# Phase 5: Loop Optimizations

> **Phase**: 5 of 11  
> **Est. Time**: ~20 hours  
> **Tasks**: 10  
> **Tests**: ~400  
> **Prerequisites**: Phase 4 (Control Flow Optimizations)

---

## Overview

Loop optimizations are among the most impactful transforms because programs spend most of their time in loops. These optimizations reduce loop overhead, move invariant code out of loops, and transform loop structures for better performance.

---

## Directory Structure Created

```
packages/compiler/src/optimizer/loop/
├── index.ts                    # Loop optimization exports
├── licm.ts                     # Loop invariant code motion
├── unroll.ts                   # Loop unrolling
├── strength-reduce.ts          # Induction variable strength reduction
├── rotate.ts                   # Loop rotation
├── unswitch.ts                 # Loop unswitching
├── fusion.ts                   # Loop fusion
├── distribute.ts               # Loop distribution
├── lcssa.ts                    # Loop-closed SSA form
└── bounds.ts                   # Loop bounds analysis
```

---

## Task 5.1: Loop Invariant Code Motion (LICM)

**Time**: 2.5 hours  
**Tests**: 50 tests

**Key Concepts**:
- Move computations that don't change within a loop to outside the loop
- Requires alias analysis to ensure safety
- One of the most effective optimizations

**File**: `packages/compiler/src/optimizer/loop/licm.ts`

```typescript
/**
 * Loop Invariant Code Motion (LICM)
 * 
 * Moves instructions whose operands don't change within
 * a loop to the loop's preheader.
 */
export class LICMPass extends TransformPass {
  readonly name = 'licm';
  readonly requires = ['loop-info', 'alias-analysis', 'dominator-tree'];
  readonly invalidates = ['liveness'];
  readonly levels = [O2, O3, Os];
  
  transform(func: ILFunction): boolean {
    let changed = false;
    const loopInfo = this.getAnalysis<LoopInfo>('loop-info', func);
    const aliasAnalysis = this.getAnalysis<AliasAnalysis>('alias-analysis', func);
    
    // Process loops from innermost to outermost
    for (const loop of loopInfo.getLoopsInPostOrder()) {
      changed = this.hoistInvariants(loop, aliasAnalysis) || changed;
    }
    
    return changed;
  }
  
  protected hoistInvariants(loop: Loop, aa: AliasAnalysis): boolean {
    let changed = false;
    const preheader = loop.getPreheader();
    if (!preheader) return false;
    
    for (const block of loop.getBlocks()) {
      for (const inst of [...block.getInstructions()]) {
        if (this.isLoopInvariant(inst, loop, aa) && this.isSafeToHoist(inst, loop)) {
          // Move instruction to preheader
          block.removeInstruction(inst);
          preheader.insertBeforeTerminator(inst);
          changed = true;
        }
      }
    }
    
    return changed;
  }
  
  protected isLoopInvariant(inst: ILInstruction, loop: Loop, aa: AliasAnalysis): boolean {
    // All operands must be defined outside loop or be loop invariant
    for (const operand of inst.getOperands()) {
      if (operand.isInstruction()) {
        const defBlock = operand.getDefiningBlock();
        if (loop.contains(defBlock)) {
          return false;
        }
      }
    }
    
    // Must not read memory that could be modified in loop
    if (inst.mayReadMemory()) {
      for (const loopBlock of loop.getBlocks()) {
        for (const loopInst of loopBlock.getInstructions()) {
          if (loopInst.mayWriteMemory() && aa.mayAlias(inst, loopInst)) {
            return false;
          }
        }
      }
    }
    
    return true;
  }
}
```

**Tests**:
- Hoist constant computation
- Hoist address calculation
- Don't hoist memory read with aliasing store
- Hoist from nested loops
- Preheader creation if missing

---

## Task 5.2: Loop Unrolling

**Time**: 2.5 hours  
**Tests**: 45 tests

**Key Concepts**:
- Duplicate loop body to reduce loop overhead
- Full unroll for small constant trip counts
- Partial unroll for larger loops
- Critical: 6502 branches limited range

**File**: `packages/compiler/src/optimizer/loop/unroll.ts`

