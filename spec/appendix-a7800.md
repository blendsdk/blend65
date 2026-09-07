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
| Clock | 1.79 MHz nominal; TIA/RIOT accesses slow to 1.19 MHz and MARIA DMA steals bus time |
| RAM | 4 KB on-board (`$1800`–`$27FF`), partly shadowed into pages zero and one |
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
$0040–$00FF  ← Shadow of physical RAM $2040–$20FF (zero-page window)
$0100–$013F  TIA/MARIA register shadows — not stack RAM
$0140–$01FF  ← Shadow of physical RAM $2140–$21FF (192-byte stack window)
$0200–$027F  Shadowed address space — not independent general RAM
$0280–$02FF  RIOT registers (timers, I/O)
$0300–$17FF  Mirrors / external-device space — unavailable to the default profile
$1800–$27FF  ← Physical RAM: 4,096 bytes
$2800–$3FFF  Mirrors/conflicts — unavailable to the default profile
$4000–$7FFF  Cartridge ROM bank (switchable, 16 KB)
$8000–$BFFF  Cartridge ROM bank (switchable, 16 KB)
$C000–$FFEF  Cartridge ROM (fixed placeable prefix)
$FFF0–$FFF9  Packaging-owned verification/reserved trailer
$FFFA–$FFFF  Interrupt vectors (NMI, RESET, IRQ/BRK)
```

### 2.2 RAM Summary

| Region | Range | Size | Notes |
|--------|-------|------|-------|
| Physical RAM | $1800–$27FF | 4,096 bytes | The only on-board RAM; low-page windows below are aliases into it |
| Zero-page shadow | $0040–$00FF | 192 addressable bytes | Aliases `$2040`–`$20FF`; not additional storage |
| Stack shadow | $0140–$01FF | 192 addressable bytes | Aliases `$2140`–`$21FF`; `$0100`–`$013F` is not RAM |
| Default general allocation | $2200–$27FF | 1,536 bytes | Disjoint from selected ZP/stack shadows; variables and SFA frames |
| **Total on-board** | | **4,096 physical bytes** | Shadow windows are counted once |

### 2.3 Profile Values

```
memory:
  code_start:     $8000
  code_end:       $FFEF
  data_start:     $8000
  data_end:       $FFEF
  ram_start:      $2200
  ram_end:        $27FF
  zp_start:       $40
  zp_end:         $7F
  stack_capacity: 192
  stack_reserve:  0
```

### 2.4 Memory Map Notes

- **Placeable code and const data live in ROM** ($8000–$FFEF). The final 16 bytes are reserved for
  packaging-owned verification data and vectors. Code executes directly from ROM; it is not loaded
  into RAM.
- **Const data shares ROM with code** ($8000–$FFEF), and their combined placement must fit the
  32,752-byte placeable cartridge span. Default-profile mutable variables and SFA frames use
  `$2200`–`$27FF`; the data segment never moves immutable arrays/assets into that RAM range.
- **MARIA display lists** also consume main RAM. A typical MARIA display list for a game screen uses 200–500 bytes of the $1800–$27FF block. The profile's `max_ram` is conservatively reduced to account for this.
- **No heap, no disk** — this is a cartridge console. Everything must fit in ROM + 4 KB RAM.
- Page 2 (`$0200`–`$027F`) is shadowed address space, not an independent 128-byte RAM bank. The
  default profile never allocates it. Likewise, ZP and stack aliases are excluded from the general
  allocation range so one physical byte cannot receive two owners.

---

## 3. Zero Page

### 3.1 Available Range

| Range | Bytes | Owner | Available? |
|-------|-------|-------|-----------|
| $00–$1F | 32 | TIA registers (memory-mapped I/O) | ❌ Hardware |
| $20–$3F | 32 | MARIA registers (memory-mapped I/O) | ❌ Hardware |
| $40–$7F | 64 | Free RAM (zero page) | ✅ |
| $80–$FF | 128 | RAM shadow reserved outside the default compiler ZP range | ❌ Default profile |

**Total ZP-addressable RAM**: `$40`–`$FF` = 192 bytes, all shadowing physical
`$2040`–`$20FF`. It is not additional storage.

**Default profile ZP range for compiler use**: `$40`–`$7F` = **64 zero-page bytes**.

The remaining ZP window (`$80`–`$FF`) is unavailable to the default allocator. A future qualified
profile may expose more of the shadow only with one physical-owner map that also excludes its
`$2080`–`$20FF` aliases.

### 3.2 Profile Values

```
budgets:
  max_zp: 64
