/**
 * Specification tests for the expression translator additions: unary
 * negate/complement, the width conversions, the four comparison framings
 * (byte/word × unsigned/signed), and word + variable-count shifts.
 *
 * Immutable oracles: expected ACME shapes derive from 6502 semantics — the
 * two's-complement identities, the carry/N⊕V comparison idioms, and the
 * ASL/ROL · LSR/ROR shift chains — never from running the translator.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, type AllocationPlan, type ZpAllocation } from "@blend65/core";

import { imm, loc, temp } from "../il/operand.js";
import { IL_BYTE, IL_SBYTE, IL_SWORD, IL_WORD } from "../il/il-type.js";
import type { ILInstruction, ILTerminator } from "../il/instruction.js";
import type { ILFunction } from "../il/cfg.js";
import { printInstr } from "./print-instr.js";
import { translateFunction } from "./translate.js";

/** Build a minimal `AllocationPlan` exposing the given temp ZP scratch slots. */
function makePlan(tempSlotNames: readonly string[] = []): AllocationPlan {
  const zpAllocations: ZpAllocation[] = tempSlotNames.map((name, i) => ({
    name,
    address: 0x10 + i,
    size: 1,
    category: "temp",
  }));
  return {
    frames: new Map(),
    dataBase: 0,
    frameRegionBase: 0,
    frameRegionSize: 0,
    peakSimultaneous: 0,
    sharingSaved: 0,
    zpAllocations,
    zpUsed: zpAllocations.length,
    zpBudget: 256,
    moduleVariables: [],
    moduleVariablesSize: 0,
    stackAnalysis: {
      maxMainDepth: 0,
      maxMainStackBytes: 0,
      maxIrqDepth: 0,
      maxIrqStackBytes: 0,
      irqOverhead: 0,
      totalWorstCase: 0,
      platformBudget: 256,
      exceedsWarningThreshold: false,
    },
    symbolDefinitions: [],
    resourceData: {
      frameRegionBytes: 0,
      frameRegionPeak: 0,
      frameSharingSaved: 0,
      zpUsed: zpAllocations.length,
      zpBudget: 256,
      ramUsed: 0,
      ramBudget: 0,
      stackWorstCase: 0,
      stackBudget: 256,
    },
    hasErrors: false,
  };
}

/** Assemble a single-block `ILFunction` named `M.f` from instructions + terminator. */
function makeFn(
  instructions: readonly ILInstruction[],
  terminator: ILTerminator,
  opts: { returnType?: ILFunction["returnType"]; tempCount?: number } = {},
): ILFunction {
  return {
    name: "M.f",
    params: [],
    returnType: opts.returnType ?? "void",
    blocks: [{ label: "_entry", instructions, terminator }],
    tempCount: opts.tempCount ?? 8,
    isInterrupt: false,
  };
}

/** Translate and render to canonical ACME text. */
function render(
  instructions: readonly ILInstruction[],
  terminator: ILTerminator,
  opts?: Parameters<typeof makeFn>[2],
): { text: string; bag: ReturnType<typeof createDiagnosticBag> } {
  const bag = createDiagnosticBag();
  const stream = translateFunction(
    makeFn(instructions, terminator, opts),
    makePlan(),
    "nmos6502",
    bag,
  );
  return { text: printInstr(stream), bag };
}

/** Shorthand: the multi-line snippet joined the way `printInstr` renders. */
function lines(...ls: string[]): string {
  return ls.map((l) => `    ${l}`).join("\n");
}

