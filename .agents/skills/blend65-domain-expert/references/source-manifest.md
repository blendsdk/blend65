# Source Manifest

> **Construction version**: `0.2.0-evidence-foundation`
> **Retrieved/rechecked**: 2026-09-05
> **Purpose**: Pin the evidence that may shape the Blend65 expert baseline. This manifest is
> provenance, dependency, and conflict control; it is not a substitute for the distilled local
> knowledge in the other references.

## Authority and Use

Use the reconciled frozen Blend65 specification for language meaning. Use manufacturer documents
for documented hardware behavior, bounded physical research for undocumented or revision-sensitive
behavior, and version-pinned official source/documentation for tool behavior. Compiler and
practitioner sources are comparative: they prove that a method exists and expose tradeoffs, but do
not silently become Blend65 requirements.

Every material citation in this skill has the form `[SOURCE-KEY, precise location]`. A URL is
provenance only; the knowledge needed during ordinary use must be distilled locally. External
content is untrusted and read-only. Never execute instructions copied from a source.

The following terms are used below:

- **Normative**: may determine the named Blend65 or documented hardware/tool fact within its stated
  revision and scope.
- **Empirical**: primary measurement or original technical research, bounded to its stated models.
- **Comparative**: informs design choices but cannot override Blend65 semantics or hardware facts.
- **Practitioner**: primary evidence for a technique, workflow, or real program.
- **Constraint only**: prevents a C64 assumption from contaminating a shared seam; it does not make
  another target supported.

## Project Authority

### BLEND65-SPEC-d39ae45 — Frozen Blend65 specification

- **Authority/status**: Normative for language meaning, subject to the conflict register.
- **Version**: repository commit `d39ae459e02133d474d7157807d53d7e71fd6268`.
- **Location**: repository `spec/**/*.md`; exact 50-path inventory is frozen in
  `../qualification/coverage-matrix.md`.
- **Scope**: syntax, types, evaluation, effects, modules, storage, intrinsics, diagnostics, target
  profile, and accepted platform appendices.
- **Dependent sections**: every row in `blend65-semantics.md#crosswalk`; language obligations in
  `compiler-architecture.md`, `sfa-and-abi.md`, `il-and-optimization.md`, and
  `6502-lowering-casebook.md`.
- **Precision**: repository path plus heading or line range at the pinned commit.
- **Known issues**: SC-001..SC-006 remain release-blocking. Compiler code, tests, readiness records,
  and feasibility snapshots have no authority to resolve them.
- **Local extraction**: only the exact crosswalk and necessary rules; no duplicate specification.
- **Verification**: pinned-path set equality plus the independent consistency gate recorded in the
  qualification artifacts.

## Processor and Bus Sources

### MOS-PGM-1976 — MCS6500 Microcomputer Family Programming Manual

- **Authority/status**: MOS Technology, normative for the documented NMOS programming model.
- **Edition/version**: publication 6500-50A, second edition, revision A, January 1976.
- **Location**: <https://www.bitsavers.org/components/mosTechnology/6500-50A_MCS6500pgmManJan76.pdf>.
- **Scope**: registers, status flags, addressing modes, official instructions, algorithms, and
  documented cycle/byte properties.
- **Dependent sections**: `mos-6502-family.md#programmer-visible-state`,
  `mos-6502-family.md#official-instruction-and-addressing-grid`, and arithmetic/comparison/shift/
  loop entries in `6502-lowering-casebook.md`.
- **Precision**: Chapter 2 §§2.2.1–2.2.3 (`ADC`, `SBC`, multi-precision arithmetic, carry, and
  overflow); Chapter 3 §§3.0–3.8 (status flags); Chapter 4 §§4.0.2–4.2.1 (jumps, relative
  branches, range repair, and comparison); Chapter 5 §§5.5–5.7 and Chapter 6 §§6.1–6.6
  (absolute, zero-page, relative, indexed, and indirect addressing); Chapter 7 §§7.4/7.6
  (`INX`/`DEX`); Chapters 8–9 (stack, subroutines, reset, interrupts, and `RTI`); Chapter 10
  §§10.0–10.9 (shifts, rotates, and read-modify-write); Appendix B's opcode/effect/byte/cycle
  tables and Appendix C's addressing-time tables.
- **Known issues**: it predates the 6510 and does not fully document later-discovered NMOS silicon
  quirks, dummy accesses, or every device-visible bus consequence.
- **Local extraction**: the complete official opcode/addressing/effect/cycle grid needed for code
  generation, rewritten as a compact table.
- **Verification**: cross-check documented operations against MOS-HW-1976 and WDC-65C02S-2022;
  isolate NMOS-only empirical behavior instead of projecting CMOS corrections backward.

### MOS-HW-1976 — MCS6500 Microcomputer Family Hardware Manual

- **Authority/status**: MOS Technology, normative for documented NMOS electrical/bus integration.
- **Edition/version**: publication 6500-10A, second edition, revision A, January 1976.
- **Location**: <https://www.bitsavers.org/components/mosTechnology/6500-10A_MCS6500hwMan_Jan76.pdf>.
- **Scope**: reset, interrupt entry, stack/bus sequencing, memory/interface timing, and system
  integration.
- **Dependent sections**: `mos-6502-family.md#reset-interrupt-and-stack-behavior`,
  `mos-6502-family.md#bus-visible-accesses`, and interrupt obligations in `sfa-and-abi.md`.
- **Precision**: processor timing, interrupt, memory-interface, and system-design sections plus the
  applicable timing diagrams.
- **Known issues**: family-level documentation does not identify all later mask revisions or every
  undocumented access sequence.
- **Local extraction**: only compiler-relevant interrupt, stack, and bus sequences.
- **Verification**: reconcile with MOS-PGM-1976 and bound later measured details to VIC-BAUER-2024
  or exact VICE test/source behavior.

### MOS-6510-1982 — MOS 6510 microprocessor datasheet

- **Authority/status**: MOS Technology, normative for documented 6510 additions.
- **Edition/version**: preliminary data sheet, November 1982.
- **Location**:
  <https://www.devili.iki.fi/pub/Commodore/docs/datasheets/CSG/6510-8211_rev_a.pdf>, SHA-256
  `298ebb5133a09b12ed06a93a57b8deb00c62af6c53bd564d998c0b7185163732`.
- **Scope**: 6502-compatible core, on-chip six-bit I/O port, `$0000/$0001` direction/data registers,
  pins, and documented timing.
- **Dependent sections**: `mos-6502-family.md#6510-delta` and
  `c64-memory-and-runtime.md#6510-port-and-cpu-memory-view`.
- **Precision**: title/feature page; “FUNCTIONAL DESCRIPTION”; “INPUT/OUTPUT PORT REGISTERS”
  description of the direction register at address 0 and port register at address 1; and the
  electrical/timing tables in this ten-page Rev. A scan.
- **Known issues**: the document is preliminary and archive mirrors have changed; use the document
  identity, not a mirror's HTML metadata, as the revision authority.
- **Local extraction**: port register semantics and the exact compiler-visible 6510 delta.
- **Verification**: cross-check C64 integration against CBM-C64-PRG-1982, CBM-C64-SVC-1985, and
  VIC-BAUER-2024.

### WDC-65C02S-2022 — W65C02S datasheet

- **Authority/status**: Western Design Center, normative for the selected W65C02S, not NMOS C64.
- **Edition/version**: W65C02S data sheet, revision dated 8 April 2022.
- **Location**: <https://www.westerndesigncenter.com/wdc/documentation/w65c02s.pdf>.
- **Scope**: CMOS instruction/addressing additions, corrected behaviors, interrupt/decimal changes,
  cycles, and legal forms.
- **Dependent sections**: `mos-6502-family.md#w65c02s-delta`, CPU selection in
  `compiler-architecture.md`, and legality checks in `6502-lowering-casebook.md`.
- **Precision**: §4 addressing modes; Tables 5-1 and 5-2 instructions/opcodes; Table 6-4 operation
  and cycle notes; Table 7-1 operational enhancements.
