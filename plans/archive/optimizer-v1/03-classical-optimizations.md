# Phase 3: Classical Optimizations

> **Phase**: 3 of 11  
> **Est. Time**: ~20 hours  
> **Tasks**: 10  
> **Tests**: ~500  
> **Prerequisites**: Phase 2 (Analysis Passes)

---

## Overview

Classical optimizations are the **bread and butter** of any production compiler. These SSA-based transforms provide significant performance and code size improvements with well-understood algorithms.

---

## Directory Structure Created

```
packages/compiler/src/optimizer/transforms/
├── index.ts                    # Transform exports
├── dce.ts                      # Dead code elimination
├── adce.ts                     # Aggressive DCE
├── constant-fold.ts            # Constant folding
├── constant-prop.ts            # Constant propagation
├── sccp.ts                     # Sparse conditional const prop
├── copy-prop.ts                # Copy propagation
├── cse.ts                      # Common subexpr elimination
├── gvn.ts                      # Global value numbering
├── pre.ts                      # Partial redundancy elimination
└── reassociate.ts              # Expression reassociation
```

---

## Task 3.1: Dead Code Elimination (DCE)

**Time**: 2 hours  
**Tests**: 50 tests

**Key Concepts**:
- Remove instructions whose results are never used
- Must preserve side-effect instructions (stores, calls)
- Iterative until fixed point

**File**: `packages/compiler/src/optimizer/transforms/dce.ts`

```typescript
/**
 * Dead Code Elimination
 * 
 * Removes instructions whose results are never used.
 * Preserves instructions with side effects.
 */
export class DCEPass extends TransformPass {
  readonly name = 'dce';
  readonly requires = ['use-def'];
  readonly invalidates = ['liveness'];
  readonly levels = [O1, O2, O3, Os, Oz];
  
  transform(func: ILFunction): boolean {
    let changed = false;
    const useDef = this.getAnalysis<UseDefInfo>('use-def', func);
    
    // Iterate until no changes
    let madeProgress: boolean;
    do {
      madeProgress = false;
      for (const block of func.getBlocks()) {
        for (const inst of block.getInstructions()) {
          if (this.isDeadInstruction(inst, useDef)) {
            block.removeInstruction(inst);
            madeProgress = true;
            changed = true;
          }
        }
      }
    } while (madeProgress);
    
    return changed;
  }
  
  protected isDeadInstruction(inst: ILInstruction, useDef: UseDefInfo): boolean {
    // Has no result → not dead (probably side effect)
    if (!inst.hasResult()) return false;
    
    // Result is unused
    if (!useDef.isUnused(inst.getResult())) return false;
    
    // Not a side-effect instruction
    return !this.hasSideEffects(inst);
  }
  
  protected hasSideEffects(inst: ILInstruction): boolean {
    // Stores, calls, volatile operations have side effects
    return inst.isStore() || 
           inst.isCall() || 
           inst.isVolatile() ||
           inst.isBarrier();
  }
}
```

**Tests**:
- Unused arithmetic result removed
- Unused load removed
- Store preserved (side effect)
- Call preserved (side effect)
- Volatile read preserved
- Chained dead code removal
- Phi node handling
- Dead branch arguments

---

## Task 3.2: Aggressive Dead Code Elimination (ADCE)

**Time**: 2 hours  
**Tests**: 40 tests

**Key Concepts**:
- Starts from "essential" instructions
- Marks backward transitively
- Removes everything not marked
- More aggressive than basic DCE

**File**: `packages/compiler/src/optimizer/transforms/adce.ts`

```typescript
/**
 * Aggressive Dead Code Elimination
 * 
 * Uses reverse liveness to find truly dead code.
 * More aggressive than basic DCE.
 */
export class ADCEPass extends TransformPass {
  readonly name = 'adce';
  readonly requires = ['use-def', 'dominator-tree'];
  readonly invalidates = ['*cfg*', 'liveness'];
  readonly levels = [O3];
  
  transform(func: ILFunction): boolean {
    const live = new Set<ILInstruction>();
    const worklist: ILInstruction[] = [];
    
    // 1. Mark essential instructions (returns, stores, calls)
    for (const block of func.getBlocks()) {
      for (const inst of block.getInstructions()) {
        if (this.isEssential(inst)) {
          live.add(inst);
          worklist.push(inst);
        }
      }
    }
    
    // 2. Mark transitively used instructions
    while (worklist.length > 0) {
      const inst = worklist.pop()!;
      for (const operand of inst.getOperands()) {
        const def = this.getDefinition(operand);
        if (def && !live.has(def)) {
          live.add(def);
          worklist.push(def);
        }
      }
    }
    
    // 3. Remove dead instructions
    let changed = false;
    for (const block of func.getBlocks()) {
      for (const inst of [...block.getInstructions()]) {
        if (!live.has(inst)) {
          block.removeInstruction(inst);
          changed = true;
        }
      }
    }
    
    return changed;
  }
}
```

