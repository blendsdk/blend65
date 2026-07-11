/**
 * Specification tests for the IL→Instr translator (memory, arithmetic/
 * bitwise/shift, `ret`, deferred-op ICE, source-span propagation).
 *
 * These are immutable oracles: the expected ACME text is derived from the
 * spec + ACME syntax, NOT by running the translator.
 *
 * The translator lowers one single-block `ILFunction` into one `InstrStream`,
 * using a fold value-flow model: single-use load results are folded into
 * the consuming ALU/store operand, ALU byte results stay in A until the
 * consumer stores them.
 */

import { describe, expect, it } from "vitest";
import {
  createDiagnosticBag,
  DiagCode,
  IceCode,
  type AllocationPlan,
  type SourceSpan,
  type ZpAllocation,
} from "@blend65/core";

import { imm, loc, temp } from "../il/operand.js";
import { IL_BYTE, IL_WORD } from "../il/il-type.js";
import type { ILInstruction, ILTerminator } from "../il/instruction.js";
import type { ILFunction } from "../il/cfg.js";
import { printInstr } from "./print-instr.js";
import { isInstr } from "./stream.js";
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
  opts: { returnType?: ILFunction["returnType"]; isInterrupt?: boolean; tempCount?: number } = {},
): ILFunction {
  return {
    name: "M.f",
    params: [],
    returnType: opts.returnType ?? "void",
    blocks: [{ label: "_entry", instructions, terminator }],
    tempCount: opts.tempCount ?? 8,
    isInterrupt: opts.isInterrupt ?? false,
  };
}

/** Translate and render to canonical ACME text. */
function render(
  instructions: readonly ILInstruction[],
  terminator: ILTerminator,
  opts?: Parameters<typeof makeFn>[2],
): { text: string; bag: ReturnType<typeof createDiagnosticBag> } {
  const bag = createDiagnosticBag();
  const stream = translateFunction(makeFn(instructions, terminator, opts), makePlan(), "nmos6502", bag);
  return { text: printInstr(stream), bag };
}

describe("Specification: translator — load/store/const (ST-T1..T6)", () => {
  // load t0,[V] (byte); the load result, returned, materialises LDA V.
  it("translates a byte load into LDA (ST-T1)", () => {
    const { text, bag } = render(
      [{ op: "load", a: temp(0, IL_BYTE), b: loc("V", IL_BYTE) }],
      { kind: "ret", value: temp(0, IL_BYTE) },
      { returnType: IL_BYTE },
    );
    expect(text).toBe(["M_f:", "    LDA V", "    RTS"].join("\n"));
    expect(bag.hasErrors()).toBe(false);
  });

  // store v,[V] (byte, v in A) → STA V.
  it("translates a byte store into STA (ST-T2)", () => {
    const { text } = render(
      [
        { op: "const", dest: temp(0, IL_BYTE), src: imm(0x42, IL_BYTE) },
        { op: "store", a: temp(0, IL_BYTE), b: loc("V", IL_BYTE) },
      ],
      { kind: "ret" },
    );
    expect(text).toBe(["M_f:", "    LDA #$42", "    STA V", "    RTS"].join("\n"));
  });

  // load t0,[V] (word) → LDA V + LDX V+1.
  it("translates a word load into LDA + LDX hi (ST-T3)", () => {
    const { text } = render(
      [{ op: "load", a: temp(0, IL_WORD), b: loc("V", IL_WORD) }],
      { kind: "ret", value: temp(0, IL_WORD) },
      { returnType: IL_WORD },
    );
    expect(text).toBe(["M_f:", "    LDA V", "    LDX V+1", "    RTS"].join("\n"));
  });

  // store v,[V] (word) → STA V + STX V+1.
  it("translates a word store into STA + STX hi (ST-T4)", () => {
    const { text } = render(
      [
        { op: "const", dest: temp(0, IL_WORD), src: imm(0x0801, IL_WORD) },
        { op: "store", a: temp(0, IL_WORD), b: loc("V", IL_WORD) },
      ],
      { kind: "ret" },
    );
    expect(text).toBe(
      ["M_f:", "    LDA #$01", "    LDX #$08", "    STA V", "    STX V+1", "    RTS"].join("\n"),
    );
  });

  // const t0, imm(0x42:byte) → LDA #$42.
  it("translates a byte const into LDA immediate (ST-T5)", () => {
    const { text } = render(
      [{ op: "const", dest: temp(0, IL_BYTE), src: imm(0x42, IL_BYTE) }],
      { kind: "ret", value: temp(0, IL_BYTE) },
      { returnType: IL_BYTE },
    );
    expect(text).toBe(["M_f:", "    LDA #$42", "    RTS"].join("\n"));
  });

  // const t0, imm(0x0801:word) → LDA #$01 + LDX #$08 (lo/hi bytes).
  it("translates a word const into LDA lo + LDX hi (ST-T6)", () => {
    const { text } = render(
      [{ op: "const", dest: temp(0, IL_WORD), src: imm(0x0801, IL_WORD) }],
      { kind: "ret", value: temp(0, IL_WORD) },
      { returnType: IL_WORD },
    );
    expect(text).toBe(["M_f:", "    LDA #$01", "    LDX #$08", "    RTS"].join("\n"));
  });
});

