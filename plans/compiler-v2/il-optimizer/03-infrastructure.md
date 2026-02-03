# Infrastructure: IL Optimizer

> **Document**: 03-infrastructure.md
> **Parent**: [Index](00-index.md)

## Overview

The optimizer infrastructure provides the foundation for running optimization passes. It includes the pass manager, optimization options, and integration with the existing IL analysis.

## Architecture

```
ILFunction (from IL Generator)
         ↓
┌────────────────────────┐
│    OptimizationOptions │
│    - level: O0..Oz     │
│    - passes: string[]  │
│    - debug: boolean    │
└────────────────────────┘
         ↓
┌────────────────────────┐
│      PassManager       │
│    - registerPass()    │
│    - runPasses()       │
│    - getStats()        │
└────────────────────────┘
         ↓
    ┌────┬────┬────┐
    │DCE │Fold│Prop│ ... passes
    └────┴────┴────┘
         ↓
Optimized ILFunction (to CodeGen)
```

## Implementation Details

### Optimization Options

```typescript
// optimizer/options.ts

export type OptimizationLevel = 'O0' | 'O1' | 'O2' | 'O3' | 'Os' | 'Oz';

export interface OptimizationOptions {
  /** Optimization level */
  level: OptimizationLevel;
  
  /** Explicitly enabled passes (overrides level defaults) */
  enabledPasses?: string[];
  
  /** Explicitly disabled passes */
  disabledPasses?: string[];
  
  /** Enable debug output */
  debug?: boolean;
  
  /** Maximum iterations for fixed-point passes */
  maxIterations?: number;
}

export function getDefaultOptions(): OptimizationOptions {
  return { level: 'O2', debug: false, maxIterations: 10 };
}

/** Get passes enabled for a given level */
export function getPassesForLevel(level: OptimizationLevel): string[] {
  switch (level) {
    case 'O0': return [];
    case 'O1': return ['dce', 'constant-fold'];
    case 'O2': return ['dce', 'constant-fold', 'constant-prop', 'copy-prop', 'il-peephole'];
    case 'O3': return ['dce', 'constant-fold', 'constant-prop', 'copy-prop', 'il-peephole']; // + iterations
    case 'Os': return ['dce', 'constant-fold', 'constant-prop', 'copy-prop', 'il-peephole'];
    case 'Oz': return ['dce', 'constant-fold', 'constant-prop', 'copy-prop', 'il-peephole']; // + iterations
  }
}
```

### Pass Interface

```typescript
// optimizer/pass.ts

export interface OptimizationPass {
  /** Unique pass name */
  name: string;
  
  /** Pass dependencies (must run before this pass) */
  dependencies: string[];
  
  /** Run the pass on a function */
  run(func: ILFunction, options: OptimizationOptions): PassResult;
}

export interface PassResult {
  /** Was any modification made? */
  modified: boolean;
  
  /** Instructions removed */
  instructionsRemoved: number;
  
  /** Instructions added */
  instructionsAdded: number;
  
  /** Debug info */
  debugInfo?: string[];
}
```

### Pass Manager

```typescript
// optimizer/pass-manager.ts

export class PassManager {
  protected passes: Map<string, OptimizationPass> = new Map();
  protected options: OptimizationOptions;

  constructor(options: OptimizationOptions = getDefaultOptions()) {
    this.options = options;
    this.registerDefaultPasses();
  }

  /** Register a pass */
  registerPass(pass: OptimizationPass): void {
    this.passes.set(pass.name, pass);
  }

  /** Get ordered passes based on options and dependencies */
  protected getOrderedPasses(): OptimizationPass[] {
    const enabledNames = this.getEnabledPassNames();
    const ordered: OptimizationPass[] = [];
    const visited = new Set<string>();

    const visit = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);
      
      const pass = this.passes.get(name);
      if (!pass) return;
      
      // Visit dependencies first
      for (const dep of pass.dependencies) {
        visit(dep);
      }
      
      ordered.push(pass);
    };

    for (const name of enabledNames) {
      visit(name);
    }

    return ordered;
  }

  /** Run all enabled passes on a function */
  optimize(func: ILFunction): OptimizationResult {
    if (this.options.level === 'O0') {
      return { modified: false, stats: [] };
    }

    const passes = this.getOrderedPasses();
    const stats: PassStats[] = [];
    let anyModified = false;
    let iterations = 0;
    const maxIter = this.options.maxIterations ?? 1;
    const shouldIterate = this.options.level === 'O3' || this.options.level === 'Oz';

    do {
      let iterModified = false;
      iterations++;

      for (const pass of passes) {
        // Re-run analysis before each pass
        runAnalysisPasses(func);

        const before = func.instructions.length;
        const result = pass.run(func, this.options);
        
        if (result.modified) {
          iterModified = true;
          anyModified = true;
        }

        stats.push({
          pass: pass.name,
          iteration: iterations,
          instructionsBefore: before,
          instructionsAfter: func.instructions.length,
          modified: result.modified,
        });

        if (this.options.debug) {
          console.log(`[${pass.name}] ${result.instructionsRemoved} removed, ${result.instructionsAdded} added`);
        }
      }

      if (!iterModified || !shouldIterate) break;
    } while (iterations < maxIter);

    return { modified: anyModified, stats };
  }
}
```

### IL Optimizer Entry Point

```typescript
// optimizer/il-optimizer.ts

export class ILOptimizer {
  protected passManager: PassManager;

  constructor(options?: OptimizationOptions) {
    this.passManager = new PassManager(options);
  }

  /** Optimize a single function */
  optimizeFunction(func: ILFunction): ILFunction {
    this.passManager.optimize(func);
    return func;
  }

  /** Optimize all functions in a program */
  optimizeProgram(program: ILProgram): ILProgram {
    for (const func of program.functions) {
      this.optimizeFunction(func);
    }
    return program;
  }
}
```

## Integration Points

### Integration with IL Generator

```typescript
// In compiler pipeline:
const ilProgram = ilGenerator.generate(ast, frames);

// NEW: Optimize IL
const optimizer = new ILOptimizer({ level: 'O2' });
const optimizedIL = optimizer.optimizeProgram(ilProgram);

// Then code generation
const asm = codeGenerator.generate(optimizedIL);
```

### Integration with Existing Analysis

```typescript
// Each pass can use existing analysis:
import { computeLiveRanges, isDeadStore, computeHints } from '../il/analysis.js';

class DCEPass implements OptimizationPass {
  run(func: ILFunction): PassResult {
    // Use existing analysis
    computeLiveRanges(func);
    
    // Now isDeadStore() works
    const toRemove: number[] = [];
    for (let i = 0; i < func.instructions.length; i++) {
      if (isDeadStore(func.instructions[i])) {
        toRemove.push(i);
      }
    }
    // ... remove dead stores
  }
}
```

## Testing Requirements

- Unit tests for PassManager
- Unit tests for OptimizationOptions
- Integration tests for pass ordering
- Tests for each optimization level

## Files to Create

| File | Description |
|------|-------------|
| `optimizer/options.ts` | OptimizationOptions, level helpers |
| `optimizer/pass.ts` | Pass interface, PassResult |
| `optimizer/pass-manager.ts` | PassManager class |
| `optimizer/il-optimizer.ts` | Main ILOptimizer class |
| `optimizer/index.ts` | Module exports |
| `__tests__/optimizer/infrastructure.test.ts` | Infrastructure tests |

## Related Documents

| Document | Description |
|----------|-------------|
| [02-current-state.md](02-current-state.md) | Existing analysis |
| [04-dce.md](04-dce.md) | First pass implementation |