/**
 * Implementation tests for effectful direct memory access and word high-byte
 * selection. These cases exercise translator liveness, malformed IL rejection,
 * and optimizer parity beyond the end-to-end specification oracle.
 */

import { createDiagnosticBag } from "@blend65/core";
import type { AllocationPlan, Diagnostic } from "@blend65/core";
import { getTiming } from "@blend65/core/platform";
import type { NmosOpcode } from "@blend65/core/platform";
import { describe, expect, it } from "vitest";

import type { ILFunction, ILProgram } from "../il/cfg.js";
import type { ILInstruction, ILTerminator } from "../il/instruction.js";
import { IL_BYTE, IL_SBYTE, IL_SWORD, IL_WORD } from "../il/il-type.js";
import { imm, loc, temp } from "../il/operand.js";
import { generateInstr } from "./instr-program.js";
import { optimizeInstr } from "./peephole.js";
import { instrByteSize } from "./print-instr.js";
import { printInstr } from "./print-instr.js";
import { serializeToAcme } from "./serialize-acme.js";
import { isInstr } from "./stream.js";
import type { InstrStream } from "./stream.js";
import { translateFunction } from "./translate.js";

const EMPTY_PLAN: AllocationPlan = {
  frames: new Map(),
  dataBase: 0,
  frameRegionBase: 0,
  frameRegionSize: 0,
  peakSimultaneous: 0,
  sharingSaved: 0,
  zpAllocations: [],
  zpUsed: 0,
  zpBudget: 0,
  moduleVariables: [],
  moduleVariablesSize: 0,
  stackAnalysis: {
    maxMainDepth: 0,
    maxMainStackBytes: 0,
    maxIrqDepth: 0,
    maxIrqStackBytes: 0,
    irqOverhead: 0,
    totalWorstCase: 0,
    platformBudget: 0,
    exceedsWarningThreshold: false,
  },
  symbolDefinitions: [],
  resourceData: {
    frameRegionBytes: 0,
    frameRegionPeak: 0,
    frameSharingSaved: 0,
    zpUsed: 0,
    zpBudget: 0,
    ramUsed: 0,
    ramBudget: 0,
    stackWorstCase: 0,
    stackBudget: 0,
  },
  hasErrors: false,
};

const WORD_SPILL_PLAN: AllocationPlan = {
  ...EMPTY_PLAN,
  zpAllocations: [
    { name: "__zp_tmp_0", address: 0x10, size: 1, category: "temp" },
    { name: "__zp_tmp_1", address: 0x11, size: 1, category: "temp" },
  ],
  zpUsed: 2,
  resourceData: { ...EMPTY_PLAN.resourceData, zpUsed: 2 },
};

const FOUR_BYTE_SPILL_PLAN: AllocationPlan = {
  ...EMPTY_PLAN,
  zpAllocations: Array.from({ length: 4 }, (_, index) => ({
    name: `__zp_tmp_${index}`,
    address: 0x10 + index,
    size: 1,
    category: "temp" as const,
  })),
  zpUsed: 4,
  resourceData: { ...EMPTY_PLAN.resourceData, zpUsed: 4 },
};

/** Build one straight-line function around the supplied IL. */
function makeFunction(
  instructions: readonly ILInstruction[],
  terminator: ILTerminator = { kind: "ret" },
): ILFunction {
  return {
    name: "M.read",
    params: [],
    returnType: "void",
    blocks: [{ label: "_entry", instructions, terminator }],
    tempCount: 8,
    isInterrupt: false,
  };
}

/** Translate a fixture and return both canonical instructions and diagnostics. */
function translate(
  instructions: readonly ILInstruction[],
  terminator?: ILTerminator,
  plan: AllocationPlan = EMPTY_PLAN,
): {
  readonly text: string;
  readonly diagnostics: readonly Diagnostic[];
  readonly stream: InstrStream;
} {
  const bag = createDiagnosticBag();
  const stream = translateFunction(makeFunction(instructions, terminator), plan, "nmos6502", bag);
  return { text: printInstr(stream), diagnostics: bag.getAll(), stream };
}

/** Return byte and worst-case NMOS cycle costs for instruction entries. */
function instructionCost(entries: InstrStream["entries"]): { bytes: number; maxCycles: number } {
  let bytes = 0;
  let maxCycles = 0;
  for (const entry of entries) {
    if (!isInstr(entry)) continue;
    bytes += instrByteSize(entry);
    const timing = getTiming(entry.opcode as NmosOpcode, entry.mode);
    maxCycles += timing.baseCycles + timing.pageCrossPenalty + timing.branchTakenPenalty;
  }
  return { bytes, maxCycles };
}

