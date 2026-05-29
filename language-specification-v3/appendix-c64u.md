# Appendix B — Platform Profile: C64 Ultimate (`c64u`)

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: provisional  
> **Fills**: Every profile slot defined in Ch 15, §3

---

## 1. Platform Summary

| Field | Value |
|-------|-------|
| Platform ID | `c64u` |
| CPU | 6502 + Ultimate extensions |
| Clock | 0.985 MHz (PAL) / 1.023 MHz (NTSC), turbo modes available |
| RAM | 64 KB base + REU (up to 16 MB expanded) |
| ROM | 20 KB (same as C64) |
| Graphics | VIC-II (same as C64) |
| Sound | SID (same as C64), optional dual-SID |
| Storage | SD card, network, USB, disk emulation |
| Hardware | Ultimate 64, Ultimate-II+, 1541 Ultimate-II |

The C64 Ultimate is a **hardware-enhanced C64** — fully compatible at the base level, but with optional hardware extensions. The key difference from the standard C64 profile is the availability of the **REU** (RAM Expansion Unit) providing up to 16 MB of banked RAM, and potential turbo mode support.

### 1.1 Compatibility Principle

Every program compiled for `c64` must run unmodified on `c64u`. The `c64u` profile extends `c64` — it never contradicts the base profile. Extensions are strictly additive.

---

## 2. Memory Map

### 2.1 Base Memory Map

The base memory map is **identical to `c64`** (→ Appendix A, §2):

```
$0000–$0001  6510 I/O port
$0002–$00FF  Zero page (partial availability)
$0100–$01FF  Hardware stack
$0200–$03FF  OS/KERNAL workspace
$0400–$07FF  Default screen memory
$0801–$CFFF  ← USER PROGRAM: 26,623 bytes
$D000–$DFFF  I/O area (VIC-II, SID, CIA, Color RAM)
$E000–$FFFF  KERNAL ROM
```

### 2.2 REU Extended Memory

The REU maps expanded memory through a DMA controller at $DF00–$DF0A. REU memory is **not directly addressable** — data must be transferred to/from main RAM via DMA.

| REU Register | Address | Purpose |
|---|---|---|
| Status | $DF00 | Transfer status |
| Command | $DF01 | Transfer type (stash/fetch/swap) |
| C64 Base (lo/hi) | $DF02/$DF03 | Main RAM address for transfer |
| REU Base (lo/mid/hi) | $DF04/$DF05/$DF06 | REU address (up to 16 MB) |
| Transfer Length (lo/hi) | $DF07/$DF08 | Bytes to transfer |
| IRQ Mask | $DF09 | Interrupt control |
| Address Control | $DF0A | Auto-increment settings |

**REU access is a platform-library concern**, not a core language feature. The platform library (`c64u.reu`) provides safe DMA transfer functions built from `peek`/`poke` intrinsics.

### 2.3 Profile Values

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
  stack_reserve:  20
```

> Same as `c64`. REU memory is accessed via platform library, not via the core memory map.

---

## 3. Zero Page

Identical to `c64` (→ Appendix A, §3).

**Default profile range**: `$02`–`$8F` = **142 zero-page bytes**.

```
budgets:
  max_zp: 142
```

---

## 4. Resource Budgets

```
budgets:
  max_binary_size: 26623    # same as c64 (base RAM program area)
  max_ram:         26623    # main RAM budget; REU is separate
  max_zp:          142      # $02–$8F
  stack_budget:    230      # same as c64
```

### 4.1 Budget Notes

- **max_binary_size** and **max_ram** reflect the base C64 RAM only. REU memory is accessed through the platform library and is not counted against these budgets.
- A future version may introduce a `max_reu` budget field, but this is not part of v3.
- Programs can detect REU presence at runtime and adapt, but the compiler's resource checking only validates against main RAM.

---

## 5. Output Format

```
output:
  output_format:  prg
  load_address:   $0801
```

Identical to `c64` (→ Appendix A, §5). The output is a standard `.prg` file. The BASIC stub, startup sequence, and return-to-BASIC behavior are the same.

---

## 6. Character Encoding

```
encoding:
  default_encoding: petscii
  screen_encoding:  screen_codes
