# Task 8.4a: Arithmetic Identity & Increment Patterns

> **Task**: 8.4a of 16 (Peephole Phase)  
> **Time**: ~1.5 hours  
> **Tests**: ~20 tests  
> **Prerequisites**: Tasks 8.1-8.2 (Pattern Framework + Matcher)

---

## Overview

Implement arithmetic identity and increment/decrement peephole patterns:
- Add zero elimination (CLC + ADC #0)
- Subtract zero elimination (SEC + SBC #0)
- Add one to INC conversion
- Subtract one to DEC conversion
- Identity operation removal

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                     # Pattern exports
└── arithmetic-identity.ts       # THIS TASK
```

---

## 6502 Arithmetic Background

### ADC (Add with Carry)
- **ADC #imm**: 2 bytes, 2 cycles
- **ADC addr**: 3 bytes, 4 cycles
- **ADC zp**: 2 bytes, 3 cycles
- **Behavior**: A = A + operand + Carry

### SBC (Subtract with Borrow)
- **SBC #imm**: 2 bytes, 2 cycles
- **SBC addr**: 3 bytes, 4 cycles
- **SBC zp**: 2 bytes, 3 cycles
- **Behavior**: A = A - operand - !Carry (borrow = inverse of carry)

### INC/DEC
- **INC addr**: 3 bytes, 6 cycles (memory)
- **INC zp**: 2 bytes, 5 cycles (zero page)
- **DEC addr**: 3 bytes, 6 cycles (memory)
- **DEC zp**: 2 bytes, 5 cycles (zero page)
- **Note**: Cannot directly INC/DEC accumulator on 6502 (65C02 adds INA/DEA)

### INX/INY/DEX/DEY
- **INX/INY/DEX/DEY**: 1 byte, 2 cycles
- **Behavior**: Increment/decrement X or Y register

---

## Implementation

### File: `arithmetic-identity.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';

/**
 * Pattern: CLC followed by ADC #0
 * 
 * Before:
 *   CLC
 *   ADC #0
 * 
 * After:
 *   (both instructions removed - no effect on A)
 * 
 * Saves: 4 cycles, 3 bytes
 * 
 * Note: Only valid when carry flag is not needed after
 */
export class AddZeroPattern extends BasePattern {
  readonly id = 'add-zero';
  readonly description = 'Remove CLC + ADC #0 (identity operation)';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    // Check: CLC followed by ADC #0
    if (!this.isClearCarry(first)) {
      return null;
    }
    
    if (!this.isAddImmediate(second, 0)) {
      return null;
    }
    
    return {
      matched: [first, second],
      captures: new Map(),
      confidence: 1.0,
    };
  }
  
  replace(_match: PatternMatch): PatternReplacement {
    // Remove both instructions entirely
    return {
      instructions: [],
      cyclesSaved: 4,  // CLC (2) + ADC #0 (2)
      bytesSaved: 3,   // CLC (1) + ADC #0 (2)
    };
  }
  
  /** Check if instruction is CLC (clear carry) */
  protected isClearCarry(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic && 
           inst.metadata?.get('mnemonic') === 'CLC';
  }
  
  /** Check if instruction is ADC with immediate value */
  protected isAddImmediate(inst: ILInstruction, value: number): boolean {
    if (inst.opcode !== ILOpcode.BinaryOp) return false;
    if (inst.metadata?.get('mnemonic') !== 'ADC') return false;
    if (inst.metadata?.get('addressingMode') !== 'immediate') return false;
    
    const operand = inst.operands[1];
    return this.isConstant(operand, value);
  }
}

/**
 * Pattern: SEC followed by SBC #0
 * 
 * Before:
 *   SEC
 *   SBC #0
 * 
 * After:
 *   (both instructions removed - no effect on A)
 * 
 * Saves: 4 cycles, 3 bytes
 * 
 * Note: Only valid when carry flag is not needed after
 */
export class SubtractZeroPattern extends BasePattern {
  readonly id = 'subtract-zero';
  readonly description = 'Remove SEC + SBC #0 (identity operation)';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    // Check: SEC followed by SBC #0
    if (!this.isSetCarry(first)) {
      return null;
    }
    
    if (!this.isSubtractImmediate(second, 0)) {
      return null;
    }
    
    return {
      matched: [first, second],
      captures: new Map(),
      confidence: 1.0,
    };
  }
  
  replace(_match: PatternMatch): PatternReplacement {
    return {
      instructions: [],
      cyclesSaved: 4,  // SEC (2) + SBC #0 (2)
      bytesSaved: 3,   // SEC (1) + SBC #0 (2)
    };
  }
  
  /** Check if instruction is SEC (set carry) */
  protected isSetCarry(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic && 
           inst.metadata?.get('mnemonic') === 'SEC';
  }
  
  /** Check if instruction is SBC with immediate value */
  protected isSubtractImmediate(inst: ILInstruction, value: number): boolean {
    if (inst.opcode !== ILOpcode.BinaryOp) return false;
    if (inst.metadata?.get('mnemonic') !== 'SBC') return false;
    if (inst.metadata?.get('addressingMode') !== 'immediate') return false;
    
    const operand = inst.operands[1];
    return this.isConstant(operand, value);
  }
}

