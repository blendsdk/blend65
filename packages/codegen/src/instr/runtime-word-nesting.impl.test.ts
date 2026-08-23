/**
 * Source-level regressions for word runtime operators whose operands are
 * user-call results. They pin evaluation order, coherent A:X preservation,
 * strength reduction, and non-commutative operand marshalling.
 */

import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { Diagnostic, ProgramNode } from "@blend65/core";
import {
  analyze,
  lex,
  modelToFunctionInfo,
  modelToModuleVars,
  parse,
  planAllocation,
} from "@blend65/frontend";
import { describe, expect, it } from "vitest";

import { lowerToIL } from "../il/lower.js";
import { generateInstr } from "./instr-program.js";
import { printInstr } from "./print-instr.js";

/** Compile one source through the real frontend, allocator, IL, and instruction selector. */
function asmSource(source: string): { readonly text: string; readonly diagnostics: Diagnostic[] } {
  const bag = createDiagnosticBag();
  const { tokens } = lex(1, source, bag);
  const program: ProgramNode = parse({ tokens, source, sourceId: 1, bag }).ast;
  const model = analyze({ programs: [program], bag, profile: DEFAULT_PROFILE });
  const plan = planAllocation(
    {
      functions: modelToFunctionInfo(model),
      moduleVars: modelToModuleVars(model),
      zpUserVars: [],
      upstreamErrors: bag.hasErrors(),
    },
    DEFAULT_PROFILE,
    bag,
  );
  const il = lowerToIL({ program: [program], model, plan }, bag);
  const generated = generateInstr(il, "nmos6502", bag);
  return {
    text: generated.streams.map(printInstr).join("\n\n"),
    diagnostics: bag.getAll(),
  };
}

/** Return one function's trimmed executable lines, excluding its label. */
function functionLines(text: string, label: string): readonly string[] {
  const lines = text.split("\n");
  const start = lines.indexOf(`${label}:`);
  expect(start, `missing function ${label}`).toBeGreaterThanOrEqual(0);
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^[A-Za-z_][A-Za-z0-9_]*:$/.test(line)) break;
    if (line.trim().length > 0) body.push(line.trim());
  }
  return body;
}

/** Build a complete program whose `read` returns the selected expression byte. */
function programFor(expression: string): string {
  return [
    "module Main;",
    "let sink: byte;",
    "function value(): word { return $1234; }",
    "function other(): word { return $0003; }",
    `function read(): byte { return ${expression}; }`,
    "function main(): void { sink = read(); }",
  ].join("\n");
}

