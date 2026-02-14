# @data Const Array Label-Based Addressing Fix

> **Feature**: Fix `@data const` array addressing in code generation
> **Status**: Planning Complete
> **Created**: 2025-02-14

## Overview

`@data const` arrays produce incorrect 6502 code: the code generator emits `LDA $0000,Y` (zero page read) instead of referencing the actual data segment location. This causes garbled reads because the data lives after the code, not at address zero.

The root cause is that `@data` global slots are assigned relative offsets (starting at 0) that are never rebased to absolute addresses. The fix uses ACME assembler labels — each `@data` entry gets a label in the data section, and the code generator references that label instead of a numeric address. ACME resolves labels to correct absolute addresses at assembly time.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Bug description, scope, acceptance criteria |
| 02 | [Current State](02-current-state.md) | Analysis of current broken behavior |
| 03 | [Label-Based Addressing](03-label-based-addressing.md) | Technical specification for the fix |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, task checklist |

## Quick Reference

### The Bug (Before Fix)

```asm
; balloonData[Y]
  LDA $00,Y          ; ← WRONG: reads from zero page
```

### Expected (After Fix)

```asm
; balloonData[Y]
  LDA __data_BalloonSprite_balloonData,Y   ; ← CORRECT: ACME resolves label

; ... later in data section:
__data_BalloonSprite_balloonData:
  !byte $00, $3C, $00, ...
```

## Related Files

| File | Role |
|------|------|
| `packages/compiler/src/frame/types-global.ts` | GlobalSlot type — add `dataLabel` |
| `packages/compiler/src/frame/allocator/global-allocator.ts` | Generate label names |
| `packages/compiler/src/frame/types.ts` | FrameSlot — propagate `dataLabel` |
| `packages/compiler/src/codegen/generator/memory.ts` | Use label in LDA/STA |
| `packages/compiler/src/pipeline/codegen-phase.ts` | Emit labels in data section |
| `examples/balloon-sprite/main.blend` | Test example — revert to @data version |