describe("Specification: translator — arithmetic & bitwise (ST-T7..T11)", () => {
  // add t2,t0,t1 (byte): LDA a / CLC / ADC b / STA r (folded loads+store).
  it("translates a byte add with folded loads and store (ST-T7)", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_BYTE), b: loc("a", IL_BYTE) },
        { op: "load", a: temp(1, IL_BYTE), b: loc("b", IL_BYTE) },
        { op: "add", dest: temp(2, IL_BYTE), left: temp(0, IL_BYTE), right: temp(1, IL_BYTE), type: IL_BYTE },
        { op: "store", a: temp(2, IL_BYTE), b: loc("r", IL_BYTE) },
      ],
      { kind: "ret" },
    );
    expect(text).toBe(
      ["M_f:", "    LDA a", "    CLC", "    ADC b", "    STA r", "    RTS"].join("\n"),
    );
    expect(bag.hasErrors()).toBe(false);
  });

  // sub t2,t0,t1 (byte): LDA a / SEC / SBC b / STA r.
  it("translates a byte sub with SEC/SBC (ST-T8)", () => {
    const { text } = render(
      [
        { op: "load", a: temp(0, IL_BYTE), b: loc("a", IL_BYTE) },
        { op: "load", a: temp(1, IL_BYTE), b: loc("b", IL_BYTE) },
        { op: "sub", dest: temp(2, IL_BYTE), left: temp(0, IL_BYTE), right: temp(1, IL_BYTE), type: IL_BYTE },
        { op: "store", a: temp(2, IL_BYTE), b: loc("r", IL_BYTE) },
      ],
      { kind: "ret" },
    );
    expect(text).toBe(
      ["M_f:", "    LDA a", "    SEC", "    SBC b", "    STA r", "    RTS"].join("\n"),
    );
  });

  // add t2,t0,t1 (word): lo CLC/ADC then hi ADC (no second CLC).
  it("translates a word add with a single CLC and hi-byte carry (ST-T9)", () => {
    const { text } = render(
      [
        { op: "load", a: temp(0, IL_WORD), b: loc("a", IL_WORD) },
        { op: "load", a: temp(1, IL_WORD), b: loc("b", IL_WORD) },
        { op: "add", dest: temp(2, IL_WORD), left: temp(0, IL_WORD), right: temp(1, IL_WORD), type: IL_WORD },
        { op: "store", a: temp(2, IL_WORD), b: loc("r", IL_WORD) },
      ],
      { kind: "ret" },
    );
    expect(text).toBe(
      [
        "M_f:",
        "    LDA a",
        "    CLC",
        "    ADC b",
        "    STA r",
        "    LDA a+1",
        "    ADC b+1",
        "    STA r+1",
        "    RTS",
      ].join("\n"),
    );
  });

  // and/or/xor t2,t0,t1 (byte) → LDA a / AND|ORA|EOR b / STA r.
  it.each([
    ["and", "AND"],
    ["or", "ORA"],
    ["xor", "EOR"],
  ] as const)("translates a byte %s into %s (ST-T10)", (ilOp, opcode) => {
    const { text } = render(
      [
        { op: "load", a: temp(0, IL_BYTE), b: loc("a", IL_BYTE) },
        { op: "load", a: temp(1, IL_BYTE), b: loc("b", IL_BYTE) },
        { op: ilOp, dest: temp(2, IL_BYTE), left: temp(0, IL_BYTE), right: temp(1, IL_BYTE), type: IL_BYTE },
        { op: "store", a: temp(2, IL_BYTE), b: loc("r", IL_BYTE) },
      ],
      { kind: "ret" },
    );
    expect(text).toBe(
      ["M_f:", "    LDA a", `    ${opcode} b`, "    STA r", "    RTS"].join("\n"),
    );
  });

  // shl t1,t0,imm(2) (const count) → two accumulator ASLs.
  it("translates a constant-count shl into repeated ASL (ST-T11)", () => {
    const { text } = render(
      [
        { op: "load", a: temp(0, IL_BYTE), b: loc("a", IL_BYTE) },
        { op: "shl", dest: temp(1, IL_BYTE), left: temp(0, IL_BYTE), right: imm(2, IL_BYTE), type: IL_BYTE },
        { op: "store", a: temp(1, IL_BYTE), b: loc("r", IL_BYTE) },
      ],
      { kind: "ret" },
    );
    expect(text).toBe(
      ["M_f:", "    LDA a", "    ASL", "    ASL", "    STA r", "    RTS"].join("\n"),
    );
  });
});

