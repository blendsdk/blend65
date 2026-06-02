# RD-02 Lexer — Error Recovery & Diagnostic Codes

> **Document**: 03-03-error-recovery.md
> **Parent**: [Index](00-index.md)
> **Covers**: FR-32..FR-37 · AR-L5 · spec Ch 01 §14 · RD-02 §4.5
> **Algorithm context**: see [03-02](03-02-lexer-algorithm.md)

The lexer is **error-tolerant** (FR-32): it never throws, appends structured diagnostics to
the shared `DiagnosticBag`, and always produces a complete token stream ending in `Eof`.
This document specifies the diagnostic codes added to the core registry, the message text,
and the recovery action for each error condition.

## 1. Codes added to the core registry (AR-L5, FR-37)

These are added to `packages/core/src/diagnostics/diagnostic-codes.ts` as named `DiagCode`
members — **addition only**; the existing RD-11a entries are untouched. They are
transcribed verbatim from spec Ch 01 §14 / Ch 14.

```typescript
  // ----- Lexer (RD-02, spec Ch 01 §14) -----
  UnexpectedCharacter: "E10210",
  UnterminatedBlockComment: "E10211",
  // E10212 (redeclare reserved built-in) is owned by RD-04 — NOT added here.
  InvalidNumericUnderscore: "E10213",
  InvalidHexLiteral: "E10214",
  InvalidBinaryLiteral: "E10215",
  NumericLiteralOverflow: "E10216",
  NewlineInString: "E10217",
  UnterminatedString: "E10218",
  UnknownEscapeSequence: "E10219",
  IncompleteHexEscape: "E10220",
  EmptyCharLiteral: "E10221",
  MultiCharLiteral: "E10222",
  UnterminatedCharLiteral: "E10223",
  ReservedKeyword: "E10224",
  // Warning
  NumericLeadingZeros: "W10210",
```

> **Naming:** the constant names follow the existing registry's descriptive-PascalCase
> convention. `ReservedKeyword` (E10224) is added now even though the *parser* emits it
> (the lexer produces `KwType`); centralizing it keeps the one-registry rule intact.
> `E10212` is excluded (RD-04 owns it — AR-L5, FR traceability note).

A registry test (ST-L2) asserts each new name maps to the exact Ch 14 code string.

## 2. Recovery table (RD-02 §4.5)

Every error condition emits its diagnostic **and** performs a defined recovery so the token
stream stays complete. After any error the cursor advances by ≥1 byte (FR-34) — no infinite
loops.

| # | Condition | Code | Span | Recovery action |
|---|-----------|------|------|-----------------|
| 1 | Non-ASCII / illegal byte outside string/comment | **E10210** | `[pos, pos+1]` | Skip the one code unit; continue. No token emitted. |
| 2 | Block comment with no closing `*/` | **E10211** | `[start, len]` | Treat rest of file as comment; `pos := len`; **no further tokens** (cascade). |
| 3 | Bad underscore in numeric literal | **E10213** | `[start, pos]` | Continue the digit run; produce `Number` with value parsed so far. |
| 4 | `$` / `0x` without a hex digit | **E10214** | `[start, pos]` | Produce `Number` value `0`; `pos` left past the prefix. |
| 5 | `0b` without a binary digit | **E10215** | `[start, pos]` | Produce `Number` value `0`; `pos` past the prefix. |
| 6 | Numeric value > 65535 | **E10216** | `[start, pos]` | Produce `Number` value `65535` (saturated). |
| 7 | Literal newline inside string | **E10217** | `[start, pos]` | End the string at the newline; produce `String` with content so far. |
| 8 | String with no closing `"` before EOL/EOF | **E10218** | `[start, pos]` | End at EOL/EOF; produce `String` with content so far. |
| 9 | Unknown escape `\?` | **E10219** | `[escPos, escPos+2]` | Keep the backslash + char literally in raw text; continue scanning the literal. |
| 10 | Incomplete `\x` (<2 hex digits) | **E10220** | `[escPos, pos]` | Keep `\x…` literally in raw text; continue. |
| 11 | Empty char literal `''` | **E10221** | `[start, pos]` | Produce `Char` with `value = ""`. |
| 12 | Multi-char literal `'AB'` | **E10222** | `[start, pos]` | Consume to closing `'`; produce `Char` with the **first** char/escape as `value`. |
| 13 | Char literal with no closing `'` | **E10223** | `[start, pos]` | Produce `Char` with what was scanned. |
| 14 | Reserved keyword `type` used | **E10224** | (token span) | **Parser**, not lexer: lexer emits `KwType`; parser raises E10224. |
| 15 | Decimal literal with leading zeros | **W10210** | `[start, pos]` | Warning only; produce the `Number` token normally. |

