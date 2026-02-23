# Word Comparison Codegen Fix — Implementation Plan

> **Feature**: Fix type-unaware word comparison in if/while conditions and dynamic for-loop bounds
> **Status**: Planning Complete
> **Created**: 2025-02-23
> **Bug Reference**: W1 (bug-list.md), plus newly discovered dynamic for-loop bug

## Overview

The IL generator's `generateConditionWithBranch()` method in `control-flow.ts` always emits byte-width comparison opcodes (`CMP_IMM`, `CMP_BYTE`) regardless of whether the operands are word-typed (16-bit). This causes two manifestations:

1. **Word vs literal in if/while** (Bug W1): Emits `CMP_IMM` with 16-bit value → ACME rejects `CMP #$0BB8` with "Number out of range"
2. **Word vs variable in if/while**: Emits `CMP_BYTE` → silently compares only low bytes (wrong results)

Additionally, `generateForConditionDynamic()` has the same type-unawareness for word-typed for-loop counters with runtime bounds — only saves/compares the low byte.

All downstream infrastructure already exists and works correctly:
- IL Builder: `cmpWordImm()`, `cmpWordSlot()` methods exist
- Codegen: `genCmpWordImm()` generates correct `CPX #>val / BNE .done / CMP #<val / .done:`
- Expression path: `generateBinaryWord()` already uses word comparison opcodes
- For-loop constant path: `generateForConditionConstant()` already uses `cmpWordImm`

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Bug requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current code and bug locations |
| 03 | [IL Generator Fix](03-il-generator-fix.md) | Technical spec for the control-flow.ts fix |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### Bug Triggers

```js
// Bug W1: ACME rejects — CMP #$0BB8 (16-bit immediate)
if (wresult == 3000) { ... }

// Silent bug: compares only low byte of wa and wb
if (wa > wb) { ... }

// Dynamic for-loop: only saves/compares low byte
for (let i: word = 0 to dynamicLimit) { ... }
```

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Fix scope | Both if/while conditions AND dynamic for-loop bounds |
| Fix approach | Add `isWordTyped()` checks, use existing `cmpWordImm`/`cmpWordSlot` |
| Session count | 1 session (small, surgical fix) |

## Related Files

| File | Role |
|------|------|
| `packages/compiler/src/il/generator/control-flow.ts` | **FIX TARGET** — contains both bugs |
| `packages/compiler/src/il/builder/control.ts` | Builder with `cmpWordImm`/`cmpWordSlot` (already correct) |
| `packages/compiler/src/codegen/generator/comparison.ts` | Codegen with `genCmpWordImm` (already correct) |
| `packages/compiler/src/__tests__/il/generator-word-comparisons.test.ts` | Existing tests (expression path only) |
| `examples/test-suite/02-word-arithmetic/main.blend` | VICE test blocked by W1 |
| `bug-list.md` | Bug catalog to update |
