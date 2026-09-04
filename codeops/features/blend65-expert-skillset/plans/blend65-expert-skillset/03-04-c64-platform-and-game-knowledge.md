# Component Specification: C64 Platform and Game Knowledge

> **Document**: 03-04-c64-platform-and-game-knowledge.md
> **Parent**: [Index](00-index.md)
> **Owns**: `c64-memory-and-runtime.md`, `c64-hardware.md`, `c64-game-engineering.md`

## Objective

Equip the skill to judge compiler and platform-library decisions as an expert C64 game developer,
while keeping hardware lore out of ordinary Blend65 source. The modules cover only platform facts
that change language expressibility, semantics, allocation, lowering, APIs, artifacts, timing, or
verification. Board repair and unrelated peripheral encyclopedias remain out of scope.

## Variant Context

Every material C64 answer fixes or declares unknown:

- PAL versus NTSC video/clock model;
- VIC-II family/revision when raster/bus behavior differs;
- SID 6581 versus 8580 when register/audio behavior or tuning differs;
- CIA revision/behavior where timer/interrupt details matter;
- memory configuration at `$0000/$0001`, cartridge lines when relevant, and CPU versus VIC view;
- KERNAL/BASIC/character ROM ownership and interrupt chain choice;
- startup/loader/container assumptions; and
- VICE model/options or physical hardware evidence used.

The knowledge must explain the consequence of leaving a variant unspecified instead of inserting
one convenient default silently.

## `c64-memory-and-runtime.md`

### Required Coverage

| Concern | Facts and compiler/API consequences |
|---|---|
| CPU address view | RAM/ROM/I/O visibility, `$0000/$0001` DDR/data port, LORAM/HIRAM/CHAREN combinations, RAM-under-ROM/I/O, safe transition rules |
| VIC address view | CIA2 bank selection, 16 KiB VIC banks, screen/charset/bitmap/sprite-pointer visibility, character-ROM windows, alignment/granularity |
| Zero page/page one | KERNAL/BASIC reservations, user/ABI/scratch allocation policy, hardware stack and interrupt headroom |
| Program placement | BASIC stub/load address, code/data/BSS/static frames, reserved ranges, overlays, cartridge/expansion interaction boundaries |
| Startup | PRG load versus initialized RAM, banking and interrupt state, data initialization, main return/nonreturn, cleanup/restore obligations |
| Runtime ownership | KERNAL calls/vectors, ROM bank requirements, zero-page clobbers, IRQ chain versus raw vectors, coexistence versus takeover |
| Artifacts/loading | Two-byte PRG load header, load address/origin agreement, labels/symbols, disk/tape/fastloader boundaries |
| Memory pressure | Placement over copying, data visible where consumer reads it, no duplicate RAM assets, static frame and ZP budgets |

### Banking Rules

The module must distinguish logical address from currently visible storage and from VIC-visible
data. A recommendation records who performs the access, which bank/configuration is active, whether
an interrupt can observe the transition, and how state is restored. Optimizations cannot move or
fold accesses across bank changes as though they were ordinary memory.

### Startup/Interrupt Patterns

Cover cooperative KERNAL use, KERNAL-vector chaining, raw hardware vectors with ROM banked out,
NMI/RESTORE implications, interrupt acknowledgement/ordering, register/decimal/banking
preservation, and what may safely return. The skill must detect an ABI mismatch such as using a raw
RTI handler behind a KERNAL wrapper that pushed additional registers.

## `c64-hardware.md`

### VIC-II

| Topic | Required decision knowledge |
|---|---|
| Raster model | Lines/cycles by PAL/NTSC model, raster register semantics, IRQ compare/acknowledge, frame budget assumptions |
| Bus contention | Badlines, sprite DMA, CPU stalls, why nominal CPU cycles differ from available scheduled work |
| Display modes | Text, multicolor text, bitmap, multicolor bitmap, ECM; memory layout and legal combinations |
| Memory registers | `$D011`, `$D016`, `$D018`, CIA2 bank control; reserved bits and read/modify/write risks |
| Sprites | Pointer table placement, data alignment, enable/position/expansion/color, X MSBs, priority/collision registers, multiplex timing |
| Scrolling | Fine/coarse scroll, badline interaction, border/open-border techniques only where relevant to compiler/API choices |
| Color RAM | Nibble semantics, CPU access, placement difference from ordinary RAM, copy/update consequences |
| Revision differences | PAL/NTSC and chip-revision behavior only when it affects correctness, timing, or qualification |

### CIA

Cover timer A/B modes and latching, interrupt-control read/write semantics, FLAG/TOD boundaries,
keyboard/joystick ports and direction registers, CIA1 versus CIA2 ownership, VIC bank bits, NMI
sources, and race/acknowledgement implications. Named volatile register APIs must encode masks and
side effects without runtime cost.

