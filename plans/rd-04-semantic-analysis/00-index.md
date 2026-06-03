# RD-04 Semantic Analysis (Skeleton) — Implementation Plan

> **Feature**: Build the **complete public surface** of the semantic-analysis phase — the
> `Type` representation, scope/symbol model, `CallGraph`, `ConstValue`, `SemanticModel`,
> `PlatformProfile` stub, and the `analyze()` entry point — with a **no-op passthrough**
> implementation. The real four-pass checker is deliberately **deferred** (research strategy:
> working compiler first). Data types live in `@blend65/core`; `analyze()` lives in
> `@blend65/frontend`. Implements RD-04 §3.5/§3.17 + §4 *shapes only*; defers §3.6–§3.16
> *behavior*.
> **Status**: Planning Complete

> **Created**: 2026-06-03
> **CodeOps Version**: (unstamped — no `codeops-mcp` dependency in this repo; consistent with RD-01/RD-02/RD-03/RD-11a)
> **Source**: [RD-04](../../requirements/RD-04-semantic-analysis.md) · spec Ch 02–10, 12–14 · `research/feasibility-and-strategy.md`

## Overview

This plan implements **RD-04** as a **passthrough skeleton**. Per the project's documented
strategy (`research/feasibility-and-strategy.md`: *"ship with NO optimizer first," "correct
before fast," "build incrementally"*) and the user's explicit direction, the semantic
**checker** is not built in this iteration. Instead, we deliver every **interface, type, and
contract** RD-04 specifies — so downstream phases (RD-05 SFA, RD-06 IL, RD-07 codegen, RD-14
LSP) can compile against a stable `SemanticModel` — while `analyze()` is a **no-op** that
accepts the parsed AST, never throws, and returns a structurally-valid but empty
`SemanticModel` (`hasErrors === false`). The full type/scope/control-flow analyzer is a
deliberate later investment, planned once the compiler emits working code end-to-end.

Following the data-vs-logic split established by RD-02/RD-03, the semantic **data vocabulary**
(`Type` union + structural utilities, `Scope`, `Symbol`, `CallGraph`, `ConstValue`,
`SemanticModel`, and a minimal `PlatformProfile` stub) lives in a new `semantics/` module in
`@blend65/core` — shared by `frontend` *and* `language-server`, neither of which may import
`codegen` (R15/AR-20). The `analyze()` function and its four **stubbed** pass functions live
in a new `semantics/` module in `@blend65/frontend`, on top of the frozen RD-03 AST. The
frozen `spec/` is never touched (D3); the AST and diagnostics core are **extended, never
refactored** (additive only).

Critically, this plan ships a first-class **[Deferred Semantics Ledger](08-deferred-semantics-ledger.md)**
that maps every requirement (R1–R121) and acceptance criterion (AC-01..AC-20) to its status
(`IMPLEMENTED (interface)` / `IMPLEMENTED (passthrough)` / `DEFERRED (no behavior)`), records
the diagnostic code each deferred check would emit, and parks the four §7 open questions — so
the real checker can be resumed later from a precise, traceable map. In-code
`// DEFERRED(RD-04-checker): Rxx` markers and a `SEMANTICS-DEFERRED` banner on the
requirements doc complete the three-layer deferral record.

> **D1 (load-bearing):** `analyze()` is **passthrough only** — it enforces none of R30–R117.
> What is *not* implemented is the point of the Deferred Semantics Ledger.

## Document Index

| #     | Document                                                       | Description                                                              |
| ----- | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| AR    | [Ambiguity Register](00-ambiguity-register.md)                 | Plan-level Zero-Ambiguity Gate decisions (D1–D12)                        |
| 00    | [Index](00-index.md)                                           | This document — overview and navigation                                  |
| 01    | [Requirements](01-requirements.md)                             | In-scope (interfaces + passthrough) vs deferred; acceptance criteria     |
| 02    | [Current State](02-current-state.md)                           | As-built core/frontend the skeleton builds on; gaps                      |
| 03-01 | [Type Model](03-01-type-model.md)                              | `Type` union, structural utils, `PlatformProfile` stub (core)            |
| 03-02 | [Scope / Symbol / SemanticModel](03-02-scope-symbol-model.md)  | `Scope`, `Symbol`, `CallGraph`, `ConstValue`, `SemanticModel` (core)     |
| 03-03 | [Passthrough Analyzer](03-03-passthrough-analyzer.md)          | `AnalyzeInput`, `analyze()`, four stubbed pass functions (frontend)      |
| 07    | [Testing Strategy](07-testing-strategy.md)                     | Spec/impl test cases (ST-S*) — shape existence + AC-01 no-throw          |
| 08    | [Deferred Semantics Ledger](08-deferred-semantics-ledger.md)   | What is NOT implemented, mapped to R/AC + diagnostic codes; parked Qs    |
| 99    | [Execution Plan](99-execution-plan.md)                         | Phases, sessions, and master task checklist                              |

## Quick Reference

### Key Decisions

| Decision                               | Outcome                                                                        | Ref   |
| -------------------------------------- | ------------------------------------------------------------------------------ | ----- |
| Scope                                  | **Passthrough skeleton** — full interfaces, `analyze()` is a no-op             | D1    |
| `SemanticModel` returned               | Empty-but-valid (global scope, `hasErrors=false`, `mainFunction=null`, empty maps) | D2 |
| Diagnostics from passthrough           | **None** — always `hasErrors=false`                                            | D3    |
| `PlatformProfile`                      | Minimal **stub interface** in `@blend65/core` (RD-10 supersedes)               | D4    |
| Primitive type name                    | **`"boolean"`** (match frozen AST; not `'bool'`)                               | D5    |
| `analyze()` signature                  | Object: `analyze(input: AnalyzeInput)`                                          | D6    |
| Type homes                             | Data in `@blend65/core` (`semantics/`); `analyze()` in `@blend65/frontend`     | D7    |
| Deferral documentation                 | Ledger doc + in-code `// DEFERRED` markers + requirements banner               | D8    |
| Requirements doc                       | Annotated (not frozen): R30–R117/AC-02..20 marked DEFERRED                     | D9    |
| Type utils                             | Pure structural utils implemented; `isAssignableTo`/`commonType` stubbed       | D10   |
| §7 open questions                      | Parked in the ledger for the future checker                                    | D11   |
| Commit mode                            | `--no-commit`                                                                  | D12   |

### Public API surface added by this plan

```typescript
// @blend65/core — semantic vocabulary (new semantics/ module)
export type PrimitiveName = "byte" | "sbyte" | "word" | "sword" | "boolean" | "void";
export type Type = PrimitiveType | ArrayType | StructType | EnumType | ErrorType;
export function isInteger(t: Type): boolean;   // + isSigned/isUnsigned/bitWidth/byteSize/isError/typeName
export function isAssignableTo(source: Type, target: Type): boolean;  // DEFERRED stub
export function commonType(a: Type, b: Type): Type | null;            // DEFERRED stub
export type ScopeKind = "global" | "module" | "function" | "block";
export interface Scope { /* kind, parent, children, symbols, node */ }
export type SymbolKind = "variable" | "constant" | "function" | /* … */ | "intrinsic";
export interface Symbol { /* name, kind, type, decl, scope, exported, mutable, … */ }
export interface CallGraph { /* functions, edges, findCycles() */ }
export interface ConstValue { readonly type: Type; readonly value: number | boolean; }
export interface PlatformProfile { /* minimal stub — RD-10 supersedes */ }
export interface SemanticModel { /* globalScope, typeMap, symbolMap, callGraph, … + query helpers */ }

// @blend65/frontend — passthrough analyzer (new semantics/ module)
export interface AnalyzeInput {
  readonly programs: readonly ProgramNode[];
  readonly bag: DiagnosticBag;
  readonly profile: PlatformProfile;
}
export function analyze(input: AnalyzeInput): SemanticModel;  // PASSTHROUGH — no checking
```

### What is explicitly NOT implemented (see the Ledger)

Type checking (R30–R43), expression typing behavior (R44–R62), declaration/statement
validation (R63–R83), recursion detection (R84–R87), const evaluation (R88–R94), intrinsic
validation (R95–R100), array/embed validation (R101–R108), warnings (R109–R112), and the
error-tolerance *behavior* (R113–R117). All accept-side behavior is a no-op; the
[Deferred Semantics Ledger](08-deferred-semantics-ledger.md) is the authoritative map.

## Related Files

Created/modified by this plan:

- **New (core semantics):** `packages/core/src/semantics/type.ts`, `semantics/type-utils.ts`,
  `semantics/scope.ts`, `semantics/symbol.ts`, `semantics/call-graph.ts`,
  `semantics/const-value.ts`, `semantics/platform-profile.ts`, `semantics/semantic-model.ts`,
  `semantics/index.ts`, plus matching `*.spec.test.ts` / `*.impl.test.ts`; wired through
  `packages/core/src/index.ts`.
- **New (frontend analyzer):** `packages/frontend/src/semantics/analyze.ts`,
  `semantics/passes.ts` (four stubbed pass functions), `semantics/index.ts`, plus
  `analyze.spec.test.ts`; wired through `packages/frontend/src/index.ts`.
- **Annotated (requirements, not frozen):** `requirements/RD-04-semantic-analysis.md`
  (`SEMANTICS-DEFERRED` banner — D9).
