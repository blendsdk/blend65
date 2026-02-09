# Phase 3.2: Constant Folding

> **Document**: 02-constant-fold.md  
> **Phase**: 3 - O1 Transforms  
> **Focus**: Evaluate constant expressions at compile time  
> **Est. Lines**: ~300  
> **Session**: 3.2

---

## Overview

**Constant Folding** evaluates constant expressions at compile time, replacing them with their computed values. This eliminates runtime computation and enables further optimizations.

### What is Constant Folding?

```typescript
// Before Constant Folding
v1 = const 5
v2 = const 3
v3 = add v1, v2      // 5 + 3

// After Constant Folding
v1 = const 5
v2 = const 3
v3 = const 8         // Computed at compile time!
```

**Benefits:**
- Eliminates runtime arithmetic
- Enables more dead code elimination
- Reduces code size
- Works synergistically with constant propagation

---

## Algorithm

### Core Principle

An instruction can be **folded** if:
1. All operands are **constants**
2. The operation is **pure** (deterministic, no side effects)
3. The result can be **represented** in the target type

### Folding Process

```
For each instruction I in function:
  1. Check if I is a foldable operation (add, mul, etc.)
  2. Check if all operands are constant values
  3. Evaluate the operation at compile time
  4. Handle overflow/type semantics (6502-specific!)
  5. Replace I with a constant instruction
```

---

## 6502-Specific Considerations

### 8-bit Overflow Semantics

The 6502 uses 8-bit arithmetic with wrap-around:

```typescript
// 6502 semantics - 8-bit unsigned wrap
v1 = const 200
v2 = const 100
v3 = add v1, v2   // 200 + 100 = 300, but wraps to 44 (300 - 256)

// After folding (MUST use 8-bit semantics!)
v3 = const 44     // NOT const 300!
```

### Signed vs Unsigned

Track signedness for correct folding:

```typescript
// Unsigned: 255 + 1 = 0 (wrap)
// Signed:   127 + 1 = -128 (overflow to negative)
```

### 16-bit Word Operations

Some operations use 16-bit words:

```typescript
// 16-bit address arithmetic
v1 = const16 $0400
v2 = const16 $0028
v3 = add16 v1, v2   // Folds to const16 $0428
```

---

## Data Structures

### Constant Value Representation

```typescript
/**
 * Represents a constant value for folding.
 */
interface ConstantValue {
  /** The numeric value */
  value: number;
  
  /** Type information */
  type: ILType;
  
  /** Bit width (8 or 16 for 6502) */
  bitWidth: 8 | 16;
  
  /** Whether signed interpretation is used */
  signed: boolean;
}

/**
 * Constant folding statistics.
 */
interface ConstFoldStats {
  /** Number of operations folded */
  operationsFolded: number;
  
  /** Breakdown by operation type */
  byOpcode: Map<string, number>;
}
```

---

## Implementation

### ConstantFolding Class

