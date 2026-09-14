# C64 Game Engineering and Compiler Realization

> **Baseline version**: `2.0.0`

Use this reference to translate a C64 game requirement or expert technique into modern Blend65
source, deterministic compiler/platform behavior, expert-quality assembly, explicit resource cost,
and independent proof. Read `c64-memory-and-runtime.md`, `c64-hardware.md`,
`mos-6502-family.md`, `6502-lowering-casebook.md`, and `sfa-and-abi.md` for their exact facts.

This is development-time knowledge. The shipped compiler never consults this prose or an AI model.
Every accepted result must become an algorithm, target fact, cost choice, link/layout rule,
zero-cost API, narrow local contract, or diagnostic.

## Product boundary

Blend65 is a language, compiler, toolchain, and narrow target-platform library. It is not a game
engine or game framework. The compiler may recognize and optimize user-authored game structures,
and may ingest, validate, convert, type, and place external assets at compile time. It may expose
named zero-cost hardware operations and the exact ABI of an imported player or loader. It does not
supply game loops, entity pools, collision systems, state dispatchers, renderers, scene graphs,
sprite multiplexers, scrolling engines, double-buffer managers, or audio mixers/schedulers.

The game systems described below are qualification workloads and expert-output oracles. Developers
write their policy in ordinary Blend65. The compiler owns correct lowering and proved optimization;
the platform library owns only hardware semantics and local timing/ownership contracts.

## Prime engineering rule

Modern source in, expert assembly out:

- The user expresses game intent without having to rediscover VIC banking, page boundaries, or
  incidental byte/word traps.
- The compiler preserves normal language behavior and does the range, layout, lifetime, and cost
  reasoning.
- A named platform API exposes genuinely platform-specific intent with no hidden runtime work.
- Generated hot code is compared with equivalent expert assembly, including bytes, cycles, data,
  padding, ZP, static frames, hardware stack, loader/player code, and setup.
- A restriction introduced only because it simplifies the compiler is a defect.

## Technique record

Every game technique or specialized lowering is reviewed through this minimum record:

| Field | Required answer |
|---|---|
| game problem | Measurable frame, memory, latency, bandwidth, or expressibility constraint |
| recognizable facts | Source/semantic/IL values, ranges, effects, layout, selected profile, whole-program use counts, and frequency |
| machine assumptions | Video/VIC/SID/CIA model, `$0001`, VIC bank, ROM/IRQ ownership, writable code, and loader state |
| expert candidates | At least the correct general implementation and every credible specialized implementation |
| equivalent work | Same visible output, input, state update, MMIO behavior, timing promise, setup, and retained capability |
| disposition | Automatic, cost-guided, zero-cost API/lowering, explicit local contract, or diagnostic/no transform |
| preserved facts | Exact obligations carried through IL, SFA/ABI, layout, selection, emission, assembly, and artifact packaging |
| complete costs | Code, hot/cold/path cycles, data/tables, padding/alignment, ZP, SFA, stack, frame slots, load/setup, and replication |
| hazards/counterexample | At least one legal workload or machine state where the tempting form is wrong or worse |
| proof | Independent behavior oracle plus assembly/byte/cycle/resource expectation, configured VICE probe, and physical-QA boundary |

This is a review schema, not a request for a new compiler framework. Encode only the fields needed
by an existing or smallest justified seam.

## Disposition policy

| Disposition | Apply when | Reject when |
|---|---|---|
| automatic | equivalence, legality, observable device behavior, and benefit are proved from facts already known to the compiler | benefit depends on guessed frequency/layout or safety needs a user promise |
| cost-guided | several legal forms trade code, data, ZP, setup, and path cycles under an explicit goal and hard budgets | instruction count or a single microbenchmark hides whole-program cost |
| zero-cost API/specialized lowering | platform intent has a named modern form that lowers directly to expert obligations | wrapper adds generic dispatch, hidden calls/copies/temps, or runtime discovery |
| explicit local contract | cycle invariance, writable code, IRQ ownership, or silicon risk cannot be inferred safely | a normal machine-wide profile or dataflow proof already settles it |
| diagnostic/no transform | source is invalid or a requested dangerous technique lacks proof | correct ordinary lowering exists and the user did not request the risky form |

There is no global “game optimization” flag. Global configuration is limited to facts that really
govern the binary: CPU/platform, video/chip compatibility, memory/cartridge map, and ROM/interrupt
ownership. Local raster or self-modifying contracts stay local.

## Knowledge-to-compiler proof chain

```text
modern source intent + selected target facts
    -> semantic and effect-preserving IL
    -> range/lifetime/call-domain/layout facts
    -> deterministic disposition and candidate selection
    -> lowering, data transform, placement, API expansion, or diagnostic
    -> independent behavior proof
    -> assembled bytes/cycles/resources versus expert equivalent work
    -> configured VICE 3.10 observation
    -> targeted physical QA for silicon/revision/analogue claims
```

If any arrow is missing, the technique is knowledge only, not baked into the compiler.

## Frame architecture

### Main-loop models

| Model | Best fit | Required behavior |
|---|---|---|
| one update per video frame | deterministic 50 Hz PAL or 60 Hz NTSC design | input, update, render preparation, audio, and publication have bounded slots; overrun policy is explicit |
| logical 50 Hz on PAL and NTSC | same gameplay speed across video standards | NTSC uses a deterministic cadence/interpolation policy; audio/player cadence remains independently correct |
| decoupled variable update | uncommon on C64; useful only for a demonstrated design | accumulator/time width, worst-case catch-up, render state, and overrun are bounded without an injected runtime |
| event/raster-driven | effects or rendering are scheduled at lines/cycles | IRQ owns only bounded work; mainline prepares data and publishes at safe points |

Prefer a small explicit source loop over a hidden engine runtime. The compiler may prove and report
budgets; it does not invent game time, drop updates, or schedule audio silently.

A robust double-buffered handoff is:

1. mainline builds the next logical state or inactive display data;
2. it publishes an index/pointer with an ordering contract while the IRQ cannot observe a partial
   multi-byte update;
3. a bounded raster/frame handler reads only the published snapshot and flips base/pointer fields;
4. the former visible buffer becomes reusable after the visibility boundary.

Different evolving buffers are distinct state. Identical static replication still needs the
necessity and cost proof in `c64-memory-and-runtime.md`.

### Budget ledger

For every frame path report:

`frameBudget = sum(model-specific available CPU slots) - fixed interrupt/loader/player overhead`.

Then allocate worst-case slots to input, simulation, collision, sorting, render preparation,
raster handlers, audio, loading/decompression, and safety margin. Badlines and sprite DMA reduce
available slots before code is fitted. Branch page crossings, variable helper paths, and IRQ
latency remain ranges until layout and entry are fixed. [VIC-BAUER-2024, §§3.5–3.8;
NINE-AKESSON, timing sections]

## Raster scheduling

### Stable entry and local contracts

A cycle-stable region declares:

- exact VIC model, trigger line, target cycle/window, and preceding interrupt source state;
- hardware/KERNAL entry kind and its bounded jitter;
- badline, sprite-DMA, and any other bus-use schedule;
- every control path, call, page-cross, branch placement, and register/flag precondition;
- shared register and SFA/ABI ownership; and
- late/overrun behavior that fails visibly or takes a bounded safe path.

Double-IRQ stabilization is one selectable local template, not an automatic answer. CIA-timer or
self-synchronizing alternatives need their own equally complete technique packet before use. A
function call inside the stable region is allowed only when its complete reachable path is bounded
and layout-proved; otherwise move the variable work to mainline or issue a compile-time diagnostic
for the cycle contract.

### Bounded double-IRQ baseline

This baseline turns the familiar PAL double-IRQ wedge into a compiler-checkable local contract. It
is not a generic interrupt runtime. The selected profile is a PAL 6569 with 63 cycles per line and
an exclusive raw VIC raster IRQ. The CIA IRQ masks are clear, no NMI may occur, I/O and writable RAM
at `$FFFE–$FFFF` are visible, and the code owns A/X/Y, decimal-state establishment, the raw vector,
the stack interval, `$D011/$D012/$D019`, and one read-safe ZP byte named `stablePad`. This exact
costed variant fixes the `$D011` raster-compare high bit at zero. Its first compare line `L` is
`1..254`, the nested line is exactly `L+1` in `2..255`, and any next first-stage line installed by
the tail is again in `1..254`; neither pair crosses bit 8 or wraps to line 0. The first, nested, and
preceding entry regions must be free of badlines, badline-minus-one disruption, sprite DMA, BA/AEC
stalls, and every other interrupt source. The wait window is page-fixed and contains only
two-cycle, one-byte `NOP`s. No call, push, pull, stack-pointer change, or one-byte non-two-cycle
instruction may occur between the saved stack pointer and the nested entry.

