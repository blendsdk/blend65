# RD-02: Lexer

> **Status**: 🟢 Authored
> **MVP Phase**: A
> **Depends On**: RD-01
> **Implements**: `spec-v3.0` Chapter 01 (Lexical Structure), evaluation F021
> **Owning package(s)**: `@blend65/frontend`
> **Created**: 2026-05-31
> **Last Updated**: 2026-05-31

---

## 1. Purpose

This document specifies the **lexer** (tokenizer) — the first stage of the Blend65
compiler pipeline. The lexer reads a UTF-8 source file (supplied via the `CompilerHost`
interface, AR-40) and produces a flat stream of typed tokens that the parser (RD-03)
consumes. It implements Chapter 01 of the frozen `spec-v3.0`.

The lexer is **error-tolerant** (AR-15). It never throws on invalid input; instead it
appends structured `Diagnostic` records to the shared `DiagnosticBag` (AR-73) and
continues tokenizing. A malformed construct — an unterminated string, an unexpected
character, a bare `$` — produces a diagnostic *and* a well-defined token (usually an
error-recovery token or the best partial token available) so the parser always receives
a complete stream ending in `EOF`. This guarantee is a load-bearing commitment that
keeps the lexer usable by both the CLI compiler and the language server (AR-14/15).

## 2. Scope

**In scope:**
- The `Lexer` class/function in `@blend65/frontend` that implements Ch 01 tokenization.
- 76 token types (4 literal + 1 identifier + 32 keyword + 29 operator + 10 punctuation + 1 EOF) — see §4.1.
- Keyword table (32 keywords) with identifier-vs-keyword disambiguation.
- Contextual keywords (`until`, `to`, `downto`, `step`) — lexer produces `IDENTIFIER`;
  recognition is the parser's job (Ch 01 §5.1.1).
- All numeric literal formats: decimal, hex (`$` and `0x`/`0X`), binary (`0b`/`0B`),
  with underscore separators.
- String literals (`"…"`) and character literals (`'…'`) with escape sequences.
- Comment handling: line comments (`//`), block comments (`/* … */`, non-nesting).
- Whitespace skipping and line/column tracking.
- Maximal-munch (longest-match) tokenization with the documented disambiguation order.
- Source span tracking: every token carries `{ source: SourceId, start, end }` byte
  offsets (AR-72).
- Error-tolerant recovery: diagnostics appended to `DiagnosticBag`, never thrown (AR-73).
- All lexer error codes (E10210–E10224) and the one warning code (W10210) from Ch 01 §14.

**Out of scope (and where it lives instead):**
- Reserved built-in identifier enforcement (`peek`, `poke`, `main`, etc.) → RD-04
  (semantic analysis); the lexer produces plain `IDENTIFIER` tokens for these (Ch 01 §5.3).
- Type-specific value range checking (e.g., `300` in a `byte`) → RD-04.
- Character/string encoding transformation (`\n` → platform byte) → RD-04 + RD-10
  platform profile.
- Parser, AST, recursive-descent, Pratt → RD-03.
- `DiagnosticBag` implementation → RD-11 (`@blend65/core`); the lexer *uses* it.
- `CompilerHost` implementation → RD-15 (CLI) / RD-14 (LSP); the lexer *consumes* it.
- Source-file discovery and `blend65.json` globs → RD-16.

> **Traceability rule:** Every decision below cites the Ambiguity Register entry
> (`AR-NN`, in `00-ambiguity-register.md`) or frozen spec section that resolved it. No
> decision is invented here — discovery is closed (Zero-Ambiguity Gate PASSED).

