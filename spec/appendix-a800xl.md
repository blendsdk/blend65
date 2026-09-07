# Appendix D — Platform Profile: Atari 800XL (`a800xl`)

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: provisional  
> **Fills**: Every profile slot defined in Ch 15, §3

---

## 1. Platform Summary

| Field | Value |
|-------|-------|
| Platform ID | `a800xl` |
| CPU | MOS 6502C |
| Clock | 1.79 MHz (NTSC) / 1.77 MHz (PAL) |
| RAM | 64 KB total |
| ROM | 24 KB (OS $C000–$CFFF + $D800–$FFFF, BASIC $A000–$BFFF) |
| Graphics | ANTIC (display list DMA) + GTIA (color/player-missile) |
| Sound | POKEY (4 voices, 8-bit) |
| Storage | Disk (810/1050), cassette, cartridge |
| Community | Active Atari 8-bit homebrew scene |

The Atari 800XL is a **64 KB 6502 computer** with a different I/O architecture from the C64. Its ANTIC chip uses a programmable display list for screen rendering (DMA-based, not raster-interrupt driven like VIC-II). POKEY handles sound and keyboard. The 1.79 MHz clock provides roughly 1.8× the cycle budget of a C64.

---

## 2. Memory Map

### 2.1 Default Configuration

The default profile assumes BASIC ROM is **disabled** (by holding OPTION at boot or setting bit 1 of $D301), providing contiguous RAM from $2000 to $BFFF.

```
$0000–$007F  OS zero-page workspace (partial availability — see §3)
$0080–$00FF  ← ZERO PAGE available to user: 128 bytes
$0100–$01FF  Hardware stack
$0200–$047F  OS workspace (page 2–4: display list, handler table, etc.)
$0480–$057F  Floating point package / misc OS
$0580–$06FF  Device handler table
$0700–$1FFF  DOS / DUP area (if DOS loaded) — or free RAM without DOS
$2000–$9FFF  ← USER PROGRAM (code + data + variables): 32,768 bytes
$A000–$BFFF  Free RAM (BASIC disabled): +8,192 bytes = 40,960 total
$C000–$CFFF  OS ROM (math pack)
$D000–$D0FF  GTIA registers
$D200–$D2FF  POKEY registers
$D300–$D3FF  PIA registers
$D400–$D4FF  ANTIC registers
$D500–$D7FF  Reserved / cartridge area
$D800–$FFFF  OS ROM (FP routines, character set, OS, vectors)
```

### 2.2 Profile Values

```
memory:
  code_start:     $2000
  code_end:       $BFFF
  data_start:     $2000
  data_end:       $BFFF
  ram_start:      $2000
  ram_end:        $BFFF
  zp_start:       $80
  zp_end:         $FF
  stack_capacity: 256
  stack_reserve:  16
```

### 2.3 Memory Map Notes

- **$2000–$BFFF** (40,960 bytes) is the default program area. This starts above the DOS/DUP area and extends through the disabled BASIC ROM space.
- **$0700–$1FFF** is available if no DOS is loaded (e.g., cartridge or standalone programs), but the default profile conservatively excludes it.
- **ANTIC DMA** steals cycles from the CPU for screen display. The exact overhead depends on the display list mode. Typical game modes (ANTIC mode 4/5): ~30% cycle loss. Blank screen: 0% loss.
- **Display list** is typically placed at a page-aligned address. The OS default display list is in low memory; games usually create custom display lists in the program area.

---

## 3. Zero Page

### 3.1 Available Range

| Range | Bytes | Owner | Available? |
|-------|-------|-------|-----------|
| $00–$01 | 2 | LNFLG / NGFLAG (OS boot) | ⚠️ Free after boot |
| $02–$06 | 5 | Cassette / editor state | ⚠️ Free if not using cassette |
| $07–$09 | 3 | Attract mode counter + misc | ❌ OS uses |
| $0A–$0B | 2 | DOSVEC (DOS run vector) | ❌ OS uses |
| $0C–$0D | 2 | DOSINI (DOS init vector) | ❌ OS uses |
| $0E–$11 | 4 | APPMHI / POKMSK / BRKKEY | ❌ OS uses |
| $12–$1F | 14 | RTCLOK, timer, critical flag | ❌ OS uses |
| $20–$3F | 32 | Handler table, device state | ❌ OS uses |
| $40–$4F | 16 | Display list indirect, color regs | ❌ OS/ANTIC uses |
| $50–$57 | 8 | Attract colors, DRKMSK | ❌ OS uses |
| $58–$6F | 24 | Text cursor, editor state | ❌ OS/Editor uses |
| $70–$7F | 16 | Misc OS workspace | ❌ OS uses |
| $80–$D3 | 84 | Floating point package | ✅ (if FP not used) |
| $D4–$FF | 44 | Free / FP continued | ✅ |

**Default profile range**: `$80`–`$FF` = **128 zero-page bytes** available to the compiler.

