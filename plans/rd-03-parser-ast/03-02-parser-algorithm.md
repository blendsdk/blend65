# Parser Algorithm (frontend): RD-03 Parser & AST

> **Document**: 03-02-parser-algorithm.md
> **Parent**: [Index](00-index.md)
> **Package**: `@blend65/frontend` — new `parser/` module
> **Source**: RD-03 §4.9, §4.13 + grammar.ebnf.md §6 + spec Ch 04 (adjusted by AR-2, AR-3, AR-4)

## Overview

The parser turns `readonly Token[]` into a `ProgramNode`. It is **recursive descent** for
source structure / declarations / statements and **Pratt** (top-down operator precedence) for
expressions. It never throws (FR-4); it consumes the as-built lexer output and appends
diagnostics to the shared `DiagnosticBag`. All AST node *types* come from `@blend65/core`; this
module is pure logic.

## Architecture

### File layout (`packages/frontend/src/parser/`)

| File          | Contents                                                                       |
| ------------- | ------------------------------------------------------------------------------ |
| `cursor.ts`   | Token cursor: `peek/peekKind/advance/check/expect/atEnd`, panic-mode state     |
| `pratt.ts`    | Binding-power tables + `parseExpression(minBP)`, prefix/infix/postfix dispatch |
| `parser.ts`   | `parse()`, source/declaration/statement/type parse functions, recovery        |
| `index.ts`    | Barrel: `export { parse }`, `export type { ParseResult }`                       |

> `parser.ts` is the largest unit. If it exceeds ~500 lines it is split into
> `parse-decl.ts`, `parse-stmt.ts`, `parse-type.ts` (each taking the shared cursor), with
> `parser.ts` retaining `parse()` + source structure. Flagged per-phase in the execution plan.

### Cursor (`cursor.ts`)

```typescript
export interface Cursor {
  peek(offset?: number): Token;            // clamped to the final Eof
  peekKind(offset?: number): TokenKindValue;
  advance(): Token;                        // returns current, moves to next (clamped at Eof)
  check(kind: TokenKindValue): boolean;    // peek().kind === kind
  expect(kind: TokenKindValue, code: DiagCodeValue, ctx: string): Token | null;
  atEnd(): boolean;                        // peek().kind === "Eof"
}
```
- Backed by a position index `i`; the token array is never mutated (FR-3).
- `peek` past the end returns the single trailing `Eof` (the lexer guarantees exactly one).
- `expect`: if `check(kind)` advances and returns the token; otherwise emits the given code
  (unless suppressed by panic mode, FR-7), returns `null`, and does **not** advance.
- Panic-mode flag lives on the parser state object (see recovery, 03-03), consulted by the
  diagnostic-emit helper so suppression is centralized.

### `parse()` (`parser.ts`)

```typescript
export interface ParseResult {
  readonly ast: ProgramNode;
  readonly hasErrors: boolean;
}
export function parse(
  tokens: readonly Token[],
  sourceId: SourceId,
  bag: DiagnosticBag,
): ParseResult;
```
Steps (FR-47):
1. Build the cursor + parser state `{ cursor, sourceId, bag, panicMode: false }`.
2. Parse the module declaration (FR-13): if the first significant token is not `KwModule`,
   emit **E10001** and synthesize a `ModuleDecl` with a zero-width span; else parse
   `module dotted.name;`. A *second* `module` later → **E10002**.
3. Parse top-level items until `Eof` (FR-15) via the declaration dispatcher.
4. Return `{ ast, hasErrors: bag.hasErrors() }` — never throws.

### Top-level dispatch (FR-15)

`peekKind()` selects the parse function:

| Leading token                            | Parse function            |
| ---------------------------------------- | ------------------------- |
| `KwImport`                               | `parseImport`             |
| `KwExport`                               | `parseExportedDecl` (peeks next: function/struct/enum/let/const; `interrupt`/`zeropage` → E10311) |
| `KwFunction`                             | `parseFunctionDecl`       |
| `KwInterrupt`                            | `parseInterruptDecl`      |
| `KwStruct` / `KwEnum`                    | `parseStructDecl` / `parseEnumDecl` |
| `KwLet` / `KwConst`                      | `parseLetDecl` / `parseConstDecl` |
| `KwZeropage`                             | `parseZeropageBlock`      |
| `KwType`                                 | **E10224** (AR-2), recover to next decl |
| anything else                            | **E10310**, recover to next decl keyword / Eof |

### Pratt expression parser (`pratt.ts`)

Binding-power table (RD-03 §4.9 — left/right BP per level). Lower BP = lower precedence:

