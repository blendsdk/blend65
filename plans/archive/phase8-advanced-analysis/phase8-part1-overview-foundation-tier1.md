# Phase 8 Implementation Plan - Part 1: Overview, Foundation & Tier 1

> **Navigation**: [Part 1] → [Part 2: Tier 2](phase8-part2-tier2.md)
> 
> **Status**: Ready for Implementation
> **Architecture**: Enum-based metadata (flat pattern, IL optimizer friendly)
> **Duration**: 5-6 weeks (33 tasks, 203 hours)
> **Prerequisites**: Phases 0-7 complete ✅
> **Last Updated**: January 15, 2026
> **Scope**: God-Level 6502 Optimization + Modern Compiler Techniques

---

## Executive Summary

This plan implements **God-Level Phase 8 Advanced Analysis** using the **new enum-based metadata architecture** defined in `phase8-metadata-keys-enum.md`. All metadata keys use `OptimizationMetadataKey` enum (flat pattern) instead of string-based "phase8:..." keys.

**This is a comprehensive, production-ready semantic analysis framework that combines:**

- ✅ **40 years of 6502 game development patterns** (VIC-II timing, SID conflicts, hardware-aware optimization)
- ✅ **Modern compiler techniques** (GCC, Rust, LLVM-level analyses)
- ✅ **Cross-module god-level analysis** (whole-program optimization metadata)

**Key Changes from Original Plan:**

- ✅ Uses `OptimizationMetadataKey` enum instead of strings
- ✅ Type-safe metadata access via `OptimizationMetadataAccessor`
- ✅ Fixes symbol.kind comparisons (uses `SymbolKind.Variable` not strings)
- ✅ IL optimizer friendly (flat enum, single-level lookup)
- ✅ **NEW: 15 additional god-level analyses** for 6502-specific and modern optimization
- ✅ **NEW: Tier 4 for hardware-aware and advanced optimizations**
- ✅ **NEW: Cross-module analysis architecture** (whole-program optimization)

**What Makes This "God-Level":**

1. **6502 Hardware Mastery**: VIC-II raster timing, SID resource conflicts, zero page banking, memory region awareness
2. **Modern Compiler Techniques**: Value range analysis, carry flag dataflow, interrupt safety, instruction scheduling
3. **Whole-Program Analysis**: Cross-module constant propagation, global dead code elimination, call graph across modules
4. **Production-Ready**: 596+ tests, cycle-accurate analysis, real C64 game pattern optimization

---

## Prerequisites Verification

**Required Phases (Must Be Complete):**

- ✅ Phase 0: AST Walker infrastructure
- ✅ Phase 1: Symbol tables and scopes
- ✅ Phase 2: Type system
- ✅ Phase 3: Type checking
- ✅ Phase 4: Statement validation
- ✅ Phase 5: Control flow graphs
- ✅ Phase 6: Multi-module infrastructure
- ✅ Phase 7: Unused import detection

**Current State Verified:**

- ✅ `SemanticAnalyzer` has all passes 1-7 integrated
- ✅ Control flow graphs available via `getAllCFGs()`
- ✅ Symbol tables and type system accessible
- ✅ No `analysis/` directory exists yet (will be created)

---

## Phase Structure Overview

### Four-Tier God-Level Implementation

**Week 1: Foundation + Tier 1 (Basic Analysis)** ← THIS PART

- Foundation: Enum definitions, base classes, integration (4 tasks, 9 hours)
- Tier 1: Definite assignment, variable usage, unused functions, dead code (4 tasks, 19 hours)

**Week 2: Tier 2 (Data Flow Analysis)** → Part 2

- Reaching definitions, liveness analysis, constant propagation (3 tasks, 22 hours)

**Week 3: Tier 3 (Advanced Analysis)** → Part 3

- Alias, purity, escape, loop, call graph, 6502 hints, integration (7 tasks, 62 hours)

**Week 4-5: Tier 4 (God-Level 6502 & Modern Optimizations)** → Parts 4 & 5

- VIC-II timing, SID conflicts, memory regions, branch distance (4 tasks, 26 hours)
- Value range, carry flag, interrupt safety (3 tasks, 20 hours)
- JSR/RTS overhead, tail calls, strength reduction, coalescing, scheduling (5 tasks, 28 hours)