> **Note**: The Atari OS floating point package uses $80–$D3. Since Blend65 has no floating point types, this entire range is safe to reclaim. If a future version adds FP support via a platform library, ZP allocation would need to be revisited.

### 3.2 Profile Values

```
budgets:
  max_zp: 128
```

---

## 4. Resource Budgets

```
budgets:
  max_binary_size: 40960    # $2000–$BFFF = 40,960 bytes
  max_ram:         40960    # shared with binary
  max_zp:          128      # $80–$FF
```

### 4.1 Budget Notes

- **max_binary_size**: 40 KB is generous for an 8-bit platform — larger than the C64's default range because BASIC ROM is fully disabled.
- **stack capacity**: The Atari OS reserve is 16 bytes, leaving 240 of the raw 256 bytes. Calls,
  generated interrupt entries, and explicit pushes are charged to the proven simultaneous peak.
- **ANTIC DMA overhead** is not reflected in byte budgets but affects available CPU cycles per frame. The compiler cannot account for this automatically; it is a developer concern documented in §9.

---

## 5. Output Format

```
output:
  output_format:  xex
  load_address:   $2000
```

### 5.1 XEX Format (Atari Executable)

The output is an Atari DOS executable (`.xex`) file with segmented loading:

| Offset | Size | Content |
|--------|------|---------|
| $0000 | 2 bytes | Magic header: `$FF $FF` |
| $0002 | 2 bytes | Segment start address (little-endian) |
| $0004 | 2 bytes | Segment end address (little-endian) |
| $0006 | n bytes | Segment data |
| ... | ... | Additional segments (optional) |

The final segment writes the entry point address to **RUNAD** ($02E0–$02E1), which the OS calls after loading:

| Offset | Size | Content |
|--------|------|---------|
| Header | 4 bytes | `$FF $FF $E0 $02` (RUNAD segment start) |
| | 2 bytes | `$E1 $02` (RUNAD segment end) |
| | 2 bytes | Entry point address (little-endian) |

The XEX packager emits only intervals that own bytes at load time: startup, code, const data, and
explicitly initialized mutable data, followed by the RUNAD segment. Every mutable or SFA interval
without emitted initialization is BSS and is omitted from XEX records; a BSS hole splits adjacent
emitted bytes into separate ordered segments rather than causing the hole to be serialized or
cleared. Emitted segments are sorted by ascending load address, may not overlap one another, and
may not overlap a reserved BSS interval. The build report records XEX payload/container bytes
separately from the complete `$2000`–`$BFFF` shared-range footprint. This preserves the language
rule that omitted initializers do not cause writes while still applying one collective placement
check to loaded and non-loaded intervals.

### 5.2 Startup Sequence

The compiler generates startup code at the entry point:

1. Disables BASIC ROM (writes to $D301 PIA port B if not already done).
2. Evaluates every module/zeropage `let` initializer exactly once in the Chapter 10 schedule.
   Constant stores, aggregate initialization, and runtime calls/expressions emit only their required
   code; uninitialized mutable storage is not cleared, and `const` data is already in the image.
3. Falls through directly into the `main()` body, with no `JSR` or `JMP` transition.
4. If `main()` returns, its target epilogue jumps to OS warm start ($E474) or halts via `JMP *`.

---

## 6. Character Encoding

```
encoding:
  default_encoding: raw
  default_character_map: raw
  encodings:
    raw:
      maps:
        raw: ascii-raw-v1
```

### 6.1 Raw Baseline

Unwrapped literals use the exact `ascii-raw-v1` identity map from Chapter 15: U+0000..U+007F maps
to the same byte and no other scalar is mapped. This is a deterministic byte baseline, not a claim
that ASCII is an Atari display or OS encoding. The `atascii()` and `internal_codes()` names are
reserved but inactive.

Their exhaustive ATASCII and internal-code mappings, including inverse-video and control-code
semantics, must be supplied and qualified by a future Atari expert-skill extension. Until then,
source uses exact bytes or asset-generated symbols where Atari display meaning matters. No runtime
Unicode representation or converter is emitted.

---

## 7. Asset Embedding

The initial profile registers no signature/version-aware format handler. Format-neutral
`embed(path)` remains available for `.bin` and every other raw file and returns its uninterpreted
bytes as `const byte[]`; it has no selector and does not appear in `embed_formats`.

### 7.1 Deferred Target Handlers

FNT, RIP, and RMT are not registered by the initial Atari 800XL profile. Their previous selector
tables did not identify exact producing tools, file generations, signatures, complete layouts,
player ABI, placement contracts, or deterministic failure behavior and therefore did not describe
an implementable language surface.

Reconsider these formats when an Atari 8-bit expert-skill extension is opened. That extension must
pin primary sources and representative fixtures and define exact validation, selectors, emitted
bytes, ANTIC/GTIA/POKEY integration, placement, costs, and failure semantics before activating a
handler. Raw files remain available through `embed(path)` in the meantime.