The emitted shape and its local accounting are exact:

1. Hardware IRQ acceptance pushes PCH, PCL, and status. The outer prologue saves A/X/Y with
   `PHA; TXA; PHA; TYA; PHA` and executes `CLD`: 6 bytes, 15 cycles, and six occupied stack bytes
   including the hardware frame.
2. The first stage installs the literal second-handler address at `$FFFE/$FFFF`, writes the next
   raster line to `$D012`, acknowledges bit 0 at `$D019`, saves the outer stack pointer with `TSX`,
   executes `CLI`, and supplies eight `NOP`s: 30 bytes and 44 nominal CPU cycles after the
   prologue. Only the prefix reached before the second IRQ actually executes.
3. The next-line IRQ lands after a seven-cycle hardware entry plus zero or one residual `NOP`
   cycle. `TXS` restores the saved outer stack pointer and discards the nested three-byte hardware
   frame. The PAL correction is `LDX #8`; eight `DEX` executions; seven taken and one untaken
   `BNE` executions; `BIT stablePad`; two consecutive absolute reads of `$D012`; and `BEQ *+2`.
   This is 16 emitted bytes. Its 57-or-56-cycle path complements the 7-or-8-cycle nested entry, so
   the stable body begins at one fixed 64-cycle offset under the stated preconditions. `stablePad`
   must be ordinary RAM because `BIT` performs a real read; an arbitrary MMIO or `$0000` operand is
   invalid. The body enters with D clear and I set; A contains the last raster read, X is zero, Y
   still contains the interrupted value, and the arithmetic flags are not a caller contract. The
   body may clobber A/X/Y and flags because the outer saved values are restored by the tail.
4. The tail installs the next literal raw vector and raster line, acknowledges `$D019`, restores
   Y/X/A, and executes `RTI`: 26 bytes and 46 cycles. The stable body is inserted before that tail
   and receives its own exact path and bus-availability proof.

The complete local wrapper/stabilizer/tail is 78 code bytes plus the body. It reserves the two raw
vector bytes and one ZP `stablePad` byte, uses no SFA scratch, and reaches nine incremental stack
bytes at the nested entry: three outer hardware bytes, three saved-register bytes, and three nested
hardware bytes. Whole-program stack closure must add the interrupted mainline depth rather than
reporting nine as a global total.

Reject this costed variant if another IRQ/NMI can arrive, the `$D011` raster-high bit is not fixed
zero, `L` or the tail target is outside `1..254`, a pair crosses bit 8 or wraps to line 0, the entry
or preceding line is a badline, sprite DMA or another BA-low interval overlaps it, the wait
code/page changes, the raw vector is not exclusively owned, or any body/tail path lacks an exact
bound. Supporting lines 256..311 requires another charged template that updates the owned `$D011`
shadow and proves the line-0 boundary; this 78-byte variant must not inherit that claim. NTSC-64
and NTSC-65 need separately derived delay bodies; adding one folklore `NOP` is not a portable
proof. Future qualification must inspect the assembled bytes and page placement, trace both
initial-jitter extremes on the exact VICE 3.10 model, assert the same first stable-body cycle, and
repeat the narrow timing observation on selected physical PAL revisions. [STABLE-RASTER-CB64-2025;
VIC-BAUER-2024, §§3.5–3.8 and 3.12; MOS-PGM-1976, interrupt and instruction-cycle sections]

### IRQ chain/table

A raster schedule can be represented at compile time as sorted events containing line, optional
cycle contract, operation/template identity, data pointers, and ownership. Lowering may emit a
specialized IRQ chain or table dispatcher. The choice is cost-guided:

- a straight chain minimizes generic dispatch but duplicates setup and fixes event count;
- a compact table saves code/data for many similar events but pays index, compare, pointer, and
  indirect dispatch costs;
- unrolled direct writes win for small fixed kernels only when their bytes and page layout fit; and
- arbitrary callback dispatch is rejected inside a stable region unless the closed target set and
  every path are proved.

This schedule is compiler data, not a runtime AI or general callback framework.

### PAL/NTSC adaptation

Do not scale raster line numbers by a ratio. Maintain target-profile schedules or derive them from
semantic regions with explicit safe windows. A shared routine may be linked into both builds when
its cycle/path contract fits both model tables. Multi-standard binaries must select a previously
compiled schedule through a bounded startup/profile mechanism and include both code/data costs.

## Sprite multiplexing

A multiplexer expands more than eight logical objects into time-separated uses of eight hardware
sprites. Its deterministic compiler/library realization has these parts:

| Owner | Responsibility |
|---|---|
| user program | define the logical sprite pool, visibility/order policy, images, positions, colors, expansion, priority, and late/drop rule |
| mainline/update | cull and produce the next frame's logical records; sort or bucket by Y under a known maximum; publish an immutable schedule |
| compile-time/profile | choose data layout, hardware-channel allocation algorithm, VIC model tables, and exact IRQ entry kind |
| SFA/ABI | separate mainline and IRQ private homes; classify shared published data; forbid unsafe reentry of sorter/update helpers |
| layout/linker | place sprite images/pointers and schedule data in visible/aligned memory; account for banks and loader windows |
| IRQ lowering | emit bounded event code for Y/X/MSB/pointer/color/shared fields, acknowledge correctly, and detect late work |
| proof | compare visible sprites and state with the logical oracle; inspect event bytes/cycles and run model-specific raster probes |

An IRQ entry callback is not an ordinary callable function. Reusable `RTS` helpers may be called
from mainline only when call-domain analysis proves no concurrent frame/static-home collision;
otherwise clone/rebind safe static homes or diagnose. The developer may deliberately share sprite
position variables between game logic and IRQ display, but multi-byte publication and ownership
must still prevent torn state.

Candidate sorting strategies include insertion sort for nearly sorted small lists, counting/bucket
schemes for bounded Y ranges, and preordered fixed layers. Do not mandate one. Charge sort cycles,
index widths beyond 255, schedule bytes, worst-case visible objects, and overflow behavior.
[HESSIAN-1.2, `actor.s::DrawActors` and `sprite.s::GetAndStoreSprite`;
C64-GAMEFRAME-C634F6F, `actor.s::DrawActors` and `sprite.s::DrawLogicalSprite`]

### Q-P13 executable baseline

The following is the required general comparator, not a claim that every game should use it. Its
machine contract is PAL 6569, 63 cycles per line, 312 lines, unexpanded 24×21 sprites, fixed
per-channel multicolor/priority/X-expansion state, VIC bank and screen base fixed for the frame,
and only the VIC raster source enabled. It uses an exclusive raw IRQ: RAM is visible at
`$FFFE–$FFFF`, I/O remains visible at `$D000–$DFFF`, `$0000` DDR and `$0001` latch stay unchanged
from the declared raw profile, and no handler banks ROM/I/O. Every handler executes `CLD` before
ordinary arithmetic and owns A/Y, the hardware
vector, `$D010`, `$D012`, and raster acknowledgement. `$D011` comes from one owned shadow whose
raster-compare high bit remains zero because every selected line is below 256. Any competing IRQ,
NMI, banking transaction, display-mode owner, or sprite-register writer rejects this baseline.

The deterministic fixture has initial Y values `24..31`. Its next 16 Y values are
`65,75,85,95,105,115,125,135,145,155,165,175,185,195,205,215`; X is
`24 + 11 × sourceOrdinal`, pointer is `sourceOrdinal`, and color is
`1 + (sourceOrdinal & 7)`. Source ordinals are `0..23`. Each six-byte logical record is exactly
`x:word`, `y:byte`, `pointer:byte`, `color:byte`, and `sourceOrdinal:byte`; X is restricted to
`0..511`, color to its low nibble, and the fixed profile owns expansion/multicolor/priority rather
than duplicating those bits per record. A stable insertion sort orders by
`(y, sourceOrdinal)`, so equal Y keeps the lower source ordinal first. Sorted ordinal `j` owns
hardware channel `j & 7`. The overflow scan accepts in that order and drops a later record if its
21-line half-open vertical interval would create nine simultaneous accepted sprites. Thus ties and
the drop winner are reproducible. Reversing the 24-record input is the sorter worst path: exactly
276 key comparisons, 276 ordinal moves, and 23 final inserts. These operation counts are the
content oracle; final instruction bytes/cycles are not claimed until the chosen generated sorter
is assembled and charged outside the raster-critical path.

