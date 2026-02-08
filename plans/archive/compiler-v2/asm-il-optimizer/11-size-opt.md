# Size Optimization Pass: ASM-IL Optimizer

> **Document**: 11-size-opt.md
> **Parent**: [Index](00-index.md)
> **Pass**: `SizeOptPass`
> **Enabled**: Os, Oz

## Overview

Optimizes for code size over speed. Critical for memory-constrained 6502 programs.

## Strategies

### Strategy 1: Short Branches When Possible

```asm
; Use relative branch instead of JMP when in range
; JMP = 3 bytes, BXX = 2 bytes

; If target within ±127 bytes:
BEQ target                  ; 2 bytes instead of JMP workaround
```

### Strategy 2: Prefer JSR Over Inline (Oz only)

```asm
; BEFORE (inline code appears multiple times)
LDA #$00
STA $D020
STA $D021
; ... same pattern elsewhere ...

; AFTER (factored to subroutine)
JSR clear_border           ; 3 bytes per call site
; vs ~6 bytes inline
```

### Strategy 3: Tail Call Optimization

```asm
; BEFORE
JSR some_function
RTS                         ; 4 bytes total

; AFTER
JMP some_function           ; 3 bytes (tail call)
```

### Strategy 4: Common Sequence Factoring (Oz)

Identify repeated instruction sequences and extract to subroutines.

## Os vs Oz

| Strategy | Os | Oz |
|----------|:--:|:--:|
| Short branches | ✅ | ✅ |
| Tail calls | ✅ | ✅ |
| JSR over inline | ❌ | ✅ |
| Sequence factoring | ❌ | ✅ |

## Implementation Summary

```typescript
export class SizeOptPass implements AsmOptimizationPass {
  readonly name = 'size-opt';
  readonly isTransform = true;

  constructor(protected readonly aggressive: boolean) {}

  run(module: AsmModule): AsmModule {
    let result = this.optimizeTailCalls(module);
    if (this.aggressive) {
      result = this.factorCommonSequences(result);
    }
    return result;
  }
}
```

## Performance Impact

| Strategy | Bytes Saved | Speed Impact |
|----------|-------------|--------------|
| Tail call | 1 per call | None |
| JSR over inline | Variable | Slower |
| Sequence factoring | Variable | Slower |

**Expected Impact**: 10-20% size reduction at Os, 20-30% at Oz.