| Level | Operators                                  | Assoc. | LBP | RBP |
| ----- | ------------------------------------------ | ------ | --- | --- |
| 1     | `= += -= *= /= %= &= \|= ^= <<= >>=`        | Right  | 2   | 1   |
| 2     | `? :`                                      | Right  | 4   | 3   |
| 3     | `\|\|`                                      | Left   | 5   | 6   |
| 4     | `&&`                                       | Left   | 7   | 8   |
| 5     | `\|`                                        | Left   | 9   | 10  |
| 6     | `^`                                        | Left   | 11  | 12  |
| 7     | `&` (binary)                               | Left   | 13  | 14  |
| 8     | `== !=`                                    | Left   | 15  | 16  |
| 9     | `< > <= >=`                                | Left   | 17  | 18  |
| 10    | `<< >>`                                    | Left   | 19  | 20  |
| 11    | `+ -`                                      | Left   | 21  | 22  |
| 12    | `* / %`                                    | Left   | 23  | 24  |
| 13    | prefix `- ! ~ &`, cast `<T>()`             | —      | —   | 25  |
| 14    | postfix `. [] ()`                          | Left   | 27  | —   |

```
parseExpression(minBP):
  lhs = parsePrefix()                 // primary, unary, or cast
  loop:
    k = peekKind()
    if k is postfix (. [ ( ) and LBP > minBP:
        lhs = parsePostfix(lhs)       // field / index / call / intrinsic-call
        continue
    if k is infix binary/ternary/assign with LBP > minBP:
        op = advance()
        rhs = parseExpression(op.RBP) // RBP<LBP ⇒ right-assoc for assign/ternary
        lhs = makeBinaryOrAssignOrCond(op, lhs, rhs)
        continue
    break
  return lhs
```

**Prefix disambiguation (FR-40):**
- `<` in **prefix** position → cast `<type>(expr)`; in **infix** position → less-than. Separate
  code paths (prefix vs infix loop) make this unambiguous.
- `&` in **prefix** position → address-of unary; in **infix** position → bitwise AND. Same.

**Postfix call disambiguation (AR-3):** when `parsePostfix` sees `(` after an `IdentExpr` whose
`name ∈ RESERVED_BUILTINS`, it builds an `IntrinsicCallExpr` (dispatching the first argument to
`parseType` for `sizeof`/`offsetof`, and a field identifier for `offsetof`'s 2nd arg); otherwise
a `CallExpr`.

### Struct-literal disambiguation (FR-45)

`{` is parsed as a `StructLitExpr` **only** when the expression parser is invoked in an
*initialiser context* (right-hand side after `=` in let/const/assignment). The declaration and
assignment parse functions pass an `allowStructLiteral` flag into `parseExpression`. In every
other position (`if (...)`, `while (...)`, `else`, `do`, function body, etc.) `{` begins a
`Block`, parsed by the statement layer. Because recursive descent always knows which parse
function it is in, this needs no token lookahead hack (FR-45, AC-10).

### Statement dispatch

`parseStatement` switches on `peekKind()`: `{` → block; `KwIf/KwWhile/KwDo/KwFor/KwSwitch` →
the matching parser; `KwReturn/KwBreak/KwContinue` → jump statements; `fallthrough` (contextual
`Identifier`) followed by `;` → `FallthroughStmt`; `KwLet/KwConst` → local declaration;
`KwType` → **E10224** (AR-2); otherwise → expression statement (`expr ;`).

### Type parsing (`parseType`)

`byte/sbyte/word/sword/boolean/void` keyword → `PrimitiveType`; identifier → `NamedType`;
suffix `[ constExpr ]` → sized `ArrayType`, `[]` → unsized `ArrayType`; on an unexpected
non-type token → emit **E10303** and return `ErrorType` **without** consuming the token (so the
caller's recovery sees it).

## Integration Points

- Imports all node types, unions, `walkNode`, `RESERVED_BUILTINS` from `@blend65/core`.
- Imports `lex` consumers' `Token`, `TokenKind`, `DiagCode`, `makeSpan`, `DiagnosticBag`,
  `SourceId` from `@blend65/core`.
- Re-exported via `packages/frontend/src/index.ts` (`export * from "./parser/index.js";`).
- Never imports `@blend65/codegen` (R15/AR-20) — enforced by the boundary tier each phase.

## Span construction

Each parse function records the first token's `span.start` and the last token's `span.end`,
then builds the node span with `makeSpan(sourceId, start, end)` (AR-4). Parenthesised
expressions extend the inner expr's span over the enclosing `(` `)` (FR-42) by re-wrapping with
a fresh `makeSpan` — no `Paren` node is created.

## Error Handling

See [03-03 Error Recovery & Codes](03-03-error-recovery.md) for the sentinel insertion, the
sync-point table, cascade suppression, and the full code list. Summary: every `expect` failure
and every dispatch miss routes through a single `emit(code, span, msg)` helper that honours
panic mode, then the caller inserts the appropriate `Error*` sentinel and synchronises.

## Testing Requirements

- `cursor.impl.test.ts`: `peek/advance/check/expect/atEnd` incl. Eof clamping (ST-P4).
- `pratt.impl.test.ts`: precedence/associativity matrix, prefix vs infix `<`/`&` (ST-P10..P13).
- `parser.spec.test.ts`: grammar-coverage + golden AST snapshots + minimal program (ST-P5..P9,
  ST-P30..P33).
- Behavioural ST cases per construct are enumerated in [07-testing-strategy.md](07-testing-strategy.md).
