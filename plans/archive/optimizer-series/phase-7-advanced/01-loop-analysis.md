# Loop Analysis

> **Phase**: 7 - Advanced Optimizations  
> **Document**: 01-loop-analysis.md  
> **Focus**: Loop detection, structure analysis, induction variables  
> **Est. Lines**: ~350

---

## Overview

Loop analysis is the **foundation** for all loop optimizations. It identifies loops in the control flow graph, determines their structure, and extracts key information needed by LICM, loop unrolling, and strength reduction.

**Key Analyses**:
1. **Loop Detection** - Find all loops in CFG using dominance
2. **Loop Structure** - Identify header, body, latch, exits
3. **Induction Variables** - Find loop counters and derived IVs
4. **Trip Count** - Determine iteration count (if computable)
5. **Dependency Analysis** - Find loop-carried dependencies

---

## 1. Natural Loop Definition

A **natural loop** is defined by:
1. **Header**: Single entry point that dominates all loop nodes
2. **Back Edge**: Edge from latch node back to header
3. **Body**: All nodes that can reach latch without leaving loop

```
    ┌───────────────┐
    │               │
    ▼               │
┌───────┐           │
│Header │◄──────────┤  Back Edge
└───┬───┘           │
    │               │
    ▼               │
┌───────┐           │
│ Body  │           │
└───┬───┘           │
    │               │
    ▼               │
┌───────┐           │
│ Latch │───────────┘
└───┬───┘
    │
    ▼
┌───────┐
│ Exit  │
└───────┘
```

---

## 2. Loop Detection Algorithm

### 2.1 Dominance-Based Detection

```typescript
/**
 * Detects all natural loops in a function.
 * Uses dominance analysis to find back edges.
 */
export class LoopDetector {
  protected readonly cfg: ControlFlowGraph;
  protected readonly domTree: DominatorTree;
  
  /**
   * Find all back edges in the CFG.
   * A back edge is an edge (A → B) where B dominates A.
   */
  protected findBackEdges(): BackEdge[] {
    const backEdges: BackEdge[] = [];
    
    for (const block of this.cfg.getBlocks()) {
      for (const succ of block.getSuccessors()) {
        // If successor dominates block, this is a back edge
        if (this.domTree.dominates(succ, block)) {
          backEdges.push({
            source: block,      // Latch
            target: succ,       // Header
          });
        }
      }
    }
    
    return backEdges;
  }
  
  /**
   * Build the natural loop from a back edge.
   * Uses reverse DFS from latch, stopping at header.
   */
  protected buildLoop(backEdge: BackEdge): NaturalLoop {
    const header = backEdge.target;
    const latch = backEdge.source;
    
    // Find all blocks that can reach latch without going through header
    const body = new Set<BasicBlock>([header, latch]);
    const worklist: BasicBlock[] = [latch];
    
    while (worklist.length > 0) {
      const block = worklist.pop()!;
      
      for (const pred of block.getPredecessors()) {
        if (!body.has(pred)) {
          body.add(pred);
          worklist.push(pred);
        }
      }
    }
    
    return new NaturalLoop(header, latch, body);
  }
  
  /**
   * Main detection entry point.
   * Returns all loops, properly nested.
   */
  public detectLoops(): LoopNest {
    const backEdges = this.findBackEdges();
    const loops: NaturalLoop[] = [];
    
    for (const edge of backEdges) {
      loops.push(this.buildLoop(edge));
    }
    
    // Build loop nesting tree
    return this.buildLoopNest(loops);
  }
}
```

### 2.2 Loop Data Structure

