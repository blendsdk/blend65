# Phase 1: Optimizer Architecture & Pass Manager

> **Phase**: 1 of 11  
> **Est. Time**: ~16 hours  
> **Tasks**: 8  
> **Tests**: ~200  
> **Prerequisites**: IL Generator with SSA (COMPLETE ✅)

---

## Overview

This phase establishes the **foundation** for the entire optimizer. We implement a modular **Pass Manager** architecture inspired by LLVM, allowing passes to be:
- Added/removed independently
- Run in optimal order based on dependencies
- Invalidated when dependent analyses change

---

## Directory Structure Created

```
packages/compiler/src/optimizer/
├── index.ts                    # Main exports
├── pass.ts                     # Pass base classes
├── pass-manager.ts             # Pass orchestration
├── options.ts                  # Optimization options
├── statistics.ts               # Optimization statistics
└── pipeline.ts                 # Pipeline builder
```

---

## Task 1.1: Create Optimizer Directory Structure

**Time**: 30 minutes  
**Tests**: 5 tests

**Deliverables**:
- Create `optimizer/` directory
- Create `index.ts` with initial exports
- Verify directory structure

**Implementation Steps**:
1. Create directory `packages/compiler/src/optimizer/`
2. Create empty `index.ts`
3. Add initial export structure
4. Verify build passes

---

## Task 1.2: Define Pass Base Class Hierarchy

**Time**: 2.5 hours  
**Tests**: 30 tests

