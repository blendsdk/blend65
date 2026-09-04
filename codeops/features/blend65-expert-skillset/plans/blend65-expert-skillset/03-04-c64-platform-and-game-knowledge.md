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
| Memory pressure | Placement over copying, data visible where the consumer reads it, no unaccounted/default duplication, evidence-gated static replication, static-frame and ZP budgets |

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

### Game Technique Casebook

This is not a list of folklore. Each technique is a structured design case that a later compiler
audit/redesign can translate into durable implementation. Every entry contains:

1. the game problem and measurable constraint it solves;
2. recognizable source, semantic, IL, layout, target-profile, and whole-program facts;
3. PAL/NTSC, chip-revision, memory-map, ROM/IRQ-ownership, and writable-code assumptions;
4. one or more expert hand-written implementations and equivalent-work obligations;
5. one primary compiler disposition: automatic, cost-guided, zero-cost API/specialized lowering,
   explicit local contract, or diagnostic/no transformation;
6. facts the IL, SFA/ABI, layout, platform API, emitter, and artifact stages must preserve;
7. complete cycle, code, data, ZP, alignment, frame, setup, and steady-state costs;
8. hazards, invalid contexts, and a counterexample where the tempting form is worse or wrong;
9. independent behavior evidence plus the intended assembly/cost expectation;
10. VICE model/probe and targeted physical-hardware QA boundary; and
11. source-manifest and qualification-case keys.

The required families are:

| Family | Minimum techniques and compiler questions |
|---|---|
| CPU/code shaping | Fixed-trip unrolling, branch/fall-through and page alignment, ZP promotion, lookup/addition-chain choices, pre-shifted/precomputed data, computed dispatch, self-modifying operands, and explicitly selected undocumented opcodes |
| Raster scheduling | Stable raster entry, double IRQ and IRQ chains, badline/sprite-DMA budgets, mode splits, invariant cycle paths, overrun/late handling, and PAL/NTSC adaptation |
| Sprites | Multiplexer sorting/scheduling, shared VIC bit-register updates, pointer/data placement, pre-shifted masks/data, and mainline/IRQ ownership |
| Scrolling/rendering | Fine/coarse scroll, double buffering and pointer flips, dirty regions, Color RAM updates, charset/tile/bitmap arrangements, and decompression/update windows |
| Aggressive VIC use | FLI, FLD, line crunch, VSP/AGSP, border opening, and sprite crunch, each explicitly risk-, revision-, and ownership-bounded rather than enabled generically |
| Audio | SID-player cadence, raster/main IRQ placement, music/SFX voice sharing, ADSR handling, table layout, and 6581/8580 consequences |
| Loading/assets | Loader coexistence, overlays, streaming, decompression windows, placement/alignment, compile-time conversion, and justified code/data reuse |
| Engine structures | Fixed pools, SoA/AoS, collision broad/narrow phases, state dispatch, function-pointer consequences, and deterministic update ordering |

### Compiler Disposition Policy

| Disposition | Policy |
|---|---|
| Automatic | Apply only when semantics, observable hardware behavior, legality, and benefit are provable without a new user promise. |
| Cost-guided | Compare complete costs under an explicit optimization goal and actual call/frequency/layout facts; do not select from instruction count alone. |
| Zero-cost API/specialized lowering | Express hardware or subsystem intent with named modern constructs that lower to the same obligations as expert assembly. Runtime templates are permitted only when they are the smallest shared implementation and all costs are visible. |
| Explicit local contract | Use for cycle-exact regions, writable-code/self-modifying sequences, IRQ ownership, deliberate silicon/revision risk, or other facts that cannot safely be inferred. Validate the contract and keep its scope narrow. |
| Diagnostic/no transformation | Preserve general code or explain why a requested technique cannot be made safe. Never guess a timing, banking, alias, ownership, or silicon fact. |

Target-wide configuration is reserved for facts that truly govern the entire binary, such as CPU,
video model, declared chip compatibility, memory/cartridge map, and ROM/IRQ ownership policy. A
local raster kernel or self-modifying routine does not justify a global “fast game” flag. Safe
optimizations remain automatic; dangerous tricks never become accidental defaults.

### Knowledge-to-Compiler Proof Chain

For each technique, the later recovery journey must trace:

```text
source intent + target facts
    → preserved semantic/IL facts
    → selected compiler/API disposition
    → deterministic algorithm, table, lowering, layout, or diagnostic
    → independent behavior proof
    → assembled bytes/cycles/resources compared with expert equivalent work
    → VICE and targeted hardware evidence where the technique depends on the machine
```