/**
 * Pattern: CLC + ADC #1 for memory location → INC
 * 
 * Before:
 *   LDA $addr
 *   CLC
 *   ADC #1
 *   STA $addr
 * 
 * After:
 *   INC $addr
 * 
 * Saves: 
 *   - Absolute: 12 cycles → 6 cycles (6 saved), 10 bytes → 3 bytes (7 saved)
 *   - Zero page: 10 cycles → 5 cycles (5 saved), 8 bytes → 2 bytes (6 saved)
 * 
 * Note: Only valid when A value is not needed after
 */
export class AddOneToIncPattern extends BasePattern {
  readonly id = 'add-one-to-inc';
  readonly description = 'Replace LDA/CLC/ADC #1/STA with INC';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 4;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 4) return null;
    
    const [lda, clc, adc, sta] = instructions;
    
    // Check: LDA $addr
    if (!this.isLoad(lda) || !this.isAccumulatorOp(lda)) {
      return null;
    }
    
    // Check: CLC
    if (!this.isClearCarry(clc)) {
      return null;
    }
    
    // Check: ADC #1
    if (!this.isAddImmediate(adc, 1)) {
      return null;
    }
    
    // Check: STA $addr (same address as LDA)
    if (!this.isStore(sta) || !this.isAccumulatorOp(sta)) {
      return null;
    }
    
    // Check: Same address
    const ldaAddr = this.getAddress(lda);
    const staAddr = this.getAddress(sta);
    if (!ldaAddr || !staAddr || ldaAddr !== staAddr) {
      return null;
    }
    
    return {
      matched: [lda, clc, adc, sta],
      captures: this.capture([
        ['address', ldaAddr],
        ['isZeroPage', this.isZeroPageAddress(ldaAddr)],
      ]),
      confidence: 0.9, // Lower confidence - requires A not needed after
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const address = match.captures.get('address') as string;
    const isZp = match.captures.get('isZeroPage') as boolean;
    
    // Create INC instruction
    const inc = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'INC',
      addressingMode: isZp ? 'zeropage' : 'absolute',
      address,
    });
    
    return {
      instructions: [inc],
      cyclesSaved: isZp ? 5 : 6,
      bytesSaved: isZp ? 6 : 7,
    };
  }
  
  protected isClearCarry(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic && 
           inst.metadata?.get('mnemonic') === 'CLC';
  }
  
  protected isAddImmediate(inst: ILInstruction, value: number): boolean {
    if (inst.opcode !== ILOpcode.BinaryOp) return false;
    if (inst.metadata?.get('mnemonic') !== 'ADC') return false;
    if (inst.metadata?.get('addressingMode') !== 'immediate') return false;
    
    const operand = inst.operands[1];
    return this.isConstant(operand, value);
  }
}

/**
 * Pattern: SEC + SBC #1 for memory location → DEC
 * 
 * Before:
 *   LDA $addr
 *   SEC
 *   SBC #1
 *   STA $addr
 * 
 * After:
 *   DEC $addr
 * 
 * Saves: Same as AddOneToIncPattern
 */
export class SubtractOneToDecPattern extends BasePattern {
  readonly id = 'subtract-one-to-dec';
  readonly description = 'Replace LDA/SEC/SBC #1/STA with DEC';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 4;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 4) return null;
    
    const [lda, sec, sbc, sta] = instructions;
    
    // Check: LDA $addr
    if (!this.isLoad(lda) || !this.isAccumulatorOp(lda)) {
      return null;
    }
    
    // Check: SEC
    if (!this.isSetCarry(sec)) {
      return null;
    }
    
    // Check: SBC #1
    if (!this.isSubtractImmediate(sbc, 1)) {
      return null;
    }
    
    // Check: STA $addr (same address as LDA)
    if (!this.isStore(sta) || !this.isAccumulatorOp(sta)) {
      return null;
    }
    
    // Check: Same address
    const ldaAddr = this.getAddress(lda);
    const staAddr = this.getAddress(sta);
    if (!ldaAddr || !staAddr || ldaAddr !== staAddr) {
      return null;
    }
    
    return {
      matched: [lda, sec, sbc, sta],
      captures: this.capture([
        ['address', ldaAddr],
        ['isZeroPage', this.isZeroPageAddress(ldaAddr)],
      ]),
      confidence: 0.9,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const address = match.captures.get('address') as string;
    const isZp = match.captures.get('isZeroPage') as boolean;
    
    const dec = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'DEC',
      addressingMode: isZp ? 'zeropage' : 'absolute',
      address,
    });
    
    return {
      instructions: [dec],
      cyclesSaved: isZp ? 5 : 6,
      bytesSaved: isZp ? 6 : 7,
    };
  }
  
  protected isSetCarry(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic && 
           inst.metadata?.get('mnemonic') === 'SEC';
  }
  
  protected isSubtractImmediate(inst: ILInstruction, value: number): boolean {
    if (inst.opcode !== ILOpcode.BinaryOp) return false;
    if (inst.metadata?.get('mnemonic') !== 'SBC') return false;
    if (inst.metadata?.get('addressingMode') !== 'immediate') return false;
    
    const operand = inst.operands[1];
    return this.isConstant(operand, value);
  }
}

