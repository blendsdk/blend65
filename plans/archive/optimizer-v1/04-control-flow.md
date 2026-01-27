# Phase 4: Control Flow Optimizations

> **Phase**: 4 of 11  
> **Est. Time**: ~16 hours  
> **Tasks**: 8  
> **Tests**: ~300  
> **Prerequisites**: Phase 3 (Classical Optimizations)

---

## Overview

Control flow optimizations improve the **structure** of the program's control flow graph. These transforms reduce branches, simplify conditionals, and eliminate unreachable code.

---

## Directory Structure Created

```
packages/compiler/src/optimizer/transforms/
├── ... (existing)
├── simplify-cfg.ts             # CFG simplification
├── unreachable.ts              # Unreachable code elimination
├── branch-fold.ts              # Branch folding
├── tail-merge.ts               # Tail merging
├── jump-thread.ts              # Jump threading
├── cross-jump.ts               # Cross-jumping
└── tail-call.ts                # Tail call optimization
```

---

## Task 4.1: Unreachable Code Elimination

**Time**: 1.5 hours  
**Tests**: 35 tests

**Key Concepts**:
- Remove blocks not reachable from entry
- Fix CFG predecessors/successors
- Common after constant branch folding

**File**: `packages/compiler/src/optimizer/transforms/unreachable.ts`

```typescript
/**
 * Unreachable Code Elimination
 * 
 * Removes basic blocks that cannot be reached from the entry block.
 */
export class UnreachableEliminationPass extends TransformPass {
  readonly name = 'unreachable-elim';
  readonly requires = ['dominator-tree'];
  readonly invalidates = ['*cfg*', 'liveness', 'loop-info'];
  readonly levels = [O1, O2, O3, Os, Oz];
  
  transform(func: ILFunction): boolean {
    const reachable = new Set<BasicBlock>();
    const worklist: BasicBlock[] = [func.getEntryBlock()];
    
    // 1. Find all reachable blocks via BFS
    while (worklist.length > 0) {
      const block = worklist.pop()!;
      if (reachable.has(block)) continue;
      reachable.add(block);
      
      for (const succ of block.getSuccessors()) {
        if (!reachable.has(succ)) {
          worklist.push(succ);
        }
      }
    }
    
    // 2. Remove unreachable blocks
    let changed = false;
    for (const block of [...func.getBlocks()]) {
      if (!reachable.has(block)) {
        // Remove phi inputs from successors
        for (const succ of block.getSuccessors()) {
          this.removePhiInputs(succ, block);
        }
        func.removeBlock(block);
        changed = true;
      }
    }
    
    return changed;
  }
}
```

**Tests**:
- All blocks reachable (no change)
- Single unreachable block
- Chain of unreachable blocks
- Unreachable with phi inputs to reachable
- Unreachable loop
- Entry block always kept

---

## Task 4.2: Branch Folding

**Time**: 2 hours  
**Tests**: 40 tests

**Key Concepts**:
- Fold conditional branches with constant conditions
- `if (true)` → unconditional jump to then
- `if (false)` → unconditional jump to else

**File**: `packages/compiler/src/optimizer/transforms/branch-fold.ts`

```typescript
/**
 * Branch Folding
 * 
 * Converts conditional branches with constant conditions
 * to unconditional jumps.
 */
export class BranchFoldPass extends TransformPass {
  readonly name = 'branch-fold';
  readonly requires = [];
  readonly invalidates = ['*cfg*', 'dominator-tree'];
  readonly levels = [O1, O2, O3, Os, Oz];
  
  transform(func: ILFunction): boolean {
    let changed = false;
    
    for (const block of func.getBlocks()) {
      const terminator = block.getTerminator();
      
      if (terminator.isBranch()) {
        const condition = terminator.getCondition();
        
        if (condition.isConstant()) {
          const value = condition.getConstantValue();
          const target = value ? terminator.getTrueBranch() : terminator.getFalseBranch();
          const dead = value ? terminator.getFalseBranch() : terminator.getTrueBranch();
          
          // Replace branch with jump
          block.setTerminator(new JumpInstruction(target));
          
          // Remove phi input from dead branch
          this.removePhiInput(dead, block);
          
          changed = true;
        }
      }
    }
    
    return changed;
  }
}
```

**Tests**:
- if(true) → then
- if(false) → else
- Constant comparison folded to branch
- Nested conditionals
- Loop exit conditions

---

## Task 4.3: CFG Simplification

**Time**: 2.5 hours  
**Tests**: 45 tests

**Key Concepts**:
- Merge blocks with single predecessor/successor
- Remove empty blocks
- Simplify trivial phi nodes

