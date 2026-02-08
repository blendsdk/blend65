# Transfer Patterns Pass: ASM-IL Optimizer

> **Document**: 07-transfer-patterns.md
> **Parent**: [Index](00-index.md)
> **Pass**: `TransferOptPass`
> **Enabled**: O2, O3, Os, Oz

## Overview

Optimizes register transfer sequences (TAX, TXA, TAY, TYA, TSX, TXS).

## Patterns

### Pattern 1: Redundant Reverse Transfer

```asm
; BEFORE
TAX                         ; Copy A to X
TXA                         ; Copy X to A - REDUNDANT (A unchanged)

; AFTER
TAX                         ; A still has original value
```

### Pattern 2: Transfer to Unused Register

```asm
; BEFORE
TAX                         ; Copy to X
; ... X never used before being overwritten
LDX #5                      ; X overwritten

; AFTER
; TAX removed
LDX #5
```

### Pattern 3: Transfer Chain

```asm
; BEFORE
TAX
TXA
TAY                         ; Could be TAY directly

; AFTER
TAX                         ; Keep for X
TAY                         ; A→Y directly
```

## Implementation Summary

```typescript
export class TransferOptPass implements AsmOptimizationPass {
  readonly name = 'transfer-opt';
  readonly isTransform = true;

  run(module: AsmModule): AsmModule {
    // 1. Remove redundant reverse transfers (TAX; TXA)
    // 2. Remove transfers to unused registers
    // 3. Simplify transfer chains
  }
}
```

## Key Rules

| Transfer | Reverse | Can Remove Reverse If... |
|----------|---------|-------------------------|
| TAX | TXA | A not modified between |
| TAY | TYA | A not modified between |
| TXA | TAX | X not modified between |
| TYA | TAY | Y not modified between |

## Performance Impact

| Pattern | Cycles Saved | Bytes Saved |
|---------|--------------|-------------|
| Reverse transfer | 2 | 1 |
| Unused transfer | 2 | 1 |

**Expected Impact**: 2-5% reduction in transfer instructions.