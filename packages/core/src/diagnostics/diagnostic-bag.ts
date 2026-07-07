/**
 * The {@link DiagnosticBag} — the compiler's accumulator for diagnostics.
 *
 * Every compiler stage that can report a problem is handed a bag and calls
 * {@link DiagnosticBag.addError}, {@link DiagnosticBag.addWarning}, or
 * {@link DiagnosticBag.addICE}. The bag enforces three cross-cutting policies so
 * individual producers don't have to:
 *
 * 1. **Deduplication** — a diagnostic with the same `(code, sourceId, start)` as
 *    one already accepted is silently dropped.
 * 2. **Max-errors cap** — once `maxErrors` user-facing errors have been accepted,
 *    further errors are suppressed and a single truncation diagnostic is emitted.
 *    Warnings and ICEs are never capped.
 * 3. **Deterministic ordering** — {@link DiagnosticBag.getAll} returns a sorted
 *    copy so output is reproducible regardless of insertion order.
 *
 * The `add*` methods never throw: on a 6502 target there is no runtime to
 * recover, so a diagnostics sink that could itself fail would be a liability.
 */

import type { SourceSpan } from "./source-span.js";
import type { Diagnostic, DiagnosticOptions } from "./diagnostic.js";
import { DiagCode } from "./diagnostic-codes.js";

/**
 * Accumulates {@link Diagnostic}s produced across compilation, applying dedup,
 * the max-errors cap, and deterministic ordering.
 *
 * Obtain an instance via {@link createDiagnosticBag}. The bag is mutable through
 * its `add*` methods but exposes only immutable, sorted copies through its
 * queries, so callers can never corrupt its internal state.
 */
export interface DiagnosticBag {
  /**
   * Records an `"error"`-severity diagnostic, subject to dedup and the
   * max-errors cap. Does nothing (beyond possibly emitting the one-time
   * truncation diagnostic) once the cap is reached.
   */
  addError(
    code: string,
    span: SourceSpan | null,
    message: string,
    options?: DiagnosticOptions,
  ): void;
  /** Records a `"warning"`-severity diagnostic, subject to dedup. Never capped. */
  addWarning(
    code: string,
    span: SourceSpan | null,
    message: string,
    options?: DiagnosticOptions,
  ): void;
  /**
   * Records an internal compiler error, subject to dedup but never capped: a
   * suppressed compiler-bug report is worse than noise. ICEs use the
   * `"error"` severity so {@link DiagnosticBag.hasErrors} reflects them.
   */
  addICE(code: string, span: SourceSpan | null, message: string): void;
  /** `true` if any error, ICE, or the truncation sentinel has been recorded. */
  hasErrors(): boolean;
  /** Returns every recorded diagnostic as a deterministically sorted copy. */
  getAll(): Diagnostic[];
  /** Returns the `"error"`-severity diagnostics (including ICEs), sorted. */
  getErrors(): Diagnostic[];
  /** Returns the `"warning"`-severity diagnostics, sorted. */
  getWarnings(): Diagnostic[];
  /** Total number of stored diagnostics (including the truncation sentinel). */
  count(): number;
  /** `true` once the `--max-errors` cap has suppressed at least one error. */
  isErrorLimitReached(): boolean;
}

/** Default `--max-errors` value when the caller supplies none. */
const DEFAULT_MAX_ERRORS = 20;

/** Sort key for null/span-less diagnostics — they sort after every real source. */
const NULL_SPAN_SORT_KEY = Number.MAX_SAFE_INTEGER;

/**
 * Builds the dedup key for a diagnostic.
 *
 * Diagnostics dedup on `(code, sourceId, start)`; the span's `end` and the
 * message are deliberately excluded so two reports of the same problem at the
 * same place collapse even if their messages differ slightly. Span-less
 * diagnostics use `-1` for both coordinates, so two identical-code span-less
 * diagnostics dedup while distinct codes do not.
 */
function dedupKey(code: string, span: SourceSpan | null): string {
  const sourceId = span ? span.sourceId : -1;
  const start = span ? span.start : -1;
  return `${code}|${sourceId}|${start}`;
}

/**
 * Creates a fresh, empty {@link DiagnosticBag}.
 *
 * @param options Optional configuration. `maxErrors` overrides the default cap
 *   of {@link DEFAULT_MAX_ERRORS}; values are used as-is (a non-positive cap
 *   suppresses all errors after the truncation sentinel).
 * @returns A new bag with no diagnostics recorded.
 */
