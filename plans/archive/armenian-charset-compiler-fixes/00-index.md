# Armenian Charset Compiler Fixes — Comprehensive Plan

> **Feature**: Fix 12 compiler backend issues discovered via armenian-charset diagnostic
> **Status**: Planning Complete
> **Created**: 2025-02-17
> **Priority**: ALL CRITICAL

## Overview

The armenian-charset example exposed **12 systemic compiler issues** spanning IL generation, codegen, optimization, and diagnostics. These were discovered through internal `diag_app` analysis and cross-referenced with external third-party ASM-level diagnostics.

The issues range from **correctness bugs** (wrong code emitted) to **quality improvements** (optimizer passes needed) to **tooling enhancements** (better diagnostic capabilities).

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | All 12 items A→L with requirements |
| 03 | [IL Generation Fixes](03-il-generation-fixes.md) | Items A, B, C — IL generator correctness |
| 04 | [Type Propagation](04-type-propagation.md) | Item D — Semantic type info propagation |
| 05 | [Codegen Improvements](05-codegen-improvements.md) | Items E, F — Word index + register preservation |
| 06 | [ASM-IL Optimizer](06-asm-il-optimizer.md) | Items G, H, I — Peephole/DCE/loop canonical |
| 07 | [Future Enhancements](07-future-enhancements.md) | Items J, K — Block copy + memory map |
| 08 | [Diagnose.md Update](08-diagnose-md-update.md) | Item L — Diagnostic analysis techniques |
| 09 | [Testing Strategy](09-testing-strategy.md) | Comprehensive test plan (~61 tests) |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, task checklist |

## Item Summary (A→L)

| Item | Category | Description | Fix Location | Priority |
|------|----------|-------------|-------------|----------|
| **A** | IL Fix | `inferWordWidthFromExpression()` doesn't recognize `@` address-of expressions as word-typed | `il/generator/expressions.ts` | CRITICAL |
| **B** | IL Fix | For-loop byte `to` syntax emits PHA + 2×PLA (stack corruption) | `il/generator/control-flow.ts` | CRITICAL |
| **C** | IL Fix | Constant-bound loops use dynamic-bound template (wasteful, causes Bug B) | `il/generator/control-flow.ts` | CRITICAL |
| **D** | Architecture | `getTypeInfo()` returns null — semantic analyzer doesn't propagate type info | `semantic/` + AST | CRITICAL |
| **E** | Codegen | Word index >256 truncated to byte for indexed addressing | `il/generator/expressions.ts` | CRITICAL |
| **F** | Codegen | Register X clobbered in `poke(dest+i, peek(src+i))` — no liveness tracking | `codegen/` | CRITICAL |
| **G** | Asm-IL Optimizer | Peephole: store-reload elimination, dead jumps, PHA/PLA pair removal | `optimizer/asm-il/` | CRITICAL |
| **H** | Asm-IL Optimizer | Loop canonicalization: delay loops → DEX/BNE canonical form | `optimizer/asm-il/` | CRITICAL |
| **I** | Asm-IL Optimizer | Constant folding at ASM level — runtime math on known constants | `optimizer/asm-il/` | CRITICAL |
| **J** | Future | Block copy pattern recognition (memcpy loops) | Research + codegen | CRITICAL |
| **K** | Future | Memory map awareness / ROM shadow detection at compile time | Compiler infrastructure | CRITICAL |
| **L** | Tooling | `diagnose.md` update: stack discipline, canonical lowering, regression tests | `.clinerules/diagnose.md` | CRITICAL |

## Key Decisions

| Decision | Outcome |
|----------|---------|
| Fix correctness bugs (A,B,C) BEFORE optimizer passes (G,H,I) | Yes — correct IL first, optimize second |
| All items CRITICAL priority | Yes — per user requirement |
| Type propagation (D) is architectural but HIGH impact | Fix after A,B,C but before optimizer work |
| Future items (J,K) need research phase | Plan includes research sessions |

## Related Files

### IL Generator
- `packages/compiler/src/il/generator/expressions.ts` — Items A, E
- `packages/compiler/src/il/generator/control-flow.ts` — Items B, C

### Codegen
- `packages/compiler/src/codegen/` — Item F

### Optimizer
- `packages/compiler/src/optimizer/` — Items G, H, I

### Semantic Analysis
- `packages/compiler/src/semantic/` — Item D

### Diagnostics
- `.clinerules/diagnose.md` — Item L
