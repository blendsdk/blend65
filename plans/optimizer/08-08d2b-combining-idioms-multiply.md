# Task 8.8d.2b: Multiply and Compare Idiom Patterns

> **Task**: 8.8d.2b of 29 (Peephole Phase)  
> **Time**: ~1.5 hours  
> **Tests**: ~15 tests  
> **Prerequisites**: Tasks 8.1-8.2 (Pattern Framework + Matcher)

---

## Overview

Implement peephole patterns for multiplication and comparison idioms on the 6502. These patterns recognize common computational sequences and replace them with more efficient equivalents.

**Patterns in this document (Multiply/Compare Idioms):**
- Multiply by 2 using addition
- Multiply by power of 2 using shifts
- Signed comparison idioms
- Unsigned 16-bit comparison idioms

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                         # Pattern exports
└── combining-idioms-multiply.ts     # THIS TASK
```

---

## 6502 Instruction Background

### Shift Instructions
| Instruction | Bytes | Cycles | Flags | Notes |
|-------------|-------|--------|-------|-------|
| ASL A       | 1     | 2      | N,Z,C | Accumulator shift left |
| ASL zp      | 2     | 5      | N,Z,C | Zero page shift left |
| ASL abs     | 3     | 6      | N,Z,C | Absolute shift left |
| LSR A       | 1     | 2      | N,Z,C | Accumulator shift right |
| ROL A       | 1     | 2      | N,Z,C | Rotate left through carry |
| ROR A       | 1     | 2      | N,Z,C | Rotate right through carry |

### Arithmetic Instructions
| Instruction | Bytes | Cycles | Flags | Notes |
|-------------|-------|--------|-------|-------|
| ADC #imm    | 2     | 2      | N,V,Z,C | Add with carry immediate |
| ADC zp      | 2     | 3      | N,V,Z,C | Add with carry zero page |
| SBC #imm    | 2     | 2      | N,V,Z,C | Subtract with carry immediate |
| CMP #imm    | 2     | 2      | N,Z,C | Compare immediate |
| CMP zp      | 2     | 3      | N,Z,C | Compare zero page |

### Branch Instructions
| Instruction | Bytes | Cycles | Notes |
|-------------|-------|--------|-------|
| BCC rel     | 2     | 2/3    | Branch if carry clear |
| BCS rel     | 2     | 2/3    | Branch if carry set |
| BMI rel     | 2     | 2/3    | Branch if minus |
| BPL rel     | 2     | 2/3    | Branch if plus |
| BEQ rel     | 2     | 2/3    | Branch if equal |
| BNE rel     | 2     | 2/3    | Branch if not equal |
| BVC rel     | 2     | 2/3    | Branch if overflow clear |
| BVS rel     | 2     | 2/3    | Branch if overflow set |

---

## Implementation

### File: `combining-idioms-multiply.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';

/**
 * Pattern: Multiply by 2 using CLC/ADC self
 * 
 * Before:
 *   STA $temp     ; Save value
 *   CLC
 *   ADC $temp     ; A = A + A = A * 2
 * 
 * After:
 *   ASL A         ; A = A * 2 (single instruction)
 * 
 * Saves: 6 cycles, 4 bytes
 */
export class MultiplyBy2AdditionPattern extends BasePattern {
  readonly id = 'mul2-add-idiom';
  readonly description = 'Replace A+A with ASL A for multiply by 2';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 3;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 3) return null;
    
    const [sta, clc, adc] = instructions;
    
    // Check: STA $temp
    if (!this.isStoreAccumulator(sta)) return null;
    
    // Check: CLC
    if (!this.isClearCarry(clc)) return null;
    
    // Check: ADC $temp (same address as STA)
    if (!this.isAddCarryMemory(adc)) return null;
    if (!this.sameAddress(sta, adc)) return null;
    
    const tempAddr = this.getAddress(sta);
    const addrMode = sta.metadata?.get('addressingMode');
    
    return {
      matched: [sta, clc, adc],
      captures: this.capture([
        ['tempAddr', tempAddr],
        ['addressingMode', addrMode],
      ]),
      confidence: 0.95,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    // Replace with single ASL A
    const asl = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'ASL',
      addressingMode: 'accumulator',
    });
    
    return {
      instructions: [asl],
      cyclesSaved: 6,  // STA(3)+CLC(2)+ADC(3)=8 → ASL(2)=2, saves 6
      bytesSaved: 4,   // STA(2)+CLC(1)+ADC(2)=5 → ASL(1)=1, saves 4
    };
  }
  
  protected isStoreAccumulator(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'STA') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
  
  protected isClearCarry(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'CLC';
  }
  
  protected isAddCarryMemory(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'ADC') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
  
  protected sameAddress(a: ILInstruction, b: ILInstruction): boolean {
    return this.getAddress(a) === this.getAddress(b) &&
           a.metadata?.get('addressingMode') === b.metadata?.get('addressingMode');
  }
}

