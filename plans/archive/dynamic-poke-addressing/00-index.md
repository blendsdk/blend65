# Dynamic Poke/Peek Addressing Implementation Plan

> **Feature**: Fix poke/peek with compound constant expressions and 16-bit dynamic offsets
> **Status**: Planning Complete
> **Created**: 2026-02-11

## Overview

The Blend65 compiler's `poke()` and `peek()` intrinsics currently fail when the address expression contains compound constant sub-expressions (e.g., `poke(SCREEN_BASE + 250 + i, value)`). The IL generator's `tryResolveConstantAddress()` method only handles numeric literals and constant identifiers — it cannot evaluate binary expressions between constants like `SCREEN_BASE + 250`.

Additionally, when the offset variable is a `word` type (16-bit), the current indexed addressing pattern (`TAX` + `STA base,X`) silently produces incorrect code because the 6502's X register is only 8 bits.

This plan addresses both issues:
1. **Constant folding** — Extend `tryResolveConstantAddress()` to recursively evaluate constant binary expressions
2. **16-bit indirect addressing** — Add `STA ($ptr),Y` support for poke/peek with word-sized offsets

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document - overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current implementation |
| 03 | [Constant Folding](03-constant-folding.md) | Fix for compound constant address expressions |
| 04 | [Word Offset Addressing](04-word-offset-addressing.md) | 16-bit indirect addressing support |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### Failing Code Examples

```js
// Issue 1: Compound constant expressions — FAILS at compile time
poke(SCREEN_BASE + 250 + i, SPACE_CHAR);   // (CONST + 250) can't be folded
poke(SCREEN_BASE + 500 + i, SPACE_CHAR);   // Same issue

// Issue 2: Word-sized offsets — Would produce INCORRECT code
let offset: word = y * SCREEN_WIDTH + x;    // 0-999, exceeds 8-bit X
poke(SCREEN_BASE + offset, STAR_CHAR);      // TAX loses high byte
```

### Expected Working Behavior

```js
// Issue 1 fix: Constant folding resolves SCREEN_BASE + 250 → $04FA
poke(SCREEN_BASE + 250 + i, SPACE_CHAR);   // STA $04FA,X ✅

// Issue 2 fix: Indirect addressing for word offsets
let offset: word = y * SCREEN_WIDTH + x;
poke(SCREEN_BASE + offset, STAR_CHAR);      // STA ($ptr),Y ✅
```

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Constant folding operators | Support `+` and `-` (most common in address math) |
| 16-bit addressing strategy | Use 6502 indirect indexed `STA ($ptr),Y` mode |
| ZP pointer location | Use compiler-reserved ZP temp locations ($FB/$FC) |
| Affected intrinsics | peek, poke, volatile_read, volatile_write |

## Related Files

| File | Purpose |
|------|---------|
| `packages/compiler/src/il/generator/expressions.ts` | IL generator — poke/peek intrinsic handling |
| `packages/compiler/src/il/operands.ts` | IL operand types (AddressOperand) |
| `packages/compiler/src/il/factories.ts` | IL operand factory functions |
| `packages/compiler/src/il/enums.ts` | IL opcodes |
| `packages/compiler/src/codegen/generator/intrinsics.ts` | Codegen — POKE/PEEK assembly generation |
| `packages/compiler/src/codegen/generator/base.ts` | Codegen base — getAddressMode |
| `packages/compiler/src/codegen/asm-il/builder.ts` | ASM IL builder — STA with indirectY |
| `examples/sprite-test/sprite-test.blend` | Trigger file — starfield simulation |
