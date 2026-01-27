# Phase 2: Analysis Passes

> **Phase**: 2 of 11  
> **Est. Time**: ~24 hours  
> **Tasks**: 12  
> **Tests**: ~400  
> **Prerequisites**: Phase 1 (Pass Manager Architecture)

---

## Overview

Analysis passes **gather information** about IL without modifying it. They provide data that transform passes use to make optimization decisions. Analyses are **cached** and **invalidated** when transforms modify the IL.

---

## Directory Structure Created

```
packages/compiler/src/optimizer/analysis/
├── index.ts                    # Analysis exports
├── dominator-tree.ts           # Dominator analysis
├── loop-info.ts                # Loop detection & analysis
├── liveness.ts                 # Live variable analysis
├── use-def.ts                  # Use-def chains
├── alias-analysis.ts           # Pointer/memory alias
├── escape-analysis.ts          # Escape analysis
├── call-graph.ts               # Call graph construction
├── memory-deps.ts              # Memory dependencies
├── demanded-bits.ts            # Demanded bits analysis
├── loop-nesting.ts             # Loop nesting depth
├── block-frequency.ts          # Basic block frequency
└── correlated-values.ts        # Correlated value analysis
```

---

## Task 2.1: Dominator Tree Analysis

**Time**: 2.5 hours  
**Tests**: 40 tests

**Key Concepts**:
- Block A **dominates** B if every path to B goes through A
- Entry block dominates all blocks
- Critical for SSA, loop detection, and many optimizations

**File**: `packages/compiler/src/optimizer/analysis/dominator-tree.ts`

```typescript
/**
 * Dominator tree node
 */
export interface DominatorNode {
  block: BasicBlock;
  parent: DominatorNode | null;
  children: DominatorNode[];
  dominanceFrontier: Set<BasicBlock>;
}

/**
 * Dominator tree analysis
 */
export class DominatorTreeAnalysis extends AnalysisPass<DominatorTree> {
  readonly name = 'dominator-tree';
  
  analyze(func: ILFunction): DominatorTree {
    // Lengauer-Tarjan algorithm (O(n α(n)))
  }
}

/**
 * Dominator tree result
 */
export interface DominatorTree {
  root: DominatorNode;
  
  /** Does A dominate B? */
  dominates(a: BasicBlock, b: BasicBlock): boolean;
  
  /** Does A strictly dominate B? (A dom B and A ≠ B) */
  strictlyDominates(a: BasicBlock, b: BasicBlock): boolean;
  
  /** Get immediate dominator */
  getImmediateDominator(block: BasicBlock): BasicBlock | null;
  
  /** Get dominance frontier */
  getDominanceFrontier(block: BasicBlock): Set<BasicBlock>;
}
```

**Tests**:
- Single block function
- Linear CFG (A→B→C)
- Diamond CFG (A→[B,C]→D)
- Loop CFG
- Multiple entry points handling
- Immediate dominator correctness
- Dominance frontier correctness
- strictlyDominates vs dominates

---

## Task 2.2: Loop Detection & Info

**Time**: 2.5 hours  
**Tests**: 40 tests

**Key Concepts**:
- Identify natural loops using dominators
- Back edges indicate loops
- Loop header, preheader, latches, exits

**File**: `packages/compiler/src/optimizer/analysis/loop-info.ts`

```typescript
/**
 * Loop information
 */
export interface Loop {
  header: BasicBlock;
  preheader: BasicBlock | null;
  latches: BasicBlock[];
  blocks: Set<BasicBlock>;
  exits: BasicBlock[];
  exitBlocks: BasicBlock[];
  depth: number;
  parent: Loop | null;
  children: Loop[];
  
  /** Is this loop innermost (no children)? */
  isInnermost(): boolean;
  
  /** Does loop contain block? */
  contains(block: BasicBlock): boolean;
}

/**
 * Loop info analysis
 */
export class LoopInfoAnalysis extends AnalysisPass<LoopInfo> {
  readonly name = 'loop-info';
  readonly requires = ['dominator-tree'];
  
  analyze(func: ILFunction): LoopInfo;
}
```

**Tests**:
- No loops
- Single while loop
- Nested loops
- Multiple loops at same level
- Loop with multiple latches
- Loop with multiple exits
- Irreducible CFG handling
- Loop depth calculation
- Preheader identification

---

## Task 2.3: Live Variable Analysis

**Time**: 2 hours  
**Tests**: 35 tests

**Key Concepts**:
- Variable is **live** if it may be used before redefinition
- Backward dataflow analysis
- Critical for register allocation

**File**: `packages/compiler/src/optimizer/analysis/liveness.ts`

