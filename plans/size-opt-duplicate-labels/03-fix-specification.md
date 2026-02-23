# Fix Specification: Size-Opt Duplicate Label Fix

> **Document**: 03-fix-specification.md
> **Parent**: [Index](00-index.md)

## Overview

Two changes to `packages/compiler/src/codegen/asm-il/optimizer/passes/size-opt.ts` fix the duplicate label bug.

## Fix 1: Move `factorCounter` to Class Instance Property

### Current (Broken)

```typescript
// Module-level variable
let factorCounter = 0;

export class SizeOptPass implements AsmOptimizationPass {
  run(program: AsmILProgram): AsmOptimizationPassResult {
    // Resets on EVERY run() call → duplicates across iterations
    factorCounter = 0;
    ...
  }
}
```

### Fixed

```typescript
export class SizeOptPass implements AsmOptimizationPass {
  /**
   * Counter for generating unique factored subroutine names.
   * Persists across run() calls so multi-iteration optimization
   * (z-levels) produces unique labels.
   */
  protected factorCounter = 0;

  run(program: AsmILProgram): AsmOptimizationPassResult {
    // NO reset — counter persists across iterations
    ...
  }
}
```

### Why This Works

- The `SizeOptPass` instance is created ONCE per optimizer run (by the pass factory)
- The optimizer calls `run()` multiple times during fixed-point iteration
- The counter persists across `run()` calls, generating unique `.factored_0`, `.factored_1`, etc.
- When a NEW `SizeOptPass` instance is created (new compilation), the counter starts fresh at 0

### Changes Required

1. **Remove** module-level `let factorCounter = 0;` (line 111)
2. **Add** `protected factorCounter = 0;` as class property
3. **Remove** `factorCounter = 0;` reset in `run()` (line 156)
4. **Update** `factorSequence()` to use `this.factorCounter` instead of `factorCounter`

## Fix 2: Merge Into Existing `_factored_routines` Section

### Current (Broken)

```typescript
// ALWAYS creates a new section
const subroutineSection: AsmILSection = {
  name: '_factored_routines',
  elements: subroutineElements,
};
newSections = [...newSections, subroutineSection];
```

### Fixed

```typescript
// Find existing _factored_routines section and merge into it
const existingIdx = newSections.findIndex(s => s.name === '_factored_routines');
if (existingIdx !== -1) {
  // Merge new elements into existing section
  const existing = newSections[existingIdx];
  const merged: AsmILSection = {
    name: '_factored_routines',
    elements: [...existing.elements, ...subroutineElements],
  };
  newSections = [
    ...newSections.slice(0, existingIdx),
    merged,
    ...newSections.slice(existingIdx + 1),
  ];
} else {
  // First factored routine — create new section
  const subroutineSection: AsmILSection = {
    name: '_factored_routines',
    elements: subroutineElements,
  };
  newSections = [...newSections, subroutineSection];
}
```

### Why This Works

- Iteration 1 creates `_factored_routines` with `.factored_0`
- Iteration 2 finds the existing section and MERGES `.factored_1` into it
- Result: single `_factored_routines` section with all factored routines

## Expected Result After Fix

With `maxIterations: 5` (z-levels):

| Iteration | Counter | Label Created | Section |
|-----------|---------|---------------|---------|
| 1 | 0→1 | `.factored_0` | `_factored_routines` (created) |
| 2 | 1→2 | `.factored_1` | `_factored_routines` (merged) |
| 3 | 2→3 | `.factored_2` | `_factored_routines` (merged) |
| 4 | 3→4 | `.factored_3` | `_factored_routines` (merged) |
| 5 | no more candidates | — | — |

Result: single section, unique labels, no ACME errors.

## Error Handling

No new error cases — this fix only ensures existing functionality works correctly across multiple iterations.
