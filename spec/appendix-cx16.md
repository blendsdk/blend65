# Appendix C — Platform Profile: Commander X16 (`cx16`)

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: provisional  
> **Fills**: Every profile slot defined in Ch 15, §3

---

## 1. Platform Summary

| Field | Value |
|-------|-------|
| Platform ID | `cx16` |
| CPU | WDC 65C02 |
| Clock | 8 MHz |
| RAM | 512 KB+ (39.75 KB low + banked high RAM in 8 KB pages) |
| ROM | 512 KB banked (KERNAL, BASIC, DOS, GEOS, etc.) |
| Graphics | VERA (Video Enhanced Retro Adapter) |
| Sound | VERA PSG (16 voices) + YM2151 FM (8 voices) |
| Storage | SD card (FAT32) |
| Community | Active modern retro community, led by The 8-Bit Guy |

The Commander X16 is a **modern 65C02 platform** with generous resources compared to vintage hardware. At 8 MHz with 512 KB+ of banked RAM, it is the most capable Blend65 target — offering the most room for larger programs, richer data, and less optimization pressure.

---

## 2. Memory Map

### 2.1 Memory Layout

```
$0000–$0001  CPU I/O port (banking control)
$0002–$0021  KERNAL zero-page workspace
$0022–$007F  ← ZERO PAGE available to user: 94 bytes
$0080–$00FF  KERNAL zero-page workspace (continued)
$0100–$01FF  Hardware stack
$0200–$03FF  KERNAL workspace
$0400–$07FF  User workspace / I/O buffers
$0800–$9EFF  ← Physical low RAM; default PRG program span is $0801–$9EFF (38,655 bytes)
$9F00–$9FFF  I/O page (VERA, VIA, YM2151, etc.)
$A000–$BFFF  ← BANKED HIGH RAM: 8 KB window (up to 256 banks = 2 MB)
$C000–$FFFF  BANKED ROM: 16 KB window (32 banks × 16 KB = 512 KB)
```

### 2.2 Profile Values

```
memory:
  code_start:     $0801
  code_end:       $9EFF
  data_start:     $0801
  data_end:       $9EFF
  ram_start:      $0801
  ram_end:        $9EFF
  zp_start:       $22
  zp_end:         $7F
  stack_capacity: 256
  stack_reserve:  16
```

### 2.3 Memory Map Notes

- **Low RAM** is physically $0800–$9EFF. The default BASIC-loaded PRG begins at $0801, so its
  compiler-controlled code, const data, mutable variables, and trailing BSS share only
  $0801–$9EFF. The byte at $0800 is outside that load image and cannot satisfy placement.
- **Banked high RAM** ($A000–$BFFF) provides 8 KB windows into up to 2 MB of extended memory. Bank selection is done by writing to address $0000. High RAM is useful for large data sets (level maps, sprite sheets, music) but code should not execute from banked RAM (branch targets would be ambiguous).
- **Banked ROM** ($C000–$FFFF) contains the KERNAL, BASIC, and other system software. User code does not execute here.
- The I/O page at $9F00–$9FFF is where VERA, VIA, and YM2151 registers are mapped. These are accessed via `peek`/`poke` in platform libraries.

---

## 3. Zero Page

### 3.1 Available Range

| Range | Bytes | Owner | Available? |
|-------|-------|-------|-----------|
| $00–$01 | 2 | Banking control | ❌ Hardware |
| $02–$21 | 32 | KERNAL workspace | ❌ KERNAL uses |
| $22–$7F | 94 | Free | ✅ |
| $80–$FF | 128 | KERNAL workspace | ❌ KERNAL uses |

**Default profile range**: `$22`–`$7F` = **94 zero-page bytes** available to the compiler.

### 3.2 Profile Values

```
budgets:
  max_zp: 94
```

### 3.3 Zero Page Notes

- The CX16 KERNAL uses more zero-page space than the C64 KERNAL because it manages banking, VERA, and FAT32 filesystem state.
- Programs that disable the KERNAL could reclaim $02–$21 and $80–$FF, but this is strongly discouraged on the CX16 (unlike the C64) because the KERNAL provides essential banking and VERA management.
- 94 bytes is still generous — more than enough for typical SFA frame pointers and compiler temporaries.

