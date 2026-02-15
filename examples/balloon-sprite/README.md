# Balloon Sprite Example

A simple Blend65 program that displays a red balloon sprite in the center of the C64 screen.

## What It Does

1. Declares sprite data using `@sprite` — automatically 64-byte aligned by the assembler
2. Uses the `@` address-of operator to compute the VIC-II sprite pointer at runtime
3. Configures sprite 0 (pointer, position, color) and enables it
4. A red balloon appears centered on screen — **no manual memory copying needed**

## Key Language Features Demonstrated

| Feature | Usage |
|---------|-------|
| `@sprite` storage class | `@sprite const balloonData: byte[] = [...]` — 64-byte aligned data |
| `@` address-of operator | `@balloonData` — gets the 16-bit memory address |
| `hi()` intrinsic | `hi(@balloonData)` — extracts the high byte of the address |
| `poke()` intrinsic | Writes to VIC-II hardware registers |

## How the Sprite Pointer Works

The VIC-II needs a sprite pointer = `data_address / 64`. Since `@sprite` guarantees 64-byte alignment (low 6 bits are zero), dividing by 64 simplifies to:

```
sprite_pointer = hi(address) * 4
```

In Blend:

```js
let spritePtr: byte = hi(@balloonData) * 4;
poke(SPRITE0_POINTER, spritePtr);
```

No hardcoded addresses. No manual copy routines. The compiler and assembler handle alignment.

## C64 Sprite Concepts

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
