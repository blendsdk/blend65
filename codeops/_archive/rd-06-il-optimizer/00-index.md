# RD-06 Intermediate Language (IL) & IL Optimizer — Implementation Plan

> **Feature**: Implement the **target-independent Intermediate Language (IL)** — the
> flat, typed three-address-code / basic-block-CFG representation between the validated
> AST+`SemanticModel` (RD-04) + `AllocationPlan` (RD-05) and 6502 codegen (RD-07) — plus
> its **deterministic textual form** (`printIL` / `--emit-il`) and the **IL optimizer
> pass pipeline** (`optimizeIL`, **passthrough in v1**). The AST→IL **lowering** is built
> for the gate + slice-2 surface behind an extensible typed visitor seam; the full IL
> data model, printer, and optimizer pipeline are built completely. All artifacts live in
> `@blend65/codegen` (the first back-end package). Implements RD-06 R1–R70 / AC-01–AC-19
> and frozen spec Ch 02–06, 08–09, 11–13 (lowering surface) + Ch 14 (W10130, deferred).
> **Status**: Implemented (2026-06-05 — walking-skeleton slice scope; gate/slice-2/§4.7 lowering green, full IL model + printer + passthrough optimizer; live façade wiring deferred to RD-04b per D5)

> **Created**: 2026-06-05
> **CodeOps Version**: (unstamped — no `codeops-mcp` dependency in this repo; consistent with RD-01..RD-05/RD-11a)
> **Source**: [RD-06](../../requirements/RD-06-il-optimizer.md) · spec Ch 02–06/08–09/11–13/14 · master register AR-45..AR-52, AR-29/AR-49, AR-91

## Overview

This plan implements **RD-06** using the **AR-38 walking-skeleton methodology**
(register **D1**). The IL **data model** is low-churn and is transcribed **fully up
front**: the typed `ILType` model, the `ILOperand` union (immediate / temp / location),
the complete `ILInstruction` set (arithmetic, bitwise, comparison, conversion, memory,
copy, call, intrinsic), the `ILTerminator` set, the `BasicBlock`/`ILFunction`/`ILProgram`
CFG records, and the deterministic **textual printer** (the `--emit-il` and
golden-snapshot surface). The **optimizer** is built as an architectural seam — an
`ILPass` interface and an `optimizeIL` pipeline runner that applies **zero passes in v1**
(R57). The **lowering** (`lowerToIL`) is the churn-prone, consumer-coupled part, so it is
implemented **only for the gate + slice-2 surface** (poke a constant; local `byte`;
`store`/`load`; simple arithmetic; `ret`) behind an **extensible typed lowering-visitor**
whose default arm raises an ICE for any not-yet-supported AST node kind (R69) — never a
silent gap.

Why this split: **the optimizer operates on IL, not on AST** (register D1 notes). When
the team returns for the two real optimizers (IL-general here, peephole in RD-08), they
need a complete, stable IL model + textual form + pass seam — which this plan delivers —
not all 51 AST→IL lowerings. The lowering rules are coupled to RD-04b's not-yet-final
promotion representation and to RD-07 codegen (which does not exist), so building them all
now would be the v2 "100%-before-a-consumer" trap. RD-06 therefore differs from RD-05's
"full algorithms" choice precisely because RD-05's passes were self-contained pure
functions, whereas RD-06's lowering bridges two empty stages.

Following the AR-20 frontend/backend boundary, **all** RD-06 artifacts live in
`@blend65/codegen` — there is no core/codegen split (the language-server must never import
codegen; R15/AR-20). The IL model + lowering + printer live in `@blend65/codegen/src/il/`;
the optimizer pipeline lives in `@blend65/codegen/src/il/optimizer/` (register **D3**).
The frozen `spec/` is never touched; the existing core `Diagnostic`/`DiagnosticBag` and
the RD-03 AST / RD-04 `SemanticModel` / RD-05 `AllocationPlan` records are **consumed,
never modified**.

> **D1/D5 (load-bearing):** the IL model, printer, and optimizer seam are **real and
> complete**; the gate/slice-2 lowering is **real and fixture-tested**. What is deferred
> is only (a) lowering for the wider language surface (added per future slice alongside
> its RD-07 codegen consumer), and (b) the live compiler-façade wiring that threads a
> *populated* `SemanticModel` (RD-04b) into `lowerToIL` — under today's passthrough an
> end-to-end call lowers to an empty `ILProgram`, but every implemented lowering rule is
> exercised directly via fixtures.

## Document Index

| #     | Document                                                              | Description                                                                 |
| ----- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| AR    | [Ambiguity Register](00-ambiguity-register.md)                       | Plan-level Zero-Ambiguity Gate decisions (D1–D7)                            |
| 00    | [Index](00-index.md)                                                 | This document — overview and navigation                                      |
| 01    | [Requirements](01-requirements.md)                                   | In-scope (IL model + printer + optimizer seam + gate/slice-2 lowering) vs deferred; R/AC mapping |
| 02    | [Current State](02-current-state.md)                                 | As-built codegen/core/frontend the lowering builds on; the empty-model gap  |
| 03-01 | [IL Data Model](03-01-il-data-model.md)                              | `ILType`, `ILOperand`, `ILInstruction`, `ILTerminator`, `BasicBlock`/`ILFunction`/`ILProgram` |
| 03-02 | [AST→IL Lowering & Visitor Seam](03-02-lowering.md)                  | `lowerToIL`, the extensible lowering visitor, gate/slice-2 rules, ICE default |
| 03-03 | [Textual Form & Optimizer Pipeline](03-03-textual-and-optimizer.md)  | `printIL` deterministic format; `ILPass`/`optimizeIL` passthrough pipeline   |
| 07    | [Testing Strategy](07-testing-strategy.md)                           | Spec/impl test cases (ST-*) incl. RD-06 §4.7 golden IL snapshots             |
| 99    | [Execution Plan](99-execution-plan.md)                               | Phases, sessions, and master task checklist                                 |

