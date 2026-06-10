# RD-02 Lexer — Algorithm & Public API

> **Document**: 03-02-lexer-algorithm.md
> **Parent**: [Index](00-index.md)
> **Covers**: FR-6, FR-11..FR-31 · AR-L1, AR-L2 · spec Ch 01 §3, §6, §7, §8, §9, §10, §11
> **Error/recovery detail**: see [03-03](03-03-error-recovery.md)

This document specifies the scanning algorithm in `@blend65/frontend`, the per-construct
scanners, and the public `lex()` API. Diagnostic-emission detail (codes, recovery actions,
cascade suppression, determinism) lives in [03-03](03-03-error-recovery.md); this document
references codes by name and focuses on control flow.

## 1. Public API (FR-31, FR-33, FR-38)

`packages/frontend/src/lexer/lexer.ts`:

```typescript
import {
  type SourceId,
  type Token,
  type DiagnosticBag,
  LineMap,
} from "@blend65/core";

/** The result of tokenizing one source file. */
export interface LexResult {
  /** The complete token stream — always non-empty, always ends with one `Eof`. */
  readonly tokens: readonly Token[];
  /** Line-start map for the source, built once (AR-L1/L2). */
  readonly lineMap: LineMap;
}

/**
 * Tokenize a single source file (spec Ch 01).
 *
 * Never throws (FR-32): malformed input appends diagnostics to `bag` and yields
 * recovery tokens, so the returned stream is always complete and ends in `Eof`.
 *
 * @param sourceId  Interned source identifier (read by the CompilerHost, AR-40).
 * @param text      The full UTF-8 source text.
 * @param bag       Accumulating diagnostic bag; lexer diagnostics are appended here.
 * @returns         The token stream plus the source's `LineMap`.
 */
export function lex(sourceId: SourceId, text: string, bag: DiagnosticBag): LexResult;
```

**Usage (called by the parser, RD-03):**

```typescript
const text = host.readFile(sourceId);
const { tokens, lineMap } = lex(sourceId, text, bag);
// tokens is always non-empty (at minimum [Eof]); bag may hold lexer diagnostics.
```

## 2. Scanner state

A single mutable cursor over `text`:

| State | Meaning |
|-------|---------|
| `pos: number` | Current byte offset (UTF-16 code-unit index into the JS string; ASCII syntax means 1 unit = 1 byte for all token-significant chars). |
| `tokens: Token[]` | Accumulated output. |

The `LineMap` is **not** maintained incrementally (AR-L2); it is constructed once with
`new LineMap(sourceId, text)` and placed in `LexResult`. Helpers:

- `peek(k = 0): string | undefined` → `text[pos + k]`.
- `makeToken(kind, start, value?)` → `{ kind, span: makeSpan(sourceId, start, pos), value }`.
- character-class predicates: `isDigit`, `isHexDigit`, `isBinDigit`, `isIdentStart`
  (`[A-Za-z_]`), `isIdentContinue` (`[A-Za-z0-9_]`), `isWhitespace` (space/tab/CR/LF).

> **Byte vs. UTF-16 note:** all token-significant characters are ASCII (Ch 01 §1), so
> `pos` advances one code unit per byte for them. A non-ASCII byte outside strings/comments
> is the only place a multi-unit char can appear in code, and it is rejected immediately
> (E10210, see 03-03) — so spans remain valid byte offsets for every emitted token.

## 3. Main loop & disambiguation order (FR-26, spec §11.2)

```
function lex(sourceId, text, bag):
  pos ← 0
  tokens ← []
  if text starts with BOM (U+FEFF) → pos ← 1          // FR-29 (one JS code unit)

  while pos < text.length:
    skipWhitespace()                                   // space/tab/CR/LF; FR-22
    if pos ≥ text.length → break

    start ← pos
    ch ← text[pos]

    // 1. Comments BEFORE operator scanning (FR-23, §11.3)
    if ch == '/' and peek(1) == '/' → skipLineComment(); continue
    if ch == '/' and peek(1) == '*' → skipBlockComment(bag); continue

    // 2. String / 3. Char literals
    if ch == '"'  → tokens.push(scanString(bag));  continue
    if ch == '\'' → tokens.push(scanChar(bag));    continue

    // 4. $ hex
    if ch == '$' → tokens.push(scanHexDollar(bag)); continue

    // 5–6. 0x hex / 0b binary / decimal
    if isDigit(ch):
      if ch == '0' and (peek(1) == 'x' or peek(1) == 'X') → tokens.push(scanHex0x(bag));  continue
      if ch == '0' and (peek(1) == 'b' or peek(1) == 'B') → tokens.push(scanBinary(bag)); continue
      tokens.push(scanDecimal(bag)); continue

    // 7. Identifier / keyword
    if isIdentStart(ch) → tokens.push(scanIdentifier()); continue

    // 8–9. Operators (maximal munch) and punctuation
    op ← scanOperatorOrPunctuation()                   // returns a Token or null
    if op != null → tokens.push(op); continue

    // 10. Unknown character → E10210, skip one unit (FR-30, FR-34)
    emitUnexpectedChar(bag, start)                     // see 03-03
    pos ← pos + 1

  tokens.push(makeToken(Eof, pos))                     // FR-33
  return { tokens, lineMap: new LineMap(sourceId, text) }
```

