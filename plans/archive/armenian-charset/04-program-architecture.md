# Program Architecture: Armenian Charset Example

> **Document**: 04-program-architecture.md
> **Parent**: [Index](00-index.md)

## Overview

Single-file Blend65 program (`main.blend`) that defines a custom Armenian charset, switches the VIC-II to use it, displays "Բdelays Αdelaysdelays" (Hello World), and animates the full alphabet as a growing serpentine snake.

## File Structure

```
examples/armenian-charset/
├── main.blend      — Complete program (charset data + logic)
└── README.md       — Documentation and Armenian alphabet reference
```

## Program Sections

### 1. Module Declaration

```js
module Armenian.Charset;
```

### 2. VIC-II Hardware Constants

```js
const VIC_MEMORY_SETUP: word = $D018;   // VIC-II memory control register
const BORDER_COLOR: word = $D020;        // Border color register
const BACKGROUND_COLOR: word = $D021;    // Background color register
const SCREEN_BASE: word = $0400;         // Screen RAM start
const COLOR_BASE: word = $D800;          // Color RAM start
const SCREEN_WIDTH: byte = 40;           // Characters per row
```

### 3. Armenian Flag Color Constants

```js
const COLOR_BLACK: byte = 0;
const COLOR_RED: byte = 2;
const COLOR_BLUE: byte = 6;
const COLOR_ORANGE: byte = 8;
const COLOR_WHITE: byte = 1;
```

### 4. Character Code Constants

```js
// Armenian letter codes (index into our custom charset)
const CHAR_AYB: byte = 0;     // Ա
const CHAR_BEN: byte = 1;     // Բ
// ... etc for key letters used in "Barev Ashkharh"
const CHAR_SPACE: byte = 38;
const ALPHABET_LENGTH: byte = 38;
```

### 5. @charset Data Block

The largest section — 2048 bytes of character bitmap data:

```js
@charset const armenianFont: byte[2048] = [
    // Char 0: Ա (Ayb)
    $30, $48, $84, $84, $FC, $84, $84, $00,
    // Char 1: Բ (Ben)
    $F8, $84, $84, $F8, $84, $84, $F8, $00,
    // ... all 38 letters + space ...
    // Chars 39-255: padding zeros
    // (217 characters × 8 bytes = 1736 zeros)
];
```

### 6. Message Data

```js
// "Բdelays Αdelaysdelays" as character codes
@data const helloWorld: byte[] = [1, 0, 31, 4, 29, 38, 0, 22, 12, 0, 31, 15];
const HELLO_LENGTH: byte = 12;
```

### 7. Snake Path Data

Pre-computed X,Y positions for the serpentine path (38 positions for 38 letters):

```js
// X positions for the snake path (serpentine: right then left)
@data const snakeX: byte[] = [
    // Row 1: left to right (positions 0-9)
    5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    // Row 2: right to left (positions 10-19)
    14, 13, 12, 11, 10, 9, 8, 7, 6, 5,
    // Row 3: left to right (positions 20-29)
    5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    // Row 4: right to left (positions 30-37)
    14, 13, 12, 11, 10, 9, 8, 7
];

@data const snakeY: byte[] = [
    // Row 1 (y=10)
    10, 10, 10, 10, 10, 10, 10, 10, 10, 10,
    // Row 2 (y=11)
    11, 11, 11, 11, 11, 11, 11, 11, 11, 11,
    // Row 3 (y=12)
    12, 12, 12, 12, 12, 12, 12, 12, 12, 12,
    // Row 4 (y=13)
    13, 13, 13, 13, 13, 13, 13, 13
];
```

### 8. Helper Functions

```js
// Delay between animation steps (~200ms visible pause)
function delay(): void {
    for (_outer = 0 to 254) {
        for (_inner = 0 to 254) {
            barrier();
        }
    }
}

// Plot a character at screen position (x, y) with a color
function plotChar(x: byte, y: byte, ch: byte, color: byte): void {
    let offset: word = y * SCREEN_WIDTH + x;
    poke(SCREEN_BASE + offset, ch);
    poke(COLOR_BASE + offset, color);
}

// Clear the screen (fill with space character, set color)
function clearScreen(): void {
    for (i = 0 to 999) {
        poke(SCREEN_BASE + i, CHAR_SPACE);
        poke(COLOR_BASE + i, COLOR_WHITE);
    }
}
```

