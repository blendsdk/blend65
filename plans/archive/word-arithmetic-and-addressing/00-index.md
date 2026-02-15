# Word Arithmetic & Indirect Addressing Implementation Plan

> **Feature**: Complete 16-bit (word) arithmetic, type-aware expression generation, and indirect addressing support
> **Status**: Planning Complete
> **Created**: 2026-02-11
> **Supersedes**: `plans/archive/dynamic-poke-addressing/` (archived)

## Overview

The Blend65 compiler currently treats all runtime expressions as 8-bit, despite the language specification defining `word` as a 16-bit type. The compiler can load/store 16-bit values but cannot perform 16-bit arithmetic at runtime. Additionally, it only generates direct 6502 addressing modes (absolute, absolute+X), missing the critical **indirect addressing** modes needed for computed memory access.

This plan adds:
1. **Word arithmetic IL opcodes + codegen** — 16-bit ADD, SUB, CMP, etc.
2. **Type-aware expression generation** — IL generator checks `TypeInfo` to choose byte/word ops
3. **Indirect addressing** — `STA ($FB),Y` / `LDA ($FB),Y` for runtime-computed addresses
4. **Dynamic address support for ALL intrinsics** — peek, poke, peekw, pokew
5. **Enhanced constant folding** — All arithmetic ops between constants
6. **Word function parameters and returns** — A:X pair convention

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of existing implementation |
| 03 | [Word Arithmetic Opcodes](03-word-arithmetic-opcodes.md) | New IL opcodes + codegen for 16-bit ops |
| 04 | [Type-Aware Expressions](04-type-aware-expressions.md) | Expression gen uses TypeInfo for byte/word |
| 05 | [Indirect Addressing](05-indirect-addressing.md) | ZP pointer setup + (ptr),Y codegen |
| 06 | [Intrinsic Dynamic Addressing](06-intrinsic-dynamic-addr.md) | 3-tier strategy for all 4 intrinsics |
| 07 | [Constant Folding](07-constant-folding.md) | Full arithmetic constant folder |
| 08 | [Word Functions](08-word-functions.md) | Word params and return values |
| 09 | [Testing Strategy](09-testing-strategy.md) | Comprehensive test plan |
| 99 | [Execution Plan](99-execution-plan.md) | Phased implementation checklist |

## Quick Reference

### The Root Problem

The 6502 has **two categories** of addressing:
- **Direct** (address known at compile time): `STA $D020`, `STA $0400,X` — compiler supports these ✅
- **Indirect** (address computed at runtime): `STA ($FB),Y`, `LDA ($FB),Y` — compiler missing these ❌

Without indirect addressing and 16-bit arithmetic, the compiler cannot handle:
```js
let addr: word = SCREEN + offset;   // ❌ 8-bit add, loses high byte
poke(SCREEN + i * 40 + col, char);  // ❌ Throws error for complex addresses
someFunc(SCREEN + offset);          // ❌ Word argument truncated to byte
```

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Word convention | Low byte in A, high byte in X (existing convention) |
| ZP scratch for pointers | $FB/$FC (already reserved by C64 platform) |
| Indirect mode | `(Indirect),Y` with Y=0 for simple pointer deref |
| Constant folding scope | All arithmetic/bitwise ops between constants |
| Intrinsic strategy | 3-tier: absolute → indexed → indirect |
| Type awareness | IL generator queries `expr.getTypeInfo()` from semantic analyzer |

### Affected Files

**IL Layer:**
- `packages/compiler/src/il/enums.ts` — New word arithmetic opcodes
- `packages/compiler/src/il/operands.ts` — Indirect address operand support
- `packages/compiler/src/il/factories.ts` — Factory for indirect operands
- `packages/compiler/src/il/builder/` — Builder methods for word ops
- `packages/compiler/src/il/generator/expressions.ts` — Type-aware expression gen

**Codegen Layer:**
- `packages/compiler/src/codegen/generator/arithmetic.ts` — 16-bit arithmetic codegen
- `packages/compiler/src/codegen/generator/intrinsics.ts` — Indirect addressing for peek/poke
- `packages/compiler/src/codegen/generator/base.ts` — getAddressMode for indirect
- `packages/compiler/src/codegen/generator/memory.ts` — Word load with promotion

**Tests:**
- `packages/compiler/src/__tests__/` — Comprehensive test coverage
