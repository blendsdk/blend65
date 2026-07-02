# Testing Strategy: RD-03 Parser & AST

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- **Spec tests** (`*.spec.test.ts`): the public contract — `parse()` behaviour, grammar
  coverage, golden AST snapshots, determinism, no-throw fuzz. Written **before** implementation.
- **Impl tests** (`*.impl.test.ts`): internals — cursor, Pratt precedence matrix, each
  diagnostic code, each sentinel/recovery context. Written **after** the slice they cover.
- Every parser diagnostic code and every `NodeKind` (50) is exercised by ≥1 test (AC-08, AC-13).

### Test file placement

| File                                                              | Tier  | Covers                              |
| ----------------------------------------------------------------- | ----- | ----------------------------------- |
| `packages/core/src/ast/node-kind.impl.test.ts`                    | impl  | ST-P1                               |
| `packages/core/src/ast/reserved-builtins.impl.test.ts`            | impl  | ST-P2                               |
| `packages/core/src/ast/walk.impl.test.ts`                         | impl  | ST-P3                               |
| `packages/core/src/diagnostics/diagnostic-codes.impl.test.ts`     | impl  | ST-P2b (extend existing file)       |
| `packages/frontend/src/parser/cursor.impl.test.ts`                | impl  | ST-P4                               |
| `packages/frontend/src/parser/pratt.impl.test.ts`                 | impl  | ST-P10..P13                         |
| `packages/frontend/src/parser/parser.impl.test.ts`                | impl  | ST-P14..P29 (constructs + codes)    |
| `packages/frontend/src/parser/parser.spec.test.ts`                | spec  | ST-P5..P9, ST-P30..P35 (API+golden) |

## 🚨 Specification Test Cases (MANDATORY — derived from spec/RD-03/AR, not from implementation)

### Component 1 — AST core vocabulary (`@blend65/core` `ast/`)

| #      | Input / Scenario                                              | Expected Output / Behavior                                              | Source            |
| ------ | ------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------- |
| ST-P1  | Enumerate the `NodeKind` union members                       | Exactly **50** kinds; includes `Program`/`ExpressionStmt`/`ErrorType`; **excludes** `AsmBlock` | FR-10, AR-1, AC-13 |
| ST-P2  | Inspect `RESERVED_BUILTINS`                                   | Exactly **22** names; contains all 13 `asm_*` + `peek poke peekw pokew lo hi sizeof offsetof length` | AR-3, FR-43 |
| ST-P2b | Read `DiagCode` for parser codes                             | `E10072` + `E10300`..`E10316` present with exact values; `E10001/E10002/E10224` unchanged | AR-6, §4.12 |
| ST-P3  | `walkNode` over a hand-built node of each kind               | Dispatches to the matching `visit*`; `walkChildren` visits every child once | FR-48, §4.11 |

### Component 2 — Parser public contract (`@blend65/frontend` `parser/`)

| #      | Input / Scenario                                              | Expected Output / Behavior                                              | Source            |
| ------ | ------------------------------------------------------------ | ---------------------------------------------------------------------- | ----------------- |
| ST-P4  | Cursor over `[KwModule, Identifier, Semicolon, Eof]`         | `peek/advance/check` correct; `peek` past end clamps to `Eof`; `expect` mismatch emits + returns null, no advance; `lexeme(token)` slices the source text (AR-8) | FR-3, AR-8 |
| ST-P5  | `module Main;` only (via `parse({ tokens, source, sourceId, bag })`, AR-8) | `ProgramNode` with `moduleDecl.name === "Main"`, `items: []`, `hasErrors === false` | FR-12/13, AC-11, AR-8 |
| ST-P6  | source with **no** `module`                                  | `E10001`; `ProgramNode` still returned (synthetic `ModuleDecl`)        | FR-13, AC-08      |
| ST-P7  | two `module` declarations                                    | `E10002` on the second; one `ProgramNode`                              | FR-13, AC-08      |
| ST-P8  | `import { a, b } from Foo.Bar;`                              | `ImportStmtNode` with `symbols=[a,b]`, `modulePath="Foo.Bar"`          | FR-14, AC-01      |
| ST-P9  | `parse()` of the same tokens twice                          | Byte-identical serialised AST (golden) and identical `bag.getAll()`    | AC-16             |
| ST-P10 | `a + b * c`                                                  | `Binary(+ , a, Binary(*, b, c))` (precedence)                          | FR-39, AC-02      |
| ST-P11 | `a = b = c`                                                  | `Assign(a, Assign(b, c))` (right-assoc)                                | FR-37, AC-03      |
| ST-P12 | `a ? b : c ? d : e`                                          | `Cond(a, b, Cond(c, d, e))` (right-assoc)                             | FR-38, AC-03      |
| ST-P13 | `<byte>(x)` vs `a < b`; `&x` vs `a & b`                      | prefix → `CastExpr`/`UnaryExpr`; infix → `BinaryExpr`                  | FR-40, AC-02      |

