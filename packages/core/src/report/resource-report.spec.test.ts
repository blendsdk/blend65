/**
 * Specification tests for the resource-report builder and budget check.
 *
 * Transcribed from the requirement that the post-ACME budget check emits
 * Ch 14 E10034. Derived from the requirements, never from the implementation.
 */

import { describe, expect, it } from "vitest";
import { buildResourceReport, checkBinaryBudget } from "./build-resource-report.js";
import { createDiagnosticBag } from "../diagnostics/index.js";
import type {
  AllocationPlan,
  SfaResourceData,
  StackAnalysis,
  ZpAllocation,
} from "../sfa/index.js";

/** Hand-built, fully-populated AllocationPlan literal (all sub-records). */
function makePlan(): AllocationPlan {
  const stackAnalysis: StackAnalysis = {
    maxMainDepth: 4,
    maxMainStackBytes: 8,
    maxIrqDepth: 0,
    maxIrqStackBytes: 0,
    irqOverhead: 6,
    totalWorstCase: 14,
    platformBudget: 230,
    exceedsWarningThreshold: false,
  };
  const resourceData: SfaResourceData = {
    frameRegionBytes: 47,
    frameRegionPeak: 47,
    frameSharingSaved: 12,
    zpUsed: 16,
    zpBudget: 30,
    ramUsed: 136,
    ramBudget: 38912,
    stackWorstCase: 14,
    stackBudget: 230,
  };
  const zpAllocations: ZpAllocation[] = [
    { name: "speed", address: 0x02, size: 6, category: "user" },
    { name: "__zp_ptr_0", address: 0x08, size: 2, category: "pointer" },
    { name: "__zp_ptr_1", address: 0x0a, size: 2, category: "pointer" },
    { name: "__zp_tmp_0", address: 0x0c, size: 4, category: "temp" },
    { name: "__zp_irq_tmp_0", address: 0x10, size: 2, category: "irq-temp" },
  ];
  return {
    frames: new Map(),
    dataBase: 0x0e19,
    frameRegionBase: 0x0e72,
    frameRegionSize: 47,
    peakSimultaneous: 47,
    sharingSaved: 12,
    zpAllocations,
    zpUsed: 16,
    zpBudget: 30,
    moduleVariables: [],
    moduleVariablesSize: 89,
    stackAnalysis,
    symbolDefinitions: [],
    resourceData,
    hasErrors: false,
  };
}

describe("buildResourceReport (R40/R41 / AR-Q3)", () => {
  // SFA sub-records embed by reference.
  it("ST-22: embeds the plan's resourceData/zpAllocations/stackAnalysis verbatim and copies scalars through", () => {
    const plan = makePlan();

    const report = buildResourceReport({
      platformName: "c64",
      targetName: "game.prg",
      plan,
      binaryBudget: 40960,
      codeSize: 1247,
      dataSize: 312,
      binarySize: 1695,
      codeRange: { start: 0x0801, end: 0x0ce0 },
      startupSize: 42,
      startupCycles: 68,
    });

    // Embedded, not copied (one owner per number, structurally).
    expect(report.sfa).toBe(plan.resourceData);
    expect(report.zpAllocations).toBe(plan.zpAllocations);
    expect(report.stackAnalysis).toBe(plan.stackAnalysis);

    // Scalars copy through.
    expect(report.platformName).toBe("c64");
    expect(report.targetName).toBe("game.prg");
    expect(report.binaryBudget).toBe(40960);
    expect(report.codeSize).toBe(1247);
    expect(report.dataSize).toBe(312);
    expect(report.binarySize).toBe(1695);
    expect(report.codeRange).toEqual({ start: 0x0801, end: 0x0ce0 });
    expect(report.startupSize).toBe(42);
    expect(report.startupCycles).toBe(68);
  });
});

describe("checkBinaryBudget (R42 / AC-17 post-ACME half / AR-Q4)", () => {
  // The over/equal/undefined boundary trio.
  it("ST-23a: over budget emits exactly one E10034 with a null span and the Ch 14 message", () => {
    const plan = makePlan();
    const report = buildResourceReport({
      platformName: "c64",
      targetName: "game.prg",
      plan,
      binaryBudget: 40960,
      binarySize: 40961,
    });
    const bag = createDiagnosticBag();

    checkBinaryBudget(report, bag);

    const all = bag.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].code).toBe("E10034");
    expect(all[0].severity).toBe("error");
    expect(all[0].primarySpan).toBeNull();
    expect(all[0].message).toBe(
      "Output binary (40961 bytes) exceeds platform 'c64' maximum binary size (40960 bytes)",
    );
  });

  it("ST-23b: exactly at budget emits nothing", () => {
    const report = buildResourceReport({
      platformName: "c64",
      targetName: "game.prg",
      plan: makePlan(),
      binaryBudget: 40960,
      binarySize: 40960,
    });
    const bag = createDiagnosticBag();

    checkBinaryBudget(report, bag);

    expect(bag.count()).toBe(0);
  });

  it("ST-23c: an undefined binarySize (pre-wiring build) is a no-op", () => {
    const report = buildResourceReport({
      platformName: "c64",
      targetName: "game.prg",
      plan: makePlan(),
      binaryBudget: 40960,
    });
    const bag = createDiagnosticBag();

    checkBinaryBudget(report, bag);

    expect(bag.count()).toBe(0);
  });
});
