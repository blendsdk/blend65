# Phase 8 Implementation Plan - Part 2: Tier 2 - Data Flow Analysis

> **Navigation**: [Part 1](phase8-part1-overview-foundation-tier1.md) ← [Part 2] → [Part 3: Tier 3](phase8-part3-tier3.md)
>
> **Focus**: Week 2 - Data Flow Analysis
> **Tasks**: 8.5-8.7, 8.21 (4 tasks, 26 hours, 68+ tests)
> **Prerequisites**: Part 1 complete (Foundation + Tier 1) ✅

---

## Tier 2 Overview: Data Flow Analysis

**Goal**: Implement classical data flow analyses that track how values flow through the program.

**Why Critical**: These analyses enable:
- Constant propagation and folding
- Register allocation optimization
- Dead code elimination refinement
- Live variable tracking for 6502 register pressure

**Dependencies**:
- Tier 1 complete (variable usage, dead code detection)
- Control flow graphs from Phase 5
- Symbol tables from Phase 1

---

## Task 8.5: Reaching Definitions Analysis (8 hours)

**File**: `packages/compiler/src/semantic/analysis/reaching-definitions.ts`

**Goal**: Track which variable definitions reach each program point

**Why Critical**: Foundation for constant propagation, enables def-use chains

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.ReachingDefinitionsSet;  // Set<DefinitionId>
OptimizationMetadataKey.DefUseChain;             // Map<DefinitionId, Set<UseId>>
OptimizationMetadataKey.UseDefChain;             // Map<UseId, Set<DefinitionId>>
```

**Implementation Pattern**:

```typescript
/**
 * Reaching definitions analyzer
 *
 * Computes which definitions of variables reach each use,
 * building def-use and use-def chains for optimization.
 */
export class ReachingDefinitionsAnalyzer {
  private defUseChains = new Map<string, Set<string>>();
  private useDefChains = new Map<string, Set<string>>();

  constructor(
    private cfg: ControlFlowGraph,
    private symbolTable: SymbolTable
  ) {}

  /**
   * Compute reaching definitions using iterative dataflow
   *
   * Uses classic dataflow equations:
   * - OUT[B] = GEN[B] ∪ (IN[B] - KILL[B])
   * - IN[B] = ∪ OUT[P] for all predecessors P of B
   */
  analyze(): void {
    // Initialize GEN and KILL sets for each block
    const gen = this.computeGenSets();
    const kill = this.computeKillSets();

    // Iterative dataflow analysis until fixpoint
    const inSets = new Map<string, Set<string>>();
    const outSets = new Map<string, Set<string>>();

    let changed = true;
    while (changed) {
      changed = false;

      for (const block of this.cfg.getBlocks()) {
        // IN[B] = ∪ OUT[P] for all predecessors
        const newIn = this.unionPredecessorOuts(block, outSets);

        // OUT[B] = GEN[B] ∪ (IN[B] - KILL[B])
        const inMinusKill = this.setDifference(newIn, kill.get(block.id)!);
        const newOut = this.setUnion(gen.get(block.id)!, inMinusKill);

        // Check for changes
        if (!this.setsEqual(inSets.get(block.id), newIn) ||
            !this.setsEqual(outSets.get(block.id), newOut)) {
          changed = true;
          inSets.set(block.id, newIn);
          outSets.set(block.id, newOut);
        }
      }
    }

    // Attach metadata to nodes
    this.attachMetadata(inSets, outSets);
  }

  private attachMetadata(
    inSets: Map<string, Set<string>>,
    outSets: Map<string, Set<string>>
  ): void {
    for (const block of this.cfg.getBlocks()) {
      const reachingDefs = inSets.get(block.id);

      for (const stmt of block.statements) {
        if (stmt.metadata) {
          stmt.metadata.set(
            OptimizationMetadataKey.ReachingDefinitionsSet,
            reachingDefs
          );
        }
      }
    }
  }

