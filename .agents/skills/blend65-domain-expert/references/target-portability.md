# Target Portability Doctrine

> **Construction version**: `0.6.0-artifacts-portability`
> **Status**: Candidate knowledge for the unqualified Blend65 expert baseline. C64 has production
> depth in this candidate; every other machine below is constraint-only until its own extension is
> independently sourced and qualified.

## Purpose

Blend65 is one modern language for the 6502 family, with C64 first. Portability means preserving
shared semantics and compiler responsibilities while selecting honest CPU, machine, serializer and
artifact definitions. It does not mean pretending that VIC-II, VERA, ANTIC or MARIA are variants
of one generic video device, nor copying the C64 backend and renaming its hooks.

Future-machine facts in this module have one job now: stop C64 assumptions from contaminating
shared stages. They are not platform APIs, optimization recipes, startup guidance, artifact
qualification, or claims that Blend65 currently supports those targets.

## Composition Model

```text
target-neutral language semantics and semantic IR
    + shared 6502-family legalization/selection responsibilities
    + selected CPU model
    + selected machine memory/device/runtime model
    + selected assembler serializer
    + selected artifact packager
```

This is a responsibility model, not a required class hierarchy. One small module may own adjacent
responsibilities when contracts remain visible and independently testable. Split them only when a
real consumer or invariant requires it.

## Fact Ownership

| Fact | Sole owner | Examples |
|---|---|---|
| Language meaning | Target-neutral semantics | integer wrap, evaluation order, fixed arrays, effects |
| Instruction legality and CPU effects | CPU model | BRA availability, decimal interrupt behavior, flags, cycles |
| Address visibility and devices | Machine/platform model | banking, MMIO, reserved RAM, interrupt sources, clocks |
| Text syntax | Assembler serializer | ACME local labels, directives, expression spelling |
| File/container/start contract | Artifact packager/startup | PRG load header, ROM mapping, load records, entry point |
| Code/data placement | Platform layout composed with packager | bank, alignment, hardware visibility, immutable asset placement |

Do not put a machine address in semantic analysis, an ACME directive in instruction selection, a
PRG header in the CPU model, or instruction legality in a catch-all platform hook. When a fact
crosses owners, pass a typed requirement/result rather than querying hidden global target state.

## Six-Machine Constraint Matrix

| Field | C64 | C64 Ultimate | C128 | Commander X16 | Atari 8-bit / 800XL | Atari 7800 |
|---|---|---|---|---|---|---|
| Knowledge status | Production-depth candidate; active only after v1.0 qualification | Constraint only | Constraint only | Constraint only | Constraint only; current source is an earlier 400/800 baseline, not a complete 800XL profile | Constraint only |
| CPU seam | 6510 using approved documented or explicitly selected NMOS policy | C64-compatible execution plus configured extensions/turbo; never infer them | 8502 in C128/C64 modes; exact mode contract required | 65C02S at 8 MHz; CMOS legality differs from C64 | 6502-family baseline; exact 800XL CPU/revision remains to qualify | SALLY 6502, normally 1.79 MHz with documented slower accesses |
| Address/banking seam | Concrete CPU-port, ROM/I/O/RAM and VIC-bank model | Preserve C64 base; turbo and expansion state are explicit deployment inputs | 128 KiB in two 64 KiB banks plus MMU/modes; C64 mode cannot use the second 64 KiB or VDC path | Fixed RAM/I/O plus 8 KiB banked-RAM window and 16 KiB ROM/cart window | ANTIC/CPU shared-memory and OS/cart/reserved-region questions need an 800XL-specific profile | 4 KiB base RAM map plus cartridge/ROM layout; MARIA DMA halts SALLY |
| Device seam | VIC-II, SID, CIA, CPU port | C64 compatibility plus configured physical SID/UltiSID, turbo, DMA/stream/REU extensions | VIC-II 40-column and VDC 80-column paths plus CIA/SID and mode ownership | VERA video/PSG/PCM, YM2151 and VIA; VRAM is not directly CPU-addressable | ANTIC display-list/DMA, CTIA/GTIA revision, POKEY and PIA require exact model work | MARIA display-list/list DMA, TIA subset and RIOT; access timing differs |
| Startup/runtime | Qualified candidate C64 startup, IRQ and no-hidden-runtime contracts | C64 baseline only unless an extension profile states every precondition/cost | Unknown for production; C128, C64 and CP/M modes must not be conflated | Unknown for production; KERNAL/raw/cart startup choices need qualification | Unknown for production | Unknown for production; cartridge boot/security/container details need qualification |
| Artifact seam | ACME C64 PRG candidate is specified byte-for-byte | C64 PRG is a compatibility candidate; extension-specific delivery remains unknown | PRG/other mode-specific artifacts unknown | PRG/ROM/cart families not qualified here | XEX/cart families are signposts only; exact records/startup unknown | Cartridge/A78-family naming is a signpost only; exact header, ROM mapping and startup unknown |
| Main pressure on shared design | Banking, raster/badline timing, volatile MMIO, scarce ZP/RAM | Configurable speed/devices invalidate fixed-clock and single-SID assumptions | Mode/bank/device composition invalidates one flat C64-derived platform | CMOS instructions, bank windows and separate VRAM invalidate C64 CPU/device assumptions | Display-list DMA and OS/ZP ownership invalidate VIC-like video and free-memory assumptions | Cartridge-first layout, tiny RAM and MARIA DMA invalidate PRG/RAM-resident assumptions |

