# RD-02 Lexer — Testing Strategy

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)
> **Covers**: AC-1..AC-16 · FR-1..FR-39
> **Method**: spec-tests-first (write failing tests before implementation), per testing.md.

This document enumerates the test cases (`ST-L#`) for the lexer, the tier each belongs to,
and the AC/FR each pins. Tests live beside their code:

- **core vocabulary** → `packages/core/src/tokens/*.impl.test.ts`
- **core registry** → extend `packages/core/src/diagnostics/diagnostic-codes.impl.test.ts`
- **lexer logic** → `packages/frontend/src/lexer/*.impl.test.ts`
- **behavioral spec + golden** → `packages/frontend/src/lexer/lexer.spec.test.ts`

## 1. Test tiers

| Tier | File pattern | What it checks |
|------|--------------|----------------|
| Vocabulary (impl) | `core/src/tokens/token-kind.impl.test.ts` | `TokenKind` member set & string values |
| Registry (impl) | `core/src/diagnostics/diagnostic-codes.impl.test.ts` (extended) | new lexer codes map to Ch 14 strings |
| Lexer unit (impl) | `frontend/src/lexer/lexer.impl.test.ts` | per-construct tokenization & recovery |
| Lexer spec (spec) | `frontend/src/lexer/lexer.spec.test.ts` | end-to-end behavior, AC walk, golden snapshots |
| Boundary (root) | `test/boundary.spec.test.ts` (existing) | R15: frontend ↛ codegen unchanged |

## 2. Vocabulary & registry tests (Phase 1)

| ST | Asserts | AC/FR |
|----|---------|-------|
| **ST-L1** | `Object.keys(TokenKind)` has exactly 77 members; each value equals its key; spot-check `Number`, `KwModule`, `ShiftLeftEqual`, `Question`, `Colon`, `Eof`. | AC-2, FR-1, FR-2 |
| **ST-L2** | New `DiagCode` members map to exact strings (E10210, E10211, E10213–E10224, W10210); **E10212 absent** from anything RD-02 adds; existing RD-11a codes unchanged. | AC-12, FR-37 |

## 3. Lexer unit tests (impl)

### 3.1 Tokens, keywords, identifiers

| ST | Source → expectation | AC/FR |
|----|----------------------|-------|
| **ST-L3** | Empty `""` → `[Eof]`; no diagnostics. | AC-11, FR-33 |
| **ST-L4** | Whitespace-only & comment-only inputs → `[Eof]`; no diagnostics. | AC-8, FR-20..22 |
| **ST-L5** | Each of the 32 keywords lexes to its `Kw*` kind. | AC-3, FR-6 |
| **ST-L6** | `Break`, `BYTE`, `iff` → `Identifier` (case-sensitive miss). | AC-3, FR-9 |
| **ST-L7** | `until to downto step` → four `Identifier` tokens. | AC-4, FR-7 |
| **ST-L8** | `true`/`false` → `KwTrue`/`KwFalse`; `type` → `KwType` (no diagnostic). | FR-8 |
| **ST-L9** | Reserved built-ins `peek main encode` → `Identifier` (no special-casing). | FR-10 |
| **ST-L10** | Identifier span/lexeme: `playerScore` → one `Identifier`, `text.slice(span)` round-trips. | AC-10, FR-27 |

### 3.2 Numeric literals

| ST | Source → expectation | AC/FR |
|----|----------------------|-------|
| **ST-L11** | `0`, `1000`, `65535` → `Number` with `value` 0/1000/65535. | AC-5, FR-11 |
| **ST-L12** | `$0400`, `$FF`, `0x0400`, `0XfF` → correct values; prefix not in value. | AC-5, FR-12/13 |
| **ST-L13** | `0b1010`, `0B1111_0000` → 10, 240. | AC-5, FR-14 |
| **ST-L14** | `1_000`, `$FF_FF`, `0b1111_0000` → underscores stripped (1000, 65535, 240). | AC-5, FR-15 |
| **ST-L15** | `$_FF`, `$FF_`, `$F__F` → **E10213**; recovery `Number` produced. | AC-5, FR-15 |
| **ST-L16** | `$`, `0x`, `$G` → **E10214**, value `0`; `0b`, `0b2` → **E10215**, value `0`. | AC-5, FR-12/13/14 |
| **ST-L17** | `65536`, `$1FFFF`, `99999` → **E10216**, value `65535` (saturated). | AC-6, FR-16 |
| **ST-L18** | `007`, `0042` → **W10210**; value 7/42; token still `Number`. | AC-6, FR-11 |
| **ST-L19** | `0bytes` → `0b` binary attempt, `y` not bin digit → **E10215** (spec §11.3 row). | AC-5, FR-14 |

### 3.3 Strings, chars, escapes

| ST | Source → expectation | AC/FR |
|----|----------------------|-------|
| **ST-L20** | `"HELLO"`, `""` → `String`, `value` `"HELLO"`/`""`. | AC-7, FR-17 |
| **ST-L21** | `"a\nb"`, `"\x41"`, `"\\"`, `"\""` → `String`; raw (unresolved) text in `value`; no diagnostics. | AC-7, FR-19 |
| **ST-L22** | `"abc⏎` (newline) → **E10217**; `"abc`<EOF> → **E10218**; recovery `String`. | AC-7, FR-17 |
| **ST-L23** | `"a\qb"` → **E10219**; `"a\x4"` → **E10220**; literal continues, `String` produced. | AC-7, FR-19 |
| **ST-L24** | `'A'`, `'\n'`, `'\x41'` → `Char`, raw `value`. | AC-7, FR-18 |
| **ST-L25** | `''` → **E10221** (value `""`); `'AB'` → **E10222** (value first char); `'A`<EOF> → **E10223**. | AC-7, FR-18 |

