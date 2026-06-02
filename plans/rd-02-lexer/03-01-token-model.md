# RD-02 Lexer — Token Model (core vocabulary)

> **Document**: 03-01-token-model.md
> **Parent**: [Index](00-index.md)
> **Covers**: FR-1..FR-10 · AR-L3, AR-L4, AR-L6 · spec Ch 01 §4, §5, §12

This document specifies the token **vocabulary** added to `@blend65/core` (`TokenKind`,
`Token`) and the `KEYWORD_MAP` placed in `@blend65/frontend`.

## 1. `TokenKind` — string-valued `const` map (AR-L6)

`TokenKind` is a string-valued `const … as const` object with a derived union, mirroring
the diagnostics core's `DiagCode`/`Severity` convention. **Not** a numeric enum — the AC
list requires readable golden token-list snapshots, and string values produce stable diffs.

`packages/core/src/tokens/token-kind.ts`:

```typescript
/**
 * Every token kind the lexer can produce (spec Ch 01 §12).
 *
 * String-valued so golden token-list snapshots are human-readable and stable,
 * and to match the `DiagCode`/`Severity` convention already established in the
 * diagnostics core. The names are the canonical Ch 01 §12 identifiers.
 */
export const TokenKind = {
  // ----- Literals (4 — boolean literals are keywords) -----
  Number: "Number", // decimal, $hex, 0xhex, 0bbinary
  String: "String", // "…"
  Char: "Char", // '…'

  // ----- Identifier (1) -----
  Identifier: "Identifier", // user names + reserved built-in identifiers + contextual keywords

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

  // ----- Operators (29, incl. Question per §9.6) -----
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
  Eof: "Eof",
} as const;

/** The union of all {@link TokenKind} string values. */
export type TokenKindValue = (typeof TokenKind)[keyof typeof TokenKind];
```

### Member count reconciliation (FR-2)

Ch 01 §12 says "76 token types"; RD-02 §4.1's note clarifies the canonical *set* counts to
**77** because `Question` is listed under operators (§9.6) and `Colon` under punctuation
(§10). This plan carries exactly the set above:

| Category | Count |
|----------|-------|
| Literals | 3 (`Number`, `String`, `Char`) |
| Identifier | 1 |
| Keywords | 32 |
| Operators (incl. `Question`) | 29 |
| Punctuation (incl. `Colon`) | 10 |
| Special | 1 (`Eof`) |
| **Total** | **76 distinct + the boolean note** → enumerated members = **77** |

> The literal *category* in §12 lists 3 concrete kinds (boolean literals are keywords), so
> "4 literal" in RD-02 counts the boolean-literal concept. The enumerated `TokenKind` has
> **77 members** as listed; a test (ST-L1) asserts the exact member set so the count is
> pinned and cannot drift.

## 2. `Token` — embeds a `SourceSpan` (AR-L3)

`packages/core/src/tokens/token.ts`:

```typescript
import type { SourceSpan } from "../diagnostics/source-span.js";
import type { TokenKindValue } from "./token-kind.js";

/**
 * A single lexical token (spec Ch 01 §11.4).
 *
 * The lexeme text is NOT stored — it is recovered lazily from the source via
 * `text.slice(token.span.start, token.span.end)`, keeping token creation
 * allocation-free for the common case (operators, punctuation, keywords).
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
```

**Design notes (RD-02 §4.2):**

- **Lexeme recovery** is lazy via the span — no eager string copies for operators/keywords.
- **Numeric value** is parsed at lex time, underscores stripped, prefixes consumed but not
  stored; safe as a JS `number` (max 65535).
- **String/char `value`** holds the raw text between delimiters with escapes **validated
  but unresolved** — byte resolution is RD-04's job (needs the platform profile, RD-10).
- **Line/column** is never stored per-token; computed on demand from the `LineMap`.

## 3. `KEYWORD_MAP` — frontend (AR-L4, FR-5..FR-9)

Lives in `@blend65/frontend` (lexer logic, not core vocabulary).

`packages/frontend/src/lexer/keyword-map.ts`:

```typescript
import { TokenKind, type TokenKindValue } from "@blend65/core";

/**
 * The 32 reserved keywords (spec Ch 01 §5.1), mapped to their token kinds.
 *
 * Contextual keywords (`until`, `to`, `downto`, `step`) are deliberately ABSENT
 * (§5.1.1) — the lexer always emits `Identifier` for them and the parser
 * recognizes them positionally. Reserved built-in identifiers (`peek`, `main`,
 * …) are likewise absent (§5.3) — the semantic analyzer enforces those.
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
```

**Lookup rule (FR-6):** after consuming an identifier-shaped run, look it up in
`KEYWORD_MAP`. Hit → keyword token; miss → `Identifier`. Case-sensitive (FR-9): `Break`
misses the map and becomes `Identifier`.

**Contextual keywords (FR-7):** `until`, `to`, `downto`, `step` are not in the map → always
`Identifier`. **`type` (FR-8):** maps to `KwType`; the lexer emits the token, and the
*parser* later raises E10224 — the lexer never does.

## 4. Barrels & exports

`packages/core/src/tokens/index.ts`:

```typescript
export * from "./token-kind.js";
export * from "./token.js";
```

`packages/core/src/index.ts` (addition):

```typescript
export const VERSION = "0.1.0";
export * from "./diagnostics/index.js";
export * from "./tokens/index.js"; // ← added
```

`packages/frontend/src/lexer/index.ts` re-exports `KEYWORD_MAP`, `lex`, `LexResult`
(see [03-02](03-02-lexer-algorithm.md)); `packages/frontend/src/index.ts` re-exports the
lexer barrel.

## 5. Feature-interaction notes (L8)

- **Token ↔ DiagnosticBag**: `Token.span` is a `SourceSpan`, so it passes directly to
  `bag.addError(code, token.span, …)` — no re-wrapping (AR-L3 payoff).
- **Token ↔ LineMap**: line/column for any token is `lineMap.getLineCol(token.span.start)`.
- **TokenKind ↔ parser (RD-03)**: the parser switches on `token.kind` string values;
  contextual-keyword recognition compares the *lexeme* (`text.slice(span)`) against
  `until`/`to`/`downto`/`step` only in for-header position.
