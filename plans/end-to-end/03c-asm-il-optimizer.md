# 03c - ASM-IL Optimizer (Pass-Through)

> **Phase:** 2 (End-to-End Compilation)
> **Session:** 6
> **Estimated Tests:** ~20
> **Dependencies:** 03a (types), 03b (builder)

---

## Overview

The ASM-IL optimizer sits between the code generator and ACME emitter. Initially, it implements a **pass-through** strategy that returns the input unchanged. This establishes the infrastructure for future peephole optimization patterns.

### Pipeline Position
```
IL Module → CodeGenerator → AsmModule → [AsmOptimizer] → ACME Emitter → .asm
                                             ↑
                                       This component
```

### Design Philosophy
- **Pass-through first**: Get the pipeline working end-to-end before adding optimizations
- **Same architecture as IL optimizer**: Reuse pass manager patterns
- **Extensible**: Easy to add peephole patterns later
- **Transparent**: No behavioral changes in pass-through mode

---

## Directory Structure

```
packages/compiler/src/asm-il/optimizer/
├── index.ts              # Public exports
├── base-optimizer.ts     # Abstract base class (~100 lines)
├── pass-through.ts       # Pass-through implementation (~50 lines)
└── asm-optimizer.ts      # Concrete optimizer with pass manager (~150 lines)
```

---

## Type Definitions

### Optimizer Pass Interface

```typescript
/**
 * Represents a single optimization pass over ASM-IL.
 * Passes can analyze and transform AsmModule.
 */
export interface AsmOptimizationPass {
  /** Unique name for this pass */
  readonly name: string;
  
  /** Whether this pass modifies the module (false for analysis-only) */
  readonly isTransform: boolean;
  
  /**
   * Run the optimization pass on an AsmModule.
   * @param module - The module to optimize
   * @returns The optimized module (may be same reference if unchanged)
   */
  run(module: AsmModule): AsmModule;
}
```

### Optimizer Configuration

```typescript
/**
 * Configuration for the ASM-IL optimizer.
 */
export interface AsmOptimizerConfig {
  /** Enable/disable optimization (false = pass-through) */
  enabled: boolean;
  
  /** List of passes to run in order */
  passes: AsmOptimizationPass[];
  
  /** Maximum iterations for fixed-point optimization */
  maxIterations: number;
  
  /** Enable debug logging */
  debug: boolean;
}

/**
 * Default configuration - pass-through mode.
 */
export const DEFAULT_ASM_OPTIMIZER_CONFIG: AsmOptimizerConfig = {
  enabled: false,
  passes: [],
  maxIterations: 1,
  debug: false
};
```

### Optimization Result

```typescript
/**
 * Result from running the optimizer.
 */
export interface AsmOptimizationResult {
  /** The optimized module */
  module: AsmModule;
  
  /** Whether any transformations were applied */
  changed: boolean;
  
  /** Number of iterations performed */
  iterations: number;
  
  /** Per-pass statistics */
  passStats: Map<string, AsmPassStatistics>;
}

/**
 * Statistics for a single optimization pass.
 */
export interface AsmPassStatistics {
  /** Pass name */
  name: string;
  
  /** Number of transformations applied */
  transformations: number;
  
  /** Execution time in milliseconds */
  timeMs: number;
}
```

---

## Implementation Plan

### File 1: `base-optimizer.ts` (~100 lines)

```typescript
import type { AsmModule } from '../types.js';
import type { AsmOptimizationPass, AsmOptimizerConfig, AsmOptimizationResult } from './types.js';

/**
 * Abstract base class for ASM-IL optimizers.
 * Provides common infrastructure for running optimization passes.
 */
export abstract class BaseAsmOptimizer {
  protected readonly config: AsmOptimizerConfig;
  
  constructor(config: Partial<AsmOptimizerConfig> = {}) {
    this.config = { ...DEFAULT_ASM_OPTIMIZER_CONFIG, ...config };
  }
  
  /**
   * Run all configured optimization passes on the module.
   * @param module - The module to optimize
   * @returns Optimization result with statistics
   */
  abstract optimize(module: AsmModule): AsmOptimizationResult;
  
  /**
   * Check if optimization is enabled.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
  
  /**
   * Get the list of configured passes.
   */
  getPasses(): readonly AsmOptimizationPass[] {
    return this.config.passes;
  }
  
  /**
   * Create a pass-through result (no changes).
   */
  protected createPassThroughResult(module: AsmModule): AsmOptimizationResult {
    return {
      module,
      changed: false,
      iterations: 0,
      passStats: new Map()
    };
  }
}
```

### File 2: `pass-through.ts` (~50 lines)

```typescript
import type { AsmModule } from '../types.js';
import type { AsmOptimizationResult } from './types.js';
import { BaseAsmOptimizer } from './base-optimizer.js';

/**
 * Pass-through optimizer that returns input unchanged.
 * Used when optimization is disabled or as a baseline.
 */
export class PassThroughOptimizer extends BaseAsmOptimizer {
  constructor() {
    super({ enabled: false, passes: [], maxIterations: 1, debug: false });
  }
  
  /**
   * Return the input module unchanged.
   * @param module - The module (returned as-is)
   * @returns Pass-through result
   */
  optimize(module: AsmModule): AsmOptimizationResult {
    return this.createPassThroughResult(module);
  }
}

/**
 * Factory function to create a pass-through optimizer.
 */
export function createPassThroughOptimizer(): PassThroughOptimizer {
  return new PassThroughOptimizer();
}
```

