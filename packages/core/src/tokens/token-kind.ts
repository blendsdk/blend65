/**
 * Every token kind the lexer can produce (spec Ch 01 §12).
 *
 * String-valued so golden token-list snapshots are human-readable and stable,
 * and to match the `DiagCode`/`Severity` convention already established in the
 * diagnostics core. The names are the canonical Ch 01 §12 identifiers.
 *
 * The enumerated member set is pinned by a unit test (ST-L1) so the count and
 * names cannot silently drift. See plans/rd-02-lexer/03-01-token-model.md.
 *
 * Covers RD-02 FR-1, FR-2 · AR-L6 · spec Ch 01 §12.
 */
export const TokenKind = {
  // ----- Literals (3 — boolean literals are keywords, see §12 note) -----
  /** A numeric literal: decimal, `$`hex, `0x`hex, or `0b`binary. */
  Number: "Number",
  /** A double-quoted string literal: `"…"`. */
  String: "String",
  /** A single-quoted character literal: `'…'`. */
  Char: "Char",

  // ----- Identifier (1) -----
  /** A user name, a reserved built-in identifier, or a contextual keyword. */
  Identifier: "Identifier",

  // ----- Keywords (32) -----
  KwModule: "KwModule",
  KwImport: "KwImport",
  KwExport: "KwExport",
  KwFrom: "KwFrom",
  KwFunction: "KwFunction",
  KwReturn: "KwReturn",
  KwInterrupt: "KwInterrupt",
  KwIf: "KwIf",
  KwElse: "KwElse",
  KwWhile: "KwWhile",
  KwDo: "KwDo",
  KwFor: "KwFor",
  KwSwitch: "KwSwitch",
  KwCase: "KwCase",
  KwDefault: "KwDefault",
  KwFallthrough: "KwFallthrough",
  KwBreak: "KwBreak",
  KwContinue: "KwContinue",
  KwLet: "KwLet",
  KwConst: "KwConst",
  KwZeropage: "KwZeropage",
  KwStruct: "KwStruct",
  KwByte: "KwByte",
  KwSbyte: "KwSbyte",
  KwWord: "KwWord",
  KwSword: "KwSword",
  KwBoolean: "KwBoolean",
  KwVoid: "KwVoid",
  KwTrue: "KwTrue",
  KwFalse: "KwFalse",
  KwEnum: "KwEnum",
  KwType: "KwType",

  // ----- Operators (32, incl. Question per §9.6) -----
  Plus: "Plus",
  Minus: "Minus",
  Star: "Star",
  Slash: "Slash",
  Percent: "Percent",
  Ampersand: "Ampersand",
  Pipe: "Pipe",
  Caret: "Caret",
  Tilde: "Tilde",
  ShiftLeft: "ShiftLeft",
  ShiftRight: "ShiftRight",
  LogicalAnd: "LogicalAnd",
  LogicalOr: "LogicalOr",
  Bang: "Bang",
  EqualEqual: "EqualEqual",
  BangEqual: "BangEqual",
  Less: "Less",
  LessEqual: "LessEqual",
  Greater: "Greater",
  GreaterEqual: "GreaterEqual",
  Equal: "Equal",
  PlusEqual: "PlusEqual",
  MinusEqual: "MinusEqual",
  StarEqual: "StarEqual",
  SlashEqual: "SlashEqual",
  PercentEqual: "PercentEqual",
  AmpersandEqual: "AmpersandEqual",
  PipeEqual: "PipeEqual",
  CaretEqual: "CaretEqual",
  ShiftLeftEqual: "ShiftLeftEqual",
  ShiftRightEqual: "ShiftRightEqual",
  Question: "Question",

  // ----- Punctuation (10) -----
  LParen: "LParen",
  RParen: "RParen",
  LBracket: "LBracket",
  RBracket: "RBracket",
  LBrace: "LBrace",
  RBrace: "RBrace",
  Comma: "Comma",
  Semicolon: "Semicolon",
  Colon: "Colon",
  Dot: "Dot",

  // ----- Special (1) -----
  /** The synthetic end-of-file marker; always the final token (FR-33). */
  Eof: "Eof",
} as const;

/** The union of all {@link TokenKind} string values. */
export type TokenKindValue = (typeof TokenKind)[keyof typeof TokenKind];