Each schedule record is six bytes: `xLo`, `y`, `pointer`, `color`, complete post-record `$D010`,
and `nextRasterLine`. Both 144-byte schedule tables are page-aligned on consecutive pages. They
therefore occupy 400 bytes including the 112-byte inter-table gap, plus zero to 255 initial linker
padding. Mainline writes only the inactive table and publishes a selector byte. The frame handler
sets the pointer low byte to zero and computes the high byte as `table0High + selector`: 12 code
bytes and 16 cycles. This placement makes every `(schedulePtr),Y` read page-contained. Logical
records use 144 bytes, the two schedule payloads use 288 bytes, the sort vector uses 24 bytes, and
the selector uses 1 byte. These are 457 non-ZP data bytes. The private schedule pointer is 2 ZP
bytes and the writable raw vector reserves 2 bytes at `$FFFE–$FFFF`: 461 occupied state bytes in
one additive partition. Table placement then reserves another 112 inter-table padding bytes and
zero to 255 initial alignment bytes, for 573–828 total data/vector/padding address-space bytes. No
byte is silently counted twice.

A raw frame handler at line 250 installs the first eight records. It performs 33 page-contained
indirect loads/absolute stores (four fields for each sprite plus the final complete `$D010`), 46
`INY`s, one `LDY #0`, immediate writes for the first event line/vector, and raster acknowledgement.
Its body is 233 bytes/415 cycles; `CLD`, A/Y save/restore, and `RTI` are 8 bytes/26 cycles; CPU
acceptance is 7 cycles. Pointer selection adds the separately reported 12 bytes/16 cycles. The
complete frame-handler path is therefore 253 code bytes and 464 cycles, with five incremental IRQ stack
bytes. Its first eight records and all 16 events come from the same selected table. Publication is
atomic because the IRQ reads the selector once; mainline may not overwrite that table until the
next frame publication.

Each of the 16 unrolled reuse handlers has a compile-time channel and table offset. Its event body
loads six sequential bytes through `(schedulePtr),Y`; stores them to the fixed channel
X/Y/pointer/color, shared `$D010`, and `$D012`; installs the next raw-vector address with two
immediate absolute stores; writes `#$01` to `$D019`; then exits. The page-contained event body is
52 bytes/84 cycles. `CLD`, saving/restoring only A/Y, and `RTI` are 8 bytes/26 cycles; CPU
acceptance adds 7 cycles and 3 hardware-pushed stack bytes. The exact event total is therefore 60
bytes/117 CPU cycles, 960 code bytes for all 16 handlers, zero ZP beyond the two-byte IRQ-private pointer, zero
SFA scratch in the IRQ domain, and five incremental IRQ stack bytes. The whole-program peak also
includes the interrupted mainline stack depth. An extra sequential schedule field costs
`INY; LDA (schedulePtr),Y; STA absolute`: 6 bytes/11 cycles with no page crossing; another form
must be counted from its actual addressing mode.

For the fixture, reuse handlers run at lines
`46,56,66,76,86,96,106,116,126,136,146,156,166,176,186,196`, nineteen raster increments before
their target Y and ten lines apart. The prior sprite on each channel is already outside its 21-line
interval. On the selected 6569 model, the raster compare test and IRQ assertion occur in cycle 1;
none of these events crosses the line-0 cycle-2 exception. The CPU finishes the interrupted
instruction before its seven-cycle interrupt entry, so this contract reserves seven available CPU
cycles for the longest permitted foreground instruction.

From cycle 1 of an event line to cycle 1 ten lines later there are exactly 630 PAL clocks. A
deliberately conservative progress bound marks the whole five-cycle BA-low-through-AEC-release
window unavailable for each of eight simultaneous sprite DMA bursts on every line, then subtracts
another 80 for the at-most-two 40-cycle badlines. This additive overcount leaves 150 guaranteed
progress cycles; after the seven-cycle foreground-instruction allowance, 143 remain. It does not
claim that refresh or all five sprite-window cycles are CPU-denied phi2 slots. The 117-cycle
handler therefore returns at least 26 guaranteed progress cycles before the next event assertion.
Even the last event is checked against the same synthetic ten-line boundary. Every handler
consequently finishes more than nine lines before its target's cycle-55 new-DMA/Y decision. Adding
the two progress-block classes instead of taking their overlap makes the bound conservative. The
final scheduler still replays Bauer's exact BA/RDY/AEC and unavailable-slot union against the
instruction path; any extra source, longer foreground instruction, or late path invalidates the
bound rather than borrowing its margin.

The complete fixed baseline owns 1,213 IRQ code bytes (253 frame plus 960 reuse), 457 non-ZP data
bytes, 2 private ZP bytes, 2 raw-vector bytes, 112 required table padding bytes, zero to 255 initial
placement bytes, no IRQ SFA scratch, and five incremental IRQ stack bytes. The sorter
code and mainline stack are reported from final output and added rather than hidden; until those
figures exist, the baseline is content-qualified but not implementation-qualified. Expanded
sprites, nine sprites with the same Y, a table crossing a page, `$D011` high-bit ownership change,
or a banking/NMI competitor are mandatory rejection cases. Later proof compares accepted
sprites/order to this oracle and checks every write, line, cycle, vector, stack byte, table byte,
late marker, and assembled sorter cost in VICE before targeted physical timing QA.
[VIC-BAUER-2024, §§3.8 and 3.12; NINE-AKESSON, sprite DMA and priority sections]

Any report that quotes those numeric costs must bind them to the whole baseline contract in the
same answer: PAL 6569 with 63 cycles per line; exclusive raw VIC raster IRQ; only the VIC raster
source enabled; no NMI, re-entry, or banking competitor; writable and visible `$FFFE–$FFFF`;
visible I/O; unchanged declared `$0000/$0001`; fixed VIC bank and screen base; and unexpanded
24×21 sprites with fixed per-channel multicolor, priority, and X-expansion state. Merely saying
that a profile will choose a model or interrupt variant is not enough. If any precondition is not
bound, the numeric baseline is inapplicable and its bytes/cycles must be reported as Unknown until
a separately qualified variant is supplied.

## Scrolling and rendering

### Fine/coarse design

For each axis distinguish:

- fine VIC scroll field updates;
- coarse row/column or tile-map movement;
- off-screen preparation width and memory layout;
- screen/charset/bitmap and Color RAM work;
- object/sprite coordinate transformation; and
- the visibility point at which a base or pointer changes.

The compiler compares actual candidates:

| Technique | Wins when | Full costs / counterexample |
|---|---|---|
| base/pointer flip | complete next state already exists in a compatible aligned VIC region | second evolving buffer and update work cost RAM; cannot flip Color RAM contents |
| dirty regions | few known cells change and tracking is cheaper than scanning/copying | dense changes make tests/lists slower and larger than a direct update |
| rolling screen/charset | coarse movement changes only an edge and data representation supports it | shift/copy volume and badline windows can dominate; arbitrary maps may need lookup/decompression |
| pre-shifted graphics/masks | hot masked draws repeat enough to repay data | multiple shifts multiply asset bytes, load time, cache pressure, and bank constraints |
| compile-time replication | two consumers cannot share visibility or meet timing by placement/banking | immutable duplicate bytes and padding must beat alternatives; updates would need coherence |
| unrolled copy/draw | fixed small trip count, hot path, code budget and layout allow it | code expansion can cross pages, evict code/data, and lose globally |

Hessian and the C64 game framework prove that scrolling, sprite caches, depacking, and actor drawing
can be integrated at shipped-scale, but their chosen layouts are comparative workload evidence,
not mandatory Blend65 architecture. [HESSIAN-1.2, named actor/sprite/level routines;
C64-GAMEFRAME-C634F6F, corresponding routines]

### Double buffering

