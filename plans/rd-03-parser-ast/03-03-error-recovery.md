# Error Recovery & Diagnostic Codes: RD-03 Parser & AST

> **Document**: 03-03-error-recovery.md
> **Parent**: [Index](00-index.md)
> **Source**: RD-03 §4.8, §4.10, §4.12 (adjusted by AR-1, AR-2, AR-6)

## Overview

The parser is error-tolerant: it never throws (FR-4), inserts error-sentinel nodes at failure
points (FR-5), synchronises at context-specific points (FR-6), and suppresses cascading
diagnostics until a sync token is consumed (FR-7). This document defines the sentinels, the
sync-point table, the cascade-suppression mechanism, and the complete diagnostic-code set —
which codes are **reused** from the frozen registry and which are **added by addition** (AR-6).

## Error-Sentinel Nodes (FR-5)

Three sentinels (from `@blend65/core`, see 03-01): `ErrorExpr`, `ErrorStmt`, `ErrorType`. Each
carries only `kind` + `span` (the erroneous/skipped token range). They are inserted where a
real node was expected so the tree stays structurally complete:

- **`ErrorExpr`** — expression position fails (e.g. operator with no operand).
- **`ErrorStmt`** — statement / top-level position fails or a region is skipped.
- **`ErrorType`** — a type was expected but the token is not type-introducing.

## Cascade Suppression (FR-7)

The parser state holds `panicMode: boolean`. The single `emit(code, span, msg)` helper:

```
emit(code, span, msg):
  if panicMode: return          // suppressed — withhold secondary errors
  bag.addError(code, span, msg)
  panicMode = true              // enter panic after the first reported error
```

`panicMode` is **cleared** when a synchronisation token is successfully consumed (see table).
Thus a single erroneous region yields **at most one** diagnostic (AC-06). The `DiagnosticBag`'s
own dedup on `(code, sourceId, start)` is a second-line guard, but suppression is the primary
mechanism so distinct-but-spurious codes are also withheld.

> Note: the first error in a fresh (non-panic) region is always reported; only *follow-on*
> errors before the next sync point are suppressed.

## Synchronisation Points (FR-6) — recovery table (AR-1: no `asm` row)

| Context        | Sync tokens                                                                                          | Action                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Top-level      | `function`, `interrupt`, `struct`, `enum`, `let`, `const`, `zeropage`, `import`, `export`, `Eof`      | Skip tokens; insert `ErrorStmt` over the skipped region; clear panic |
| Statement list | `;`, `}`, `if`, `while`, `do`, `for`, `switch`, `return`, `break`, `continue`, `let`, `const`         | Skip to sync; if `;`, consume it; insert `ErrorStmt`; clear panic |
| Expression     | `;`, `)`, `]`, `}`, `,`                                                                               | Insert `ErrorExpr`; stop the sub-expression parse                |
| Parameter list | `,`, `)`                                                                                              | Insert a parameter with `ErrorType`; skip to sync                |
| Struct fields  | `;`, `}`                                                                                              | Skip to sync; resume field parsing                               |
| Enum members   | `,`, `}`                                                                                              | Skip to sync; resume member parsing                              |
| Switch body    | `case`, `default`, `}`                                                                                | Skip to next case/default/end                                    |
| Type position  | any non-type token                                                                                   | Insert `ErrorType`; **do not** consume the unexpected token      |

> The `asm` keyword row from RD-03 §4.10 is **removed** — there is no `asm` keyword (AR-1).
> Contextual keywords `to`/`downto`/`step`/`fallthrough` are `Identifier`s, never sync tokens.

## Diagnostic Codes (AR-6)

### Reused — already in the frozen registry (do NOT re-add)

| Code   | `DiagCode` name        | Meaning                                   | Emitted by |
| ------ | ---------------------- | ----------------------------------------- | ---------- |
| E10001 | `MissingModuleDecl`    | Missing `module` declaration              | FR-13      |
| E10002 | `ModuleDeclNotFirst`   | A second `module` declaration / not first | FR-13      |
| E10224 | `ReservedKeyword`      | `type` is reserved for future use         | FR-36 (AR-2) |

### Added by addition (AR-6) — new `DiagCode` members in `diagnostic-codes.ts`