  // ... helper methods
}
```

**Tests** (20+):

- Single definition reaches use
- Multiple definitions reach single use
- Definition killed by reassignment
- Definition reaches through multiple blocks
- Loop handling (definitions reach back)
- Conditional branches (merge reaching definitions)
- Uninitialized variable detection
- Def-use chain construction
- Use-def chain construction
- Complex control flow graphs
- Nested loops
- Function calls (conservative analysis)
- Export/import handling
- Edge cases (empty blocks, unreachable code)

**Test Example**:

```typescript
describe('ReachingDefinitionsAnalyzer', () => {
  it('should track single definition reaching use', () => {
    const source = `
      let x: byte = 10;  // Definition 1
      let y: byte = x;   // Use of definition 1
    `;
    
    const { ast, analyzer } = setupTest(source);
    const reachingDefs = analyzer.analyze();
    
    const yDecl = findNode(ast, 'y');
    const reaching = yDecl.metadata?.get(
      OptimizationMetadataKey.ReachingDefinitionsSet
    );
    
    expect(reaching).toContain('x:def:1');
  });

  it('should handle multiple definitions', () => {
    const source = `
      let x: byte = 10;  // Definition 1
      if (condition) {
        x = 20;          // Definition 2
      }
      let y: byte = x;   // Both definitions reach here
    `;
    
    // Test that both definitions reach the use
  });
});
```

---

## Task 8.6: Liveness Analysis (8 hours)

**File**: `packages/compiler/src/semantic/analysis/liveness.ts`

**Goal**: Track which variables are "live" (will be used) at each program point

**Why Critical**: Essential for register allocation on 6502 (only A, X, Y available!)

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.LivenessLiveIn;          // Set<VariableId> - live before block
OptimizationMetadataKey.LivenessLiveOut;         // Set<VariableId> - live after block
OptimizationMetadataKey.LivenessInterval;        // [start, end] program points
OptimizationMetadataKey.LivenessIntervalLength;  // end - start (for priority)
```

**Implementation Pattern**:

```typescript
/**
 * Liveness analyzer
 *
 * Computes live variable sets using backward dataflow analysis.
 * Critical for 6502 register allocation (A, X, Y are precious!)
 */
export class LivenessAnalyzer {
  constructor(
    private cfg: ControlFlowGraph,
    private symbolTable: SymbolTable
  ) {}

  /**
   * Compute liveness using backward dataflow
   *
   * Dataflow equations (backward):
   * - IN[B] = USE[B] ∪ (OUT[B] - DEF[B])
   * - OUT[B] = ∪ IN[S] for all successors S of B
   */
  analyze(): void {
    // Initialize USE and DEF sets for each block
    const use = this.computeUseSets();
    const def = this.computeDefSets();

    // Backward dataflow analysis until fixpoint
    const inSets = new Map<string, Set<string>>();
    const outSets = new Map<string, Set<string>>();

    let changed = true;
    while (changed) {
      changed = false;

      // Process blocks in reverse postorder (backward)
      for (const block of this.cfg.getReversePostorder()) {
        // OUT[B] = ∪ IN[S] for all successors
        const newOut = this.unionSuccessorIns(block, inSets);

        // IN[B] = USE[B] ∪ (OUT[B] - DEF[B])
        const outMinusDef = this.setDifference(newOut, def.get(block.id)!);
        const newIn = this.setUnion(use.get(block.id)!, outMinusDef);

        // Check for changes
        if (!this.setsEqual(inSets.get(block.id), newIn) ||
            !this.setsEqual(outSets.get(block.id), newOut)) {
          changed = true;
          inSets.set(block.id, newIn);
          outSets.set(block.id, newOut);
        }
      }
    }

    // Compute live intervals
    this.computeLiveIntervals(inSets, outSets);

    // Attach metadata
    this.attachMetadata(inSets, outSets);
  }

  private computeLiveIntervals(
    inSets: Map<string, Set<string>>,
    outSets: Map<string, Set<string>>
  ): void {
    // Build live intervals for each variable
    // Used for register allocation priority
    const intervals = new Map<string, { start: number; end: number }>();

    for (const [blockId, liveVars] of inSets) {
      for (const varId of liveVars) {
        const programPoint = this.getProgramPoint(blockId);
        
        if (!intervals.has(varId)) {
          intervals.set(varId, { start: programPoint, end: programPoint });
        } else {
          const interval = intervals.get(varId)!;
          interval.start = Math.min(interval.start, programPoint);
          interval.end = Math.max(interval.end, programPoint);
        }
      }
    }

    // Attach interval metadata to variable declarations
    for (const [varId, interval] of intervals) {
      const symbol = this.symbolTable.lookup(varId);
      if (symbol?.node) {
        symbol.node.metadata = symbol.node.metadata || new Map();
        symbol.node.metadata.set(OptimizationMetadataKey.LivenessInterval, interval);
        symbol.node.metadata.set(
          OptimizationMetadataKey.LivenessIntervalLength,
          interval.end - interval.start
        );
      }
    }
  }

  // ... helper methods
}
```

