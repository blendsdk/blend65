# Global ZP Allocation Fix

> **Document**: 04-global-zp-allocation.md
> **Parent**: [Index](00-index.md)

## Overview

Default (non-annotated) global variables are currently assigned relative offsets starting from 0 by `allocateRamGlobals()`. These offsets are used as literal addresses, placing globals at ZP addresses $00-$43 where they overlap with SFA function-local variables. The fix routes mutable default globals through the ZpPool (same mechanism as @zp globals) to prevent address conflicts.

## Architecture

### Current Flow (Broken)

```
GlobalAllocator.allocateRamGlobals():
  offset = 0
  SCREEN_BASE → address 0  (const, 2 bytes)
  COLOR_BASE  → address 2  (const, 2 bytes)
  STAR_CHAR   → address 4  (const, 1 byte)
  SPACE_CHAR  → address 5  (const, 1 byte)
  SCREEN_WIDTH→ address 6  (const, 1 byte)  ← overlaps with initStars.i ($06)
  NUM_STARS   → address 7  (const, 1 byte)
  starX       → address 8  (array, 20 bytes) ← overlaps with locals at $08+
  starY       → address 28 ($1C)
  starSpeed   → address 48 ($30)

SFA ZpAllocator (independent, unaware of above):
  clearScreen.i → $02
  initStars.seedX → $03, seedY → $04, speed → $05, i → $06
  eraseStars.y → $07, x → $08, i → $09  ← OVERLAP with starX!
```

### Proposed Flow (Fixed)

```
GlobalAllocator:
  1. Skip const globals with literal initializers (inlined — no address needed)
  2. Route default mutable globals through ZpPool:
     starX    → ZpPool.allocate(20) → $02-$15  (or wherever pool assigns)
     starY    → ZpPool.allocate(20) → $16-$29
     starSpeed→ ZpPool.allocate(20) → $2A-$3D
  3. ZpPool now has globals marked, remaining space available for SFA

FramePhase passes zpPool (with globals) to FrameAllocator:
  SFA locals allocated from REMAINING ZpPool space → NO overlap
```

## Implementation Details

### Change 1: Skip const globals in `collectGlobals()`

Add a check to identify const globals whose initializers are compile-time resolvable. These get collected but marked so they're skipped during allocation:

```typescript
// In collectGlobals() — mark const globals with literal initializers
const canInline = varDecl.isConst() && varDecl.getInitializer() !== null;
```

### Change 2: Filter out inlinable consts before allocation

In `allocate()`, after collection and categorization, filter out const globals with resolvable initializers before passing to allocation methods. They still appear in the global slots map (for the IL generator to find), but with a special marker (e.g., address = -1 or a `constInlined: true` flag).

### Change 3: Route default mutable globals through ZpPool

Modify `allocateRamGlobals()` (or create a new `allocateDefaultGlobals()`) to use `this.zpPool.allocate(size)` for default globals that fit in ZP. This is identical to how `allocateZpGlobals()` works:

```typescript
for (const global of defaultMutableGlobals) {
  // Try ZP first for fast addressing
  const zpResult = this.zpPool.allocate(global.size);
  if (zpResult.success) {
    slot.address = zpResult.address;
    // Storage class stays 'default' but location becomes ZP
  } else {
    // ZP full — fall back to frame region
    slot.address = frameRegionOffset;
    frameRegionOffset += global.size;
  }
}
```

### Change 4: Update `convertAndCacheGlobalSlot()` in IL generator base

For default globals allocated through ZpPool, the slot location should be `SlotLocation.ZeroPage` (not `SlotLocation.FrameRegion`). The conversion logic in `base.ts` should check the actual address:

```typescript
// If address is in ZP range (0-255) and came from ZpPool, use ZP location
const location = (globalSlot.storageClass === 'zp' || globalSlot.address < 256)
  ? SlotLocation.ZeroPage
  : SlotLocation.FrameRegion;
```

## Error Handling

| Error Case | Strategy |
|------------|----------|
| ZP pool full for large arrays | Fall back to frame region allocation |
| Const without resolvable initializer | Treat as mutable (allocate normally) |

## Testing Requirements

- Unit: Const globals not allocated addresses (skipped)
- Unit: Default mutable globals get ZP addresses via ZpPool
- Unit: SFA locals don't overlap with ZpPool-allocated globals
- Integration: GlobalAllocator → FrameAllocator ZP pool flow with defaults
- E2E: sprite-test arrays at non-overlapping addresses