```typescript
import { TransformPass } from '../passes/transform-pass.js';
import { ILFunction, BasicBlock, ILInstruction, ILValue, ILType } from '../../il/index.js';

/**
 * Constant Folding pass.
 * 
 * Evaluates constant expressions at compile time.
 * Uses 6502-appropriate overflow semantics.
 * 
 * @example
 * ```typescript
 * const folder = new ConstantFolding();
 * folder.runOnFunction(func);
 * ```
 */
export class ConstantFolding extends TransformPass {
  static override readonly passName = 'const-fold';
  static override readonly description = 'Constant Folding';
  static override readonly preserves = ['cfg', 'use-def'];
  
  /** Known constant values */
  protected constants = new Map<ILValue, ConstantValue>();
  
  /** Statistics */
  protected stats: ConstFoldStats = {
    operationsFolded: 0,
    byOpcode: new Map()
  };
  
  /**
   * Run constant folding on a function.
   */
  override runOnFunction(func: ILFunction): boolean {
    let changed = false;
    
    // Collect initial constants
    this.collectConstants(func);
    
    // Iterate until no more changes
    let iterationChanged: boolean;
    do {
      iterationChanged = false;
      
      for (const block of func.getBlocks()) {
        for (const inst of [...block.getInstructions()]) {
          if (this.tryFold(inst, block)) {
            iterationChanged = true;
            changed = true;
          }
        }
      }
    } while (iterationChanged);
    
    return changed;
  }
  
  /**
   * Collect constant definitions.
   */
  protected collectConstants(func: ILFunction): void {
    this.constants.clear();
    
    for (const block of func.getBlocks()) {
      for (const inst of block.getInstructions()) {
        if (inst.getOpcode() === 'const' || inst.getOpcode() === 'const16') {
          const result = inst.getResult();
          if (result) {
            this.constants.set(result, {
              value: inst.getImmediateValue(),
              type: result.getType(),
              bitWidth: inst.getOpcode() === 'const16' ? 16 : 8,
              signed: result.getType().isSigned()
            });
          }
        }
      }
    }
  }
  
  /**
   * Try to fold a single instruction.
   */
  protected tryFold(inst: ILInstruction, block: BasicBlock): boolean {
    const opcode = inst.getOpcode();
    
    // Check if operation is foldable
    if (!this.isFoldable(opcode)) {
      return false;
    }
    
    // Get operand constants
    const operands = inst.getOperands();
    const constOperands = operands.map(op => this.constants.get(op));
    
    // All operands must be constant
    if (constOperands.some(c => c === undefined)) {
      return false;
    }
    
    // Perform the fold
    const result = this.evaluate(opcode, constOperands as ConstantValue[]);
    if (result === null) {
      return false;  // Cannot fold (e.g., division by zero)
    }
    
    // Replace with constant instruction
    const resultValue = inst.getResult();
    if (!resultValue) return false;
    
    const constInst = this.createConstInstruction(result, resultValue);
    block.replaceInstruction(inst, constInst);
    
    // Record the new constant
    this.constants.set(resultValue, result);
    
    // Update statistics
    this.stats.operationsFolded++;
    this.stats.byOpcode.set(opcode, (this.stats.byOpcode.get(opcode) ?? 0) + 1);
    
    return true;
  }
  
  /**
   * Check if an opcode can be folded.
   */
  protected isFoldable(opcode: string): boolean {
    const foldable = new Set([
      // Arithmetic
      'add', 'sub', 'mul', 'div', 'mod',
      'add16', 'sub16',
      
      // Bitwise
      'and', 'or', 'xor', 'not',
      'shl', 'shr', 'asr',  // Shifts
      
      // Comparison (result is 0 or 1)
      'eq', 'ne', 'lt', 'le', 'gt', 'ge',
      'ult', 'ule', 'ugt', 'uge',  // Unsigned comparisons
      
      // Unary
      'neg', 'not',
    ]);
    
    return foldable.has(opcode);
  }
  
  /**
   * Evaluate an operation at compile time.
   */
  protected evaluate(opcode: string, operands: ConstantValue[]): ConstantValue | null {
    const a = operands[0];
    const b = operands[1];  // May be undefined for unary ops
    
    let value: number;
    let bitWidth: 8 | 16 = a.bitWidth;
    
    switch (opcode) {
      // Arithmetic
      case 'add':
        value = this.wrap8(a.value + b.value);
        break;
      case 'add16':
        value = this.wrap16(a.value + b.value);
        bitWidth = 16;
        break;
      case 'sub':
        value = this.wrap8(a.value - b.value);
        break;
      case 'sub16':
        value = this.wrap16(a.value - b.value);
        bitWidth = 16;
        break;
      case 'mul':
        value = this.wrap8(a.value * b.value);
        break;
      case 'div':
        if (b.value === 0) return null;  // Division by zero
        value = this.wrap8(Math.trunc(a.value / b.value));
        break;
      case 'mod':
        if (b.value === 0) return null;  // Division by zero
        value = this.wrap8(a.value % b.value);
        break;
      case 'neg':
        value = this.wrap8(-a.value);
        break;
        
      // Bitwise
      case 'and':
        value = a.value & b.value;
        break;
      case 'or':
        value = a.value | b.value;
        break;
      case 'xor':
        value = a.value ^ b.value;
        break;
      case 'not':
        value = this.wrap8(~a.value);
        break;
      case 'shl':
        value = this.wrap8(a.value << b.value);
        break;
      case 'shr':
        value = (a.value >>> b.value) & 0xFF;
        break;
      case 'asr':  // Arithmetic shift right (signed)
        value = this.wrap8(this.toSigned8(a.value) >> b.value);
        break;
        
      // Comparisons (result is 0 or 1)
      case 'eq':
        value = a.value === b.value ? 1 : 0;
        break;
      case 'ne':
        value = a.value !== b.value ? 1 : 0;
        break;
      case 'lt':
        value = this.toSigned8(a.value) < this.toSigned8(b.value) ? 1 : 0;
        break;
      case 'le':
        value = this.toSigned8(a.value) <= this.toSigned8(b.value) ? 1 : 0;
        break;
      case 'gt':
        value = this.toSigned8(a.value) > this.toSigned8(b.value) ? 1 : 0;
        break;
      case 'ge':
        value = this.toSigned8(a.value) >= this.toSigned8(b.value) ? 1 : 0;
        break;
      case 'ult':
        value = a.value < b.value ? 1 : 0;
        break;
      case 'ule':
        value = a.value <= b.value ? 1 : 0;
        break;
      case 'ugt':
        value = a.value > b.value ? 1 : 0;
        break;
      case 'uge':
        value = a.value >= b.value ? 1 : 0;
        break;
        
      default:
        return null;
    }
    
    return { value, type: a.type, bitWidth, signed: a.signed };
  }
  
  /**
   * Wrap value to 8-bit unsigned.
   */
  protected wrap8(value: number): number {
    return ((value % 256) + 256) % 256;
  }
  
  /**
   * Wrap value to 16-bit unsigned.
   */
  protected wrap16(value: number): number {
    return ((value % 65536) + 65536) % 65536;
  }
  
  /**
   * Convert 8-bit unsigned to signed.
   */
  protected toSigned8(value: number): number {
    return value > 127 ? value - 256 : value;
  }
  
  /**
   * Create a constant instruction.
   */
  protected createConstInstruction(
    constant: ConstantValue,
    result: ILValue
  ): ILInstruction {
    const opcode = constant.bitWidth === 16 ? 'const16' : 'const';
    return new ILInstruction(opcode, [constant.value], result);
  }
  
  /**
   * Get statistics.
   */
  getStats(): ConstFoldStats {
    return {
      operationsFolded: this.stats.operationsFolded,
      byOpcode: new Map(this.stats.byOpcode)
    };
  }
}
```

