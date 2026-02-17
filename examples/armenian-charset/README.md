# Armenian Charset Example

Displays **"Barev Ashkharh"** (Բարեւ Աdelays — Hello World) in the Armenian alphabet using a custom 8×8 pixel bitmap font, then animates all 38 uppercase Armenian letters as a growing serpentine snake across the screen in Armenian flag colors.

## What This Demonstrates

| Feature | Description |
|---------|-------------|
| `@charset` storage class | 2048-byte aligned character set data for VIC-II |
| `@` address-of operator | Compute font address for VIC-II register |
| `lo()` intrinsic | Word-to-byte narrowing for register computation |
| `@data` arrays | Pre-computed message and path data |
| `peek()`/`poke()` | Direct hardware register access |
| `barrier()` | Prevent optimizer from removing delay loops |
| VIC-II `$D018` | Character generator memory switching |

## How It Works

### VIC-II Charset Switching

The Commodore 64's VIC-II chip reads character shapes from a 2048-byte block in memory. Register `$D018` (bits 1-3) selects which block.

**Important: Character ROM Shadow at $1000-$1FFF**

In VIC-II bank 0 ($0000-$3FFF), addresses $1000-$1FFF are mapped to the built-in character ROM for VIC-II reads. If the `@charset` data aligns to $1000 (which it naturally does in this program), the VIC-II reads the ROM instead of our custom font data.

The fix is a standard C64 technique: the CPU can still read RAM at $1000, so we copy the charset to $2000 (outside the ROM shadow) at startup, then point the VIC-II there:

```
copyCharset();  // Copy from @armenianFont ($1000) to $2000
poke($D018, screenBits | $08);  // Point VIC-II to $2000
```

The `@charset` storage class ensures the font data is placed at a 2048-byte aligned address, and `copyCharset()` moves it to a VIC-safe location.

### Armenian Alphabet Encoding

The 38 uppercase Armenian letters are encoded as characters 0-37 in the custom charset:

| Index | Letter | Name | Index | Letter | Name |
|-------|--------|------|-------|--------|------|
| 0 | Ա | Ayb | 19 | Մ | Men |
| 1 | Բ | Ben | 20 | Յ | Yi |
| 2 | Գ | Gim | 21 | Ն | Nu |
| 3 | Դ | Da | 22 | Շ | Sha |
| 4 | Ե | Yech | 23 | Ո | Vo |
| 5 | Զ | Za | 24 | Չ | Cha |
| 6 | Է | É | 25 | Պ | Pe |
| 7 | Ը | Et | 26 | Ջ | Jhe |
| 8 | Թ | To | 27 | Ռ | Ra |
| 9 | Ժ | Zhe | 28 | Ս | Se |
| 10 | Ի | Ini | 29 | Վ | Vev |
| 11 | Լ | Lyun | 30 | Տ | Tiwn |
| 12 | Խ | Khe | 31 | Ր | Re |
| 13 | Ծ | Tsa | 32 | Ց | Co |
| 14 | Կ | Ken | 33 | Ւ | Yiwn |
| 15 | Հ | Ho | 34 | Փ | Piwr |
| 16 | Ձ | Dza | 35 | Ք | Ke |
| 17 | Ղ | Ghat | 36 | Օ | O |
| 18 | Ճ | Tche | 37 | Ֆ | Fe |

Character 38 is a space, and characters 39-255 are blank.

### Animation

The program displays the greeting on row 3, then animates the full alphabet as a snake crawling in a serpentine pattern (left→right, right→left, etc.) across rows 10-13, with each row colored in Armenian flag colors:

- **Row 10**: Red (top stripe)
- **Row 11**: Blue (middle stripe)
- **Row 12**: Orange (bottom stripe)
- **Row 13**: Red (repeating)

## Building

```bash
node packages/cli/bin/blend65.js build examples/armenian-charset/main.blend
```

## Files

| File | Description |
|------|-------------|
| `main.blend` | Complete program: charset data, helper functions, and main logic |
| `README.md` | This documentation |
