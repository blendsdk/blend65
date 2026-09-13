# Appendix A — Commodore 64 Qualified Profiles

> **Version**: 4.0
> **Status**: draft  
> **Stability**: provisional  
> **Fills**: Every profile slot defined in Ch 15, §3

---

## 1. Qualified Profile Set

Specification 4 defines exactly these nine profiles. The profile ID selects the whole row; source
cannot independently mix video, ownership, SID, or artifact fields.

| Profile ID | Video record | Runtime ownership | SID endpoint | Primary artifact |
|------------|--------------|-------------------|--------------|------------------|
| `c64-pal-prg-kernal-6581` | PAL | cooperative KERNAL | `$D400`, MOS 6581 | `<name>.prg` |
| `c64-pal-prg-kernal-8580` | PAL | cooperative KERNAL | `$D400`, MOS 8580 | `<name>.prg` |
| `c64-pal-prg-takeover-6581` | PAL | raw takeover | `$D400`, MOS 6581 | `<name>.prg` |
| `c64-pal-prg-takeover-8580` | PAL | raw takeover | `$D400`, MOS 8580 | `<name>.prg` |
| `c64-ntsc-prg-kernal-6581` | NTSC | cooperative KERNAL | `$D400`, MOS 6581 | `<name>.prg` |
| `c64-ntsc-prg-kernal-8580` | NTSC | cooperative KERNAL | `$D400`, MOS 8580 | `<name>.prg` |
| `c64-ntsc-prg-takeover-6581` | NTSC | raw takeover | `$D400`, MOS 6581 | `<name>.prg` |
| `c64-ntsc-prg-takeover-8580` | NTSC | raw takeover | `$D400`, MOS 8580 | `<name>.prg` |
| `c64-pal-d64-kernal-6581` | PAL | cooperative KERNAL | `$D400`, MOS 6581 | `<name>.d64` |

`c64-pal-prg-kernal-6581` is implemented first. The D64 profile is not an alias for its PRG
counterpart: it adds a contained boot PRG, reachable load-unit files, and the loader contract in
§5. Unknown IDs and every other combination are unavailable.

### 1.1 Common Machine Contract

| Field | Value |
|-------|-------|
| Platform family | `c64` |
| CPU | NMOS MOS 6510; documented NMOS 6502 instruction set plus the on-chip I/O port |
| Clock | 0.985248 MHz (PAL baseline) / 1.022730 MHz (NTSC baseline) |
| RAM | 64 KB total |
| ROM | 20 KB (BASIC $A000–$BFFF, KERNAL $E000–$FFFF, Char ROM $D000–$DFFF) |
| Graphics | VIC-II |
| Sound | SID (6581/8580) |
| Assembler | ACME 0.97 |
| Emulator evidence | VICE 3.10 `x64sc`, with exact model/video/SID/ROM configuration recorded |
| Hardware evidence | Targeted exact-profile QA for timing-, CIA-, SID-, banking-, and silicon-sensitive claims |

Every profile is for a stock, unexpanded C64 with no cartridge, REU, turbo mode, additional SID,
or undocumented opcode. A result proved only in VICE is reported as
`VICE-verified / hardware-unverified` until its required physical checks pass. Compatibility claims
never imply cycle-stable or analogue identity across unlisted VIC-II, CIA, SID, or board revisions.

---

## 2. Memory Map

### 2.1 Common Allocatable Configuration

All nine profiles use the same conservative general allocation range. BASIC ROM is banked out,
I/O remains visible, and the resident image plus trailing mutable/SFA storage share `$0801–$CFFF`.
KERNAL profiles keep KERNAL ROM visible. Takeover profiles expose RAM at `$E000–$FFFF` only for
their owned vectors and explicitly placed storage; that range is not silently added to the general
allocation budget.

```
$0000–$0001  6510 I/O port (data direction + port)
$0002–$00FF  Zero page (partial availability — see §3)
$0100–$01FF  Hardware stack
$0200–$03FF  OS/KERNAL workspace
$0400–$07FF  Default screen memory (1 KB) — available if screen relocated
$0801–$CFFF  ← PROGRAM IMAGE (12-byte BASIC auto-start stub, code, data, variables): 51,199 bytes
$D000–$D3FF  VIC-II registers
$D400–$D7FF  SID registers
$D800–$DBFF  Color RAM (1 KB, 4-bit nybbles)
$DC00–$DCFF  CIA1
$DD00–$DDFF  CIA2
$DE00–$DFFF  I/O expansion
$E000–$FFFF  KERNAL ROM (active)
```

### 2.2 Common Profile Values

```
memory:
  code_start:     $0801
  code_end:       $CFFF
  data_start:     $0801
  data_end:       $CFFF
  ram_start:      $0801
  ram_end:        $CFFF
  zp_start:       $02
  zp_end:         $8F
  stack_capacity: 256
  stack_reserve:  20
```

### 2.3 Memory Map Notes

- **Code and data share the same segment** ($0801–$CFFF). The linker interleaves code and const data; mutable data is placed after code.
- **$0400–$07FF** (default screen) is not included in the general range. A declaration may use it
  only through explicit placement after proving that the selected program no longer needs the
  screen/editor storage.
- **KERNAL profiles** keep `$E000–$FFFF` ROM visible for file I/O and firmware interrupt entry.
- **Takeover profiles** keep I/O visible but expose RAM at `$E000–$FFFF`; they own both raw vectors,
  every enabled IRQ/NMI source, and every bank state in which an entry may occur.
- The 12-byte BASIC line at $0801–$080C is part of the program image. `RUN` executes `SYS 2061`,
  which enters generated startup at $080D.

---

## 3. Zero Page

### 3.1 Available Range

With BASIC ROM banked out and KERNAL active:

| Range | Bytes | Owner | Available? |
|-------|-------|-------|-----------|
| $00–$01 | 2 | 6510 I/O port | ❌ Hardware |
| $02 | 1 | Free | ✅ |
| $03–$04 | 2 | Float→Int vector (BASIC) | ✅ (BASIC off) |
| $05–$06 | 2 | Float→Int vector (BASIC) | ✅ (BASIC off) |
| $07–$08 | 2 | BASIC search / temp | ✅ (BASIC off) |
| $09–$0A | 2 | BASIC scan column | ✅ (BASIC off) |
| $0B–$60 | 86 | BASIC workspace | ✅ (BASIC off) |
| $61–$6F | 15 | BASIC FP workspace | ✅ (BASIC off) |
| $70–$8F | 32 | BASIC temp / cassette | ✅ (BASIC off) |
| $90–$9F | 16 | KERNAL status / timing | ❌ KERNAL uses |
| $A0–$A2 | 3 | Jiffy clock | ❌ KERNAL uses |
| $A3–$B3 | 17 | KERNAL I/O | ❌ KERNAL uses |
| $B4–$BD | 10 | KERNAL temp | ⚠️ Usable between I/O calls |
| $BE–$C2 | 5 | KERNAL buffer | ❌ KERNAL uses |
| $C3–$CF | 13 | KERNAL I/O | ❌ KERNAL uses |
| $D0–$FA | 43 | KERNAL / screen editor | ❌ KERNAL uses |
| $FB–$FE | 4 | Free (always) | ✅ |
| $FF | 1 | BASIC temp | ✅ (BASIC off) |

