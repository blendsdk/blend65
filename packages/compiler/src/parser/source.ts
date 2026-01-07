/**
 * Source span helpers shared by parser, analyzer, and diagnostics layers.
 *
 * The lexer already exposes {@link SourcePosition}. This module builds on
 * that shape to provide span utilities that keep error reporting consistent
 * across the compiler pipeline.
 */

import type { SourcePosition } from '../lexer/types.js';

/**
 * Represents a half-open range in the source text.
 */
export interface SourceSpan {
  /** Inclusive start position of the span. */
  start: SourcePosition;
  /** Exclusive end position of the span. */
  end: SourcePosition;
}

/**
 * Sentinel position used when a node originates from synthesized code or when
 * the parser cannot confidently determine a precise location. Using a shared
 * constant keeps comparisons and testing predictable.
 */
export const UNKNOWN_SOURCE_POSITION: SourcePosition = Object.freeze({
  line: 0,
  column: 0,
  offset: -1,
});

/**
 * Sentinel span that references {@link UNKNOWN_SOURCE_POSITION} for both the
 * start and end positions. This is helpful for placeholder nodes created
 * during error recovery.
 */
export const UNKNOWN_SOURCE_SPAN: SourceSpan = Object.freeze({
  start: UNKNOWN_SOURCE_POSITION,
  end: UNKNOWN_SOURCE_POSITION,
});

/**
 * Creates a normalized {@link SourceSpan}. Callers should prefer this helper
 * instead of manually crafting objects so future invariants (such as offset
 * ordering checks) can be centralized here.
 *
 * @param start - Location where the span begins.
 * @param end - Location where the span ends.
 * @returns A half-open span guaranteed to have non-negative length.
 */
export function createSourceSpan(start: SourcePosition, end: SourcePosition): SourceSpan {
  if (start.offset > end.offset) {
    return { start: end, end: start };
  }
  return { start, end };
}
