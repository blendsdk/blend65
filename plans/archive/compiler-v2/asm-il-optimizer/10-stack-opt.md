# Stack Optimization Pass: ASM-IL Optimizer

> **Document**: 10-stack-opt.md
> **Parent**: [Index](00-index.md)
> **Pass**: `StackOptPass`
> **Enabled**: O3, Os, Oz

## Overview

Eliminates redundant PHA/PLA pairs when the saved value is not needed.

## Patterns

### Pattern 1: PHA/PLA with Unused Value

```asm
; BEFORE
PHA                         ; Save A
INX                         ; Work that doesn't use A
INY
PLA                         ; Restore A
LDA #5                      ; A immediately overwritten!

; AFTER
INX                         ; No need to save/restore
INY
LDA #5
```

### Pattern 2: PHA/PLA Around Non-Modifying Code

```asm
; BEFORE
PHA                         ; Save A (paranoid)
STX $50                     ; Doesn't touch A
STY $51                     ; Doesn't touch A
PLA                         ; Restore A - UNNECESSARY

; AFTER
STX $50
STY $51
; PHA/PLA removed
```

### Pattern 3: Nested Redundant Saves

```asm
; BEFORE
PHA
PHA                         ; Double save - outer is dead if inner restored
; ...
PLA
PLA

; AFTER
PHA
; ...
PLA
```

## Implementation Summary

```typescript
export class StackOptPass implements AsmOptimizationPass {
  readonly name = 'stack-opt';
  readonly isTransform = true;

  run(module: AsmModule): AsmModule {
    // Find PHA/PLA pairs
    // Check if A is modified between them
    // Check if A is used after PLA
    // Remove pair if redundant
  }
}
```

## Analysis Required

Must track:
- Whether A is modified between PHA and PLA
- Whether A is used after PLA
- Stack depth for matching pairs

## Edge Cases

- **Nested PHA/PLA**: Must match correctly
- **JSR between**: Assume A modified (conservative)
- **Branch/Jump**: Cannot safely remove if control flow diverges

## Performance Impact

| Pattern | Cycles Saved | Bytes Saved |
|---------|--------------|-------------|
| PHA/PLA pair | 7 | 2 |

**Expected Impact**: 5-10% savings in function prologues/epilogues.