### Component 3 — Declarations, statements, expressions (constructs)

| #      | Input / Scenario                                             | Expected Output / Behavior                                             | Source        |
| ------ | ----------------------------------------------------------- | --------------------------------------------------------------------- | ------------- |
| ST-P14 | `function f(a: byte, b: word): void { }`                    | `FunctionDeclNode` params `[a:byte, b:word]`, return `void`, empty body | FR-16/17, AC-01 |
| ST-P15 | `interrupt function isr() { }`                              | `InterruptDeclNode`, no params; `export interrupt …` → `E10311`        | FR-18/23, AC-12 |
| ST-P16 | `struct P { x: byte; y: byte; }` / `struct E { }`           | `StructDeclNode` 2 fields / empty → `E10316`                           | FR-19, AC-08  |
| ST-P17 | `enum C { A, B = 5, }` / `enum E { }`                       | `EnumDeclNode` members (trailing comma ok) / empty → `E10315`         | FR-20, AC-08  |
| ST-P18 | `let x: byte = 1;` / `const k: byte;`                       | `LetDecl` w/ init / `const` no init → `E10314`                         | FR-21, AC-08  |
| ST-P19 | `zeropage { p: word; q: byte = 0; }`                        | `ZeropageBlockNode` with 2 `ZeropageField`s                           | FR-22, AC-01  |
| ST-P20 | `if (c) { } else if (d) { } else { }`                       | `IfStmt` with `elseClause` an `IfStmt` whose else is a `Block`         | FR-25, AC-01  |
| ST-P21 | `for (let i: byte = 0 to 10 step 2) { }`                    | `ForStmt` direction `to`, step present; `i`/`to`/`step` parse positionally | FR-28/29, AC-09 |
| ST-P22 | `switch (x) { case 1, 2: ... default: ... }` / no default   | `SwitchStmt` (multi-value case) / missing default → `E10072`           | FR-30/31/32, AC-08 |
| ST-P23 | `let x: byte = +;` (operator, no operand)                   | `ErrorExpr` inserted; one diagnostic                                   | FR-5, AC-04   |
| ST-P24 | garbage token at top level (e.g. `@`)                       | `ErrorStmt`; recovery to next decl/Eof; `E10310`                       | FR-5/15, AC-04 |
| ST-P25 | `let x: 123 = 0;` (number where type expected)              | `ErrorType`; `E10303`; offending token not consumed by `parseType`     | FR-5, AC-04   |
| ST-P26 | malformed decl then a valid `function`                      | Parser resumes at the `function` sync point (recovery table)          | FR-6, AC-05   |
| ST-P27 | one error followed by several would-be errors in a region   | Exactly **one** diagnostic for the region (cascade suppression)       | FR-7, AC-06   |
| ST-P28 | `type Foo = byte;` (or bare `type`)                         | `E10224` ("`type` reserved for future use"); recovery continues       | AR-2, AC-18   |
| ST-P29 | `peek($D020)`, `sizeof(P)`, `offsetof(P, y)`, `foo(1)`      | 3× `IntrinsicCallExpr` (`sizeof`/`offsetof` capture type/field arg); `foo(1)` → `CallExpr` | AR-3, AC-19 |

### Component 4 — Golden, span, fuzz, performance (spec tier)