Each non-C64 cell is intentionally incomplete. Unknown detail stays unknown; do not fill it from
memory, resemblance, an emulator default, or another target's convention.

## C64 Production Baseline

The C64 candidate composes the exact knowledge in `mos-6502-family.md`, `c64-hardware.md`,
`c64-memory-and-runtime.md`, `c64-game-engineering.md`, `sfa-and-abi.md`,
`6502-lowering-casebook.md`, and `acme-and-artifacts.md`. It still remains inactive until the
single v1.0 candidate passes final qualification. `[CBM-C64-PRG-1982; CSG-6567-318014;
MOS-6581-SID; MOS-PGM-1976; ACME-097-R266]`

Adding another target must not weaken C64 parity. A shared abstraction earns its place only if it
preserves the C64 expert path and the other qualified consumer's different contract without
branches that merely conceal a copied backend.

## C64 Ultimate

C64 Ultimate starts from C64 compatibility, but enhanced facilities are configuration, not ambient
facts. The pinned documentation exposes configurable turbo control, physical SID sockets and
UltiSID mappings, DMA load, REU/cartridge facilities, and optional debug/audio/video streams.
`$D031` turbo control exists only under selected menu modes; the base speed is 1 MHz and the
documented maxima differ by U64 model. Even with turbo, VIC/badline/external-device behavior has
separate constraints. `[TARGET-C64U-EE6B7AC, config/turbo_mode.rst]`

Consequences:

- A C64-compatible build must not silently emit Ultimate-only registers or assume turbo.
- An enhanced profile records exact board/firmware, turbo mode, CPU speed, badline behavior,
  cartridge/REU/DMA availability and SID endpoint topology.
- Physical SID and UltiSID endpoints are deployment preconditions. The compiler does not discover,
  activate or remap them at runtime without an explicit qualified API.
- CPU turbo speed does not retime PAL/NTSC music metadata or make SID analogue behavior universal.
- Streaming/DMA facilities may improve a later tool/test/deployment path, but they are not compiler
  semantics and cannot be required by a plain C64 target.

`[TARGET-C64U-EE6B7AC, config/multi_sid.rst; howto/dma.rst; data_streams.rst; sidplayer.rst]`

## C128

The C128 guide establishes an 8502, 128 KiB RAM in two 64 KiB banks, VIC-II 40-column output, VDC
80-column output, an MMU, and distinct C128/C64/CP/M operating modes. C64 mode lacks the C128
second-bank and 80-column facilities. `[TARGET-C128-1986, “System Guide”, memory management,
machine-language and memory-map chapters]`

