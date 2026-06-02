# RD-03 Parser & AST — Implementation Plan

> **Feature**: Build the **parser** (recursive-descent + Pratt) and the **AST node model**
> — the second compiler pipeline stage — consuming the RD-02 lexer's `Token[]` stream.
> AST node types + visitor live in `@blend65/core`; the parser lives in `@blend65/frontend`.
> Implements `spec-v3.0` Ch 02–13 + `grammar.ebnf.md`; evaluations F001–F006, F008–F009,
> F011–F019, F022, F024.
> **Status**: Planning Complete
> **Created**: 2026-06-02
> **CodeOps Version**: (unstamped — no `codeops-mcp` dependency in this repo; consistent with RD-01/RD-02/RD-11a)
> **Source**: [RD-03](../../requirements/RD-03-parser-ast.md) · [grammar](../../spec/grammar.ebnf.md) · spec Ch 02–13

## Overview

This plan implements **RD-03** — the parser that turns the lexer's flat `Token[]` stream
into a typed, span-annotated **abstract syntax tree** for one source file, plus the AST node
model it produces. Following the error-tolerant frontend mandate (AR-15), the parser **never
throws**: it accumulates `Diagnostic`s in the shared `DiagnosticBag` (RD-11a) and inserts
**error-sentinel nodes** (`ErrorExpr`, `ErrorStmt`, `ErrorType`) so downstream phases always
receive a structurally complete tree.

Per the data-vs-logic split established by RD-02 (AR-L4), the **AST node interfaces**, the
`AstVisitor<R>` contract, the `walkNode`/`walkChildren` helpers, and the `RESERVED_BUILTINS`
set live in `@blend65/core` (a new `ast/` module) — shared by `frontend` *and*
`language-server`, neither of which may import `codegen` (R15/AR-20). The **parser logic**
(`parse()`, the token cursor, the 14-level Pratt engine, every parse function) lives in
`@blend65/frontend`, on top of the frozen RD-02 lexer. Parser diagnostic codes are added to
the single core registry (`diagnostic-codes.ts`) by addition (AR-L5 pattern). The frozen
`spec/` and the frozen RD-11a/RD-02 code are **never refactored**, only extended (D3, AR-Q2).

Scope is the complete grammar: a **50-node-kind** AST catalogue (3 source + 11 declaration +
**13** statement + 17 expression + 3 type + 3 error sentinel), the 14-precedence-level Pratt
expression parser, context-specific sync-point recovery with cascade suppression, the visitor
contract, the public `parse()` API, and the parser diagnostic codes (E10001/E10002 reused,
E10072 + E10300–E10316 added, E10224 reused). Explicitly **out of scope** (owned elsewhere):
token production (RD-02), type/scope/semantic checking (RD-04), SFA frame planning (RD-05),
IL/codegen (RD-06/07), diagnostic rendering (RD-11b), incremental re-parse (RD-14).

> **AR-1 (load-bearing):** `asm { }` blocks **do not exist** in Blend65 v3 (spec Ch 12 §1).
> The `AsmBlockNode` in the RD-03 requirements is an error; this plan removes it (51→50 node
> kinds) **and** corrects `requirements/RD-03-parser-ast.md` to match the frozen spec.

## Document Index

| #     | Document                                                | Description                                                          |
| ----- | ------------------------------------------------------- | ------------------------------------------------------------------- |
| AR    | [Ambiguity Register](00-ambiguity-register.md)          | Plan-level Zero-Ambiguity Gate decisions (AR-1..AR-7)               |
| 00    | [Index](00-index.md)                                    | This document — overview and navigation                             |
| 01    | [Requirements](01-requirements.md)                      | Functional requirements (FR-*), scope, acceptance criteria (AC-*)   |
| 02    | [Current State](02-current-state.md)                    | As-built core/frontend API the parser builds on; gaps               |
| 03-01 | [AST Node Catalogue](03-01-ast-node-catalogue.md)       | 50 node kinds, interfaces, `SourceSpan`, `AstVisitor`, walkers (core)|
| 03-02 | [Parser Algorithm](03-02-parser-algorithm.md)           | Cursor, recursive descent, 14-level Pratt, `parse()` API (frontend) |
| 03-03 | [Error Recovery & Codes](03-03-error-recovery.md)       | Sentinels, sync tables, cascade suppression, E10072/E10300–E10316   |
| 07    | [Testing Strategy](07-testing-strategy.md)              | Spec/impl test cases (ST-P*) + golden AST snapshots + fuzz          |
| 99    | [Execution Plan](99-execution-plan.md)                  | Phases, sessions, and master task checklist                         |

