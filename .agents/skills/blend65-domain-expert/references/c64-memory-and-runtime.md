# C64 Memory, Startup, and Runtime Ownership

Use this reference when a Blend65 decision depends on the C64 address map, `$0000/$0001`
banking, VIC-visible placement, startup, KERNAL coexistence, interrupt entry, loading, or resource
ownership. Read `c64-hardware.md` for device semantics and `c64-game-engineering.md` for frame and
game-system design.

This module targets a stock C64 with an NMOS 6510. Cartridge and expansion modes are not silently
included: a target profile must add their PLA, vector, and artifact contracts explicitly.

## Decision packet

Before giving a placement or runtime answer, establish these facts or mark them unknown:

| Fact | Why it changes the answer |
|---|---|
| PAL/NTSC and VIC-II family | Frame timing and some silicon-sensitive behavior differ. |
| KERNAL ROM identity | KERNAL entry, save/restore, vector, and tail-address claims are revision-specific. |
| CPU port state and ownership | `$0001` changes which storage the CPU reads and whether I/O is reachable. |
| CIA2 port-A direction/value | Its low two output bits select the VIC's 16 KiB bank and also share a physical port. |
| CPU versus VIC consumer | The two bus masters can observe different storage at the same logical address. |
| startup/container | A PRG loaded by KERNAL, cartridge reset, monitor injection, and resident loader establish different state. |
| interrupt sink and enabled sources | KERNAL-chain, KERNAL-exclusive, and raw hardware entry require different ABIs. |
| loader/overlay plan | Load windows, code visibility, decompression destinations, and IRQ coexistence must not overlap accidentally. |

Never substitute “normal C64” for a missing fact in a correctness or cycle claim.

## CPU, VIC, and physical memory views

Keep these concepts separate throughout semantic IR, layout, lowering, and verification:

1. **Logical address**: the 16-bit number used by the 6510 or represented by a source pointer.
2. **Physical storage/device selected for a CPU access**: RAM, ROM, I/O, cartridge, or open-bus
   behavior selected by CPU port, cartridge lines, read/write direction, and the PLA.
3. **Storage selected for a VIC fetch**: one of four 16 KiB VIC banks, with character-ROM windows
   in two banks and internal VIC addressing rules.

An optimizer must preserve the consumer, configuration, access direction, volatility, and order.
Two equal numeric addresses are not enough to prove aliasing; two different visible selections do
not prove that the underlying RAM bytes are different. [MOS-6510-1982, INPUT/OUTPUT PORT
REGISTERS; CBM-C64-PRG-1982, printed pp.101–104 and 311; VIC-BAUER-2024, §§2.2 and
2.4.1–2.4.3]

## CPU address view

### Baseline map

| Range | Baseline role | Compiler/layout consequence |
|---|---|---|
| `$0000` | 6510 on-chip port data-direction register | Never allocate as RAM. It controls which `$0001` bits drive pins. |
| `$0001` | 6510 on-chip port data register | Volatile machine configuration, not a general byte. Preserve unrelated driven bits and ownership. |
| `$0002–$00FF` | Zero page | Scarce target resource. Allocate only through the global ZP budget and coexistence profile. |
| `$0100–$01FF` | Hardware stack page | Reserve measured `JSR`/interrupt/explicit-save peak and guard bytes; never place general SFA homes here. |
| `$0200–$9FFF` | RAM in the no-cartridge baseline, with system work areas inside it | Placement is profile-dependent; KERNAL/BASIC coexistence reserves their live work areas. |
| `$A000–$BFFF` | BASIC ROM or underlying RAM | RAM use requires an access/banking contract; ROM visibility does not erase physical RAM. |
| `$C000–$CFFF` | RAM | Common code/data region, but not magically free of loader or application ownership. |
| `$D000–$DFFF` | I/O, character ROM, or underlying RAM | Access direction and port state are part of semantics. I/O writes are not RAM-under-I/O writes. |
| `$E000–$FFFF` | KERNAL ROM or underlying RAM | RAM use and raw vectors require a profile-controlled banking/interrupt contract. |

