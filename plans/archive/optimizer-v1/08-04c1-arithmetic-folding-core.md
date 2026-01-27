# Task 8.4c1: Constant Folding Patterns - Core

> **Task**: 8.4c1 of 16 (Peephole Phase)  
> **Time**: ~1 hour  
> **Tests**: ~15 tests  
> **Prerequisites**: Tasks 8.1-8.2, 8.4a-8.4b

---

## Overview

Implement core constant folding peephole patterns:
- Constant addition folding (LDA #k1, ADC #k2 → LDA #(k1+k2))
- Constant subtraction folding (LDA #k1, SBC #k2 → LDA #(k1-k2))
- Bitwise AND with #$FF elimination
- Bitwise OR with #$00 elimination
- Bitwise EOR with #$00 elimination

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                     # Pattern exports
└── constant-folding.ts          # THIS TASK
```

---

## 6502 Constant Operations Background

### Folding Opportunities

On the 6502, constant operations often appear when:
1. Immediate loads followed by arithmetic with another immediate
2. Mask operations where the mask has no effect
3. Compiler-generated code that could be pre-computed

### Constant Arithmetic
- **LDA #k1 + CLC + ADC #k2**: Can become LDA #(k1+k2) if result fits in byte
- **LDA #k1 + SEC + SBC #k2**: Can become LDA #(k1-k2) if result is valid

### Identity Masks
- **AND #$FF**: Identity - no bits are cleared
- **ORA #$00**: Identity - no bits are set  
- **EOR #$00**: Identity - no bits are flipped

---

## Implementation

### File: `constant-folding.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';

/**
 * Pattern: LDA #k1 followed by CLC + ADC #k2
 * 
 * Before:
 *   LDA #$10
 *   CLC
 *   ADC #$05
 * 
 * After:
 *   LDA #$15
 * 
 * Saves: 4 cycles, 3 bytes
 * 
 * Constraints:
 * - Result must fit in byte (0-255)
 * - Carry flag behavior changes (may affect subsequent code)
 */
export class ConstantAddFoldPattern extends BasePattern {
  readonly id = 'constant-add-fold';
  readonly description = 'Fold LDA #k1 + CLC + ADC #k2 into LDA #(k1+k2)';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 3;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 3) return null;
    
    const [lda, clc, adc] = instructions;
    
    // Check: LDA #immediate
    const k1 = this.getLoadImmediateValue(lda);
    if (k1 === null) return null;
    
    // Check: CLC
    if (!this.isClearCarry(clc)) return null;
    
    // Check: ADC #immediate
    const k2 = this.getAddImmediateValue(adc);
    if (k2 === null) return null;
    
    // Check: Result fits in byte
    const result = k1 + k2;
    if (result > 255) return null;
    
    return {
      matched: [lda, clc, adc],
      captures: this.capture([
        ['k1', k1],
        ['k2', k2],
        ['result', result],
      ]),
      confidence: 0.9, // Carry flag changes
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const result = match.captures.get('result') as number;
    
    const newLda = this.createInstruction(ILOpcode.LoadImm, {
      mnemonic: 'LDA',
      addressingMode: 'immediate',
      value: result,
    });
    
    return {
      instructions: [newLda],
      cyclesSaved: 4,  // CLC (2) + ADC (2)
      bytesSaved: 3,   // CLC (1) + ADC (2)
    };
  }
  
  /** Get immediate value from LDA instruction */
  protected getLoadImmediateValue(inst: ILInstruction): number | null {
    if (inst.opcode !== ILOpcode.LoadImm) return null;
    if (inst.metadata?.get('mnemonic') !== 'LDA') return null;
    if (inst.metadata?.get('addressingMode') !== 'immediate') return null;
    
    const value = inst.operands[0];
    if (typeof value === 'number') return value;
    if (this.isConstantValue(value)) {
      return this.getConstantNumericValue(value);
    }
    return null;
  }
  
  /** Get immediate value from ADC instruction */
  protected getAddImmediateValue(inst: ILInstruction): number | null {
    if (inst.opcode !== ILOpcode.BinaryOp) return null;
    if (inst.metadata?.get('mnemonic') !== 'ADC') return null;
    if (inst.metadata?.get('addressingMode') !== 'immediate') return null;
    
    const value = inst.operands[1];
    if (typeof value === 'number') return value;
    if (this.isConstantValue(value)) {
      return this.getConstantNumericValue(value);
    }
    return null;
  }
  
  protected isClearCarry(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic && 
           inst.metadata?.get('mnemonic') === 'CLC';
  }
}

/**
 * Pattern: LDA #k1 followed by SEC + SBC #k2
 * 
 * Before:
 *   LDA #$20
 *   SEC
 *   SBC #$05
 * 
 * After:
 *   LDA #$1B
 * 
 * Saves: 4 cycles, 3 bytes
 * 
 * Constraints:
 * - Result must be >= 0 (no underflow)
 * - Carry flag behavior changes
 */
export class ConstantSubtractFoldPattern extends BasePattern {
  readonly id = 'constant-subtract-fold';
  readonly description = 'Fold LDA #k1 + SEC + SBC #k2 into LDA #(k1-k2)';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 3;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 3) return null;
    
    const [lda, sec, sbc] = instructions;
    
    // Check: LDA #immediate
    const k1 = this.getLoadImmediateValue(lda);
    if (k1 === null) return null;
    
    // Check: SEC
    if (!this.isSetCarry(sec)) return null;
    
    // Check: SBC #immediate
    const k2 = this.getSubtractImmediateValue(sbc);
    if (k2 === null) return null;
    
    // Check: Result is non-negative
    const result = k1 - k2;
    if (result < 0) return null;
    
    return {
      matched: [lda, sec, sbc],
      captures: this.capture([
        ['k1', k1],
        ['k2', k2],
        ['result', result],
      ]),
      confidence: 0.9,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const result = match.captures.get('result') as number;
    
    const newLda = this.createInstruction(ILOpcode.LoadImm, {
      mnemonic: 'LDA',
      addressingMode: 'immediate',
      value: result,
    });
    
    return {
      instructions: [newLda],
      cyclesSaved: 4,
      bytesSaved: 3,
    };
  }
  
  protected getLoadImmediateValue(inst: ILInstruction): number | null {
    if (inst.opcode !== ILOpcode.LoadImm) return null;
    if (inst.metadata?.get('mnemonic') !== 'LDA') return null;
    if (inst.metadata?.get('addressingMode') !== 'immediate') return null;
    
    const value = inst.operands[0];
    if (typeof value === 'number') return value;
    if (this.isConstantValue(value)) {
      return this.getConstantNumericValue(value);
    }
    return null;
  }
  
  protected getSubtractImmediateValue(inst: ILInstruction): number | null {
    if (inst.opcode !== ILOpcode.BinaryOp) return null;
    if (inst.metadata?.get('mnemonic') !== 'SBC') return null;
    if (inst.metadata?.get('addressingMode') !== 'immediate') return null;
    
    const value = inst.operands[1];
    if (typeof value === 'number') return value;
    if (this.isConstantValue(value)) {
      return this.getConstantNumericValue(value);
    }
    return null;
  }
  
  protected isSetCarry(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic && 
           inst.metadata?.get('mnemonic') === 'SEC';
  }
}

