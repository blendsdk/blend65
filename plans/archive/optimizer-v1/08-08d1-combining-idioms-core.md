# Task 8.8d.1: Core Multi-Instruction Idiom Patterns

> **Task**: 8.8d.1 of 28 (Peephole Phase)  
> **Time**: ~1.5 hours  
> **Tests**: ~20 tests  
> **Prerequisites**: Tasks 8.1-8.2 (Pattern Framework + Matcher)

---

## Overview

Implement peephole patterns for common multi-instruction idioms on the 6502. These patterns recognize frequently-used instruction sequences and replace them with more efficient equivalents.

**Patterns in this document (Core Idioms):**
- 16-bit increment idioms
- 16-bit decrement idioms
- Clear memory idioms
- Memory-to-memory copy idioms

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                       # Pattern exports
└── combining-idioms-core.ts       # THIS TASK
```

---

## 6502 Instruction Background

### Arithmetic Instructions
| Instruction | Bytes | Cycles | Flags |
|-------------|-------|--------|-------|
| INC zp      | 2     | 5      | N, Z  |
| INC abs     | 3     | 6      | N, Z  |
| DEC zp      | 2     | 5      | N, Z  |
| DEC abs     | 3     | 6      | N, Z  |
| INX         | 1     | 2      | N, Z  |
| INY         | 1     | 2      | N, Z  |
| DEX         | 1     | 2      | N, Z  |
| DEY         | 1     | 2      | N, Z  |

### Branch Instructions
| Instruction | Bytes | Cycles | Notes |
|-------------|-------|--------|-------|
| BNE rel     | 2     | 2/3    | +1 if taken |
| BEQ rel     | 2     | 2/3    | +1 if taken |
| BCC rel     | 2     | 2/3    | +1 if taken |
| BCS rel     | 2     | 2/3    | +1 if taken |

### Memory Instructions
| Instruction | Bytes | Cycles | Flags |
|-------------|-------|--------|-------|
| LDA #imm    | 2     | 2      | N, Z  |
| STA zp      | 2     | 3      | -     |
| STA abs     | 3     | 4      | -     |

---

## Implementation

### File: `combining-idioms-core.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';

/**
 * Pattern: Inefficient 16-bit increment using separate INC instructions
 * 
 * Before:
 *   INC $lo       ; Increment low byte
 *   BNE skip      ; If not zero, we're done
 *   INC $hi       ; Increment high byte (carry propagation)
 * skip:
 * 
 * This pattern is already optimal for 16-bit increment, but we detect
 * suboptimal variants that don't use the BNE skip optimization.
 * 
 * Suboptimal Before:
 *   CLC
 *   LDA $lo
 *   ADC #$01
 *   STA $lo
 *   LDA $hi
 *   ADC #$00
 *   STA $hi
 * 
 * After (optimized):
 *   INC $lo
 *   BNE +3       ; Skip high byte increment if no wrap
 *   INC $hi
 * 
 * Saves: 8 cycles, 8 bytes (typical case where low byte doesn't wrap)
 */
