/**
 * Golden specification tests for the terminal build summary.
 *
 * The layout is transcribed VERBATIM from the frozen spec (the Ch 11 §6
 * `=== Blend65 Build Summary ===` form) with hand-rolled thousands grouping,
 * Math.round percentages, `($HHHH–$HHHH)` ranges, and zero/placeholder
 * staging for values not yet wired up. Derived from the requirements, never
 * from the implementation.
 */

import { describe, expect, it } from "vitest";
import { buildResourceReport } from "./build-resource-report.js";
import { renderReportTerminal } from "./render-report-terminal.js";
import type { AllocationPlan, SfaResourceData, StackAnalysis, ZpAllocation } from "../sfa/index.js";

/** Builds an AllocationPlan literal with configurable SFA/ZP/stack figures. */
function makePlan(overrides?: {
  resourceData?: Partial<SfaResourceData>;
  zpAllocations?: ZpAllocation[];
  stackAnalysis?: Partial<StackAnalysis>;
}): AllocationPlan {
  const stackAnalysis: StackAnalysis = {
    maxMainDepth: 4,
    maxMainStackBytes: 8,
    maxIrqDepth: 0,
    maxIrqStackBytes: 0,
    irqOverhead: 6,
    totalWorstCase: 14,
    platformBudget: 230,
    exceedsWarningThreshold: false,
    ...overrides?.stackAnalysis,
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
    ...overrides?.resourceData,
  };
  const zpAllocations: ZpAllocation[] = overrides?.zpAllocations ?? [
    { name: "speed", address: 0x02, size: 6, category: "user" },
    { name: "__zp_ptr_0", address: 0x08, size: 2, category: "pointer" },
    { name: "__zp_ptr_1", address: 0x0a, size: 2, category: "pointer" },
    { name: "__zp_tmp_0", address: 0x0c, size: 4, category: "temp" },
    { name: "__zp_irq_tmp_0", address: 0x10, size: 2, category: "irq-temp" },
  ];
  return {
    frames: new Map(),
    dataBase: 0x0e72 - (resourceData.ramUsed - resourceData.frameRegionBytes),
    frameRegionBase: 0x0e72,
    frameRegionSize: resourceData.frameRegionBytes,
    peakSimultaneous: resourceData.frameRegionPeak,
    sharingSaved: resourceData.frameSharingSaved,
    zpAllocations,
    zpUsed: resourceData.zpUsed,
    zpBudget: resourceData.zpBudget,
    moduleVariables: [],
    moduleVariablesSize: resourceData.ramUsed - resourceData.frameRegionBytes,
    stackAnalysis,
    symbolDefinitions: [],
    resourceData,
    hasErrors: false,
  };
}