**Common profile range**: `$02`–`$8F` = **142 zero-page bytes** available to the compiler. Takeover
does not silently reclaim KERNAL zero page; a later qualified profile may expose a larger exact
range without changing these identities.

### 3.2 Profile Values

```
budgets:
  max_zp: 142
```

---

## 4. Resource Budgets

```
budgets:
  max_binary_size: 51199    # inclusive span $0801–$CFFF
  max_ram:         51199    # shared with binary
  max_zp:          142      # $02–$8F
```

`stack_capacity` is 256 in every profile. `stack_reserve` is 20 in cooperative KERNAL profiles and
zero in takeover profiles. Takeover profiles instead charge every reachable raw IRQ/NMI frame,
wrapper, explicit push, and call path to the proved program peak. This does not make the hardware
stack available for SFA homes.

### 4.1 Budget Notes

- **max_binary_size**: The PRG file includes a 2-byte load-address header, which is excluded from the
  payload measure. Emitted startup/code/const/asset bytes and internal padding form one prefix from
  `$0801`; its payload may not exceed 51,199 bytes.
- **shared-range fit**: Code, embedded/constant data, mutable variables, and SFA instances occupy
  the same `$0801`–`$CFFF` range. Non-emitted mutable/SFA storage is a trailing BSS suffix after the
  emitted prefix so the PRG loader does not overwrite its initial bits. Final placements must be
  disjoint and fit collectively; `max_binary_size` and `max_ram` do not grant two separate
  51,199-byte pools. The build report lists emitted payload and complete shared footprint separately.
- **stack capacity**: A KERNAL profile has 236 bytes after its 20-byte firmware reserve. A takeover
  profile has all 256 bytes subject to its complete generated raw-route peak. Each simultaneously
  live interrupt entry, call return, and explicit stack push is charged; no generated entry is
  pre-subtracted.
- **Frame accounting**: Every SFA frame and static instance is reported exactly and the complete
  allocation must fit target RAM. There is no arbitrary single-frame warning threshold.

---

## 5. Artifact, Startup, Banking, and Exit

### 5.1 Resident PRG profiles

```
output:
  output_format:  prg
  load_address:   $0801
```

#### PRG format

The output is a standard C64 `.prg` file:

| Offset | Size | Content |
|--------|------|---------|
| $0000 | 2 bytes | Load address (little-endian): `$01 $08` |
| $0002 | n bytes | Contiguous emitted payload; trailing BSS is not serialized |

#### Shared loaded entry

The compiler generates a BASIC stub at $0801 that auto-starts the program:

```
$0801: $0B $08 $0A $00 $9E $32 $30 $36 $31 $00 $00 $00
       (BASIC line: 10 SYS 2061)
$080D: ← actual entry point (2061 = $080D)
```

Startup captures every compiler-owned machine value that a normal return must restore. It
establishes the hardware-stack baseline, `D=0`, selected CPU mapping, declared interrupt/device
state, CIA2 VIC-bank ownership, and language-required storage. It never recopies initialized bytes
already loaded at their final address. It then evaluates each module/zeropage `let` initializer
exactly once in Chapter 10 order and enters `main`.

#### Cooperative KERNAL profiles

The compiler owns mask `$07` in both 6510 processor-port registers: `$0000` is the data-direction
register and `$0001` is the port data latch/readback. At entry it captures both register readbacks.
It preserves bits 3–7, first writes `(saved_port & $f8) | mapping` to `$0001`, and then writes
`saved_ddr | $07` to `$0000`; this makes LORAM, HIRAM, and CHAREN outputs without a transient new
latch value. `mapping` is `$06` for the cooperative mapping and `$05` for takeover. Therefore the
complete low-bit register/latch values commonly written as `$36` and `$35` are examples for a
`saved_port & $f8` value of `$30`, not unconditional whole-byte stores.

Bits 3–7 retain their original direction and observable value throughout. A bit that remains an
input has no software-readable hidden output-latch value, so the profile neither changes its
direction nor claims to preserve unobservable latent state. On normal exit the compiler writes the
captured `$0001` readback before restoring the captured `$0000` direction byte; this restores every
observable port value and direction that the profile owns or can capture.

The four `*-kernal-*` PRG profiles and the D64 profile use the cooperative `$06` low-bit mapping
(BASIC ROM out, KERNAL ROM and I/O visible).
They use the pinned 901227-03 KERNAL entry/vector contracts. CINV/NMINV chain or explicitly
exclusive helpers are available; raw hardware-vector helpers are not. A returning `main` must have
balanced every helper-owned interrupt stack and released every exclusive resource. The epilogue
then restores the exact captured compiler-owned port, vector, device, interrupt, decimal, and stack
state and executes `RTS` to BASIC.

#### Raw takeover profiles

The four `*-takeover-*` profiles install complete IRQ `$FFFE/$FFFF` and NMI `$FFFA/$FFFB` vectors
in underlying RAM before changing the owned latch bits to `$05` under mask `$07` (BASIC and KERNAL
execution out, I/O visible). Both the ROM route before the change and the RAM route after it must be
valid; an NMI
cannot be made safe by `SEI`. During application execution the program owns every enabled IRQ/NMI
source, acknowledgement, vector, entry wrapper, nesting bound, and terminal `RTI`. KERNAL calls and
CINV/NMINV helpers are unavailable. A returning `main` restores all captured machine state and
returns to BASIC; otherwise the source path must be proved nonreturning. An unbalanced interrupt
owner or unsafe bank/vector transition is a compile-time error.

### 5.2 D64 profile

`c64-pal-d64-kernal-6581` publishes one standard 35-track D64 as its primary artifact. The image
contains the cooperative PAL/6581 boot PRG and exactly the reachable uncompressed load-unit files.
Its optional built-in KERNAL sequential loader is linked only when reached. It reuses the boot
device, requires application IRQ/NMI/audio observers and writers to be explicitly quiescent while
retaining the required KERNAL service route, and writes directly into the final destination. The
exact transfer ABI, publication rules, disk geometry, and trusted-media limitation are defined
with the loadable-asset contract in this appendix.

---

## 6. Character Encoding

```
encoding:
  default_encoding: screen_codes
  default_character_map: upper_graphics
  encodings:
    screen_codes:
      maps:
        upper_graphics: c64-screen-upper-graphics-v1
        lower_upper: c64-screen-lower-upper-v1
    petscii:
      maps:
        upper_graphics: c64-petscii-upper-graphics-v1
        lower_upper: c64-petscii-lower-upper-v1
```

### 6.1 Screen Codes (Default)

Unwrapped string and character literals use **screen codes** with the `upper_graphics` map, because
C64 games normally write text directly to the screen matrix and that is the power-on ROM character
set. The `screen_codes()` intrinsic makes the encoding choice explicit. Its optional second literal
argument selects `upper_graphics` or `lower_upper` for that literal only. It does not switch the
VIC-II character set. Direct screen memory has no newline, carriage-return, or tab byte, so those
three symbolic escapes are unavailable in both maps and produce E10249. Use explicit layout logic
or `\xNN` when an exact control/data byte is intended.