| Code   | Proposed `DiagCode` name      | Message                                            |
| ------ | ----------------------------- | -------------------------------------------------- |
| E10072 | `MissingDefaultClause`        | Missing `default` clause in `switch` statement     |
| E10300 | `UnexpectedToken`             | Unexpected token: expected `{expected}`, found `{found}` |
| E10301 | `ExpectedExpression`          | Expected expression                                |
| E10302 | `ExpectedStatement`           | Expected statement                                 |
| E10303 | `ExpectedTypeAnnotation`      | Expected type annotation                           |
| E10304 | `ExpectedIdentifier`          | Expected identifier                                |
| E10305 | `MissingSemicolon`            | Missing `;` after `{context}`                      |
| E10306 | `MissingCloseBrace`           | Missing `}` to close `{context}`                   |
| E10307 | `MissingCloseParen`           | Missing `)` to close `{context}`                   |
| E10308 | `MissingCloseBracket`         | Missing `]` to close `{context}`                   |
| E10309 | `ExpectedToOrDownto`          | Expected `to` or `downto` in for-loop              |
| E10310 | `InvalidTopLevelDeclaration`  | Invalid top-level declaration                      |
| E10311 | `ExportNotAllowed`            | `export` is not allowed on `{context}`             |
| E10312 | `ExpectedBlock`               | Expected block `{ ... }`                           |
| E10313 | `ExpectedColon`               | Expected `:` after `{context}`                     |
| E10314 | `MissingConstInitialiser`     | Missing `=` in const declaration (initialiser required) |
| E10315 | `EmptyEnumDeclaration`        | Empty `enum` declaration (at least one member required) |
| E10316 | `EmptyStructDeclaration`      | Empty `struct` declaration (at least one field required) |

> **Naming note:** `E10163 EmptyStruct` already exists in the registry as a *semantic* code
> (RD-04 band). The parser's empty-struct code is the **distinct** spec-defined `E10316`
> (`EmptyStructDeclaration`) per RD-03 §4.12 — they do not collide. Same for enums: semantic
> `E10140 EmptyEnum` vs parser `E10315 EmptyEnumDeclaration`. The parser uses the E103xx
> members exclusively.

### Registry placement

New members are appended to the existing `DiagCode` object in
`packages/core/src/diagnostics/diagnostic-codes.ts`, in a clearly commented
`// Parser (RD-03, spec Ch 14)` block, immediately after the lexer block. The existing RD-11a /
RD-02 entries are untouched (AR-Q2). `diagnostic-codes.impl.test.ts` is extended to assert each
new code's value (ST-P2b).

## Code → context map (which FR/AC triggers each)

| Code   | Trigger site                                              | Test (AC/ST)    |
| ------ | -------------------------------------------------------- | --------------- |
| E10001 | `parse()` finds no leading `module`                      | AC-08, ST-P5    |
| E10002 | a second `module` decl appears                           | AC-08           |
| E10072 | `switch` body parsed with no `default`                   | AC-08, FR-32    |
| E10224 | `KwType` in decl/stmt position                           | AC-18, ST-P22   |
| E10300 | generic `expect()` mismatch                              | AC-08           |
| E10301 | `parsePrefix` finds no primary                           | AC-04 (ErrorExpr) |
| E10302 | statement dispatch finds nothing valid                   | AC-04 (ErrorStmt) |
| E10303 | `parseType` on a non-type token                          | AC-04 (ErrorType) |
| E10304 | identifier expected (name positions)                     | AC-08           |
| E10305 | missing `;` (e.g. do-while, let/const)                   | FR-27, AC-08    |
| E10306–E10308 | missing `}` / `)` / `]`                            | AC-05, AC-08    |
| E10309 | for-loop direction not `to`/`downto`                     | FR-28, AC-08    |
| E10310 | invalid top-level token                                  | FR-15, AC-08    |
| E10311 | `export interrupt` / `export zeropage` / local `export`  | FR-23, AC-12    |
| E10312 | block expected (function/if/while/... body)              | AC-08           |
| E10313 | missing `:` (param, struct field, return type, ternary)  | AC-08           |
| E10314 | `const` without initialiser                              | FR-21, AC-08    |
| E10315 | empty `enum`                                             | FR-20, AC-08    |
| E10316 | empty `struct`                                           | FR-19, AC-08    |

## Error Handling Strategy summary

| Error Case                            | Strategy                                                          | AR Ref |
| ------------------------------------- | ---------------------------------------------------------------- | ------ |
| Unexpected token mid-construct        | `emit` (panic-aware) → insert sentinel → sync                    | FR-5/6/7 |
| `type` used as a declaration          | E10224, recover to next decl (no `type` semantics)               | AR-2   |
| Inline assembly `asm { }`             | N/A — does not exist; `asm_*()` parse as `IntrinsicCallExpr`     | AR-1   |
| Cascade of secondary errors           | `panicMode` withholds until a sync token is consumed             | FR-7   |
| Unrecoverable type syntax             | `ErrorType` returned without consuming the offending token       | FR-5   |

## Testing Requirements

- `parser.impl.test.ts`: one triggering case per added code (ST-P20..P29), each sentinel kind
  (ST-P23..P25), each recovery context (ST-P26), cascade suppression (ST-P27).
- `diagnostic-codes.impl.test.ts`: assert E10072 + E10300–E10316 values (ST-P2b).
- Determinism + no-throw fuzz live in `parser.spec.test.ts` (ST-P34, ST-P35).
