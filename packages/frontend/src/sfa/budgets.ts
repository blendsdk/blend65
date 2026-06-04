/**
 * The SFA budget-diagnostics pass (RD-05 §4.13, R41–R46, R62; spec Ch 11 §8,
 * Ch 14).
 *
 * Checks the planner's RAM, zero-page, and stack usage against the platform
 * profile and emits the Ch 14 budget diagnostics through the shared
 * {@link DiagnosticBag} — **pre-ACME**, so an over-budget build stops before the
 * `.asm` is written. Division of responsibility:
 *
 *   - **E10033** (RAM over budget) and **W10033** (RAM nearing limit) — owned here.
 *   - **W10030** (large ZP allocation) — owned here, but only when the ZP allocator
 *     did NOT already overflow (E10032 supersedes the warning).
 *   - **W10180** (stack depth near limit) — owned here, driven by the precomputed
 *     {@link StackAnalysis.exceedsWarningThreshold}.
 *   - **E10032** (ZP over budget) — emitted by the ZP allocator (03-03), NEVER
 *     re-emitted here, so it appears exactly once with a precise span.
 *
 * When `upstreamErrors` is true the numbers are unreliable, so this pass emits
 * **nothing** at all (cascade suppression, R62).
 *
 * Imports `@blend65/core` only — never `@blend65/codegen` (R15/AR-20).
 * See plans/rd-05-sfa-frame-planner/03-04-stack-and-budgets.md.
 */

import type { StackAnalysis, PlatformProfile, DiagnosticBag } from "@blend65/core";
import { DiagCode } from "@blend65/core";

/** Everything `checkBudgets` needs to evaluate the three resource budgets. */
export interface BudgetInputs {
  /** Zero-page bytes used. */
  readonly zpUsed: number;
  /** Zero-page budget (inclusive: `zpEnd − zpStart + 1`). */
  readonly zpBudget: number;
  /** RAM bytes used (`moduleVarsSize + frameRegionSize`). */
  readonly ramUsed: number;
  /** RAM budget (half-open: `ramEnd − ramStart`). */
  readonly ramBudget: number;
  /** `true` if the ZP allocator already emitted E10032 (suppresses W10030). */
  readonly zpOverflowed: boolean;
  /** The precomputed stack analysis (drives W10180). */
  readonly stack: StackAnalysis;
  /** `true` to suppress ALL budget diagnostics (cascade, R62). */
  readonly upstreamErrors: boolean;
}

/**
 * Checks the RAM/ZP/stack budgets and emits the Ch 14 diagnostics (R41–R46, R62).
 *
 * @param inputs The used-vs-budget figures and the stack analysis.
 * @param profile The platform profile (supplies `name`/thresholds).
 * @param bag The diagnostic accumulator.
 */
export function checkBudgets(
  inputs: BudgetInputs,
  profile: PlatformProfile,
  bag: DiagnosticBag,
): void {
  // R62 — cascade suppression: with upstream errors the numbers are meaningless,
  // so emit nothing.
  if (inputs.upstreamErrors) {
    return;
  }

  // RAM (R42 / FR-29): error if over budget, else warn in the band.
  if (inputs.ramUsed > inputs.ramBudget) {
    bag.addError(
      DiagCode.RamBudgetExceeded,
      null,
      `RAM usage (${inputs.ramUsed} bytes) exceeds platform '${profile.name}' available RAM (${inputs.ramBudget} bytes)`,
    );
  } else if (inputs.ramUsed >= inputs.ramBudget * profile.ramWarnThreshold) {
    const percent = Math.round((inputs.ramUsed / inputs.ramBudget) * 100);
    bag.addWarning(
      DiagCode.RamNearingLimit,
      null,
      `RAM usage is ${percent}% of platform '${profile.name}' budget`,
    );
  }

  // ZP (R43 / FR-30): E10032 is emitted by the allocator at the overflow point;
  // here we only add the large-ZP warning when NOT overflowed.
  if (!inputs.zpOverflowed && inputs.zpUsed >= inputs.zpBudget * profile.zpWarnThreshold) {
    bag.addWarning(
      DiagCode.LargeZpAllocation,
      null,
      `Zeropage allocation uses ${inputs.zpUsed} of ${inputs.zpBudget} bytes`,
    );
  }

  // Stack (R40/R45 / FR-27): warn when the precomputed analysis crosses threshold.
  if (inputs.stack.exceedsWarningThreshold) {
    bag.addWarning(
      DiagCode.StackDepthNearLimit,
      null,
      `Maximum stack depth is ${inputs.stack.totalWorstCase} bytes (${inputs.stack.maxMainDepth} call levels) on platform '${profile.name}' — budget is ${inputs.stack.platformBudget} bytes`,
    );
  }
}