### SID

Cover register write-only/readback boundaries, voice registers, waveform/gate/control sequencing,
ADSR behavior relevant to software control, filter/volume, paddle/oscillator/envelope reads when
used, 6581/8580 differences that affect program behavior, and music-driver scheduling. The skill
does not promise analog-audio identity from a simple register trace.

### Volatile Register Contract

Hardware access uses named registers/bitfields at the source API while producing the exact expert
load/store/RMW sequence. The module identifies registers for which read, write, read-modify-write,
or acknowledgement has special behavior. A compiler optimization must preserve access identity,
width, order, and count under every future pass.

## `c64-game-engineering.md`

### System Patterns

| System | Required design and parity questions |
|---|---|
| Main loop | Fixed/variable update model, raster synchronization, input/update/render/audio split, frame overrun behavior |
| Raster scheduling | IRQ chain/table, stable timing boundary, badline/sprite DMA budget, PAL/NTSC adaptation, mainline handoff |
| Sprite engine | Hardware sprite allocation, multiplexing, sorted Y events, pointer/image placement, update bandwidth |
| Scrolling | Tile/character map representation, fine/coarse update, screen/charset double buffering, copy volume and timing |
| Graphics | Charset/bitmap asset placement, screen switching, color updates, dirty regions, decompression/stream boundaries |
| Audio | SID driver cadence, IRQ ownership, per-frame budget, tables/instruments, 6581/8580 policy |
| Input | Keyboard matrix, joystick active-low semantics, debounce/repeat, CIA sharing and interrupt-safe access |
| Entities/collision | SoA/AoS based on hot access, fixed-size pools, broad/narrow phases, arithmetic widths, deterministic updates |
| State machines | Compact dispatch, function-pointer/indirect-call implications for SFA, data-driven alternatives |
| Load/stream | Disk/tape/fastloader integration boundary, memory windows, IRQ coexistence, decompression destination placement |
| Assets | Compile-time conversion/embed boundary, alignment, bank/visibility, no runtime recreation of link-time facts |

### Zero-Cost API Standard

A platform API is acceptable when a modern programmer can express intent using named types,
registers, masks, and domain operations while emitted code is equal to the expert hand-written
sequence after the same obligations. The module must distinguish:

- constant wrapper that folds to direct writes;
- type-safe bitfield/mask abstraction with no extra traffic;
- compile-time placement/alignment declaration;
- operation requiring a deliberate safe sequence; and
- convenience wrapper that adds hidden calls, copies, temporary materialization, or volatile
  accesses and therefore fails the bar.

### Data Placement Doctrine

Data lives where the hardware or hot loop reads it. Prefer symbolic placement, alignment, bank
selection, pointer flips, and compile-time transformations over runtime copying. Duplication is
allowed only when the measured access/timing tradeoff and memory cost justify it; “simpler
lowering” is not a justification.

### Game Feasibility

Feasibility is decomposed into:

1. expressible source architecture;
2. correct compiler/runtime behavior;
3. required platform APIs/assets;
4. RAM/ZP/stack/code/data budget;
5. worst-case and frame-path cycle budget under video DMA;
6. assembly parity of hot systems; and
7. verification on the declared model.

A game-row score is not proof by itself. An inexpressible capability is an infinite parity failure
and belongs in the expressiveness ledger; a compiling but slower-than-expert path remains a defect.

## Cross-Module Cases

Mandatory cases combine memory, hardware, game, CPU, and compiler knowledge:

- switching a charset/screen by pointer/register changes versus copying the data;
- raster IRQ code under PAL and NTSC with badline and sprite-DMA costs;
- sprite multiplexer storage and interrupt-safe SFA scratch;
- volatile VIC IRQ acknowledgement where a generic RMW rewrite is unsafe;
- KERNAL-vector versus raw-vector handler ABI;
- SID driver scheduling with revision assumptions;
- CIA joystick/keyboard scanning without clobbering VIC bank selection; and
- a zero-cost modern wrapper whose emitted accesses are compared to hand assembly.

## Evidence Baseline

The source manifest pins the Commodore 64 Programmer's Reference Guide, original Commodore service
or schematic material, original chip documentation where available, and revision-specific
empirical evidence for known documentation gaps. Community references can identify a dispute or
idiom but must be corroborated before becoming release guidance.

## Failure Conditions

This component fails if PAL/NTSC is ignored where timing differs, CPU and VIC memory views are
collapsed, chip side effects are treated as ordinary RAM, wrapper cost is not inspected, KERNAL/raw
interrupt ABIs are mixed, a game feasibility claim lacks resource/timing/expressibility evidence,
or future C64U features are presented as qualified C64 behavior.