**File**: `packages/compiler/src/optimizer/transforms/simplify-cfg.ts`

```typescript
/**
 * CFG Simplification
 * 
 * Simplifies the control flow graph by merging blocks,
 * removing empty blocks, and simplifying phi nodes.
 */
export class SimplifyCFGPass extends TransformPass {
  readonly name = 'simplify-cfg';
  readonly requires = [];
  readonly invalidates = ['*cfg*', 'dominator-tree', 'loop-info'];
  readonly levels = [O1, O2, O3, Os, Oz];
  
  transform(func: ILFunction): boolean {
    let changed = false;
    let madeProgress: boolean;
    
    do {
      madeProgress = false;
      
      // 1. Merge blocks with single pred/succ
      madeProgress = this.mergeBlocks(func) || madeProgress;
      
      // 2. Remove empty blocks
      madeProgress = this.removeEmptyBlocks(func) || madeProgress;
      
      // 3. Simplify trivial phis
      madeProgress = this.simplifyPhis(func) || madeProgress;
      
      // 4. Thread jumps through empty blocks
      madeProgress = this.threadJumps(func) || madeProgress;
      
      changed = changed || madeProgress;
    } while (madeProgress);
    
    return changed;
  }
  
  /** Merge B into A if A→B is only edge to B and B has single pred */
  protected mergeBlocks(func: ILFunction): boolean {
    let changed = false;
    
    for (const block of func.getBlocks()) {
      if (block.getSuccessors().length === 1) {
        const succ = block.getSuccessors()[0];
        if (succ.getPredecessors().length === 1) {
          // Merge succ into block
          this.merge(block, succ);
          func.removeBlock(succ);
          changed = true;
        }
      }
    }
    
    return changed;
  }
}
```

**Tests**:
- Single pred/succ merge
- Empty block removal
- Jump chain threading
- Trivial phi (single input) simplification
- Multiple merge rounds
- No merge of loop headers

---

## Task 4.4: Tail Merging

**Time**: 2 hours  
**Tests**: 35 tests

**Key Concepts**:
- Merge identical code at ends of different blocks
- Reduces code size
- Important for -Os and -Oz

**File**: `packages/compiler/src/optimizer/transforms/tail-merge.ts`

```typescript
/**
 * Tail Merging
 * 
 * Merges identical instruction sequences at the ends of blocks
 * that jump to the same successor.
 */
export class TailMergePass extends TransformPass {
  readonly name = 'tail-merge';
  readonly requires = ['dominator-tree'];
  readonly invalidates = ['*cfg*', 'liveness'];
  readonly levels = [Os, Oz];  // Size optimization only
  
  transform(func: ILFunction): boolean {
    let changed = false;
    
    // Find blocks with same successor
    const bySuccessor = this.groupBySuccessor(func);
    
    for (const [succ, preds] of bySuccessor) {
      if (preds.length < 2) continue;
      
      // Find common tail
      const commonTail = this.findCommonTail(preds);
      if (commonTail.length < this.minTailLength) continue;
      
      // Create merged block
      changed = this.createMergedTail(func, preds, commonTail, succ) || changed;
    }
    
    return changed;
  }
  
  protected findCommonTail(blocks: BasicBlock[]): ILInstruction[] {
    // Compare instructions from end
    const tails = blocks.map(b => [...b.getInstructions()].reverse());
    const common: ILInstruction[] = [];
    
    for (let i = 0; ; i++) {
      const insts = tails.map(t => t[i]);
      if (!insts.every(inst => inst && this.instructionsEqual(inst, insts[0]))) {
        break;
      }
      common.push(insts[0]);
    }
    
    return common.reverse();
  }
}
```

**Tests**:
- Two blocks with identical tail
- Multiple blocks with common tail
- Partial tail match
- No match (different instructions)
- Minimum tail length threshold

---

## Task 4.5: Jump Threading

**Time**: 2 hours  
**Tests**: 40 tests

**Key Concepts**:
- Thread jumps through blocks that just compute and branch
- Reduces branches by going directly to final target
- Must be careful with code duplication

**File**: `packages/compiler/src/optimizer/transforms/jump-thread.ts`