The broad map comes from [CBM-C64-PRG-1982, printed pp.311 and 320]. A concrete profile must
replace “system work areas” with exact reservations rather than assuming every RAM-looking byte is
available.

### The `$0000/$0001` selection rules

Port bits 0–2 are `LORAM`, `HIRAM`, and `CHAREN`. Their effective pin levels, not merely the last
stored data byte, drive the PLA. The normal target profile drives them as outputs and records both
DDR and data values. Preserve bits 3–5 unless the profile owns cassette-related lines as well.

| Condition | `$A000–$BFFF` CPU read/write | `$D000–$DFFF` CPU read/write | `$E000–$FFFF` CPU read/write |
|---|---|---|---|
| `LORAM=1, HIRAM=1` | BASIC ROM / underlying RAM | I/O read and device write when `CHAREN=1`; character ROM read and underlying-RAM write when `CHAREN=0` | KERNAL ROM / underlying RAM |
| `LORAM=0, HIRAM=1` | RAM | I/O read and device write when `CHAREN=1`; character ROM read and underlying-RAM write when `CHAREN=0` | KERNAL ROM / underlying RAM |
| `HIRAM=0, LORAM=1` | RAM | I/O read and device write when `CHAREN=1`; character ROM read and underlying-RAM write when `CHAREN=0` | RAM |
| `HIRAM=0, LORAM=0` | RAM | RAM read/write; `CHAREN` does not expose I/O/character ROM | RAM |

ROM-selected writes in the BASIC, character, and KERNAL ranges reach underlying RAM because ROM
does not own the write. I/O selection is the important exception: a `$D000–$DFFF` write goes to
the decoded device or expansion-I/O target, not to RAM. To modify RAM under I/O, select RAM; to
modify RAM while character ROM is selected, a write alone is sufficient, although a verification
read still needs RAM selected. This read/write distinction is the stock no-cartridge C64 profile,
not a rule for cartridge/Ultimax or future target profiles. `$0001` changes the CPU/PLA selection;
it does not change which bank or character-ROM window the VIC fetches. [MOS-6510-1982, port truth
table; CBM-C64-PRG-1982, printed pp.261–265 memory-configuration tables and the “RAM under ROM”
write note]

### Safe banking transaction

A compiler or zero-cost platform API may expose a scoped banking operation only when it can lower
to this explicit contract:

1. identify the CPU accesses inside the region and the required target selection;
2. determine whether any IRQ or NMI can run and observe `$0001` or the temporarily exposed device;
3. preserve the incoming CPU interrupt-disable state and every owned device mask; either mask the
   relevant source for the shortest bounded region or use an interrupt protocol whose handler is
   valid in both configurations;
4. preserve `$0000` as its DDR value and `$0001` through an owned output-latch shadow (or another
   profile-proven exact latch model); never reconstruct the output latch from a pin-mixed port read;
   alter only owned bits, perform exact accesses, and restore DDR, latch, CPU `I`, and device masks
   on every exit;
5. preserve volatile access order and do not move ordinary memory operations across the banking
   boundary unless their physical target is proved unchanged; and
6. charge save/restore bytes, cycles, stack/SFA scratch, and interrupt latency.

NMI is not masked by `SEI`. CIA mask state is not recovered by reading ICR, and reading ICR also
acknowledges pending sources. If prior pending/mask state cannot be preserved without changing
observable device behavior, temporary masking is not a valid implementation: keep a dual-valid
handler or reject the scope. A scope that banks out the KERNAL while RESTORE or CIA2 NMI remains
possible must provide a valid NMI path or disable/own the source through a separately proven
hardware contract. A source-level lexical scope is not proof by itself.

## VIC view and placement

CIA2 port A bits 0–1 provide inverted high VIC address bits when configured as outputs. In the
baseline C64 wiring, the low-bit values select:

| `$DD00 & 3` | VIC bank | CPU-address span |
|---:|---:|---|
| `3` | 0 | `$0000–$3FFF` |
| `2` | 1 | `$4000–$7FFF` |
| `1` | 2 | `$8000–$BFFF` |
| `0` | 3 | `$C000–$FFFF` |