describe("Specification: unary negate and complement", () => {
  it("negates an 8-bit signed value as two's complement (EOR/ADC)", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_SBYTE), b: loc("S", IL_SBYTE) },
        { op: "neg", dest: temp(1, IL_SBYTE), src: temp(0, IL_SBYTE), type: IL_SBYTE },
      ],
      { kind: "ret", value: temp(1, IL_SBYTE) },
      { returnType: IL_SBYTE },
    );
    expect(bag.hasErrors()).toBe(false);
    expect(text).toContain(lines("LDA S", "EOR #$FF", "CLC", "ADC #$01"));
  });

  it("negates a 16-bit value as 0 minus x through the store home", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_SWORD), b: loc("W", IL_SWORD) },
        { op: "neg", dest: temp(1, IL_SWORD), src: temp(0, IL_SWORD), type: IL_SWORD },
        { op: "store", a: temp(1, IL_SWORD), b: loc("R", IL_SWORD) },
      ],
      { kind: "ret" },
    );
    expect(bag.hasErrors()).toBe(false);
    expect(text).toContain(
      lines("SEC", "LDA #$00", "SBC W", "STA R", "LDA #$00", "SBC W+1", "STA R+1"),
    );
  });

  it("complements 8-bit with EOR #$FF and 16-bit per byte through the home", () => {
    const byte = render(
      [
        { op: "load", a: temp(0, IL_BYTE), b: loc("B", IL_BYTE) },
        { op: "not", dest: temp(1, IL_BYTE), src: temp(0, IL_BYTE), type: IL_BYTE },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
      { returnType: IL_BYTE },
    );
    expect(byte.bag.hasErrors()).toBe(false);
    expect(byte.text).toContain(lines("LDA B", "EOR #$FF"));

    const word = render(
      [
        { op: "load", a: temp(0, IL_WORD), b: loc("W", IL_WORD) },
        { op: "not", dest: temp(1, IL_WORD), src: temp(0, IL_WORD), type: IL_WORD },
        { op: "store", a: temp(1, IL_WORD), b: loc("R", IL_WORD) },
      ],
      { kind: "ret" },
    );
    expect(word.bag.hasErrors()).toBe(false);
    expect(word.text).toContain(
      lines("LDA W", "EOR #$FF", "STA R", "LDA W+1", "EOR #$FF", "STA R+1"),
    );
  });
});

describe("Specification: width conversions", () => {
  it("zero-extends into a word store with a constant 0 high byte", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_BYTE), b: loc("B", IL_BYTE) },
        { op: "zext", dest: temp(1, IL_WORD), src: temp(0, IL_BYTE) },
        { op: "store", a: temp(1, IL_WORD), b: loc("R", IL_WORD) },
      ],
      { kind: "ret" },
    );
    expect(bag.hasErrors()).toBe(false);
    // The high byte is the constant 0 — no memory read beyond the byte source.
    expect(text).toContain("LDA B");
    expect(text).toContain("STA R");
    expect(text).toContain("R+1");
    expect(text).not.toContain("B+1");
  });

  it("folds a zero-extended operand into word arithmetic (lo from source, hi #$00)", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_WORD), b: loc("W", IL_WORD) },
        { op: "load", a: temp(1, IL_BYTE), b: loc("B", IL_BYTE) },
        { op: "zext", dest: temp(2, IL_WORD), src: temp(1, IL_BYTE) },
        { op: "add", dest: temp(3, IL_WORD), left: temp(0, IL_WORD), right: temp(2, IL_WORD), type: IL_WORD },
        { op: "store", a: temp(3, IL_WORD), b: loc("R", IL_WORD) },
      ],
      { kind: "ret" },
    );
    expect(bag.hasErrors()).toBe(false);
    expect(text).toContain(lines("LDA W", "CLC", "ADC B", "STA R"));
    expect(text).toContain(lines("LDA W+1", "ADC #$00", "STA R+1"));
  });

  it("sign-extends into a word store (sign byte from the value's high bit)", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_SBYTE), b: loc("S", IL_SBYTE) },
        { op: "sext", dest: temp(1, IL_SWORD), src: temp(0, IL_SBYTE) },
        { op: "store", a: temp(1, IL_SWORD), b: loc("R", IL_SWORD) },
      ],
      { kind: "ret" },
    );
    expect(bag.hasErrors()).toBe(false);
    expect(text).toContain("LDA S");
    expect(text).toContain("STA R");
    // The sign byte is computed from the stored value's bit 7 and lands at +1.
    expect(text).toContain("STA R+1");
    expect(text).toContain("ASL");
  });

  it("truncates a word by reading only its low byte", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_WORD), b: loc("W", IL_WORD) },
        { op: "trunc", dest: temp(1, IL_BYTE), src: temp(0, IL_WORD) },
        { op: "store", a: temp(1, IL_BYTE), b: loc("B", IL_BYTE) },
      ],
      { kind: "ret" },
    );
    expect(bag.hasErrors()).toBe(false);
    expect(text).toContain(lines("LDA W", "STA B"));
    expect(text).not.toContain("W+1");
  });
});

