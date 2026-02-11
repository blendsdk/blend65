# Sprite System Research for Blend65

**Date:** January 8, 2026  
**Status:** Research Complete - Ready for Implementation Planning  
**Author:** Research Session

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Current State](#current-state)
3. [Sprite Sizes Across Platforms](#sprite-sizes-across-platforms)
4. [Proposed Solutions](#proposed-solutions)
5. [File Format Research](#file-format-research)
6. [Multi-Sprite Access Patterns](#multi-sprite-access-patterns)
7. [Recommended Implementation](#recommended-implementation)
8. [Next Steps](#next-steps)

---

## Problem Statement

### Goal
Provide Blend65 users an easy way to load/define sprites as a first-class language functionality, inspired by C64 and retro game development practices.

### Current State
Blend65 theoretically supports sprites via `byte[]` arrays:

```js
@data const spriteData: byte[63] = [
  $00, $3C, $00,  // Row 1
  $00, $7E, $00,  // Row 2
  $01, $FF, $80,  // Row 3
  // ... 21 rows × 3 bytes = 63 bytes total for C64
];

setSpriteData(0, spriteData);
```

### Limitations
1. **Not readable** - Hard to visualize what the sprite looks like
2. **Error-prone** - Easy to make mistakes in byte values
3. **No validation** - Compiler doesn't know it's sprite data
4. **No metadata** - No way to specify multicolor, dimensions, etc.
5. **Tedious maintenance** - Changing one pixel means recalculating hex values

---

## Current State

### What Blend65 Already Supports

✅ **Array type syntax**: `byte[63]`, `byte[256]`, etc.
```ebnf
type_expr = type_name | type_name , "[" , integer , "]" ;
```

✅ **Array initializers**: `[value, value, ...]`

✅ **Hex literals**: `$FF`, `$D000`, `$00` (perfect for sprite data)

✅ **Binary literals**: `0b11110000` (alternative way to express sprite rows)

✅ **Storage classes**: `@data` (for ROM), `@ram` (for dynamic sprites), `@zp` (for pointers)

✅ **Const declarations**: `const` ensures sprite data is immutable

✅ **Import/export system**: Module-based organization

---

## Sprite Sizes Across Platforms

### Commodore 64 (C64) - VIC-II Chip

**Hardware Sprites:**
- **8 hardware sprites** (MOB 0-7)
- **24×21 pixels** each in single-color mode
- **12×21 pixels** each in multicolor mode (double-width pixels)
- **63 bytes per sprite** (21 rows × 3 bytes)
- **Sprite pointers** at $07F8-$07FF
- **64-byte aligned** sprite data blocks

```js
// C64 sprite - 24×21 pixels = 63 bytes
type C64Sprite = byte[63];
```

### Commodore 128 (C128) - VIC-IIe Chip

**Hardware Sprites:**
- **Same as C64**: 8 sprites, 24×21 pixels
- **Identical VIC-II chip** (enhanced version)
- **Same 63-byte format**

### VIC-20 - VIC Chip

**No Hardware Sprites!**
- VIC-20 does not have hardware sprite support
- Sprites must be software-implemented:
  - **Character-based sprites** (8×8 or 16×16 using custom chars)
  - **Bitmap sprites** (software blitting)
  - Typical sizes: **8×8**, **16×16**, **24×24** pixels

```js
// VIC-20 software sprite - 8×8
type VIC20Sprite = byte[8];
```

### Commodore PET

**No Hardware Sprites!**
- Text-only display (no bitmap graphics on most models)
- "Sprites" are **character-based only**:
  - **8×8 character cells** using custom character sets
  - **2×2 character blocks** = 16×16 pixels

```js
// PET character-based "sprite" - 8×8 pixels
type PETChar = byte[8];
```

### Commander X16 - VERA Graphics

**Modern hardware with powerful sprite system!**

**Hardware Sprites:**
- **128 hardware sprites** (0-127)
- **Multiple size modes per sprite:**
  - **8×8 pixels** (64 bytes)
  - **16×16 pixels** (256 bytes)
  - **32×32 pixels** (1024 bytes)
  - **64×64 pixels** (4096 bytes)
- **8 bits per pixel** (256 colors)
- **4 bits per pixel** (16 colors) in some modes
- **Z-depth sorting** (layering)
- **Collision detection**

```js
// X16 sprite types
type X16Sprite8 = byte[64];
type X16Sprite16 = byte[256];
type X16Sprite32 = byte[1024];
type X16Sprite64 = byte[4096];
```

### Plus/4, C16, C128

**No Hardware Sprites** (Plus/4, C16)
- Software sprites only
- Character-based (8×8) or bitmap-based
- Common sizes: **8×8**, **16×16**, **24×24**

### Summary Table

| Platform | Hardware Sprites | Sprite Sizes | Data Size | Notes |
|----------|------------------|--------------|-----------|-------|
| **C64** | ✅ 8 sprites | 24×21 (single), 12×21 (multi) | 63 bytes | VIC-II chip |
| **C128** | ✅ 8 sprites | 24×21 (single), 12×21 (multi) | 63 bytes | VIC-IIe chip |
| **VIC-20** | ❌ None | 8×8, 16×16 (software) | 8, 32 bytes | Custom chars |
| **PET** | ❌ None | 8×8 (chars only) | 8 bytes | Text-based |
| **Plus/4** | ❌ None | 8×8, 16×16 (software) | 8, 32 bytes | Software sprites |
| **C16** | ❌ None | 8×8, 16×16 (software) | 8, 32 bytes | Software sprites |
| **X16** | ✅ 128 sprites | 8×8, 16×16, 32×32, 64×64 | 64, 256, 1024, 4096 bytes | Modern VERA chip |

### Recommended Generic Sprite Types

```js
// Universal sizes (all platforms)
type Sprite8x8 = byte[8];
type Sprite16x16 = byte[32];

// C64/C128 hardware sprites
type Sprite24x21 = byte[63];

// Commander X16 sprite sizes
type Sprite32x32 = byte[1024];
type Sprite64x64 = byte[4096];
```

---

## Proposed Solutions

### Solution 1: Sprite Literal Syntax (ASCII Art)
*First-class language feature using visual representation*

```js
sprite PlayerShip = """
  ....XXXX........
  ...XXXXXX.......
  ..XXXXXXXX......
  ..XX.XX.XX......
  .XXXX..XXXX.....
  .XX......XX.....
  XX........XX....
  ..........X.....
""";
```

**Features:**
- Visual representation directly in source code
- Each character maps to sprite pixels (`.` = transparent, `X` = set)
- Compiler validates dimensions and converts to byte arrays
- Multi-color support: `.` = transparent, `X` = color1, `O` = color2, `#` = color3

**Pros:** Extremely readable, maintainable, self-documenting  
**Cons:** Takes more source lines, limited to simple patterns, **requires new syntax**

**Status:** ❌ Rejected - User doesn't want new `"""` syntax

---

### Solution 2: External Sprite Files ⭐ SELECTED
*Import sprites from external files at compile time*

```js
// main.b65
module Game.Main

import playerSprite from "./sprites/player.spr";
import enemySprites from "./sprites/enemies.spd";

function init(): void
  setSpriteData(0, playerSprite);
  setSpriteData(1, enemySprites[0]);
end function
```

**How it works:**
- Use **existing import syntax** (no changes needed!)
- Compiler recognizes `.spr`, `.spd`, `.chr` file extensions
- Loads binary sprite data at compile time
- Generates `byte[]` arrays automatically
- Supports SpritePad, CharPad, and other sprite editor formats

**Pros:**
- ✅ Zero new syntax required
- ✅ Professional workflow (use existing tools)
- ✅ Separation of code and assets
- ✅ Support for sprite editors
- ✅ Easy to update sprites without touching code

**Cons:**
- ❌ Can't see sprite in source code
- ❌ Requires external tools (but most devs use them anyway)

**Status:** ✅ **SELECTED FOR IMPLEMENTATION**

---

### Solution 3: Build-Time Code Generation

```bash
# Build step generates sprite.b65 from sprite images
blend-sprite-gen ./sprites/*.png --output ./src/sprites.b65
```

**Status:** Could be added later as tooling enhancement

---

### Solution 4: Comment-Based Sprite Data

```js
@data const playerShip: byte[63] = [
  /* SPRITE 24x21
  ....XXXX........XXXX....
  ...XXXXXX......XXXXXX...
  END SPRITE */
  $00, $3C, $00, $00, $7E, $00, $01, $FF, $80,
];
```

**Status:** Interesting but creates duplication and sync issues

---

## File Format Research

### Are Sprite Formats Open Source/Documented?

**Yes! Most formats are well-documented and open source.**

### SpritePad Format (.spd, .spr)

- **Tool**: SpritePad (C64 sprite editor)
- **Status**: ✅ Format well-documented, tools are freeware
- **Documentation**: Available in SpritePad distribution and community wikis
- **Parsable**: Yes, simple binary format

**SpritePad .spr format (single sprite):**
```
Offset  Size  Description
------  ----  -----------
0       63    Sprite data (63 bytes raw)
63      1     Color byte (optional in some versions)
```

**SpritePad .spd format (sprite project):**
```
Offset  Size  Description
------  ----  -----------
0       3     Magic: "SPD" or "SPR"
3       1     Version
4       1     Number of sprites
5       1     Color info
6+      ?     Sprite data (63 bytes per sprite)
?       ?     Animation data (optional)
?       ?     Sprite names (metadata - OFTEN PRESENT!)
```

### CharPad Format (.ctm, .chr)

- **Tool**: CharPad (C64 character/tile editor)
- **Status**: ✅ Format documented
- **Use**: Character sets and tile maps
- **Parsable**: Yes

**CharPad .ctm format:**
```
Offset  Size  Description
------  ----  -----------
0       4     Magic: "CTM" + version
4       2     Background color
6       2     Multi-color settings
8       ?     Character data (8 bytes per char)
?       ?     Screen map data
?       ?     Metadata
```

### Raw Binary Formats (.bin, .dat)

- **Format**: Pure sprite data, no headers
- **Size**: Exact sprite size (63 bytes for C64, etc.)
- **Status**: ✅ Easiest to parse
- **Tools**: Can be created by any tool

### Koala Format (.kla, .koa)

- **Use**: Full-screen bitmap images
- **Status**: ✅ Well-documented
- **Size**: 10,003 bytes (8000 bitmap + 1000 screen + 1000 color + 3 metadata)

### PRG Format (.prg)

- **Format**: 2-byte load address + data
- **Status**: ✅ Universal Commodore format
- **Can contain**: Sprites, graphics, code, anything

### Platform-Specific Tools

#### C64 Tools
| Tool | Format | Type | Open Source | Status |
|------|--------|------|-------------|--------|
| **SpritePad** | .spd, .spr | Sprite editor | Freeware | ⭐ Recommended |
| **CharPad** | .ctm, .chr | Char/tile editor | Freeware | ⭐ Recommended |
| **Spritemate** | .json, .asm | Web-based sprite | ✅ Yes (MIT) | Modern option |
| **Petmate** | .c, .asm, .json | PETSCII editor | ✅ Yes (MIT) | Text/character art |
| **Koala Painter** | .kla, .koa | Bitmap editor | Freeware | Legacy |

#### VIC-20 Tools
- CharPad (character editor)
- VIC-20 Screen Designer
- Custom tools for 8×8 char data

#### PET Tools
- Petmate (designed for PET!)
- CharPad (PET character sets)

#### Commander X16 Tools
- X16 Edit (official IDE) - ✅ Open source
- png2sprite (PNG converter) - ✅ Open source
- Aseprite (pixel art editor) - Commercial but popular
- GIMP scripts - ✅ Open source

### Graphics Formats to Support

The same import technique can be used for ALL graphics types:

#### A. Character/Tile Data
```js
import charset from "./assets/game.chr";        // byte[2048]
import tileset from "./assets/tiles.ctm";       // CharPad format
```

#### B. Full-Screen Bitmaps
```js
import titleScreen from "./assets/title.kla";   // byte[10003]
import gameOver from "./assets/gameover.koa";   // Koala format
```

#### C. Tile Maps
```js
import level1 from "./assets/level1.map";       // byte[?]
import worldMap from "./assets/world.tmx";      // Tiled format
```

#### D. Animation Data
```js
import playerAnim from "./assets/player-walk.spd";  // Multi-frame
```

#### E. Palette Data (X16)
```js
import gamePalette from "./assets/colors.pal";  // byte[?]
```

---

## Multi-Sprite Access Patterns

### The Key Question
**How do users access individual sprites from a multi-sprite file?**

Example: `player.spd` contains 4 sprites (idle, walk1, walk2, jump)

### How C64 Developers Do It

**Traditional C64 approach uses FLAT arrays + offset calculation:**

```asm
; Flat sprite array - just sequential bytes
sprites:
    .byte $00,$3C,$00,... ; Sprite 0 (bytes 0-62)
    .byte $00,$18,$00,... ; Sprite 1 (bytes 63-125)
    .byte $00,$7E,$00,... ; Sprite 2 (bytes 126-188)
    
; Access sprite N: address = sprites + (N * 63)
```

**Key insight:** No fancy data structures needed! Just math.

### Multi-Dimensional Arrays NOT Required!

We can support multi-sprite files **WITHOUT** multi-dimensional arrays or slicing!

---

## Multi-Sprite Solutions (Using Existing Features)

### Solution A: Named Imports (Best UX) ⭐⭐⭐

```js
// Import generates multiple constants
import { idle, walk1, walk2, jump } from "./player.spd";

// Each is a separate byte[63] constant
setSpriteData(0, idle);
setSpriteData(0, walk1);
setSpriteData(0, jump);
```

**What the compiler does:**
1. Parse .spd file (contains 4 sprites × 63 bytes = 252 bytes total)
2. Extract sprite names from .spd metadata (SpritePad files often include names!)
3. Split into 4 separate byte[63] arrays
4. Export as individual named constants
5. No multi-dimensional arrays needed!

**Pros:**
- ✅ Uses existing `byte[63]` syntax
- ✅ No new language features
- ✅ Named access (best developer experience)
- ✅ Type-safe
- ✅ Uses existing import destructuring syntax

**Cons:**
- ⚠️ Requires .spd files with sprite names (but most have them!)

**Language requirements:**
- ✅ Destructuring imports: `import { a, b } from module` (ALREADY IN SPEC!)
- ✅ byte[N] arrays (already supported)

---

### Solution B: Fragment Imports (Fallback) ⭐⭐

```js
// For unnamed sprites or explicit indexing
import idle from "./player.spd#0";     // Sprite 0
import walk1 from "./player.spd#1";    // Sprite 1  
import walk2 from "./player.spd#2";    // Sprite 2
import jump from "./player.spd#3";     // Sprite 3

// Each is byte[63]
setSpriteData(0, idle);
```

**How it works:**
- `#N` syntax tells compiler which sprite to extract
- Each import is a separate byte[63] array
- No fancy features needed

**Pros:**
- ✅ Simplest possible
- ✅ Uses existing syntax (just add fragment `#N` to import path)
- ✅ No language changes
- ✅ Works for unnamed sprites

**Cons:**
- ❌ Verbose for many sprites
- ❌ Not discoverable (how do you know there are 4 sprites?)

**Language requirements:**
- ⚠️ Import path fragment parsing (minor enhancement)

---

### Solution C: Wildcard Import (Optional) ⭐⭐

```js
import * as player from "./player.spd";

// Access via namespace
setSpriteData(0, player.idle);
setSpriteData(0, player.walk1);
setSpriteData(0, player.jump);
```

**Pros:**
- ✅ Organized namespace
- ✅ All sprites accessible
- ✅ May already work if wildcard imports supported

**Cons:**
- ⚠️ Check if wildcard imports already implemented

---

### Solution D: Flat Array + Helper (Traditional C64 Style) ⭐

```js
// Import as flat byte array
import allSprites from "./player.spd";  // byte[252] (4 × 63)

// Helper function for offset calculation
function getSpriteAddress(spriteNum: byte): word
  return @allSprites + (spriteNum * 63);  // Pointer arithmetic
end function

// Usage
setSpriteDataAt(0, getSpriteAddress(0));  // Sprite 0
setSpriteDataAt(0, getSpriteAddress(1));  // Sprite 1
```

**Pros:**
- ✅ Matches C64 pattern exactly
- ✅ Memory efficient
- ✅ Simple implementation

**Cons:**
- ❌ Manual offset calculation
- ❌ Less type-safe
- ⚠️ Requires pointer arithmetic support

---

### Solution E: Metadata Companion File

**Create a companion .json file:**
```json
// player.spd.json
{
  "sprites": [
    { "name": "idle", "index": 0 },
    { "name": "walk1", "index": 1 },
    { "name": "walk2", "index": 2 },
    { "name": "jump", "index": 3 }
  ]
}
```

**Compiler reads both files:**
```js
import { idle, walk1, walk2, jump } from "./player.spd";
```

**Status:** Fallback if .spd metadata insufficient

---

## Recommended Implementation

### Implementation Strategy: Hybrid Approach

**Implement multiple solutions in phases:**

### Phase 1: Single Sprite Import (Simplest)
```js
import sprite from "./single.spr";  // byte[63] - file has 1 sprite
```
- Zero new features
- Direct byte array import
- Works for `.spr` (single sprite) and `.bin` (raw binary)

**Requirements:**
- File format parser for .spr
- Binary file loader
- Import system extension to handle non-.b65 files

---

### Phase 2: Named Multi-Sprite Import (Best UX)
```js
import { idle, walk, jump } from "./player.spd";
```
- Uses destructuring imports (already in spec!)
- Compiler splits .spd into named exports
- Each sprite is separate byte[63]
- Reads sprite names from .spd metadata

**Requirements:**
- SpritePad .spd format parser
- Metadata extraction (sprite names)
- Named export generation
- Destructuring import support (verify already works)

---

### Phase 3: Fragment Import (Fallback)
```js
import sprite0 from "./unnamed.spd#0";
import sprite1 from "./unnamed.spd#1";
```
- Simple parser enhancement
- Works for unnamed sprites
- Explicit indexing

**Requirements:**
- Import path fragment parsing (`#N`)
- Index-based sprite extraction

---

### Phase 4: Wildcard Import (Optional)
```js
import * as player from "./player.spd";
// Access: player.idle, player.walk, etc.
```
- Uses namespace imports
- Check if already supported

**Requirements:**
- Wildcard import support (verify if exists)
- Module export generation from binary file

---

### Phase 5: Additional Formats
- CharPad (.ctm, .chr) for character sets
- Koala (.kla) for bitmaps
- Tiled (.tmx) for maps
- PNG with conversion

---

## Language Features Required

### Already Supported (No Changes Needed)
```js
✅ import X from "./file"           // Single default import
✅ import { a, b } from "./file"    // Named imports (in spec!)
✅ byte[63]                         // Array types
✅ @data const                      // Storage classes
✅ Module system                    // Import/export
```

### New Features Needed
```js
⚠️ File format parsers              // .spr, .spd, .chr format readers
⚠️ Import of non-.b65 files        // Treat .spr as virtual module
⚠️ Fragment imports (#N)            // Optional enhancement
⚠️ Wildcard imports (*)             // Verify if exists, implement if not
```

### NOT Required
```js
❌ Multi-dimensional arrays         // Not needed!
❌ Array slicing syntax             // Not needed!
❌ New string literal syntax        // Rejected by user
❌ New type keywords                // Use existing byte[N]
```

---

## Concrete Implementation Example

### Example 1: C64 Game with Sprites

**File: assets/player.spd**
- Contains 4 sprites with names: "idle", "walk1", "walk2", "jump"
- SpritePad format with metadata
- Total size: 252 bytes (4 × 63)

**File: main.b65**
```js
module Game.Main

// Named imports from multi-sprite file
import { idle, walk1, walk2, jump } from "./assets/player.spd";

// Single sprite imports
import bullet from "./assets/bullet.spr";      // byte[63]
import enemy from "./assets/enemy.spr";        // byte[63]

// Character set import
import charset from "./assets/font.chr";       // byte[2048]

let currentFrame: byte = 0;
@data const walkCycle: byte[3] = [1, 2, 1];  // Frame indices

function animatePlayer(): void
  // Cycle through walk animation
  match currentFrame
    case 0:
      setSpriteData(0, idle);
    case 1:
      setSpriteData(0, walk1);
    case 2:
      setSpriteData(0, walk2);
  end match
  
  currentFrame = (currentFrame + 1) % 3;
end function

function initSprites(): void
  setSpriteData(0, idle);     // Player starts idle
  setSpriteData(1, enemy);    // Enemy sprite
  setSpriteData(2, bullet);   // Bullet sprite
  
  loadCharset(charset);       // Load character set
end function

export function main(): void
  initSprites();
  
  while true
    animatePlayer();
    waitFrame();
  end while
end function
```

**What the compiler generates (conceptually):**
```js
// Generated virtual module from player.spd
module __imported_assets_player_spd

@data const __sprite_data: byte[252] = [
  /* All 252 bytes from player.spd */
];

// Export each sprite as separate constant
@data export const idle: byte[63] = [
  /* Bytes 0-62 from __sprite_data */
];

@data export const walk1: byte[63] = [
  /* Bytes 63-125 from __sprite_data */
];

@data export const walk2: byte[63] = [
  /* Bytes 126-188 from __sprite_data */
];

@data export const jump: byte[63] = [
  /* Bytes 189-251 from __sprite_data */
];

end module
```

---

## Next Steps

### Immediate Actions

1. **Verify Current Language Features**
   - Test if `import { a, b } from "./file"` works
   - Test if `import * as ns from "./file"` works
   - Confirm array type syntax works

2. **Design File Format Parsers**
   - SpritePad .spr parser (single sprite, 63 bytes)
   - SpritePad .spd parser (multi-sprite with metadata)
   - Raw binary loader (.bin)
   - CharPad .chr/.ctm parser (future)

3. **Extend Import System**
   - Allow imports from non-.b65 files
   - File extension detection
   - Virtual module generation
   - Named export generation from binary files

4. **Create Test Suite**
   - Sample .spr files
   - Sample .spd files with named sprites
   - Sample .spd files without names
   - Test imports in Blend65 code

5. **Documentation**
   - User guide for sprite imports
   - Supported file formats
   - Tool recommendations (SpritePad, CharPad, etc.)
   - Migration guide from byte[] arrays

### Future Enhancements

1. **Additional Format Support**
   - CharPad (.ctm, .chr) for character sets
   - Koala (.kla) for bitmaps
   - Tiled (.tmx) for tile maps
   - PNG with automatic conversion

2. **Tooling**
   - Sprite viewer in compiler/IDE
   - Format converter utilities
   - Sprite metadata editor

3. **Optimization**
   - Deduplication of identical sprite data
   - Compression for large graphics
   - Bank switching for large sprite sets

---

## Summary

### Chosen Solution: External File Import

**Why this approach:**
- ✅ Zero new language syntax required
- ✅ Leverages existing import/export system
- ✅ Professional workflow (use industry-standard tools)
- ✅ Supports all major Commodore sprite formats
- ✅ Extensible to other graphics types (chars, bitmaps, maps)
- ✅ No multi-dimensional arrays or slicing needed
- ✅ Works with existing byte[] foundation

**User writes:**
```js
import { idle, walk, jump } from "./player.spd";
setSpriteData(0, idle);
```

**Compiler generates:**
```js
// Virtual module with separate byte[63] constants
const idle: byte[63] = [...];
const walk: byte[63] = [...];
const jump: byte[63] = [...];
```

**Result:** Clean, type-safe, readable sprite handling with zero new syntax!

---

## References

### Tools
- SpritePad: http://spritepad.com
- CharPad: https://subchristsoftware.itch.io/charpad-free-edition
- Spritemate: https://github.com/Esshahn/spritemate
- Petmate: https://github.com/nurpax/petmate

### File Format Documentation
- SpritePad format: Included in SpritePad distribution
- CharPad format: Included in CharPad distribution
- Koala format: https://www.fileformat.info/format/koala/
- C64 sprite format: https://www.c64-wiki.com/wiki/Sprite

### Communities
- Lemon64 Forums: https://www.lemon64.com
- C64 Scene Database: https://csdb.dk
- Commander X16 Forum: https://cx16forum.com

---

**End of Research Document**