The C64 does not consume Unicode or UTF-8 text. The profile maps only its explicitly supported
Unicode source scalars to single C64 bytes at compile time; every absent scalar is E10249. This lets
a modern editor spell a supported glyph without placing Unicode data or conversion code in the
program.

The two screen-code maps are exhaustive:

| Source scalar | `c64-screen-upper-graphics-v1` | `c64-screen-lower-upper-v1` |
|---------------|--------------------------------|--------------------------------|
| U+0020..U+003F | `$20`..`$3F` respectively | `$20`..`$3F` respectively |
| `@` (U+0040) | `$00` | `$00` |
| `A`..`Z` | `$01`..`$1A` respectively | `$41`..`$5A` respectively |
| `a`..`z` | unavailable | `$01`..`$1A` respectively |
| `[` (U+005B) | `$1B` | `$1B` |
| `£` (U+00A3) | `$1C` | `$1C` |
| `]` (U+005D) | `$1D` | `$1D` |
| `↑` (U+2191) | `$1E` | `$1E` |
| `←` (U+2190) | `$1F` | `$1F` |
| `\n`, `\r`, `\t` | unavailable | unavailable |

No other Unicode scalar or symbolic escape is mapped. In particular, ASCII `\`, `^`, `_`, `` ` ``,
`{`, `|`, `}`, and `~` do not stand in for different C64 glyphs. Reverse-video codes `$80`..`$FF`
remain available through exact bytes; the compiler does not guess a Unicode-to-reverse-glyph map.

### 6.2 PETSCII

The named `petscii()` intrinsic maps source characters to **PETSCII** (PET Standard Code of
Information Interchange) at compile time for KERNAL and device I/O. Its optional second literal
argument selects the same `upper_graphics` or `lower_upper` character-set interpretation.

| Source scalar | `c64-petscii-upper-graphics-v1` | `c64-petscii-lower-upper-v1` |
|---------------|---------------------------------|---------------------------------|
| U+0020..U+003F | `$20`..`$3F` respectively | `$20`..`$3F` respectively |
| `@` (U+0040) | `$40` | `$40` |
| `A`..`Z` | `$41`..`$5A` respectively | `$C1`..`$DA` respectively |
| `a`..`z` | unavailable | `$41`..`$5A` respectively |
| `[` (U+005B) | `$5B` | `$5B` |
| `£` (U+00A3) | `$5C` | `$5C` |
| `]` (U+005D) | `$5D` | `$5D` |
| `↑` (U+2191) | `$5E` | `$5E` |
| `←` (U+2190) | `$5F` | `$5F` |
| `\n`, `\r` | `$0D` | `$0D` |
| `\t` | unavailable | unavailable |

No other Unicode scalar or symbolic escape is mapped. PETSCII has no horizontal-tab control byte
with the modern language meaning, so `\t` is E10249.

The quote and backslash escapes request ordinary characters through the selected encoding table.
If that table cannot represent one, E10249 applies; `\0` and `\xNN` remain exact in every encoding.

---

## 7. Embed Format Handlers

```
embed_formats:
  spd: spritepad
  ctm: charpad
  kla: koala
  koa: koala
  sid: sid_file

audio_player_contracts: {} # Exact qualified adapters add contract entries; PSID alone is insufficient
```

Every Specification 4 profile accepts exactly five asset forms: raw unregistered bytes and the four
registered handlers below. SpritePad and
CharPad use pinned producer releases as qualification provenance plus observable file identities.
Koala uses its fixed native layout. SID uses the hash-pinned HVSC PSID/RSID format-description
snapshot named below rather than a producer-application version. The compiler never interprets
"latest" at build time or claims to detect an application release that a file does not encode.
Every unregistered format generation or variant fails with E10204. Ordinary one-argument
`embed(path)` remains the format-neutral raw-byte path for `.prg` and any other file whose extension
has no registered handler; raw passthrough is not listed in `embed_formats` and exposes no selector.

### 7.1 SpritePad (`.spd`)

The initial profile pins SpritePad Pro 3.80 and accepts only SPD v5. The handler validates every
declared count, component flag, index, and record boundary before producing a value.

| Selector | Type | Description |
|----------|------|-------------|
| `"sprites"` | `const byte[]` | Exact native records: 63 bitmap bytes plus one packed attribute byte per sprite; 64-byte aligned and VIC-bank visible |
| `"count"` | `word` | Number of sprites |
| `"background_color"` | `byte` | Global transparent/background color |
| `"multicolor_1"` | `byte` | First global multicolor value |
| `"multicolor_2"` | `byte` | Second global multicolor value |
| `"sprite_attributes"` | `const byte[]` | Explicit derived contiguous table of packed per-sprite attributes |
| `"tile_count"` | `word` | Number of sprite tiles |
| `"tile_width"` | `byte` | Tile width in sprites |
| `"tile_height"` | `byte` | Tile height in sprites |
| `"tiles"` | `const word[]` | Native row-major sprite indices for every tile |
| `"tile_attributes"` | `const byte[]` | Native per-tile attributes |
| `"tile_tags"` | `const byte[]` | Native per-tile tags |
| `"sprite_overlay_distance"` | `word` | Underlay-to-overlay sprite distance |
| `"tile_overlay_distance"` | `word` | Underlay-to-overlay tile distance |
| `"sprite_animation_count"` | `word` | Number of sprite animations |
| `"sprite_animation_starts"` | `const word[]` | First sprite index for each animation |
| `"sprite_animation_ends"` | `const word[]` | Last sprite index for each animation |
| `"sprite_animation_timers"` | `const byte[]` | Native timer byte for each sprite animation |
| `"sprite_animation_flags"` | `const byte[]` | Native flags for each sprite animation |
| `"tile_animation_count"` | `word` | Number of tile animations |
| `"tile_animation_starts"` | `const word[]` | First tile index for each animation |
| `"tile_animation_ends"` | `const word[]` | Last tile index for each animation |
| `"tile_animation_timers"` | `const byte[]` | Native timer byte for each tile animation |
| `"tile_animation_flags"` | `const byte[]` | Native flags for each tile animation |
| **Default when selector is omitted** | `"sprites"` | `embed("file.spd")` selects the native 64-byte sprite records |

There is no file-wide `"multicolor"` selector. Color, multicolor mode, X/Y expansion, and overlay
status come from each sprite's packed attribute byte. Zero-copy C64 operations expose those fields
directly; the explicitly selected `"sprite_attributes"` table is separately emitted and costed.
Tile names remain compile-time lookup metadata and are not emitted as runtime strings.

`vicSpriteBlock(&SPRITES)` is the zero-runtime-cost placement operation. It checks 64-byte alignment
and VIC-bank visibility, then returns `(addressWithinVicBank / 64)`. The handler has no
`"base_block"` or implicit offset-table selector. Ordinary base-plus-frame arithmetic is valid only
for records that remain in that VIC bank; larger sets require an explicit bank or loader layout.

### 7.2 CharPad (`.ctm`)

The initial profile is qualified against CharPad C64 Pro 3.88 and accepts only structurally valid
CTM v9 files: bytes 0–2 are ASCII `CTM` and byte 3 is version 9. The producing application release
is provenance, not an encoded file field, so every byte-valid CTM v9 file receives the same
treatment. Before exposing selectors, the handler validates the complete profile-pinned CTM v9
header and ordered-block schema, including flags, counts, dimensions, optional-block conditions,
payload lengths, every referenced index, block boundaries, and exact end of file. A malformed
structure or another version is E10204. The handler has no default; omitting the selector is E10132.

