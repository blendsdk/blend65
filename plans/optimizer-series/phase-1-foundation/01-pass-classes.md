# Phase 1.1: Pass Base Classes

> **Document**: 01-pass-classes.md  
> **Phase**: 1 - Foundation  
> **Est. Time**: ~2 hours  
> **Tests**: ~30 tests

---

## Overview

This document specifies the **Pass base class hierarchy** - the foundation for all optimization passes. Every analysis and transformation inherits from these base classes.

---

## File Location

```
packages/compiler/src/optimizer/pass.ts
```

---

## Type Definitions

### PassKind Enum

```typescript
/**
 * Classification of optimization passes
 */
export enum PassKind {
  /** Analysis passes read IL but don't modify it */
  Analysis = 'analysis',
  
  /** Transform passes modify IL */
  Transform = 'transform',
  
  /** Utility passes for debugging/printing */
  Utility = 'utility',
}
```

### Pass Interface

```typescript
/**
 * Information about a pass for registration
 */
export interface PassInfo {
  /** Unique pass identifier */
  readonly name: string;
  
  /** What kind of pass this is */
  readonly kind: PassKind;
  
  /** Passes that must run before this one */
  readonly requires: readonly string[];
  
  /** Analyses this pass invalidates when it runs */
  readonly invalidates: readonly string[];
  
  /** Optimization levels where this pass is enabled */
  readonly levels: readonly OptimizationLevel[];
}
```

---

## Base Classes

### Abstract Pass Class

```typescript
import type { ILFunction } from '../il/index.js';
import type { OptimizationLevel } from './options.js';

/**
 * Abstract base class for all optimization passes.
 * 
 * Passes are the building blocks of the optimizer. Each pass
 * performs a specific analysis or transformation on IL code.
 * 
 * @example
 * ```typescript
 * class MyPass extends TransformPass {
 *   readonly name = 'my-pass';
 *   readonly requires = ['use-def'];
 *   readonly invalidates = ['liveness'];
 *   readonly levels = [O1, O2, O3];
 *   
 *   transform(func: ILFunction): boolean {
 *     // ... transformation logic
 *     return changed;
 *   }
 * }
 * ```
 */
export abstract class Pass implements PassInfo {
  /** Unique name identifying this pass */
  abstract readonly name: string;
  
  /** Kind of pass (analysis, transform, utility) */
  abstract readonly kind: PassKind;
  
  /** Passes this pass requires to run first */
  readonly requires: readonly string[] = [];
  
  /** Analyses this pass invalidates when it modifies IL */
  readonly invalidates: readonly string[] = [];
  
  /** Optimization levels where this pass is enabled */
  readonly levels: readonly OptimizationLevel[] = [];
  
  /** Reference to pass manager (set during registration) */
  protected manager: PassManager | null = null;
  
  /**
   * Set the pass manager reference.
   * Called by PassManager during registration.
   */
  setManager(manager: PassManager): void {
    this.manager = manager;
  }
  
  /**
   * Get analysis result from the pass manager.
   * Helper method for accessing required analyses.
   */
  protected getAnalysis<T>(name: string, func: ILFunction): T {
    if (!this.manager) {
      throw new Error(`Pass ${this.name} not registered with PassManager`);
    }
    return this.manager.getAnalysis<T>(name, func);
  }
}
```

### AnalysisPass Class

```typescript
/**
 * Base class for analysis passes.
 * 
 * Analysis passes examine IL code and produce results but do NOT
 * modify the IL. Results are cached and reused until invalidated.
 * 
 * @typeParam T - The type of analysis result produced
 * 
 * @example
 * ```typescript
 * interface UseDefInfo {
 *   getUseCount(value: ILValue): number;
 *   isUnused(value: ILValue): boolean;
 * }
 * 
 * class UseDefAnalysis extends AnalysisPass<UseDefInfo> {
 *   readonly name = 'use-def';
 *   
 *   analyze(func: ILFunction): UseDefInfo {
 *     // Compute use-def information
 *     return { getUseCount, isUnused };
 *   }
 * }
 * ```
 */
export abstract class AnalysisPass<T = unknown> extends Pass {
  readonly kind = PassKind.Analysis;
  
  // Analysis passes never invalidate anything (they don't modify IL)
  readonly invalidates: readonly string[] = [];
  
  /**
   * Run analysis on a function and return the result.
   * 
   * @param func - The function to analyze
   * @returns Analysis result of type T
   */
  abstract analyze(func: ILFunction): T;
}
```