## Quick Reference

### Key Decisions

| Decision                                  | Outcome                                                                              | Ref   |
| ----------------------------------------- | ------------------------------------------------------------------------------------ | ----- |
| Build strategy                            | **Walking-skeleton slice scope** — full IL model + printer + optimizer seam now; lowering for gate/slice-2 behind an extensible visitor | D1    |
| W10130 (unreachable code)                 | **Deferred** — build the CFG, but no reachability analysis / no warning until the real DCE pass | D2    |
| Module layout                             | **`il/`** (model + lowering + printer) and **`il/optimizer/`** (pass pipeline) in `@blend65/codegen` | D3    |
| Entry-point signature                     | **`lowerToIL(input: LowerInput, bag)`** with `{ program, model, plan }` (object-input convention) | D4    |
| Deferred seam                             | Lowering **fixture-tested**; defer only the live `analyze()`→`planAllocation()`→`lowerToIL()` façade wiring | D5    |
| Diagnostic codes                          | **Reuse** `IceCode.Unexpected` (E90001) for the visitor default; no new codes; v1 emits no user diagnostics | D6    |
| Commit mode                               | `--no-commit`                                                                        | D7    |

### Public API surface added by this plan

```typescript
// @blend65/codegen — IL model (new il/ module)
export interface ILType { readonly width: 8 | 16; readonly signed: boolean; }
export type ILOperand =
  | { readonly kind: "immediate"; readonly value: number; readonly type: ILType }
  | { readonly kind: "temp"; readonly id: number; readonly type: ILType }
  | { readonly kind: "location"; readonly symbol: string; readonly offset?: number; readonly type: ILType };
export type ILInstruction = /* arithmetic | bitwise | comparison | conversion | memory | copy | call | intrinsic | source_span */ ;
export type ILTerminator = /* br | brcond | ret | unreachable */ ;
export interface BasicBlock { readonly label: string; readonly instructions: readonly ILInstruction[]; readonly terminator: ILTerminator; }
export interface ILFunction { readonly name: string; readonly params: readonly ILOperand[]; readonly returnType: ILType | "void"; readonly blocks: readonly BasicBlock[]; readonly tempCount: number; readonly isInterrupt: boolean; }
export interface ILProgram { readonly functions: readonly ILFunction[]; readonly initCode: readonly BasicBlock[]; readonly constData: readonly ConstDataEntry[]; readonly allocationPlan: AllocationPlan; }

// @blend65/codegen — lowering (new il/ module)
export interface LowerInput { readonly program: readonly ProgramNode[]; readonly model: SemanticModel; readonly plan: AllocationPlan; }
export function lowerToIL(input: LowerInput, bag: DiagnosticBag): ILProgram;  // gate/slice-2 surface; ICE on unsupported node kinds

// @blend65/codegen — textual form
export function printIL(program: ILProgram): string;  // deterministic; --emit-il + golden surface

// @blend65/codegen — optimizer (new il/optimizer/ module)
export interface ILPass { readonly name: string; run(program: ILProgram, bag: DiagnosticBag): ILProgram; }
export function optimizeIL(program: ILProgram, passes: readonly ILPass[], bag: DiagnosticBag): ILProgram;  // v1: passes = [] (passthrough)
```

### What is explicitly NOT implemented (the deferred surface)

1. **Lowering beyond the gate/slice-2 surface** — control flow (`if`/`while`/`do`/`for`/
   `switch`), short-circuit `&&`/`||`, `?:`, struct/array access, function calls, the
   wider intrinsic set, type-promotion materialization for the full type matrix. Each is
   added per future slice **alongside its RD-07 codegen consumer** (R29–R52). The visitor
   default raises an ICE (E90001) for any node kind not yet handled (R69).
2. **Optimizer passes** — constant folding, DCE, strength reduction (R58–R60) are
   **named and architected** but **not implemented** (v1 passthrough, R57).
3. **W10130 unreachable-code analysis** — deferred with the DCE pass (D2).
4. **Live façade wiring** — threading a *populated* `SemanticModel` into `lowerToIL`
   (lights up unchanged when RD-04b lands, D5).

## Related Files

Created/modified by this plan (all in `@blend65/codegen`; nothing in `spec/`):

- **New (`il/`):** `packages/codegen/src/il/il-type.ts`, `il/operand.ts`,
  `il/instruction.ts`, `il/cfg.ts` (`BasicBlock`/`ILFunction`/`ILProgram`/`ConstDataEntry`),
  `il/print-il.ts`, `il/lower.ts` (`lowerToIL` + visitor), `il/builder.ts` (CFG/temp
  builder helpers), `il/test-fixtures.ts`, `il/index.ts`, plus matching
  `*.spec.test.ts` / `*.impl.test.ts` and `__snapshots__/` golden files.
- **New (`il/optimizer/`):** `packages/codegen/src/il/optimizer/pass.ts` (`ILPass`),
  `optimizer/optimize-il.ts` (`optimizeIL`), `optimizer/index.ts`, plus tests.
- **Modified (codegen):** `packages/codegen/src/index.ts` — export `il/` + `il/optimizer/`.
- **Annotated (requirements, not frozen):** `requirements/RD-06-il-optimizer.md` (status
  banner noting the slice-scope + live-wiring deferral — D1/D5).
