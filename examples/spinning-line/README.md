# Spinning Line Sprite Animation

A Blend65 program that animates a spinning line using 4 sprite frames: `|` `/` `-` `\`

## What It Does

1. Declares a **single multi-frame `@sprite`** containing all 4 rotation frames (256 bytes total)
2. Uses `getSpriteFrame(@lineFrames, frame)` for O(1) frame selection via pointer arithmetic
3. Cycles through frames `| → / → - → \ → | → ...` in an infinite loop
4. A white spinning line appears centered on screen

## Key Language Features Demonstrated

| Feature | Usage |
|---------|-------|
| `@sprite` storage class | `@sprite const lineFrames: byte[] = [...]` — 64-byte aligned data |
| Multi-frame sprite sheet | 4 frames × 64 bytes stored contiguously in one `@sprite` block |
| `@` address-of operator | `@lineFrames` — gets the 16-bit memory address |
| Address-of as function arg | `getSpriteFrame(@lineFrames, frame)` — @var passed as word parameter |
| Word division in functions | `spriteAddr / 64` — 16-bit division via shift-right |
| `lo()` intrinsic | `lo(spriteAddr / 64)` — narrows word result to byte |
| `barrier()` intrinsic | Used in delay loops to prevent optimization |
| Full-range byte for-loop | `for (let _j: byte = 0 to 255)` — uses post-body exit pattern |

## Multi-Frame Sprite Sheet Pattern

### Why One @sprite Instead of Four?

The VIC-II reads sprite data from 64-byte aligned blocks. With **separate** `@sprite`
declarations, each one gets its own alignment padding — potentially wasting up to
63 bytes per sprite (252 bytes for 4 sprites). With a **single** multi-frame `@sprite`,
there's only ONE alignment gap, saving up to 189 bytes.

### Memory Layout

```
base+0:     Frame 0 (|)   — 64 bytes (63 data + 1 padding)
base+64:    Frame 1 (/)   — 64 bytes
base+128:   Frame 2 (-)   — 64 bytes
base+192:   Frame 3 (\)   — 64 bytes
```

### Pointer Arithmetic

The VIC-II sprite pointer = `data_address / 64`. For contiguous 64-byte frames:

```
pointer_for_frame_N = (base_address / 64) + N
```

This is exactly what `getSpriteFrame()` computes:

```js
function getSpriteFrame(spriteAddr: word, frameIndex: byte): byte {
    return lo(spriteAddr / 64) + frameIndex;
}
```

### Compatibility with Sprite Editors

This layout matches how sprite editors (SpritePad, Spritemate) export multi-frame
sprites — each frame is exactly 64 bytes, stored contiguously. You can paste exported
data directly into the `@sprite` array.

## Bug Fixes Exercised

This example serves as a real-world integration test for three compiler bug fixes:

| Bug | Fix | How This Example Tests It |
|-----|-----|---------------------------|
| **#1**: Address-of promotion | `@var` args skip `PROMOTE_BYTE_WORD` | `getSpriteFrame(@lineFrames, frame)` passes `@lineFrames` as word |
| **#2**: Word division | `SHR_WORD` opcode for 16-bit shifts | `spriteAddr / 64` inside `getSpriteFrame()` |
| **#3**: Byte 255 for-loop | Post-body exit for `end=255` | `for (let _j: byte = 0 to 255)` in `delay()` |

## getSpriteFrame() — Reusable Pattern

The `getSpriteFrame()` function is a library-style utility that works with any
multi-frame `@sprite` sheet:

```js
// Usage with any @sprite variable:
poke(SPRITE0_POINTER, getSpriteFrame(@mySprite, currentFrame));
```

It computes the VIC-II pointer at runtime using a single word division and byte
addition. The division by 64 (power of 2) compiles to efficient shift-right
instructions.

## Sprite Frame Designs (24×21 pixels)

### Frame 0: Vertical `|`
```
      ██
      ██
      ██
      ██
      ██
      ██  (all 21 rows)
      ██
      ██
      ██
```

### Frame 1: Forward Slash `/`
```
                    ██
                  ██
                ██
              ██
            ██
          ██
        ██
      ██
    ██
  ██
██
```

### Frame 2: Horizontal `-`
```


         (9 empty rows)
████████████████████████
████████████████████████
████████████████████████
         (9 empty rows)


```

### Frame 3: Backslash `\`
```
██
  ██
    ██
      ██
        ██
          ██
            ██
              ██
                ██
                  ██
                    ██
```

## How It Works

1. **Setup**: Configure sprite 0 position (centered), color (white), and enable it
2. **Initial frame**: Set sprite pointer via `getSpriteFrame(@lineFrames, 0)`
3. **Animation loop**:
   - `getSpriteFrame(@lineFrames, frame)` computes the pointer for the current frame
   - Result is poked to `SPRITE0_POINTER` ($07F8)
   - `delay()` provides visible timing between frames (nested loops with `barrier()`)
   - Frame counter advances: 0 → 1 → 2 → 3 → 0 → ...

## Compile & Run

```bash
# Compile and assemble to .prg
node packages/cli/bin/blend65.js build examples/spinning-line/main.blend -O 2 -o build --outFile spinning-line && acme -f cbm -o ./build/spinning-line.prg ./build/spinning-line.asm
```