**Tests** (20+):

- Variable live across multiple blocks
- Variable dead after last use
- Variable live through loop
- Conditional liveness (different paths)
- Live variable at function entry
- Live variable at function exit
- Live interval computation
- Short-lived variables (good for registers)
- Long-lived variables (need memory)
- Interference graph basics
- Register pressure calculation
- Dead store detection via liveness
- Zero-page allocation priority
- Function parameter liveness
- Return value liveness

**Test Example**:

```typescript
describe('LivenessAnalyzer', () => {
  it('should detect variable is live across blocks', () => {
    const source = `
      let x: byte = 10;  // x defined
      if (condition) {
        // x is live here (used later)
      }
      let y: byte = x;   // x used here
    `;
    
    const { ast, analyzer } = setupTest(source);
    analyzer.analyze();
    
    const ifBlock = findBlock(ast, 'if');
    const liveOut = ifBlock.metadata?.get(
      OptimizationMetadataKey.LivenessLiveOut
    );
    
    expect(liveOut).toContain('x');
  });

  it('should compute live intervals for register priority', () => {
    const source = `
      let x: byte = 1;   // Start: 0
      x = x + 1;         // Use: 1
      x = x + 2;         // Use: 2
      return x;          // End: 3
    `;
    
    const { ast, analyzer } = setupTest(source);
    analyzer.analyze();
    
    const xDecl = findNode(ast, 'x');
    const interval = xDecl.metadata?.get(
      OptimizationMetadataKey.LivenessInterval
    );
    
    expect(interval).toEqual({ start: 0, end: 3 });
    expect(xDecl.metadata?.get(
      OptimizationMetadataKey.LivenessIntervalLength
    )).toBe(3);
  });
});
```

---

## Task 8.7: Constant Propagation Analysis (6 hours)

**File**: `packages/compiler/src/semantic/analysis/constant-propagation.ts`

**Goal**: Track compile-time constant values through the program

**Why Critical**: Enables constant folding, branch elimination, array bounds optimization

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.ConstantValue;           // number - the constant value
OptimizationMetadataKey.ConstantFoldable;        // boolean - can be folded
OptimizationMetadataKey.ConstantFoldResult;      // number - folded result
OptimizationMetadataKey.ConstantEffectivelyConst; // boolean - never changes
OptimizationMetadataKey.ConstantBranchCondition; // boolean - const condition
```

**Implementation Pattern**:

```typescript
/**
 * Constant propagation analyzer
 *
 * Tracks constant values through the program using sparse
 * conditional constant propagation (optimistic algorithm).
 */
export class ConstantPropagationAnalyzer {
  private constantValues = new Map<string, number | 'TOP' | 'BOTTOM'>();

  constructor(
    private cfg: ControlFlowGraph,
    private symbolTable: SymbolTable
  ) {}

  /**
   * Sparse conditional constant propagation
   *
   * Uses lattice:
   * - TOP: not yet analyzed
   * - Constant value: known constant
   * - BOTTOM: not constant (multiple values)
   */
  analyze(): void {
    // Initialize worklist with all variables at TOP
    for (const symbol of this.symbolTable.getAllSymbols()) {
      if (symbol.kind === SymbolKind.Variable) {
        this.constantValues.set(symbol.name, 'TOP');
      }
    }

    // Process variable definitions
    let changed = true;
    while (changed) {
      changed = false;

      for (const block of this.cfg.getBlocks()) {
        for (const stmt of block.statements) {
          if (this.isVariableDeclaration(stmt)) {
            const newValue = this.evaluateInitializer(stmt);
            const oldValue = this.constantValues.get(stmt.name);

            if (this.latticeJoin(oldValue, newValue) !== oldValue) {
              this.constantValues.set(stmt.name, newValue);
              changed = true;
            }
          } else if (this.isAssignment(stmt)) {
            const newValue = this.evaluateExpression(stmt.value);
            const oldValue = this.constantValues.get(stmt.target);

            if (this.latticeJoin(oldValue, newValue) !== oldValue) {
              this.constantValues.set(stmt.target, newValue);
              changed = true;
            }
          }
        }
      }
    }

    // Constant folding pass
    this.performConstantFolding();

    // Branch condition analysis
    this.analyzeBranchConditions();

    // Attach metadata
    this.attachMetadata();
  }

