# Chapter 13 — Data Inclusion & Asset Embedding

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: F015

---

## 1. Overview

The `embed()` intrinsic includes external binary data into the compiled program at compile time. It supports two modes:

1. **Raw binary inclusion** — embeds file bytes directly, no format interpretation
2. **Format-aware asset import** — uses platform-profile-registered format handlers to parse asset files and extract a specific data part named by a literal selector key

This eliminates the manual conversion step between third-party asset tools (SpritePad, CharPad, SID editors) and Blend65 source code.

```blend65
// Raw binary — any platform, any file
const LOOKUP: byte[] = embed("table.bin");

// Format-aware — SpritePad file, extract sprite data
const SPRITES: byte[] = embed("player.spd", "sprites");
const SPRITE_COUNT: word = embed("player.spd", "count");
```

---

## 2. Syntax

### 2.1 One-Argument Embed

```ebnf
embed_expr = "embed" , "(" , string_literal , [ "," , string_literal ] , ")" ;
```

```blend65
const DATA: byte[] = embed("filename.bin");
```

Dispatch is determined by the selected profile. If the extension has a registered handler, the
handler validates the file and uses its declared default selector; omission is E10132 when that
handler has no default. If the extension has no registered handler, this form inserts the raw bytes
and infers the array extent from the file size.

### 2.2 Format-Aware Embed

```ebnf
embed_selector = "embed" , "(" , string_literal , "," , string_literal , ")" ;
```

```blend65
const SPRITES: byte[] = embed("player.spd", "sprites");
```

The extension must choose a candidate handler from the selected platform profile. The handler validates
the file signature and version, then resolves the exact selector key and extracts the named data
part. Both arguments are string literals. The core language treats the selector as an opaque,
case-sensitive key: it does not split dots or define a generic path/query language. A handler may
expose fixed keys such as `"sprites"` or file-derived keys such as `"layer.hero"`; it must enumerate
the keys valid for the parsed file and define each key's type and placement requirements.

---

## 3. Rules

### EMB-1 — Compile-Time Only

`embed()` is a compile-time intrinsic. The file is read during compilation. A raw fallback produces
a `const byte[]`. A registered handler produces the scalar or immutable array type declared by its
explicit or default selector. Every array result is immutable and placed in the data section.

```blend65
const DATA: byte[] = embed("table.bin");    // ✅ const declaration
let DATA: byte[] = embed("table.bin");      // ❌ E10134: embed produces const data
```

### EMB-2 — File Path Relative to Source

The file path is relative to the source file containing the `embed()` call. The compiler searches:
1. Directory of the current source file
2. Directories listed in the `--asset-path` compiler option

### EMB-3 — File Not Found

If the file cannot be found → E10130.

```blend65
const DATA: byte[] = embed("missing.bin");  // ❌ E10130: file not found
```

### EMB-4 — Size Inference

The array size is inferred from the file contents. An explicit size may be provided; if it doesn't match, the compiler reports an error.

```blend65
const DATA: byte[] = embed("table.bin");           // ✅ size inferred
const DATA: byte[256] = embed("table.bin");        // ✅ if file is exactly 256 bytes
const DATA: byte[100] = embed("table.bin");        // ❌ E10140 if file is not 100 bytes
```

### EMB-5 — Format Handlers Are Platform-Profile Defined

Available format handlers and their selectors are defined in the platform profile (→ Ch 15). The core language defines only the `embed()` syntax — format support is extensible.

An extension selects a candidate handler; it is not sufficient proof of a format. The handler must
validate its magic/signature and supported version before producing a value. An unsupported or
malformed version is E10204. The compiler and language server may use the parsed file's enumerated
keys for completion and diagnostics.

For an application project format, the profile pins the selected producer release and accepted
observable file signature/version. For a published interchange format that is not owned by one
producer application, the profile instead pins an authoritative format-specification revision or
content hash plus the exact accepted variant/version subset. "Latest" is never a moving
compile-time label. Older, newer, malformed, or otherwise unregistered generations and variants
produce E10204 rather than being guessed from the extension. A later profile release may add
another explicitly verified identity without changing `embed()` syntax.

