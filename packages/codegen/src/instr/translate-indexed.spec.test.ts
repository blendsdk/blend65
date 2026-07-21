/**
 * Specification tests for indexed translation and const-data emission: the
 * tier-1 `abs,X` framings (`LDX` index, `LDA/STA sym+k,X`), index scaling's
 * warning attribution (power-of-two element sizes strength-reduce to shifts;
 * only non-power-of-two sizes call the runtime multiply), load-result homing
 * (an indexed read feeding further arithmetic must compile, never die in the
 * register binder), the fail-loud word-store rule (a register-resident word
 * source is rejected, never silently stored as the index), the documented
 * pointer-tier boundary, `!byte` data streams serialized after code, and the
 * user-written power-of-two multiply's own exclusion from that same warning.
 *
 * Programs run the REAL pipeline: frontend → IL lowering → instruction
 * translation → ACME serialization. Expectations derive from the documented
 * framings and the frozen spec — never from reading the implementation.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE, DiagCode, isIceCode } from "@blend65/core";
import type { Diagnostic, ProgramNode } from "@blend65/core";
import {
  analyze,
  lex,
  modelToFunctionInfo,
  modelToModuleVars,
  parse,
  planAllocation,
} from "@blend65/frontend";
import { lowerToIL } from "../il/lower.js";
import { IL_BYTE } from "../il/il-type.js";
import { loc, temp } from "../il/operand.js";
import { generateInstr } from "./instr-program.js";
import { serializeToAcme } from "./serialize-acme.js";

/** Compiles sources through the real pipeline to ACME text. */
function toAsm(sources: readonly string[]): {
  asm: string;
  hasErrors: boolean;
  diags: Diagnostic[];
} {
  const bag = createDiagnosticBag();
  const programs: ProgramNode[] = sources.map((source, i) => {
    const { tokens } = lex(i + 1, source, bag);
    return parse({ tokens, source, sourceId: i + 1, bag }).ast;
  });
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE });
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
  const il = lowerToIL({ program: programs, model, plan }, bag);
  const program = generateInstr(il, "nmos6502", bag);
  return { asm: serializeToAcme(program), hasErrors: bag.hasErrors(), diags: bag.getAll() };
}

describe("Specification: indexed framings (ST-53, ST-53a, ST-54, ST-54a)", () => {
  it("ST-53: a runtime byte index reads as LDX-then-LDA sym,X (AbsoluteX)", () => {
    const { asm, hasErrors } = toAsm([
      "module Main;\nlet a: byte[10] = [; 0];\n" +
        "function main(): void { let i: byte = 1; poke($C000, a[i]); }\n",
    ]);
    expect(hasErrors).toBe(false);
    expect(asm).toMatch(/LDX .*\n.*LDA __var_Main_a,X/);
  });

  it("ST-53a: an indexed read feeding arithmetic compiles — the result is homed", () => {
    const { asm, hasErrors, diags } = toAsm([
      "module Main;\nlet a: byte[5] = [1, 2, 3; 4];\n" +
        "function main(): void {\n" +
        "  let sum: byte = 0;\n  let i: byte = 0;\n" +
        "  sum = sum + a[i];\n  poke($C000, sum);\n}\n",
    ]);
    expect(diags.filter((d) => isIceCode(d.code))).toEqual([]);
    expect(hasErrors).toBe(false);
    expect(asm).toContain("LDA __var_Main_a,X");
  });

  it("ST-54: a word-element read stashes both bytes to the destination home", () => {
    const { asm, hasErrors } = toAsm([
      "module Main;\nlet w: word[3] = [; 0];\nlet out: word;\n" +
        "function main(): void { let i: byte = 1; out = w[i]; }\n",
    ]);
    expect(hasErrors).toBe(false);
    // lo byte then hi byte, each read indexed and stored immediately.
    expect(asm).toMatch(/LDA __var_Main_w,X\n\s+STA __var_Main_out/);
    expect(asm).toMatch(/LDA __var_Main_w\+1,X\n\s+STA __var_Main_out\+1/);
  });

  it("ST-54a: a word store from a register-resident source rejects loudly — never X-as-data", () => {
    const { asm, diags } = toAsm([
      "module Main;\nlet w: word[3] = [; 0];\n" +
        "function f(): word { return 258; }\n" +
        "function main(): void { let i: byte = 1; w[i] = f(); }\n",
    ]);
    // Correct code or a loud reject are both within contract; silent
    // TXA-as-high-byte is not. The shipped framing rejects.
    const rejected = diags.some((d) => isIceCode(d.code));
    const compiled = !rejected && /LDX/.test(asm);
    expect(rejected || compiled).toBe(true);
    if (compiled) {
      // If it compiled, the high byte must come from memory, not TXA after LDX.
      expect(asm).not.toMatch(/LDX [^\n]*\n(?:[^\n]*\n)*?\s+TXA/);
    }
  });
});

