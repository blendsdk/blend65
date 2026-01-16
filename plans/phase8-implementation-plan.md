# Phase 8 Implementation Plan: Advanced Analysis with Enum-Based Metadata

> **Status**: Ready for Implementation
> **Architecture**: Enum-based metadata (flat pattern, IL optimizer friendly)
> **Duration**: 3-4 weeks (14 tasks, 103 hours)
> **Prerequisites**: Phases 0-7 complete ✅
> **Last Updated**: January 15, 2026

---

## Executive Summary

This plan implements Phase 8 Advanced Analysis using the **new enum-based metadata architecture** defined in `phase8-metadata-keys-enum.md`. All metadata keys use `OptimizationMetadataKey` enum (flat pattern) instead of string-based "phase8:..." keys.

**Key Changes from Original Plan:**

- ✅ Uses `OptimizationMetadataKey` enum instead of strings
- ✅ Type-safe metadata access via `OptimizationMetadataAccessor`
- ✅ Fixes symbol.kind comparisons (uses `SymbolKind.Variable` not strings)
- ✅ IL optimizer friendly (flat enum, single-level lookup)

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

## Phase Structure

### Three-Tier Implementation

**Week 1: Foundation + Tier 1 (Basic Analysis)**

- Foundation: Enum definitions, base classes, integration
- Tier 1: Definite assignment, variable usage, unused functions, dead code

**Week 2: Tier 2 (Data Flow Analysis)**

- Reaching definitions, liveness analysis, constant propagation

**Week 3-4: Tier 3 (Advanced Analysis)**

- Alias, purity, escape, loop, call graph, 6502 hints, integration

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
  // ... (40+ keys from specification)
}

export enum DeadCodeKind {
  UnreachableStatement = 'UnreachableStatement',
  UnreachableBranch = 'UnreachableBranch',
  DeadStore = 'DeadStore',
  UnusedResult = 'UnusedResult',
}