describe("Specification: translator — deferred-op ICEs (ST-T12, ST-T24)", () => {
  // An earlier revision of this suite also pinned deferred-op ICEs for
  // variable-count shifts, `neg`, `not`, `copy`, and the direct-indexed
  // memory pair — all now live (their behavior is pinned by the co-located
  // expression and indexed-translation suites), so the deferred set shrank
  // to the pointer-tier INDIRECT pair.
  it.each([
    {
      op: "load_indirect",
      value: temp(2, IL_BYTE),
      ptr: loc("__zp_p", IL_WORD),
      offset: temp(0, IL_BYTE),
    },
    {
      op: "store_indirect",
      value: temp(0, IL_BYTE),
      ptr: loc("__zp_p", IL_WORD),
      offset: temp(1, IL_BYTE),
    },
  ] as unknown as ILInstruction[])("ICEs on the deferred op %o (ST-T24)", (ins) => {
    const bag = createDiagnosticBag();
    const stream = translateFunction(makeFn([ins], { kind: "ret" }), makePlan(), "nmos6502", bag);
    expect(bag.hasErrors()).toBe(true);
    expect(bag.getErrors()[0].code).toBe(IceCode.Unexpected);
    // No instruction entries beyond the label / terminator were produced for the op.
    const opcodes = stream.entries.filter(isInstr).map((e) => (isInstr(e) ? e.opcode : ""));
    expect(opcodes).toEqual(["RTS"]);
  });
});

describe("Specification: translator — ret terminator (ST-T20..T23)", () => {
  // ret (void) → RTS.
  it("translates a void ret into RTS (ST-T20)", () => {
    const { text } = render([], { kind: "ret" });
    expect(text).toBe(["M_f:", "    RTS"].join("\n"));
  });

  // ret v (byte) → LDA v + RTS.
  it("translates a byte ret into LDA + RTS (ST-T21)", () => {
    const { text } = render(
      [{ op: "const", dest: temp(0, IL_BYTE), src: imm(0x07, IL_BYTE) }],
      { kind: "ret", value: temp(0, IL_BYTE) },
      { returnType: IL_BYTE },
    );
    expect(text).toBe(["M_f:", "    LDA #$07", "    RTS"].join("\n"));
  });

  // ret v (word) → LDA v_lo + LDX v_hi + RTS.
  it("translates a word ret into LDA lo + LDX hi + RTS (ST-T22)", () => {
    const { text } = render(
      [{ op: "load", a: temp(0, IL_WORD), b: loc("v", IL_WORD) }],
      { kind: "ret", value: temp(0, IL_WORD) },
      { returnType: IL_WORD },
    );
    expect(text).toBe(["M_f:", "    LDA v", "    LDX v+1", "    RTS"].join("\n"));
  });

  // ret in an isInterrupt function → RTI, not RTS.
  it("translates a ret in an interrupt handler into RTI (ST-T23)", () => {
    const { text } = render([], { kind: "ret" }, { isInterrupt: true });
    expect(text).toBe(["M_f:", "    RTI"].join("\n"));
  });
});