```typescript
/**
 * Jump Threading
 * 
 * Threads jumps through blocks where the branch target
 * is determined by values from predecessors.
 */
export class JumpThreadingPass extends TransformPass {
  readonly name = 'jump-threading';
  readonly requires = ['dominator-tree', 'correlated-values'];
  readonly invalidates = ['*cfg*', 'liveness'];
  readonly levels = [O2, O3];
  
  transform(func: ILFunction): boolean {
    let changed = false;
    const correlatedValues = this.getAnalysis<CorrelatedValueInfo>('correlated-values', func);
    
    for (const block of func.getBlocks()) {
      const terminator = block.getTerminator();
      
      if (!terminator.isBranch()) continue;
      
      for (const pred of block.getPredecessors()) {
        // Check if we can determine branch outcome from pred
        const outcome = this.determineBranchOutcome(
          terminator, pred, correlatedValues
        );
        
        if (outcome !== null) {
          // Thread pred directly to target
          const target = outcome ? terminator.getTrueBranch() : terminator.getFalseBranch();
          this.threadEdge(pred, block, target);
          changed = true;
        }
      }
    }
    
    return changed;
  }
}
```

**Tests**:
- Thread based on constant
- Thread based on correlated value
- Thread through chain of jumps
- No thread when would duplicate too much code
- Loop edge handling

---

## Task 4.6: Conditional Move Conversion (Diamond → SELECT)

**Time**: 1.5 hours  
**Tests**: 30 tests

**Key Concepts**:
- Convert simple if-then-else to conditional assignment
- **Primary use case: Ternary operator diamond patterns**
- Reduces branches (good for 6502)
- Limited by 6502's lack of CMOV instruction

**File**: `packages/compiler/src/optimizer/transforms/if-convert.ts`

```typescript
/**
 * If Conversion (Conditional Move)
 * 
 * Converts simple if-then-else patterns to conditional
 * assignments where profitable.
 * 
 * Note: 6502 has no CMOV, so this generates:
 *   LDA thenValue
 *   condition? -> skip
 *   LDA elseValue
 * skip:
 */
export class IfConvertPass extends TransformPass {
  readonly name = 'if-convert';
  readonly requires = ['dominator-tree'];
  readonly invalidates = ['*cfg*'];
  readonly levels = [O2, O3];
  
  transform(func: ILFunction): boolean {
    let changed = false;
    
    for (const block of func.getBlocks()) {
      // Look for diamond pattern: block → [then, else] → merge
      const diamond = this.findDiamond(block);
      if (!diamond) continue;
      
      // Check if profitable to convert
      if (!this.isProfitable(diamond)) continue;
      
      // Convert to conditional assignment
      changed = this.convertDiamond(diamond) || changed;
    }
    
    return changed;
  }
  
  protected isProfitable(diamond: DiamondPattern): boolean {
    // Only convert if then/else are single instruction each
    return diamond.thenBlock.getInstructionCount() <= 1 &&
           diamond.elseBlock.getInstructionCount() <= 1;
  }
}
```

**Tests**:
- Simple if-then-else to select
- Not profitable (complex then/else)
- Nested diamonds
- Side effects prevent conversion

### Ternary Operator Diamond Pattern

The ternary operator (`?:`) generates a characteristic diamond CFG pattern:

```
┌─────────────────────┐
│   BRANCH cond       │
│     /         \     │
│    ▼           ▼    │
│ true_block  false_block │
│  (value1)    (value2)   │
│    \           /    │
│     ▼         ▼     │
│   merge_block       │
│   PHI(v1,v2)        │
└─────────────────────┘
```

**Example IL from ternary:**
```
let x: byte = cond ? 10 : 20;
```

```
block_0:
  %cond = LOAD cond
  BRANCH %cond, block_true, block_false

block_true:
  %1 = CONST 10
  JUMP block_merge

block_false:
  %2 = CONST 20
  JUMP block_merge

block_merge:
  %3 = PHI [%1, block_true], [%2, block_false]
  STORE x, %3
```

**Optimization Goal:** Convert to SELECT instruction:
```
block_0:
  %cond = LOAD cond
  %1 = CONST 10
  %2 = CONST 20
  %3 = SELECT %cond, %1, %2
  STORE x, %3
```

**See also:** [08-13-ternary-patterns.md](08-13-ternary-patterns.md) for comprehensive ternary optimization patterns.

---

## Task 4.7: Cross-Jumping

**Time**: 2 hours  
**Tests**: 35 tests

**Key Concepts**:
- Like tail merging but for non-adjacent blocks
- Find identical code sequences anywhere
- More aggressive than tail merging

**File**: `packages/compiler/src/optimizer/transforms/cross-jump.ts`

