# Appendix E — Platform Profile: Atari 7800 (`a7800`)

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: provisional  
> **Fills**: Every profile slot defined in Ch 15, §3

---

## 1. Platform Summary

| Field | Value |
|-------|-------|
| Platform ID | `a7800` |
| CPU | Sally 6502C (modified) |
| Clock | 1.19 MHz (effective — MARIA DMA steals cycles) |
| RAM | 4 KB on-board ($40–$FF + $0200–$027F + $1800–$27FF) |
| ROM | Cartridge-based (up to 48 KB, typically 32 KB) |
| Graphics | MARIA (DMA-based display list processor) |
| Sound | TIA (2 voices, Atari 2600 compatible) + optional POKEY |
| Storage | Cartridge only (ROM-based) |
| Community | Growing 7800 homebrew community |

The Atari 7800 is the **most constrained Blend65 target** — a game console with only 4 KB of on-board RAM, cartridge-based ROM execution, and a DMA-based display engine (MARIA) that heavily contends with the CPU for bus access. Programs must be extremely efficient with RAM and carefully manage CPU time around MARIA's display rendering.

### 1.1 Constraint Warning

The 7800's 4 KB RAM severely limits what can be expressed in Blend65:
- Total variable + frame space: ~1,536 bytes usable
- No large arrays or data structures
- Frame coloring (Ch 11) is essential — every shared byte matters
- Warning thresholds are set very low to catch overruns early

---

## 2. Memory Map

### 2.1 Memory Layout

The 7800's memory map is fragmented — RAM exists in three non-contiguous regions:

```
$0000–$001F  TIA registers (write-only; reads return open bus)
$0020–$003F  MARIA registers
$0040–$00FF  ← RAM (zero page): 192 bytes (shared ZP + general RAM)
$0100–$01FF  Hardware stack (256 bytes)
$0200–$027F  ← RAM: 128 bytes
$0280–$02FF  RIOT registers (timers, I/O)
$0300–$17FF  Unmapped / mirrors
$1800–$27FF  ← RAM: 4,096 bytes (main RAM block)
$2800–$3FFF  Cartridge RAM (optional — cart-dependent, 0–6 KB)
$4000–$7FFF  Cartridge ROM bank (switchable, 16 KB)
$8000–$BFFF  Cartridge ROM bank (switchable, 16 KB)
$C000–$FFEF  Cartridge ROM (fixed, 16 KB minus vectors)
$FFF0–$FFF7  Encryption verification area
$FFF8–$FFFE  Interrupt vectors (NMI, RESET, IRQ/BRK)
$FFFF        Last ROM byte
```

### 2.2 RAM Summary

| Region | Range | Size | Notes |
|--------|-------|------|-------|
| Zero Page RAM | $0040–$00FF | 192 bytes | Fast ZP access; shared between ZP variables and general use |
| Page 2 RAM | $0200–$027F | 128 bytes | General variables |
| Main RAM | $1800–$27FF | 4,096 bytes | Largest contiguous block; variables, buffers, MARIA display lists |
| **Total on-board** | | **4,416 bytes** | |
| Cart RAM (optional) | $2800–$3FFF | 0–6,144 bytes | Hardware-dependent; not guaranteed |

### 2.3 Profile Values

```
memory:
  code_start:     $8000
  code_end:       $FFF7
  data_start:     $1800
  data_end:       $27FF
  ram_start:      $1800
  ram_end:        $27FF
  zp_start:       $40
  zp_end:         $7F
  stack_reserve:  24
```

### 2.4 Memory Map Notes

- **Code lives in ROM** ($8000–$FFF7, typically 32 KB). This is the cartridge ROM. Code is executed directly from ROM — it is not loaded into RAM.
- **Data lives in RAM** ($1800–$27FF). The compiler places mutable variables and SFA frames here. Const data (arrays, lookup tables) stays in ROM.
- **MARIA display lists** also consume main RAM. A typical MARIA display list for a game screen uses 200–500 bytes of the $1800–$27FF block. The profile's `max_ram` is conservatively reduced to account for this.
- **No heap, no disk** — this is a cartridge console. Everything must fit in ROM + 4 KB RAM.
- Page 2 RAM ($0200–$027F) is available but outside the main contiguous block. The compiler may use it for additional frames via manual placement.

