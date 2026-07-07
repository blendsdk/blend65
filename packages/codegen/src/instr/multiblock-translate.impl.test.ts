/**
 * Implementation tests for multi-block translation: cross-function block-label
 * uniqueness, the `unreachable` terminator, and per-block state-reset
 * correctness — the `skipIndex` reset (a word-ALU store-fold in one block
 * must not drop the next block's instruction) and prescan coverage of
 * non-entry blocks (no dropped consumer).
 *
 * These build multi-block `ILFunction`s by hand (the lowering never emits a
 * twice-read temp, so the guards are exercised at the translator boundary).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag, IceCode, type AllocationPlan, type ZpAllocation } from "@blend65/core";
import { imm, loc, temp } from "../il/operand.js";
import { IL_BYTE, IL_WORD } from "../il/il-type.js";
import type { BasicBlock, ILFunction } from "../il/cfg.js";
import { printInstr } from "./print-instr.js";
import { translateFunction } from "./translate.js";

/** A minimal AllocationPlan with optional ZP temp scratch slots. */
function makePlan(tempSlotNames: readonly string[] = []): AllocationPlan {
  const zpAllocations: ZpAllocation[] = tempSlotNames.map((name, i) => ({
    name,
    address: 0x10 + i,
    size: 1,
    category: "temp",
  }));
  return {
    frames: new Map(),
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

/** Build a multi-block ILFunction from a name + block list. */
function makeFn(name: string, blocks: BasicBlock[]): ILFunction {
  return { name, params: [], returnType: "void", blocks, tempCount: 16, isInterrupt: false };
}

/** Translate + render to ACME text + bag. */
function render(fn: ILFunction): { text: string; bag: ReturnType<typeof createDiagnosticBag> } {
  const bag = createDiagnosticBag();
  const stream = translateFunction(fn, makePlan(), "nmos6502", bag);
  return { text: printInstr(stream), bag };
}

describe("RD-18 Slice 4a multi-block translation internals (P3)", () => {
  it("emits function-unique block labels (no cross-function collision)", () => {
    const f = makeFn("Mod.f", [
      { label: "_entry", instructions: [], terminator: { kind: "br", target: "_L0" } },
      { label: "_L0", instructions: [], terminator: { kind: "ret" } },
    ]);
    const g = makeFn("Mod.g", [
      { label: "_entry", instructions: [], terminator: { kind: "br", target: "_L0" } },
      { label: "_L0", instructions: [], terminator: { kind: "ret" } },
    ]);
    const ft = render(f).text;
    const gt = render(g).text;
    expect(ft).toContain("Mod_f_L0:");
    expect(gt).toContain("Mod_g_L0:");
    expect(ft).not.toContain("Mod_g_L0"); // labels are prefixed by the function name
  });

  it("translates an `unreachable` terminator with no ICE and no crash", () => {
    const fn = makeFn("M.f", [
      { label: "_entry", instructions: [], terminator: { kind: "br", target: "_L0" } },
      { label: "_L0", instructions: [], terminator: { kind: "unreachable" } },
    ]);
    const { text, bag } = render(fn);
    expect(bag.getAll().filter((d) => d.code === IceCode.Unexpected)).toHaveLength(0);
    expect(text).toContain("M_f_L0:"); // the block label is still emitted
  });

  it("resets skipIndex per block: a word-ALU store-fold does NOT drop the next block's instruction (PF-001)", () => {
    // _entry: word `add %0 = A + B` immediately followed by `store %0 -> W` folds
    // the store into the ALU and sets skipIndex = 1. _L0's instruction at index 1
    // (`STA X`) must NOT be dropped — resetBlockState clears skipIndex at the block
    // boundary. Without the reset, `STA X` silently vanishes.
    const fn = makeFn("M.f", [
      {
        label: "_entry",
        instructions: [
          { op: "add", dest: temp(0, IL_WORD), left: loc("A", IL_WORD), right: loc("B", IL_WORD), type: IL_WORD },
          { op: "store", a: temp(0, IL_WORD), b: loc("W", IL_WORD) },
        ],
        terminator: { kind: "br", target: "_L0" },
      },
      {
        label: "_L0",
        instructions: [
          { op: "const", dest: temp(1, IL_BYTE), src: imm(0x11, IL_BYTE) }, // index 0
          { op: "store", a: temp(1, IL_BYTE), b: loc("X", IL_BYTE) }, // index 1 — dropped if skipIndex leaks
        ],
        terminator: { kind: "ret" },
      },
    ]);
    const { text, bag } = render(fn);
    expect(bag.hasErrors()).toBe(false);
    expect(text).toContain("STA W"); // the folded word store in _entry
    expect(text).toContain("STA X"); // the _L0 store survives the block boundary
  });

  it("prescan covers non-entry blocks: a body consumer is not dropped/mis-folded (PF-001)", () => {
    // A non-entry block loads a temp and consumes it twice (two stores). prescanAll
    // counts it across all blocks; both consumers must be emitted (no dropped
    // second store).
    const fn = makeFn("M.f", [
      { label: "_entry", instructions: [], terminator: { kind: "br", target: "_L0" } },
      {
        label: "_L0",
        instructions: [
          { op: "load", a: temp(0, IL_BYTE), b: loc("V", IL_BYTE) },
          { op: "store", a: temp(0, IL_BYTE), b: loc("W", IL_BYTE) },
          { op: "store", a: temp(0, IL_BYTE), b: loc("X", IL_BYTE) },
        ],
        terminator: { kind: "ret" },
      },
    ]);
    const { text, bag } = render(fn);
    expect(bag.hasErrors()).toBe(false);
    expect(text).toContain("STA W"); // first consumer
    expect(text).toContain("STA X"); // second consumer — not dropped
  });
});