`$DD02` must make those bits outputs. A bank update is a port read/modify/write only when the
profile proves that reading the port and preserving every other bit is correct; otherwise use an
owned shadow byte. CIA2 also serves serial/user-port/NMI roles, so the video bank is one field in a
shared device, not a private graphics register. [CBM-C64-PRG-1982, printed pp.101–102 and 320;
MOS-6526-1981, printed pp.1–2 and 8]

Within the selected bank:

| Consumer object | Placement granularity / selector |
|---|---|
| screen matrix | 1 KiB boundary; `$D018` high nibble selects one of 16 bank-relative slots |
| character set | 2 KiB boundary; `$D018` bits 1–3 select one of eight slots in text modes |
| bitmap | 8 KiB boundary; `$D018` bit 3 selects bank offset `$0000` or `$2000` |
| sprite data | 64-byte block; each sprite pointer is the bank-relative address divided by 64 |
| sprite pointer table | final eight bytes of the active 1 KiB screen matrix |

In VIC banks 0 and 2, the VIC sees character ROM in bank-relative `$1000–$1FFF`; CPU-visible RAM
at those logical addresses does not become VIC-visible glyph data there. The CPU can still write
physical RAM that another configuration or CPU access can see. Layout must therefore prove the
VIC consumer's view, not only the CPU link map. [CBM-C64-PRG-1982, printed pp.101–104;
VIC-BAUER-2024, §§2.4.1–2.4.3]

Placement-derived operations such as `vicScreenField(&screen)`, `vicCharsetField(&chars)`,
`vicBitmapField(&bitmap)`, and `vicSpriteBlock(&sprites)` are compile/link-time calculations. They
must reject misalignment, mixed banks, invisible character-ROM windows, or out-of-bank objects.
They emit constants and direct register writes, not runtime division, address tables, or copies.

## Zero page and page one

### Zero-page ownership

Treat ZP as a globally allocated, target-specific resource with named consumers:

- KERNAL/BASIC work areas retained by the selected coexistence profile;
- compiler ABI pointer pairs and scalar homes;
- helper scratch discovered before final SFA closure;
- IRQ/NMI-domain private homes and explicitly shared state;
- loader, decompressor, audio-player, and user-reserved locations; and
- alignment/adjacency constraints for indirect addressing.

Every candidate reports permanent and peak ZP use. A two-byte pointer is indivisible for allocation
and cannot start at `$FF` when `(zp),Y` or `(zp,X)` needs the high byte. A takeover profile may
reclaim documented KERNAL locations only after proving no surviving ROM call, vector path, loader,
or NMI routine uses them.

### Hardware-stack budget

Page one holds return addresses, CPU interrupt frames, explicit register/status saves, and any
profile/handler pushes. For every execution domain compute the maximum nested path, including an
IRQ interrupted by NMI when allowed. A conservative formula is:

`stackPeak = deepestJSRReturnBytes + interruptFrames + handlerSaves + explicitStackBytes + guard`.

SFA removes general local-variable frames; it does not remove the hardware stack. A full stack
budget must account for the 6510's wrap within page one and fail compilation when the declared
bound is not provable. [MOS-PGM-1976, Chapters 3 and 9; CBM-C64-KERNAL-03, named IRQ paths]

## Startup contracts

### KERNAL-loaded PRG

A `.prg` begins with a two-byte little-endian load address. Those header bytes are container
metadata and are not loaded into the destination. The assembler origin, header, link map, and
loader destination must agree. A conventional BASIC stub at `$0801` is optional product policy,
not part of every machine-language program. [CBM-C64-PRG-1982, machine-language startup and
memory-map sections]

The startup owner must establish, rather than inherit by folklore:

- interrupt masking and enabled VIC/CIA sources;
- stack pointer and stack budget baseline;
- binary decimal state (`CLD`) for ordinary Blend65 arithmetic;
- `$0000/$0001`, CIA2 DDR/port, and ROM/I/O ownership;
- required VIC/CIA/SID register state;
- zero/BSS initialization and any copied initialized-data ranges;
- module-initializer order, then `main`; and
- the exact policy for `main` return.