```typescript
/**
 * Loop Unrolling
 * 
 * Duplicates loop body to reduce branch overhead
 * and enable further optimizations.
 */
export class LoopUnrollPass extends TransformPass {
  readonly name = 'loop-unroll';
  readonly requires = ['loop-info', 'loop-bounds'];
  readonly invalidates = ['*'];
  readonly levels = [O3];  // Only at -O3 (increases code size)
  
  protected maxFullUnrollIterations = 8;
  protected maxPartialUnrollFactor = 4;
  
  transform(func: ILFunction): boolean {
    let changed = false;
    const loopInfo = this.getAnalysis<LoopInfo>('loop-info', func);
    const bounds = this.getAnalysis<LoopBoundsInfo>('loop-bounds', func);
    
    for (const loop of loopInfo.getLoopsInPostOrder()) {
      const tripCount = bounds.getTripCount(loop);
      
      if (tripCount !== null && tripCount <= this.maxFullUnrollIterations) {
        // Full unroll
        changed = this.fullyUnroll(loop, tripCount) || changed;
      } else if (this.shouldPartialUnroll(loop)) {
        // Partial unroll
        changed = this.partialUnroll(loop, this.maxPartialUnrollFactor) || changed;
      }
    }
    
    return changed;
  }
  
  protected fullyUnroll(loop: Loop, tripCount: number): boolean {
    // Duplicate loop body tripCount times
    // Remove loop back-edge
    // Connect duplicated bodies sequentially
    return true;
  }
  
  protected partialUnroll(loop: Loop, factor: number): boolean {
    // Duplicate body factor times
    // Adjust induction variable increment
    // Add epilogue for remainder iterations
    return true;
  }
}
```

**Tests**:
- Full unroll for i=0 to 4
- Partial unroll with factor 2
- Don't unroll if body too large
- Handle remainder iterations
- Nested loop unrolling

---

## Task 5.3: Loop Rotation

**Time**: 1.5 hours  
**Tests**: 35 tests

**Key Concepts**:
- Transform while loop to do-while with guard
- Moves loop test to end
- Enables other optimizations

**File**: `packages/compiler/src/optimizer/loop/rotate.ts`

```typescript
/**
 * Loop Rotation
 * 
 * Transforms while(cond) { body } to:
 * if (cond) { do { body } while(cond) }
 * 
 * This moves the loop test to the end, enabling
 * better optimization of the loop body.
 */
export class LoopRotatePass extends TransformPass {
  readonly name = 'loop-rotate';
  readonly requires = ['loop-info'];
  readonly invalidates = ['loop-info', '*cfg*'];
  readonly levels = [O2, O3];
  
  transform(func: ILFunction): boolean {
    let changed = false;
    const loopInfo = this.getAnalysis<LoopInfo>('loop-info', func);
    
    for (const loop of loopInfo.getLoops()) {
      if (this.shouldRotate(loop)) {
        changed = this.rotateLoop(loop) || changed;
      }
    }
    
    return changed;
  }
  
  protected shouldRotate(loop: Loop): boolean {
    // Only rotate if header has conditional branch
    // Don't rotate if already bottom-tested
    const header = loop.getHeader();
    return header.getTerminator().isBranch();
  }
  
  protected rotateLoop(loop: Loop): boolean {
    // 1. Create guard block before loop
    // 2. Duplicate header condition as guard
    // 3. Move condition test to end of loop body
    // 4. Update phi nodes
    return true;
  }
}
```

**Tests**:
- Rotate simple while loop
- Already rotated (no change)
- Nested loop rotation
- Phi node updates

---

## Task 5.4: Loop Unswitching

**Time**: 2 hours  
**Tests**: 40 tests

**Key Concepts**:
- Move loop-invariant conditionals outside loop
- Creates two versions of the loop
- Trade-off: code size vs. speed

**File**: `packages/compiler/src/optimizer/loop/unswitch.ts`

```typescript
/**
 * Loop Unswitching
 * 
 * Moves loop-invariant conditionals outside the loop
 * by creating two versions of the loop.
 * 
 * Before: for(...) { if(invariant) { A } else { B } }
 * After:  if(invariant) { for(...) { A } } else { for(...) { B } }
 */
export class LoopUnswitchPass extends TransformPass {
  readonly name = 'loop-unswitch';
  readonly requires = ['loop-info'];
  readonly invalidates = ['*'];
  readonly levels = [O3];  // Only at -O3 (duplicates code)
  
  transform(func: ILFunction): boolean {
    let changed = false;
    const loopInfo = this.getAnalysis<LoopInfo>('loop-info', func);
    
    for (const loop of loopInfo.getLoops()) {
      const unswitchable = this.findUnswitchableCondition(loop);
      
      if (unswitchable && this.isProfitable(loop, unswitchable)) {
        changed = this.unswitchLoop(loop, unswitchable) || changed;
      }
    }
    
    return changed;
  }
  
  protected findUnswitchableCondition(loop: Loop): ILInstruction | null {
    for (const block of loop.getBlocks()) {
      const term = block.getTerminator();
      if (term.isBranch()) {
        const cond = term.getCondition();
        if (this.isLoopInvariant(cond, loop)) {
          return term;
        }
      }
    }
    return null;
  }
}
```