export function createDiagnosticBag(options?: { maxErrors?: number }): DiagnosticBag {
  const maxErrors = options?.maxErrors ?? DEFAULT_MAX_ERRORS;

  // Insertion-ordered store; getAll() returns a sorted copy of this.
  const diagnostics: Diagnostic[] = [];
  // Dedup keys of every accepted diagnostic.
  const seen = new Set<string>();
  // Count of accepted user-facing (non-ICE) errors — drives the cap.
  let errorCount = 0;
  // Whether the cap has suppressed at least one error.
  let limitReached = false;
  // Whether the one-time truncation sentinel has been appended.
  let truncationEmitted = false;

  /** Normalizes optional extras and pushes a finished diagnostic to the store. */
  function store(
    code: string,
    severity: Diagnostic["severity"],
    span: SourceSpan | null,
    message: string,
    options?: DiagnosticOptions,
  ): void {
    diagnostics.push({
      code,
      severity,
      message,
      primarySpan: span,
      secondarySpans: options?.secondarySpans ?? [],
      notes: options?.notes ?? [],
      ...(options?.help !== undefined ? { help: options.help } : {}),
    });
  }

  /** Appends the single truncation sentinel if not already emitted. */
  function emitTruncation(): void {
    if (truncationEmitted) {
      return;
    }
    truncationEmitted = true;
    // The sentinel is not counted toward errorCount and is exempt from the cap.
    store(
      DiagCode.TooManyErrors,
      "error",
      null,
      `Too many errors — stopped after ${maxErrors}. Fix earlier errors and recompile.`,
    );
  }

  function addError(
    code: string,
    span: SourceSpan | null,
    message: string,
    options?: DiagnosticOptions,
  ): void {
    // Precedence: dedup → max-errors gate → store/count.
    const key = dedupKey(code, span);
    if (seen.has(key)) {
      return;
    }
    if (errorCount >= maxErrors) {
      limitReached = true;
      emitTruncation();
      return;
    }
    seen.add(key);
    store(code, "error", span, message, options);
    errorCount += 1;
  }

  function addWarning(
    code: string,
    span: SourceSpan | null,
    message: string,
    options?: DiagnosticOptions,
  ): void {
    const key = dedupKey(code, span);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    store(code, "warning", span, message, options);
  }

  function addICE(code: string, span: SourceSpan | null, message: string): void {
    // ICEs bypass the cap but still dedup.
    const key = dedupKey(code, span);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    store(code, "error", span, message);
  }

  /** Comparison key for a diagnostic's source identity (null sorts last). */
  function sortSourceId(diag: Diagnostic): number {
    return diag.primarySpan ? diag.primarySpan.sourceId : NULL_SPAN_SORT_KEY;
  }

  /** Comparison key for a diagnostic's start offset (null sorts last). */
  function sortStart(diag: Diagnostic): number {
    return diag.primarySpan ? diag.primarySpan.start : NULL_SPAN_SORT_KEY;
  }

  function getAll(): Diagnostic[] {
    // Array.prototype.sort is stable (ES2019+), so equal keys keep insertion
    // order, making the result fully deterministic.
    return [...diagnostics].sort((a, b) => {
      const bySource = sortSourceId(a) - sortSourceId(b);
      if (bySource !== 0) {
        return bySource;
      }
      const byStart = sortStart(a) - sortStart(b);
      if (byStart !== 0) {
        return byStart;
      }
      return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
    });
  }

  function getErrors(): Diagnostic[] {
    return getAll().filter((d) => d.severity === "error");
  }

  function getWarnings(): Diagnostic[] {
    return getAll().filter((d) => d.severity === "warning");
  }

  function hasErrors(): boolean {
    // Any stored "error" severity (user errors + ICEs) or the truncation
    // sentinel constitutes a failing build.
    return diagnostics.some((d) => d.severity === "error");
  }

  function count(): number {
    return diagnostics.length;
  }

  function isErrorLimitReached(): boolean {
    return limitReached;
  }

  return {
    addError,
    addWarning,
    addICE,
    hasErrors,
    getAll,
    getErrors,
    getWarnings,
    count,
    isErrorLimitReached,
  };
}
