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
$0800–$9EFF  ← LOW RAM (user program): 38,656 bytes
$9F00–$9FFF  I/O page (VERA, VIA, YM2151, etc.)
$A000–$BFFF  ← BANKED HIGH RAM: 8 KB window (up to 256 banks = 2 MB)
$C000–$FFFF  BANKED ROM: 16 KB window (32 banks × 16 KB = 512 KB)
```

### 2.2 Profile Values

```
memory:
  code_start:     $0800
  code_end:       $9EFF
  data_start:     $0800
  data_end:       $9EFF
  ram_start:      $0800
  ram_end:        $9EFF
  zp_start:       $22
  zp_end:         $7F
  stack_reserve:  16
```

### 2.3 Memory Map Notes

- **Low RAM** ($0800–$9EFF) is the primary code + data area. This is where the compiler places all code, const data, and mutable variables.
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
  max_binary_size: 38656    # $0800–$9EFF = 38,656 bytes
  max_ram:         38656    # low RAM only; banked RAM is separate
  max_zp:          94       # $22–$7F
  stack_budget:    234      # 256 - 16 reserve - 6 IRQ overhead
```

### 4.1 Budget Notes

- **max_binary_size**: Low RAM only. Programs needing more space can store data in banked high RAM, but this is managed by platform library calls, not the core compiler.
- **max_ram**: Same constraint — the compiler's SFA allocator only considers low RAM. Banked RAM is a library-level concern.
- **stack_budget**: The CX16 KERNAL is lighter on stack usage than the C64 KERNAL, so only 16 bytes are reserved.
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
1. Zeroes BSS segment
2. Copies DATA initializers to RAM
3. Calls `main()`
4. On return: `RTS` to BASIC

> **Note**: Unlike the C64, no ROM banking is needed in the startup sequence — BASIC ROM is in the high bank area and doesn't conflict with low RAM.

---

## 6. Character Encoding

```
encoding:
  default_encoding: petscii
  screen_encoding:  petscii
```

### 6.1 PETSCII (ISO-compatible variant)

The CX16 uses a **PETSCII-compatible** encoding that aligns more closely with ISO 8859-15 in the upper range. For the standard ASCII range ($20–$7E), values match both PETSCII and ASCII.

The `encode()` intrinsic uses the same PETSCII mapping as the C64 profile for source characters in the ASCII range. Extended characters follow the CX16's extended PETSCII table.

### 6.2 Screen Encoding

On the CX16, VERA handles text display. In text mode, the screen encoding is the same as PETSCII (no separate screen code table like the C64's VIC-II).

---

## 7. Embed Format Handlers

```
embed_formats:
  bin: raw_binary
  pcx: pcx_image
  bmx: cx16_bitmap
  zcm: zsound_module
```

### 7.1 Raw Binary (`.bin`)

| Selector | Type | Description |
|----------|------|-------------|
| (default) | `const byte[]` | Raw bytes, no interpretation |

### 7.2 PCX Image (`.pcx`)

| Selector | Type | Description |
|----------|------|-------------|
| `.pixels` | `const byte[]` | Decoded pixel data (indexed color) |
| `.palette` | `const byte[]` | RGB palette (3 bytes per entry) |
| `.width` | `word` | Image width in pixels |
| `.height` | `word` | Image height in pixels |

### 7.3 CX16 Bitmap (`.bmx`)

| Selector | Type | Description |
|----------|------|-------------|
| `.data` | `const byte[]` | VERA-format bitmap data |
| `.palette` | `const byte[]` | VERA palette entries (2 bytes per color) |
| `.width` | `word` | Bitmap width |
| `.height` | `word` | Bitmap height |

### 7.4 ZSound Module (`.zcm`)

| Selector | Type | Description |
|----------|------|-------------|
| `.data` | `const byte[]` | ZSound music/sound data |
| `.play_rate` | `byte` | Playback rate (calls per second) |

---

## 8. Platform Warnings

```
warnings:
  warn_frame_size: 256
  warn_array_size: 1024
```

| Warning | Threshold | Rationale |
|---------|-----------|-----------|
| W10030 (frame size) | 256 bytes | CX16 has generous RAM; higher threshold appropriate |
| W10191 (array size) | 1024 bytes | Larger arrays practical on CX16; still warn for very large ones |

### 8.1 Warning Threshold Notes

The CX16's 38 KB of low RAM and 8 MHz clock make it the most forgiving target. Warning thresholds are set higher than the C64 to avoid nuisance warnings in programs that are well within the platform's capabilities.

---

## 9. Platform-Specific Notes

### 9.1 65C02 Extensions

The CX16 uses the WDC 65C02, which adds instructions not present on the original 6502:

| Instruction | Intrinsic | Notes |
|------------|-----------|-------|
| WAI (Wait for Interrupt) | `asm_wai()` | Halts CPU until interrupt; saves power |
| STZ (Store Zero) | N/A (compiler optimization) | Compiler can emit STZ instead of LDA #0 / STA |
| BRA (Branch Always) | N/A (compiler optimization) | Compiler can emit BRA instead of JMP for short jumps |
| PHX/PLX, PHY/PLY | N/A (compiler optimization) | More efficient register save/restore |

The compiler's codegen backend for `cx16` uses 65C02 instructions automatically for optimization. The only user-visible 65C02 addition is `asm_wai()`.

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
  code_start:     $0800
  code_end:       $9EFF
  data_start:     $0800
  data_end:       $9EFF
  ram_start:      $0800
  ram_end:        $9EFF
  zp_start:       $22
  zp_end:         $7F
  stack_reserve:  16

budgets:
  max_binary_size: 38656
  max_ram:         38656
  max_zp:          94
  stack_budget:    234

output:
  output_format:  prg
  load_address:   $0801

encoding:
  default_encoding: petscii
  screen_encoding:  petscii

embed_formats:
  bin: raw_binary
  pcx: pcx_image
  bmx: cx16_bitmap
  zcm: zsound_module

warnings:
  warn_frame_size: 256
  warn_array_size: 1024
```

---

## Gate G3 Checklist (cx16)

| Profile Slot | Filled? |
|---|---|
| code_start / code_end | ✅ $0800 / $9EFF |
| data_start / data_end | ✅ $0800 / $9EFF |
| ram_start / ram_end | ✅ $0800 / $9EFF |
| zp_start / zp_end | ✅ $22 / $7F |
| stack_reserve | ✅ 16 |
| max_binary_size | ✅ 38656 |
| max_ram | ✅ 38656 |
| max_zp | ✅ 94 |
| stack_budget | ✅ 234 |
| output_format | ✅ prg |
| load_address | ✅ $0801 |
| reset_vector | N/A (SD-card loaded, not cartridge) |
| default_encoding | ✅ petscii |
| screen_encoding | ✅ petscii |
| embed_formats | ✅ bin, pcx, bmx, zcm |
| warn_frame_size | ✅ 256 |
| warn_array_size | ✅ 1024 |
