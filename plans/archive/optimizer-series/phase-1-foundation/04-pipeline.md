# Phase 1.4: Pipeline Builder

> **Document**: 04-pipeline.md  
> **Phase**: 1 - Foundation  
> **Est. Time**: ~2 hours  
> **Tests**: ~25 tests

---

## Overview

The **Pipeline Builder** provides a fluent API for constructing optimization pipelines. It creates preset pipelines for each optimization level and allows custom pipeline construction.

---

## File Location

```
packages/compiler/src/optimizer/pipeline.ts
```

---

## Type Definitions

### Pipeline Interface

```typescript
/**
 * A constructed optimization pipeline.
 */
export interface OptimizationPipeline {
  /** The passes in execution order */
  readonly passes: readonly Pass[];
  
  /** The optimization level this pipeline targets */
  readonly level: OptimizationLevel;
  
  /** Execute the pipeline on a module */
  execute(module: ILModule): OptimizationResult;
}
```

---

## Pipeline Builder Implementation

```typescript
import { Pass, AnalysisPass, TransformPass } from './pass.js';
import { OptimizationLevel, getPassesForLevel } from './options.js';
import { PassManager } from './pass-manager.js';

/**
 * Fluent builder for optimization pipelines.
 * 
 * @example
 * ```typescript
 * // Build custom pipeline
 * const pipeline = new PipelineBuilder()
 *   .setLevel(OptimizationLevel.O2)
 *   .add(new UseDefAnalysis())
 *   .add(new DCEPass())
 *   .add(new ConstantFoldPass())
 *   .build();
 * 
 * const result = pipeline.execute(module);
 * ```
 */
export class PipelineBuilder {
  protected passes: Pass[] = [];
  protected level: OptimizationLevel = OptimizationLevel.O0;
  
  /**
   * Set the optimization level for this pipeline.
   */
  setLevel(level: OptimizationLevel): this {
    this.level = level;
    return this;
  }
  
  /**
   * Add a single pass to the pipeline.
   */
  add(pass: Pass): this {
    this.passes.push(pass);
    return this;
  }
  
  /**
   * Add multiple passes to the pipeline.
   */
  addAll(passes: Pass[]): this {
    this.passes.push(...passes);
    return this;
  }
  
  /**
   * Add all passes appropriate for the specified level.
   * Requires pass registry to be populated.
   */
  addLevelPasses(level: OptimizationLevel, registry: PassRegistry): this {
    const passNames = getPassesForLevel(level);
    
    for (const name of passNames) {
      const pass = registry.get(name);
      if (pass) {
        this.passes.push(pass);
      }
    }
    
    return this;
  }
  
  /**
   * Build the pipeline.
   */
  build(): OptimizationPipeline {
    return new BuiltPipeline(this.passes, this.level);
  }
}

/**
 * Internal implementation of OptimizationPipeline.
 */
class BuiltPipeline implements OptimizationPipeline {
  readonly passes: readonly Pass[];
  readonly level: OptimizationLevel;
  protected manager: PassManager;
  
  constructor(passes: Pass[], level: OptimizationLevel) {
    this.passes = passes;
    this.level = level;
    
    // Create pass manager with level options
    this.manager = new PassManager({ level });
    
    // Register all passes
    for (const pass of passes) {
      this.manager.registerPass(pass);
    }
  }
  
  execute(module: ILModule): OptimizationResult {
    return this.manager.run(module);
  }
}
```

---

## Pass Registry

```typescript
/**
 * Registry of all available passes.
 * 
 * Used by pipeline builder to construct level-specific pipelines.
 */
export class PassRegistry {
  protected passes: Map<string, () => Pass> = new Map();
  
  /**
   * Register a pass factory.
   */
  register(name: string, factory: () => Pass): void {
    this.passes.set(name, factory);
  }
  
  /**
   * Get a new instance of a pass.
   */
  get(name: string): Pass | undefined {
    const factory = this.passes.get(name);
    return factory ? factory() : undefined;
  }
  
  /**
   * Check if pass is registered.
   */
  has(name: string): boolean {
    return this.passes.has(name);
  }
  
  /**
   * Get all registered pass names.
   */
  getNames(): string[] {
    return [...this.passes.keys()];
  }
}

/** Global pass registry instance */
export const globalPassRegistry = new PassRegistry();
```

---

## Preset Pipelines