/** Assert that compilation produced no error or internal diagnostic. */
function expectClean(diagnostics: readonly Diagnostic[]): void {
  expect(diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
  expect(diagnostics.filter(({ code }) => code.startsWith("E9"))).toEqual([]);
}

/** Exact selected result for a constant word left shift from a call-returned A:X value. */
function selectedLeftShiftLines(count: number): readonly string[] {
  if (count === 0) return ["JSR Main_value", "TXA", "RTS"];
  if (count === 1) return ["JSR Main_value", "ASL", "TXA", "ROL", "RTS"];
  if (count <= 3) {
    const body = ["JSR Main_value"];
    for (let step = 0; step < count; step++) {
      body.push("ASL");
      if (step + 1 < count) body.push("PHA");
      body.push("TXA", "ROL");
      if (step + 1 < count) body.push("TAX", "PLA");
    }
    return [...body, "RTS"];
  }
  if (count <= 7) {
    return [
      "JSR Main_value",
      "TAY",
      "TXA",
      ...Array.from({ length: count }, () => "ASL"),
      "PHA",
      "TYA",
      ...Array.from({ length: 8 - count }, () => "LSR"),
      "TSX",
      "INX",
      "ORA $0100,X",
      "TXS",
      "RTS",
    ];
  }
  if (count <= 15) {
    return ["JSR Main_value", ...Array.from({ length: count - 8 }, () => "ASL"), "RTS"];
  }
  return ["JSR Main_value", "LDA #$00", "RTS"];
}

describe("selected word runtime operators", () => {
  it.each([
    { expression: "hi(value() * 2)", expected: ["JSR Main_value", "ASL", "TXA", "ROL", "RTS"] },
    { expression: "hi(value() / 2)", expected: ["JSR Main_value", "TXA", "LSR", "RTS"] },
    { expression: "hi(value() % 2)", expected: ["JSR Main_value", "LDA #$00", "RTS"] },
  ])("should strength-reduce $expression after evaluating its call", ({ expression, expected }) => {
    const result = asmSource(programFor(expression));
    const lines = functionLines(result.text, "Main_read");

    expectClean(result.diagnostics);
    expect(lines).toEqual(expected);
    expect(lines.some((line) => line.startsWith("JSR __rt_"))).toBe(false);
  });

  it("should strength-reduce signed word multiplication by a power of two", () => {
    const source = [
      "module Main;",
      "function value(): sword { return -1000; }",
      "function read(): byte { return hi(value() * 2); }",
      "function main(): void { let sink: byte = read(); }",
    ].join("\n");
    const result = asmSource(source);

    expectClean(result.diagnostics);
    expect(functionLines(result.text, "Main_read")).toEqual([
      "JSR Main_value",
      "ASL",
      "TXA",
      "ROL",
      "RTS",
    ]);
  });

  it.each([
    { expression: "hi(value() * 0)", expected: ["JSR Main_value", "LDA #$00", "RTS"] },
    { expression: "hi(value() * 1)", expected: ["JSR Main_value", "TXA", "RTS"] },
    { expression: "hi(value() * 256)", expected: ["JSR Main_value", "RTS"] },
    {
      expression: "hi(value() * 32768)",
      expected: ["JSR Main_value", "ASL", "ASL", "ASL", "ASL", "ASL", "ASL", "ASL", "RTS"],
    },
    { expression: "hi(value() / 1)", expected: ["JSR Main_value", "TXA", "RTS"] },
    { expression: "hi(value() / 256)", expected: ["JSR Main_value", "LDA #$00", "RTS"] },
    { expression: "hi(value() % 256)", expected: ["JSR Main_value", "LDA #$00", "RTS"] },
    {
      expression: "hi(value() % 32768)",
      expected: ["JSR Main_value", "TXA", "AND #$7F", "RTS"],
    },
  ])("should emit the exact high-byte result for $expression", ({ expression, expected }) => {
    const result = asmSource(programFor(expression));

    expectClean(result.diagnostics);
    expect(functionLines(result.text, "Main_read")).toEqual(expected);
  });

  it.each([
    { expression: "hi(value() * 3)", routine: "__rt_mul16" },
    { expression: "hi(value() / 3)", routine: "__rt_div16" },
    { expression: "hi(value() % 3)", routine: "__rt_div16" },
  ])("should retain the runtime fallback for non-power $expression", ({ expression, routine }) => {
    const result = asmSource(programFor(expression));
    const lines = functionLines(result.text, "Main_read");

    expectClean(result.diagnostics);
    expect(lines).toContain(`JSR ${routine}`);
    expect(lines).not.toContain("STA __zp_tmp_0");
    expect(lines).toContain("TAY");
    expect(lines).toContain("TYA");
  });
});

describe("selected word shift boundaries", () => {
  it.each([0, 1, 3, 4, 7, 8, 15, 16, 255])(
    "should emit the exact high result for value() << %d",
    (count) => {
      const result = asmSource(programFor(`hi(value() << ${count})`));

      expectClean(result.diagnostics);
      expect(functionLines(result.text, "Main_read")).toEqual(selectedLeftShiftLines(count));
    },
  );

  it.each([0, 1, 3, 4, 7, 8, 15, 16, 255])(
    "should saturate unsigned value() >> %d at eight",
    (count) => {
      const result = asmSource(programFor(`hi(value() >> ${count})`));
      const expected =
        count >= 8
          ? ["JSR Main_value", "LDA #$00", "RTS"]
          : ["JSR Main_value", "TXA", ...Array.from({ length: count }, () => "LSR"), "RTS"];

      expectClean(result.diagnostics);
      expect(functionLines(result.text, "Main_read")).toEqual(expected);
    },
  );

  it.each([0, 1, 3, 4, 7, 8, 15, 16, 255])(
    "should saturate signed value() >> %d from the original sign",
    (count) => {
      const source = [
        "module Main;",
        "function value(): sword { return -28108; }",
        `function read(): byte { return hi(value() >> ${count}); }`,
        "function main(): void { let sink: byte = read(); }",
      ].join("\n");
      const result = asmSource(source);
      const expected =
        count >= 8
          ? ["JSR Main_value", "TXA", "ASL", "LDA #$00", "ADC #$FF", "EOR #$FF", "RTS"]
          : [
              "JSR Main_value",
              "TXA",
              ...Array.from({ length: count }, () => ["CMP #$80", "ROR"]).flat(),
              "RTS",
            ];

      expectClean(result.diagnostics);
      expect(functionLines(result.text, "Main_read")).toEqual(expected);
    },
  );

  it.each(["<<", ">>"])("should evaluate call operands once for a variable %s count", (op) => {
    const source = [
      "module Main;",
      "function value(): word { return $9234; }",
      "function count(): byte { return 15; }",
      `function read(): byte { return hi(value() ${op} count()); }`,
      "function main(): void { let sink: byte = read(); }",
    ].join("\n");
    const result = asmSource(source);
    const lines = functionLines(result.text, "Main_read");

    expectClean(result.diagnostics);
    expect(lines.filter((line) => line === "JSR Main_value")).toHaveLength(1);
    expect(lines.filter((line) => line === "JSR Main_count")).toHaveLength(1);
    expect(lines.filter((line) => line === "TAY")).toHaveLength(1);
    expect(lines).toContain(op === "<<" ? "CPY #$10" : "CPY #$08");
  });
});

describe("two nested word-call operands", () => {
  it.each([
    { expression: "hi(value() * other())", routine: "__rt_mul16" },
    { expression: "hi(value() / other())", routine: "__rt_div16" },
    { expression: "hi(value() % other())", routine: "__rt_div16" },
  ])("should preserve left-to-right meaning for $expression", ({ expression, routine }) => {
    const result = asmSource(programFor(expression));
    const lines = functionLines(result.text, "Main_read");
    const leftCall = lines.indexOf("JSR Main_value");
    const rightCall = lines.indexOf("JSR Main_other");
    const runtimeCall = lines.indexOf(`JSR ${routine}`);

    expectClean(result.diagnostics);
    expect(leftCall).toBeGreaterThanOrEqual(0);
    expect(lines.slice(leftCall + 1, rightCall)).toEqual(["STA __zp_tmp_0", "STX __zp_tmp_1"]);
    expect(rightCall).toBeGreaterThan(leftCall);
    expect(lines.slice(rightCall + 1, runtimeCall)).toEqual([
      "STA __zp_arg_0",
      "STX __zp_arg_1",
      "LDX __zp_tmp_1",
      "LDA __zp_tmp_0",
    ]);
    expect(runtimeCall).toBeGreaterThan(rightCall);
    expect(lines.at(-2)).toBe(expression.includes("%") ? "LDA __zp_arg_1" : "TXA");
    expect(lines.at(-1)).toBe("RTS");
  });

  it("should snapshot the left call before marshalling the right call's argument", () => {
    const source = [
      "module Main;",
      "function value(): word { return $1234; }",
      "function other(n: word): word { return n; }",
      "function read(): byte { return hi(value() / other(3)); }",
      "function main(): void { let sink: byte = read(); }",
    ].join("\n");
    const result = asmSource(source);
    const lines = functionLines(result.text, "Main_read");
    const leftCall = lines.indexOf("JSR Main_value");
    const argumentStore = lines.indexOf("STA __frame_Main_other_n");
    const rightCall = lines.indexOf("JSR Main_other");

    expectClean(result.diagnostics);
    expect(lines.slice(leftCall + 1, argumentStore)).toEqual([
      "STA __zp_tmp_0",
      "STX __zp_tmp_1",
      "LDA #$03",
      "LDX #$00",
    ]);
    expect(argumentStore).toBeGreaterThan(leftCall);
    expect(rightCall).toBeGreaterThan(argumentStore);
    expect(lines).toContain("LDX __zp_tmp_1");
    expect(lines).toContain("LDA __zp_tmp_0");
  });

  it("should reuse one word snapshot across three sequential nested expressions", () => {
    const source = [
      "module Main;",
      "function value(): word { return $1234; }",
      "function other(): word { return $0102; }",
      "function read(): byte {",
      "  let first: byte = hi(value() + other());",
      "  let second: byte = hi(value() + other());",
      "  let third: byte = hi(value() + other());",
      "  return first + second + third;",
      "}",
      "function main(): void { let sink: byte = read(); }",
    ].join("\n");
    const result = asmSource(source);
    const lines = functionLines(result.text, "Main_read");

    expectClean(result.diagnostics);
    expect(lines.filter((line) => line === "STA __zp_tmp_0")).toHaveLength(3);
    expect(lines.filter((line) => line === "STX __zp_tmp_1")).toHaveLength(3);
    expect(lines.some((line) => line.includes("__zp_tmp_2"))).toBe(false);
    expect(lines.some((line) => line.includes("__zp_tmp_3"))).toBe(false);
  });
});

describe("selected word producers nested in byte expressions", () => {
  it.each([
    { expression: "hi(a + b)", selected: ["LDA __frame_Main_read_a", "ADC __frame_Main_read_b"] },
    { expression: "hi(a * 2)", selected: ["ASL", "ROL"] },
    { expression: "hi(a / 3)", selected: ["JSR __rt_div16", "TXA"] },
  ])("should preserve the outer byte while evaluating $expression", ({ expression, selected }) => {
    const source = [
      "module Main;",
      "function byteValue(): byte { return 5; }",
      `function read(a: word, b: word): byte { return byteValue() + ${expression}; }`,
      "function main(): void { let sink: byte = read($1201, $0234); }",
    ].join("\n");
    const result = asmSource(source);
    const lines = functionLines(result.text, "Main_read");
    const outerCall = lines.indexOf("JSR Main_byteValue");
    const spill = lines.indexOf("STA __zp_tmp_0");
    const outerAdd = lines.lastIndexOf("ADC __zp_tmp_0");

    expectClean(result.diagnostics);
    expect(outerCall).toBeGreaterThanOrEqual(0);
    expect(spill).toBe(outerCall + 1);
    for (const instruction of selected) expect(lines).toContain(instruction);
    expect(outerAdd).toBeGreaterThan(spill);
    expect(lines.at(-1)).toBe("RTS");
  });
});
