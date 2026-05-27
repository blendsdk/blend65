# F015 — Data Inclusion (Asset Embedding)

> **Status**: ✅ ACCEPTED  
> **Stability**: stable  
> **Depends on**: F003 (module contents), F005 (memory placement), F014 (arrays, const params)  
> **Interacts with**: F006 (address-of), F011 (structs)

---

## Description

The `embed()` intrinsic includes external binary data into the compiled program at compile time. It supports two modes:

1. **Raw binary inclusion** — embeds file bytes directly, no format interpretation
2. **Format-aware asset import** — uses platform-profile-registered format handlers to parse asset files (SpritePad, CharPad, SID, etc.) and extract specific data parts via dot-notation selectors

This eliminates the manual conversion step between third-party asset tools and Blend65 source code. Developers work directly with native asset file formats — the compiler handles parsing and extraction.

```blend65
// Raw binary — any platform, any file
const LOOKUP: byte[] = embed("table.bin");

// Format-aware — SpritePad file, compiler extracts sprite data
const SPRITES: byte[] = embed("player.spd").sprites;
const SPRITE_BASE: byte = embed("player.spd").base_block;

// SID music — compiler parses SID header
const MUSIC: byte[] = embed("music.sid").data;
const MUSIC_INIT: word = embed("music.sid").init_address;
const MUSIC_PLAY: word = embed("music.sid").play_address;

// CharPad — compiler extracts charset, screen, and color data
const CHARSET: byte[2048] = embed("level.ctm").charset;
const SCREEN: byte[1000] = embed("level.ctm").screen;
```

---

## Part 1: The `embed()` Intrinsic

### 1.1 Syntax

```ebnf
embed_expr       = "embed" , "(" , string_literal , ")" , [ "." , selector ] ;
selector         = identifier ;
```

`embed()` is a **compile-time intrinsic** — the file is read during compilation and its bytes become part of the output binary. There is no runtime file I/O.

### 1.2 Core Rules

| Rule | ID | Decision |
|------|----|----------|
| Compile-time only | EM-1 | `embed()` is evaluated at compile time. The referenced file must exist when the compiler runs |
| Always `const` | EM-2 | `embed()` can only appear as the initializer of a `const` declaration. Embedded data is immutable |
| Module-level only | EM-3 | `embed()` can only be used at module level — `const` declarations are module-level (F003) |
| Byte arrays only | EM-4 | Without a selector, `embed()` produces `byte[]`. With a selector, the type is defined by the format handler |
| Path is string literal | EM-5 | The file path must be a string literal, not a variable or expression |
| Forward-slash paths | EM-6 | File paths always use `/` as separator. The compiler normalizes to the host filesystem |
| Path resolution | EM-7 | Paths are resolved relative to the source file's directory. Additional search paths can be specified with the `--embed-path <dir>` compiler flag |
| File caching | EM-8 | When multiple `embed()` calls reference the same file, the compiler parses the file **once** and caches the result. All selectors on the same file share the cached parse |

### 1.3 Raw Binary Mode (No Selector)

When `embed()` is used without a dot-notation selector, the file bytes are included directly with no format interpretation:

```blend65
// Size inferred from file
const DATA: byte[] = embed("table.bin");

// Size validated — compiler checks file is exactly 256 bytes
const TABLE: byte[256] = embed("sine.bin");
```

**Size validation rules:**

| Declaration | File Size | Result |
|-------------|-----------|--------|
| `byte[] = embed(file)` | Any > 0 | ✅ Size inferred from file |
| `byte[N] = embed(file)` | Exactly N | ✅ Match |
| `byte[N] = embed(file)` | < N | ❌ E10140: not enough data |
| `byte[N] = embed(file)` | > N | ❌ E10140: too much data |

**Raw mode triggers when:**
- The file extension has no registered format handler in the active platform profile, OR
- The file extension is `.bin` (always treated as raw)

### 1.4 Partial Embedding (Offset)

The `offset` named parameter specifies a starting byte position (0-based):

```blend65
// Take 63 bytes starting at byte 0
const SPRITE_1: byte[63] = embed("sprites.bin", offset: 0);

// Take 63 bytes starting at byte 63
const SPRITE_2: byte[63] = embed("sprites.bin", offset: 63);

// Take all bytes from offset 128 to end of file
const TAIL: byte[] = embed("data.bin", offset: 128);
```

