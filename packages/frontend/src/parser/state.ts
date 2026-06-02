/**
 * Shared parser state (RD-03 §4.13, FR-7; AR-8).
 *
 * `parse()` builds one {@link ParserState} and threads it through the
 * declaration / type / (later) statement and expression parse functions, which
 * live in sibling modules so no single file grows unwieldy (code.md 500-line
 * rule). The state owns the token {@link Cursor}, the source id embedded in every
 * span, and the panic-aware {@link ParserState.emit} sink that implements cascade
 * suppression (FR-7): the first error in a region is reported, follow-ons are
 * withheld until a sync point clears {@link ParserState.clearPanic}.
 */

import type { DiagCodeValue, SourceId, SourceSpan } from "@blend65/core";
import type { Cursor } from "./cursor.js";

/** The mutable context shared by every parse function for one source file. */
export interface ParserState {
  /** The token cursor (also the single `lexeme()` site, AR-8). */
  readonly cursor: Cursor;
  /** The source id embedded in every constructed node span. */
  readonly sourceId: SourceId;
  /**
   * Panic-aware diagnostic sink (FR-7). Reports `code` at `span` only when not
   * already in panic mode, then enters panic so secondary errors are withheld.
   */
  emit(code: DiagCodeValue, span: SourceSpan, message: string): void;
  /** Clears panic mode — called when a synchronisation point is reached. */
  clearPanic(): void;
  /** The current token's span (convenience for `cursor.peek().span`). */
  here(): SourceSpan;
}
