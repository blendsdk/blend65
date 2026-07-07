/**
 * The severity policy — the single layer that turns *natural* severities into
 * *final* severities.
 *
 * Compiler stages always emit natural severity; the policy (blanket/selective
 * `--warn-as-error` promotion, selective `--suppress-warning` suppression) is
 * applied exactly once, after all diagnostics are collected. Consumers derive
 * build success from the policy-applied array — never from `bag.hasErrors()`:
 *
 * ```typescript
 * const final = applySeverityPolicy(bag.getAll(), policy);
 * const buildFailed = final.some((d) => d.severity === "error");
 * ```
 */

import type { Diagnostic } from "./diagnostic.js";

/**
 * The resolved severity policy consumed by {@link applySeverityPolicy}.
 *
 * Build one from raw config fields via {@link createSeverityPolicy}. Suppression
 * always wins over promotion, whether the promotion is blanket or selective.
 */
export interface SeverityPolicy {
  /** Promote all warnings to errors (blanket `--warn-as-error`). */
  warnAsError: boolean;
  /** Specific warning codes promoted to error. */
  promoteWarnings: Set<string>;
  /** Specific warning codes suppressed. Wins over promotion. */
  suppressWarnings: Set<string>;
}

/**
 * Adapts the `BlendConfig` diagnostics fields into a {@link SeverityPolicy}.
 *
 * The input shape *is* `BlendConfig.warnAsError`/`suppressWarnings`, passed
 * straight through so the policy lives in exactly one place. Codes are not
 * re-validated here: config loading already validated their shape, and a
 * code that matches nothing is a silent no-op by construction.
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
 * Applies a {@link SeverityPolicy} to a collected diagnostic array.
 *
 * A single pure pass in input order:
 * - `"error"` diagnostics (including ICEs and the E10000 truncation sentinel)
 *   pass through untouched.
 * - Warnings whose code is suppressed are dropped — even when the same
 *   code is also promoted, blanket or selective.
 * - Warnings under blanket promotion or with a listed code become errors via a
 *   shallow copy with only `severity` changed — the code string stays the
 *   W-code so output renders `error[W10xxx]`.
 * - All other warnings pass through untouched.
 *
 * Promoted warnings are exempt from the bag's `--max-errors` cap: the cap
 * applies to naturally-emitted errors at collection time; this layer never
 * consults it. Callers pass `bag.getAll()` (already deterministically
 * sorted); the output preserves that order. Neither the input array nor any
 * record is mutated.
 *
 * @param diagnostics The collected diagnostics, natural severities intact.
 * @param policy The resolved policy from {@link createSeverityPolicy}.
 * @returns A new array with final severities. Build success is
 *   `!result.some((d) => d.severity === "error")`.
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

    // Suppression wins over promotion — check it first.
    if (policy.suppressWarnings.has(diagnostic.code)) {
      continue;
    }

    if (policy.warnAsError || policy.promoteWarnings.has(diagnostic.code)) {
      // Shallow copy with only `severity` changed; the W-code is preserved so
      // the user can still find the flag that controls it.
      result.push({ ...diagnostic, severity: "error" });
      continue;
    }

    result.push(diagnostic);
  }

  return result;
}