**EBNF extension:**

```ebnf
embed_expr       = "embed" , "(" , string_literal , [ "," , "offset" , ":" , const_expr ] , ")" ,
                   [ "." , selector ] ;
```

**Rules:**

| Rule | ID | Decision |
|------|----|----------|
| Offset must be constant | EM-9 | The offset value must be a compile-time constant expression |
| Offset bounds | EM-10 | Error if offset ≥ file size |
| Size from type | EM-11 | When array size is explicit (`byte[N]`), N bytes are read from the offset. Error if offset + N > file size |
| Size inferred | EM-12 | When array size is inferred (`byte[]`), all bytes from offset to end of file are included |
| Offset with selectors | EM-13 | `offset` is **not allowed** with format-aware selectors — the format handler controls data extraction |

---

## Part 2: Format-Aware Asset Import

### 2.1 Format Handlers

Platform profiles register **format handlers** — compiler components that understand specific asset file formats. Each handler declares:

1. **File extensions** it handles (e.g., `.spd`, `.ctm`, `.sid`)
2. **Selectors** — named data parts that can be extracted
3. **Return type** per selector — `byte[]`, `byte`, `word`, or `boolean`
4. **Alignment requirement** per selector — if the data needs specific memory alignment
5. **Linker-resolved flag** — whether the selector's value depends on final address assignment
6. **Default selector** — what to return when no selector is specified (or error if format requires one)

### 2.2 Dot-Notation Selectors

When a file has a registered format handler, selectors are accessed via dot notation:

```blend65
const SPRITES: byte[]  = embed("player.spd").sprites;
const COLORS: byte[]   = embed("player.spd").colors;
const COUNT: byte      = embed("player.spd").count;
const MULTI: boolean   = embed("player.spd").multicolor;
```

The compiler:
1. Detects the file extension (`.spd`)
2. Looks up the format handler in the active platform profile
3. Parses the file using the format handler
4. Validates the selector name against the handler's registered selectors
5. Validates the declared type against the selector's return type
6. Extracts the data

### 2.3 Type Validation

The declared variable type must match the selector's return type:

```blend65
// ✅ .sprites returns byte[] — matches byte[]
const SPRITES: byte[] = embed("player.spd").sprites;

// ✅ .init_address returns word — matches word
const INIT: word = embed("music.sid").init_address;

// ❌ E10144: .sprites returns byte[], not byte
const WRONG: byte = embed("player.spd").sprites;

// ❌ E10144: .init_address returns word, not byte[]
const ALSO_WRONG: byte[] = embed("music.sid").init_address;
```

For array selectors, explicit size is validated:

```blend65
// ✅ .charset returns byte[] — file contains exactly 2048 bytes of charset data
const CHARS: byte[2048] = embed("level.ctm").charset;

// ❌ E10140: selector 'charset' produces 2048 bytes, array size is 1024
const WRONG: byte[1024] = embed("level.ctm").charset;

// ✅ Size inferred from selector output
const CHARS2: byte[] = embed("level.ctm").charset;
```

### 2.4 Scalar Selectors in Expressions

Selectors that return scalar types (`byte`, `word`, `boolean`) resolve to compile-time constants and can be used in const expressions:

```blend65
const SPRITE_COUNT: byte = embed("player.spd").count;
const LAST_SPRITE: byte = embed("player.spd").count - 1;  // ✅ Const expression

const HAS_MULTI: boolean = embed("player.spd").multicolor;

// ✅ Scalar selector in const expression
const MUSIC_END: word = embed("music.sid").init_address + embed("music.sid").data_size;
```

Array selectors (returning `byte[]`) can **only** appear as initializers — they cannot be used in expressions:

```blend65
// ❌ E10142: array selector cannot be used in expression context
let x: byte = embed("player.spd").sprites + 1;
```

### 2.5 Default Selectors

A format handler may define a **default selector** — the data returned when no dot-notation is used:

```blend65
// SID format handler defines default: "data" (player + music combined)
const MUSIC: byte[] = embed("music.sid");           // Same as .data
const MUSIC2: byte[] = embed("music.sid").data;     // Explicit — same result
```