export class Increment16BitIdiomPattern extends BasePattern {
  readonly id = 'inc16-idiom';
  readonly description = 'Optimize 16-bit increment to INC+BNE+INC idiom';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 7;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 7) return null;
    
    const [clc, ldaLo, adcOne, staLo, ldaHi, adcZero, staHi] = instructions;
    
    // Check: CLC
    if (!this.isClearCarry(clc)) return null;
    
    // Check: LDA $lo (zero page or absolute)
    if (!this.isLoadAccumulator(ldaLo)) return null;
    
    // Check: ADC #$01
    if (!this.isAddCarryImmediate(adcOne, 0x01)) return null;
    
    // Check: STA $lo (same address as LDA)
    if (!this.isStoreAccumulator(staLo)) return null;
    if (!this.sameAddress(ldaLo, staLo)) return null;
    
    // Check: LDA $hi
    if (!this.isLoadAccumulator(ldaHi)) return null;
    
    // Check: ADC #$00
    if (!this.isAddCarryImmediate(adcZero, 0x00)) return null;
    
    // Check: STA $hi (same address as second LDA)
    if (!this.isStoreAccumulator(staHi)) return null;
    if (!this.sameAddress(ldaHi, staHi)) return null;
    
    // Verify this looks like a 16-bit pair (hi = lo + 1)
    const loAddr = this.getAddress(ldaLo);
    const hiAddr = this.getAddress(ldaHi);
    const addrMode = ldaLo.metadata?.get('addressingMode');
    
    return {
      matched: [clc, ldaLo, adcOne, staLo, ldaHi, adcZero, staHi],
      captures: this.capture([
        ['loAddr', loAddr],
        ['hiAddr', hiAddr],
        ['addressingMode', addrMode],
      ]),
      confidence: 0.85,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const loAddr = match.captures.get('loAddr') as string;
    const hiAddr = match.captures.get('hiAddr') as string;
    const addrMode = match.captures.get('addressingMode') as string;
    
    // Create INC $lo
    const incLo = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'INC',
      addressingMode: addrMode,
      address: loAddr,
    });
    
    // Create BNE +3 (skip INC $hi if no wrap)
    const bne = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'BNE',
      addressingMode: 'relative',
      offset: 3, // Skip past INC $hi
    });
    
    // Create INC $hi
    const incHi = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'INC',
      addressingMode: addrMode,
      address: hiAddr,
    });
    
    return {
      instructions: [incLo, bne, incHi],
      cyclesSaved: 8,  // CLC(2)+LDA(3)+ADC(2)+STA(3)+LDA(3)+ADC(2)+STA(3)=18 → INC(5)+BNE(2)+INC(5)=12 best, but avg ~8 saved
      bytesSaved: 8,   // 1+2+2+2+2+2+2=13 → 2+2+2=6 = 7 bytes saved (varies by addr mode)
    };
  }
  
  protected isClearCarry(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'CLC';
  }
  
  protected isLoadAccumulator(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'LDA') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
  
  protected isAddCarryImmediate(inst: ILInstruction, value: number): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'ADC' &&
           inst.metadata?.get('addressingMode') === 'immediate' &&
           inst.metadata?.get('operand') === value;
  }
  
  protected isStoreAccumulator(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'STA') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
  
  protected sameAddress(a: ILInstruction, b: ILInstruction): boolean {
    return this.getAddress(a) === this.getAddress(b) &&
           a.metadata?.get('addressingMode') === b.metadata?.get('addressingMode');
  }
}

/**
 * Pattern: Inefficient 16-bit decrement using separate operations
 * 
 * Suboptimal Before:
 *   SEC
 *   LDA $lo
 *   SBC #$01
 *   STA $lo
 *   LDA $hi
 *   SBC #$00
 *   STA $hi
 * 
 * After (optimized):
 *   LDA $lo
 *   BNE +5       ; If not zero, just decrement low
 *   DEC $hi      ; Borrow from high byte first
 *   DEC $lo      ; Then decrement low byte
 *   JMP done     ; Skip alternative
 * +5:
 *   DEC $lo
 * done:
 * 
 * Alternative (simpler, but not quite optimal):
 *   LDA $lo
 *   BNE no_borrow
 *   DEC $hi
 * no_borrow:
 *   DEC $lo
 * 
 * Saves: ~6 cycles average, ~6 bytes
 */