```

Identical to `c64` (→ Appendix A, §6).

---

## 7. Embed Format Handlers

```
embed_formats:
  spd: spritepad
  ctm: charpad
  sid: sid_file
  prg: raw_binary
```

Identical to `c64` (→ Appendix A, §7). Same format handlers apply.

---

## 8. Platform Warnings

```
warnings:
  warn_frame_size: 64
  warn_array_size: 256
```

Identical to `c64`. Although the REU provides vast storage, the main-RAM constraints that trigger these warnings are unchanged.

---

## 9. Platform-Specific Notes

### 9.1 Differences from `c64`

| Aspect | `c64` | `c64u` |
|--------|-------|--------|
| REU | Not available | Up to 16 MB via DMA |
| Turbo mode | N/A | Platform-library opt-in (if supported by hardware) |
| Storage | 1541 disk / tape | SD card, USB, network, disk emulation |
| Dual SID | Not standard | Optional second SID chip |
| Ethernet | N/A | Optional network via Ultimate hardware |

### 9.2 REU Programming Model

REU access uses three DMA operations, all performed through `peek`/`poke`:

| Operation | DMA Command ($DF01) | Direction |
|-----------|-------------------|-----------|
| **Stash** | $90 | Main RAM → REU |
| **Fetch** | $91 | REU → Main RAM |
| **Swap** | $92 | Exchange blocks |

Typical usage via platform library:

```blend65
import { reu_stash, reu_fetch } from c64u.reu;

// Store 256 bytes from $4000 to REU bank 0, offset $0000
reu_stash($4000, 0, $0000, 256);

// Retrieve 256 bytes from REU to $4000
reu_fetch($4000, 0, $0000, 256);
```

### 9.3 When to Use `c64u` vs `c64`

- Use `c64` when targeting all C64 hardware (including original breadbin, C64C, etc.)
- Use `c64u` when your program specifically requires REU or other Ultimate hardware features
- Every `c64` program runs on `c64u` hardware; the reverse is not guaranteed

### 9.4 Cycle Timing

Same as `c64` (→ Appendix A, §9.1). REU DMA transfers pause the CPU for the duration of the transfer (approximately 1 cycle per byte transferred).

---

## 10. Complete Profile

```yaml
# Blend65 Platform Profile: C64 Ultimate
platform: c64u
cpu: 6502
clock_mhz: 0.985       # PAL base (NTSC: 1.023)

memory:
  code_start:     $0801
  code_end:       $CFFF
  data_start:     $0801
  data_end:       $CFFF
  ram_start:      $0801
  ram_end:        $CFFF
  zp_start:       $02
  zp_end:         $8F
  stack_reserve:  20

budgets:
  max_binary_size: 26623
  max_ram:         26623
  max_zp:          142
  stack_budget:    230

output:
  output_format:  prg
  load_address:   $0801

encoding:
  default_encoding: petscii
  screen_encoding:  screen_codes

embed_formats:
  spd: spritepad
  ctm: charpad
  sid: sid_file
  prg: raw_binary

warnings:
  warn_frame_size: 64
  warn_array_size: 256
```

---

## Gate G3 Checklist (c64u)

| Profile Slot | Filled? |
|---|---|
| code_start / code_end | ✅ $0801 / $CFFF |
| data_start / data_end | ✅ $0801 / $CFFF |
| ram_start / ram_end | ✅ $0801 / $CFFF |
| zp_start / zp_end | ✅ $02 / $8F |
| stack_reserve | ✅ 20 |
| max_binary_size | ✅ 26623 |
| max_ram | ✅ 26623 |
| max_zp | ✅ 142 |
| stack_budget | ✅ 230 |
| output_format | ✅ prg |
| load_address | ✅ $0801 |
| reset_vector | N/A (disk-based, not cartridge) |
| default_encoding | ✅ petscii |
| screen_encoding | ✅ screen_codes |
| embed_formats | ✅ spd, ctm, sid, prg |
| warn_frame_size | ✅ 64 |
| warn_array_size | ✅ 256 |
