# IL Optimizer Implementation Plan

> **Feature**: God-Level IL Optimizer for Blend65 v2
> **Status**: Planning Complete
> **Created**: February 3, 2026

## Overview

The IL Optimizer is the **first stage** of a two-stage optimization pipeline for the Blend65 v2 compiler. It operates on the Intermediate Language (IL) before code generation, producing maximally optimized IL that then feeds into the Code Generator.

**Two-Stage Architecture:**
```
Source → ... → IL Generator
                    ↓
        ┌───────────────────┐
        │   IL OPTIMIZER    │  ← THIS PLAN
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
        │ ASM-IL OPTIMIZER  │  ← FUTURE PLAN
        │  - 6502 Peephole  │
        │  - Flag Opt       │
        │  - Branch Chain   │
        └───────────────────┘
                    ↓
               Emitter (ACME)
```

**Goal**: God-level IL optimization that maximizes the quality of IL before code generation, reducing the burden on the ASM-IL optimizer.

## Document Index

| #   | Document                                        | Description                             |
| --- | ----------------------------------------------- | --------------------------------------- |
| 00  | [Index](00-index.md)                            | This document - overview and navigation |
| 01  | [Requirements](01-requirements.md)              | God-level optimizer requirements        |
| 02  | [Current State](02-current-state.md)            | Analysis of existing il/analysis.ts     |
| 03  | [Infrastructure](03-infrastructure.md)          | Pass manager, options, pipeline         |
| 04  | [DCE](04-dce.md)                                | Dead Code Elimination                   |
| 05  | [Constant Folding](05-constant-fold.md)         | Constant folding pass                   |
| 06  | [Constant Propagation](06-constant-prop.md)     | Constant propagation pass               |
| 07  | [Copy Propagation](07-copy-prop.md)             | Copy propagation pass                   |
| 08  | [IL Peephole](08-il-peephole.md)                | IL-level peephole patterns              |
| 09  | [Testing Strategy](09-testing-strategy.md)      | Test cases and verification             |
| 99  | [Execution Plan](99-execution-plan.md)          | Phases, sessions, and task checklist    |

## Quick Reference

### Optimization Levels

| Level | IL Optimizer Behavior | Description |
|-------|----------------------|-------------|
| **-O0** | OFF | No optimization, debug builds |
| **-O1** | DCE + ConstFold | Basic optimization, fast compile |
| **-O2** | Full IL optimization | Standard release builds |
| **-O3** | Full + aggressive | Maximum performance |
| **-Os** | Full - size focus | Optimize for code size |
| **-Oz** | Aggressive size | Minimum size possible |

### Example Optimizations

**Dead Code Elimination:**
```typescript
// Before:
let x: byte = 5;  // x is never used
return 0;

// IL Before:
LOAD_IMM 5
STORE_BYTE x    ← DEAD (removed)
LOAD_IMM 0
RETURN

// IL After:
LOAD_IMM 0
RETURN
```

**Constant Folding:**
```typescript
// IL Before:
LOAD_IMM 5
ADD_IMM 3

// IL After:
LOAD_IMM 8
```

**Constant Propagation:**
```typescript
// Source:
let x: byte = 5;
let y: byte = x + 1;

// IL Before:
LOAD_IMM 5
STORE_BYTE x
LOAD_BYTE x    ← x is known to be 5
ADD_IMM 1

// IL After:
LOAD_IMM 5
STORE_BYTE x
LOAD_IMM 5     ← Propagated constant
ADD_IMM 1
// Then constant folding:
LOAD_IMM 6
```

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Use existing analysis | Yes - leverage `il/analysis.ts` |
| Pass architecture | Composable passes with dependencies |
| Integration point | After IL Generator, before CodeGen |
| Two-stage model | IL Optimizer + ASM-IL Optimizer |

## Related Files

**Existing Infrastructure (to leverage):**
- `packages/compiler-v2/src/il/analysis.ts` - Liveness, dead store detection
- `packages/compiler-v2/src/il/enums.ts` - IL opcodes
- `packages/compiler-v2/src/il/guards.ts` - Type guards
- `packages/compiler-v2/src/il/builder/` - IL construction

**New Files (to create):**
- `packages/compiler-v2/src/optimizer/` - Optimizer module
- `packages/compiler-v2/src/optimizer/passes/` - Individual passes
- `packages/compiler-v2/src/__tests__/optimizer/` - Tests

## Cross-References

- [Compiler v2 Plan](../00-index.md) - Parent plan
- [Optimizer Series](../../optimizer-series/OPTIMIZER-ROADMAP.md) - Concepts reference
- [IL Generator](../08-il-generator.md) - IL input source
- [Code Generator](../09-code-generator.md) - Output consumer