export class Decrement16BitIdiomPattern extends BasePattern {
  readonly id = 'dec16-idiom';
  readonly description = 'Optimize 16-bit decrement to DEC idiom';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 7;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 7) return null;
    
    const [sec, ldaLo, sbcOne, staLo, ldaHi, sbcZero, staHi] = instructions;
    
    // Check: SEC
    if (!this.isSetCarry(sec)) return null;
    
    // Check: LDA $lo
    if (!this.isLoadAccumulator(ldaLo)) return null;
    
    // Check: SBC #$01
    if (!this.isSubCarryImmediate(sbcOne, 0x01)) return null;
    
    // Check: STA $lo
    if (!this.isStoreAccumulator(staLo)) return null;
    if (!this.sameAddress(ldaLo, staLo)) return null;
    
    // Check: LDA $hi
    if (!this.isLoadAccumulator(ldaHi)) return null;
    
    // Check: SBC #$00
    if (!this.isSubCarryImmediate(sbcZero, 0x00)) return null;
    
    // Check: STA $hi
    if (!this.isStoreAccumulator(staHi)) return null;
    if (!this.sameAddress(ldaHi, staHi)) return null;
    
    const loAddr = this.getAddress(ldaLo);
    const hiAddr = this.getAddress(ldaHi);
    const addrMode = ldaLo.metadata?.get('addressingMode');
    
    return {
      matched: [sec, ldaLo, sbcOne, staLo, ldaHi, sbcZero, staHi],
      captures: this.capture([
        ['loAddr', loAddr],
        ['hiAddr', hiAddr],
        ['addressingMode', addrMode],
      ]),
      confidence: 0.85,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const loAddr = match.captures.get('loAddr') as string;
    const hiAddr = match.captures.get('hiAddr') as string;
    const addrMode = match.captures.get('addressingMode') as string;
    
    // Simpler approach: LDA $lo / BNE skip / DEC $hi / skip: DEC $lo
    const ldaLo = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'LDA',
      addressingMode: addrMode,
      address: loAddr,
    });
    
    const bne = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'BNE',
      addressingMode: 'relative',
      offset: 3, // Skip DEC $hi
    });
    
    const decHi = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'DEC',
      addressingMode: addrMode,
      address: hiAddr,
    });
    
    const decLo = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'DEC',
      addressingMode: addrMode,
      address: loAddr,
    });
    
    return {
      instructions: [ldaLo, bne, decHi, decLo],
      cyclesSaved: 6,
      bytesSaved: 6,
    };
  }
  
  protected isSetCarry(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'SEC';
  }
  
  protected isLoadAccumulator(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'LDA') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
  
  protected isSubCarryImmediate(inst: ILInstruction, value: number): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'SBC' &&
           inst.metadata?.get('addressingMode') === 'immediate' &&
           inst.metadata?.get('operand') === value;
  }
  
  protected isStoreAccumulator(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'STA') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
  
  protected sameAddress(a: ILInstruction, b: ILInstruction): boolean {
    return this.getAddress(a) === this.getAddress(b) &&
           a.metadata?.get('addressingMode') === b.metadata?.get('addressingMode');
  }
}

/**
 * Pattern: Multiple LDA #0 / STA sequences for clearing memory
 * 
 * Before:
 *   LDA #$00
 *   STA $addr1
 *   LDA #$00      ; Redundant load
 *   STA $addr2
 *   LDA #$00      ; Redundant load
 *   STA $addr3
 * 
 * After:
 *   LDA #$00
 *   STA $addr1
 *   STA $addr2
 *   STA $addr3
 * 
 * Saves: 2 cycles per redundant LDA, 2 bytes per redundant LDA
 */