```typescript
/**
 * Liveness result for a block
 */
export interface BlockLiveness {
  liveIn: Set<VirtualRegister>;
  liveOut: Set<VirtualRegister>;
  uses: Set<VirtualRegister>;
  defs: Set<VirtualRegister>;
}

/**
 * Live variable analysis
 */
export class LivenessAnalysis extends AnalysisPass<LivenessInfo> {
  readonly name = 'liveness';
  
  analyze(func: ILFunction): LivenessInfo;
}

/**
 * Liveness info result
 */
export interface LivenessInfo {
  getBlockLiveness(block: BasicBlock): BlockLiveness;
  isLiveAt(reg: VirtualRegister, instruction: ILInstruction): boolean;
  getLiveRange(reg: VirtualRegister): [number, number];
}
```

**Tests**:
- Simple linear liveness
- Phi node handling
- Loop liveness (live across back edge)
- Dead variable detection
- Multiple definitions
- Conditional liveness
- Live range calculation

---

## Task 2.4: Use-Def Chains

**Time**: 1.5 hours  
**Tests**: 25 tests

**Key Concepts**:
- Track where values are defined and used
- SSA form makes this straightforward
- Essential for many optimizations

**File**: `packages/compiler/src/optimizer/analysis/use-def.ts`

```typescript
/**
 * Use-def chain analysis
 */
export class UseDefAnalysis extends AnalysisPass<UseDefInfo> {
  readonly name = 'use-def';
  
  analyze(func: ILFunction): UseDefInfo;
}

/**
 * Use-def info result
 */
export interface UseDefInfo {
  /** Get the instruction that defines this value */
  getDefinition(value: ILValue): ILInstruction | null;
  
  /** Get all uses of a value */
  getUses(value: ILValue): ILInstruction[];
  
  /** Get number of uses */
  getUseCount(value: ILValue): number;
  
  /** Is value used only once? */
  hasOneUse(value: ILValue): boolean;
  
  /** Is value unused? */
  isUnused(value: ILValue): boolean;
}
```

**Tests**:
- Single def, single use
- Single def, multiple uses
- Unused definition
- Phi node as definition
- Cross-block uses
- SSA value uniqueness

---

## Task 2.5: Basic Alias Analysis

**Time**: 2 hours  
**Tests**: 35 tests

**Key Concepts**:
- Do two memory references point to same location?
- Conservative: assume aliasing when uncertain
- Enables load/store optimization

**File**: `packages/compiler/src/optimizer/analysis/alias-analysis.ts`

```typescript
/**
 * Alias result
 */
export enum AliasResult {
  NoAlias = 0,      // Definitely different locations
  MayAlias = 1,     // Might be same location
  MustAlias = 2,    // Definitely same location
}

/**
 * Alias analysis
 */
export class AliasAnalysis extends AnalysisPass<AliasInfo> {
  readonly name = 'alias-analysis';
  
  analyze(func: ILFunction): AliasInfo;
}

/**
 * Alias info result
 */
export interface AliasInfo {
  /** Check if two memory operations may alias */
  alias(a: MemoryOp, b: MemoryOp): AliasResult;
  
  /** Get memory locations that may be modified by instruction */
  getModifiedLocations(inst: ILInstruction): Set<MemoryLocation>;
  
  /** Get memory locations that may be read by instruction */
  getReadLocations(inst: ILInstruction): Set<MemoryLocation>;
}
```

**Tests**:
- Same variable = MustAlias
- Different variables = NoAlias
- Array elements (different index = NoAlias if provable)
- Pointer arithmetic handling
- Function call side effects
- @map hardware registers (always alias themselves)
- Conservative fallback to MayAlias

---

## Task 2.6: Escape Analysis

**Time**: 2 hours  
**Tests**: 30 tests

**Key Concepts**:
- Does a value "escape" current function?
- If not, can allocate on stack or optimize more aggressively
- Useful for future optimizations

**File**: `packages/compiler/src/optimizer/analysis/escape-analysis.ts`

```typescript
/**
 * Escape state
 */
export enum EscapeState {
  NoEscape = 0,     // Never escapes function
  ArgEscape = 1,    // Escapes via function argument
  GlobalEscape = 2, // Escapes to global scope
}

/**
 * Escape analysis
 */
export class EscapeAnalysis extends AnalysisPass<EscapeInfo> {
  readonly name = 'escape-analysis';
  
  analyze(func: ILFunction): EscapeInfo;
}

/**
 * Escape info result
 */
export interface EscapeInfo {
  getEscapeState(value: ILValue): EscapeState;
  doesEscape(value: ILValue): boolean;
}
```

**Tests**:
- Local variable no escape
- Return value escapes
- Passed to function escapes
- Stored to global escapes
- Address-of escapes
- Transitivity (if A escapes and B = A, B escapes)

---

## Task 2.7: Call Graph Construction

