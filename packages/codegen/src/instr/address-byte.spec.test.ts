/**
 * Specification tests for a selected address byte reaching the assembler as an
 * assembler-resolved immediate.
 *
 * An address is a link-time constant (frozen spec Ch 04 §8.5), so one byte of
 * it is a link-time constant too: `lo(&X)` is `#<X` and `hi(&X)` is `#>X` — one
 * instruction, no runtime arithmetic, and no scratch word to home the address
 * in first. That holds uniformly for every operand kind `&` accepts (module
 * variable, local, const aggregate, function entry) and in every position a
 * byte value is legal, not only as a `poke` value: an array index, a `let`
 * initialiser and a plain assignment all take one.
 *
 * Programs run the REAL pipeline: frontend → IL lowering → instruction
 * translation → ACME serialization. Expectations derive from that documented
 * shape and the symbol mapping the address-of lowering tests record — never
 * from reading the implementation.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, DEFAULT_PROFILE } from "@blend65/core";
import type { Diagnostic, ProgramNode } from "@blend65/core";
import {
  analyze,
  lex,
  modelNeedsPointerScratch,
  modelToFunctionInfo,
  modelToModuleVars,
  parse,
  planAllocation,
} from "@blend65/frontend";
import { lowerToIL } from "../il/lower.js";
import { generateInstr } from "./instr-program.js";
import { serializeToAcme } from "./serialize-acme.js";

/** Compiles sources through the real pipeline to ACME text. */
function toAsm(source: string): {
  asm: string;
  hasErrors: boolean;
  diags: Diagnostic[];
} {
  const bag = createDiagnosticBag();
  const programs: ProgramNode[] = [source].map((text, i) => {
    const { tokens } = lex(i + 1, text, bag);
    return parse({ tokens, source: text, sourceId: i + 1, bag }).ast;
  });
  const model = analyze({ programs, bag, profile: DEFAULT_PROFILE });
  const plan = planAllocation(
    {
      functions: modelToFunctionInfo(model),
      moduleVars: modelToModuleVars(model),
      zpUserVars: [],
      upstreamErrors: bag.hasErrors(),
      needsPointerScratch: modelNeedsPointerScratch(model),
    },
    DEFAULT_PROFILE,
    bag,
  );
  const il = lowerToIL({ program: programs, model, plan }, bag);
  const program = generateInstr(il, "nmos6502", bag);
  return { asm: serializeToAcme(program), hasErrors: bag.hasErrors(), diags: bag.getAll() };
}

/** The emitted instruction lines, trimmed — symbol definitions and labels dropped. */
function instructions(asm: string): string[] {
  return asm
    .split("\n")
    .filter((line) => /^\s+[A-Z]{3}\b/.test(line))
    .map((line) => line.trim());
}

/**
 * Asserts `want` appears in order (gaps allowed) among the emitted instructions.
 * Constant addresses are matched with a leading-zero wildcard, so these tests
 * pin the operand selected — not how wide the serializer prints a hex address.
 */
function expectSubsequence(asm: string, want: readonly RegExp[]): void {
  const lines = instructions(asm);
  let at = 0;
  for (const wanted of want) {
    const found = lines.findIndex((line, i) => i >= at && wanted.test(line));
    expect(
      found,
      `${wanted.source} not found after index ${at} in:\n${lines.join("\n")}`,
    ).toBeGreaterThanOrEqual(at);
    at = found + 1;
  }
}

