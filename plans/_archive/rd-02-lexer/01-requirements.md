# RD-02 Lexer — Requirements

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source of truth**: [RD-02](../../requirements/RD-02-lexer.md) (R1–R34, AC list) ·
> [spec Ch 01](../../spec/01-lexical-structure.md) (frozen) · reconciled by
> [AR-L1..L6](00-ambiguity-register.md).

This document restates RD-02's requirements as a checklist of **functional requirements
(FR-*)** the implementation must satisfy, plus the **acceptance criteria (AC-*)** the
acceptance phase walks. Every FR traces to an RD-02 `R#`, a frozen Ch 01 section, or an
`AR-L#`. No requirement is invented here.

## 1. Scope

**In scope** (this plan builds it):

- The `lex(sourceId, text, bag): LexResult` function in `@blend65/frontend`.
- The `TokenKind` / `Token` vocabulary in `@blend65/core` (AR-L4, AR-L6, AR-L3).
- 77 token kinds (4 literal + 1 identifier + 32 keyword + 29 operator + 10 punctuation +
  1 EOF) — Ch 01 §12 / RD-02 §4.1.
- 32-keyword table + identifier-vs-keyword disambiguation (Ch 01 §5.1).
- Contextual keywords (`until`, `to`, `downto`, `step`) → `IDENTIFIER` (Ch 01 §5.1.1).
- All numeric formats: decimal, `$`hex, `0x`/`0X`hex, `0b`/`0B`binary, underscores.
- String + character literals with escape **validation** (not byte resolution).
- Line (`//`) and block (`/* */`, non-nesting) comments.
- Whitespace skipping; `LineMap` construction (AR-L1/L2).
- Maximal-munch operator/punctuation tokenization (Ch 01 §11.1–§11.3).
- Byte-offset spans on every token (AR-L3).
- Error-tolerant recovery; codes E10210–E10224 + W10210 (AR-L5).

**Out of scope** (owned elsewhere — must NOT be implemented here):

| Item | Owner |
|------|-------|
| Reserved-built-in enforcement (E10212) | RD-04 semantic analysis |
| Escape → platform-encoding byte resolution | RD-04 + RD-10 |
| Type-specific numeric range (e.g. `300` in `byte`) | RD-04 |
| Parser, AST, recursive-descent, Pratt | RD-03 |
| `DiagnosticBag`, `SourceSpan`, `LineMap` implementation | RD-11a (consumed here) |
| `CompilerHost.readFile`, file discovery, `blend65.json` | RD-14/RD-15/RD-16 |

## 2. Functional Requirements

### Token model (core vocabulary)

- [x] **FR-1** — `TokenKind` is a string-valued `const … as const` map with a derived
  `TokenKindValue` union, exported from `@blend65/core`. *(AR-L6; RD-02 §4.1)*
- [x] **FR-2** — `TokenKind` contains exactly the 77 kinds of Ch 01 §12: 4 literals
  (`Number`, `String`, `Char`), 1 `Identifier`, 32 keywords, 29 operators, 10 punctuation,
  `Eof`. *(Ch 01 §12; RD-02 §4.1 note)*
- [x] **FR-3** — `Token` is `{ readonly kind: TokenKindValue; readonly span: SourceSpan;
  readonly value?: number | string }`, exported from `@blend65/core`. *(AR-L3; RD-02 §4.2)*
- [x] **FR-4** — `Token.value` is set for `Number` (parsed 0–65535), `String`/`Char` (raw
  escape-unprocessed text between delimiters); `undefined` for identifiers/keywords/
  operators/punctuation (lexeme recoverable from source via the span). *(RD-02 §4.2, §4.7)*

### Keyword & identifier handling (frontend)

- [x] **FR-5** — `KEYWORD_MAP` maps the 32 keyword lexemes to their `TokenKind`; lives in
  `@blend65/frontend`. *(AR-L4; RD-02 §4.3; Ch 01 §5.1)*
- [x] **FR-6** — An identifier-shaped run (`[A-Za-z_][A-Za-z0-9_]*`) is looked up in
  `KEYWORD_MAP`: hit → keyword token, miss → `Identifier`. *(Ch 01 §4.1, §5.1; RD-02 R8/R9)*
- [x] **FR-7** — `until`, `to`, `downto`, `step` are **not** in `KEYWORD_MAP`; they always
  produce `Identifier`. *(Ch 01 §5.1.1; RD-02 R10)*
