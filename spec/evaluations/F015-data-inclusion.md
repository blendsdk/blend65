# F015 — Data Inclusion (Asset Embedding)

> **Status**: ✅ ACCEPTED  
> **Stability**: stable  
> **Depends on**: F003 (module contents), F005 (memory placement), F014 (arrays, const params)  
> **Interacts with**: F006 (address-of), F011 (structs)

---

## Description

The `embed()` intrinsic includes external binary data into the compiled program at compile time. It supports two modes:

1. **Raw binary inclusion** — embeds file bytes directly, no format interpretation
2. **Format-aware asset import** — uses platform-profile-registered format handlers to parse asset files (SpritePad, CharPad, SID, etc.) and extract specific data parts through literal selector keys

This eliminates the manual conversion step between third-party asset tools and Blend65 source code. Developers work directly with native asset file formats — the compiler handles parsing and extraction.

```blend65
// Raw binary — any platform, any file
const LOOKUP: byte[] = embed("table.bin");

// Format-aware — SpritePad file, compiler extracts sprite data
const SPRITES: byte[] = embed("player.spd", "sprites");
const SPRITE_BASE: byte = vicSpriteBlock(&SPRITES);

// SID music — compiler parses SID header
const MUSIC: byte[] = embed("music.sid", "data");
const MUSIC_INIT: word = embed("music.sid", "init_address");
const MUSIC_PLAY: word = embed("music.sid", "play_address");

// CharPad — compiler preserves the file's character, tile, map, and color layers
const CHARSET: byte[] = embed("level.ctm", "charset");
const TILES: byte[] = embed("level.ctm", "tiles");
const MAP: byte[] = embed("level.ctm", "map");
```

---

## Part 1: The `embed()` Intrinsic

### 1.1 Syntax

```ebnf
embed_expr       = "embed" , "(" , string_literal , [ "," , string_literal ] , ")" ;
```

`embed()` is a **compile-time intrinsic** — the file is read during compilation and its bytes become part of the output binary. There is no runtime file I/O.

### 1.2 Core Rules

| Rule | ID | Decision |
|------|----|----------|
| Compile-time only | EM-1 | `embed()` is evaluated at compile time. The referenced file must exist when the compiler runs |
| Always `const` | EM-2 | `embed()` can only appear as the initializer of a `const` declaration. Source cannot mutate it; a qualified player contract may separately own declared writable/self-modifying physical ranges |
| Module-level only | EM-3 | `embed()` can only be used at module level — `const` declarations are module-level (F003) |
| Dispatch and result type | EM-4 | A registered extension always invokes and validates its handler. An explicit selector chooses its enumerated result; omission uses the handler's default or E10132. Only an unregistered extension without a selector produces raw `byte[]` bytes |
| Path is string literal | EM-5 | The file path must be a string literal, not a variable or expression |
| Selector is string literal | EM-5a | When present, the selector must be one string literal, not a variable or expression |
| Forward-slash paths | EM-6 | File paths always use `/` as separator. The compiler normalizes to the host filesystem |
| Path resolution | EM-7 | Paths are resolved relative to the source file's directory. Additional search paths can be specified with the `--asset-path <dir>` compiler flag |
| File caching | EM-8 | When multiple `embed()` calls reference the same file, the compiler parses the file **once** and caches the result. All selectors on the same file share the cached parse |
| Opaque selector key | EM-9 | The selector is an exact, case-sensitive key resolved by the format handler. The core language does not split dots or define a generic member/query language |

### 1.3 Raw Binary Fallback

When `embed()` has no selector and the extension has no registered handler, the file bytes are
included directly with no format interpretation:

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

Raw mode therefore requires both an unregistered extension and no selector. A selector on an
unregistered extension is E10137. A registered extension always dispatches its handler, even when
the selector is omitted.

## Part 2: Format-Aware Asset Import

### 2.1 Format Handlers

Platform profiles register **format handlers** — compiler components that understand specific asset file formats. Each handler declares:

1. **File extensions** it handles (e.g., `.spd`, `.ctm`, `.sid`)
2. **Selectors** — named data parts that can be extracted
3. **Return type** per parsed-file selector — `byte[]`, `word[]`, `byte`, `word`, or `boolean`; a
   handler may choose among declared alternatives from validated file content
4. **Alignment requirement** per selector — if the data needs specific memory alignment
5. **Linker-resolved flag** — whether the selector's value depends on final address assignment
6. **Default selector** — what to return when no selector is specified (or error if format requires one)

### 2.2 Literal Selector Keys

When a file has a registered format handler, the optional second argument chooses an exact key:

```blend65
const SPRITES: byte[]      = embed("player.spd", "sprites");
const COUNT: word          = embed("player.spd", "count");
const BACKGROUND: byte     = embed("player.spd", "background_color");
const SPRITE_ATTRS: byte[] = embed("player.spd", "sprite_attributes");
```

The key is opaque to the core language. A simple format can expose fixed keys such as
`"sprites"`. A container format can expose keys derived from the parsed file, such as
`"layer.hero"`, when its handler defines that convention. A dot inside the string has no built-in
meaning. The handler enumerates the exact keys valid for that file, so diagnostics and language
tools can present completion without inventing a universal selector language.

