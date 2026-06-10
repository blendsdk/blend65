# RD-05 SFA Frame Planner & Zero-Page Allocator — Implementation Plan

> **Feature**: Implement the **Static Frame Allocation (SFA) frame planner** and
> **zero-page allocator** — the last stage of the error-tolerant front-end pipeline. It
> transforms function frame inputs + a platform budget profile into a concrete
> `AllocationPlan`: per-function frames, frame-coloring (interference-graph) memory sharing,
> module-variable layout, priority-ordered ZP allocation with pointer sharing, worst-case
> stack-depth analysis, pre-ACME budget diagnostics, and ACME symbol definitions. Shared
> records live in `@blend65/core` (`sfa/`); `planAllocation()` lives in `@blend65/frontend`
> (`sfa/`). Implements RD-05 R1–R62 / AC-01–AC-21 and frozen spec Ch 11 + Ch 06 §5–§7.
> **Status**: ✅ Implemented (2026-06-04) — all 24 execution tasks complete; full verify green; spec/ clean
> **Created**: 2026-06-04
> **CodeOps Version**: (unstamped — no `codeops-mcp` dependency in this repo; consistent with RD-01..RD-04/RD-11a)
> **Source**: [RD-05](../../requirements/RD-05-sfa-frame-planner.md) · spec Ch 11 (Memory Model & SFA), Ch 06 §5–§7 · evaluations F005/F018/F019

## Overview

This plan implements **RD-05** with **full, fixture-tested algorithms** (register D1=A) — not
a passthrough. The SFA passes are pure functions of `(FunctionInfo[], CallGraph, PlatformProfile)`,
so they can be built and golden-tested today against hand-constructed fixtures even though
RD-04's `analyze()` currently returns an empty `SemanticModel`. The **only** deferred seam is the
live `SemanticModel → FunctionInfo[]` adapter (`modelToFunctionInfo`), which returns `[]` under
the passthrough and is filled in unchanged when the future RD-04b checker populates the model.

Following the data-vs-logic split established by RD-02/RD-03/RD-04, the SFA **data vocabulary**
(`FunctionInfo`, the `AllocationPlan` record family, and the interim `PlatformProfile` budget
fields) lives in a new `sfa/` module in `@blend65/core` — shared by `frontend` *and*
`language-server`, neither of which may import `codegen` (R15/AR-20). The planner logic
(`planAllocation()` + the nine passes + the adapter) lives in a new `sfa/` module in
`@blend65/frontend`. The frozen `spec/` is never touched (D3-RD04 freeze); the existing core
diagnostics and `PlatformProfile` stub are **extended, never refactored** (additive only).

Because RD-10 (the real platform-profile system) is not yet built, RD-05 additively defines the
budget fields it needs on the existing core `PlatformProfile` stub (register D2=A), supplies a
C64-shaped test fixture profile, and reuses the already-registered diagnostic codes
E10032/E10033/W10030/W10033/W10180 (register D4 — verified present).

> **D1 (load-bearing):** the algorithms are **real**. What is deferred is only the live wiring
> to `analyze()`'s output (the `modelToFunctionInfo` adapter), because RD-04 is a passthrough.

## Document Index

| #     | Document                                                              | Description                                                                |
| ----- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| AR    | [Ambiguity Register](00-ambiguity-register.md)                       | Plan-level Zero-Ambiguity Gate decisions (D1–D7)                          |
| 00    | [Index](00-index.md)                                                 | This document — overview and navigation                                    |
| 01    | [Requirements](01-requirements.md)                                   | In-scope (algorithms + records) vs deferred (live wiring); R/AC mapping     |
| 02    | [Current State](02-current-state.md)                                 | As-built core/frontend the planner builds on; the empty-model gap          |
| 03-01 | [Frame Model & Computation](03-01-frame-model.md)                    | `FunctionInfo`, `FunctionFrame`/`FrameSlot`, type-size table (core + pass) |
| 03-02 | [Interference Graph & Coloring](03-02-interference-and-coloring.md)  | Interference-graph construction, greedy chordal coloring (deterministic)   |
| 03-03 | [Module Vars & Zero-Page Allocation](03-03-zp-and-layout.md)         | Module-var layout, ZP priority allocation, pointer sharing                 |
| 03-04 | [Stack Depth & Budget Diagnostics](03-04-stack-and-budgets.md)       | Stack-depth analysis; E10032/E10033/W10030/W10033/W10180; error tolerance  |
| 03-05 | [AllocationPlan, API & Symbols](03-05-allocation-plan-and-api.md)    | `AllocationPlan` record, `planAllocation()`, adapter seam, ACME symbol names |
| 07    | [Testing Strategy](07-testing-strategy.md)                           | Spec/impl test cases (ST-*) incl. the Ch 11 §3.4 coloring example + goldens |
| 99    | [Execution Plan](99-execution-plan.md)                               | Phases, sessions, and master task checklist                                |

