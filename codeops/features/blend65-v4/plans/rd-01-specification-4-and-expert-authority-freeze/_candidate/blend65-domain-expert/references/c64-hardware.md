# C64 VIC-II, CIA, and SID Hardware

> **Baseline version**: `2.0.0`

Use this reference when compiler or platform-library behavior depends on C64 device registers,
video bus timing, interrupts, input, or sound. Read `c64-memory-and-runtime.md` for mapping and
startup ownership and `c64-game-engineering.md` for whole-game scheduling.

The rules below separate documented device behavior, revision-bounded measurement, configured
emulator evidence, and physical-machine evidence. Never turn a number for one VIC-II or SID into a
universal C64 constant.

## Model declaration

Every material answer names or leaves explicitly unknown:

- video standard and exact VIC family/revision where relevant;
- SID model and address for every selected chip;
- CIA revision when an edge/timing claim depends on it;
- KERNAL ROM and board/PLA context when interrupt or banking paths use them;
- CPU `$0001`, CIA2 `$DD00/$DD02`, enabled interrupt sources, and ownership mode; and
- VICE 3.10 `x64sc` model/options or exact physical test machine used as evidence.

When the model is unknown, use a documented common subset or diagnose that a cycle/silicon claim
cannot be proved. [CBM-C64-SVC-1985, board-identification/schematic sheets;
VIC-BAUER-2024, model warning; VICE-310-MANUAL, C64 model options]

## Models, revisions, and QA bounds

The common model families have different raster geometries:

| VIC-II family | Video | Lines/frame | Cycles/line | CPU clock class | Qualification use |
|---|---:|---:|---:|---|---|
| 6569 family | PAL | 312 | 63 | about 0.985 MHz | Bind an exact PAL model before cycle-exact scheduling. |
| early 6567R56A | NTSC | 262 | 64 | about 1.02 MHz | Do not merge with later NTSC geometry. |
| later 6567R8 family | NTSC | 263 | 65 | about 1.02 MHz | Common NTSC baseline, still revision-bounded. |

These measured model values come from [VIC-BAUER-2024, §§3.5–3.8]. The preliminary
`CSG-6567-318014` sheet supplies the documented 6567 register/bus baseline, not a complete PAL or
revision history. A frame budget is never just `lines × cycles`: badlines, sprite DMA, interrupt
entry, and path variation remove CPU availability.

## VIC-II register contract

### Control, bases, raster, and interrupts

| Register | Important fields/effects | Compiler/API rule |
|---|---|---|
| `$D011` | raster compare bit 8 on write; current raster bit 8 on read; `ECM`, `BMM`, `DEN`, row select, vertical fine scroll | Preserve non-owned bits. Timed writes can change badline/display behavior; never fold or move them as ordinary state. |
| `$D012` | raster low byte/current raster low byte | A compare update spanning `$D011/$D012` needs an ordering/race contract. |
| `$D016` | `MCM`, column select, horizontal fine scroll | Fine-scroll and mode bits share a register; use an owned shadow or proven read/mask/write sequence. |
| `$D018` | screen high nibble; character-base bits 1–3 or bitmap-base bit 3 | Values derive from final placement in the active VIC bank. Reserved/unused bit handling is explicit. |
| `$D019` | IRQ status: raster, sprite-background, sprite-sprite, light pen; bit 7 summarizes an active enabled source | Acknowledge selected latched sources by writing ones. Read and write effects are device semantics. |
| `$D01A` | IRQ enable mask | Enable/disable and pending-status handling are separate operations. |

Source: [CBM-C64-PRG-1982, printed p.151 and Appendix G p.391;
CSG-6567-318014, internal sheets 11–14; VIC-BAUER-2024, §§3.2 and 3.12].

For a raster compare change, avoid an accidental match between the two writes. The API either
updates during a proven safe interval, masks the raster source and handles pending state, or emits
a schedule-specific sequence. A generic `rasterLine = word` store has no correct device-neutral
lowering.