Double buffering may mean screen matrices, charsets, bitmaps, software render targets, or logical
command/schedule buffers. Name which state is doubled. Place both objects with their own alignment
and VIC-visibility proof, prepare only the inactive object, then switch through link-time-derived
base fields or a pointer. If the switch also requires a CIA2 bank change, coordinate CIA2 shared
port ownership and ensure the IRQ code remains visible/valid. Do not describe a whole-screen copy
as a buffer flip.

## Aggressive VIC techniques

| Technique family | Required local contract | Safe default |
|---|---|---|
| FLI / raster mode splits | exact line/cycle register schedule, badline control, memory/color layout, IRQ exclusivity, model bounds | named template/API only; never inferred from ordinary writes |
| FLD / line crunch | exact `$D011` timing and intended internal counter effect, vertical range, following display state | explicit cycle contract and model-specific proof |
| border opening | exact border flip-flop write cycles and conflict with sprite/raster work | explicit template; preserve standard fallback where requested |
| sprite crunch | exact sprite DMA/display-state manipulation, sprite data/position constraints, revision compatibility | opt-in, physical QA when silicon-sensitive |
| VSP / AGSP | writable/visible screen layout, cycle timing, chip/board risk acceptance, corruption test and safer alternative comparison | never enabled for a general C64 build |

These techniques can be exposed cleanly to a modern programmer as named display operations or
cycle-region constructs. Their bodies may be prebuilt target templates or specialized lowering,
but their exact bytes/resources remain inspectable. Arbitrary loop/store pattern matching is too
fragile. [VIC-BAUER-2024, §3.14; VSP-AKESSON; FRAGILITY-AKESSON]

### Q-P19 cycle-event templates

A template is a set of bus-write events plus a selected-model stabilizer and slot proof. “Cycle”
means the final device-write bus cycle, not the start of an `LDA`. A full known register value costs
5 bytes/6 nominal cycles as `LDA #value; STA absolute`; with the value already proved live in A,
the store is 3 bytes/4 cycles. Stabilization, entry/exit, padding, DMA stalls, data, and restore
writes are separate ledger rows. This baseline recognizes these templates only through
an explicit named local contract:

| Template | Deterministic event/effect baseline | Layout and fallback |
|---|---|---|
| vertical-border open | keep RSEL set first; clear `$D011.3` during raster 248–250; restore it after line 251 | two complete `$D011` writes (10 bytes/12 cycles without A reuse); show standard border or reject when the model schedule cannot place them |
| horizontal-border open | clear `$D016.3` with its write access exactly at cycle 56; restore/set it with its write access at cycle 17 | one 6-cycle known-value write per edge plus stabilization/padding; only sprites/idle graphics whose bank/layout is declared may be revealed |
| FLD | before the model's badline decision window, hold YSCROLL unequal to `raster & 7`; make it equal only on each declared display-start line | one complete `$D011` write for every change; the manifest stores the allowed-line set and final state; ordinary display is the fallback |
| FLI baseline | on each intended bitmap display line, select the line's one of eight 1 KiB video matrices through `$D018`, then make the `$D011` write access that creates the badline at cycle 14—not earlier | owns eight matrices (8,192 bytes including pointer tails), the 8,000-byte bitmap and 1,000 Color RAM nibbles; at least two known-value writes/line (10 bytes/12 nominal cycles) plus the complete stable kernel; standard multicolor bitmap is the fallback |
| line-crunch step | enter a known begun badline, then make the `$D011` write negate the condition before cycle 14; one step advances VCBASE by 40 while RC remains 7 | one 5-byte/6-cycle known-value write plus stabilization; declare 10-bit VCBASE wrap and the normally hidden 24 matrix bytes; ordinary coarse update is the fallback |
| sprite-crunch step | for a named sprite already in Y-expanded DMA, clear its `$D017` bit in phase 2 of cycle 15 and reassert it before the cycle-56 advance decision | two complete `$D017` writes (10 bytes/12 nominal cycles) plus stabilization; owns the full shared register, pointer changes, MC/MCBASE evolution and data seams; ordinary sprite multiplexing/expansion is the fallback |

FLI's cycle-14 creation deliberately yields the documented invalid first three c-accesses and
24-pixel side artifact; a contract that promises unconstrained left-edge colors is rejected.
Line-crunch contracts must state whether an invalid mode hides the piled-up rows. Sprite crunch
must trace MC/MCBASE until DMA really terminates; updating only Y or assuming one 21-line image is
wrong. VSP/AGSP remains a separate explicit-risk contract under Q-P18 and is never selected as the
fallback for FLD or line crunch.

Every template is rejected until its requested line/cycle events, model table, entry stabilizer,
bank/matrix/sprite layout, shared-register ownership, restore state, total code/data/ZP/SFA/stack,
and worst path all close. Future proof records the final writes and corruption markers in a pinned
VICE model; border/FLI/FLD/line-crunch timing and all sprite-crunch/revision claims also require the
declared physical compatibility sample. This is deterministic support knowledge, not a claim that
the current compiler emits any template. [VIC-BAUER-2024, §§3.14.1–3.14.4 and 3.14.7;
FRAGILITY-AKESSON, line-crunch/AGSP integration; NINE-AKESSON, crunched-sprite sections]

## Music and sound effects

### Player-neutral source surface

Games need theme music, subtunes, one-shot cues, and action effects such as collision, shot,
explosion, victory, and loss. The public source API therefore expresses operations rather than a
tracker brand:

- initialize default, numeric, or compile-time named song;
- execute exactly one player tick at a source-owned call site;
- trigger a compile-time named effect with player-defined arbitration; and
- optionally trigger an effect on logical voice 0–2 when the selected contract exposes it.

Names resolve at compile time. There is no emitted string/name table. Constant calls become the
exact player-specific register loads and absolute `JSR` sequence. A dynamic numeric ID is available
only when its exact type/range belongs to the contract.

### Four valid integration paths

| Path | Use case | Required contract |
|---|---|---|
| music only | title/theme/background music with no player SFX ABI | init/tick, subtunes, cadence, writable state, resources, SID model/topology |
| integrated music + SFX | music and action effects share a player and voices | all above plus effect inventory, priority/replacement/resume, same-frame requests, voice mapping |
| minimal SFX only | game needs effects but no tracker music | exact tiny player's effects/voices/tick or immediate-call behavior and complete smaller costs |
| custom exact player | developer supplies known code/data | hash-bound entry ABI, every effect/resource/ownership field, and proof equal to a built-in adapter |

Plain PSID supplies init/play metadata, not an SFX contract. Do not guess identity from filename,
load address, or header. Unknown PSID model/clock metadata is not universal compatibility.

### GoatTracker 2.77 adapter

The first adapter family is pinned to GoatTracker 2.77 archive and member hashes. Its documented
integration calls init with subtune in A followed by `JSR start`, ticks with `JSR start+3`, and—when
the `-Dx` SFX feature is selected—passes effect address in A/Y and channel offset `0`, `7`, or `14`
in X to `JSR start+6`. Export options can remove unused player code, so the accepted contract binds
the exact exported player/data identity and enabled feature set. [GOATTRACKER-2.77, `readme.txt`,
`src/player.s`, `examples/src/example2.s`; GOATTRACKER-R172, named player entry points]

GoatTracker is not mandatory. SID Factory II remains a candidate until its exact exporter output,
callable SFX ABI, fixtures, state, and cost are qualified. GTUltra/multi-SID requires a later C64U
profile. A small SFX-only player can be the better expert result when music is absent.

The source owns tick placement, normally one call in an existing raster/timer path. The compiler
does not install a scheduler. Reachable concurrent calls to non-reentrant player state are rejected
or protected only by a bounded declared critical section whose masking and cycle cost are explicit.
Player-native queues are allowed when their exact one-request/priority/replacement semantics are
declared; they are not generalized into a compiler mixer. [C64-GAMEFRAME-C634F6F,
`sound.s::QueueSfx` and `::PlaySong`; OSCAR64-1.32.273, `sidfx.{h,c}`]

Behavior proof checks init/song/effect selection, arbitration, resume, cadence, writable ranges,
and register-call ordering. Assembly proof checks direct call sequences and all linked code/data/ZP/
stack/cycle costs. A selected-model register trace in VICE/libsidplayfp is useful but does not prove
identical 6581/8580 analogue sound; targeted listening/measurement on named hardware closes that
boundary.

