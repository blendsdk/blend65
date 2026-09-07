# Chapter 15 — Conformance & Platform Profile Contract

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: Language Guard, F005, F015 (consolidated)

---

## 1. Overview

A **platform profile** defines everything the Blend65 compiler needs to know about a specific target platform. The core language specification (Ch 00–14) is platform-neutral — it never mentions a specific CPU speed, memory address, or hardware chip. All platform-specific details live in platform profiles.

This chapter defines:
- The contract a platform profile must fulfill
- The required and optional fields
- How the compiler uses profile data for code generation, resource checking, and diagnostics
- Conformance rules for the compiler itself

---

## 2. Target Platforms

Blend65 v3 targets five platforms:

| Platform ID | CPU | Clock | RAM | Notes |
|-------------|-----|-------|-----|-------|
| `c64` | 6502 | 1 MHz | 64 KB | Primary target, disk-based |
| `c64u` | 6502 + extensions | 1 MHz+ | 64 KB+ | C64 Ultimate (REU, etc.) |
| `cx16` | 65C02 | 8 MHz | 512 KB+ banked | Modern 6502 design |
| `a800xl` | 6502 | 1.79 MHz | 64 KB | Atari 800XL |
| `a7800` | 6502C | 1.79 MHz nominal | 4 KB + cart | Atari 7800; TIA/RIOT accesses slow to 1.19 MHz and MARIA DMA steals bus time |

---

## 3. Platform Profile Contract

Every platform profile must define the following sections. The compiler validates the profile at startup and refuses to compile if required fields are missing.

### 3.1 Required Fields

#### Target Identity and Timing

| Field | Type | Description |
|-------|------|-------------|
| `platform` | `string` | Selected target ID: `c64`, `c64u`, `cx16`, `a800xl`, or `a7800` in the v3 baseline |
| `cpu` | `string` | Instruction-set identity: `6502` or `65c02` in the v3 baseline |
| `clock_mhz` | positive finite number | Nominal CPU clock derived from the selected target timing record and used as the base for cycle-to-time reports |

All three fields are required. The compiler rejects an unknown target/CPU identity, an unsupported
target/CPU combination, and a missing, zero, negative, or non-finite clock. `clock_mhz` is a derived
timing fact, not a machine-configuration identity. When a target defines a named timing record, the
profile value must match that record; changing the number cannot select another video standard,
chip model, or acceleration mode. A target with variable bus timing records device slowdowns and
DMA stalls separately; it must not encode an estimated average throughput as `clock_mhz`.

#### C64 SID Configuration Identity

A `c64` or `c64u` profile that registers the `sid_file` handler or any
`audio_player_contracts` entry must also define:

| Field | Type | Description |
|-------|------|-------------|
| `video_standard` | `pal` or `ntsc` | Selected C64-compatible video and SID timing record |
| `sid_chips` | non-empty ordered list of `{ address: word, model: mos6581 | mos8580 }` | Concrete SID-compatible endpoints exposed to the program |

The current single-SID baselines contain exactly one endpoint at `$D400`. Its `model` is the
deployment requirement used for asset and player-contract validation; on C64U the endpoint may be
a physical socket or UltiSID implementation. Blend65 records this requirement in the build but does
not discover or configure the hardware at runtime.

The current C64-compatible timing records are versioned target facts:

| `video_standard` | Nominal CPU cycles/second | `clock_mhz` | Raster geometry | Cycles/frame | Derived frames/second |
|------------------|--------------------------:|------------:|-----------------|-------------:|----------------------:|
| `pal` | 985,248 | `0.985248` | 312 lines × 63 cycles | 19,656 | approximately 50.124542 |
| `ntsc` | 1,022,730 | `1.022730` | 263 lines × 65 cycles | 17,095 | approximately 59.826265 |