To acknowledge raster IRQ, the semantic operation is “write one to `$D019` bit 0”, not “set the
stored byte's bit 0.” A direct `LDA #$01; STA $D019` is the reference effect when A is not already a
proven `$01`. An NMOS memory RMW performs multiple device-visible writes and cannot replace it
unless that exact bus sequence is independently proved safe for the requested acknowledgement.

### Display modes

`ECM` (`$D011` bit 6), `BMM` (bit 5), and `MCM` (`$D016` bit 4) select the standard modes. Treat
unused/invalid combinations as unsupported device states, not extra portable modes.

| Standard mode | Pixel/data interpretation | Runtime data obligations |
|---|---|---|
| standard text | one character byte per matrix cell; 8-byte glyph; foreground from Color RAM | screen, charset, Color RAM, background color |
| multicolor text | glyph bit pairs; per-cell Color RAM bit 3 chooses wide multicolor interpretation | screen, charset, Color RAM, two shared multicolors, background |
| extended-color text | character code high bits select one of four backgrounds; reduced glyph index space | screen-code masking and four background registers |
| hires bitmap | 8,000 bitmap bytes; screen nibbles provide two colors per cell | bitmap plus 1,000-byte screen matrix |
| multicolor bitmap | pixel pairs; screen nibbles plus Color RAM and background select colors | bitmap, screen, 1,000 Color RAM nibbles, background |

Mode changes have data-layout consequences. A named modern API may package them, but it must lower
to declared register writes and already placed data; it may not secretly convert or copy an image
at runtime. [CBM-C64-PRG-1982, Chapter 3 graphics; CSG-6567-318014, internal sheets 1–10]

### Color RAM

Color RAM at `$D800–$DBFF` is a separate 1 Ki × 4-bit device. Only the low nibble is meaningful for
color. It is CPU-visible while I/O is selected and is not ordinary VIC-bank RAM. An image placed in
normal RAM cannot make its color layer appear in Color RAM by address selection; the transfer or
generation cost is explicit. Reads must not be used to preserve an assumed high nibble. A fill or
copy counts 1,000 destination writes for a full 40×25 matrix unless the chosen update is smaller.
[CBM-C64-PRG-1982, graphics and I/O maps]

## VIC-II bus arbitration

### Badlines

During the standard display window, a badline occurs when display enable has been established and
the raster low three bits match vertical scroll. The VIC fetches 40 matrix/color entries, asserts
bus control early enough to stop the CPU, and removes roughly forty CPU opportunities; the exact
stall boundary and count depend on model and surrounding DMA. Writing `$D011` at critical times can
alter the condition and is itself a cycle-exact technique. [VIC-BAUER-2024, §§3.5–3.7;
CSG-6567-318014, internal sheets 14–16]

Compiler scheduling distinguishes VIC activity from actual CPU denial:

`availablePhi2(line) = modelCycles(line) - |cpuBusDeniedPhi2(line)|`.

`cpuBusDeniedPhi2` is the union of model-specific second-phase takeovers for badline character
pointer fetches, active sprite data, and any separately proved exceptional takeover. Normal
refresh, graphics, sprite-pointer, and idle accesses use the VIC's first half-cycle and do not by
themselves remove the 6510's second-half opportunity. They must not be subtracted merely because
they are VIC bus activity. BA's three-cycle warning is also not another unconditional bus-loss
penalty: exact instruction scheduling replays BA/RDY and AEC against the read/write path. A safe
path-independent lower bound may conservatively mark the complete BA-low-through-AEC-release
window unavailable, but labels it a progress bound and unions overlaps rather than calling every
slot a stolen phi2 cycle.

The line table also names the exact display-enable/badline-eligible raster window for the selected
VIC revision; a generic “visible line” range is insufficient. For the pinned 6569, 6567R56A, and
6567R8 timing baseline, badlines are eligible only in raster `$30–$F7`, and DEN must have been set
during raster `$30`; later target profiles must restate rather than inherit that window.