- [x] **FR-8** — `true`/`false` → `KwTrue`/`KwFalse`; `type` → `KwType` (parser later emits
  E10224 — the lexer just tokenizes it). *(Ch 01 §5.1, §5.2; RD-02 R11/R12)*
- [x] **FR-9** — Fully case-sensitive: `break`→keyword, `Break`→identifier. *(Ch 01 §2.2; RD-02 R2)*
- [x] **FR-10** — Reserved built-in identifiers (`peek`, `main`, …) are produced as plain
  `Identifier` — the lexer does **not** special-case them. *(Ch 01 §5.3; RD-02 R13)*

### Numeric literals

- [x] **FR-11** — Decimal `digit { ["_"] digit }`; leading zeros allowed but emit
  **W10210**. *(Ch 01 §6.1; RD-02 R14)*
- [x] **FR-12** — `$`hex requires ≥1 hex digit; bare `$` → **E10214**, recovery value `0`.
  *(Ch 01 §6.2; RD-02 R15)*
- [x] **FR-13** — `0x`/`0X`hex requires ≥1 hex digit; bare `0x` → **E10214**, recovery `0`.
  *(Ch 01 §6.2; RD-02 R16)*
- [x] **FR-14** — `0b`/`0B`binary requires ≥1 bin digit; bare `0b` → **E10215**, recovery `0`.
  *(Ch 01 §6.3; RD-02 R17)*
- [x] **FR-15** — Underscores only **between** digits; leading/trailing/consecutive →
  **E10213**. Underscores stripped before parsing. *(Ch 01 §6.4; RD-02 R18)*
- [x] **FR-16** — Parsed value capped at 65535; overflow → **E10216**, recovery value
  `65535` (saturated). *(Ch 01 §6.5; RD-02 R19)*

### String & character literals

- [x] **FR-17** — `"…"`: single-line; literal newline → **E10217**; unterminated →
  **E10218**; `""` valid. `value` = raw text between quotes. *(Ch 01 §7.1; RD-02 R20)*
- [x] **FR-18** — `'…'`: exactly one char/escape; empty → **E10221**; multi → **E10222**;
  unterminated → **E10223**. *(Ch 01 §8; RD-02 R21)*
- [x] **FR-19** — Escape set is closed: `\\ \" \' \n \r \t \0 \xNN`. Unknown → **E10219**;
  incomplete `\x` (<2 hex) → **E10220**. Escapes are **validated** for well-formedness but
  **not** resolved to bytes (RD-04 owns resolution). *(Ch 01 §7.2; RD-02 R22, §4.7)*

### Comments & whitespace

- [x] **FR-20** — `//` line comment to EOL, fully discarded. *(Ch 01 §3.3; RD-02 R6)*
- [x] **FR-21** — `/* */` block comment, non-nesting; unterminated → **E10211**. *(Ch 01 §3.4; RD-02 R7)*
- [x] **FR-22** — Space/tab/CR/LF are whitespace, skipped, never significant; lines
  increment on LF, CRLF, bare CR. *(Ch 01 §3.1; RD-02 R3/R4)*
- [x] **FR-23** — Comment detection (`//`, `/*`) precedes operator scanning; lone `/` →
  `Slash`. *(Ch 01 §11.3; RD-02 R27)*

### Operators, punctuation, disambiguation

- [x] **FR-24** — Maximal munch: `<<=` is one token, `&&` is one token, etc. *(Ch 01 §11.1; RD-02 R23)*
- [x] **FR-25** — `&` always `Ampersand`; `:` always `Colon`; `?` → `Question` (parser
  disambiguates meaning). *(Ch 01 §9.6/§9.7; RD-02 R24/R25/R26)*
- [x] **FR-26** — Disambiguation order is exactly Ch 01 §11.2: string → char → `$`hex →
  `0x`hex → `0b`bin → decimal → identifier/keyword → operator → punctuation → E10210.
  *(Ch 01 §11.2; RD-02 R28)*

### Spans, line map, source input

- [x] **FR-27** — Every token carries a correct `SourceSpan { sourceId, start, end }`
  (half-open byte offsets). *(AR-L3; RD-02 R29)*
- [x] **FR-28** — `LineMap` is built once via `new LineMap(sourceId, text)` and returned in
  `LexResult`; line/col computed on demand. *(AR-L1/L2; RD-02 §4.8)*
- [x] **FR-29** — Leading UTF-8 BOM (`EF BB BF`) is skipped before tokenizing; not part of
  any token span; no diagnostic. *(Ch 01 §2.1; RD-02 R1/§4.10)*
