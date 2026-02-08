# 6502 Strength Reduction Pass: ASM-IL Optimizer

> **Document**: 09-6502-strength.md
> **Parent**: [Index](00-index.md)
> **Pass**: `Strength6502Pass`
> **Enabled**: O3

## Overview

Replaces expensive operations with cheaper 6502-specific sequences.

## Patterns

### Multiply by Powers of 2

```asm
; x * 2 - Use ASL
; BEFORE: JSR _mul2 (~80 cycles)
; AFTER:
ASL A                       ; 2 cycles

; x * 4
ASL A
ASL A                       ; 4 cycles total

; x * 8
ASL A
ASL A
ASL A                       ; 6 cycles total
```

### Divide by Powers of 2

```asm
; x / 2 - Use LSR
; BEFORE: JSR _div2 (~80 cycles)
; AFTER:
LSR A                       ; 2 cycles

; x / 4
LSR A
LSR A                       ; 4 cycles
```

### Modulo Powers of 2

```asm
; x % 2 (odd/even)
AND #$01                    ; 2 cycles

; x % 4
AND #$03                    ; 2 cycles

; x % 8
AND #$07                    ; 2 cycles

; x % 256 (byte)
; Already a byte - no operation needed!
```

### Multiply by Small Constants

```asm
; x * 3 = x * 2 + x
STA temp
ASL A                       ; x * 2
CLC
ADC temp                    ; + x = x * 3

; x * 5 = x * 4 + x
STA temp
ASL A
ASL A                       ; x * 4
CLC
ADC temp                    ; + x = x * 5

; x * 10 = x * 8 + x * 2
STA temp
ASL A                       ; x * 2
STA temp2
ASL A
ASL A                       ; x * 8 (from x * 2)
CLC
ADC temp2                   ; x * 8 + x * 2 = x * 10
```

## Implementation Summary

```typescript
export class Strength6502Pass implements AsmOptimizationPass {
  readonly name = '6502-strength';
  readonly isTransform = true;

  run(module: AsmModule): AsmModule {
    // Pattern match JSR _mulN / JSR _divN
    // Replace with shift sequences
  }
}
```

## Savings Table

| Operation | Before | After | Savings |
|-----------|--------|-------|---------|
| × 2 | ~80 cycles | 2 cycles | 78 cycles |
| × 4 | ~80 cycles | 4 cycles | 76 cycles |
| ÷ 2 | ~80 cycles | 2 cycles | 78 cycles |
| % 2 | ~60 cycles | 2 cycles | 58 cycles |
| × 3 | ~80 cycles | ~12 cycles | 68 cycles |

**Expected Impact**: Huge savings when multiplies/divides are present.