Instruction nominal cycles are then fitted to the actual path and placement. Average frame time,
an IRQ's source line alone, or a source-level “small loop” is not proof.

### Sprite DMA

Each enabled sprite whose Y expansion/display state starts DMA consumes pointer and data fetch
slots on its active lines. Multiple sprites can overlap, reducing CPU slots and changing stable
raster entry. The scheduler needs enable/Y/expansion state, model, line, and the exact fetch table;
“eight sprites enabled” is not one constant penalty over the whole frame. [CSG-6567-318014,
sprite/DMA sheets; VIC-BAUER-2024, §3.8; NINE-AKESSON, sprite DMA and timing sections]

The later timing proof must use a model-specific line table and include BA lead time, instruction
stallability, badline overlap, and every candidate path. If the current line and sprite state are
not statically bounded, use a worst-case budget or reject a stable-region contract.

## VIC-II sprites

| Concern | Registers/storage | Rule |
|---|---|---|
| position | `$D000–$D00F`; X high bits in `$D010` | Shared X-MSB updates need one owner/shadow or atomic schedule; no per-sprite byte exists for the high bit. |
| enable | `$D015` | Treat all eight bits as one shared register. |
| Y/X expansion | `$D017` / `$D01D` | Expansion affects display/DMA timing and must be in the schedule facts. |
| multicolor | `$D01C`, `$D025`, `$D026`, `$D027–$D02E` | Per-sprite mode/color plus shared colors; do not infer one file-wide mode from SpritePad. |
| priority | `$D01B` | Sprite-behind-background is a shared bit register and interacts with foreground mask design. |
| collision | `$D01E` / `$D01F` | Reads return latched collisions and clear the latches; repeated/hoisted reads are not equivalent. |
| image pointer | active screen matrix bytes `$03F8–$03FF` relative to that matrix | Pointer selects a 64-byte block within the current VIC bank. |

Sprite bitmap bytes are 63 bytes; a 64-byte project/runtime record may use the final byte as
software attributes, but the VIC fetches its own 63-byte image pattern and pointer. The asset
contract must distinguish native software record layout from hardware-visible bytes. Pointer,
data, active screen, and bank changes must become visible before the scheduled fetch.

Multiplexing is not “write new Y positions sometime.” It requires sorted events, sufficient
distance after the prior display/DMA state, coordinated pointer/color/X-MSB/shared-register writes,
late/overrun policy, and mainline/IRQ ownership. See `c64-game-engineering.md`.

## Fine scrolling and display tricks

Fine X/Y fields shift the display within a character cell; coarse scrolling updates screen/charset
or bitmap data when the fine value wraps. Horizontal and vertical algorithms have different border,
badline, and update-window costs. A pointer flip can exchange aligned screen/charset/bitmap bases;
it cannot update Color RAM or manufacture the next coarse column/row.

Border opening, FLI, FLD, line crunch, VSP/AGSP, and sprite crunch depend on writes at narrow cycle
positions and often on undocumented or revision-sensitive internal behavior. They are never generic
peepholes or default optimizations. Expose them only through a named local contract that fixes
video model, line/cycle schedule, register ownership, banking/layout, IRQ exclusion, fallback, and
physical-QA status. [VIC-BAUER-2024, §3.14; FRAGILITY-AKESSON, named technique sections]

### VSP and silicon-sensitive effects

VSP/AGSP has a physical corruption risk on some machines. VICE success does not prove hardware
safety. A request must compare safer scrolling alternatives and opt into a stated compatibility
range; general C64 builds reject or avoid it. [VSP-AKESSON, VSP bug and safety discussion]

## CIA register effects and ownership

CIA1 at `$DC00` normally participates in keyboard/joystick and produces IRQ. CIA2 at `$DD00`
normally participates in serial/user-port/VIC-bank control and produces NMI. The same 6526 register
shape does not make their board-level ownership interchangeable. [CBM-C64-PRG-1982, printed
pp.101–102 and 320; MOS-6526-1981, register map]