/**
 * Pattern: Multiply by 4 using repeated addition
 * 
 * Before:
 *   STA $temp
 *   CLC
 *   ADC $temp     ; A * 2
 *   CLC
 *   ADC A         ; A * 4 (if compiler generates this)
 * 
 * Or:
 *   STA $temp
 *   CLC
 *   ADC $temp     ; A * 2
 *   STA $temp
 *   CLC
 *   ADC $temp     ; A * 4
 * 
 * After:
 *   ASL A         ; A * 2
 *   ASL A         ; A * 4
 * 
 * Saves: ~10 cycles, ~7 bytes
 */
export class MultiplyBy4ShiftPattern extends BasePattern {
  readonly id = 'mul4-shift-idiom';
  readonly description = 'Replace multiply by 4 with double ASL';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 6;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 6) return null;
    
    const [sta1, clc1, adc1, sta2, clc2, adc2] = instructions;
    
    // First multiply by 2: STA/CLC/ADC
    if (!this.isStoreAccumulator(sta1)) return null;
    if (!this.isClearCarry(clc1)) return null;
    if (!this.isAddCarryMemory(adc1)) return null;
    if (!this.sameAddress(sta1, adc1)) return null;
    
    // Second multiply by 2: STA/CLC/ADC (same or different temp)
    if (!this.isStoreAccumulator(sta2)) return null;
    if (!this.isClearCarry(clc2)) return null;
    if (!this.isAddCarryMemory(adc2)) return null;
    if (!this.sameAddress(sta2, adc2)) return null;
    
    return {
      matched: [sta1, clc1, adc1, sta2, clc2, adc2],
      captures: new Map(),
      confidence: 0.90,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const asl1 = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'ASL',
      addressingMode: 'accumulator',
    });
    
    const asl2 = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'ASL',
      addressingMode: 'accumulator',
    });
    
    return {
      instructions: [asl1, asl2],
      cyclesSaved: 10, // (3+2+3)*2=16 → 2+2=4, saves 12 (conservative 10)
      bytesSaved: 7,   // (2+1+2)*2=10 → 1+1=2, saves 8 (conservative 7)
    };
  }
  
  protected isStoreAccumulator(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'STA') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
  
  protected isClearCarry(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'CLC';
  }
  
  protected isAddCarryMemory(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'ADC') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
  
  protected sameAddress(a: ILInstruction, b: ILInstruction): boolean {
    return this.getAddress(a) === this.getAddress(b) &&
           a.metadata?.get('addressingMode') === b.metadata?.get('addressingMode');
  }
}

/**
 * Pattern: Signed comparison using SEC/SBC/BVC/BMI sequence
 * 
 * For signed comparison A < B (8-bit signed):
 * 
 * Standard approach (suboptimal):
 *   SEC
 *   SBC $value    ; A - value
 *   BVC noOverflow
 *   EOR #$80      ; Invert sign if overflow
 * noOverflow:
 *   BMI isLess    ; Branch if A < value
 * 
 * When comparing against constant 0:
 *   LDA $value
 *   BMI negative  ; Just check N flag directly
 * 
 * This pattern detects comparison with zero and simplifies.
 * Saves: ~4 cycles, ~3 bytes
 */
export class SignedCompareZeroPattern extends BasePattern {
  readonly id = 'signed-cmp-zero-idiom';
  readonly description = 'Simplify signed comparison with zero';
  readonly category = PatternCategory.Comparison;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 4;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 4) return null;
    
    const [sec, sbc, bvc, bmi] = instructions;
    
    // Check: SEC
    if (!this.isSetCarry(sec)) return null;
    
    // Check: SBC #$00 (subtracting zero is pointless)
    if (!this.isSubCarryImmediate(sbc, 0x00)) return null;
    
    // Check: BVC (checking overflow for zero sub is unnecessary)
    if (!this.isBranchOverflowClear(bvc)) return null;
    
    // Check: BMI (final branch)
    if (!this.isBranchMinus(bmi)) return null;
    
    const targetLabel = bmi.metadata?.get('target');
    
    return {
      matched: [sec, sbc, bvc, bmi],
      captures: this.capture([
        ['targetLabel', targetLabel],
      ]),
      confidence: 0.90,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const targetLabel = match.captures.get('targetLabel') as string;
    
    // Just need the BMI, no need for SEC/SBC/BVC
    // The N flag is already set from previous operation
    const bmi = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'BMI',
      addressingMode: 'relative',
      target: targetLabel,
    });
    
    return {
      instructions: [bmi],
      cyclesSaved: 4,  // SEC(2)+SBC(2)+BVC(2-3)=6-7 → BMI(2-3), saves ~4
      bytesSaved: 3,   // SEC(1)+SBC(2)+BVC(2)=5 → BMI(2)=2, saves 3
    };
  }
  
  protected isSetCarry(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'SEC';
  }
  
  protected isSubCarryImmediate(inst: ILInstruction, value: number): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'SBC' &&
           inst.metadata?.get('addressingMode') === 'immediate' &&
           inst.metadata?.get('operand') === value;
  }
  
  protected isBranchOverflowClear(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'BVC';
  }
  
  protected isBranchMinus(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'BMI';
  }
}