These records describe the qualified baseline configurations, not PAL-N, early NTSC VIC-II
revisions, or every historical oscillator tolerance. Such variants require separately sourced and
qualified timing records; they cannot be requested by overriding `clock_mhz`. A C64U turbo CPU
profile likewise needs a separate execution-timing contract. The compatibility profile keeps the
selected C64 video/SID timing and may not compare a PAL or NTSC SID asset against a turbo CPU rate.

For a PSID asset, the handler intersects the file's declared video/model sets with the selected
profile and any callable player contract. A specific incompatible declaration is E10261. `PAL and
NTSC` or `MOS6581 and MOS8580` includes either corresponding profile choice. `Unknown` makes no
compatibility claim: embed-only data remains legal, while callable audio requires its exact
hash-bound player contract to establish support for the selected configuration. A player contract
may close an unknown header field but may never contradict a specific one. The compiler does not
retime, retune, or otherwise translate an incompatible SID payload.

#### Memory Map

| Field | Type | Description |
|-------|------|-------------|
| `code_start` | `word` | Start address of code segment |
| `code_end` | `word` | End address of code segment |
| `data_start` | `word` | Start address of data segment |
| `data_end` | `word` | End address of data segment |
| `ram_start` | `word` | Start address of general RAM |
| `ram_end` | `word` | End address of general RAM |
| `zp_start` | `byte` | First available zero-page address |
| `zp_end` | `byte` | Last available zero-page address |
| `stack_capacity` | `word` | Hardware-stack bytes proven writable and stack-safe in the selected memory map before any platform reserve (commonly 256, but 192 on Atari 7800 because `$0100`–`$013F` aliases registers) |
| `stack_reserve` | `byte` | Bytes reserved for OS/KERNAL on hardware stack |

#### Resource Budgets

| Field | Type | Description |
|-------|------|-------------|
| `max_binary_size` | `word` | Maximum emitted target payload in bytes, excluding container header/trailer bytes named by the output format |
| `max_ram` | `word` | Maximum RAM available for variables + frames |
| `max_zp` | `byte` | Maximum zero-page bytes available |

Budgets are upper bounds, not independent reservations. When code, data, and mutable RAM ranges
overlap, the linker must place their combined live bytes without overlap inside the shared range;
passing each individual maximum cannot excuse a placement collision or make the same byte available
to two objects.

A contiguous load-image profile must place all serialized bytes in one prefix from `load_address`
and reserve non-emitted mutable/SFA storage as a trailing BSS suffix. The build report distinguishes
emitted payload bytes from the complete shared-range footprint. Padding inside the emitted prefix is
part of `max_binary_size`; trailing BSS bytes are part of `max_ram` and the combined placement check,
but are not serialized. Cartridge or segmented formats define their own ROM/RAM serialization split.

Usable stack capacity is derived as `stack_capacity - stack_reserve`. Interrupt entries are not
pre-subtracted: every entry that can be live simultaneously is charged to the proven program peak.
`stack_capacity` must be an integer in `1..256`, `stack_reserve` must be an integer in
`0..stack_capacity-1`, and the selected capacity must correspond to writable page-one addresses in
the target memory map rather than assuming that every 6502-family system exposes all 256 bytes.

#### Output Format

| Field | Type | Description |
|-------|------|-------------|
| `output_format` | `string` | Binary format: `prg`, `bin`, `rom`, `xex`, `a78` |
| `load_address` | `word` | Required base load/placement address; a PRG writes it to the header, XEX uses it as the default segment/start basis, and a cartridge uses it as the image base |
| `reset_vector` | `word` | Required exactly when the output format/profile writes or owns a reset vector; absent for disk-loaded PRG/XEX profiles |

Every current profile requires `output_format` and `load_address`. Profile validation rejects a
missing `reset_vector` for a vector-owning cartridge format and rejects a spurious `reset_vector`
for a loader-owned format whose packaging does not write one. The output-format contract, rather
than platform folklore, determines the condition.

#### Character Encoding