## 3. Decisions & Requirements

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R1 | Source encoding | UTF-8; BOM silently skipped; non-ASCII outside strings/comments → E10210 | Ch 01 §2.1 |
| R2 | Case sensitivity | Fully case-sensitive; `break` is keyword, `Break` is identifier | Ch 01 §2.2 |
| R3 | Whitespace | Space, tab, CR, LF are whitespace; skipped; never significant | Ch 01 §3.1 |
| R4 | Line tracking | Line numbers increment on LF, CR+LF, and bare CR; column = 1-based byte offset from line start | Ch 01 §3.1 |
| R5 | Semicolons | `;` is a `SEMICOLON` token; no automatic semicolon insertion | Ch 01 §3.2 |
| R6 | Line comments | `//` to end of line; fully discarded | Ch 01 §3.3 |
| R7 | Block comments | `/* … */`; non-nesting; unterminated → E10211 | Ch 01 §3.4 |
| R8 | Identifier rules | Start with `[A-Za-z_]`, continue with `[A-Za-z0-9_]`; no max length | Ch 01 §4.1 |
| R9 | Keyword table | 32 keywords; identifier-shaped token checked against keyword map; match → keyword token, else → `IDENTIFIER` | Ch 01 §5.1 |
| R10 | Contextual keywords | `until`, `to`, `downto`, `step` are NOT keywords; lexer always produces `IDENTIFIER`; parser recognizes them in for-header position only | Ch 01 §5.1.1 |
| R11 | Reserved keyword `type` | Lexed as `KW_TYPE`; parser rejects with E10224 ("reserved for future version") | Ch 01 §5.1 |
| R12 | Boolean literals | `true`/`false` are keywords → `KW_TRUE`/`KW_FALSE` | Ch 01 §5.2 |
| R13 | Reserved built-in identifiers | 28 names (`peek`, `poke`, `main`, etc.) are NOT keywords; lexer produces `IDENTIFIER`; semantic analyzer enforces | Ch 01 §5.3 |
| R14 | Decimal literals | `digit { ["_"] digit }`; leading zeros allowed (W10210 warning) | Ch 01 §6.1 |
| R15 | Hex literals (`$` prefix) | `$` + hex digit mandatory; `$` alone → E10214 | Ch 01 §6.2 |
| R16 | Hex literals (`0x` prefix) | `0x`/`0X` + hex digit mandatory; bare `0x` → E10214 | Ch 01 §6.2 |
| R17 | Binary literals | `0b`/`0B` + bin digit mandatory; bare `0b` → E10215 | Ch 01 §6.3 |
| R18 | Underscore separators | Between digits only; no leading/trailing/consecutive; violation → E10213 | Ch 01 §6.4 |
| R19 | Numeric value cap | Lexer validates ≤ 65535; overflow → E10216; type-specific range → RD-04 | Ch 01 §6.5 |
| R20 | String literals | `"…"`; single-line; unterminated → E10218; newline in string → E10217 | Ch 01 §7.1 |
| R21 | Character literals | `'…'`; exactly one char/escape; empty → E10221; multi → E10222; unterminated → E10223 | Ch 01 §8 |
| R22 | Escape sequences | Closed set: `\\`, `\"`, `\'`, `\n`, `\r`, `\t`, `\0`, `\xNN`; unknown → E10219; incomplete hex → E10220 | Ch 01 §7.2 |
| R23 | Operator tokenization | Maximal munch (longest match); e.g. `<<=` is one token, not `<<` + `=` | Ch 01 §9, §11.1 |
| R24 | `&` dual purpose | Always `AMPERSAND`; parser disambiguates address-of vs bitwise AND | Ch 01 §9.7 |
| R25 | `:` shared token | Always `COLON`; parser disambiguates type annotation / case label / ternary | Ch 01 §9.6 |
| R26 | `?` token | `QUESTION`; used by conditional operator (Ch 04) | Ch 01 §9.6 |
| R27 | Comment vs operator | `//` and `/*` detected *before* operator scanning; `/` alone → `SLASH` | Ch 01 §11.3 |
| R28 | Disambiguation order | §11.2 priority: string → char → `$`hex → `0x`hex → `0b`bin → decimal → identifier/keyword → operator → punctuation → E10210 | Ch 01 §11.2 |
| R29 | Span model | Every token carries `{ source: SourceId, start: number, end: number }` (byte offsets); line/col computed on demand by `LineMap` | AR-72 |
| R30 | Error tolerance | Never throws; appends to `DiagnosticBag`; always produces a complete token stream ending in `EOF` | AR-15, AR-73 |
| R31 | Error recovery tokens | On error, produce a best-effort token (e.g., partial number with value 0, empty string) or skip the bad byte and retry; never silently drop valid input | AR-74 |
| R32 | Source input | Reads source text from `CompilerHost.readFile(sourceId)` — never directly from disk | AR-40 |
| R33 | Determinism | Same input → identical token stream + identical diagnostic set/order, every run | AR-74 (H5) |
| R34 | Package home | Lexer lives in `@blend65/frontend`; depends on `@blend65/core` for token types, span, `DiagnosticBag` | AR-20 |