| Selector | Type | Description |
|----------|------|-------------|
| `"charset"` | `const byte[]` | Character images in character-number order (8 bytes each); 2048-byte aligned and visible to the selected VIC bank |
| `"tiles"` | `const byte[]` or `const word[]` | In tile mode, row-major character indices using the smallest lossless logical element type |
| `"map"` | `const byte[]` or `const word[]` | Row-major tile indices in tile mode, otherwise row-major character indices, using the smallest lossless logical element type |
| `"tiles_word"` | `const word[]` | Forced 16-bit little-endian tile indices, even when all values fit in a byte; available in tile mode |
| `"map_word"` | `const word[]` | Forced 16-bit little-endian map indices, even when all values fit in a byte |
| `"tiles_packed12"` | `const byte[]` | File-derived packed-12 tile indices; available in tile mode when every index is at most 4095 |
| `"map_packed12"` | `const byte[]` | File-derived packed-12 map indices; available when every index is at most 4095 |
| `"tiles_low"` | `const byte[]` | Low-byte plane for tile indices; available in tile mode |
| `"tiles_high"` | `const byte[]` | High-byte plane for tile indices; available in tile mode |
| `"map_low"` | `const byte[]` | Low-byte plane for map indices |
| `"map_high"` | `const byte[]` | High-byte plane for map indices |
| `"colors"` | `const byte[]` | Native CharPad color table for the selected color method |
| `"color_method"` | `byte` | Native CharPad color-method identifier |
| `"map_width"` | `word` | Map width in entries |
| `"map_height"` | `word` | Map height in entries |
| `"tile_width"` | `byte` | Tile width in characters; `1` without a tile layer |
| `"tile_height"` | `byte` | Tile height in characters; `1` without a tile layer |
| `"tile_mode"` | `boolean` | Whether `"tiles"` exists and `"map"` indexes tiles |

For `"tiles"` and `"map"`, a maximum referenced index of 255 selects `byte[]`; a larger index selects
`word[]`, whose elements use Blend65's little-endian word representation. A declaration that names
the other type fails with E10144 and reports the required type. This boundary is never truncated and
is not a format parse error. The packed-12 selectors use the exact layout pinned by the registered
CharPad profile and are absent when the corresponding layer does not exist or any index exceeds
4095. The `"tiles_word"` and `"map_word"` selectors always emit the same logical values as
`word[]`, low byte then high byte per element, so source may deliberately retain a stable 16-bit
data contract when a current asset happens to fit in 8 bits.

For `N` logical values `v[0]` through `v[N-1]`, a packed-12 selector emits `N` low bytes followed by
`ceil(N/2)` packed high-nibble bytes. Packed byte `j` is
`((v[2*j] >> 8) & $0f) | (((v[2*j+1] >> 8) & $0f) << 4)`; when `N` is odd, the absent final value
contributes zero to the upper nibble. Thus `$123,$456,$789` emits `$23,$56,$89,$41,$07`. The
selector is absent when the corresponding layer does not exist or any value exceeds `$fff`; it
never truncates. The low and high selectors are independent full byte planes suitable for 6502
indexed access.

The handler emits and reports only explicitly selected representations. Supporting 8-, 12-, and
16-bit output does not mean emitting all three: it never silently emits a canonical, forced-word,
packed, or split companion, and does not create flattened screen data, derived color RAM, or
implicit offset tables. A raw CharPad binary export may still be included through ordinary raw
`embed(path)`, but it has no project dimensions or selector metadata and is not parsed as CTM.

VIC-II character selection is derived from final placement, not from the CTM file. The zero-cost
C64 platform operation `vicCharsetSelect(&CHARSET)` checks 2048-byte alignment and visibility in the
selected VIC bank, then returns `((addressWithinVicBank / 2048) & $07) << 1`, the already-positioned
character-memory field for `$D018`. Offset tables, when explicitly requested, are separate named
assets whose memory cost is reported.

### 7.3 SID File (`.sid`)

The initial game-integration handler is qualified against source key
`HVSC-SID-FORMAT-20260906`: the official HVSC `SID_file_format.txt` bytes retrieved 2026-09-06
(SHA-256 `b89a78d3c1d90d0b8c6b4cfd2001be026ad6c2c31b73cdbab857c627a60779f0`). It accepts only the self-contained, directly callable,
C64-compatible **PSID v1 through v4** subset. It rejects `RSID`, Compute! MUS payloads,
PlaySID-specific payloads, and a zero play address. A valid PSID whose declared video, chip-model,
or multi-SID requirements do not fit the selected profile is E10261 rather than a parse failure.
The excluded environment-dependent variants require a standalone C64 environment, an external
player, or a self-installed interrupt path rather than the ordinary game-owned init/play contract
exposed here.

The handler validates all of the following before exposing a selector:

- ASCII magic `PSID`; big-endian version 1–4; data offset `$0076` for v1 or `$007C` for v2–v4;
- a non-empty payload and every version-specific header field, reserved bit, flag, relocation range,
  SID address, song count (`1..256`), and start-song range;
- for v2–v4, clear MUS-player and PlaySID-specific bits, plus no second/third SID unless the selected
  profile explicitly supports those addresses;
- exact compatibility between every specific clock/model/SID-address declaration, the selected
  `video_standard` and `sid_chips` topology, and any attached callable player contract;
- an effective load address and payload interval that do not wrap and fit writable selected-profile
  memory, with effective init and nonzero play addresses inside that emitted interval.

All header words and longwords are big-endian. If the header load address is nonzero, payload bytes
begin at `dataOffset`. If it is zero, the first two payload bytes are the little-endian effective
load address and are stripped from the emitted data. A zero header init address resolves to that
effective load address. The linker places the selected data bytes exactly at the effective load
address; it does not relocate or copy them at runtime. A malformed or unregistered format identity
is E10204; a valid but incompatible target declaration is E10261.

PSID v1 has no video-standard or SID-model flag and therefore makes no compatibility claim. For
PSID v2NG through v4, the handler decodes the flag pairs exactly:

| Field | `00` | `01` | `10` | `11` |
|-------|------|------|------|------|
| Video standard, bits 2–3 | Unknown | PAL | NTSC | PAL and NTSC |
| Primary SID model, bits 4–5 | Unknown | MOS6581 | MOS8580 | MOS6581 and MOS8580 |
| Second SID model, bits 6–7 (v3+) | Inherit primary | MOS6581 | MOS8580 | MOS6581 and MOS8580 |
| Third SID model, bits 8–9 (v4+) | Inherit primary | MOS6581 | MOS8580 | MOS6581 and MOS8580 |

`Unknown` does not mean that every machine is compatible; it means that the header asserts no
restriction. Embed-only data remains legal when a field is unknown. Callable audio additionally
requires the exact hash-bound player contract to include the selected `video_standard` and every
selected `sid_chips` endpoint. A contract may close an unknown header field but cannot override a
specific header restriction.

