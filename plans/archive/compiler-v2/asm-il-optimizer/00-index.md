# ASM-IL Optimizer Implementation Plan

> **Feature**: God-Level ASM-IL Optimizer for Blend65 v2
> **Status**: Planning Complete
> **Created**: February 3, 2026

## Overview

The ASM-IL Optimizer is the **second stage** of a two-stage optimization pipeline for the Blend65 v2 compiler. It operates on ASM-IL (6502 assembly intermediate language) after code generation, applying 6502-specific peephole patterns and machine-level optimizations.

**Two-Stage Architecture:**
```
Source → ... → IL Generator
                    ↓
        ┌───────────────────┐
        │   IL OPTIMIZER    │  ← IMPLEMENTED (see il-optimizer/)
        │  - DCE            │
        │  - Constant Fold  │
        │  - Const Prop     │
        │  - Copy Prop      │
        │  - IL Peephole    │
        └───────────────────┘
                    ↓
             Code Generator
                    ↓
                 ASM-IL
                    ↓
        ┌───────────────────┐
        │ ASM-IL OPTIMIZER  │  ← THIS PLAN
        │  - Flag Patterns  │
        │  - Store-Load     │
        │  - Branch Opt     │
        │  - Transfer Opt   │
        │  - ZP Promotion   │
        │  - 6502 Strength  │
        │  - Stack Opt      │
        │  - Size Opt       │
        └───────────────────┘
                    ↓
               Emitter (ACME)
```

**Goal**: God-level 6502 assembly optimization that produces code competitive with hand-written assembly.

## Document Index

| #   | Document                                        | Description                              |
| --- | ----------------------------------------------- | ---------------------------------------- |
| 00  | [Index](00-index.md)                            | This document - overview and navigation  |
| 01  | [Requirements](01-requirements.md)              | God-level optimizer requirements         |
| 02  | [Current State](02-current-state.md)            | Analysis of existing asm-il/optimizer    |
| 03  | [Infrastructure](03-infrastructure.md)          | Pass manager integration, config         |
| 04  | [Flag Patterns](04-flag-patterns.md)            | CLC/SEC, zero-flag optimization          |
| 05  | [Store-Load](05-store-load.md)                  | STA/LDA elimination                      |
| 06  | [Branch Optimization](06-branch-opt.md)         | Branch chain collapse, direction opt     |
| 07  | [Transfer Patterns](07-transfer-patterns.md)    | TAX/TXA/TAY/TYA optimization             |
| 08  | [ZP Promotion](08-zp-promotion.md)              | Hot variable zero-page promotion         |
| 09  | [6502 Strength](09-6502-strength.md)            | 6502-specific strength reduction         |
| 10  | [Stack Optimization](10-stack-opt.md)           | PHA/PLA elimination                      |
| 11  | [Size Optimization](11-size-opt.md)             | -Os/-Oz size-focused passes              |
| 12  | [Testing Strategy](12-testing-strategy.md)      | Test cases and verification              |
| 99  | [Execution Plan](99-execution-plan.md)          | Phases, sessions, and task checklist     |

## Quick Reference

### Optimization Levels (ASM-IL Stage)

| Level | Passes Enabled | Description |
|-------|----------------|-------------|
| **-O0** | None | No optimization, debug builds |
| **-O1** | Flag, Store-Load | Basic patterns only |
| **-O2** | O1 + Branch, Transfer | Standard optimization |
| **-O3** | O2 + iterations | Aggressive, fixed-point |
| **-Os** | O2 + Size opt | Prefer size over speed |
| **-Oz** | O3 + aggressive size | Minimum size |

### Example Optimizations

**Store-Load Elimination (FIXES redundant code!):**
```asm
; BEFORE (common compiler output)
STA $50                     ; Store value
LDA $50                     ; Load same value - REDUNDANT!

; AFTER
STA $50                     ; A already has the value!
```

**Zero-Flag Optimization:**
```asm
; BEFORE
LDA counter
CMP #0                      ; REDUNDANT - LDA sets Z flag
BEQ done

; AFTER
LDA counter
BEQ done                    ; CMP removed
```

**Branch Chain Collapse:**
```asm
; BEFORE
JMP label1
...
label1: JMP label2

; AFTER
JMP label2                  ; Direct jump
```

**Zero-Page Promotion:**
```asm
; BEFORE (absolute addressing - 4 cycles, 3 bytes)
LDA $0400
STA $0400

; AFTER (ZP addressing - 3 cycles, 2 bytes)
LDA $50                     ; 1 byte, 1 cycle saved PER ACCESS!
STA $50
```

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Use existing optimizer | Yes - extend `asm-il/optimizer/` |
| Pass architecture | `AsmOptimizationPass` interface |
| Integration point | After CodeGen, before Emitter |
| ZP allocation | Hotness-based ranking |

## Performance Impact

| Optimization | Cycles Saved | Bytes Saved |
|--------------|--------------|-------------|
| Store-Load elimination | 3-4/pattern | 2-3/pattern |
| Zero-flag optimization | 2/pattern | 2/pattern |
| CLC/SEC removal | 2/pattern | 1/pattern |
| Branch collapse | 3+/pattern | 0-3/pattern |
| ZP promotion | 1/access | 1/access |
| 6502 strength reduction | 50-100/multiply | varies |
| Stack optimization | 7/pair | 2/pair |

## Related Files

**Existing Infrastructure (from compiler-v1):**
- `packages/compiler/src/asm-il/types.ts` - ASM-IL types
- `packages/compiler/src/asm-il/optimizer/types.ts` - Pass interface
- `packages/compiler/src/asm-il/optimizer/asm-optimizer.ts` - Pass manager

**New Files (to create for v2):**
- `packages/compiler-v2/src/asm-il/optimizer/` - Optimizer module
- `packages/compiler-v2/src/asm-il/optimizer/passes/` - Individual passes
- `packages/compiler-v2/src/__tests__/asm-il/optimizer/` - Tests

## Cross-References

- [Compiler v2 Plan](../00-index.md) - Parent plan
- [IL Optimizer Plan](../il-optimizer/00-index.md) - First stage optimizer
- [Optimizer Series](../../optimizer-series/OPTIMIZER-ROADMAP.md) - Concepts reference
- [Code Generator](../09-code-generator.md) - ASM-IL source
- [ASM Optimizer (original)](../10-asm-optimizer.md) - Original v2 outline