**Tests**:
- Unswitch simple invariant condition
- Don't unswitch variant condition
- Profitability check
- Multiple unswitch candidates

---

## Task 5.5: Induction Variable Optimization

**Time**: 2 hours  
**Tests**: 45 tests

**Key Concepts**:
- Identify loop induction variables (i = i + 1)
- Simplify derived induction variables
- Essential for array indexing

**File**: `packages/compiler/src/optimizer/loop/induction.ts`

```typescript
/**
 * Induction Variable Optimization
 * 
 * Identifies and optimizes loop induction variables
 * and their derived expressions.
 */
export class InductionVarOptPass extends TransformPass {
  readonly name = 'indvar-opt';
  readonly requires = ['loop-info', 'loop-bounds'];
  readonly invalidates = ['loop-bounds'];
  readonly levels = [O2, O3];
  
  transform(func: ILFunction): boolean {
    let changed = false;
    const loopInfo = this.getAnalysis<LoopInfo>('loop-info', func);
    
    for (const loop of loopInfo.getLoops()) {
      // 1. Find basic induction variables
      const basicIVs = this.findBasicIVs(loop);
      
      // 2. Find derived induction variables
      const derivedIVs = this.findDerivedIVs(loop, basicIVs);
      
      // 3. Optimize derived IVs
      for (const [derived, base] of derivedIVs) {
        changed = this.optimizeDerivedIV(loop, derived, base) || changed;
      }
    }
    
    return changed;
  }
  
  protected findBasicIVs(loop: Loop): Set<Value> {
    const ivs = new Set<Value>();
    
    for (const phi of loop.getHeader().getPhis()) {
      // Check if phi has form: phi(init, phi + const)
      if (this.isLinearRecurrence(phi, loop)) {
        ivs.add(phi);
      }
    }
    
    return ivs;
  }
}
```

**Tests**:
- Identify i = i + 1
- Identify i = i - 1
- Derived IV: j = i * 4
- Replace IV with simplified form

---

## Task 5.6: Loop Strength Reduction

**Time**: 2 hours  
**Tests**: 40 tests

**Key Concepts**:
- Replace expensive operations with cheaper ones
- MUL → ADD (array[i] indexing)
- Critical for 6502 (no hardware multiply)

**File**: `packages/compiler/src/optimizer/loop/strength-reduce.ts`

```typescript
/**
 * Loop Strength Reduction
 * 
 * Replaces expensive operations (multiply) with
 * cheaper ones (add) based on induction variables.
 * 
 * Before: for(i) { a = i * 4 }
 * After:  t = 0; for(i) { a = t; t += 4 }
 */
export class LoopStrengthReducePass extends TransformPass {
  readonly name = 'loop-strength-reduce';
  readonly requires = ['loop-info', 'indvar-opt'];
  readonly invalidates = ['liveness'];
  readonly levels = [O2, O3, Os, Oz];
  
  transform(func: ILFunction): boolean {
    let changed = false;
    const loopInfo = this.getAnalysis<LoopInfo>('loop-info', func);
    
    for (const loop of loopInfo.getLoops()) {
      changed = this.reduceStrength(loop) || changed;
    }
    
    return changed;
  }
  
  protected reduceStrength(loop: Loop): boolean {
    let changed = false;
    
    for (const block of loop.getBlocks()) {
      for (const inst of block.getInstructions()) {
        if (inst.isMul()) {
          const reduction = this.canReduceMul(inst, loop);
          if (reduction) {
            this.applyReduction(loop, inst, reduction);
            changed = true;
          }
        }
      }
    }
    
    return changed;
  }
  
  protected canReduceMul(inst: ILInstruction, loop: Loop): StrengthReduction | null {
    // Check if MUL is IV * constant
    const [left, right] = inst.getOperands();
    
    if (left.isInductionVariable(loop) && right.isConstant()) {
      return { iv: left, multiplier: right.getConstantValue() };
    }
    
    if (right.isInductionVariable(loop) && left.isConstant()) {
      return { iv: right, multiplier: left.getConstantValue() };
    }
    
    return null;
  }
}
```

**Tests**:
- Reduce i * 4 to add sequence
- Reduce i * 2 (special case: shift)
- Don't reduce non-IV multiply
- Nested loop reduction

---

## Task 5.7: Loop Fusion

**Time**: 2 hours  
**Tests**: 35 tests

**Key Concepts**:
- Combine adjacent loops with same trip count
- Reduces loop overhead
- May improve cache locality