describe("Specification: scaling warnings (ST-51a, ST-51b)", () => {
  // OP-5 (spec/evaluations/F017-operators.md:442) states the shift-and-add warning
  // "does NOT trigger for power-of-2 constants (which use cheap shifts)". A 2-byte
  // element scale is exactly that case, and it is the compiler's own multiply — the
  // user wrote an index, not an arithmetic expression to reconsider.
  it("ST-51a: a 2-byte element scale strength-reduces to ASL with no W10172 — no runtime multiply", () => {
    const { asm, diags, hasErrors } = toAsm([
      "module Main;\nstruct Point { x: byte; y: byte; }\n" +
        "let pts: Point[4];\n" +
        "function main(): void { let i: byte = 1; pts[i].x = 5; }\n",
    ]);
    expect(hasErrors).toBe(false);
    expect(asm).toContain("ASL");
    expect(asm).not.toContain("__rt_mul8");
    expect(diags.some((d) => d.code === DiagCode.ShiftAndAddMultiply)).toBe(false);
    expect(diags.some((d) => d.code === DiagCode.RuntimeMultiply)).toBe(false);
  });

  it("ST-51b: a 3-byte element scale calls __rt_mul8 with W10170", () => {
    const { asm, diags, hasErrors } = toAsm([
      "module Main;\nstruct Rgb { r: byte; g: byte; b: byte; }\n" +
        "let px: Rgb[4];\n" +
        "function main(): void { let i: byte = 1; px[i].r = 5; }\n",
    ]);
    expect(hasErrors).toBe(false);
    expect(asm).toContain("__rt_mul8");
    expect(diags.some((d) => d.code === DiagCode.RuntimeMultiply)).toBe(true);
  });
});

describe("Specification: a user-written power-of-two multiply (ST-13c)", () => {
  // The companion to ST-51a on the other side of authorship: here the multiply IS
  // the user's own, written in source, and it still must not warn. OP-5
  // (spec/evaluations/F017-operators.md:442) excludes power-of-2 constants because
  // they lower to cheap shifts — advising "consider power-of-2 stride" about a
  // stride that already is one has nothing to tell the developer.
  //
  // The multiplicand is a raster read, so the product is genuinely computed at run
  // time and cannot be folded away by any future constant propagation.
  it("ST-13c: `peek($D012) * 4` shifts twice, calls no runtime multiply, and warns nothing", () => {
    const { asm, diags, hasErrors } = toAsm([
      "module Main;\nfunction main(): void { poke($0400, peek($D012) * 4); }\n",
    ]);
    expect(hasErrors).toBe(false);
    expect(asm.match(/^\s*ASL\b/gm) ?? []).toHaveLength(2);
    expect(asm).not.toContain("__rt_mul8");
    expect(diags.some((d) => d.code === DiagCode.ShiftAndAddMultiply)).toBe(false);
    expect(diags.some((d) => d.code === DiagCode.RuntimeMultiply)).toBe(false);
  });
});

describe("Specification: data streams & the pointer-tier boundary (ST-55, ST-56, ST-57)", () => {
  it("ST-55: const data serializes as a labeled !byte block AFTER the code", () => {
    const { asm, hasErrors } = toAsm([
      "module Main;\n" +
        "const TABLE: byte[20] = [1, 2, 3; 9];\n" +
        "function main(): void { let i: byte = 1; poke($C000, TABLE[i]); }\n",
    ]);
    expect(hasErrors).toBe(false);
    expect(asm).toContain("__data_Main_TABLE:");
    expect(asm).toContain("!byte");
    // Rows cap at 16 values — 20 bytes need at least two !byte rows.
    const rows = asm.split("\n").filter((l) => l.includes("!byte"));
    expect(rows.length).toBeGreaterThanOrEqual(2);
    // Data comes after the code streams.
    expect(asm.indexOf("__data_Main_TABLE:")).toBeGreaterThan(asm.indexOf("_main:"));
  });

  it("ST-56: a load_indirect reaching translate stays a documented loud boundary", () => {
    // A real (empty) program supplies a well-formed allocation plan; the
    // indirect instruction is injected into the lowered IL.
    const bag = createDiagnosticBag();
    const source = "module Main;\nfunction main(): void { }\n";
    const { tokens } = lex(1, source, bag);
    const { ast } = parse({ tokens, source, sourceId: 1, bag });
    const model = analyze({ programs: [ast], bag, profile: DEFAULT_PROFILE });
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
    const real = lowerToIL({ program: [ast], model, plan }, bag);
    const injected = {
      ...real,
      functions: [
        {
          ...real.functions[0]!,
          tempCount: 2,
          blocks: [
            {
              ...real.functions[0]!.blocks[0]!,
              instructions: [
                {
                  op: "load_indirect" as const,
                  value: temp(0, IL_BYTE),
                  ptr: loc("__zp_p", IL_BYTE),
                  offset: temp(1, IL_BYTE),
                },
              ],
            },
          ],
        },
      ],
    };
    // The indirect ops are the pointer-tier surface — not yet supported.
    generateInstr(injected as never, "nmos6502", bag);
    expect(bag.getAll().some((d) => isIceCode(d.code))).toBe(true);
  });

  it("ST-57: a whole-struct copy unrolls to per-byte moves at +0/+1/+2", () => {
    const { asm, hasErrors } = toAsm([
      "module Main;\nstruct P { x: byte; y: byte; z: byte; }\n" +
        "let a: P;\nlet b: P;\n" +
        "function main(): void { b = a; }\n",
    ]);
    expect(hasErrors).toBe(false);
    expect(asm).toMatch(/LDA __var_Main_a\n\s+STA __var_Main_b/);
    expect(asm).toMatch(/LDA __var_Main_a\+1\n\s+STA __var_Main_b\+1/);
    expect(asm).toMatch(/LDA __var_Main_a\+2\n\s+STA __var_Main_b\+2/);
  });
});