The compiler:
1. Uses the file extension (`.spd`) to select a candidate format handler
2. Validates the file signature and supported version through that handler
3. Parses the file using the handler
4. Validates the selector name against the exact set enumerated for the parsed file
5. Validates the declared type against that parsed selector's return type
6. Extracts the data

### 2.3 Type Validation

The declared variable type must match the return type enumerated for that selector and parsed file:

```blend65
// ✅ "sprites" returns byte[] — matches byte[]
const SPRITES: byte[] = embed("player.spd", "sprites");

// ✅ "init_address" returns word — matches word
const INIT: word = embed("music.sid", "init_address");

// ❌ E10144: "sprites" returns byte[], not byte
const WRONG: byte = embed("player.spd", "sprites");

// ❌ E10144: "init_address" returns word, not byte[]
const ALSO_WRONG: byte[] = embed("music.sid", "init_address");
```

For array selectors, explicit size is validated:

```blend65
// ✅ "charset" returns byte[] — file contains exactly 2048 bytes of charset data
const CHARS: byte[2048] = embed("level.ctm", "charset");

// ❌ E10140: selector 'charset' produces 2048 bytes, array size is 1024
const WRONG: byte[1024] = embed("level.ctm", "charset");

// ✅ Size inferred from selector output
const CHARS2: byte[] = embed("level.ctm", "charset");
```

### 2.4 Scalar Selectors in Expressions

Selectors that return scalar types (`byte`, `word`, `boolean`) resolve to compile-time constants and can be used in const expressions:

```blend65
const SPRITE_COUNT: word = embed("player.spd", "count");
const LAST_SPRITE: word = embed("player.spd", "count") - 1;  // ✅ Const expression

// ✅ Scalar selector in const expression
const MUSIC_PLAY: word = embed("music.sid", "play_address");
```

Array selectors (returning `byte[]` or `word[]`) can **only** appear as initializers — they cannot
be used in expressions:

```blend65
// ❌ E10142: array selector cannot be used in expression context
let x: byte = embed("player.spd", "sprites") + 1;
```

### 2.5 Default Selectors

A format handler may define a **default selector** — the data returned when the second argument is omitted:

```blend65
// SID format handler defines default: "data" (player + music combined)
const MUSIC: byte[] = embed("music.sid");            // Same as selector "data"
const MUSIC2: byte[] = embed("music.sid", "data");  // Explicit — same object/address
```

The two names are aliases for one source-immutable emitted SID payload. The compiler validates and places
the fixed-address output once, counts its bytes once, and emits W10151 to make the shared identity
visible; it does not create an impossible second copy at the same load address.

If a format **requires** a selector (no sensible default), omitting it triggers E10132. The
diagnostic can enumerate the handler's registered selectors as contextual help, but
[Chapter 14](../14-diagnostics.md) alone owns its public template, spans, notes, and help format.

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
  player.spd  "sprites"     → $2000  (1024 bytes, align:64 ✓, block base: 128)
  player.spd  "sprite_attributes" → $2400  (16 derived bytes, explicitly requested)
  music.sid   "data"        → $2800  (4096 bytes, fixed load ✓)
  level.ctm   "charset"     → $3800  (2048 bytes, align:2048 ✓, VIC bank-visible ✓)
  level.ctm   "tiles"       → $4000  (512 bytes, 64 tiles × 2 × 4)
  level.ctm   "map"         → $4200  (1000 bytes, 40 × 25 tile indices)
  table.bin   (raw)        → $43E8  (256 bytes)
  Total embedded: 8384 bytes
```

---

## Part 4: Linker-Resolved Values

### 4.1 The Problem

Some metadata values depend on WHERE the compiler places the data in memory. These can't be known when the file is parsed — they're calculated after address assignment.

**Example**: On the C64, VIC-II sprite pointers need a "block number" = address / 64. The block number depends on where the sprite data is placed.

### 4.2 Linker-Resolved Values

Platform operations and format handlers may produce **linker-resolved** values computed after
address assignment. Placement-derived hardware fields do not belong to an asset-file handler when
the file itself does not contain them:

```blend65
// Calculated from final placement; not a field in the SpritePad file.
const SPRITE_BASE: byte = vicSpriteBlock(&SPRITES);
```

**Rules:**

| Rule | ID | Decision |
|------|----|----------|
| Linker-resolved = const | LR-1 | Linker-resolved values produce compile-time constants (value known before runtime) |
| Used in expressions | LR-2 | Linker-resolved scalar values can be used in const expressions: `SPRITE_BASE + frame` |
| Alignment prerequisite | LR-3 | A linker-resolved selector that computes `address / N` requires its data selector to have N-byte alignment. The format handler enforces this |
| Build summary | LR-4 | Linker-resolved values are shown in the build summary for verification |

### 4.3 How This Solves the Sprite Alignment Problem

The previous Blend65 version had alignment bugs with sprite block calculations. This design eliminates the problem by making the compiler responsible for both alignment AND block calculation:

```blend65
import { SPRITE_PTR, SPRITE_ENABLE, vicSpriteBlock } from c64.vic;

// The compiler:
// 1. Parses player.spd (SpritePad format)
// 2. Extracts sprite pixel data
// 3. Places data at 64-byte aligned address (format handler requirement)
// 4. Calculates the VIC-bank-relative block number from the final address
const PLAYER_SPRITES: byte[] = embed("player.spd", "sprites");
const PLAYER_BASE: byte = vicSpriteBlock(&PLAYER_SPRITES);
const PLAYER_FRAMES: word = embed("player.spd", "count");

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
  name:         Human-readable format name (e.g., "SpritePad project format")
  extensions:   File extensions (e.g., [".spd"])
  versions:     Supported signature/version set
  selectors:    Exact selector definitions enumerated after parsing the file
  default:      Default selector name, or null (requires explicit selector)
