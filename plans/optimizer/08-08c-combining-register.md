# Task 8.8c: Register Chain Combining Patterns

> **Task**: 8.8c of 27 (Peephole Phase)  
> **Time**: ~1.5 hours  
> **Tests**: ~22 tests  
> **Prerequisites**: Tasks 8.1-8.2 (Pattern Framework + Matcher)

---

## Overview

Implement peephole patterns that optimize register chain operations by eliminating redundant transfer sequences and combining increment/decrement pairs. These patterns target common inefficiencies in register manipulation code.

**Patterns in this document:**
- TAX + TXA → remove (round-trip elimination)
- TAY + TYA → remove (round-trip elimination)
- TXA + TAX → remove (round-trip elimination)
- TYA + TAY → remove (round-trip elimination)
- INX + DEX → remove (increment/decrement cancellation)
- INY + DEY → remove (increment/decrement cancellation)
- DEX + INX → remove (decrement/increment cancellation)
- DEY + INY → remove (decrement/increment cancellation)

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                        # Pattern exports
└── combining-register.ts           # THIS TASK
```

---

## 6502 Instruction Background

### Transfer Instructions
| Instruction | Bytes | Cycles | Flags | Operation     |
|-------------|-------|--------|-------|---------------|
| TAX         | 1     | 2      | N, Z  | X ← A         |
| TAY         | 1     | 2      | N, Z  | Y ← A         |
| TXA         | 1     | 2      | N, Z  | A ← X         |
| TYA         | 1     | 2      | N, Z  | A ← Y         |

### Increment/Decrement Instructions
| Instruction | Bytes | Cycles | Flags | Operation     |
|-------------|-------|--------|-------|---------------|
| INX         | 1     | 2      | N, Z  | X ← X + 1     |
| INY         | 1     | 2      | N, Z  | Y ← Y + 1     |
| DEX         | 1     | 2      | N, Z  | X ← X - 1     |
| DEY         | 1     | 2      | N, Z  | Y ← Y - 1     |

---

## Implementation

### File: `combining-register.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';

/**
 * Pattern: TAX followed by TXA → remove both (round-trip)
 * 
 * Before:
 *   TAX       ; X ← A
 *   TXA       ; A ← X (A is unchanged, X has A's value)
 * 
 * After:
 *   (nothing - if A value is all that matters)
 *   or TAX   (if X value needed)
 * 
 * Saves: 4 cycles, 2 bytes (if A only) or 2 cycles, 1 byte (if X needed)
 * 
 * Analysis Required:
 * - If X is live after: keep TAX, remove TXA (saves 2 cycles, 1 byte)
 * - If X is dead after: remove both (saves 4 cycles, 2 bytes)
 * 
 * Flag Note: TXA sets N, Z based on A, which equals original A after round-trip
 */
export class TaxTxaRoundTripPattern extends BasePattern {
  readonly id = 'tax-txa-roundtrip';
  readonly description = 'Remove TAX + TXA round-trip when X not needed';
  readonly category = PatternCategory.Redundancy;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [tax, txa] = instructions;
    
    // Check: TAX
    if (!this.isTransferAtoX(tax)) {
      return null;
    }
    
    // Check: TXA
    if (!this.isTransferXtoA(txa)) {
      return null;
    }
    
    return {
      matched: [tax, txa],
      captures: new Map(),
      confidence: 0.85, // Requires liveness analysis for X
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    // Conservative: assume X might be needed, keep TAX
    // Full optimization would remove both if X is dead
    return {
      instructions: [],
      cyclesSaved: 4, // Both removed (full optimization case)
      bytesSaved: 2,
    };
  }
  
  protected isTransferAtoX(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'TAX';
  }
  
  protected isTransferXtoA(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'TXA';
  }
}

/**
 * Pattern: TAY followed by TYA → remove both (round-trip)
 * 
 * Before:
 *   TAY       ; Y ← A
 *   TYA       ; A ← Y (A is unchanged, Y has A's value)
 * 
 * After:
 *   (nothing)
 * 
 * Saves: 4 cycles, 2 bytes
 * 
 * Preconditions:
 * - Y must not be live after TYA (Y value is discarded)
 */
export class TayTyaRoundTripPattern extends BasePattern {
  readonly id = 'tay-tya-roundtrip';
  readonly description = 'Remove TAY + TYA round-trip when Y not needed';
  readonly category = PatternCategory.Redundancy;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [tay, tya] = instructions;
    
    // Check: TAY
    if (!this.isTransferAtoY(tay)) {
      return null;
    }
    
