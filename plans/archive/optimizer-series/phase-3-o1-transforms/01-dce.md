# Phase 3.1: Dead Code Elimination (DCE)

> **Document**: 01-dce.md  
> **Phase**: 3 - O1 Transforms  
> **Focus**: Remove unused instructions  
> **Est. Lines**: ~300  
> **Session**: 3.1

---

## Overview

**Dead Code Elimination (DCE)** removes instructions whose results are never used. This is one of the most impactful optimizations, directly reducing code size and improving execution speed.

### What is Dead Code?

```typescript
// IL Example - Before DCE
v1 = const 5           // ← DEAD: v1 never used
v2 = const 10
v3 = add v2, v2        // ← DEAD: v3 never used
return v2

// IL Example - After DCE
v2 = const 10
return v2
```

**DCE eliminates:**
- Unused variable definitions
- Unused computation results
- Unreachable code (after unconditional jumps)

---

## Algorithm

### Core Principle

An instruction is **dead** if:
1. It produces a result that is **never used** (use count = 0)
2. It has **no side effects** (no memory stores, no I/O)

### Worklist Algorithm

```
1. Build use-def information
2. Collect all dead instructions into worklist
3. While worklist not empty:
   a. Remove instruction I from worklist
   b. Delete I from its block
   c. For each operand V of I:
      - Decrement use count of V
      - If V now has 0 uses, add V's definition to worklist
4. Repeat until worklist is empty
```

### Why Worklist?

Deleting one instruction may make others dead:

```typescript
v1 = const 5
v2 = add v1, v1   // Only use of v1
v3 = mul v2, 2    // Only use of v2, but v3 unused!

// After deleting v3:
//   v2 becomes dead (0 uses)
// After deleting v2:
//   v1 becomes dead (0 uses)
```

---

## Data Structures

### DCE Pass Interface

```typescript
/**
 * Dead Code Elimination statistics.
 */
interface DCEStats {
  /** Number of instructions removed */
  instructionsRemoved: number;
  
  /** Number of blocks removed (unreachable) */
  blocksRemoved: number;
}

/**
 * DCE configuration options.
 */
interface DCEOptions {
  /** Remove unreachable blocks (default: true) */
  removeUnreachableBlocks: boolean;
  
  /** Remove dead stores to locals (default: true) */
  removeDeadStores: boolean;
}
```

---

## Implementation

### DeadCodeElimination Class