Both CIAs expose the same 16-register shape at base `$DC00` or `$DD00`:

| Offset | Register | Offset | Register |
|---:|---|---:|---|
| `$00` | port A data (`PRA`) | `$08` | TOD tenths |
| `$01` | port B data (`PRB`) | `$09` | TOD seconds |
| `$02` | port A direction (`DDRA`) | `$0A` | TOD minutes |
| `$03` | port B direction (`DDRB`) | `$0B` | TOD hours/alarm |
| `$04` | timer A low | `$0C` | serial data (`SDR`) |
| `$05` | timer A high | `$0D` | interrupt control/data (`ICR`) |
| `$06` | timer B low | `$0E` | control A (`CRA`) |
| `$07` | timer B high | `$0F` | control B (`CRB`) |

The absolute address does not determine safe semantics by itself. Reads/writes at `$DC0D` and
`$DD0D`, for example, share the ICR effect class but acknowledge different interrupt domains.

### Ports and data direction

For each port bit, DDR `1` drives output and DDR `0` permits input. Port reads combine pin state
with the configured direction/outputs. Keyboard scanning drives a selected CIA1 port pattern and
reads the matrix through the other port; joystick lines are active low and share some matrix lines.
The scan contract preserves direction, output latch, joystick effects, and any concurrent owner.

On a stock C64, joystick port 2 drives CIA1 PA0..PA4 and joystick port 1 drives CIA1 PB0..PB4. In
both cases bit 0 is up, bit 1 down, bit 2 left, bit 3 right, and bit 4 fire; a zero means asserted.
CIA port reads observe pin state even for output-configured bits. A direct joystick read is valid
only when the selected port's output latch/DDR state has released the five lines high or configured
them as inputs, and when a keyboard scan or another device is not actively pulling the shared
lines. Preserve bits 5..7, both DDRs, and both output latches; a five-bit joystick value is a mask
of the port read, not permission to overwrite it.

For keyboard scanning, CIA1 port A selects one active-low column and port B reads active-low rows.
This is the exact `(PA column, PB row)` matrix used by the named-key API:

| PB row | PA0 | PA1 | PA2 | PA3 | PA4 | PA5 | PA6 | PA7 |
|---:|---|---|---|---|---|---|---|---|
| PB0 | Delete | 3 | 5 | 7 | 9 | `+` | `£` | 1 |
| PB1 | Return | W | R | Y | I | P | `*` | Left Arrow |
| PB2 | Cursor L/R | A | D | G | J | L | `;` | Control |
| PB3 | F7 | 4 | 6 | 8 | 0 | `-` | Home | 2 |
| PB4 | F1 | Z | C | B | M | `.` | Right Shift | Space |
| PB5 | F3 | S | F | H | K | `:` | `=` | Commodore |
| PB6 | F5 | E | T | U | O | `@` | Up Arrow | Q |
| PB7 | Cursor U/D | Left Shift | X | V | N | `,` | `/` | Run/Stop |

The matrix has no per-key isolation, so multiple keys can ghost. Joystick states can also appear
as matrix closures. A combined-input API must use a declared scan sequence and expose ambiguous
combinations rather than inventing a key. A constant joystick test lowers to one port read and mask
when its ownership preconditions hold. A constant key test lowers to its one-low PA mask and PB bit
test. Debounce, repeat, and a full snapshot are separate source-selected policies; none implies a
hidden scheduler or runtime. `RESTORE` is an NMI source rather than a matrix key. `SHIFT LOCK`
mechanically holds the left-shift matrix line and therefore is not a separate coordinate.