For a specific or `11` field, the selected profile value must be a member of the declared set. A
second or third SID address must exist exactly in `sid_chips`, its resolved model set must contain
that endpoint's concrete model, and the player contract must support the complete topology. The
current C64 baseline has one `$D400` endpoint, so any second or third SID is E10261. A PSID header
never activates, configures, or proves extra hardware. No automatic PAL/NTSC cadence conversion,
oscillator retuning, filter adaptation, or model translation is performed.

| Selector | Type | Description |
|----------|------|-------------|
| `"data"` | `const byte[]` | Player + music payload with fixed linker placement at the effective load address |
| `"init_address"` | `word` | Effective init routine address; header zero resolves to the effective load address |
| `"play_address"` | `word` | Nonzero play routine address, called according to the selected tune's declared cadence |
| **Default when selector is omitted** | `"data"` | `embed("file.sid")` selects the combined player and music data |

#### 7.3.1 Qualified game-audio operations

The `.sid` header describes music initialization and playback; it does not describe a sound-effect
ABI, voice arbitration, writable player state, or interrupt ownership. An embedded payload therefore
becomes callable through `c64.audio` only when its format handler preserves provenance to an exact
`audio_player_contracts` entry in the selected profile. An ordinary PSID payload with no matching
contract remains valid embedded data, but using it with an audio operation is E10256. The compiler
never infers a sound-effect interface from a PSID header.

The player-neutral source operations are:

```blend65
import {
    audioInitDefault,
    audioInit,
    audioInitNamed,
    audioTick,
    audioTriggerSfx,
    audioTriggerSfxOn,
} from c64.audio;

audioInitDefault(&AUDIO);              // Contract-defined default song
audioInit(&AUDIO, 0);                  // Zero-based song index
audioInitNamed(&AUDIO, "victory");    // Compile-time cue name
audioTick(&AUDIO);                     // Exactly one player update
audioTriggerSfx(&AUDIO, "explosion");
audioTriggerSfxOn(&AUDIO, "explosion", 2); // Logical SID voice 0..2
```

`AUDIO` is a module-scope embedded asset whose handler attached a qualified player contract. Named
song and effect arguments are string literals resolved at compile time; no string or name table is
emitted. A contract may additionally permit a dynamic numeric song/effect ID and must state its
exact type and valid range. Asking for an absent operation, cue, dynamic-ID form, or voice is
E10257 and lists the contract's available forms.

`audioTick()` performs exactly one update and does not install, chain, or schedule an interrupt.
Source owns the call site and cadence, normally by placing it in the game's existing raster or timer
handler. A reachable overlap between a non-reentrant player operation and another interrupt or
mainline call is E10258. If the contract requires a critical section, the compiler may emit only a
bounded inline section that masks every declared racing source, restores the prior state, and
reports its exact byte and cycle cost. A partial mask or a hidden generic lock is rejected.

For constant arguments each operation lowers directly to the contract's register setup and absolute
`JSR` entry. There is no generic dispatcher, scheduler, mixer, queue, copied payload, name lookup,
or linked runtime. A queue or arbitration algorithm exists only when the selected player itself
provides it and the contract declares its code, data, timing, priority, replacement, same-frame
request, and music-resume behavior. `audioTriggerSfxOn()` uses logical SID voices `0..2`; the
contract maps those to its ABI, such as GoatTracker's channel offsets `0`, `7`, and `14`.

Every audio-player contract identifies and hash-binds the exact player/export family it accepts and
declares:

- fixed or relocatable placement, executable entry points, writable/self-modifying ranges, and any
  required banking state;
- init, tick, named/numeric song, SFX, and explicit-voice ABIs; register, flag, decimal-state,
  interrupt-state, `$01`, stack, RAM, zero-page, MMIO, and self-modification effects;
- tune/effect inventories, default selection, dynamic-ID support, logical-to-player voice mapping,
  priority, replacement, resume, and same-frame request rules;
- supported `video_standard` values and exact `sid_chips` address/model topologies; cadence, legal
  call domains, interrupt/CIA ownership, reentrancy, and SID/filter ownership; and
- feature-dependent code/data sizes plus worst-case and path-specific cycle costs.

The source declaration's `const` qualifier forbids Blend65 source from mutating the asset. It does
not claim that the physical bytes are ROM-safe: contract-declared writable or self-modifying ranges
are player-owned state and the linker must place them in writable, visible memory. The build summary
reports the selected contract identity, enabled operations, placement, all player-owned memory and
zero-page ranges, cadence assumptions, and code/data/cycle costs.

GoatTracker, SID Factory II, and other player/export families are not additional native asset
handlers. A payload becomes callable only through an exact hash-bound `audio_player_contracts`
entry. The baseline profiles have no universal entry. GoatTracker 2.77 must be the first
player-adapter family qualified; until its exact player/export hash and ABI evidence pass that
gate, the maps remain empty. Adding that qualified entry later does not change the five asset forms
or supply a scheduler or mixer.

### 7.4 Koala Paint (`.kla` / `.koa`)

The initial Koala handler accepts only the classic native 10,003-byte layout: the two-byte
little-endian load address `$6000`, followed by 8,000 bitmap bytes, 1,000 screen-matrix bytes,
1,000 Color RAM bytes, and one background-color byte. Every Color RAM byte and the background byte
is accepted and preserved in full; only `value & $0f` carries VIC-II color meaning. A nonzero high
nibble is not an error and is never normalized away. The `.kla` and `.koa` extensions select the
candidate handler but do not prove the format. A wrong load address, wrong length, or malformed
component is E10204. The load-address bytes are metadata and are not part of any selector result.

| Selector | Type | Description |
|----------|------|-------------|
| `"bitmap"` | `const byte[8000]` | Native multicolor bitmap bytes; 8-KiB aligned and visible in the selected VIC bank |
| `"screen"` | `const byte[1000]` | Native screen-matrix bytes; 1-KiB aligned and visible in the same selected VIC bank as `"bitmap"` |
| `"color_ram"` | `const byte[1000]` | Exact source bytes; low nibbles are the VIC-II colors and copying to Color RAM is explicit runtime work |
| `"background"` | `byte` | Exact source byte; its low nibble is the VIC-II background color |

The handler has no default selector; omission is E10132. It emits and reports only the explicitly
selected component. It has no address, bank, base, or register-field selector.

Final placement, not the Koala file, determines the VIC-II memory-pointer fields. The zero-cost
operations `vicBitmapSelect(&BITMAP)` and `vicScreenSelect(&SCREEN)` validate that both assets are
visible in the same selected 16-KiB VIC bank, that the bitmap is 8-KiB aligned, that the screen is
1-KiB aligned, and that both bank-relative offsets are legal. They return the already-positioned
`$D018` fields:

```text
vicBitmapSelect(&BITMAP) = ((addressWithinVicBank / $2000) & $01) << 3
vicScreenSelect(&SCREEN) = ((addressWithinVicBank / $0400) & $0f) << 4
```

These operations emit no data, call, or runtime calculation. Color RAM is separate 4-bit hardware
memory at `$D800` in the standard C64 profile; displaying the image therefore requires an explicit,
costed transfer of the selected `"color_ram"` bytes. The handler must never hide that transfer.