- **Known issues**: it describes a modern WDC implementation. It must never be used to “correct”
  C64 NMOS behavior.
- **Local extraction**: a delta matrix only; shared NMOS facts remain owned by the MOS sources.
- **Verification**: explicit selected-CPU qualification case; no W65C02-only opcode in C64 output.

### ZAKS-6502-1980 — Programming the 6502

- **Authority/status**: Rodnay Zaks/Sybex, published technical corroboration for an NMOS quirk;
  not a manufacturer source.
- **Edition/version**: third edition-era scan, 1980.
- **Location**: <https://www.atarimania.com/documents/6502_Assembly_Language_Programming.pdf>.
- **Scope**: the NMOS indirect `JMP` vector-page-wrap behavior omitted from the early MOS manuals.
- **Dependent sections**: `mos-6502-family.md#indirect-jump-page-wrap` and Q-C09.
- **Precision**: Chapter 3, page 3-13, indirect addressing discussion.
- **Known issues**: secondary to manufacturer evidence; used only for this explicit published
  behavior and paired with the W65C02S correction plus pinned emulator-test evidence.
- **Local extraction**: one bounded rule: an NMOS indirect vector ending in `$FF` fetches its high
  byte from `$xx00`, not the next page.
- **Verification**: contrast with WDC-65C02S-2022 Table 7-1 and VICE-TEST-EF8E8EFE CPU tests.

## Commodore 64 and Chip Sources

### CBM-C64-PRG-1982 — Commodore 64 Programmer's Reference Guide

- **Authority/status**: Commodore Business Machines/Howard W. Sams, normative for the documented
  C64 programming model.
- **Edition/version**: 1982, ISBN 0-672-22056-3.
- **Location**: <https://www.commodore.ca/manuals/c64_programmers_reference/c64-programmers_reference.htm>;
  direct chapter scans are linked from that contents page.
- **Scope**: memory map, VIC-II/SID/CIA register use, graphics, sound, machine-language startup,
  KERNAL vectors, and I/O.
- **Dependent sections**: all of `c64-memory-and-runtime.md`; documented register portions of
  `c64-hardware.md`; platform contracts in `c64-game-engineering.md`.
- **Precision**: Chapter 3 printed pages 101–104 (CIA2 VIC-bank selection, screen/character bases,
  and 16 KiB visibility), printed page 151 (`$D019` interrupt status/acknowledgement), Chapter 5
  printed pages 308 and 311 (IRQ vectors, `RTI`, `$0000/$0001`, CINV, and memory map), printed page
  320 (I/O assignments), and Appendix G printed page 391 (VIC register map). Other claims name
  their chapter PDF, printed page, register table, or subsection.
- **Known issues**: documented programming behavior is not a complete cycle-exact or
  revision-specific silicon model.
- **Local extraction**: compiler-facing memory/register/banking/startup tables with named fields.
- **Verification**: integration cross-check with the service manual and Bauer's measured VIC model.

### CBM-C64-KERNAL-03 — Recovered Commodore C64 KERNAL 901227-03 source

- **Authority/status**: recovered original Commodore source artifact, normative for the named
  KERNAL ROM revision's implementation but not for other ROM revisions.
- **Edition/version**: KERNAL revision 901227-03 at `mist64/cbmsrc` commit
  `01bd60f162ef92212ef0cb67546ae8f42be34168`.
- **Location**:
  <https://github.com/mist64/cbmsrc/tree/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03>.
- **Scope**: the KERNAL-mediated IRQ entry, RAM vector dispatch, register saves/restores, and IRQ
  exit contract.
- **Dependent sections**: `c64-memory-and-runtime.md#interrupt-entry-and-exit-contracts` and
  Q-P07.
- **Precision**: `KERNAL_C64_03/irqfile::PULS/PULS1` pushes A/X/Y and dispatches through `CINV`;
  `KERNAL_C64_03/editor.2::KPREND` restores Y/X/A and executes `RTI`.
- **Known issues**: this is a revision-specific implementation artifact. A raw vector with KERNAL
  ROM absent has only the selected CPU's hardware interrupt contract.
- **Local extraction**: exact stack/ownership difference between a KERNAL `CINV` handler and a raw
  `$FFFE/$FFFF` handler.
- **Verification**: pair with CBM-C64-PRG-1982 printed pages 308 and 311 and MOS-PGM-1976 Chapter 9.

### CBM-C64-SVC-1985 — C64 service manual and schematics

- **Authority/status**: Commodore service documentation, normative for the identified board/model
  integration.
- **Edition/version**: Model C64 service manual, February 1985, part 314001-02.
- **Location**: <https://www.commodore.ca/manuals/funet/cbm/schematics/computers/c64/manual/>.
- **Scope**: board variants, clock and memory integration, chip select/banking circuitry,
  connectors, and chip pinout context.
- **Dependent sections**: `c64-memory-and-runtime.md#cpu-vic-and-physical-memory-views` and
  `c64-hardware.md#models-revisions-and-qa-bounds`.
- **Precision**: specifications, circuit-theory pages, board-identification sheets, and matching
  schematic identifier.
- **Known issues**: multiple board and chip revisions exist; a schematic for one assembly is not a
  universal C64 claim.
- **Local extraction**: only software-relevant integration facts and revision bounds.
- **Verification**: require an exact board/model when a conclusion depends on analogue or revision
  behavior.

### MOS-6526-1981 — MOS 6526 Complex Interface Adapter datasheet

- **Authority/status**: MOS Technology, normative for documented 6526 behavior.
- **Edition/version**: November 1981 (`11/81`) datasheet.
- **Location**: <https://myoldcomputer.nl/Files/mos_6526_cia.pdf>, SHA-256
  `3c0e8403c3b46c0b74980e6cc7bec41a72d7aa82deabd58cc7884a11532ac78f`.
- **Scope**: data-direction/port registers, timers, time of day, serial port, interrupt control,
  flag pin, and register map.
- **Dependent sections**: `c64-hardware.md#cia-register-effects-and-ownership`, input scanning and
  VIC-bank ownership in `c64-game-engineering.md`.
- **Precision**: printed pages 1–2 (port and data-direction registers), printed pages 3–5
  (timers/control registers), printed page 6 “Interrupt Control (ICR)”, and printed page 8
  register summary. On ICR read, returned interrupt data and IRQ are cleared; on ICR write, bit 7
  selects set versus clear for the mask bits written as one.
- **Known issues**: chip revisions and system wiring can matter; C64-specific ownership comes from
  CBM-C64-PRG-1982 rather than this generic chip sheet.
- **Local extraction**: ICR set/clear and read/ack behavior, port direction, and compiler-visible
  volatility rules.
- **Verification**: cross-check installed CIA purpose/wiring against the C64 guide and exact tests.

### MOS-6581-SID — MOS 6581 SID datasheet

- **Authority/status**: MOS Technology, normative only for documented programmer-visible 6581
  registers; analogue output is revision-sensitive.
- **Edition/version**: original MOS 6581 Sound Interface Device data sheet; scan has no reliable
  mask-revision identity.
- **Location**: <https://www.cpcwiki.eu/imgs/9/9d/Mos_6581_sid.pdf>.
- **Scope**: register map, oscillators, envelope, filters, and external component interface.
- **Dependent sections**: `c64-hardware.md#sid-register-and-revision-model` and
  `c64-game-engineering.md#music-and-sound-effects`.
- **Precision**: register map plus oscillator, envelope, filter, and programming sections.
- **Known issues**: original documentation is incomplete for many analogue/revision effects and is
  not an 8580 specification. Do not infer universal audio from it.
- **Local extraction**: stable register/effect obligations and explicit unknown/revision fields.
- **Verification**: register-level behavior is cross-checked with version-pinned player/emulator
  source; audible/analogue claims require revision-bounded hardware QA.

### CSG-6567-318014 — 6567 Video Interface Chip Specification Sheet

- **Authority/status**: Commodore Semiconductor Group manufacturer specification; primary for the
  documented programmer-visible 6567 baseline within the preliminary sheet's scope.