One bounded stock-C64 keyboard-only baseline gives CIA1 exclusive ownership for the scan: set
`DDRA=$FF`, `DDRB=$00`; write each of the eight one-low column masks to `$DC00`; read one row byte
from `$DC01` after each write; then restore the declared idle column value and prior profile state.
An unrolled snapshot with absolute result stores costs 130 cycles and 103 bytes before any
save/restore required by a non-exclusive caller: 12 cycles/10 bytes for DDR setup, eight
14-cycle/11-byte row samples, and 6 cycles/5 bytes to restore `$DC00=$FF`. This exact candidate is
invalid when a joystick or another owner may pull shared CIA1 lines unless the selected combined
scan contract accounts for and filters those states. Joystick-only or combined profiles use their
own CIA1 sequence and cost; none may touch CIA2 `$DD00/$DD02`. [MOS-6526-1981, port/DDR sections;
CBM-C64-PRG-1982, printed p.93 and pp.343–344]

Never use CIA2 as though it were the keyboard CIA or rewrite `$DD00` without preserving the VIC
bank and other owned pins. A robust platform API uses explicit masks and either exclusive ownership
or a synchronized shadow byte.

### Timers and control

Each CIA has two 16-bit down-counters with latches. Timer A can count PHI2 or CNT events. Timer B can
count PHI2, CNT, Timer-A underflows, or Timer-A underflows gated by CNT. Control registers select
start, one-shot/continuous, port output, and force-load behavior. Byte order and running/stopped
state matter when updating a latch/counter; a generic volatile `word` read or store is not a
complete atomic-timer API. [MOS-6526-1981, printed pp.3–5]

A timer API states whether it observes the current counter or programs the latch, the update
sequence, start state, first-underflow timing, and whether an IRQ can intervene. Stable scheduling
uses the selected CIA clock source and revision-bounded edge behavior, not merely the 16-bit value.

`CRA` has bit 0 `START` (`1` starts), bit 1 `PBON` (`1` exposes timer-A output on PB6), bit 2
`OUTMODE` (`0` pulse, `1` toggle), bit 3 `RUNMODE` (`0` continuous, `1` one-shot), bit 4
write-strobe `LOAD`, bit 5 timer-A input select (`0` PHI2, `1` CNT), bit 6 serial-port direction
(`0` input, `1` output), and bit 7 TOD input select (`0` 60 Hz, `1` 50 Hz). `CRB` has the same
bits 0..4 for timer B and PB7; bits 6:5 select PHI2 (`00`), CNT (`01`), timer-A underflows (`10`),
or timer-A underflows while CNT is high (`11`); bit 7 selects TOD-clock writes (`0`) versus alarm
writes (`1`). `LOAD=1` commands a transfer from latch to counter and must not be treated as
persistent shadow state. [MOS-6526-1981, printed pp.3–5 and 8]

### Interrupt control

CIA ICR at offset `$0D` has different read and write meanings:

- bits 0..4 identify timer A underflow, timer B underflow, TOD alarm, serial-port completion, and
  an active-low FLAG event respectively; bits 5..6 are unused;
- reading returns those latched source bits plus bit 7 when an enabled source caused the interrupt, and
  clears the returned interrupt data/IRQ condition;
- writing uses bit 7 as set/clear control for each mask bit written as one; it is not a stored byte
  assignment; and
- pending source state and mask state are distinct.

One ICR read may return and clear several simultaneously latched source bits. Masking the returned
value afterwards does not turn it into “acknowledge only one source”; the other returned latches
have already been cleared.

Therefore CSE, duplicated reads, RMW, and a read-mask-write idiom are invalid unless the exact device
operation calls for them. Acknowledge/enable/disable methods lower to exact reads or immediate
writes with preserved volatile count/order. [MOS-6526-1981, printed p.6]

### TOD, serial, and FLAG bounds

TOD has latch/alarm and 50/60 Hz configuration semantics; individual byte access can latch or stop
parts of the clock. The serial shift register, CNT/SP pins, and FLAG input can also generate or
share interrupts. A game profile may omit high-level APIs for unused facilities, but exclusive IRQ
or NMI ownership must still prove they are disabled or handled. CIA revision-specific timer/TOD
races require exact test evidence and targeted physical QA rather than a generic guarantee.

