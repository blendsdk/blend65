# Phase 8: Optimization Metadata Specification

> **Purpose**: Define the exact metadata format that Phase 8 produces for IL optimizer consumption
> **Status**: Specification Document
> **Last Updated**: January 15, 2026

---

## Overview

This document specifies the **optimization metadata** that Phase 8 (Advanced Analysis) generates. The IL optimizer consumes this metadata to perform god-level optimizations.

**Key Principle**: Phase 8 ANALYZES and MARKS, IL Optimizer TRANSFORMS.

---

## Table of Contents

1. [Metadata Architecture](#metadata-architecture)
2. [Core Data Structures](#core-data-structures)
3. [Tier 1: Basic Analysis Metadata](#tier-1-basic-analysis-metadata)
4. [Tier 2: Data Flow Analysis Metadata](#tier-2-data-flow-analysis-metadata)
5. [Tier 3: Advanced Analysis Metadata](#tier-3-advanced-analysis-metadata)
6. [Usage Examples](#usage-examples)
7. [Integration Points](#integration-points)

---

## Metadata Architecture

### Storage Location

All optimization metadata is stored in the AST nodes' `metadata` field:

```typescript
// Base AST node (from ast/base.ts)
interface ASTNode {
  metadata?: Map<string, unknown>; // Optimization metadata stored here
}
```

### Metadata Namespaces

To prevent collisions, metadata uses namespaced keys:

```typescript
// Namespace format: "phase8:<category>:<key>"
node.metadata.set('phase8:constant:value', 42);
node.metadata.set('phase8:liveness:live-in', new Set(['x', 'y']));
node.metadata.set('phase8:purity:level', PurityLevel.Pure);
```

---

## Core Data Structures

### OptimizationMetadata (Root)

```typescript
/**
 * Root optimization metadata container
 *
 * Attached to Program node for global access.
 */
export interface OptimizationMetadata {
  /** Metadata format version */
  version: string;

  /** When this metadata was generated */
  timestamp: Date;

  /** Per-function analysis results */
  functions: Map<string, FunctionMetadata>;

  /** Per-variable analysis results */
  variables: Map<string, VariableMetadata>;

  /** Global optimization opportunities */
  opportunities: OptimizationOpportunity[];

  /** Analysis metrics (performance tracking) */
  metrics: AnalysisMetrics;
}
```

---

## Usage Examples

### Example 1: Constant Propagation

```typescript
// Blend65 code:
let x: byte = 10;
let y: byte = x + 5;

// Phase 8 marks:
x.metadata.set('phase8:constant:value', 10);
x.metadata.set('phase8:constant:effectively-const', true);

// Expression "x + 5"
expr.metadata.set('phase8:constant:foldable', true);
expr.metadata.set('phase8:constant:result', 15);

// IL Optimizer uses this to transform:
// let y: byte = 15;  // Constant folded
```

### Example 2: Zero Page Allocation

```typescript
// Blend65 code:
@zp let counter: byte = 0;
for counter = 0 to 255
  // counter accessed 1000 times in hot loop
next counter

// Phase 8 analyzes:
counter.metadata.set('phase8:usage:read-count', 1000);
counter.metadata.set('phase8:usage:hot-path-accesses', 1000);
counter.metadata.set('phase8:usage:max-loop-depth', 1);
counter.metadata.set('phase8:6502:zp-priority', 100); // HIGH

// IL Optimizer allocates counter to $FB (zero page)
```

### Example 3: Dead Code Elimination

```typescript
// Blend65 code:
if false
  // This code is unreachable
  let x: byte = 10;
end if

// Phase 8 marks:
ifStmt.metadata.set('phase8:constant:condition', false);
thenBlock.metadata.set('phase8:dead-code:unreachable', true);
thenBlock.metadata.set('phase8:dead-code:kind', DeadCodeKind.UnreachableBranch);

// IL Optimizer removes entire if statement
```

### Example 4: Loop Invariant Code Motion

```typescript
// Blend65 code:
let result: word;
for i = 0 to 100
  result = i * constant;  // "constant" never changes in loop
next i

// Phase 8 marks:
constantExpr.metadata.set('phase8:loop:invariant', true);
constantExpr.metadata.set('phase8:loop:hoist-candidate', true);

// IL Optimizer hoists:
// let temp = constant;
// for i = 0 to 100
//   result = i * temp;
// next i
```

### Example 5: Function Inlining

```typescript
// Blend65 code:
function add(a: byte, b: byte): byte
  return a + b;
end function

let result = add(5, 10);  // Only call site

// Phase 8 marks:
addFunc.metadata.set('phase8:purity:level', PurityLevel.Pure);
addFunc.metadata.set('phase8:call-graph:size', 15); // 15 bytes
addFunc.metadata.set('phase8:call-graph:call-count', 1);
addFunc.metadata.set('phase8:inline:priority', 95); // HIGH

// IL Optimizer inlines:
// let result = 5 + 10;  // Then constant folds to 15
```

---

## Integration Points

### Phase 8 Analyzer Interface

```typescript
/**
 * Phase 8: Advanced Analysis Pass
 */
export class AdvancedAnalyzer extends BaseWalker {
  /**
   * Perform all Phase 8 analyses
   *
   * @param program AST to analyze
   * @param cfg Control flow graph (from Phase 5)
   * @param symbolTable Symbol table (from Phase 1)
   * @returns Optimization metadata
   */
  public analyze(
    program: Program,
    cfg: Map<FunctionDecl, ControlFlowGraph>,
    symbolTable: SymbolTable
  ): OptimizationMetadata {
    // Tier 1: Basic Analysis
    this.analyzeDefiniteAssignment(program, cfg);
    this.analyzeVariableUsage(program, symbolTable);
    this.analyzeUnusedFunctions(program, symbolTable);
    this.analyzeDeadCode(program, cfg);

    // Tier 2: Data Flow Analysis
    this.computeReachingDefinitions(cfg);
    this.computeLiveness(cfg);
    this.propagateConstants(cfg);

    // Tier 3: Advanced Analysis
    this.analyzeAliasing(program);
    this.analyzePurity(program);
    this.analyzeEscape(program);
    this.analyzeLoops(cfg);
    this.buildCallGraph(program);
    this.generate6502Hints(program);

    return this.gatherMetadata();
  }
}
```

### IL Optimizer Consumption

```typescript
/**
 * IL Optimizer uses Phase 8 metadata
 */
export class ILOptimizer {
  /**
   * Apply optimizations using Phase 8 metadata
   */
  public optimize(il: ILProgram, metadata: OptimizationMetadata): ILProgram {
    // Use constant propagation metadata
    il = this.constantFolding(il, metadata);

    // Use dead code metadata
    il = this.eliminateDeadCode(il, metadata);

    // Use loop metadata
    il = this.optimizeLoops(il, metadata);

    // Use inlining metadata
    il = this.inlineFunctions(il, metadata);

    // Use 6502-specific hints
    il = this.apply6502Optimizations(il, metadata);

    return il;
  }
}
```

### Accessing Metadata in Code

```typescript
// Reading metadata from AST nodes:
const constantValue = node.metadata?.get('phase8:constant:value') as number;
const isInvariant = node.metadata?.get('phase8:loop:invariant') as boolean;
const zpPriority = node.metadata?.get('phase8:6502:zp-priority') as number;

// Checking if metadata exists:
if (node.metadata?.has('phase8:constant:foldable')) {
  // This expression can be constant-folded
  const result = node.metadata.get('phase8:constant:result');
}

// Iterating over optimization opportunities:
for (const opp of metadata.opportunities) {
  if (opp.kind === OptimizationKind.ConstantFolding) {
    applyConstantFolding(opp);
  }
}
```

---

## Performance Considerations

### Metadata Size

- **Estimated overhead**: ~2-5KB per 1000 LOC
- **Storage**: In-memory only (not serialized to disk)
- **Lifetime**: Generated during Phase 8, consumed by IL optimizer, then discarded

### Analysis Performance

Expected analysis time for Phase 8:

| Program Size | Analysis Time | Bottleneck     |
| ------------ | ------------- | -------------- |
| 100 LOC      | <100ms        | Negligible     |
| 1,000 LOC    | <500ms        | Data flow      |
| 10,000 LOC   | <2s           | Alias analysis |
| 50,000 LOC   | <10s          | Call graph     |

**Optimization:** Use worklist algorithms for data flow to avoid exponential complexity.

---

## Summary

This metadata specification defines the **exact interface** between Phase 8 (Advanced Analysis) and the IL Optimizer.

**Key Points:**

1. ✅ **Namespaced Keys** - Prevent metadata collisions
2. ✅ **Typed Structures** - Clear contracts for each analysis
3. ✅ **Optimization-Focused** - Data designed for transformation, not just diagnostics
4. ✅ **6502-Aware** - Includes target-specific optimization hints
5. ✅ **Performance-Conscious** - Efficient storage and access patterns

**Next Steps:**

- Implement Phase 8 analysis passes (see `semantic-analyzer-phase8-god-level.md`)
- Create IL optimizer that consumes this metadata
- Benchmark analysis performance on real programs

## Tier 3: Advanced Analysis Metadata

### AliasAnalysisInfo

```typescript
/**
 * Alias analysis for memory operations (Task 8.8)
 */
export interface AliasAnalysisInfo {
  /** Which memory locations might be accessed by each expression */
  pointsTo: Map<Expression, Set<MemoryLocation>>;

  /** Sets of non-aliasing memory locations */
  nonAliasSets: Set<Set<MemoryLocation>>;

  /** Memory region classification */
  regions: Map<Expression, MemoryRegion>;
}

export interface MemoryLocation {
  /** Type of memory location */
  kind: MemoryLocationKind;

  /** Base address (for @map) */
  address?: number;

  /** Variable name (for variables) */
  variable?: string;

  /** Array base + index expression */
  arrayBase?: string;
  arrayIndex?: Expression;
}

export enum MemoryLocationKind {
  ZeroPage = 'ZeroPage', // $00-$FF
  RAM = 'RAM', // General purpose RAM
  Hardware = 'Hardware', // @map I/O registers
  Unknown = 'Unknown',
}

export enum MemoryRegion {
  ZeroPage = 'ZeroPage',
  RAM = 'RAM',
  IO = 'IO',
  Unknown = 'Unknown',
}
```

### PurityInfo

```typescript
/**
 * Function purity and side effect analysis (Task 8.9)
 */
export interface PurityInfo {
  /** Purity classification */
  level: PurityLevel;

  /** Memory locations written by function */
  writtenLocations: Set<MemoryLocation>;

  /** Memory locations read by function */
  readLocations: Set<MemoryLocation>;

  /** Is function deterministic (same input → same output)? */
  isDeterministic: boolean;

  /** Can this function be safely inlined? */
  isInlineable: boolean;

  /** Does function access hardware registers? */
  accessesHardware: boolean;
}

export enum PurityLevel {
  Pure = 'Pure', // No side effects, deterministic
  ReadOnly = 'ReadOnly', // Reads globals, no writes
  LocalOnly = 'LocalOnly', // Only local side effects
  HasSideEffects = 'HasSideEffects', // Writes globals, I/O, etc.
}
```

### EscapeAnalysisInfo

```typescript
/**
 * Escape analysis (Task 8.10)
 */
export interface EscapeAnalysisInfo {
  /** Variables that escape function scope */
  escapes: Set<string>;

  /** Variables safe for aggressive optimization */
  stackAllocatable: Set<string>;

  /** Variables that must be in global scope */
  requiresGlobal: Set<string>;

  /** How variable escapes */
  escapeReason: Map<string, EscapeReason>;
}

export enum EscapeReason {
  PassedToFunction = 'PassedToFunction',
  StoredInGlobal = 'StoredInGlobal',
  ReturnedFromFunction = 'ReturnedFromFunction',
  AddressTaken = 'AddressTaken',
}
```

### LoopAnalysisInfo

```typescript
/**
 * Loop structure and optimization analysis (Task 8.11)
 */
export interface LoopAnalysisInfo {
  /** All natural loops in function */
  loops: Set<Loop>;

  /** Loop nesting tree */
  loopTree: LoopNestingTree;

  /** Loop-invariant code per loop */
  invariantCode: Map<Loop, Set<Statement>>;

  /** Induction variables per loop */
  inductionVars: Map<Loop, Set<InductionVariable>>;

  /** Counted loops (optimization targets) */
  countedLoops: Set<Loop>;
}

export interface Loop {
  /** Loop header (condition node) */
  header: CFGNode;

  /** Loop body nodes */
  body: Set<CFGNode>;

  /** Loop exit nodes */
  exits: Set<CFGNode>;

  /** Back edges (body → header) */
  backEdges: Set<[CFGNode, CFGNode]>;

  /** Nesting level */
  nestingLevel: number;
}

export interface InductionVariable {
  /** Variable name */
  variable: string;

  /** Initial value */
  initial: number | Expression;

  /** Increment per iteration */
  stride: number;

  /** Loop bounds */
  bounds: LoopBounds;
}

export interface LoopBounds {
  /** Lower bound */
  lower: number | Expression;

  /** Upper bound */
  upper: number | Expression;

  /** Is this a counted loop (constant bounds)? */
  isCounted: boolean;
}

export interface LoopNestingTree {
  /** Root loops (not nested in other loops) */
  roots: Set<Loop>;

  /** Parent loop for each nested loop */
  parent: Map<Loop, Loop>;

  /** Child loops for each loop */
  children: Map<Loop, Set<Loop>>;
}
```

### CallGraphInfo

```typescript
/**
 * Call graph and inlining analysis (Task 8.12)
 */
export interface CallGraphInfo {
  /** Complete call graph */
  callGraph: CallGraph;

  /** Strongly connected components (recursive cycles) */
  recursiveSets: Set<Set<FunctionDecl>>;

  /** Inline candidates with priority */
  inlineCandidates: Map<FunctionDecl, InlinePriority>;

  /** Tail call optimization candidates */
  tailCallCandidates: Set<CallExpression>;

  /** Function metrics */
  metrics: Map<FunctionDecl, FunctionMetrics>;
}

export interface CallGraph {
  /** Nodes (functions) */
  nodes: Set<FunctionDecl>;

  /** Edges (calls) */
  edges: Map<FunctionDecl, Set<FunctionDecl>>;

  /** Reverse edges (called by) */
  reverseEdges: Map<FunctionDecl, Set<FunctionDecl>>;
}

export interface InlinePriority {
  /** Priority score (higher = more important to inline) */
  score: number;

  /** Reasons for inlining */
  reasons: InlineReason[];

  /** Estimated benefit */
  benefit: number;

  /** Estimated cost */
  cost: number;
}

export enum InlineReason {
  SmallFunction = 'SmallFunction', // Function is tiny
  CalledOnce = 'CalledOnce', // Only one call site
  HotPath = 'HotPath', // Called in performance-critical code
  EnablesOptimization = 'EnablesOptimization', // Unlocks other optimizations
}

export interface FunctionMetrics {
  /** Estimated size in bytes */
  size: number;

  /** Number of times called */
  callCount: number;

  /** Call graph depth */
  depth: number;

  /** Is leaf function (no callees)? */
  isLeaf: boolean;

  /** Is on hot path? */
  isHot: boolean;

  /** Is recursive? */
  isRecursive: boolean;
}
```

### M6502OptimizationHints

```typescript
/**
 * 6502-specific optimization hints (Task 8.13)
 */
export interface M6502OptimizationHints {
  /** Zero page allocation priorities */
  zpAllocation: Map<string, ZeroPagePriority>;

  /** Register allocation hints */
  registerHints: Map<string, RegisterPreference>;

  /** Addressing mode opportunities */
  addressingModes: Map<Expression, AddressingModeHint>;

  /** Instruction selection hints */
  instructionHints: Map<Expression, InstructionPattern>;
}

export interface ZeroPagePriority {
  /** Variable name */
  variable: string;

  /** Access frequency */
  accessFrequency: number;

  /** Maximum loop nesting depth */
  loopDepth: number;

  /** Combined priority score */
  priority: number;

  /** Estimated cycle savings if in zero page */
  cycleSavings: number;
}

export interface RegisterPreference {
  /** Variable name */
  variable: string;

  /** Preferred register (A, X, Y) */
  register: Register;

  /** Why this register is preferred */
  reason: string;
}

export enum Register {
  A = 'A', // Accumulator
  X = 'X', // X index register
  Y = 'Y', // Y index register
  None = 'None',
}

export interface AddressingModeHint {
  /** Expression being accessed */
  expression: Expression;

  /** Recommended addressing mode */
  mode: AddressingMode;

  /** Estimated cycle savings */
  cycleSavings: number;
}

export enum AddressingMode {
  ZeroPage = 'ZeroPage', // $00-$FF (2 bytes, 3 cycles)
  Absolute = 'Absolute', // $0000-$FFFF (3 bytes, 4 cycles)
  ZeroPageIndexed = 'ZeroPageIndexed', // $00,X or $00,Y
  AbsoluteIndexed = 'AbsoluteIndexed', // $0000,X or $0000,Y
  Indirect = 'Indirect', // ($00) or ($0000)
}

export interface InstructionPattern {
  /** Expression/operation */
  expression: Expression;

  /** Optimal 6502 instruction(s) */
  instructions: string[];

  /** Pattern description */
  pattern: string;
}
```

---

## Tier 2: Data Flow Analysis Metadata

### ReachingDefinitionsInfo

```typescript
/**
 * Reaching definitions analysis (Task 8.5)
 */
export interface ReachingDefinitionsInfo {
  /** For each program point, which definitions reach it */
  reachingDefs: Map<CFGNode, Set<Definition>>;

  /** Def-use chains: which uses are reached by each definition */
  defUseChains: Map<Definition, Set<Use>>;

  /** Use-def chains: which definitions reach each use */
  useDefChains: Map<Use, Set<Definition>>;
}

export interface Definition {
  /** Variable being defined */
  variable: string;

  /** CFG node where definition occurs */
  node: CFGNode;

  /** AST node (assignment, declaration, etc.) */
  astNode: Statement;

  /** Value being assigned (if known) */
  value?: ConstantValue;
}

export interface Use {
  /** Variable being used */
  variable: string;

  /** CFG node where use occurs */
  node: CFGNode;

  /** AST node (identifier expression) */
  astNode: Expression;
}
```

### LivenessInfo

```typescript
/**
 * Live variable analysis (Task 8.6)
 */
export interface LivenessInfo {
  /** Variables live before each CFG node */
  liveIn: Map<CFGNode, Set<string>>;

  /** Variables live after each CFG node */
  liveOut: Map<CFGNode, Set<string>>;

  /** Liveness intervals for each variable */
  intervals: Map<string, LivenessInterval>;
}

export interface LivenessInterval {
  /** Variable identifier */
  variable: string;

  /** Start point (first definition) */
  start: CFGNode;

  /** End point (last use) */
  end: CFGNode;

  /** All CFG nodes where variable is live */
  liveNodes: Set<CFGNode>;

  /** Length of interval (optimization hint) */
  length: number;
}
```

### ConstantPropagationInfo

```typescript
/**
 * Constant propagation analysis (Task 8.7)
 */
export interface ConstantPropagationInfo {
  /** Known constant values at each program point */
  constants: Map<CFGNode, Map<string, ConstantValue>>;

  /** Expressions that can be constant-folded */
  foldableExpressions: Set<Expression>;

  /** Variables that are effectively constant */
  effectivelyConst: Set<string>;

  /** Branches with constant conditions (can be eliminated) */
  constantBranches: Map<CFGNode, boolean>;
}

export type ConstantValue = number | string | boolean | null;
```

---

## Tier 1: Basic Analysis Metadata

### VariableUsageInfo

```typescript
/**
 * Variable usage tracking (Task 8.2)
 */
export interface VariableUsageInfo {
  /** Variable identifier */
  name: string;

  /** Total read count */
  readCount: number;

  /** Total write count */
  writeCount: number;

  /** Is variable ever used? */
  isUsed: boolean;

  /** Is variable write-only? (dead store candidate) */
  isWriteOnly: boolean;

  /** Is variable read-only? (constant propagation candidate) */
  isReadOnly: boolean;

  /** Access frequency in hot paths */
  hotPathAccesses: number;

  /** Loop nesting depth of accesses */
  maxLoopDepth: number;
}
```

### DefiniteAssignmentInfo

```typescript
/**
 * Definite assignment analysis (Task 8.1)
 */
export interface DefiniteAssignmentInfo {
  /** Variable identifier */
  name: string;

  /** Is variable always initialized before use? */
  alwaysInitialized: boolean;

  /** Initialization paths */
  initializationPaths: InitializationPath[];

  /** Use-before-init locations (errors) */
  uninitializedUses: SourceLocation[];
}

export interface InitializationPath {
  /** CFG node where initialization occurs */
  node: CFGNode;

  /** Is this path guaranteed to execute? */
  isGuaranteed: boolean;

  /** Initialization value (if constant) */
  value?: ConstantValue;
}
```

### DeadCodeInfo

```typescript
/**
 * Dead code detection (Task 8.4)
 */
export interface DeadCodeInfo {
  /** Type of dead code */
  kind: DeadCodeKind;

  /** Location of dead code */
  location: SourceLocation;

  /** Why is this code dead? */
  reason: string;

  /** Can this be safely removed? */
  removable: boolean;
}

export enum DeadCodeKind {
  UnreachableStatement = 'UnreachableStatement',
  UnreachableBranch = 'UnreachableBranch',
  DeadStore = 'DeadStore',
  UnusedResult = 'UnusedResult',
}
```

---