**Tests**:
- Complex dead code chains
- Control-dependent code
- Dead branch removal
- Dead loop removal
- Essential instruction preservation

---

## Task 3.3: Constant Folding

**Time**: 2 hours  
**Tests**: 60 tests

**Key Concepts**:
- Evaluate constant expressions at compile time
- Handle overflow correctly for 6502 (8-bit/16-bit)
- Support all arithmetic, bitwise, and comparison ops

**File**: `packages/compiler/src/optimizer/transforms/constant-fold.ts`

```typescript
/**
 * Constant Folding
 * 
 * Evaluates constant expressions at compile time.
 * Handles 6502 overflow semantics correctly.
 */
export class ConstantFoldPass extends TransformPass {
  readonly name = 'constant-fold';
  readonly requires = [];
  readonly invalidates = ['use-def'];
  readonly levels = [O1, O2, O3, Os, Oz];
  
  transform(func: ILFunction): boolean {
    let changed = false;
    
    for (const block of func.getBlocks()) {
      for (const inst of block.getInstructions()) {
        const folded = this.tryFold(inst);
        if (folded !== null) {
          this.replaceWithConstant(inst, folded);
          changed = true;
        }
      }
    }
    
    return changed;
  }
  
  protected tryFold(inst: ILInstruction): number | null {
    if (!inst.isBinary() && !inst.isUnary()) return null;
    
    const operands = inst.getOperands();
    if (!operands.every(op => op.isConstant())) return null;
    
    switch (inst.getOpcode()) {
      case Opcode.ADD:
        return this.foldAdd(operands[0].getValue(), operands[1].getValue(), inst.getType());
      case Opcode.SUB:
        return this.foldSub(operands[0].getValue(), operands[1].getValue(), inst.getType());
      case Opcode.MUL:
        return this.foldMul(operands[0].getValue(), operands[1].getValue(), inst.getType());
      // ... more cases
    }
    return null;
  }
  
  /** Fold addition with overflow handling */
  protected foldAdd(a: number, b: number, type: ILType): number {
    const result = a + b;
    // Handle overflow for 6502 types
    if (type.isByte()) return result & 0xFF;
    if (type.isWord()) return result & 0xFFFF;
    return result;
  }
}
```

**Tests**:
- Addition folding
- Subtraction folding
- Multiplication folding
- Division folding (with zero check)
- Modulo folding
- Bitwise AND/OR/XOR/NOT folding
- Shift folding
- Comparison folding
- Byte overflow wrapping
- Word overflow wrapping
- Signed vs unsigned handling
- Boolean constant folding

---

## Task 3.4: Constant Propagation

**Time**: 2 hours  
**Tests**: 50 tests

**Key Concepts**:
- Replace variable uses with constant value when known
- SSA form makes this simple (one definition per value)
- Enable further constant folding

**File**: `packages/compiler/src/optimizer/transforms/constant-prop.ts`