describe("Specification: comparison framings", () => {
  const cmpByte = (type = IL_BYTE): ILInstruction[] => [
    { op: "load", a: temp(0, type), b: loc("L", type) },
    { op: "load", a: temp(1, type), b: loc("R", type) },
    { op: "lt", dest: temp(2, IL_BYTE), left: temp(0, type), right: temp(1, type), type },
  ];

  it("keeps the 8-bit unsigned carry framing (unchanged)", () => {
    const { text, bag } = render(cmpByte(IL_BYTE), { kind: "ret", value: temp(2, IL_BYTE) }, {
      returnType: IL_BYTE,
    });
    expect(bag.hasErrors()).toBe(false);
    expect(text).toContain("CMP R");
    expect(text).toContain("BCC");
    expect(text).not.toContain("BVC"); // no signed dance for unsigned operands
  });

  it("frames 8-bit signed ordered comparisons with the N-xor-V idiom", () => {
    const { text, bag } = render(cmpByte(IL_SBYTE), { kind: "ret", value: temp(2, IL_BYTE) }, {
      returnType: IL_BYTE,
    });
    expect(bag.hasErrors()).toBe(false);
    expect(text).toContain("SBC R");
    expect(text).toContain("BVC");
    expect(text).toContain("EOR #$80");
    expect(text).toContain("BMI");
  });

  it("compares 16-bit equality over both bytes", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_WORD), b: loc("L", IL_WORD) },
        { op: "load", a: temp(1, IL_WORD), b: loc("R", IL_WORD) },
        { op: "eq", dest: temp(2, IL_BYTE), left: temp(0, IL_WORD), right: temp(1, IL_WORD), type: IL_WORD },
      ],
      { kind: "ret", value: temp(2, IL_BYTE) },
      { returnType: IL_BYTE },
    );
    expect(bag.hasErrors()).toBe(false);
    expect(text).toContain("CMP R");
    expect(text).toContain("CMP R+1");
    expect(text).toContain("BEQ");
  });

  it("frames 16-bit unsigned ordered comparisons high byte first", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_WORD), b: loc("L", IL_WORD) },
        { op: "load", a: temp(1, IL_WORD), b: loc("R", IL_WORD) },
        { op: "lt", dest: temp(2, IL_BYTE), left: temp(0, IL_WORD), right: temp(1, IL_WORD), type: IL_WORD },
      ],
      { kind: "ret", value: temp(2, IL_BYTE) },
      { returnType: IL_BYTE },
    );
    expect(bag.hasErrors()).toBe(false);
    // Both high bytes and both low bytes participate in the decision.
    expect(text).toContain("L+1");
    expect(text).toContain("R+1");
    expect(text).toContain("BCC");
    const hiIdx = text.indexOf("CMP R+1");
    const loIdx = text.indexOf("CMP R\n");
    expect(hiIdx).toBeGreaterThanOrEqual(0);
    expect(loIdx).toBeGreaterThan(hiIdx); // high decides first, low breaks ties
  });

  it("frames 16-bit signed ordered comparisons with SBC and N-xor-V on the high byte", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_SWORD), b: loc("L", IL_SWORD) },
        { op: "load", a: temp(1, IL_SWORD), b: loc("R", IL_SWORD) },
        { op: "lt", dest: temp(2, IL_BYTE), left: temp(0, IL_SWORD), right: temp(1, IL_SWORD), type: IL_SWORD },
      ],
      { kind: "ret", value: temp(2, IL_BYTE) },
      { returnType: IL_BYTE },
    );
    expect(bag.hasErrors()).toBe(false);
    expect(text).toContain("CMP R"); // low bytes via the borrow chain
    expect(text).toContain("SBC R+1"); // high bytes signed
    expect(text).toContain("BVC");
    expect(text).toContain("EOR #$80");
  });
});

