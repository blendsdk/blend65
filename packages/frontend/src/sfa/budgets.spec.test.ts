/**
 * Specification tests for the SFA budget-diagnostics pass (spec Ch 11 §8, Ch 14).
 *
 * Expectations derive exclusively from the language specification — NOT from
 * implementation logic. Immutable oracle.
 *
 * Spec-tests-first: authored before `budgets.ts`; verified to FAIL (red).
 * `checkBudgets` owns E10033 + the three warnings (W10030/W10033/W10180); E10032
 * is emitted by the ZP allocator and is never re-emitted here.
 */

import { describe, expect, it } from "vitest";
import type { StackAnalysis } from "@blend65/core";
import { createDiagnosticBag, DiagCode } from "@blend65/core";
import { checkBudgets } from "./budgets.js";
import { C64_FIXTURE_PROFILE } from "./test-fixtures.js";

/** A neutral stack analysis (no warning) for tests not exercising the stack. */
const QUIET_STACK: StackAnalysis = {
  maxMainDepth: 1,
  maxMainStackBytes: 2,
  maxIrqDepth: 0,
  maxIrqStackBytes: 0,
  irqOverhead: 0,
  totalWorstCase: 2,
  platformBudget: 230,
  exceedsWarningThreshold: false,
};

/** Codes present in a bag (for concise assertions). */
function codes(bag: ReturnType<typeof createDiagnosticBag>): string[] {
  return bag.getAll().map((d) => d.code);
}

describe("Specification: SFA budget diagnostics (R41–R46, §4.13)", () => {
  // RAM used > budget → E10033 (pre-ACME).
  it("should emit E10033 when RAM usage exceeds the budget (ST-S4 / AC-12)", () => {
    const bag = createDiagnosticBag();
    checkBudgets(
      {
        zpUsed: 0,
        zpBudget: 46,
        ramUsed: 0x9800 + 1, // one over the half-open RAM budget
        ramBudget: 0x9800,
        zpOverflowed: false,
        stack: QUIET_STACK,
        upstreamErrors: false,
      },
      C64_FIXTURE_PROFILE,
      bag,
    );
    expect(codes(bag)).toContain(DiagCode.RamBudgetExceeded);
  });

  // RAM used ≥ 90% budget (not over) → W10033.
  it("should emit W10033 when RAM usage is in the warning band (ST-S5 / R44)", () => {
    const bag = createDiagnosticBag();
    const ramBudget = 0x9800;
    checkBudgets(
      {
        zpUsed: 0,
        zpBudget: 46,
        ramUsed: Math.floor(ramBudget * 0.95), // ≥ 90%, < 100%
        ramBudget,
        zpOverflowed: false,
        stack: QUIET_STACK,
        upstreamErrors: false,
      },
      C64_FIXTURE_PROFILE,
      bag,
    );
    expect(codes(bag)).toContain(DiagCode.RamNearingLimit);
    expect(codes(bag)).not.toContain(DiagCode.RamBudgetExceeded);
  });

  // ZP usage ≥ 80% budget, not overflowed → W10030.
  it("should emit W10030 when ZP usage is large but not overflowed (ST-Z7 / R43)", () => {
    const bag = createDiagnosticBag();
    const zpBudget = 46;
    checkBudgets(
      {
        zpUsed: Math.ceil(zpBudget * 0.85), // ≥ 80%
        zpBudget,
        ramUsed: 0,
        ramBudget: 0x9800,
        zpOverflowed: false,
        stack: QUIET_STACK,
        upstreamErrors: false,
      },
      C64_FIXTURE_PROFILE,
      bag,
    );
    expect(codes(bag)).toContain(DiagCode.LargeZpAllocation);
  });

  // §4.13 — when the ZP allocator already overflowed, checkBudgets does NOT add
  // W10030 (the E10032 error supersedes the warning).
  it("should not add W10030 when ZP already overflowed", () => {
    const bag = createDiagnosticBag();
    checkBudgets(
      {
        zpUsed: 46,
        zpBudget: 46,
        ramUsed: 0,
        ramBudget: 0x9800,
        zpOverflowed: true,
        stack: QUIET_STACK,
        upstreamErrors: false,
      },
      C64_FIXTURE_PROFILE,
      bag,
    );
    expect(codes(bag)).not.toContain(DiagCode.LargeZpAllocation);
  });

  // Stack analysis above threshold → W10180.
  it("should emit W10180 when the stack analysis exceeds its threshold (AC-13)", () => {
    const bag = createDiagnosticBag();
    const hotStack: StackAnalysis = { ...QUIET_STACK, exceedsWarningThreshold: true };
    checkBudgets(
      {
        zpUsed: 0,
        zpBudget: 46,
        ramUsed: 0,
        ramBudget: 0x9800,
        zpOverflowed: false,
        stack: hotStack,
        upstreamErrors: false,
      },
      C64_FIXTURE_PROFILE,
      bag,
    );
    expect(codes(bag)).toContain(DiagCode.StackDepthNearLimit);
  });

  // upstreamErrors true → no budget diagnostics at all (cascade suppression).
  it("should suppress ALL budget diagnostics when upstreamErrors is true (ST-S6 / R62)", () => {
    const bag = createDiagnosticBag();
    const hotStack: StackAnalysis = { ...QUIET_STACK, exceedsWarningThreshold: true };
    checkBudgets(
      {
        zpUsed: 46,
        zpBudget: 46,
        ramUsed: 0x9800 + 100, // would be E10033
        ramBudget: 0x9800,
        zpOverflowed: false,
        stack: hotStack, // would be W10180
        upstreamErrors: true,
      },
      C64_FIXTURE_PROFILE,
      bag,
    );
    expect(bag.getAll()).toHaveLength(0);
  });
});