Initialized bytes already loaded at their final address are not copied again. BSS is cleared only
for ranges whose language contract requires zero initialization. A game normally has a nonreturning
main loop; if `main` may return, the profile must define whether it restores machine state and
returns to a loader/KERNAL caller, warm-starts, or stops. Falling into adjacent code is never a
return policy.

### Coexistence versus takeover

| Mode | What remains owned by ROM/system | Compiler obligations |
|---|---|---|
| cooperative KERNAL | ROM calls, documented vectors/work areas, normally enabled system services | Keep required ROM/I/O mapping at call sites; preserve documented registers/ZP; budget ROM and IRQ costs. |
| KERNAL-vector chain | KERNAL hardware entry/save and its eventual service/restore path | Handler ABI matches CINV entry, acknowledges only owned sources, then chains exactly once. |
| KERNAL-exclusive | Named KERNAL entry/save and revision-pinned restore-only tail, but application owns all enabled sources | Prove ROM revision and `$EA81` tail contract; no source may be left for a skipped KERNAL service. |
| raw takeover | Application owns mapping, hardware vectors, all enabled interrupt sources, and restoration | Provide complete raw entry/save/ack/restore/`RTI`, NMI policy, and RAM-vector visibility. |

Calling a ROM routine while it is banked out is a control-flow defect. Temporarily banking ROM in
may also expose I/O/character ROM differently and may race interrupts; model the complete
transaction.

## Interrupt entry and exit contracts

The 901227-03 KERNAL IRQ entry pushes A, X, and Y, does not clear decimal mode, and dispatches via
the RAM `CINV` vector. Its normal exit reads CIA1 ICR, restores Y/X/A, and executes `RTI`.
[CBM-C64-KERNAL-03, `irqfile::PULS/PULS1` and `editor.2::KPREND`]

| Sink | Entry state seen by Blend65 body | Exit rule | Rejected mismatch |
|---|---|---|---|
| default CINV chain | CPU frame plus KERNAL-saved A/X/Y; interrupted D is still live | preserve interrupted status around a binary-mode body, acknowledge owned device, then jump through the saved prior CINV link exactly once | body pushes A/X/Y again without an explicit reason; direct `RTI`; raw-entry address stored in CINV |
| revision-pinned exclusive CINV | same KERNAL saves | own every enabled source; establish binary body state; finish at the proven `$EA81` restore-only tail | using `$EA81` for an unpinned ROM; leaving CIA1 service enabled but skipped |
| raw `$FFFE/$FFFF` | CPU-pushed PC/status only; D is not cleared by NMOS entry | save declared live registers, establish body D policy, acknowledge every owned source, restore exactly, `RTI` | using a KERNAL restore tail; omitting A/X/Y saves that the handler clobbers |
| 901227-03 `NMINV` chain at `$0318/$0319` | CPU frame plus the ROM `$FE43` `SEI; JMP (NMINV)` stub; no register save and no decimal clear | save status before A/X/Y, establish binary body state, restore A/X/Y then status, and jump through one page-safe saved prior `NMINV` | assuming the IRQ-style CINV save already happened; consuming CIA2 ICR state that the prior handler owns |
| revision-pinned exclusive `NMINV` | same ROM stub with no register save | own or explicitly replace CIA2, RESTORE, cartridge, and any other NMI behavior; save/restore A/X/Y and exit with `RTI` | silently dropping stock RS-232, RESTORE+STOP, or cartridge behavior |
| raw NMI `$FFFA/$FFFB` | independent edge-triggered CPU frame; no ROM stub | keep a valid raw vector visible for every reachable bank state; own all sources/nesting, save/restore A/X/Y, and `RTI` | assuming `SEI` blocks NMI, changing banking before the underlying vector is valid, or sharing unsafe SFA homes with IRQ/mainline |

### Revision-pinned IRQ cost baselines