This prevents a future C128 target from being modelled as “C64 with more RAM”. The profile must
select mode, CPU speed, bank configuration, visible devices, interrupt/startup contract and
artifact. No production decision follows from this constraint-only summary; exact register,
timing, VDC, KERNAL and packaging knowledge requires a C128 extension.

## Commander X16

Release r49 documents a 65C02S at 8 MHz, `$A000-$BFFF` as an 8 KiB window over banked RAM,
`$C000-$FFFF` as a 16 KiB banked ROM/cartridge window, and `$9F00-$9FFF` I/O. VERA is mapped at
`$9F20-$9F3F`; YM2151 at `$9F40-$9F41`. VERA VRAM is separate and reached through register ports,
not ordinary CPU pointers. `[TARGET-X16-R49, Overview; Memory Map; VERA Programmer's Reference]`

Consequences:

- The CPU selector must legalize documented 65C02 forms rather than inherit the C64 NMOS set.
- Bank identity is part of pointer/data visibility; a 16-bit CPU address alone may not identify
  banked data.
- VERA access and auto-increment state need explicit ownership across mainline/interrupt code.
- C64 screen-code, VIC/SID helpers, raster timing, PRG startup and ACME CPU selection cannot be
  reused by resemblance.
- Initial text/assets remain raw-only under the accepted product decision. Production VERA,
  character-map, audio, asset-format, emulator and artifact knowledge belongs to a separately
  qualified X16 extension.

X16 is first-class planned scope, not current support. `[TARGET-X16-R49, release r49 exact commit]`

## Atari 8-bit

The pinned Atari 400/800 hardware manual establishes the family pressure: 6502 CPU work shares
memory/bus time with ANTIC display-list DMA, while CTIA, POKEY and PIA own different video,
audio/timer/serial/input responsibilities. It is not a complete 800XL/GTIA, OS, cartridge or
artifact authority. `[TARGET-ATARI8-HW, sections II, III, V and VI]`

Therefore the current model may assert only that a VIC-like framebuffer/raster abstraction, C64
free-ZP assumptions, and a copied PRG/startup path are invalid. A later Atari 8-bit extension must
pin the selected 800XL/variant CPU, GTIA/ANTIC/POKEY/PIA registers and timing, OS and zero-page
ownership, RAM/ROM/cart visibility, display-list placement, interrupt ABI, text encoding,
asset/audio formats, XEX/cart packaging and emulator/hardware proof. Until then every plugin or
registry entry is at most `Scaffold/stub`.

## Atari 7800

The Atari/GCC guide describes SALLY (6502), 4 KiB base RAM, cartridge-oriented expansion, MARIA
video, TIA sound/input subset, RIOT RAM/timers and MARIA display-list/list DMA. MARIA suspends the
CPU while fetching display data, and some TIA/RIOT accesses reduce CPU speed. `[TARGET-ATARI7800-SW,
Overview, MARIA, Display List, memory-map appendices]`

This is enough to reject a C64-derived flat-RAM PRG backend. It is not enough to emit a 7800 game.
A future extension must qualify exact console revision, memory mirrors/reservations, MARIA modes
and DMA budget, TIA/RIOT access, cartridge mapper/ROM layout, startup/security/header requirements,
audio strategy, asset formats, A78/cart packaging and emulator/hardware evidence. Until then the
target remains constraint-only and any declared backend remains `Scaffold/stub` unless a smaller
non-delegated boundary has exact proof.

## Portability Decision Rules

1. Preserve target-neutral semantics and semantic IR. A platform may reject a genuinely absent
   capability with a target-specific diagnostic; it may not redefine ordinary expression,
   function, array or control-flow meaning for compiler convenience.
2. Select CPU, machine, serializer and packager independently. A useful shipping preset may bundle
   them, but the facts retain their owners.