If a format **requires** a selector (no sensible default), omitting it is an error:

```
error[E10132]: format 'charpad' (.ctm) requires a selector
  --> src/main.blend:5:22
   |
5  | const DATA: byte[] = embed("level.ctm");
   |                       ^^^^^^^^^^^^^^^^^
   |
   Available selectors for .ctm (CharPad) files:
     .charset      → byte[]    Character definition data
     .screen       → byte[]    Screen/map layout data
     .colors       → byte[]    Per-cell color data
     .tile_width   → byte      Tile width in characters
     .tile_height  → byte      Tile height in characters
```

---

## Part 3: Alignment (Format-Handler Driven)

### 3.1 How Alignment Works

Format handlers declare alignment requirements for their selectors. The compiler respects these requirements when placing data in the output binary.

**This is NOT a language keyword** — alignment is a property of the format handler, invisible to the developer.

| Platform | Asset | Alignment | Why |
|----------|-------|-----------|-----|
| C64 | Sprites (SpritePad) | 64 bytes | VIC-II addresses sprites at block × 64 |
| C64 | Character sets | 2048 bytes | VIC-II character memory at 2KB boundaries within bank |
| C64 | Bitmap data | 8192 bytes | VIC-II bitmap at 8KB boundary within bank |
| Atari 800XL | Player/Missile graphics | 256 bytes | ANTIC PMBASE register uses page-aligned address |
| Atari 7800 | MARIA graphics | Varies | MARIA tile data alignment depends on mode |

### 3.2 Compiler Guarantees

When a format handler specifies alignment:

1. The compiler places the data at an aligned address in the output binary
2. The compiler verifies alignment in the build summary
3. If alignment is impossible (not enough space, conflicting requirements), the compiler emits E10143

### 3.3 Build Summary Output

The compiler reports embedded asset placement in the build summary:

```
=== Embedded Assets ===
  player.spd  .sprites     → $2000  (1024 bytes, align:64 ✓, block base: 128)
  player.spd  .colors      → $2400  (16 bytes)
  music.sid   .data        → $2800  (4096 bytes, align:256 ✓)
  level.ctm   .charset     → $3800  (2048 bytes, align:2048 ✓)
  level.ctm   .screen      → $4000  (1000 bytes)
  table.bin   (raw)        → $43E8  (256 bytes)
  Total embedded: 8384 bytes
```

---

## Part 4: Linker-Resolved Selectors

### 4.1 The Problem

Some metadata values depend on WHERE the compiler places the data in memory. These can't be known when the file is parsed — they're calculated after address assignment.

**Example**: On the C64, VIC-II sprite pointers need a "block number" = address / 64. The block number depends on where the sprite data is placed.

### 4.2 Linker-Resolved Selectors

Format handlers can declare selectors as **linker-resolved** — their values are computed after address assignment:

```blend65
// .base_block is linker-resolved: calculated as &SPRITES / 64 after placement
const SPRITE_BASE: byte = embed("player.spd").base_block;

// .base_page is linker-resolved: calculated as &PMG_DATA / 256 after placement
const PMG_PAGE: byte = embed("player.pmg").base_page;
```

**Rules:**

| Rule | ID | Decision |
|------|----|----------|
| Linker-resolved = const | LR-1 | Linker-resolved selectors produce compile-time constants (value known before runtime) |
| Used in expressions | LR-2 | Linker-resolved scalar values can be used in const expressions: `SPRITE_BASE + frame` |
| Alignment prerequisite | LR-3 | A linker-resolved selector that computes `address / N` requires its data selector to have N-byte alignment. The format handler enforces this |
| Build summary | LR-4 | Linker-resolved values are shown in the build summary for verification |

### 4.3 How This Solves the Sprite Alignment Problem

The previous Blend65 version had alignment bugs with sprite block calculations. This design eliminates the problem by making the compiler responsible for both alignment AND block calculation:

```blend65
import { SPRITE_PTR, SPRITE_ENABLE } from c64.vic;

// The compiler:
// 1. Parses player.spd (SpritePad format)
// 2. Extracts sprite pixel data
// 3. Places data at 64-byte aligned address (format handler requirement)
// 4. Calculates block number = address / 64
const PLAYER_SPRITES: byte[] = embed("player.spd").sprites;
const PLAYER_BASE: byte = embed("player.spd").base_block;
const PLAYER_FRAMES: byte = embed("player.spd").count;

let playerFrame: byte = 0;

function animatePlayer(): void {
    playerFrame = playerFrame + 1;
    if (playerFrame >= PLAYER_FRAMES) {
        playerFrame = 0;
    }
    // Set sprite 0 to show the current frame
    // PLAYER_BASE is guaranteed correct — compiler handled alignment + division
    poke(SPRITE_PTR, PLAYER_BASE + playerFrame);
}
```

**Zero manual address calculation. Zero alignment worries. The compiler guarantees correctness.**

---

## Part 5: Platform Format Handler Registry

### 5.1 Format Handler Interface

Each format handler in a platform profile must declare:

```
Format Handler Declaration:
  name:         Human-readable format name (e.g., "SpritePad v2.0")
  extensions:   File extensions (e.g., [".spd"])
  selectors:    Map of selector definitions
  default:      Default selector name, or null (requires explicit selector)
```

Each selector definition:

```
Selector Definition:
  name:         Identifier (e.g., "sprites")
  type:         Return type — byte[], byte, word, boolean
  alignment:    Required byte alignment, or null (no requirement)
  linker_resolved: boolean — true if value depends on placement address
  description:  Human-readable description (for error messages and IDE tooltips)
```

### 5.2 C64 Platform Profile — Format Handlers

The C64 platform profile registers handlers for common C64 asset tools:

#### SpritePad (.spd)

| Selector | Type | Alignment | Linker-Resolved | Description |
|----------|------|-----------|----------------|-------------|
| `.sprites` | `byte[]` | 64 bytes | No | All sprite pixel data (63 bytes/sprite, padded to 64-byte blocks) |
| `.colors` | `byte[]` | — | No | Per-sprite color values (one byte per sprite) |
| `.count` | `byte` | — | No | Number of sprites in the file |
| `.multicolor` | `boolean` | — | No | Whether sprites use multicolor mode |
| `.base_block` | `byte` | — | **Yes** | `&sprites / 64` — VIC-II sprite block number for first sprite |
| `.sprite_offsets` | `word[]` | — | No | Pre-computed byte offsets for each sprite: `[0, 64, 128, ...]`. Size = sprite count |
| **Default** | `.sprites` | | | |

#### CharPad (.ctm)

| Selector | Type | Alignment | Linker-Resolved | Description |
|----------|------|-----------|----------------|-------------|
| `.charset` | `byte[]` | 2048 bytes | No | Character definition data (8 bytes per character) |
| `.screen` | `byte[]` | — | No | Screen/map layout data |
| `.colors` | `byte[]` | — | No | Per-cell color attribute data |
| `.tile_width` | `byte` | — | No | Tile width in characters (if tile mode) |
| `.tile_height` | `byte` | — | No | Tile height in characters (if tile mode) |
| `.charset_base` | `byte` | — | **Yes** | `(&charset >> 11) & $0F` — VIC-II charset pointer bits |
| `.char_offsets` | `word[]` | — | No | Pre-computed byte offsets for each character: `[0, 8, 16, ...]`. Size = character count |
| `.tile_offsets` | `word[]` | — | No | Pre-computed byte offsets for each tile (if tile mode): `[0, tileSize, ...]`. Size = tile count |
| **Default** | error | | | Requires selector |

#### SID (.sid)

| Selector | Type | Alignment | Linker-Resolved | Description |
|----------|------|-----------|----------------|-------------|
| `.data` | `byte[]` | 256 bytes | No | Combined player + music data |
| `.init_address` | `word` | — | No | JSR address to initialize the music |
| `.play_address` | `word` | — | No | JSR address to play one frame of music |
| `.songs` | `byte` | — | No | Number of songs in the file |
| `.start_song` | `byte` | — | No | Default starting song (1-based) |
| `.name` | `byte[]` | — | No | Song name (32 bytes, padded) |
| `.author` | `byte[]` | — | No | Author name (32 bytes, padded) |
| **Default** | `.data` | | | |

#### Koala Paint (.kla / .koa)