```typescript
/**
 * Constant Propagation
 * 
 * Propagates constant values to their uses.
 * SSA form makes this straightforward.
 */
export class ConstantPropPass extends TransformPass {
  readonly name = 'constant-prop';
  readonly requires = ['use-def'];
  readonly invalidates = ['use-def'];
  readonly levels = [O1, O2, O3, Os, Oz];
  
  transform(func: ILFunction): boolean {
    let changed = false;
    const constants = new Map<ILValue, number>();
    
    // 1. Find all constant definitions
    for (const block of func.getBlocks()) {
      for (const inst of block.getInstructions()) {
        if (inst.isConstant()) {
          constants.set(inst.getResult(), inst.getConstantValue());
        }
      }
    }
    
    // 2. Replace uses with constants
    for (const block of func.getBlocks()) {
      for (const inst of block.getInstructions()) {
        for (let i = 0; i < inst.getOperandCount(); i++) {
          const operand = inst.getOperand(i);
          if (constants.has(operand)) {
            inst.setOperand(i, new ConstantValue(constants.get(operand)!));
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
- Simple constant propagation
- Constant through multiple blocks
- No propagation of non-constants
- Phi node handling
- Loop invariant constants

---

## Task 3.5: Sparse Conditional Constant Propagation (SCCP)

**Time**: 2.5 hours  
**Tests**: 60 tests

**Key Concepts**:
- Combines constant propagation with reachability
- Uses lattice: ⊤ (unknown) → constant → ⊥ (overdefined)
- More powerful than simple const prop

**File**: `packages/compiler/src/optimizer/transforms/sccp.ts`

```typescript
/**
 * Lattice value for SCCP
 */
export enum LatticeValue {
  Top = 0,      // Unknown (may be constant)
  Constant = 1, // Known constant value
  Bottom = 2,   // Overdefined (not constant)
}

/**
 * Sparse Conditional Constant Propagation
 * 
 * Combines constant propagation with unreachable code detection.
 * More powerful than simple constant propagation.
 */
export class SCCPPass extends TransformPass {
  readonly name = 'sccp';
  readonly requires = ['dominator-tree'];
  readonly invalidates = ['*cfg*', 'use-def', 'liveness'];
  readonly levels = [O2, O3];
  
  protected lattice: Map<ILValue, { kind: LatticeValue; value?: number }>;
  protected reachable: Set<BasicBlock>;
  protected ssaWorklist: ILInstruction[];
  protected cfgWorklist: [BasicBlock, BasicBlock][];
  
  transform(func: ILFunction): boolean {
    this.initialize(func);
    
    // Main loop: process worklists
    while (this.ssaWorklist.length > 0 || this.cfgWorklist.length > 0) {
      // Process CFG edges
      while (this.cfgWorklist.length > 0) {
        const [from, to] = this.cfgWorklist.pop()!;
        this.visitEdge(from, to);
      }
      
      // Process SSA values
      while (this.ssaWorklist.length > 0) {
        const inst = this.ssaWorklist.pop()!;
        this.visitInstruction(inst);
      }
    }
    
    // Apply results
    return this.applyResults(func);
  }
}
```

**Tests**:
- Constant branch folding
- Unreachable block detection
- Lattice meet operation
- Phi node evaluation
- Loop constant detection
- Conditional constant propagation

---

## Task 3.6: Copy Propagation

**Time**: 1.5 hours  
**Tests**: 40 tests

**Key Concepts**:
- Replace `x = y; use(x)` with `use(y)`
- Reduces register pressure
- Enables further DCE

**File**: `packages/compiler/src/optimizer/transforms/copy-prop.ts`

```typescript
/**
 * Copy Propagation
 * 
 * Replaces uses of copied values with the original.
 * Enables further DCE to remove the copy.
 */
export class CopyPropPass extends TransformPass {
  readonly name = 'copy-prop';
  readonly requires = ['use-def'];
  readonly invalidates = ['use-def'];
  readonly levels = [O1, O2, O3, Os, Oz];
  
