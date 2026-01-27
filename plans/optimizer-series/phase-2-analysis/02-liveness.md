# Phase 2.2: Liveness Analysis

> **Document**: 02-liveness.md  
> **Phase**: 2 - Analysis Passes  
> **Focus**: Track which values are live at each program point  
> **Est. Lines**: ~300  
> **Session**: 2.2

---

## Overview

**Liveness Analysis** determines which values are **live** (will be used in the future) at each program point. A value is **dead** if it will never be used again.

### Why Liveness Matters

```typescript
// Example IL
v1 = const 5       // v1 becomes live
v2 = add v1, 3     // v1 used (still live until here), v2 becomes live
v3 = const 10      // v3 becomes live
return v2          // v2 used (dies here), v3 is dead (never used)
```

**Liveness enables:**
- **Register Allocation**: Know when registers can be reused
- **Dead Store Elimination**: Find stores to values that are never read
- **Spill Decisions**: Know which values are live across calls

---

## Data Flow Equations

Liveness is a **backward dataflow analysis** - we analyze from the end to the beginning.

### Definitions

| Term | Meaning |
|------|---------|
| **LiveIn(B)** | Values live at the **entry** of block B |
| **LiveOut(B)** | Values live at the **exit** of block B |
| **Def(B)** | Values **defined** in block B |
| **Use(B)** | Values **used** in block B before any definition |

### Equations

```
LiveOut(B) = ∪ LiveIn(S) for all successors S of B

LiveIn(B) = Use(B) ∪ (LiveOut(B) - Def(B))
```

### Example

```
Block B1:          Block B2:
  v1 = 5             v3 = v1 + v2
  v2 = 10            return v3
  goto B2

Def(B1) = {v1, v2}    Def(B2) = {v3}
Use(B1) = {}          Use(B2) = {v1, v2}

LiveOut(B1) = LiveIn(B2) = {v1, v2}
LiveIn(B1) = {} ∪ ({v1, v2} - {v1, v2}) = {}

LiveOut(B2) = {} (no successors)
LiveIn(B2) = {v1, v2} ∪ ({} - {v3}) = {v1, v2}
```

---

## Data Structures

### Core Interfaces

```typescript
/**
 * Liveness information for a single block.
 */
interface BlockLiveness {
  /** Values live at block entry */
  readonly liveIn: ReadonlySet<VirtualRegister>;
  
  /** Values live at block exit */
  readonly liveOut: ReadonlySet<VirtualRegister>;
}

/**
 * Complete liveness information for a function.
 */
interface LivenessInfo {
  /**
   * Get liveness at block boundaries.
   */
  getBlockLiveness(block: BasicBlock): BlockLiveness;
  
  /**
   * Check if a value is live at a specific instruction.
   */
  isLiveAt(reg: VirtualRegister, inst: ILInstruction): boolean;
  
  /**
   * Check if a value is live after a specific instruction.
   */
  isLiveAfter(reg: VirtualRegister, inst: ILInstruction): boolean;
  
  /**
   * Get all live values at an instruction.
   */
  getLiveAt(inst: ILInstruction): ReadonlySet<VirtualRegister>;
  
  /**
   * Get the number of live values at an instruction (for spill decisions).
   */
  getLiveCount(inst: ILInstruction): number;
}
```

---

## Implementation

### LivenessAnalysis Class

