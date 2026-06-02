/**
 * The structured diagnostic record produced and accumulated by the Blend65
 * compiler.
 *
 * A {@link Diagnostic} is renderer-agnostic: it carries the data describing a
 * single error or warning (code, severity, message, locations, notes) but says
 * nothing about how that data is presented. Terminal/JSON renderers (deferred to
 * RD-11b) consume this record; the core only produces and stores it.
 *
 * Covers RD-11 §4.1 (FR-9, R4–R11) · §4.3 (FR-10).
 */

import type { SourceSpan, LabeledSpan } from "./source-span.js";

/**
 * The two diagnostic severities Blend65 distinguishes.
 *
 * An `"error"` fails compilation (no binary is produced); a `"warning"` lets
 * compilation continue while informing the developer. Internal compiler errors
 * (ICEs) reuse the `"error"` severity so that {@link Diagnostic} consumers need
 * not special-case them — they are distinguished only by their code band.
 */
export type Severity = "error" | "warning";

/**
 * A single structured compiler diagnostic.
 *
 * The record is `readonly` end-to-end: once a diagnostic has been accepted by a
 * {@link DiagnosticBag} it is immutable. `secondarySpans` and `notes` always
 * materialize as arrays (empty when none were supplied) so consumers never have
 * to branch on `undefined`; only `help` stays optional.
 */
export interface Diagnostic {
  /** Canonical Ch 14 code, e.g. `"E10001"`, `"W10191"`, or an ICE `"E90001"`. */
  readonly code: string;
  /** Whether this diagnostic fails the build (`"error"`) or merely informs (`"warning"`). */
  readonly severity: Severity;
  /** Human-readable, actionable description of the problem. */
  readonly message: string;
  /** The primary location; `null` only for span-less ICEs (RD-11 R8). */
  readonly primarySpan: SourceSpan | null;
  /** Related locations with explanatory labels (empty when none). */
  readonly secondarySpans: readonly LabeledSpan[];
  /** Additional context lines (empty when none). */
  readonly notes: readonly string[];
  /** Optional single-line suggestion for how to fix the problem. */
  readonly help?: string;
}

/**
 * Optional extras accepted by the `DiagnosticBag.add*` methods.
 *
 * Every field is optional; omitted array fields are normalized to empty arrays
 * on the resulting {@link Diagnostic}. This keeps the common "code + span +
 * message" call site terse while still allowing richer diagnostics.
 */
export interface DiagnosticOptions {
  /** Related locations with explanatory labels. */
  readonly secondarySpans?: readonly LabeledSpan[];
  /** Additional context lines. */
  readonly notes?: readonly string[];
  /** Single-line fix suggestion. */
  readonly help?: string;
}
