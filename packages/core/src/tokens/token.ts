import type { SourceSpan } from "../diagnostics/source-span.js";
import type { TokenKindValue } from "./token-kind.js";

/**
 * A single lexical token (spec Ch 01 §11.4).
 *
 * The lexeme text is NOT stored — it is recovered lazily from the source via
 * `text.slice(token.span.start, token.span.end)`, keeping token creation
 * allocation-free for the common case (operators, punctuation, keywords).
 *
 * Covers RD-02 FR-3, FR-4 · AR-L3 · spec Ch 01 §11.4.
 */
export interface Token {
  /** The token's kind (spec Ch 01 §12). */
  readonly kind: TokenKindValue;
  /** Half-open byte-offset span into the owning source (AR-72). */
  readonly span: SourceSpan;
  /**
   * Semantic value, set only for value-bearing tokens:
   *  - `Number`: the parsed numeric value (0–65535).
   *  - `String` / `Char`: the raw, escape-UNRESOLVED text between delimiters.
   *  - all other kinds: `undefined` (lexeme recoverable from the span).
   */
  readonly value?: number | string;
}