## 4. Design Detail

### 4.1 Token type enumeration (76 types)

The lexer produces exactly the token types defined in Ch 01 §12. They are represented as
a TypeScript `enum` (or `const enum` / union of string literals — implementation choice)
exported from `@blend65/core` so that both `frontend` and `codegen` can reference them.

```typescript
// @blend65/core — token types
export enum TokenKind {
  // Literals (4)
  NUMBER,         // decimal, hex, binary — all numeric literals
  STRING,         // "…"
  CHAR,           // '…'
  // (boolean literals are KW_TRUE / KW_FALSE)

  // Identifiers (1)
  IDENTIFIER,     // user names + reserved built-in identifiers

  // Keywords (32)
  KW_MODULE, KW_IMPORT, KW_EXPORT, KW_FROM,
  KW_FUNCTION, KW_RETURN, KW_INTERRUPT,
  KW_IF, KW_ELSE, KW_WHILE, KW_DO, KW_FOR,
  KW_SWITCH, KW_CASE, KW_DEFAULT, KW_FALLTHROUGH,
  KW_BREAK, KW_CONTINUE,
  KW_LET, KW_CONST, KW_ZEROPAGE, KW_STRUCT,
  KW_BYTE, KW_SBYTE, KW_WORD, KW_SWORD, KW_BOOLEAN, KW_VOID,
  KW_TRUE, KW_FALSE,
  KW_ENUM, KW_TYPE,

  // Operators (29)
  PLUS, MINUS, STAR, SLASH, PERCENT,
  AMPERSAND, PIPE, CARET, TILDE, SHIFT_LEFT, SHIFT_RIGHT,
  LOGICAL_AND, LOGICAL_OR, BANG,
  EQUAL_EQUAL, BANG_EQUAL, LESS, LESS_EQUAL, GREATER, GREATER_EQUAL,
  EQUAL,
  PLUS_EQUAL, MINUS_EQUAL, STAR_EQUAL, SLASH_EQUAL, PERCENT_EQUAL,
  AMPERSAND_EQUAL, PIPE_EQUAL, CARET_EQUAL,
  SHIFT_LEFT_EQUAL, SHIFT_RIGHT_EQUAL,
  QUESTION,

  // Punctuation (10)
  LPAREN, RPAREN, LBRACKET, RBRACKET, LBRACE, RBRACE,
  COMMA, SEMICOLON, COLON, DOT,

  // Special (1)
  EOF,
}
```

> **Note on count:** Ch 01 §12 states "76 token types" but counts 28 operators + `QUESTION`
> in operators and `:` shared between operators and punctuation. The canonical count is:
> 4 + 1 + 32 + 29 operators (including `QUESTION`) + 10 punctuation + 1 EOF = **77**.
> `COLON` appears in punctuation (10); `QUESTION` appears in operators (§9.6). The
> implementation carries exactly these members; the doc count may be off-by-one due to
> `QUESTION` classification. Both this RD and the spec agree on the *set* of token types.

