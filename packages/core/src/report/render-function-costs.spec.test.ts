/**
 * Specification tests for the per-function cost section of both report
 * renderers: name + bytes + `min–max` straight-line cycle estimates, the
 * explicit no-timing-data label for CPU variants outside the NMOS table,
 * and the absent-section staging. Derived from the requirements, never from
 * the implementation.
 */

import { describe, expect, it } from "vitest";
import { buildResourceReport } from "./build-resource-report.js";
import { renderReportJson } from "./render-report-json.js";
import { renderReportTerminal } from "./render-report-terminal.js";
import type { AllocationPlan, SfaResourceData, StackAnalysis } from "../sfa/index.js";

/** Minimal AllocationPlan literal for the renderer fixtures. */
function makePlan(): AllocationPlan {
  const stackAnalysis: StackAnalysis = {
    maxMainDepth: 2,
    maxMainStackBytes: 4,
    maxIrqDepth: 0,
    maxIrqStackBytes: 0,
    irqOverhead: 0,
    totalWorstCase: 4,
    platformBudget: 230,
    exceedsWarningThreshold: false,
  };
  const resourceData: SfaResourceData = {
    frameRegionBytes: 10,
    frameRegionPeak: 10,
    frameSharingSaved: 0,
    zpUsed: 4,
    zpBudget: 30,
    ramUsed: 20,
    ramBudget: 38912,
    stackWorstCase: 4,
    stackBudget: 230,
  };
  return {
    frames: new Map(),
    dataBase: 0x0e68,
    frameRegionBase: 0x0e72,
    frameRegionSize: 10,
    peakSimultaneous: 10,
    sharingSaved: 0,
    zpAllocations: [{ name: "speed", address: 0x02, size: 4, category: "user" }],
    zpUsed: 4,
    zpBudget: 30,
    moduleVariables: [],
    moduleVariablesSize: 10,
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

const COSTS = [
  { name: "_main", bytes: 120, minCycles: 145, maxCycles: 162 },
  { name: "Main_copyBytes", bytes: 38, minCycles: 41, maxCycles: 46 },
];

describe("Specification: per-function cost rendering", () => {
  it("should render a straight-line-labeled section with name, bytes, and min–max cycles", () => {
    const report = buildResourceReport({ ...BASE_INPUTS, functionCosts: COSTS });
    const text = renderReportTerminal(report);

    expect(text).toContain("straight-line");
    expect(text).toMatch(/_main\s+120 bytes\s+145–162 cycles/);
    expect(text).toMatch(/Main_copyBytes\s+38 bytes\s+41–46 cycles/);
  });

  it("should replace cycle figures with the no-timing-data label for a non-NMOS variant", () => {
    const report = buildResourceReport({
      ...BASE_INPUTS,
      functionCosts: [{ name: "_main", bytes: 120, minCycles: 0, maxCycles: 0 }],
      cycleEstimatesUnavailable: "no timing data for this CPU variant",
    });
    const text = renderReportTerminal(report);

    expect(text).toContain("no timing data for this CPU variant");
    expect(text).toMatch(/_main\s+120 bytes/);
    expect(text).not.toMatch(/0–0 cycles/);
  });

  it("should not render the section when no costs are present", () => {
    const text = renderReportTerminal(buildResourceReport(BASE_INPUTS));
    expect(text).not.toContain("straight-line");
  });

  it("should mirror the identical per-function data in the JSON form", () => {
    const report = buildResourceReport({ ...BASE_INPUTS, functionCosts: COSTS });
    const json = JSON.parse(renderReportJson(report));

    expect(json.functionCosts).toEqual(COSTS.map((c) => ({ ...c })));
  });

  it("should mirror the no-timing-data label in the JSON form", () => {
    const report = buildResourceReport({
      ...BASE_INPUTS,
      functionCosts: [{ name: "_main", bytes: 120, minCycles: 0, maxCycles: 0 }],
      cycleEstimatesUnavailable: "no timing data for this CPU variant",
    });
    const json = JSON.parse(renderReportJson(report));
    expect(json.cycleEstimatesUnavailable).toBe("no timing data for this CPU variant");
  });
});