Before closing an audio design or audit, explicitly report the four integration paths, the exact
export/player identity and selected features, logical source voices `0..2` separately from any
player-native channel-offset encoding, cadence ownership, callable ABI/clobbers, writable state,
arbitration/resume behavior, IRQ/mainline exclusion, every enabled IRQ/CIA/NMI source and nesting
path, banking, video/SID topology, and every linked resource cost. Name GoatTracker 2.77 only as the
first adapter family, retain SID Factory II as an unqualified candidate, and require a separate
C64U profile for GTUltra or multi-SID. Missing contract fields stay `Unknown`; they never justify a
generic scheduler or mixer or a fixed stack/timing claim.

## Input

Keyboard and joysticks share active-low CIA1 port lines. A scan algorithm declares driven rows,
read columns, DDR/latch preservation, ghosting assumptions, joystick coexistence, debounce/repeat,
and publication to game logic. Do not hide a full keyboard scan behind a property read whose cost
looks like one byte access.

Input sampling can occur once per logical update and publish a stable snapshot. Raster IRQ code
should not rescan unless latency requires it and the CIA/slot budget is explicit. CIA2 writes for
video-bank selection are unrelated and must not be clobbered by a generic “CIA port” abstraction.
[MOS-6526-1981, port/DDR sections; CBM-C64-PRG-1982, printed p.93 and pp.343–344]

## Entities, collision, and state

### Fixed pools and layout

Blend65 fixed-size arrays fit game workloads: the maximum entities/projectiles/events are declared
from design constraints, and an active count or free list selects live slots. Dynamic allocation is
not required. Array/index arithmetic still follows modern ordinal semantics; a pool larger than
255 or any expression whose reachable ordinal exceeds 255 receives word-capable index lowering
without forcing the user to spot the machine-width boundary.

Choose structure-of-arrays (SoA), array-of-structures (AoS), or a hybrid from hot accesses:

- SoA favors tight passes over one field and split low/high byte arrays.
- AoS favors complete per-entity updates and compact ownership.
- Hybrid hot/cold separation can reduce bandwidth without duplicating semantic state.

The compiler may scalarize or relayout only when public layout/address identity, aliasing, embedded
asset contracts, and volatile effects permit it. No layout is universally fastest.

### Collision

Separate broad phase (grid, buckets, sorted intervals, coarse masks, active lists) from narrow phase
(AABB, point, sprite/mask, tile properties). Select arithmetic width from world/map ranges rather
than from screen width. Bound every list and overflow policy. Precomputed masks or tile metadata are
cost-guided assets, not free accelerators.

### State dispatch

Candidate forms include compare chains, dense jump tables, sparse tables, and explicit state
machines. Function pointers enlarge the reachable call graph and therefore SFA/IRQ interference;
they require a closed target set or conservative allocation. A data-driven action table may be
smaller, but its pointer/ZP/dispatch costs and bank visibility count. Deterministic update order is
observable game behavior and is not reordered for cache convenience.

Qualification uses a fixed representative workload, then compares layouts and dispatch candidates
under the same update/collision behavior. [HESSIAN-1.2, `actor.s::UpdateActors` and collision paths;
C64-GAMEFRAME-C634F6F, corresponding actor/collision paths]

### Q-P16 fixed comparison workload

The reusable qualification workload has 320 fixed entity slots, exactly 40 active records in its
worst frame (including slot 270), eight state kinds, and this packed semantic record: `x:word`,
`y:word`, `vx:sbyte`, `vy:sbyte`, `halfWidth:byte`, `halfHeight:byte`, `state:byte`, `flags:byte`,
and `image:byte`. Source-visible order is ascending active-list order. Each active entity updates
position once, dispatches one state action, and participates in the same broad/narrow collision
oracle. The pair result is ordered `(lower active ordinal, higher active ordinal)`. At most 96
pairs may be published; the 97th is a visible overflow result, never memory overwrite or silent
drop.

The semantic entity bytes are exactly 3,520 (320 × 11) for packed SoA, packed AoS, or a hybrid;
layout must not pretend field padding or duplicated hot state is free. The active word-index list
is 80 bytes and a 96-pair result using two word slot indices is 384, so candidate-neutral storage
is 3,984 bytes. A sweep candidate adds an 80-byte sorted-X work vector; a table-dispatch candidate
adds a 16-byte eight-entry address table. A 20×12 bucket grid adds 480 bytes of word heads plus 640 bytes of word next links;
its per-bucket capacity and overflow result are part of behavior. A brute broad phase owns no grid
bytes but performs 780 candidate pairs in the worst 40-active frame. Sweep-and-prune owns the
80-byte sorted vector already counted and may also reach 780 comparisons; average spacing cannot
be used as its worst-case proof.

The candidate set is deliberately small:

| Candidate | Required numeric comparison |
|---|---|
| SoA + direct state chain | word-capable access to every field; eight-state worst chain; exact update and 780-pair AABB path |
| packed AoS + address table | cost of forming/reusing `11 × slot` or a record pointer; complete-record locality; same chain/table alternatives |
| hot-SoA/cold-AoS hybrid | position/velocity/extent arrays versus cold state/flags/image record, with no semantic duplication; table or proven closed-target specialization |
| bounded grid variant | common layout plus 1,120 bytes; exact clear/insert/neighbour/narrow paths and explicit overflow |

The independent behavior fixture is generated from active ordinal `k = 0..39`. Its slot list is
`0,7,14,...,266,270` (the arithmetic sequence stops at 266 and appends 270). Before update:

```text
x = 20 + (floor(k / 2) % 10) * 28 + (k % 2)       * 3
y = 30 + floor(k / 20)             * 70 + (k % 2) * 2
vx = (k % 3) - 1
vy = (k % 5 == 0) ? 1 : 0
halfWidth = 4; halfHeight = 5
state = k % 8; flags = 1; image = k % 16
```

First add signed `vx`/`vy` to the word positions with ordinary Blend65 word semantics. Then run
exactly one state action: states 0–7 respectively do nothing, add one to X, subtract one from X,
add one to Y, subtract one from Y, set `image = (image + 1) & 31`, toggle flag bit 1, or negate
`vx`. The chosen values do not cross a word boundary. Each state occurs five times. This order and
these field effects are observable; a candidate may specialize dispatch but may not reorder them.

Narrow collision uses half-open boxes: a pair overlaps exactly when
`abs(xA-xB) < halfWidthA+halfWidthB` and
`abs(yA-yB) < halfHeightA+halfHeightB`. Touching edges do not collide. Brute force visits pairs in
ascending active ordinal. A grid candidate uses the post-update center cell
`(min(19, x >> 4), min(11, y >> 4))`, inserts active ordinals in ascending order, examines the
clipped 3×3 neighbour cells in row-major order, and tests only a greater active ordinal; result
publication is finally sorted by the canonical ordinal pair. The exact expected slot pairs are:

```text
(0,7) (14,21) (28,35) (42,49) (56,63)
(70,77) (84,91) (98,105) (112,119) (126,133)
(140,147) (154,161) (168,175) (182,189) (196,203)
(210,217) (224,231) (238,245) (252,259) (266,270)
```

There are 20 results and no overflow. The clustered counterexample instead assigns all 40 centers
to `(160,96)`; it reaches 780 overlaps, publishes the first 96 canonical pairs, then produces the
defined overflow result on pair 97. A candidate-specific traversal may discover pairs in another
order internally, but it must canonicalize the published result or it is behaviorally different.

For each candidate the proof table must contain final code bytes, static data and padding, ZP,
SFA homes, hardware-stack peak, initialization, update, broad phase, narrow-hit and narrow-miss,
state best/worst path cycles, plus the complete machine, interrupt, and loading context required by
the machine-bound workload completion gate below. Those numbers come from final assembled
addresses because page crossings and address-mode choices matter; this content-only phase does not
invent them. The compiler selects the lowest candidate satisfying the declared RAM and worst-frame
budget. A source address escape, unknown state target, or observable layout fixes the affected
representation. Counterexamples are mandatory: slot 270 rejects byte-truncated indexing, the
fixed 20-pair oracle detects missing/duplicate/order-changing collision paths, clustered 40-way
overlap defeats an average-case sweep claim, touching edges detect `<=` in place of `<`, and a
sparse two-state trace can make the 16-byte jump table lose to a chain. [MOS-PGM-1976,
indexed/indirect access and instruction costs;
HESSIAN-1.2 and C64-GAMEFRAME-C634F6F, named actor/collision paths]

