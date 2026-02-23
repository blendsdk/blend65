# Diagnosis: Address-Of Operator Fix

> **Document**: 03-diagnosis.md
> **Parent**: [Index](00-index.md)

## Overview

This phase creates a debug script to dump the IL instructions for the balloon-sprite `main()` function, confirming whether `LOAD_ADDRESS` is emitted or not.

## Diagnosis Script

Create `scripts/debug-address-of.ts` that:

1. Compiles `examples/balloon-sprite/main.blend` through the full pipeline
2. Dumps the IL instructions for the `main` function
3. Checks if `LOAD_ADDRESS` opcode appears in the IL
4. If NOT: confirms the IL generator is the root cause
5. If YES: confirms the optimizer is the root cause (removing or replacing it)

### Expected Output (if IL generator is broken)

```
IL for main():
  LOAD_BYTE balloonData        ← WRONG! Should be LOAD_ADDRESS
  HI
  STORE_BYTE $FE
  LOAD_IMM 4
  ...
```

### Expected Output (if optimizer is broken)

```
IL for main() (pre-optimizer):
  LOAD_ADDRESS balloonData     ← CORRECT in IL
IL for main() (post-optimizer):
  LOAD_BYTE balloonData        ← Optimizer replaced it!
```

## Root Cause Hypotheses

### Hypothesis A: `tryResolveVariable('balloonData')` returns undefined (MOST LIKELY)

**Why:** The `@sprite const balloonData` is a module-level constant with an array initializer. The `generateIdentifier` method (which IS being called based on the assembly comment `; load balloonData`) has special handling for constants:

```typescript
// In generateIdentifier():
const symbol = this.symbolTable.lookupGlobal(name);
if (symbol && symbol.isConst && symbol.initializer) {
  const resolvedValue = this.tryResolveConstantAddress(symbol.initializer);
  // Array initializer → returns undefined → falls through to tryResolveVariable
}
const slot = this.tryResolveVariable(name);
// This succeeds → emits LOAD_BYTE
```

But in `generateAddressOf()`, the flow is different:
```typescript
const slot = this.tryResolveVariable(name);
if (!slot) {
  this.builder.nop();  // ← Falls through silently
  return;
}
this.builder.loadAddress(slot, `@${name}`);
```

**Key question:** Does `tryResolveVariable('balloonData')` work differently when called from `generateAddressOf` vs `generateIdentifier`? They call the same method, so it should work. Unless the issue is that `generateAddressOf` is never reached at all.

### Hypothesis B: `generateAddressOf` is never called

**Why:** If the semantic analyzer or some AST transformation replaces `UnaryExpression(AT, Ident)` with just `Ident` before the IL generator sees it, then `generateIdentifier` would be called directly (matching the `; load balloonData` comment).

**How to verify:** The IL dump script will show whether LOAD_ADDRESS or LOAD_BYTE is emitted.

### Hypothesis C: Optimizer replaces LOAD_ADDRESS with LOAD_BYTE

**Why:** The optimizer has zero knowledge of LOAD_ADDRESS. Constant propagation looks for `LOAD_BYTE` patterns. If the optimizer treats an unknown opcode as something to replace, this could happen.

**How to verify:** Compare pre-optimizer and post-optimizer IL dumps.

## Implementation

### Task 3.1: Create debug script

```typescript
// scripts/debug-address-of.ts
// 1. Use compiler pipeline to compile balloon-sprite
// 2. Intercept IL output before and after optimization
// 3. Print all IL instructions for main() function
// 4. Check for LOAD_ADDRESS opcode
```

### Task 3.2: Run diagnosis and update this document with findings

After running the debug script, update this document with:
- Which hypothesis is confirmed
- Exact location of the bug
- Specific fix needed
