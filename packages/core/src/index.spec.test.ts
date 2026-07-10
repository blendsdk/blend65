import { describe, expect, it } from "vitest";
import {
  VERSION,
  applySeverityPolicy,
  buildResourceReport,
  checkBinaryBudget,
  createSeverityPolicy,
  createSourceMap,
  renderJson,
  renderReportJson,
  renderReportTerminal,
  renderTerminal,
} from "./index.js";
import type {
  BuildResourceReportInputs,
  PeepholeStats,
  ResourceReport,
  SegmentRange,
  SeverityPolicy,
  SourceMap,
} from "./index.js";

describe("@blend65/core smoke", () => {
  it("exposes VERSION 0.1.0", () => {
    expect(VERSION).toBe("0.1.0");
  });
});

describe("@blend65/core RD-11b export surface (ST-28)", () => {
  // All nine new value exports are reachable from the root barrel.
  it("re-exports the nine RD-11b value exports", () => {
    expect(typeof createSourceMap).toBe("function");
    expect(typeof applySeverityPolicy).toBe("function");
    expect(typeof createSeverityPolicy).toBe("function");
    expect(typeof renderTerminal).toBe("function");
    expect(typeof renderJson).toBe("function");
    expect(typeof buildResourceReport).toBe("function");
    expect(typeof checkBinaryBudget).toBe("function");
    expect(typeof renderReportTerminal).toBe("function");
    expect(typeof renderReportJson).toBe("function");
  });

  it("re-exports the six RD-11b types (compile-time surface)", () => {
    // These bindings only need to type-check; referencing them keeps the
    // imports live and documents the public type surface.
    const sourceMap: SourceMap = createSourceMap();
    const policy: SeverityPolicy = createSeverityPolicy({
      warnAsError: false,
      suppressWarnings: [],
    });
    const range: SegmentRange = { start: 0x0801, end: 0x0ce0 };
    const stats: PeepholeStats = {
      totalApplications: 0,
      ruleHits: new Map(),
      bytesSaved: 0,
      cyclesSaved: 0,
    };
    const inputs: BuildResourceReportInputs = {
      platformName: "c64",
      targetName: "out.prg",
      plan: {
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
      },
      binaryBudget: 0,
      peepholeStats: stats,
      codeRange: range,
    };
    const report: ResourceReport = buildResourceReport(inputs);

    expect(sourceMap.has(0)).toBe(false);
    expect(policy.warnAsError).toBe(false);
    expect(report.platformName).toBe("c64");
    expect(report.codeRange).toBe(range);
    expect(report.peepholeStats).toBe(stats);
  });
});