```typescript
import { AnalysisPass } from '../passes/analysis-pass.js';
import { ILFunction, BasicBlock, ILInstruction } from '../../il/index.js';

/**
 * Liveness analysis pass.
 * 
 * Computes which values are live at each program point using
 * backward dataflow analysis.
 * 
 * @example
 * ```typescript
 * const liveness = passManager.getAnalysis(LivenessAnalysis, func);
 * if (!liveness.isLiveAfter(reg, inst)) {
 *   // reg is dead after inst, can reuse its register
 * }
 * ```
 */
export class LivenessAnalysis extends AnalysisPass<LivenessInfo> {
  static override readonly passName = 'liveness';
  static override readonly description = 'Liveness analysis';
  
  /** Block liveness: block → {liveIn, liveOut} */
  protected blockLiveness = new Map<BasicBlock, {
    liveIn: Set<VirtualRegister>;
    liveOut: Set<VirtualRegister>;
  }>();
  
  /** Def sets: block → defined values */
  protected defSets = new Map<BasicBlock, Set<VirtualRegister>>();
  
  /** Use sets: block → used values (before def) */
  protected useSets = new Map<BasicBlock, Set<VirtualRegister>>();
  
  /**
   * Run the analysis on a function.
   */
  override runOnFunction(func: ILFunction): LivenessInfo {
    this.clear();
    
    // Step 1: Compute Def and Use sets for each block
    for (const block of func.getBlocks()) {
      this.computeDefUse(block);
    }
    
    // Step 2: Iterate dataflow equations until fixpoint
    this.computeLiveness(func);
    
    return this.buildResult(func);
  }
  
  /**
   * Compute Def and Use sets for a block.
   */
  protected computeDefUse(block: BasicBlock): void {
    const def = new Set<VirtualRegister>();
    const use = new Set<VirtualRegister>();
    
    for (const inst of block.getInstructions()) {
      // Uses: operands that haven't been defined in this block yet
      for (const operand of inst.getOperands()) {
        if (this.isVirtualRegister(operand) && !def.has(operand)) {
          use.add(operand);
        }
      }
      
      // Defs: results of instructions
      const result = inst.getResult();
      if (result && this.isVirtualRegister(result)) {
        def.add(result);
      }
    }
    
    this.defSets.set(block, def);
    this.useSets.set(block, use);
    
    // Initialize liveness sets
    this.blockLiveness.set(block, {
      liveIn: new Set(),
      liveOut: new Set()
    });
  }
  
  /**
   * Iterate dataflow equations until fixpoint.
   */
  protected computeLiveness(func: ILFunction): void {
    // Get blocks in reverse post-order (better convergence for backward analysis)
    const blocks = this.getReversePostOrder(func);
    
    let changed = true;
    while (changed) {
      changed = false;
      
      // Process blocks in reverse order (backward analysis)
      for (let i = blocks.length - 1; i >= 0; i--) {
        const block = blocks[i];
        const liveness = this.blockLiveness.get(block)!;
        const def = this.defSets.get(block)!;
        const use = this.useSets.get(block)!;
        
        // LiveOut = ∪ LiveIn(successors)
        const newLiveOut = new Set<VirtualRegister>();
        for (const succ of block.getSuccessors()) {
          const succLiveness = this.blockLiveness.get(succ);
          if (succLiveness) {
            for (const reg of succLiveness.liveIn) {
              newLiveOut.add(reg);
            }
          }
        }
        
        // LiveIn = Use ∪ (LiveOut - Def)
        const newLiveIn = new Set<VirtualRegister>(use);
        for (const reg of newLiveOut) {
          if (!def.has(reg)) {
            newLiveIn.add(reg);
          }
        }
        
        // Check for changes
        if (!this.setsEqual(liveness.liveIn, newLiveIn) ||
            !this.setsEqual(liveness.liveOut, newLiveOut)) {
          changed = true;
          liveness.liveIn = newLiveIn;
          liveness.liveOut = newLiveOut;
        }
      }
    }
  }
  
  /**
   * Build the final result object with instruction-level queries.
   */
  protected buildResult(func: ILFunction): LivenessInfo {
    const blockLiveness = this.blockLiveness;
    
    // Precompute instruction-level liveness for efficiency
    const instLiveness = new Map<ILInstruction, Set<VirtualRegister>>();
    
    for (const block of func.getBlocks()) {
      const liveness = blockLiveness.get(block)!;
      let currentLive = new Set(liveness.liveOut);
      
      // Process instructions backward
      const instructions = block.getInstructions();
      for (let i = instructions.length - 1; i >= 0; i--) {
        const inst = instructions[i];
        
        // Store liveness BEFORE this instruction
        instLiveness.set(inst, new Set(currentLive));
        
        // Update: remove defs, add uses
        const result = inst.getResult();
        if (result && this.isVirtualRegister(result)) {
          currentLive.delete(result);
        }
        for (const operand of inst.getOperands()) {
          if (this.isVirtualRegister(operand)) {
            currentLive.add(operand);
          }
        }
      }
    }
    
    return {
      getBlockLiveness(block: BasicBlock): BlockLiveness {
        const liveness = blockLiveness.get(block);
        if (!liveness) {
          return { liveIn: new Set(), liveOut: new Set() };
        }
        return {
          liveIn: new Set(liveness.liveIn),
          liveOut: new Set(liveness.liveOut)
        };
      },
      
      isLiveAt(reg: VirtualRegister, inst: ILInstruction): boolean {
        const live = instLiveness.get(inst);
        return live?.has(reg) ?? false;
      },
      
      isLiveAfter(reg: VirtualRegister, inst: ILInstruction): boolean {
        // Value is live after if it's in the liveness set (computed backward)
        const live = instLiveness.get(inst);
        if (!live) return false;
        
        // If this instruction defines reg, it's not live after
        // (unless used by a later instruction)
        const result = inst.getResult();
        if (result === reg) {
          return live.has(reg);  // Only if still in use set
        }
        
        return live.has(reg);
      },
      
      getLiveAt(inst: ILInstruction): ReadonlySet<VirtualRegister> {
        return instLiveness.get(inst) ?? new Set();
      },
      
      getLiveCount(inst: ILInstruction): number {
        return instLiveness.get(inst)?.size ?? 0;
      }
    };
  }
  
  /**
   * Get blocks in reverse post-order.
   */
  protected getReversePostOrder(func: ILFunction): BasicBlock[] {
    const visited = new Set<BasicBlock>();
    const postOrder: BasicBlock[] = [];
    
    const visit = (block: BasicBlock) => {
      if (visited.has(block)) return;
      visited.add(block);
      
      for (const succ of block.getSuccessors()) {
        visit(succ);
      }
      
      postOrder.push(block);
    };
    
    visit(func.getEntryBlock());
    
    return postOrder.reverse();
  }
  
  /**
   * Check if a value is a virtual register.
   */
  protected isVirtualRegister(value: ILValue): value is VirtualRegister {
    return value.kind === 'virtual-register';
  }
  
  /**
   * Check if two sets are equal.
   */
  protected setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
    if (a.size !== b.size) return false;
    for (const item of a) {
      if (!b.has(item)) return false;
    }
    return true;
  }
  
  /**
   * Clear analysis state.
   */
  protected clear(): void {
    this.blockLiveness.clear();
    this.defSets.clear();
    this.useSets.clear();
  }
}
```