### 7.5 Standard D64 and KERNAL Sequential Load

Only `c64-pal-d64-kernal-6581` provides runtime loading. Its primary artifact is one headerless,
error-table-free 174,848-byte D64 containing the boot PRG and every reachable uncompressed load
unit. The physical contract is fixed:

| Tracks | Sectors per track | Sector numbers |
|--------|------------------:|----------------|
| 1–17 | 21 | 0–20 |
| 18–24 | 19 | 0–18 |
| 25–30 | 18 | 0–17 |
| 31–35 | 17 | 0–16 |

The 683 sectors are stored as raw 256-byte sectors in track/sector order. BAM is 18/0 and the
directory starts at 18/1. File data does not use track 18, leaving 664 data blocks. Eighteen
directory sectors with eight entries each permit at most 144 closed files. A closed PRG entry uses
type `$82`. File-sector bytes 0–1 link to the next track/sector and bytes 2–255 carry up to 254 data
bytes. In the final sector, byte 0 is zero and byte 1 is the last used byte index, so payload length
is `byte1 - 1`. Any invalid geometry, BAM, directory, link, count, or capacity state is rejected.

The built-in `kernal-sequential-uncompressed` transport is optional and linked only when a load call
is reachable. It uses KERNAL 901227-03 exactly:

1. Reuse the boot device recorded in KERNAL `FA`; source does not name a device or packaged filename.
2. Call `SETLFS` at `$FFBA` with logical file in A, the boot device in X, and secondary address zero
   in Y.
3. Call `SETNAM` at `$FFBD` with the compiler-owned directory-name length in A and address in X/Y.
4. Evaluate the mutable destination exactly once and call relocating `LOAD` at `$FFD5` with A zero
   and that destination in X/Y.
5. Return `true` only when carry is clear and returned X/Y equals the low 16 bits of conceptual
   `destination + sizeof(unit)`. An exact end at `$10000` returns `$0000`; extending beyond it is a
   compile-time error. KERNAL error, short transfer, or unexpected end returns `false`.

Before the call, the source program explicitly stops and restores its own callback and audio routes
and proves every other selected-profile asynchronous observer or writer absent or quiescent. The
required stock KERNAL service route remains active. The compiler neither suspends application
behavior nor promises timing continuity. KERNAL writes directly into the final destination. A
successful boolean edge publishes only the captured destination range; failure invalidates only
that range because a partial transfer may already have changed it.

**HLE-010 — stock KERNAL load is trusted-media only.** `LOAD` has no maximum-length parameter and
writes a received byte before its returned end address can be checked. The exact compiler-produced
D64 is trusted. A readable longer replacement may overwrite beyond the expected destination before
the wrapper returns `false`. No checksum, staging buffer, relocation copy, compressor, fastloader,
custom bounded transport, or hostile-media containment is claimed.

---

## 8. Platform Warnings

```
warnings:
  warn_array_size: 256
  warn_stack_peak: 188
  warn_zp_percent: 75
  warn_ram_percent: 75
  warn_struct_zp_size: 35
  warn_embed_percent: 75
```

| Warning | Threshold | Rationale |
|---------|-----------|-----------|
| W10143 (array size) | 256 bytes | Large arrays consume scarce RAM and often require indirect indexing |
| W10180 (stack peak) | 188 bytes | 80% of the 236-byte KERNAL-compatible usable hardware stack, rounded down |
| W10030 / W10033 | 75% of ZP / shared RAM budget | Surface pressure before placement fails |
| W10110 (one ZP struct) | 35 bytes | A single struct consumes approximately one quarter of allocatable zero page |
| W10150 (embedded data) | 75% of binary budget | Surface asset pressure in the shared program span |

---

## 9. Platform-Specific Notes

### 9.1 Cycle Timing

| Baseline record | CPU cycles/second | Raster geometry | Cycles/frame | Frames/second |
|-----------------|------------------:|-----------------|-------------:|--------------:|
| PAL | 985,248 | 312 lines × 63 cycles | 19,656 | approximately 50.124542 |
| NTSC | 1,022,730 | 263 lines × 65 cycles | 17,095 | approximately 59.826265 |

Raster time per visible line is 40 visible characters = 40 cycles; badlines and sprite DMA steal
additional CPU access. These are the selected baseline timing records, not universal claims for
PAL-N, early NTSC, or every VIC-II revision.

### 9.2 IRQ Considerations

Cooperative KERNAL profiles are bound to the standard 901227-03 KERNAL IRQ path. The hardware IRQ vector
enters KERNAL PULS/PULS1, which saves A/X/Y and then jumps through CINV at `$0314/$0315`. A CINV
handler is therefore entered with six live stack bytes: the CPU's P/PCL/PCH and KERNAL's saved
A/X/Y. It must not push A/X/Y a second time and must not execute `RTI` directly.

The 6510 does not clear decimal mode on IRQ entry. The compiler therefore makes the first Blend65
handler statement and every initially called ordinary helper observe `D=0`. A default chained
variant uses `PHP; CLD` before the body and `PLP` before the chain, preserving the prior handler's
entry flags; this makes seven stack bytes live while the body runs. Exclusive and raw variants use
`CLD` without another status push because their eventual `RTI` restores the interrupted status.

The C64 platform library exposes three deliberately different IRQ tiers:

| API | Availability and generated contract | Generated handler tail |
|---|---|---|
| `c64.system.setIRQ(&handler)` | Default. Atomically saves the current CINV in a dedicated page-safe two-byte static link and installs a no-second-save handler variant. `PHP; CLD` precedes the body; `PLP` restores entry flags before the handler chains. | Normalization/status wrapper: 3 bytes, 9 cycles, 1 stack byte. Tail: `JMP (saved_previous_cinv)` — 3 bytes, 5 cycles, plus the chained handler. |
| `c64.system.setIRQExclusive(&handler)` | Advanced KERNAL takeover. Installs a no-second-save variant, enters the body through `CLD`, and does not call the previous CINV handler. The program owns every enabled IRQ source that can reach this path. | Normalization: 1 byte, 2 cycles. Tail: `JMP $EA81` — 3 bytes, 3 cycles, then the 901227-03 Y/X/A restore and `RTI` tail (22 cycles). |
| `c64.system.setRawIRQ(&handler)` | Available only in a takeover profile after `$FFFE/$FFFF` is proved writable and active. | Compiler A/X/Y save, `CLD`, restore, and direct `RTI` — 12 bytes, 37 cycles. |

The NMI routes are distinct because 901227-03 reaches NMINV at `$0318/$0319` without saving A/X/Y
or clearing decimal mode:

| API | Availability and generated contract | Generated wrapper |
|---|---|---|
| `c64.system.setNMI(&handler)` | Cooperative KERNAL profiles. Saves the prior NMINV in one page-safe two-byte link and leaves CIA2 ICR state for the prior handler. | `PHP`; save A/X/Y; `CLD`; body; restore Y/X/A; `PLP`; `JMP (saved_previous_nminv)` — 16 bytes, 43 cycles plus body and the variable prior-handler path. |
| `c64.system.setNMIExclusive(&handler)` | Cooperative KERNAL profiles only when the program owns or replaces CIA2, RESTORE, cartridge, and every other NMI behavior. | Save A/X/Y; `CLD`; body; restore Y/X/A; `RTI` — 12 bytes, 37 cycles plus body. |
| `c64.system.setRawNMI(&handler)` | Takeover profiles only, after `$FFFA/$FFFB` and every reachable bank state are proved valid. | Save A/X/Y; `CLD`; body; restore Y/X/A; `RTI` — 12 bytes, 37 cycles plus body. |

