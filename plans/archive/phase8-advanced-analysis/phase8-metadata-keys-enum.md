# Phase 8: Optimization Metadata Keys Enum Definition

> **Purpose**: Define TypeScript enum for all Phase 8 optimization metadata keys
> **Pattern**: Flat enum (like TokenType, SymbolKind) - easiest for IL optimizer
> **Last Updated**: January 15, 2026

---

## Metadata Keys Enum

```typescript
/**
 * Optimization metadata keys for Phase 8 analysis
 *
 * These keys are used to store analysis results in AST node metadata.
 * Following the same pattern as TokenType and SymbolKind for consistency.
 */
export enum OptimizationMetadataKey {
  // ==========================================
  // TIER 1: Basic Analysis
  // ==========================================

  // Definite Assignment (Task 8.1)
  DefiniteAssignmentAlwaysInitialized = 'DefiniteAssignmentAlwaysInitialized',
  DefiniteAssignmentInitValue = 'DefiniteAssignmentInitValue',
  DefiniteAssignmentUninitializedUse = 'DefiniteAssignmentUninitializedUse',

  // Variable Usage (Task 8.2)
  UsageReadCount = 'UsageReadCount',
  UsageWriteCount = 'UsageWriteCount',
  UsageIsUsed = 'UsageIsUsed',
  UsageIsWriteOnly = 'UsageIsWriteOnly',
  UsageIsReadOnly = 'UsageIsReadOnly',
  UsageHotPathAccesses = 'UsageHotPathAccesses',
  UsageMaxLoopDepth = 'UsageMaxLoopDepth',

  // Unused Functions (Task 8.3)
  CallGraphUnused = 'CallGraphUnused',
  CallGraphCallCount = 'CallGraphCallCount',

  // Dead Code (Task 8.4)
  DeadCodeUnreachable = 'DeadCodeUnreachable',
  DeadCodeKind = 'DeadCodeKind',
  DeadCodeReason = 'DeadCodeReason',
  DeadCodeRemovable = 'DeadCodeRemovable',

  // ==========================================
  // TIER 2: Data Flow Analysis
  // ==========================================

  // Reaching Definitions (Task 8.5)
  ReachingDefinitionsSet = 'ReachingDefinitionsSet',
  ReachingDefinitionsDefUseChain = 'ReachingDefinitionsDefUseChain',
  ReachingDefinitionsUseDefChain = 'ReachingDefinitionsUseDefChain',

  // Liveness Analysis (Task 8.6)
  LivenessLiveIn = 'LivenessLiveIn',
  LivenessLiveOut = 'LivenessLiveOut',
  LivenessInterval = 'LivenessInterval',
  LivenessIntervalLength = 'LivenessIntervalLength',

  // Constant Propagation (Task 8.7)
  ConstantValue = 'ConstantValue',
  ConstantFoldable = 'ConstantFoldable',
  ConstantFoldResult = 'ConstantFoldResult',
  ConstantEffectivelyConst = 'ConstantEffectivelyConst',
  ConstantBranchCondition = 'ConstantBranchCondition',

  // ==========================================
  // TIER 3: Advanced Analysis
  // ==========================================

  // Alias Analysis (Task 8.8)
  AliasPointsTo = 'AliasPointsTo',
  AliasNonAliasSet = 'AliasNonAliasSet',
  AliasMemoryRegion = 'AliasMemoryRegion',

  // Purity Analysis (Task 8.9)
  PurityLevel = 'PurityLevel',
  PurityWrittenLocations = 'PurityWrittenLocations',
  PurityReadLocations = 'PurityReadLocations',
  PurityIsDeterministic = 'PurityIsDeterministic',
  PurityIsInlineable = 'PurityIsInlineable',
  PurityAccessesHardware = 'PurityAccessesHardware',

  // Escape Analysis (Task 8.10)
  EscapeEscapes = 'EscapeEscapes',
  EscapeStackAllocatable = 'EscapeStackAllocatable',
  EscapeRequiresGlobal = 'EscapeRequiresGlobal',
  EscapeReason = 'EscapeReason',

  // Loop Analysis (Task 8.11)
  LoopInvariant = 'LoopInvariant',
  LoopHoistCandidate = 'LoopHoistCandidate',
  LoopInductionVariable = 'LoopInductionVariable',
  LoopIsCounted = 'LoopIsCounted',
  LoopNestingLevel = 'LoopNestingLevel',

  // Call Graph (Task 8.12)
  CallGraphInlineCandidate = 'CallGraphInlineCandidate',
  CallGraphInlinePriority = 'CallGraphInlinePriority',
  CallGraphTailCallCandidate = 'CallGraphTailCallCandidate',
  CallGraphFunctionSize = 'CallGraphFunctionSize',
  CallGraphIsRecursive = 'CallGraphIsRecursive',
  CallGraphIsLeaf = 'CallGraphIsLeaf',

  // 6502 Optimization Hints (Task 8.13)
  M6502ZeroPagePriority = 'M6502ZeroPagePriority',
  M6502ZeroPageCycleSavings = 'M6502ZeroPageCycleSavings',
  M6502RegisterPreference = 'M6502RegisterPreference',
  M6502AddressingMode = 'M6502AddressingMode',
  M6502InstructionPattern = 'M6502InstructionPattern',
}
```

---