/**
 * Pattern: INX followed by DEX (or vice versa)
 * 
 * Before:
 *   INX
 *   DEX
 * 
 * After:
 *   (both removed - net zero effect)
 * 
 * Saves: 4 cycles, 2 bytes
 */
export class IncrementDecrementCancelPattern extends BasePattern {
  readonly id = 'inc-dec-cancel';
  readonly description = 'Remove INX/DEX or INY/DEY pairs that cancel out';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    // Check for INX/DEX pair
    if (this.isIncrementX(first) && this.isDecrementX(second)) {
      return {
        matched: [first, second],
        captures: this.capture([['register', 'X']]),
        confidence: 1.0,
      };
    }
    
    // Check for DEX/INX pair
    if (this.isDecrementX(first) && this.isIncrementX(second)) {
      return {
        matched: [first, second],
        captures: this.capture([['register', 'X']]),
        confidence: 1.0,
      };
    }
    
    // Check for INY/DEY pair
    if (this.isIncrementY(first) && this.isDecrementY(second)) {
      return {
        matched: [first, second],
        captures: this.capture([['register', 'Y']]),
        confidence: 1.0,
      };
    }
    
    // Check for DEY/INY pair
    if (this.isDecrementY(first) && this.isIncrementY(second)) {
      return {
        matched: [first, second],
        captures: this.capture([['register', 'Y']]),
        confidence: 1.0,
      };
    }
    
    return null;
  }
  
  replace(_match: PatternMatch): PatternReplacement {
    return {
      instructions: [],
      cyclesSaved: 4,  // 2 + 2
      bytesSaved: 2,   // 1 + 1
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
 * Register all arithmetic identity patterns
 */
export function registerArithmeticIdentityPatterns(registry: PatternRegistry): void {
  registry.register(new AddZeroPattern());
  registry.register(new SubtractZeroPattern());
  registry.register(new AddOneToIncPattern());
  registry.register(new SubtractOneToDecPattern());
  registry.register(new IncrementDecrementCancelPattern());
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `AddZero match` | Matches CLC + ADC #0 sequence |
| `AddZero no match ADC #1` | No match when ADC uses non-zero value |
| `AddZero no match no CLC` | No match without preceding CLC |
| `AddZero replace` | Returns empty instruction list |
| `AddZero cycles/bytes` | Reports 4 cycles, 3 bytes saved |
| `SubtractZero match` | Matches SEC + SBC #0 sequence |
| `SubtractZero no match` | No match when SBC uses non-zero value |
| `SubtractZero replace` | Returns empty instruction list |
| `AddOneToInc match abs` | Matches LDA/CLC/ADC #1/STA for absolute |
| `AddOneToInc match zp` | Matches LDA/CLC/ADC #1/STA for zero page |
| `AddOneToInc no match diff addr` | No match when LDA and STA differ |
| `AddOneToInc replace` | Creates INC instruction |
| `SubtractOneToDec match` | Matches LDA/SEC/SBC #1/STA sequence |
| `SubtractOneToDec replace` | Creates DEC instruction |
| `IncDecCancel match INX/DEX` | Matches INX followed by DEX |
| `IncDecCancel match DEX/INX` | Matches DEX followed by INX |
| `IncDecCancel match INY/DEY` | Matches INY followed by DEY |
| `IncDecCancel no match INX/DEY` | No match for mismatched registers |
| `IncDecCancel replace` | Returns empty instruction list |
| `register all` | All 5 patterns registered correctly |

---

## Integration Notes

### Pattern Registration

```typescript
import { patternRegistry } from './registry.js';
import { registerArithmeticIdentityPatterns } from './patterns/arithmetic-identity.js';

registerArithmeticIdentityPatterns(patternRegistry);
```

### Optimization Levels

| Pattern | O1 | O2 | O3 |
|---------|----|----|-----|
| AddZeroPattern | ✅ | ✅ | ✅ |
| SubtractZeroPattern | ✅ | ✅ | ✅ |
| AddOneToIncPattern | ❌ | ✅ | ✅ |
| SubtractOneToDecPattern | ❌ | ✅ | ✅ |
| IncrementDecrementCancelPattern | ✅ | ✅ | ✅ |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `arithmetic-identity.ts` | [ ] |
| Implement AddZeroPattern | [ ] |
| Implement SubtractZeroPattern | [ ] |
| Implement AddOneToIncPattern | [ ] |
| Implement SubtractOneToDecPattern | [ ] |
| Implement IncrementDecrementCancelPattern | [ ] |
| Add registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 8.3c → `08-03c-load-store-indexed.md`  
**Next Task**: 8.4b → `08-04b-arithmetic-shift.md`