| Field | Type | Description |
|-------|------|-------------|
| `default_encoding` | `string` | Name of the encoding used by unwrapped string and character literals. It must name an entry in `encodings`. |
| `default_character_map` | `string` | Immutable map key used by unwrapped literals and by a named encoding call that omits its optional map argument. Every registered encoding must define this key. |
| `encodings` | `map` | Encoding name → `maps`; each map key names one immutable finite Unicode-scalar-to-byte mapping plus explicit symbolic-escape mappings or `unavailable`. |

The registered names also determine which named conversion intrinsics exist. The current qualified
intrinsic names are `petscii` and `screen_codes` on C64 and C64U. The names `atascii` and
`internal_codes` are reserved but inactive until an Atari expert extension supplies exhaustive,
source-backed maps. There is no generic `encode()` or `raw()` intrinsic. `\0` and `\xNN` bypass
these maps and always produce exact bytes. Every ordinary literal Unicode scalar and every other
accepted escape is resolved by the selected encoding and map without normalization,
transliteration, replacement, or lossy fallback. A missing scalar/escape mapping, or a
character-literal mapping that is not exactly one byte, is E10249 (→ Ch 08 and Ch 14).

A qualified named intrinsic accepts a string or character literal and may accept the exact map key
as an optional second string-literal argument. For example,
`screen_codes("Hello", "lower_upper")` selects the C64 lower/upper ROM map for that literal only.
It does not write a hardware register, change the active character set, or add runtime code. A map
key absent from the selected encoding is E10125; a non-literal map argument is E10251.

Every current Blend65 target encoding is an explicit finite scalar-to-one-byte map. String encoding
concatenates those bytes in source order, so it needs no runtime conversion. A scalar absent from
the selected map is `unavailable`; UTF-8 source support never implies that the target accepts UTF-8
bytes or Unicode text. A future multibyte target encoding would require a versioned profile/schema
extension rather than silently changing this contract.

The shared `ascii-raw-v1` map is the exact identity mapping U+0000..U+007F → `$00`..`$7F`; no other
scalar is present. Its symbolic `\n`, `\r`, and `\t` mappings are `$0A`, `$0D`, and `$09`. It is the
conservative baseline for a target whose specialized text maps are not yet qualified. It is not a
claim about that machine's display hardware. A custom character set may gain text conversion only
through explicit, versioned compile-time scalar-to-glyph metadata with an immutable map identity.
The compiler never infers glyph meaning from bitmap order, filenames, or a platform ROM. Without
such metadata, source uses asset-generated symbols or exact byte values.

### 3.2 Optional Fields

#### Asset Format Handlers

| Field | Type | Description |
|-------|------|-------------|
| `embed_formats` | `map` | File extension → signature/version-validating format handler for `embed()` selector keys (→ Ch 13) |
| `audio_player_contracts` | `map` | Contract key → hash-bound callable audio-player ABI, ownership, placement, and cost contract |

An `audio_player_contracts` entry is independent of a file extension. An asset handler may attach a
contract key only after proving the exact player/export identity required by that entry. Each entry
enumerates its available init, tick, song, SFX, and voice forms; entry points and calling convention;
clobbers and machine-state requirements; writable/self-modifying storage; placement and banking;
cadence, reentrancy, interrupt/CIA/SID ownership; arbitration; and feature-dependent bytes, cycles,
RAM, zero page, and stack. It enumerates every supported `video_standard` and exact `sid_chips`
topology, and also defines whether numeric IDs are accepted dynamically.
String cue names are always compile-time literals and emit no name table.

Absence means that no embedded audio payload is callable through the platform's player-neutral audio
operations. It does not disable raw or format-aware inclusion. A file header, extension, likely
originating tool, or PSID init/play pair never substitutes for a matching contract identity.

#### Platform Warnings