### 4.2 Token structure

```typescript
// @blend65/core
export interface Token {
  readonly kind: TokenKind;
  /** Byte offset of the first character in the source. */
  readonly start: number;
  /** Byte offset one past the last character. */
  readonly end: number;
  /** Interned source identifier (multi-file aware, AR-72). */
  readonly source: SourceId;
  /**
   * Semantic value — set for:
   *  - NUMBER tokens: the parsed numeric value (0–65535)
   *  - STRING tokens: the raw escape-unprocessed text between quotes
   *  - CHAR tokens: the raw escape-unprocessed character/escape
   *  - IDENTIFIER / keyword tokens: undefined (lexeme recoverable from source text)
   */
  readonly value?: number | string;
}
```

**Design notes:**

- **Lexeme recovery**: The lexeme string is recovered lazily via
  `source.text.slice(token.start, token.end)` rather than eagerly copying strings. This
  keeps token creation allocation-free for the common case (operators, punctuation,
  keywords).
- **Numeric value**: Parsed at lex time and stored in `value` as a JavaScript `number`
  (safe because max is 65535). Underscores are stripped; prefixes (`$`, `0x`, `0b`) are
  consumed but not stored.
- **String/char raw text**: Stored as the raw text between delimiters (escapes NOT yet
  resolved). Escape resolution and platform-encoding transformation happen in the
  semantic analyzer (RD-04) which has access to the platform profile (RD-10). The lexer
  only validates that each escape is syntactically well-formed.
- **Line/column**: NOT stored per-token. Computed on demand by the `LineMap` (a
  sorted array of line-start byte offsets built once per source file). This avoids per-token
  overhead and aligns with the AR-72 span model. The `LineMap` is owned by the source
  entry in the `CompilerHost`.

### 4.3 Keyword lookup

```typescript
const KEYWORD_MAP: ReadonlyMap<string, TokenKind> = new Map([
  ["module",      TokenKind.KW_MODULE],
  ["import",      TokenKind.KW_IMPORT],
  ["export",      TokenKind.KW_EXPORT],
  ["from",        TokenKind.KW_FROM],
  ["function",    TokenKind.KW_FUNCTION],
  ["return",      TokenKind.KW_RETURN],
  ["interrupt",   TokenKind.KW_INTERRUPT],
  ["if",          TokenKind.KW_IF],
  ["else",        TokenKind.KW_ELSE],
  ["while",       TokenKind.KW_WHILE],
  ["do",          TokenKind.KW_DO],
  ["for",         TokenKind.KW_FOR],
  ["switch",      TokenKind.KW_SWITCH],
  ["case",        TokenKind.KW_CASE],
  ["default",     TokenKind.KW_DEFAULT],
  ["fallthrough", TokenKind.KW_FALLTHROUGH],
  ["break",       TokenKind.KW_BREAK],
  ["continue",    TokenKind.KW_CONTINUE],
  ["let",         TokenKind.KW_LET],
  ["const",       TokenKind.KW_CONST],
  ["zeropage",    TokenKind.KW_ZEROPAGE],
  ["struct",      TokenKind.KW_STRUCT],
  ["byte",        TokenKind.KW_BYTE],
  ["sbyte",       TokenKind.KW_SBYTE],
  ["word",        TokenKind.KW_WORD],
  ["sword",       TokenKind.KW_SWORD],
  ["boolean",     TokenKind.KW_BOOLEAN],
  ["void",        TokenKind.KW_VOID],
  ["true",        TokenKind.KW_TRUE],
  ["false",       TokenKind.KW_FALSE],
  ["enum",        TokenKind.KW_ENUM],
  ["type",        TokenKind.KW_TYPE],
]);
```

After consuming an identifier-shaped sequence, the lexer looks it up in `KEYWORD_MAP`.
Match → keyword token; no match → `IDENTIFIER`. The contextual keywords (`until`, `to`,
`downto`, `step`) are **not** in this map — they always produce `IDENTIFIER`.