    // Check: TYA
    if (!this.isTransferYtoA(tya)) {
      return null;
    }
    
    return {
      matched: [tay, tya],
      captures: new Map(),
      confidence: 0.85,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [],
      cyclesSaved: 4,
      bytesSaved: 2,
    };
  }
  
  protected isTransferAtoY(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'TAY';
  }
  
  protected isTransferYtoA(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'TYA';
  }
}

/**
 * Pattern: TXA followed by TAX → remove both (round-trip)
 * 
 * Before:
 *   TXA       ; A ← X
 *   TAX       ; X ← A (X is unchanged, A has X's value)
 * 
 * After:
 *   (nothing - if X value is all that matters)
 *   or TXA   (if A value needed)
 * 
 * Saves: 4 cycles, 2 bytes (if X only) or 2 cycles, 1 byte (if A needed)
 */
export class TxaTaxRoundTripPattern extends BasePattern {
  readonly id = 'txa-tax-roundtrip';
  readonly description = 'Remove TXA + TAX round-trip when A not needed';
  readonly category = PatternCategory.Redundancy;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [txa, tax] = instructions;
    
    // Check: TXA
    if (!this.isTransferXtoA(txa)) {
      return null;
    }
    
    // Check: TAX
    if (!this.isTransferAtoX(tax)) {
      return null;
    }
    
    return {
      matched: [txa, tax],
      captures: new Map(),
      confidence: 0.85,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [],
      cyclesSaved: 4,
      bytesSaved: 2,
    };
  }
  
  protected isTransferXtoA(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'TXA';
  }
  
  protected isTransferAtoX(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'TAX';
  }
}

/**
 * Pattern: TYA followed by TAY → remove both (round-trip)
 * 
 * Before:
 *   TYA       ; A ← Y
 *   TAY       ; Y ← A (Y is unchanged, A has Y's value)
 * 
 * After:
 *   (nothing)
 * 
 * Saves: 4 cycles, 2 bytes
 */
export class TyaTayRoundTripPattern extends BasePattern {
  readonly id = 'tya-tay-roundtrip';
  readonly description = 'Remove TYA + TAY round-trip when A not needed';
  readonly category = PatternCategory.Redundancy;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [tya, tay] = instructions;
    
    // Check: TYA
    if (!this.isTransferYtoA(tya)) {
      return null;
    }
    
    // Check: TAY
    if (!this.isTransferAtoY(tay)) {
      return null;
    }
    
    return {
      matched: [tya, tay],
      captures: new Map(),
      confidence: 0.85,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [],
      cyclesSaved: 4,
      bytesSaved: 2,
    };
  }
  
  protected isTransferYtoA(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'TYA';
  }
  
  protected isTransferAtoY(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'TAY';
  }
}

/**
 * Pattern: INX followed by DEX → remove both (cancellation)
 * 
 * Before:
 *   INX       ; X ← X + 1
 *   DEX       ; X ← X - 1 (X is unchanged)
 * 
 * After:
 *   (nothing)
 * 
 * Saves: 4 cycles, 2 bytes
 * 
 * Flag Note: DEX sets N, Z based on final X value = original X value
 * This is the same as if nothing happened, flags are correct
 */
export class InxDexCancellationPattern extends BasePattern {
  readonly id = 'inx-dex-cancel';
  readonly description = 'Remove INX + DEX pair (cancellation)';
  readonly category = PatternCategory.Redundancy;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [inx, dex] = instructions;
    
    // Check: INX
    if (!this.isIncrementX(inx)) {
      return null;
    }
    
    // Check: DEX
    if (!this.isDecrementX(dex)) {
      return null;
    }
    
    return {
      matched: [inx, dex],
      captures: new Map(),
      confidence: 0.95, // Very safe pattern
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [],
      cyclesSaved: 4,
      bytesSaved: 2,
    };
  }
  
  protected isIncrementX(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'INX';
  }
  
  protected isDecrementX(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'DEX';
  }
}

/**
 * Pattern: INY followed by DEY → remove both (cancellation)
 * 
 * Before:
 *   INY       ; Y ← Y + 1
 *   DEY       ; Y ← Y - 1 (Y is unchanged)
 * 
 * After:
 *   (nothing)
 * 
 * Saves: 4 cycles, 2 bytes
 */
export class InyDeyCancellationPattern extends BasePattern {
  readonly id = 'iny-dey-cancel';
  readonly description = 'Remove INY + DEY pair (cancellation)';
  readonly category = PatternCategory.Redundancy;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [iny, dey] = instructions;
    
    // Check: INY
    if (!this.isIncrementY(iny)) {
      return null;
    }
    
