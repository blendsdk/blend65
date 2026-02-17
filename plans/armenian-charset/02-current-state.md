# Current State: Armenian Charset Example

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The Blend65 compiler already supports all features needed for this example:

1. **`@charset` storage class**: Desugars to `@data(align: 2048)` — fully implemented
2. **`@` address-of operator**: Works with division for assembly-time pointer computation
3. **`lo()` intrinsic**: Extracts low byte from word value
4. **`poke()` intrinsic**: Writes bytes to memory addresses
5. **For loops / While loops**: Fully functional for animation
6. **`barrier()` intrinsic**: Prevents optimizer from removing delay loops

### Reference Examples

| Example | Relevant Pattern |
|---------|-----------------|
| `examples/balloon-sprite/main.blend` | `@sprite` + `@` address-of + `lo()` for VIC-II pointer |
| `examples/border-cycle/main.blend` | `delay()` function using nested for loops with `barrier()` |
| `examples/spinning-line/main.blend` | Complex animation with VIC-II register access |
| `examples/lib/print.blend` | Screen memory writing pattern, cursor tracking |

### Key Patterns to Reuse

**From balloon-sprite — VIC-II pointer calculation:**
```js
// Same pattern, but for charset instead of sprite
// Sprite:  poke(SPRITE0_POINTER, lo(@balloonData / 64));
// Charset: we need to set $D018 bits 1-3 to (charset_addr / 2048)
```

**From border-cycle — delay loop:**
```js
function delay(): void {
    for (_outer = 0 to 254) {
        for (_inner = 0 to 254) {
            barrier();
        }
    }
}
```

**From print.blend — screen memory access:**
```js
// Screen address calculation: $0400 + (row * 40) + col
// Color RAM: $D800 + (row * 40) + col
poke(screenAddr, characterCode);
poke(colorAddr, colorValue);
```

## Gaps Identified

### Gap 1: No Existing Charset Example

**Current Behavior:** No example uses `@charset` yet
**Required Behavior:** Need a working `@charset` example
**Fix Required:** Create the armenian-charset example

### Gap 2: No Custom Font Data

**Current Behavior:** All examples use the C64 default ROM character set
**Required Behavior:** Need hand-crafted 8×8 Armenian letter bitmaps
**Fix Required:** Design 38 Armenian glyphs as pixel art

### Gap 3: VIC-II `$D018` Charset Switching

**Current Behavior:** No example switches the character generator
**Required Behavior:** Need to modify `$D018` to point to custom charset
**Fix Required:** Calculate correct `$D018` value and apply it

## Dependencies

### Internal Dependencies

- Blend65 compiler (already built and working)
- `@charset` / `@data(align: 2048)` support (already implemented)
- `@` address-of operator (already implemented)
- `poke()`, `lo()`, `barrier()` intrinsics (already implemented)

### External Dependencies

- ACME assembler (for final assembly, already installed)
- `diag_app.sh` script (for verification, already exists)

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Armenian glyphs unreadable at 8×8 | Medium | Medium | Careful pixel art design; uppercase only |
| Large `@charset` array exceeds compiler limits | Low | High | Compiler handles 2048-byte arrays in other tests |
| `$D018` value calculation wrong | Low | High | Follow well-documented C64 VIC-II patterns |
| Snake animation too fast/slow | Low | Low | Adjust delay loop iterations |
