/**
 * Implementation tests for the severity policy (RD-11b Phase 2).
 *
 * Covers internals and edge cases beyond the ST-6..ST-11 specification tier:
 * empty/all-suppressed inputs, non-mutation, promoted-copy field integrity,
 * and idempotence of a second application.
 */

import { describe, expect, it } from "vitest";
import { applySeverityPolicy, createSeverityPolicy } from "./severity-policy.js";
import { DiagCode } from "./diagnostic-codes.js";
import { makeSpan } from "./source-span.js";
import type { Diagnostic } from "./diagnostic.js";

describe("severity policy implementation details", () => {
  it("returns an empty array for empty input", () => {
    const policy = createSeverityPolicy({ warnAsError: true, suppressWarnings: [] });
    expect(applySeverityPolicy([], policy)).toEqual([]);
  });

  it("returns an empty array when every input warning is suppressed", () => {
    const policy = createSeverityPolicy({
      warnAsError: false,
      suppressWarnings: [DiagCode.UnusedVariable, DiagCode.LargeZpAllocation],
    });
    const input: Diagnostic[] = [
      {
        code: DiagCode.UnusedVariable,
        severity: "warning",
        message: "w1",
        primarySpan: makeSpan(0, 0, 1),
        secondarySpans: [],
        notes: [],
      },
      {
        code: DiagCode.LargeZpAllocation,
        severity: "warning",
        message: "w2",
        primarySpan: makeSpan(0, 5, 6),
        secondarySpans: [],
        notes: [],
      },
    ];
    expect(applySeverityPolicy(input, policy)).toEqual([]);
  });

  it("preserves every field on a promoted copy (spans, notes, help)", () => {
    const policy = createSeverityPolicy({ warnAsError: true, suppressWarnings: [] });
    const original: Diagnostic = {
      code: DiagCode.UnusedVariable,
      severity: "warning",
      message: "variable `x` is never used",
      primarySpan: makeSpan(3, 10, 15),
      secondarySpans: [{ span: makeSpan(3, 2, 5), label: "declared here" }],
      notes: ["note one", "note two"],
      help: "remove the declaration",
    };

    const [promoted] = applySeverityPolicy([original], policy);

    expect(promoted.severity).toBe("error");
    expect(promoted.code).toBe(original.code);
    expect(promoted.message).toBe(original.message);
    // Shallow copy: nested objects are the same references, not clones.
    expect(promoted.primarySpan).toBe(original.primarySpan);
    expect(promoted.secondarySpans).toBe(original.secondarySpans);
    expect(promoted.notes).toBe(original.notes);
    expect(promoted.help).toBe(original.help);
    // The original record was not mutated.
    expect(original.severity).toBe("warning");
  });

  it("is idempotent — applying the same policy twice yields the same result", () => {
    const policy = createSeverityPolicy({
      warnAsError: [DiagCode.LargeZpAllocation],
      suppressWarnings: [DiagCode.UnusedVariable],
    });
    const input: Diagnostic[] = [
      {
        code: DiagCode.LargeZpAllocation,
        severity: "warning",
        message: "large",
        primarySpan: makeSpan(0, 0, 1),
        secondarySpans: [],
        notes: [],
      },
      {
        code: DiagCode.UnusedVariable,
        severity: "warning",
        message: "unused",
        primarySpan: makeSpan(0, 5, 6),
        secondarySpans: [],
        notes: [],
      },
      {
        code: DiagCode.UndeclaredIdentifier,
        severity: "error",
        message: "undeclared",
        primarySpan: makeSpan(0, 9, 12),
        secondarySpans: [],
        notes: [],
      },
    ];

    const once = applySeverityPolicy(input, policy);
    const twice = applySeverityPolicy(once, policy);

    expect(twice).toEqual(once);
  });

  it("createSeverityPolicy maps each input shape to the documented policy", () => {
    const blanket = createSeverityPolicy({ warnAsError: true, suppressWarnings: [] });
    expect(blanket.warnAsError).toBe(true);
    expect(blanket.promoteWarnings.size).toBe(0);

    const off = createSeverityPolicy({ warnAsError: false, suppressWarnings: ["W10191"] });
    expect(off.warnAsError).toBe(false);
    expect(off.promoteWarnings.size).toBe(0);
    expect(off.suppressWarnings.has("W10191")).toBe(true);

    const selective = createSeverityPolicy({
      warnAsError: ["W10030", "W10191"],
      suppressWarnings: [],
    });
    expect(selective.warnAsError).toBe(false);
    expect(selective.promoteWarnings).toEqual(new Set(["W10030", "W10191"]));
  });
});