### Machine-bound workload completion gate

Every C64 workload, representation comparison, or game-system recommendation fixes the execution
context even when the work appears CPU-only. State the exact machine profile, CPU, video chip and
video standard, plus relevant banking and visibility. If the packet does not supply one, keep the
affected result `Unknown`; do not silently choose a generic C64.

State either that interrupts are absent/disabled for the measured interval or describe every
reachable IRQ and NMI route. Each introduced route must name its source and entry kind, vector/link
storage, acknowledgement owner, terminal/exit owner, nesting and re-entry assumptions, banking
visibility, handler/wrapper code bytes, IRQ-specific hardware-stack peak, and entry,
acknowledgement, restoration, exit, and full-path cycles. A generic `stack`, `code`, or `cycles`
line does not account for an interrupt route.

State loader and initialization ownership whether or not streaming is central to the comparison.
Report loader/decompressor code and data bytes, transfer/load time, initialization/loading cycles,
scratch/ZP/stack, destination and visibility windows, and interference with live code, IRQ, audio,
SFA homes, and assets. Each unavailable figure is individually `Unknown`, never omitted or treated
as zero.

## Asset streaming and loading

Loading and decompression are explicit subsystems, not compiler runtime. Each plan identifies
artifact range, destination, mapping, loader code visibility, IRQ/audio policy, scratch/ZP/stack,
input/output overlap, worst-case output, publication, and restore state. Place decompression output
where its final consumer reads it when possible. A temporary buffer needs a measured reason.

Overlays require whole-program liveness proof: no executing code, return address, vector, static
home, published pointer, or live asset may refer to the overwritten range. A loader that pauses an
IRQ must specify the maximum pause and audio/render consequence; one that continues must keep the
handler/player/data visible and non-conflicting. [SPINDLE-V3, loader/linker/IRQ sections;
HESSIAN-1.2 and C64-GAMEFRAME-C634F6F, loader paths]

## Native asset handlers

`embed(path, selector)` is a compile-time operation. The literal selector is an opaque exact key
owned by the selected profile handler; it is not a general query language. Parsing may be cached,
but only selected outputs are emitted. Extension chooses a candidate handler; signature, version,
complete structure, indices, lengths, and exact EOF establish validity. Older, newer, malformed,
or unregistered generations fail closed with E10204.

Keep four asset costs distinct: emitted artifact bytes, final runtime residency, compile-time import
work, and any runtime access/transfer work. A compile-time handler allocates no SFA home and can add
zero runtime import instructions, but that does not make its selected object “zero RAM.” The linker
and packager may place bytes in ROM, resident RAM, a load overlay, cartridge space, or another
profile-owned region. Until the final map and loader plan exist, physical RAM/ROM/banked residency,
replication, transfer, and overlap costs are individually `Unknown`. For VIC-consumed data, also
prove the selected bank, offset, alignment, visibility, and every other simultaneously resident
object; never infer fit from payload size alone.

### Qualification baseline and surfaces

| Handler | Pinned identity | Exact accepted identity | Surface and important rejection rules | Evidence state |
|---|---|---|---|---|
| SpritePad | SpritePad C64 Pro 3.80, public 2025-08-22 | project contract: ASCII `SPD`, version 5; complete flags/counts/records/tails must validate | native 64-byte `sprites`, word `count`, three global colors, explicit derived `sprite_attributes`, tile count/dimensions/word indices/attributes/tags, overlay distances, sprite/tile animation counts/start/end word arrays/timer/flag bytes; default `sprites`; no global multicolor/base-block/implicit offsets | producer release pinned; complete schema/parser and 3.80 fixtures not yet qualified |
| CharPad | CharPad C64 Pro 3.88, public 2026-06-19 | project contract: ASCII `CTM`, version 9; complete header and ordered conditional blocks through exact EOF | charset; canonical smallest-lossless tiles/map; forced word, packed-12, low/high variants; native colors/method; word map dimensions; byte tile dimensions; tile-mode flag; selector required; no flattening, per-cell color invention, bases, or implicit offsets | producer release pinned; complete schema/parser and 3.88 fixtures not yet qualified |
| SID | `HVSC-SID-FORMAT-20260906` hash | self-contained directly callable PSID v1–v4 subset with exact header/payload/target validation | data, init address, nonzero play address; default data; reject RSID/MUS/PlaySID-dependent/unsupported topology; PSID alone does not provide SFX | header authority pinned; Blend65 subset and fixtures remain implementation proof |
| Koala | `KOALA-NATIVE-003` classic layout cross-check | project contract: exactly 10,003 bytes with little-endian `$6000`, 8,000 bitmap, 1,000 screen, 1,000 Color RAM bytes, and one background byte | bitmap, screen, color_ram, background; selector required; preserve every source byte; only the low nibble of Color RAM/background is semantically consumed by VIC-II | layout and full-byte preservation policy are frozen; fixtures still qualify implementation behavior |

Every active C64 profile selects `video_standard: pal | ntsc` and exactly one concrete SID at
`$D400`, with model `mos6581` or `mos8580`. PAL uses 985,248 CPU cycles/second
(`clock_mhz: 0.985248`); NTSC uses 1,022,730 (`clock_mhz: 1.022730`). Those clock values are derived
profile facts, not substitutes for video or SID identity.

PSID v1 has no clock/model flags and therefore asserts neither. PSID v2NG through v4 decode the
two-bit fields exactly:

| Field | `00` | `01` | `10` | `11` |
|---|---|---|---|---|
| clock, bits 2–3 | Unknown | PAL | NTSC | PAL and NTSC |
| primary model, bits 4–5 | Unknown | MOS6581 | MOS8580 | MOS6581 and MOS8580 |
| second model, bits 6–7 (v3+) | inherit primary | MOS6581 | MOS8580 | MOS6581 and MOS8580 |
| third model, bits 8–9 (v4+) | inherit primary | MOS6581 | MOS8580 | MOS6581 and MOS8580 |

Unknown is not Both: embed-only use remains legal, while callable audio needs a hash-bound player
contract that closes every unknown without contradicting a specific field. The active profiles
reject every second/third-SID requirement and every known clock/model mismatch with E10261; they do
not activate hardware or retime, retune, filter-adapt, or translate a SID payload.

The complete normative Blend65 selector/type rules come from
[BLEND65-SPEC-4-5c6bac04, `spec/appendix-c64.md` §7 and F015]. Producer release evidence is
provenance: SpritePad/CharPad files do not encode the producing application version. The format
claim is qualified only against representative files produced by the pinned release plus an exact
schema/parser review.

For SpritePad, `SPRITEPAD-380` proves the current producer release but not its private byte schema.
`C64LIB-RBT-79D5C0E` corroborates signature, v5 header/count widths, and native records but drops
tails. The reviewed OpenSprite `read_spd` implementation independently exposes sprite attributes,
tile blocks/tags/names, overlay distances, and sprite animation arrays but marks tile animations
unimplemented and is not the 3.80 producer. Therefore no implementation may claim the complete v5
tail parser from those comparative sources alone: the implementation gate requires a licensed
3.80-produced fixture set and producer manual/schema. This is a proof prerequisite, not permission
to shrink the accepted Blend65 surface or guess omitted bytes.

For CharPad, the pinned c64lib CTM9 processor corroborates the `CTM`/9 identity, header fields,
`$DABn` ordered blocks, 16-bit counts/dimensions/indices, conditional tile/color blocks, materials,
tags, names, and map. `CHARPAD-388` must pin the producer release record; release-produced fixtures
cover every display/color/tile combination and wide index boundary. Comparative parser limits
cannot silently become Blend65 limits.

The CharPad handler has no default selector. Its exact initial selector surface is:

| Selector | Type and availability |
|---|---|
| `"charset"` | `const byte[]`; eight bytes per character, with 2-KiB alignment and selected-VIC-bank visibility |
| `"tiles"` | smallest-lossless `const byte[]` or little-endian `const word[]`; tile mode only |
| `"map"` | smallest-lossless `const byte[]` or little-endian `const word[]`; tile indices in tile mode, otherwise character indices |
| `"tiles_word"` | forced little-endian `const word[]`, even when every value fits in a byte; tile mode only |
| `"map_word"` | forced little-endian `const word[]`, even when every value fits in a byte |
| `"tiles_packed12"` | `const byte[]`; tile mode only, and only when every tile index is at most 4095 |
| `"map_packed12"` | `const byte[]`; present only when every map index is at most 4095 |
| `"tiles_low"`, `"tiles_high"` | independently selected full `const byte[]` planes; tile mode only |
| `"map_low"`, `"map_high"` | independently selected full `const byte[]` planes |
| `"colors"`, `"color_method"` | native color table as `const byte[]` and native method as `byte` |
| `"map_width"`, `"map_height"` | `word` dimensions in map entries |
| `"tile_width"`, `"tile_height"`, `"tile_mode"` | `byte`, `byte`, and `boolean`; dimensions are 1 without a tile layer |

For canonical `"tiles"` and `"map"`, maximum index 255 selects `byte[]`; any larger valid index
selects `word[]`. Declaring the other type is E10144 with the required type, never truncation or a
format error. A requested selector absent from the parsed file's enumerated surface is E10133.

For logical values `v[0..N-1]`, packed-12 emits the `N` low bytes first, followed by `ceil(N/2)`
high-nibble bytes. High byte `j` is
`((v[2*j] >> 8) & $0f) | (((v[2*j+1] >> 8) & $0f) << 4)`. When `N` is odd, the absent final value
contributes zero to the upper nibble. Therefore `$123,$456,$789` emits
`$23,$56,$89,$41,$07`. A value above `$fff` makes the packed selector unavailable; it never
truncates. Only explicitly selected canonical, forced-word, packed, or split representations emit
and appear in the build cost. No companion representation, flattened screen, derived color RAM,
address base, or offset table appears implicitly.

Before closing a CharPad/Koala review, state the canonical 255 byte/word selection boundary,
packed-12's 4095 maximum, low-plane-then-high-nibble ordering, odd-tail zero padding, independent
low/high selectors, selector-required/no-default rule, E10144 selector-type mismatch, and E10204
for malformed or unregistered versions. For Koala, also state the exact 10,003-byte `$6000`
layout, its one-byte background component, requested-only emission, placement-derived VIC fields,
and the explicit costed Color RAM transfer.

For CharPad availability, do not group all tile-related names under “tile-only.” `"tile_width"`,
`"tile_height"`, and `"tile_mode"` are always present; without a tile layer their exact values are
`1`, `1`, and `false`. Only the selectors explicitly marked tile-mode-only in the table above are
absent and produce E10133 when requested.

Before closing a SpritePad review, state the exact accepted SPD v5 identity, E10204 for every other
version, complete 64-byte records, word counts, per-record attributes, every selected optional
tile/animation/overlay component, explicit requested derived outputs, and placement-derived VIC
blocks. All embedded assets are program-lifetime platform-layout/packaging objects outside SFA;
their handlers never allocate function-execution storage or hidden duplicate representations.

State resident-set placement as intervals, not as one scalar byte sum. In a selected 16-KiB VIC
bank `B = [0, $4000)`, `S` contiguous native sprite records placed at bank-relative offset `o`
occupy `R = [o, o + 64 × S)`. Require `o mod 64 = 0` and `R` to lie entirely within `B`. Model every
simultaneously live VIC-visible object as its actual interval or intervals; each must satisfy its
own alignment, visibility, and banking constraints and must not overlap another live object unless
the overlap is a proved identical-object alias or an explicit overlay with a complete liveness
contract. The active screen matrix occupies its complete 1-KiB interval; its final eight bytes are
the sprite-pointer table and are not an additional allocation. Final offsets already include
alignment padding, so report padding as artifact cost but do not add it again to an interval end.

`256 × 64 = 16,384`: 256 native records fill every block only as `[0, $4000)`, so they cannot
coexist with an active screen matrix in that bank. More than 256 necessarily exceeds one bank. For
any project whose complete set is not simultaneously resident, report the explicit resident subset
and loader/overlay/bank-transition contract.

Parser-closing evidence must cover the accepted-fixture roles `SPD380-MIN-V5` (smallest accepted
structure), `SPD380-ALL-V5` (all supported components together), `SPD380-WIDE-V5` (word-sized counts
and indices), and an `SPD380-OPTIONALS-V5-*` matrix that exercises every optional component both
present and absent in meaningful legal combinations. It must also cover the explicit adjacent-
version rejections `SPD-V4` and `SPD-V6` and every derived malformed boundary in the acquisition
register. These IDs are stable manifest labels, not evidence by themselves: producer provenance,
file hashes, expected selector types/bytes, and exact boundary/EOF results supply the proof.

For Koala, `KOALA-NATIVE-003` cross-checks the classic header and four ordered components. It does
not justify treating nonzero unused high bits as a malformed historic file. If the current product
contract rejects such bytes, record that as a deliberate Blend65 policy and test both accepted and
rejected cases; a later compiler audit may recommend preserving raw bytes while exposing their
low-nibble hardware meaning. Wording in an existing specification or evaluation that says a
SpritePad/CharPad parser “is qualified” does not override missing producer evidence. The skill
must report the conflict, keep the parser state pending, and never convert project prose into
external format authority.

### Asset fixture acquisition register

The exact future manifest has these required IDs. Its hash field remains `not-admissible` until the
named producer/source creates or supplies the bytes; an invented or hand-edited file cannot fill a
producer slot.

| Handler | Required accepted fixture IDs | Required rejection IDs | Provenance and expected output record |
|---|---|---|---|
| SpritePad 3.80 | `SPD380-MIN-V5`, `SPD380-ALL-V5`, `SPD380-WIDE-V5`, and the `SPD380-OPTIONALS-V5-*` matrix | `SPD-V4`, `SPD-V6`, every block truncation/count mismatch/trailer/selector mismatch derived from a hashed accepted file | 3.80 project/save provenance, file SHA-256, every selector's type/length/SHA-256, full tail/EOF coverage; IDs label evidence but never replace it |
| CharPad 3.88 | `CTM388-MIN-V9`, `CTM388-ALL-V9`, `CTM388-WIDE-V9`, one ID for every display × color × tile-mode combination | `CTM-V8`, `CTM-V10`, every marker/block truncation/count/index/trailer/selector mismatch | 3.88 project/save provenance, file SHA-256, component dimensions/widths and every selector's type/length/SHA-256 |
| PSID v1–v4 | one self-contained fixed-load and one payload-load-address case per accepted version, plus valid PAL/NTSC/model/topology cases | RSID, MUS, zero-play, bad offset/load/init/range, unsupported SID address/topology, target mismatch | HVSC-format provenance, complete header fields, payload SHA-256, selected data/init/play result and call contract |
| Koala classic | `KOALA-6000-ZERO`, `KOALA-6000-PATTERN`, `KOALA-6000-HIGH-NIBBLE` | short/long, wrong load address, selector mismatch, and whichever high-nibble case product policy explicitly rejects | `KOALA-NATIVE-003` recipe/tool pin, file SHA-256, four exact component lengths/SHA-256, placement and Color RAM transfer |

This register is an enforced evidence dependency, not deferred design work. The skill can explain
and audit the handlers, but no compiler implementation may report the SpritePad/CharPad parser
facet as qualified while the producer rows remain `not-admissible`.

For each handler, future goldens include:

1. a minimal valid file from the pinned producer/baseline;
2. a maximal/wide file exercising every supported component, flag, and width;
3. each optional-component combination;
4. wrong signature, prior/next version, truncation at every block boundary, inconsistent count,
   invalid index/attribute, trailing bytes, and selector/type mismatch;
5. exact expected selector type and bytes, placement requirements, derived-asset report, and no
   unselected output; and
6. load/link/VICE observation for hardware-facing layout, with physical QA only where silicon or
   analogue behavior matters.

Raw `embed(path)` remains available only for unregistered extensions. It has no selector metadata
and does not bypass validation of a registered extension.

## Integrator-style scene and asset pipeline

Robin Levy's account establishes that The Last Ninja workflow used reusable elements and panels,
foreground/background priority, silhouettes/masks, multicolor attribute-clash handling, and
explicit memory-versus-draw/mask-speed choices. Luigi Di Fraia's reconstruction supplies evidence
for recovered panel/object and editor stages while explicitly leaving parts of the original tool
unknown. Do not attribute the new compiler design below to the historical tool.
[INTEGRATOR-LEVY, interview lines 124–136; INTEGRATOR-DIFRAIA-2012, entry lines 279–313]