---

## 4. Resource Budgets

```
budgets:
  max_binary_size: 38655    # placeable PRG span $0801–$9EFF
  max_ram:         38655    # placeable low-RAM span; banked RAM is separate
  max_zp:          94       # $22–$7F
```

### 4.1 Budget Notes

- **max_binary_size**: The default PRG's `$0801`–`$9EFF` placeable span. Programs needing more
  space can store data in banked high RAM, but this is managed by platform library calls, not the
  core compiler.
- **max_ram**: The same placeable span; the compiler's SFA allocator does not count the physical but
  unloaded byte at `$0800`. Banked RAM is a library-level concern.
- **stack capacity**: The CX16 KERNAL reserve is 16 bytes, leaving 240 of the raw 256 bytes. Calls,
  generated interrupt entries, and explicit pushes are charged to the proven simultaneous peak.
- The 8 MHz clock means cycle budgets are ~8× more generous than the C64. Most programs will not be cycle-constrained.

---

## 5. Output Format

```
output:
  output_format:  prg
  load_address:   $0801
```

### 5.1 PRG Format

The CX16 uses the same `.prg` format as the C64:

| Offset | Size | Content |
|--------|------|---------|
| $0000 | 2 bytes | Load address (little-endian): `$01 $08` |
| $0002 | n bytes | Program binary |

### 5.2 Startup Sequence

The CX16 BASIC loads `.prg` files the same way as the C64. The compiler generates a BASIC stub:

```
$0801: BASIC line "10 SYS 2061"
$080D: ← entry point
```

The startup code at $080D:

1. Evaluates every module/zeropage `let` initializer exactly once in the Chapter 10 schedule.
   Constant stores, aggregate initialization, and runtime calls/expressions emit only their required
   code; uninitialized mutable storage is not cleared, and `const` data is already in the image.
2. Falls through directly into the `main()` body, with no `JSR` or `JMP` transition.
3. If `main()` returns, its target epilogue executes `RTS` to BASIC.

> **Note**: Unlike the C64, no ROM banking is needed in the startup sequence — BASIC ROM is in the high bank area and doesn't conflict with low RAM.

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
that ASCII is the X16's native screen or KERNAL encoding. The profile exposes no `petscii()` or
`screen_codes()` intrinsic yet.

The X16 has distinct upper/graphics, lower/upper, and ISO character modes. Their complete mappings
must be supplied and qualified by the future X16 expert-skill extension; C64 tables must not be
reused by resemblance. Until then, use exact bytes or asset-generated symbols for VERA text data.
No runtime Unicode representation or converter is emitted.

---

## 7. Asset Embedding

The initial profile registers no signature/version-aware format handler. Format-neutral
`embed(path)` remains available for `.bin` and every other raw file and returns its uninterpreted
bytes as `const byte[]`; it has no selector and does not appear in `embed_formats`.

### 7.1 Deferred Target Handlers

PCX, BMX, and music-project handlers are not registered by the initial Commander X16 profile. The
previous tables did not pin exact source identities, complete layouts, VERA mode/palette conversion,
validation, placement, or failure behavior. They therefore did not define an implementable language
surface. The earlier `.zcm` name was also incorrect: the officially documented X16 music format is
ZSM.

Reconsider these handlers when the separately qualified Commander X16 expert-skill extension is
opened after the C64 baseline. Official ZSM revision 1 is the first direct-handler candidate. BMX
requires an exact owner/version/layout and representative fixtures. PCX decoding additionally
requires deterministic VERA pixel mode, dimensions, palette mapping, conversion, and failure
semantics. Raw files remain available through `embed(path)` in the meantime.

---

## 8. Platform Warnings

```
warnings:
  warn_array_size: 1024
```

| Warning | Threshold | Rationale |
|---------|-----------|-----------|
| W10143 (array size) | 1024 bytes | Larger arrays are practical on X16, but this threshold still surfaces substantial RAM use |

### 8.1 Warning Threshold Notes

The CX16's 38 KB of low RAM and 8 MHz clock make it the most forgiving target. Warning thresholds are set higher than the C64 to avoid nuisance warnings in programs that are well within the platform's capabilities.