/**
 * Pattern: Unsigned 16-bit comparison using CMP/SBC sequence
 * 
 * For A:B > X:Y (16-bit unsigned comparison):
 * 
 * Before (suboptimal):
 *   LDA $hi_a
 *   CMP $hi_b
 *   BNE compared    ; If hi bytes differ, we know the result
 *   LDA $lo_a
 *   CMP $lo_b
 * compared:
 *   BCS greaterEqual
 * 
 * Optimized approach when values in memory:
 *   LDA $lo_a
 *   CMP $lo_b
 *   LDA $hi_a
 *   SBC $hi_b       ; Borrow from low comparison
 *   BCS greaterEqual
 * 
 * This pattern detects the suboptimal sequence and transforms it.
 * Saves: ~2 cycles (removes BNE overhead on equal case)
 */
export class Unsigned16BitComparePattern extends BasePattern {
  readonly id = 'u16-cmp-idiom';
  readonly description = 'Optimize 16-bit unsigned comparison';
  readonly category = PatternCategory.Comparison;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 6;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 6) return null;
    
    const [ldaHi, cmpHi, bne, ldaLo, cmpLo, branch] = instructions;
    
    // Check: LDA $hi_a
    if (!this.isLoadAccumulator(ldaHi)) return null;
    
    // Check: CMP $hi_b
    if (!this.isCompareMemory(cmpHi)) return null;
    
    // Check: BNE (skip to result if hi differs)
    if (!this.isBranchNotEqual(bne)) return null;
    
    // Check: LDA $lo_a
    if (!this.isLoadAccumulator(ldaLo)) return null;
    
    // Check: CMP $lo_b
    if (!this.isCompareMemory(cmpLo)) return null;
    
    // Check: BCS/BCC (final comparison branch)
    if (!this.isCarryBranch(branch)) return null;
    
    const loA = this.getAddress(ldaLo);
    const loB = this.getAddress(cmpLo);
    const hiA = this.getAddress(ldaHi);
    const hiB = this.getAddress(cmpHi);
    const branchMnemonic = branch.metadata?.get('mnemonic');
    const targetLabel = branch.metadata?.get('target');
    
    return {
      matched: [ldaHi, cmpHi, bne, ldaLo, cmpLo, branch],
      captures: this.capture([
        ['loA', loA],
        ['loB', loB],
        ['hiA', hiA],
        ['hiB', hiB],
        ['branchMnemonic', branchMnemonic],
        ['targetLabel', targetLabel],
      ]),
      confidence: 0.85,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const loA = match.captures.get('loA') as string;
    const loB = match.captures.get('loB') as string;
    const hiA = match.captures.get('hiA') as string;
    const hiB = match.captures.get('hiB') as string;
    const branchMnemonic = match.captures.get('branchMnemonic') as string;
    const targetLabel = match.captures.get('targetLabel') as string;
    
    // Optimized: LDA lo_a / CMP lo_b / LDA hi_a / SBC hi_b / BCS/BCC
    const ldaLo = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'LDA',
      addressingMode: 'zeropage',
      address: loA,
    });
    
    const cmpLo = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'CMP',
      addressingMode: 'zeropage',
      address: loB,
    });
    
    const ldaHi = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'LDA',
      addressingMode: 'zeropage',
      address: hiA,
    });
    
    const sbcHi = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'SBC',
      addressingMode: 'zeropage',
      address: hiB,
    });
    
    const branch = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: branchMnemonic,
      addressingMode: 'relative',
      target: targetLabel,
    });
    
    return {
      instructions: [ldaLo, cmpLo, ldaHi, sbcHi, branch],
      cyclesSaved: 2,  // Removes BNE overhead, slightly better average
      bytesSaved: 1,   // BNE(2) removed, same other instructions
    };
  }
  
  protected isLoadAccumulator(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'LDA') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
  
  protected isCompareMemory(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    if (inst.metadata?.get('mnemonic') !== 'CMP') return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'zeropage' || mode === 'absolute';
  }
  
  protected isBranchNotEqual(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic &&
           inst.metadata?.get('mnemonic') === 'BNE';
  }
  
  protected isCarryBranch(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Intrinsic) return false;
    const mnemonic = inst.metadata?.get('mnemonic');
    return mnemonic === 'BCS' || mnemonic === 'BCC';
  }
}

