/**
 * Implementation tests for the resource-report module.
 *
 * Covers internals and edge cases beyond the specification tier:
 * thousands-grouping and percentage boundaries, the arg-block-only fold,
 * builder reference identity, and field-width overflow.
 */

import { describe, expect, it } from "vitest";
import { buildResourceReport } from "./build-resource-report.js";
import { renderReportTerminal } from "./render-report-terminal.js";
import type { BuildResourceReportInputs } from "./build-resource-report.js";
import type { AllocationPlan, SfaResourceData, StackAnalysis, ZpAllocation } from "../sfa/index.js";

/** Builds a plan with the given SFA figure overrides and ZP allocations. */
function makePlan(
  resourceData?: Partial<SfaResourceData>,
  zpAllocations: ZpAllocation[] = [],
): AllocationPlan {
  const stackAnalysis: StackAnalysis = {
    maxMainDepth: 0,
    maxMainStackBytes: 0,
    maxIrqDepth: 0,
    maxIrqStackBytes: 0,
    irqOverhead: 0,
    totalWorstCase: 0,
    platformBudget: 0,
    exceedsWarningThreshold: false,
  };
  const sfa: SfaResourceData = {
    frameRegionBytes: 0,
    frameRegionPeak: 0,
    frameSharingSaved: 0,
    zpUsed: 0,
    zpBudget: 0,
    ramUsed: 0,
    ramBudget: 0,
    stackWorstCase: 0,
    stackBudget: 0,
    ...resourceData,
  };
  return {
    frames: new Map(),
    frameRegionBase: 0,
    frameRegionSize: sfa.frameRegionBytes,
    peakSimultaneous: sfa.frameRegionPeak,
    sharingSaved: sfa.frameSharingSaved,
    zpAllocations,
    zpUsed: sfa.zpUsed,
    zpBudget: sfa.zpBudget,
    moduleVariables: [],
    moduleVariablesSize: sfa.ramUsed - sfa.frameRegionBytes,
    stackAnalysis,
    symbolDefinitions: [],
    resourceData: sfa,
    hasErrors: false,
  };
}

/** Renders a report built from the given inputs (identity defaults applied). */
function render(inputs: Partial<BuildResourceReportInputs>): string {
  return renderReportTerminal(
    buildResourceReport({
      platformName: "c64",
      targetName: "out.prg",
      plan: makePlan(),
      binaryBudget: 40960,
      ...inputs,
    }),
  );
}

describe("thousands grouping boundaries", () => {
  it("does not group 999, groups 1000, and groups 1000000 twice", () => {
    expect(render({ codeSize: 999 })).toContain("Code segment:      999 bytes");
    expect(render({ codeSize: 1000 })).toContain("Code segment:    1,000 bytes");
    expect(render({ codeSize: 1_000_000 })).toContain("Code segment:1,000,000 bytes");
  });
});

describe("percentage rounding boundaries", () => {
  it("rounds .5 up and renders 0% for a zero budget", () => {
    // 1/200 = 0.5% → Math.round → 1%? No: 0.5 rounds to 1 in JS Math.round.
    expect(render({ plan: makePlan({ zpUsed: 1, zpBudget: 200 }) })).toContain(
      "/ 200 bytes (1%)",
    );
    // 1/1000 = 0.1% → rounds to 0%.
    expect(render({ plan: makePlan({ zpUsed: 1, zpBudget: 1000 }) })).toContain(
      "/ 1,000 bytes (0%)",
    );
    // 30/30 = 100%.
    expect(render({ plan: makePlan({ zpUsed: 30, zpBudget: 30 }) })).toContain(
      "/ 30 bytes (100%)",
    );
    // Over-budget values exceed 100% rather than clamping.
    expect(render({ plan: makePlan({ zpUsed: 45, zpBudget: 30 }) })).toContain(
      "/ 30 bytes (150%)",
    );
    // Zero budget → 0%, no division-by-zero artifacts.
    expect(render({ plan: makePlan({ zpUsed: 5, zpBudget: 0 }) })).toContain("/ 0 bytes (0%)");
  });
});

describe("arg-block fold edge case", () => {
  it("shows arg-block bytes as Compiler temps when no plain temps exist", () => {
    const output = render({
      plan: makePlan({ zpUsed: 2, zpBudget: 30 }, [
        { name: "__zp_arg_0", address: 0x02, size: 2, category: "arg-block" },
      ]),
    });

    expect(output).toContain("  Compiler temps:   2 bytes");
    expect(output).toContain("  User variables:   0 bytes");
  });
});

describe("builder reference identity", () => {
  it("embeds the same object references on repeated builds (no cloning)", () => {
    const plan = makePlan({ zpUsed: 4, zpBudget: 30 });
    const inputs: BuildResourceReportInputs = {
      platformName: "c64",
      targetName: "out.prg",
      plan,
      binaryBudget: 40960,
    };

    const first = buildResourceReport(inputs);
    const second = buildResourceReport(inputs);

    expect(first.sfa).toBe(plan.resourceData);
    expect(second.sfa).toBe(plan.resourceData);
    expect(first.zpAllocations).toBe(plan.zpAllocations);
    expect(first.stackAnalysis).toBe(plan.stackAnalysis);
  });
});

describe("field-width overflow", () => {
  it("extends >8-digit byte counts rightward without truncation", () => {
    const output = render({ binarySize: 123_456_789 });

    // pad(9) is exceeded ("123,456,789" is 11 chars) — the value must extend
    // rightward, keeping label and suffix intact.
    expect(output).toContain("Total binary:123,456,789 bytes");
  });

  it("extends wide hex addresses beyond 4 digits without truncation", () => {
    const output = render({ codeRange: { start: 0x10000, end: 0x1ffff } });

    expect(output).toContain("($10000–$1FFFF)");
  });
});