### Deterministic Blend65 realization

1. **Import** exact native/raw assets through qualified handlers. Preserve element pixels, palette/
   attributes, dimensions, anchors, collision/occlusion metadata, and source identity.
2. **Author composition in Blend65** using ordinary typed data and code. Scene membership, draw
   order, foreground/occlusion policy, transformations, and reusable-component identity belong to
   the program, not to an asset handler or compiler-supplied scene system.
3. **Validate** C64 mode/color constraints. Report cell/character attribute conflicts with source
   locations and available deterministic choices; never silently recolor.
4. **Author algorithms and derived data in Blend65.** The program owns foreground/occlusion masks,
   draw priority, clipping/address tables, dirty-region policy, and any selected pre-shifted forms.
   The compiler may optimize only proved equivalent patterns; it does not invent renderer policy.
5. **Choose representation in the program** among reusable commands, panel references, precomposed
   cells/bitmap, masks, deliberate immutable replication, and compressed streams. The compiler may
   compare equivalent lowerings by total asset bytes, padding, loader/decompression cost,
   draw/erase/mask cycles, ZP/SFA scratch, and update frequency, but it may not change user-visible
   scene or rendering policy.
6. **Place and package** the chosen bytes in VIC-visible/aligned regions or declared load windows;
   emit exact screen/charset/bitmap/Color RAM separation and a machine-readable build report.
7. **Expose** typed asset bytes, metadata, symbols, placement constraints, and any exact imported
   ABI. The user-authored renderer consumes them; runtime never re-parses project files.

This is compile-time asset handling plus ordinary user-authored Blend65, not an editor or scene
framework. A compiler plugin/handler may ingest, validate, convert, type, place, and package assets
as ordinary link objects and constants. It may include an explicitly selected low-level loader or
exact imported-player ABI, but it never composes scenes, derives renderer algorithms, selects
gameplay representations, or supplies a renderer or gameplay policy.

### Q-P15 proof shape

Use a large visible area built from repeated elements/panels, foreground objects, occlusion masks,
and at least one multicolor attribute conflict. Compare two credible representations. The expected
artifact proof checks exact bytes, reuse/replication, alignments, bank visibility, mask/priority
data, reported conflicts, loader destinations, and absence of hidden copies. Runtime proof checks
draw order, foreground occlusion, changed-panel updates, Color RAM work, and worst-case cycles. A
response that says only “use Integrator,” “build an editor,” or “flatten and copy the screen” fails.

Apply the machine-bound workload completion gate. If a runtime renderer is selected, report its
code bytes separately from asset, table, loader/decompressor, and static-data bytes. If an IRQ
publishes or consumes scene state, enumerate that route's vector/link storage, handler/wrapper
bytes, entry/acknowledgement/restoration/exit cycles, full-path cycles, IRQ-specific stack peak,
source and terminal ownership, visibility, and nesting assumptions. Every unavailable term is
individually `Unknown`; generic renderer, draw, stack, or cycle totals cannot stand in for it.

Keep useful payload and reserved address space as separate totals. A C64 screen matrix reserves
1,024 address-space bytes even though only 1,000 are visible cells; Color RAM likewise occupies
1,024 addresses even though only 1,000 cells are visible. Therefore two screen matrices, one
2,048-byte charset, and Color RAM reserve exactly `2 × 1,024 + 2,048 + 1,024 = 5,120` address-space
bytes. Their visible/useful cells are `2,000 + 1,000`, but that smaller number must never be added
to the charset and labelled an address-space allocation. Report the 48 screen-tail bytes and 24
Color-RAM non-visible addresses explicitly; then add masks, tables, alignment, and loader windows
without silently dropping or double-counting them.

## Feasibility reasoning

When asked whether a new game or program is feasible, derive the answer live from:

1. modern source expressibility and any registered hardware exception;
2. correct compiler/platform/library behavior needed;
3. static RAM, code, immutable/mutable data, ZP, stack, SFA, and loader-window budgets;
4. worst-case frame/raster path under model-specific VIC DMA;
5. asset/audio/input/loading integration and chip/profile compatibility;
6. hot-system output parity against expert equivalent work; and
7. specified VICE and targeted physical evidence.

Do not read, update, or rely on the optional game-feasibility matrix/page. It is a naive historical
snapshot and may be removed. A source architecture the language cannot express is an infinite
parity failure; a compiling path that loses to expert assembly remains a defect.

## Technique-family compiler map

| Family | Automatic/cost-guided work | Named API or local contract | Diagnostic boundary |
|---|---|---|---|
| CPU/code shaping | proven constant specialization, strength reduction, register reuse, ZP allocation, branch layout, bounded unroll/table choices | writable-code self-modifying specialization; selected undocumented opcode | no proof of ownership, benefit, legality, or physical compatibility |
| raster | exact branch/layout repair and target schedule costing | stable-region, IRQ-chain/table, mode-split templates | variable/unbounded path or impossible slot |
| sprites | placement-derived pointers, shared-register coalescing under ownership, user-authored sort-choice costing | zero-cost VIC operations and local timing/ownership contracts | torn publication, unsafe helper domain, unbounded late path |
| scrolling/rendering | optimize user-authored pointer flips and dirty/pre-shift/copy/unroll choices | display placement and cycle-region operations | invisible/misaligned data or unproved frame fit |
| aggressive VIC | none by accidental source shape | explicit FLI/FLD/line-crunch/border/sprite-crunch/VSP contract | missing model/timing/ownership/physical-risk proof |
| audio | constant cue/voice lowering and dead feature stripping | hash-bound player adapter/custom contract | guessed SFX ABI, incompatible clock/model/topology, unsafe overlap |
| loading/assets | parse/validate/transform/place selected representations at build time | loader/decompressor contract and explicit derived asset | malformed/unknown version, overlap, hidden copy, unowned load window |
| user-authored game structures | range/layout/dispatch candidate costing under fixed workload | ordinary arrays, structs, function values, and hardware operations | unsafe function target, width truncation, or missing lowering |

## Future Runtime Evidence Matrix

The observations below are future proof requirements; this knowledge baseline does not claim that
they have run. Each later runtime proof uses VICE 3.10 `x64sc` with exact model/options/ROMs, binary
and asset hashes, initial state, stop condition, observable memory/register/frame/audio trace, and
expected result.

| System | Behavior observable | Assembly/resource observable | Physical QA |
|---|---|---|---|
| raster/sprites/scroll | frame images/signatures, event order, no late/torn updates | line/path cycles after DMA, writes and order, schedule/data/ZP/SFA/stack bytes | cycle-exact and revision-sensitive display kernels |
| audio | named song/effect, arbitration/resume, tick cadence, selected endpoints | exact adapter calls, linked player/data/state, worst path and register trace | 6581/8580 audible/filter/board conclusions |
| input | active-low samples and stable published state without bank clobber | CIA access count/order and snapshot cost | unusual controllers/electrical sharing |
| loader/assets | exact destination bytes, publication, no live overwrite, visible final layout | artifact component hashes, copies/replicas, scratch, load/decompress cost | real drive/fastloader/cartridge timing |
| entity/collision/state | deterministic updates and collision oracle over boundary workloads | chosen layout/addressing/index widths/dispatch and complete cost | normally none beyond whole-game smoke |
| aggressive VIC | intended display plus explicit error/corruption markers | exact cycle/layout/ownership contract | mandatory for silicon-risk compatibility claims |

## Decision checklist

- Does the user write familiar source while platform lore stays in zero-cost target behavior?
- Is every technique assigned one deterministic compiler/API disposition?
- Are recognizable preconditions machine-checkable, with a correct general fallback?
- Are SFA homes and shared state safe across mainline, IRQ, and NMI domains?
- Are complete costs compared under equivalent work and actual frame/memory budgets?
- Are asset formats exact and fail-closed, with no guessed tail or hidden emitted representation?
- Are future VICE observables and physical-QA bounds specified without pretending they ran?
- Before claiming a fixed C64 route cost or stack peak, are every enabled IRQ/CIA/NMI source,
  priority, and nesting path closed, or is the no-NMI/no-nesting precondition explicit?
- Does every displayed assembly line assemble to exactly one intended instruction? Write
  alternatives on separate lines or in prose; never use an expression such as `#0|7|14` or
  `#$02|$14` to mean “choose one,” because ACME evaluates it as bitwise OR.