## Quick Reference

### Key Decisions

| Decision                                  | Outcome                                                                              | Ref   |
| ----------------------------------------- | ------------------------------------------------------------------------------------ | ----- |
| Build strategy                            | **Full algorithms, fixture-tested**; defer only the live `analyze()`→planner wiring  | D1    |
| Platform budgets                          | **Interim budget fields** added to core `PlatformProfile` stub (RD-10 supersedes)    | D2    |
| Frame inputs                              | **RD-05-owned `FunctionInfo` record** + `modelToFunctionInfo` adapter (not `Symbol`) | D3/D5 |
| Diagnostic codes                          | **Reuse** E10032/E10033/W10030/W10033/W10180 (verified present; one-registry rule)   | D4    |
| Module directory                          | **`sfa/`** in both `@blend65/core` and `@blend65/frontend`                           | D6    |
| Commit mode                               | `--no-commit`                                                                        | D7    |

### Public API surface added by this plan

```typescript
// @blend65/core — SFA vocabulary (new sfa/ module)
export interface FunctionInfo {
  readonly name: string;                       // fully-qualified module.function
  readonly parameters: readonly FrameVar[];    // declaration order
  readonly locals: readonly FrameVar[];        // declaration order
  readonly isInterrupt: boolean;
  readonly isEscaped: boolean;                 // address-taken (&fn) — FUT-003 insurance
  readonly isReachable: boolean;               // called, exported, or address-taken
  readonly callees: readonly string[];         // outgoing call edges (by callee name)
}
export interface FrameVar { readonly name: string; readonly type: Type; readonly byRef: boolean; }

export interface AllocationPlan { /* frames, zp, module vars, stack, symbols, resourceData, hasErrors */ }
export interface FunctionFrame { /* functionName, slots[], totalSize, isInterrupt, isEscaped, isReachable */ }
export interface FrameSlot { /* name, kind, type, size, offset */ }
// + FrameAllocation, ZpAllocation, ModuleVariableAllocation, StackAnalysis, SymbolDefinition, SfaResourceData

// @blend65/core — interim PlatformProfile budget fields (additive; RD-10 supersedes)
export interface PlatformProfile { /* …existing name/charEncoding… + ramStart/ramEnd/zpStart/zpEnd/stackBudget/… */ }

// @blend65/frontend — planner (new sfa/ module)
export function planAllocation(functions: readonly FunctionInfo[], profile: PlatformProfile, bag: DiagnosticBag): AllocationPlan;
export function modelToFunctionInfo(model: SemanticModel): FunctionInfo[]; // DEFERRED wiring seam → [] under passthrough
```

### What is explicitly NOT implemented (the single deferred seam)

Only the **live extraction** of `FunctionInfo[]` from a populated `SemanticModel` is deferred
(`modelToFunctionInfo` returns `[]` while RD-04 is a passthrough). Every SFA algorithm — frame
computation, interference graph, coloring, module-var layout, ZP allocation, stack-depth
analysis, budget checking, symbol generation — is **fully implemented and tested** against
`FunctionInfo` fixtures. When RD-04b lands, only the adapter body changes.

## Related Files

Created/modified by this plan:

- **New (core `sfa/`):** `packages/core/src/sfa/function-info.ts`, `sfa/frame.ts`,
  `sfa/allocation-plan.ts`, `sfa/index.ts`, plus `*.spec.test.ts` / `*.impl.test.ts`;
  wired through `packages/core/src/index.ts`.
- **Modified (core):** `packages/core/src/semantics/platform-profile.ts` — additive interim
  budget fields (D2); `packages/core/src/index.ts` — export `sfa/`.
- **New (frontend `sfa/`):** `packages/frontend/src/sfa/frame-computation.ts`,
  `sfa/interference.ts`, `sfa/coloring.ts`, `sfa/zp-allocator.ts`, `sfa/stack-analysis.ts`,
  `sfa/budgets.ts`, `sfa/symbols.ts`, `sfa/plan-allocation.ts`, `sfa/model-adapter.ts`,
  `sfa/index.ts`, plus matching `*.spec.test.ts` / `*.impl.test.ts`; wired through
  `packages/frontend/src/index.ts`.
- **Annotated (requirements, not frozen):** `requirements/RD-05-sfa-frame-planner.md`
  (status banner noting the live-wiring deferral — D1).