| Selector | Type | Alignment | Linker-Resolved | Description |
|----------|------|-----------|----------------|-------------|
| `.bitmap` | `byte[8000]` | 8192 bytes | No | Bitmap pixel data |
| `.screen` | `byte[1000]` | — | No | Screen RAM color data |
| `.color_ram` | `byte[1000]` | — | No | Color RAM data |
| `.background` | `byte` | — | No | Background color |
| `.bitmap_base` | `byte` | — | **Yes** | VIC-II bitmap base pointer |
| **Default** | error | | | Requires selector |

### 5.3 Other Platform Profiles

Format handlers for other platforms follow the same pattern but register handlers for their native asset tools:

**Atari 800XL**: RMT (Raster Music Tracker), Atari font formats, player/missile graphics formats  
**Atari 7800**: MARIA tile graphics formats, TIA sound data  
**Commander X16**: VERA-native graphics formats, PSG audio formats  

These are specified in each platform's profile appendix, not in this core feature document.

### 5.4 Universal Format Handler

The raw binary handler (`.bin` extension) is always available on **all** platforms:

| Selector | Type | Notes |
|----------|------|-------|
| (none) | `byte[]` | Entire file as raw bytes |
| **Default** | raw bytes | No selectors available |

Any file with an unrecognized extension AND no selector is treated as raw binary.

---

## Part 6: Error Codes

### Compile Errors

| Code | Message | Trigger |
|------|---------|---------|
| E10130 | File not found: `{path}` (searched: `{search_paths}`) | `embed()` cannot locate the file |
| E10131 | Embedded file `{path}` is empty (0 bytes) | File has zero bytes — zero-length arrays prohibited (F014 E10111) |
| E10132 | Format `{format}` (`{ext}`) requires a selector | Format handler has no default; selector must be specified |
| E10133 | Unknown selector `{selector}` for format `{format}` (`{ext}`) — available: `{list}` | Selector name not in format handler's registry |
| E10134 | `embed()` can only initialize `const` declarations — found `let` | Used as `let` initializer |
| E10135 | `embed()` can only be used at module level | Used inside a function body |
| E10136 | `embed()` path must be a string literal | Path is a variable, expression, or non-string |
| E10137 | No format handler registered for extension `{ext}` and selector `{selector}` specified | Unknown extension with a selector |
| E10138 | Offset `{offset}` exceeds file size (`{file_size}` bytes) | Offset parameter out of bounds |
| E10139 | Offset `{offset}` + size `{size}` exceeds file size (`{file_size}` bytes) | Partial embed goes past end of file |
| E10140 | Embedded data size mismatch: expected `{expected}` bytes, got `{actual}` bytes | `byte[N]` declaration doesn't match data |
| E10141 | `offset` parameter cannot be used with format-aware selectors | `embed("file.spd", offset: 10).sprites` — offset is for raw mode only |
| E10142 | Cannot use array selector in expression context — array selectors can only initialize `const` declarations | `embed("file.spd").sprites + 1` |
| E10143 | Alignment conflict: `{data}` requires `{align}`-byte alignment but placement failed | Cannot satisfy alignment requirement |
| E10144 | Type mismatch: selector `{selector}` returns `{expected}`, declaration type is `{actual}` | Declared type doesn't match selector's return type |

### Warnings

| Code | Message | Trigger |
|------|---------|---------|
| W10150 | Embedded data (`{N}` bytes) uses `{percent}`% of platform `{platform}` data budget | Approaching platform ROM/data limits |
| W10151 | File `{path}` is embedded `{N}` times — each creates a separate copy in the binary | Same file embedded multiple times (may be intentional) |

---

## Part 7: Feature Interactions

| Feature | Interaction |
|---------|-------------|
| F003 Module contents | `embed()` is valid only as a module-level `const` initializer |
| F005 Memory placement | Embedded data is placed in the data/ROM section (`const` placement) |
| F006 Address-of | `&embeddedData` returns the base address — works the same as any `const byte[]` |
| F008 For loop | Iterate over embedded arrays with `for` — standard array indexing |
| F011 Structs | Embedded data is `byte[]` — can be used with struct-of-arrays patterns |
| F014 Arrays | Embedded data follows all array rules — indexing, length(), const params |
| F014 Const params | Embedded data is `const` — can be passed to `const byte[]` parameters |
| F014 length() | `length(embeddedData)` returns compile-time-known size |
| `export` | `export const DATA: byte[] = embed("file.bin");` — exported embedded data is visible to other modules |

