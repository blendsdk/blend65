# Phase 3.3: Constant Propagation

> **Document**: 03-constant-prop.md  
> **Phase**: 3 - O1 Transforms  
> **Focus**: Propagate known constant values to their uses  
> **Est. Lines**: ~250  
> **Session**: 3.3

---

## Overview

**Constant Propagation** replaces variable uses with their known constant values. This enables constant folding and reduces register pressure.

### What is Constant Propagation?

```typescript
// Before Constant Propagation
v1 = const 5
v2 = add v1, 3        // Uses v1

// After Constant Propagation
v1 = const 5
v2 = add const(5), 3  // v1 replaced with its value
// Now constant folding can compute: v2 = const 8
```

**Benefits:**
- Exposes opportunities for constant folding
- Reduces register pressure (fewer live values)
- Enables dead code elimination of original definitions
- Works synergistically with inlining

---

## Algorithm

### Sparse Conditional Constant Propagation (SCCP)

We use a simplified version focusing on **definite constants**:

```
1. Initialize all values as UNKNOWN
2. Mark constant instructions as CONSTANT(value)
3. Worklist: all instructions with constant operands
4. For each instruction I in worklist:
   a. If all operands are CONSTANT, mark result as CONSTANT
   b. Replace operand uses with constant values
   c. Add users of I to worklist
5. Repeat until worklist is empty
```

### Lattice States

```
       TOP (Unknown)
          |
     CONSTANT(v)
          |
       BOTTOM (Varying)
```

- **TOP**: Value not yet analyzed
- **CONSTANT(v)**: Value is known to be v
- **BOTTOM**: Value is not constant (varies)

---

## Data Structures

### Propagation State

```typescript
/**
 * Lattice value for constant propagation.
 */
type LatticeValue =
  | { kind: 'top' }              // Unknown
  | { kind: 'constant'; value: number; type: ILType }
  | { kind: 'bottom' };          // Not constant

/**
 * Constant propagation statistics.
 */
interface ConstPropStats {
  /** Number of uses replaced with constants */
  usesReplaced: number;
  
  /** Number of values proven constant */
  constantsFound: number;
}
```

---

## Implementation

### ConstantPropagation Class