  /**
   * Lattice join operation
   * TOP ⊔ x = x
   * x ⊔ x = x
   * x ⊔ y = BOTTOM (if x ≠ y)
   */
  private latticeJoin(
    a: number | 'TOP' | 'BOTTOM',
    b: number | 'TOP' | 'BOTTOM'
  ): number | 'TOP' | 'BOTTOM' {
    if (a === 'TOP') return b;
    if (b === 'TOP') return a;
    if (a === 'BOTTOM' || b === 'BOTTOM') return 'BOTTOM';
    return a === b ? a : 'BOTTOM';
  }

  private performConstantFolding(): void {
    // Fold constant expressions
    for (const block of this.cfg.getBlocks()) {
      for (const stmt of block.statements) {
        if (this.isBinaryExpression(stmt)) {
          const left = this.getConstantValue(stmt.left);
          const right = this.getConstantValue(stmt.right);

          if (typeof left === 'number' && typeof right === 'number') {
            const result = this.evaluateBinaryOp(stmt.operator, left, right);
            
            stmt.metadata = stmt.metadata || new Map();
            stmt.metadata.set(OptimizationMetadataKey.ConstantFoldable, true);
            stmt.metadata.set(OptimizationMetadataKey.ConstantFoldResult, result);
          }
        }
      }
    }
  }

  private analyzeBranchConditions(): void {
    // Detect constant branch conditions
    for (const block of this.cfg.getBlocks()) {
      if (block.terminator && this.isConditionalBranch(block.terminator)) {
        const condition = this.getConstantValue(block.terminator.condition);

        if (typeof condition === 'number') {
          block.terminator.metadata = block.terminator.metadata || new Map();
          block.terminator.metadata.set(
            OptimizationMetadataKey.ConstantBranchCondition,
            condition !== 0
          );
        }
      }
    }
  }

  // ... helper methods
}
```

**Tests** (18+):

- Simple constant propagation
- Arithmetic constant folding
- Conditional constant propagation
- Constant through loops (loop-invariant)
- Branch elimination via constant condition
- Array bounds constant checking
- Multi-level constant propagation
- Constant function parameters
- Effectively constant variables
- Non-constant detection (BOTTOM)
- Zero-page constant addresses
- @map constant addresses
- Cross-block propagation
- Phi node handling
- Conservative function call handling

**Test Example**:

```typescript
describe('ConstantPropagationAnalyzer', () => {
  it('should propagate constants through expressions', () => {
    const source = `
      let x: byte = 10;
      let y: byte = 20;
      let z: byte = x + y;  // Should fold to 30
    `;
    
    const { ast, analyzer } = setupTest(source);
    analyzer.analyze();
    
    const zInit = findNode(ast, 'z', 'initializer');
    
    expect(zInit.metadata?.get(
      OptimizationMetadataKey.ConstantFoldable
    )).toBe(true);
    
    expect(zInit.metadata?.get(
      OptimizationMetadataKey.ConstantFoldResult
    )).toBe(30);
  });

  it('should detect constant branch conditions', () => {
    const source = `
      let x: byte = 10;
      if (x > 5) {  // Always true
        // Dead code elimination possible
      }
    `;
    
    const { ast, analyzer } = setupTest(source);
    analyzer.analyze();
    
    const ifStmt = findNode(ast, 'if');
    
    expect(ifStmt.metadata?.get(
      OptimizationMetadataKey.ConstantBranchCondition
    )).toBe(true);
  });

  it('should detect effectively constant variables', () => {
    const source = `
      let x: byte = 100;
      // x never reassigned
      let y: byte = x;
      let z: byte = x;
    `;
    
    const { ast, analyzer } = setupTest(source);
    analyzer.analyze();
    
    const xDecl = findNode(ast, 'x');
    
    expect(xDecl.metadata?.get(
      OptimizationMetadataKey.ConstantEffectivelyConst
    )).toBe(true);
  });
});
```

---

---

## Task 8.21: Copy Propagation (4 hours) 🆕

**File**: `packages/compiler/src/semantic/analysis/copy-propagation.ts`

**Goal**: Replace copy variables with their original values

**Why Critical**: Eliminates unnecessary intermediate variables, reduces memory usage

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.CopyFrom;           // string - variable this is a copy of
OptimizationMetadataKey.CopyPropagatable;   // boolean - can be replaced with original
```