Hardware acceptance adds 7 cycles and 3 stack bytes to every IRQ or NMI route. The 901227-03
KERNAL IRQ path adds 29 cycles and 16 existing-ROM bytes before CINV; its NMI stub adds 7 cycles
and 4 existing-ROM bytes before NMINV. Existing ROM bytes are reported separately from output
bytes. Only reachable variants, saved links, and wrappers are emitted. Every replaceable sink has
its matching restore operation and compile-time LIFO ownership proof.

Installer code updates the two-byte vector inside a caller-state-preserving interrupt-disabled
critical section; its actual emitted bytes and cycles are reported. The chain variant's two RAM
bytes must start at a low byte no greater than `$FE`: `$xxFE` is valid, while `$xxFF` is relocated
or rejected because NMOS `JMP ($xxFF)` fetches the high byte from `$xx00`. Any duplicated handler
body/SFA homes, decimal normalization, status preservation, KERNAL entry/exit path, and every
generated byte are also reported. These APIs are compiler-recognized typed sinks, not a generic dispatcher or
linked runtime. `setIRQ` is the normal choice for programs that retain KERNAL services;
`setIRQExclusive` and a raw profile are explicit expert ownership choices.

The handler must acknowledge the actual source it owns. The compiler never guesses VIC versus CIA.
An exclusive handler must handle or disable every IRQ source that remains enabled, including the
default CIA source when applicable. Writing `pokew($0314, &handler)` is E10252 because the raw entry
address has the wrong stack/exit ABI for CINV. Truly opaque vector writes remain unsafe boundaries.
The setter is a vector-ownership operation, not a multi-listener runtime; code that layers or
restores different handlers must preserve a valid chain.

### 9.3 VIC-II Bank Considerations

VIC-II addresses one 16 KiB bank selected through the owned low bits of CIA2 `$DD00`, with their
direction established in `$DD02`. Screen, charset, bitmap, sprite data, and sprite-pointer values
derive from final placement in that bank. A bank switch preserves unrelated CIA2 bits and cannot
move across an affected CPU or VIC access. Misalignment, mixed-bank placement, a character-ROM
visibility conflict, or an unowned CIA2 update is rejected; the compiler never repairs it by
copying the data or inventing a custom target profile.

### 9.4 Optional Safety Stop

The default unchecked array contract emits no bounds handling. Its effective address is computed
modulo 65536; a multi-byte element continues from `$FFFF` to `$0000`, and each byte observes the
active C64 banking and MMIO map. A constant provably outside the array is still a compile-time
error. The checks below are explicit, independent, and off by default.

When `--bounds-check` or `--division-zero-check` detects a failure, the C64 profile branches to a
source-labelled terminal block emitted in ROM/code bytes. The block uses no RAM or zero page and is
non-returning:

```asm
blend65_safety_stop_file_line:
    SEI
.stop:
    JMP .stop
```

The source label identifies the failed site in symbols and the build report; no text renderer,
KERNAL call, runtime library, handler, or writable state is injected. `SEI` prevents further
maskable IRQ entry. NMI, reset, and external hardware activity retain their real C64 behavior.

### 9.5 Evidence Contract

Every profile result records the exact profile ID, NMOS 6510 legality, video record, VIC-II/CIA/SID
model assumptions, 901227-03 KERNAL identity when used, `$0000/$0001` and `$DD00/$DD02` ownership,
enabled IRQ/NMI sources, memory/ZP/stack use, ACME 0.97 identity, artifact hash, VICE 3.10 `x64sc`
configuration, initial state, stop condition, expected state, and return or nonreturning exit.
Shared proofs may be factored by dimension, but each of the nine complete identities requires its
own fresh artifact and bounded runtime observation. Raster, CIA-edge, SID analogue/revision,
undocumented-silicon, cartridge/expansion, and unusual-banking claims require targeted physical QA.

---

## 10. First Profile Record and Closed Deltas

```yaml
# Blend65 Platform Profile: first qualified identity
profile_id: c64-pal-prg-kernal-6581
platform: c64
cpu: mos6510-nmos
video_standard: pal
clock_mhz: 0.985248
runtime_ownership: cooperative_kernal
kernal_rom: 901227-03
processor_port:
  owned_mask: $07
  ddr_bits: $07
  latch_bits: $06

sid_chips:
  - address: $D400
    model: mos6581

memory:
  code_start:     $0801
  code_end:       $CFFF
  data_start:     $0801
  data_end:       $CFFF
  ram_start:      $0801
  ram_end:        $CFFF
  zp_start:       $02
  zp_end:         $8F
  stack_capacity: 256
  stack_reserve:  20

budgets:
  max_binary_size: 51199
  max_ram:         51199
  max_zp:          142

interrupt_sources:
  irq:
    may_preempt: [mainline, irq, nmi, callback]
    masks_self_on_entry: true
    external_reentry_bound: unbounded
  nmi:
    may_preempt: [mainline, irq, nmi, callback]
    masks_self_on_entry: false
    external_reentry_bound: unbounded

interrupt_entry_variants:
  c64_kernal_cinv_chain:
    accepted_source_kind: interrupt_handler
    register_save_owner: firmware
    handler_entry_stack_bytes: 7
    decimal_mode_on_body_entry: binary
    entry_status_policy: preserve_and_restore_before_chain
    entry_normalization_bytes: 3
    entry_normalization_cycles: 9
    terminal: jump_saved_previous_vector
    static_link_bytes: 2
    static_link_low_byte_max: $FE
  c64_kernal_cinv_exclusive:
    accepted_source_kind: interrupt_handler
    register_save_owner: firmware
    handler_entry_stack_bytes: 6
    decimal_mode_on_body_entry: binary
    entry_status_policy: restore_by_rti
    entry_normalization_bytes: 1
    entry_normalization_cycles: 2
    terminal: jump_firmware_restore_tail
    terminal_address: $EA81
    static_link_bytes: 0
  c64_kernal_nminv_chain:
    accepted_source_kind: interrupt_handler
    register_save_owner: compiler
    handler_entry_stack_bytes: 7
    decimal_mode_on_body_entry: binary
    entry_status_policy: preserve_and_restore_before_chain
    terminal: jump_saved_previous_vector
    static_link_bytes: 2
    static_link_low_byte_max: $FE
  c64_kernal_nminv_exclusive:
    accepted_source_kind: interrupt_handler
    register_save_owner: compiler
    handler_entry_stack_bytes: 6
    decimal_mode_on_body_entry: binary
    entry_status_policy: restore_by_rti
    terminal: rti
    static_link_bytes: 0

function_address_sinks:
  c64.system.setIRQ:
    accepted_source_kind: interrupt_handler
    entry_variant: c64_kernal_cinv_chain
    execution_domain: irq
    interrupt_source: irq
  c64.system.setIRQExclusive:
    accepted_source_kind: interrupt_handler
    entry_variant: c64_kernal_cinv_exclusive
    execution_domain: irq
    interrupt_source: irq
  c64.system.setNMI:
    accepted_source_kind: interrupt_handler
    entry_variant: c64_kernal_nminv_chain
    execution_domain: nmi
    interrupt_source: nmi
  c64.system.setNMIExclusive:
    accepted_source_kind: interrupt_handler
    entry_variant: c64_kernal_nminv_exclusive
    execution_domain: nmi
    interrupt_source: nmi

recognized_interrupt_vectors:
  $0314:
    entry_contract: c64_kernal_cinv_postsave
    required_installer: c64.system.setIRQ
  $0318:
    entry_contract: c64_kernal_nminv_presave
    required_installer: c64.system.setNMI

raw_interrupt_paths: {}

output:
  output_format:  prg
  load_address:   $0801

exit:
  normal_return: restore_compiler_owned_state_then_rts_to_basic

evidence:
  assembler: ACME-0.97
  emulator: VICE-3.10-x64sc
  physical_status: required_for_sensitive_claims

encoding:
  default_encoding: screen_codes
  default_character_map: upper_graphics
  encodings:
    screen_codes:
      maps:
        upper_graphics: c64-screen-upper-graphics-v1
        lower_upper: c64-screen-lower-upper-v1
    petscii:
      maps:
        upper_graphics: c64-petscii-upper-graphics-v1
        lower_upper: c64-petscii-lower-upper-v1

embed_formats:
  spd: spritepad
  ctm: charpad
  kla: koala
  koa: koala
  sid: sid_file

audio_player_contracts: {} # Exact qualified adapters add contract entries; PSID alone is insufficient

warnings:
  warn_array_size: 256
  warn_stack_peak: 188
  warn_zp_percent: 75
  warn_ram_percent: 75
  warn_struct_zp_size: 35
  warn_embed_percent: 75
```