- **Edition/version**: drawing `318014`; undated preliminary scan; 19 scanned pages whose internal
  sheet labels run within a 22-sheet drawing.
- **Location**:
  <https://www.zimmers.net/anonftp/pub/cbm/documents/chipdata/6567_vicII_preliminary.pdf>;
  mirror SHA-256 `6fbad4b037e4c4880e28bd9c34caa940a8ceb82041a41a0c22f8e6b12014567b`.
- **Scope**: display modes, movable-image blocks (sprites), raster and interrupt registers,
  register map, memory interface, BA/AEC arbitration, and DMA behavior for the documented 6567.
- **Dependent sections**: `c64-memory-and-runtime.md#cpu-and-vic-views`;
  `c64-hardware.md#vic-ii-register-and-dma-baseline`; raster/sprite sections of
  `c64-game-engineering.md`.
- **Precision**: internal sheets 1–10 (display and movable-image-block behavior), 11–14 (raster,
  interrupts, screen-position decodes, and register map), and 15–16 (system interface and DMA).
- **Known issues**: the document is preliminary, centered on the NTSC 6567, and the available scan
  is not a complete revision history. It does not establish later PAL/NTSC revisions, every
  cycle-level badline/sprite interaction, or physical silicon safety.
- **Local extraction**: manufacturer register/effect and bus-ownership baseline, with preliminary
  and variant limits attached to every dependent claim.
- **Verification**: cross-check C64 wiring/register addresses against CBM-C64-PRG-1982 and bound
  later revision/timing detail to VIC-BAUER-2024, exact VICE tests, or targeted physical QA.

### VIC-BAUER-2024 — The MOS 6567/6569 video controller (VIC-II) and its application in the C64

- **Authority/status**: Christian Bauer, empirical primary research and implementation model.
- **Edition/version**: text revision dated 29 September 2024.
- **Location**: <https://www.cebix.net/VIC-Article.txt>.
- **Scope**: 6510/VIC memory views, bus access, badlines, sprite DMA, raster timing, interrupts, and
  documented display techniques.
- **Dependent sections**: `c64-memory-and-runtime.md#cpu-and-vic-views`;
  `c64-hardware.md#vic-ii-timing-dma-and-register-effects`; raster/display sections of
  `c64-game-engineering.md`.
- **Precision**: §§2.2, 2.4.1–2.4.3, 3.2, 3.5–3.8, 3.12, and 3.14; the source's own model-limit
  warning is part of every dependent conclusion.
- **Known issues**: the author explicitly describes emulator-derived and empirical limits. It is
  stronger than folklore but not a manufacturer specification or proof for every chip revision.
- **Local extraction**: cycle/bus-access tables and named technique preconditions needed for
  scheduling decisions.
- **Verification**: compare with CBM documents and exact VICE tests; require physical QA for a
  physical/revision claim.

### VSP-AKESSON — Safe use of VSP on the C64

- **Authority/status**: Linus Åkesson, original practitioner/silicon-risk investigation.
- **Edition/version**: live article retrieved 2026-09-05.
- **Location**: <https://www.linusakesson.net/scene/safevsp/index.php>.
- **Scope**: VSP failure mechanism, risk factors, detection/mitigation context, and why emulator
  success cannot establish general hardware safety.
- **Dependent sections**: `c64-hardware.md#vsp-and-silicon-sensitive-effects` and Q-P18.
- **Precision**: “VSP explained”, “The VSP bug”, and safety/compatibility discussion.
- **Known issues**: observed risk depends on VIC revision, temperature, board parasitics, power,
  and individual machine. No general-build safety guarantee is inferred.
- **Local extraction**: explicit opt-in/risk contract and targeted-QA requirements.
- **Verification**: safe default is no VSP/AGSP transformation; physical claims remain bounded.

### FRAGILITY-AKESSON — Perpetual Fragility

- **Authority/status**: Linus Åkesson, original demo technique explanation.
- **Edition/version**: live article retrieved 2026-09-05.
- **Location**: <https://www.linusakesson.net/scene/perpetual-fragility/index.php>.
- **Scope**: AGSP, line crunch, bank switching, badline scheduling, and their integrated constraints.
- **Dependent sections**: `c64-game-engineering.md#cycle-exact-display-techniques` and Q-P19.
- **Precision**: named AGSP, line-crunch, graphics, and timing sections.
- **Known issues**: authoritative for this production and technique, not a universal compiler
  rewrite recipe.
- **Local extraction**: preconditions, ownership, resource costs, and unsafe-generalization guards.
- **Verification**: underlying hardware facts cross-checked with VIC-BAUER-2024.

### NINE-AKESSON — Nine: a technical explanation

- **Authority/status**: Linus Åkesson, original demo technique explanation.
- **Edition/version**: live article retrieved 2026-09-05.
- **Location**: <https://www.linusakesson.net/scene/nine/explanation.php>.
- **Scope**: sprite DMA/timing interactions, revision awareness, and cycle-critical construction.
- **Dependent sections**: `c64-hardware.md#sprite-dma` and
  `c64-game-engineering.md#sprite-multiplexing`.
- **Precision**: sprite DMA, timing, and compatibility sections.
- **Known issues**: one production's solution is evidence for a technique, not proof that the same
  schedule is correct for another workload.
- **Local extraction**: scheduler and compatibility obligations only.
- **Verification**: hardware mechanics cross-checked with VIC-BAUER-2024 and VICE test sources.

## Tool Authorities

### ACME-097-R266 — ACME 0.97 “Zem” official source and documentation

- **Authority/status**: official SourceForge SVN, normative for ACME 0.97 behavior represented by
  source revision 266.
- **Edition/version**: release 0.97 “Zem”; `src/version.h` change date 28 June 2020; SVN r266.
- **Location**: <https://sourceforge.net/p/acme-crossass/code-0/266/tree/>; release files at
  <https://sourceforge.net/projects/acme-crossass/files/>.
- **Scope**: expression grammar, low/high byte operators, addressing selection/forcing, symbols,
  branches, directives, diagnostics, reports, and output formats.
- **Dependent sections**: all of `acme-and-artifacts.md`; serializer/packager boundaries in
  `compiler-architecture.md`; Q-A01..Q-A05 and Q-R12.
- **Precision**: `trunk/docs/QuickRef.txt` lines 302–360 (operator table, associativity, and
  low/high-byte ambiguity); `trunk/docs/AddrModes.txt` lines 7–45 (automatic ZP/absolute
  selection), 94–141 (force-width postfixes and byte extraction), and 146–172 (selection
  algorithm); `trunk/src/alu.c` lines 102–149 and 653–667 (operator definitions and low/high
  lexer) plus 1146–1164 (`OPHANDLE_LOWBYTEOF`/`OPHANDLE_HIGHBYTEOF` evaluation);
  `trunk/src/mnemo.c::calc_arg_size` and `::near_branch`; and
  `trunk/src/output.c::Output_save_file`. `trunk/docs/AllPOs.txt` lines 279–289 and
  `trunk/src/output.c`'s `OUTPUT_FORMAT_CBM` path define the CBM output's little-endian load
  address.
- **Known issues**: the prominent `meonwax/acme` GitHub mirror is older (0.96.4-era) and cannot
  establish 0.97 behavior. The earlier plan date 2021-01-31 was unsupported and is superseded by
  official r266 metadata.
- **Local extraction**: exact syntax/behavior rules and minimal future proof inputs/expected
  bytes—never an assembled observation claimed without execution.
- **Verification**: source-to-proof-spec review now; executable ACME checks are reserved for later
  compiler implementation/audit and are not run during skill creation.

### VICE-310-SOURCE — VICE 3.10 official source tag

- **Authority/status**: official VICE Team source mirror, normative for the configured emulator
  implementation only.
- **Edition/version**: tag `3.10.0`, commit `4d283a2e7dd59b7e378524878e81ecc7826b700c`, released
  24 December 2025.
- **Location**: <https://github.com/VICE-Team/svn-mirror/tree/3.10.0>.
- **Scope**: `x64sc` model selection, monitor/automation behavior, CPU/device models, and exit/
  observation mechanisms used by future proof specifications.