| Field | Type | Description |
|-------|------|-------------|
| `warn_array_size` | `word` | Optional W10143 threshold in bytes for one mutable array; absence disables this advisory warning |
| `warn_stack_peak` | `word` | Optional warning threshold in bytes; when absent, use 80% of derived usable capacity, rounded down |
| `warn_zp_percent` | `byte` | Optional W10030 threshold as a percentage of `max_zp`; default 75 |
| `warn_ram_percent` | `byte` | Optional W10033 threshold as a percentage of `max_ram`; default 75 |
| `warn_struct_zp_size` | `byte` | Optional W10110 threshold for one zero-page struct; default `max(1, floor(max_zp / 4))` |
| `warn_embed_percent` | `byte` | Optional W10150 threshold for total emitted embedded data as a percentage of `max_binary_size`; default 75 |

Derived usable capacity is `stack_capacity - stack_reserve`. W10180 fires when the proven
simultaneous peak is greater than or equal to `warn_stack_peak`; if that field is absent, the
threshold is `floor(0.8 * (stack_capacity - stack_reserve))`. A peak above derived usable capacity
is E10238, independent of the warning threshold.

Every percentage warning field must be in `1..100`; its byte threshold is
`ceil(budget * percent / 100)`. `warn_struct_zp_size` must be in `1..max_zp`, a present
`warn_array_size` must be in `1..65535`, and a present `warn_stack_peak` must be an integer in
`1..(stack_capacity - stack_reserve)`. A resource warning fires when the measured value is greater
than or equal to its resolved byte threshold. W10143 measures one mutable array's RAM allocation;
const arrays do not trigger it. `warn_array_size` has no inferred default: if a profile omits it,
W10143 is disabled for that profile. These diagnostics are advisory only:
exceeding `max_zp`, `max_ram`,
`max_binary_size`, or usable stack capacity remains the corresponding resource error. The defaults
make every warning predicate deterministic without forcing each profile to repeat common policy.

#### Interrupt Sources, Entry Variants, and Function-Address Sinks

Profiles that expose compiler-recognized interrupt/callback APIs define `function_address_sinks`.
Absence or an empty map means there are no recognized sinks; the compiler must not guess from a
library symbol's spelling. A sink names the accepted source kind (`interrupt_handler` or
`ordinary_callback`), the exact entry variant to materialize, the execution domain, and the
interrupt-source ID. This keeps one source-level `interrupt function` independent of whether a
platform enters it directly from the CPU or after firmware has already established a stack frame.

`interrupt_entry_variants` defines the ABI facts needed by lowering and stack/resource analysis:
who saves A/X/Y, stack bytes live when the handler body starts, the handler-body decimal-mode
guarantee, entry-status preservation, and whether the generated terminal is direct `RTI`, an
indirect jump through a saved prior vector, or a jump to an exact profile-declared firmware
restore/`RTI` tail. A chain variant also declares its static link bytes and any low-byte placement
limit required by its CPU's indirect-jump behavior. These are closed values, not arbitrary assembly
snippets. Only reachable variants are emitted.

On an NMOS CPU that does not clear decimal mode on interrupt entry, the ordinary Blend65 handler
contract requires `decimal_mode_on_body_entry: binary`. A chained variant preserves and restores
the entry status around the Blend65 body so the prior handler sees the original flag state. A raw
or exclusive variant may rely on its eventual `RTI` to restore the interrupted status. The
compiler may elide normalization only with proof that the same incoming-body and outgoing-terminal
contracts hold. Every emitted normalization byte, cycle, and live stack byte is reported.

The source ID resolves through `interrupt_sources`, whose entry declares which domains it may
preempt, whether hardware masks that same source on entry, and any externally guaranteed finite
re-entry bound. Without a finite external bound, a reachable preemption cycle is unbounded and
rejected with E10245. `raw_interrupt_paths` is optional and names a hardware vector only when the
selected profile guarantees that the vector is both writable and active under that profile's
fixed memory/banking contract. A raw installer is unavailable when no such path exists.

