# Address-Of Operator (`@`) Fix — Implementation Plan

> **Feature**: Fix `@` address-of operator not generating `LOAD_ADDRESS` IL opcode
> **Status**: Planning Complete
> **Created**: 2025-02-15
> **Priority**: CRITICAL — Balloon sprite example produces garbled output

## Overview

The `@` (address-of) operator was implemented in commit `e93d63f` across the IL generator and codegen layers. However, when compiling the balloon-sprite example (`hi(@balloonData) * 4`), the generated assembly shows a `LOAD_BYTE` (loads the byte VALUE from memory) instead of `LOAD_ADDRESS` (loads the 16-bit ADDRESS into A:X).

This causes the sprite pointer calculation to use garbage data, resulting in a garbled/scattered sprite in the emulator.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Fix requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current broken behavior |
| 03 | [Diagnosis](03-diagnosis.md) | IL dump diagnosis + root cause identification |
| 04 | [Optimizer Awareness](04-optimizer-awareness.md) | Adding LOAD_ADDRESS to optimizer passes |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### The Bug

```js
// Blend source:
let spritePtr: byte = hi(@balloonData) * 4;
```

**Expected assembly:**
```asm
LDA #<__data_BalloonSprite_balloonData  ; low byte of address
LDX #>__data_BalloonSprite_balloonData  ; high byte of address
TXA                                      ; hi() extracts high byte
```

**Actual assembly (BROKEN):**
```asm
LDA __data_BalloonSprite_balloonData    ; loads VALUE ($00) from memory!
TXA                                      ; X was never set — garbage!
```

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Parser correct? | Yes — creates UnaryExpression(AT, Identifier) correctly |
| Lexer correct? | Yes — produces AT + IDENTIFIER tokens correctly |
| Codegen correct? | Yes — genLoadAddress() produces correct LDA #< / LDX #> |
| Optimizer aware of LOAD_ADDRESS? | **NO** — zero references across all passes |
| Treat LOAD_ADDRESS like LOAD_IMM_WORD? | Yes — effectively an immediate word load |

## Related Files

| File | Role |
|------|------|
| `packages/compiler/src/il/generator/expressions.ts` | `generateAddressOf()` method |
| `packages/compiler/src/il/generator/base.ts` | `tryResolveVariable()` method |
| `packages/compiler/src/il/builder/memory.ts` | `loadAddress()` builder method |
| `packages/compiler/src/il/enums.ts` | `LOAD_ADDRESS` opcode enum |
| `packages/compiler/src/codegen/generator/memory.ts` | `genLoadAddress()` codegen |
| `packages/compiler/src/optimizer/passes/*.ts` | All optimizer passes (need LOAD_ADDRESS) |
| `examples/balloon-sprite/main.blend` | Test case — balloon sprite |