```

Each selector definition:

```
Selector Definition:
  name:         Exact case-sensitive string key (e.g., "sprites" or "layer.hero")
  type:         Return type — byte[], word[], byte, word, boolean
  alignment:    Required byte alignment, or null (no requirement)
  linker_resolved: boolean — true if value depends on placement address
  description:  Human-readable description (for error messages and IDE tooltips)
```

### 5.2 C64 Platform Profile — Format Handlers

The C64 platform profile registers handlers for common C64 asset tools:

#### SpritePad (.spd)

| Selector | Type | Alignment | Linker-Resolved | Description |
|----------|------|-----------|----------------|-------------|
| `"sprites"` | `byte[]` | 64 bytes plus VIC-bank visibility | No | Exact 64-byte SPD v5 records: 63 bitmap bytes followed by the packed per-sprite attribute byte |
| `"count"` | `word` | — | No | Number of sprites in the file |
| `"background_color"` | `byte` | — | No | Global transparent/background color |
| `"multicolor_1"` | `byte` | — | No | First global multicolor value |
| `"multicolor_2"` | `byte` | — | No | Second global multicolor value |
| `"sprite_attributes"` | `byte[]` | — | No | Explicit derived table containing the packed attribute byte for each sprite |
| `"tile_count"` | `word` | — | No | Number of sprite tiles |
| `"tile_width"` | `byte` | — | No | Tile width in sprites |
| `"tile_height"` | `byte` | — | No | Tile height in sprites |
| `"tiles"` | `word[]` | — | No | Native row-major sprite indices for every tile |
| `"tile_attributes"` | `byte[]` | — | No | Native per-tile attribute bytes |
| `"tile_tags"` | `byte[]` | — | No | Native per-tile tag bytes |
| `"sprite_overlay_distance"` | `word` | — | No | Offset from an underlay sprite to its overlay partner |
| `"tile_overlay_distance"` | `word` | — | No | Offset from an underlay tile to its overlay partner |
| `"sprite_animation_count"` | `word` | — | No | Number of sprite animation records |
| `"sprite_animation_starts"` | `word[]` | — | No | First sprite index for each sprite animation |
| `"sprite_animation_ends"` | `word[]` | — | No | Last sprite index for each sprite animation |
| `"sprite_animation_timers"` | `byte[]` | — | No | Native timer byte for each sprite animation |
| `"sprite_animation_flags"` | `byte[]` | — | No | Native flags for each sprite animation |
| `"tile_animation_count"` | `word` | — | No | Number of tile animation records |
| `"tile_animation_starts"` | `word[]` | — | No | First tile index for each tile animation |
| `"tile_animation_ends"` | `word[]` | — | No | Last tile index for each tile animation |
| `"tile_animation_timers"` | `byte[]` | — | No | Native timer byte for each tile animation |
| `"tile_animation_flags"` | `byte[]` | — | No | Native flags for each tile animation |
| **Default** | `"sprites"` | | | |

The initial C64 profile pins SpritePad Pro 3.80 and accepts only its SPD v5 project files. The
handler validates the `SPD` signature, version byte, declared counts, component flags, lengths,
indices, and record boundaries before producing any selector. SPD v5 tile names are compile-time
lookup metadata; they are not emitted as runtime strings. Empty optional components produce empty
arrays and a zero count.

There is no file-wide `"multicolor"` selector. Color, multicolor mode, X/Y expansion, and overlay
status are fields of each packed sprite attribute byte. C64 platform operations read those fields
directly from the 64th byte of a selected sprite record without copying the table. A program that
explicitly selects `"sprite_attributes"` instead requests a contiguous derived table; the build
summary reports its additional bytes, and selecting both forms does not silently alias or hide the
duplication.

SpritePad does not define `"base_block"` or implicit sprite-offset selectors. The zero-runtime-cost
C64 operation `vicSpriteBlock(&SPRITES)` derives the first VIC-II block number from final placement,
checks 64-byte alignment and VIC-bank visibility, and fails at compile/link time if those conditions
cannot be proven. Further frames use ordinary block arithmetic only while they remain in the same
visible VIC bank; larger sets require an explicit bank/loader layout rather than silent wrapping.

#### CharPad (.ctm)

The initial C64 profile is qualified against CharPad C64 Pro 3.88 and accepts only the observable
ASCII `CTM` signature plus CTM version 9. It validates the complete profile-pinned header and
ordered-block structure, including all conditional blocks, counts, dimensions, indices, lengths,
boundaries, and exact end of file. The application release itself is provenance rather than a file
field. The handler has no default selector.

| Selector | Type | Alignment | Linker-Resolved | Description |
|----------|------|-----------|----------------|-------------|
| `"charset"` | `byte[]` | 2048 bytes plus VIC-bank visibility | No | Character images in character-number order, exactly 8 bytes per character |
| `"tiles"` | `byte[]` or `word[]` | — | No | In tile mode, row-major character indices using the smallest lossless logical element type; absent outside tile mode |
| `"map"` | `byte[]` or `word[]` | — | No | Row-major tile indices in tile mode, otherwise row-major character indices, using the smallest lossless logical element type |
| `"tiles_word"` | `word[]` | — | No | Forced 16-bit little-endian tile indices, even when the canonical layer uses bytes; absent outside tile mode |
| `"map_word"` | `word[]` | — | No | Forced 16-bit little-endian map indices, even when the canonical layer uses bytes |
| `"tiles_packed12"` | `byte[]` | — | No | File-derived packed-12 tile indices; available in tile mode when every index is at most 4095 |
| `"map_packed12"` | `byte[]` | — | No | File-derived packed-12 map indices; available when every index is at most 4095 |
| `"tiles_low"` | `byte[]` | — | No | Low-byte plane for tile indices; available in tile mode |
| `"tiles_high"` | `byte[]` | — | No | High-byte plane for tile indices; available in tile mode |
| `"map_low"` | `byte[]` | — | No | Low-byte plane for map indices |
| `"map_high"` | `byte[]` | — | No | High-byte plane for map indices |
| `"colors"` | `byte[]` | — | No | The native CharPad color table for the file's color method; not synthesized per-cell color RAM |
| `"color_method"` | `byte` | — | No | Native CharPad color-method identifier needed to interpret `"colors"` |
| `"map_width"` | `word` | — | No | Map width in map entries |
| `"map_height"` | `word` | — | No | Map height in map entries |
| `"tile_width"` | `byte` | — | No | Tile width in characters; `1` outside tile mode |
| `"tile_height"` | `byte` | — | No | Tile height in characters; `1` outside tile mode |
| `"tile_mode"` | `boolean` | — | No | Whether `"tiles"` exists and `"map"` indexes tiles rather than characters |
| **Default** | error | | | Requires selector |

For each parsed `"tiles"` or `"map"` layer, a maximum referenced index of 255 selects `byte[]`; a
larger index selects `word[]` with little-endian elements. A declaration that names the other type
fails with E10144 and reports the required type. This prevents truncation without misclassifying a
valid current-format project as a parse error. `"tiles_word"` and `"map_word"` keep an explicitly
stable `word[]` contract irrespective of the current maximum index.

When the corresponding layer exists and every index is at most 4095, the parsed selector set also
offers `"tiles_packed12"` or `"map_packed12"` as `byte[]`. Given `N` logical values, it emits their
`N` low bytes first, followed by `ceil(N/2)` bytes that pack the even value's high nibble low and
the odd value's high nibble high. The unused upper nibble is zero for odd `N`; for example,
`$123,$456,$789` becomes `$23,$56,$89,$41,$07`. Independently requested `"tiles_low"`/`"tiles_high"` and
`"map_low"`/`"map_high"` selectors provide byte planes for 6502 code. An unavailable packed selector
is E10133, whose available-selector list shows the lossless alternatives. The handler never
flattens a tile map into a screen, invents per-cell colors, or emits character/tile offset tables.

Only explicitly referenced representations are emitted. Parsing one file may be cached, but that
does not authorize emission of unreferenced layers, canonical/forced-word/packed/split companions,
or duplicate runtime copies. Raw binary exports remain usable through raw `embed(path)`, but they
do not gain CTM metadata or selector semantics. If a program explicitly asks
a separate compiler/platform operation to build an offset table, that table is a separately named
asset and its ROM/RAM placement cost appears in the build summary.

CharPad does not define a `"charset_base"`, `"tiles_base"`, `"char_offsets"`, or implicit
`"tile_offsets"` selector. VIC-II register bits depend on final placement and the selected VIC bank,
not on the CTM file. The C64 platform library supplies the separate zero-cost compile-time operation
`vicCharsetSelect(&CHARSET)`. It validates 2048-byte alignment and VIC-bank visibility, then returns
the already-positioned `$D018` character-memory field:

```
((addressWithinVicBank / 2048) & $07) << 1
```

The operation emits no data, call, or runtime calculation.

#### SID (.sid)

The initial handler uses the official HVSC `SID_file_format.txt` snapshot retrieved 2026-09-06
(source key `HVSC-SID-FORMAT-20260906`, SHA-256
`b89a78d3c1d90d0b8c6b4cfd2001be026ad6c2c31b73cdbab857c627a60779f0`) and accepts only the
self-contained, directly callable, C64-compatible PSID v1–v4 subset. It validates `PSID` magic,
version-specific `$0076`/`$007C` data offsets, big-endian header fields, legal flags/reserved fields,
song ranges, relocation/SID-address fields, selected-profile clock/model compatibility, a non-empty
non-wrapping payload, and effective init/play addresses inside the payload. `RSID`, MUS-player,
PlaySID-specific, and zero-play-address inputs are E10204. A valid PSID with video, chip-model, or
multi-SID requirements incompatible with the selected `video_standard`, `sid_chips`, or callable
player contract is E10261.

PSID v1 has no clock/model flags and therefore makes no claim. PSID v2NG through v4 decodes clock
bits as Unknown, PAL, NTSC, or PAL-and-NTSC and the primary SID-model bits as Unknown, MOS6581,
MOS8580, or both. Second/third SID Unknown model bits inherit the primary requirement. Unknown
permits embed-only data but does not prove callable compatibility: the exact hash-bound player
contract must include the selected profile configuration. Specific header restrictions and player
contracts are intersected and cannot be overridden. The current single-SID profiles reject every
second/third SID with E10261; no header activates hardware or causes automatic retiming/retuning.

When the header load address is zero, the handler reads and strips the payload's initial
little-endian load address. A zero init address resolves to the effective load address. The linker
places the payload exactly there; the handler does not claim that SID machine code is freely
relocatable and does not add a runtime copy.

| Selector | Type | Alignment | Linker-Resolved | Description |
|----------|------|-----------|----------------|-------------|
| `"data"` | `byte[]` | Fixed effective load address | Yes | Combined player + music payload |
| `"init_address"` | `word` | — | No | Effective JSR address to initialize the music |
| `"play_address"` | `word` | — | No | Nonzero JSR address to play the music at its declared cadence |
| **Default** | `"data"` | | | |

##### Callable game-audio contract

The PSID header does not define sound effects, voice arbitration, writable player state, or
interrupt ownership. Its payload is callable through `c64.audio` only when the handler attaches
provenance to an exact hash-bound `audio_player_contracts` entry. Without that match, inclusion is
still legal but an audio operation is E10256; the compiler never infers an SFX ABI from PSID.

The player-neutral operations initialize the default, a zero-based numeric, or a compile-time named
song; execute exactly one source-scheduled tick; and trigger a compile-time named effect using either
contract-defined arbitration or logical SID voice `0..2`. E10257 owns an unavailable operation,
name, numeric form/range, or voice. E10258 owns a reachable overlap with a non-reentrant player
operation. Constant calls lower directly to the player's register loads and absolute `JSR` entry.
There is no compiler runtime, name table, generic dispatcher, queue, mixer, scheduler, or copied
payload. Player-native queues and arbitration remain legal only when their exact costs and behavior
are part of the contract.

The contract declares the exact player/export identity; placement and writable/self-modifying
ranges; every entry ABI and clobber; stack, RAM, zero-page, MMIO, banking, decimal, interrupt, and
`$01` effects; song/effect inventory; dynamic-ID rules; logical voice mapping; arbitration and
resume behavior; cadence, reentrancy, and call domains; CIA/SID/filter ownership; chip/video
assumptions; and feature-dependent byte/cycle costs. Source `const` prevents user writes but does not
make player-owned state ROM-safe. The build report includes all those selected costs and ranges.

GoatTracker 2.77 is the first qualified adapter family, including its optional player-native SFX
entry and feature-pruned export. A minimal SFX-only player and a hash-bound custom player are equal
supported paths. SID Factory II is only the next adapter candidate until independently qualified;
GTUltra and multi-SID need a later multi-SID/C64U profile.

#### Koala Paint (.kla / .koa)

The handler accepts only the classic native 10,003-byte file: two-byte little-endian load address
`$6000`, 8,000 bitmap bytes, 1,000 screen-matrix bytes, 1,000 color-RAM bytes, and one background
byte. The load address is validated and stripped. Every color-RAM byte and the background byte must
have a zero upper nibble. An extension selects the candidate handler but does not prove the format;
wrong length, address, component boundary, or color value is E10204.

| Selector | Type | Alignment | Linker-Resolved | Description |
|----------|------|-----------|----------------|-------------|
| `"bitmap"` | `byte[8000]` | 8192 bytes and selected-VIC-bank visible | No | Bitmap pixel data |
| `"screen"` | `byte[1000]` | 1024 bytes and same selected VIC bank as bitmap | No | Screen-matrix color data |
| `"color_ram"` | `byte[1000]` | — | No | Low-nibble color-RAM data; runtime transfer is explicit |
| `"background"` | `byte` | — | No | Background color |
| **Default** | error | | | Requires selector |

Only explicitly selected components are emitted and reported. Placement-dependent `$D018` fields
are not selectors. `vicBitmapSelect(&BITMAP)` and `vicScreenSelect(&SCREEN)` validate 8-KiB bitmap
alignment, 1-KiB screen alignment, a common selected VIC bank, and legal bank-relative offsets,
then return the already-positioned bitmap and screen fields with no emitted runtime work. The
selected `"color_ram"` bytes still require an explicit, costed transfer to the C64 color-RAM
window; the format handler never hides that copy.

### 5.3 Other Platform Profiles

Other platforms follow the same handler boundary but do not gain a format merely because a likely
tool or extension can be named. The initial Atari 800XL and Atari 7800 profiles expose raw embedding
only. Their native/project handlers are deferred to their separately researched expert-skill
extensions, which must pin exact versions or observable identities, selector types, validation,
emitted layouts, placement rules, costs, and fixtures before updating the platform appendix.
The initial Commander X16 profile also exposes raw embedding only. Its first separately qualified
platform-skill extension will reconsider official ZSM revision 1, then any BMX or conversion format
whose identity, transformation, layout, and fixtures can be pinned. No Atari decision supplies or
removes X16 support.

### 5.4 Universal Raw Fallback

Raw inclusion is not a registered format handler. It applies on **all** platforms when the file's
extension is absent from the selected profile's `embed_formats`, including `.bin` when no profile
has explicitly registered that extension:

| Selector | Type | Notes |
|----------|------|-------|
| (none) | `byte[]` | Entire file as raw bytes |
| **Default** | raw bytes | No selectors available |

Any such unregistered extension with no selector is included as raw bytes. Supplying a selector is
E10137; a registered extension always uses its handler and never bypasses validation through this
fallback.

---

## Part 6: Error Codes

### Compile Errors

| Code | Public presentation | Rationale trigger |
|------|---------|---------|
| E10130 | [Chapter 14](../14-diagnostics.md) | `embed()` cannot locate the file |
| E10131 | [Chapter 14](../14-diagnostics.md) | A selected raw input file has zero bytes and is rejected as an invalid asset input |
| E10132 | [Chapter 14](../14-diagnostics.md) | Format handler has no default; selector must be specified |
| E10133 | [Chapter 14](../14-diagnostics.md) | Selector name not in format handler's registry |
| E10134 | [Chapter 14](../14-diagnostics.md) | Used as `let` initializer |
| E10135 | [Chapter 14](../14-diagnostics.md) | Used inside a function body |
| E10136 | [Chapter 14](../14-diagnostics.md) | Path is a variable, expression, or non-string |
| E10137 | [Chapter 14](../14-diagnostics.md) | Unknown extension with a selector |
| E10140 | [Chapter 14](../14-diagnostics.md) | Explicit array length does not match the selected array's element count |
| E10142 | [Chapter 14](../14-diagnostics.md) | `embed("file.spd", "sprites") + 1` |
| E10143 | [Chapter 14](../14-diagnostics.md) | Cannot satisfy alignment requirement |
| E10144 | [Chapter 14](../14-diagnostics.md) | Declared type doesn't match selector's return type |
| E10204 | [Chapter 14](../14-diagnostics.md) | Recognized format is malformed or has an unsupported registered-version identity |
| E10250 | [Chapter 14](../14-diagnostics.md) | Selector argument is a variable, expression, or non-string |
| E10256 | [Chapter 14](../14-diagnostics.md) | Audio operation receives an asset without a qualified player contract |
| E10257 | [Chapter 14](../14-diagnostics.md) | Audio operation, cue, numeric form/range, or voice is absent from the selected contract |
| E10258 | [Chapter 14](../14-diagnostics.md) | Reachability permits unsafe overlap with a non-reentrant audio operation |
| E10261 | [Chapter 14](../14-diagnostics.md) | A valid SID asset's specific target requirements are incompatible with the selected profile or player contract |

### Warnings

| Code | Public presentation | Rationale trigger |
|------|---------|---------|
| W10150 | [Chapter 14](../14-diagnostics.md) | Approaching the platform binary-size limit |
| W10151 | [Chapter 14](../14-diagnostics.md) | Several declaration names resolve to one canonical path/selector/representation and therefore share one emitted object/address |

---

## Part 7: Feature Interactions

| Feature | Interaction |
|---------|-------------|
| F003 Module contents | `embed()` is valid only as a module-level `const` initializer |
| F005 Memory placement | Ordinary embedded data uses data/ROM placement; a qualified contract may require declared player-owned writable/self-modifying ranges in RAM |
| F006 Address-of | `&embeddedData` returns the base address — works the same as any const array |
| F008 For loop | Iterate over embedded arrays with `for` — standard array indexing |
| F011 Structs | Embedded arrays may be `byte[]` or `word[]` and can be used with struct-of-arrays patterns |
| F014 Arrays | Embedded data follows all array rules — indexing, length(), const params |
| F014 Const params | Embedded data is `const` and can be passed to a matching const-array parameter |
| F014 length() | `length(embeddedData)` returns compile-time-known size |
| C64 game audio | An exact handler-attached player contract may make an embedded object callable without inferring behavior from its file header |
| `export` | `export const DATA: byte[] = embed("file.bin");` — exported embedded data is visible to other modules |

---

## Part 8: Resolved Ambiguities

### DI-A1: What happens when a file has a known extension but no selector?

**Decision**: If the format handler defines a **default selector**, that data is returned. If the format handler requires a selector (no default), it's a compile error (E10132) with a list of available selectors.

### DI-A2: What happens when a file has an unknown extension and a selector?

**Decision**: Compile error E10137 — unknown extensions are treated as raw binary, and raw binary has no selectors.

### DI-A3: Can the same file produce different data for different selectors?

**Decision**: Yes — that's the entire purpose. `embed("player.spd", "sprites")` and
`embed("player.spd", "tile_attributes")` extract different parts of the same file. The file is
parsed once (EM-8 caching rule).

### DI-A4: Can `embed()` be used with `[values; fill]` syntax?

**Decision**: No — `embed()` and array initializer syntax are mutually exclusive. `embed()` provides the complete data; there's nothing to fill.

### DI-A5: Can `embed()` appear inside another `embed()`?

**Decision**: No — `embed()` takes a string literal path, not an expression. Nesting is syntactically impossible.

### DI-A6: How are format handler version differences handled?

**Decision**: The extension selects a candidate handler, then the handler validates the file's
signature and version. For an application project format, the profile pins both a producer release
and the accepted observable file identity. For a published interchange format, it pins the
authoritative specification revision or content hash and the exact accepted subset instead.
“Latest” is never resolved dynamically during a build. An older, newer, malformed, or otherwise
unregistered version or variant produces E10204 with the
supported version set. The compiler never guesses a layout from the extension alone. Additional
generations require separately verified handler support but do not change the language syntax.

### DI-A7: What about files with no extension?

**Decision**: Treated as raw binary — same as `.bin`.

### DI-A8: Does a selector string define a general path language?

**Decision**: No. The core language passes the exact case-sensitive literal to the selected format
handler. A key such as `"layer.hero"` is legal only when that handler exposes it for the parsed
file; dots and other characters have no core-language meaning. This permits format-specific named
layers, tags, or records without committing Blend65 to a universal asset-query language.

## Part 9: Examples

### Example 1: C64 Sprite Animation

```blend65
module SpriteDemo;

