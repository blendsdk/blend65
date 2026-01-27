# Phase 1.2: Pass Manager

> **Document**: 02-pass-manager.md  
> **Phase**: 1 - Foundation  
> **Est. Time**: ~3 hours  
> **Tests**: ~40 tests

---

## Overview

The **PassManager** is the orchestrator of all optimization passes. It handles:

- Pass registration
- Dependency resolution (topological sort)
- Analysis result caching
- Analysis invalidation when transforms modify IL
- Optimization level filtering

---

## File Location

```
packages/compiler/src/optimizer/pass-manager.ts
```

---

## Type Definitions

### Optimization Result

```typescript
/**
 * Result of running the optimizer on a module
 */
export interface OptimizationResult {
  /** The optimized module */
  module: ILModule;
  
  /** Whether any modifications were made */
  modified: boolean;
  
  /** Statistics about what changed */
  statistics: OptimizationStatistics;
}
```

### Analysis Cache Key

```typescript
/**
 * Key for caching analysis results
 */
type AnalysisCacheKey = `${string}:${string}`; // "analysisName:functionId"
```

---

## PassManager Implementation

```typescript
import type { ILModule, ILFunction } from '../il/index.js';
import type { Pass, AnalysisPass, TransformPass } from './pass.js';
import type { OptimizationOptions, OptimizationLevel } from './options.js';
import { PassKind } from './pass.js';

/**
 * Manages optimization pass execution.
 * 
 * The PassManager orchestrates all optimization passes:
 * - Registers passes by name
 * - Resolves dependencies automatically
 * - Caches analysis results until invalidated
 * - Respects optimization level settings
 * 
 * @example
 * ```typescript
 * const manager = new PassManager({
 *   level: OptimizationLevel.O2,
 * });
 * 
 * manager.registerPass(new UseDefAnalysis());
 * manager.registerPass(new DCEPass());
 * 
 * const result = manager.run(module);
 * ```
 */
export class PassManager {
  /** Registered passes by name */
  protected passes: Map<string, Pass> = new Map();
  
  /** Cached analysis results: "analysisName:funcId" → result */
  protected analysisCache: Map<string, unknown> = new Map();
  
  /** Optimization options */
  protected options: OptimizationOptions;
  
  /** Statistics collector */
  protected statistics: StatisticsCollector;
  
  constructor(options: OptimizationOptions) {
    this.options = options;
    this.statistics = new StatisticsCollector();
  }
  
  /**
   * Register a pass with the manager.
   * 
   * @param pass - The pass to register
   * @throws Error if pass with same name already registered
   */
  registerPass(pass: Pass): void {
    if (this.passes.has(pass.name)) {
      throw new Error(`Pass '${pass.name}' already registered`);
    }
    
    pass.setManager(this);
    this.passes.set(pass.name, pass);
  }
  
  /**
   * Get a registered pass by name.
   * 
   * @param name - Pass name
   * @returns The pass or undefined if not found
   */
  getPass(name: string): Pass | undefined {
    return this.passes.get(name);
  }
  
  /**
   * Get analysis result, running the analysis if needed.
   * 
   * Results are cached until invalidated by a transform pass.
   * 
   * @typeParam T - Expected analysis result type
   * @param name - Analysis pass name
   * @param func - Function to analyze
   * @returns Analysis result
   * @throws Error if analysis not found or not an analysis pass
   */
  getAnalysis<T>(name: string, func: ILFunction): T {
    const cacheKey = `${name}:${func.getId()}`;
    
    // Check cache first
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey) as T;
    }
    
    // Find the analysis pass
    const pass = this.passes.get(name);
    if (!pass) {
      throw new Error(`Analysis '${name}' not registered`);
    }
    if (pass.kind !== PassKind.Analysis) {
      throw new Error(`Pass '${name}' is not an analysis pass`);
    }
    
    // Run analysis and cache result
    const analysisPass = pass as AnalysisPass<T>;
    const result = analysisPass.analyze(func);
    this.analysisCache.set(cacheKey, result);
    
    return result;
  }
  
  /**
   * Run all applicable passes on the module.
   * 
   * Passes are run in dependency order. Only passes enabled
   * for the current optimization level are executed.
   * 
   * @param module - The IL module to optimize
   * @returns Optimization result with statistics
   */
  run(module: ILModule): OptimizationResult {
    let modified = false;
    this.statistics.reset();
    
    // Get passes enabled for current level
    const enabledPasses = this.getEnabledPasses();
    
    // Sort by dependencies
    const orderedPasses = this.sortByDependencies(enabledPasses);
    
    // Run transforms on each function
    for (const func of module.getFunctions()) {
      for (const pass of orderedPasses) {
        if (pass.kind === PassKind.Transform) {
          const transformPass = pass as TransformPass;
          
          this.statistics.beginPass(pass.name);
          const changed = transformPass.transform(func);
          this.statistics.endPass(changed);
          
          if (changed) {
            modified = true;
            this.invalidateAnalyses(pass, func);
          }
        }
      }
    }
    
    return {
      module,
      modified,
      statistics: this.statistics.getStatistics(),
    };
  }
  
  /**
   * Get passes enabled for current optimization level.
   */
  protected getEnabledPasses(): Pass[] {
    const level = this.options.level;
    
    return [...this.passes.values()].filter(pass => {
      // Always include if levels is empty (utility passes)
      if (pass.levels.length === 0) return true;
      
      // Check if enabled for this level
      return pass.levels.includes(level);
    });
  }
  
  /**
   * Sort passes by dependencies using topological sort.
   * 
   * @throws Error if circular dependency detected
   */
  protected sortByDependencies(passes: Pass[]): Pass[] {
    const result: Pass[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const visit = (pass: Pass) => {
      if (visited.has(pass.name)) return;
      
      if (visiting.has(pass.name)) {
        throw new Error(`Circular dependency detected involving '${pass.name}'`);
      }
      
      visiting.add(pass.name);
      
      // Visit dependencies first
      for (const reqName of pass.requires) {
        const reqPass = this.passes.get(reqName);
        if (reqPass && passes.includes(reqPass)) {
          visit(reqPass);
        }
      }
      
      visiting.delete(pass.name);
      visited.add(pass.name);
      result.push(pass);
    };
    
    for (const pass of passes) {
      visit(pass);
    }
    
    return result;
  }
  
  /**
   * Invalidate cached analyses after a transform modifies IL.
   */
  protected invalidateAnalyses(transform: Pass, func: ILFunction): void {
    const funcId = func.getId();
    
    for (const analysisName of transform.invalidates) {
      // Handle wildcard invalidation
      if (analysisName === '*') {
        // Invalidate ALL analyses for this function
        for (const key of this.analysisCache.keys()) {
          if (key.endsWith(`:${funcId}`)) {
            this.analysisCache.delete(key);
          }
        }
      } else if (analysisName === '*cfg*') {
        // Invalidate CFG-dependent analyses
        const cfgDependent = ['dominator-tree', 'loop-info', 'liveness'];
        for (const name of cfgDependent) {
          this.analysisCache.delete(`${name}:${funcId}`);
        }
      } else {
        // Invalidate specific analysis
        this.analysisCache.delete(`${analysisName}:${funcId}`);
      }
    }
  }
  
  /**
   * Clear all cached analysis results.
   */
  clearCache(): void {
    this.analysisCache.clear();
  }
  
  /**
   * Get current optimization options.
   */
  getOptions(): OptimizationOptions {
    return this.options;
  }
}
```

