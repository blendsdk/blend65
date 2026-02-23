# Profitable Inlining at Os/Oz

> **Document**: 04-profitable-inlining.md
> **Parent**: [Index](00-index.md)

## Overview

Os/Oz levels currently skip function inlining entirely, missing optimization opportunities where inlining would actually REDUCE code size. This document specifies a "profitable-only" inlining mode that enables inlining at size levels when the net result is smaller code.

## Problem

### Pipeline Gating Chain

```
function-inline → address-expr-folding (in il-peephole)
                   ↑ folding only fires when LOAD_ADDRESS + SHR_WORD + LO
                     appear in the same function body (requires inlining first)
```

At Os/Oz, `function-inline` is absent from `PROGRAM_LEVEL_PASSES`. This means:
1. Functions like `getSpriteFrame(@data, frame)` remain as separate functions
2. The call site has `LOAD_ADDRESS + STORE_WORD` (argument setup) + `CALL`
3. The callee has `LOAD_WORD + SHR_WORD + LO` (body)
4. The LOAD_ADDRESS and SHR_WORD+LO are in different functions → address-expr folding can't see them
5. Result: full SHR_WORD codegen (36 bytes) instead of LOAD_ADDRESS_EXPR (2 bytes)

### Size Impact

For spinning-line with getSpriteFrame called from 2 sites:
- **Without inlining (Os/Oz):** 2 × (JSR 3B) + function body (~50B) = ~56B
- **With inlining + folding (O3):** 2 × (LOAD_ADDRESS_EXPR 2B + remaining body ~10B) = ~24B
- **Savings:** ~32B — inlining REDUCES size here

## Proposed Changes

### 1. Add `function-inline` to Os/Oz/O1s/O1z/O3s/O3z Program Passes

In `options.ts`, update `PROGRAM_LEVEL_PASSES` for size levels:

```typescript
// BEFORE:
Os: ['dead-function-elim', 'dead-global-elim'],

// AFTER:
Os: ['dead-function-elim', 'dead-global-elim', 'function-inline', 'dead-function-elim'],
```

The second `dead-function-elim` after inlining cleans up fully-inlined functions.

### 2. Add Profitable-Only Mode to Inliner

In `function-inlining.ts`, modify `findCandidates()` to use a stricter strategy at size levels:

**Strategy for size levels:**
- **Single-call-site functions**: ALWAYS inline (always profitable — saves JSR 3B + RTS 1B = 4B)
- **Multi-call-site functions**: Only inline if function size ≤ 4 instructions (roughly equal to JSR+RTS overhead after duplication)

This is simpler than trying to estimate post-optimization savings. Single-call-site inlining is always a win. Multi-call-site inlining at size levels uses a very conservative threshold.

### 3. Implementation in `findCandidates()`

```typescript
// Determine inlining strategy based on level
const allowSmallFunctionInlining = options.level === 'O2' || options.level === 'O3';
const sizeOptimizing = isSizeOptimization(options.level);

// ... for each function:

// Strategy 1: Single-call-site (ALL levels with function-inline)
if (callCount === 1) {
  // Always profitable — add candidate
}

// Strategy 2: Small-function multi-site (O2/O3 only)
if (allowSmallFunctionInlining && callCount > 1 && func.instructions.length <= SMALL_FUNCTION_THRESHOLD) {
  // Add candidates with size budget
}

// Strategy 3: Size-profitable multi-site (Os/Oz)
// Very conservative: only inline tiny functions at multiple sites
if (sizeOptimizing && callCount > 1 && func.instructions.length <= SIZE_PROFITABLE_THRESHOLD) {
  // Add candidates — 4 instructions or fewer
}
```

**New constant:**
```typescript
export const SIZE_PROFITABLE_THRESHOLD = 4;
```

### 4. Pass Ordering

After adding `function-inline` to Os/Oz, the function-level passes already include `il-peephole` at these levels. So the pipeline becomes:

```
Program level:  DFE → DGE → function-inline → DFE
Function level: dce → constant-fold → constant-prop → copy-prop → il-peephole → cse → licm
```

The `il-peephole` will run address-expr folding on the inlined code, folding LOAD_ADDRESS+SHR_WORD+LO into LOAD_ADDRESS_EXPR.

## Testing Requirements

- Unit test: single-call-site function is inlined at Os
- Unit test: multi-call-site function with >4 instructions is NOT inlined at Os
- Unit test: tiny function (≤4 instructions) IS inlined at Os even with multiple call sites
- Integration test: spinning-line at Os produces smaller PRG than without this fix
- Regression test: existing Os/Oz behavior for programs without inlining candidates unchanged
