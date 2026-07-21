/**
 * Implementation tests for the address-byte operand and its consumers.
 *
 * Written after the implementation: these pin the operand record's own shape,
 * the immediate each consumer emits for it, and — the part no specification
 * test can reach — that the translator's three fall-out guards actually raise.
 * A guard is proven unreachable by the suite passing with it in place; that
 * says nothing about whether it works when something finally does reach it, so
 * each is driven here with a deliberately corrupt operand.
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, isIceCode } from "@blend65/core";
import type { AllocationPlan, DiagnosticBag, ZpAllocation } from "@blend65/core";
import { addrByteOf, isAddrByte, imm, loc, temp } from "../il/operand.js";
import type { ILOperand } from "../il/operand.js";
import { IL_BYTE, IL_WORD } from "../il/il-type.js";
import type { ILInstruction, ILTerminator } from "../il/instruction.js";
import type { ILFunction } from "../il/cfg.js";
import { printInstr } from "./print-instr.js";
import { isSymbolExprOperand, symbolExpr, symbolRef } from "./operand.js";
import { instr } from "./stream.js";
import type { InstrOperand } from "./operand.js";
import { translateFunction } from "./translate.js";

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

function makeFn(instructions: readonly ILInstruction[], terminator: ILTerminator): ILFunction {
  return {
    name: "M.f",
    params: [],
    returnType: "void",
    blocks: [{ label: "_entry", instructions, terminator }],
    tempCount: 8,
    isInterrupt: false,
  };
}

function render(
  instructions: readonly ILInstruction[],
  terminator: ILTerminator = { kind: "ret" },
): { text: string; bag: DiagnosticBag } {
  const bag = createDiagnosticBag();
  const stream = translateFunction(
    makeFn(instructions, terminator),
    makePlan(["__zp_tmp_0"]),
    "nmos6502",
    bag,
  );
  return { text: printInstr(stream), bag };
}

/** An operand of a kind no consumer has an arm for — a corrupt IL record. */
const CORRUPT_BYTE = { kind: "nonesuch", type: IL_BYTE } as unknown as ILOperand;
const CORRUPT_WORD = { kind: "nonesuch", type: IL_WORD } as unknown as ILOperand;

/** The ICE messages raised while translating, in order. */
function ices(bag: DiagnosticBag): string[] {
  return bag
    .getAll()
    .filter((d) => isIceCode(d.code))
    .map((d) => d.message);
}

describe("addrByteOf / isAddrByte", () => {
  it("constructs a byte-typed record and narrows through its guard", () => {
    const op = addrByteOf("__data_M_SPRITE", "low");
    expect(isAddrByte(op)).toBe(true);
    expect(op).toEqual({
      kind: "addrByte",
      symbol: "__data_M_SPRITE",
      select: "low",
      type: IL_BYTE,
    });
    expect(isAddrByte(imm(3, IL_BYTE))).toBe(false);
  });

  it("omits shift entirely when absent, so the bare form compares equal", () => {
    expect(addrByteOf("S", "high")).toEqual(addrByteOf("S", "high"));
    expect(Object.hasOwn(addrByteOf("S", "high"), "shift")).toBe(false);
    expect(addrByteOf("S", "low", 6)).toMatchObject({ shift: 6, select: "low" });
  });
});

describe("the address byte's consumers each emit one immediate", () => {
  it("a store source loads the selected byte and stores it", () => {
    const { text, bag } = render([
      { op: "store", a: addrByteOf("SPRITE", "low"), b: loc("$07F8", IL_BYTE) },
    ]);
    expect(text).toContain("LDA #<SPRITE");
    expect(ices(bag)).toEqual([]);
  });

  it("a const source loads the selected byte and binds it to the temp", () => {
    const { text, bag } = render([
      { op: "const", dest: temp(0, IL_BYTE), src: addrByteOf("SPRITE", "high") },
      { op: "store", a: temp(0, IL_BYTE), b: loc("r", IL_BYTE) },
    ]);
    // Bound to A, so the store reads the register rather than reloading.
    expect(text).toBe(["M_f:", "    LDA #>SPRITE", "    STA r", "    RTS"].join("\n"));
    expect(ices(bag)).toEqual([]);
  });

  it("an array index loads the selected byte straight into X", () => {
    const { text, bag } = render([
      {
        op: "load_indexed",
        value: temp(0, IL_BYTE),
        base: loc("TBL", IL_BYTE),
        index: addrByteOf("SPRITE", "low"),
      },
      { op: "store", a: temp(0, IL_BYTE), b: loc("r", IL_BYTE) },
    ]);
    expect(text).toContain("LDX #<SPRITE");
    expect(text).toContain("LDA TBL,X");
    expect(ices(bag)).toEqual([]);
  });

  it("a word ALU reads the byte as its low half and zero as its high half", () => {
    const { text, bag } = render([
      { op: "load", a: temp(0, IL_WORD), b: loc("base", IL_WORD) },
      {
        op: "add",
        dest: temp(1, IL_WORD),
        left: temp(0, IL_WORD),
        right: addrByteOf("SPRITE", "low"),
        type: IL_WORD,
      },
      { op: "store", a: temp(1, IL_WORD), b: loc("r", IL_WORD) },
    ]);
    expect(text).toContain("ADC #<SPRITE");
    expect(text).toContain("ADC #$00");
    expect(ices(bag)).toEqual([]);
  });
});

