# Zero-Page Promotion Pass: ASM-IL Optimizer

> **Document**: 08-zp-promotion.md
> **Parent**: [Index](00-index.md)
> **Pass**: `ZPPromotionPass`
> **Enabled**: O3, Os, Oz

## Overview

Promotes frequently-accessed variables from absolute addressing to zero-page addressing for faster access.

**Benefits**: 1 cycle and 1 byte saved per access!

## Algorithm

1. **Analyze** - Count access frequency for each memory location
2. **Rank** - Score by `frequency × cycles_saved`
3. **Allocate** - Assign top-N to available ZP slots
4. **Transform** - Update all references

## Example

```asm
; BEFORE (absolute addressing)
LDA $0400                   ; 4 cycles, 3 bytes
STA $0400                   ; 4 cycles, 3 bytes
; Used 100 times = 800 cycles, 600 bytes

; AFTER (zero-page)
LDA $50                     ; 3 cycles, 2 bytes
STA $50                     ; 3 cycles, 2 bytes
; Used 100 times = 600 cycles, 400 bytes
; Savings: 200 cycles, 200 bytes!
```

## Implementation Summary

```typescript
export class ZPPromotionPass implements AsmOptimizationPass {
  readonly name = 'zp-promotion';
  readonly isTransform = true;

  constructor(protected readonly availableSlots: number[]) {}

  run(module: AsmModule): AsmModule {
    // 1. Count variable access frequencies
    const frequencies = this.countAccesses(module);
    
    // 2. Rank by hotness
    const ranked = this.rankByHotness(frequencies);
    
    // 3. Allocate ZP slots to hottest variables
    const allocations = this.allocate(ranked, this.availableSlots);
    
    // 4. Transform references
    return this.applyAllocations(module, allocations);
  }
}
```

## Hotness Calculation

```typescript
hotness = accessCount × cyclesSaved × (inLoop ? loopDepth * 10 : 1)
```

| Access Type | Cycles Saved |
|-------------|--------------|
| LDA absolute → LDA zp | 1 |
| STA absolute → STA zp | 1 |
| LDA abs,X → LDA zp,X | 0 (same cycles) |
| Indirect required | ∞ (only works with ZP!) |

## ZP Slot Management

**Default available slots**: `$50-$57` (8 bytes)

**C64 ZP map**:
- `$00-$01`: Reserved (CPU)
- `$02-$8F`: Generally available
- `$90-$FF`: BASIC/Kernal (safe if disabled)

## Edge Cases

- **Already ZP**: Don't re-promote
- **Labels**: Can't promote without address resolution
- **Aliasing**: Conservative with potential aliases

## Performance Impact

| Metric | Savings |
|--------|---------|
| Per access | 1 cycle, 1 byte |
| Typical loop var (100 accesses) | 100 cycles, 100 bytes |

**Expected Impact**: 5-15% overall improvement for hot code.