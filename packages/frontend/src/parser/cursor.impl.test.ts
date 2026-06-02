import { describe, expect, it } from "vitest";
import { DiagCode, TokenKind, createDiagnosticBag, makeSpan } from "@blend65/core";
import type { Token } from "@blend65/core";
import { createCursor } from "./cursor.js";

/** The synthetic source id used by every cursor test in this file. */
const SRC = 1;

/**
 * Builds a token list for `module Main;` over the real source text so the
 * cursor's `lexeme()` (AR-8) can be exercised against genuine spans.
 *
 * Layout (byte offsets):
 *   `module Main;`
 *    0-5  KwModule     [0,6)
 *    7-10 Identifier   [7,11)
 *    11   Semicolon    [11,12)
 *    12   Eof          [12,12)
 */
const SOURCE = "module Main;";
function tokens(): Token[] {
  return [
    { kind: TokenKind.KwModule, span: makeSpan(SRC, 0, 6) },
    { kind: TokenKind.Identifier, span: makeSpan(SRC, 7, 11) },
    { kind: TokenKind.Semicolon, span: makeSpan(SRC, 11, 12) },
    { kind: TokenKind.Eof, span: makeSpan(SRC, 12, 12) },
  ];
}

describe("parser cursor — ST-P4 (FR-3, AR-8)", () => {
  it("peek() returns the current token and does not advance", () => {
    const bag = createDiagnosticBag();
    const c = createCursor(tokens(), SOURCE, SRC, bag);
    expect(c.peek().kind).toBe(TokenKind.KwModule);
    expect(c.peek().kind).toBe(TokenKind.KwModule);
  });

  it("peek(offset) looks ahead", () => {
    const bag = createDiagnosticBag();
    const c = createCursor(tokens(), SOURCE, SRC, bag);
    expect(c.peek(1).kind).toBe(TokenKind.Identifier);
    expect(c.peek(2).kind).toBe(TokenKind.Semicolon);
  });

  it("peekKind() mirrors peek().kind", () => {
    const bag = createDiagnosticBag();
    const c = createCursor(tokens(), SOURCE, SRC, bag);
    expect(c.peekKind()).toBe(TokenKind.KwModule);
    expect(c.peekKind(1)).toBe(TokenKind.Identifier);
  });

  it("advance() returns the current token then moves forward", () => {
    const bag = createDiagnosticBag();
    const c = createCursor(tokens(), SOURCE, SRC, bag);
    expect(c.advance().kind).toBe(TokenKind.KwModule);
    expect(c.advance().kind).toBe(TokenKind.Identifier);
    expect(c.peekKind()).toBe(TokenKind.Semicolon);
  });

  it("check() compares the current kind without advancing", () => {
    const bag = createDiagnosticBag();
    const c = createCursor(tokens(), SOURCE, SRC, bag);
    expect(c.check(TokenKind.KwModule)).toBe(true);
    expect(c.check(TokenKind.Identifier)).toBe(false);
    expect(c.peekKind()).toBe(TokenKind.KwModule);
  });

  it("peek past the end clamps to the single trailing Eof", () => {
    const bag = createDiagnosticBag();
    const c = createCursor(tokens(), SOURCE, SRC, bag);
    expect(c.peek(99).kind).toBe(TokenKind.Eof);
    // advancing past Eof keeps returning Eof (clamped)
    c.advance();
    c.advance();
    c.advance();
    c.advance();
    c.advance();
    expect(c.peek().kind).toBe(TokenKind.Eof);
    expect(c.advance().kind).toBe(TokenKind.Eof);
  });

  it("atEnd() is true only at Eof", () => {
    const bag = createDiagnosticBag();
    const c = createCursor(tokens(), SOURCE, SRC, bag);
    expect(c.atEnd()).toBe(false);
    c.advance(); // Identifier
    c.advance(); // Semicolon
    expect(c.atEnd()).toBe(false);
    c.advance(); // Eof
    expect(c.atEnd()).toBe(true);
  });

  it("expect() consumes and returns the token on a match", () => {
    const bag = createDiagnosticBag();
    const c = createCursor(tokens(), SOURCE, SRC, bag);
    const tok = c.expect(TokenKind.KwModule, DiagCode.UnexpectedToken, "module");
    expect(tok?.kind).toBe(TokenKind.KwModule);
    expect(c.peekKind()).toBe(TokenKind.Identifier);
    expect(bag.getAll()).toHaveLength(0);
  });

  it("expect() on a mismatch emits the code, returns null, and does NOT advance", () => {
    const bag = createDiagnosticBag();
    const c = createCursor(tokens(), SOURCE, SRC, bag);
    const tok = c.expect(TokenKind.Identifier, DiagCode.ExpectedIdentifier, "name");
    expect(tok).toBeNull();
    expect(c.peekKind()).toBe(TokenKind.KwModule); // unchanged
    const diags = bag.getAll();
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe(DiagCode.ExpectedIdentifier);
  });

  it("lexeme(token) recovers the source text for a span (AR-8)", () => {
    const bag = createDiagnosticBag();
    const c = createCursor(tokens(), SOURCE, SRC, bag);
    const [kw, ident, semi] = tokens();
    expect(c.lexeme(kw!)).toBe("module");
    expect(c.lexeme(ident!)).toBe("Main");
    expect(c.lexeme(semi!)).toBe(";");
  });
});
