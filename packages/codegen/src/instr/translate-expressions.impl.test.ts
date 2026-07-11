/**
 * Implementation tests for the expression translator: the word-compare
 * regression witness (the old translator compared low bytes only), immediate
 * lo/hi splitting per framing, the pinned sign-extension sequence, signed
 * shift sign retention, variable-shift guards, and the zero-cost
 * zero-extension fold.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, type AllocationPlan, type ZpAllocation } from "@blend65/core";

import { imm, loc, temp } from "../il/operand.js";
import { IL_BYTE, IL_SBYTE, IL_SWORD, IL_WORD } from "../il/il-type.js";
import type { ILInstruction, ILTerminator } from "../il/instruction.js";
import type { ILFunction } from "../il/cfg.js";
import { printInstr } from "./print-instr.js";
import { isInstr } from "./stream.js";
import { translateFunction } from "./translate.js";

function makePlan(): AllocationPlan {
  const zpAllocations: ZpAllocation[] = [];
  return {
    frames: new Map(),
    dataBase: 0,
    frameRegionBase: 0,
    frameRegionSize: 0,
    peakSimultaneous: 0,
    sharingSaved: 0,
    zpAllocations,
    zpUsed: 0,
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
      zpUsed: 0,
      zpBudget: 256,
      ramUsed: 0,
      ramBudget: 0,
      stackWorstCase: 0,
      stackBudget: 256,
    },
    hasErrors: false,
  };
}

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

function render(
  instructions: readonly ILInstruction[],
  terminator: ILTerminator,
  opts?: Parameters<typeof makeFn>[2],
): { text: string; bag: ReturnType<typeof createDiagnosticBag>; opcodes: string[] } {
  const bag = createDiagnosticBag();
  const stream = translateFunction(
    makeFn(instructions, terminator, opts),
    makePlan(),
    "nmos6502",
    bag,
  );
  const opcodes = stream.entries.filter(isInstr).map((e) => (isInstr(e) ? e.opcode : ""));
  return { text: printInstr(stream), bag, opcodes };
}

describe("word-compare regression witness (high bytes participate)", () => {
  // The defective translator emitted one low-byte CMP for word operands, so
  // operands differing only in the high byte compared as equal. Every word
  // framing must read BOTH high bytes.
  it("reads the high bytes in a word lt over locations", () => {
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
    expect(text).toContain("LDA L+1");
    expect(text).toContain("CMP R+1");
  });

  it("splits an immediate word bound into hi/lo compare bytes ($0100)", () => {
    // lt against $0100: lo bytes are equal (0), only the hi byte ($01)
    // separates the values — the emitted immediates must carry it.
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_WORD), b: loc("L", IL_WORD) },
        { op: "lt", dest: temp(1, IL_BYTE), left: temp(0, IL_WORD), right: imm(0x0100, IL_WORD), type: IL_WORD },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
      { returnType: IL_BYTE },
    );
    expect(bag.hasErrors()).toBe(false);
    expect(text).toContain("CMP #$01"); // the high byte of $0100
    expect(text).toContain("CMP #$00"); // the low byte
  });

  it("reads the high bytes in word equality", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_WORD), b: loc("L", IL_WORD) },
        { op: "eq", dest: temp(1, IL_BYTE), left: temp(0, IL_WORD), right: imm(0x1234, IL_WORD), type: IL_WORD },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
      { returnType: IL_BYTE },
    );
    expect(bag.hasErrors()).toBe(false);
    expect(text).toContain("CMP #$34"); // lo
    expect(text).toContain("CMP #$12"); // hi
  });

  it("reads the high bytes in a word signed compare", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_SWORD), b: loc("L", IL_SWORD) },
        { op: "load", a: temp(1, IL_SWORD), b: loc("R", IL_SWORD) },
        { op: "ge", dest: temp(2, IL_BYTE), left: temp(0, IL_SWORD), right: temp(1, IL_SWORD), type: IL_SWORD },
      ],
      { kind: "ret", value: temp(2, IL_BYTE) },
      { returnType: IL_BYTE },
    );
    expect(bag.hasErrors()).toBe(false);
    expect(text).toContain("SBC R+1");
    expect(text).toContain("BPL"); // ge decides on the corrected sign
  });
});

describe("signed comparison operand swap (gt/le reuse lt/ge)", () => {
  it("swaps operands for a signed gt (compares R against L)", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_SBYTE), b: loc("L", IL_SBYTE) },
        { op: "load", a: temp(1, IL_SBYTE), b: loc("R", IL_SBYTE) },
        { op: "gt", dest: temp(2, IL_BYTE), left: temp(0, IL_SBYTE), right: temp(1, IL_SBYTE), type: IL_SBYTE },
      ],
      { kind: "ret", value: temp(2, IL_BYTE) },
      { returnType: IL_BYTE },
    );
    expect(bag.hasErrors()).toBe(false);
    // a > b ≡ b < a: the subtraction runs R − L.
    expect(text).toContain("LDA R");
    expect(text).toContain("SBC L");
    expect(text).toContain("BMI"); // "less" decision on the swapped pair
  });
});

describe("pinned sign-extension sequence", () => {
  it("emits the exact branch-free sign-byte computation", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_SBYTE), b: loc("S", IL_SBYTE) },
        { op: "sext", dest: temp(1, IL_SWORD), src: temp(0, IL_SBYTE) },
        { op: "store", a: temp(1, IL_SWORD), b: loc("R", IL_SWORD) },
      ],
      { kind: "ret" },
    );
    expect(bag.hasErrors()).toBe(false);
    expect(text).toBe(
      [
        "M_f:",
        "    LDA S",
        "    STA R",
        "    ASL A",
        "    LDA #$00",
        "    ADC #$FF",
        "    EOR #$FF",
        "    STA R+1",
        "    RTS",
      ].join("\n"),
    );
  });

  it("computes the documented sign byte for both sign regions", () => {
    // The emitted arithmetic, replayed: carry = bit7; $00 + $FF + carry,
    // then EOR #$FF — must yield $FF for negatives and $00 otherwise.
    for (let v = 0; v <= 255; v++) {
      const carry = v >= 0x80 ? 1 : 0;
      const adc = (0x00 + 0xff + carry) & 0xff;
      const sign = adc ^ 0xff;
      expect(sign).toBe(v >= 0x80 ? 0xff : 0x00);
    }
  });
});

describe("signed shift sign retention and variable-shift guards", () => {
  it("seeds the carry from the sign once per constant arithmetic-shift step", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_SBYTE), b: loc("S", IL_SBYTE) },
        { op: "shr", dest: temp(1, IL_SBYTE), left: temp(0, IL_SBYTE), right: imm(3, IL_BYTE), type: IL_SBYTE },
      ],
      { kind: "ret", value: temp(1, IL_SBYTE) },
      { returnType: IL_SBYTE },
    );
    expect(bag.hasErrors()).toBe(false);
    expect(text.match(/CMP #\$80/g) ?? []).toHaveLength(3);
    expect(text.match(/ROR A/g) ?? []).toHaveLength(3);
  });

  it("emits nothing for a constant zero shift count (value passes through)", () => {
    const { opcodes, bag } = render(
      [
        { op: "load", a: temp(0, IL_BYTE), b: loc("B", IL_BYTE) },
        { op: "shl", dest: temp(1, IL_BYTE), left: temp(0, IL_BYTE), right: imm(0, IL_BYTE), type: IL_BYTE },
        { op: "store", a: temp(1, IL_BYTE), b: loc("R", IL_BYTE) },
      ],
      { kind: "ret" },
    );
    expect(bag.hasErrors()).toBe(false);
    expect(opcodes).toEqual(["LDA", "STA", "RTS"]); // no shift instructions at all
  });

  it("guards the variable count with BEQ before the loop and BNE after DEX", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_BYTE), b: loc("B", IL_BYTE) },
        { op: "load", a: temp(1, IL_BYTE), b: loc("N", IL_BYTE) },
        { op: "shr", dest: temp(2, IL_BYTE), left: temp(0, IL_BYTE), right: temp(1, IL_BYTE), type: IL_BYTE },
      ],
      { kind: "ret", value: temp(2, IL_BYTE) },
      { returnType: IL_BYTE },
    );
    expect(bag.hasErrors()).toBe(false);
    const beq = text.indexOf("BEQ");
    const dex = text.indexOf("DEX");
    const bne = text.indexOf("BNE");
    expect(beq).toBeGreaterThanOrEqual(0);
    expect(dex).toBeGreaterThan(beq);
    expect(bne).toBeGreaterThan(dex);
  });

  it("keeps a word shift of a variable back into itself copy-free", () => {
    // shl of W consumed by a store back to W: the home IS the source — no
    // copy loads, just the in-place shift steps.
    const { opcodes, bag } = render(
      [
        { op: "load", a: temp(0, IL_WORD), b: loc("W", IL_WORD) },
        { op: "shl", dest: temp(1, IL_WORD), left: temp(0, IL_WORD), right: imm(1, IL_BYTE), type: IL_WORD },
        { op: "store", a: temp(1, IL_WORD), b: loc("W", IL_WORD) },
      ],
      { kind: "ret" },
    );
    expect(bag.hasErrors()).toBe(false);
    expect(opcodes).toEqual(["ASL", "ROL", "RTS"]);
  });
});

describe("zero-extension fold cost", () => {
  it("adds zero instructions when a homed byte zero-extends into word arithmetic", () => {
    const { opcodes, bag } = render(
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
    // Identical to a plain word+word add: no LDX #$00, no extra moves.
    expect(opcodes).toEqual(["LDA", "CLC", "ADC", "STA", "LDA", "ADC", "STA", "RTS"]);
  });

  it("truncates an A-resident word without emitting anything", () => {
    const { opcodes, bag } = render(
      [
        { op: "const", dest: temp(0, IL_WORD), src: imm(0x1234, IL_WORD) },
        { op: "trunc", dest: temp(1, IL_BYTE), src: temp(0, IL_WORD) },
        { op: "store", a: temp(1, IL_BYTE), b: loc("R", IL_BYTE) },
      ],
      { kind: "ret" },
    );
    expect(bag.hasErrors()).toBe(false);
    expect(opcodes).toEqual(["LDA", "LDX", "STA", "RTS"]); // const's pair + the store
  });
});
