# Task 8.4b: Shift and Multiply Patterns

> **Task**: 8.4b of 16 (Peephole Phase)  
> **Time**: ~1.5 hours  
> **Tests**: ~20 tests  
> **Prerequisites**: Tasks 8.1-8.2 (Pattern Framework + Matcher)

---

## Overview

Implement shift and multiply peephole patterns for 6502:
- Multiply by 2 using ASL (Arithmetic Shift Left)
- Divide by 2 using LSR (Logical Shift Right)
- Multiply by power of 2 using multiple shifts
- Multiply by small constants (3, 5, 6, 7, 9, 10)
- Redundant shift elimination

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                     # Pattern exports
├── arithmetic-identity.ts       # Task 8.4a
└── arithmetic-shift.ts          # THIS TASK
```

---

## 6502 Shift Instruction Background

### ASL (Arithmetic Shift Left)
- **ASL A**: 1 byte, 2 cycles (accumulator)
- **ASL addr**: 3 bytes, 6 cycles (absolute)
- **ASL zp**: 2 bytes, 5 cycles (zero page)
- **Behavior**: Shifts all bits left, 0 into bit 0, bit 7 into Carry
- **Effect**: Multiplies unsigned value by 2

### LSR (Logical Shift Right)
- **LSR A**: 1 byte, 2 cycles (accumulator)
- **LSR addr**: 3 bytes, 6 cycles (absolute)
- **LSR zp**: 2 bytes, 5 cycles (zero page)
- **Behavior**: Shifts all bits right, 0 into bit 7, bit 0 into Carry
- **Effect**: Divides unsigned value by 2 (truncates)

### ROL (Rotate Left through Carry)
- **ROL A**: 1 byte, 2 cycles (accumulator)
- **ROL addr**: 3 bytes, 6 cycles (absolute)
- **ROL zp**: 2 bytes, 5 cycles (zero page)
- **Behavior**: Rotate left through Carry (Carry into bit 0, bit 7 into Carry)

### ROR (Rotate Right through Carry)
- **ROR A**: 1 byte, 2 cycles (accumulator)
- **ROR addr**: 3 bytes, 6 cycles (absolute)
- **ROR zp**: 2 bytes, 5 cycles (zero page)
- **Behavior**: Rotate right through Carry (Carry into bit 7, bit 0 into Carry)

---

## Multiplication Strategies

### Power of 2 Multiplication
| Multiply By | Shift Count | Cycles (A) | Example |
|-------------|-------------|------------|---------|
| 2 | 1 | 2 | ASL A |
| 4 | 2 | 4 | ASL A, ASL A |
| 8 | 3 | 6 | ASL A, ASL A, ASL A |
| 16 | 4 | 8 | ASL A × 4 |
| 32 | 5 | 10 | ASL A × 5 |

### Small Constant Multiplication
| Multiply By | Strategy | Cycles (A) | Instructions |
|-------------|----------|------------|--------------|
| 3 | x*2 + x | ~8 | TAX, ASL A, STX $tmp, CLC, ADC $tmp |
| 5 | x*4 + x | ~10 | TAX, ASL A, ASL A, STX $tmp, CLC, ADC $tmp |
| 6 | x*4 + x*2 | ~12 | (x*2)*3 or custom sequence |
| 7 | x*8 - x | ~12 | ASL×3, SEC, SBC original |
| 9 | x*8 + x | ~12 | Similar to x*5 pattern |
| 10 | x*8 + x*2 | ~14 | (x*2)*5 or custom sequence |

---

## Implementation

### File: `arithmetic-shift.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';

/**
 * Pattern: Replace multiply by 2 with ASL
 * 
 * Before (naive multiply):
 *   LDA value
 *   CLC
 *   ADC value    ; A = A + value = 2*value
 * 
 * After:
 *   LDA value
 *   ASL A        ; A = A * 2
 * 
 * Saves: 3-4 cycles, 2-3 bytes
 */
