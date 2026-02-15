# Spinning Line Sprite Animation

A Blend65 program that animates a spinning line using 4 sprite frames: `|` `/` `-` `\`

## What It Does

1. Declares **4 separate `@sprite` constants** — one for each rotation frame
2. Uses `lo(@spriteData / 64)` to compute VIC-II sprite pointers at assembly time
3. Cycles through frames `| → / → - → \ → | → ...` in an infinite loop
4. A white spinning line appears centered on screen

## Key Language Features Demonstrated

| Feature | Usage |
|---------|-------|
| `@sprite` storage class | `@sprite const lineVertical: byte[] = [...]` — 64-byte aligned data |
| Multiple `@sprite` blocks | 4 separate sprite frames, each independently aligned |
| `@` address-of operator | `@lineVertical` — gets the 16-bit memory address |
| `lo()` intrinsic | `lo(@lineVertical / 64)` — narrows word to byte |
| Assembly-time math | `@label / 64` resolved by ACME assembler — zero runtime cost |
| `barrier()` intrinsic | Used in delay loops to prevent optimization |

## Assembly-Time Sprite Pointers

The VIC-II sprite pointer = `data_address / 64`. Since `@sprite` guarantees 64-byte
alignment, the division is always exact. Using `lo(@spriteData / 64)` inline, the
compiler emits assembly-time expressions that ACME resolves to single `LDA #immediate`
instructions — zero runtime cost:

```asm
; Assembly output — no runtime division!
LDA #(__data_SpinningLine_lineVertical / 64)
STA $07F8
```

This is the same pattern used in the [balloon-sprite](../balloon-sprite/) example.

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
2. **Initial frame**: Set sprite pointer to the vertical line via `lo(@lineVertical / 64)`
3. **Animation loop**:
   - `setAnimationFrame(frame)` selects the current sprite via if-chain
   - Each branch writes `lo(@spriteData / 64)` to the sprite pointer register
   - `delay()` provides visible timing between frames
   - Frame counter advances: 0 → 1 → 2 → 3 → 0 → ...

## Compile & Run

```bash
# Compile and assemble to .prg
node packages/cli/bin/blend65.js build examples/spinning-line/main.blend -O 2 -o build --outFile spinning-line && acme -f cbm -o ./build/spinning-line.prg ./build/spinning-line.asm
```