**Week 6: Integration & Testing** → Part 5

- Cross-module analysis, whole-program optimization, final integration (3 tasks, 17 hours)

---

## Foundation Tasks (Before Tier 1)

### Task 0.1: Create Optimization Metadata Keys Enum (2 hours)

**Goal**: Define all Phase 8 metadata keys as TypeScript enum

**Deliverables:**

- `packages/compiler/src/semantic/analysis/optimization-metadata-keys.ts`
- All enums from `phase8-metadata-keys-enum.md`
- Export from `packages/compiler/src/semantic/analysis/index.ts`

**Implementation:**

```typescript
// optimization-metadata-keys.ts
/**
 * Optimization metadata keys for Phase 8 analysis
 *
 * Pattern: Flat enum (like TokenType, SymbolKind) for IL optimizer ease
 */
export enum OptimizationMetadataKey {
  // Tier 1: Basic Analysis
  DefiniteAssignmentAlwaysInitialized = 'DefiniteAssignmentAlwaysInitialized',
  DefiniteAssignmentInitValue = 'DefiniteAssignmentInitValue',
  DefiniteAssignmentUninitializedUse = 'DefiniteAssignmentUninitializedUse',
  
  UsageReadCount = 'UsageReadCount',
  UsageWriteCount = 'UsageWriteCount',
  UsageIsUsed = 'UsageIsUsed',
  UsageIsWriteOnly = 'UsageIsWriteOnly',
  UsageIsReadOnly = 'UsageIsReadOnly',
  UsageHotPathAccesses = 'UsageHotPathAccesses',
  UsageMaxLoopDepth = 'UsageMaxLoopDepth',
  
  DeadCodeUnreachable = 'DeadCodeUnreachable',
  DeadCodeKind = 'DeadCodeKind',
  DeadCodeReason = 'DeadCodeReason',
  DeadCodeRemovable = 'DeadCodeRemovable',
  
  CallGraphUnused = 'CallGraphUnused',
  CallGraphCallCount = 'CallGraphCallCount',
  CallGraphInlineCandidate = 'CallGraphInlineCandidate',
  
  // Tier 2: Data Flow Analysis
  ReachingDefinitionsSet = 'ReachingDefinitionsSet',
  DefUseChain = 'DefUseChain',
  UseDefChain = 'UseDefChain',
  
  LivenessLiveIn = 'LivenessLiveIn',
  LivenessLiveOut = 'LivenessLiveOut',
  LivenessInterval = 'LivenessInterval',
  LivenessIntervalLength = 'LivenessIntervalLength',
  
  ConstantValue = 'ConstantValue',
  ConstantFoldable = 'ConstantFoldable',
  ConstantFoldResult = 'ConstantFoldResult',
  ConstantEffectivelyConst = 'ConstantEffectivelyConst',
  ConstantBranchCondition = 'ConstantBranchCondition',
  
  // Tier 3: Advanced Analysis
  AliasPointsTo = 'AliasPointsTo',
  AliasNonAliasSet = 'AliasNonAliasSet',
  AliasMemoryRegion = 'AliasMemoryRegion',
  
  PurityLevel = 'PurityLevel',
  PurityWrittenLocations = 'PurityWrittenLocations',
  PurityReadLocations = 'PurityReadLocations',
  PuritySideEffectFree = 'PuritySideEffectFree',
  
  EscapeEscapes = 'EscapeEscapes',
  EscapeStackAllocatable = 'EscapeStackAllocatable',
  EscapeLocalOnly = 'EscapeLocalOnly',
  
  LoopInvariant = 'LoopInvariant',
  LoopHoistCandidate = 'LoopHoistCandidate',
  LoopIterationCount = 'LoopIterationCount',
  LoopUnrollable = 'LoopUnrollable',
  
  M6502ZeroPagePriority = 'M6502ZeroPagePriority',
  M6502RegisterPreference = 'M6502RegisterPreference',
  M6502MemoryAccessPattern = 'M6502MemoryAccessPattern',
  
  // Tier 4: God-Level (Hardware)
  VICIICyclesBudget = 'VICIICyclesBudget',
  VICIIRasterSafe = 'VICIIRasterSafe',
  VICIIBadlineAware = 'VICIIBadlineAware',
  SpriteMultiplexCandidate = 'SpriteMultiplexCandidate',
  
  SIDVoiceUsage = 'SIDVoiceUsage',
  SIDVoiceConflict = 'SIDVoiceConflict',
  SIDFilterInUse = 'SIDFilterInUse',
  SIDTimingRequirements = 'SIDTimingRequirements',
  
  MemoryRegion = 'MemoryRegion',
  MemoryOverlap = 'MemoryOverlap',
  AlignmentRequirement = 'AlignmentRequirement',
  BankingRequired = 'BankingRequired',
  
  BranchDistance = 'BranchDistance',
  RequiresJMP = 'RequiresJMP',
  BranchFrequency = 'BranchFrequency',
  BranchPredictionHint = 'BranchPredictionHint',
  
  // Tier 4: Modern Compiler
  ValueRange = 'ValueRange',
  OverflowImpossible = 'OverflowImpossible',
  UnderflowPossible = 'UnderflowPossible',
  SignednessInferred = 'SignednessInferred',
  
  CarryFlagState = 'CarryFlagState',
  RequiresCLC = 'RequiresCLC',
  RequiresSEC = 'RequiresSEC',
  CarryPropagation = 'CarryPropagation',
  
  InterruptSafe = 'InterruptSafe',
  RequiresCriticalSection = 'RequiresCriticalSection',
  IRQLatency = 'IRQLatency',
  VolatileAccess = 'VolatileAccess',
  
  // Tier 4: Call/Instruction Optimization
  CallOverhead = 'CallOverhead',
  BodyCycles = 'BodyCycles',
  InlineThreshold = 'InlineThreshold',
  LeafFunction = 'LeafFunction',
  
  TailCallCandidate = 'TailCallCandidate',
  TailCallSavings = 'TailCallSavings',
  
  StrengthReducible = 'StrengthReducible',
  ReplacementOp = 'ReplacementOp',
  CycleSavings = 'CycleSavings',
  
  RedundantLoad = 'RedundantLoad',
  CoalesceCandidate = 'CoalesceCandidate',
  
  SchedulingHint = 'SchedulingHint',
  RegisterConflict = 'RegisterConflict',
  
  // Tier 4: Cross-Module
  GlobalCallGraph = 'GlobalCallGraph',
  CrossModuleInlineCandidate = 'CrossModuleInlineCandidate',
  GlobalConstant = 'GlobalConstant',
  CrossModulePropagation = 'CrossModulePropagation',
}

export enum DeadCodeKind {
  UnreachableStatement = 'UnreachableStatement',
  UnreachableBranch = 'UnreachableBranch',
  DeadStore = 'DeadStore',
  UnusedResult = 'UnusedResult',
}

export enum PurityLevel {
  Pure = 'Pure',
  ReadOnly = 'ReadOnly',
  LocalMutation = 'LocalMutation',
  SideEffects = 'SideEffects',
}

export enum Register {
  A = 'A',
  X = 'X',
  Y = 'Y',
  Any = 'Any',
}

export enum MemoryAccessPattern {
  Sequential = 'Sequential',
  Random = 'Random',
  SingleAccess = 'SingleAccess',
  HotPath = 'HotPath',
}
```