### File 3: `asm-optimizer.ts` (~150 lines)

```typescript
import type { AsmModule } from '../types.js';
import type { 
  AsmOptimizationPass, 
  AsmOptimizerConfig, 
  AsmOptimizationResult,
  AsmPassStatistics 
} from './types.js';
import { BaseAsmOptimizer, DEFAULT_ASM_OPTIMIZER_CONFIG } from './base-optimizer.js';

/**
 * Concrete ASM-IL optimizer with pass manager.
 * Runs configured optimization passes in order.
 */
export class AsmOptimizer extends BaseAsmOptimizer {
  constructor(config: Partial<AsmOptimizerConfig> = {}) {
    super(config);
  }
  
  /**
   * Run all optimization passes on the module.
   * If disabled, returns pass-through result.
   */
  optimize(module: AsmModule): AsmOptimizationResult {
    // Pass-through if disabled
    if (!this.isEnabled()) {
      return this.createPassThroughResult(module);
    }
    
    // Run passes
    const passStats = new Map<string, AsmPassStatistics>();
    let currentModule = module;
    let changed = false;
    let iterations = 0;
    
    for (let i = 0; i < this.config.maxIterations; i++) {
      iterations++;
      let iterationChanged = false;
      
      for (const pass of this.config.passes) {
        const startTime = performance.now();
        const result = pass.run(currentModule);
        const endTime = performance.now();
        
        // Track statistics
        const existing = passStats.get(pass.name);
        const stats: AsmPassStatistics = {
          name: pass.name,
          transformations: (existing?.transformations ?? 0) + (result !== currentModule ? 1 : 0),
          timeMs: (existing?.timeMs ?? 0) + (endTime - startTime)
        };
        passStats.set(pass.name, stats);
        
        // Check if changed
        if (result !== currentModule) {
          currentModule = result;
          iterationChanged = true;
          changed = true;
        }
      }
      
      // Fixed-point: stop if no changes
      if (!iterationChanged) {
        break;
      }
    }
    
    return {
      module: currentModule,
      changed,
      iterations,
      passStats
    };
  }
  
  /**
   * Add an optimization pass to the end of the pass list.
   */
  addPass(pass: AsmOptimizationPass): this {
    this.config.passes.push(pass);
    return this;
  }
  
  /**
   * Enable or disable the optimizer.
   */
  setEnabled(enabled: boolean): this {
    this.config.enabled = enabled;
    return this;
  }
}

/**
 * Factory function to create an optimizer with default config.
 */
export function createAsmOptimizer(config?: Partial<AsmOptimizerConfig>): AsmOptimizer {
  return new AsmOptimizer(config);
}
```

---

## Test Plan (~20 tests)

### Test File: `__tests__/asm-il/optimizer.test.ts`

```typescript
describe('ASM-IL Optimizer', () => {
  describe('PassThroughOptimizer', () => {
    it('should return input module unchanged');
    it('should report changed = false');
    it('should report iterations = 0');
    it('should have empty passStats');
    it('should work with empty module');
    it('should work with module containing instructions');
  });
  
  describe('AsmOptimizer - Disabled', () => {
    it('should return pass-through result when disabled');
    it('should not run any passes when disabled');
    it('should report isEnabled() = false');
  });
  
  describe('AsmOptimizer - Enabled', () => {
    it('should run passes in order');
    it('should track pass statistics');
    it('should detect when module changed');
    it('should stop at fixed-point (no changes)');
    it('should respect maxIterations limit');
    it('should accumulate statistics across iterations');
  });
  
  describe('AsmOptimizer - Configuration', () => {
    it('should accept partial config');
    it('should use defaults for missing config');
    it('should allow adding passes dynamically');
    it('should allow enabling/disabling dynamically');
  });
});
```

---

## Future Optimization Passes (Not in Scope)

These patterns will be implemented later when the pass-through infrastructure is proven:

### Peephole Patterns
- **Dead store elimination**: Remove stores that are immediately overwritten
- **Redundant load elimination**: Remove loads when value is already in register
- **Branch chain collapse**: Simplify `JMP -> JMP` chains
- **Identity operations**: Remove `LDA` followed by `STA` to same location

### Flag-Based Patterns
- **CLC/SEC elimination**: Remove flag sets when not needed
- **Comparison elimination**: Remove CMP when flags already set

---

## Integration Points

### With CodeGenerator
```typescript
// CodeGenerator produces AsmModule
const asmModule = codeGenerator.generate(ilModule);

// Optimizer transforms (or passes through)
const optimizerResult = asmOptimizer.optimize(asmModule);

// Emitter serializes to text
const asmText = emitter.emit(optimizerResult.module);
```

### With Configuration System
```typescript
// From compiler config
const asmOptimizer = createAsmOptimizer({
  enabled: compilerConfig.optimizations.asmIl.enabled,
  maxIterations: compilerConfig.optimizations.asmIl.maxIterations,
  debug: compilerConfig.debug
});
```

---

## Task Checklist

| Task | Description | Status |
|------|-------------|--------|
| 6.1 | Create optimizer types (interfaces) | ⬜ |
| 6.2 | Implement BaseAsmOptimizer | ⬜ |
| 6.3 | Implement PassThroughOptimizer | ⬜ |
| 6.4 | Implement AsmOptimizer with pass manager | ⬜ |
| 6.5 | Write unit tests for all optimizer classes | ⬜ |
| 6.6 | Create index.ts with public exports | ⬜ |