---

## 3. Zero Page

### 3.1 Available Range

| Range | Bytes | Owner | Available? |
|-------|-------|-------|-----------|
| $00–$1F | 32 | TIA registers (memory-mapped I/O) | ❌ Hardware |
| $20–$3F | 32 | MARIA registers (memory-mapped I/O) | ❌ Hardware |
| $40–$7F | 64 | Free RAM (zero page) | ✅ |
| $80–$FF | 128 | Free RAM (zero page) | ✅ |

**Total ZP RAM**: $40–$FF = 192 bytes, but the profile reserves the upper portion for general variable use since the 7800's RAM is so scarce.

**Default profile ZP range for compiler use**: `$40`–`$7F` = **64 zero-page bytes**.

The remaining ZP RAM ($80–$FF, 128 bytes) is part of the general RAM pool and can be used for variables that don't need ZP-speed access.

### 3.2 Profile Values

```
budgets:
  max_zp: 64
```

### 3.3 Zero Page Notes

- The 7800 has **no OS/KERNAL** consuming zero page — it's a bare-metal console. All of $40–$FF is genuinely free.
- However, the total is only 192 bytes of ZP-accessible RAM, and this is part of the overall 4 KB RAM budget.
- Aggressive ZP sharing via frame coloring (Ch 11) is critical on this platform.

---

## 4. Resource Budgets

```
budgets:
  max_binary_size: 32752    # $8000–$FFF7 = 32,760 bytes (minus 8 for vectors)
  max_ram:         1536     # conservative: 4096 - ~2560 for MARIA display lists
  max_zp:          64       # $40–$7F
  stack_budget:    226      # 256 - 24 reserve - 6 NMI overhead
```

### 4.1 Budget Notes

- **max_binary_size**: 32 KB ROM is the default cartridge size. Larger cartridges (48 KB with bank switching) exist but require a custom profile.
- **max_ram**: Only **1,536 bytes** of the 4,096-byte main RAM block are budgeted for program variables. The remaining ~2,560 bytes are reserved for MARIA display lists, which must reside in RAM. This is a **conservative estimate** — actual MARIA overhead varies by game. Developers can adjust this in custom profiles.
- **max_zp**: 64 bytes. The compiler uses ZP for frame pointers, temporaries, and critical loop variables. On the 7800, every ZP byte is precious.
- **stack_budget**: 24 bytes reserved for MARIA DMA interruption and NMI handling. The 7800's NMI (VBLANK) fires every frame and uses stack space.

---

## 5. Output Format

```
output:
  output_format:  a78
  load_address:   $8000
  reset_vector:   $8000
```

### 5.1 A78 Format (Atari 7800 ROM)

The output is an Atari 7800 cartridge ROM image (`.a78`):

| Offset | Size | Content |
|--------|------|---------|
| $0000 | 128 bytes | A78 header (magic, title, ROM size, cart type, etc.) |
| $0080 | n bytes | ROM data (32 KB typical, padded) |

The ROM image includes the standard 6502 vectors at the end:

| Vector | Address | Purpose |
|--------|---------|---------|
| NMI | $FFFA–$FFFB | VBLANK interrupt handler |
| RESET | $FFFC–$FFFD | Entry point (cold start) |
| IRQ/BRK | $FFFE–$FFFF | IRQ handler (typically unused on 7800) |

### 5.2 Startup Sequence

The 7800 RESET vector points to the entry point. The compiler generates a startup routine:

1. Clears TIA registers (silence any 2600-mode sound)
2. Initializes MARIA (enable DMA, set display list pointer)
3. Zeroes all RAM ($40–$FF, $0200–$027F, $1800–$27FF)
4. Copies DATA initializers from ROM to RAM
5. Enables NMI (VBLANK)
6. Calls `main()`
7. On return: `main()` is not expected to return — game loops forever. If it does return, the startup code halts via `JMP *`.

### 5.3 Encryption Header

The Atari 7800 has a BIOS that checks for a valid signature before allowing the cartridge to boot. The compiler generates the required signature bytes in the A78 header. For homebrew development, the standard homebrew signature is used.

---

## 6. Character Encoding