`recognized_interrupt_vectors` records exact addresses whose entry ABI the compiler can know. It
exists to diagnose a visible raw write that bypasses a required platform installer; it does not
turn arbitrary runtime addresses into recognized sinks. A known ordinary-function mismatch is
E10244, erased/unknown function provenance at a recognized API sink is E10247, and a visible raw
interrupt-entry address written directly to an incompatible recognized firmware vector is E10252.

These records are semantic compiler metadata, not a runtime table or dispatcher.
Provenance-preserving calls to a recognized sink add the selected handler variant as an SFA and
stack-analysis root. The sink consumes retained function identity and may install the selected
variant address rather than the raw numeric `word` value. Every variant, saved-vector word, and
installation sequence is included in ROM/RAM/ZP/stack/cycle reports. Platform/firmware interrupt
activity wholly outside generated code remains in `stack_reserve`, not duplicated as a compiler
root.

| Field | Type | Description |
|------|------|-------------|
| `interrupt_sources` | `map` | Source ID → preemptible domains, self-mask behavior, and a non-negative finite re-entry bound or `unbounded` |
| `interrupt_entry_variants` | `map` | Variant ID → accepted source kind, A/X/Y save owner, body-entry stack bytes, decimal-mode guarantee, entry-status policy, terminal kind/target, static-link bytes, and any indirect-link low-byte limit |
| `function_address_sinks` | `map` | Fully qualified library symbol → accepted source kind, entry variant, execution domain, and declared interrupt-source ID |
| `recognized_interrupt_vectors` | `map` | Exact vector base address → firmware/raw ABI identity and required platform installer |
| `raw_interrupt_paths` | `map` | Optional source ID → vector address and fixed profile proof that the hardware vector is writable and active |

#### BRK Contract

`brk_contract` is optional. Its absence means that the profile cannot prove what a reachable
`asm_brk()` does, so that call is E10259. A contract is declarative metadata; it never asks the
compiler to install a vector, emit a handler, or link a runtime.

When present, the contract defines all of these facts:

| Field | Type | Description |
|---|---|---|
| `vector` | `word` | Active CPU IRQ/BRK vector used by the selected memory/banking configuration |
| `handler_identity` | `string` | Exact ROM, monitor, application-handler, or image identity that proves the behavior |
| `return_mode` | `rti_after_padding` or `nonreturning` | Whether execution resumes after the compiler-emitted padding byte or has no normal successor |
| `handler_stack_peak` | non-negative integer | Maximum additional live stack bytes beyond the CPU's three BRK-pushed bytes, including nested calls in the declared handler path |
| `preserves` / `clobbers` | closed register/flag sets | Exact A/X/Y and processor-status facts visible if the handler returns |
| `entry_requirements` | closed machine-state record | Required interrupt, decimal, banking, vector, memory, and MMIO state on entry |
| `machine_effects` | closed effect record | Memory, banking, MMIO, and other externally observable effects before return or termination |
| `reentry_bound` | non-negative finite integer | Maximum additional nested entry count already included in `handler_stack_peak`; `unbounded` is invalid for a usable contract |

The compiler emits exactly `$00 $EA` for `asm_brk()`. Stack analysis charges three CPU bytes plus
`handler_stack_peak` on the synchronous BRK edge. `rti_after_padding` adds a control-flow successor
after `$EA` and applies the declared post-handler machine state. `nonreturning` adds no normal
successor. The build report names every reachable BRK site, the selected contract identity, return
mode, vector, and the separate CPU/handler stack charges.

---

## 4. Example Platform Profile (C64)

