/**
 * Specification tests for the severity policy (RD-11b Phase 2).
 *
 * ST-6..ST-11 — transcribed from RD-11 R27–R31 and R50 (as clarified by
 * AR-Q8, PF-005/PF-011/PF-014); see
 * plans/rd-11b-diagnostics-reporting/07-testing-strategy.md.
 * IMMUTABLE ORACLE: these expectations derive from the requirements, never
 * from the implementation.
 */

import { describe, expect, it } from "vitest";
import { applySeverityPolicy, createSeverityPolicy } from "./severity-policy.js";
import { createDiagnosticBag } from "./diagnostic-bag.js";
import { DiagCode, IceCode } from "./diagnostic-codes.js";
import { makeSpan } from "./source-span.js";
import type { Diagnostic } from "./diagnostic.js";

/** Terse builder for a warning-severity diagnostic record. */
function warning(code: string, start = 0): Diagnostic {
  return {
    code,
    severity: "warning",
    message: `warning ${code}`,
    primarySpan: makeSpan(0, start, start + 1),
    secondarySpans: [],
    notes: [],
  };
}

/** Terse builder for an error-severity diagnostic record. */
function error(code: string, start = 0): Diagnostic {
  return {
    code,
    severity: "error",
    message: `error ${code}`,
    primarySpan: makeSpan(0, start, start + 1),
    secondarySpans: [],
    notes: [],
  };
}

describe("severity policy (RD-11 R27–R31, R50)", () => {
  // ST-6 · R28, AR-Q8 — blanket promotion keeps the W-code string unchanged.
  it("ST-6: blanket warnAsError promotes warnings to errors with the code string unchanged", () => {
    const policy = createSeverityPolicy({ warnAsError: true, suppressWarnings: [] });
    const err = error(DiagCode.UndeclaredIdentifier);
    const warn = warning(DiagCode.UnusedVariable, 10);

    const result = applySeverityPolicy([err, warn], policy);

    expect(result).toHaveLength(2);
    // The pre-existing error is untouched.
    expect(result[0]).toEqual(err);
    // The warning became an error — but its code is STILL the W-code (AR-Q8:
    // it renders as error[W10191] so the user can find the flag to disable).
    expect(result[1].severity).toBe("error");
    expect(result[1].code).toBe(DiagCode.UnusedVariable);
  });

  // ST-7 · R29 — selective promotion touches only the listed codes.
  it("ST-7: selective warnAsError promotes only the listed code", () => {
    const policy = createSeverityPolicy({
      warnAsError: [DiagCode.LargeZpAllocation],
      suppressWarnings: [],
    });

    const result = applySeverityPolicy(
      [warning(DiagCode.LargeZpAllocation, 0), warning(DiagCode.UnusedVariable, 10)],
      policy,
    );

    expect(result).toHaveLength(2);
    expect(result[0].code).toBe(DiagCode.LargeZpAllocation);
    expect(result[0].severity).toBe("error");
    expect(result[1].code).toBe(DiagCode.UnusedVariable);
    expect(result[1].severity).toBe("warning");
  });

  // ST-8 · R30 — suppression removes the warning from the output entirely.
  it("ST-8: suppressWarnings removes the listed warning and leaves errors untouched", () => {
    const policy = createSeverityPolicy({
      warnAsError: false,
      suppressWarnings: [DiagCode.UnusedVariable],
    });
    const err = error(DiagCode.UndeclaredIdentifier, 20);

    const result = applySeverityPolicy([warning(DiagCode.UnusedVariable), err], policy);

    expect(result).toEqual([err]);
  });

  // ST-9 · R50/PF-011 — suppression wins over promotion, selective AND blanket.
  it("ST-9: suppression wins when a code is both promoted and suppressed", () => {
    const selective = createSeverityPolicy({
      warnAsError: [DiagCode.LargeZpAllocation],
      suppressWarnings: [DiagCode.LargeZpAllocation],
    });
    expect(applySeverityPolicy([warning(DiagCode.LargeZpAllocation)], selective)).toEqual([]);

    const blanket = createSeverityPolicy({
      warnAsError: true,
      suppressWarnings: [DiagCode.LargeZpAllocation],
    });
    expect(applySeverityPolicy([warning(DiagCode.LargeZpAllocation)], blanket)).toEqual([]);
  });

  // ST-10 · R27/R31 — errors/ICEs/sentinel pass through; order and inputs intact.
  it("ST-10: errors, ICEs, and the E10000 sentinel pass through untouched in input order without mutation", () => {
    const policy = createSeverityPolicy({ warnAsError: true, suppressWarnings: [] });
    const ice = error(IceCode.Unexpected, 5);
    const sentinel: Diagnostic = {
      code: DiagCode.TooManyErrors,
      severity: "error",
      message: "Too many errors",
      primarySpan: null,
      secondarySpans: [],
      notes: [],
    };
    const warn = warning(DiagCode.UnusedVariable, 30);
    const err = error(DiagCode.UndeclaredIdentifier, 40);
    const input = [ice, sentinel, warn, err];
    const inputSnapshot = [...input];

    const result = applySeverityPolicy(input, policy);

    // Pass-throughs are the SAME records, in the SAME positions.
    expect(result[0]).toBe(ice);
    expect(result[1]).toBe(sentinel);
    expect(result[3]).toBe(err);
    // The promoted warning kept its position (input order preserved, R31).
    expect(result[2].code).toBe(DiagCode.UnusedVariable);
    expect(result[2].severity).toBe("error");
    // Purity: neither the input array nor the warning record was mutated.
    expect(input).toEqual(inputSnapshot);
    expect(warn.severity).toBe("warning");
  });

  // ST-11 · R31/PF-014 — promotion is exempt from the bag's --max-errors cap.
  it("ST-11: 25 warnings under blanket promotion all become errors despite the default cap of 20", () => {
    const bag = createDiagnosticBag(); // default maxErrors = 20
    for (let i = 0; i < 25; i++) {
      // Distinct start offsets so dedup does not collapse them.
      bag.addWarning(DiagCode.UnusedVariable, makeSpan(0, i * 10, i * 10 + 1), `w${i}`);
    }

    const policy = createSeverityPolicy({ warnAsError: true, suppressWarnings: [] });
    const result = applySeverityPolicy(bag.getAll(), policy);

    expect(result).toHaveLength(25);
    expect(result.every((d) => d.severity === "error")).toBe(true);
  });
});