```
encoding:
  default_encoding: ascii
  screen_encoding:  ascii
```

### 6.1 ASCII

The Atari 7800 is a **game console with no text display hardware**. All text rendering is done via custom bitmap fonts drawn by MARIA. There is no standard character encoding.

The default encoding is **ASCII** — the simplest baseline. The `encode()` intrinsic maps source characters to standard ASCII values ($20–$7E). Game developers typically define their own font tile ordering and use `encode()` with custom offset tables.

### 6.2 Screen Encoding

Since text display is fully custom (rendered via MARIA sprites or bitmap tiles), screen encoding equals default encoding. Font-specific remapping is a game-code concern, not a platform profile concern.

---

## 7. Embed Format Handlers

```
embed_formats:
  bin: raw_binary
  png: indexed_image
  tmx: tilemap
```

### 7.1 Raw Binary (`.bin`)

| Selector | Type | Description |
|----------|------|-------------|
| (default) | `const byte[]` | Raw bytes, no interpretation |

### 7.2 Indexed Image (`.png`)

| Selector | Type | Description |
|----------|------|-------------|
| `.pixels` | `const byte[]` | Pixel data (MARIA-format: 160-mode or 320-mode packed) |
| `.palette` | `const byte[]` | Palette indices (MARIA palette format) |
| `.width` | `byte` | Width in pixels |
| `.height` | `byte` | Height in pixels |

### 7.3 Tilemap (`.tmx`)

| Selector | Type | Description |
|----------|------|-------------|
| `.map` | `const byte[]` | Tile index map (row-major) |
| `.tileset` | `const byte[]` | Tile graphics data |
| `.width` | `byte` | Map width in tiles |
| `.height` | `byte` | Map height in tiles |

---

## 8. Platform Warnings

```
warnings:
  warn_frame_size: 16
  warn_array_size: 32
```

| Warning | Threshold | Rationale |
|---------|-----------|-----------|
| W10030 (frame size) | 16 bytes | With only ~1.5 KB usable RAM, large frames are dangerous |
| W10191 (array size) | 32 bytes | Mutable arrays > 32 bytes consume significant RAM; use const arrays in ROM instead |

### 8.1 Warning Threshold Notes

These are the **tightest thresholds** of any Blend65 platform. On the 7800:
- A single 64-byte array consumes ~4% of total usable RAM
- SFA frame coloring must be aggressive — non-overlapping functions should share every possible byte
- Developers are strongly encouraged to keep mutable data minimal and use `const` arrays (stored in ROM) for all lookup tables, level data, sprite shapes, etc.

---

## 9. Platform-Specific Notes

### 9.1 Cycle Timing

- **NTSC**: 29,868 cycles per frame (262 lines × ~114 cycles per line), 60 Hz
- **PAL**: 35,568 cycles per frame (312 lines × ~114 cycles per line), 50 Hz
- **MARIA DMA overhead**: MARIA halts the CPU during each display line's DMA fetch. The overhead depends on the number of objects per line:
  - Blank line: ~5 cycles lost
  - Typical game line (5–10 objects): 30–70 cycles lost per line
  - Complex line (15+ objects): 80+ cycles lost per line
  - **Total DMA overhead**: typically 40–60% of CPU time during active display
- **VBLANK**: ~4,500 cycles of uninterrupted CPU time per frame (NTSC). Most game logic runs here.

### 9.2 MARIA Display Engine

MARIA is a **DMA-based display list processor** — fundamentally different from the C64's VIC-II or the 800XL's ANTIC:

- MARIA reads **display lists from RAM** to determine what to draw each frame
- Display lists contain **object headers** (position, palette, width, graphics pointer)
- Graphics data is read from **ROM** (cartridge) via DMA
- The CPU is halted during each DMA fetch

MARIA programming is done through platform libraries (`a7800.maria`). Key concepts:

```blend65
import { set_display_list, maria_clear } from a7800.maria;

// Display list lives in RAM ($1800+)
// Each zone (group of scanlines) has a linked list of object headers
// Object header: 5 bytes (graphics ptr, palette, x-pos, width, etc.)
```

### 9.3 ROM vs RAM Split

This is the most important architectural distinction on the 7800:

| Data | Location | Implication |
|------|----------|-------------|
| Code | ROM ($8000–$FFF7) | Executes directly from cart; no RAM cost |
| `const` arrays / data | ROM | No RAM cost — use `const` liberally |
| `let` variables | RAM ($1800–$27FF) | Scarce — every byte counts |
| MARIA display lists | RAM | ~500–2,560 bytes, depending on complexity |
| Hardware stack | $0100–$01FF | 256 bytes minus reserves |

**Best practice**: Maximize `const` data in ROM. Minimize `let` variables in RAM. Use struct-of-arrays layout over array-of-structs to improve byte-level access patterns.

### 9.4 TIA Sound

The 7800 includes the Atari 2600's TIA chip for backward compatibility, providing 2 channels of basic sound:

| Register | Address | Purpose |
|----------|---------|---------|
| AUDC0/1 | $15/$16 | Channel control (waveform selection) |
| AUDF0/1 | $17/$18 | Frequency (5-bit) |
| AUDV0/1 | $19/$1A | Volume (4-bit) |

Some 7800 cartridges include a POKEY chip for enhanced audio (4 additional channels). POKEY support is an optional platform-library extension.

### 9.5 Bank Switching

The default 32 KB profile uses a flat ROM layout. Larger cartridges (48 KB, 128 KB, etc.) use bank switching at $4000–$7FFF and/or $8000–$BFFF. Bank-switched configurations require custom profiles with adjusted `code_start`/`code_end` values.

### 9.6 Differences from Other Platforms

| Aspect | C64 | Atari 800XL | Atari 7800 |
|--------|-----|-------------|------------|
| RAM | 64 KB | 64 KB | **4 KB** |
| Code location | RAM (loaded) | RAM (loaded) | **ROM (cartridge)** |
| CPU clock | ~1 MHz | ~1.8 MHz | ~1.2 MHz (effective) |
| Display | VIC-II (raster) | ANTIC (DMA) | **MARIA (DMA, heavier)** |
| Sound | SID (3 voices) | POKEY (4 voices) | TIA (2 voices) |
| Encoding | PETSCII | ATASCII | ASCII (custom fonts) |
| Binary format | PRG (disk) | XEX (disk) | **A78 (ROM cartridge)** |
| ZP budget | 142 bytes | 128 bytes | **64 bytes** |
| Usable RAM | ~26 KB | ~40 KB | **~1.5 KB** |

---

## 10. Complete Profile

```yaml
# Blend65 Platform Profile: Atari 7800
platform: a7800
cpu: 6502
clock_mhz: 1.19        # effective (MARIA DMA reduces throughput)

memory:
  code_start:     $8000
  code_end:       $FFF7
  data_start:     $1800
  data_end:       $27FF
  ram_start:      $1800
  ram_end:        $27FF
  zp_start:       $40
  zp_end:         $7F
  stack_reserve:  24

budgets:
  max_binary_size: 32752
  max_ram:         1536
  max_zp:          64
  stack_budget:    226

output:
  output_format:  a78
  load_address:   $8000
  reset_vector:   $8000

encoding:
  default_encoding: ascii
  screen_encoding:  ascii

embed_formats:
  bin: raw_binary
  png: indexed_image
  tmx: tilemap

warnings:
  warn_frame_size: 16
  warn_array_size: 32
```

---

## Gate G3 Checklist (a7800)

| Profile Slot | Filled? |
|---|---|
| code_start / code_end | ✅ $8000 / $FFF7 |
| data_start / data_end | ✅ $1800 / $27FF |
| ram_start / ram_end | ✅ $1800 / $27FF |
| zp_start / zp_end | ✅ $40 / $7F |
| stack_reserve | ✅ 24 |
| max_binary_size | ✅ 32752 |
| max_ram | ✅ 1536 |
| max_zp | ✅ 64 |
| stack_budget | ✅ 226 |
| output_format | ✅ a78 |
| load_address | ✅ $8000 |
| reset_vector | ✅ $8000 |
| default_encoding | ✅ ascii |
| screen_encoding | ✅ ascii |
| embed_formats | ✅ bin, png, tmx |
| warn_frame_size | ✅ 16 |
| warn_array_size | ✅ 32 |
