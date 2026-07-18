/**
 * Implementation tests for the per-function cost section's layout edges:
 * long names keep the columns readable, and an empty cost list renders no
 * section at all (same staging as an absent one).
 */

import { describe, expect, it } from "vitest";
import { buildResourceReport } from "./build-resource-report.js";
import { renderReportTerminal } from "./render-report-terminal.js";
import type { AllocationPlan, SfaResourceData, StackAnalysis } from "../sfa/index.js";

/** Minimal AllocationPlan literal for the renderer fixtures. */
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

const BASE_INPUTS = {
  platformName: "c64",
  targetName: "main.prg",
  plan: makePlan(),
  binaryBudget: 53248,
};

describe("Implementation: function-cost section layout edges", () => {
  it("should keep a long function name on one readable line", () => {
    const name = "Sprites.updateAllHardwarePositionsForFrame";
    const report = buildResourceReport({
      ...BASE_INPUTS,
      functionCosts: [{ name, bytes: 9, minCycles: 12, maxCycles: 14 }],
    });
    const line = renderReportTerminal(report)
      .split("\n")
      .find((l) => l.includes(name));
    expect(line).toBeDefined();
    expect(line).toMatch(/9 bytes\s+12–14 cycles/);
  });

  it("should render no section for an empty cost list", () => {
    const report = buildResourceReport({ ...BASE_INPUTS, functionCosts: [] });
    expect(renderReportTerminal(report)).not.toContain("straight-line");
  });
});