---

## Usage Examples

### Register Allocation

```typescript
// In register allocator
const liveness = this.manager.getAnalysis(LivenessAnalysis, func);

for (const block of func.getBlocks()) {
  for (const inst of block.getInstructions()) {
    const liveCount = liveness.getLiveCount(inst);
    
    // If more values live than physical registers, need to spill
    if (liveCount > PHYSICAL_REGISTERS) {
      selectSpillCandidate(inst, liveness.getLiveAt(inst));
    }
  }
}
```

### Dead Store Elimination

```typescript
// Find stores to dead values
for (const inst of getStoreInstructions(func)) {
  const destReg = inst.getDestination();
  
  // If value is not live after the store, it's dead
  if (!liveness.isLiveAfter(destReg, inst)) {
    // This store is useless, can delete
    block.removeInstruction(inst);
  }
}
```

### Live Range Computation

```typescript
// Compute live range for a value (start to end instruction)
function getLiveRange(reg: VirtualRegister, func: ILFunction): [ILInstruction, ILInstruction] {
  let first: ILInstruction | null = null;
  let last: ILInstruction | null = null;
  
  for (const block of func.getBlocks()) {
    for (const inst of block.getInstructions()) {
      if (liveness.isLiveAt(reg, inst)) {
        if (!first) first = inst;
        last = inst;
      }
    }
  }
  
  return [first!, last!];
}
```

---

## Edge Cases

### Loop-Carried Liveness

Values can be live across loop iterations:

```
loop_header:
  v1 = phi [init, entry], [v2, loop_body]  // v1 live from v2
  ...
  goto loop_body
  
loop_body:
  v2 = add v1, 1  // v1 used, v2 defined
  goto loop_header
```

The dataflow iteration handles this correctly because we iterate until fixpoint.

### Multiple Exits

Blocks with multiple successors union all successor liveness:

```
  if cond goto then_block else else_block
  
then_block:           else_block:
  use v1               use v2
  
// LiveOut of if block = {v1} ∪ {v2} = {v1, v2}
```

### Unreachable Code

Blocks not reachable from entry have empty liveness:

```typescript
protected computeLiveness(func: ILFunction): void {
  // getReversePostOrder only visits reachable blocks
  const blocks = this.getReversePostOrder(func);
  // Unreachable blocks remain with empty liveIn/liveOut
}
```

---

## Testing Strategy

### Test Categories

1. **Single block**: Basic liveness in straight-line code
2. **Sequential blocks**: Liveness across block boundaries
3. **Branches**: LiveOut with multiple successors
4. **Loops**: Fixpoint iteration for loop-carried liveness
5. **Dead values**: Values that are never live
6. **Instruction queries**: `isLiveAt`, `isLiveAfter` accuracy
7. **Live count**: Correct count for register pressure

### Example Tests

```typescript
describe('LivenessAnalysis', () => {
  it('should compute liveness for straight-line code', () => {
    const func = createFunction(`
      v1 = const 5
      v2 = add v1, 3
      return v2
    `);
    
    const liveness = new LivenessAnalysis().runOnFunction(func);
    const block = func.getEntryBlock();
    const blockLive = liveness.getBlockLiveness(block);
    
    // Nothing live at entry
    expect(blockLive.liveIn.size).toBe(0);
    // Nothing live at exit (return consumes v2)
    expect(blockLive.liveOut.size).toBe(0);
  });
  
  it('should handle branches correctly', () => {
    const func = createFunction(`
    entry:
      v1 = const 5
      v2 = const 10
      br cond, then_block, else_block
      
    then_block:
      return v1
      
    else_block:
      return v2
    `);
    
    const liveness = new LivenessAnalysis().runOnFunction(func);
    const entry = func.getBlockByName('entry');
    const entryLive = liveness.getBlockLiveness(entry);
    
    // Both v1 and v2 must be live at exit
    expect(entryLive.liveOut.has(v1)).toBe(true);
    expect(entryLive.liveOut.has(v2)).toBe(true);
  });
  
  it('should detect dead values', () => {
    const func = createFunction(`
      v1 = const 5
      v2 = const 10   // Never used
      return v1
    `);
    
    const liveness = new LivenessAnalysis().runOnFunction(func);
    const returnInst = findInstruction(func, 'return');
    
    expect(liveness.isLiveAt(v1, returnInst)).toBe(true);
    expect(liveness.isLiveAt(v2, returnInst)).toBe(false);
  });
});
```

---

## File Location

```
packages/compiler/src/optimizer/analysis/liveness.ts
```

---

## Dependencies

| Dependency | From | Purpose |
|------------|------|---------|
| `AnalysisPass` | Phase 1 | Base class |
| `ILFunction` | IL Generator | Function to analyze |
| `BasicBlock` | IL Generator | Block iteration, successors |
| `ILInstruction` | IL Generator | Instruction inspection |
| `VirtualRegister` | IL Generator | Register tracking |

---

## Complexity Analysis

| Operation | Complexity |
|-----------|------------|
| Compute Def/Use | O(n) per block |
| Fixpoint iteration | O(n × b) worst case |
| `getBlockLiveness` | O(1) |
| `isLiveAt` | O(1) with precomputation |
| Total | O(n × b) where n=instructions, b=blocks |

---

## Next Steps

After implementing Liveness Analysis:
1. Register with PassManager
2. Integrate caching (analyses cached until IL changes)
3. Use in Phase 3 transforms (DCE, Copy Propagation)

---

**Parent**: [Phase 2 Index](00-phase-index.md)  
**Previous**: [Use-Def Analysis](01-use-def.md)  
**Next**: [Phase Tasks](99-phase-tasks.md)