```typescript
/**
 * Create preset pipelines for each optimization level.
 */
export const Pipelines = {
  /**
   * No optimization - pass-through.
   */
  O0: (): OptimizationPipeline => {
    return new PipelineBuilder()
      .setLevel(OptimizationLevel.O0)
      .build();
  },
  
  /**
   * Basic optimizations.
   */
  O1: (): OptimizationPipeline => {
    return new PipelineBuilder()
      .setLevel(OptimizationLevel.O1)
      .addLevelPasses(OptimizationLevel.O1, globalPassRegistry)
      .build();
  },
  
  /**
   * Standard optimizations (release default).
   */
  O2: (): OptimizationPipeline => {
    return new PipelineBuilder()
      .setLevel(OptimizationLevel.O2)
      .addLevelPasses(OptimizationLevel.O2, globalPassRegistry)
      .build();
  },
  
  /**
   * Aggressive optimizations.
   */
  O3: (): OptimizationPipeline => {
    return new PipelineBuilder()
      .setLevel(OptimizationLevel.O3)
      .addLevelPasses(OptimizationLevel.O3, globalPassRegistry)
      .build();
  },
  
  /**
   * Size optimization.
   */
  Os: (): OptimizationPipeline => {
    return new PipelineBuilder()
      .setLevel(OptimizationLevel.Os)
      .addLevelPasses(OptimizationLevel.Os, globalPassRegistry)
      .build();
  },
  
  /**
   * Minimum size.
   */
  Oz: (): OptimizationPipeline => {
    return new PipelineBuilder()
      .setLevel(OptimizationLevel.Oz)
      .addLevelPasses(OptimizationLevel.Oz, globalPassRegistry)
      .build();
  },
};

/**
 * Get preset pipeline for optimization level.
 */
export function getPipeline(level: OptimizationLevel): OptimizationPipeline {
  switch (level) {
    case OptimizationLevel.O0: return Pipelines.O0();
    case OptimizationLevel.O1: return Pipelines.O1();
    case OptimizationLevel.O2: return Pipelines.O2();
    case OptimizationLevel.O3: return Pipelines.O3();
    case OptimizationLevel.Os: return Pipelines.Os();
    case OptimizationLevel.Oz: return Pipelines.Oz();
    default: return Pipelines.O0();
  }
}
```

---

## Test Requirements

### Unit Tests (~25 tests)

| Test Category | Tests | Description |
|---------------|-------|-------------|
| PipelineBuilder | 10 | Builder methods |
| PassRegistry | 8 | Registry operations |
| Preset pipelines | 7 | Level presets |

### Test Cases

```typescript
describe('PipelineBuilder', () => {
  it('should create empty pipeline');
  it('should set optimization level');
  it('should add single pass');
  it('should add multiple passes');
  it('should add level passes from registry');
  it('should build executable pipeline');
  it('should chain methods fluently');
});

describe('PassRegistry', () => {
  it('should register pass factory');
  it('should return new instance on get');
  it('should return undefined for unknown pass');
  it('should check if pass exists');
  it('should list all pass names');
});

describe('Pipelines presets', () => {
  it('should create O0 pipeline with no passes');
  it('should create O1 pipeline with DCE, const fold/prop');
  it('should create O2 pipeline with peephole');
  it('should create O3 pipeline with loop opts');
});

describe('getPipeline', () => {
  it('should return correct pipeline for each level');
});
```

---

## Usage Examples

### Using Preset

```typescript
import { getPipeline, OptimizationLevel } from './optimizer/index.js';

const pipeline = getPipeline(OptimizationLevel.O2);
const result = pipeline.execute(module);
```

### Custom Pipeline

```typescript
import { PipelineBuilder, OptimizationLevel } from './optimizer/index.js';

// O2 without peephole
const pipeline = new PipelineBuilder()
  .setLevel(OptimizationLevel.O2)
  .add(new UseDefAnalysis())
  .add(new DCEPass())
  .add(new ConstantFoldPass())
  .add(new ConstantPropPass())
  // Skip peephole
  .build();
```

---

## Task Checklist

| Task | Status |
|------|--------|
| Create `pipeline.ts` file | [ ] |
| Implement PipelineBuilder class | [ ] |
| Implement BuiltPipeline class | [ ] |
| Implement PassRegistry class | [ ] |
| Implement preset pipelines | [ ] |
| Implement getPipeline function | [ ] |
| Add JSDoc to all exports | [ ] |
| Write unit tests (~25) | [ ] |
| Verify 100% coverage | [ ] |

---

**Previous**: [03-options.md](03-options.md)  
**Next**: [99-phase-tasks.md](99-phase-tasks.md)