### EMB-6 — Unknown Selector

If a selector doesn't match any field in the format handler → E10133.

```blend65
const DATA: byte[] = embed("player.spd", "unknown"); // ❌ E10133: unknown selector
```

If the second argument is present but is not a string literal, compilation fails with E10250. An
empty or otherwise unrecognized string is an unknown selector and uses E10133.

---

## 4. Code Generation

Array-valued `embed()` data is placed directly in the data/ROM section of the binary, exactly like a
`const byte[]` or `const word[]` initializer. Scalar selectors produce compile-time constants. There
is no runtime import or conversion cost. Array data uses the ordinary `const`-array access rules
(→ Ch 08, §10.6).

Array outputs with the same canonical input path, resolved selector (including a handler default),
and output representation are one immutable embedded object. Every declaration name aliases the
same address; the linker emits the bytes once, satisfies fixed placement once, and counts them once
toward W10150 and `max_binary_size`. This identity rule is independent of source spelling or module
order. Different selectors or representations remain distinct outputs even when their source file
is the same.

```
; embed("table.bin") — 256 bytes placed in data section
_LOOKUP:
    .incbin "table.bin"    ; assembler directive equivalent
```

---

## 5. Diagnostic Conditions

This chapter owns the asset-import predicates below. Chapter 14 owns their public presentation.

| Code | Trigger | Rejected behavior or consequence |
|------|---------|----------------------------------|
| E10130 | The path cannot be found relative to the source or any `--asset-path`. | Compilation cannot read the asset. |
| E10131 | The selected raw asset file is empty. | The empty input is rejected as invalid raw asset input; zero-length arrays and empty optional parsed components remain legal elsewhere. |
| E10132 | A registered format has no default selector and the source omits one. | The embed expression is rejected. |
| E10133 | A selector is not registered for the detected format. | The selector is rejected. |
| E10134 | `embed()` initializes a mutable `let` rather than `const`. | The declaration is rejected. |
| E10135 | `embed()` appears outside a module-level declaration. | The expression is rejected. |
| E10136 | The path argument is not one string literal. | The expression is rejected. |
| E10137 | A selector is used with an extension that has no registered handler. | The selector is rejected. |
| E10140 | The selected element count differs from an explicit array extent. | The declaration is rejected. |
| E10142 | An array-valued selector appears in scalar expression context. | The expression is rejected. |
| E10143 | Required alignment or device visibility cannot be satisfied. | Asset placement fails. |
| E10144 | The declared type does not match the selector type enumerated for the parsed file. | The declaration is rejected and the diagnostic reports the required type. |
| E10204 | The handler cannot parse the file or its signature/version is not registered by the selected profile. | No asset bytes are emitted. |
| E10250 | The optional selector argument is present but is not a string literal. | The expression is rejected before handler lookup. |
| E10261 | A valid SID asset's specific video, SID-model, or multi-SID requirement is incompatible with the selected C64/C64U profile or its player contract. | The asset is rejected before emission or callable-audio lowering; no automatic conversion or contradictory override is attempted. |

### Warning Conditions

| Code | Trigger | Consequence |
|------|---------|-------------|
| W10150 | Total emitted embedded-data bytes reach `warn_embed_percent`, or 75% of `max_binary_size` when omitted. | Compilation continues and reports the measured bytes and percentage. |
| W10151 | Two or more distinct `embed()` declarations resolve to the same canonical input path, selector (including the same resolved default), and output representation. | Compilation continues and reports that all names share one emitted immutable object/address. Different selectors from one file do not trigger it. |

---

## 6. Feature Interactions