import { SPRITE_PTR, SPRITE_ENABLE, VIC_SPRITE_X, VIC_SPRITE_Y, vicSpriteBlock } from c64.vic;

// Embed sprite data — compiler handles alignment and block calculation
const PLAYER: byte[] = embed("player.spd", "sprites");
const PLAYER_BASE: byte = vicSpriteBlock(&PLAYER);
const PLAYER_FRAMES: word = embed("player.spd", "count");

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

import {
    audioInitDefault,
    audioTick,
    audioTriggerSfx,
} from c64.audio;
import { setIRQ } from c64.system;

// This exact export is recognized by a qualified player contract.
const AUDIO: byte[] = embed("ingame.sid", "data");

function main(): void {
    audioInitDefault(&AUDIO);

    // Source owns player scheduling; the compiler adds no audio IRQ.
    setIRQ(&musicIRQ);

    // Game loop
    while (true) {
        if (playerFired()) {
            audioTriggerSfx(&AUDIO, "fire");
        }
    }
}

interrupt function musicIRQ(): void {
    // Exactly one update at the contract's required cadence.
    audioTick(&AUDIO);
}
```

### Example 3: C64 Character Map Display

```blend65
module LevelDisplay;

import { VIC_MEMORY_POINTERS, vicCharsetSelect } from c64.vic;