## Quick Reference

### Key Decisions

| Decision                               | Outcome                                                                        | Ref   |
| -------------------------------------- | ------------------------------------------------------------------------------ | ----- |
| `asm { }` / `AsmBlockNode`             | **Removed** — no inline asm in v3 (spec Ch 12 §1); 51→50 node kinds            | AR-1  |
| `type` keyword                         | Parser emits **E10224** on `KwType` in decl/stmt position; no `type` semantics | AR-2  |
| Intrinsic node shape                   | Store name **string** + `nameSpan`; `RESERVED_BUILTINS` (22 names) in core     | AR-3  |
| AST node span type                     | Embed as-built core **`SourceSpan`** (`{sourceId,start,end}`) as `node.span`   | AR-4  |
| Visitor/walker home                    | `@blend65/core` (with node types); parser logic in `@blend65/frontend`         | AR-5  |
| Parser diagnostic codes                | Added to core `diagnostic-codes.ts`; E10072 + E10300–E10316 new; E10001/2/224 reused | AR-6 |
| Commit mode                            | `--no-commit`                                                                  | AR-7  |

### Public API surface added by this plan

```typescript
// @blend65/core — AST vocabulary (new ast/ module)
export type NodeKind = "Program" | "ModuleDecl" | /* … 50 kinds total … */ | "ErrorType";
export interface AstNode { readonly kind: NodeKind; readonly span: SourceSpan; }
export interface ProgramNode extends AstNode { /* … */ }
// … 50 node interfaces + TopLevelItem / StmtNode / ExprNode / TypeNode unions …
export interface AstVisitor<R = void> { /* one visit* per node kind */ }
export function walkNode<R>(node: AstNode, visitor: AstVisitor<R>): R;
export function walkChildren(node: AstNode, visitor: AstVisitor<void>): void;
export const RESERVED_BUILTINS: ReadonlySet<string>; // 22 universal intrinsic names

// @blend65/frontend — parser logic
export interface ParseResult { readonly ast: ProgramNode; readonly hasErrors: boolean; }
export function parse(tokens: readonly Token[], sourceId: SourceId, bag: DiagnosticBag): ParseResult;
```

### Diagnostic codes touched (AR-6)

- **Reused (already in registry):** `E10001` MissingModuleDecl, `E10002` ModuleDeclNotFirst,
  `E10224` ReservedKeyword.
- **Added (by addition):** `E10072` (missing `default` clause) and the parser band
  `E10300`–`E10316` (17 codes — unexpected token, expected expression/statement/type/identifier,
  missing `;`/`}`/`)`/`]`, expected `to`/`downto`, invalid top-level decl, `export` not allowed,
  expected block, expected `:`, missing const `=`, empty enum, empty struct).

## Related Files

Created/modified by this plan:

- **New (core AST):** `packages/core/src/ast/node-kind.ts`, `ast/nodes.ts`, `ast/visitor.ts`,
  `ast/walk.ts`, `ast/reserved-builtins.ts`, `ast/index.ts`, wired through `packages/core/src/index.ts`.
- **Modified (core registry, addition-only):** `packages/core/src/diagnostics/diagnostic-codes.ts`
  (+ matching `*.impl.test.ts`).
- **New (frontend parser):** `packages/frontend/src/parser/cursor.ts`, `parser/pratt.ts`,
  `parser/parser.ts`, `parser/index.ts`, the matching `*.impl.test.ts` / `*.spec.test.ts` files
  and golden AST snapshots, wired through `packages/frontend/src/index.ts`.
- **Corrected (requirements, not frozen):** `requirements/RD-03-parser-ast.md` (remove asm — AR-1).
