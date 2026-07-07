/**
 * The JSON diagnostic renderer — machine-readable output.
 *
 * A pure function over a policy-applied `Diagnostic[]`. Each element
 * mirrors the {@link Diagnostic} record exactly; spans are emitted raw and
 * verbatim, including unresolvable ids like the config sentinel `-2` — this
 * renderer never resolves paths, hence no `SourceMap` parameter.
 * Serialization is exclusively via `JSON.stringify`, so hostile
 * message/source content can never break the JSON structure.
 */

import type { Diagnostic } from "./diagnostic.js";

/**
 * Renders diagnostics as a JSON array string.
 *
 * The top level is an **array**; each element carries
 * `{ code, severity, message, primarySpan, secondarySpans, notes, help? }`
 * with `help` omitted (not `null`) when absent. Output is
 * `JSON.stringify(value, null, 2)` plus a trailing newline. Order is the
 * caller's (policy-applied, already deterministic).
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