// This example asset uses only character and tile indices at most 255.
// A larger asset declares TILES and/or MAP as word[] as reported by E10144.
const CHARS: byte[] = embed("level1.ctm", "charset");
const TILES: byte[] = embed("level1.ctm", "tiles");
const MAP: byte[] = embed("level1.ctm", "map");
const COLORS: byte[] = embed("level1.ctm", "colors");
const MAP_WIDTH: word = embed("level1.ctm", "map_width");
const MAP_HEIGHT: word = embed("level1.ctm", "map_height");
const TILE_WIDTH: byte = embed("level1.ctm", "tile_width");
const TILE_HEIGHT: byte = embed("level1.ctm", "tile_height");
const CHARSET_SELECT: byte = vicCharsetSelect(&CHARS);

function displayLevel(): void {
    // Keep the screen-base field and select the placed, bank-visible charset.
    poke(VIC_MEMORY_POINTERS, (peek(VIC_MEMORY_POINTERS) & $F1) | CHARSET_SELECT);

    // A tile renderer consumes MAP, TILES, and COLORS in their native layers.
    drawVisibleMap(MAP, TILES, COLORS, MAP_WIDTH, MAP_HEIGHT, TILE_WIDTH, TILE_HEIGHT);
}
```

### Example 4: Raw Binary Lookup Table

```blend65
module Tables;

