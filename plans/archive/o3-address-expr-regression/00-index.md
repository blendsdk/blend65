# O3 Address-Expr Folding Regression Fix

> **Feature**: Fix O3 regression from 385→449 B in spinning-line + general post-inlining cleanup improvements
> **Status**: Planning Complete
> **Created**: 2026-02-17

## Overview

After optimization-pass2, the O3 optimization level regressed from 385 B to 449 B on the spinning-line example. The root cause is a **dead STORE_WORD instruction** left behind by `loadStoreElimination` that breaks the `addressExprFolding` pattern match. The new `shrWordLoNarrowing` (added in optimization-pass2 Phase 3) then catches the `SHR_WORD+LO` pair as a less-optimal fallback, preventing `addressExprFolding` from ever matching on subsequent iterations.

This plan fixes the primary regression and also implements general improvements to `loadStoreElimination` for inline continuation labels, making the optimizer more robust against similar pattern-breaking interactions.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Root cause analysis and current IL behavior |
| 03 | [Address-Expr Store Gap](03-address-expr-store-gap.md) | Primary fix: new pattern variant |
| 04 | [Load-Store Inline Labels](04-load-store-inline-labels.md) | General improvement: STORE/LOAD across inline labels |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### The Regression

| Level | Before opt-pass2 | After opt-pass2 | Target |
|-------|-------------------|------------------|--------|
| O3 | 385 B | 449 B (+64 B) | 385 B |

### Root Cause (One-Line)

`loadStoreElimination` removes `LOAD_WORD` but keeps dead `STORE_WORD` → breaks `addressExprFolding` pattern → `shrWordLoNarrowing` catches SHR_WORD+LO first → `LOAD_ADDRESS_EXPR` never fires.

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Fix approach | Add "store-gap" pattern to addressExprFolding + extend loadStoreElimination for inline labels |
| Safety mechanism | Forward-scan to verify STORE_WORD target is dead before removing |
| Scope | Both targeted fix (Phase 1) AND general improvement (Phase 2) |

## Related Files

- `packages/compiler/src/optimizer/passes/il-peephole.ts` — Primary file modified
- `packages/compiler/src/__tests__/optimizer/` — Test files
