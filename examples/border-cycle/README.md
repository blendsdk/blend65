# Border Color Cycle

A simple Commodore 64 demo that cycles through all 16 C64 colors on the screen border, changing approximately every second.

## What It Does

The program sets the VIC-II border color register (`$D020`) to each of the 16 C64 colors in sequence:

| # | Color | # | Color |
|---|-------|---|-------|
| 0 | Black | 8 | Orange |
| 1 | White | 9 | Brown |
| 2 | Red | 10 | Light Red |
| 3 | Cyan | 11 | Dark Grey |
| 4 | Purple | 12 | Grey |
| 5 | Green | 13 | Light Green |
| 6 | Blue | 14 | Light Blue |
| 7 | Yellow | 15 | Light Grey |

After displaying all 16 colors, it wraps back to black and repeats forever.

## How It Works

1. **`poke(BORDER, color)`** — Writes the current color value to VIC-II register `$D020`
2. **`delay()`** — A nested busy-wait loop (255 × 255 iterations with `barrier()`) that produces approximately 1 second of delay on a PAL C64
3. **Color wrapping** — After color 15, resets to 0

The `barrier()` intrinsic prevents the Blend65 optimizer from removing the empty delay loop body, ensuring the timing loop executes as intended.

## Compiling

```bash
# From the project root
node packages/cli/bin/blend65.js build examples/border-cycle/main.blend
```

This produces a `.asm` file in ACME assembler format that can be assembled into a `.prg` file for the C64.

## Language Features Demonstrated

- **Module declaration** (`module BorderCycle`)
- **Constants** (`const BORDER: word = $D020`)
- **Functions** (`function delay(): void`)
- **While loop** (`while (true)` for infinite loop)
- **For loop** (C-style counting loop)
- **Intrinsics** (`poke()` for hardware access, `barrier()` for optimization control)
- **Comparison operators** (`>=` for color wrapping)
- **Hex literals** (`$D020` for hardware addresses)