The skill may propose the mechanism and judge the implementation, but the released compiler may
not consult natural-language guidance or an AI model. If an expert trick cannot be inferred safely,
the correct result is an explicit modern API/contract or a clear diagnostic—not fragile loop-shape
pattern matching.

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
selection, pointer flips, and compile-time transformations over runtime copying. Never copy or
duplicate data merely for compiler convenience. Replicating identical data is allowed only at
compile time when hardware visibility or a measured timing requirement makes it the best expert
result, placement/banking/pointer changes cannot meet the same need, and the exact consumer,
visibility constraint, byte cost, and timing/access benefit are recorded. Hot paths do not copy
when compile-time placement or replication can solve the problem. Buffers that hold different
evolving states are distinct storage, not duplicated data.

### Game Feasibility

When the user explicitly asks whether a program or game design is feasible, decompose the live
question into:

1. expressible source architecture;
2. correct compiler/runtime behavior;
3. required platform APIs/assets;
4. RAM/ZP/stack/code/data budget;
5. worst-case and frame-path cycle budget under video DMA;
6. assembly parity of hot systems; and
7. verification on the declared model.

No existing game-feasibility matrix or generated page is input, authority, required coverage, or
acceptance evidence for this reasoning. That repository snapshot is naive, time-stamped, optional,
and removable. An inexpressible capability is an infinite parity failure and belongs in the
expressiveness ledger; a compiling but slower-than-expert path remains a defect.

### VICE and Physical-Hardware Boundary

VICE 3.10 `x64sc` is the normal development, regression, and automated runtime oracle for a fixed
model/configuration. Primary documentation governs stated hardware semantics. Targeted
real-hardware QA is required near release when the conclusion depends on raster/badline timing,
CIA edge behavior, SID analog or revision behavior, undocumented/silicon-sensitive opcodes,
cartridge or expansion behavior, unusual banking, or a documentation-versus-emulator conflict.
Until that physical check is completed, label the conclusion
`VICE-verified / hardware-unverified`; do not generalize one emulator result to all C64 revisions.

## Cross-Module Cases

Mandatory cases combine memory, hardware, game, CPU, and compiler knowledge:

- switching a charset/screen by pointer/register changes versus copying the data;
- raster IRQ code under PAL and NTSC with badline and sprite-DMA costs;
- sprite multiplexer storage and interrupt-safe SFA scratch;
- a sprite multiplexer whose source API, scheduling representation, lowering/layout ownership,
  full cost, and timing proof are traced end to end;
- volatile VIC IRQ acknowledgement where a generic RMW rewrite is unsafe;
- KERNAL-vector versus raw-vector handler ABI;
- SID driver scheduling with revision assumptions;
- CIA joystick/keyboard scanning without clobbering VIC bank selection; and
- a zero-cost modern wrapper whose emitted accesses are compared to hand assembly;
- a fixed-trip hot loop where unrolling competes with code size, alignment, and branch/page layout
  effects rather than winning by slogan;
- self-modifying operand specialization that is accepted only with writable-code, ownership,
  reentrancy, IRQ-safety, and measured-benefit proof;
- an advanced VIC technique that is exposed through an explicit risk/revision contract and never
  selected from arbitrary source shape; and
- a scrolling/rendering decision among pointer flips, compile-time placement/replication, dirty
  updates, and copying using actual frame and memory budgets.

## Evidence Baseline

The source manifest pins the Commodore 64 Programmer's Reference Guide, original Commodore service
or schematic material, original chip documentation where available, revision-specific empirical
evidence for known documentation gaps, original practitioner articles/source for game idioms, real
game/demo implementations, VICE hardware-test programs, and relevant SID-player/emulation
references. Practitioner evidence may establish that an idiom is real and show its implementation;
hardware-semantic claims are cross-checked against stronger hardware evidence where obtainable.

## Failure Conditions

This component fails if PAL/NTSC is ignored where timing differs, CPU and VIC memory views are
collapsed, chip side effects are treated as ordinary RAM, data is copied or replicated without the
required necessity and cost evidence, wrapper cost is not inspected, KERNAL/raw interrupt ABIs are
mixed, a game feasibility claim lacks resource/timing/expressibility evidence, or future C64U
features are presented as qualified C64 behavior. It also fails if techniques remain lore without
recognizable facts, a compiler disposition, safety bounds, costs, and proof, or if a risky trick is
enabled by a broad global optimization flag.