The ordering is **exactly** spec §11.2; ST-L* tests assert each disambiguation case from
§11.3 (e.g. `0bytes`, `&&`, `<<=`, `/` + `/`).

## 4. Whitespace & comments (FR-20..FR-23)

```
skipWhitespace():
  while pos < len and isWhitespace(text[pos]): pos++       // no token emitted

skipLineComment():               // pos at first '/', peek(1) == '/'
  pos += 2
  while pos < len and text[pos] != '\n' and text[pos] != '\r': pos++
  // the newline itself is left for skipWhitespace; fully discarded (FR-20)

skipBlockComment(bag):           // pos at '/', peek(1) == '*'
  start ← pos
  pos += 2
  while pos < len:
    if text[pos] == '*' and peek(1) == '/': pos += 2; return   // closed; non-nesting (FR-21)
    pos++
  // reached EOF without closing → E10211 at [start,len]; pos := len (cascade, 03-03 / FR-35)
  emitUnterminatedBlockComment(bag, start)
```

Block comments do **not** nest (§3.4): the first `*/` closes. Unterminated swallows the
rest of the file (FR-35).

## 5. Identifiers & keywords (FR-6)

```
scanIdentifier():                // pos at isIdentStart
  start ← pos
  while pos < len and isIdentContinue(text[pos]): pos++
  lexeme ← text.slice(start, pos)
  kind ← KEYWORD_MAP.get(lexeme) ?? Identifier         // FR-6, FR-7, FR-9
  return makeToken(kind, start)                         // value undefined
```

`until`/`to`/`downto`/`step` miss the map → `Identifier` (FR-7). `type` hits → `KwType`
(FR-8); no diagnostic here.

## 6. Numeric literals (FR-11..FR-16)

All four scanners share an **underscore-validating digit run** helper and produce a
`Number` token whose `value` is the parsed integer (0–65535). Underscore-rule violations
emit E10213; bare prefixes emit E10214/E10215; overflow emits E10216 (recovery values in
03-03).

```
scanDecimal(bag):                // pos at digit
  start ← pos
  digits ← scanDigitRun(bag, isDigit)                  // consumes digits + valid '_'; flags E10213
  raw ← digits without underscores
  value ← min(parseInt(raw, 10), 65535)
  if parseInt(raw,10) > 65535 → emitOverflow(bag, start); value ← 65535      // FR-16
  if raw.length > 1 and raw[0] == '0' → emitLeadingZeros(bag, start)         // FR-11 → W10210
  return makeToken(Number, start, value)

scanHexDollar(bag):              // pos at '$'
  start ← pos; pos++                                    // consume '$'
  if pos ≥ len or not isHexDigit(text[pos]):
    emitBadHex(bag, start, "$"); return makeToken(Number, start, 0)          // FR-12 → E10214
  digits ← scanDigitRun(bag, isHexDigit)
  value ← min(parseInt(strip_(digits), 16), 65535)
  if … > 65535 → emitOverflow(bag, start); value ← 65535
  return makeToken(Number, start, value)

scanHex0x(bag):                  // pos at '0', peek(1) in x/X — consume 2, else E10214
scanBinary(bag):                 // pos at '0', peek(1) in b/B — consume 2, base 2, else E10215
```

`scanDigitRun(bag, isClass)` consumes a maximal run of `isClass` digits and `_`, emitting
**E10213** once per violation (leading `_` right after prefix, trailing `_`, or consecutive
`__`), and never consuming a stray non-digit. Underscores are stripped before `parseInt`.