  transform(func: ILFunction): boolean {
    let changed = false;
    const copies = new Map<ILValue, ILValue>();
    
    // 1. Find all copy instructions (x = y where y is single value)
    for (const block of func.getBlocks()) {
      for (const inst of block.getInstructions()) {
        if (this.isCopy(inst)) {
          copies.set(inst.getResult(), inst.getOperand(0));
        }
      }
    }
    
    // 2. Replace uses with original
    for (const block of func.getBlocks()) {
      for (const inst of block.getInstructions()) {
        for (let i = 0; i < inst.getOperandCount(); i++) {
          let operand = inst.getOperand(i);
          // Follow copy chain
          while (copies.has(operand)) {
            operand = copies.get(operand)!;
          }
          if (operand !== inst.getOperand(i)) {
            inst.setOperand(i, operand);
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
- Simple copy propagation
- Copy chain (a=b, b=c → a=c)
- Phi as copy source
- No propagation of modified values
- Cross-block copy propagation

---

## Task 3.7: Common Subexpression Elimination (CSE)

**Time**: 2 hours  
**Tests**: 50 tests

**Key Concepts**:
- If `a + b` computed twice, reuse first result
- Hash-based expression identification
- Must respect side effects and aliasing

**File**: `packages/compiler/src/optimizer/transforms/cse.ts`

```typescript
/**
 * Expression hash for CSE
 */
function hashExpression(inst: ILInstruction): string {
  // Hash based on opcode and operands
  return `${inst.getOpcode()}:${inst.getOperands().map(o => o.getId()).join(',')}`;
}

/**
 * Common Subexpression Elimination
 * 
 * Reuses results of identical expressions.
 */
export class CSEPass extends TransformPass {
  readonly name = 'cse';
  readonly requires = ['dominator-tree', 'alias-analysis'];
  readonly invalidates = ['use-def'];
  readonly levels = [O2, O3, Os, Oz];
  
  transform(func: ILFunction): boolean {
    let changed = false;
    const available = new Map<string, ILInstruction>();
    
    // Process blocks in dominator order
    for (const block of this.getDominatorOrder(func)) {
      for (const inst of block.getInstructions()) {
        if (!this.isCSECandidate(inst)) continue;
        
        const hash = hashExpression(inst);
        const existing = available.get(hash);
        
        if (existing && this.dominates(existing, inst)) {
          // Replace with existing value
          this.replaceAllUses(inst.getResult(), existing.getResult());
          block.removeInstruction(inst);
          changed = true;
        } else {
          available.set(hash, inst);
        }
      }
    }
    
    return changed;
  }
  
  protected isCSECandidate(inst: ILInstruction): boolean {
    // No side effects, no volatile, pure arithmetic/comparison
    return inst.isPure() && !inst.isVolatile();
  }
}
```

**Tests**:
- Same expression twice
- Expression in dominator → dominated block
- No CSE for stores
- No CSE for calls (may have side effects)
- Hash collision handling
- Operand order for commutative ops

---

## Task 3.8: Global Value Numbering (GVN)

**Time**: 2.5 hours  
**Tests**: 60 tests

**Key Concepts**:
- More powerful than CSE
- Detects equivalent expressions with different structure
- Uses value partitioning

**File**: `packages/compiler/src/optimizer/transforms/gvn.ts`

```typescript
/**
 * Global Value Numbering
 * 
 * Assigns the same "value number" to equivalent expressions.
 * More powerful than CSE - detects structural equivalence.
 */
export class GVNPass extends TransformPass {
  readonly name = 'gvn';
  readonly requires = ['dominator-tree', 'alias-analysis', 'memory-deps'];
  readonly invalidates = ['use-def', 'liveness'];
  readonly levels = [O3];
  
  protected valueNumbers: Map<ILValue, number>;
  protected numberToValue: Map<number, ILValue>;
  protected nextNumber: number;
  
  transform(func: ILFunction): boolean {
    this.initialize();
    let changed = false;
    
    // Process in RPO for efficiency
    for (const block of this.getReversePostOrder(func)) {
      for (const inst of block.getInstructions()) {
        const vn = this.computeValueNumber(inst);
        const existing = this.numberToValue.get(vn);
        
        if (existing && existing !== inst.getResult()) {
          // Found equivalent value
          this.replaceAllUses(inst.getResult(), existing);
          block.removeInstruction(inst);
          changed = true;
        } else {
          this.valueNumbers.set(inst.getResult(), vn);
          this.numberToValue.set(vn, inst.getResult());
        }
      }
    }
    
    return changed;
  }
}
```

**Tests**:
- Equivalent expressions with different operand order (a+b = b+a)
- Transitive equivalence (a=b, b=c → a=c)
- Memory operations
- Load-after-store optimization
- Phi node value numbering

---

## Task 3.9: Partial Redundancy Elimination (PRE)

**Time**: 2 hours  
**Tests**: 50 tests

**Key Concepts**:
- Eliminates redundant computations
- Inserts computations on some paths to enable elimination
- Combines CSE with code motion

**File**: `packages/compiler/src/optimizer/transforms/pre.ts`

```typescript
/**
 * Partial Redundancy Elimination
 * 
 * Eliminates partially redundant expressions by inserting
 * computations on paths where they're missing.
 */
export class PREPass extends TransformPass {
  readonly name = 'pre';
  readonly requires = ['dominator-tree', 'loop-info', 'alias-analysis'];
  readonly invalidates = ['*cfg*', 'use-def', 'liveness'];
  readonly levels = [O3];
  
  transform(func: ILFunction): boolean {
    // 1. Compute anticipated expressions (backward)
    const anticipated = this.computeAnticipated(func);
    
    // 2. Compute available expressions (forward)
    const available = this.computeAvailable(func);
    
    // 3. Find partial redundancies
    const partiallyRedundant = this.findPartialRedundancies(anticipated, available);
    
    // 4. Insert computations to make them fully redundant
    let changed = this.insertComputations(partiallyRedundant);
    
    // 5. Eliminate now-redundant expressions
    changed = this.eliminateRedundant() || changed;
    
    return changed;
  }
}
```

**Tests**:
- Diamond CFG PRE
- Loop invariant hoisting via PRE
- No insertion that increases code size (-Os)
- Critical edge handling

---

## Task 3.10: Expression Reassociation

**Time**: 1.5 hours  
**Tests**: 40 tests

**Key Concepts**:
- Reorder associative/commutative operations
- Enable more constant folding
- Optimize for 6502 instruction patterns

**File**: `packages/compiler/src/optimizer/transforms/reassociate.ts`

```typescript
/**
 * Expression Reassociation
 * 
 * Reorders associative operations for better optimization.
 * E.g., (a + 1) + 2 → a + 3
 */
export class ReassociatePass extends TransformPass {
  readonly name = 'reassociate';
  readonly requires = ['use-def'];
  readonly invalidates = ['use-def'];
  readonly levels = [O2, O3];
  
  transform(func: ILFunction): boolean {
    let changed = false;
    
    for (const block of func.getBlocks()) {
      for (const inst of block.getInstructions()) {
        if (this.canReassociate(inst)) {
          changed = this.reassociate(inst) || changed;
        }
      }
    }
    
    return changed;
  }
  
  protected canReassociate(inst: ILInstruction): boolean {
    // ADD, MUL, AND, OR, XOR are associative
    return inst.isAssociative() && inst.isCommutative();
  }
  
  protected reassociate(inst: ILInstruction): boolean {
    // Collect chain of same operation
    const chain = this.collectChain(inst);
    
    // Sort: constants last (enables folding)
    const sorted = this.sortChain(chain);
    
    // Rebuild tree
    return this.rebuildTree(inst, sorted);
  }
}
```

**Tests**:
- Constant grouping: (a + 1) + 2 → a + 3
- Variable ordering for CSE
- No reassociation of non-associative ops
- Overflow considerations

---

## Phase 3 Task Checklist

| Task | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 3.1 | DCE | 2 hr | 50 | [ ] |
| 3.2 | Aggressive DCE | 2 hr | 40 | [ ] |
| 3.3 | Constant folding | 2 hr | 60 | [ ] |
| 3.4 | Constant propagation | 2 hr | 50 | [ ] |
| 3.5 | SCCP | 2.5 hr | 60 | [ ] |
| 3.6 | Copy propagation | 1.5 hr | 40 | [ ] |
| 3.7 | CSE | 2 hr | 50 | [ ] |
| 3.8 | GVN | 2.5 hr | 60 | [ ] |
| 3.9 | PRE | 2 hr | 50 | [ ] |
| 3.10 | Reassociation | 1.5 hr | 40 | [ ] |
| **Total** | | **20 hr** | **500** | |

---

## Success Criteria

- [ ] All 500 tests passing
- [ ] DCE removes unused code correctly
- [ ] Constants propagate and fold correctly
- [ ] No semantic changes to programs
- [ ] 6502 overflow semantics respected
- [ ] Passes work together in pipeline

---

## Implementation Sessions

| Session | Tasks | Focus |
|---------|-------|-------|
| Session 1 | 3.1, 3.2 | Dead code elimination |
| Session 2 | 3.3, 3.4 | Constant folding/propagation |
| Session 3 | 3.5 | SCCP |
| Session 4 | 3.6, 3.7 | Copy prop + CSE |
| Session 5 | 3.8, 3.9, 3.10 | GVN + PRE + Reassoc |

---

**Previous**: [02-analysis-passes.md](02-analysis-passes.md)  
**Next**: [04-control-flow.md](04-control-flow.md)