```typescript
import { TransformPass } from '../passes/transform-pass.js';
import { UseDefAnalysis, UseDefInfo } from '../analysis/use-def.js';
import { ILFunction, BasicBlock, ILInstruction, ILValue, ILType } from '../../il/index.js';

/**
 * Constant Propagation pass.
 * 
 * Propagates known constant values to their use sites.
 * Enables constant folding and reduces register pressure.
 * 
 * @example
 * ```typescript
 * const prop = new ConstantPropagation();
 * prop.runOnFunction(func);
 * ```
 */
export class ConstantPropagation extends TransformPass {
  static override readonly passName = 'const-prop';
  static override readonly description = 'Constant Propagation';
  static override readonly preserves = ['cfg'];
  static override readonly requires = [UseDefAnalysis];
  
  /** Lattice values for all values */
  protected lattice = new Map<ILValue, LatticeValue>();
  
  /** Use-def information */
  protected useDef!: UseDefInfo;
  
  /** Worklist of instructions to process */
  protected worklist: ILInstruction[] = [];
  
  /** Statistics */
  protected stats: ConstPropStats = { usesReplaced: 0, constantsFound: 0 };
  
  /**
   * Run constant propagation on a function.
   */
  override runOnFunction(func: ILFunction): boolean {
    this.useDef = this.manager.getAnalysis(UseDefAnalysis, func);
    this.initializeLattice(func);
    this.propagate(func);
    return this.replaceUses(func);
  }
  
  /**
   * Initialize lattice values.
   */
  protected initializeLattice(func: ILFunction): void {
    this.lattice.clear();
    this.worklist = [];
    
    // Parameters are BOTTOM (could be anything)
    for (const param of func.getParameters()) {
      this.lattice.set(param, { kind: 'bottom' });
    }
    
    // Find initial constants
    for (const block of func.getBlocks()) {
      for (const inst of block.getInstructions()) {
        const result = inst.getResult();
        if (!result) continue;
        
        if (inst.getOpcode() === 'const' || inst.getOpcode() === 'const16') {
          // Constant instruction - mark as CONSTANT
          this.lattice.set(result, {
            kind: 'constant',
            value: inst.getImmediateValue(),
            type: result.getType()
          });
          this.stats.constantsFound++;
          this.addUsersToWorklist(result);
        } else {
          // Start as TOP (unknown)
          this.lattice.set(result, { kind: 'top' });
        }
      }
    }
  }
  
  /**
   * Add all users of a value to the worklist.
   */
  protected addUsersToWorklist(value: ILValue): void {
    for (const use of this.useDef.getUses(value)) {
      this.worklist.push(use.instruction);
    }
  }
  
  /**
   * Propagate constants through the function.
   */
  protected propagate(func: ILFunction): void {
    while (this.worklist.length > 0) {
      const inst = this.worklist.pop()!;
      const result = inst.getResult();
      if (!result) continue;
      
      // Try to evaluate instruction with known constants
      const newValue = this.evaluateInstruction(inst);
      const oldValue = this.lattice.get(result);
      
      // If lattice value changed, add users to worklist
      if (this.latticeChanged(oldValue, newValue)) {
        this.lattice.set(result, newValue);
        if (newValue.kind === 'constant') {
          this.stats.constantsFound++;
        }
        this.addUsersToWorklist(result);
      }
    }
  }
  
  /**
   * Evaluate instruction to determine if result is constant.
   */
  protected evaluateInstruction(inst: ILInstruction): LatticeValue {
    const opcode = inst.getOpcode();
    
    // Get operand lattice values
    const operands = inst.getOperands();
    const operandValues = operands.map(op => this.lattice.get(op));
    
    // If any operand is BOTTOM, result is BOTTOM
    if (operandValues.some(v => v?.kind === 'bottom')) {
      return { kind: 'bottom' };
    }
    
    // If any operand is still TOP, result is TOP
    if (operandValues.some(v => v?.kind === 'top' || v === undefined)) {
      return { kind: 'top' };
    }
    
    // All operands are CONSTANT - try to evaluate
    const constValues = operandValues.map(v => (v as { kind: 'constant'; value: number }).value);
    
    const result = this.evaluate(opcode, constValues);
    if (result !== null) {
      return { 
        kind: 'constant', 
        value: result,
        type: inst.getResult()!.getType()
      };
    }
    
    // Can't evaluate (e.g., unknown opcode, side effects)
    return { kind: 'bottom' };
  }
  
  /**
   * Evaluate a foldable operation.
   */
  protected evaluate(opcode: string, operands: number[]): number | null {
    const a = operands[0];
    const b = operands[1];
    
    switch (opcode) {
      case 'add': return this.wrap8(a + b);
      case 'sub': return this.wrap8(a - b);
      case 'mul': return this.wrap8(a * b);
      case 'and': return a & b;
      case 'or':  return a | b;
      case 'xor': return a ^ b;
      case 'shl': return this.wrap8(a << b);
      case 'shr': return (a >>> b) & 0xFF;
      case 'eq':  return a === b ? 1 : 0;
      case 'ne':  return a !== b ? 1 : 0;
      // Add more operations as needed
      default: return null;
    }
  }
  
  /**
   * Wrap to 8-bit unsigned.
   */
  protected wrap8(value: number): number {
    return ((value % 256) + 256) % 256;
  }
  
  /**
   * Check if lattice value changed.
   */
  protected latticeChanged(
    oldVal: LatticeValue | undefined, 
    newVal: LatticeValue
  ): boolean {
    if (!oldVal) return true;
    if (oldVal.kind !== newVal.kind) return true;
    if (oldVal.kind === 'constant' && newVal.kind === 'constant') {
      return oldVal.value !== newVal.value;
    }
    return false;
  }
  
  /**
   * Replace uses with constant values.
   */
  protected replaceUses(func: ILFunction): boolean {
    let changed = false;
    
    for (const block of func.getBlocks()) {
      for (const inst of block.getInstructions()) {
        const operands = inst.getOperands();
        
        for (let i = 0; i < operands.length; i++) {
          const latticeVal = this.lattice.get(operands[i]);
          
          if (latticeVal?.kind === 'constant') {
            // Replace operand with constant
            inst.replaceOperand(i, this.createConstValue(latticeVal));
            this.stats.usesReplaced++;
            changed = true;
          }
        }
      }
    }
    
    return changed;
  }
  
  /**
   * Create a constant value.
   */
  protected createConstValue(lattice: { kind: 'constant'; value: number; type: ILType }): ILValue {
    // Create an immediate constant value for the operand
    return ILValue.createImmediate(lattice.value, lattice.type);
  }
  
  /**
   * Get statistics.
   */
  getStats(): ConstPropStats {
    return { ...this.stats };
  }
}
```

