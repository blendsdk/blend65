# Balloon Sprite Example

A simple Blend65 program that displays a red balloon sprite in the center of the C64 screen.

## What It Does

1. Sets the border and background to blue
2. Copies a 24×21 pixel balloon sprite to VIC-II accessible memory at `$2000`
3. Configures sprite 0 (pointer, position, color)
4. Enables sprite 0 — a red balloon appears centered on screen
5. Loops forever to keep the display active

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