---

## 9. Platform-Specific Notes

### 9.1 65C02 Extensions

The CX16 uses the WDC 65C02, which adds instructions not present on the original 6502:

| Instruction | Intrinsic | Notes |
|------------|-----------|-------|
| WAI (Wait for Interrupt) | Backend-selected only | Halts the CPU until an interrupt when a future language/platform operation gives that exact semantic guarantee |
| STZ (Store Zero) | N/A (compiler optimization) | Compiler can emit STZ instead of LDA #0 / STA |
| BRA (Branch Always) | N/A (compiler optimization) | Compiler can emit BRA instead of JMP for short jumps |
| PHX/PLX, PHY/PLY | N/A (compiler optimization) | More efficient register save/restore |

The compiler's `cx16` backend may use legal 65C02 instructions automatically when they preserve
language and platform semantics. v3 exposes no `asm_wai()` intrinsic; the universal CPU-control
intrinsic set remains the 13 operations in Chapter 12.

### 9.2 VERA Graphics

VERA (Video Enhanced Retro Adapter) provides:
- 128 KB dedicated VRAM
- Two independent layers (tile or bitmap modes)
- 128 sprites (up to 64×64 pixels)
- 256-color palette
- Multiple resolutions (320×240, 640×480)

VERA registers are at $9F20–$9F3F. All VERA programming is done through platform libraries (`cx16.vera`), not core language features.

### 9.3 Banked RAM Programming

```
Bank selection register: $0000
Bank window: $A000–$BFFF (8 KB)
Available banks: 0–63 (512 KB) or more with expanded RAM
```

Banked RAM access is a platform-library concern:

```blend65
import { set_ram_bank, bank_peek, bank_poke } from cx16.banking;

set_ram_bank(5);                    // Select bank 5
poke($A000, 42);                    // Write to bank 5, offset 0
let val: byte = peek($A000);       // Read from bank 5, offset 0
```

### 9.4 Cycle Timing

- **8 MHz**: 8,000,000 cycles per second
- **Frame rate**: 60 Hz (NTSC-based timing)
- **Cycles per frame**: ~133,333
- This is approximately **8× the C64's cycle budget** per frame

---

## 10. Complete Profile

```yaml
# Blend65 Platform Profile: Commander X16
platform: cx16
cpu: 65c02
clock_mhz: 8.0

memory:
  code_start:     $0801
  code_end:       $9EFF
  data_start:     $0801
  data_end:       $9EFF
  ram_start:      $0801
  ram_end:        $9EFF
  zp_start:       $22
  zp_end:         $7F
  stack_capacity: 256
  stack_reserve:  16

budgets:
  max_binary_size: 38655
  max_ram:         38655
  max_zp:          94

# brk_contract omitted: no exact handler/control-flow contract is qualified in this baseline

output:
  output_format:  prg
  load_address:   $0801

encoding:
  default_encoding: raw
  default_character_map: raw
  encodings:
    raw:
      maps:
        raw: ascii-raw-v1

warnings:
  warn_array_size: 1024
```

---

## Gate G3 Checklist (cx16)

| Profile Slot | Filled? |
|---|---|
| code_start / code_end | ✅ $0801 / $9EFF |
| data_start / data_end | ✅ $0801 / $9EFF |
| ram_start / ram_end | ✅ $0801 / $9EFF |
| zp_start / zp_end | ✅ $22 / $7F |
| stack_capacity | ✅ 256 |
| stack_reserve | ✅ 16 |
| max_binary_size | ✅ 38655 |
| max_ram | ✅ 38655 |
| max_zp | ✅ 94 |
| brk_contract | N/A — omitted; reachable `asm_brk()` is E10259 |
| output_format | ✅ prg |
| load_address | ✅ $0801 |
| reset_vector | N/A (SD-card loaded, not cartridge) |
| default_encoding | ✅ raw |
| default_character_map | ✅ raw |
| encodings | ✅ ascii-raw-v1 only; X16-specific maps deferred to its expert extension |
| embed_formats | N/A — no registered format handler; raw `embed(path)` remains available |
| warn_array_size | ✅ 1024 |