| Feature | Interaction |
|---------|-------------|
| **Arrays** (→ Ch 08) | Raw `embed()` produces `const byte[]`; a format selector may produce `const byte[]` or `const word[]`. All const-array rules apply. `length()` returns the element count. |
| **Variables** (→ Ch 03) | Must be `const`. Cannot be `let`. |
| **Memory model** (→ Ch 11) | Ordinary embedded data goes to the data/ROM section. A qualified contract may declare player-owned writable/self-modifying ranges; every range adds to binary/resource totals and is reported. |
| **Platform profile** (→ Ch 15) | Format handlers, selector names, supported file types, and callable-player contracts are platform-profile-defined. |

---

## 7. Examples

### 7.1 Raw Lookup Table

```blend65
module Tables;
const SINE: byte[] = embed("sine256.bin");     // 256-byte sine table
const COSINE: byte[] = embed("cosine256.bin"); // 256-byte cosine table
```

### 7.2 Platform-Specific Asset Import (C64)

```blend65
module Assets;

// SpritePad file — extract parts
const PLAYER_SPRITES: byte[] = embed("player.spd", "sprites");
const PLAYER_COUNT: word = embed("player.spd", "count");
const PLAYER_BACKGROUND: byte = embed("player.spd", "background_color");

// CharPad tilemap whose referenced character and tile indices are all at most 255
const LEVEL_CHARSET: byte[] = embed("level1.ctm", "charset");
const LEVEL_MAP: byte[] = embed("level1.ctm", "map");
const LEVEL_TILES: byte[] = embed("level1.ctm", "tiles");
const LEVEL_COLORS: byte[] = embed("level1.ctm", "colors");
const LEVEL_COLOR_METHOD: byte = embed("level1.ctm", "color_method");
const LEVEL_MAP_WIDTH: word = embed("level1.ctm", "map_width");
const LEVEL_MAP_HEIGHT: word = embed("level1.ctm", "map_height");
const LEVEL_TILE_WIDTH: byte = embed("level1.ctm", "tile_width");
const LEVEL_TILE_HEIGHT: byte = embed("level1.ctm", "tile_height");
const LEVEL_USES_TILES: boolean = embed("level1.ctm", "tile_mode");

// SID music
const MUSIC: byte[] = embed("ingame.sid", "data");
const MUSIC_INIT: word = embed("ingame.sid", "init_address");
const MUSIC_PLAY: word = embed("ingame.sid", "play_address");
```

Asset inclusion and callable game audio are separate contracts. The PSID header supplies init/play
metadata but no SFX ABI, arbitration, writable-state map, or interrupt-ownership rules. A C64
handler may attach provenance from the emitted `MUSIC` object to an exact hash-bound
`audio_player_contracts` entry in the selected profile. Only then may `c64.audio` operations use
`&MUSIC`; otherwise the bytes remain legal embedded data and a call is E10256. No SFX operation is
ever inferred from a plain PSID header.

The C64/C64U handler also validates the asset's specific video-standard, SID-model, and multi-SID
requirements against the selected profile. A known incompatibility is E10261. Unknown PSID metadata
makes no claim and permits embed-only data; callable use requires its exact player contract to close
the uncertainty. The compiler never treats Unknown as proof, contradicts a specific header, or
retimes/retunes the payload.

The player-neutral operations initialize a contract-defined default song, a zero-based numeric song,
or a compile-time named song; perform exactly one source-scheduled player tick; and request a
compile-time named effect with either contract-defined arbitration or an explicit logical SID voice
`0..2`. The contract must enumerate every accepted operation, name, ID range, voice mapping,
entry ABI, clobber, writable/self-modifying range, cadence, ownership rule, and resource cost.
Unavailable forms are E10257 and unsafe non-reentrant call overlap is E10258. Constant operations
lower directly to the player's register setup and absolute `JSR`; inclusion never adds a generic
dispatcher, queue, mixer, scheduler, copied payload, or runtime library. See Appendix A, §7.3.1.