export class MultiplyBy2Pattern extends BasePattern {
  readonly id = 'multiply-by-2';
  readonly description = 'Replace multiply by 2 with ASL';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 3;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 3) return null;
    
    const [lda, clc, adc] = instructions;
    
    // Check: LDA $addr
    if (!this.isLoadAccumulator(lda)) {
      return null;
    }
    
    // Check: CLC
    if (!this.isClearCarry(clc)) {
      return null;
    }
    
    // Check: ADC $addr (same address as LDA)
    if (!this.isAddWithCarry(adc)) {
      return null;
    }
    
    // Check: Same source address (doubling the value)
    const ldaAddr = this.getAddress(lda);
    const adcAddr = this.getAddress(adc);
    if (!ldaAddr || !adcAddr || ldaAddr !== adcAddr) {
      return null;
    }
    
    return {
      matched: [lda, clc, adc],
      captures: this.capture([
        ['address', ldaAddr],
        ['isZeroPage', this.isZeroPageAddress(ldaAddr)],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const address = match.captures.get('address') as string;
    const isZp = match.captures.get('isZeroPage') as boolean;
    
    // Keep LDA, replace CLC+ADC with ASL A
    const lda = match.matched[0];
    const asl = this.createInstruction(ILOpcode.Intrinsic, {
      mnemonic: 'ASL',
      addressingMode: 'accumulator',
    });
    
    return {
      instructions: [lda, asl],
      cyclesSaved: isZp ? 3 : 4,  // CLC(2) + ADC(3-4) - ASL(2)
      bytesSaved: isZp ? 2 : 3,   // CLC(1) + ADC(2-3) - ASL(1)
    };
  }
  
  protected isLoadAccumulator(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Load && 
           inst.metadata?.get('register') === 'A';
  }
  
  protected isClearCarry(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic && 
           inst.metadata?.get('mnemonic') === 'CLC';
  }
  
  protected isAddWithCarry(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.BinaryOp && 
           inst.metadata?.get('mnemonic') === 'ADC';
  }
}

/**
 * Pattern: Replace multiply by power of 2 with multiple ASLs
 * 
 * Before (IL multiply by constant 4):
 *   MUL %reg, #4
 * 
 * After:
 *   ASL A
 *   ASL A
 * 
 * Valid for: 2, 4, 8, 16, 32, 64, 128
 */
export class MultiplyByPowerOf2Pattern extends BasePattern {
  readonly id = 'multiply-by-power-of-2';
  readonly description = 'Replace multiply by power of 2 with ASL sequence';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 1;
  
  /** Powers of 2 that can be optimized (and their shift counts) */
  protected static readonly POWER_MAP = new Map<number, number>([
    [2, 1], [4, 2], [8, 3], [16, 4], [32, 5], [64, 6], [128, 7],
  ]);
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const inst = instructions[0];
    
    // Check: IL multiply instruction
    if (inst.opcode !== ILOpcode.BinaryOp) return null;
    if (inst.metadata?.get('operation') !== 'multiply') return null;
    
    // Check: Second operand is a power of 2 constant
    const operand = inst.operands[1];
    if (!this.isConstantValue(operand)) return null;
    
    const value = this.getConstantValue(operand);
    if (value === null) return null;
    
    const shiftCount = MultiplyByPowerOf2Pattern.POWER_MAP.get(value);
    if (shiftCount === undefined) return null;
    
    return {
      matched: [inst],
      captures: this.capture([
        ['value', value],
        ['shiftCount', shiftCount],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const shiftCount = match.captures.get('shiftCount') as number;
    
    // Create ASL A instructions
    const instructions: ILInstruction[] = [];
    for (let i = 0; i < shiftCount; i++) {
      instructions.push(this.createInstruction(ILOpcode.Intrinsic, {
        mnemonic: 'ASL',
        addressingMode: 'accumulator',
      }));
    }
    
    // Cycles: MUL is typically implemented as subroutine call (~100+ cycles)
    // ASL A is 2 cycles each
    const aslCycles = shiftCount * 2;
    const estimatedMulCycles = 100; // Conservative estimate for software multiply
    
    return {
      instructions,
      cyclesSaved: estimatedMulCycles - aslCycles,
      bytesSaved: 10, // Rough estimate (JSR + routine vs inline ASLs)
    };
  }
}

/**
 * Pattern: Replace divide by power of 2 with LSR sequence
 * 
 * Before (IL divide by constant 4):
 *   DIV %reg, #4
 * 
 * After:
 *   LSR A
 *   LSR A
 * 
 * Valid for: 2, 4, 8, 16, 32, 64, 128
 * Note: Only valid for unsigned division
 */
export class DivideByPowerOf2Pattern extends BasePattern {
  readonly id = 'divide-by-power-of-2';
  readonly description = 'Replace unsigned divide by power of 2 with LSR sequence';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 1;
  
  protected static readonly POWER_MAP = new Map<number, number>([
    [2, 1], [4, 2], [8, 3], [16, 4], [32, 5], [64, 6], [128, 7],
  ]);
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const inst = instructions[0];
    
    // Check: IL divide instruction
    if (inst.opcode !== ILOpcode.BinaryOp) return null;
    if (inst.metadata?.get('operation') !== 'divide') return null;
    
    // Check: Unsigned division only
    if (inst.metadata?.get('signed') === true) return null;
    
    // Check: Second operand is a power of 2 constant
    const operand = inst.operands[1];
    if (!this.isConstantValue(operand)) return null;
    
    const value = this.getConstantValue(operand);
    if (value === null) return null;
    
    const shiftCount = DivideByPowerOf2Pattern.POWER_MAP.get(value);
    if (shiftCount === undefined) return null;
    
    return {
      matched: [inst],
      captures: this.capture([
        ['value', value],
        ['shiftCount', shiftCount],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const shiftCount = match.captures.get('shiftCount') as number;
    
    // Create LSR A instructions
    const instructions: ILInstruction[] = [];
    for (let i = 0; i < shiftCount; i++) {
      instructions.push(this.createInstruction(ILOpcode.Intrinsic, {
        mnemonic: 'LSR',
        addressingMode: 'accumulator',
      }));
    }
    
    const lsrCycles = shiftCount * 2;
    const estimatedDivCycles = 150; // Division is slower than multiply
    
    return {
      instructions,
      cyclesSaved: estimatedDivCycles - lsrCycles,
      bytesSaved: 15,
    };
  }
}

/**
 * Pattern: Remove redundant consecutive shifts that cancel out
 * 
 * Before:
 *   ASL A
 *   LSR A
 * 
 * After:
 *   AND #$FE    ; Clear bit 0 (ASL sets it to 0, LSR shifts it out)
 * 
 * Note: ASL then LSR doesn't restore original - it clears bit 0
 * This pattern detects the sequence and replaces with AND
 */
export class ShiftCancelPattern extends BasePattern {
  readonly id = 'shift-cancel';
  readonly description = 'Optimize ASL/LSR or LSR/ASL sequences';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [first, second] = instructions;
    
    // Check: ASL A followed by LSR A (clears bit 0)
    if (this.isASL(first) && this.isLSR(second)) {
      return {
        matched: [first, second],
        captures: this.capture([['type', 'asl-lsr'], ['mask', 0xFE]]),
        confidence: 0.9, // Flags may differ
      };
    }
    
    // Check: LSR A followed by ASL A (clears bit 7)
    if (this.isLSR(first) && this.isASL(second)) {
      return {
        matched: [first, second],
        captures: this.capture([['type', 'lsr-asl'], ['mask', 0x7F]]),
        confidence: 0.9,
      };
    }
    
    return null;
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const mask = match.captures.get('mask') as number;
    
    const andInst = this.createInstruction(ILOpcode.BinaryOp, {
      mnemonic: 'AND',
      addressingMode: 'immediate',
      value: mask,
    });
    
    return {
      instructions: [andInst],
      cyclesSaved: 2,  // ASL(2) + LSR(2) - AND(2)
      bytesSaved: 1,   // ASL(1) + LSR(1) - AND(2)
    };
  }
  
  protected isASL(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic && 
           inst.metadata?.get('mnemonic') === 'ASL' &&
           inst.metadata?.get('addressingMode') === 'accumulator';
  }
  
  protected isLSR(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Intrinsic && 
           inst.metadata?.get('mnemonic') === 'LSR' &&
           inst.metadata?.get('addressingMode') === 'accumulator';
  }
}

/**
 * Pattern: Multiply by 3 using shifts and add
 * 
 * Before (IL multiply by 3):
 *   MUL %reg, #3
 * 
 * After:
 *   TAX          ; Save original
 *   ASL A        ; A = A * 2
 *   STX $tmp     ; Store original to temp
 *   CLC
 *   ADC $tmp     ; A = A*2 + A = A*3
 * 
 * Cycles: ~12 vs software multiply ~100+
 */
export class MultiplyBy3Pattern extends BasePattern {
  readonly id = 'multiply-by-3';
  readonly description = 'Replace multiply by 3 with shift-add sequence';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const inst = instructions[0];
    
    if (inst.opcode !== ILOpcode.BinaryOp) return null;
    if (inst.metadata?.get('operation') !== 'multiply') return null;
    
    const operand = inst.operands[1];
    if (!this.isConstant(operand, 3)) return null;
    
    return {
      matched: [inst],
      captures: new Map(),
      confidence: 0.95,
    };
  }
  
  replace(_match: PatternMatch): PatternReplacement {
    // x*3 = x*2 + x
    const instructions: ILInstruction[] = [
      this.createInstruction(ILOpcode.Intrinsic, { mnemonic: 'TAX' }),
      this.createInstruction(ILOpcode.Intrinsic, { mnemonic: 'ASL', addressingMode: 'accumulator' }),
      this.createInstruction(ILOpcode.Intrinsic, { mnemonic: 'STA', addressingMode: 'zeropage', address: '$FE' }), // temp
      this.createInstruction(ILOpcode.Intrinsic, { mnemonic: 'TXA' }),
      this.createInstruction(ILOpcode.Intrinsic, { mnemonic: 'CLC' }),
      this.createInstruction(ILOpcode.BinaryOp, { mnemonic: 'ADC', addressingMode: 'zeropage', address: '$FE' }),
    ];
    
    return {
      instructions,
      cyclesSaved: 85, // ~100 (software mul) - ~15 (this sequence)
      bytesSaved: 5,
    };
  }
}

/**
 * Pattern: Multiply by 5 using shifts and add
 * 
 * x*5 = x*4 + x
 * 
 * After:
 *   TAX          ; Save original
 *   ASL A        ; A = A * 2
 *   ASL A        ; A = A * 4
 *   STX $tmp
 *   CLC
 *   ADC $tmp     ; A = A*4 + A = A*5
 */
export class MultiplyBy5Pattern extends BasePattern {
  readonly id = 'multiply-by-5';
  readonly description = 'Replace multiply by 5 with shift-add sequence';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const inst = instructions[0];
    
    if (inst.opcode !== ILOpcode.BinaryOp) return null;
    if (inst.metadata?.get('operation') !== 'multiply') return null;
    
    const operand = inst.operands[1];
    if (!this.isConstant(operand, 5)) return null;
    
    return {
      matched: [inst],
      captures: new Map(),
      confidence: 0.95,
    };
  }
  
  replace(_match: PatternMatch): PatternReplacement {
    // x*5 = x*4 + x
    const instructions: ILInstruction[] = [
      this.createInstruction(ILOpcode.Intrinsic, { mnemonic: 'TAX' }),
      this.createInstruction(ILOpcode.Intrinsic, { mnemonic: 'ASL', addressingMode: 'accumulator' }),
      this.createInstruction(ILOpcode.Intrinsic, { mnemonic: 'ASL', addressingMode: 'accumulator' }),
      this.createInstruction(ILOpcode.Intrinsic, { mnemonic: 'STA', addressingMode: 'zeropage', address: '$FE' }),
      this.createInstruction(ILOpcode.Intrinsic, { mnemonic: 'TXA' }),
      this.createInstruction(ILOpcode.Intrinsic, { mnemonic: 'CLC' }),
      this.createInstruction(ILOpcode.BinaryOp, { mnemonic: 'ADC', addressingMode: 'zeropage', address: '$FE' }),
    ];
    
    return {
      instructions,
      cyclesSaved: 82, // ~100 - ~18
      bytesSaved: 4,
    };
  }
}

/**
 * Pattern: Multiply by 10 using shifts (x*8 + x*2)
 * 
 * x*10 = x*8 + x*2
 * 
 * After:
 *   ASL A        ; A = A * 2
 *   TAX          ; Save A*2
 *   ASL A        ; A = A * 4
 *   ASL A        ; A = A * 8
 *   STX $tmp
 *   CLC
 *   ADC $tmp     ; A = A*8 + A*2 = A*10
 */
export class MultiplyBy10Pattern extends BasePattern {
  readonly id = 'multiply-by-10';
  readonly description = 'Replace multiply by 10 with shift-add sequence';
  readonly category = PatternCategory.Arithmetic;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 1;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 1) return null;
    
    const inst = instructions[0];
    
    if (inst.opcode !== ILOpcode.BinaryOp) return null;
    if (inst.metadata?.get('operation') !== 'multiply') return null;
    
    const operand = inst.operands[1];
    if (!this.isConstant(operand, 10)) return null;
    
    return {
      matched: [inst],
      captures: new Map(),
      confidence: 0.95,
    };
  }
  
  replace(_match: PatternMatch): PatternReplacement {
    // x*10 = x*8 + x*2
    const instructions: ILInstruction[] = [
      this.createInstruction(ILOpcode.Intrinsic, { mnemonic: 'ASL', addressingMode: 'accumulator' }),
      this.createInstruction(ILOpcode.Intrinsic, { mnemonic: 'TAX' }),
      this.createInstruction(ILOpcode.Intrinsic, { mnemonic: 'ASL', addressingMode: 'accumulator' }),
      this.createInstruction(ILOpcode.Intrinsic, { mnemonic: 'ASL', addressingMode: 'accumulator' }),
      this.createInstruction(ILOpcode.Intrinsic, { mnemonic: 'STA', addressingMode: 'zeropage', address: '$FE' }),
      this.createInstruction(ILOpcode.Intrinsic, { mnemonic: 'TXA' }),
      this.createInstruction(ILOpcode.Intrinsic, { mnemonic: 'CLC' }),
      this.createInstruction(ILOpcode.BinaryOp, { mnemonic: 'ADC', addressingMode: 'zeropage', address: '$FE' }),
    ];
    
    return {
      instructions,
      cyclesSaved: 78, // ~100 - ~22
      bytesSaved: 2,
    };
  }
}