---

## Test Requirements

### Unit Tests (~40 tests)

| Test Category | Tests | Description |
|---------------|-------|-------------|
| Construction | 3 | Create with options |
| Registration | 8 | Register/get passes |
| Analysis caching | 10 | Cache hits/misses |
| Invalidation | 8 | Analysis invalidation |
| Dependencies | 8 | Dependency resolution |
| Level filtering | 3 | Optimization level |

### Test Cases

```typescript
describe('PassManager', () => {
  describe('construction', () => {
    it('should create with options');
    it('should have empty pass registry initially');
    it('should have empty cache initially');
  });
  
  describe('registerPass', () => {
    it('should register a pass');
    it('should throw on duplicate registration');
    it('should set manager reference on pass');
    it('should allow multiple different passes');
  });
  
  describe('getAnalysis', () => {
    it('should run analysis on first call');
    it('should return cached result on second call');
    it('should throw for unknown analysis');
    it('should throw for non-analysis pass');
  });
  
  describe('invalidation', () => {
    it('should clear analysis after transform');
    it('should handle * wildcard invalidation');
    it('should handle *cfg* wildcard');
    it('should only invalidate for modified function');
  });
  
  describe('sortByDependencies', () => {
    it('should sort simple A→B dependency');
    it('should sort A→[B,C] dependencies');
    it('should detect circular dependency');
    it('should handle diamond dependency');
  });
  
  describe('run', () => {
    it('should return modified=false when nothing changes');
    it('should return modified=true when transform changes IL');
    it('should collect statistics');
  });
});
```

---

## Implementation Notes

### Dependency Resolution Algorithm

Uses depth-first topological sort:

```
visit(pass):
  if visited[pass]: return
  if visiting[pass]: CIRCULAR ERROR
  
  visiting[pass] = true
  for each dependency:
    visit(dependency)
  visiting[pass] = false
  visited[pass] = true
  result.push(pass)
```

### Invalidation Strategy

Three invalidation modes:

1. **Specific**: `invalidates: ['liveness']` - Clear one analysis
2. **CFG wildcard**: `invalidates: ['*cfg*']` - Clear CFG-dependent
3. **All wildcard**: `invalidates: ['*']` - Clear everything for function

### Performance Considerations

- Analysis caching avoids redundant computation
- Cache key uses function ID for per-function caching
- Invalidation is targeted (per-function, not global)

---

## Task Checklist

| Task | Status |
|------|--------|
| Create `pass-manager.ts` file | [ ] |
| Implement constructor | [ ] |
| Implement registerPass | [ ] |
| Implement getPass | [ ] |
| Implement getAnalysis with caching | [ ] |
| Implement run method | [ ] |
| Implement sortByDependencies | [ ] |
| Implement invalidateAnalyses | [ ] |
| Add JSDoc to all methods | [ ] |
| Write unit tests (~40) | [ ] |
| Verify 100% coverage | [ ] |

---

**Previous**: [01-pass-classes.md](01-pass-classes.md)  
**Next**: [03-options.md](03-options.md)