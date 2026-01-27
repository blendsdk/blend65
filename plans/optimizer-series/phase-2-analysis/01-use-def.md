# Phase 2.1: Use-Definition Analysis

> **Document**: 01-use-def.md  
> **Phase**: 2 - Analysis Passes  
> **Focus**: Track definitions and uses of values  
> **Est. Lines**: ~300  
> **Session**: 2.1

---

## Overview

**Use-Definition (Use-Def) Analysis** tracks where values are **defined** (assigned) and **used** (read) throughout the IL. This is the foundation for many optimizations.

### Why Use-Def Matters

```typescript
// IL Example
const v1 = 5;        // Definition of v1
const v2 = v1 + 3;   // Use of v1, Definition of v2
return v2;           // Use of v2
// v1 has 1 use, v2 has 1 use
```

**Use-Def enables:**
- **DCE**: Find values with 0 uses → delete them
- **Copy Propagation**: Find single-definition values → propagate
- **CSE**: Find identical computations → reuse

---

## Data Structures

### Core Interfaces

```typescript
/**
 * Information about a single definition.
 */
interface Definition {
  /** The value being defined */
  readonly value: ILValue;
  
  /** The instruction that defines it */
  readonly instruction: ILInstruction;
  
  /** The block containing the definition */
  readonly block: BasicBlock;
}

/**
 * Information about a single use.
 */
interface Use {
  /** The value being used */
  readonly value: ILValue;
  
  /** The instruction that uses it */
  readonly instruction: ILInstruction;
  
  /** Which operand position (0, 1, etc.) */
  readonly operandIndex: number;
  
  /** The block containing the use */
  readonly block: BasicBlock;
}
```

### Use-Def Chain

```typescript
/**
 * Complete use-def information for a function.
 */
interface UseDefInfo {
  /**
   * Get the single definition of a value.
   * In SSA form, each value has exactly one definition.
   */
  getDefinition(value: ILValue): Definition | null;
  
  /**
   * Get all uses of a value.
   */
  getUses(value: ILValue): readonly Use[];
  
  /**
   * Get the number of uses (fast path).
   */
  getUseCount(value: ILValue): number;
  
  /**
   * Check if a value has no uses (dead).
   */
  isUnused(value: ILValue): boolean;
  
  /**
   * Check if a value has exactly one use.
   */
  hasSingleUse(value: ILValue): boolean;
  
  /**
   * Get all definitions in a block.
   */
  getBlockDefinitions(block: BasicBlock): readonly Definition[];
  
  /**
   * Get all uses in a block.
   */
  getBlockUses(block: BasicBlock): readonly Use[];
}
```

---

## Implementation

### UseDefAnalysis Class