**Invariant (FR-34):** after any error path `pos` is strictly greater than its value at the
start of that loop iteration, so the main loop always makes progress.

## 3. Message text (spec Ch 01 §14)

Messages match the frozen Ch 01 §14 table. Placeholders (`<char>`, `<value>`, `<prefix>`,
`<literal>`, `<keyword>`) are filled from the offending lexeme:

| Code | Message template |
|------|------------------|
| E10210 | `Unexpected character '<char>' (U+<codepoint>) — only ASCII characters are valid in Blend65 source code` |
| E10211 | `Unterminated block comment — expected '*/' before end of file` |
| E10213 | `Invalid underscore in numeric literal — underscores must appear between digits only (no leading, trailing, or consecutive underscores)` |
| E10214 | `Invalid hexadecimal literal — expected hex digit (0–9, A–F) after '<prefix>'` |
| E10215 | `Invalid binary literal — expected binary digit (0 or 1) after '0b'` |
| E10216 | `Numeric literal value <value> exceeds maximum (65535) — no Blend65 type can hold values larger than 16 bits` |
| E10217 | `Newline in string literal — strings must be on a single line. Use \n for newline characters` |
| E10218 | `Unterminated string literal — expected closing '"' before end of line` |
| E10219 | `Unknown escape sequence '\<char>' — valid escapes are: \\, \", \', \n, \r, \t, \0, \xNN` |
| E10220 | `Incomplete hex escape '\x<char>' — \x requires exactly two hex digits (e.g., \x41)` |
| E10221 | `Empty character literal — char literals must contain exactly one character or escape sequence` |
| E10222 | `Multi-character literal '<literal>' — char literals must contain exactly one character. Use a string literal for multiple characters` |
| E10223 | `Unterminated character literal — expected closing '` |
| E10224 | `'<keyword>' is reserved for a future Blend65 version and cannot be used yet` |
| W10210 | `Numeric literal has leading zeros: '<literal>' — Blend65 does not have octal literals; this is decimal <value>` |

Messages are produced by the lexer at each call site (`bag.addError(DiagCode.X, span, msg)`),
exactly as RD-11a's design intends — the bag stores the code + message verbatim.

## 4. Escape validation (shared by strings & chars, FR-19)

```
validateEscape(bag):             // pos at '\\'
  escPos ← pos; pos++            // consume backslash
  if pos ≥ len → (string/char terminator logic handles the dangling '\\')
  c ← text[pos]
  switch c:
    '\\','"','\'','n','r','t','0' → pos++          // valid simple escape; keep raw
    'x' →
      pos++
      if next two are hex digits → pos += 2         // valid \xNN; keep raw
      else → emitIncompleteHexEscape(bag, escPos)   // E10220; keep '\x…' raw, continue
    default → emitUnknownEscape(bag, escPos, c)      // E10219; keep '\<c>' raw, continue
```

Escapes are **validated only** — the raw `\…` text stays in `Token.value`; byte resolution
is RD-04's job (needs the platform encoding profile, RD-10). E10219/E10220 do **not**
terminate the literal; scanning continues to the closing delimiter.

## 5. Cascade suppression (FR-35, AR-74)

Lexer errors are largely independent, so cascades are rare. The one case is the
**unterminated block comment** (E10211): once it fires, the rest of the file is the
comment, so `pos := len`, the loop exits, and only the trailing `Eof` is appended. No
"unexpected character" is emitted for the swallowed bytes — emitting one per byte would
violate cascade suppression. This is the single intentional "swallow to EOF" recovery; all
other recoveries resume normal scanning.

## 6. Never-throws guarantee (FR-32, FR-33)

- No scanner throws; all failure modes are table entries above.
- Out-of-range `peek` returns `undefined`, handled as "end of input."
- The function always appends exactly one `Eof` token (FR-33), even for empty input
  (`""` → `[Eof]`, no diagnostics) and comment-only input.
- The bag itself never throws (RD-11a FR-18), so `bag.addError` is always safe.

## 7. Determinism (FR-36)

Recovery actions are deterministic functions of the input position and bytes — no state
outside the cursor influences them. Combined with the bag's deterministic ordering
(RD-11a), identical input yields an identical diagnostic set **and** order every run. ST-L
determinism tests lex the same fixture twice and assert deep-equality of both `tokens` and
`bag.getAll()`.

## 8. Test-visible error matrix (→ [07](07-testing-strategy.md))

Each row above maps to at least one ST-L case: a minimal source triggering the condition,
asserting (a) the emitted code, (b) the recovery token's `kind`/`value`/`span`, and (c) that
the stream still ends in `Eof`. E10224 is tested at the parser layer (RD-03), noted here for
traceability only.