**Tests** (10+):

- Enum key uniqueness
- Enum value format validation
- Supporting enum completeness
- Export verification

---

### Task 0.2: Create Metadata Accessor Class (2 hours)

**Goal**: Type-safe accessor for optimization metadata

**Deliverables:**

- `packages/compiler/src/semantic/analysis/metadata-accessor.ts`
- Type-safe getters for all metadata keys
- Integration with AST nodes

**Implementation:**

```typescript
// metadata-accessor.ts
import { OptimizationMetadataKey, Register, PurityLevel, DeadCodeKind } from './optimization-metadata-keys.js';
import type { ASTNode } from '../../ast/nodes.js';

/**
 * Type-safe accessor for optimization metadata
 *
 * Provides convenient, type-safe access to Phase 8 metadata
 * stored in AST node metadata maps.
 */
export class OptimizationMetadataAccessor {
  constructor(private node: ASTNode) {}

  // Constant propagation
  getConstantValue(): number | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.ConstantValue) as number | undefined;
  }

  isConstantFoldable(): boolean {
    return this.node.metadata?.get(OptimizationMetadataKey.ConstantFoldable) === true;
  }

  // Variable usage
  getUsageReadCount(): number {
    return (this.node.metadata?.get(OptimizationMetadataKey.UsageReadCount) as number) ?? 0;
  }

  getUsageWriteCount(): number {
    return (this.node.metadata?.get(OptimizationMetadataKey.UsageWriteCount) as number) ?? 0;
  }

  isUsed(): boolean {
    return this.node.metadata?.get(OptimizationMetadataKey.UsageIsUsed) === true;
  }

  // Dead code
  isDeadCode(): boolean {
    return this.node.metadata?.get(OptimizationMetadataKey.DeadCodeUnreachable) === true;
  }

  getDeadCodeKind(): DeadCodeKind | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.DeadCodeKind) as DeadCodeKind | undefined;
  }

  // Purity
  getPurityLevel(): PurityLevel | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.PurityLevel) as PurityLevel | undefined;
  }

  // 6502 hints
  getRegisterPreference(): Register | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.M6502RegisterPreference) as Register | undefined;
  }

  getZeroPagePriority(): number {
    return (this.node.metadata?.get(OptimizationMetadataKey.M6502ZeroPagePriority) as number) ?? 0;
  }

  // ... (accessors for all remaining keys)
}
```