**Time**: 2 hours  
**Tests**: 30 tests

**Key Concepts**:
- Track which functions call which
- Enables interprocedural optimization
- Handle indirect calls conservatively

**File**: `packages/compiler/src/optimizer/analysis/call-graph.ts`

```typescript
/**
 * Call graph node
 */
export interface CallGraphNode {
  func: ILFunction;
  callers: Set<CallGraphNode>;
  callees: Set<CallGraphNode>;
  callSites: Map<ILInstruction, CallGraphNode>;
}

/**
 * Call graph analysis
 */
export class CallGraphAnalysis extends AnalysisPass<CallGraph> {
  readonly name = 'call-graph';
  
  analyze(module: ILModule): CallGraph;
}

/**
 * Call graph result
 */
export interface CallGraph {
  getNode(func: ILFunction): CallGraphNode;
  getRoots(): CallGraphNode[];
  getLeaves(): CallGraphNode[];
  isRecursive(func: ILFunction): boolean;
  getCallChain(from: ILFunction, to: ILFunction): ILFunction[][] | null;
}
```

**Tests**:
- Single function (no calls)
- Direct calls
- Recursive functions
- Mutual recursion
- Call chain detection
- Multiple call sites to same function

---

## Task 2.8: Memory Dependency Analysis

**Time**: 2 hours  
**Tests**: 30 tests

**Key Concepts**:
- Track read-after-write, write-after-read, write-after-write
- Essential for instruction reordering
- Uses alias analysis

**File**: `packages/compiler/src/optimizer/analysis/memory-deps.ts`

```typescript
/**
 * Memory dependency kind
 */
export enum MemoryDepKind {
  RAW = 'read-after-write',   // True dependency
  WAR = 'write-after-read',   // Anti-dependency
  WAW = 'write-after-write',  // Output dependency
}

/**
 * Memory dependency analysis
 */
export class MemoryDepsAnalysis extends AnalysisPass<MemoryDeps> {
  readonly name = 'memory-deps';
  readonly requires = ['alias-analysis'];
  
  analyze(func: ILFunction): MemoryDeps;
}

/**
 * Memory deps result
 */
export interface MemoryDeps {
  getDependencies(inst: ILInstruction): MemoryDep[];
  hasDependency(a: ILInstruction, b: ILInstruction): boolean;
  canReorder(a: ILInstruction, b: ILInstruction): boolean;
}
```

**Tests**:
- RAW dependency detection
- WAR dependency detection
- WAW dependency detection
- No dependency (different locations)
- Reordering safety check
- Volatile memory handling

---

## Task 2.9: Demanded Bits Analysis

**Time**: 2 hours  
**Tests**: 30 tests

**Key Concepts**:
- Which bits of a value are actually used?
- Enables bit-width optimization for 6502
- byte vs word optimization

**File**: `packages/compiler/src/optimizer/analysis/demanded-bits.ts`

```typescript
/**
 * Demanded bits analysis
 */
export class DemandedBitsAnalysis extends AnalysisPass<DemandedBitsInfo> {
  readonly name = 'demanded-bits';
  readonly requires = ['use-def'];
  
  analyze(func: ILFunction): DemandedBitsInfo;
}

/**
 * Demanded bits result
 */
export interface DemandedBitsInfo {
  /** Get mask of demanded bits (1 = demanded) */
  getDemandedBits(value: ILValue): number;
  
  /** Is only low byte demanded? */
  isOnlyLowByteDemanded(value: ILValue): boolean;
  
  /** Is only high byte demanded? */
  isOnlyHighByteDemanded(value: ILValue): boolean;
  
  /** Are any bits demanded? */
  isValueDead(value: ILValue): boolean;
}
```

**Tests**:
- All bits demanded (default)
- Only low byte demanded
- Only high byte demanded
- Single bit demanded (boolean)
- No bits demanded (dead value)
- Propagation through operations

---

## Task 2.10: Loop Nesting Analysis

**Time**: 1.5 hours  
**Tests**: 25 tests

**Key Concepts**:
- Track nesting depth of loops
- Prioritize optimization of inner loops
- Used for loop-aware optimizations

**File**: `packages/compiler/src/optimizer/analysis/loop-nesting.ts`

```typescript
/**
 * Loop nesting analysis
 */
export class LoopNestingAnalysis extends AnalysisPass<LoopNestingInfo> {
  readonly name = 'loop-nesting';
  readonly requires = ['loop-info'];
  
  analyze(func: ILFunction): LoopNestingInfo;
}

/**
 * Loop nesting result
 */
export interface LoopNestingInfo {
  getLoopDepth(block: BasicBlock): number;
  getInstructionLoopDepth(inst: ILInstruction): number;
  getInnermostLoops(): Loop[];
  getMaxNestingDepth(): number;
}
```