## SID register and revision model

### Stable digital contract

The three voice blocks start at offsets `$00`, `$07`, and `$0E` from SID base `$D400`. Within each
block, offsets +0/+1 are frequency low/high, +2/+3 are the 12-bit pulse-width low byte and low four
bits of the high byte, +4 is control, +5 attack/decay, and +6 sustain/release. Control bits 0..7 are
`GATE`, `SYNC`, `RING`, `TEST`, triangle, sawtooth, pulse, and noise. Attack/decay and
sustain/release each put the first named four-bit value in the high nibble and the second in the low
nibble.

The global register map is exact:

| Offset/address | Fields |
|---|---|
| `$15` / `$D415` | filter-cutoff bits 2..0 in bits 2..0; bits 7..3 are unused |
| `$16` / `$D416` | filter-cutoff bits 10..3 |
| `$17` / `$D417` | resonance in bits 7..4; external input and voices 3..1 routed to filter in bits 3..0 |
| `$18` / `$D418` | voice-3 direct-output disable, high-pass, band-pass, and low-pass in bits 7..4; master volume in bits 3..0 |
| `$19` / `$D419` | paddle X, defined read source |
| `$1A` / `$D41A` | paddle Y, defined read source |
| `$1B` / `$D41B` | oscillator 3/random, defined read source |
| `$1C` / `$D41C` | envelope 3, defined read source |

In `$D417`, bits 0, 1, 2, and 3 route voice 1, voice 2, voice 3, and the external input
respectively. In `$D418`, bits 4, 5, 6, and 7 select low-pass, band-pass, high-pass, and voice-3
disable respectively. This explicit ordering prevents the common reversed-mode-bit error.
[MOS-6581-SID, register map and programming sections]

Only POTX, POTY, oscillator 3, and envelope 3 are defined read sources in the normal register map.
Do not assume that reading a write-only SID register returns its last written value. Named field
updates use a software shadow where preservation is needed, or write a complete known byte.
The stock single-SID profile therefore permits ordinary reads only from `$D419–$D41C` and writes
only to `$D400–$D418`. Register mirrors, additional SID endpoints, and C64U virtual chips exist only
when the selected target profile declares their exact topology; they are never inferred from an
address pattern.

Gate sequencing is observable: starting an envelope requires the intended gate transition; merely
rewriting an unchanged gate-on control byte is not a universal retrigger. Test/noise/combined-waveform
use and very fast gate changes need bounded player or silicon evidence. Frequency constants depend
on the selected clock/video standard.

### 6581 versus 8580

The 6581 and 8580 differ in filter response, combined waveforms, bias/leakage, volume-DAC behavior,
and other analogue/revision characteristics. ADSR timing also has known edge behavior not captured
by a simple ideal envelope formula. The compiler may validate declared model compatibility and
preserve exact register scheduling; it cannot promise that one register trace sounds identical on
all chips and boards. [MOS-6581-SID, documented baseline; LIBSIDPLAYFP-3.1.1,
`reSIDfpEmu::{write,clock,model}`; SRC-003 in `source-manifest.md`]

Model metadata has four useful states: 6581, 8580, either, and unknown. Unknown is not either. A
callable player contract must close unknown clock/model/topology fields without contradicting
specific PSID metadata; otherwise the asset may be embedded but not called as qualified audio.

### Scheduling and ownership

A SID player contract declares exact init/play/SFX entry points and ABI, selected video cadence,
SID endpoints, writable/self-modifying ranges, ZP/SFA/stack use, register/flag clobbers, voice
ownership and arbitration, tables, code/data bytes, and IRQ/mainline concurrency. A PSID header
describes a container; it does not prove an SFX API or the callable ABI of arbitrary payload.

The source program owns tick scheduling. The compiler does not inject a generic mixer, scheduler,
name table, copied payload, or hidden runtime. Constant operations lower directly through a
hash-bound adapter contract. See `c64-game-engineering.md#music-and-sound-effects`.