**Tests** (15+):

- All accessor methods
- Type safety validation
- Undefined handling
- Default value behavior

---

### Task 0.3: Create Advanced Analyzer Base Class (3 hours)

**Goal**: Main orchestrator for all Phase 8 analyses

**Deliverables:**

- `packages/compiler/src/semantic/analysis/advanced-analyzer.ts`
- Orchestrates all Tier 1-4 analyses
- Integrates with SemanticAnalyzer

**Implementation:**

```typescript
// advanced-analyzer.ts
import type { Program } from '../../ast/nodes.js';
import type { SymbolTable } from '../symbol-table.js';
import type { TypeSystem } from '../type-system.js';
import type { ControlFlowGraph } from '../control-flow.js';
import { Diagnostic } from '../../ast/diagnostics.js';

/**
 * Advanced analyzer orchestrator (Phase 8)
 *
 * Coordinates all optimization analysis passes and generates
 * metadata for IL optimizer consumption.
 *
 * **Analysis Only**: This class performs analysis and marks
 * opportunities - it does NOT perform transformations.
 */
export class AdvancedAnalyzer {
  protected diagnostics: Diagnostic[] = [];

  constructor(
    protected symbolTable: SymbolTable,
    protected cfgs: Map<string, ControlFlowGraph>,
    protected typeSystem: TypeSystem
  ) {}

  /**
   * Run all Phase 8 analyses
   *
   * Executes analyses in dependency order:
   * - Tier 1: Basic analysis (usage, dead code)
   * - Tier 2: Data flow (reaching defs, liveness, constants)
   * - Tier 3: Advanced (alias, purity, loops, 6502 hints)
   * - Tier 4: God-level (hardware, modern compiler, cross-module)
   */
  public analyze(ast: Program): void {
    // Tier 1: Basic Analysis
    this.runTier1BasicAnalysis(ast);

    // Tier 2: Data Flow Analysis (requires Tier 1)
    this.runTier2DataFlowAnalysis(ast);

    // Tier 3: Advanced Analysis (requires Tiers 1+2)
    this.runTier3AdvancedAnalysis(ast);

    // Tier 4: God-Level Analysis (requires Tiers 1+2+3)
    this.runTier4GodLevelAnalysis(ast);
  }

  protected runTier1BasicAnalysis(ast: Program): void {
    // Implemented in Tier 1 tasks
  }

  protected runTier2DataFlowAnalysis(ast: Program): void {
    // Implemented in Tier 2 tasks
  }

  protected runTier3AdvancedAnalysis(ast: Program): void {
    // Implemented in Tier 3 tasks
  }

  protected runTier4GodLevelAnalysis(ast: Program): void {
    // Implemented in Tier 4 tasks
  }

  public getDiagnostics(): Diagnostic[] {
    return [...this.diagnostics];
  }
}
```

