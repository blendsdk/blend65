# Current State: Size-Opt Duplicate Label Fix

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Root Cause Analysis

### Bug 1: Module-Level `factorCounter` Reset

**File:** `packages/compiler/src/codegen/asm-il/optimizer/passes/size-opt.ts`

**Lines 111, 155-156:**
```typescript
let factorCounter = 0;  // module-level variable

// Inside run():
factorCounter = 0;  // Reset on EVERY run() call
```

**Problem:** The `SizeOptPass.run()` method resets `factorCounter` to 0 on each invocation. When the ASM-IL optimizer iterates (z-levels have `maxIterations: 5`), each iteration resets the counter, so all iterations create `.factored_0`.

**Design intent (line 367):**
> "We only factor one candidate per pass invocation because factoring invalidates element indices for remaining candidates. The optimizer's fixed-point iteration will re-run and find the next candidate."

This design is correct — factor ONE candidate per iteration, let fixed-point iteration find the rest. But the counter reset breaks it.

### Bug 2: Separate `_factored_routines` Sections Per Iteration

**Lines 380-386:**
```typescript
const subroutineSection: AsmILSection = {
  name: '_factored_routines',
  elements: subroutineElements,
};
newSections = [...newSections, subroutineSection];
```

**Problem:** Each call to `applySequenceFactoring()` appends a NEW section named `_factored_routines`. After 5 iterations, there are 5 separate `_factored_routines` sections, each with its own `.factored_0` label.

### Combined Effect

With `maxIterations: 5` (z-levels):

| Iteration | Counter | Label Created | Section Created |
|-----------|---------|---------------|-----------------|
| 1 | reset→0 | `.factored_0` | `_factored_routines` (new) |
| 2 | reset→0 | `.factored_0` | `_factored_routines` (new) |
| 3 | reset→0 | `.factored_0` | `_factored_routines` (new) |
| 4 | reset→0 | `.factored_0` | `_factored_routines` (new) |
| 5 | reset→0 | `.factored_0` | `_factored_routines` (new) |

Result: 5 duplicate `.factored_0` labels across 5 sections → ACME "Symbol already defined".

## Relevant Files

| File | Purpose | Changes Needed |
|------|---------|---------------|
| `passes/size-opt.ts` | SizeOptPass implementation | Fix counter + section merging |
| `__tests__/.../size-opt.test.ts` | SizeOptPass tests | Add multi-iteration test |

## Dependencies

- No external dependencies
- Fix is entirely within the size-opt pass

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Counter change breaks existing factored labels | Low | Medium | JSR references use same counter, so they stay in sync |
| Section merging changes element ordering | Low | Medium | Append new elements to end of existing section |