// Raw binary — no format handler, just bytes
const SINE: byte[256] = embed("sine_table.bin");

// Export for use by other modules
export const COLOR_CYCLE: byte[] = embed("colors.bin");
```

### Example 5: Koala Bitmap Display

```blend65
module KoalaViewer;

import {
    COLOR_RAM,
    VIC_BACKGROUND_COLOR,
    VIC_MEMORY_POINTERS,
    VIC_MODE_CONTROL_1,
    VIC_MULTICOLOR_BITMAP_MASK,
    vicBitmapSelect,
    vicScreenSelect
} from c64.vic;

const BITMAP: byte[8000] = embed("picture.kla", "bitmap");
const BMP_SCREEN: byte[1000] = embed("picture.kla", "screen");
const BMP_COLORS: byte[1000] = embed("picture.kla", "color_ram");
const BMP_BG: byte = embed("picture.kla", "background");
const BITMAP_SELECT: byte = vicBitmapSelect(&BITMAP);
const SCREEN_SELECT: byte = vicScreenSelect(&BMP_SCREEN);

function showPicture(): void {
    // Set background color from the selected scalar.
    poke(VIC_BACKGROUND_COLOR, BMP_BG);

    // These zero-cost operations derive the $D018 fields from final placement.
    poke(VIC_MEMORY_POINTERS, BITMAP_SELECT | SCREEN_SELECT);
    poke(VIC_MODE_CONTROL_1, peek(VIC_MODE_CONTROL_1) | VIC_MULTICOLOR_BITMAP_MASK);

    // Color RAM is separate hardware memory, so this cost stays explicit.
    for (let i: word = 0; i <= 999; i += 1) {
        poke(COLOR_RAM + i, BMP_COLORS[i]);
    }
}
```

### Example 6: Optional Offset Tables Are Separate Assets

The CharPad handler emits no offset table as a side effect of selecting `"charset"`, `"tiles"`, or
`"map"`. A separately requested table is justified against the actual hot path: power-of-two strides
may be cheaper as shifts, while irregular strides may justify a lookup. If requested, the table has
its own symbol, placement, byte count, and access cost in the build report. This keeps unused helper
data out of memory and prevents a format selector from hiding an optimization policy.

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
; embed("player.spd", "sprites") → exact SPD v5 records, 64-byte aligned
    .align 64
PLAYER_SPRITES:
    .byte $00, $7E, $00, ...  ; sprite pixel data extracted from .spd format
    .byte $91                  ; this sprite's packed attribute byte

; vicSpriteBlock(&PLAYER_SPRITES) → linker-resolved C64 platform constant
PLAYER_BASE = (PLAYER_SPRITES & $3FFF) / 64    ; assembler/linker calculates this
```

