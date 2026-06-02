/**
 * The parser's token {@link Cursor} (RD-03 §4.13, FR-3; AR-8).
 *
 * A position-indexed reader over the lexer's `readonly Token[]`. The token array
 * is never mutated (FR-3); the cursor only moves an internal index `i`. Reading
 * past the end always returns the single trailing `Eof` the lexer guarantees, so
 * parse functions never bounds-check.
 *
 * The cursor is also the **single site** that recovers lexeme text from the
 * source (AR-8): the frozen RD-02 `Token` stores only a `span`, never the text,
 * so {@link Cursor.lexeme} slices the `source` string the cursor closes over.
 * Every AST string field (`ModuleDecl.name`, `IdentExpr.name`, …) is filled
 * through it — keeping the frozen lexer untouched and the slicing logic in one
 * tested place.
 */

import { makeSpan } from "@blend65/core";
import type { DiagCodeValue, DiagnosticBag, SourceId, Token, TokenKindValue } from "@blend65/core";
import { TokenKind } from "@blend65/core";

/** A position-indexed, non-mutating reader over the lexer's token stream. */
export interface Cursor {
  /** The token `offset` positions ahead (default 0), clamped to the final `Eof`. */
  peek(offset?: number): Token;
  /** The kind of the token `offset` positions ahead (clamped to `Eof`). */
  peekKind(offset?: number): TokenKindValue;
  /** Returns the current token, then advances (clamped — never past `Eof`). */
  advance(): Token;
  /** `true` when the current token has the given kind. Does not advance. */
  check(kind: TokenKindValue): boolean;
  /**
   * If the current token has `kind`, consumes and returns it. Otherwise emits
   * `code` (panic-aware suppression is the caller/parser's concern; here the
   * diagnostic is added directly) and returns `null` **without** advancing, so
   * the caller's recovery sees the offending token (FR-3, FR-5).
   */
  expect(kind: TokenKindValue, code: DiagCodeValue, ctx: string): Token | null;
  /** `true` when the current token is the `Eof` terminator. */
  atEnd(): boolean;
  /** Recovers a token's source text: `source.slice(span.start, span.end)` (AR-8). */
  lexeme(token: Token): string;
}

/**
 * Builds a {@link Cursor} over `tokens`, closing over `source` for `lexeme()`.
 *
 * @param tokens   The lexer's token stream (non-empty, ends in exactly one `Eof`).
 * @param source   The full source text these tokens span (for `lexeme()`, AR-8).
 * @param sourceId The interned source identifier (for diagnostic spans).
 * @param bag      The shared diagnostic bag `expect` failures are appended to.
 */
export function createCursor(
  tokens: readonly Token[],
  source: string,
  sourceId: SourceId,
  bag: DiagnosticBag,
): Cursor {
  // The lexer guarantees a non-empty stream ending in exactly one Eof; the last
  // token is therefore always a safe clamp target for reads past the end.
  const lastIndex = tokens.length - 1;
  let i = 0;

  /** Clamps an index into `[0, lastIndex]` so reads never fall off either end. */
  function at(index: number): Token {
    const clamped = index < 0 ? 0 : index > lastIndex ? lastIndex : index;
    return tokens[clamped] as Token;
  }

  function peek(offset = 0): Token {
    return at(i + offset);
  }

  function peekKind(offset = 0): TokenKindValue {
    return peek(offset).kind;
  }

  function advance(): Token {
    const current = at(i);
    if (i < lastIndex) {
      i += 1;
    }
    return current;
  }

  function check(kind: TokenKindValue): boolean {
    return peek().kind === kind;
  }

  function expect(kind: TokenKindValue, code: DiagCodeValue, ctx: string): Token | null {
    if (check(kind)) {
      return advance();
    }
    const tok = peek();
    bag.addError(code, makeSpan(sourceId, tok.span.start, tok.span.end), `Expected ${ctx}`);
    return null;
  }

  function atEnd(): boolean {
    return peek().kind === TokenKind.Eof;
  }

  function lexeme(token: Token): string {
    return source.slice(token.span.start, token.span.end);
  }

  return { peek, peekKind, advance, check, expect, atEnd, lexeme };
}