```typescript
import { AnalysisPass } from '../passes/analysis-pass.js';
import { ILFunction, BasicBlock, ILInstruction } from '../../il/index.js';

/**
 * Use-Definition analysis pass.
 * 
 * Computes where values are defined and used throughout a function.
 * This is the foundation for many optimization passes.
 * 
 * @example
 * ```typescript
 * const useDef = passManager.getAnalysis(UseDefAnalysis, func);
 * if (useDef.isUnused(value)) {
 *   // Value is dead, can delete the defining instruction
 * }
 * ```
 */
export class UseDefAnalysis extends AnalysisPass<UseDefInfo> {
  static override readonly passName = 'use-def';
  static override readonly description = 'Use-Definition analysis';
  
  /** Definition map: value → Definition */
  protected definitions = new Map<ILValue, Definition>();
  
  /** Uses map: value → Use[] */
  protected uses = new Map<ILValue, Use[]>();
  
  /**
   * Run the analysis on a function.
   */
  override runOnFunction(func: ILFunction): UseDefInfo {
    this.clear();
    
    // Single pass through all blocks and instructions
    for (const block of func.getBlocks()) {
      this.analyzeBlock(block);
    }
    
    return this.buildResult();
  }
  
  /**
   * Analyze a single basic block.
   */
  protected analyzeBlock(block: BasicBlock): void {
    for (const inst of block.getInstructions()) {
      this.analyzeInstruction(inst, block);
    }
  }
  
  /**
   * Analyze a single instruction.
   */
  protected analyzeInstruction(inst: ILInstruction, block: BasicBlock): void {
    // Record definitions (results of the instruction)
    const result = inst.getResult();
    if (result) {
      this.recordDefinition(result, inst, block);
    }
    
    // Record uses (operands of the instruction)
    const operands = inst.getOperands();
    for (let i = 0; i < operands.length; i++) {
      this.recordUse(operands[i], inst, i, block);
    }
  }
  
  /**
   * Record a definition.
   */
  protected recordDefinition(
    value: ILValue,
    inst: ILInstruction,
    block: BasicBlock
  ): void {
    // In SSA form, should not have multiple definitions
    if (this.definitions.has(value)) {
      throw new Error(`Multiple definitions of ${value} - SSA violation`);
    }
    
    this.definitions.set(value, { value, instruction: inst, block });
    
    // Initialize empty use list
    if (!this.uses.has(value)) {
      this.uses.set(value, []);
    }
  }
  
  /**
   * Record a use.
   */
  protected recordUse(
    value: ILValue,
    inst: ILInstruction,
    operandIndex: number,
    block: BasicBlock
  ): void {
    const use: Use = { value, instruction: inst, operandIndex, block };
    
    let useList = this.uses.get(value);
    if (!useList) {
      useList = [];
      this.uses.set(value, useList);
    }
    useList.push(use);
  }
  
  /**
   * Build the final result object.
   */
  protected buildResult(): UseDefInfo {
    const defs = this.definitions;
    const uses = this.uses;
    
    return {
      getDefinition(value: ILValue): Definition | null {
        return defs.get(value) ?? null;
      },
      
      getUses(value: ILValue): readonly Use[] {
        return uses.get(value) ?? [];
      },
      
      getUseCount(value: ILValue): number {
        return uses.get(value)?.length ?? 0;
      },
      
      isUnused(value: ILValue): boolean {
        const useList = uses.get(value);
        return !useList || useList.length === 0;
      },
      
      hasSingleUse(value: ILValue): boolean {
        return uses.get(value)?.length === 1;
      },
      
      getBlockDefinitions(block: BasicBlock): readonly Definition[] {
        return Array.from(defs.values())
          .filter(d => d.block === block);
      },
      
      getBlockUses(block: BasicBlock): readonly Use[] {
        return Array.from(uses.values())
          .flat()
          .filter(u => u.block === block);
      }
    };
  }
  
  /**
   * Clear analysis state.
   */
  protected clear(): void {
    this.definitions.clear();
    this.uses.clear();
  }
}
```

---

## Usage Examples

### Dead Code Elimination

```typescript
// In DCE pass
const useDef = this.manager.getAnalysis(UseDefAnalysis, func);

for (const block of func.getBlocks()) {
  for (const inst of block.getInstructions()) {
    const result = inst.getResult();
    
    // If instruction produces a result that's never used
    if (result && useDef.isUnused(result)) {
      // And has no side effects
      if (!inst.hasSideEffects()) {
        // Delete it
        block.removeInstruction(inst);
      }
    }
  }
}
```

### Copy Propagation

```typescript
// In Copy Propagation pass
const useDef = this.manager.getAnalysis(UseDefAnalysis, func);

// Find: v2 = v1 (copy instructions)
for (const inst of getCopyInstructions(func)) {
  const source = inst.getOperand(0);
  const dest = inst.getResult();
  
  // Get all uses of the destination
  const uses = useDef.getUses(dest);
  
  // Replace all uses of dest with source
  for (const use of uses) {
    use.instruction.replaceOperand(use.operandIndex, source);
  }
  
  // Now dest is unused, can delete
  block.removeInstruction(inst);
}
```

### Constant Propagation

```typescript
// Find constant definitions
for (const block of func.getBlocks()) {
  for (const inst of block.getInstructions()) {
    if (inst.isConstant()) {
      const constValue = inst.getConstantValue();
      const result = inst.getResult();
      
      // Get all uses
      const uses = useDef.getUses(result);
      
      // Replace uses with the constant
      for (const use of uses) {
        // Fold the constant into the use site
        foldConstant(use.instruction, use.operandIndex, constValue);
      }
    }
  }
}
```