- [x] **FR-30** — Non-ASCII outside strings/comments → **E10210**. *(Ch 01 §2.1; RD-02 R1)*
- [x] **FR-31** — `lex()` receives `text` as a parameter; never reads disk directly.
  *(RD-02 R32; AR-40)*

### Error tolerance & determinism

- [x] **FR-32** — `lex()` never throws; all errors append to the `DiagnosticBag`. *(RD-02 R30; AR-15/AR-73)*
- [x] **FR-33** — The token stream is always non-empty and ends with exactly one `Eof`
  token at `{ start: pos, end: pos }`. *(RD-02 R30; Ch 01 §12)*
- [x] **FR-34** — After any error the lexer advances `pos` by ≥1 byte (no infinite loop);
  every recovery path produces a well-defined token or skips exactly the bad byte. *(RD-02 R31; §4.5)*
- [x] **FR-35** — Unterminated block comment (E10211) swallows the rest of the file — no
  further tokens/diagnostics after it (cascade suppression). *(RD-02 §4.5; AR-74)*
- [x] **FR-36** — Deterministic: identical input → identical token stream **and** identical
  diagnostic set/order, every run. *(RD-02 R33; H5)*

### Packaging & export

- [x] **FR-37** — Lexer diagnostic codes (E10210–E10224 except E10212; W10210) are added to
  `@blend65/core` `diagnostic-codes.ts` as named `DiagCode` members. *(AR-L5)*
- [x] **FR-38** — `lex`, `LexResult` are exported from `@blend65/frontend`'s public entry;
  `TokenKind`, `TokenKindValue`, `Token` from `@blend65/core`. *(RD-02 §4.9, R34; AR-L4)*
- [x] **FR-39** — R15/AR-20 boundary preserved: `frontend` imports `@blend65/core` only;
  no new edge to `@blend65/codegen`. *(project.md R15; RD-02 R34)*

## 3. Acceptance Criteria

Walked during the acceptance phase (mirrors RD-02 §6). Each maps to ST-* in
[07-testing-strategy](07-testing-strategy.md).

- [x] **AC-1** — `lex()` exists in `@blend65/frontend`, exported in the public API.
- [x] **AC-2** — Produces the complete set of 77 token kinds (Ch 01 §12).
- [x] **AC-3** — All 32 keywords distinguished from identifiers via `KEYWORD_MAP`.
- [x] **AC-4** — `until`/`to`/`downto`/`step` always produce `Identifier`.
- [x] **AC-5** — Decimal, `$`hex, `0x`/`0X`hex, `0b`/`0B`binary tokenized with underscore
  rules (E10213) validated.
- [x] **AC-6** — Numeric values parsed and capped at 65535 (E10216 on overflow); leading
  zeros emit W10210.
- [x] **AC-7** — Strings and chars tokenized with escape validation; raw text in `value`;
  all 8 escapes validated (E10219 unknown, E10220 incomplete `\x`).
- [x] **AC-8** — Line/block comments skipped; unterminated block → E10211.
- [x] **AC-9** — Maximal munch: `<<=`, `&&` single tokens; `//` is a comment, not two
  `Slash`.
- [x] **AC-10** — Every token carries a correct `{ sourceId, start, end }` span; `LineMap`
  `getLineCol()` returns correct 1-based line/column.
- [x] **AC-11** — Error tolerance: never throws; invalid input appends diagnostic(s) and
  yields a complete stream ending in `Eof`.
- [x] **AC-12** — All 14 error codes (E10210, E10211, E10213–E10224) and W10210 emitted for
  their conditions, with messages matching Ch 01 §14.
- [x] **AC-13** — Determinism: identical input → identical tokens + diagnostics every run.
- [x] **AC-14** — Unit tests cover every token kind, keyword, operator, error code, recovery
  path, underscore rules, BOM, contextual-keyword-as-identifier, empty input (`[Eof]`),
  comment-only input.
- [x] **AC-15** — Golden-snapshot tests cover representative `.blend` files tokenized to a
  canonical token-list format (foundation for `--emit-tokens`).
- [x] **AC-16** — Every decision traces to an `AR-L#`, an RD-02 `R#`, or a frozen Ch 01
  section.

## 4. Traceability note

`E10212` appears in Ch 01 §14 but is explicitly enforced by the semantic analyzer
(RD-04), not the lexer — see the Ch 01 §14 note and RD-02 §2. It is therefore **excluded**
from this plan's FR/AC set and is **not** added to the core registry by RD-02 (AR-L5).