---

## Part 8: Resolved Ambiguities

### DI-A1: What happens when a file has a known extension but no selector?

**Decision**: If the format handler defines a **default selector**, that data is returned. If the format handler requires a selector (no default), it's a compile error (E10132) with a list of available selectors.

### DI-A2: What happens when a file has an unknown extension and a selector?

**Decision**: Compile error E10137 — unknown extensions are treated as raw binary, and raw binary has no selectors.

### DI-A3: Can the same file produce different data for different selectors?

**Decision**: Yes — that's the entire purpose. `embed("player.spd").sprites` and `embed("player.spd").colors` extract different parts of the same file. The file is parsed once (EM-8 caching rule).

### DI-A4: Can `embed()` be used with `[values; fill]` syntax?

**Decision**: No — `embed()` and array initializer syntax are mutually exclusive. `embed()` provides the complete data; there's nothing to fill.

### DI-A5: Can `embed()` appear inside another `embed()`?

**Decision**: No — `embed()` takes a string literal path, not an expression. Nesting is syntactically impossible.

### DI-A6: How are format handler version differences handled?

**Decision**: The format handler specifies which versions it supports (e.g., "SpritePad v2.0, v2.1"). If the file version is unsupported, the format handler emits a descriptive compile error with the supported version range.

### DI-A7: What about files with no extension?

**Decision**: Treated as raw binary — same as `.bin`.

### DI-A8: Can `offset` be used with format-aware files?

**Decision**: No — `offset` is for raw binary mode only. Format handlers manage their own data extraction. Error E10141.

---

## Part 9: Examples

### Example 1: C64 Sprite Animation

```blend65
module SpriteDemo;

import { SPRITE_PTR, SPRITE_ENABLE, VIC_SPRITE_X, VIC_SPRITE_Y } from c64.vic;

// Embed sprite data — compiler handles alignment and block calculation
const PLAYER: byte[] = embed("player.spd").sprites;
const PLAYER_BASE: byte = embed("player.spd").base_block;
const PLAYER_FRAMES: byte = embed("player.spd").count;

let frame: byte = 0;
let delay: byte = 0;

function main(): void {
    // Enable sprite 0
    poke(SPRITE_ENABLE, 1);
    poke(VIC_SPRITE_X, 160);
    poke(VIC_SPRITE_Y, 140);

    // Set initial sprite frame
    poke(SPRITE_PTR, PLAYER_BASE);

    // Main loop
    while (true) {
        // Wait for raster
        while (peek($D012) != 255) { }
        while (peek($D012) == 255) { }

        // Animate
        delay = delay + 1;
        if (delay >= 6) {
            delay = 0;
            frame = frame + 1;
            if (frame >= PLAYER_FRAMES) {
                frame = 0;
            }
            poke(SPRITE_PTR, PLAYER_BASE + frame);
        }
    }
}
```

### Example 2: C64 Music Playback

```blend65
module MusicPlayer;

import { setIRQ } from c64.system;

// Embed SID music
const MUSIC: byte[] = embed("ingame.sid").data;
const MUSIC_INIT: word = embed("ingame.sid").init_address;
const MUSIC_PLAY: word = embed("ingame.sid").play_address;
const SONG_COUNT: byte = embed("ingame.sid").songs;

function main(): void {
    // Initialize music (song 0)
    // Platform library provides call-by-address helper
    callAddress(MUSIC_INIT, 0);

    // Install music player as IRQ handler
    setIRQ(&musicIRQ);

    // Game loop
    while (true) {
        // ... game logic ...
    }
}

interrupt function musicIRQ(): void {
    callAddress(MUSIC_PLAY, 0);
}
```

### Example 3: C64 Character Map Display