The takeover delta replaces, rather than extends, all four interrupt-routing maps from the first
record:

```yaml
interrupt_entry_variants:
  c64_raw_irq:
    accepted_source_kind: interrupt_handler
    register_save_owner: compiler
    handler_entry_stack_bytes: 6
    decimal_mode_on_body_entry: binary
    entry_status_policy: restore_by_rti
    entry_normalization_bytes: 1
    entry_normalization_cycles: 2
    terminal: rti
    static_link_bytes: 0
  c64_raw_nmi:
    accepted_source_kind: interrupt_handler
    register_save_owner: compiler
    handler_entry_stack_bytes: 6
    decimal_mode_on_body_entry: binary
    entry_status_policy: restore_by_rti
    entry_normalization_bytes: 1
    entry_normalization_cycles: 2
    terminal: rti
    static_link_bytes: 0

function_address_sinks:
  c64.system.setRawIRQ:
    accepted_source_kind: interrupt_handler
    entry_variant: c64_raw_irq
    execution_domain: irq
    interrupt_source: irq
  c64.system.setRawNMI:
    accepted_source_kind: interrupt_handler
    entry_variant: c64_raw_nmi
    execution_domain: nmi
    interrupt_source: nmi

recognized_interrupt_vectors:
  $FFFE:
    entry_contract: c64_raw_irq
    required_installer: c64.system.setRawIRQ
  $FFFA:
    entry_contract: c64_raw_nmi
    required_installer: c64.system.setRawNMI

raw_interrupt_paths:
  irq:
    vector_address: $FFFE
    vector_bytes: [$FFFE, $FFFF]
    writable_when: processor_port_mask_07_outputs_and_latch_05
    active_when: processor_port_mask_07_outputs_and_latch_05
  nmi:
    vector_address: $FFFA
    vector_bytes: [$FFFA, $FFFB]
    writable_when: processor_port_mask_07_outputs_and_latch_05
    active_when: processor_port_mask_07_outputs_and_latch_05
```

The other eight records are exact closed deltas from the first record:

| Profile ID | Exact delta |
|------------|-------------|
| `c64-pal-prg-kernal-8580` | `sid_chips[0].model = mos8580` |
| `c64-pal-prg-takeover-6581` | `runtime_ownership = raw_takeover`; processor-port owned mask `$07`, DDR low bits `$07`, and latch low bits `$05`; replace all four interrupt-routing maps with the takeover maps above; no KERNAL call path while the application runs; all enabled IRQ/NMI sources owned; `stack_reserve = 0` |
| `c64-pal-prg-takeover-8580` | takeover delta above plus `sid_chips[0].model = mos8580` |
| `c64-ntsc-prg-kernal-6581` | `video_standard = ntsc`; `clock_mhz = 1.022730`; 263 lines × 65 cycles; later NTSC VIC-II record |
| `c64-ntsc-prg-kernal-8580` | NTSC delta above plus `sid_chips[0].model = mos8580` |
| `c64-ntsc-prg-takeover-6581` | NTSC delta plus the takeover delta |
| `c64-ntsc-prg-takeover-8580` | NTSC and takeover deltas plus `sid_chips[0].model = mos8580` |
| `c64-pal-d64-kernal-6581` | `output_format = d64`; the boot PRG retains the first record; the primary artifact contains the boot PRG and reachable load units; loader strategy `kernal-sequential-uncompressed` is available only when reached |

These deltas are specification compression, not user-composable switches. Every unlisted field is
the first record's contract.

---

## Gate G3 Checklist (first profile)

| Profile Slot | Filled? |
|---|---|
| video_standard | ✅ `pal` baseline (`ntsc` selects its separate timing record) |
| sid_chips | ✅ one MOS6581 endpoint at `$D400` in this concrete profile |
| code_start / code_end | ✅ $0801 / $CFFF |
| data_start / data_end | ✅ $0801 / $CFFF |
| ram_start / ram_end | ✅ $0801 / $CFFF |
| zp_start / zp_end | ✅ $02 / $8F |
| stack_capacity | ✅ 256 |
| stack_reserve | ✅ 20 |
| max_binary_size | ✅ 51199 |
| max_ram | ✅ 51199 |
| max_zp | ✅ 142 |
| interrupt_entry_variants | ✅ KERNAL chain, KERNAL exclusive, and raw IRQ ABIs are explicit |
| function_address_sinks | ✅ `setIRQ` and `setIRQExclusive`; `setRawIRQ` requires a raw profile |
| recognized_interrupt_vectors | ✅ `$0314` → KERNAL CINV post-save contract |
| raw_interrupt_paths | ✅ empty in the default KERNAL-active profile |
| output_format | ✅ prg |
| load_address | ✅ $0801 |
| reset_vector | N/A (disk-based, not cartridge) |
| default_encoding | ✅ screen_codes |
| default_character_map | ✅ upper_graphics |
| encodings | ✅ screen_codes and petscii, each with upper_graphics and lower_upper |
| embed_formats | ✅ spd, ctm, kla, koa, sid |
| audio_player_contracts | ✅ empty baseline; exact qualified adapters add entries |
| warn_array_size | ✅ 256 |
| warn_stack_peak | ✅ 188 |
| warn_zp_percent / warn_ram_percent | ✅ 75 / 75 |
| warn_struct_zp_size | ✅ 35 |
| warn_embed_percent | ✅ 75 |