---

## Examples

### Arithmetic Folding

```typescript
// Before
v1 = const 10
v2 = const 20
v3 = add v1, v2
v4 = mul v3, 2

// After
v1 = const 10      // May become dead
v2 = const 20      // May become dead
v3 = const 30      // Folded: 10 + 20
v4 = const 60      // Folded: 30 * 2
```

### Comparison Folding

```typescript
// Before
v1 = const 5
v2 = const 3
v3 = lt v1, v2     // 5 < 3?

// After
v3 = const 0       // False
```

### 8-bit Overflow

```typescript
// Before
v1 = const 250
v2 = const 10
v3 = add v1, v2    // 250 + 10 = 260

// After (6502 semantics!)
v3 = const 4       // 260 - 256 = 4
```

---

## Testing Strategy

### Test Categories

1. **Arithmetic operations**: add, sub, mul, div, mod
2. **Bitwise operations**: and, or, xor, not, shifts
3. **Comparisons**: signed and unsigned
4. **Overflow handling**: 8-bit wrap-around
5. **16-bit operations**: Word arithmetic
6. **Edge cases**: Division by zero, shift by 0
7. **Cascading**: Folding enables more folding

### Example Tests

```typescript
describe('ConstantFolding', () => {
  it('should fold arithmetic', () => {
    const func = createFunction(`
      v1 = const 10
      v2 = const 5
      v3 = add v1, v2
      return v3
    `);
    
    const folder = new ConstantFolding(passManager);
    folder.runOnFunction(func);
    
    const v3Inst = findInstruction(func, 'v3');
    expect(v3Inst.getOpcode()).toBe('const');
    expect(v3Inst.getImmediateValue()).toBe(15);
  });
  
  it('should handle 8-bit overflow', () => {
    const func = createFunction(`
      v1 = const 200
      v2 = const 100
      v3 = add v1, v2
      return v3
    `);
    
    const folder = new ConstantFolding(passManager);
    folder.runOnFunction(func);
    
    const v3Inst = findInstruction(func, 'v3');
    expect(v3Inst.getImmediateValue()).toBe(44);  // 300 - 256
  });
  
  it('should fold comparisons', () => {
    const func = createFunction(`
      v1 = const 5
      v2 = const 3
      v3 = lt v1, v2
      return v3
    `);
    
    const folder = new ConstantFolding(passManager);
    folder.runOnFunction(func);
    
    const v3Inst = findInstruction(func, 'v3');
    expect(v3Inst.getImmediateValue()).toBe(0);  // false
  });
  
  it('should not fold division by zero', () => {
    const func = createFunction(`
      v1 = const 10
      v2 = const 0
      v3 = div v1, v2
      return v3
    `);
    
    const folder = new ConstantFolding(passManager);
    folder.runOnFunction(func);
    
    const v3Inst = findInstruction(func, 'v3');
    expect(v3Inst.getOpcode()).toBe('div');  // NOT folded
  });
});
```

---

## File Location

```
packages/compiler/src/optimizer/transforms/constant-fold.ts
```

---

## Dependencies

| Dependency | From | Purpose |
|------------|------|---------|
| `TransformPass` | Phase 1 | Base class |
| `ILFunction` | IL Generator | Function to optimize |
| `ILInstruction` | IL Generator | Instruction manipulation |
| `ILType` | IL Generator | Type information |

---

## Interaction with Other Passes

**Works well with:**
- **Constant Propagation**: Propagates constants, enabling more folding
- **DCE**: Removes original operand definitions that become dead
- **Inline**: Inlining exposes more constant arguments

**Typical pipeline:**
```
ConstantPropagation → ConstantFolding → DCE
```

---

**Parent**: [Phase 3 Index](00-phase-index.md)  
**Previous**: [DCE](01-dce.md)  
**Next**: [Constant Propagation](03-constant-prop.md)