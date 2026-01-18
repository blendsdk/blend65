# Phase 8: God-Level Advanced Analysis Implementation Plan

> **Status**: Implementation Plan
> **Duration**: 3-4 weeks (full-time)
> **Tasks**: 14 comprehensive tasks
> **Tests**: 295+ tests
> **Focus**: Optimization-enabling analysis (NOT transformations)
> **Last Updated**: January 15, 2026

---

## Executive Summary

Phase 8 implements **god-level advanced analysis** that enables GCC/Rust/C++ level optimizations for the 6502 target. This phase performs comprehensive **analysis and metadata generation**—it does NOT perform optimizations itself.

**Critical Distinction:**

- **Phase 8**: Analyzes code, marks opportunities, generates metadata
- **IL Optimizer (Future)**: Consumes metadata, performs transformations

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tier 1: Basic Analysis](#tier-1-basic-analysis-tasks-81-84)
4. [Tier 2: Data Flow Analysis](#tier-2-data-flow-analysis-tasks-85-87)
5. [Tier 3: Advanced Analysis](#tier-3-advanced-analysis-tasks-88-814)
6. [Implementation Guide](#implementation-guide)
7. [Testing Strategy](#testing-strategy)
8. [Success Criteria](#success-criteria)

---

## Overview

### What Phase 8 Delivers

Phase 8 provides **optimization-critical metadata** for the IL optimizer:

**1. Dead Code Analysis**

- Unreachable code detection
- Dead store identification
- Unused variable/function detection

**2. Data Flow Analysis**

- Reaching definitions
- Live variable analysis
- Constant propagation

**3. Advanced Analysis**

- Alias analysis (6502 memory-aware)
- Purity and side effect analysis
- Escape analysis
- Loop analysis (invariant code, induction variables)
- Call graph analysis (inlining candidates)
- 6502-specific optimization hints

### Prerequisites

Phase 8 requires these completed phases:

- ✅ **Phase 0**: AST Walker infrastructure
- ✅ **Phase 1**: Symbol tables and scopes
- ✅ **Phase 2**: Type system
- ✅ **Phase 3**: Type checking
- ✅ **Phase 4**: Statement validation
- ✅ **Phase 5**: Control flow graphs
- ✅ **Phase 6**: Multi-module infrastructure
- ✅ **Phase 7**: Unused import detection

### Design Principles

1. **Analysis Only** - Phase 8 marks opportunities, never transforms
2. **Metadata-Driven** - All analysis results stored as AST metadata
3. **6502-Aware** - Considers zero page, hardware registers, addressing modes
4. **Optimization-Focused** - Every analysis enables specific optimizations
5. **Performance-Conscious** - Use efficient algorithms (worklist, DFS)

---

## Architecture

### Three-Tier Analysis Architecture

```
┌─────────────────────────────────────────┐
│   Tier 1: Basic Analysis (1 week)       │
│   - Definite assignment (Task 8.1)      │
│   - Variable usage (Task 8.2)           │
│   - Unused functions (Task 8.3)         │
│   - Dead code (Task 8.4)                │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│   Tier 2: Data Flow Analysis (1 week)   │
│   - Reaching definitions (Task 8.5)     │
│   - Liveness analysis (Task 8.6)        │
│   - Constant propagation (Task 8.7)     │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│   Tier 3: Advanced Analysis (2 weeks)   │
│   - Alias analysis (Task 8.8)           │
│   - Purity analysis (Task 8.9)          │
│   - Escape analysis (Task 8.10)         │
│   - Loop analysis (Task 8.11)           │
│   - Call graph (Task 8.12)              │
│   - 6502 hints (Task 8.13)              │
│   - Integration (Task 8.14)             │
└─────────────────────────────────────────┘
```

### File Structure

```
packages/compiler/src/semantic/analysis/
├── advanced-analyzer.ts          # Main orchestrator
├── definite-assignment.ts        # Task 8.1
├── variable-usage.ts             # Task 8.2
├── unused-functions.ts           # Task 8.3
├── dead-code.ts                  # Task 8.4
├── reaching-definitions.ts       # Task 8.5
├── liveness.ts                   # Task 8.6
├── constant-propagation.ts       # Task 8.7
├── alias-analysis.ts             # Task 8.8
├── purity-analysis.ts            # Task 8.9
├── escape-analysis.ts            # Task 8.10
├── loop-analysis.ts              # Task 8.11
├── call-graph.ts                 # Task 8.12
├── m6502-hints.ts                # Task 8.13
└── index.ts                      # Exports

packages/compiler/src/__tests__/semantic/analysis/
├── definite-assignment.test.ts   # 15+ tests
├── variable-usage.test.ts        # 12+ tests
├── unused-functions.test.ts      # 10+ tests
├── dead-code.test.ts             # 15+ tests
├── reaching-definitions.test.ts  # 20+ tests
├── liveness.test.ts              # 20+ tests
├── constant-propagation.test.ts  # 18+ tests
├── alias-analysis.test.ts        # 25+ tests
├── purity-analysis.test.ts       # 20+ tests
├── escape-analysis.test.ts       # 15+ tests
├── loop-analysis.test.ts         # 25+ tests
├── call-graph.test.ts            # 20+ tests
├── m6502-hints.test.ts           # 30+ tests
└── integration.test.ts           # 50+ tests
```

### Integration with Semantic Analyzer

```typescript
// packages/compiler/src/semantic/analyzer.ts

export class SemanticAnalyzer {
  /**
   * Phase 8: Advanced analysis (after type checking)
   */
  protected runAdvancedAnalysis(ast: Program): void {
    // Create advanced analyzer
    const analyzer = new AdvancedAnalyzer(this.symbolTable, this.cfgMap, this.typeChecker);

    // Run all analyses
    const metadata = analyzer.analyze(ast);

    // Store metadata in AST
    ast.metadata = ast.metadata || new Map();
    ast.metadata.set('phase8:optimization', metadata);

    // Aggregate diagnostics
    this.diagnostics.push(...analyzer.getDiagnostics());
  }
}
```

---

## Tier 1: Basic Analysis (Tasks 8.1-8.4)

> **Duration**: 1 week
> **Tasks**: 4
> **Tests**: 52+
> **Focus**: Diagnostics and usage tracking

### Task 8.1: Definite Assignment Analysis (6 hours)

**Goal**: Detect use of variables before initialization

**Implementation**:

```typescript
/**
 * Definite assignment analysis
 *
 * Tracks variable initialization state through CFG to detect
 * use-before-initialization errors.
 */
export class DefiniteAssignmentAnalyzer {
  /**
   * Analyze definite assignment for all variables
   */
  public analyze(
    cfg: ControlFlowGraph,
    symbolTable: SymbolTable
  ): Map<string, DefiniteAssignmentInfo> {
    const results = new Map<string, DefiniteAssignmentInfo>();

    // For each variable, track initialization state
    for (const [name, symbol] of symbolTable.getAllSymbols()) {
      if (symbol.kind === 'Variable') {
        const info = this.analyzeVariable(name, cfg);
        results.set(name, info);
      }
    }

    return results;
  }

  /**
   * Analyze single variable initialization
   */
  protected analyzeVariable(variable: string, cfg: ControlFlowGraph): DefiniteAssignmentInfo {
    // Track initialization state at each CFG node
    const initialized = new Map<CFGNode, boolean>();

    // DFS from entry
    this.dfs(cfg.entry, variable, false, initialized);

    // Find use-before-init errors
    const errors = this.findUninitializedUses(variable, cfg, initialized);

    return {
      name: variable,
      alwaysInitialized: this.isAlwaysInitialized(initialized, cfg),
      initializationPaths: this.getInitPaths(variable, cfg),
      uninitializedUses: errors,
    };
  }
}
```

**Optimization Metadata Generated**:

- `phase8:definite-assignment:always-initialized` - Variable is always initialized before use
- `phase8:definite-assignment:init-value` - Known initialization value

**IL Optimizer Benefits**:

- Skip zero-initialization for always-initialized variables
- Dead store elimination for overwritten initializations

**Tests** (15+):

- Basic initialization before use
- Use before init error detection
- Conditional initialization (if/else branches)
- Loop initialization
- Multiple initialization paths
- Partial initialization warnings

---

### Task 8.2: Variable Usage Analysis (5 hours)

**Goal**: Track variable reads and writes for optimization hints

**Implementation**:

```typescript
/**
 * Variable usage analysis
 *
 * Tracks how variables are used to identify:
 * - Unused variables
 * - Write-only variables (dead stores)
 * - Read-only variables (constant candidates)
 * - Hot path access patterns
 */
export class VariableUsageAnalyzer extends BaseWalker {
  protected usageInfo = new Map<string, VariableUsageInfo>();

  /**
   * Visit identifier expression - track variable reads
   */
  protected visitIdentifierExpression(node: IdentifierExpression): void {
    const name = node.getName();
    const info = this.getOrCreateInfo(name);

    info.readCount++;
    info.isUsed = true;

    // Track hot path accesses (in loops)
    if (this.currentLoopDepth > 0) {
      info.hotPathAccesses++;
      info.maxLoopDepth = Math.max(info.maxLoopDepth, this.currentLoopDepth);
    }
  }

  /**
   * Visit assignment - track variable writes
   */
  protected visitAssignment(node: Assignment): void {
    const target = node.getTarget();
    if (target instanceof IdentifierExpression) {
      const name = target.getName();
      const info = this.getOrCreateInfo(name);

      info.writeCount++;
    }
  }
}
```

**Optimization Metadata Generated**:

- `phase8:usage:read-count` - Number of reads
- `phase8:usage:write-count` - Number of writes
- `phase8:usage:is-write-only` - Variable written but never read
- `phase8:usage:is-read-only` - Variable read but never written (after init)
- `phase8:usage:hot-path-accesses` - Accesses in loops
- `phase8:usage:max-loop-depth` - Maximum nesting depth

**IL Optimizer Benefits**:

- Dead store elimination (write-only variables)
- Register allocation priorities (hot path variables)
- Zero page allocation hints (frequently accessed)

**Diagnostics**:

- `H002` HINT: Unused variable (never read or written)
- `H003` HINT: Write-only variable (possible dead store)

**Tests** (12+):

- Basic read/write counting
- Unused variable detection
- Write-only variable detection
- Read-only variable detection
- Hot path access tracking
- Loop depth tracking

---

### Task 8.3: Unused Function Detection (4 hours)

**Goal**: Identify unused functions for dead code elimination

**Implementation**:

```typescript
/**
 * Unused function detection
 *
 * Builds call graph and identifies functions that are never called.
 * Excludes exported functions and entry points.
 */
export class UnusedFunctionAnalyzer extends BaseWalker {
  protected calledFunctions = new Set<string>();
  protected allFunctions = new Set<string>();

  /**
   * Visit function call - mark function as called
   */
  protected visitCallExpression(node: CallExpression): void {
    const callee = node.getCallee();
    if (callee instanceof IdentifierExpression) {
      this.calledFunctions.add(callee.getName());
    }
  }

  /**
   * Get unused functions
   */
  public getUnusedFunctions(): Set<string> {
    const unused = new Set<string>();

    for (const funcName of this.allFunctions) {
      // Skip exported functions (public API)
      if (this.isExported(funcName)) continue;

      // Skip entry points (module-level code)
      if (this.isEntryPoint(funcName)) continue;

      // Check if never called
      if (!this.calledFunctions.has(funcName)) {
        unused.add(funcName);
      }
    }

    return unused;
  }
}
```

**Optimization Metadata Generated**:

- `phase8:call-graph:unused` - Function is never called
- `phase8:call-graph:call-count` - Number of times function is called

**IL Optimizer Benefits**:

- Dead function elimination
- Code size reduction

**Diagnostics**:

- `H004` HINT: Unused function (never called)

**Tests** (10+):

- Basic unused function detection
- Exported functions excluded
- Recursive function handling
- Indirect calls (callbacks)
- Multi-module analysis

---

### Task 8.4: Dead Code Detection (4 hours)

**Goal**: Identify all forms of dead code

**Implementation**:

```typescript
/**
 * Dead code detection
 *
 * Identifies unreachable code using CFG reachability analysis
 * and additional patterns:
 * - Unreachable statements (after return)
 * - Unreachable branches (constant conditions)
 * - Dead stores (overwritten without reading)
 * - Unused expression results
 */
export class DeadCodeAnalyzer {
  /**
   * Find all dead code in program
   */
  public analyze(cfg: ControlFlowGraph): DeadCodeInfo[] {
    const deadCode: DeadCodeInfo[] = [];

    // 1. Unreachable statements (from CFG)
    const unreachable = cfg.getUnreachableNodes();
    for (const node of unreachable) {
      if (node.statement) {
        deadCode.push({
          kind: DeadCodeKind.UnreachableStatement,
          location: node.statement.getLocation(),
          reason: 'Statement is unreachable from function entry',
          removable: true,
        });
      }
    }

    // 2. Unreachable branches (constant conditions)
    deadCode.push(...this.findUnreachableBranches(cfg));

    // 3. Dead stores (write followed by overwrite with no read)
    deadCode.push(...this.findDeadStores(cfg));

    // 4. Unused expression results
    deadCode.push(...this.findUnusedResults(cfg));

    return deadCode;
  }
}
```

**Optimization Metadata Generated**:

- `phase8:dead-code:unreachable` - Code is unreachable
- `phase8:dead-code:dead-store` - Write has no effect
- `phase8:dead-code:constant-branch` - Branch always taken/never taken

**IL Optimizer Benefits**:

- Complete dead code elimination
- Code size reduction
- Execution time reduction

**Diagnostics**:

- `W010` WARNING: Unreachable statement
- `W011` WARNING: Dead store (overwritten before read)
- `H005` HINT: Unused expression result

**Tests** (15+):

- Unreachable statement detection
- Unreachable branch detection (constant if)
- Dead store detection
- After-return code detection
- Loop early exit patterns

---

## Tier 1 Summary

| Task      | Hours      | Tests         | Diagnostics       | Metadata Keys |
| --------- | ---------- | ------------- | ----------------- | ------------- |
| 8.1       | 6          | 15+           | 1 error           | 2             |
| 8.2       | 5          | 12+           | 2 hints           | 6             |
| 8.3       | 4          | 10+           | 1 hint            | 2             |
| 8.4       | 4          | 15+           | 3 warnings        | 3             |
| **Total** | **19 hrs** | **52+ tests** | **7 diagnostics** | **13 keys**   |

**Tier 1 Completion Criteria**:

- ✅ All 52+ tests passing
- ✅ Diagnostics generating correctly
- ✅ Metadata stored in AST nodes
- ✅ Integration with SemanticAnalyzer complete

---

## Tier 2: Data Flow Analysis (Tasks 8.5-8.7)

> **Duration**: 1 week
> **Tasks**: 3
> **Tests**: 58+
> **Focus**: Reaching definitions, liveness, constant propagation

### Task 8.5: Reaching Definitions Analysis (8 hours)

**Goal**: Track which variable definitions reach each program point

**Algorithm**: Forward data flow analysis with worklist algorithm

**Implementation**:

```typescript
/**
 * Reaching definitions analysis
 *
 * Computes which definitions of variables reach each program point.
 * Uses worklist algorithm for efficiency.
 */
export class ReachingDefinitionsAnalyzer {
  /**
   * Compute reaching definitions for CFG
   */
  public analyze(cfg: ControlFlowGraph): ReachingDefinitionsInfo {
    // Initialize IN and OUT sets for each node
    const IN = new Map<CFGNode, Set<Definition>>();
    const OUT = new Map<CFGNode, Set<Definition>>();

    // Initialize worklist with all nodes
    const worklist: CFGNode[] = Array.from(cfg.getNodes());

    // Iterative data flow analysis
    while (worklist.length > 0) {
      const node = worklist.shift()!;

      // IN[n] = union of OUT[p] for all predecessors p
      const inSet = this.computeIN(node, OUT);
      IN.set(node, inSet);

      // OUT[n] = GEN[n] ∪ (IN[n] - KILL[n])
      const oldOut = OUT.get(node) || new Set();
      const newOut = this.computeOUT(node, inSet);

      // If OUT changed, add successors to worklist
      if (!this.setsEqual(oldOut, newOut)) {
        OUT.set(node, newOut);
        for (const succ of node.successors) {
          if (!worklist.includes(succ)) {
            worklist.push(succ);
          }
        }
      }
    }

    // Build def-use and use-def chains
    return this.buildChains(IN, OUT, cfg);
  }
}
```

**Optimization Metadata Generated**:

- `phase8:reaching-defs:definitions` - Set of definitions reaching this point
- `phase8:reaching-defs:def-use-chain` - Which uses this definition reaches
- `phase8:reaching-defs:use-def-chain` - Which definitions reach this use

**IL Optimizer Benefits**:

- Constant propagation (track constant values through definitions)
- Dead store elimination (definition never reaches a use)
- Common subexpression elimination (same definition reaches multiple uses)

**Tests** (20+):

- Basic reaching definitions
- Multiple definitions of same variable
- Definitions across branches (if/else)
- Definitions in loops
- Phi node handling at merge points
- Def-use chain correctness
- Use-def chain correctness

---

### Task 8.6: Live Variable Analysis (8 hours)

**Goal**: Determine which variables are live at each program point

**Algorithm**: Backward data flow analysis with worklist algorithm

**Implementation**:

```typescript
/**
 * Live variable analysis
 *
 * Computes which variables are live (will be used in the future)
 * at each program point. Uses backward data flow analysis.
 */
export class LivenessAnalyzer {
  /**
   * Compute liveness for CFG
   */
  public analyze(cfg: ControlFlowGraph): LivenessInfo {
    // Initialize IN and OUT sets for each node
    const IN = new Map<CFGNode, Set<string>>();
    const OUT = new Map<CFGNode, Set<string>>();

    // Initialize worklist with all nodes (reverse order)
    const worklist: CFGNode[] = this.getReversePostOrder(cfg);

    // Iterative backward data flow analysis
    while (worklist.length > 0) {
      const node = worklist.shift()!;

      // OUT[n] = union of IN[s] for all successors s
      const outSet = this.computeOUT(node, IN);
      OUT.set(node, outSet);

      // IN[n] = USE[n] ∪ (OUT[n] - DEF[n])
      const oldIn = IN.get(node) || new Set();
      const newIn = this.computeIN(node, outSet);

      // If IN changed, add predecessors to worklist
      if (!this.setsEqual(oldIn, newIn)) {
        IN.set(node, newIn);
        for (const pred of node.predecessors) {
          if (!worklist.includes(pred)) {
            worklist.push(pred);
          }
        }
      }
    }

    // Compute liveness intervals
    return this.buildIntervals(IN, OUT, cfg);
  }

  /**
   * Build liveness intervals for each variable
   */
  protected buildIntervals(
    liveIn: Map<CFGNode, Set<string>>,
    liveOut: Map<CFGNode, Set<string>>,
    cfg: ControlFlowGraph
  ): LivenessInfo {
    const intervals = new Map<string, LivenessInterval>();

    // For each variable, find first def and last use
    for (const node of cfg.getNodes()) {
      const vars = liveIn.get(node) || new Set();
      for (const variable of vars) {
        // Update or create interval
        // ...
      }
    }

    return {
      liveIn,
      liveOut,
      intervals,
    };
  }
}
```

**Optimization Metadata Generated**:

- `phase8:liveness:live-in` - Variables live before this node
- `phase8:liveness:live-out` - Variables live after this node
- `phase8:liveness:interval-length` - How long variable is live
- `phase8:liveness:overlaps` - Which variables have overlapping lifetimes

**IL Optimizer Benefits**:

- Register allocation (non-overlapping lifetimes can share registers)
- Dead code elimination (assignments to dead variables)
- 6502 zero page allocation (short-lived variables are good candidates)

**Tests** (20+):

- Basic liveness analysis
- Variables live across branches
- Variables live in loops
- Dead variable detection
- Liveness interval computation
- Register interference (overlapping intervals)

---

### Task 8.7: Constant Propagation Analysis (6 hours)

**Goal**: Track compile-time constant values through the program

**Algorithm**: Sparse Conditional Constant Propagation (SCCP)

**Implementation**:

```typescript
/**
 * Constant propagation analysis
 *
 * Tracks known constant values through the program using
 * Sparse Conditional Constant Propagation (SCCP) algorithm.
 */
export class ConstantPropagationAnalyzer {
  /**
   * Perform SCCP analysis
   */
  public analyze(cfg: ControlFlowGraph): ConstantPropagationInfo {
    // Lattice values: ⊤ (unknown), constant, ⊥ (not constant)
    const values = new Map<string, ConstantValue | 'TOP' | 'BOTTOM'>();

    // Worklist of CFG edges to process
    const cfgWorkList: [CFGNode, CFGNode][] = [[cfg.entry, cfg.entry.successors[0]]];

    // Worklist of SSA edges to process
    const ssaWorkList: Definition[] = [];

    // Process worklists until convergence
    while (cfgWorkList.length > 0 || ssaWorkList.length > 0) {
      if (cfgWorkList.length > 0) {
        const [from, to] = cfgWorkList.shift()!;
        this.visitEdge(from, to, values, cfgWorkList, ssaWorkList);
      } else {
        const def = ssaWorkList.shift()!;
        this.visitDefinition(def, values, cfgWorkList, ssaWorkList);
      }
    }

    // Identify constant-foldable expressions
    return this.identifyOptimizations(values, cfg);
  }

  /**
   * Identify optimization opportunities
   */
  protected identifyOptimizations(
    values: Map<string, ConstantValue | 'TOP' | 'BOTTOM'>,
    cfg: ControlFlowGraph
  ): ConstantPropagationInfo {
    const foldableExpressions = new Set<Expression>();
    const effectivelyConst = new Set<string>();
    const constantBranches = new Map<CFGNode, boolean>();

    // Find expressions with constant operands
    for (const node of cfg.getNodes()) {
      if (node.statement) {
        this.analyzeForFolding(node.statement, values, foldableExpressions);
      }

      // Find constant branch conditions
      if (node.kind === CFGNodeKind.Branch) {
        const condition = this.getBranchCondition(node);
        if (condition !== 'TOP' && condition !== 'BOTTOM') {
          constantBranches.set(node, !!condition);
        }
      }
    }

    // Find effectively constant variables
    for (const [variable, value] of values) {
      if (value !== 'TOP' && value !== 'BOTTOM') {
        effectivelyConst.add(variable);
      }
    }

    return {
      constants: new Map(), // Populated with per-node constant values
      foldableExpressions,
      effectivelyConst,
      constantBranches,
    };
  }
}
```

**Optimization Metadata Generated**:

- `phase8:constant:value` - Known constant value
- `phase8:constant:foldable` - Expression can be folded at compile time
- `phase8:constant:effectively-const` - Variable is effectively constant
- `phase8:constant:branch-condition` - Branch condition is constant

**IL Optimizer Benefits**:

- Constant folding (evaluate expressions at compile time)
- Branch elimination (remove unreachable branches)
- Dead code elimination (code after constant false branches)
- Strength reduction (replace operations with simpler equivalents)

**Tests** (18+):

- Basic constant propagation
- Constant propagation through assignments
- Constant folding in expressions
- Constant branch elimination
- Propagation through phi nodes
- Non-constant value handling
- SCCP algorithm correctness

---

## Tier 2 Summary

| Task      | Hours      | Tests         | Algorithms                    | Complexity    |
| --------- | ---------- | ------------- | ----------------------------- | ------------- |
| 8.5       | 8          | 20+           | Forward data flow (worklist)  | O(N × E)      |
| 8.6       | 8          | 20+           | Backward data flow (worklist) | O(N × E)      |
| 8.7       | 6          | 18+           | SCCP (sparse analysis)        | O(N + E)      |
| **Total** | **22 hrs** | **58+ tests** | **Data flow analysis**        | **Efficient** |

**Tier 2 Completion Criteria**:

- ✅ All 58+ tests passing
- ✅ Worklist algorithms implemented correctly
- ✅ Data flow equations correct
- ✅ Convergence guaranteed (fixed-point reached)
- ✅ Performance acceptable (<500ms for 1000 LOC)

---

## Tier 3: Advanced Analysis (Tasks 8.8-8.14)

> **Duration**: 2 weeks
> **Tasks**: 7
> **Tests**: 185+
> **Focus**: God-level optimization analysis (alias, purity, loops, call graph, 6502 hints)

**Due to document length, Tier 3 tasks are summarized. See `phase8-metadata-specification.md` for complete data structures.**

### Task Summary

| Task      | Description                                             | Hours      | Tests          | Key Benefit                  |
| --------- | ------------------------------------------------------- | ---------- | -------------- | ---------------------------- |
| 8.8       | **Alias Analysis** - 6502 memory-aware pointer analysis | 10         | 25+            | Safe load/store reordering   |
| 8.9       | **Purity Analysis** - Side effect detection             | 8          | 20+            | Function inlining, CSE       |
| 8.10      | **Escape Analysis** - Variable scope analysis           | 6          | 15+            | Aggressive optimization      |
| 8.11      | **Loop Analysis** - Invariant code, induction variables | 10         | 25+            | Loop optimization            |
| 8.12      | **Call Graph** - Inlining candidates, recursion         | 8          | 20+            | Dead function elimination    |
| 8.13      | **6502 Hints** - Zero page, registers, addressing modes | 10         | 30+            | Target-specific optimization |
| 8.14      | **Integration** - Orchestrate all analyses              | 10         | 50+            | End-to-end analysis          |
| **Total** | **7 advanced analyses**                                 | **62 hrs** | **185+ tests** | **God-level optimization**   |

### Critical Implementation Notes

**Task 8.8: Alias Analysis (6502-Specific)**

- Zero page ($00-$FF) never aliases with RAM
- @map hardware registers have fixed addresses (no aliasing)
- Array accesses need conservative analysis
- Enables: Load/store reordering, redundant load elimination

**Task 8.11: Loop Analysis**

- Natural loop detection (back edges in CFG)
- Loop-invariant code motion opportunities
- Induction variable identification (for strength reduction)
- Counted loops (0 to 255) are 6502 optimization targets

**Task 8.13: 6502 Optimization Hints**

- Zero page priority scoring (frequency × loop depth)
- Register allocation hints (A, X, Y preferences)
- Addressing mode selection (zero page vs absolute)
- Instruction pattern matching (INC/DEC, BEQ/BNE, etc.)

---

## Implementation Guide

### Phase-by-Phase Workflow

**Week 1: Tier 1 (Basic Analysis)**

- Day 1-2: Tasks 8.1, 8.2 (definite assignment, variable usage)
- Day 3: Task 8.3 (unused functions)
- Day 4: Task 8.4 (dead code)
- Day 5: Integration, testing, bug fixes

**Week 2: Tier 2 (Data Flow)**

- Day 1-2: Task 8.5 (reaching definitions)
- Day 3-4: Task 8.6 (liveness analysis)
- Day 5: Task 8.7 (constant propagation)

**Week 3: Tier 3a (Alias, Purity, Escape)**

- Day 1-3: Task 8.8 (alias analysis)
- Day 4: Task 8.9 (purity analysis)
- Day 5: Task 8.10 (escape analysis)

**Week 4: Tier 3b (Loops, Call Graph, 6502)**

- Day 1-2: Task 8.11 (loop analysis)
- Day 3: Task 8.12 (call graph)
- Day 4: Task 8.13 (6502 hints)
- Day 5: Task 8.14 (integration & final testing)

### Code Quality Standards

**All Phase 8 code must follow**:

- ✅ Comprehensive JSDoc comments
- ✅ Algorithm complexity documented
- ✅ TypeScript strict mode
- ✅ 95%+ test coverage
- ✅ Performance benchmarks included
- ✅ Examples in comments

---

## Testing Strategy

### Test Categories

**1. Unit Tests (per analysis)**

- Algorithm correctness
- Edge case handling
- Performance characteristics
- Example: `reaching-definitions.test.ts` (20+ tests)

**2. Integration Tests**

- Multiple analyses working together
- Metadata dependencies correct
- Example: `integration.test.ts` (50+ tests)

**3. Real-World Tests**

- C64 game code patterns
- Snake game analysis
- Performance critical code
- Example: Sprite multiplexer optimization

**4. Performance Tests**

- 100 LOC: <100ms
- 1,000 LOC: <500ms
- 10,000 LOC: <2s
- Benchmark against real programs

### Test Coverage Requirements

| Tier      | Tests          | Coverage | Status            |
| --------- | -------------- | -------- | ----------------- |
| Tier 1    | 52+            | 95%+     | Must pass         |
| Tier 2    | 58+            | 95%+     | Must pass         |
| Tier 3    | 185+           | 90%+     | Must pass         |
| **Total** | **295+ tests** | **93%+** | **Zero failures** |

---

## Success Criteria

### Phase 8 Complete When:

**✅ Functional Requirements:**

- All 14 tasks implemented
- All 295+ tests passing
- Zero test failures
- All metadata formats match specification

**✅ Performance Requirements:**

- 1,000 LOC programs analyze in <500ms
- 10,000 LOC programs analyze in <2s
- No memory leaks
- No exponential algorithms

**✅ Quality Requirements:**

- 93%+ test coverage
- All public APIs documented
- Code review complete
- Integration tests passing

**✅ Optimization Requirements:**

- Dead code detection working
- Constant propagation working
- Zero page hints generating
- Liveness analysis accurate

### Deliverables

1. **Source Code**
   - `packages/compiler/src/semantic/analysis/` (14 files)
   - All files following coding standards

2. **Test Suite**
   - `packages/compiler/src/__tests__/semantic/analysis/` (14 test files)
   - 295+ tests, all passing

3. **Documentation**
   - JSDoc for all public APIs
   - Algorithm descriptions in comments
   - Examples in code

4. **Metadata Specification**
   - `plans/phase8-metadata-specification.md` (complete)
   - Defines IL optimizer interface

5. **Integration**
   - SemanticAnalyzer calls AdvancedAnalyzer
   - Metadata stored in AST
   - Diagnostics aggregated

---

## Final Task Checklist

| Task                           | Description                  | Hours       | Tests          | Status  |
| ------------------------------ | ---------------------------- | ----------- | -------------- | ------- |
| **Tier 1: Basic Analysis**     |                              |             |                |         |
| 8.1                            | Definite assignment analysis | 6           | 15+            | [ ]     |
| 8.2                            | Variable usage analysis      | 5           | 12+            | [ ]     |
| 8.3                            | Unused function detection    | 4           | 10+            | [ ]     |
| 8.4                            | Dead code detection          | 4           | 15+            | [ ]     |
| **Tier 2: Data Flow Analysis** |                              |             |                |         |
| 8.5                            | Reaching definitions         | 8           | 20+            | [ ]     |
| 8.6                            | Liveness analysis            | 8           | 20+            | [ ]     |
| 8.7                            | Constant propagation         | 6           | 18+            | [ ]     |
| **Tier 3: Advanced Analysis**  |                              |             |                |         |
| 8.8                            | Alias analysis               | 10          | 25+            | [ ]     |
| 8.9                            | Purity analysis              | 8           | 20+            | [ ]     |
| 8.10                           | Escape analysis              | 6           | 15+            | [ ]     |
| 8.11                           | Loop analysis                | 10          | 25+            | [ ]     |
| 8.12                           | Call graph analysis          | 8           | 20+            | [ ]     |
| 8.13                           | 6502 optimization hints      | 10          | 30+            | [ ]     |
| 8.14                           | Integration & testing        | 10          | 50+            | [ ]     |
| **TOTAL**                      | **14 tasks**                 | **103 hrs** | **295+ tests** | **[ ]** |

---

## Next Steps After Phase 8

With Phase 8 complete, the compiler will have:

- ✅ Complete semantic analysis
- ✅ Comprehensive optimization metadata
- ✅ Production-ready diagnostics
- ✅ Ready for IL generator

**Proceed to**: IL Generator implementation (uses Phase 8 metadata)

---

**Phase 8 Status**: Implementation Plan Complete
**Ready for**: Act Mode implementation
**Estimated Duration**: 3-4 weeks full-time
**Confidence**: High (well-defined tasks, clear deliverables)