> **Hex/binary prefix already validated:** `scanHex0x`/`scanBinary` are only entered when
> `peek(1)` is `x/X` or `b/B`; if no valid digit follows the 2-char prefix, the bare-prefix
> code fires (E10214/E10215) with recovery value `0` and `pos` past the prefix.

## 7. String literals (FR-17, FR-19)

```
scanString(bag):                 // pos at '"'
  start ← pos; pos++             // consume opening quote
  while pos < len:
    ch ← text[pos]
    if ch == '"' → pos++; return makeToken(String, start, rawText(start, pos))   // closed
    if ch == '\n' or ch == '\r' → emitNewlineInString(bag, start); return makeToken(String, start, rawText…)  // FR-17 → E10217, end at newline
    if ch == '\\' → validateEscape(bag); continue       // FR-19, see 03-03
    pos++
  // EOF before closing quote → E10218 (FR-17), end at EOF
  emitUnterminatedString(bag, start); return makeToken(String, start, rawText…)
```

`rawText` is the text **between** the delimiters (escapes unresolved) — stored in
`Token.value` (FR-4). The empty string `""` is valid → `value = ""`.

## 8. Character literals (FR-18, FR-19)

```
scanChar(bag):                   // pos at '\''
  start ← pos; pos++             // consume opening quote
  contentStart ← pos
  if pos < len and text[pos] == '\'' → pos++; emitEmptyChar(bag, start); return makeToken(Char, start, "" )  // FR-18 → E10221
  scan exactly one char or one escape (validateEscape for '\\'); track count
  if next is not '\'' and more content before quote → consume to closing quote; emitMultiChar(bag, start)     // FR-18 → E10222 (value = first char/escape)
  if pos ≥ len or newline before '\'' → emitUnterminatedChar(bag, start)                                       // FR-18 → E10223
  else pos++                     // consume closing quote
  return makeToken(Char, start, rawText(contentStart, closeQuotePos))
```

`value` is the raw single char or escape (unresolved). Escape validation (E10219/E10220)
is shared with strings (03-03).

## 9. Operators & punctuation — maximal munch (FR-24, FR-25)

A longest-match scan tries 3-char, then 2-char, then 1-char operators, then punctuation:

```
scanOperatorOrPunctuation():     // returns Token or null
  three ← text.slice(pos, pos+3)
  if three in { "<<=", ">>=" } → emit(len 3)
  two ← text.slice(pos, pos+2)
  if two in { "<<",">>","&&","||","==","!=","<=",">=",
              "+=","-=","*=","/=","%=","&=","|=","^=" } → emit(len 2)
  one ← text[pos]
  if one in { "+","-","*","/","%","&","|","^","~","<",">","=","!","?" } → emit operator(len 1)
  if one in { "(",")","[","]","{","}",",",";",":","." } → emit punctuation(len 1)
  return null                    // not an operator/punctuation → caller does E10210
```

Note `/` reaches this scan **only** when not followed by `/` or `*` (FR-23), so a lone `/`
yields `Slash`. `&` always yields `Ampersand`; `:` always `Colon`; `?` always `Question`
(FR-25). The 3→2→1 order guarantees maximal munch (`<<=` not `<<`+`=`; `&&` not `&`+`&`).

## 10. BOM handling (FR-29, §4.10)

If `text[0] === "\uFEFF"`, set `pos = 1` before the loop. The BOM is excluded from every
token span; no diagnostic is emitted.

## 11. Determinism (FR-36)

The loop is a pure function of `(sourceId, text)`: a single forward cursor, fixed
disambiguation order, and append-only diagnostics. No clocks, randomness, hashing of
addresses, or map-iteration-order dependence (`KEYWORD_MAP` is keyed by lexeme). Identical
input therefore yields identical `tokens` and identical bag contents/order every run.

## 12. Feature interactions (L8)

| Combined with | Behavior |
|---------------|----------|
| `DiagnosticBag` (RD-11a) | every scanner appends via `bag.addError/addWarning`; bag dedup/cap/order are the bag's concern, not the lexer's |
| `LineMap` (RD-11a) | built once post-scan; consumers map `token.span.start` → line/col |
| Parser (RD-03) | consumes `tokens`; resolves contextual keywords + `&`/`:`/`?` meaning positionally; emits E10224 for `KwType` |
| Semantic (RD-04) | resolves string/char `value` escapes to encoding bytes; enforces reserved built-ins (E10212) and numeric-vs-type range |
| Empty / comment-only input | yields `[Eof]` only; no diagnostics (ST-L tests) |
