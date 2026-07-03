/**
 * The severity policy — the single layer that turns *natural* severities into
 * *final* severities (RD-11 §3.6/§4.4).
 *
 * Compiler stages always emit natural severity; the policy (blanket/selective
 * `--warn-as-error` promotion, selective `--suppress-warning` suppression) is
 * applied exactly once, after all diagnostics are collected (R31). Consumers
 * derive build success from the policy-applied array — never from
 * `bag.hasErrors()` (PF-005):
 *
 * ```typescript
 * const final = applySeverityPolicy(bag.getAll(), policy);
 * const buildFailed = final.some((d) => d.severity === "error");
 * ```
 *
 * Covers RD-11 R27–R31, R50 · AC-11 · AR-75, PF-005/PF-011/PF-014.
 */

import type { Diagnostic } from "./diagnostic.js";

/**
 * The resolved severity policy consumed by {@link applySeverityPolicy}.
 *
 * Build one from raw config fields via {@link createSeverityPolicy}. Suppression
 * always wins over promotion (R50), whether the promotion is blanket or
 * selective.
 */
export interface SeverityPolicy {
  /** Promote all warnings to errors (blanket `--warn-as-error`). */
  warnAsError: boolean;
  /** Specific warning codes promoted to error. */
  promoteWarnings: Set<string>;
  /** Specific warning codes suppressed. Wins over promotion (R50). */
  suppressWarnings: Set<string>;
}

/**
 * Adapts the RD-16 `BlendConfig` diagnostics fields into a {@link SeverityPolicy}.
 *
 * The input shape *is* `BlendConfig.warnAsError`/`suppressWarnings` — RD-15
 * passes them straight through (PF-005: the policy lives in exactly one place).
 * Codes are not re-validated here: RD-16 already validated their shape at load
 * time, and a code that matches nothing is a silent no-op by construction.
 *
 * @param input Raw policy fields: `warnAsError` as a blanket boolean or a list
 *   of specific codes; `suppressWarnings` as a list of codes.
 * @returns The resolved policy for {@link applySeverityPolicy}.
 */
export function createSeverityPolicy(input: {
  warnAsError: boolean | string[];
  suppressWarnings: string[];
}): SeverityPolicy {
  const blanket = input.warnAsError === true;
  const promoteWarnings = Array.isArray(input.warnAsError)
    ? new Set(input.warnAsError)
    : new Set<string>();
  return {
    warnAsError: blanket,
    promoteWarnings,
    suppressWarnings: new Set(input.suppressWarnings),
  };
}

/**
 * Applies a {@link SeverityPolicy} to a collected diagnostic array (R27–R31).
 *
 * A single pure pass in input order:
 * - `"error"` diagnostics (including ICEs and the E10000 truncation sentinel)
 *   pass through untouched (R27).
 * - Warnings whose code is suppressed are dropped (R30) — even when the same
 *   code is also promoted, blanket or selective (R50).
 * - Warnings under blanket promotion or with a listed code become errors via a
 *   shallow copy with only `severity` changed — the code string stays the
 *   W-code so output renders `error[W10xxx]` (R28/R29, AR-Q8).
 * - All other warnings pass through untouched.
 *
 * Promoted warnings are exempt from the bag's `--max-errors` cap (PF-014): the
 * cap applies to naturally-emitted errors at collection time; this layer never
 * consults it. Callers pass `bag.getAll()` (already deterministically sorted,
 * R18); the output preserves that order. Neither the input array nor any
 * record is mutated.
 *
 * @param diagnostics The collected diagnostics, natural severities intact.
 * @param policy The resolved policy from {@link createSeverityPolicy}.
 * @returns A new array with final severities. Build success is
 *   `!result.some((d) => d.severity === "error")` (PF-005).
 */
export function applySeverityPolicy(
  diagnostics: readonly Diagnostic[],
  policy: SeverityPolicy,
): Diagnostic[] {
  const result: Diagnostic[] = [];

  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === "error") {
      result.push(diagnostic);
      continue;
    }

    // Suppression wins over promotion (R50) — check it first.
    if (policy.suppressWarnings.has(diagnostic.code)) {
      continue;
    }

    if (policy.warnAsError || policy.promoteWarnings.has(diagnostic.code)) {
      // Shallow copy with only `severity` changed; the W-code is preserved so
      // the user can still find the flag that controls it (AR-Q8).
      result.push({ ...diagnostic, severity: "error" });
      continue;
    }

    result.push(diagnostic);
  }

  return result;
}