**Tests**:
- No loops (depth 0)
- Single loop (depth 1)
- Nested loops (depth 2+)
- Multiple loops at same level
- Instruction loop depth

---

## Task 2.11: Basic Block Frequency Estimation

**Time**: 2 hours  
**Tests**: 30 tests

**Key Concepts**:
- Estimate how often each block executes
- Static heuristics (no profiling data)
- Hot vs cold code decisions

**File**: `packages/compiler/src/optimizer/analysis/block-frequency.ts`

```typescript
/**
 * Block frequency analysis
 */
export class BlockFrequencyAnalysis extends AnalysisPass<BlockFrequencyInfo> {
  readonly name = 'block-frequency';
  readonly requires = ['loop-info'];
  
  analyze(func: ILFunction): BlockFrequencyInfo;
}

/**
 * Block frequency result
 */
export interface BlockFrequencyInfo {
  getFrequency(block: BasicBlock): number;
  isHot(block: BasicBlock): boolean;
  isCold(block: BasicBlock): boolean;
  getHotBlocks(): BasicBlock[];
  getColdBlocks(): BasicBlock[];
}
```

**Heuristics**:
- Loop body = 10x header frequency
- Branch taken = 50% (default)
- Error handling = rare (cold)
- Entry block = 1.0 frequency

**Tests**:
- Entry block frequency
- Loop body frequency boost
- Nested loop frequency
- Cold block detection
- Hot path identification

---

## Task 2.12: Correlated Value Analysis

**Time**: 2 hours  
**Tests**: 30 tests

**Key Concepts**:
- Track value relationships from branches
- `if (x > 0)` → in then-block, x > 0
- Enables conditional optimization

**File**: `packages/compiler/src/optimizer/analysis/correlated-values.ts`

```typescript
/**
 * Value constraint
 */
export interface ValueConstraint {
  value: ILValue;
  kind: 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge';
  bound: number | ILValue;
}

/**
 * Correlated value analysis
 */
export class CorrelatedValueAnalysis extends AnalysisPass<CorrelatedValueInfo> {
  readonly name = 'correlated-values';
  readonly requires = ['dominator-tree'];
  
  analyze(func: ILFunction): CorrelatedValueInfo;
}

/**
 * Correlated value result
 */
export interface CorrelatedValueInfo {
  getConstraints(block: BasicBlock): ValueConstraint[];
  getValueConstraint(value: ILValue, block: BasicBlock): ValueConstraint | null;
  isValueConstantIn(value: ILValue, block: BasicBlock): number | null;
}
```

**Tests**:
- Branch condition propagation
- Equality constraint
- Inequality constraints
- Constant propagation via constraint
- Nested branches
- Phi node handling

---

## Phase 2 Task Checklist

| Task | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 2.1 | Dominator tree | 2.5 hr | 40 | [ ] |
| 2.2 | Loop info | 2.5 hr | 40 | [ ] |
| 2.3 | Liveness | 2 hr | 35 | [ ] |
| 2.4 | Use-def chains | 1.5 hr | 25 | [ ] |
| 2.5 | Alias analysis | 2 hr | 35 | [ ] |
| 2.6 | Escape analysis | 2 hr | 30 | [ ] |
| 2.7 | Call graph | 2 hr | 30 | [ ] |
| 2.8 | Memory deps | 2 hr | 30 | [ ] |
| 2.9 | Demanded bits | 2 hr | 30 | [ ] |
| 2.10 | Loop nesting | 1.5 hr | 25 | [ ] |
| 2.11 | Block frequency | 2 hr | 30 | [ ] |
| 2.12 | Correlated values | 2 hr | 30 | [ ] |
| **Total** | | **24 hr** | **380** | |

---

## Success Criteria

- [ ] All 380 tests passing
- [ ] Dominator tree correct for all CFG shapes
- [ ] Loop detection handles all loop types
- [ ] Liveness correct for SSA form
- [ ] Alias analysis conservative and correct
- [ ] All analyses integrate with PassManager
- [ ] Analysis caching works
- [ ] Invalidation works correctly

---

## Implementation Sessions

| Session | Tasks | Focus |
|---------|-------|-------|
| Session 1 | 2.1 | Dominator tree |
| Session 2 | 2.2 | Loop info |
| Session 3 | 2.3, 2.4 | Liveness + Use-def |
| Session 4 | 2.5, 2.6 | Alias + Escape |
| Session 5 | 2.7, 2.8 | Call graph + Memory deps |
| Session 6 | 2.9, 2.10, 2.11, 2.12 | Remaining analyses |

---

**Previous**: [01-architecture.md](01-architecture.md)  
**Next**: [03-classical-optimizations.md](03-classical-optimizations.md)