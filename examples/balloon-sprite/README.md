# Balloon Sprite Example

A simple Blend65 program that displays a red balloon sprite in the center of the C64 screen. Demonstrates the `@sprite` storage class for 64-byte aligned sprite data.

## What It Does

1. Declares sprite data using `@sprite` — automatically 64-byte aligned by the assembler
2. Copies the sprite data to VIC-II accessible memory at `$2000` (until `@` address-of is available)
3. Configures sprite 0 (pointer, position, color)
4. Enables sprite 0 — a red balloon appears centered on screen

## C64 Sprite Concepts Demonstrated

| Concept | Detail |
|---------|--------|
| Sprite data | 63 bytes (3 bytes/row × 21 rows) at 64-byte aligned address |
| Sprite pointer | `$07F8` = sprite data address / 64 |
| Position | X=172, Y=140 (centered in 320×200 visible area) |
| Color | Red (color index 2) |
| Enable | Bit 0 of `$D015` |

## Balloon Shape

```
    ████████
  ████████████
██████████████████
██████████████████
██████████████████
██████████████████
  ████████████
    ████████
      ██
      ██
     ████
     ████
      ██
```