```typescript
import { TransformPass } from '../passes/transform-pass.js';
import { UseDefAnalysis, UseDefInfo } from '../analysis/use-def.js';
import { ILFunction, BasicBlock, ILInstruction, ILValue } from '../../il/index.js';

/**
 * Dead Code Elimination pass.
 * 
 * Removes instructions whose results are never used.
 * Uses worklist algorithm to handle cascading dead code.
 * 
 * @example
 * ```typescript
 * const dce = new DeadCodeElimination();
 * const changed = dce.runOnFunction(func);
 * ```
 */
export class DeadCodeElimination extends TransformPass {
  static override readonly passName = 'dce';
  static override readonly description = 'Dead Code Elimination';
  static override readonly preserves = ['cfg'];  // Preserves CFG structure
  static override readonly requires = [UseDefAnalysis];
  
  /** Instructions pending removal */
  protected worklist: ILInstruction[] = [];
  
  /** Use counts (mutable during pass) */
  protected useCounts = new Map<ILValue, number>();
  
  /** Use-def information */
  protected useDef!: UseDefInfo;
  
  /** Pass statistics */
  protected stats: DCEStats = { instructionsRemoved: 0, blocksRemoved: 0 };
  
  /**
   * Run DCE on a function.
   */
  override runOnFunction(func: ILFunction): boolean {
    // Get use-def analysis
    this.useDef = this.manager.getAnalysis(UseDefAnalysis, func);
    
    // Initialize mutable use counts
    this.initializeUseCounts(func);
    
    // Find initial dead instructions
    this.collectDeadInstructions(func);
    
    // Process worklist
    this.processWorklist(func);
    
    // Remove unreachable blocks
    this.removeUnreachableBlocks(func);
    
    return this.stats.instructionsRemoved > 0 || this.stats.blocksRemoved > 0;
  }
  
  /**
   * Initialize mutable use counts from use-def analysis.
   */
  protected initializeUseCounts(func: ILFunction): void {
    this.useCounts.clear();
    
    for (const block of func.getBlocks()) {
      for (const inst of block.getInstructions()) {
        const result = inst.getResult();
        if (result) {
          this.useCounts.set(result, this.useDef.getUseCount(result));
        }
      }
    }
  }
  
  /**
   * Collect initial dead instructions.
   */
  protected collectDeadInstructions(func: ILFunction): void {
    this.worklist = [];
    
    for (const block of func.getBlocks()) {
      for (const inst of block.getInstructions()) {
        if (this.isDead(inst)) {
          this.worklist.push(inst);
        }
      }
    }
  }
  
  /**
   * Check if an instruction is dead.
   */
  protected isDead(inst: ILInstruction): boolean {
    // Must produce a result
    const result = inst.getResult();
    if (!result) return false;
    
    // Result must have no uses
    const useCount = this.useCounts.get(result) ?? 0;
    if (useCount > 0) return false;
    
    // Must not have side effects
    if (this.hasSideEffects(inst)) return false;
    
    return true;
  }
  
  /**
   * Check if instruction has side effects.
   */
  protected hasSideEffects(inst: ILInstruction): boolean {
    const opcode = inst.getOpcode();
    
    // Side-effecting opcodes
    const sideEffects = new Set([
      'store',       // Memory store
      'store_zp',    // Zero page store
      'call',        // Function call (may have side effects)
      'intrinsic',   // Intrinsic call
      'asm',         // Inline assembly
      'debug',       // Debug instruction
    ]);
    
    return sideEffects.has(opcode);
  }
  
  /**
   * Process the worklist until empty.
   */
  protected processWorklist(func: ILFunction): void {
    while (this.worklist.length > 0) {
      const inst = this.worklist.pop()!;
      
      // Get the block containing this instruction
      const block = inst.getParent();
      if (!block) continue;  // Already removed
      
      // Decrement use counts for operands
      for (const operand of inst.getOperands()) {
        this.decrementUseCount(operand);
      }
      
      // Remove the instruction
      block.removeInstruction(inst);
      this.stats.instructionsRemoved++;
    }
  }
  
  /**
   * Decrement use count and possibly add to worklist.
   */
  protected decrementUseCount(value: ILValue): void {
    const currentCount = this.useCounts.get(value);
    if (currentCount === undefined) return;
    
    const newCount = currentCount - 1;
    this.useCounts.set(value, newCount);
    
    // If now dead, add defining instruction to worklist
    if (newCount === 0) {
      const def = this.useDef.getDefinition(value);
      if (def && def.instruction && !this.hasSideEffects(def.instruction)) {
        this.worklist.push(def.instruction);
      }
    }
  }
  
  /**
   * Remove unreachable basic blocks.
   */
  protected removeUnreachableBlocks(func: ILFunction): void {
    const reachable = this.findReachableBlocks(func);
    
    for (const block of func.getBlocks()) {
      if (!reachable.has(block)) {
        func.removeBlock(block);
        this.stats.blocksRemoved++;
      }
    }
  }
  
  /**
   * Find all reachable blocks via DFS.
   */
  protected findReachableBlocks(func: ILFunction): Set<BasicBlock> {
    const reachable = new Set<BasicBlock>();
    const worklist: BasicBlock[] = [func.getEntryBlock()];
    
    while (worklist.length > 0) {
      const block = worklist.pop()!;
      if (reachable.has(block)) continue;
      
      reachable.add(block);
      
      for (const succ of block.getSuccessors()) {
        worklist.push(succ);
      }
    }
    
    return reachable;
  }
  
  /**
   * Get pass statistics.
   */
  getStats(): DCEStats {
    return { ...this.stats };
  }
}
```

---

## Special Cases

### Side-Effecting Instructions

Never remove these even if result is unused:

```typescript
v1 = call print, "hello"   // Side effect: I/O
v2 = store addr, value     // Side effect: memory write
// v1 and v2 unused, but instructions must stay!
```

### Phi Functions

Phi functions can become dead:

```typescript
// If only use of v3 is removed, phi becomes dead
entry:
  br cond, bb1, bb2
bb1:
  v1 = const 1
  br merge
bb2:
  v2 = const 2
  br merge
merge:
  v3 = phi [v1, bb1], [v2, bb2]  // DEAD if v3 unused
  return v4
```

### Critical Edges

Don't remove blocks that split critical edges (yet):

```typescript
// Critical edge: branch to block with multiple preds
// Handled in separate pass if needed
```

---

## Usage Example

```typescript
// Before DCE
function example() {
  v1 = const 5           // Dead
  v2 = const 10
  v3 = add v2, v2
  v4 = mul v1, 2         // Dead (uses v1, but v4 unused)
  return v3
}

// After DCE
function example() {
  v2 = const 10
  v3 = add v2, v2
  return v3
}
// Removed: v1, v4 (2 instructions)
```

---

## Testing Strategy

### Test Categories

1. **Simple dead code**: Remove unused definitions
2. **Cascading dead**: Removing one makes others dead
3. **Side effects**: Never remove side-effecting instructions
4. **Unreachable blocks**: Remove blocks with no path from entry
5. **Phi functions**: Handle dead phi nodes correctly
6. **Parameters**: Never remove parameter definitions
7. **Multiple passes**: DCE can enable more DCE

### Example Tests

```typescript
describe('DeadCodeElimination', () => {
  it('should remove unused definitions', () => {
    const func = createFunction(`
      v1 = const 5
      v2 = const 10
      return v2
    `);
    
    const dce = new DeadCodeElimination(passManager);
    const changed = dce.runOnFunction(func);
    
    expect(changed).toBe(true);
    expect(func.getInstructionCount()).toBe(2);  // const, return
    expect(dce.getStats().instructionsRemoved).toBe(1);
  });
  
  it('should cascade dead code removal', () => {
    const func = createFunction(`
      v1 = const 5
      v2 = add v1, v1
      v3 = mul v2, 2
      return const 0
    `);
    
    const dce = new DeadCodeElimination(passManager);
    dce.runOnFunction(func);
    
    expect(dce.getStats().instructionsRemoved).toBe(3);  // v1, v2, v3
  });
  
  it('should preserve side effects', () => {
    const func = createFunction(`
      v1 = call print, "hello"
      return const 0
    `);
    
    const dce = new DeadCodeElimination(passManager);
    dce.runOnFunction(func);
    
    expect(dce.getStats().instructionsRemoved).toBe(0);
  });
  
  it('should remove unreachable blocks', () => {
    const func = createFunction(`
      entry:
        return const 0
      unreachable:
        v1 = const 42
        return v1
    `);
    
    const dce = new DeadCodeElimination(passManager);
    dce.runOnFunction(func);
    
    expect(dce.getStats().blocksRemoved).toBe(1);
  });
});
```

---

## File Location

```
packages/compiler/src/optimizer/transforms/dce.ts
```

---

## Dependencies

| Dependency | From | Purpose |
|------------|------|---------|
| `TransformPass` | Phase 1 | Base class |
| `UseDefAnalysis` | Phase 2 | Find unused values |
| `ILFunction` | IL Generator | Function manipulation |
| `BasicBlock` | IL Generator | Block removal |
| `ILInstruction` | IL Generator | Instruction removal |

---

## Performance

**Time Complexity**: O(n) where n = number of instructions
- Single pass to collect dead instructions
- Worklist processing is bounded by total instructions

**Space Complexity**: O(n) for worklist and use counts

---

## Next Steps

After implementing DCE:
1. Implement Constant Folding (02-constant-fold.md)
2. Run DCE after constant propagation (more dead code appears)
3. Add statistics tracking to optimization reports

---

**Parent**: [Phase 3 Index](00-phase-index.md)  
**Next**: [Constant Folding](02-constant-fold.md)