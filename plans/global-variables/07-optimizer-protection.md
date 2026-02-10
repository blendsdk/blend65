# Optimizer Protection: @zp and @data Globals

> **Document**: 07-optimizer-protection.md
> **Parent**: [Index](00-index.md)

## Overview

`@zp` and `@data` global variables must be protected from optimizer passes that could eliminate or reorder them. This document defines the protection rules and required changes to existing optimizer passes.

## Protection Rules

### `@zp` Globals: Pinned + Volatile

| Rule | Rationale |
|------|-----------|
| Never eliminate initialization | Developer explicitly placed in ZP |
| Never cache reads across statements | May be modified by interrupt handler |
| Never reorder reads/writes | Memory ordering matters for hardware |
| Never dead-store-eliminate writes | Write may be observed by interrupt |

### `@data` Globals: Pinned + Immutable

| Rule | Rationale |
|------|-----------|
| Never eliminate data block | Data is needed at runtime |
| Reads CAN be cached/CSE'd | Data is `const` — never changes |
| Reads CAN be hoisted (LICM) | Data is `const` — loop-invariant |
| No writes possible | `const` enforced by semantic analyzer |

### `@ram` / Default Globals: Standard Optimization

| Rule | Rationale |
|------|-----------|
| Dead global elimination OK | If unused, can be removed |
| CSE of reads OK | Compiler-managed memory |
| LICM of reads OK | Compiler-managed memory |
| Dead store elimination OK | If result unused, can remove |

## Required Changes to Existing Optimizer Passes

### 1. `DeadGlobalElimPass` (already implemented in optimizer-v2)

**File**: `optimizer/passes/dead-global-elim.ts`

Add storage class check before eliminating:

```typescript
// In findDeadGlobalSlots(), add:
// Skip @zp and @data globals — they're pinned
if (slot.storageClass === 'zp' || slot.storageClass === 'data') {
  continue; // Never eliminate
}
```

### 2. `CSEPass` (already implemented in optimizer-v2)

**File**: `optimizer/passes/cse.ts`

Add volatility check for `@zp` globals:

```typescript
// When tracking expressions involving global loads:
if (isGlobalLoad(instr) && isVolatileGlobal(instr.operands[0])) {
  // Don't cache @zp global reads — they could change between statements
  invalidateExpression(exprKey);
}
// @data globals CAN be cached (they're const)
```

### 3. `LICMPass` (planned in optimizer-v2 Phase 4.2)

**File**: `optimizer/passes/licm.ts`

Add volatility check:

```typescript
// In isInvariant():
if (isGlobalLoad(instr) && isVolatileGlobal(instr.operands[0])) {
  return false; // @zp globals are NOT loop-invariant (interrupt could change)
}
// @data globals ARE loop-invariant (const)
```

### 4. Future Dead Store Elimination (not yet implemented)

When DSE is implemented, it must respect `@zp` volatility:
- Never eliminate stores to `@zp` globals
- Stores to `@ram`/default globals can be eliminated if provably dead

## IL Metadata for Volatility

Global IL instructions need a volatility flag:

```typescript
interface ILInstruction {
  // ... existing fields
  isVolatile?: boolean;  // NEW: true for @zp global access
}
```

The IL generator sets `isVolatile = true` for any load/store targeting a `@zp` global. Optimizer passes check this flag before optimizing.

## Testing Requirements

- Dead global elim skips @zp globals (~5 tests)
- Dead global elim skips @data globals (~5 tests)
- Dead global elim still removes unused @ram globals (~3 tests)
- CSE doesn't cache @zp global reads (~5 tests)
- CSE CAN cache @data reads (~3 tests)
- Volatile flag propagation in IL (~5 tests)
