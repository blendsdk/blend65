# Examples: Data Alignment

> **Document**: 08-examples.md
> **Parent**: [Index](00-index.md)

## Example Programs

### 1. Balloon Sprite (Single Sprite)

**Location**: `examples/balloon-sprite/main.blend`

Current version uses `@data` with manual copy. After implementation, will use:
```js
@sprite const balloonData: byte[] = [/* 63 bytes */];
// No copySpriteData() needed! VIC reads directly from aligned data.
```

### 2. Space Shooter (Multi-Frame Sprites)

**Location**: `examples/space-shooter/main.blend`

Demonstrates:
- 4 sprite frames in a single `@data` sheet
- Player ship thruster animation (frame toggle)
- 3 enemies with animation
- Pointer-based frame switching

After implementation, the `copySpriteData()` function and `SPRITE_DATA_ADDR` constant are eliminated.

## Syntax Showcase: All Sugar Keywords

### @sprite — VIC-II Sprite Data (align: 64)
```js
@sprite const playerShip: byte[] = [
    $00, $18, $00, $00, $3C, $00, /* ... 63 bytes */
];
// Equivalent to: @data(align: 64) const playerShip: byte[] = [...]
```

### @charset — Custom Character Set (align: 2048)
```js
@charset const gameFont: byte[2048] = [
    // 256 characters × 8 bytes each = 2048 bytes
    $3C, $66, $6E, $76, $66, $66, $3C, $00,  // char 0
    // ... 255 more characters
];
```

### @screen — Pre-Built Screen (align: 1024)
```js
@screen const titleScreen: byte[1000] = [
    // 40 columns × 25 rows of screen codes
    $20, $20, $20, /* ... title screen layout */
];
```

### @bitmap — Hi-Res/Multicolor Bitmap (align: 8192)
```js
@bitmap const splashImage: byte[8000] = [
    // 320×200 hi-res bitmap data
    /* ... 8000 bytes from image converter */
];
```

### @page — Page-Aligned Lookup Table (align: 256)
```js
@page const sinTable: byte[256] = [
    // Pre-computed sine wave (0-255 mapped to 0-255)
    128, 131, 134, 137, 140, 143, 146, 149,
    // ... 248 more values
];
// Page alignment guarantees no page-crossing penalty on indexed access
```

### @data(align: N) — Custom Alignment
```js
@data(align: 128) const customAligned: byte[128] = [/* ... */];
// For non-standard alignment requirements
```

### @ram(align: N) — Aligned Mutable Buffer
```js
@ram(align: 64) let dmaBuffer: byte[6400];
// Mutable buffer for REU DMA destination — 64-byte aligned for sprites
```

## Future Example: Full Game Pattern

After both `@sprite` and `@` address-of operator are implemented:

```js
module Game;

// All sprite data, 64-byte aligned — VIC reads directly
@sprite const sprites: byte[6400] = [/* 100 frames from SpritePad */];

// Computed at assembly time — zero runtime cost
const SPR_BASE: byte = @sprites / 64;

// Custom charset for HUD — 2KB aligned
@charset const hudFont: byte[2048] = [/* from CharPad */];

// Pre-computed math tables — page aligned for speed
@page const sinTable: byte[256] = [/* sine lookup */];
@page const cosTable: byte[256] = [/* cosine lookup */];

export function main(): void {
    // Set charset: ACME computes @hudFont / 1024 at assembly time
    poke($D018, (@hudFont / 1024) << 1);

    // Show sprite frame 42 on hardware sprite 0
    poke($07F8, SPR_BASE + 42);
    poke($D015, 1);

    // Use sin table with guaranteed no page-cross penalty
    let angle: byte = 0;
    let y: byte = sinTable[angle];  // Always 4 cycles, never 5
}
```