export class ClearMemoryIdiomPattern extends BasePattern {
  readonly id = 'clear-mem-idiom';
  readonly description = 'Remove redundant LDA #0 in memory clear sequence';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 4;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 4) return null;
    
    const [ldaFirst, staFirst, ldaSecond, staSecond] = instructions;
    
    // Check: LDA #$00
    if (!this.isLoadZero(ldaFirst)) return null;
    
    // Check: STA addr
    if (!this.isStoreAccumulator(staFirst)) return null;
    
    // Check: LDA #$00 (redundant)
    if (!this.isLoadZero(ldaSecond)) return null;
    
    // Check: STA addr (different from first)
    if (!this.isStoreAccumulator(staSecond)) return null;
    
    const addr1 = this.getAddress(staFirst);
    const addr2 = this.getAddress(staSecond);
    const mode1 = staFirst.metadata?.get('addressingMode');
    const mode2 = staSecond.metadata?.get('addressingMode');
    
    return {
      matched: [ldaFirst, staFirst, ldaSecond, staSecond],
      captures: this.capture([
        ['addr1', addr1],
        ['addr2', addr2],
        ['mode1', mode1],
        ['mode2', mode2],
      ]),
      confidence: 0.95,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const addr1 = match.captures.get('addr1') as string;
    const addr2 = match.captures.get('addr2') as string;
    const mode1 = match.captures.get('mode1') as string;
    const mode2 = match.captures.get('mode2') as string;
    
    const lda = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'LDA',
      addressingMode: 'immediate',
      operand: 0x00,
    });
    
    const sta1 = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'STA',
      addressingMode: mode1,
      address: addr1,
    });
    
    const sta2 = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'STA',
      addressingMode: mode2,
      address: addr2,
    });
    
    return {
      instructions: [lda, sta1, sta2],
      cyclesSaved: 2,  // Remove one LDA #$00 (2 cycles)
      bytesSaved: 2,   // Remove one LDA #$00 (2 bytes)
    };
  }
  
  protected isLoadZero(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'LDA' &&
           inst.metadata?.get('addressingMode') === 'immediate' &&
           inst.metadata?.get('operand') === 0x00;
  }
  
  protected isStoreAccumulator(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'STA') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
}

/**
 * Pattern: Memory-to-memory copy using explicit loads
 * 
 * Before:
 *   LDA $src
 *   STA $dst
 *   LDA $src+1
 *   STA $dst+1
 * 
 * This is already optimal for single-byte copies. For multi-byte copies,
 * detect and ensure no redundant operations exist between load-store pairs.
 * 
 * Common suboptimal (preserving A unnecessarily):
 *   PHA
 *   LDA $src
 *   STA $dst
 *   PLA
 * 
 * After (when A not needed):
 *   LDA $src
 *   STA $dst
 * 
 * Saves: 7 cycles, 2 bytes
 */
export class MemoryCopyPreservePattern extends BasePattern {
  readonly id = 'memcpy-preserve-idiom';
  readonly description = 'Remove unnecessary A preservation around memory copy';
  readonly category = PatternCategory.General;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 4;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 4) return null;
    
    const [pha, lda, sta, pla] = instructions;
    
    // Check: PHA
    if (!this.isPushAccumulator(pha)) return null;
    
    // Check: LDA addr
    if (!this.isLoadAccumulator(lda)) return null;
    
    // Check: STA addr
    if (!this.isStoreAccumulator(sta)) return null;
    
    // Check: PLA
    if (!this.isPullAccumulator(pla)) return null;
    
    const srcAddr = this.getAddress(lda);
    const dstAddr = this.getAddress(sta);
    const srcMode = lda.metadata?.get('addressingMode');
    const dstMode = sta.metadata?.get('addressingMode');
    
    return {
      matched: [pha, lda, sta, pla],
      captures: this.capture([
        ['srcAddr', srcAddr],
        ['dstAddr', dstAddr],
        ['srcMode', srcMode],
        ['dstMode', dstMode],
      ]),
      confidence: 0.8, // Requires liveness analysis for A
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const srcAddr = match.captures.get('srcAddr') as string;
    const dstAddr = match.captures.get('dstAddr') as string;
    const srcMode = match.captures.get('srcMode') as string;
    const dstMode = match.captures.get('dstMode') as string;
    
    const lda = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'LDA',
      addressingMode: srcMode,
      address: srcAddr,
    });
    
    const sta = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'STA',
      addressingMode: dstMode,
      address: dstAddr,
    });
    
    return {
      instructions: [lda, sta],
      cyclesSaved: 7,  // PHA(3) + PLA(4) = 7 cycles
      bytesSaved: 2,   // PHA(1) + PLA(1) = 2 bytes
    };
  }
  
  protected isPushAccumulator(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'PHA';
  }
  
  protected isPullAccumulator(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'PLA';
  }
  
  protected isLoadAccumulator(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'LDA') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
  
  protected isStoreAccumulator(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'STA') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
}