**Key Concepts**:
- `Pass`: Abstract base for all passes
- `AnalysisPass`: Read-only analysis (doesn't modify IL)
- `TransformPass`: Modifies IL

**File**: `packages/compiler/src/optimizer/pass.ts`

```typescript
/**
 * Pass kind enumeration
 */
export enum PassKind {
  Analysis = 'analysis',
  Transform = 'transform',
  Utility = 'utility',
}

/**
 * Base class for all optimization passes
 */
export abstract class Pass {
  abstract readonly name: string;
  abstract readonly kind: PassKind;
  
  /** Passes this pass requires to run first */
  readonly requires: string[] = [];
  
  /** Passes this pass invalidates when it runs */
  readonly invalidates: string[] = [];
  
  /** Optimization levels this pass runs at */
  readonly levels: OptimizationLevel[] = [];
}

/**
 * Analysis pass - reads IL, doesn't modify
 */
export abstract class AnalysisPass<T = unknown> extends Pass {
  readonly kind = PassKind.Analysis;
  
  /** Run analysis on function, return result */
  abstract analyze(func: ILFunction): T;
}

/**
 * Transform pass - modifies IL
 */
export abstract class TransformPass extends Pass {
  readonly kind = PassKind.Transform;
  
  /** Transform function, return true if modified */
  abstract transform(func: ILFunction): boolean;
}
```

**Tests**:
- Pass base class instantiation
- PassKind enum values
- AnalysisPass abstract contract
- TransformPass abstract contract
- Pass requirements declaration
- Pass invalidation declaration
- Pass level filtering

---

## Task 1.3: Implement PassManager

**Time**: 3 hours  
**Tests**: 40 tests

**Key Concepts**:
- Orchestrates pass execution
- Handles dependencies automatically
- Caches analysis results
- Invalidates stale analyses

**File**: `packages/compiler/src/optimizer/pass-manager.ts`

```typescript
/**
 * Manages optimization pass execution
 */
export class PassManager {
  protected passes: Map<string, Pass> = new Map();
  protected analysisCache: Map<string, Map<string, unknown>> = new Map();
  protected options: OptimizationOptions;
  
  constructor(options: OptimizationOptions) {
    this.options = options;
  }
  
  /** Register a pass */
  registerPass(pass: Pass): void;
  
  /** Get analysis result (runs if needed) */
  getAnalysis<T>(name: string, func: ILFunction): T;
  
  /** Run all applicable passes on module */
  run(module: ILModule): OptimizationResult;
  
  /** Invalidate cached analysis */
  protected invalidateAnalysis(name: string, func: ILFunction): void;
}
```

**Tests**:
- PassManager construction
- Pass registration
- Duplicate pass handling
- Analysis caching
- Analysis invalidation
- Dependency resolution
- Circular dependency detection
- Pass ordering
- Level filtering (-O0, -O1, etc.)

---

## Task 1.4: Define OptimizationOptions

**Time**: 1.5 hours  
**Tests**: 25 tests

**Key Concepts**:
- Optimization level (-O0 to -O3, -Os, -Oz)
- Individual pass enable/disable
- Target-specific options

**File**: `packages/compiler/src/optimizer/options.ts`

```typescript
/**
 * Optimization level
 */
export enum OptimizationLevel {
  O0 = 0,   // No optimization
  O1 = 1,   // Basic optimizations
  O2 = 2,   // Standard (default for release)
  O3 = 3,   // Aggressive
  Os = 10,  // Size optimization
  Oz = 11,  // Minimum size
}

/**
 * Optimization options
 */
export interface OptimizationOptions {
  level: OptimizationLevel;
  
  // Individual pass control
  enableDCE?: boolean;
  enableConstantFold?: boolean;
  enableCSE?: boolean;
  // ... more passes
  
  // Target options
  targetId?: string;
  
  // SMC options (opt-in)
  enableSMC?: boolean;
  
  // Debug options
  verbose?: boolean;
  dumpAfterEachPass?: boolean;
}

/**
 * Create default options for a level
 */
export function createOptions(level: OptimizationLevel): OptimizationOptions;

/**
 * Get passes enabled for a level
 */
export function getPassesForLevel(level: OptimizationLevel): string[];
```

**Tests**:
- OptimizationLevel enum values
- Default options creation for each level
- Pass enabling/disabling
- Level → pass mapping
- Option merging
- SMC opt-in behavior
- Invalid option handling

---

## Task 1.5: Implement Pass Dependency System

**Time**: 2.5 hours  
**Tests**: 35 tests

**Key Concepts**:
- Topological sorting for pass order
- Cycle detection
- Lazy dependency resolution

**File**: `packages/compiler/src/optimizer/pass-manager.ts` (extension)

```typescript
/**
 * Dependency resolver for passes
 */
export class PassDependencyResolver {
  /** Build execution order respecting dependencies */
  buildExecutionOrder(passes: Pass[]): Pass[];
  
  /** Check for circular dependencies */
  detectCycles(passes: Pass[]): string[][] | null;
  
  /** Get all transitive dependencies */
  getTransitiveDependencies(pass: Pass): string[];
}
```

**Tests**:
- Simple dependency chain (A→B→C)
- Multiple dependencies (A→[B,C])
- Diamond dependencies (A→[B,C]→D)
- Circular dependency detection
- Self-dependency detection
- Missing dependency handling
- Transitive dependency calculation
- Order stability
- Empty pass list handling

---

## Task 1.6: Implement Analysis Invalidation

**Time**: 2 hours  
**Tests**: 30 tests

**Key Concepts**:
- Transform passes invalidate analyses
- Cached results are cleared when invalidated
- Re-analysis on demand

**Implementation in PassManager**:

```typescript
/**
 * Analysis invalidation tracking
 */
protected onTransformComplete(transform: TransformPass, func: ILFunction): void {
  // Clear invalidated analyses
  for (const analysisName of transform.invalidates) {
    this.invalidateAnalysis(analysisName, func);
  }
  
  // If transform modified CFG, invalidate all CFG-dependent analyses
  if (transform.invalidates.includes('*cfg*')) {
    this.invalidateCFGDependentAnalyses(func);
  }
}
```

**Tests**:
- Explicit invalidation
- Wildcard invalidation (*cfg*)
- Transitive invalidation
- No-op when not cached
- Re-analysis after invalidation
- Multiple invalidations
- Function-scoped invalidation

---

## Task 1.7: Create Optimization Statistics

**Time**: 1.5 hours  
**Tests**: 20 tests

**Key Concepts**:
- Track what each pass did
- Useful for debugging and benchmarking

**File**: `packages/compiler/src/optimizer/statistics.ts`

```typescript
/**
 * Statistics for a single pass run
 */
export interface PassStatistics {
  name: string;
  timeMs: number;
  instructionsRemoved: number;
  instructionsAdded: number;
  blocksRemoved: number;
  blocksAdded: number;
  modified: boolean;
}

/**
 * Overall optimization statistics
 */
export interface OptimizationStatistics {
  totalTimeMs: number;
  passes: PassStatistics[];
  totalInstructionsRemoved: number;
  totalInstructionsAdded: number;
}

/**
 * Statistics collector
 */
export class StatisticsCollector {
  beginPass(name: string): void;
  endPass(modified: boolean): void;
  recordRemoval(kind: 'instruction' | 'block', count: number): void;
  recordAddition(kind: 'instruction' | 'block', count: number): void;
  getStatistics(): OptimizationStatistics;
}
```

**Tests**:
- Statistics recording
- Time measurement
- Instruction counting
- Block counting
- Multiple pass aggregation
- Reset functionality
- JSON serialization

---

## Task 1.8: Implement Pass Pipeline Builder

**Time**: 2.5 hours  
**Tests**: 25 tests

**Key Concepts**:
- Fluent API for building pipelines
- Preset pipelines for each -O level

**File**: `packages/compiler/src/optimizer/pipeline.ts`

```typescript
/**
 * Builder for optimization pipelines
 */
export class PipelineBuilder {
  protected passes: Pass[] = [];
  
  /** Add a pass */
  add(pass: Pass): this;
  
  /** Add passes for an optimization level */
  addLevelPasses(level: OptimizationLevel): this;
  
  /** Build the pipeline */
  build(): OptimizationPipeline;
}

/**
 * Preset pipelines
 */
export const Pipelines = {
  O0: () => new PipelineBuilder().addLevelPasses(OptimizationLevel.O0).build(),
  O1: () => new PipelineBuilder().addLevelPasses(OptimizationLevel.O1).build(),
  O2: () => new PipelineBuilder().addLevelPasses(OptimizationLevel.O2).build(),
  O3: () => new PipelineBuilder().addLevelPasses(OptimizationLevel.O3).build(),
  Os: () => new PipelineBuilder().addLevelPasses(OptimizationLevel.Os).build(),
  Oz: () => new PipelineBuilder().addLevelPasses(OptimizationLevel.Oz).build(),
};
```

**Tests**:
- Empty pipeline
- Single pass pipeline
- Multi-pass pipeline
- Level preset pipelines
- Custom pipeline building
- Pass ordering in pipeline
- Duplicate pass handling

---

## Phase 1 Task Checklist

| Task | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 1.1 | Create directory structure | 0.5 hr | 5 | [ ] |
| 1.2 | Pass base class hierarchy | 2.5 hr | 30 | [ ] |
| 1.3 | PassManager implementation | 3 hr | 40 | [ ] |
| 1.4 | OptimizationOptions | 1.5 hr | 25 | [ ] |
| 1.5 | Dependency system | 2.5 hr | 35 | [ ] |
| 1.6 | Analysis invalidation | 2 hr | 30 | [ ] |
| 1.7 | Statistics collector | 1.5 hr | 20 | [ ] |
| 1.8 | Pipeline builder | 2.5 hr | 25 | [ ] |
| **Total** | | **16 hr** | **210** | |

---

## Success Criteria

- [ ] All 210 tests passing
- [ ] PassManager can register and run passes
- [ ] Dependencies resolved automatically
- [ ] Analysis caching works correctly
- [ ] Invalidation triggers re-analysis
- [ ] Statistics tracking accurate
- [ ] Pipeline builder creates valid pipelines
- [ ] All -O level presets work

---

## Implementation Sessions

**Per multi-session rules, this phase breaks into:**

| Session | Tasks | Focus |
|---------|-------|-------|
| Session 1 | 1.1, 1.2 | Directory + Pass classes |
| Session 2 | 1.3 | PassManager core |
| Session 3 | 1.4, 1.5 | Options + Dependencies |
| Session 4 | 1.6, 1.7, 1.8 | Invalidation + Stats + Pipeline |

---

**Previous**: [00-index.md](00-index.md)  
**Next**: [02-analysis-passes.md](02-analysis-passes.md)