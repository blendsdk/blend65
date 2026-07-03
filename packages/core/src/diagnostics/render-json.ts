/**
 * The JSON diagnostic renderer — machine-readable output (AC-13).
 *
 * A pure function over a policy-applied `Diagnostic[]` (R32). Each element
 * mirrors the {@link Diagnostic} record exactly; spans are emitted raw and
 * verbatim, including unresolvable ids like the RD-16 config sentinel `-2`
 * (R51 — this renderer never resolves paths, hence no `SourceMap` parameter,
 * §4.5). Serialization is exclusively via `JSON.stringify`, so hostile
 * message/source content can never break the JSON structure.
 *
 * Covers RD-11 §4.5 · AC-13 · R51 · AR-Q10.
 */

import type { Diagnostic } from "./diagnostic.js";

/**
 * Renders diagnostics as a JSON array string (AR-Q10).
 *
 * The top level is an **array**; each element carries
 * `{ code, severity, message, primarySpan, secondarySpans, notes, help? }`
 * with `help` omitted (not `null`) when absent. Output is
 * `JSON.stringify(value, null, 2)` plus a trailing newline. Order is the
 * caller's (policy-applied, already deterministic per R18).
 *
 * @param diagnostics The policy-applied diagnostics.
 * @returns The serialized JSON text (pure — this function never prints).
 */
export function renderJson(diagnostics: readonly Diagnostic[]): string {
  const mirrored = diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    primarySpan: diagnostic.primarySpan,
    secondarySpans: diagnostic.secondarySpans,
    notes: diagnostic.notes,
    ...(diagnostic.help !== undefined ? { help: diagnostic.help } : {}),
  }));
  return `${JSON.stringify(mirrored, null, 2)}\n`;
}
