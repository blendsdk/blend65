# SpritePad and CharPad: RD-06 Native Assets

> **Document**: 03-02-spritepad-charpad.md
> **Parent**: [Index](00-index.md)

## Overview

This component owns the two producer-application project handlers: SpritePad C64 Pro 3.80 with SPD
v5 and CharPad C64 Pro 3.80 with CTM v9. The licensed applications and their official manuals are
available at `/home/gevik/workdir/github/blend65.ri/apps`. The manuals are the exact schema
authority; the installed examples are real producer acceptance data. No schema is guessed and no
comparative parser is used.

The real examples are local-only evidence because the EULA does not grant redistribution of the
bundled files. The repository carries a producer-evidence manifest with paths, versions and
SHA-256 values plus synthetic fixtures generated from the official manuals (AR-54–AR-57).

## Architecture

### Current architecture

No SpritePad or CharPad code exists. `.spd` and `.ctm` reach the generic native stub and return
E10204; `.ctm` without a selector returns E10132. The application folders and their manuals were
not previously available to the compiler.

### Proposed changes

Both handlers implement `AssetHandler` from
[03-01](03-01-asset-handler-core.md#new-types-and-interfaces):

```text
frontend profile
  spd -> spritepad 3.80
  ctm -> charpad 3.80
```

Each handler is a pure byte parser over the already-read input. It produces a complete result or one
E10204 failure; it never returns partial selectors. The handler owns signature/version, complete
structure, exact EOF, every declared count/index/flag/component, the selector inventory, typed
outputs, output SHA-256 and handler-derived constraints. It does not own a final address, a VIC
register field, a runtime copy, a renderer, or a game policy.

### Authoritative manuals

| Format | Vendor manual | SHA-256 |
| --- | --- | --- |
| SPD v5 | `apps/SpritePad C64 3.80 Pro/Help/File Format - SPD (V5).htm` | `8c28898ed1c0451290721ebbf686a86e501014f597aaf7e191a00fc13b1ee4a6` |
| CTM v9 | `apps/CharPad C64 3.80 Pro/Help/File Format - CTM (V9).htm` | `cbf1503202ad90232e8944c6975099dcc176b9348e5c467c7f4d433446897346` |

The manuals are not copied into the repository; the manifest records their paths and hashes.
The installed producer versions are SpritePad C64 Pro 3.80 and CharPad C64 Pro 3.80. CTM v9 is the
format contract (introduced in CharPad 3.5); the RD pin is amended from 3.88 to 3.80+ with CTM v9
(AR-55).

## Implementation Details

### SpritePad SPD v5

Header, 20 bytes:

| Offset | Field | Rule |
| --- | --- | --- |
| `$00-$02` | ID | ASCII `SPD` |
| `$03` | Version | `5` only |
| `$04` | Flags | bit2 tile animations, bit1 sprite animations, bit0 tiles |
| `$05-$06` | SPQ | Sprite quantity, 16-bit little-endian |
| `$07-$08` | TLQ | Tile quantity, 16-bit little-endian |
| `$09` | ANSPQ-1 | Sprite animation quantity minus one (1–256) |
| `$0A` | ANTLQ-1 | Tile animation quantity minus one (1–256) |
| `$0B` | TWID | Tile width 1–8 |
| `$0C` | THEI | Tile height 1–8 |
| `$0D-$0F` | Colors | Background, multicolor 1, multicolor 2 (0–15 each) |
| `$10-$11` | SPOVDIST | Signed 16-bit little-endian sprite overlay distance |
| `$12-$13` | TLOVDIST | Signed 16-bit little-endian tile overlay distance |

Data follows in this exact order:

1. `SPQ * 64` sprite bytes. Each 64-byte record is 63 bitmap bytes plus one packed attribute byte.
2. If tiles: `TLQ * TWID * THEI * 2` tile bytes, then `TLQ` tile attributes, then `TLQ` tile tags,
   then `TLQ` zero-terminated ASCII tile names (0–32 characters plus terminator).
3. If sprite animations: `ANSPQ * 2` starts, `ANSPQ * 2` ends, `ANSPQ` timers, `ANSPQ` flags.
4. If tile animations: `ANTLQ * 2` starts, `ANTLQ * 2` ends, `ANTLQ` timers, `ANTLQ` flags.
5. Exact EOF after the last declared block.

Attribute meanings:

- Sprite: `MYXVCCCC` — multicolor, Y-expand, X-expand, overlay flag, color.
- Tile: `---V----` — overlay flag.
- Animation: `---P----` — ping-pong flag.

The parser validates every count, index, flag, record boundary, name terminator and exact EOF.
Tile names are compile-time metadata only; they are not emitted as runtime strings. `"sprites"`
preserves each 64-byte record; `"sprite_attributes"` extracts record byte 63 into its own table.
Overlay distances are emitted as raw 16-bit `word` values preserving the manual's two's-complement
bits; consumers may interpret them as signed offsets.

### CharPad CTM v9

Header, 19 bytes:

| Offset | Field | Rule |
| --- | --- | --- |
| `$00-$02` | ID | ASCII `CTM` |
| `$03` | Version | `9` only |
| `$04` | DISP_MODE | 0 Text HR, 1 Text MC, 2 Text EC, 3 Bitmap HR, 4 Bitmap MC |
| `$05` | COLR_METH | 0 Per-project, 1 Per-tile, 2 Per-char |
| `$06` | KEYMAP + FLAGS | High nibble key map 0–10; low nibble bit0 TILESYS |
| `$07-$08` | FGRID_WID | Map flexi-grid width, 16-bit little-endian |
| `$09-$0A` | FGRID_HEI | Map flexi-grid height, 16-bit little-endian |
| `$0B` | FGRID_CONFIG | Flexi-grid configuration |
| `$0C-$0F` | VCOLR_BG0..3 | VIC background colors 0–15 |
| `$10-$12` | MTRXCOLRS_BASE | `CmLo`, `SmLo`, `SmHi` for per-project color |

Blocks follow in this exact order, each introduced by `$DA` and a second byte with high nibble `$B`:

1. Character set: `$DA,$B0`, character count minus one (16-bit), `8 * count` character bytes.
2. Character materials: `$DA,$B1`, one byte per character.
3. Character colors (only per-char): `$DA,$Bn`, 1–3 bytes per character depending on display mode.
4. Tile set (only TILESYS): `$DA,$Bn`, tile count minus one, tile width, tile height,
   `2 * width * height * count` tile bytes.
5. Tile colors (only TILESYS and per-tile): `$DA,$Bn`, 1–3 bytes per tile.
6. Tile tags (only TILESYS): `$DA,$Bn`, one byte per tile.
7. Tile names (only TILESYS): `$DA,$Bn`, zero-terminated ASCII strings, one per tile.
8. Map: `$DA,$Bn`, map width, map height, `2 * width * height` map bytes.
9. Exact EOF after the map block.

The block numbers increment by one for each block actually present; the parser validates the upper
nibble and the known order, not a hardcoded lower nibble. Character, tile and map data are
little-endian 16-bit cells in left-to-right/top-to-bottom order.

`"colors"` yields the exact native color block for the file's color method: the three header bytes
for per-project, the tile color block for per-tile, or the character color block for per-char. The
number of bytes per item is determined by the display mode. `"color_method"` tells the consumer how
to interpret the bytes. No derived Color RAM or flattened screen data is invented.

### Selector availability

- SpritePad `"sprites"` is the default. `"sprite_attributes"`, colors, counts and tile/animation
  components are available only when the flags and validated counts make them present.
- CharPad has no default selector; omission is E10132. `"tiles"`, `"tiles_word"`,
  `"tiles_packed12"`, `"tiles_low"` and `"tiles_high"` require tile mode. `"map"` and its
  representations always exist. `"colors"` and `"color_method"` always exist. `"tile_width"`,
  `"tile_height"` and `"tile_mode"` always exist and yield `1`, `1` and `false` without a tile layer.

### Evidence fixtures

The following real producer examples are used as local acceptance evidence. They are not committed
to the repository because the EULA does not grant redistribution of the bundled files.

| Fixture | Path | Bytes | SHA-256 |
| --- | --- | --- | --- |
| SPD v5 sprite sheet | `SpritePad C64 3.80 Pro/Examples (SPD5)/Sprite Sheets (Subchrist)/ChromeFont.spd` | 2,388 | `5b231c73ce2a0f4697ed9ef916a9a95b4bb5b582114b509ba99a5b295da3f57e` |
| SPD v5 sprite animations | `SpritePad C64 3.80 Pro/Examples (SPD5)/Sprite Animations (Subchrist)/SpriteAnimations01.spd` | 13,252 | `ca032b6fb295b5f315bd560fa020e937aad6f5497636596340c8d84429170efc` |
| SPD v5 tiles | `SpritePad C64 3.80 Pro/Examples (SPD5)/Tile Sheets (Subchrist)/Expanded Sprite Test.spd` | 1,090 | `72f1394349a4a8502ed7d0a0500f49898b91e2ce027f23b4f3de73e7d73ea066` |
| CTM v9 text MC per-tile | `CharPad C64 3.80 Pro/Examples (CTM9)/Maps (Subchrist)/Hexagone (5x5).ctm` | 833 | `dcd26ceb1af4d72776ce6f54120db2fec9d80ba969060e8f72aceaced234009f` |
| CTM v9 text MC per-project | `CharPad C64 3.80 Pro/Examples (CTM9)/Maps (Subchrist)/Floor Kit S1 (4x4).ctm` | 1,186 | `43c25a6b1cddfc8daa1ab937727787c08eea3c8fc1b5f0d983af91b090dadc11` |
| CTM v9 text EC | `CharPad C64 3.80 Pro/Examples (CTM9)/Maps (Subchrist, ECM)/ECM Icon Samples (2x2).ctm` | 3,067 | `09c888463e5e3b98fcc76c027a9102df3904ca11f14d8c1d0d0ea812c5cd23b9` |
| CTM v9 text HR no tiles | `CharPad C64 3.80 Pro/Examples (key maps)/C64 ROM Upper Case.ctm` | 4,335 | `7dd3979e661c855ecf376ce7a0d88bc054aa7c56d43eb4bb64dbc19a18ec5d2d` |
| CTM v9 bitmap MC per-char | `CharPad C64 3.80 Pro/Examples (CTM9)/Pictures (image imports)/Misc - CharPadPro.ctm` | 8,033 | `33d557f6ee208643411bb21d908f398361e6f72e51ccb15df258ed01faca32ba` |

The test suite reads these files when `RD06_PRODUCER_ROOT` points at the apps folder. The committed
fixtures are synthetic files generated from the official manual; they cover optional components,
adjacent versions, truncation, boundary counts and display/color/tile combinations. The manifest
records both the local real paths/hashes and the committed synthetic fixture hashes.

### Error handling

| Error case | Handling strategy | AR Ref |
| --- | --- | --- |
| Wrong magic/version | E10204 at the signature/version offset | AR-17 |
| Truncated header/block/record | E10204 naming the block and required/remaining bytes | AR-17 |
| Count/index/attribute mismatch | E10204 naming the field and offending value | AR-17 |
| Optional component absent | Selector absent; requesting it is E10133 | AR-17 |
| Trailing bytes | E10204 naming the exact EOF offset | AR-17 |
| Tile name without terminator or over 32 chars | E10204 naming the tile and name offset | AR-17 |
| Canonical width mismatch | E10144 with the required `byte[]` or `word[]` type | AR-20 |
| Packed-12 unavailable | E10133 listing available representations | AR-20 |
| Charset alignment/visibility failure | E10143 for one-object alignment; E10273 for character-ROM/cross-object conflicts | AR-11 |
| Selected output over 65,535 bytes | E10265 before selector exposure | AR-12 |

## Testing Requirements

- Parse the official manual structure for SPD v5 and CTM v9, including exact header offsets, flags,
  counts, block order, variable names and exact EOF.
- Parse every selected real example locally and verify exact selector types, lengths and hashes.
- Synthetic coverage for every selector, optional component, adjacent version, truncation boundary,
  count/index mismatch, trailing byte, tile/no-tile, display × color × tile mode and packed-12
  boundary.
- Layout tests for 64-byte sprite alignment, 2-KiB charset alignment, VIC visibility and the
  256-record-plus-screen failure.
- No Linux build or test invokes SpritePad or CharPad.