The following totals are derived from the exact 901227-03 instructions and NMOS timings. They
exclude the interrupted instruction's completion, VIC/CIA bus stalls, device acknowledgement, and
the application body. Branches are assumed not to cross a page. ROM bytes are existing machine
bytes, not output-file bytes.

| Segment / route | Cycles | Output bytes | Peak hardware-stack bytes | Exact boundary |
|---|---:|---:|---:|---|
| CPU accepts IRQ | 7 | 0 | 3 | pushes PC/status and reads `$FFFE/$FFFF` |
| 901227-03 `PULS` to `CINV` | 29 | 0 (16 in ROM) | 6 including CPU frame | saves A/X/Y, tests stacked B, `JMP (CINV)` |
| default-chain Blend65 wrapper | 14 + body | 6 + body | 7 including temporary `PHP` | `PHP; CLD; body/ack; PLP; JMP (savedCINV)`; prior handler cost follows and is not silently called fixed |
| exclusive-CINV Blend65 wrapper plus `$EA81` tail | 27 + body | 4 + body (6-byte tail in ROM) | 6 | `CLD; body/ack; JMP $EA81`; restore-only tail restores Y/X/A and CPU-pushed status through `RTI`; it deliberately skips the preceding CIA1 ICR read |
| raw A/X/Y-preserving wrapper after CPU acceptance | 37 + body | 12 + body | 6 | save A/X/Y; `CLD`; body/ack; restore Y/X/A; `RTI` restores CPU-pushed status |

Thus entry-to-body is 36 cycles through this KERNAL revision. Exclusive completion is 63 cycles
plus body/ack from IRQ acceptance; the generic raw template is 44 cycles plus body/ack. A raw
specialization may omit a save only when final liveness proves that register dead across every
interrupted point. A default chain cannot claim a fixed total until the saved prior handler and
its enabled-source paths are pinned and costed. Only the default-chain wrapper needs `PHP`/`PLP`
to restore the prior handler's entry flags before its jump. Exclusive and raw exits must not add
that redundant pair: their final `RTI` restores the CPU-pushed status, including D and the prior I
state. [CBM-C64-KERNAL-03,
`irqfile::PULS/PULS1` and `editor.2::KPREND`; MOS-PGM-1976, interrupt and instruction timings]

### Revision-pinned NMI contracts and costs

On KERNAL 901227-03 the hardware vector `$FFFA/$FFFB` points to `$FE43`. Hardware NMI acceptance
takes seven cycles, pushes PCH/PCL/status, sets I, and leaves NMOS decimal mode unchanged. The ROM
then executes `SEI; JMP ($0318)`: 7 cycles and 4 existing ROM bytes, with no A/X/Y save. Reset
initializes `NMINV` at `$0318/$0319` to `$FE47`, where the stock handler first saves A/X/Y, disables
the CIA2 interrupt masks, reads `$DD0D` once to capture and clear CIA2 latches, and then follows
source-dependent RS-232, cartridge, or RESTORE+STOP paths before its restore/`RTI` tail. The stock
handler has variable path cost and is never reported as one fixed number. [CBM-C64-KERNAL-03,
`vectors::NMI`, `rs232nmi::NMI/NNMI/NMIRTI/PREND`, and `init::VECTSS`]

The exact compiler-owned portions are:

| NMI route | Compiler sequence around body | Cycles | Output bytes | Peak hardware-stack bytes | Fixed path from CPU acceptance |
|---|---|---:|---:|---:|---|
| `NMINV` chain | `PHP`; save A/X/Y; `CLD`; body/source action; restore Y/X/A; `PLP`; `JMP (savedNMIV)` | 43 + body | 16 + body | 7 | 57 + body to the prior handler; its variable path follows |
| exclusive `NMINV` | save A/X/Y; `CLD`; body/source action; restore Y/X/A; `RTI` | 37 + body | 12 + body | 6 | 51 + body including hardware and the 7-cycle ROM stub |
| raw `$FFFA/$FFFB` | save A/X/Y; `CLD`; body/source action; restore Y/X/A; `RTI` | 37 + body | 12 + body | 6 | 44 + body including hardware acceptance |