### 4.4 Tokenization algorithm (Ch 01 §11.2 disambiguation order)

```
function tokenize(source: SourceId, text: string, bag: DiagnosticBag): Token[]

  pos ← 0
  tokens ← []

  while pos < text.length:
    skip whitespace (space/tab/CR/LF), updating line map
    if pos ≥ text.length → break

    ch ← text[pos]

    // 1. Comments (before operators — "/" + "/" or "/" + "*")
    if ch == '/' and peek(1) == '/' → scanLineComment(); continue
    if ch == '/' and peek(1) == '*' → scanBlockComment(); continue

    // 2. String literal
    if ch == '"' → tokens.push(scanString()); continue

    // 3. Character literal
    if ch == '\'' → tokens.push(scanChar()); continue

    // 4. $ hex literal
    if ch == '$' → tokens.push(scanHexDollar()); continue

    // 5–6. 0x hex / 0b binary / decimal
    if ch is digit:
      if ch == '0' and peek(1) in ['x','X'] → tokens.push(scanHex0x()); continue
      if ch == '0' and peek(1) in ['b','B'] → tokens.push(scanBinary()); continue
      tokens.push(scanDecimal()); continue

    // 7. Identifier / keyword
    if ch is letter or '_' → tokens.push(scanIdentifier()); continue

    // 8–9. Operators (longest match) and punctuation
    if matchOperatorOrPunctuation(ch) → tokens.push(result); continue

    // 10. Unknown character → E10210
    bag.add(E10210, span(pos, pos+1), ch)
    pos++   // skip the bad byte and retry

  tokens.push(Token(EOF, pos, pos, source))
  return tokens
```

### 4.5 Error-tolerant recovery strategy (AR-15, AR-73, AR-74)

The lexer is the most straightforward pipeline stage to make error-tolerant because
individual tokens are independent. The strategy:

| Error condition | Diagnostic | Recovery action |
|----------------|------------|-----------------|
| Unexpected character (non-ASCII in code, illegal byte) | E10210 | Skip the byte; continue tokenizing from next position |
| Unterminated block comment | E10211 | Treat rest of file as comment; produce `EOF` |
| Invalid underscore in numeric literal | E10213 | Produce `NUMBER` token with the value parsed so far |
| `$` / `0x` without hex digit | E10214 | Produce `NUMBER` token with value `0` |
| `0b` without binary digit | E10215 | Produce `NUMBER` token with value `0` |
| Numeric overflow (> 65535) | E10216 | Produce `NUMBER` token with value `65535` (saturated) |
| Newline in string literal | E10217 | End the string at the newline; produce `STRING` token with content so far |
| Unterminated string | E10218 | End the string at EOL/EOF; produce `STRING` token with content so far |
| Unknown escape `\?` | E10219 | Include the backslash literally in the raw string; continue |
| Incomplete `\x` hex escape | E10220 | Include `\x` literally; continue |
| Empty char literal `''` | E10221 | Produce `CHAR` token with value `0` |
| Multi-char literal `'AB'` | E10222 | Produce `CHAR` token with value of first character |
| Unterminated char literal | E10223 | Produce `CHAR` token with what was scanned |
| Leading zeros in decimal | W10210 | Produce `NUMBER` token normally (warning only) |

**Invariant:** After any error, the lexer advances `pos` by at least one byte. This
prevents infinite loops. After recovery, tokenization continues from the new position —
the downstream parser always receives a complete stream.

**Cascade suppression (AR-74):** Lexer-level errors rarely cascade (each token is
independent), but one case exists: an unterminated block comment (E10211) swallows the
rest of the file, so no further tokens are produced and no further diagnostics are
emitted after the E10211. This is the correct behavior — reporting "unexpected character"
for every byte of the swallowed comment would violate the cascade-suppression rule.