**File**: `packages/compiler/src/optimizer/loop/fusion.ts`

```typescript
/**
 * Loop Fusion
 * 
 * Merges adjacent loops with compatible trip counts
 * into a single loop.
 */
export class LoopFusionPass extends TransformPass {
  readonly name = 'loop-fusion';
  readonly requires = ['loop-info', 'loop-bounds', 'alias-analysis'];
  readonly invalidates = ['*'];
  readonly levels = [O3];
  
  transform(func: ILFunction): boolean {
    let changed = false;
    const loopInfo = this.getAnalysis<LoopInfo>('loop-info', func);
    const bounds = this.getAnalysis<LoopBoundsInfo>('loop-bounds', func);
    const aa = this.getAnalysis<AliasAnalysis>('alias-analysis', func);
    
    // Find fusible loop pairs
    const pairs = this.findFusiblePairs(loopInfo, bounds);
    
    for (const [loop1, loop2] of pairs) {
      if (this.isSafeToFuse(loop1, loop2, aa)) {
        changed = this.fuseLoops(loop1, loop2) || changed;
      }
    }
    
    return changed;
  }
  
  protected findFusiblePairs(loopInfo: LoopInfo, bounds: LoopBoundsInfo): [Loop, Loop][] {
    const pairs: [Loop, Loop][] = [];
    const loops = loopInfo.getTopLevelLoops();
    
    for (let i = 0; i < loops.length - 1; i++) {
      if (this.areAdjacent(loops[i], loops[i + 1]) &&
          bounds.haveSameTripCount(loops[i], loops[i + 1])) {
        pairs.push([loops[i], loops[i + 1]]);
      }
    }
    
    return pairs;
  }
}
```

**Tests**:
- Fuse identical trip count loops
- Don't fuse different trip counts
- Don't fuse with dependencies
- Multiple fusion candidates

---

## Task 5.8: Loop Distribution

**Time**: 1.5 hours  
**Tests**: 30 tests

**Key Concepts**:
- Split loop into multiple loops
- Opposite of fusion
- Can enable vectorization or parallelization

**File**: `packages/compiler/src/optimizer/loop/distribute.ts`

```typescript
/**
 * Loop Distribution
 * 
 * Splits a loop into multiple loops, each handling
 * independent parts of the original loop body.
 */
export class LoopDistributePass extends TransformPass {
  readonly name = 'loop-distribute';
  readonly requires = ['loop-info', 'memory-deps'];
  readonly invalidates = ['*'];
  readonly levels = [O3];
  
  transform(func: ILFunction): boolean {
    let changed = false;
    const loopInfo = this.getAnalysis<LoopInfo>('loop-info', func);
    
    for (const loop of loopInfo.getLoops()) {
      const partitions = this.findIndependentPartitions(loop);
      
      if (partitions.length > 1 && this.isProfitable(partitions)) {
        changed = this.distributeLoop(loop, partitions) || changed;
      }
    }
    
    return changed;
  }
}
```

**Tests**:
- Distribute independent operations
- Don't distribute with dependencies
- Two-way distribution
- Profitability check

---

## Task 5.9: Loop-Closed SSA Form

**Time**: 1.5 hours  
**Tests**: 35 tests

**Key Concepts**:
- Insert phi nodes at loop exits
- Ensures values defined in loop have single use point outside
- Simplifies other loop transforms

**File**: `packages/compiler/src/optimizer/loop/lcssa.ts`

```typescript
/**
 * Loop-Closed SSA Form (LCSSA)
 * 
 * Ensures that any value defined inside a loop that is
 * used outside the loop has a phi node at loop exits.
 */
export class LCSSAPass extends TransformPass {
  readonly name = 'lcssa';
  readonly requires = ['loop-info', 'dominator-tree'];
  readonly invalidates = [];
  readonly levels = [O2, O3, Os, Oz];
  
  transform(func: ILFunction): boolean {
    let changed = false;
    const loopInfo = this.getAnalysis<LoopInfo>('loop-info', func);
    
    for (const loop of loopInfo.getLoopsInPostOrder()) {
      changed = this.formLCSSA(loop) || changed;
    }
    
    return changed;
  }
  
  protected formLCSSA(loop: Loop): boolean {
    let changed = false;
    const exitBlocks = loop.getExitBlocks();
    
    for (const block of loop.getBlocks()) {
      for (const inst of block.getInstructions()) {
        // Check if instruction is used outside loop
        for (const use of inst.getUses()) {
          if (!loop.contains(use.getBlock())) {
            // Insert phi at exit block
            this.insertLCSSAPhi(inst, exitBlocks);
            changed = true;
          }
        }
      }
    }
    
    return changed;
  }
}
```