```blend65
module LevelDisplay;

import { VIC_CHARSET_PTR, SCREEN_BASE, COLOR_BASE } from c64.vic;

// Embed CharPad data
const CHARS: byte[2048] = embed("level1.ctm").charset;
const SCREEN: byte[1000] = embed("level1.ctm").screen;
const COLORS: byte[1000] = embed("level1.ctm").colors;
const CHARS_PTR: byte = embed("level1.ctm").charset_base;

function displayLevel(): void {
    // Point VIC-II to our custom charset
    poke(VIC_CHARSET_PTR, CHARS_PTR);

    // Copy screen data to screen RAM
    for (let i: word = 0 to 999) {
        poke(SCREEN_BASE + i, SCREEN[i]);
    }

    // Copy color data to color RAM
    for (let i: word = 0 to 999) {
        poke(COLOR_BASE + i, COLORS[i]);
    }
}
```

### Example 4: Raw Binary Lookup Table

```blend65
module Tables;

// Raw binary — no format handler, just bytes
const SINE: byte[256] = embed("sine_table.bin");

// Partial embed — take first 128 bytes
const HALF_SINE: byte[128] = embed("sine_table.bin", offset: 0);

// Export for use by other modules
export const COLOR_CYCLE: byte[] = embed("colors.bin");
```

### Example 5: Koala Bitmap Display

```blend65
module KoalaViewer;

import { VIC_BANK, VIC_MODE, VIC_BG_COLOR } from c64.vic;

const BITMAP: byte[8000] = embed("picture.kla").bitmap;
const BMP_SCREEN: byte[1000] = embed("picture.kla").screen;
const BMP_COLORS: byte[1000] = embed("picture.kla").color_ram;
const BMP_BG: byte = embed("picture.kla").background;

function showPicture(): void {
    // Set background color from image
    poke(VIC_BG_COLOR, BMP_BG);

    // Enable multicolor bitmap mode and point to data
    // (platform library helpers handle VIC-II configuration)
    setupBitmapMode(&BITMAP, &BMP_SCREEN);

    // Copy color RAM
    for (let i: word = 0 to 999) {
        poke(COLOR_BASE + i, BMP_COLORS[i]);
    }
}
```

### Example 6: Offset Table — Eliminate Runtime Multiply

```blend65
module TileEngine;

import { SCREEN_BASE } from c64.vic;

// Embed tileset with pre-computed offset table
const TILESET: byte[] = embed("tiles.ctm").charset;
const TILE_OFFSETS: word[] = embed("tiles.ctm").char_offsets;
// Compiler generates: [0, 8, 16, 24, ..., 2040] — array size inferred from file

function drawTile(tileIndex: byte, screenPos: word): void {
    // Fast lookup — NO runtime multiply!
    let dataOffset: word = TILE_OFFSETS[tileIndex];  // ~8 cycles (word array lookup)

    // Copy 8 bytes of tile data to screen
    for (let row: byte = 0 to 7) {
        poke(SCREEN_BASE + screenPos + word(row), TILESET[dataOffset + word(row)]);
    }
}

// Compare: without offset table, you'd need:
//   let dataOffset: word = word(tileIndex) * 8;   // 3 shifts — cheap but adds up in loops
// For non-power-of-2 strides (e.g., 40 bytes per row), the offset table saves ~30+ cycles per lookup
```

---

## Part 10: Code Generation

### 10.1 Raw Binary

Raw binary embedding has zero code generation overhead — the bytes are placed directly in the output data section:

```
; embed("table.bin") → 256 bytes in data section
LOOKUP_TABLE:
    .byte $00, $03, $06, $09, ...  ; file contents verbatim
```

### 10.2 Format-Aware Data

Format handlers extract and transform data during compilation. The output is the same as raw binary — bytes in the data section:

```
; embed("player.spd").sprites → extracted sprite data, 64-byte aligned
    .align 64
PLAYER_SPRITES:
    .byte $00, $7E, $00, ...  ; sprite pixel data extracted from .spd format
    .byte $00                  ; padding to 64-byte boundary per sprite

; embed("player.spd").base_block → linker-resolved constant
PLAYER_BASE = PLAYER_SPRITES / 64    ; assembler/linker calculates this
```

### 10.3 Resource Cost

| Item | RAM | ROM/Binary | Zero Page |
|------|-----|------------|-----------|
| `embed()` raw | 0 | File size | 0 |
| `embed().selector` (array) | 0 | Extracted data size | 0 |
| `embed().selector` (scalar) | 0 | 0 (inlined constant) | 0 |
| Format handler alignment padding | 0 | 0–(align-1) bytes | 0 |