### 9. Main Function

```js
export function main(): void {
    // ── Step 1: Setup ──
    // Set Armenian flag colors
    poke(BORDER_COLOR, COLOR_BLUE);
    poke(BACKGROUND_COLOR, COLOR_BLACK);

    // Clear screen
    clearScreen();

    // ── Step 2: Switch VIC-II to custom charset ──
    // $D018 bits 1-3 = charset address / 2048
    // We need: (screen at $0400 → bits 4-7 = $01) | (charset / 2048 << 1)
    // Default $D018 = $15 (screen=$0400, charset=ROM $1000)
    // We keep screen bits and change charset bits
    let d018val: byte = (peek($D018) & $F0) | (lo(@armenianFont / 2048) << 1);
    poke(VIC_MEMORY_SETUP, d018val);

    // ── Step 3: Display "Բdelays Αdelaysdelays" ──
    // Print greeting centered on row 3
    let startX: byte = 14;  // Center: (40 - 12) / 2 = 14
    for (i = 0 to HELLO_LENGTH - 1) {
        plotChar(startX + i, 3, helloWorld[i], COLOR_RED);
    }

    // ── Step 4: Display "ՀԱՅՈCLOSE AYDELAYSDELAYSDELAYS" label on row 5 ──
    // (Armenian Alphabet label - optional)

    // ── Step 5: Snake animation ──
    // Animate alphabet as growing snake
    for (letterIndex = 0 to ALPHABET_LENGTH - 1) {
        // Pick color based on row (Armenian flag: red/blue/orange)
        let color: byte = COLOR_RED;
        if (snakeY[letterIndex] == 11) {
            color = COLOR_BLUE;
        }
        if (snakeY[letterIndex] == 12) {
            color = COLOR_ORANGE;
        }
        if (snakeY[letterIndex] == 13) {
            color = COLOR_RED;
        }

        // Plot the letter at the snake head position
        plotChar(snakeX[letterIndex], snakeY[letterIndex], letterIndex, color);

        // Delay for visible animation
        delay();
    }

    // ── Step 6: Infinite loop (keep display) ──
    while (true) {
        barrier();
    }
}
```

## VIC-II $D018 Calculation

This is the most critical hardware detail:

```
$D018 register layout:
  Bits 7-4: Screen memory address (× 1024)
  Bits 3-1: Character generator address (× 2048)
  Bit 0: Unused

Default value: $15 = %00010101
  Screen = %0001 × 1024 = $0400 ✓
  Charset = %010 × 2048 = $1000 (ROM charset)

For our custom charset at address A:
  New bits 3-1 = (A / 2048) << 1
  Keep bits 7-4 from current value (screen stays at $0400)
  Formula: (peek($D018) & $F0) | ((A / 2048) << 1)
```

**Important**: The `@armenianFont` address is resolved at assembly time by ACME. The expression `@armenianFont / 2048` is computed by the assembler, not at runtime.

## Snake Animation Logic

The serpentine pattern uses pre-computed coordinate arrays to avoid complex direction-tracking logic at runtime:

```
Step 0:  [Ա]                          ← 1 letter visible
Step 1:  [Ա][Բ]                       ← 2 letters visible
Step 2:  [Ա][Բ][Գ]                    ← 3 letters visible
...
Step 9:  [Ա][Բ][Գ][Դ][Ե][Զ][Է][Ը][Թ][Ժ]  ← 10 letters, row 1 full
Step 10: [ Delays][Ժ]                          ← turn down + left
                [Ի]
...
Step 37: All 38 letters visible as serpentine trail
```

Color alternates by row to create the Armenian flag stripe effect:
- Row 10: Red (🔴)
- Row 11: Blue (🔵)
- Row 12: Orange (🟠)
- Row 13: Red (🔴)

## Memory Budget

| Component | Size |
|-----------|------|
| @charset data | 2048 bytes |
| @data helloWorld | 12 bytes |
| @data snakeX | 38 bytes |
| @data snakeY | 38 bytes |
| Program code | ~300-500 bytes |
| ZP variables | ~10 bytes |
| **Estimated total** | **~2,600 bytes** |

Well within the C64's available memory (~38KB).