### TransformPass Class

```typescript
/**
 * Base class for transformation passes.
 * 
 * Transform passes modify IL code. They return true if any
 * modification was made, which triggers invalidation of
 * dependent analyses.
 * 
 * @example
 * ```typescript
 * class DCEPass extends TransformPass {
 *   readonly name = 'dce';
 *   readonly requires = ['use-def'];
 *   readonly invalidates = ['liveness'];
 *   readonly levels = [O1, O2, O3];
 *   
 *   transform(func: ILFunction): boolean {
 *     const useDef = this.getAnalysis<UseDefInfo>('use-def', func);
 *     let changed = false;
 *     // ... remove dead code
 *     return changed;
 *   }
 * }
 * ```
 */
export abstract class TransformPass extends Pass {
  readonly kind = PassKind.Transform;
  
  /**
   * Transform a function's IL.
   * 
   * @param func - The function to transform
   * @returns true if any modification was made, false otherwise
   */
  abstract transform(func: ILFunction): boolean;
}
```

### UtilityPass Class

```typescript
/**
 * Base class for utility passes.
 * 
 * Utility passes don't analyze or transform - they provide
 * debugging/printing/validation functionality.
 * 
 * @example
 * ```typescript
 * class ILPrinterPass extends UtilityPass {
 *   readonly name = 'il-printer';
 *   
 *   execute(func: ILFunction): void {
 *     console.log(func.toString());
 *   }
 * }
 * ```
 */
export abstract class UtilityPass extends Pass {
  readonly kind = PassKind.Utility;
  readonly requires: readonly string[] = [];
  readonly invalidates: readonly string[] = [];
  
  /**
   * Execute utility function.
   * 
   * @param func - The function to process
   */
  abstract execute(func: ILFunction): void;
}
```

---

## Test Requirements

### Unit Tests (~30 tests)

| Test Category | Tests | Description |
|---------------|-------|-------------|
| PassKind enum | 3 | Verify enum values exist |
| Pass base | 8 | Abstract class behavior |
| AnalysisPass | 8 | Analysis contract |
| TransformPass | 8 | Transform contract |
| UtilityPass | 3 | Utility contract |

### Test Cases

```typescript
describe('PassKind', () => {
  it('should have Analysis value');
  it('should have Transform value');
  it('should have Utility value');
});

describe('Pass', () => {
  it('should have default empty requires array');
  it('should have default empty invalidates array');
  it('should have default empty levels array');
  it('should allow setting manager reference');
  it('should throw if getAnalysis called without manager');
  it('should delegate getAnalysis to manager');
});

describe('AnalysisPass', () => {
  it('should have Analysis kind');
  it('should enforce empty invalidates');
  it('should require analyze method implementation');
  it('should return analysis result');
});

describe('TransformPass', () => {
  it('should have Transform kind');
  it('should require transform method implementation');
  it('should return boolean indicating change');
});

describe('UtilityPass', () => {
  it('should have Utility kind');
  it('should require execute method implementation');
});
```

---

## Implementation Notes

### Design Decisions

1. **Abstract classes vs interfaces**: Using abstract classes to provide default implementations and enforce contracts.

2. **Generic AnalysisPass<T>**: The type parameter allows type-safe analysis results without casting.

3. **Protected getAnalysis helper**: Simplifies accessing required analyses from transform passes.

4. **Readonly arrays**: Using `readonly string[]` for immutable pass metadata.

### Integration with PassManager

The `setManager()` method is called by PassManager during registration:

```typescript
// In PassManager
registerPass(pass: Pass): void {
  pass.setManager(this);
  this.passes.set(pass.name, pass);
}
```

---

## Exports

```typescript
// packages/compiler/src/optimizer/pass.ts

export { PassKind } from './pass.js';
export type { PassInfo } from './pass.js';
export { Pass, AnalysisPass, TransformPass, UtilityPass } from './pass.js';
```

---

## Task Checklist

| Task | Status |
|------|--------|
| Create `pass.ts` file | [ ] |
| Implement PassKind enum | [ ] |
| Implement Pass abstract class | [ ] |
| Implement AnalysisPass class | [ ] |
| Implement TransformPass class | [ ] |
| Implement UtilityPass class | [ ] |
| Add JSDoc to all exports | [ ] |
| Write unit tests (~30) | [ ] |
| Verify 100% coverage | [ ] |

---

**Previous**: [00-phase-index.md](00-phase-index.md)  
**Next**: [02-pass-manager.md](02-pass-manager.md)