For the initial C64 SpritePad handler, `"sprites"` preserves each SPD v5 sprite as its native
64-byte record: 63 bitmap bytes followed by the packed attribute byte. The handler does not invent
a file-wide multicolor value because color, multicolor mode, X/Y expansion, and overlay status are
per-sprite properties. C64 platform operations may read those fields directly without making a
second table. Selecting `"sprite_attributes"` explicitly creates a separate contiguous derived
table and its additional bytes appear in the build report. `vicSpriteBlock(&PLAYER_SPRITES)` derives
the VIC-bank-relative block number from final placement; `"base_block"` and implicit offset tables
are not asset selectors.

For C64 CharPad files, `"charset"` is the sequence of 8-byte character images and carries the
platform's 2048-byte alignment and VIC-bank-visibility constraint. In tile mode, `"tiles"` contains
row-major character indices for each tile and `"map"` contains row-major tile indices. Without a
tile layer, `"map"` contains row-major character indices. `"colors"` is the file's native color
table; `"color_method"` tells the platform code how to interpret it. For each parsed layer, the
canonical `"tiles"` or `"map"` selector uses the smallest lossless logical type: `byte[]` when every
referenced index is at most 255, otherwise `word[]` with little-endian elements. Declaring the wrong
type produces E10144 with the required type; changing an asset across the 255 boundary is never
truncated and is not a parse error.

The initial C64 CharPad handler is qualified against CharPad C64 Pro 3.88 and accepts the observable
ASCII `CTM` signature with CTM version 9 only. The application release is provenance because CTM v9
does not encode it. The handler validates the complete profile-pinned header/block schema and exact
file length before exposing selectors, and it defines no default selector. `"tiles_word"` and
`"map_word"` explicitly produce `word[]` even when the canonical selector would choose `byte[]`.

When the layer exists and every index is at most 4095, the file-derived selector set also exposes
`"tiles_packed12"` or `"map_packed12"` as `byte[]`. For `N` values, the representation contains the
`N` low bytes in order followed by `ceil(N/2)` high-nibble bytes. Each high-nibble byte stores the
even value's bits 8–11 in its low nibble and the odd value's bits 8–11 in its high nibble; an absent
final odd value contributes zero. Therefore `$123,$456,$789` becomes `$23,$56,$89,$41,$07`. The
separately selectable `"tiles_low"`/`"tiles_high"` and
`"map_low"`/`"map_high"` byte planes provide the usual 6502 split-array representation. A packed-12
selector that is not valid for the parsed layer is absent from its enumerated selector set, so
requesting it produces E10133 and lists the available representations.

The handler emits and reports only referenced representations. Requesting a canonical, forced-word,
packed, or split representation never silently emits one of the others. It does not invent flattened
screen data, derived color RAM, address bases, or offset tables. On C64, use the separate zero-cost platform operation
`vicCharsetSelect(&LEVEL_CHARSET)` to validate alignment and bank visibility and derive the `$D018`
character-memory field from final placement. Any explicitly requested offset table is a separately
named and costed asset.

The initial C64 Koala handler accepts the classic native 10,003-byte `.kla`/`.koa` layout only:
little-endian load address `$6000`, 8,000 bitmap bytes, 1,000 screen-matrix bytes, 1,000 color-RAM
bytes, and one background-color byte. The handler validates the exact length, load address, component
boundaries, and zero upper nibbles for color values before exposing `"bitmap"`, `"screen"`,
`"color_ram"`, or `"background"`. It has no default and emits only the selected component.
Extensions are handler hints rather than proof; malformed input is E10204.

Koala placement is not file metadata. The separate zero-cost C64 operations
`vicBitmapSelect(&BITMAP)` and `vicScreenSelect(&SCREEN)` validate 8-KiB and 1-KiB alignment,
respectively, plus common selected-VIC-bank visibility, then derive the already-positioned `$D018`
fields from final placement. There is no `"bitmap_base"` or equivalent selector. Copying the
selected color bytes to the C64's separate color RAM is unavoidable runtime work, so source must
request that transfer explicitly and the compiler must report its cost rather than hiding it in the
handler.