---

## 8. Platform Warnings

```
warnings:
  warn_array_size: 256
```

| Warning | Threshold | Rationale |
|---------|-----------|-----------|
| W10143 (array size) | 256 bytes | Large arrays consume notable RAM and often require indirect indexing |

---

## 9. Platform-Specific Notes

### 9.1 Cycle Timing

- **NTSC**: 29,829 cycles per frame (262 lines × ~114 cycles per line), 60 Hz
- **PAL**: 35,568 cycles per frame (312 lines × ~114 cycles per line), 50 Hz
- **ANTIC DMA overhead**: Varies by display mode. Typical game mode (ANTIC 4/5): ~25-35% of cycles stolen by DMA. Narrow playfield: less DMA. Blank screen: no DMA overhead.

### 9.2 ANTIC Display List

Unlike the C64's VIC-II (which always scans 40 columns), ANTIC is **display-list programmable**. The display list is a small program that tells ANTIC which graphics mode to use per line, where screen data is, and when to trigger interrupts (DLIs).

Display list programming is done through platform libraries (`a800xl.antic`), not core language features. Typical pattern:

```blend65
import { set_display_list } from a800xl.antic;

const my_dlist: byte[32] = [
    $70, $70, $70,          // 24 blank lines
    $42, lo($4000), hi($4000), // Mode 2 (text), screen at $4000
    // ... more mode lines ...
    $41, lo($2400), hi($2400)  // JVB (jump and wait for VBLANK)
];

set_display_list(&my_dlist);
```

### 9.3 Player-Missile Graphics

The Atari's hardware sprites are called "players" (4 × 8px wide, full-screen height) and "missiles" (4 × 2px wide). They are controlled via GTIA registers ($D000–$D01F) and positioned in a dedicated RAM area (typically $3000–$3FFF for double-line resolution).

Player-missile setup is a platform-library concern.

### 9.4 POKEY Sound

POKEY provides 4 audio channels with 8-bit frequency control. Registers at $D200–$D208. Two channels can be paired for 16-bit frequency resolution. Sound programming is done through platform libraries (`a800xl.pokey`).

### 9.5 Differences from C64

| Aspect | C64 | Atari 800XL |
|--------|-----|-------------|
| CPU clock | 0.985–1.023 MHz | 1.79 MHz (~1.8× faster) |
| Display engine | VIC-II (raster-based) | ANTIC (display-list DMA) |
| Sprites | 8 hardware sprites | 4 players + 4 missiles |
| Sound | SID (3 voices, 16-bit freq) | POKEY (4 voices, 8-bit freq) |
| Default character encoding | Screen codes | Raw ASCII identity baseline |
| Executable format | PRG | XEX |
| Zero-page budget | 142 bytes ($02–$8F) | 128 bytes ($80–$FF) |

---

## 10. Complete Profile

```yaml
# Blend65 Platform Profile: Atari 800XL
platform: a800xl
cpu: 6502
clock_mhz: 1.79        # NTSC (PAL: 1.77)

memory:
  code_start:     $2000
  code_end:       $BFFF
  data_start:     $2000
  data_end:       $BFFF
  ram_start:      $2000
  ram_end:        $BFFF
  zp_start:       $80
  zp_end:         $FF
  stack_capacity: 256
  stack_reserve:  16

budgets:
  max_binary_size: 40960
  max_ram:         40960
  max_zp:          128

# brk_contract omitted: no exact handler/control-flow contract is qualified in this baseline

output:
  output_format:  xex
  load_address:   $2000

encoding:
  default_encoding: raw
  default_character_map: raw
  encodings:
    raw:
      maps:
        raw: ascii-raw-v1

warnings:
  warn_array_size: 256
```

---

## Gate G3 Checklist (a800xl)

| Profile Slot | Filled? |
|---|---|
| code_start / code_end | ✅ $2000 / $BFFF |
| data_start / data_end | ✅ $2000 / $BFFF |
| ram_start / ram_end | ✅ $2000 / $BFFF |
| zp_start / zp_end | ✅ $80 / $FF |
| stack_capacity | ✅ 256 |
| stack_reserve | ✅ 16 |
| max_binary_size | ✅ 40960 |
| max_ram | ✅ 40960 |
| max_zp | ✅ 128 |
| brk_contract | N/A — omitted; reachable `asm_brk()` is E10259 |
| output_format | ✅ xex |
| load_address | ✅ $2000 |
| reset_vector | N/A (disk-loaded, not cartridge) |
| default_encoding | ✅ raw |
| default_character_map | ✅ raw |
| encodings | ✅ ascii-raw-v1 only; Atari-specific maps deferred to its expert extension |
| embed_formats | N/A — no registered format handler; raw `embed(path)` remains available |
| warn_array_size | ✅ 256 |