---

## Examples

### Basic Propagation

```typescript
// Before
v1 = const 5
v2 = const 10
v3 = add v1, v2

// After constant propagation + folding
v1 = const 5      // May become dead
v2 = const 10     // May become dead  
v3 = const 15     // v1 and v2 propagated, then folded
```

### Through Phi Functions

```typescript
// Before
entry:
  v1 = const 5
  br cond, bb1, bb2
bb1:
  v2 = const 5     // Same value!
  br merge
bb2:
  v3 = const 5     // Same value!
  br merge
merge:
  v4 = phi [v2, bb1], [v3, bb2]
  v5 = add v4, 1

// After - v4 is constant 5 on all paths!
v5 = const 6
```

### Conditional Constants

```typescript
// Before
v1 = const 1
v2 = eq v1, 1      // Always true!
br v2, then, else

// After constant propagation + folding
// v2 = const 1 (true), branch simplified to unconditional
```

---

## Testing Strategy

### Test Categories

1. **Simple propagation**: Single definition, single use
2. **Multiple uses**: One constant, many uses
3. **Cascading**: Propagation enables more propagation
4. **Phi functions**: Constants through control flow
5. **Non-constants**: Parameters and varying values
6. **Interaction with folding**: Propagate then fold

### Example Tests

```typescript
describe('ConstantPropagation', () => {
  it('should propagate constants to uses', () => {
    const func = createFunction(`
      v1 = const 5
      v2 = add v1, 3
      return v2
    `);
    
    const prop = new ConstantPropagation(passManager);
    prop.runOnFunction(func);
    
    // v1's constant value should be propagated to add
    expect(prop.getStats().usesReplaced).toBeGreaterThan(0);
  });
  
  it('should not propagate non-constants', () => {
    const func = createFunction(`
      param p1: byte
      v1 = add p1, 5
      return v1
    `);
    
    const prop = new ConstantPropagation(passManager);
    prop.runOnFunction(func);
    
    // p1 is not constant, should not be replaced
    expect(prop.getStats().usesReplaced).toBe(0);
  });
  
  it('should propagate through phi when all inputs constant', () => {
    const func = createFunction(`
      entry:
        br cond, bb1, bb2
      bb1:
        v1 = const 5
        br merge
      bb2:
        v2 = const 5
        br merge
      merge:
        v3 = phi [v1, bb1], [v2, bb2]
        return v3
    `);
    
    const prop = new ConstantPropagation(passManager);
    prop.runOnFunction(func);
    
    // v3 should be recognized as constant 5
    expect(prop.getStats().constantsFound).toBeGreaterThan(2);
  });
});
```

---

## File Location

```
packages/compiler/src/optimizer/transforms/constant-prop.ts
```

---

## Dependencies

| Dependency | From | Purpose |
|------------|------|---------|
| `TransformPass` | Phase 1 | Base class |
| `UseDefAnalysis` | Phase 2 | Find uses to replace |
| `ILFunction` | IL Generator | Function to optimize |
| `ILValue` | IL Generator | Create constant values |

---

## Interaction with Other Passes

**Typical pipeline:**
```
ConstantPropagation → ConstantFolding → DCE → (repeat)
```

**Why repeat?** Constant folding may create new constants that can be propagated!

---

**Parent**: [Phase 3 Index](00-phase-index.md)  
**Previous**: [Constant Folding](02-constant-fold.md)  
**Next**: [Copy Propagation](04-copy-prop.md)