Embedded data is `const` — always in ROM/data section, never in RAM.

---

## Part 11: Language Guard Evaluation

| Rule | Status | Notes |
|------|--------|-------|
| **P1** Cross-platform compilable | ✅ | `embed()` compiles on all platforms. Raw mode always available. Format handlers are per-profile |
| **P2** Platform-meaningful | ✅ | Every platform has asset tools. The format handler system makes embed useful everywhere |
| **P3** No platform assumptions | ✅ | Core spec defines `embed()` generically. Format names, selectors, and alignment requirements live in platform profiles |
| **P4** Resource-scalable | ✅ | W10150 warns when approaching data budget. Platform profile defines budget |
| **H1** 6502 implementable | ✅ | Embedded data is just bytes in the binary — no CPU features required |
| **H2** Cost transparency | ✅ | Zero runtime cost. ROM cost = data size + alignment padding. Build summary shows exact placement |
| **H3** SFA compatible | ✅ | Embedded data is `const` — no mutable state, no frame allocation |
| **H4** Memory footprint documented | ✅ | Part 10.3 documents resource costs. Build summary shows per-asset totals |
| **H5** Fully deterministic | ✅ | File exists → data included. File missing → E10130. All edge cases produce defined errors |
| **L1** Unambiguous syntax | ✅ | `embed("path")` or `embed("path").selector` — EBNF in Part 1. No parsing ambiguity |
| **L2** Consistent with existing | ✅ | Dot notation follows struct field access pattern. Intrinsic call follows `sizeof()`, `length()` pattern |
| **L3** Beginner-friendly | ✅ | `embed("player.spd").sprites` reads naturally. Error messages list available selectors |
| **L4** Minimal feature | ✅ | One intrinsic, optional dot selector. Format complexity is in platform profiles, not core language |
| **L5** No redundancy | ✅ | No other way to include binary data exists in the language |
| **L6** Error messages defined | ✅ | 15 error codes (E10130-E10144), 2 warning codes (W10150-W10151). Part 6 |
| **L7** Compile-time failure | ✅ | All errors are compile-time. No runtime failure possible — data is in the binary |
| **L8** Feature interactions | ✅ | Part 7 documents interactions with F003, F005, F006, F008, F011, F014 |
| **L9** Documentable with examples | ✅ | Part 9: five examples covering sprites, music, charmaps, raw binary, bitmaps |
| **C1** Lexer/parser implementable | ✅ | `embed` keyword, `(`, string literal, optional `,offset:expr`, `)`, optional `.identifier`. Standard tokens |
| **C2** Semantic analysis defined | ✅ | Type checking: selector return type vs declared type. Scope: module-level const only. Validation: file existence, size matching |
| **C3** Code generation strategy | ✅ | Part 10 documents codegen: bytes placed in data section, alignment via assembler directive, linker-resolved constants |
| **C4** Unit testable | ✅ | Lexer: `embed` → `KW_EMBED`, `(` → `LPAREN`, etc. Parser: embed-expression AST node. Semantic: type validation. Codegen: data section bytes |
| **C5** Runtime verifiable | ✅ | Embedded data can be verified by reading memory locations in emulator and comparing against source file bytes |
| **F1** Extensible | ✅ | New format handlers added to platform profiles without language changes. New selectors don't break existing code |
| **F2** Platform-profile ready | ✅ | All format-specific behavior (handlers, selectors, alignment) is in platform profiles |
| **F3** Optimizer-friendly | ✅ | Embedded data is read-only constants — optimizer can propagate scalar values, dead-code-eliminate unused embeds |
| **F4** Stability classification | ✅ | **Stable** — `embed()` syntax and raw mode. **Provisional** — format handler interface (may be refined as more formats are implemented) |

**Verdict: ✅ ACCEPTED — all 23 rules pass**

---

## Deferred Items

### → FUT-014: Manual alignment attribute

Manual alignment for non-asset data (e.g., page-aligning a hand-written sine table) is deferred. See `future-considerations.md`.

### → FUT-015: Common image format conversion

Automatic conversion of modern image formats (PNG, BMP) to platform-native graphics formats is deferred. See `future-considerations.md`.
