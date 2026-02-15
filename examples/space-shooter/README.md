# Space Shooter — Multi-Frame Sprite Example

## Overview

This example demonstrates multi-frame sprite management on the C64:
- 4 sprite frames in a `@data` sprite sheet
- Player ship with thruster animation (frame toggle)
- 3 enemies with open/closed animation
- Frame switching via sprite pointer changes (1 `poke` per switch)

## Sprite Frames

| Frame | Content | Bytes |
|-------|---------|-------|
| 0 | Player ship — normal | 63 |
| 1 | Player ship — thruster on | 63 |
| 2 | Enemy — open | 63 |
| 3 | Enemy — closed | 63 |

## Key Technique: Pointer-Based Frame Switching

The VIC-II reads sprite graphics from `pointer × 64`. Switching a sprite's
appearance is just changing one byte:

```js
// Switch hardware sprite 0 to show frame 2 (enemy open)
poke($07F8, 128 + 2);  // pointer = base + frame offset
```

This takes 4 CPU cycles — the same as hand-written assembly.

## Future: @sprite Syntax

When the `@sprite` alignment directive is implemented, this example will use:

```js
@sprite const spriteSheet: byte[] = [/* ... */];
const SPRITE_PTR_BASE: byte = @spriteSheet / 64;
```

This eliminates the `copySpriteData()` function entirely — the VIC-II reads
directly from the aligned data segment. Zero runtime copying.

## Build

```bash
node packages/cli/bin/blend65.js build examples/space-shooter/main.blend --verbose
```
