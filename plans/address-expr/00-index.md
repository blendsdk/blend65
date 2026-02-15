# Assembly-Time Address Expressions Implementation Plan

> **Feature**: Assembly-time address expressions (`@variable / constant`, `@variable >> constant`)
> **Status**: Planning Complete
> **Created**: 2025-02-15

## Overview

When a Blend programmer writes `@variable / 64` or `@variable >> 6`, and the variable has a data label known at assembly time, the compiler should emit an **ACME assembler expression** like `LDA #(label / 64)` instead of generating runtime division code.

This fixes the balloon sprite bug where `hi(@balloonData) * 4` produces an incorrect sprite pointer because the formula drops the low-byte contribution. The correct approach is `@balloonData / 64`, which the assembler computes at assembly time with zero runtime cost.

## The Bug

The formula `hi(addr) * 4` only equals `addr / 64` when the low byte of the address is `$00` (256-byte aligned). For 64-byte aligned data that lands at addresses like `$0880`, the formula gives 32 instead of the correct 34, causing the VIC-II to read garbage instead of sprite data.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document - overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current implementation |
| 03 | [IL and Codegen Changes](03-il-codegen.md) | Technical specification for IL + codegen |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### User Code (Before → After)

**Before (broken):**
```js
let spritePtr: byte = hi(@balloonData) * 4;  // WRONG for non-page-aligned data
```

**After (correct):**
```js
let spritePtr: byte = @balloonData / 64;     // Assembler computes at assembly time
```

### Generated Assembly

```asm
; @balloonData / 64 → assembly-time expression (zero runtime cost)
LDA #(__data_BalloonSprite_balloonData / 64)
STA $07F8
```

### Key Decisions

| Decision | Outcome |
|----------|---------|
| New keyword/intrinsic? | NO — uses existing `/` and `>>` operators |
| Alignment change? | NO — keeps 64-byte alignment for @sprite |
| Supported operators | `/` (divide) and `>>` (right shift) on address-of |
| Scope | Any @data/@ram/@zp variable with a known label |
| Assembler lock-in | NONE — `label / N` is universal across all 6502 assemblers |

## Related Files

- `packages/compiler/src/il/enums.ts` — New IL opcode
- `packages/compiler/src/il/generator/expressions.ts` — Pattern detection
- `packages/compiler/src/il/builder/memory.ts` — Builder method
- `packages/compiler/src/codegen/asm-il/emitter.ts` — Assembly output
- `packages/compiler/src/codegen/code-generator.ts` — IL → ASM-IL translation
- `examples/balloon-sprite/main.blend` — Updated example