describe("Specification: translator — source-span propagation (ST-T25)", () => {
  // a source_span op attaches its span to the next lead Instr only.
  it("attaches the carried span to the lead instruction (ST-T25)", () => {
    const span: SourceSpan = { sourceId: 0, start: 5, end: 9 };
    const bag = createDiagnosticBag();
    const stream = translateFunction(
      makeFn(
        [
          { op: "source_span", span },
          { op: "load", a: temp(0, IL_BYTE), b: loc("a", IL_BYTE) },
          { op: "load", a: temp(1, IL_BYTE), b: loc("b", IL_BYTE) },
          { op: "add", dest: temp(2, IL_BYTE), left: temp(0, IL_BYTE), right: temp(1, IL_BYTE), type: IL_BYTE },
          { op: "store", a: temp(2, IL_BYTE), b: loc("r", IL_BYTE) },
        ],
        { kind: "ret" },
      ),
      makePlan(),
      "nmos6502",
      bag,
    );
    const instrs = stream.entries.filter(isInstr);
    const lead = instrs[0];
    expect(isInstr(lead) && lead.opcode).toBe("LDA");
    expect(isInstr(lead) ? lead.sourceSpan : undefined).toEqual(span);
    // Following instructions in the sequence omit the span.
    for (const e of instrs.slice(1)) {
      expect(isInstr(e) ? e.sourceSpan : "x").toBeUndefined();
    }
    expect(bag.hasErrors()).toBe(false);
  });
});

// Comparison materialisation + mul/div/mod call-site codegen.

/** Opcodes emitted, in order, for a rendered function. */
function opcodesOf(
  instructions: readonly ILInstruction[],
  terminator: ILTerminator,
): { ops: string[]; bag: ReturnType<typeof createDiagnosticBag> } {
  const bag = createDiagnosticBag();
  const stream = translateFunction(makeFn(instructions, terminator), makePlan(), "nmos6502", bag);
  return { ops: stream.entries.filter(isInstr).map((e) => (isInstr(e) ? e.opcode : "")), bag };
}

describe("Specification: translator — comparison 0/1 materialisation (ST-T13, ST-T14)", () => {
  // eq t2,t0,t1 → CMP-based 0/1. The Z-based branch MUST come directly
  // after CMP (an LDA between CMP and the branch clobbers Z) — the
  // earlier `LDA #$01; BEQ` form always evaluated to 0 (verified wrong on real
  // VICE). Corrected form: branch-first, then materialise 0 (fall-through) / 1.
  it("translates eq into a CMP + BEQ 0/1 materialisation (ST-T13)", () => {
    const { text } = render(
      [
        { op: "load", a: temp(0, IL_BYTE), b: loc("a", IL_BYTE) },
        { op: "load", a: temp(1, IL_BYTE), b: loc("b", IL_BYTE) },
        { op: "eq", dest: temp(2, IL_BYTE), left: temp(0, IL_BYTE), right: temp(1, IL_BYTE), type: IL_BYTE },
        { op: "store", a: temp(2, IL_BYTE), b: loc("r", IL_BYTE) },
      ],
      { kind: "ret" },
    );
    expect(text).toBe(
      [
        "M_f:",
        "    LDA a",
        "    CMP b",
        "    BEQ _cmp0",
        "    LDA #$00",
        "    JMP _cmp1",
        "_cmp0:",
        "    LDA #$01",
        "_cmp1:",
        "    STA r",
        "    RTS",
      ].join("\n"),
    );
  });

  // lt t2,t0,t1 (unsigned) → CMP-based, BCC branch form.
  it("translates unsigned lt into a CMP + BCC form (ST-T14)", () => {
    const { ops } = opcodesOf(
      [
        { op: "load", a: temp(0, IL_BYTE), b: loc("a", IL_BYTE) },
        { op: "load", a: temp(1, IL_BYTE), b: loc("b", IL_BYTE) },
        { op: "lt", dest: temp(2, IL_BYTE), left: temp(0, IL_BYTE), right: temp(1, IL_BYTE), type: IL_BYTE },
        { op: "store", a: temp(2, IL_BYTE), b: loc("r", IL_BYTE) },
      ],
      { kind: "ret" },
    );
    expect(ops).toEqual(["LDA", "CMP", "LDA", "BCC", "LDA", "STA", "RTS"]);
  });
});