### 4.6 Numeric literal parsing detail

```
scanDecimal():
  start ← pos
  while pos < text.length and (text[pos] is digit or text[pos] == '_'):
    validate underscore rules (R18)
    pos++
  raw ← text[start..pos] with underscores stripped
  value ← parseInt(raw, 10)
  if value > 65535 → E10216, value ← 65535
  if raw starts with "0" and raw.length > 1 → W10210
  return Token(NUMBER, start, pos, source, value)

scanHexDollar():
  start ← pos   // pos is at '$'
  pos++          // skip '$'
  if pos ≥ text.length or text[pos] is not hex digit → E10214, return Token(NUMBER, start, pos, source, 0)
  while pos < text.length and (text[pos] is hex digit or text[pos] == '_'):
    validate underscore rules
    pos++
  raw ← text[start+1..pos] with underscores stripped
  value ← parseInt(raw, 16)
  if value > 65535 → E10216, value ← 65535
  return Token(NUMBER, start, pos, source, value)

scanHex0x():   // analogous to scanHexDollar but skips 2 bytes for "0x"/"0X"
scanBinary():  // analogous but base-2, skips 2 bytes for "0b"/"0B"
```

### 4.7 String and character literal parsing detail

The lexer scans string/char literals to validate syntax and collect the **raw** text
(escapes unresolved). Escape validation is performed at lex time (well-formedness check:
known escape character, `\xNN` has exactly 2 hex digits), but the actual byte-value
resolution is deferred to the semantic analyzer (RD-04) because `\n`, `\r`, `\t`, `\"`,
`\'` produce encoding-dependent bytes that require the platform profile (RD-10).

The `value` field of `STRING` and `CHAR` tokens stores the raw text between delimiters
(after escape validation but before encoding resolution).

### 4.8 `LineMap` construction

While scanning, the lexer builds a `LineMap` — a sorted array of byte offsets where each
line begins. This is constructed incrementally during the whitespace/newline-skipping pass.

```typescript
// @blend65/core
export class LineMap {
  /** Sorted array of byte offsets where each line starts. lineStarts[0] is always 0. */
  readonly lineStarts: readonly number[];

  /** Given a byte offset, returns { line: 1-based, column: 1-based byte offset }. */
  getLineAndColumn(offset: number): { line: number; column: number };

  /** Given a byte offset, returns the UTF-16 column (for LSP). */
  getUtf16Column(offset: number, sourceText: string): number;
}
```

The `LineMap` is stored alongside the source text in the source registry (managed by
`CompilerHost` / the source-file store that RD-11/RD-15 define). It is computed once per
file and reused by the diagnostic renderer and (future) LSP.

### 4.9 Lexer public API

```typescript
// @blend65/frontend

export interface LexResult {
  readonly tokens: readonly Token[];
  readonly lineMap: LineMap;
}

/**
 * Tokenize a single source file.
 *
 * @param sourceId  Interned identifier for the source file (AR-72).
 * @param text      The UTF-8 source text (already read by CompilerHost).
 * @param bag       Accumulating diagnostic bag (AR-73); lexer errors are appended here.
 * @returns         The complete token stream (always ends with EOF) plus the line map.
 */
export function lex(sourceId: SourceId, text: string, bag: DiagnosticBag): LexResult;
```

**Usage pattern (called by the parser, RD-03):**

```typescript
const text = host.readFile(sourceId);
const { tokens, lineMap } = lex(sourceId, text, bag);
// tokens is always non-empty (at minimum [EOF])
// bag may contain lexer diagnostics — caller continues regardless
```

### 4.10 BOM handling (Ch 01 §2.1)

If the source text starts with the UTF-8 BOM (`\xEF\xBB\xBF` / U+FEFF), the lexer
sets `pos = 3` before entering the main loop. The BOM bytes are not included in any
token span. No diagnostic is emitted for a BOM.

## 5. Interactions With Other RDs