**What is Copy Propagation?**

When a variable is just a copy of another, replace all uses with the original:

```typescript
// Before copy propagation:
let x: byte = 10;
let y: byte = x;  // y is a copy of x
let z: byte = y;  // Use y

// After copy propagation:
let x: byte = 10;
let y: byte = x;  // y is a copy of x
let z: byte = x;  // Use x directly (y eliminated)
```

**Implementation Pattern**:

```typescript
/**
 * Copy propagation analyzer
 *
 * Identifies copy assignments (y = x) and marks opportunities
 * to replace y with x throughout the program.
 */
export class CopyPropagationAnalyzer {
  private copyMap = new Map<string, string>();  // variable -> what it's a copy of

  constructor(
    private cfg: ControlFlowGraph,
    private symbolTable: SymbolTable,
    private reachingDefs: Map<string, Set<string>>  // From Task 8.5
  ) {}

  analyze(): void {
    // Phase 1: Identify copy assignments
    for (const block of this.cfg.getBlocks()) {
      for (const stmt of block.statements) {
        if (this.isCopyAssignment(stmt)) {
          // y = x (where x is a variable, not an expression)
          this.copyMap.set(stmt.target, stmt.source);
          
          stmt.metadata = stmt.metadata || new Map();
          stmt.metadata.set(OptimizationMetadataKey.CopyFrom, stmt.source);
        }
      }
    }

    // Phase 2: Determine propagatability
    for (const [copyVar, originalVar] of this.copyMap) {
      const canPropagate = this.canPropagateCopy(copyVar, originalVar);
      
      const symbol = this.symbolTable.lookup(copyVar);
      if (symbol?.node) {
        symbol.node.metadata = symbol.node.metadata || new Map();
        symbol.node.metadata.set(
          OptimizationMetadataKey.CopyPropagatable,
          canPropagate
        );
      }
    }

    // Phase 3: Mark all uses of propagatable copies
    this.markPropagationSites();
  }

  /**
   * Check if copy assignment: y = x (where x is a simple variable)
   */
  private isCopyAssignment(stmt: Statement): boolean {
    if (!this.isAssignment(stmt)) return false;
    
    // Right side must be simple variable reference (not expression)
    return this.isSimpleVariableReference(stmt.value);
  }

  /**
   * Determine if copy can be safely propagated
   */
  private canPropagateCopy(copyVar: string, originalVar: string): boolean {
    // Can't propagate if original is reassigned before copy's uses
    if (this.isOriginalReassignedBeforeUse(copyVar, originalVar)) {
      return false;
    }

    // Can't propagate if copy is used in multiple reaching paths
    // where original has different values
    if (this.hasConflictingReachingDefinitions(copyVar, originalVar)) {
      return false;
    }

    return true;
  }

  private isOriginalReassignedBeforeUse(
    copyVar: string,
    originalVar: string
  ): boolean {
    // Check if originalVar is reassigned between copy and uses
    // Uses reaching definitions from Task 8.5
    return false; // Implementation detail
  }

  private hasConflictingReachingDefinitions(
    copyVar: string,
    originalVar: string
  ): boolean {
    // Check if different definitions of originalVar reach different uses
    return false; // Implementation detail
  }

  private markPropagationSites(): void {
    // Mark all uses of propagatable copies in AST
    for (const [copyVar, originalVar] of this.copyMap) {
      const symbol = this.symbolTable.lookup(copyVar);
      if (!symbol?.node) continue;

      const canPropagate = symbol.node.metadata?.get(
        OptimizationMetadataKey.CopyPropagatable
      );

      if (canPropagate) {
        // Mark all uses of copyVar for replacement with originalVar
        this.markUsesForReplacement(copyVar, originalVar);
      }
    }
  }

  // ... helper methods
}
```

**Tests** (10+):