```typescript
/**
 * Represents a natural loop in the CFG.
 */
export class NaturalLoop {
  /** The single entry block of the loop */
  protected readonly header: BasicBlock;
  
  /** The block with the back edge to header */
  protected readonly latch: BasicBlock;
  
  /** All blocks in the loop body */
  protected readonly body: Set<BasicBlock>;
  
  /** Parent loop (null if outermost) */
  protected parent: NaturalLoop | null = null;
  
  /** Nested loops */
  protected readonly children: NaturalLoop[] = [];
  
  /** Exit blocks (successors outside loop) */
  protected exits: BasicBlock[] = [];
  
  /** Induction variables detected in this loop */
  protected inductionVars: InductionVariable[] = [];
  
  /** Trip count (null if unknown) */
  protected tripCount: number | null = null;
  
  /**
   * Check if a block is in this loop.
   */
  public contains(block: BasicBlock): boolean {
    return this.body.has(block);
  }
  
  /**
   * Get the loop depth (1 = outermost).
   */
  public getDepth(): number {
    let depth = 1;
    let p = this.parent;
    while (p !== null) {
      depth++;
      p = p.parent;
    }
    return depth;
  }
  
  /**
   * Get all blocks that exit the loop.
   */
  public getExitBlocks(): BasicBlock[] {
    if (this.exits.length === 0) {
      for (const block of this.body) {
        for (const succ of block.getSuccessors()) {
          if (!this.body.has(succ)) {
            this.exits.push(succ);
          }
        }
      }
    }
    return this.exits;
  }
  
  /**
   * Check if this loop has a single exit.
   * Single-exit loops are easier to optimize.
   */
  public hasSingleExit(): boolean {
    return this.getExitBlocks().length === 1;
  }
}
```

---

## 3. Loop Nesting Tree

Loops can be nested, and we represent this as a tree:

```typescript
/**
 * Represents the nesting structure of all loops.
 */
export class LoopNest {
  /** Top-level loops (not nested in any other loop) */
  protected readonly topLevel: NaturalLoop[] = [];
  
  /** Map from block to innermost containing loop */
  protected readonly blockToLoop: Map<BasicBlock, NaturalLoop> = new Map();
  
  /**
   * Build the nesting tree from detected loops.
   */
  protected buildLoopNest(loops: NaturalLoop[]): void {
    // Sort by size (smaller loops nested inside larger)
    loops.sort((a, b) => a.body.size - b.body.size);
    
    for (const loop of loops) {
      let parent: NaturalLoop | null = null;
      
      // Find smallest loop that contains this one's header
      for (const other of loops) {
        if (other !== loop && 
            other.contains(loop.header) &&
            (parent === null || other.body.size < parent.body.size)) {
          parent = other;
        }
      }
      
      if (parent !== null) {
        loop.parent = parent;
        parent.children.push(loop);
      } else {
        this.topLevel.push(loop);
      }
      
      // Update block-to-loop mapping (innermost loop wins)
      for (const block of loop.body) {
        const existing = this.blockToLoop.get(block);
        if (!existing || loop.body.size < existing.body.size) {
          this.blockToLoop.set(block, loop);
        }
      }
    }
  }
  
  /**
   * Get all loops from outermost to innermost (post-order).
   * Use for bottom-up optimization.
   */
  public getLoopsPostOrder(): NaturalLoop[] {
    const result: NaturalLoop[] = [];
    
    const visit = (loop: NaturalLoop): void => {
      for (const child of loop.children) {
        visit(child);
      }
      result.push(loop);
    };
    
    for (const top of this.topLevel) {
      visit(top);
    }
    
    return result;
  }
  
  /**
   * Get all loops from innermost to outermost (pre-order).
   * Use for top-down optimization.
   */
  public getLoopsPreOrder(): NaturalLoop[] {
    const result: NaturalLoop[] = [];
    
    const visit = (loop: NaturalLoop): void => {
      result.push(loop);
      for (const child of loop.children) {
        visit(child);
      }
    };
    
    for (const top of this.topLevel) {
      visit(top);
    }
    
    return result;
  }
}
```

### Nested Loop Example