```

### 3.3 Zero Page Notes

- The 7800 has **no OS/KERNAL** consuming the selected `$40`–`$7F` zero-page window.
- ZP-addressable bytes are aliases into the 4 KiB physical RAM budget, not extra capacity.
- Aggressive ZP sharing via frame coloring (Ch 11) is critical on this platform.

---

## 4. Resource Budgets

```
budgets:
  max_binary_size: 32752    # placeable span $8000–$FFEF inclusive
  max_ram:         1536     # conservative: 4096 - ~2560 for MARIA display lists
  max_zp:          64       # $40–$7F
```

### 4.1 Budget Notes

- **max_binary_size**: The placeable `$8000`–`$FFEF` span is 32,752 bytes. The packaging-owned
  `$FFF0`–`$FFFF` verification/vector trailer completes the default 32-KB ROM image and is not
  available to code or const-data placement. Larger cartridges require a custom profile.
- **max_ram**: Only **1,536 bytes** of the 4,096-byte main RAM block are budgeted for program variables. The remaining ~2,560 bytes are reserved for MARIA display lists, which must reside in RAM. This is a **conservative estimate** — actual MARIA overhead varies by game. Developers can adjust this in custom profiles.
- **max_zp**: 64 bytes. The compiler uses ZP for frame pointers, temporaries, and critical loop variables. On the 7800, every ZP byte is precious.
- **stack capacity**: only `$0140`–`$01FF` is writable RAM in hardware-stack address space, giving
  192 safe bytes. The bare-metal default reserves none of those bytes statically; generated
  NMI/IRQ entries, calls, and explicit pushes are charged to the proven peak.

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

The 7800 RESET vector points to the entry point. The compiler generates startup code that:

1. Clears the hardware registers required to enter the selected TIA/MARIA mode; this is device
   initialization, not a blanket clear of user RAM.
2. Initializes MARIA (enable DMA, set display-list pointer).
3. Evaluates every module/zeropage `let` initializer exactly once in the Chapter 10 schedule.
   Constant stores, aggregate initialization, and runtime calls/expressions emit only their required
   code; uninitialized mutable storage is not cleared, and `const` data is already in ROM.
4. Enables the selected NMI/VBLANK source according to the platform interrupt contract.
5. Falls through directly into the `main()` body, with no `JSR` or `JMP` transition.
6. If `main()` returns, its target epilogue halts via `JMP *`.

### 5.3 Encryption Header

The Atari 7800 has a BIOS that checks for a valid signature before allowing the cartridge to boot. The compiler generates the required signature bytes in the A78 header. For homebrew development, the standard homebrew signature is used.

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

### 6.1 Raw Bytes

The Atari 7800 is a **game console with no text display hardware**. All text rendering is done via custom bitmap fonts drawn by MARIA. There is no standard character encoding.

The default `raw` mapping is the exact `ascii-raw-v1` map from Chapter 15: every scalar
U+0000..U+007F maps to the identical byte `$00`..`$7F`, including `\n`, `\r`, and `\t` as `$0A`,
`$0D`, and `$09`; no other scalar is mapped. `\0` and `\xNN` remain exact. There is no Unicode
runtime representation, `raw()` intrinsic, or generic `encode()` intrinsic.

### 6.2 Screen Encoding

Since text display is fully custom (rendered via MARIA sprites or bitmap tiles), font-specific
indices require explicit versioned scalar-to-glyph metadata. Without that metadata they must be
expressed as exact byte arrays/escapes or asset-generated symbols. The compiler does not infer glyph
meaning or emit a hidden remapping table.

---

## 7. Asset Embedding

The initial profile registers no signature/version-aware format handler. Format-neutral
`embed(path)` remains available for `.bin` and every other raw file and returns its uninterpreted
bytes as `const byte[]`; it has no selector and does not appear in `embed_formats`.

### 7.1 Deferred Target Handlers

PNG and TMX are not registered by the initial Atari 7800 profile. Their previous selector tables
did not define a source format/version, MARIA graphics mode, palette mapping, conversion algorithm,
placement contract, or deterministic failure behavior and therefore did not describe an
implementable language surface.

Reconsider these formats when an Atari 7800 expert-skill extension is opened. That extension must
pin primary sources and representative fixtures and define exact validation, selectors, emitted
bytes, MARIA mode/layout, placement, costs, and failure semantics before activating a handler. Raw
files remain available through `embed(path)` in the meantime.

---

## 8. Platform Warnings

```
warnings:
  warn_array_size: 32
