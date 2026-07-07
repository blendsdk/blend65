/**
 * Span & source-identity primitives for the Blend65 diagnostics core.
 *
 * These value objects describe *where* in the source a diagnostic (or any
 * compiler artifact) originates. They store raw UTF-8 byte offsets — the same
 * units the lexer produces while scanning bytes — and deliberately carry no
 * line/column information. Line/column (and UTF-16) positions are derived on
 * demand by {@link LineMap}, so spans stay cheap, immutable, and shareable.
 */

/**
 * Index identifying a source file.
 *
 * A plain number assigned by the SourceMap registry. Using a numeric id keeps
 * spans tiny and comparable, and lets the registry map the id back to a
 * filename/contents pair without spans needing a back-pointer.
 */
export type SourceId = number;

/**
 * A half-open byte range within a single source file.
 *
 * `start` is inclusive and `end` is exclusive; both are UTF-8 byte offsets. No
 * line/column is stored — those are derived on demand via {@link LineMap}.
 * All fields are `readonly`: spans are value objects and may be freely
 * shared without defensive copying.
 */
export interface SourceSpan {
  /** The file this span points into. */
  readonly sourceId: SourceId;
  /** Inclusive UTF-8 byte offset of the first byte of the span. */
  readonly start: number;
  /** Exclusive UTF-8 byte offset just past the last byte of the span. */
  readonly end: number;
}

/**
 * A secondary span carrying an explanatory label.
 *
 * Used by multi-span diagnostics (e.g. "defined here" / "used here") to attach
 * human-readable context to a related location. The renderer decides how to
 * present the label; the core only stores it.
 */
export interface LabeledSpan {
  /** The location being annotated. */
  readonly span: SourceSpan;
  /** Short human-readable note describing why this location matters. */
  readonly label: string;
}

/**
 * Convenience constructor for a {@link SourceSpan}.
 *
 * Keeps call sites terse and guarantees offset ordering: if `end` precedes
 * `start` (a degenerate/inverted range), `end` is clamped up to `start` so the
 * resulting span can never invert. Trusted producers may still build a
 * `SourceSpan` object literal directly when they have already validated bounds.
 *
 * @param sourceId The file the span points into.
 * @param start Inclusive UTF-8 byte offset.
 * @param end Exclusive UTF-8 byte offset; clamped to `>= start`.
 * @returns A frozen-by-convention, well-ordered span.
 */
export function makeSpan(sourceId: SourceId, start: number, end: number): SourceSpan {
  // Clamp `end` so a caller-supplied inverted range collapses to an empty span
  // at `start` rather than producing a span whose end is before its start.
  return { sourceId, start, end: end < start ? start : end };
}