| RD | Relationship |
|----|--------------|
| RD-01 | Lexer lives in `@blend65/frontend`, which RD-01 scaffolds |
| RD-03 | Parser consumes the `Token[]` stream this lexer produces; parser handles contextual keywords |
| RD-04 | Semantic analyzer resolves escape sequences to platform-encoding bytes; enforces reserved built-in identifiers (E10212); validates numeric-range-vs-type |
| RD-10 | Platform profile defines character-encoding tables needed for escape-sequence byte resolution (deferred to RD-04, not the lexer) |
| RD-11 | Lexer appends to `DiagnosticBag` and uses `SourceId`/span types from `@blend65/core`; `LineMap` feeds the diagnostic renderer |
| RD-12 | Lexer is testable at all three tiers: unit tests (token output), golden tests (full-file snapshots), emulator tests (indirect — correct tokens → correct code → correct binary) |
| RD-15 | The `lex()` function is part of the library-first API (AR-77); callable programmatically, not only via CLI |
| RD-16 | `blend65.json` may (future) add lexer-level config (e.g., max-errors); currently no lexer-specific config keys |

## 6. Acceptance Criteria

- [ ] `lex()` function exists in `@blend65/frontend`, exported as part of the public API
- [ ] Produces the complete set of 76+ token types defined in Ch 01 §12
- [ ] All 32 keywords correctly distinguished from identifiers via keyword-table lookup
- [ ] Contextual keywords (`until`, `to`, `downto`, `step`) produce `IDENTIFIER` tokens — never keyword tokens
- [ ] Decimal, hex (`$` and `0x`/`0X`), and binary (`0b`/`0B`) literals tokenized correctly with underscore separators validated per Ch 01 §6.4
- [ ] Numeric values parsed and capped at 65535 (E10216 on overflow)
- [ ] Leading-zero decimal literals emit W10210 warning
- [ ] String and character literals tokenized with escape-sequence validation; raw text stored in token value
- [ ] All 8 escape sequences validated (`\\`, `\"`, `\'`, `\n`, `\r`, `\t`, `\0`, `\xNN`); unknown escapes → E10219; incomplete `\x` → E10220
- [ ] Line comments (`//`) and block comments (`/* … */`) correctly skipped; unterminated block → E10211
- [ ] Maximal-munch operator scanning: `<<=` is one token, `&&` is one token, `//` is a comment (not two `SLASH`)
- [ ] Every token carries correct span (`source`, `start`, `end` byte offsets per AR-72)
- [ ] `LineMap` built during lexing; `getLineAndColumn()` returns correct 1-based line/column for any byte offset
- [ ] **Error tolerance**: lexer never throws; invalid input appends diagnostic(s) to `DiagnosticBag` and produces a complete token stream ending in `EOF` (AR-15, AR-73)
- [ ] All 15 error codes (E10210–E10224) and 1 warning code (W10210) emitted for their respective conditions with correct messages per Ch 01 §14
- [ ] **Determinism**: same input → identical token stream + identical diagnostics, every run (AR-74 / H5)
- [ ] Unit tests cover: every token type, every keyword, every operator, every error code, every recovery path, underscore rules, BOM handling, contextual keywords as identifiers, empty input (just `EOF`), comment-only input
- [ ] Golden-snapshot tests cover: representative `.blend` source files tokenized to canonical token-list format (supports `--emit-tokens` debug output, AR-51 lesson)
- [ ] All decisions trace to an `AR-NN` or a frozen spec section

## 7. Open Questions

> Discovery is **closed** (Zero-Ambiguity Gate PASSED). This section must normally be
> **empty**. If authoring surfaces a *new* ambiguity, STOP, add it to
> `00-ambiguity-register.md` as the next `AR-NN` (tagged `(runtime)`), resolve it with the
> user, then resume — per the Surface-During-Authoring rule. Do not fill gaps by guessing.

[None.]
