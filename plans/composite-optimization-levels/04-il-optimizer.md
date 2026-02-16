# IL Optimizer: Composite Optimization Levels

> **Document**: 04-il-optimizer.md
> **Parent**: [Index](00-index.md)

## Overview

The IL optimizer uses string-based `OptimizationLevel` type and two `Record` maps
(`LEVEL_PASSES` and `PROGRAM_LEVEL_PASSES`) to configure passes per level.

## File: `packages/compiler/src/optimizer/options.ts`

### Type Change

**Current:**
```typescript
export type OptimizationLevel = 'O0' | 'O1' | 'O2' | 'O3' | 'Os' | 'Oz';
```

**New:**
```typescript
export type OptimizationLevel = 'O0' | 'O1' | 'O1s' | 'O1z' | 'O2' | 'Os' | 'Oz' | 'O3' | 'O3s' | 'O3z';
```

### Function-Level Pass Map

Add 4 new entries to `LEVEL_PASSES`. The rule:
- **Base determines which passes are available** (O1 = basic, O2+ = all)
- **Size modifier removes loop-unroll** (increases size)

```typescript
const LEVEL_PASSES: Record<OptimizationLevel, string[]> = {
  O0: [],
  O1: ['dce', 'constant-fold'],
  O1s: ['dce', 'constant-fold'],  // Same as O1 (no loop-unroll to remove)
  O1z: ['dce', 'constant-fold'],  // Same as O1 + iterations
  O2: ['dce', 'constant-fold', 'constant-prop', 'copy-prop', 'il-peephole', 'cse', 'licm', 'loop-unroll'],
  Os: ['dce', 'constant-fold', 'constant-prop', 'copy-prop', 'il-peephole', 'cse', 'licm'],
  Oz: ['dce', 'constant-fold', 'constant-prop', 'copy-prop', 'il-peephole', 'cse', 'licm'],
  O3: ['dce', 'constant-fold', 'constant-prop', 'copy-prop', 'il-peephole', 'cse', 'licm', 'loop-unroll'],
  O3s: ['dce', 'constant-fold', 'constant-prop', 'copy-prop', 'il-peephole', 'cse', 'licm'],  // O3 passes minus loop-unroll
  O3z: ['dce', 'constant-fold', 'constant-prop', 'copy-prop', 'il-peephole', 'cse', 'licm'],  // O3 passes minus loop-unroll + iterations
};
```

### Program-Level Pass Map

Size modifier disables function-inline (increases size). O1s has dead-global-elim
since it's a size-reduction pass.

```typescript
const PROGRAM_LEVEL_PASSES: Record<OptimizationLevel, string[]> = {
  O0: [],
  O1: ['dead-function-elim', 'function-inline', 'dead-function-elim'],
  O1s: ['dead-function-elim', 'dead-global-elim'],  // No inlining (size goal)
  O1z: ['dead-function-elim', 'dead-global-elim'],  // No inlining + iterations
  O2: ['dead-function-elim', 'dead-global-elim', 'function-inline', 'dead-function-elim'],
  Os: ['dead-function-elim', 'dead-global-elim'],
  Oz: ['dead-function-elim', 'dead-global-elim'],
  O3: ['dead-function-elim', 'dead-global-elim', 'function-inline', 'dead-function-elim'],
  O3s: ['dead-function-elim', 'dead-global-elim'],  // No inlining (size goal)
  O3z: ['dead-function-elim', 'dead-global-elim'],  // No inlining + iterations
};
```

### Iteration/Size Helper Updates

**`shouldIterate()`** — z suffix means multi-iteration:
```typescript
export function shouldIterate(level: OptimizationLevel): boolean {
  return level === 'O3' || level === 'Oz' || level === 'O1z' || level === 'O3z';
}
```

**`isSizeOptimization()`** — any s/z suffix:
```typescript
export function isSizeOptimization(level: OptimizationLevel): boolean {
  return level === 'Os' || level === 'Oz' ||
         level === 'O1s' || level === 'O1z' ||
         level === 'O3s' || level === 'O3z';
}
```

## Complete Pass Matrix (10 levels)

### Function Passes

| Pass | O0 | O1 | O1s | O1z | O2 | Os | Oz | O3 | O3s | O3z |
|------|----|----|-----|-----|----|----|----|----|-----|-----|
| dce | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| constant-fold | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| constant-prop | - | - | - | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| copy-prop | - | - | - | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| il-peephole | - | - | - | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| cse | - | - | - | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| licm | - | - | - | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| loop-unroll | - | - | - | - | ✓ | - | - | ✓ | - | - |
| **Iterates** | - | - | - | ✓ | - | - | ✓ | ✓ | - | ✓ |

### Program Passes

| Pass | O0 | O1 | O1s | O1z | O2 | Os | Oz | O3 | O3s | O3z |
|------|----|----|-----|-----|----|----|----|----|-----|-----|
| dead-function-elim | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| dead-global-elim | - | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| function-inline | - | ✓ | - | - | ✓ | - | - | ✓ | - | - |

## Testing Requirements

- Verify `getPassesForLevel()` returns correct passes for each of 10 levels
- Verify `getProgramPassesForLevel()` returns correct passes for each of 10 levels
- Verify `shouldIterate()` for all 10 levels
- Verify `isSizeOptimization()` for all 10 levels
