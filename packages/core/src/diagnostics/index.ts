/**
 * Public barrel for the Blend65 diagnostics core.
 *
 * Re-exports the span/source model, the line map, the diagnostic record and its
 * options, the canonical code namespace, and the {@link DiagnosticBag} factory.
 * Downstream packages import everything diagnostics-related from `@blend65/core`
 * (which re-exports this module) rather than reaching into individual files, so
 * the internal file layout can evolve without breaking consumers (FR-19).
 */

export type { SourceId, SourceSpan, LabeledSpan } from "./source-span.js";
export { makeSpan } from "./source-span.js";

export { LineMap } from "./line-map.js";

export type { SourceMap } from "./source-map.js";
export { createSourceMap } from "./source-map.js";

export type { Severity, Diagnostic, DiagnosticOptions } from "./diagnostic.js";

export type { SeverityPolicy } from "./severity-policy.js";
export { createSeverityPolicy, applySeverityPolicy } from "./severity-policy.js";

export type { DiagCodeValue, IceCodeValue } from "./diagnostic-codes.js";
export { DiagCode, IceCode, isIceCode } from "./diagnostic-codes.js";

export type { DiagnosticBag } from "./diagnostic-bag.js";
export { createDiagnosticBag } from "./diagnostic-bag.js";