- **Dependent sections**: `acme-and-artifacts.md#vice-proof-contract`, emulator boundaries in
  `c64-hardware.md`, Q-A06, and Q-R06.
- **Precision**: tagged source path and symbol; never moving default-branch line numbers.
- **Known issues**: VICE behavior is not universal physical truth. Model/settings must be recorded.
- **Local extraction**: configuration and observation contract only.
- **Verification**: cross-check the release manual and relevant test-program sources; no emulator
  execution occurs in this plan.

### VICE-310-MANUAL — VICE 3.10 manual

- **Authority/status**: VICE Team official user manual, normative for documented 3.10 options and
  monitor behavior.
- **Edition/version**: VICE 3.10 release manual.
- **Location**: <https://vice-emu.sourceforge.io/manual/vice.pdf>.
- **Scope**: emulator/model configuration, command-line use, monitor, snapshots, and test
  observation interfaces.
- **Dependent sections**: `acme-and-artifacts.md#vice-proof-contract` and Q-A06/Q-R06.
- **Precision**: machine-model, command-line-options, monitor, and C64-model sections by heading.
- **Known issues**: the online URL may later serve a newer manual; tagged source is the immutable
  version anchor.
- **Local extraction**: exact future command template and required recorded configuration.
- **Verification**: documentation/source agreement only during skill creation.

### VICE-TEST-EF8E8EFE — VICE test-program corpus snapshot

- **Authority/status**: version-pinned mirror of the VICE testprogs corpus; empirical test-source
  evidence, not manufacturer authority.
- **Edition/version**: commit `ef8e8efe52f3d43df7acefad132c6506239bddee`.
- **Location**: <https://github.com/libsidplayfp/VICE-testprogs/tree/ef8e8efe52f3d43df7acefad132c6506239bddee>.
- **Scope**: existing CPU, VIC-II, CIA, SID, banking, and timing test designs and expected model
  observations.
- **Dependent sections**: edge-case/future-proof entries in `mos-6502-family.md`, `c64-hardware.md`,
  and `acme-and-artifacts.md`.
- **Precision**: commit, test directory, source file, and expected-result/readme file.
- **Known issues**: this repository is a mirror and individual tests vary in physical-hardware
  coverage and documentation quality. Inspect each selected test before relying on it.
- **Local extraction**: only the smallest discriminating test idea and expected observation.
- **Verification**: source review now; any later execution records exact tag/model/result separately.

## Comparative Compiler Sources

These sources inform architecture, lowering, allocation, and optimization choices. None may
override Blend65 semantics, the SFA product decision, or the “modern ergonomics in, expert assembly
out” directive.

The following fields apply to every entry in the compact table: **authority/status** is the named
project's official repository and is comparative; **retrieved** is 2026-09-05; **precision** is the
exact pinned file, symbol, test, or document heading cited by dependent knowledge; **local
extraction** is only the observed responsibility/algorithm/tradeoff needed for a decision;
**verification** compares equivalent obligations against at least one other pinned implementation
and the governing Blend65/hardware source. Moving branch state is never evidence.

| Key | Exact pin and location | Comparative scope | Dependent sections / known limits |
|---|---|---|---|
| LLVM-CODEGEN-22 | LLVM `llvmorg-22.1.8`, commit `ca7933e47d3a3451d81e72ac174dcb5aa28b59d1`; <https://github.com/llvm/llvm-project/blob/llvmorg-22.1.8/llvm/docs/CodeGenerator.rst> | Target-independent/target-dependent responsibilities, selection, register allocation, prologue/epilogue, emission | `compiler-architecture.md`, `il-and-optimization.md`; a responsibility vocabulary, not a required LLVM-shaped architecture |
| LLVM-MOS-275C7FC | commit `275c7fc25448d9bae8e201cdfd782dd4fec803d2`; <https://github.com/llvm-mos/llvm-mos/tree/275c7fc25448d9bae8e201cdfd782dd4fec803d2> | Real LLVM 6502 backend, address spaces, lowering, machine passes | `compiler-architecture.md`, `sfa-and-abi.md`, `il-and-optimization.md`; comparative only, including where its runtime/stack choices differ from Blend65 |
| LLVM-MOS-SDK-23.1.0 | tag `v23.1.0`, commit `7e47e7dff564f4989129ea4131d2f9db9650513e`; <https://github.com/llvm-mos/llvm-mos-sdk/tree/v23.1.0> | Platform libraries, target composition, startup/linker/runtime patterns | `compiler-architecture.md`, `target-portability.md`; breadth is not proof Blend65 should copy its interfaces |
| OSCAR64-1.32.273 | tag `v1.32.273`, commit `9408778695b5442e755832711b89243b4f94a9ff`; <https://github.com/drmortalwombat/oscar64/tree/v1.32.273> | 6502 optimizer/code generator, calling, linking, C64 libraries | `6502-lowering-casebook.md`, `il-and-optimization.md`, `c64-game-engineering.md`; C semantics/runtime obligations differ |
| KICKC-0.8.6 | tag `0.8.6`, commit `d9d7f2cf03a19b9ae3dfb289d8755fc9b327b217`; <https://gitlab.com/camelot/kickc/-/tree/0.8.6> | SSA-oriented 6502 compilation, allocation, fragments, platform headers | `sfa-and-abi.md`, `il-and-optimization.md`, `6502-lowering-casebook.md`; comparative only |
| PROG8-12.1.1 | tag `v12.1.1`, commit `d1383813d2718fa8e14dd03b3eafb8be25e1f5a3`; <https://github.com/irmen/prog8/tree/v12.1.1> | Modern-language ergonomics, 6502/65C02 lowering, target libraries | `blend65-semantics.md`, `6502-lowering-casebook.md`, `target-portability.md`; language design is not Blend65 authority |
| CC65-2.19 | tag `V2.19`, commit `555282497c3ecf8b313d87d5973093af19c35bd5`; <https://github.com/cc65/cc65/tree/V2.19> | Mature 6502 C ABI/runtime, optimizer, assembler/linker, C64 target | `sfa-and-abi.md`, `6502-lowering-casebook.md`, `target-portability.md`; its software-stack/runtime compromises are comparison points, not defaults |

Citations to this table add an exact file/symbol or document heading from the pinned tree, such as
`cc65/doc/cc65.sgml`, `cc65/doc/coding.sgml`, or `cc65/doc/c64.sgml`. A recommendation must state
which obligation differs before comparing emitted code or architecture.

## C64 Game, Asset, Loader, and Audio Practice

### HESSIAN-1.2 — Hessian game source

- **Authority/status**: Lasse Öörni/Cadaver, practitioner evidence from a shipped-scale C64 game.
- **Edition/version**: tag `1.2`, commit `87aa35065cf4c6b49ea55ea3129ec8dd038c4177`.
- **Location**: <https://github.com/cadaver/hessian/tree/1.2>.
- **Scope**: PAL/NTSC 50 Hz design, eight-direction scrolling, 24-sprite multiplexing, sprite
  cache/depacking, music, loading, entity/game-state structures, and build-time assets.
- **Dependent sections**: `c64-game-engineering.md#scrolling-and-rendering`,
  `#sprite-multiplexing`, `#entities-collision-and-state`, `#asset-streaming-and-loading`.
- **Precision**: pinned README claim plus `actor.s::DrawActors`, `::RedrawAndAddActors`,
  `::UpdateActors`, and `::InterpolateActors`; `sprite.s::GetAndStoreSprite` and its cache/depack
  path; `level.s::ChangeLevel`; and `loader.s::InitLoader` plus its fast-load/sprite-wait paths.
- **Known issues**: one game's tradeoffs are workload evidence, never a universal layout mandate.
- **Local extraction**: responsibility, precondition, data layout, hot-path, and measured-resource
  lessons; not source-code copying.
- **Verification**: cross-check hardware assumptions against C64 authorities and compare at least one
  independent practitioner implementation before generalizing.

### C64-GAMEFRAME-C634F6F — C64 game framework source