The chain pushes status _before_ A/X/Y so it can restore Y/X/A and then execute `PLP` immediately
before the indirect jump. The prior handler therefore sees the entry registers and flags, including
D, rather than flags changed by the restore instructions. The chain also owns a reported two-byte
saved-`NMINV` link whose pointer location cannot end in `$FF` on NMOS. The exclusive and raw routes
must not add `PHP`/`PLP`: their final `RTI` restores the CPU-pushed status. Exclusive/raw
specialization may remove a register save only after proving that register dead across every
possible interrupted point. A chain additionally preserves every register/flag the closed prior
handler may observe; it may elide a save only when both the interrupted program and every reachable
prior-handler path prove that entry value unobservable.

NMI acknowledgement is source-specific. A CIA2 ICR read captures and clears all returned pending
bits, so a simple `NMINV` chain must not read `$DD0D` when the saved stock handler owns CIA2. A
generated composite may read it once and dispatch the saved bitset only when that complete
replacement, its storage, and every path are explicitly selected and costed; it is not an implicit
runtime. An exclusive/raw handler that owns CIA2 reads ICR once, handles every returned bit, and
restores an exact mask from software-owned state if sources continue. RESTORE is an external NMI
input with stock RESTORE+STOP behavior, while cartridges have device-specific NMI acknowledgement;
neither is made safe by writing CIA2. A takeover must define their behavior or prove the source
absent. Because I does not mask NMI, any possible new edge during a handler needs a finite nesting
contract and disjoint SFA/stack capacity; otherwise compilation rejects the sink.

Installing `$0318/$0319` is a two-byte transaction that `SEI` cannot protect. It occurs only in a
profile-proven NMI-quiescent startup window, or through a separately proved update scheme whose
every torn intermediate address is valid. For raw takeover, write the complete RAM vector beneath
KERNAL ROM before clearing the mapping bit that exposes RAM; the ROM and raw routes must each remain
valid on their side of that single mapping change. The chosen bank state must then keep the raw
vector and handler visible at every NMI boundary. A scope that cannot prove this transition keeps
the ROM/NMINV route or fails at compile time.

Future qualification pins the ROM hash and checks `$FFFA/$FFFB → $FE43`, the 4-byte ROM stub,
`$0318/$0319 → $FE47` after reset, entry D/A/X/Y state, exact wrapper bytes/cycles, the expected
CIA2 ICR read count (zero in a simple chain and exactly one in an owning adapter), all simultaneous
source bits, restored status, stack high-water mark, vector-update states, and raw banking in VICE
3.10. RESTORE pulses, cartridge NMI acknowledgement, CIA2 revision behavior, and any re-entry bound
then receive targeted physical-hardware QA. No emulator or hardware result is claimed by this
knowledge baseline.

The default saved-link object is two writable bytes and must be page-safe for any NMOS indirect
jump form, or the lowering must use a form without the `$xxFF` wrap. Each installed handler has one
entry kind; an IRQ callback is not an ordinary callable function. Reusable logic lives in an
`RTS` helper with a separately checked mainline/IRQ concurrency contract.

Banking, decimal mode, registers, flags, and the hardware-stack shape are all observable state.
The handler restores the interrupted state unless its declared exclusive contract says otherwise.
Acknowledgement is device-specific and occurs in the order required to prevent a lost or repeated
interrupt; see `c64-hardware.md`.

## Loaders, overlays, and memory windows

The compiler owns static facts; the chosen loader owns transport. A load/stream contract declares:

| Field | Required proof |
|---|---|
| source artifact | disk/tape/container identity and exact byte range |
| destination | physical RAM range, required CPU mapping, and final consumer visibility |
| lifetime | objects/code that are dead before overwrite and roots that keep a region live |
| execution | no executing code, live return address, vector, SFA home, or stack byte is overwritten |
| interrupts | which IRQ/NMI/audio/raster activity continues, pauses, or is relocated |
| decompression | input/output overlap rule, scratch/ZP, worst-case output length, and failure policy |
| publication | when pointers/state may expose the completed object to mainline or IRQ consumers |
| restoration | banking, device, and loader state restored on every exit |