```typescript
/**
 * Cross-Jumping
 * 
 * Finds identical code sequences in different blocks
 * and merges them by introducing jumps.
 */
export class CrossJumpPass extends TransformPass {
  readonly name = 'cross-jump';
  readonly requires = [];
  readonly invalidates = ['*cfg*'];
  readonly levels = [Os, Oz];  // Size optimization
  
  transform(func: ILFunction): boolean {
    let changed = false;
    const blocks = func.getBlocks();
    
    // Compare all pairs of blocks
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const common = this.findCommonSequence(blocks[i], blocks[j]);
        
        if (common.length >= this.minSequenceLength) {
          changed = this.mergeSequence(func, blocks[i], blocks[j], common) || changed;
        }
      }
    }
    
    return changed;
  }
}
```

**Tests**:
- Identical sequences merged
- Partial sequence match
- Multiple merge opportunities
- No merge when too small

---

## Task 4.8: Tail Call Optimization

**Time**: 2.5 hours  
**Tests**: 40 tests

**Key Concepts**:
- Convert `call f; return` to `jump f`
- Eliminates stack frame
- Critical for recursive functions on 6502 (256-byte stack!)

**File**: `packages/compiler/src/optimizer/transforms/tail-call.ts`

```typescript
/**
 * Tail Call Optimization
 * 
 * Converts tail calls (call followed by return) to jumps.
 * Critical for 6502 due to 256-byte stack limit.
 */
export class TailCallPass extends TransformPass {
  readonly name = 'tail-call';
  readonly requires = [];
  readonly invalidates = [];
  readonly levels = [O1, O2, O3, Os, Oz];  // All levels - critical for 6502
  
  transform(func: ILFunction): boolean {
    let changed = false;
    
    for (const block of func.getBlocks()) {
      const terminator = block.getTerminator();
      
      // Look for: CALL followed by RETURN
      if (!terminator.isReturn()) continue;
      
      const lastInst = block.getLastNonTerminator();
      if (!lastInst || !lastInst.isCall()) continue;
      
      // Check if return value is call result (or void)
      if (!this.isReturnValueFromCall(terminator, lastInst)) continue;
      
      // Check if we can safely transform (no cleanup needed)
      if (!this.canTailCall(func, lastInst)) continue;
      
      // Transform: replace CALL with tail call
      this.convertToTailCall(block, lastInst);
      changed = true;
    }
    
    return changed;
  }
  
  protected canTailCall(func: ILFunction, call: ILInstruction): boolean {
    // Must not have any live locals after call
    // Must not need stack cleanup
    // Callee must have compatible calling convention
    return true; // Simplified - real implementation checks these
  }
}
```

**Tests**:
- Simple tail call
- Tail recursion
- No optimization if work after call
- No optimization if return value differs
- Mutual tail recursion

---

## Phase 4 Task Checklist

| Task | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 4.1 | Unreachable elimination | 1.5 hr | 35 | [ ] |
| 4.2 | Branch folding | 2 hr | 40 | [ ] |
| 4.3 | CFG simplification | 2.5 hr | 45 | [ ] |
| 4.4 | Tail merging | 2 hr | 35 | [ ] |
| 4.5 | Jump threading | 2 hr | 40 | [ ] |
| 4.6 | If conversion | 1.5 hr | 30 | [ ] |
| 4.7 | Cross-jumping | 2 hr | 35 | [ ] |
| 4.8 | Tail call | 2.5 hr | 40 | [ ] |
| **Total** | | **16 hr** | **300** | |

---

## Success Criteria

- [ ] All 300 tests passing
- [ ] Unreachable code removed
- [ ] Constant branches folded
- [ ] CFG simplified after transforms
- [ ] Tail calls converted to jumps
- [ ] Code size reduced with -Os

---

## 6502-Specific Considerations

### Tail Call Critical for 6502

The 6502 has a **256-byte stack** at $0100-$01FF. Deep recursion quickly causes stack overflow. Tail call optimization converts recursion to iteration:

```asm
; Before TCO (uses stack)
factorial:
  JSR factorial  ; Push return address
  RTS            ; Pop return address
  
; After TCO (no stack growth)
factorial:
  JMP factorial  ; No stack usage!
```

### Branch Distance Awareness

6502 branches have limited range (-128 to +127 bytes). CFG transforms should consider:
- Prefer short branches where possible
- May need JMP if branch target too far
- Impact of block reordering on branch distances

---

## Implementation Sessions

| Session | Tasks | Focus |
|---------|-------|-------|
| Session 1 | 4.1, 4.2 | Unreachable + Branch folding |
| Session 2 | 4.3 | CFG simplification |
| Session 3 | 4.4, 4.5 | Tail merge + Jump threading |
| Session 4 | 4.6, 4.7, 4.8 | If-convert + Cross-jump + TCO |

---

**Previous**: [03-classical-optimizations.md](03-classical-optimizations.md)  
**Next**: [05-loop-optimizations.md](05-loop-optimizations.md)