/** The rendered `LDA #<operand>` line for one immediate operand. */
function loadOf(operand: InstrOperand): string {
  return printInstr({
    symbol: "M_f",
    segment: "code",
    entries: [instr("LDA", "Immediate", operand)],
  });
}

describe("symbolExpr and its rendering", () => {
  it("constructs with both fields required and narrows through its guard", () => {
    const op = symbolExpr("SPRITE", 6, "low");
    expect(isSymbolExprOperand(op)).toBe(true);
    expect(op).toEqual({ kind: "symbolExpr", name: "SPRITE", shift: 6, byteSelect: "low" });
    expect(isSymbolExprOperand(symbolRef("SPRITE", { byteSelect: "low" }))).toBe(false);
  });

  it("renders as a parenthesised division for every shift the fold accepts", () => {
    for (let k = 1; k <= 15; k++) {
      expect(loadOf(symbolExpr("S", k, "low"))).toBe(`    LDA #<(S / ${2 ** k})`);
    }
  });

  it("renders both byte selects", () => {
    expect(loadOf(symbolExpr("S", 6, "low"))).toContain("#<(S / 64)");
    expect(loadOf(symbolExpr("S", 6, "high"))).toContain("#>(S / 64)");
  });
});

describe("instrOperandFor maps both spellings from the one site", () => {
  it("an unshifted select renders as a plain byte selector", () => {
    const { text } = render([
      { op: "store", a: addrByteOf("SPRITE", "low"), b: loc("r", IL_BYTE) },
    ]);
    expect(text).toContain("LDA #<SPRITE");
    expect(text).not.toContain("(");
  });

  it("a shifted select renders as the division", () => {
    const { text } = render([
      { op: "store", a: addrByteOf("SPRITE", "low", 6), b: loc("r", IL_BYTE) },
    ]);
    expect(text).toContain("LDA #<(SPRITE / 64)");
  });
});

describe("the translator's fall-out guards raise rather than emit nothing", () => {
  it("a byte value with no load form raises instead of leaving A stale", () => {
    const { bag } = render([{ op: "store", a: CORRUPT_BYTE, b: loc("r", IL_BYTE) }]);
    expect(ices(bag).join(" ")).toContain("byte operand with no load form");
  });

  it("a word value with no per-byte reference raises instead of storing stale registers", () => {
    const { bag } = render([{ op: "store", a: CORRUPT_WORD, b: loc("r", IL_WORD) }]);
    expect(ices(bag).join(" ")).toContain("word value with no per-byte read reference");
  });

  it("an ALU right operand with no read reference raises instead of emitting implied mode", () => {
    const { bag } = render([
      { op: "load", a: temp(0, IL_BYTE), b: loc("a", IL_BYTE) },
      {
        op: "add",
        dest: temp(1, IL_BYTE),
        left: temp(0, IL_BYTE),
        right: CORRUPT_BYTE,
        type: IL_BYTE,
      },
      { op: "store", a: temp(1, IL_BYTE), b: loc("r", IL_BYTE) },
    ]);
    expect(ices(bag).join(" ")).toContain("ALU right operand with no read reference");
  });

  it("a non-immediate const source other than an address byte still raises", () => {
    const { bag } = render([{ op: "const", dest: temp(0, IL_BYTE), src: loc("a", IL_BYTE) }]);
    expect(ices(bag).join(" ")).toContain("const (non-temp dest or non-immediate src)");
  });

  it("an index of a kind with no arm still raises", () => {
    const { bag } = render([
      {
        op: "load_indexed",
        value: temp(0, IL_BYTE),
        base: loc("TBL", IL_BYTE),
        index: CORRUPT_BYTE,
      },
      { op: "store", a: temp(0, IL_BYTE), b: loc("r", IL_BYTE) },
    ]);
    expect(ices(bag).join(" ")).toContain("indexed access with a non-value index operand");
  });
});