describe("renderReportTerminal (Ch 11 §6 / RD-11 §4.7 golden)", () => {
  // The fully-populated normative layout.
  it("ST-24: renders the complete §4.7 layout with grouping, percentages, and ranges", () => {
    const report = buildResourceReport({
      platformName: "c64",
      targetName: "game.prg",
      plan: makePlan(),
      binaryBudget: 40960,
      codeSize: 1247,
      dataSize: 312,
      binarySize: 1695,
      codeRange: { start: 0x0801, end: 0x0ce0 },
      dataRange: { start: 0x0ce1, end: 0x0e18 },
      ramRange: { start: 0x0e19, end: 0x0e71 },
      framesRange: { start: 0x0e72, end: 0x0ea0 },
      startupSize: 42,
      startupCycles: 68,
    });

    expect(renderReportTerminal(report)).toBe(
      [
        "=== Blend65 Build Summary ===",
        "Platform: c64",
        "Target: game.prg",
        "",
        "Code segment:    1,247 bytes ($0801–$0CE0)",
        "Data segment:      312 bytes ($0CE1–$0E18)  [const arrays, strings, embed data]",
        "RAM variables:      89 bytes ($0E19–$0E71)",
        "SFA frames:         47 bytes ($0E72–$0EA0)  [peak: 47 bytes simultaneous]",
        "",
        "Zero page:",
        "  User variables:   6 bytes",
        "  Compiler temps:   4 bytes",
        "  Struct pointers:  4 bytes",
        "  IRQ temps:        2 bytes",
        "  Total:           16 / 30 bytes (53%)",
        "",
        "Hardware stack:",
        "  Max call depth:   4 levels (8 bytes)",
        "  IRQ overhead:     6 bytes",
        "  Total peak:      14 / 230 bytes (6%)",
        "",
        "Startup routine:   42 bytes, 68 cycles",
        "",
        "Total binary:    1,695 bytes",
      ].join("\n") + "\n",
    );
  });

  // Minimal report: same geometry, zeros/placeholders.
  it("ST-25: a minimal report renders the identical line set with zeros, placeholder ranges, and 0% for zero budgets", () => {
    const zeroed = makePlan({
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
      zpAllocations: [],
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
    });
    // Only sfa + identity + budget: every optional input absent. The plan's
    // zpAllocations/stackAnalysis embed regardless (they are plan-owned), so
    // the "absent optional" staging is exercised via their zeroed values and
    // the seven absent ACME/plugin inputs.
    const report = buildResourceReport({
      platformName: "c64",
      targetName: "out.prg",
      plan: zeroed,
      binaryBudget: 40960,
    });

    expect(renderReportTerminal(report)).toBe(
      [
        "=== Blend65 Build Summary ===",
        "Platform: c64",
        "Target: out.prg",
        "",
        "Code segment:        0 bytes ($0000–$0000)",
        "Data segment:        0 bytes ($0000–$0000)  [const arrays, strings, embed data]",
        "RAM variables:       0 bytes ($0000–$0000)",
        "SFA frames:          0 bytes ($0000–$0000)  [peak: 0 bytes simultaneous]",
        "",
        "Zero page:",
        "  User variables:   0 bytes",
        "  Compiler temps:   0 bytes",
        "  Struct pointers:  0 bytes",
        "  IRQ temps:        0 bytes",
        "  Total:            0 / 0 bytes (0%)",
        "",
        "Hardware stack:",
        "  Max call depth:   0 levels (0 bytes)",
        "  IRQ overhead:     0 bytes",
        "  Total peak:       0 / 0 bytes (0%)",
        "",
        "Startup routine:    0 bytes, 0 cycles",
        "",
        "Total binary:        0 bytes",
      ].join("\n") + "\n",
    );
  });

  // The arg-block fold and the zpUsed-sourced ZP total.
  it("ST-26: folds arg-block bytes into Compiler temps and takes the ZP total from zpUsed/zpBudget, not the category sum", () => {
    const report = buildResourceReport({
      platformName: "c64",
      targetName: "game.prg",
      plan: makePlan({
        resourceData: { zpUsed: 20, zpBudget: 40 },
        zpAllocations: [
          { name: "speed", address: 0x02, size: 6, category: "user" },
          { name: "__zp_ptr_0", address: 0x08, size: 4, category: "pointer" },
          { name: "__zp_tmp_0", address: 0x0c, size: 3, category: "temp" },
          { name: "__zp_arg_0", address: 0x0f, size: 1, category: "arg-block" },
          { name: "__zp_irq_tmp_0", address: 0x10, size: 2, category: "irq-temp" },
        ],
      }),
      binaryBudget: 40960,
    });

    const output = renderReportTerminal(report);

    expect(output).toContain("  User variables:   6 bytes");
    // 3 temp bytes + 1 arg-block byte fold into one line (no arg-block line).
    expect(output).toContain("  Compiler temps:   4 bytes");
    expect(output).toContain("  Struct pointers:  4 bytes");
    expect(output).toContain("  IRQ temps:        2 bytes");
    // Total comes from sfa.zpUsed/zpBudget (20/40 → 50%), NOT the 16-byte sum.
    expect(output).toContain("  Total:           20 / 40 bytes (50%)");
    expect(output).not.toContain("arg-block");
  });
});