/**
 * Pattern: AND #$FF (identity operation)
 * 
 * Before:
 *   AND #$FF
 * 
 * After:
 *   (removed)
 * 
 * Saves: 2 cycles, 2 bytes
 * 
 * Note: Flags are preserved since AND sets N/Z based on result
 */
export class AndFullMaskPattern extends BasePattern {
  readonly id = 'and-full-mask';
  readonly description = 'Remove AND #$FF (identity operation)';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const [and] = instructions;
    
    // Check: AND #$FF
    if (!this.isAndImmediate(and, 0xFF)) return null;
    
    return {
      matched: [and],
      captures: new Map(),
      confidence: 1.0,
    };
  }
  
  replace(_match: PatternMatch): PatternReplacement {
    return {
      instructions: [],
      cyclesSaved: 2,
      bytesSaved: 2,
    };
  }
  
  protected isAndImmediate(inst: ILInstruction, value: number): boolean {
    if (inst.opcode !== ILOpcode.BinaryOp) return false;
    if (inst.metadata?.get('mnemonic') !== 'AND') return false;
    if (inst.metadata?.get('addressingMode') !== 'immediate') return false;
    
    const operand = inst.operands[1];
    return this.isConstant(operand, value);
  }
}

/**
 * Pattern: ORA #$00 (identity operation)
 * 
 * Before:
 *   ORA #$00
 * 
 * After:
 *   (removed)
 * 
 * Saves: 2 cycles, 2 bytes
 */