**Tests** (10+):

- Basic orchestration
- Analysis order correctness
- Diagnostic aggregation
- Integration with SemanticAnalyzer

---

### Task 0.4: Integrate with SemanticAnalyzer (2 hours)

**Goal**: Add Phase 8 to SemanticAnalyzer pipeline

**Deliverables:**

- Update `packages/compiler/src/semantic/analyzer.ts`
- Add `runPass8_AdvancedAnalysis()` method
- Call from `analyzeModule()` and `analyzeModuleWithContext()`

**Implementation:**

```typescript
// In SemanticAnalyzer class:

/**
 * Pass 8: Advanced Analysis (Phase 8)
 *
 * Performs god-level optimization analysis and generates metadata
 * for IL optimizer. Only runs if all previous passes succeeded.
 */
protected runPass8_AdvancedAnalysis(ast: Program): void {
  if (!this.symbolTable || !this.typeSystem) {
    throw new Error('Pass 1 and Pass 2 must be run before Pass 8');
  }

  const analyzer = new AdvancedAnalyzer(
    this.symbolTable,
    this.cfgs,
    this.typeSystem
  );

  // Run all analyses
  analyzer.analyze(ast);

  // Collect diagnostics
  this.diagnostics.push(...analyzer.getDiagnostics());
}

// Update analyzeModule():
protected analyzeModule(ast: Program): void {
  // ... existing passes 1-7 ...

  // Pass 8: Advanced analysis (only if no errors)
  if (!this.hasErrors()) {
    this.runPass8_AdvancedAnalysis(ast);
  }
}
```

**Tests** (8+):

- Integration with existing passes
- Error propagation handling
- Diagnostic collection
- Multi-module support

---

## Foundation Summary

| Task      | Description                  | Hours     | Tests         | Status  |
| --------- | ---------------------------- | --------- | ------------- | ------- |
| 0.1       | Metadata keys enum           | 2         | 10+           | [ ]     |
| 0.2       | Metadata accessor class      | 2         | 15+           | [ ]     |
| 0.3       | Advanced analyzer base       | 3         | 10+           | [ ]     |
| 0.4       | SemanticAnalyzer integration | 2         | 8+            | [ ]     |
| **Total** | **Foundation**               | **9 hrs** | **43+ tests** | **[ ]** |

**Foundation Completion Criteria:**

- ✅ All 43+ tests passing
- ✅ Enum-based metadata keys defined
- ✅ Type-safe accessor working
- ✅ Integration with SemanticAnalyzer complete
- ✅ Directory structure created

---

## Tier 1: Basic Analysis (Week 1)

### Task 8.1: Definite Assignment Analysis (6 hours)

**File**: `packages/compiler/src/semantic/analysis/definite-assignment.ts`

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.DefiniteAssignmentAlwaysInitialized;
OptimizationMetadataKey.DefiniteAssignmentInitValue;
OptimizationMetadataKey.DefiniteAssignmentUninitializedUse;
```

**Implementation Pattern**:

```typescript
// Set metadata using enum
node.metadata = node.metadata || new Map();
node.metadata.set(OptimizationMetadataKey.DefiniteAssignmentAlwaysInitialized, true);

// NOT: node.metadata.set('phase8:definite-assignment:always-initialized', true)
```

**Symbol Kind Comparison** (CRITICAL):

```typescript
// CORRECT:
if (symbol.kind === SymbolKind.Variable) {
}

// WRONG:
if (symbol.kind === 'Variable') {
}
```

**Tests** (15+):

- Always initialized detection
- Conditional initialization tracking
- Uninitialized use detection
- Loop initialization handling
- Branch merge analysis

---

### Task 8.2: Variable Usage Analysis (5 hours)

**File**: `packages/compiler/src/semantic/analysis/variable-usage.ts`

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.UsageReadCount;
OptimizationMetadataKey.UsageWriteCount;
OptimizationMetadataKey.UsageIsUsed;
OptimizationMetadataKey.UsageIsWriteOnly;
OptimizationMetadataKey.UsageIsReadOnly;
OptimizationMetadataKey.UsageHotPathAccesses;
OptimizationMetadataKey.UsageMaxLoopDepth;
```