- **Authority/status**: Lasse Öörni/Cadaver, practitioner/reference implementation.
- **Edition/version**: commit `c634f6fa7004cc5bfb14df14dee6f9fa3fe20b1b`.
- **Location**: <https://github.com/cadaver/c64gameframework/tree/c634f6fa7004cc5bfb14df14dee6f9fa3fe20b1b>.
- **Scope**: compact game loop, scrolling, sprites, actors, loader/tool flow, and data ownership.
- **Dependent sections**: the same game-system headings as HESSIAN-1.2.
- **Precision**: `actor.s::DrawActors`, `::UpdateActors`, collision bounds/search paths;
  `sprite.s::DrawLogicalSprite` and its depack cache; `level.s::ChangeLevel`; and `loader.s`'s
  `ELoad`, fast-load, and sprite-wait paths at the pinned commit.
- **Known issues**: framework conventions are not Blend65 APIs by default.
- **Local extraction**: cross-cutting ownership and cost patterns.
- **Verification**: only promote patterns with an explicit Blend65/compiler disposition and proof.

### CADAVER-TOOLS-2026 — Covert BitOps tools and players

- **Authority/status**: original author/maintainer page, practitioner authority for the listed
  loaders, trackers, players, and their stated tradeoffs.
- **Edition/version**: live index retrieved 2026-09-05; any decision-critical downloadable tool
  must gain its own immutable version/hash entry before citation.
- **Location**: <https://cadaver.github.io/tools.html>.
- **Scope**: cross-development loading, music/player integration, memory use, raster/IRQ ownership,
  and size/speed tradeoffs.
- **Dependent sections**: `c64-game-engineering.md#asset-streaming-and-loading` and
  `#music-and-sound-effects`.
- **Precision**: named tool/version entry and its technical notes; this index alone cannot support
  a source-code invariant.
- **Known issues**: the rolling page is not immutable; a later audit records the individual archive
  hash if a binary/source package becomes decision-critical.
- **Local extraction**: integration contracts and published resource costs only.
- **Verification**: pair hardware claims with chip/C64 sources and code claims with pinned source.

### GOATTRACKER-R172 — GoatTracker 2 source

- **Authority/status**: official SourceForge SVN, practitioner/source evidence.
- **Edition/version**: SVN revision 172; `player.s` declares playroutine version 2.73.
- **Location**:
  <https://sourceforge.net/p/goattracker2/code/172/tree/goattrk2/trunk/src/player.s>.
- **Scope**: SID music data, player scheduling, effects, exported player/source integration.
- **Dependent sections**: `c64-game-engineering.md#music-and-sound-effects`.
- **Precision**: `goattrk2/trunk/src/player.s::mt_init`, `::mt_playsfx`, `::mt_play`,
  `::mt_chntempo`, and the final SID-register write block (source lines 1350–1431 at r172).
- **Known issues**: tracker/editor behavior is separate from the generated player's runtime
  contract; SID analogue behavior remains revision-sensitive.
- **Local extraction**: cadence, memory-table, voice/SFX-sharing, and IRQ ownership patterns.
- **Verification**: compare register intent with MOS-6581-SID and LIBSIDPLAYFP-3.1.1.

### LIBSIDPLAYFP-3.1.1 — libsidplayfp/reSID source

- **Authority/status**: version-pinned emulator/library source, comparative implementation evidence.
- **Edition/version**: tag `v3.1.1`, commit `732fa8ec8131fc75aafc2eaea583ddcdeea2a3cc`.
- **Location**: <https://github.com/libsidplayfp/libsidplayfp/tree/v3.1.1>.
- **Scope**: 6581/8580 model separation, SID register/cycle model, and playback environment.
- **Dependent sections**: `c64-hardware.md#sid-register-and-revision-model` and
  `c64-game-engineering.md#music-and-sound-effects`.
- **Precision**: `src/builders/residfp-builder/residfp-emu.cpp::reSIDfpEmu::write`,
  `::clock`, and `::model`; the last maps `MOS6581`/`MOS8580` to the selected reSIDfp chip model.
- **Known issues**: an emulator model is not audible proof for every chip, filter, board, or output
  stage.
- **Local extraction**: revision/model boundaries and register-level expectations.
- **Verification**: physical/analogue claims retain targeted hardware-QA status.

### SPINDLE-V3 — Spindle 3 handbook

- **Authority/status**: Linus Åkesson, original tool author/practitioner source.
- **Edition/version**: Spindle version 3 handbook.
- **Location**: <https://linusakesson.net/software/spindle/v3manual.pdf>.
- **Scope**: integrated linking, crunching, loading, resident IRQ interaction, memory placement, and
  cross-development workflow.
- **Dependent sections**: `c64-game-engineering.md#asset-streaming-and-loading` and
  `acme-and-artifacts.md#artifact-and-loader-boundaries`.
- **Precision**: handbook section and page for loader/linker/IRQ/memory behavior.
- **Known issues**: demo-oriented solution; loader tradeoffs and assumptions must be re-evaluated for
  a game's I/O and runtime contract.
- **Local extraction**: ownership and interaction rules, not a mandated tool dependency.
- **Verification**: separate build-time representation, emitted artifact, and runtime loader proof.

### INTEGRATOR-LEVY — Robin Levy's account of The Last Ninja Integrator workflow

- **Authority/status**: first-person practitioner interview; primary testimony for the described
  production workflow and tradeoffs.
- **Edition/version**: interview page retrieved 2026-09-05.
- **Location**: <https://www.lemon64.com/page/dan-phillips-and-robin-levy-interview>.
- **Scope**: John Twiddy's Integrator use; elements/panels; draw/mask speed; attribute clashes;
  multicolor handling; silhouette masks; memory-versus-speed choices; reuse and priority order.
- **Dependent sections**: `c64-game-engineering.md#integrator-style-scene-and-asset-pipeline` and
  Q-P15.
- **Precision**: Robin Levy answer at page lines 124–136 in the retrieved HTML/text rendering.
- **Known issues**: testimony is not a complete format, algorithm, editor, or source listing.
- **Local extraction**: only the stated workflow concepts and tradeoffs, each labelled testimony.
- **Verification**: pair with INTEGRATOR-DIFRAIA-2012 for concrete reconstructed editor stages and
  explicitly retain what remains unknown.

### INTEGRATOR-DIFRAIA-2012 — Integrator reconstruction

- **Authority/status**: Luigi Di Fraia's reconstruction and recovered-evidence report;
  corroborative practitioner evidence, not the original tool source.
- **Edition/version**: Integrator 2012 entry, page retrieved 2026-09-05.
- **Location**: <https://www.luigidifraia.com/software/>.
- **Scope**: recovered PDS Ninja III editor evidence and reconstructed panel/object import,
  foreground/boundary/connection/sprite-position editor stages.
- **Dependent sections**: `c64-game-engineering.md#integrator-style-scene-and-asset-pipeline` and
  Q-P15.
- **Precision**: Integrator 2012 entry, retrieved-page lines 279–313.
- **Known issues**: the author explicitly identifies unknown original manual/additional-editor
  behavior. Reconstruction features cannot be attributed to Twiddy's original without other
  evidence.
- **Local extraction**: evidence-labelled stage inventory and unknowns.
- **Verification**: no reconstructed detail becomes an original-Integrator claim; the compiler
  recommendation is independent synthesis with explicit proof duties.

## Future-Target Constraint Sources

These entries exist only to expose seam pressure. Every non-C64 target stays unqualified until its
own primary research and target-specific cases pass.

The following fields apply to every entry in the compact table: **authority/status** is the named
vendor/community project's primary manual or official repository and is constraint-only;
**retrieved** is 2026-09-05; **precision** is the exact printed section/heading or pinned file named
in its row; **local extraction** is only the seam pressure recorded in `target-portability.md`;
**verification** checks that no C64 assumption is projected onto the target and never claims target
support. When a legacy scan prints no edition/revision, the row says so and pins its file digest
instead of inventing one.

