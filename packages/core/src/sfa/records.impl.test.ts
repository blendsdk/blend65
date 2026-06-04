/**
 * Implementation tests for the RD-05 core SFA vocabulary (Phase 1).
 *
 * Where the `*.spec.test.ts` suite asserts the documented record *contract*, this
 * suite exercises internal/edge properties of the concrete artifacts the core
 * `sfa` module actually ships: the `DEFAULT_PROFILE` value and the interim budget
 * invariants it must satisfy so the planner's budget arithmetic is well-defined.
 *
 * These are derived from the implementation (the shipped `DEFAULT_PROFILE`
 * constant), per the code.md / testing.md spec-vs-impl separation.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "../index.js";

describe("DEFAULT_PROFILE interim SFA budget invariants", () => {
  it("should keep zpStart ≤ zpEnd so the inclusive ZP budget is positive", () => {
    expect(DEFAULT_PROFILE.zpStart).toBeLessThanOrEqual(DEFAULT_PROFILE.zpEnd);
    const zpBudget = DEFAULT_PROFILE.zpEnd - DEFAULT_PROFILE.zpStart + 1;
    expect(zpBudget).toBeGreaterThan(0);
  });

  it("should keep ramStart < ramEnd so the half-open RAM budget is positive", () => {
    expect(DEFAULT_PROFILE.ramStart).toBeLessThan(DEFAULT_PROFILE.ramEnd);
    const ramBudget = DEFAULT_PROFILE.ramEnd - DEFAULT_PROFILE.ramStart;
    expect(ramBudget).toBeGreaterThan(0);
  });

  it("should default the deferred arg-block floor to 0 (D8)", () => {
    // The "arg-block" category stays plumbed but contributes 0 bytes until RD-17.
    expect(DEFAULT_PROFILE.zpArgBlockMin).toBe(0);
  });

  it("should keep all warn thresholds in the (0, 1] fraction range", () => {
    for (const t of [
      DEFAULT_PROFILE.zpWarnThreshold,
      DEFAULT_PROFILE.ramWarnThreshold,
      DEFAULT_PROFILE.stackWarnThreshold,
    ]) {
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThanOrEqual(1);
    }
  });

  it("should provide non-negative temp/stack budgets", () => {
    expect(DEFAULT_PROFILE.mainTempBytes).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_PROFILE.irqTempBytes).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_PROFILE.stackBudget).toBeGreaterThan(0);
  });
});
