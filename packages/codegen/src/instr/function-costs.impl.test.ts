/**
 * Implementation tests for the per-function cost summarizer: label and
 * directive handling, min–max accumulation over branches and indexed
 * accesses, data-stream skipping, and the non-NMOS variant marker.
 */

import { describe, expect, it } from "vitest";
import type { AllocationPlan, SfaResourceData, StackAnalysis } from "@blend65/core";
import { directive, imm8, instr, label, labelRef, symbolRef } from "@blend65/core/platform";
import type { InstrStream } from "@blend65/core/platform";

import { NO_TIMING_DATA_LABEL, summarizeFunctionCosts } from "./function-costs.js";
import type { InstrProgram } from "./instr-program.js";

/** Minimal AllocationPlan literal — the summarizer never touches it. */
function makePlan(): AllocationPlan {
  const stackAnalysis: StackAnalysis = {
    maxMainDepth: 0,
    maxMainStackBytes: 0,
    maxIrqDepth: 0,
    maxIrqStackBytes: 0,
    irqOverhead: 0,
    totalWorstCase: 0,
    platformBudget: 230,
    exceedsWarningThreshold: false,
  };
  const resourceData: SfaResourceData = {
    frameRegionBytes: 0,
    frameRegionPeak: 0,
    frameSharingSaved: 0,
    zpUsed: 0,
    zpBudget: 30,
    ramUsed: 0,
    ramBudget: 38912,
    stackWorstCase: 0,
    stackBudget: 230,
  };
  return {
    frames: new Map(),
    dataBase: 0x2000,
    frameRegionBase: 0x2000,
    frameRegionSize: 0,
    peakSimultaneous: 0,
    sharingSaved: 0,
    zpAllocations: [],
    zpUsed: 0,
    zpBudget: 30,
    moduleVariables: [],
    moduleVariablesSize: 0,
    stackAnalysis,
    symbolDefinitions: [],
    resourceData,
    hasErrors: false,
  };
}

/** A program literal around the given streams. */
function makeProgram(streams: InstrStream[]): InstrProgram {
  return { preamble: [], streams, allocationPlan: makePlan() };
}

const CODE_STREAM: InstrStream = {
  symbol: "Main.update",
  segment: "code",
  entries: [
    label("Main_update"),
    instr("LDA", "Immediate", imm8(5)), // 2 bytes, 2 cycles fixed
    instr("LDA", "AbsoluteX", symbolRef("table")), // 3 bytes, 4..5 (indexed read)
    instr("BNE", "Relative", labelRef("Main_update_L0")), // 2 bytes, 2..4 (taken + cross)
    instr("RTS", "Implied", { kind: "none" }), // 1 byte, 6 cycles
  ],
};

const DATA_STREAM: InstrStream = {
  symbol: "__data_Main_TABLE",
  segment: "data",
  entries: [label("__data_Main_TABLE"), directive({ kind: "byte", values: [1, 2, 3] })],
};

describe("Implementation: function-cost summarizer", () => {
  it("should sum bytes over all entries and cycles over instructions only, skipping data streams", () => {
    const summary = summarizeFunctionCosts(makeProgram([CODE_STREAM, DATA_STREAM]), "nmos6502");

    expect(summary.cycleEstimatesUnavailable).toBeUndefined();
    expect(summary.functionCosts).toHaveLength(1);
    const [cost] = summary.functionCosts;
    expect(cost.name).toBe("Main.update");
    expect(cost.bytes).toBe(2 + 3 + 2 + 1);
    expect(cost.minCycles).toBe(2 + 4 + 2 + 6);
    expect(cost.maxCycles).toBe(2 + 5 + 4 + 6);
  });

  it("should zero cycles and set the marker for a non-NMOS variant, keeping bytes", () => {
    const summary = summarizeFunctionCosts(makeProgram([CODE_STREAM]), "wdc65c02");

    expect(summary.cycleEstimatesUnavailable).toBe(NO_TIMING_DATA_LABEL);
    const [cost] = summary.functionCosts;
    expect(cost.bytes).toBe(8);
    expect(cost.minCycles).toBe(0);
    expect(cost.maxCycles).toBe(0);
  });

  it("should produce an empty summary for a program with only data streams", () => {
    const summary = summarizeFunctionCosts(makeProgram([DATA_STREAM]), "nmos6502");
    expect(summary.functionCosts).toHaveLength(0);
  });
});