```js
// Source code
for (let y = 0; y < 25; y++) {
  for (let x = 0; x < 40; x++) {
    screen[y * 40 + x] = color;
  }
}

// Loop nesting:
// Loop 1 (outer): y loop, depth=1
//   └── Loop 2 (inner): x loop, depth=2, parent=Loop 1
```

---

## 4. Induction Variable Analysis

### 4.1 Basic Induction Variables

A **basic induction variable** is incremented/decremented by a constant each iteration:

```typescript
/**
 * Represents an induction variable.
 */
export interface InductionVariable {
  /** The variable being incremented */
  variable: string;
  
  /** Start value (loop entry) */
  init: number | string;  // Constant or variable
  
  /** Step (increment/decrement per iteration) */
  step: number;
  
  /** Final value (loop exit condition) */
  final: number | string | null;
  
  /** Comparison operator (<, <=, >, >=, !=) */
  comparison: ComparisonOp | null;
}

/**
 * Detects induction variables in a loop.
 */
export class InductionVariableAnalysis {
  /**
   * Find basic induction variables.
   * Pattern: v = v ± constant
   */
  protected findBasicIVs(loop: NaturalLoop): InductionVariable[] {
    const ivs: InductionVariable[] = [];
    
    // Look for increment patterns in loop body
    for (const block of loop.body) {
      for (const inst of block.getInstructions()) {
        // Pattern: v = v + c or v = v - c
        if (inst.opcode === ILOpcode.ADD || inst.opcode === ILOpcode.SUB) {
          const dest = inst.dest;
          const src1 = inst.operands[0];
          const src2 = inst.operands[1];
          
          // Check if dest === one operand and other is constant
          if (src1 === dest && this.isConstant(src2)) {
            const step = inst.opcode === ILOpcode.ADD 
              ? this.getConstValue(src2)
              : -this.getConstValue(src2);
            
            // Find initialization (value at loop entry)
            const init = this.findInitValue(loop, dest);
            
            // Find final value from exit condition
            const [final, comparison] = this.findFinalValue(loop, dest);
            
            ivs.push({
              variable: dest,
              init,
              step,
              final,
              comparison,
            });
          }
        }
      }
    }
    
    return ivs;
  }
  
  /**
   * Find the initial value of a variable at loop entry.
   */
  protected findInitValue(loop: NaturalLoop, variable: string): number | string {
    // Look at reaching definition from outside loop
    const header = loop.header;
    
    for (const pred of header.getPredecessors()) {
      if (!loop.contains(pred)) {
        // This predecessor is outside the loop
        const def = this.findLastDef(pred, variable);
        if (def && this.isConstant(def.value)) {
          return this.getConstValue(def.value);
        }
      }
    }
    
    return variable; // Unknown, return variable name
  }
  
  /**
   * Find the final value from the exit condition.
   */
  protected findFinalValue(
    loop: NaturalLoop, 
    variable: string
  ): [number | string | null, ComparisonOp | null] {
    // Look for comparison in loop latch or header
    const exitBlocks = [loop.header, loop.latch];
    
    for (const block of exitBlocks) {
      const lastInst = block.getLastInstruction();
      
      if (lastInst && this.isConditionalBranch(lastInst)) {
        // Find the comparison feeding this branch
        const cmp = this.findComparisonFor(block, variable);
        if (cmp) {
          return [cmp.comparand, cmp.operator];
        }
      }
    }
    
    return [null, null];
  }
}
```

### 4.2 Example Induction Variables

```js
// Source
for (let i = 0; i < 10; i++) {
    buffer[i] = 0;
}

// Induction Variable:
// - variable: i
// - init: 0
// - step: +1
// - final: 10
// - comparison: <
// - Trip count: 10
```

```js
// Source
for (let i = 100; i >= 0; i -= 5) {
    process(i);
}

// Induction Variable:
// - variable: i
// - init: 100
// - step: -5
// - final: 0
// - comparison: >=
// - Trip count: 21
```

---

## 5. Trip Count Analysis

### 5.1 Computing Trip Count