```
platform: c64
cpu: 6502
video_standard: pal
clock_mhz: 0.985248

sid_chips:
  - address: $D400
    model: mos6581

memory:
  code_start: $0801
  code_end:   $CFFF
  data_start: $0801      # interleaved with code
  data_end:   $CFFF
  ram_start:  $0801
  ram_end:    $CFFF
  zp_start:   $02
  zp_end:     $8F
  stack_capacity: 256
  stack_reserve: 20

budgets:
  max_binary_size: 51199  # inclusive span $0801–$CFFF
  max_ram:         51199
  max_zp:          142    # inclusive span $02–$8F

interrupt_sources:
  irq:
    may_preempt: [mainline, irq, nmi, callback]
    masks_self_on_entry: true
    external_reentry_bound: unbounded

interrupt_entry_variants:
  c64_kernal_cinv_chain:
    accepted_source_kind: interrupt_handler
    register_save_owner: firmware
    handler_entry_stack_bytes: 7   # CPU/KERNAL 6 + compiler PHP while body runs
    decimal_mode_on_body_entry: binary
    entry_status_policy: preserve_and_restore_before_chain
    entry_normalization_bytes: 3   # PHP + CLD + PLP
    entry_normalization_cycles: 9
    terminal: jump_saved_previous_vector
    static_link_bytes: 2
    static_link_low_byte_max: $FE  # NMOS JMP ($xxFF) is forbidden
  c64_kernal_cinv_exclusive:
    accepted_source_kind: interrupt_handler
    register_save_owner: firmware
    handler_entry_stack_bytes: 6
    decimal_mode_on_body_entry: binary
    entry_status_policy: restore_by_rti
    entry_normalization_bytes: 1   # CLD
    entry_normalization_cycles: 2
    terminal: jump_firmware_restore_tail
    terminal_address: $EA81
    static_link_bytes: 0
  raw_irq:
    accepted_source_kind: interrupt_handler
    register_save_owner: compiler
    handler_entry_stack_bytes: 6   # CPU P/PCL/PCH + compiler A/X/Y
    decimal_mode_on_body_entry: binary
    entry_status_policy: restore_by_rti
    entry_normalization_bytes: 1   # CLD
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

# Empty in the default KERNAL-active profile. A raw C64 profile may add $FFFE
# only with a fixed proof that RAM there is the active hardware vector.
raw_interrupt_paths: {}

# No brk_contract: the default profile does not promise a safe returning BRK handler.

output:
  output_format: prg
  load_address:  $0801

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
  spd: spritepad       # "sprites" is default; exact selectors are profile-defined
  ctm: charpad         # "map", "tiles", "colors"
  kla: koala           # "bitmap", "screen", "color_ram", "background"
  koa: koala           # same classic native Koala layout as .kla
  sid: sid_file         # "data" is default; "init_address", "play_address"

audio_player_contracts: {} # No universal SID-player ABI; qualified adapters add exact entries

warnings:
  warn_array_size: 256
  warn_stack_peak: 188
  warn_zp_percent: 75
  warn_ram_percent: 75
  warn_struct_zp_size: 35
  warn_embed_percent: 75
```

---

## 5. Compiler Conformance Rules

### 5.1 Language Conformance

A conforming Blend65 v3 compiler must:

1. Accept any source program that conforms to the grammar in Ch 01 and the semantic rules in Ch 02–13
2. Reject any source program that violates a rule, with the correct error code from Ch 14
3. Generate correct machine code for all target platforms defined in §2
4. Produce deterministic output — the same source + profile = the same binary, byte for byte
5. Report all diagnostics with the format specified in Ch 14, §1

### 5.2 Platform Conformance

For each platform profile:

1. Generated code must execute correctly on the target hardware (or a cycle-accurate emulator)
2. Memory placement must respect the profile's memory map boundaries
3. Resource usage must be validated against the profile's budgets
4. Budget violations must produce E10032 for zero page, E10034 for final binary size, or E10238 for the named target resource
5. Budget warnings must fire at the thresholds defined in the profile

### 5.3 Determinism

Language behavior is defined except for the bounded result fields in the registered hardware-
limitation exceptions. Those exceptions still define control flow, width, effects, and costs.