### 10.3 Resource Cost

| Item | RAM | ROM/Binary | Zero Page |
|------|-----|------------|-----------|
| `embed()` raw | 0 | File size | 0 |
| `embed(path, selector)` (array) | 0 | Extracted data size | 0 |
| `embed(path, selector)` (scalar) | 0 | 0 (inlined constant) | 0 |
| Format handler alignment padding | 0 | 0–(align-1) bytes | 0 |
| Qualified audio payload | Contract-defined writable state | Player + music/effect data and alignment | Contract-defined |

Ordinary embedded data is `const` and uses ROM/data placement. A qualified audio object remains
source-immutable, but its contract may identify player-owned writable or self-modifying ranges;
those ranges use writable placement and are included in the exact resource report.

---

## Part 11: Language Guard Evaluation

| Rule | Status | Notes |
|------|--------|-------|
| **P1** Cross-platform compilable | ✅ | `embed()` compiles on all platforms. Raw mode always available. Format handlers are per-profile |
| **P2** Platform-meaningful | ✅ | Every platform has asset tools. The format handler system makes embed useful everywhere |
| **P3** No platform assumptions | ✅ | Core spec defines `embed()` generically. Format names, selectors, and alignment requirements live in platform profiles |
| **P4** Resource-scalable | ✅ | W10150 warns when approaching `max_binary_size`. The platform profile defines the budget. |
| **H1** 6502 implementable | ✅ | Embedded data is just bytes in the binary — no CPU features required |
| **H2** Cost transparency | ✅ | Inclusion has no hidden runtime cost. The build summary reports data/alignment, and qualified audio reports every selected player code/state/cycle cost |
| **H3** SFA compatible | ✅ | Ordinary embedded data needs no mutable frame state; qualified player-owned writable ranges are statically placed and never hidden in SFA |
| **H4** Memory footprint documented | ✅ | Part 10.3 documents resource costs. Build summary shows per-asset totals |
| **H5** Fully deterministic | ✅ | File exists → data included. File missing → E10130. All edge cases produce defined errors |
| **L1** Unambiguous syntax | ✅ | `embed("path")` or `embed("path", "selector")` — EBNF in Part 1. No parsing ambiguity |
| **L2** Consistent with existing | ✅ | Both forms use ordinary intrinsic-call syntax; the second literal is compile-time configuration, not runtime data |
| **L3** Beginner-friendly | ✅ | `embed("player.spd", "sprites")` is explicit. Error messages and completion list the file's available keys |
| **L4** Minimal feature | ✅ | One intrinsic with one optional literal argument. Format complexity remains in platform profiles |
| **L5** No redundancy | ✅ | No other way to include binary data exists in the language |
| **L6** Error messages defined | ✅ | Asset and callable-audio diagnostics are defined; Chapter 14 is canonical |
| **L7** Compile-time failure | ✅ | All errors are compile-time. No runtime failure possible — data is in the binary |
| **L8** Feature interactions | ✅ | Part 7 documents interactions with F003, F005, F006, F008, F011, F014 |
| **L9** Documentable with examples | ✅ | Part 9: five examples covering sprites, music, charmaps, raw binary, bitmaps |
| **C1** Lexer/parser implementable | ✅ | `embed`, one required string literal, and one optional comma plus string literal use standard tokens |
| **C2** Semantic analysis defined | ✅ | Type checking: selector return type vs declared type. Scope: module-level const only. Validation: file existence, size matching |
| **C3** Code generation strategy | ✅ | Part 10 documents codegen: bytes placed in data section, alignment via assembler directive, linker-resolved constants |
| **C4** Unit testable | ✅ | Lexer: `embed` → `KW_EMBED`, `(` → `LPAREN`, etc. Parser: embed-expression AST node. Semantic: type validation. Codegen: data section bytes |
| **C5** Runtime verifiable | ✅ | Embedded data can be verified by reading memory locations in emulator and comparing against source file bytes |
| **F1** Extensible | ✅ | New format handlers added to platform profiles without language changes. New selectors don't break existing code |
| **F2** Platform-profile ready | ✅ | All format-specific behavior (handlers, selectors, alignment) is in platform profiles |
| **F3** Optimizer-friendly | ✅ | Ordinary embedded data is read-only; a qualified player's declared writable ranges carry effects and cannot be propagated as constants, while unused unreferenced assets remain removable |
| **F4** Stability classification | ✅ | **Stable** — `embed()` syntax and raw mode. **Provisional** — format handler interface (may be refined as more formats are implemented) |

**Verdict: ✅ ACCEPTED — all 23 rules pass**

---

## Deferred Items

### → FUT-014: Manual alignment attribute

Manual alignment for non-asset data (e.g., page-aligning a hand-written sine table) is deferred. See `future-considerations.md`.

### → FUT-015: Common image format conversion

Automatic conversion of modern image formats (PNG, BMP) to platform-native graphics formats is deferred. See `future-considerations.md`.
