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
| Clock | 0.985248 MHz (PAL baseline) / 1.022730 MHz (NTSC baseline); turbo requires a separate qualified timing contract |
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
$0801–$CFFF  ← USER PROGRAM: 51,199 bytes
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
  stack_capacity: 256
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
  max_binary_size: 51199    # same inclusive $0801–$CFFF span as c64
  max_ram:         51199    # main RAM budget; REU is separate
  max_zp:          142      # $02–$8F
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

Identical to `c64` (→ Appendix A, §5). The output is a standard `.prg` file. The BASIC stub,
scheduled one-time runtime initializers, direct fallthrough into `main()`, and return-to-BASIC
epilogue are the same. Startup never blanket-clears uninitialized storage or copies a generic DATA
segment.

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

The current C64U profile uses its proven C64-compatibility mode and therefore aliases the four
immutable C64 map identities defined exhaustively in Appendix A, §6. It adds no C64U-specific
mapping. The optional map argument, compile-time-only behavior, exact-byte escapes, and E10249 rules
are identical to `c64`. C64 Ultimate support does not introduce a Unicode runtime representation.

---

## 7. Embed Format Handlers

```
embed_formats:
  spd: spritepad
  ctm: charpad
  kla: koala
  koa: koala
  sid: sid_file

audio_player_contracts: {} # Exact qualified single-SID C64 adapters may be overlaid unchanged
```

Identical to `c64` (→ Appendix A, §7). Same format handlers apply.

Callable game audio inherits only an exact qualified **single-SID** C64 player contract. The
compatible operation, ABI, placement, cadence, ownership, and cost rules remain unchanged. The
profile's `$D400` `sid_chips` endpoint is a deployment precondition and may name a physical SID
socket or an UltiSID implementation; Blend65 does not discover or configure it at runtime. C64U's
optional extra SID hardware does not widen a contract implicitly: multi-SID layouts, GTUltra, and
additional SID address/model choices remain unavailable until a separate C64U audio contract
profiles and qualifies them. A plain PSID header never supplies that missing contract.

C64U turbo execution does not change the selected C64-compatible video/SID timing record. The
current baseline cannot be turned into a turbo profile by replacing `clock_mhz` with a turbo rate;
a future turbo profile must model accelerated CPU execution separately from PAL/NTSC video and SID
cadence.

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

### 9.5 IRQ Entry Compatibility

The base C64U compatibility profile selects the same 901227-03-compatible KERNAL CINV contract as
`c64` (→ Appendix A, §9.2). It therefore exposes `setIRQ` and `setIRQExclusive` with the same
post-save entry variants, binary-mode handler-body guarantee, page-safe chain link, and `$EA81`
restore tail. `setRawIRQ` remains absent unless a separate raw
profile proves that its hardware vector is writable and active. A replacement or patched KERNAL
may not inherit these exact sinks merely because the machine is a C64 Ultimate; it needs a profile
whose entry and tail addresses are independently qualified.

### 9.6 BRK Compatibility

The base compatibility profile also omits `brk_contract`. C64 compatibility does not prove that a
particular Ultimate ROM, monitor, cartridge, or freezer configuration owns BRK with stable return,
stack, and machine-effect behavior. Reachable `asm_brk()` is therefore E10259 unless a separately
pinned C64U configuration supplies the complete Chapter-15 contract. The compiler never injects a
handler or monitor bridge.

---

## 10. Complete Profile

```yaml
# Blend65 Platform Profile: C64 Ultimate
platform: c64u
cpu: 6502
video_standard: pal
clock_mhz: 0.985248

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
  raw_irq:
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

recognized_interrupt_vectors:
  $0314:
    entry_contract: c64_kernal_cinv_postsave
    required_installer: c64.system.setIRQ

raw_interrupt_paths: {}

# brk_contract omitted: exact ROM/monitor configuration is not part of this profile

output:
  output_format:  prg
  load_address:   $0801

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

audio_player_contracts: {} # Exact qualified single-SID C64 adapters may be overlaid unchanged

warnings:
  warn_array_size: 256
  warn_stack_peak: 188
  warn_zp_percent: 75
  warn_ram_percent: 75
  warn_struct_zp_size: 35
  warn_embed_percent: 75
```

---

## Gate G3 Checklist (c64u)

| Profile Slot | Filled? |
|---|---|
| video_standard | ✅ `pal` compatibility baseline (`ntsc` selects its separate timing record) |
| sid_chips | ✅ one MOS6581-compatible endpoint at `$D400`; physical or UltiSID is a deployment precondition |
| code_start / code_end | ✅ $0801 / $CFFF |
| data_start / data_end | ✅ $0801 / $CFFF |
| ram_start / ram_end | ✅ $0801 / $CFFF |
| zp_start / zp_end | ✅ $02 / $8F |
| stack_capacity | ✅ 256 |
| stack_reserve | ✅ 20 |
| max_binary_size | ✅ 51199 |
| max_ram | ✅ 51199 |
| max_zp | ✅ 142 |
| interrupt_entry_variants | ✅ C64-compatible KERNAL chain/exclusive and raw ABI definitions |
| function_address_sinks | ✅ `setIRQ` and `setIRQExclusive`; raw installer profile-gated |
| recognized_interrupt_vectors | ✅ `$0314` → KERNAL CINV post-save contract |
| raw_interrupt_paths | ✅ empty in the base compatibility profile |
| brk_contract | N/A — omitted; reachable `asm_brk()` is E10259 |
| output_format | ✅ prg |
| load_address | ✅ $0801 |
| reset_vector | N/A (disk-based, not cartridge) |
| default_encoding | ✅ screen_codes |
| default_character_map | ✅ upper_graphics |
| encodings | ✅ C64-compatible screen_codes and petscii maps |
| embed_formats | ✅ spd, ctm, kla, koa, sid |
| audio_player_contracts | ✅ empty baseline; exact single-SID C64 contracts may be inherited |
| warn_array_size | ✅ 256 |
| warn_stack_peak | ✅ 188 |
| warn_zp_percent / warn_ram_percent | ✅ 75 / 75 |
| warn_struct_zp_size | ✅ 35 |
| warn_embed_percent | ✅ 75 |