| #      | Input / Scenario                                            | Expected Output / Behavior                                            | Source        |
| ------ | ---------------------------------------------------------- | -------------------------------------------------------------------- | ------------- |
| ST-P30 | A representative valid `.blend` program                    | Serialised AST matches committed `.snap`; `hasErrors === false`       | AC-07         |
| ST-P31 | A representative **invalid** `.blend` program              | Serialised AST (with sentinels) + ordered diagnostics match `.snap`   | AC-07         |
| ST-P32 | Known source; for every node, `source.slice(start,end)`    | Extracts the expected lexeme/construct text                          | AC-15, FR-9   |
| ST-P33 | Struct literal after `=` vs `{` after `if (...)`           | First → `StructLitExpr`; second → `Block`                            | FR-45, AC-10  |
| ST-P34 | 1,000 random token sequences → `parse()`                  | Never throws; always returns a `ParseResult`                         | FR-4, AC-14   |
| ST-P35 | 10,000-token file                                          | Parses in < 50 ms on CI hardware                                     | AC-17         |

> **AUTHORING RULE:** Every expectation above is derived from `spec/`, RD-03, or the Ambiguity
> Register — never from imagined implementation output. Golden `.snap` files (ST-P30/P31) are
> generated once during implementation and **reviewed** against the spec before being committed;
> thereafter they are the immutable oracle (testing.md Rule 10).

## Test Categories

### Specification Tests (written BEFORE implementation, per phase)

| Test File                       | ST Cases Covered                       | Component   |
| ------------------------------- | -------------------------------------- | ----------- |
| `node-kind.impl.test.ts`        | ST-P1                                  | AST core    |
| `reserved-builtins.impl.test.ts`| ST-P2                                  | AST core    |
| `diagnostic-codes.impl.test.ts` | ST-P2b                                 | registry    |
| `parser.spec.test.ts`           | ST-P5..P9, ST-P30..P35                 | parser API  |

> Note: ST-P1/P2/P2b/P3 are `*.impl.test.ts` files but are authored **before** their target
> code as spec-derived oracles (they assert spec-mandated counts/values, not implementation
> output). The red-phase verification still applies.

### Implementation Tests (after the slice they cover)

| Test File                  | Description                                                  | Priority |
| -------------------------- | ----------------------------------------------------------- | -------- |
| `walk.impl.test.ts`        | `walkNode`/`walkChildren` dispatch (ST-P3)                  | High     |
| `cursor.impl.test.ts`      | cursor primitives + Eof clamp (ST-P4)                      | High     |
| `pratt.impl.test.ts`       | precedence/assoc matrix, prefix vs infix (ST-P10..P13)     | High     |
| `parser.impl.test.ts`      | constructs + every diagnostic code + recovery (ST-P14..P29)| High     |

### Integration Tests

| Test                  | Components            | Description                                  |
| --------------------- | -------------------- | -------------------------------------------- |
| lex→parse round-trip  | lexer + parser       | `parse({ tokens: lex(...).tokens, source, sourceId, bag })` end-to-end |
| R15 boundary          | frontend / codegen   | ST-R15a/b/c remain green every phase         |

## Test Data

### Fixtures Needed
- Inline source strings for ST-P5..P29 (small, focused).
- Two committed `.blend`-style sources for golden snapshots (one valid, one invalid).
- A generated 10,000-token sequence for ST-P35 (built programmatically; not committed).

### Mock Requirements
- None — use the real `lex()`, real `createDiagnosticBag()`, real `parse()`.

## Verification Checklist

- [ ] All ST-P cases defined with concrete input/expected pairs (above).
- [ ] Every ST-P case traces to a requirement/spec/AR entry (Source column).
- [ ] Spec tests written BEFORE implementation; verified to FAIL (red) first.
- [ ] All spec tests pass after implementation (green).
- [ ] Impl tests written for cursor, Pratt, codes, recovery.
- [ ] Every parser code (E10001/E10002/E10072/E10224/E10300–E10316) has a triggering test.
- [ ] Every `NodeKind` (50) produced by ≥1 test (AC-13).
- [ ] Golden `.snap` files reviewed against spec before commit.
- [ ] No regressions; R15 boundary green; `git status --porcelain spec/` empty.