describe("Specification: translator — mul (ST-T15, ST-T16, ST-T17)", () => {
  // mul of two constants folds to a const; no JSR, no warning.
  it("constant-folds a mul of two immediates (ST-T15)", () => {
    const { text, bag } = render(
      [
        { op: "mul", dest: temp(0, IL_BYTE), left: imm(3, IL_BYTE), right: imm(4, IL_BYTE), type: IL_BYTE },
        { op: "store", a: temp(0, IL_BYTE), b: loc("r", IL_BYTE) },
      ],
      { kind: "ret" },
    );
    expect(text).toBe(["M_f:", "    LDA #$0C", "    STA r", "    RTS"].join("\n"));
    expect(bag.getWarnings()).toHaveLength(0);
    expect(bag.hasErrors()).toBe(false);
  });

  // mul by a constant power-of-two → shift sequence; W10172 emitted.
  it("translates mul by a power of two into shifts and warns W10172 (ST-T16)", () => {
    const { text, bag } = render(
      [
        { op: "load", a: temp(0, IL_BYTE), b: loc("a", IL_BYTE) },
        { op: "mul", dest: temp(1, IL_BYTE), left: temp(0, IL_BYTE), right: imm(8, IL_BYTE), type: IL_BYTE },
        { op: "store", a: temp(1, IL_BYTE), b: loc("r", IL_BYTE) },
      ],
      { kind: "ret" },
    );
    expect(text).toBe(
      ["M_f:", "    LDA a", "    ASL", "    ASL", "    ASL", "    STA r", "    RTS"].join("\n"),
    );
    expect(bag.getWarnings().map((w) => w.code)).toContain(DiagCode.ShiftAndAddMultiply);
  });

  // runtime mul (both operands variable) → JSR __rt_mul8; W10170 emitted.
  it("translates a runtime mul into JSR __rt_mul8 and warns W10170 (ST-T17)", () => {
    const bag = createDiagnosticBag();
    const stream = translateFunction(
      makeFn(
        [
          { op: "load", a: temp(0, IL_BYTE), b: loc("a", IL_BYTE) },
          { op: "load", a: temp(1, IL_BYTE), b: loc("b", IL_BYTE) },
          { op: "mul", dest: temp(2, IL_BYTE), left: temp(0, IL_BYTE), right: temp(1, IL_BYTE), type: IL_BYTE },
          { op: "store", a: temp(2, IL_BYTE), b: loc("r", IL_BYTE) },
        ],
        { kind: "ret" },
      ),
      makePlan(),
      "nmos6502",
      bag,
    );
    const jsr = stream.entries.filter(isInstr).find((e) => isInstr(e) && e.opcode === "JSR");
    expect(jsr && isInstr(jsr) ? jsr.operand : undefined).toMatchObject({ label: "__rt_mul8" });
    expect(bag.getWarnings().map((w) => w.code)).toContain(DiagCode.RuntimeMultiply);
    expect(bag.hasErrors()).toBe(false);
  });
});

describe("Specification: translator — div/mod (ST-T18, ST-T19)", () => {
  // div → JSR __rt_div8; W10171 emitted.
  it("translates div into JSR __rt_div8 and warns W10171 (ST-T18)", () => {
    const bag = createDiagnosticBag();
    const stream = translateFunction(
      makeFn(
        [
          { op: "load", a: temp(0, IL_BYTE), b: loc("a", IL_BYTE) },
          { op: "load", a: temp(1, IL_BYTE), b: loc("b", IL_BYTE) },
          { op: "div", dest: temp(2, IL_BYTE), left: temp(0, IL_BYTE), right: temp(1, IL_BYTE), type: IL_BYTE },
          { op: "store", a: temp(2, IL_BYTE), b: loc("r", IL_BYTE) },
        ],
        { kind: "ret" },
      ),
      makePlan(),
      "nmos6502",
      bag,
    );
    const jsr = stream.entries.filter(isInstr).find((e) => isInstr(e) && e.opcode === "JSR");
    expect(jsr && isInstr(jsr) ? jsr.operand : undefined).toMatchObject({ label: "__rt_div8" });
    expect(bag.getWarnings().map((w) => w.code)).toContain(DiagCode.RuntimeDivide);
  });

  // mod → JSR __rt_div8 (remainder return); W10171 emitted.
  it("translates mod into JSR __rt_div8 and warns W10171 (ST-T19)", () => {
    const bag = createDiagnosticBag();
    const stream = translateFunction(
      makeFn(
        [
          { op: "load", a: temp(0, IL_BYTE), b: loc("a", IL_BYTE) },
          { op: "load", a: temp(1, IL_BYTE), b: loc("b", IL_BYTE) },
          { op: "mod", dest: temp(2, IL_BYTE), left: temp(0, IL_BYTE), right: temp(1, IL_BYTE), type: IL_BYTE },
          { op: "store", a: temp(2, IL_BYTE), b: loc("r", IL_BYTE) },
        ],
        { kind: "ret" },
      ),
      makePlan(),
      "nmos6502",
      bag,
    );
    const jsr = stream.entries.filter(isInstr).find((e) => isInstr(e) && e.opcode === "JSR");
    expect(jsr && isInstr(jsr) ? jsr.operand : undefined).toMatchObject({ label: "__rt_div8" });
    expect(bag.getWarnings().map((w) => w.code)).toContain(DiagCode.RuntimeDivide);
  });
});