/** Execute the register-source split-shift subset with a concrete hardware stack pointer. */
function executeSplitShift(
  entries: InstrStream["entries"],
  word: number,
  initialSp: number,
): { a: number; sp: number } {
  const memory = new Uint8Array(0x10000);
  let a = word & 0xff;
  let x = (word >> 8) & 0xff;
  let y = 0;
  let sp = initialSp & 0xff;
  for (const entry of entries) {
    if (!isInstr(entry)) continue;
    switch (entry.opcode) {
      case "TAY":
        y = a;
        break;
      case "TXA":
        a = x;
        break;
      case "ASL":
        a = (a << 1) & 0xff;
        break;
      case "PHA":
        memory[0x100 + sp] = a;
        sp = (sp - 1) & 0xff;
        break;
      case "TYA":
        a = y;
        break;
      case "LSR":
        a >>= 1;
        break;
      case "TSX":
        x = sp;
        break;
      case "INX":
        x = (x + 1) & 0xff;
        break;
      case "ORA": {
        if (entry.mode !== "AbsoluteX" || entry.operand.kind !== "symbolRef") {
          throw new Error("unexpected split-shift ORA form");
        }
        const base = Number.parseInt(entry.operand.name.slice(1), 16);
        a |= memory[(base + x) & 0xffff] ?? 0;
        break;
      }
      case "TXS":
        sp = x;
        break;
      default:
        throw new Error(`unexpected split-shift opcode ${entry.opcode}`);
    }
  }
  return { a, sp };
}