```

| Warning | Threshold | Rationale |
|---------|-----------|-----------|
| W10143 (array size) | 32 bytes | Mutable arrays above this threshold consume significant RAM; prefer const arrays in ROM when appropriate |

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
| Code | ROM ($8000–$FFEF) | Executes directly from cart; no RAM cost; final 16 bytes are packaging-owned |
| `const` arrays / data | ROM | No RAM cost — use `const` liberally |
| `let` variables | Default allocation `$2200`–`$27FF` | Scarce, disjoint from selected ZP/stack shadows |
| MARIA display lists | RAM | ~500–2,560 bytes, depending on complexity |
| Hardware stack | $0140–$01FF | 192 writable bytes; `$0100`–`$013F` aliases registers |

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

## 10. Complete Profile

```yaml
# Blend65 Platform Profile: Atari 7800
platform: a7800
cpu: 6502
clock_mhz: 1.79        # nominal CPU clock; slow-device accesses and MARIA DMA are separate timing effects

memory:
  code_start:     $8000
  code_end:       $FFEF
  data_start:     $8000
  data_end:       $FFEF
  ram_start:      $2200
  ram_end:        $27FF
  zp_start:       $40
  zp_end:         $7F
  stack_capacity: 192
  stack_reserve:  0

budgets:
  max_binary_size: 32752
  max_ram:         1536
  max_zp:          64

# brk_contract omitted: no exact handler/control-flow contract is qualified in this baseline

output:
  output_format:  a78
  load_address:   $8000
  reset_vector:   $8000

encoding:
  default_encoding: raw
  default_character_map: raw
  encodings:
    raw:
      maps:
        raw: ascii-raw-v1

warnings:
  warn_array_size: 32
```

---

## Gate G3 Checklist (a7800)

| Profile Slot | Filled? |
|---|---|
| code_start / code_end | ✅ $8000 / $FFEF |
| data_start / data_end | ✅ $8000 / $FFEF |
| ram_start / ram_end | ✅ $2200 / $27FF |
| zp_start / zp_end | ✅ $40 / $7F |
| stack_capacity | ✅ 192 |
| stack_reserve | ✅ 0 |
| max_binary_size | ✅ 32752 |
| max_ram | ✅ 1536 |
| max_zp | ✅ 64 |
| brk_contract | N/A — omitted; reachable `asm_brk()` is E10259 |
| output_format | ✅ a78 |
| load_address | ✅ $8000 |
| reset_vector | ✅ $8000 |
| default_encoding | ✅ raw |
| default_character_map | ✅ raw |
| encodings | ✅ ascii-raw-v1 |
| embed_formats | N/A — no registered format handler; raw `embed(path)` remains available |
| warn_array_size | ✅ 32 |