```typescript
/**
 * Computes loop trip count when possible.
 */
export class TripCountAnalysis {
  /**
   * Compute trip count from induction variable.
   * Returns null if not computable at compile time.
   */
  public computeTripCount(iv: InductionVariable): number | null {
    // Need constant init, step, and final
    if (typeof iv.init !== 'number' ||
        typeof iv.final !== 'number' ||
        iv.comparison === null) {
      return null;
    }
    
    const init = iv.init;
    const final = iv.final;
    const step = iv.step;
    
    // Handle different comparison operators
    switch (iv.comparison) {
      case '<':
        if (step > 0) {
          return Math.max(0, Math.ceil((final - init) / step));
        }
        break;
        
      case '<=':
        if (step > 0) {
          return Math.max(0, Math.floor((final - init) / step) + 1);
        }
        break;
        
      case '>':
        if (step < 0) {
          return Math.max(0, Math.ceil((init - final) / (-step)));
        }
        break;
        
      case '>=':
        if (step < 0) {
          return Math.max(0, Math.floor((init - final) / (-step)) + 1);
        }
        break;
        
      case '!=':
        // Only works if step evenly divides distance
        const distance = final - init;
        if (distance % step === 0) {
          return Math.abs(distance / step);
        }
        break;
    }
    
    return null;
  }
}
```

### 5.2 Trip Count Examples

| Loop | Init | Final | Step | Comparison | Trip Count |
|------|------|-------|------|------------|------------|
| `for (i=0; i<10; i++)` | 0 | 10 | +1 | < | 10 |
| `for (i=0; i<=10; i++)` | 0 | 10 | +1 | <= | 11 |
| `for (i=10; i>0; i--)` | 10 | 0 | -1 | > | 10 |
| `for (i=100; i>=0; i-=10)` | 100 | 0 | -10 | >= | 11 |
| `for (i=0; i<n; i++)` | 0 | n | +1 | < | Unknown |

---

## 6. Loop-Carried Dependency Analysis

### 6.1 Dependency Types

Loop-carried dependencies affect what optimizations are legal:

```typescript
/**
 * Types of loop-carried dependencies.
 */
export enum DependencyType {
  /** True dependency: read after write (RAW) */
  FLOW = 'flow',
  
  /** Anti dependency: write after read (WAR) */
  ANTI = 'anti',
  
  /** Output dependency: write after write (WAW) */
  OUTPUT = 'output',
}

/**
 * Represents a dependency between loop iterations.
 */
export interface LoopCarriedDependency {
  /** Type of dependency */
  type: DependencyType;
  
  /** Source instruction */
  source: ILInstruction;
  
  /** Target instruction */
  target: ILInstruction;
  
  /** Distance in iterations (1 = next iteration) */
  distance: number;
}
```

### 6.2 Dependency Detection

```typescript
/**
 * Detects loop-carried dependencies.
 */
export class LoopDependencyAnalysis {
  /**
   * Find all loop-carried dependencies.
   */
  public findDependencies(loop: NaturalLoop): LoopCarriedDependency[] {
    const deps: LoopCarriedDependency[] = [];
    
    // Get all memory accesses in loop
    const loads = this.collectLoads(loop);
    const stores = this.collectStores(loop);
    
    // Check each store against loads in next iteration
    for (const store of stores) {
      for (const load of loads) {
        if (this.mayAlias(store.address, load.address)) {
          // Potential RAW dependency
          if (this.isCarriedDependency(store, load, loop)) {
            deps.push({
              type: DependencyType.FLOW,
              source: store,
              target: load,
              distance: this.computeDistance(store, load, loop),
            });
          }
        }
      }
    }
    
    // WAR: load in current iteration, store in next
    for (const load of loads) {
      for (const store of stores) {
        if (this.mayAlias(load.address, store.address)) {
          if (this.isCarriedDependency(load, store, loop)) {
            deps.push({
              type: DependencyType.ANTI,
              source: load,
              target: store,
              distance: this.computeDistance(load, store, loop),
            });
          }
        }
      }
    }
    
    return deps;
  }
  
  /**
   * Check if dependency is loop-carried (crosses iteration boundary).
   */
  protected isCarriedDependency(
    inst1: ILInstruction,
    inst2: ILInstruction,
    loop: NaturalLoop
  ): boolean {
    // Analyze if inst2 in iteration N+1 depends on inst1 in iteration N
    // This requires analyzing the index expressions with the IV
    
    const iv = loop.getInductionVariable();
    if (!iv) return true; // Assume carried if no IV
    
    // Get index expressions
    const idx1 = this.extractIndexExpr(inst1.address, iv.variable);
    const idx2 = this.extractIndexExpr(inst2.address, iv.variable);
    
    if (idx1 === null || idx2 === null) return true; // Assume carried
    
    // If idx2 references IV from previous iteration, it's carried
    return idx2.referencesIV && idx2.offset < idx1.offset;
  }
}
```

