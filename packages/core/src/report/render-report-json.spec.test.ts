/**
 * Specification test for the JSON resource-report renderer.
 *
 * Transcribed from the requirement that `Map` values stringify to `{}`, so
 * `ruleHits` must convert to name-sorted entries. Derived from the
 * requirements, never from the implementation.
 */

import { describe, expect, it } from "vitest";
import { buildResourceReport } from "./build-resource-report.js";
import { renderReportJson } from "./render-report-json.js";
import { renderReportTerminal } from "./render-report-terminal.js";
import type { AllocationPlan, SfaResourceData, StackAnalysis } from "../sfa/index.js";

/** Minimal AllocationPlan literal for the JSON fixture. */
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

describe("renderReportJson (AC-19 / PF-012 / AR-Q10)", () => {
  it("ST-27: emits parseable JSON with name-sorted ruleHits entries, omitted absent optionals, and no peephole line in the terminal form", () => {
    const report = buildResourceReport({
      platformName: "c64",
      targetName: "game.prg",
      plan: makePlan(),
      binaryBudget: 40960,
      // Deliberately insertion-UNsorted Map — output entries must sort by name.
      peepholeStats: {
        totalApplications: 5,
        ruleHits: new Map([
          ["zz-redundant-load", 2],
          ["aa-dead-store", 3],
        ]),
        bytesSaved: 7,
        cyclesSaved: 11,
      },
    });

    const output = renderReportJson(report);
    const parsed = JSON.parse(output) as Record<string, unknown>;

    // Mirror object with the SFA sub-records as plain data.
    expect(parsed.platformName).toBe("c64");
    expect(parsed.targetName).toBe("game.prg");
    expect(parsed.binaryBudget).toBe(40960);
    expect(parsed.sfa).toEqual({
      frameRegionBytes: 10,
      frameRegionPeak: 10,
      frameSharingSaved: 0,
      zpUsed: 4,
      zpBudget: 30,
      ramUsed: 20,
      ramBudget: 38912,
      stackWorstCase: 4,
      stackBudget: 230,
    });
    expect(parsed.zpAllocations).toEqual([
      { name: "speed", address: 2, size: 4, category: "user" },
    ]);

    // ruleHits: name-sorted entries array (a Map would stringify to {}).
    expect(parsed.peepholeStats).toEqual({
      totalApplications: 5,
      ruleHits: [
        ["aa-dead-store", 3],
        ["zz-redundant-load", 2],
      ],
      bytesSaved: 7,
      cyclesSaved: 11,
    });

    // Absent optionals are omitted, not null (native JSON.stringify behavior).
    expect("codeSize" in parsed).toBe(false);
    expect("binarySize" in parsed).toBe(false);
    expect("startupSize" in parsed).toBe(false);

    // 2-space indent + trailing newline.
    expect(output).toBe(`${JSON.stringify(parsed, null, 2)}\n`);

    // peepholeStats never renders in the TERMINAL summary (Ch 11 §6 has no
    // optimization line).
    const terminal = renderReportTerminal(report);
    expect(terminal).not.toContain("peephole");
    expect(terminal).not.toContain("aa-dead-store");
  });
});