export class OrZeroPattern extends BasePattern {
  readonly id = 'or-zero';
  readonly description = 'Remove ORA #$00 (identity operation)';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const [ora] = instructions;
    
    // Check: ORA #$00
    if (!this.isOrImmediate(ora, 0x00)) return null;
    
    return {
      matched: [ora],
      captures: new Map(),
      confidence: 1.0,
    };
  }
  
  replace(_match: PatternMatch): PatternReplacement {
    return {
      instructions: [],
      cyclesSaved: 2,
      bytesSaved: 2,
    };
  }
  
  protected isOrImmediate(inst: ILInstruction, value: number): boolean {
    if (inst.opcode !== ILOpcode.BinaryOp) return false;
    if (inst.metadata?.get('mnemonic') !== 'ORA') return false;
    if (inst.metadata?.get('addressingMode') !== 'immediate') return false;
    
    const operand = inst.operands[1];
    return this.isConstant(operand, value);
  }
}

/**
 * Pattern: EOR #$00 (identity operation)
 * 
 * Before:
 *   EOR #$00
 * 
 * After:
 *   (removed)
 * 
 * Saves: 2 cycles, 2 bytes
 */
export class EorZeroPattern extends BasePattern {
  readonly id = 'eor-zero';
  readonly description = 'Remove EOR #$00 (identity operation)';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const [eor] = instructions;
    
    // Check: EOR #$00
    if (!this.isEorImmediate(eor, 0x00)) return null;
    
    return {
      matched: [eor],
      captures: new Map(),
      confidence: 1.0,
    };
  }
  
  replace(_match: PatternMatch): PatternReplacement {
    return {
      instructions: [],
      cyclesSaved: 2,
      bytesSaved: 2,
    };
  }
  
  protected isEorImmediate(inst: ILInstruction, value: number): boolean {
    if (inst.opcode !== ILOpcode.BinaryOp) return false;
    if (inst.metadata?.get('mnemonic') !== 'EOR') return false;
    if (inst.metadata?.get('addressingMode') !== 'immediate') return false;
    
    const operand = inst.operands[1];
    return this.isConstant(operand, value);
  }
}

/**
 * Register core constant folding patterns
 */
export function registerConstantFoldingCorePatterns(registry: PatternRegistry): void {
  registry.register(new ConstantAddFoldPattern());
  registry.register(new ConstantSubtractFoldPattern());
  registry.register(new AndFullMaskPattern());
  registry.register(new OrZeroPattern());
  registry.register(new EorZeroPattern());
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `ConstantAddFold match` | Matches LDA #$10, CLC, ADC #$05 |
| `ConstantAddFold result` | Result is $15 |
| `ConstantAddFold overflow reject` | Rejects when result > 255 |
| `ConstantAddFold cycles/bytes` | Reports 4 cycles, 3 bytes saved |
| `ConstantSubtractFold match` | Matches LDA #$20, SEC, SBC #$05 |
| `ConstantSubtractFold result` | Result is $1B |
| `ConstantSubtractFold underflow reject` | Rejects when result < 0 |
| `AndFullMask match` | Matches AND #$FF |
| `AndFullMask no match $FE` | No match for AND #$FE |
| `AndFullMask replace` | Returns empty instruction list |
| `OrZero match` | Matches ORA #$00 |
| `OrZero no match $01` | No match for ORA #$01 |
| `EorZero match` | Matches EOR #$00 |
| `EorZero no match $01` | No match for EOR #$01 |
| `register all` | All 5 patterns registered |

---

## Optimization Levels

| Pattern | O1 | O2 | O3 |
|---------|----|----|-----|
| ConstantAddFoldPattern | ❌ | ✅ | ✅ |
| ConstantSubtractFoldPattern | ❌ | ✅ | ✅ |
| AndFullMaskPattern | ✅ | ✅ | ✅ |
| OrZeroPattern | ✅ | ✅ | ✅ |
| EorZeroPattern | ✅ | ✅ | ✅ |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `constant-folding.ts` | [ ] |
| Implement ConstantAddFoldPattern | [ ] |
| Implement ConstantSubtractFoldPattern | [ ] |
| Implement AndFullMaskPattern | [ ] |
| Implement OrZeroPattern | [ ] |
| Implement EorZeroPattern | [ ] |
| Add registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 8.4b → `08-04b-arithmetic-shift.md`  
**Next Task**: 8.4c2 → `08-04c2-arithmetic-folding-advanced.md`