## Supporting Enums

```typescript
/**
 * Dead code classification
 */
export enum DeadCodeKind {
  UnreachableStatement = 'UnreachableStatement',
  UnreachableBranch = 'UnreachableBranch',
  DeadStore = 'DeadStore',
  UnusedResult = 'UnusedResult',
}

/**
 * Function purity levels
 */
export enum PurityLevel {
  Pure = 'Pure', // No side effects, deterministic
  ReadOnly = 'ReadOnly', // Reads globals, no writes
  LocalOnly = 'LocalOnly', // Only local side effects
  HasSideEffects = 'HasSideEffects', // Writes globals, I/O, etc.
}

/**
 * Variable escape reasons
 */
export enum EscapeReason {
  PassedToFunction = 'PassedToFunction',
  StoredInGlobal = 'StoredInGlobal',
  ReturnedFromFunction = 'ReturnedFromFunction',
  AddressTaken = 'AddressTaken',
}

/**
 * Memory regions (6502-specific)
 */
export enum MemoryRegion {
  ZeroPage = 'ZeroPage', // $00-$FF
  RAM = 'RAM', // General purpose RAM
  IO = 'IO', // Hardware registers
  Unknown = 'Unknown',
}

/**
 * 6502 registers
 */
export enum Register {
  A = 'A', // Accumulator
  X = 'X', // X index register
  Y = 'Y', // Y index register
  None = 'None',
}

/**
 * 6502 addressing modes
 */
export enum AddressingMode {
  ZeroPage = 'ZeroPage', // $00-$FF (2 bytes, 3 cycles)
  Absolute = 'Absolute', // $0000-$FFFF (3 bytes, 4 cycles)
  ZeroPageIndexed = 'ZeroPageIndexed', // $00,X or $00,Y
  AbsoluteIndexed = 'AbsoluteIndexed', // $0000,X or $0000,Y
  Indirect = 'Indirect', // ($00) or ($0000)
}
```

---

## Usage Examples

### Basic Usage

```typescript
import { OptimizationMetadataKey } from './optimization-metadata-keys';

// Setting metadata (Phase 8 analyzer)
node.metadata = node.metadata || new Map();
node.metadata.set(OptimizationMetadataKey.ConstantValue, 42);
node.metadata.set(OptimizationMetadataKey.UsageReadCount, 100);

// Reading metadata (IL optimizer)
const value = node.metadata?.get(OptimizationMetadataKey.ConstantValue) as number | undefined;
const readCount = (node.metadata?.get(OptimizationMetadataKey.UsageReadCount) as number) ?? 0;
```

### Type-Safe Accessor Pattern

```typescript
/**
 * Type-safe accessor for optimization metadata
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

  // 6502 hints
  getZeroPagePriority(): number {
    return (this.node.metadata?.get(OptimizationMetadataKey.M6502ZeroPagePriority) as number) ?? 0;
  }

  getRegisterPreference(): Register | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.M6502RegisterPreference) as
      | Register
      | undefined;
  }
}

// Usage in IL optimizer:
const accessor = new OptimizationMetadataAccessor(node);
if (accessor.isConstantFoldable()) {
  const value = accessor.getConstantValue();
  // Perform constant folding
}
```

---

## Integration Points

### Phase 8 Analyzer

```typescript
// In variable usage analyzer:
info.metadata.set(OptimizationMetadataKey.UsageReadCount, readCount);
info.metadata.set(OptimizationMetadataKey.UsageWriteCount, writeCount);
info.metadata.set(OptimizationMetadataKey.UsageHotPathAccesses, hotPathAccesses);

// In constant propagation:
node.metadata.set(OptimizationMetadataKey.ConstantValue, 42);
node.metadata.set(OptimizationMetadataKey.ConstantFoldable, true);

// In 6502 hints:
varNode.metadata.set(OptimizationMetadataKey.M6502ZeroPagePriority, 95);
varNode.metadata.set(OptimizationMetadataKey.M6502RegisterPreference, Register.A);
```

### IL Optimizer Consumption

```typescript
// Check if constant folding is possible:
if (node.metadata?.has(OptimizationMetadataKey.ConstantFoldable)) {
  const value = node.metadata.get(OptimizationMetadataKey.ConstantValue);
  // Replace expression with constant
}

// Use zero page priorities for allocation:
const priority = node.metadata?.get(OptimizationMetadataKey.M6502ZeroPagePriority) as number;
if (priority > 80) {
  // Allocate to zero page
}

// Check function inlining candidates:
const inlinePriority = funcNode.metadata?.get(
  OptimizationMetadataKey.CallGraphInlinePriority
) as number;
if (inlinePriority > 70) {
  // Inline this function
}
```

---

## Benefits of This Approach

1. ✅ **Type-Safe** - Compile-time validation of metadata keys
2. ✅ **Consistent** - Follows existing patterns (TokenType, SymbolKind)
3. ✅ **Discoverable** - IDE autocomplete shows all available keys
4. ✅ **Maintainable** - Easy to add new keys, refactor existing ones
5. ✅ **IL Optimizer Friendly** - Simple, flat enum easy to consume

---

## File Location

This enum should be defined in:

```
packages/compiler/src/semantic/analysis/optimization-metadata-keys.ts
```

And exported from:

```
packages/compiler/src/semantic/analysis/index.ts
```