### 6.3 Dependency Examples

```js
// Example 1: No loop-carried dependency (can parallelize)
for (let i = 0; i < 10; i++) {
    a[i] = b[i] + 1;  // Each iteration independent
}

// Example 2: Flow dependency distance 1 (cannot parallelize)
for (let i = 1; i < 10; i++) {
    a[i] = a[i-1] + 1;  // Depends on previous iteration
    // Must execute sequentially
}

// Example 3: Flow dependency distance 2
for (let i = 2; i < 10; i++) {
    a[i] = a[i-2] + 1;  // Can potentially unroll 2x
}
```

---

## 7. Analysis Results Interface

```typescript
/**
 * Complete analysis results for a loop.
 */
export interface LoopAnalysisResult {
  /** The analyzed loop */
  loop: NaturalLoop;
  
  /** All induction variables */
  inductionVariables: InductionVariable[];
  
  /** Primary induction variable (loop counter) */
  primaryIV: InductionVariable | null;
  
  /** Trip count (null if unknown) */
  tripCount: number | null;
  
  /** Trip count upper bound (for partial info) */
  tripCountUpperBound: number | null;
  
  /** Loop-carried dependencies */
  dependencies: LoopCarriedDependency[];
  
  /** All instructions in loop */
  instructions: ILInstruction[];
  
  /** Instructions that are loop-invariant */
  invariantInstructions: ILInstruction[];
  
  /** Whether loop has side effects (I/O, volatile) */
  hasSideEffects: boolean;
  
  /** Whether loop has single exit */
  hasSingleExit: boolean;
  
  /** Nested loops */
  nestedLoops: LoopAnalysisResult[];
}

/**
 * Main entry point for loop analysis.
 */
export class LoopAnalyzer {
  /**
   * Perform complete analysis of all loops in a function.
   */
  public analyzeLoops(func: ILFunction): LoopAnalysisResult[] {
    // Build CFG and dominator tree
    const cfg = buildCFG(func);
    const domTree = buildDominatorTree(cfg);
    
    // Detect loops
    const detector = new LoopDetector(cfg, domTree);
    const loopNest = detector.detectLoops();
    
    // Analyze each loop
    const results: LoopAnalysisResult[] = [];
    
    for (const loop of loopNest.getLoopsPostOrder()) {
      const result = this.analyzeLoop(loop);
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * Analyze a single loop.
   */
  protected analyzeLoop(loop: NaturalLoop): LoopAnalysisResult {
    // Find induction variables
    const ivAnalysis = new InductionVariableAnalysis();
    const ivs = ivAnalysis.findBasicIVs(loop);
    
    // Find primary IV (most likely the loop counter)
    const primaryIV = this.identifyPrimaryIV(ivs, loop);
    
    // Compute trip count
    const tripCount = primaryIV 
      ? new TripCountAnalysis().computeTripCount(primaryIV)
      : null;
    
    // Find loop-carried dependencies
    const depAnalysis = new LoopDependencyAnalysis();
    const deps = depAnalysis.findDependencies(loop);
    
    // Identify invariant instructions
    const invariants = this.findInvariantInstructions(loop);
    
    return {
      loop,
      inductionVariables: ivs,
      primaryIV,
      tripCount,
      tripCountUpperBound: tripCount ?? 256, // 6502 byte limit
      dependencies: deps,
      instructions: this.collectInstructions(loop),
      invariantInstructions: invariants,
      hasSideEffects: this.checkSideEffects(loop),
      hasSingleExit: loop.hasSingleExit(),
      nestedLoops: [],
    };
  }
}
```