A loader can use RAM under ROM/I/O or overlays only when its own code and interrupt path remain
visible. Do not turn Spindle, a fastloader, or one game's resident loader into a compulsory
runtime. They are implementations compared against this contract. [SPINDLE-V3, loader/linker/IRQ
sections; HESSIAN-1.2, `loader.s::InitLoader`; C64-GAMEFRAME-C634F6F, `loader.s`]

## Placement and replication doctrine

Default to one physical copy at the consumer's final address. Prefer compile-time layout,
alignment, bank selection, pointer/base flips, and representation conversion over runtime copying.

Identical static data may be replicated only when all of these are recorded:

1. exact consumer and visibility/timing constraint;
2. why one placement, a bank change, a pointer flip, or a loader window cannot meet it;
3. replicated byte count including padding/alignment;
4. setup/load cost and steady-state cycle benefit; and
5. proof that both copies are immutable or receive coherent updates.

Two screen buffers that contain different evolving frames are distinct state, not duplicate data.
A hidden “convenience” copy, implicit offset table, or runtime-transcoded asset is a compiler
defect.

## Resource report

Every C64 build/report should make these quantities inspectable even if the future implementation
chooses a different internal layout:

- CPU-visible segments with physical ranges and mapping requirements;
- VIC bank, bank-relative offsets, alignments, and character-ROM conflicts;
- code, immutable data, mutable globals, BSS, static frames, and helper/player/loader ranges;
- permanent/peak ZP use by owner;
- hardware-stack peak by execution domain;
- all compile-time replicas and derived assets with reason and byte cost;
- overlays/load windows with lifetime proofs; and
- startup/interrupt/ROM ownership plus saved links and writable-code regions.

If the link map cannot prove non-overlap, visibility, or a hard budget, fail before assembly rather
than emit a binary whose success depends on accidental placement.

## Future proof specifications

This skill phase does not run the machine. Each later executable claim must bind VICE 3.10
`x64sc`, exact model/video/SID/CIA settings, ROM identities, command line or monitor method, program
hash, initial port/device state, and observed bytes/accesses. Required cases include:

| Case | Observable expectation | Physical QA boundary |
|---|---|---|
| CPU RAM under I/O, VIC display fetch | CPU write reaches underlying RAM only under the declared mapping; VIC fetch shows the placed bytes from its selected bank | unusual banking/board/cartridge combinations |
| scoped `$0001` change with IRQ pressure | no handler observes an invalid mapping; every exit restores exact `$0000` DDR, `$0001` latch shadow, incoming CPU `I`, device masks, and the declared pending-source behavior | NMI/RESTORE and exact interrupt-edge behavior |
| VIC-bank/base placement | link addresses derive exact CIA2/`$D018`/sprite-pointer values without copying | normal documented behavior needs only targeted release smoke; anomalies go to hardware |
| each interrupt sink | exact stack bytes, register/D restoration, acknowledgement count/order, chain/tail/`RTI` destination | KERNAL revision and raw-vector/RESTORE behavior |
| overlay/load window | loaded/decompressed bytes, no live-region overwrite, correct publication point | real drive/fastloader/electrical timing and cartridge interaction |

Until a physical check settles a silicon- or board-sensitive conclusion, report
`VICE-verified / hardware-unverified`; never broaden it to every C64.

## Decision checklist

- Did the answer separate logical address, CPU-selected storage, and VIC-selected storage?
- Are `$0000/$0001` and `$DD00/$DD02` values, ownership, and interrupt exposure explicit?
- Is data placed where its consumer reads it, with every copy or replica justified and costed?
- Are ZP, stack, SFA, loader, player, and system reservations all in one conflict-free map?
- Does startup establish every relied-on state and define `main` return?
- Does the handler entry kind match its save/restore/chain/`RTI` exit?
- Are future VICE observables and targeted hardware bounds stated without claiming execution now?