| Operation | Defined Behavior |
|-----------|-----------------|
| Integer overflow | Wraps (natural 6502 behavior) |
| Unsigned subtraction underflow | Wraps to 255/65535 |
| Signed overflow | Wraps (two's complement) |
| Array index out of bounds (static) | Compile-time error; canonical code in Ch 14 |
| Array index out of bounds (runtime, default) | Effective address wraps modulo 65536; no array-length reduction or check |
| Array index out of bounds (`--bounds-check`) | Inline pre-access check; failure enters the platform safety stop |
| Division by zero (constant) | Compile-time error; canonical code in Ch 14 |
| Division by zero (runtime, default) | Finite selected sequence; bounded unspecified quotient/remainder; no injected handling |
| Division by zero (`--division-zero-check`) | Inline pre-division check; failure enters the platform safety stop |
| Packed-BCD invalid digit (constant) | Compile-time E10254 |
| Packed-BCD invalid digit (runtime) | Exact selected-CPU decimal `ADC`/`SBC` result; no injected validation |
| Reachable `asm_brk()` without a profile contract | Compile-time E10259 |
| Reachable `asm_brk()` with a profile contract | Exact `$00 $EA`; profile-defined returning or non-returning edge and machine effects; no injected handler/runtime |
| Valid SID asset with incompatible specific video/model/topology requirement | Compile-time E10261; no automatic conversion or contradictory override |

### 5.4 Optional Safety Instrumentation

`--bounds-check` and `--division-zero-check` are independent and off by default. They emit checks at
the affected operation sites and do not link a runtime library. Operands are evaluated once, and a
failure is detected before the unsafe arithmetic or memory/MMIO effect. Sound compile-time proofs
remove individual checks.

Each platform profile supplies a non-returning, zero-RAM/zero-ZP safety-stop sequence. The portable
6502 baseline is `SEI` followed by a self-branch; the C64 profile may add source identification using
ROM bytes only. The build summary reports enabled modes, instrumented/elided sites, and ROM/cycle
cost. NMI and external reset behavior remain properties of the selected hardware profile.

### 5.5 Build Summary

A conforming compiler must produce a build summary (→ Ch 11, §6) that reports:
- Code, data, RAM, ZP usage (bytes and addresses)
- SFA frame allocation with sharing statistics
- Hardware stack peak usage
- Reachable BRK sites, contract identity, return mode/vector, and separate three-byte CPU plus
  handler stack charges
- Startup routine cost (bytes and cycles)
- Selected target, encoding, and immutable character-map identities
- Selected audio-player contract identity, enabled operations, placement, ownership, writable state,
  and feature-dependent code/data/RAM/ZP/stack/cycle costs
- Total binary size

---

## 6. Stability Classifications

Each chapter's features are classified per the Language Guard (→ `.clinerules/language-guard.md`, F4):

| Classification | Meaning | Contract |
|----------------|---------|----------|
| **Stable** | Fully designed, will not change | Breaking changes require major version bump |
| **Provisional** | Designed but may be refined | Minor adjustments possible in next minor version |
| **Experimental** | Exploratory, may be removed | No stability guarantee |

### v3 Chapter Classifications

| Chapter | Classification | Notes |
|---------|---------------|-------|
| 00 – Introduction | Stable | Design axioms are foundational |
| 01 – Lexical Structure | Stable | |
| 02 – Type System | Stable | |
| 03 – Variables & Constants | Stable | |
| 04 – Expressions & Operators | Stable | Multiply/divide/modulo: provisional (software routines) |
| 05 – Statements & Control Flow | Stable | |
| 06 – Functions | Stable | Interrupt functions: provisional |
| 07 – Structs | Stable | |
| 08 – Arrays & Strings | Stable | Closed escapes and named encodings/maps are profile-defined and stable |
| 09 – Enums | Stable | |
| 10 – Modules | Stable | |
| 11 – Memory Model & SFA | Stable | |
| 12 – Intrinsics | Stable | |
| 13 – Data Inclusion | Stable | Format-aware embed selectors: provisional |
| 14 – Diagnostics | Stable | New codes may be added (never removed) |
| 15 – Platform Profile | Provisional | Profile schema may evolve with new platforms |