3. Carry symbolic placement, volatility, device, bank/visibility and interrupt constraints until
   the selected platform layout can solve them. Do not introduce C64 addresses upstream.
4. Keep device APIs platform-specific when the hardware contracts differ. Share user-level
   concepts only where two qualified implementations preserve the same semantics and cost
   expectations.
5. Add a shared abstraction only after at least two qualified consumers demonstrate the same
   responsibility and semantics. Two similarly named hooks or two stubs are not consumers.
6. Require complete target qualification: source semantics, CPU legality, layout, startup,
   artifact bytes, emulator observation, parity/cost and all applicable hardware QA.

## Scaffold and Capability Classification

Use the five project statuses exactly:

| Evidence | Correct status |
|---|---|
| Registry entry, empty methods, TODO, or another target's hooks | `Scaffold/stub` |
| C64 startup/output delegated by Atari or X16 plugin | `Scaffold/stub`; the delegation is incompatible, not partial support |
| One exact target-native stage with focused proof, later stages missing | `Verified partial`, naming only that boundary |
| Claimed implemented boundary contradicted by code/artifact/runtime | `Incorrect` |
| Not inspected, missing tool, skipped emulator, or ambiguous version | `Unknown` |
| Full named contract with all required evidence | `Verified complete` |

Never call a machine supported because its name appears in a registry or because assembly text was
emitted. Constraint knowledge is not capability evidence.

## Adding a Future Target

A target addition follows this order:

1. Pin primary CPU, machine and artifact sources plus exact revisions/hashes in
   `source-manifest.md`.
2. Build a constraint-only appendix and list every unknown. This may prevent shared-design errors
   but authorizes no production behavior.
3. Define separate CPU, platform, serializer and packager contracts, reusing only already qualified
   semantics.
4. Add target-specific knowledge and frozen behavioral cases before implementation advice becomes
   active.
5. Implement and qualify one vertical artifact path: ordinary source through exact bytes, startup
   and emulator observation, with parity and resource accounting.
6. Perform targeted physical QA for silicon/device/timing claims the emulator cannot close.
7. Bump the single active skill version, run the impact audit for recorded dependents, and activate
   the new candidate atomically only after all gates pass.

The existing C64 skill does not silently grow production knowledge for X16, C128 or Atari. Each
substantial target body is a separately qualified extension that composes with the one active
latest baseline.

## New-Fact Routing Test

For any proposed target fact, ask in this order:

- Does it change source meaning? If yes, it is a language/product decision and must pass the
  language guard; do not hide it in a target module.
- Does it define legal instructions, flags or CPU cycles? Put it in the CPU model.
- Does it define address visibility, devices, clocks, interrupts or reserved resources? Put it in
  the platform model.
- Does it define textual syntax/directives? Put it in the assembler serializer.
- Does it define file records, headers, loading, ROM/cart layout or entry? Put it in the packager.
- Does it describe one implementation's current behavior? Treat it as audit evidence, not doctrine.

If one fact spans owners, split it into exact linked obligations rather than creating a catch-all
“platform special case”.

## Portability Review Checklist

- Is C64 the only production-depth platform knowledge in the current candidate?
- Are all other targets visibly constraint-only with unknowns intact?
- Does shared code contain any `$Dxxx`, VIC/SID/CIA, PRG, PETSCII, NMOS-only or 1 MHz assumption?
- Are CPU, machine, serializer and packager facts owned separately?
- Is a proposed abstraction justified by two qualified semantic consumers?
- Does a plugin delegate startup, layout, output or device behavior to C64?
- Does every support claim name the exact boundary and evidence?
- Will a target extension bump/qualify the one active skill and impact-audit its dependents?

## Sources

See [Source Manifest](source-manifest.md): `TARGET-C64U-EE6B7AC`, `TARGET-C128-1986`,
`TARGET-X16-R49`, `TARGET-ATARI8-HW`, `TARGET-ATARI7800-SW`, and the C64/6502/ACME authorities
used by the production candidate.