| Key | Exact pin and location | Constraint scope | Known limit / dependent section |
|---|---|---|---|
| TARGET-X16-R49 | Commander X16 docs release `r49`, commit `d8c26e580caa3b92c96446a24d65c32149cc41e4`; `X16 Reference - 08 - Memory Map.md`, `09 - VERA Programmer's Reference.md`, `14 - Hardware.md`, and `Appendix C - 65C02 Processor.md`; <https://github.com/X16Community/x16-docs/tree/r49> | W65C02, banking, VERA, memory map, artifacts | Constraint only; `target-portability.md#commander-x16` |
| TARGET-C64U-EE6B7AC | commit `ee6b7ac1d5d06a6713dcfa5f95efdc78588d4b69`; `config/turbo_mode.rst`, `howto/dma.rst`, `data_streams.rst`, and `hardware/index.rst`; <https://github.com/GideonZ/1541u-documentation/tree/ee6b7ac1d5d06a6713dcfa5f95efdc78588d4b69> | C64 compatibility and Ultimate extensions | Constraint only; model/firmware must be stated; `target-portability.md#c64-ultimate` |
| TARGET-C128-1986 | Commodore 128 Programmer's Reference Guide, February 1986, ISBN 0-553-34292-4; memory-management, machine-language, VIC-II/VDC, and appendices headings; <https://www.devili.iki.fi/pub/Commodore/docs/books/C128_Programmers_Reference_OCR.pdf> | 8502, modes, banking, VIC-II/VDC, startup | OCR must be checked against scans for exact bits; `target-portability.md#c128` |
| TARGET-ATARI8-HW | Atari 400/800 Home Computer System Hardware Manual, Atari, copyright 1982; no edition/revision printed; SHA-256 `4072344ee26b954f492608af70dba812f5214d89468e1061ba6724d7a8054845`; sections II.A–II.E, III.A–III.I, V.A–V.B, and VI.A–VI.C; <https://www.atarimania.com/documents/atari-400-800-hardware-manual.pdf> | 6502-family, ANTIC/CTIA, POKEY, interrupt/register, display-list, and memory-map seams | Constraint only and not a complete 800XL/GTIA profile; `target-portability.md#atari-8-bit` |
| TARGET-ATARI7800-SW | Atari/GCC 7800 Software Guide, circa 1984; no edition/revision/date printed in the 21-page mirror; SHA-256 `f20778e88a0b16080a74029751e4c93afd4c77e79de66169cb564d4c67a64162`; “Overview of 7800”, “Overview of MARIA”, “Display List”, “Display List List”, “Graphics Modes”, and Appendices 1–4; <https://www.atarihq.com/danb/files/7800%20Software%20Guide.pdf> | SALLY/6502-family, MARIA, RAM, cartridge, DMA, and artifact seams | Constraint only; document uncertainty/errata require later target research; `target-portability.md#atari-7800` |

## Oracle Source-to-Invariant Audit Map

This table is the review packet for the Phase 2 authority gate. “Derivation” separates a sourced
fact from a compiler recommendation. A frozen case may require both: the external source supports
the fact; the project parity/modern-language directives support the compiler disposition. Rows
labelled **project-policy oracle** are not external oracles; their governing policy is already
frozen, while named sources are only permitted raw evidence for a later isolated evaluation.