**Implementation Pattern**:

```typescript
// Increment read count
const currentReads = (node.metadata?.get(OptimizationMetadataKey.UsageReadCount) as number) ?? 0;

node.metadata = node.metadata || new Map();
node.metadata.set(OptimizationMetadataKey.UsageReadCount, currentReads + 1);
```

**Tests** (12+):

- Read/write count tracking
- Unused variable detection
- Write-only variable detection
- Read-only variable detection
- Hot path identification

---

### Task 8.3: Unused Function Detection (4 hours)

**File**: `packages/compiler/src/semantic/analysis/unused-functions.ts`

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.CallGraphUnused;
OptimizationMetadataKey.CallGraphCallCount;
```

**Symbol Kind Comparison**:

```typescript
// CORRECT:
if (symbol.kind === SymbolKind.Function) {
}
```

**Tests** (10+):

- Unused function detection
- Entry point handling
- Exported function handling
- Call count tracking
- Recursive function handling

---

### Task 8.4: Dead Code Detection (4 hours)

**File**: `packages/compiler/src/semantic/analysis/dead-code.ts`

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.DeadCodeUnreachable;
OptimizationMetadataKey.DeadCodeKind; // Uses DeadCodeKind enum
OptimizationMetadataKey.DeadCodeReason;
OptimizationMetadataKey.DeadCodeRemovable;
```

**Supporting Enum**:

```typescript
// Use supporting enum for dead code classification
node.metadata.set(OptimizationMetadataKey.DeadCodeKind, DeadCodeKind.UnreachableStatement);
```

**Tests** (15+):

- Unreachable statement detection
- Unreachable branch detection
- Dead store detection
- Unused result detection
- Removability analysis

---

## Tier 1 Summary

| Task      | Description         | Hours      | Tests         | Metadata Keys | Status  |
| --------- | ------------------- | ---------- | ------------- | ------------- | ------- |
| 8.1       | Definite assignment | 6          | 15+           | 3             | [ ]     |
| 8.2       | Variable usage      | 5          | 12+           | 7             | [ ]     |
| 8.3       | Unused functions    | 4          | 10+           | 2             | [ ]     |
| 8.4       | Dead code           | 4          | 15+           | 4             | [ ]     |
| **Total** | **Tier 1**          | **19 hrs** | **52+ tests** | **16 keys**   | **[ ]** |

---

## Implementation Guidelines

### Enum Usage Rules

**✅ ALWAYS DO:**

```typescript
// 1. Use OptimizationMetadataKey enum
node.metadata.set(OptimizationMetadataKey.ConstantValue, 42);

// 2. Use SymbolKind enum
if (symbol.kind === SymbolKind.Variable) {
}

// 3. Use StorageClass enum
if (symbol.storageClass === StorageClass.ZeroPage) {
}

// 4. Use supporting enums
metadata.set(OptimizationMetadataKey.DeadCodeKind, DeadCodeKind.DeadStore);
```

**❌ NEVER DO:**

```typescript
// 1. String-based metadata keys
node.metadata.set('phase8:constant:value', 42);
node.metadata.set('ConstantValue', 42);

// 2. String-based symbol kind
if (symbol.kind === 'Variable') {
}

// 3. String-based storage class
if (symbol.storageClass === 'ZeroPage') {
}
```

### Testing Requirements

**Every test must verify**:

1. Metadata keys use `OptimizationMetadataKey` enum
2. Symbol comparisons use `SymbolKind` enum
3. Type-safe accessor methods work correctly
4. IL optimizer can consume metadata easily

---

## Next Steps

After completing **Part 1 (Foundation + Tier 1)**:

1. ✅ All Foundation tasks complete (0.1-0.4)
2. ✅ All Tier 1 tasks complete (8.1-8.4)
3. ✅ 95+ tests passing
4. ✅ Enum-based architecture working

**→ Continue to [Part 2: Tier 2 - Data Flow Analysis](phase8-part2-tier2.md)**

---

**Part 1 Status**: Foundation + Tier 1 (8 tasks, 28 hours, 95+ tests)
**Architecture**: Enum-based, IL optimizer friendly ✅