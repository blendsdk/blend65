# Sprite-Test Fixes — Implementation Plan

> **Feature**: Fix compiler bugs preventing sprite-test.blend (starfield simulation) from running correctly
> **Status**: Planning Complete
> **Created**: 2025-02-14

## Overview

The starfield simulation program (`examples/sprite-test/sprite-test.blend`) compiles and assembles without errors, but produces completely wrong output on the C64. Deep analysis of the generated assembly reveals **5 compiler bugs** across the IL generator, IL builder, and optimizer that combine to produce a broken program.

The screenshot shows a blue character-filled screen instead of the expected black background with animated star dots.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Bug descriptions and fix requirements |
| 02 | [Current State](02-current-state.md) | Root cause analysis with code references |
| 03 | [Constants Inline Fix](03-constants-inline.md) | Fix constants in value expressions |
| 04 | [Array Store Operations](04-array-store.md) | Add array element write support |
| 05 | [Barrier Intrinsic Fix](05-barrier-intrinsic.md) | Make barrier() produce optimizer-respected IL |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test cases for all fixes |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### Bugs Summary (v2 — after multi-level O0-O3 analysis)

All bugs are **CORE BUGS** present at O0 (no optimization). Optimizer issues are secondary effects.

| Bug | Component | Impact | Priority |
|-----|-----------|--------|----------|
| Array READ codegen ignores `indexedByY` | CodeGen (memory.ts) | ALL array reads broken — `LDA $08` instead of `LDA $08,Y` | 🔴 Critical |
| Constants not inlined in value expressions | IL Generator | SPACE_CHAR, STAR_CHAR, SCREEN_WIDTH loaded as garbage | 🔴 Critical |
| Array element assignment not implemented | IL Generator + Builder | starX[i], starY[i] never stored — no `storeIndexedY` | 🔴 Critical |
| barrier() generates no IL | IL Generator | Loop structure survives without it; future-proofing fix | 🟢 Low |
| byte×byte→word not promoted in multiply | IL Generator | Screen offset calculations overflow (partially caused by Bug 1) | 🟡 High |

## Related Files

### IL Generator
- `packages/compiler/src/il/generator/expressions.ts` — `generateIdentifier()`, `generateAssignment()`, `generateIntrinsic()`
- `packages/compiler/src/il/generator/generator.ts` — `generateGlobalVariable()`

### IL Builder
- `packages/compiler/src/il/builder/memory.ts` — Missing `storeIndexedY()`, `storeIndexedImm()`

### Optimizer
- `packages/compiler/src/optimizer/passes/loop-unroll/` — Loop unrolling
- `packages/compiler/src/optimizer/passes/copy-prop.ts` — Copy propagation
- `packages/compiler/src/optimizer/passes/function-inlining.ts` — Function inlining

### Test Program
- `examples/sprite-test/sprite-test.blend` — The starfield simulation