### 3.4 Comments, operators, punctuation, disambiguation

| ST | Source → expectation | AC/FR |
|----|----------------------|-------|
| **ST-L26** | `// c\nx` → only `Identifier x` + `Eof`; line comment discarded. | AC-8, FR-20 |
| **ST-L27** | `/* a */ x`, multi-line block → discarded; `/* unterminated` → **E10211**, then only `Eof` (cascade). | AC-8, FR-21, FR-35 |
| **ST-L28** | Every operator lexeme → its kind (all 29). | AC-9, FR-24 |
| **ST-L29** | Every punctuation lexeme → its kind (all 10). | FR-25 |
| **ST-L30** | Maximal munch: `<<=`→`ShiftLeftEqual`; `>>=`→`ShiftRightEqual`; `&&`→`LogicalAnd`; `==`→`EqualEqual`; `<=`,`>=`,`!=`. | AC-9, FR-24 |
| **ST-L31** | `&x` → `Ampersand`,`Identifier`; `a?b:c` → `Question`/`Colon` present; lone `/` → `Slash`. | AC-9, FR-23, FR-25 |

### 3.5 Spans, BOM, line map, unexpected chars

| ST | Source → expectation | AC/FR |
|----|----------------------|-------|
| **ST-L32** | Multi-token line: each token's `span.start/end` are correct half-open byte offsets; lexeme round-trips. | AC-10, FR-27 |
| **ST-L33** | BOM-prefixed source: first real token span starts at offset 1 (post-BOM); no diagnostic. | FR-29 |
| **ST-L34** | `lineMap.getLineCol(span.start)` returns correct 1-based line/col across LF, CRLF, and bare-CR inputs. | AC-10, FR-28 |
| **ST-L35** | Non-ASCII `é` / control byte outside strings → **E10210**; skipped; following token still lexes. | AC-12, FR-30, FR-34 |

### 3.6 Error tolerance & determinism

| ST | Source → expectation | AC/FR |
|----|----------------------|-------|
| **ST-L36** | A source mixing several errors never throws; stream still ends in exactly one `Eof`; bag holds each expected code. | AC-11, FR-32/33 |
| **ST-L37** | Lexing the same fixture twice → deep-equal `tokens` **and** `bag.getAll()`. | AC-13, FR-36 |
| **ST-L38** | After each recovery path, `pos` advanced (no hang): a fixture of pure error bytes terminates and yields `Eof`. | FR-34 |

## 4. Behavioral spec + golden snapshots (Phase 6)

| ST | Asserts | AC/FR |
|----|---------|-------|
| **ST-L39** | `lex` & `LexResult` exported from `@blend65/frontend`; `TokenKind`/`Token` from `@blend65/core`. | AC-1, FR-38 |
| **ST-L40** | Golden: a representative `.blend` program (e.g. `examples/gate/main.blend`) tokenized to a canonical, readable token-list snapshot (`kind start..end value?`), via Vitest `toMatchSnapshot`. | AC-15 |
| **ST-L41** | Golden: an error-bearing fixture snapshots both the token list and the ordered diagnostic list — pins recovery + ordering together. | AC-13, AC-15 |

> The canonical token-list format (`<Kind> <start>..<end> [value]`) is the foundation for a
> future `--emit-tokens` debug flag (RD-02 §6, AR-51 lesson). String-valued `TokenKind`
> (AR-L6) is what makes these snapshots readable.

## 5. Boundary tier (unchanged)

The existing root `test/boundary.spec.test.ts` (ST-R15a/b/c) must stay green: the lexer adds
no `@blend65/frontend → @blend65/codegen` edge (FR-39). No new boundary test is required;
the phase gates simply confirm the existing tier still passes.

## 6. AC ↔ ST coverage matrix

| AC | Covered by |
|----|-----------|
| AC-1 | ST-L39 |
| AC-2 | ST-L1 |
| AC-3 | ST-L5, ST-L6 |
| AC-4 | ST-L7 |
| AC-5 | ST-L11..L16, L19 |
| AC-6 | ST-L17, ST-L18 |
| AC-7 | ST-L20..L25 |
| AC-8 | ST-L4, ST-L26, ST-L27 |
| AC-9 | ST-L28, ST-L30, ST-L31 |
| AC-10 | ST-L10, ST-L32, ST-L34 |
| AC-11 | ST-L3, ST-L36 |
| AC-12 | ST-L2, ST-L35, (all error STs) |
| AC-13 | ST-L37, ST-L41 |
| AC-14 | ST-L3..L35 (enumerated coverage) |
| AC-15 | ST-L40, ST-L41 |
| AC-16 | every ST cites an AR-L/R#/Ch 01 § (this doc + 03-0x) |

## 7. Verify command

Each phase ends green against:

```bash
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```

`yarn test` runs the per-package Vitest suites (core + frontend) and the root boundary tier.
