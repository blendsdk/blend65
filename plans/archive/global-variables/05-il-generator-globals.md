# IL Generator Globals: Complete "Phase 7c"

> **Document**: 05-il-generator-globals.md
> **Parent**: [Index](00-index.md)

## Overview

Complete the IL generator's global variable support (marked as "Phase 7c" in the codebase). The IL generator must emit proper instructions for global variable initialization and access.

## Current State

### `generator.ts` — `generateGlobalInit()`
Currently a placeholder that collects instructions but doesn't properly handle global scope. Comment: "Full global support will be added in Phase 7c".

### `expressions.ts` — Variable references
When a variable isn't found as a local/parameter slot, it falls through with: "Not a local variable — might be intrinsic or global. Emit placeholder for now."

## Required Changes

### 1. Global Slot Resolution (`base.ts`)

The IL generator's `resolveVariable()` method must check:
1. Current function's local slots (existing)
2. **Module-level global slots** (NEW — from GlobalAllocationResult)
3. Intrinsics (existing)

```typescript
// In ILGeneratorBase, add:
protected globalSlots: Map<string, GlobalSlot>;

protected resolveVariable(name: string): ResolvedVariable {
  // 1. Try local slot
  const local = this.currentFrame?.slots.find(s => s.name === name);
  if (local) return { kind: 'local', slot: local };
  
  // 2. Try global slot (NEW)
  const global = this.globalSlots.get(name);
  if (global) return { kind: 'global', slot: global };
  
  // 3. Try intrinsic
  // ... existing intrinsic resolution
}
```

### 2. Global Variable Initialization (`generator.ts`)

For `@zp` and `@ram` globals with initializers:
```
// @zp let score: word = 0;
LOAD_IMM 0              // Load initial value
STORE_WORD_ADDR $02     // Store to ZP address (from GlobalAllocator)

// @ram let lives: byte = 3;
LOAD_IMM 3              // Load initial value
STORE_BYTE_ADDR $0400   // Store to RAM address
```

For `@data const` globals: **NO initialization IL** (data embedded in binary).

### 3. Global Variable Access (`expressions.ts`)

**Loading a global:**
```
// @zp let score: word = 0;  (at ZP $02)
LOAD_WORD_ADDR $02      // ZP-mode load (2 bytes, fast)

// @ram let buffer: byte[32]; (at RAM $0400)
LOAD_BYTE_ADDR $0400    // Absolute-mode load (3 bytes)
```

**Storing to a global:**
```
// score = score + 10;
LOAD_WORD_ADDR $02      // Load current score
LOAD_IMM 10             // Load 10
ADD                     // Add
STORE_WORD_ADDR $02     // Store back to ZP
```

### 4. New IL Instructions (if needed)

May need new address-mode IL opcodes to distinguish ZP from absolute:
- `LOAD_BYTE_ZP` / `STORE_BYTE_ZP` — ZP addressing
- `LOAD_BYTE_ABS` / `STORE_BYTE_ABS` — absolute addressing

Or use existing `LOAD_BYTE_ADDR`/`STORE_BYTE_ADDR` with address range detection in codegen (address < $100 → ZP mode).

### 5. Constructor Extension

```typescript
// ILGenerator constructor must accept GlobalAllocationResult
constructor(
  frameMap: Map<string, Frame>,
  symbolTable: SymbolTable,
  globalAllocation: GlobalAllocationResult  // NEW
)
```

## Testing Requirements

- Global init IL for @zp, @ram, default globals (~10 tests)
- Global load IL for all storage classes (~10 tests)
- Global store IL for mutable globals (~5 tests)
- @data references (base address only, no init IL) (~5 tests)
- Cross-module global access (~5 tests)