---

## 8. 6502-Specific Considerations

### 8.1 Byte-Sized Loops

The 6502 has 8-bit registers, affecting loop analysis:

```typescript
/**
 * 6502-specific loop considerations.
 */
export class M6502LoopAnalysis {
  /** Maximum trip count for single-byte counter */
  protected static readonly MAX_BYTE_TRIP = 256;
  
  /**
   * Check if loop fits in 6502 byte limits.
   */
  public fitsByteCounter(result: LoopAnalysisResult): boolean {
    const tc = result.tripCount;
    return tc !== null && tc <= M6502LoopAnalysis.MAX_BYTE_TRIP;
  }
  
  /**
   * Check if loop uses X or Y as counter (common 6502 pattern).
   */
  public usesIndexRegisterCounter(result: LoopAnalysisResult): boolean {
    const iv = result.primaryIV;
    if (!iv) return false;
    
    // Check if IV maps to X or Y register
    return iv.variable.startsWith('__x_') || iv.variable.startsWith('__y_');
  }
  
  /**
   * Common 6502 loop patterns.
   */
  public identifyPattern(result: LoopAnalysisResult): M6502LoopPattern {
    const iv = result.primaryIV;
    if (!iv) return M6502LoopPattern.UNKNOWN;
    
    // Count-down to zero (most efficient)
    if (iv.step === -1 && iv.final === 0 && iv.comparison === '>=') {
      return M6502LoopPattern.COUNTDOWN_TO_ZERO;
    }
    
    // Count-up with compare
    if (iv.step === 1 && iv.comparison === '<') {
      return M6502LoopPattern.COUNTUP_WITH_CMP;
    }
    
    return M6502LoopPattern.GENERAL;
  }
}

export enum M6502LoopPattern {
  /** DEX; BNE loop - most efficient */
  COUNTDOWN_TO_ZERO = 'countdown-to-zero',
  
  /** INX; CPX #n; BCC loop */
  COUNTUP_WITH_CMP = 'countup-with-cmp',
  
  /** General loop structure */
  GENERAL = 'general',
  
  /** Unrecognized pattern */
  UNKNOWN = 'unknown',
}
```

### 8.2 Count-Down Transformation

```asm
; Count-up loop (less efficient)
    LDX #0
loop:
    LDA data,X
    STA buffer,X
    INX
    CPX #10           ; Extra comparison
    BCC loop          ; 2 + 3 = 5 cycles per iteration

; Count-down loop (more efficient)
    LDX #9
loop:
    LDA data,X
    STA buffer,X
    DEX
    BPL loop          ; 3 cycles per iteration (CPX eliminated!)
```

**When safe**: If loop body doesn't depend on specific iteration order.

---

## Success Criteria

- [ ] Loop detection finds all natural loops
- [ ] Loop nesting tree correctly built
- [ ] Induction variables correctly identified
- [ ] Trip counts computed for constant-bound loops
- [ ] Loop-carried dependencies detected
- [ ] 6502 loop patterns identified
- [ ] ~40 tests passing for loop analysis

---

**Next Document**: [02-licm.md](02-licm.md) - Loop Invariant Code Motion  
**Parent**: [00-phase-index.md](00-phase-index.md)