/** An exact-instruction matcher, with `$`-address operands leading-zero tolerant. */
function line(text: string): RegExp {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\\\$0*/g, "\\$0*")}$`);
}

/**
 * Instruction lines that read or write a synthetic scratch slot. A byte select
 * needs none: homing an address into one only to read a byte back out is the
 * cost this shape exists to remove.
 */
function scratchTraffic(asm: string): string[] {
  return instructions(asm).filter((line) => /_0sc\d/.test(line));
}

const PROGRAM_HEAD = ["module Main;", "const SPRITE: byte[3] = [1, 2, 3];"].join("\n");

describe("Specification: a byte of an address is one immediate (ST-13a, ST-13b)", () => {
  it("ST-13a: hi(&X) is a single #> select feeding the multiply, with no scratch slot", () => {
    const { asm, hasErrors } = toAsm(
      [PROGRAM_HEAD, "function main(): void {", "  poke($07F8, hi(&SPRITE) * 4);", "}"].join("\n"),
    );
    expect(hasErrors).toBe(false);
    expectSubsequence(asm, [
      line("LDA #>__data_Main_SPRITE"),
      line("ASL"),
      line("ASL"),
      line("STA $07F8"),
    ]);
    expect(scratchTraffic(asm)).toEqual([]);
  });

  it("ST-13b: lo(&X) is a single #< select feeding the store, with no scratch slot", () => {
    const { asm, hasErrors } = toAsm(
      [PROGRAM_HEAD, "function main(): void {", "  poke($07F9, lo(&SPRITE));", "}"].join("\n"),
    );
    expect(hasErrors).toBe(false);
    expectSubsequence(asm, [line("LDA #<__data_Main_SPRITE"), line("STA $07F9")]);
    expect(scratchTraffic(asm)).toEqual([]);
  });
});

describe("Specification: the byte select is uniform across kinds and positions (ST-13g)", () => {
  it("ST-13g: all four operand kinds select from their own symbol", () => {
    const { asm, hasErrors } = toAsm(
      [
        "module Main;",
        "let m: byte = 0;",
        "const T: byte[3] = [1, 2, 3];",
        "function helper(): void { }",
        "function main(): void {",
        "  let l: byte = 2;",
        "  poke($0400, lo(&m));",
        "  poke($0401, lo(&l));",
        "  poke($0402, lo(&T));",
        "  poke($0403, lo(&helper));",
        "  poke($0404, hi(&m));",
        "  poke($0405, hi(&l));",
        "  poke($0406, hi(&T));",
        "  poke($0407, hi(&helper));",
        "}",
      ].join("\n"),
    );
    expect(hasErrors).toBe(false);
    // A module variable addresses its allocation slot, a local its frame slot, a
    // const aggregate its data image, and a function its emitted entry label.
    expectSubsequence(asm, [
      line("LDA #<__var_Main_m"),
      line("STA $0400"),
      line("LDA #<__frame_Main_main_l"),
      line("STA $0401"),
      line("LDA #<__data_Main_T"),
      line("STA $0402"),
      line("LDA #<Main_helper"),
      line("STA $0403"),
      line("LDA #>__var_Main_m"),
      line("STA $0404"),
      line("LDA #>__frame_Main_main_l"),
      line("STA $0405"),
      line("LDA #>__data_Main_T"),
      line("STA $0406"),
      line("LDA #>Main_helper"),
      line("STA $0407"),
    ]);
    expect(scratchTraffic(asm)).toEqual([]);
  });

  it("ST-13g: an address byte is a legal array index", () => {
    const { asm, hasErrors } = toAsm(
      [
        "module Main;",
        "let m: byte = 0;",
        "const TBL: byte[4] = [1, 2, 3, 4];",
        "function main(): void {",
        "  poke($D020, TBL[lo(&m)]);",
        "}",
      ].join("\n"),
    );
    expect(hasErrors).toBe(false);
    expectSubsequence(asm, [
      line("LDX #<__var_Main_m"),
      line("LDA __data_Main_TBL,X"),
      line("STA $D020"),
    ]);
    expect(scratchTraffic(asm)).toEqual([]);
  });

  it("ST-13g: an address byte is a legal let initialiser and assignment source", () => {
    const { asm, hasErrors } = toAsm(
      [
        "module Main;",
        "let m: byte = 0;",
        "let v: byte = 0;",
        "function main(): void {",
        "  let b: byte = lo(&m);",
        "  v = hi(&m);",
        "  poke($0400, b);",
        "}",
      ].join("\n"),
    );
    expect(hasErrors).toBe(false);
    expectSubsequence(asm, [
      line("LDA #<__var_Main_m"),
      line("STA __frame_Main_main_b"),
      line("LDA #>__var_Main_m"),
      line("STA __var_Main_v"),
    ]);
    expect(scratchTraffic(asm)).toEqual([]);
  });
});