/**
 * Register all multiply and compare idiom patterns
 */
export function registerMultiplyCompareIdiomPatterns(registry: PatternRegistry): void {
  // Multiply idioms
  registry.register(new MultiplyBy2AdditionPattern());
  registry.register(new MultiplyBy4ShiftPattern());
  
  // Comparison idioms
  registry.register(new SignedCompareZeroPattern());
  registry.register(new Unsigned16BitComparePattern());
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `Mul2Add match sta-clc-adc` | Matches STA/CLC/ADC self sequence |
| `Mul2Add no match diff addr` | No match if ADC uses different address |
| `Mul2Add replace` | Creates single ASL A instruction |
| `Mul2Add savings` | Reports 6 cycles, 4 bytes saved |
| `Mul4Shift match double` | Matches two STA/CLC/ADC sequences |
| `Mul4Shift no match partial` | No match for single multiply |
| `Mul4Shift replace` | Creates ASL A / ASL A sequence |
| `Mul4Shift savings` | Reports ~10 cycles, ~7 bytes saved |
| `SignedCmpZero match` | Matches SEC/SBC#0/BVC/BMI sequence |
| `SignedCmpZero no match` | No match if SBC not zero |
| `SignedCmpZero replace` | Simplifies to single BMI |
| `SignedCmpZero savings` | Reports 4 cycles, 3 bytes saved |
| `U16Cmp match` | Matches 16-bit compare sequence |
| `U16Cmp replace` | Creates optimized comparison |
| `register all` | All 4 patterns registered correctly |

---

## Integration Notes

### Pattern Registration

```typescript
import { patternRegistry } from './registry.js';
import { registerMultiplyCompareIdiomPatterns } from './patterns/combining-idioms-multiply.js';

registerMultiplyCompareIdiomPatterns(patternRegistry);
```

### Optimization Levels

| Pattern | O1 | O2 | O3 |
|---------|----|----|-----|
| MultiplyBy2AdditionPattern  | ✅ | ✅ | ✅ |
| MultiplyBy4ShiftPattern     | ❌ | ✅ | ✅ |
| SignedCompareZeroPattern    | ✅ | ✅ | ✅ |
| Unsigned16BitComparePattern | ❌ | ✅ | ✅ |

### Pattern Interaction Notes

1. **MultiplyBy2AdditionPattern** should run before other arithmetic patterns to catch the basic A+A case.

2. **MultiplyBy4ShiftPattern** depends on temporary variable usage patterns from the compiler's code generation.

3. **SignedCompareZeroPattern** specifically targets the degenerate case of comparing against zero, which is common in loop conditions.

4. **Unsigned16BitComparePattern** assumes variables are stored in adjacent memory locations (common for 16-bit values on 6502).

### Window Size Considerations

| Pattern | Window | Notes |
|---------|--------|-------|
| Mul2Add | 3 | STA/CLC/ADC sequence |
| Mul4Shift | 6 | Two STA/CLC/ADC sequences |
| SignedCmpZero | 4 | SEC/SBC/BVC/BMI sequence |
| U16Cmp | 6 | Full 16-bit compare sequence |

---

## Cycle and Byte Analysis

### Multiply by 2 Optimization

| Before | Cycles | Bytes |
|--------|--------|-------|
| STA zp | 3 | 2 |
| CLC | 2 | 1 |
| ADC zp | 3 | 2 |
| **Total** | **8** | **5** |

| After | Cycles | Bytes |
|-------|--------|-------|
| ASL A | 2 | 1 |
| **Total** | **2** | **1** |

**Savings: 6 cycles, 4 bytes**

### Multiply by 4 Optimization

| Before | Cycles | Bytes |
|--------|--------|-------|
| STA zp | 3 | 2 |
| CLC | 2 | 1 |
| ADC zp | 3 | 2 |
| STA zp | 3 | 2 |
| CLC | 2 | 1 |
| ADC zp | 3 | 2 |
| **Total** | **16** | **10** |

| After | Cycles | Bytes |
|-------|--------|-------|
| ASL A | 2 | 1 |
| ASL A | 2 | 1 |
| **Total** | **4** | **2** |

**Savings: 12 cycles, 8 bytes**

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `combining-idioms-multiply.ts` | [ ] |
| Implement MultiplyBy2AdditionPattern | [ ] |
| Implement MultiplyBy4ShiftPattern | [ ] |
| Implement SignedCompareZeroPattern | [ ] |
| Implement Unsigned16BitComparePattern | [ ] |
| Add registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 3.8d.2a → `08-08d2a-combining-idioms-swap.md`  
**Next Task**: 3.9a → `08-09a-redundant-core.md`