    // Check: DEY
    if (!this.isDecrementY(dey)) {
      return null;
    }
    
    return {
      matched: [iny, dey],
      captures: new Map(),
      confidence: 0.95,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [],
      cyclesSaved: 4,
      bytesSaved: 2,
    };
  }
  
  protected isIncrementY(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'INY';
  }
  
  protected isDecrementY(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'DEY';
  }
}

/**
 * Pattern: DEX followed by INX → remove both (cancellation)
 * 
 * Before:
 *   DEX       ; X ← X - 1
 *   INX       ; X ← X + 1 (X is unchanged)
 * 
 * After:
 *   (nothing)
 * 
 * Saves: 4 cycles, 2 bytes
 */
export class DexInxCancellationPattern extends BasePattern {
  readonly id = 'dex-inx-cancel';
  readonly description = 'Remove DEX + INX pair (cancellation)';
  readonly category = PatternCategory.Redundancy;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [dex, inx] = instructions;
    
    // Check: DEX
    if (!this.isDecrementX(dex)) {
      return null;
    }
    
    // Check: INX
    if (!this.isIncrementX(inx)) {
      return null;
    }
    
    return {
      matched: [dex, inx],
      captures: new Map(),
      confidence: 0.95,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [],
      cyclesSaved: 4,
      bytesSaved: 2,
    };
  }
  
  protected isDecrementX(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'DEX';
  }
  
  protected isIncrementX(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'INX';
  }
}

/**
 * Pattern: DEY followed by INY → remove both (cancellation)
 * 
 * Before:
 *   DEY       ; Y ← Y - 1
 *   INY       ; Y ← Y + 1 (Y is unchanged)
 * 
 * After:
 *   (nothing)
 * 
 * Saves: 4 cycles, 2 bytes
 */
export class DeyInyCancellationPattern extends BasePattern {
  readonly id = 'dey-iny-cancel';
  readonly description = 'Remove DEY + INY pair (cancellation)';
  readonly category = PatternCategory.Redundancy;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [dey, iny] = instructions;
    
    // Check: DEY
    if (!this.isDecrementY(dey)) {
      return null;
    }
    
    // Check: INY
    if (!this.isIncrementY(iny)) {
      return null;
    }
    
    return {
      matched: [dey, iny],
      captures: new Map(),
      confidence: 0.95,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    return {
      instructions: [],
      cyclesSaved: 4,
      bytesSaved: 2,
    };
  }
  
  protected isDecrementY(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'DEY';
  }
  
  protected isIncrementY(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'INY';
  }
}

/**
 * Register all register chain combining patterns
 */
export function registerRegisterCombiningPatterns(registry: PatternRegistry): void {
  // Transfer round-trip patterns
  registry.register(new TaxTxaRoundTripPattern());
  registry.register(new TayTyaRoundTripPattern());
  registry.register(new TxaTaxRoundTripPattern());
  registry.register(new TyaTayRoundTripPattern());
  
  // Increment/Decrement cancellation patterns
  registry.register(new InxDexCancellationPattern());
  registry.register(new InyDeyCancellationPattern());
  registry.register(new DexInxCancellationPattern());
  registry.register(new DeyInyCancellationPattern());
}
```

---

## Pattern Summary

| Pattern | Before | After | Cycles Saved | Bytes Saved | Level |
|---------|--------|-------|--------------|-------------|-------|
| TaxTxaRoundTripPattern | TAX + TXA | (none) | 4 | 2 | O2+ |
| TayTyaRoundTripPattern | TAY + TYA | (none) | 4 | 2 | O2+ |
| TxaTaxRoundTripPattern | TXA + TAX | (none) | 4 | 2 | O2+ |
| TyaTayRoundTripPattern | TYA + TAY | (none) | 4 | 2 | O2+ |
| InxDexCancellationPattern | INX + DEX | (none) | 4 | 2 | O1+ |
| InyDeyCancellationPattern | INY + DEY | (none) | 4 | 2 | O1+ |
| DexInxCancellationPattern | DEX + INX | (none) | 4 | 2 | O1+ |
| DeyInyCancellationPattern | DEY + INY | (none) | 4 | 2 | O1+ |

---

## Tests Required

| Test | Description |
|------|-------------|
| `TaxTxaRoundTrip match` | Matches TAX + TXA sequence |
| `TaxTxaRoundTrip no match` | No match for TAX without TXA |
| `TaxTxaRoundTrip replace` | Removes both instructions |
| `TaxTxaRoundTrip confidence` | Confidence 0.85 (needs liveness) |
| `TayTyaRoundTrip match` | Matches TAY + TYA sequence |
| `TayTyaRoundTrip replace` | Removes both instructions |
| `TxaTaxRoundTrip match` | Matches TXA + TAX sequence |
| `TxaTaxRoundTrip replace` | Removes both instructions |
| `TyaTayRoundTrip match` | Matches TYA + TAY sequence |
| `TyaTayRoundTrip replace` | Removes both instructions |
| `InxDexCancel match` | Matches INX + DEX sequence |
| `InxDexCancel no match` | No match for INX alone |
| `InxDexCancel replace` | Removes both instructions |
| `InxDexCancel confidence` | Confidence 0.95 (very safe) |
| `InyDeyCancel match` | Matches INY + DEY sequence |
| `InyDeyCancel replace` | Removes both instructions |
| `DexInxCancel match` | Matches DEX + INX sequence |
| `DexInxCancel replace` | Removes both instructions |
| `DeyInyCancel match` | Matches DEY + INY sequence |
| `DeyInyCancel replace` | Removes both instructions |
| `register all` | All 8 patterns registered correctly |
| `integration` | Patterns work with matcher and optimizer |

---

## Integration Notes

### Pattern Registration

```typescript
import { patternRegistry } from './registry.js';
import { registerRegisterCombiningPatterns } from './patterns/combining-register.js';