- Simple copy propagation (y = x, use y → use x)
- Copy with multiple uses
- Copy not propagatable (original reassigned)
- Copy through branches
- Copy in loops
- Chained copies (y = x, z = y → z = x)
- Copy with conflicting definitions
- Copy of @map variable
- Copy of function parameter
- Copy elimination enables further optimization

**Test Example**:

```typescript
describe('CopyPropagationAnalyzer', () => {
  it('should identify and propagate simple copy', () => {
    const source = `
      let x: byte = 10;
      let y: byte = x;  // y is copy of x
      let z: byte = y;  // Should use x directly
    `;
    
    const { ast, analyzer } = setupTest(source);
    analyzer.analyze();
    
    const yDecl = findNode(ast, 'y');
    expect(yDecl.metadata?.get(OptimizationMetadataKey.CopyFrom)).toBe('x');
    expect(yDecl.metadata?.get(OptimizationMetadataKey.CopyPropagatable)).toBe(true);
  });

  it('should not propagate if original is reassigned', () => {
    const source = `
      let x: byte = 10;
      let y: byte = x;  // y is copy of x
      x = 20;           // x reassigned!
      let z: byte = y;  // Must use y, not x (different value)
    `;
    
    const { ast, analyzer } = setupTest(source);
    analyzer.analyze();
    
    const yDecl = findNode(ast, 'y');
    expect(yDecl.metadata?.get(OptimizationMetadataKey.CopyFrom)).toBe('x');
    expect(yDecl.metadata?.get(OptimizationMetadataKey.CopyPropagatable)).toBe(false);
  });

  it('should handle chained copies', () => {
    const source = `
      let x: byte = 10;
      let y: byte = x;  // y = x
      let z: byte = y;  // z = y = x (should propagate to x)
    `;
    
    const { ast, analyzer } = setupTest(source);
    analyzer.analyze();
    
    // Both y and z should be copies
    expect(findNode(ast, 'y').metadata?.get(OptimizationMetadataKey.CopyFrom)).toBe('x');
    expect(findNode(ast, 'z').metadata?.get(OptimizationMetadataKey.CopyFrom)).toBe('y');
  });
});
```

**Why This Matters**:

```typescript
// WITHOUT copy propagation:
let borderColor: byte = vicBorder;  // Load from I/O
let temp: byte = borderColor;       // Unnecessary copy
vicBorder = temp;                   // Write back
// Result: 3 memory operations

// WITH copy propagation:
let borderColor: byte = vicBorder;  // Load from I/O
// temp eliminated by copy propagation
vicBorder = borderColor;            // Write back directly
// Result: 2 memory operations (33% faster!)
```

---

## Tier 2 Summary

| Task      | Description             | Hours      | Tests         | Metadata Keys | Status  |
| --------- | ----------------------- | ---------- | ------------- | ------------- | ------- |
| 8.5       | Reaching definitions    | 8          | 20+           | 3             | [ ]     |
| 8.6       | Liveness analysis       | 8          | 20+           | 4             | [ ]     |
| 8.7       | Constant propagation    | 6          | 18+           | 5             | [ ]     |
| 8.21      | Copy propagation 🆕     | 4          | 10+           | 2             | [ ]     |
| **Total** | **Tier 2 (Data Flow)**  | **26 hrs** | **68+ tests** | **14 keys**   | **[ ]** |

---

## Integration Notes

**After Tier 2 completion, the following are available:**

1. **Reaching Definitions**: Enables constant propagation refinement, dead store detection
2. **Liveness Analysis**: Essential input for register allocation, zero-page priority
3. **Constant Propagation**: Enables constant folding, branch elimination, bounds checking

**Dependencies for Tier 3:**

- Tier 2 provides critical dataflow information
- Alias analysis (Tier 3) uses reaching definitions
- Loop analysis (Tier 3) uses liveness and constants
- 6502 hints (Tier 3) use all Tier 2 analyses

---

## Next Steps

After completing **Part 2 (Tier 2)**:

1. ✅ All Tier 2 tasks complete (8.5-8.7)
2. ✅ 58+ tests passing
3. ✅ Dataflow infrastructure working
4. ✅ Constant propagation functional

**→ Continue to [Part 3: Tier 3 - Advanced Analysis](phase8-part3-tier3.md)**

---

**Part 2 Status**: Tier 2 - Data Flow Analysis (4 tasks, 26 hours, 68+ tests)
**Architecture**: Classical dataflow algorithms, enum-based metadata ✅