| Cases | Stable sources and precise locations | Invariant derivation and bound |
|---|---|---|
| Q-C01, Q-C03 | MOS-PGM-1976 §4.2.1 (`CMP`), §§4.1.2–4.1.3 (conditional branches), and Appendix B effect table | `CMP` defines N/Z/C but not V, so signed `N xor V` after CMP consumes stale state; unsigned `>=` may branch on C without materializing a Boolean. |
| Q-C02, Q-C04 | BLEND65-SPEC-d39ae45 `spec/02-type-system.md`, “Comparison operators” and signed integer ranges; MOS-PGM-1976 §4.2.1 and §§4.1.2–4.1.3 | Blend65 requires mathematical signed order while MOS supplies the exact flag effects. Sign normalization, sign split, or controlled subtraction is valid only when its stated preconditions reproduce that order. A word comparison settles a differing signed high byte before the low byte. |
| Q-C05, Q-C06 | BLEND65-SPEC-d39ae45 `spec/02-type-system.md`, “Deterministic integer wraparound”; MOS-PGM-1976 §§2.2.1–2.2.3 (`ADC`/`SBC`, multi-precision, carry/overflow) and §§3.0–3.0.2 (`C`, `SEC`, `CLC`) | Multi-byte addition must establish a source-independent initial carry and propagate it; subtraction uses carry as no-borrow and begins with `SEC` for ordinary `a-b`. |
| Q-C07 | MOS-PGM-1976 Chapter 3 §3.3 (`D`/`SED`/`CLD`) and Chapter 9 §§9.5–9.9 (IRQ/NMI entry and return); WDC-65C02S-2022 Table 7-1 | NMOS interrupt entry does not provide the CMOS decimal-clear guarantee. The ABI must own D (normally `CLD` before binary IRQ arithmetic or a stronger caller invariant) and name the CPU variant. |
| Q-C08 | MOS-PGM-1976 Chapter 6 §§6.4–6.5, indexed-indirect and indirect-indexed addressing examples/tables | A two-byte ZP pointer cannot begin at `$FF` when the required high byte wraps to `$00`; allocation must enforce the pair boundary. |
| Q-C09 | ZAKS-6502-1980, Chapter 3 p.3-13; WDC-65C02S-2022 Table 7-1 | NMOS `JMP ($xxFF)` wraps the high-byte fetch within the page; W65C02S fixes it. C64 output must avoid or deliberately model the NMOS form. |
| Q-C10 | MOS-PGM-1976 Chapter 10 §§10.6–10.9 (memory read-modify-write); CSG-6567-318014 internal sheet 11 (interrupt register); VIC-BAUER-2024 §§3.2/3.12; CBM-C64-PRG-1982 printed pages 151 and 391 (`$D019`) | A memory RMW performs device-visible accesses and may not preserve the semantics of a chosen VIC register operation. Bytes/cycles alone cannot authorize the rewrite. |
| Q-C11, Q-C12 | MOS-PGM-1976 §§4.1.1–4.1.4 (relative branch, range, and path timing), §§6.1–6.2 (absolute indexed), Appendix B opcode timing, and Appendix C addressing timing | Branch cost is path/page dependent. Indexed read page crossing and store timing are not the same rule. Layout/repair must use final addresses. |
| Q-C13 | BLEND65-SPEC-d39ae45 `spec/04-expressions-operators.md:112-117` and `spec/02-type-system.md:429-446`; MOS-PGM-1976 Chapter 10 §§10.0–10.4 (`LSR`, `ASL`, `ROR`, `ROL`) | **Blocked conflict:** for a negative signed value and count at least the width, “always 0” contradicts arithmetic sign extension. No lowering invariant freezes until the product resolves that semantic field. |
| Q-C14 | BLEND65-SPEC-d39ae45 `spec/04-expressions-operators.md:70-78` and `spec/02-type-system.md:450-464`; MOS-PGM-1976 Chapter 10 shift/rotate effects; `evidence-parity-and-recovery.md#equivalent-work-accounting` | Fold/identity/shift-add/table/helper selection is compiler synthesis. It must preserve width/signedness/wrap semantics and win after complete attributable cost; no comparative compiler is authority for the choice. |
| Q-C15 | BLEND65-SPEC-d39ae45 `spec/04-expressions-operators.md:80-93` (division quotient truncates toward zero); MOS-PGM-1976 Chapter 10 shift/rotate effects; `evidence-parity-and-recovery.md#transformation-proof` | A signed negative odd dividend distinguishes truncation-toward-zero division from arithmetic shift. This case is deliberately quotient-only; it does not define or qualify signed `%` behavior. |
| Q-C16 | BLEND65-SPEC-d39ae45 `spec/02-type-system.md:181-185,228-237` (comparison produces Boolean); MOS-PGM-1976 §4.2.1 and §§4.1.2–4.1.3; `evidence-parity-and-recovery.md#equivalent-work-accounting` | Direct branching and delayed materialization are project/compiler synthesis. The escaping Boolean remains materialized exactly where demanded by the use graph. |
| Q-C17 | MOS-PGM-1976 official opcode grid; WDC-65C02S-2022 Tables 5-1/5-2 | Instruction legality belongs to the selected CPU; assembler ability to accept a W65C02 opcode does not make it legal for NMOS 6510 output. |
| Q-C18 | MOS-PGM-1976 Chapter 8 (`JSR`/`RTS` and stack) and Chapter 9 (interrupt context); `evidence-parity-and-recovery.md#equivalent-work-accounting`; the frozen SFA/IRQ ownership policy | Inline/helper selection includes call/return, ABI saves, reachability/dead stripping, scratch/ZP/frame use, and IRQ reentrancy—not body length alone. |
| Q-C19 | BLEND65-SPEC-d39ae45 `spec/05-statements-control-flow.md:215-255,309-327` and `spec/evaluations/F008-for-loop.md:244-258`; MOS-PGM-1976 Chapter 7 §§7.4/7.6 (`INX`/`DEX`) and Chapter 4 branch rules | **Blocked conflict:** the product ruling selects inclusive `to`, with `0 to 255` as the full 256-iteration byte range and `0 to 256` out of range. F008 still conflicts, so no loop/lowering invariant freezes until a separately authorized spec commit reconciles it. |
| Q-C20 | ACME-097-R266 `trunk/docs/QuickRef.txt` lines 302–360 and `trunk/src/alu.c` lines 102–149/653–667 plus 1146–1164 (low/high operators, tokens, and evaluation); MOS-PGM-1976 Appendix B immediate-load forms | Link-time-known address bytes remain symbolic until assembly; runtime helper/materialization is unnecessary unless runtime semantics require it. |
| Q-C21 (**project-policy oracle**) | `evidence-parity-and-recovery.md#transformation-proof`; BLEND65-SPEC-d39ae45 and MOS-PGM-1976 are permitted raw semantic/hardware evidence for the isolated case | Changed assembly requires an independent expected-behavior oracle and a separate intended shape/cost expectation; comparing two implementations alone cannot prove both correct. |
| Q-C22 | MOS-PGM-1976 §§4.1.1–4.1.4 and Appendices B–C; `evidence-parity-and-recovery.md#equivalent-work-accounting` | Unrolling is a workload decision. Fixed count, path frequency, code/layout expansion, and saved cycles determine full/partial/no-unroll; none is universally correct. |
| Q-C23 | MOS-PGM-1976 Appendix B instruction sizes and Chapter 5 absolute addressing; CBM-C64-PRG-1982 printed pages 311/320 memory map; frozen IRQ/ownership policy | Operand patching is valid only in writable visible memory with exclusive or synchronized ownership and IRQ/reentrancy safety. This is a bounded synthesis, not a claim that practitioner precedent makes self-modifying code a default optimization. |
| Q-C24 | MOS-PGM-1976 Appendices B–C access/cycle tables; CBM-C64-PRG-1982 printed pages 101–104 and 311/320 for visibility/banking; `evidence-parity-and-recovery.md#equivalent-work-accounting` | A table replaces work with data and access cost. Its bytes, padding/alignment, bank/placement, path frequency, and behavior all count. |
| Q-P01..Q-P03 | MOS-6510-1982 “INPUT/OUTPUT PORT REGISTERS”; CSG-6567-318014 internal sheets 2–5 and 14–16; CBM-C64-PRG-1982 printed pages 101–104 (`$DD00/$DD02`, VIC bank, `$D018`, screen/character bases), 311 (`$0000/$0001` and memory map), and 320 (I/O assignments); VIC-BAUER-2024 §§2.2 and 2.4.1–2.4.3 | CPU mapping, physical RAM, and VIC visibility are distinct. `$0000/$0001`, CIA2 bank bits, VIC base alignment, and interrupt ownership must be explicit; placement/pointer changes are preferred over runtime copying when equivalent. |
| Q-P04..Q-P06 | CSG-6567-318014 internal sheets 10–16; VIC-BAUER-2024 §§2.4.3, 3.5–3.8; NINE-AKESSON sprite/timing sections; CBM-C64-PRG-1982 graphics/VIC appendices | Raster capacity depends on video standard, path, badlines, and sprite DMA. Nominal CPU cycles or an average frame are insufficient. |
| Q-P07 | CBM-C64-PRG-1982 printed pages 308/311; CBM-C64-KERNAL-03 `irqfile::PULS/PULS1` and `editor.2::KPREND`; MOS-PGM-1976 Chapter 9 | The selected 901227-03 KERNAL path saves A/X/Y before `CINV` and provides a matching restore/`RTI` exit; a raw hardware-vector handler owns its own save/restore/`RTI`. The implementation must match the declared ROM/banking path and must not double-push blindly. |
| Q-P08 | CSG-6567-318014 internal sheet 11 (interrupt register); CBM-C64-PRG-1982 printed page 151 “Interrupt Status Register” and Appendix G printed page 391; VIC-BAUER-2024 §§3.2/3.12 | `$D019` acknowledgement writes one to selected latched bits. This volatile, register-specific access count/order is semantic; a generic memory RMW is not presumed equivalent. |
| Q-P09, Q-P10 | MOS-6526-1981 printed pages 1–2 (ports/DDRs), page 6 (ICR), and page 8 (register map); CBM-C64-PRG-1982 printed pages 101–102 and 320 | CIA ICR reads acknowledge pending sources while writes set/clear mask bits according to bit 7; CIA1 input and CIA2 VIC-bank/serial ownership must not be conflated. |
| Q-P11 | MOS-6581-SID register/programming sections; GOATTRACKER-R172 `player.s::mt_init`, `::mt_playsfx`, `::mt_play`, `::mt_chntempo`, and SID-write block; LIBSIDPLAYFP-3.1.1 `residfp-emu.cpp::reSIDfpEmu::{write,clock,model}` | A player contract owns cadence, registers/voices, tables, IRQ/mainline interaction, and SFX arbitration. 6581/8580 model differences bound expectations; register traces do not prove universal analogue sound. |
| Q-P12 | CBM-C64-PRG-1982 VIC base-pointer/memory rules; VIC-BAUER-2024 §§2.4.2 and 3.2 | Independent evolving buffers are distinct storage. For visibility changes, aligned placement and base/pointer flips avoid runtime copies; any extra compile-time replica needs a named consumer, constraint, size, and measured benefit. |
| Q-P13, Q-P21 | VIC-BAUER-2024 §§3.8/3.12; NINE-AKESSON sprite/timing sections; HESSIAN-1.2 `actor.s::DrawActors` and `sprite.s::GetAndStoreSprite`; C64-GAMEFRAME-C634F6F `actor.s::DrawActors` and `sprite.s::DrawLogicalSprite` | Multiplexing spans raster schedule, sorted data, register updates, IRQ ownership, frame/scratch interference, and API/lowering proof. Describing the trick or relying on runtime skill prose is not implementation. |
| Q-P14 | CBM-C64-PRG-1982 VIC register table; MOS-PGM-1976 `LDA`/`STA` entries | A constant named border-color wrapper must fold to the same direct store sequence and effects an expert would use; hidden call, temporary, or read traffic violates zero-cost intent. |
| Q-P15 | INTEGRATOR-LEVY lines 124–136; INTEGRATOR-DIFRAIA-2012 lines 279–313; CBM-C64-PRG-1982 graphics/memory facts | Testimony supports elements/panels, masks, attributes, priority, reuse, and memory/speed tradeoffs; reconstruction supports concrete editor stages but retains explicit unknowns. Compiler/toolchain ownership, emitted layout, loader contract, zero-cost renderer, and artifact/runtime proof are new synthesis, not attributed history. |
| Q-P16 | HESSIAN-1.2 `actor.s::UpdateActors` and target/collision-list paths; C64-GAMEFRAME-C634F6F `actor.s::UpdateActors` and collision bounds/search paths; MOS-PGM-1976 Chapter 6 and Appendices B–C | SoA/AoS, pools, collision phases, and dispatch are selected from the fixed workload and SFA/IRQ consequences. No source establishes one universally best layout. |
| Q-P17 | MOS-PGM-1976 path-specific cycle data; VIC-BAUER-2024 §§3.5–3.8 and 3.12 | A stable raster region needs a declared worst-case local cycle contract and proof across every control/call path; source shape or average cycles cannot establish stability. |
| Q-P18 | VSP-AKESSON risk/safety sections; VIC-BAUER-2024 §3.14; VICE-310-SOURCE only for configured-emulator behavior | VSP/AGSP is never enabled by default. An opt-in must state silicon/board/video assumptions, compare safer alternatives, and require targeted physical QA; VICE cannot prove universal safety. |
| Q-P19 | VIC-BAUER-2024 §3.14; FRAGILITY-AKESSON named technique/timing sections | FLI/FLD/line-crunch/border/sprite-crunch requires explicit timing, banking, layout, and ownership. A named API/template/local contract may expose intent; a generic peephole must not guess it from arbitrary stores. |
| Q-P20 | HESSIAN-1.2 `actor.s::{DrawActors,InterpolateActors}`, `sprite.s::GetAndStoreSprite`, and `level.s::ChangeLevel`; C64-GAMEFRAME-C634F6F `actor.s::{DrawActors,UpdateActors}`, `sprite.s::DrawLogicalSprite`, and `level.s::ChangeLevel`; CBM-C64-PRG-1982 printed pages 101–104/311 | Choose pointer flip, placement/justified replication, pre-shift, dirty update, unroll, or copy only against the actual frame and memory budgets with equivalent-work accounting. These implementations are workload evidence, not a universal winner. |
| Q-A01, Q-A03 | ACME-097-R266 `docs/AddrModes.txt` lines 7–45/94–172 and `src/mnemo.c::calc_arg_size` | ACME resolves automatic versus forced operand width from values/symbol state according to these rules. A future proof must inspect actual bytes and values; source mnemonic appearance is insufficient. |
| Q-A02 | ACME-097-R266 `docs/QuickRef.txt` lines 302–360 and `src/alu.c` lines 102–149/653–667 plus 1146–1164 | Parenthesize ambiguous low/high-byte expressions according to the pinned precedence/associativity rules; a future proof fixes the exact expression and expected value. |
| Q-A04 | ACME-097-R266 `docs/AddrModes.txt` relative-mode rules and `src/mnemo.c::near_branch` | An out-of-range relative branch is not a valid serialized artifact; the compiler repairs it before serialization or the assembler reports the exact failure in a future proof. |
| Q-A05 | ACME-097-R266 `docs/AllPOs.txt` lines 279–289 and `src/output.c::Output_save_file`/`OUTPUT_FORMAT_CBM`; CBM-C64-PRG-1982 printed pages 308/311 for load/startup context | ACME's CBM output carries the little-endian two-byte load address. A future proof separately checks header, origin, body, symbols, and startup contract. |
| Q-A06 (**project-policy oracle**) | Frozen five-status/evidence policy; VICE-310-MANUAL and VICE-310-SOURCE are permitted raw tool evidence for the isolated case | Absence or skip yields `Unknown` runtime status, never pass. This reporting invariant does not depend on executing or trusting VICE. |
| Q-A09 (**project-policy oracle**) | Frozen five-status/target-boundary policy; target declarations and TARGET-X16-R49/TARGET-ATARI8-HW are permitted raw context | A registry entry that delegates incompatible C64 startup/output is `Scaffold/stub`; `Verified partial` is limited to an exact non-delegated boundary with its own proof. No future target becomes supported from a declaration. |
| Q-R06 (**project-policy oracle**) | `evidence-parity-and-recovery.md#non-negotiable-direction-of-authority` and `#evidence-boundary-rules`; the manufacturer excerpt, VICE-310 tagged trace/model, and measurement method are permitted raw evidence | VICE settles only the configured automated-model observation. A silicon-sensitive disagreement remains revision-bounded and requests targeted physical QA rather than averaging sources. |