// ... other supporting enums
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
import { OptimizationMetadataKey, Register } from './optimization-metadata-keys.js';
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

  // ... (accessors for all 40+ keys)
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
- Orchestrates all Tier 1-3 analyses
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
   */
  public analyze(ast: Program): void {
    // Tier 1: Basic Analysis
    this.runTier1BasicAnalysis(ast);

    // Tier 2: Data Flow Analysis (requires Tier 1)
    this.runTier2DataFlowAnalysis(ast);

    // Tier 3: Advanced Analysis (requires Tiers 1+2)
    this.runTier3AdvancedAnalysis(ast);
  }

  protected runTier1BasicAnalysis(ast: Program): void {
    // Implemented in Phase 1
  }

  protected runTier2DataFlowAnalysis(ast: Program): void {
    // Implemented in Phase 2
  }

  protected runTier3AdvancedAnalysis(ast: Program): void {
    // Implemented in Phase 3
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
  // ... existing passes 1-5 ...

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

**Tests** (15+): Same as original plan, but verify enum usage

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

**Tests** (12+): Same as original plan, but verify enum usage

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

**Tests** (10+): Same as original plan

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

**Tests** (15+): Same as original plan

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

## Tier 2: Data Flow Analysis (Week 2)

**Note**: Tier 2 tasks follow same pattern as Tier 1:

- Use `OptimizationMetadataKey` enum for all metadata
- Use `SymbolKind` enum for symbol comparisons
- No string-based keys or comparisons

**Tasks**:

- Task 8.5: Reaching Definitions (8 hours, 20+ tests)
- Task 8.6: Liveness Analysis (8 hours, 20+ tests)
- Task 8.7: Constant Propagation (6 hours, 18+ tests)

**Metadata Keys** (13 total):

- ReachingDefinitionsSet, DefUseChain, UseDefChain
- LivenessLiveIn, LivenessLiveOut, LivenessInterval, LivenessIntervalLength
- ConstantValue, ConstantFoldable, ConstantFoldResult, ConstantEffectivelyConst, ConstantBranchCondition

---

## Tier 3: Advanced Analysis (Weeks 3-4)

**Tasks**:

- Task 8.8: Alias Analysis (10 hours, 25+ tests)
- Task 8.9: Purity Analysis (8 hours, 20+ tests)
- Task 8.10: Escape Analysis (6 hours, 15+ tests)
- Task 8.11: Loop Analysis (10 hours, 25+ tests)
- Task 8.12: Call Graph (8 hours, 20+ tests)
- Task 8.13: 6502 Hints (10 hours, 30+ tests)
- Task 8.14: Integration (10 hours, 50+ tests)

**Metadata Keys** (21 total):

- Alias: AliasPointsTo, AliasNonAliasSet, AliasMemoryRegion
- Purity: PurityLevel, PurityWrittenLocations, etc.
- Escape: EscapeEscapes, EscapeStackAllocatable, etc.
- Loop: LoopInvariant, LoopHoistCandidate, etc.
- Call Graph: CallGraphInlineCandidate, etc.
- 6502: M6502ZeroPagePriority, M6502RegisterPreference, etc.

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

## File Structure

```
packages/compiler/src/semantic/analysis/
├── optimization-metadata-keys.ts    # Task 0.1 (enums)
├── metadata-accessor.ts             # Task 0.2 (type-safe access)
├── advanced-analyzer.ts             # Task 0.3 (orchestrator)
├── definite-assignment.ts           # Task 8.1
├── variable-usage.ts                # Task 8.2
├── unused-functions.ts              # Task 8.3
├── dead-code.ts                     # Task 8.4
├── reaching-definitions.ts          # Task 8.5
├── liveness.ts                      # Task 8.6
├── constant-propagation.ts          # Task 8.7
├── alias-analysis.ts                # Task 8.8
├── purity-analysis.ts               # Task 8.9
├── escape-analysis.ts               # Task 8.10
├── loop-analysis.ts                 # Task 8.11
├── call-graph.ts                    # Task 8.12
├── m6502-hints.ts                   # Task 8.13
└── index.ts                         # Exports

packages/compiler/src/__tests__/semantic/analysis/
├── optimization-metadata-keys.test.ts
├── metadata-accessor.test.ts
├── advanced-analyzer.test.ts
├── definite-assignment.test.ts
├── variable-usage.test.ts
├── unused-functions.test.ts
├── dead-code.test.ts
├── reaching-definitions.test.ts
├── liveness.test.ts
├── constant-propagation.test.ts
├── alias-analysis.test.ts
├── purity-analysis.test.ts
├── escape-analysis.test.ts
├── loop-analysis.test.ts
├── call-graph.test.ts
├── m6502-hints.test.ts
└── integration.test.ts
```

---

## Complete Task Checklist

| Phase          | Task | Description                  | Hours       | Tests          | Status  |
| -------------- | ---- | ---------------------------- | ----------- | -------------- | ------- |
| **Foundation** |      |                              |             |                |         |
| 0              | 0.1  | Metadata keys enum           | 2           | 10+            | [ ]     |
| 0              | 0.2  | Metadata accessor            | 2           | 15+            | [ ]     |
| 0              | 0.3  | Advanced analyzer base       | 3           | 10+            | [ ]     |
| 0              | 0.4  | SemanticAnalyzer integration | 2           | 8+             | [ ]     |
| **Tier 1**     |      |                              |             |                |         |
| 1              | 8.1  | Definite assignment          | 6           | 15+            | [ ]     |
| 1              | 8.2  | Variable usage               | 5           | 12+            | [ ]     |
| 1              | 8.3  | Unused functions             | 4           | 10+            | [ ]     |
| 1              | 8.4  | Dead code                    | 4           | 15+            | [ ]     |
| **Tier 2**     |      |                              |             |                |         |
| 2              | 8.5  | Reaching definitions         | 8           | 20+            | [ ]     |
| 2              | 8.6  | Liveness analysis            | 8           | 20+            | [ ]     |
| 2              | 8.7  | Constant propagation         | 6           | 18+            | [ ]     |
| **Tier 3**     |      |                              |             |                |         |
| 3              | 8.8  | Alias analysis               | 10          | 25+            | [ ]     |
| 3              | 8.9  | Purity analysis              | 8           | 20+            | [ ]     |
| 3              | 8.10 | Escape analysis              | 6           | 15+            | [ ]     |
| 3              | 8.11 | Loop analysis                | 10          | 25+            | [ ]     |
| 3              | 8.12 | Call graph                   | 8           | 20+            | [ ]     |
| 3              | 8.13 | 6502 hints                   | 10          | 30+            | [ ]     |
| 3              | 8.14 | Integration                  | 10          | 50+            | [ ]     |
| **TOTAL**      |      | **18 tasks**                 | **112 hrs** | **338+ tests** | **[ ]** |

---

## Success Criteria

### Phase 8 Complete When:

**✅ Functional**:

- All 18 tasks (Foundation + Tiers 1-3) implemented
- All 338+ tests passing
- All metadata uses `OptimizationMetadataKey` enum
- All symbol comparisons use `SymbolKind` enum

**✅ Performance**:

- 1,000 LOC: <500ms analysis time
- 10,000 LOC: <2s analysis time
- No exponential algorithms

**✅ Quality**:

- 93%+ test coverage
- All public APIs documented
- Type-safe accessor working
- IL optimizer can easily consume metadata

---

## Next Steps

1. **Review this plan** - Verify enum architecture is correct
2. **Toggle to Act Mode** - Begin implementation
3. **Start with Foundation** - Tasks 0.1-0.4 (9 hours, 43+ tests)
4. **Then Tier 1** - Tasks 8.1-8.4 (19 hours, 52+ tests)
5. **Continue with Tiers 2-3** - Following the checklist

---

**Status**: Plan Complete, Ready for Implementation
**Architecture**: Enum-based, IL optimizer friendly ✅
**Compliance**: Fixed all string-based comparisons ✅
