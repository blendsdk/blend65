# Global Variable Pipeline Fix — Implementation Plan

> **Feature**: Fix critical code generation bugs in the global variable pipeline
> **Status**: Planning Complete
> **Created**: 2025-02-14

## Overview

The compiler's global variable pipeline has three critical bugs that cause any program with module-level variables to produce incorrect code:

1. **Constants not inlined in binary expressions** — `SCREEN_WIDTH * y` loads from memory instead of using immediate value
2. **Default global addresses overlap with function locals** — relative offsets starting from 0 collide with SFA-allocated ZP addresses
3. **No initialization code for mutable globals** — arrays/variables never get their initial values written to memory

These bugs were discovered when the sprite-test example compiled successfully but showed a black screen at runtime.

## Document Index

| #  | Document                                         | Description                                |
|----|--------------------------------------------------|--------------------------------------------|
| 00 | [Index](00-index.md)                             | This document — overview and navigation    |
| 01 | [Requirements](01-requirements.md)               | Feature requirements and scope             |
| 02 | [Current State](02-current-state.md)             | Analysis of current implementation         |
| 03 | [Constant Inlining](03-constant-inlining.md)     | Fix constant refs in binary expressions    |
| 04 | [Global ZP Allocation](04-global-zp-allocation.md) | Fix address overlap for default globals  |
| 07 | [Testing Strategy](07-testing-strategy.md)       | Test cases and verification                |
| 99 | [Execution Plan](99-execution-plan.md)           | Phases, sessions, and task checklist       |

## Quick Reference

### The Three Bugs (Sprite-Test Assembly Evidence)

```asm
; Bug 1: SCREEN_WIDTH (const = 40) loaded from memory instead of immediate
  LDA $06       ; ← Should be LDA #$28 (immediate 40)
  STA $FF       ; multiplier

; Bug 2: Function local 'x' at $08 overlaps global array starX[$08-$1B]
  STA $08       ; eraseStars local 'x' → corrupts starX[0]!

; Bug 3: No init code → $06 contains leftover value (20) instead of 40
```

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Constant handling | Inline at all expression sites (not just standalone identifiers) |
| Default global placement | Allocate through ZpPool (same as @zp) to prevent overlap |
| Const globals | Skip allocation entirely — they produce no runtime storage |

## Related Files

| File | Role |
|------|------|
| `packages/compiler/src/il/generator/expressions.ts` | Binary expression constant inlining |
| `packages/compiler/src/frame/allocator/global-allocator.ts` | Global variable allocation |
| `packages/compiler/src/il/generator/base.ts` | Variable resolution & global slot conversion |
| `packages/compiler/src/pipeline/frame-phase.ts` | Pipeline orchestration |
