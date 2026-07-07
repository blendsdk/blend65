/**
 * Specification tests for the SFA stack-depth analysis pass (spec Ch 11 §5,
 * Ch 06 §7.8).
 *
 * Expectations derive exclusively from the language specification — NOT from
 * implementation logic. Immutable oracle.
 *
 * Spec-tests-first: authored before `stack-analysis.ts`; verified to FAIL (red).
 */

import { describe, expect, it } from "vitest";
import { analyzeStack } from "./stack-analysis.js";
import { C64_FIXTURE_PROFILE, makeFn } from "./test-fixtures.js";

describe("Specification: SFA stack-depth analysis (R37–R40, §4.9)", () => {
  // Chain main→a→b (no irq): maxMainDepth 3; maxMainStackBytes 6;
  // irqOverhead 0.
  it("should compute main-path depth and bytes for a chain (ST-S1)", () => {
    const fns = [
      makeFn("main", { callees: ["a"] }),
      makeFn("a", { callees: ["b"] }),
      makeFn("b"),
    ];
    const stack = analyzeStack(fns, C64_FIXTURE_PROFILE);

    expect(stack.maxMainDepth).toBe(3);
    expect(stack.maxMainStackBytes).toBe(6);
    expect(stack.irqOverhead).toBe(0);
    expect(stack.maxIrqStackBytes).toBe(0);
    expect(stack.totalWorstCase).toBe(6);
  });

  // With one interrupt irq→x: irqOverhead 6; maxIrqStackBytes 4;
  // total = main + 6 + 4.
  it("should add interrupt overhead and irq path bytes (ST-S2)", () => {
    const fns = [
      makeFn("main", { callees: ["a"] }),
      makeFn("a"),
      makeFn("irq", { isInterrupt: true, callees: ["x"] }),
      makeFn("x"),
    ];
    const stack = analyzeStack(fns, C64_FIXTURE_PROFILE);

    // main→a: depth 2 → 4 bytes.
    expect(stack.maxMainStackBytes).toBe(4);
    expect(stack.irqOverhead).toBe(6);
    // irq→x: depth 2 → 4 bytes.
    expect(stack.maxIrqStackBytes).toBe(4);
    expect(stack.totalWorstCase).toBe(4 + 6 + 4);
  });

  // Total stack ≥ 75% budget → exceedsWarningThreshold true. Use a tiny
  // stack budget so the worst case crosses the 0.75 threshold.
  it("should flag exceedsWarningThreshold at/above 75% of budget (ST-S3)", () => {
    // main→a→b→c→d: depth 5 → 10 bytes. Budget 12 → 10/12 = 0.83 ≥ 0.75.
    const fns = [
      makeFn("main", { callees: ["a"] }),
      makeFn("a", { callees: ["b"] }),
      makeFn("b", { callees: ["c"] }),
      makeFn("c", { callees: ["d"] }),
      makeFn("d"),
    ];
    const tight = { ...C64_FIXTURE_PROFILE, stackBudget: 12 };
    const stack = analyzeStack(fns, tight);

    expect(stack.totalWorstCase).toBe(10);
    expect(stack.exceedsWarningThreshold).toBe(true);
  });

  // No main present → maxMainDepth 0, valid record (error tolerance).
  it("should return a valid record when no entry point is present", () => {
    const fns = [makeFn("util")];
    const stack = analyzeStack(fns, C64_FIXTURE_PROFILE);
    expect(stack.maxMainDepth).toBe(0);
    expect(stack.totalWorstCase).toBe(0);
    expect(stack.exceedsWarningThreshold).toBe(false);
  });
});
