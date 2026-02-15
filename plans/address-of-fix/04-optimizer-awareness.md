# Optimizer Awareness: LOAD_ADDRESS

> **Document**: 04-optimizer-awareness.md
> **Parent**: [Index](00-index.md)

## Overview

The `LOAD_ADDRESS` opcode has ZERO references in the optimizer. Every pass that switches on opcodes must be updated to handle it. `LOAD_ADDRESS` behaves like `LOAD_IMM_WORD` — it loads a known value into A:X without side effects.

## Passes Requiring Updates

### 1. CSE Pass (`cse/cse.ts`) — `modifiesAccumulator()`

`LOAD_ADDRESS` modifies both A and X. Must be added alongside `LOAD_IMM_WORD`:

```typescript
if (opcode === ILOpcode.LOAD_ADDRESS) return true;
```

### 2. Constant Propagation (`constant-prop.ts`)

`LOAD_ADDRESS` is NOT a `LOAD_BYTE` and must not be replaced by `LOAD_IMM`. No special handling needed beyond not misidentifying it. However, verify it's not caught by existing `LOAD_BYTE` checks.

### 3. Copy Propagation (`copy-prop.ts`)

`LOAD_ADDRESS` is not a `LOAD_BYTE` — no replacement needed. Must not be caught by `LOAD_BYTE` pattern matching. Verify existing code doesn't match on it.

### 4. Dead Code Elimination (`dce.ts`)

`LOAD_ADDRESS` produces a value — it's not dead unless its result is unused. Current DCE works on reachability, not value liveness, so no change likely needed. Verify.

### 5. Dead Global Elimination (`dead-global-elim.ts`)

`LOAD_ADDRESS` references a slot (reads the slot's address). This counts as a "reference" to the global — must be included in reference scanning so the global is not eliminated.

**CRITICAL:** Add `LOAD_ADDRESS` to the set of opcodes that count as slot references. Otherwise, `@sprite const balloonData` might be eliminated as "dead" if only accessed via `@`.

### 6. Constant Folding (`constant-fold.ts`)

`LOAD_ADDRESS` is not `LOAD_IMM` — must not be folded. No changes needed unless it's misidentified.

### 7. IL Peephole (`il-peephole.ts`)

`LOAD_ADDRESS` followed by `STORE_BYTE` would be a valid pattern (store low byte of address). No special peephole patterns needed. Verify existing patterns don't misfire.

### 8. LICM (`licm/invariance.ts`)

`LOAD_ADDRESS` is always loop-invariant (the address of a variable never changes). However, like `LOAD_IMM`, it modifies the accumulator and should NOT be hoisted (same reasoning as LOAD_IMM in the existing code). Verify it's excluded by the "no explicit slot reads" rule.

### 9. Function Inlining (`function-inlining.ts`)

`LOAD_ADDRESS` should be cloned normally during inlining. No special handling needed.

## Implementation Strategy

For each pass:
1. Search for existing `LOAD_IMM_WORD` references (LOAD_ADDRESS behaves similarly)
2. Add `LOAD_ADDRESS` alongside `LOAD_IMM_WORD` where appropriate
3. Focus on: `modifiesAccumulator`, `isValueProducingInstruction`, slot reference scanning