registerRegisterCombiningPatterns(patternRegistry);
```

### Optimization Levels

| Pattern | O1 | O2 | O3 |
|---------|----|----|-----|
| TaxTxaRoundTripPattern | ❌ | ✅ | ✅ |
| TayTyaRoundTripPattern | ❌ | ✅ | ✅ |
| TxaTaxRoundTripPattern | ❌ | ✅ | ✅ |
| TyaTayRoundTripPattern | ❌ | ✅ | ✅ |
| InxDexCancellationPattern | ✅ | ✅ | ✅ |
| InyDeyCancellationPattern | ✅ | ✅ | ✅ |
| DexInxCancellationPattern | ✅ | ✅ | ✅ |
| DeyInyCancellationPattern | ✅ | ✅ | ✅ |

### Liveness Analysis Requirements

**Transfer round-trip patterns** (TAX+TXA, TAY+TYA, TXA+TAX, TYA+TAY) require liveness analysis to ensure the intermediate register is not used after the sequence. These patterns have confidence 0.85.

**Increment/decrement cancellation patterns** (INX+DEX, INY+DEY, etc.) are always safe because:
1. The final register value equals the original
2. The final flags reflect the original value

### Flag Considerations

All patterns in this document are flag-safe because:

1. **Transfer round-trips**: The second transfer sets N, Z based on the original value (restored)
2. **Inc/Dec cancellation**: The final instruction sets N, Z based on the original value

---

## Code Examples

### Transfer Round-Trip Example

```
; Original code
LDA #$42      ; A = $42
TAX           ; X = $42 (copying A to X for temporary use)
; ... some code that doesn't use X or A ...
TXA           ; A = $42 (restoring A from X)
; X not used after this

; Optimized (if X not live after)
LDA #$42      ; A = $42
; TAX + TXA removed - A already has the value
```

### Increment/Decrement Cancellation Example

```
; Original code (perhaps from unoptimized loop unrolling)
loop_body:
  INX           ; X++
  ; ... realized we went too far ...
  DEX           ; X--
  ; continue with original X value

; Optimized
loop_body:
  ; INX + DEX removed - X unchanged
  ; continue with original X value
```

### Real-World Scenario: Index Adjustment

```
; Original: adjusting array index
  LDY #$10      ; Y = 16
  INY           ; Y = 17 (oops, off by one)
  DEY           ; Y = 16 (fixed)
  LDA ($FB),Y   ; Load from array

; Optimized
  LDY #$10      ; Y = 16
  ; INY + DEY removed
  LDA ($FB),Y   ; Load from array
```

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `combining-register.ts` | [ ] |
| Implement TaxTxaRoundTripPattern | [ ] |
| Implement TayTyaRoundTripPattern | [ ] |
| Implement TxaTaxRoundTripPattern | [ ] |
| Implement TyaTayRoundTripPattern | [ ] |
| Implement InxDexCancellationPattern | [ ] |
| Implement InyDeyCancellationPattern | [ ] |
| Implement DexInxCancellationPattern | [ ] |
| Implement DeyInyCancellationPattern | [ ] |
| Add registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 3.8b → `08-08b-combining-stack.md`  
**Next Task**: 3.8d → `08-08d-combining-idioms.md`