/**
 * Register all arithmetic shift patterns
 */
export function registerArithmeticShiftPatterns(registry: PatternRegistry): void {
  registry.register(new MultiplyBy2Pattern());
  registry.register(new MultiplyByPowerOf2Pattern());
  registry.register(new DivideByPowerOf2Pattern());
  registry.register(new ShiftCancelPattern());
  registry.register(new MultiplyBy3Pattern());
  registry.register(new MultiplyBy5Pattern());
  registry.register(new MultiplyBy10Pattern());
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `MultiplyBy2 match` | Matches LDA/CLC/ADC same addr sequence |
| `MultiplyBy2 no match diff addr` | No match when addresses differ |
| `MultiplyBy2 replace` | Generates LDA + ASL A |
| `MultiplyByPowerOf2 match ×4` | Matches MUL #4 |
| `MultiplyByPowerOf2 match ×8` | Matches MUL #8 |
| `MultiplyByPowerOf2 no match ×3` | No match for non-power-of-2 |
| `MultiplyByPowerOf2 replace` | Generates correct number of ASLs |
| `DivideByPowerOf2 match` | Matches unsigned DIV by power of 2 |
| `DivideByPowerOf2 no match signed` | No match for signed division |
| `DivideByPowerOf2 replace` | Generates correct number of LSRs |
| `ShiftCancel ASL-LSR` | Matches ASL followed by LSR |
| `ShiftCancel LSR-ASL` | Matches LSR followed by ASL |
| `ShiftCancel replace` | Generates AND with correct mask |
| `MultiplyBy3 match` | Matches MUL #3 |
| `MultiplyBy3 replace` | Generates TAX/ASL/STA/TXA/CLC/ADC |
| `MultiplyBy5 match` | Matches MUL #5 |
| `MultiplyBy5 replace` | Generates correct x*4+x sequence |
| `MultiplyBy10 match` | Matches MUL #10 |
| `MultiplyBy10 replace` | Generates correct x*8+x*2 sequence |
| `register all` | All 7 patterns registered correctly |

---

## Integration Notes

### Pattern Registration

```typescript
import { patternRegistry } from './registry.js';
import { registerArithmeticShiftPatterns } from './patterns/arithmetic-shift.js';

registerArithmeticShiftPatterns(patternRegistry);
```

### Optimization Levels

| Pattern | O1 | O2 | O3 |
|---------|----|----|-----|
| MultiplyBy2Pattern | ✅ | ✅ | ✅ |
| MultiplyByPowerOf2Pattern | ✅ | ✅ | ✅ |
| DivideByPowerOf2Pattern | ✅ | ✅ | ✅ |
| ShiftCancelPattern | ❌ | ✅ | ✅ |
| MultiplyBy3Pattern | ❌ | ✅ | ✅ |
| MultiplyBy5Pattern | ❌ | ✅ | ✅ |
| MultiplyBy10Pattern | ❌ | ✅ | ✅ |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `arithmetic-shift.ts` | [ ] |
| Implement MultiplyBy2Pattern | [ ] |
| Implement MultiplyByPowerOf2Pattern | [ ] |
| Implement DivideByPowerOf2Pattern | [ ] |
| Implement ShiftCancelPattern | [ ] |
| Implement MultiplyBy3Pattern | [ ] |
| Implement MultiplyBy5Pattern | [ ] |
| Implement MultiplyBy10Pattern | [ ] |
| Add registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 8.4a → `08-04a-arithmetic-identity.md`  
**Next Task**: 8.4c → `08-04c-arithmetic-folding.md`