describe("volatile direct loads", () => {
  it("should defer an ordinary unused hardware-shaped load but execute an arbitrary volatile load", () => {
    const ordinary = translate([{ op: "load", a: temp(0, IL_BYTE), b: loc("$D020", IL_BYTE) }]);
    const effectful = translate([
      { op: "load", a: temp(0, IL_BYTE), b: loc("DEVICE", IL_BYTE), volatile: true },
    ]);

    expect(ordinary.text).toBe(["M_read:", "    RTS"].join("\n"));
    expect(effectful.text).toBe(["M_read:", "    LDA DEVICE", "    RTS"].join("\n"));
  });

  it("should execute both bytes of an unused volatile word load", () => {
    const result = translate([
      { op: "load", a: temp(0, IL_BYTE), b: loc("BYTE_DEVICE", IL_BYTE), volatile: true },
      { op: "load", a: temp(1, IL_WORD), b: loc("WORD_DEVICE", IL_WORD), volatile: true },
    ]);

    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(
      [
        "M_read:",
        "    LDA BYTE_DEVICE",
        "    LDA WORD_DEVICE",
        "    LDA WORD_DEVICE+1",
        "    RTS",
      ].join("\n"),
    );
  });

  it("should preserve both reads when selecting the low byte of a volatile word", () => {
    const result = translate(
      [
        { op: "load", a: temp(0, IL_WORD), b: loc("DEVICE", IL_WORD), volatile: true },
        { op: "trunc", dest: temp(1, IL_BYTE), src: temp(0, IL_WORD) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(
      ["M_read:", "    LDA DEVICE", "    LDX DEVICE+1", "    RTS"].join("\n"),
    );
  });

  it("should retain volatile access order across an intervening write", () => {
    const result = translate([
      { op: "load", a: temp(0, IL_BYTE), b: loc("READ_A", IL_BYTE), volatile: true },
      { op: "store", a: imm(7, IL_BYTE), b: loc("WRITE_B", IL_BYTE), volatile: true },
      { op: "load", a: temp(1, IL_WORD), b: loc("READ_C", IL_WORD), volatile: true },
    ]);

    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(
      [
        "M_read:",
        "    LDA READ_A",
        "    LDA #$07",
        "    STA WRITE_B",
        "    LDA READ_C",
        "    LDA READ_C+1",
        "    RTS",
      ].join("\n"),
    );
  });
});

describe("high-byte instruction selection", () => {
  it("should fuse an adjacent volatile word read to two direct LDA instructions", () => {
    const result = translate(
      [
        { op: "load", a: temp(0, IL_WORD), b: loc("$D020", IL_WORD), volatile: true },
        { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, IL_WORD) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(["M_read:", "    LDA $D020", "    LDA $D021", "    RTS"].join("\n"));
  });

  it("should read only the high byte of an ordinary deferred load", () => {
    const result = translate(
      [
        { op: "load", a: temp(0, IL_WORD), b: loc("WORD", IL_WORD) },
        { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, IL_WORD) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(["M_read:", "    LDA WORD+1", "    RTS"].join("\n"));
  });

  it("should select a constant word's high byte without materializing its low byte", () => {
    const result = translate([
      { op: "const", dest: temp(0, IL_WORD), src: imm(0x1234, IL_WORD) },
      { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, IL_WORD) },
      { op: "store", a: temp(1, IL_BYTE), b: loc("RESULT", IL_BYTE) },
    ]);

    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(["M_read:", "    LDA #$12", "    STA RESULT", "    RTS"].join("\n"));
  });

  it("should reject malformed destination and source widths", () => {
    const badDestination = translate([
      { op: "high_byte", dest: loc("RESULT", IL_BYTE), src: temp(0, IL_WORD) },
    ]);
    const badSource = translate([
      { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, IL_BYTE) },
    ]);

    expect(badDestination.diagnostics.map(({ code }) => code)).toContain("E90001");
    expect(badSource.diagnostics.map(({ code }) => code)).toContain("E90001");
  });

  it("should emit the same volatile high-byte sequence with optimization enabled or disabled", () => {
    const fn = makeFunction(
      [
        { op: "load", a: temp(0, IL_WORD), b: loc("$D020", IL_WORD), volatile: true },
        { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, IL_WORD) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
    );
    const il: ILProgram = {
      functions: [fn],
      initCode: [],
      initTempCount: 0,
      constData: [],
      allocationPlan: EMPTY_PLAN,
    };
    const disabledBag = createDiagnosticBag();
    const enabledBag = createDiagnosticBag();
    const disabled = optimizeInstr(
      generateInstr(il, "nmos6502", disabledBag),
      "nmos6502",
      disabledBag,
      { enabled: false },
    );
    const enabled = optimizeInstr(
      generateInstr(il, "nmos6502", enabledBag),
      "nmos6502",
      enabledBag,
      { enabled: true },
    );

    expect(disabledBag.getAll()).toEqual([]);
    expect(enabledBag.getAll()).toEqual([]);
    expect(serializeToAcme(enabled)).toBe(serializeToAcme(disabled));
    expect(serializeToAcme(enabled)).toContain("    LDA $D020\n    LDA $D021\n    RTS");
  });
});

describe("computed word high-byte producers", () => {
  it.each([
    {
      op: "add" as const,
      carry: "CLC",
      alu: "ADC",
    },
    {
      op: "sub" as const,
      carry: "SEC",
      alu: "SBC",
    },
  ])("should preserve the low-byte $carry into word $op", ({ op, carry, alu }) => {
    const result = translate(
      [
        { op: "load", a: temp(0, IL_WORD), b: loc("LEFT", IL_WORD) },
        { op: "load", a: temp(1, IL_WORD), b: loc("RIGHT", IL_WORD) },
        {
          op,
          dest: temp(2, IL_WORD),
          left: temp(0, IL_WORD),
          right: temp(1, IL_WORD),
          type: IL_WORD,
        },
        { op: "high_byte", dest: temp(3, IL_BYTE), src: temp(2, IL_WORD) },
      ],
      { kind: "ret", value: temp(3, IL_BYTE) },
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(
      [
        "M_read:",
        "    LDA LEFT",
        `    ${carry}`,
        `    ${alu} RIGHT`,
        "    LDA LEFT+1",
        `    ${alu} RIGHT+1`,
        "    RTS",
      ].join("\n"),
    );
  });

  it.each([
    { op: "and" as const, opcode: "AND" },
    { op: "or" as const, opcode: "ORA" },
    { op: "xor" as const, opcode: "EOR" },
  ])("should compute only the independent high byte for word $op", ({ op, opcode }) => {
    const result = translate(
      [
        {
          op,
          dest: temp(0, IL_WORD),
          left: loc("LEFT", IL_WORD),
          right: loc("RIGHT", IL_WORD),
          type: IL_WORD,
        },
        { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, IL_WORD) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(
      ["M_read:", "    LDA LEFT+1", `    ${opcode} RIGHT+1`, "    RTS"].join("\n"),
    );
  });

  it("should preserve borrow when selecting the high byte of word negation", () => {
    const result = translate(
      [
        { op: "neg", dest: temp(0, IL_SWORD), src: loc("VALUE", IL_SWORD), type: IL_SWORD },
        { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, IL_SWORD) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(
      [
        "M_read:",
        "    SEC",
        "    LDA #$00",
        "    SBC VALUE",
        "    LDA #$00",
        "    SBC VALUE+1",
        "    RTS",
      ].join("\n"),
    );
  });

  it("should select complement and extension high bytes without a word home", () => {
    const complemented = translate(
      [
        { op: "not", dest: temp(0, IL_WORD), src: loc("VALUE", IL_WORD), type: IL_WORD },
        { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, IL_WORD) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
    );
    const zeroExtended = translate(
      [
        { op: "zext", dest: temp(0, IL_WORD), src: loc("BYTE", IL_BYTE) },
        { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, IL_WORD) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
    );
    const signExtended = translate(
      [
        { op: "sext", dest: temp(0, IL_SWORD), src: loc("SIGNED", IL_SBYTE) },
        { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, IL_SWORD) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
    );

    expect(complemented.diagnostics).toEqual([]);
    expect(complemented.text).toBe(
      ["M_read:", "    LDA VALUE+1", "    EOR #$FF", "    RTS"].join("\n"),
    );
    expect(zeroExtended.diagnostics).toEqual([]);
    expect(zeroExtended.text).toBe(["M_read:", "    LDA #$00", "    RTS"].join("\n"));
    expect(signExtended.diagnostics).toEqual([]);
    expect(signExtended.text).toBe(
      [
        "M_read:",
        "    LDA SIGNED",
        "    ASL",
        "    LDA #$00",
        "    ADC #$FF",
        "    EOR #$FF",
        "    RTS",
      ].join("\n"),
    );
  });

  it("should propagate low-byte carry through a two-bit left shift", () => {
    const result = translate(
      [
        {
          op: "shl",
          dest: temp(0, IL_WORD),
          left: loc("VALUE", IL_WORD),
          right: imm(2, IL_BYTE),
          type: IL_WORD,
        },
        { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, IL_WORD) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(
      [
        "M_read:",
        "    LDA VALUE",
        "    LDX VALUE+1",
        "    ASL",
        "    PHA",
        "    TXA",
        "    ROL",
        "    TAX",
        "    PLA",
        "    ASL",
        "    TXA",
        "    ROL",
        "    RTS",
      ].join("\n"),
    );
  });

  it.each([4, 5, 6, 7])(
    "should split a %d-bit selected left shift within the expert cost envelope",
    (count) => {
      const result = translate(
        [
          { op: "call", dest: temp(0, IL_WORD), target: "M.value", args: [] },
          {
            op: "shl",
            dest: temp(1, IL_WORD),
            left: temp(0, IL_WORD),
            right: imm(count, IL_BYTE),
            type: IL_WORD,
          },
          { op: "high_byte", dest: temp(2, IL_BYTE), src: temp(1, IL_WORD) },
        ],
        { kind: "ret", value: temp(2, IL_BYTE) },
      );
      const expected = [
        "M_read:",
        "    JSR M_value",
        "    TAY",
        "    TXA",
        ...Array.from({ length: count }, () => "    ASL"),
        "    PHA",
        "    TYA",
        ...Array.from({ length: 8 - count }, () => "    LSR"),
        "    TSX",
        "    INX",
        "    ORA $0100,X",
        "    TXS",
        "    RTS",
      ];
      const selectedEntries = result.stream.entries.filter(isInstr).slice(1, -1);
      const cost = instructionCost(selectedEntries);

      expect(result.diagnostics).toEqual([]);
      expect(result.text).toBe(expected.join("\n"));
      expect(cost.bytes).toBe(18);
      expect(cost.maxCycles).toBe(36);
      expect(cost.bytes).toBeLessThanOrEqual(20);
      expect(cost.maxCycles).toBeLessThanOrEqual(41);
      expect(expected.filter((line) => line.trim() === "PHA")).toHaveLength(1);
    },
  );

  it.each([0x00, 0xfd])(
    "should restore SP and read the pushed byte when the initial stack pointer is $%s",
    (initialSp) => {
      const count = 4;
      const word = 0x9234;
      const result = translate(
        [
          { op: "call", dest: temp(0, IL_WORD), target: "M.value", args: [] },
          {
            op: "shl",
            dest: temp(1, IL_WORD),
            left: temp(0, IL_WORD),
            right: imm(count, IL_BYTE),
            type: IL_WORD,
          },
          { op: "high_byte", dest: temp(2, IL_BYTE), src: temp(1, IL_WORD) },
        ],
        { kind: "ret", value: temp(2, IL_BYTE) },
      );
      const selectedEntries = result.stream.entries.filter(isInstr).slice(1, -1);

      expect(result.diagnostics).toEqual([]);
      expect(executeSplitShift(selectedEntries, word, initialSp)).toEqual({
        a: ((word << count) >> 8) & 0xff,
        sp: initialSp,
      });
    },
  );

  it("should keep the memory-source split shift within twenty bytes", () => {
    const result = translate(
      [
        {
          op: "shl",
          dest: temp(0, IL_WORD),
          left: loc("VALUE", IL_WORD),
          right: imm(4, IL_BYTE),
          type: IL_WORD,
        },
        { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, IL_WORD) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
    );
    const selectedEntries = result.stream.entries.filter(isInstr).slice(0, -1);

    expect(result.diagnostics).toEqual([]);
    expect(instructionCost(selectedEntries)).toEqual({ bytes: 20, maxCycles: 36 });
    expect(result.text).toContain("    TSX\n    LDA VALUE+1");
    expect(result.text).toContain("    ORA $0100,X\n    TXS");
  });

  it.each([
    { count: 8, body: ["    LDA VALUE"] },
    { count: 10, body: ["    LDA VALUE", "    ASL", "    ASL"] },
    { count: 16, body: ["    LDA #$00"] },
  ])("should reduce a $count-bit left shift to its contributing byte", ({ count, body }) => {
    const result = translate(
      [
        {
          op: "shl",
          dest: temp(0, IL_WORD),
          left: loc("VALUE", IL_WORD),
          right: imm(count, IL_BYTE),
          type: IL_WORD,
        },
        { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, IL_WORD) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(["M_read:", ...body, "    RTS"].join("\n"));
  });

  it.each([
    { type: IL_WORD, signSeed: [] as readonly string[] },
    { type: IL_SWORD, signSeed: ["    CMP #$80"] as readonly string[] },
  ])("should shift only the high byte for a constant right shift", ({ type, signSeed }) => {
    const result = translate(
      [
        {
          op: "shr",
          dest: temp(0, type),
          left: loc("VALUE", type),
          right: imm(2, IL_BYTE),
          type,
        },
        { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, type) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
    );
    const oneStep = [...signSeed, signSeed.length === 0 ? "    LSR" : "    ROR"];

    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(
      ["M_read:", "    LDA VALUE+1", ...oneStep, ...oneStep, "    RTS"].join("\n"),
    );
  });

  it("should keep a variable left-shift count while carrying the full word in A:X", () => {
    const result = translate(
      [
        { op: "load", a: temp(0, IL_WORD), b: loc("VALUE", IL_WORD) },
        { op: "load", a: temp(1, IL_BYTE), b: loc("COUNT", IL_BYTE) },
        {
          op: "shl",
          dest: temp(2, IL_WORD),
          left: temp(0, IL_WORD),
          right: temp(1, IL_BYTE),
          type: IL_WORD,
        },
        { op: "high_byte", dest: temp(3, IL_BYTE), src: temp(2, IL_WORD) },
      ],
      { kind: "ret", value: temp(3, IL_BYTE) },
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain("    LDY COUNT");
    expect(result.text).toContain("    CPY #$00");
    expect(result.text).toContain("    ASL\n    PHA\n    TXA\n    ROL\n    TAX\n    PLA");
    expect(result.text).toContain("    DEY");
  });

  it.each([
    { type: IL_WORD, saturated: ["    LDA #$00"] },
    {
      type: IL_SWORD,
      saturated: ["    LDA VALUE+1", "    ASL", "    LDA #$00", "    ADC #$FF", "    EOR #$FF"],
    },
  ])("should saturate a variable $type right shift after seven steps", ({ type, saturated }) => {
    const result = translate(
      [
        {
          op: "shr",
          dest: temp(0, type),
          left: loc("VALUE", type),
          right: loc("COUNT", IL_BYTE),
          type,
        },
        { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, type) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
    );
    const lines = result.text.split("\n");
    const large = lines.indexOf("_sh0:");
    const done = lines.indexOf("_sh2:");

    expect(result.diagnostics).toEqual([]);
    expect(lines.slice(1, 4)).toEqual(["    LDY COUNT", "    CPY #$08", "    BCS _sh0"]);
    expect(lines.slice(large + 1, done)).toEqual(saturated);
    expect(result.text.match(/LDA VALUE\+1/g)).toHaveLength(type.signed ? 2 : 1);
  });

  it("should partition a variable left shift into full-word, low-only, and zero paths", () => {
    const result = translate(
      [
        {
          op: "shl",
          dest: temp(0, IL_WORD),
          left: loc("VALUE", IL_WORD),
          right: loc("COUNT", IL_BYTE),
          type: IL_WORD,
        },
        { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, IL_WORD) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain(
      ["    LDY COUNT", "    CPY #$10", "    BCS _sh0", "    CPY #$08", "    BCS _sh1"].join("\n"),
    );
    expect(result.text).toContain("_sh0:\n    LDA #$00\n    JMP _sh5");
    expect(result.text).toContain("_sh1:\n    LDA VALUE\n    CPY #$08");
    expect(result.text).toContain("    CPY #$08\n    BNE _sh4");
  });

  it("should select word results from copies, calls, and runtime operators", () => {
    const copied = translate(
      [
        { op: "copy", dest: temp(0, IL_WORD), src: loc("VALUE", IL_WORD) },
        { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, IL_WORD) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
    );
    const called = translate(
      [
        { op: "call", dest: temp(0, IL_WORD), target: "M.value", args: [] },
        { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, IL_WORD) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
    );
    const multiplied = translate(
      [
        {
          op: "mul",
          dest: temp(0, IL_WORD),
          left: imm(0x1234, IL_WORD),
          right: imm(2, IL_WORD),
          type: IL_WORD,
        },
        { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, IL_WORD) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
    );

    expect(copied.diagnostics).toEqual([]);
    expect(copied.text).toBe(["M_read:", "    LDA VALUE+1", "    RTS"].join("\n"));
    expect(called.diagnostics).toEqual([]);
    expect(called.text).toBe(["M_read:", "    JSR M_value", "    TXA", "    RTS"].join("\n"));
    expect(multiplied.diagnostics).toEqual([]);
    expect(multiplied.text).toBe(["M_read:", "    LDA #$24", "    RTS"].join("\n"));
  });

  it.each(["add", "and"] as const)(
    "should use a computed A:X right operand directly for word %s",
    (op) => {
      const result = translate(
        [
          { op: "load", a: temp(0, IL_WORD), b: loc("LEFT", IL_WORD) },
          { op: "call", dest: temp(1, IL_WORD), target: "M.value", args: [] },
          {
            op,
            dest: temp(2, IL_WORD),
            left: temp(0, IL_WORD),
            right: temp(1, IL_WORD),
            type: IL_WORD,
          },
          { op: "high_byte", dest: temp(3, IL_BYTE), src: temp(2, IL_WORD) },
        ],
        { kind: "ret", value: temp(3, IL_BYTE) },
      );

      expect(result.diagnostics).toEqual([]);
      expect(result.text).toContain("    JSR M_value");
      expect(result.text).toContain(
        op === "add" ? "    CLC\n    ADC LEFT" : "    TXA\n    AND LEFT+1",
      );
      expect(result.text.endsWith("    RTS")).toBe(true);
    },
  );

  it("should preserve a computed A:X right operand through subtraction and negation", () => {
    const subtracted = translate(
      [
        { op: "load", a: temp(0, IL_WORD), b: loc("LEFT", IL_WORD) },
        { op: "call", dest: temp(1, IL_WORD), target: "M.value", args: [] },
        {
          op: "sub",
          dest: temp(2, IL_WORD),
          left: temp(0, IL_WORD),
          right: temp(1, IL_WORD),
          type: IL_WORD,
        },
        { op: "high_byte", dest: temp(3, IL_BYTE), src: temp(2, IL_WORD) },
      ],
      { kind: "ret", value: temp(3, IL_BYTE) },
    );
    const negated = translate(
      [
        { op: "call", dest: temp(0, IL_SWORD), target: "M.value", args: [] },
        { op: "neg", dest: temp(1, IL_SWORD), src: temp(0, IL_SWORD), type: IL_SWORD },
        { op: "high_byte", dest: temp(2, IL_BYTE), src: temp(1, IL_SWORD) },
      ],
      { kind: "ret", value: temp(2, IL_BYTE) },
    );

    expect(subtracted.diagnostics).toEqual([]);
    expect(subtracted.text).toContain(
      [
        "    EOR #$FF",
        "    CLC",
        "    ADC #$01",
        "    PHA",
        "    TXA",
        "    EOR #$FF",
        "    ADC #$00",
        "    TAX",
        "    PLA",
        "    CLC",
        "    ADC LEFT",
        "    TXA",
        "    ADC LEFT+1",
      ].join("\n"),
    );
    expect(negated.diagnostics).toEqual([]);
    expect(negated.text).toContain(
      [
        "    JSR M_value",
        "    EOR #$FF",
        "    CLC",
        "    ADC #$01",
        "    TXA",
        "    EOR #$FF",
        "    ADC #$00",
        "    RTS",
      ].join("\n"),
    );
  });

  it("should select a word runtime division result from X", () => {
    const result = translate(
      [
        {
          op: "div",
          dest: temp(0, IL_WORD),
          left: loc("LEFT", IL_WORD),
          right: loc("RIGHT", IL_WORD),
          type: IL_WORD,
        },
        { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, IL_WORD) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
    );

    expect(result.diagnostics.some(({ severity }) => severity === "error")).toBe(false);
    expect(result.text).toContain("    JSR __rt_div16");
    expect(result.text.endsWith("    TXA\n    RTS")).toBe(true);
  });

  it("should load only the runtime remainder's selected high byte", () => {
    const result = translate(
      [
        {
          op: "mod",
          dest: temp(0, IL_WORD),
          left: loc("LEFT", IL_WORD),
          right: loc("RIGHT", IL_WORD),
          type: IL_WORD,
        },
        { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, IL_WORD) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
    );
    const afterCall = result.text.split("    JSR __rt_div16\n")[1];

    expect(result.diagnostics.some(({ severity }) => severity === "error")).toBe(false);
    expect(afterCall).toBe("    LDA __zp_arg_1\n    RTS");
    expect(afterCall).not.toContain("__zp_arg_0");
    expect(afterCall).not.toContain("LDX");
    expect(afterCall).not.toContain("TXA");
  });

  it("should preserve a reused A:X call result beyond a selected word producer", () => {
    const result = translate(
      [
        { op: "call", dest: temp(0, IL_WORD), target: "M.value", args: [] },
        {
          op: "add",
          dest: temp(1, IL_WORD),
          left: temp(0, IL_WORD),
          right: imm(1, IL_WORD),
          type: IL_WORD,
        },
        { op: "high_byte", dest: temp(2, IL_BYTE), src: temp(1, IL_WORD) },
        { op: "store", a: temp(2, IL_BYTE), b: loc("RESULT", IL_BYTE) },
        { op: "high_byte", dest: temp(3, IL_BYTE), src: temp(0, IL_WORD) },
      ],
      { kind: "ret", value: temp(3, IL_BYTE) },
      WORD_SPILL_PLAN,
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(
      [
        "M_read:",
        "    JSR M_value",
        "    STA __zp_tmp_0",
        "    STX __zp_tmp_1",
        "    LDA __zp_tmp_0",
        "    CLC",
        "    ADC #$01",
        "    LDA __zp_tmp_1",
        "    ADC #$00",
        "    STA RESULT",
        "    LDA __zp_tmp_1",
        "    RTS",
      ].join("\n"),
    );
  });

  it("should reuse one word spill color across sequential nested expressions", () => {
    const instructions: ILInstruction[] = [];
    for (let group = 0; group < 3; group++) {
      const id = group * 4;
      instructions.push(
        { op: "call", dest: temp(id, IL_WORD), target: `M.left${group}`, args: [] },
        { op: "call", dest: temp(id + 1, IL_WORD), target: `M.right${group}`, args: [] },
        {
          op: "add",
          dest: temp(id + 2, IL_WORD),
          left: temp(id, IL_WORD),
          right: temp(id + 1, IL_WORD),
          type: IL_WORD,
        },
        { op: "high_byte", dest: temp(id + 3, IL_BYTE), src: temp(id + 2, IL_WORD) },
        { op: "store", a: temp(id + 3, IL_BYTE), b: loc(`RESULT${group}`, IL_BYTE) },
      );
    }
    const result = translate(instructions, undefined, FOUR_BYTE_SPILL_PLAN);

    expect(result.diagnostics).toEqual([]);
    expect(result.text.match(/STA __zp_tmp_0/g)).toHaveLength(3);
    expect(result.text.match(/STX __zp_tmp_1/g)).toHaveLength(3);
    expect(result.text).not.toContain("__zp_tmp_2");
    expect(result.text).not.toContain("__zp_tmp_3");
  });

  it("should assign distinct colors to overlapping word spills without aliasing", () => {
    const result = translate(
      [
        { op: "call", dest: temp(0, IL_WORD), target: "M.first", args: [] },
        { op: "call", dest: temp(1, IL_WORD), target: "M.second", args: [] },
        { op: "load", a: temp(2, IL_WORD), b: loc("SOURCE", IL_WORD) },
        { op: "high_byte", dest: temp(3, IL_BYTE), src: temp(2, IL_WORD) },
        { op: "store", a: temp(3, IL_BYTE), b: loc("RESULT", IL_BYTE) },
        { op: "high_byte", dest: temp(4, IL_BYTE), src: temp(0, IL_WORD) },
        { op: "store", a: temp(4, IL_BYTE), b: loc("FIRST_HIGH", IL_BYTE) },
        { op: "high_byte", dest: temp(5, IL_BYTE), src: temp(1, IL_WORD) },
      ],
      { kind: "ret", value: temp(5, IL_BYTE) },
      FOUR_BYTE_SPILL_PLAN,
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe(
      [
        "M_read:",
        "    JSR M_first",
        "    STA __zp_tmp_0",
        "    STX __zp_tmp_1",
        "    JSR M_second",
        "    STA __zp_tmp_2",
        "    STX __zp_tmp_3",
        "    LDA SOURCE+1",
        "    STA RESULT",
        "    LDA __zp_tmp_1",
        "    STA FIRST_HIGH",
        "    LDA __zp_tmp_3",
        "    RTS",
      ].join("\n"),
    );
  });

  it("should marshal a last-use A:X operand used on both sides without spill or reload", () => {
    const result = translate(
      [
        { op: "call", dest: temp(0, IL_WORD), target: "M.value", args: [] },
        {
          op: "mul",
          dest: temp(1, IL_WORD),
          left: temp(0, IL_WORD),
          right: temp(0, IL_WORD),
          type: IL_WORD,
        },
        { op: "high_byte", dest: temp(2, IL_BYTE), src: temp(1, IL_WORD) },
      ],
      { kind: "ret", value: temp(2, IL_BYTE) },
    );

    expect(result.diagnostics.some(({ severity }) => severity === "error")).toBe(false);
    expect(result.text).not.toContain("__zp_tmp_");
    expect(result.text).toBe(
      [
        "M_read:",
        "    JSR M_value",
        "    STA __zp_arg_0",
        "    STX __zp_arg_1",
        "    JSR __rt_mul16",
        "    TXA",
        "    RTS",
      ].join("\n"),
    );
  });

  it("should select only the addressed high byte for indexed and indirect word loads", () => {
    const indexed = translate(
      [
        {
          op: "load_indexed",
          value: temp(0, IL_WORD),
          base: loc("TABLE", IL_WORD),
          index: imm(3, IL_BYTE),
        },
        { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, IL_WORD) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
    );
    const indirectPlan: AllocationPlan = {
      ...EMPTY_PLAN,
      symbolDefinitions: [{ name: "PAIR", value: 0x20, zeroPage: true }],
    };
    const indirect = translate(
      [
        {
          op: "load_indirect",
          value: temp(0, IL_WORD),
          ptr: loc("PAIR", IL_WORD),
          offset: imm(4, IL_BYTE),
        },
        { op: "high_byte", dest: temp(1, IL_BYTE), src: temp(0, IL_WORD) },
      ],
      { kind: "ret", value: temp(1, IL_BYTE) },
      indirectPlan,
    );

    expect(indexed.diagnostics).toEqual([]);
    expect(indexed.text).toBe(
      ["M_read:", "    LDX #$03", "    LDA TABLE+1,X", "    RTS"].join("\n"),
    );
    expect(indirect.diagnostics).toEqual([]);
    expect(indirect.text).toBe(
      ["M_read:", "    LDY #$04", "    INY", "    LDA (PAIR),Y", "    RTS"].join("\n"),
    );
  });
});
