# Example Update: Multi-Frame Sprite Sheet + getSpriteFrame()

> **Document**: 05-example-update.md
> **Parent**: [Index](00-index.md)

## Overview

Update `examples/spinning-line/main.blend` to use a single multi-frame `@sprite`
variable and a `getSpriteFrame()` library-style function. This matches how real-world
C64 sprite editors export data and proves the compiler can handle sprite utility libraries.

## Current vs Target

### Current: 4 Separate @sprite Variables

```js
@sprite const lineVertical: byte[] = [63 bytes...];
@sprite const lineSlash: byte[] = [63 bytes...];
@sprite const lineHorizontal: byte[] = [63 bytes...];
@sprite const lineBackslash: byte[] = [63 bytes...];

function setAnimationFrame(frame: byte): void {
    if (frame == 0) { poke(PTR, lo(@lineVertical / 64)); }
    if (frame == 1) { poke(PTR, lo(@lineSlash / 64)); }
    // ... if-else chain for each frame
}
```

**Problems**:
- 4 separate `!align 63, 0` directives (up to 252 wasted bytes)
- if-else chain for frame selection (O(n) with frame count)
- Doesn't match sprite editor export format
- Can't scale to many frames

### Target: Single Multi-Frame @sprite

```js
@sprite const lineFrames: byte[] = [
    // Frame 0: | (64 bytes: 63 data + 1 padding)
    $00, $18, $00, ... $00,
    // Frame 1: / (64 bytes)
    $00, $00, $06, ... $00,
    // Frame 2: - (64 bytes)
    $00, $00, $00, ... $00,
    // Frame 3: \ (64 bytes)
    $60, $00, $00, ... $00
];

function getSpriteFrame(spriteAddr: word, frameIndex: byte): byte {
    return lo(spriteAddr / 64) + frameIndex;
}

// Usage:
poke(SPRITE0_POINTER, getSpriteFrame(@lineFrames, frame));
```

**Benefits**:
- Single `!align 63, 0` directive (saves up to 189 bytes)
- O(1) frame selection via pointer arithmetic
- Matches SpritePad/Spritemate export format
- Scales to any number of frames

## Multi-Frame Sprite Data Layout

### VIC-II Sprite Memory Model

The VIC-II reads sprite data from 64-byte blocks. The sprite pointer at `$07F8+n`
contains the block number: `pointer = data_address / 64`.

For multi-frame sprites stored contiguously:
```
Address:  base   base+64  base+128  base+192
Frame:    0      1        2         3
Pointer:  P      P+1      P+2       P+3
```

Where `P = base / 64`. So: `pointer_for_frame_N = P + N`.

### 64-Byte Frame Alignment

**Critical**: Each frame must be exactly **64 bytes**, not 63! The VIC-II uses 63 bytes
of sprite data per frame, but the block size is 64. The 64th byte is padding (or used
for multicolor sprite extra data in some editors).

```
Frame layout (64 bytes):
  Byte 0-2:   Row 0 (3 bytes)
  Byte 3-5:   Row 1 (3 bytes)
  ...
  Byte 60-62:  Row 20 (3 bytes)
  Byte 63:     Padding (typically $00)
```

### Sprite Data for Spinning Line

Each frame's pixel data (21 rows × 3 bytes = 63 bytes) plus 1 padding byte:

**Frame 0 — Vertical "|"**: 2-pixel wide vertical bar at columns 11-12
**Frame 1 — Forward Slash "/"**: Diagonal bottom-left to top-right
**Frame 2 — Horizontal "—"**: 3-pixel tall bar at rows 9-11
**Frame 3 — Backslash "\\"**: Diagonal top-left to bottom-right

## getSpriteFrame() Function Design

```js
// Library-style function: compute VIC-II sprite pointer for a frame
// within a multi-frame @sprite sheet.
//
// @param spriteAddr - Address of the sprite sheet (from @spriteVar)
// @param frameIndex - Zero-based frame index within the sheet
// @return VIC-II sprite pointer value (byte)
//
// Math: pointer = (spriteAddr / 64) + frameIndex
// Since @sprite guarantees 64-byte alignment, spriteAddr is always
// divisible by 64. The division produces the base pointer, and adding
// frameIndex selects the specific frame.
function getSpriteFrame(spriteAddr: word, frameIndex: byte): byte {
    return lo(spriteAddr / 64) + frameIndex;
}
```

This function exercises:
- **Bug #1**: `@lineFrames` passed as word argument (address-of promotion)
- **Bug #2**: `spriteAddr / 64` (word division inside function)
- **lo() intrinsic**: Narrowing word result to byte

## Updated main.blend Structure

```
1. Module declaration
2. VIC-II register constants
3. Screen position constants
4. Animation constants
5. Multi-frame sprite data (@sprite const lineFrames)
6. getSpriteFrame() function
7. delay() function
8. main() — setup + animation loop
```

## README Update

The README should be updated to document:
- Multi-frame sprite sheet concept
- 64-byte frame alignment (63 data + 1 padding)
- getSpriteFrame() as reusable pattern
- How sprite editors export compatible data
- The pointer arithmetic: `base_pointer + frame_index`

## Files to Modify

| File | Change |
|------|--------|
| `examples/spinning-line/main.blend` | Complete rewrite with multi-frame pattern |
| `examples/spinning-line/README.md` | Update documentation |