---

## Edge Cases

### Phi Functions

Phi functions have multiple definitions reaching them:

```typescript
// Handle phi functions specially
protected analyzeInstruction(inst: ILInstruction, block: BasicBlock): void {
  if (inst.isPhi()) {
    // Phi result is a definition
    this.recordDefinition(inst.getResult(), inst, block);
    
    // Phi operands come from different blocks
    const phiInst = inst as PhiInstruction;
    for (let i = 0; i < phiInst.getIncomingCount(); i++) {
      const value = phiInst.getIncomingValue(i);
      const sourceBlock = phiInst.getIncomingBlock(i);
      // Use is conceptually at the end of the source block
      this.recordUse(value, inst, i, sourceBlock);
    }
  } else {
    // Normal instruction handling
    super.analyzeInstruction(inst, block);
  }
}
```

### Function Parameters

Function parameters are definitions without instructions:

```typescript
override runOnFunction(func: ILFunction): UseDefInfo {
  this.clear();
  
  // Parameters are implicit definitions
  for (const param of func.getParameters()) {
    this.definitions.set(param, {
      value: param,
      instruction: null,  // No defining instruction
      block: func.getEntryBlock()
    });
    this.uses.set(param, []);
  }
  
  // Normal block analysis
  for (const block of func.getBlocks()) {
    this.analyzeBlock(block);
  }
  
  return this.buildResult();
}
```

---

## Testing Strategy

### Test Categories

1. **Basic definitions**: Single definition recorded correctly
2. **Basic uses**: Uses recorded with correct operand indices
3. **Use counting**: `getUseCount` returns correct values
4. **Dead detection**: `isUnused` identifies unused values
5. **Single use**: `hasSingleUse` works correctly
6. **Block queries**: `getBlockDefinitions/Uses` filter correctly
7. **Phi handling**: Phi functions tracked correctly
8. **Parameters**: Function parameters as definitions

### Example Tests

```typescript
describe('UseDefAnalysis', () => {
  it('should track single definition', () => {
    const func = createFunction(`
      v1 = const 5
      return v1
    `);
    
    const useDef = new UseDefAnalysis().runOnFunction(func);
    
    const def = useDef.getDefinition(v1);
    expect(def).not.toBeNull();
    expect(def!.instruction.opcode).toBe('const');
  });
  
  it('should count uses correctly', () => {
    const func = createFunction(`
      v1 = const 5
      v2 = add v1, v1
      return v2
    `);
    
    const useDef = new UseDefAnalysis().runOnFunction(func);
    
    expect(useDef.getUseCount(v1)).toBe(2);  // Used twice in add
    expect(useDef.getUseCount(v2)).toBe(1);  // Used once in return
  });
  
  it('should detect unused values', () => {
    const func = createFunction(`
      v1 = const 5
      v2 = const 10
      return v1
    `);
    
    const useDef = new UseDefAnalysis().runOnFunction(func);
    
    expect(useDef.isUnused(v1)).toBe(false);
    expect(useDef.isUnused(v2)).toBe(true);  // v2 never used
  });
});
```

---

## File Location

```
packages/compiler/src/optimizer/analysis/use-def.ts
```

---

## Dependencies

| Dependency | From | Purpose |
|------------|------|---------|
| `AnalysisPass` | Phase 1 | Base class |
| `ILFunction` | IL Generator | Function to analyze |
| `BasicBlock` | IL Generator | Block iteration |
| `ILInstruction` | IL Generator | Instruction inspection |
| `ILValue` | IL Generator | Value tracking |

---

## Next Steps

After implementing Use-Def Analysis:
1. Implement Liveness Analysis (02-liveness.md)
2. Integrate with PassManager caching
3. Create comprehensive test suite

---

**Parent**: [Phase 2 Index](00-phase-index.md)  
**Next**: [Liveness Analysis](02-liveness.md)