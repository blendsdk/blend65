import { TokenKind } from "@blend65/core";
import type { TokenKindValue } from "@blend65/core";

/**
 * The 32 reserved keywords (spec Ch 01 §5.1), mapped to their token kinds.
 *
 * Contextual keywords (`until`, `to`, `downto`, `step`) are deliberately ABSENT
 * (§5.1.1) — the lexer always emits `Identifier` for them and the parser
 * recognizes them positionally. Reserved built-in identifiers (`peek`, `main`,
 * …) are likewise absent (§5.3) — the semantic analyzer (RD-04) enforces those,
 * not the lexer.
 *
 * Lookup is case-sensitive (FR-9): `Break` misses the map and becomes an
 * `Identifier`. `type` maps to `KwType`; the lexer emits the token and the
 * *parser* later raises E10224 — the lexer never does (FR-8).
 *
 * Covers RD-02 FR-5..FR-9 · AR-L4 · spec Ch 01 §5.
 */
export const KEYWORD_MAP: ReadonlyMap<string, TokenKindValue> = new Map([
  ["module", TokenKind.KwModule],
  ["import", TokenKind.KwImport],
  ["export", TokenKind.KwExport],
  ["from", TokenKind.KwFrom],
  ["function", TokenKind.KwFunction],
  ["return", TokenKind.KwReturn],
  ["interrupt", TokenKind.KwInterrupt],
  ["if", TokenKind.KwIf],
  ["else", TokenKind.KwElse],
  ["while", TokenKind.KwWhile],
  ["do", TokenKind.KwDo],
  ["for", TokenKind.KwFor],
  ["switch", TokenKind.KwSwitch],
  ["case", TokenKind.KwCase],
  ["default", TokenKind.KwDefault],
  ["fallthrough", TokenKind.KwFallthrough],
  ["break", TokenKind.KwBreak],
  ["continue", TokenKind.KwContinue],
  ["let", TokenKind.KwLet],
  ["const", TokenKind.KwConst],
  ["zeropage", TokenKind.KwZeropage],
  ["struct", TokenKind.KwStruct],
  ["byte", TokenKind.KwByte],
  ["sbyte", TokenKind.KwSbyte],
  ["word", TokenKind.KwWord],
  ["sword", TokenKind.KwSword],
  ["boolean", TokenKind.KwBoolean],
  ["void", TokenKind.KwVoid],
  ["true", TokenKind.KwTrue],
  ["false", TokenKind.KwFalse],
  ["enum", TokenKind.KwEnum],
  ["type", TokenKind.KwType],
]);