## Conflict and Limitation Register

| ID | Evidence issue | Resolution for this baseline | Downstream effect |
|---|---|---|---|
| SRC-001 | ACME's commonly found GitHub mirror is older than release 0.97. | ACME-097-R266 official SourceForge revision 266 is the sole 0.97 authority. | Do not cite mirror HEAD for Q-A01..Q-A05 or Q-R12. |
| SRC-002 | VICE accurately defines its configured software model but cannot establish universal silicon behavior. | Record tag, machine/video/chip model, settings, and result; label physical conclusions separately. | Q-R06 and Q-P18 cannot turn a VICE result into a general hardware claim. |
| SRC-003 | Original SID documentation is incomplete and not revision-complete. | Bound register facts; use pinned player/emulator source for model behavior and targeted hardware QA for analogue output. | Q-P11 must separate register proof from audible/revision proof. |
| SRC-004 | Bauer's VIC-II article is empirical and explicitly model-bounded. | Preserve the author's bounds; cross-check documented facts and use exact test/physical evidence for disputed revisions. | Cycle tables are not silently generalized to every VIC/board. |
| SRC-005 | No complete original Integrator source/manual is available in the accepted packet. | Keep first-person statements, reconstruction features, unknown original steps, and new Blend65 synthesis distinct. | Q-P15 may freeze as a design-evaluation oracle, but cannot claim historical details not evidenced. |
| SRC-006 | Future-target documents do not constitute implementation qualification. | Use them only to prevent C64-specific assumptions in shared seams. | Q-A09 can classify delegation; no future target becomes `Verified complete`. |
| SRC-007 | Some archive URLs are mirrors and may move. | Pin document identity/version and record a replacement mirror only after verifying identical content. | URL failure does not change a fact, but blocks new exact citation until identity is rechecked. |
| SRC-008 | `spec/evaluations/F010-signed-types.md` presents a general signed-compare example using `N xor V` after `CMP`, but MOS-PGM-1976 §4.2.1 shows that `CMP` does not set V. | Preserve the normative Blend65 signed-order semantics, reject the defective lowering example, and trace the conflict in the Phase 3 semantic crosswalk. Hardware instruction effects cannot be changed by an evaluation example. | Q-C01/Q-C02 must never accept stale V; later architecture work must own a correct lowering family and an independent behavior oracle. |
| SRC-009 | `spec/04-expressions-operators.md:115-116` says a shift by at least the width is always zero and that signed right shift sign-extends; `spec/02-type-system.md:429-446` also requires sign extension. | No semantic choice is made in skill construction. Record SC-005, block Q-C13, and require a product ruling plus reconciled spec commit before qualification. | The unaffected CPU shift effects remain usable; only the conflicting wide signed-right-shift result is blocked. |
| SRC-010 | `spec/05-statements-control-flow.md:215-255,309-327` defines inclusive `to` and full-byte `0 to 255`; `spec/evaluations/F008-for-loop.md:244-258` defines exclusive `to` and allows `0 to 256`. | The product ruling selects inclusive `to`: `0 to 255` executes 256 iterations and `0 to 256` is out of range. Keep SC-006 and Q-C19 blocked until a separately authorized spec commit reconciles F008. | The hardware wrap idiom and product intent are factual; the Blend65 source-form oracle cannot freeze while the specification still contradicts itself. |
| SRC-011 | The available CSG 6567 manufacturer document is a preliminary, NTSC-centered 19-page scan from a 22-sheet drawing, not a complete VIC-II revision history. | Use CSG-6567-318014 for its documented register/effect and bus baseline only; use revision-bounded research/tests for later PAL/NTSC timing and physical-silicon claims. | VIC-dependent oracles retain explicit variant and physical-QA boundaries; the preliminary sheet cannot universalize Bauer/VICE observations. |

No material conflict remains unresolved for the bounded Phase 2 external invariants eligible to
freeze. SRC-009/SC-005 and SRC-010/SC-006 are explicitly excluded and blocked; no result is frozen
for those fields. A later source that materially contradicts a frozen invariant reopens only the
affected authority gate and its dependent knowledge/results; it never permits silent editing of a
frozen oracle.
