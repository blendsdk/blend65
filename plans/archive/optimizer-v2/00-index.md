# Optimizer V2 — Real Gaps Implementation Plan

> **Feature**: Complete the Blend65 optimizer by filling all identified gaps
> **Status**: Planning Complete
> **Created**: 2026-09-02
> **Supersedes**: `plans/archive/optimizer-series/` (obsolete — diverged from implementation)

## Overview

The Blend65 compiler already has a working **IL-level optimizer** (`packages/compiler/src/optimizer/`) and an **ASM-level optimizer** (`packages/compiler/src/codegen/asm-il/optimizer/`). Both were implemented pragmatically but left significant gaps — most critically, the optimizer only operates at the **function level** and cannot see relationships between functions.

This plan addresses **14 real gaps** identified by cross-referencing the old optimizer-series plan with actual implementation code. The gaps range from critical architectural issues (no program-level passes) to advanced optimizations (loop invariant code motion).

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current implementation |
| 03 | [Program-Level Infrastructure](03-program-level.md) | ProgramPass, call graph analysis |
| 04 | [Inter-Procedural Optimizations](04-inter-procedural.md) | Dead function elim, inlining |
| 05 | [IL-Level Improvements](05-il-improvements.md) | MUL/DIV fix, CSE |
| 06 | [Advanced Loop Optimizations](06-advanced-loops.md) | LICM, unrolling, register alloc |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### All 14 Gaps

| # | Gap | Phase | Priority |
|---|-----|-------|----------|
| 1 | Program-level pass infrastructure | 1 | CRITICAL |
| 2 | Call graph analysis | 1 | CRITICAL |
| 3 | Dead function elimination | 2 | HIGH |
| 4 | Dead global/constant elimination | 2 | MEDIUM |
| 5 | Single-call-site function inlining | 2 | HIGH |
| 6 | Small function inlining | 2 | HIGH |
| 7 | MUL/DIV strength reduction at IL level | 3 | MEDIUM |
| 8 | CSE (Common Subexpression Elimination) | 3 | MEDIUM |
| 9 | Loop analysis | 4 | HIGH |
| 10 | LICM (Loop Invariant Code Motion) | 4 | HIGH |
| 11 | Loop unrolling | 4 | MEDIUM |
| 12 | Register allocation improvements | 4 | MEDIUM |
| 13 | Compare+Branch simplification (ASM) | 3 | LOW |
| 14 | Indexed addressing optimization (ASM) | 3 | MEDIUM |

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Architecture for program passes | Extend existing `OptimizationPass` with `ProgramOptimizationPass` interface |
| Location of call graph | `optimizer/analysis/call-graph.ts` |
| Inlining strategy | Single-call-site at O1, small-function at O2 |
| Loop analysis approach | Build on existing `ILLoop` structures in `ILFunction` |

## Related Files

### IL-Level Optimizer (existing)
- `packages/compiler/src/optimizer/pass.ts` — Pass interface
- `packages/compiler/src/optimizer/pass-manager.ts` — Pass orchestration
- `packages/compiler/src/optimizer/il-optimizer.ts` — Program optimization entry
- `packages/compiler/src/optimizer/options.ts` — Level configuration
- `packages/compiler/src/optimizer/passes/` — 5 existing passes (dce, constant-fold, constant-prop, copy-prop, il-peephole)

### ASM-Level Optimizer (existing)
- `packages/compiler/src/codegen/asm-il/optimizer/` — Full ASM optimizer with 8 passes

### IL Analysis (existing)
- `packages/compiler/src/il/analysis.ts` — Liveness, dead store detection, hints