## Volatile and RMW policy

Classify every mapped register operation before optimizing:

| Class | Examples | Required preservation |
|---|---|---|
| ordinary full-byte write with known value | border color `$D020`, background `$D021` | exact write count/order; no read needed |
| shared bitfield register | `$D010`, `$D015–$D01D`, CIA ports | preserve other owners through a proven shadow or synchronized sequence |
| write-one-to-clear | VIC `$D019` | exact selected one bits; never generic “store updated value” semantics |
| read-to-clear/acknowledge | CIA ICR, VIC collision latches | one intentional read at the intended point; do not hoist, duplicate, or eliminate |
| different read/write meanings | CIA ICR; raster compare/current raster fields | typed methods, not an ordinary mutable byte abstraction |
| write-only state needing partial update | most SID controls | software shadow or complete known write; no fabricated readback |
| timing-sensitive write | `$D011/$D016/$D018`, sprite scheduling, SID player writes | exact cycle/path window in addition to order/count |

An optimizer must preserve address identity, width, access direction, count, order, bus pattern,
and timing when declared observable. An instruction with fewer bytes is a defect if it changes any
of these.

## Zero-cost platform API examples

These are semantic shapes, not a frozen namespace:

| Intent | Acceptable expert-parity lowering |
|---|---|
| `vic.borderColor.set(5)` | `LDA #$05; STA $D020`, or only the `STA` when A is already proven 5 and reusable; no call/temp/read |
| acknowledge raster | direct write of `$01` to `$D019`; exact A/flag cost reported |
| enable one sprite | update an owned compile-time-known/shared shadow then one `$D015` write; a raw RMW is accepted only with proof |
| select VIC screen/charset | link-time-derived `$D018` constant and one coordinated write after alignment/bank validation |
| CIA mask enable | write `$80 | bits` to ICR; no preceding read |
| CIA mask disable | write `bits` with bit 7 clear; no preceding read |
| SID voice control update | full known control byte or shadow-based write; never read a write-only register |

Wrappers with hidden calls, duplicated volatile accesses, generic dispatch, runtime address
calculation for link-time facts, or data copies fail the zero-cost standard.

## Future proof specifications

No emulator or hardware is run in this skill-creation phase. A later proof binds VICE 3.10
`x64sc`, exact C64 model, video standard, VIC/SID/CIA model, ROM set, options, binary hash, initial
state, stop condition, and monitor/trace observation.

| Claim family | VICE observable | Required targeted physical QA |
|---|---|---|
| raster/badline/sprite schedule | IRQ entry cycle, BA/AEC-derived CPU availability or accepted test signature, register-write cycle, overrun marker | cycle-exact release kernels and model/revision generalization |
| VIC/CIA acknowledgements | exact access address/direction/count/order and pending-line transition | CIA edge/race or documentation/emulator disagreement |
| input scan | driven/read port values, DDR restoration, VIC-bank preservation | unusual controllers/electrical sharing |
| SID adapter | exact init/tick/SFX calls and ordered register trace on selected model | audible/filter/combined-waveform/6581–8580 claims |
| VSP/AGSP and aggressive display | configured-emulator output plus corruption/error markers | mandatory compatible and at-risk real machines; never universalized |

Report unexecuted specifications as future evidence, not as a pass. Report completed emulator-only
silicon claims as `VICE-verified / hardware-unverified` until the physical boundary is closed.

## Decision checklist

- Is the exact device/model context explicit?
- Did nominal CPU cycles get reduced by badline and sprite-DMA availability?
- Are shared registers, read-to-clear, write-one-to-clear, and write-only behavior represented?
- Does every mode/base/pointer value derive from placed data rather than force a copy?
- Are CIA1/CIA2, IRQ/NMI, and port ownership kept distinct?
- Does audio separate SID register facts, player ABI, PSID metadata, and analogue QA?
- Does each risky display technique require a narrow contract and real-hardware boundary?