describe("Specification: shifts", () => {
  it("keeps the unrolled 8-bit constant shift (unchanged)", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_BYTE), b: loc("B", IL_BYTE) },
        { op: "shl", dest: temp(1, IL_BYTE), left: temp(0, IL_BYTE), right: imm(3, IL_BYTE), type: IL_BYTE },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
      { returnType: IL_BYTE },
    );
    expect(bag.hasErrors()).toBe(false);
    expect(text).toContain(lines("ASL", "ASL", "ASL"));
  });

  it("shifts 8-bit signed right arithmetically (sign-replicating CMP/ROR)", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_SBYTE), b: loc("S", IL_SBYTE) },
        { op: "shr", dest: temp(1, IL_SBYTE), left: temp(0, IL_SBYTE), right: imm(1, IL_BYTE), type: IL_SBYTE },
      ],
      { kind: "ret", value: temp(1, IL_SBYTE) },
      { returnType: IL_SBYTE },
    );
    expect(bag.hasErrors()).toBe(false);
    expect(text).toContain("CMP #$80");
    expect(text).toContain("ROR");
  });

  it("shifts a word left through the store home with ASL/ROL per step", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_WORD), b: loc("W", IL_WORD) },
        { op: "shl", dest: temp(1, IL_WORD), left: temp(0, IL_WORD), right: imm(2, IL_BYTE), type: IL_WORD },
        { op: "store", a: temp(1, IL_WORD), b: loc("R", IL_WORD) },
      ],
      { kind: "ret" },
    );
    expect(bag.hasErrors()).toBe(false);
    expect(text).toContain(lines("ASL R", "ROL R+1", "ASL R", "ROL R+1"));
  });

  it("shifts a word right (unsigned) with LSR/ROR from the high byte down", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_WORD), b: loc("W", IL_WORD) },
        { op: "shr", dest: temp(1, IL_WORD), left: temp(0, IL_WORD), right: imm(1, IL_BYTE), type: IL_WORD },
        { op: "store", a: temp(1, IL_WORD), b: loc("R", IL_WORD) },
      ],
      { kind: "ret" },
    );
    expect(bag.hasErrors()).toBe(false);
    expect(text).toContain(lines("LSR R+1", "ROR R"));
  });

  it("loops a variable-count byte shift over X with a zero-count guard", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_BYTE), b: loc("B", IL_BYTE) },
        { op: "load", a: temp(1, IL_BYTE), b: loc("N", IL_BYTE) },
        { op: "shl", dest: temp(2, IL_BYTE), left: temp(0, IL_BYTE), right: temp(1, IL_BYTE), type: IL_BYTE },
      ],
      { kind: "ret", value: temp(2, IL_BYTE) },
      { returnType: IL_BYTE },
    );
    expect(bag.hasErrors()).toBe(false);
    expect(text).toContain("LDX N");
    expect(text).toContain("BEQ"); // count 0 shifts nothing
    expect(text).toContain("DEX");
    expect(text).toContain("BNE");
  });

  it("loops a variable-count word shift through the store home", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_WORD), b: loc("W", IL_WORD) },
        { op: "load", a: temp(1, IL_BYTE), b: loc("N", IL_BYTE) },
        { op: "shl", dest: temp(2, IL_WORD), left: temp(0, IL_WORD), right: temp(1, IL_BYTE), type: IL_WORD },
        { op: "store", a: temp(2, IL_WORD), b: loc("R", IL_WORD) },
      ],
      { kind: "ret" },
    );
    expect(bag.hasErrors()).toBe(false);
    expect(text).toContain("LDX N");
    expect(text).toContain(lines("ASL R", "ROL R+1"));
    expect(text).toContain("DEX");
  });
});