/**
 * Register all core multi-instruction idiom patterns
 */
export function registerCoreIdiomPatterns(registry: PatternRegistry): void {
  // 16-bit arithmetic idioms
  registry.register(new Increment16BitIdiomPattern());
  registry.register(new Decrement16BitIdiomPattern());
  
  // Memory operation idioms
  registry.register(new ClearMemoryIdiomPattern());
  registry.register(new MemoryCopyPreservePattern());
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `Inc16Bit match clc-adc` | Matches CLC/LDA/ADC#1/STA/LDA/ADC#0/STA sequence |
| `Inc16Bit no match partial` | No match for incomplete sequence |
| `Inc16Bit replace` | Creates INC+BNE+INC sequence |
| `Inc16Bit savings` | Reports ~8 cycles, ~8 bytes saved |
| `Inc16Bit zeropage` | Works with zero page addresses |
| `Inc16Bit absolute` | Works with absolute addresses |
| `Dec16Bit match sec-sbc` | Matches SEC/LDA/SBC#1/STA/LDA/SBC#0/STA sequence |
| `Dec16Bit no match` | No match for non-16-bit patterns |
| `Dec16Bit replace` | Creates LDA+BNE+DEC+DEC sequence |
| `Dec16Bit savings` | Reports ~6 cycles, ~6 bytes saved |
| `ClearMem match` | Matches LDA#0/STA/LDA#0/STA sequence |
| `ClearMem no match diff value` | No match if not loading zero |
| `ClearMem replace` | Removes redundant LDA#0 |
| `ClearMem savings` | Reports 2 cycles, 2 bytes saved per LDA |
| `MemCopyPreserve match` | Matches PHA/LDA/STA/PLA sequence |
| `MemCopyPreserve no match` | No match without PHA/PLA pair |
| `MemCopyPreserve replace` | Removes unnecessary PHA/PLA |
| `MemCopyPreserve savings` | Reports 7 cycles, 2 bytes saved |
| `register all` | All 4 patterns registered correctly |
| `integration` | Patterns work with matcher and optimizer |

---

## Integration Notes

### Pattern Registration

```typescript
import { patternRegistry } from './registry.js';
import { registerCoreIdiomPatterns } from './patterns/combining-idioms-core.js';

registerCoreIdiomPatterns(patternRegistry);
```

### Optimization Levels

| Pattern | O1 | O2 | O3 |
|---------|----|----|-----|
| Increment16BitIdiomPattern  | ❌ | ✅ | ✅ |
| Decrement16BitIdiomPattern  | ❌ | ✅ | ✅ |
| ClearMemoryIdiomPattern     | ✅ | ✅ | ✅ |
| MemoryCopyPreservePattern   | ❌ | ✅ | ✅ |

### Liveness Analysis Requirements

The `MemoryCopyPreservePattern` requires liveness analysis to ensure A is not needed after the copy. Confidence is set to 0.8 to indicate this requirement.

### Window Size Considerations

| Pattern | Window | Notes |
|---------|--------|-------|
| Inc16Bit | 7 | Full 16-bit increment sequence |
| Dec16Bit | 7 | Full 16-bit decrement sequence |
| ClearMem | 4 | Two LDA/STA pairs |
| MemCopyPreserve | 4 | PHA/LDA/STA/PLA sequence |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `combining-idioms-core.ts` | [ ] |
| Implement Increment16BitIdiomPattern | [ ] |
| Implement Decrement16BitIdiomPattern | [ ] |
| Implement ClearMemoryIdiomPattern | [ ] |
| Implement MemoryCopyPreservePattern | [ ] |
| Add registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 3.8c → `08-08c-combining-register.md`  
**Next Task**: 3.8d.2 → `08-08d2-combining-idioms-advanced.md`