**Tests**:
- Insert LCSSA phi for loop-defined value
- Multiple uses outside loop
- Multiple exit blocks
- Already in LCSSA form

---

## Task 5.10: Loop Bounds Analysis

**Time**: 2 hours  
**Tests**: 45 tests

**Key Concepts**:
- Determine loop iteration counts
- Identify constant trip count loops
- Enable unrolling and other optimizations

**File**: `packages/compiler/src/optimizer/loop/bounds.ts`

```typescript
/**
 * Loop Bounds Analysis
 * 
 * Analyzes loops to determine iteration counts,
 * bounds, and other loop characteristics.
 */
export class LoopBoundsAnalysis extends AnalysisPass<LoopBoundsInfo> {
  readonly name = 'loop-bounds';
  readonly requires = ['loop-info'];
  
  analyze(func: ILFunction): LoopBoundsInfo {
    const loopInfo = this.getAnalysis<LoopInfo>('loop-info', func);
    const result = new LoopBoundsInfo();
    
    for (const loop of loopInfo.getLoops()) {
      const bounds = this.computeBounds(loop);
      result.setBounds(loop, bounds);
    }
    
    return result;
  }
  
  protected computeBounds(loop: Loop): LoopBounds {
    const iv = this.findCanonicalIV(loop);
    if (!iv) return { tripCount: null };
    
    const { start, end, step } = this.analyzeIV(iv, loop);
    
    if (start !== null && end !== null && step !== null) {
      // Compute trip count: (end - start) / step
      const tripCount = Math.ceil((end - start) / step);
      return { tripCount, start, end, step };
    }
    
    return { tripCount: null };
  }
}
```

**Tests**:
- Constant trip count (for i=0; i<10; i++)
- Variable trip count (for i=0; i<n; i++)
- Step != 1 (for i=0; i<10; i+=2)
- Down-counting (for i=10; i>0; i--)
- Unknown bounds

---

## Phase 5 Task Checklist

| Task | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 5.1 | Loop invariant code motion (LICM) | 2.5 hr | 50 | [ ] |
| 5.2 | Loop unrolling | 2.5 hr | 45 | [ ] |
| 5.3 | Loop rotation | 1.5 hr | 35 | [ ] |
| 5.4 | Loop unswitching | 2 hr | 40 | [ ] |
| 5.5 | Induction variable optimization | 2 hr | 45 | [ ] |
| 5.6 | Loop strength reduction | 2 hr | 40 | [ ] |
| 5.7 | Loop fusion | 2 hr | 35 | [ ] |
| 5.8 | Loop distribution | 1.5 hr | 30 | [ ] |
| 5.9 | Loop-closed SSA form | 1.5 hr | 35 | [ ] |
| 5.10 | Loop bounds analysis | 2 hr | 45 | [ ] |
| **Total** | | **20 hr** | **400** | |

---

## Success Criteria

- [ ] All 400 tests passing
- [ ] Loop invariants hoisted
- [ ] Small constant loops fully unrolled
- [ ] Strength reduction applied (MUL → ADD)
- [ ] LCSSA form maintained for all loops
- [ ] Bounds analysis accurate for common patterns

---

## 6502-Specific Considerations

### Strength Reduction Critical

The 6502 has **no hardware multiply**. A loop like:
```c
for (i = 0; i < 10; i++) {
    a = array[i * 4];  // Expensive!
}
```

Should become:
```c
ptr = array;
for (i = 0; i < 10; i++) {
    a = *ptr;
    ptr += 4;  // Much cheaper!
}
```

### Loop Unrolling Trade-offs

Unrolling increases code size. On 6502:
- PRO: Reduces branch overhead
- PRO: Enables other optimizations
- CON: Limited memory (64KB)
- CON: May exceed branch range

### Index Register Utilization

The 6502's X and Y registers are perfect for loop counters:
```asm
    LDX #10
loop:
    DEX
    BNE loop
```

Loop optimizations should preserve patterns that use X/Y as counters.

---

## Implementation Sessions

| Session | Tasks | Focus |
|---------|-------|-------|
| Session 1 | 5.1, 5.10 | LICM + Bounds analysis (foundations) |
| Session 2 | 5.2, 5.3 | Unrolling + Rotation |
| Session 3 | 5.4, 5.5, 5.6 | Unswitching + IV + Strength reduce |
| Session 4 | 5.7, 5.8, 5.9 | Fusion + Distribution + LCSSA |

---

**Previous**: [04-control-flow.md](04-control-flow.md)  
**Next**: [06-register-allocation.md](06-register-allocation.md)