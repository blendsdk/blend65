# Frame unwind in the flag proof — and the fixed-address local that needed no home

> **Owner**: T-45 · **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Status**: Complete
> **Progress**: 4/4 tasks (100%)
> **Last Updated**: 2026-11-21
> **Related**: [chained-nmi-retention-proof](../chained-nmi-retention-proof/99-execution-plan.md)

These two changes are recorded together because they were the two prerequisites the chained-NMI
retention admission turned out to have. Each stands on its own and each shipped separately.

## Part one — a one-byte read of a fixed address may stay in the accumulator

The register-only rule omits the home of an interrupt local whose whole life is an adjacent
read-then-store pair, but it admitted only a platform capability from the forwardable set. An
ordinary one-byte read of a fixed address was excluded, although its selection is the same single
load into the same register.

The exclusion cost more than a byte. A handler on a cooperative interrupt route is admitted only if
it leaves no invocation-private home behind, so a local that could have lived in the accumulator and
did not was a local that refused its handler's route outright. A chained handler holding exactly one
such local — a byte read from an address and written straight back out, needing no storage whatever
— was rejected, while the same handler written without the name built.

The two shapes are now admitted on the one fact they share, in a named helper: each is selected as a
single load, so in both the byte is in the accumulator when the read finishes, which is the entire
requirement for omitting the home. A read whose address is computed stays out, because its selection
builds a pointer and may route the byte through an index register. The stack-retention proof's own
in-accumulator test already admitted both shapes and now shares that helper rather than restating
it.

### Why the read is undisturbed

The proof this needed was already in place. The existing adjacency requirements forbid anything but
compile-time constants between the read and its store, and anything but constants and one permitted
peer load between the load and its single consumer, so the read keeps its exact position and its
single occurrence. The only thing that disappears is the memory the byte was being parked in. If a
value turns out not to be in the accumulator, lowering refuses rather than guesses.

### Not permissiveness

| Shape | Outcome | Why |
| --- | --- | --- |
| One local, read then written | **elided**, no private home | The byte never has to outlive the accumulator |
| The same with a masked or tested consumer | **elided** | Both sit inside the permitted gap |
| A second use of the local | **not elided**, charges its slot | The byte must survive past its first consumer |
| Two locals with crossed lifetimes | **not elided**, charges two slots | Two bytes live at once |
| A computed-address read | **refused** | The value is not reliably in the accumulator |

## Part two — following a generated frame unwind

An interrupt handler retaining seven or more bytes was refused outright, with a compiler limitation
reported at the `plp` that restores the caller's status.

The generated code was correct throughout. Beyond six retained bytes the unwind stops popping one
byte at a time and raises the stack pointer in one go, which is six bytes against seven or more. The
flag proof treated every write to the stack pointer as making the whole stack unknowable — the right
answer in general, because the new pointer is usually a value it knows nothing about — and so forgot
the status snapshot the entry had saved beneath the frame. A route that returns from the interrupt
never noticed, because its terminal instruction restores the status itself. A route that hands over
to a previous handler has to restore the status with an explicit `plp` first, and that `plp` then had
nothing to draw on.

The released byte count is known where the unwind is emitted and nowhere afterwards, so it is
recorded on the instruction instead of left to be re-derived from the surrounding arithmetic.

### The subtlety that decided it

The first attempt subtracted the recorded count from the depth at the write-back, and failed in a way
that looked identical to the original bug. Instrumenting the model against the instructions showed
why: the count is relative to the base the matching capture took. The emitted sequence reads the
topmost slot with a pop in between, and because the new pointer is computed from the captured base
rather than from the current one, that pop is silently restored by the write-back. Subtracting from
the current depth released one byte too many and walked the model off the end of the frame.

The proof now takes the same two steps the instructions take: remember the depth at the transfer out
of the pointer, and set it back from there. The field's documentation says so explicitly, because
anything else consuming it has to apply it the same way.

No bound was invented. The figure is the lowering's own computed depth.

### Still conservative where it has to be

| Case | Outcome |
| --- | --- |
| A pointer write with a recorded release | Exactly that many entries dropped, measured from the captured base; everything beneath keeps its facts |
| Any other pointer write | The stack is forgotten entirely, as before |
| A recorded release larger than the captured base | Refused, rather than accepted on a negative depth |

### Measured

| Subject | Before | After |
| --- | --- | --- |
| Retained depth a chained handler can emit | 1–6, then unemittable | **1–12**, balanced throughout |
| Charged hardware stack at nine samples, chained | not emitted | **15** |
| Charged hardware stack at nine samples, exclusive | 14 | 14, unchanged |

One byte apart, which is the difference between the two routes' declared entry frames of seven and
six — predicted before measuring and then measured.

## Tasks

- [x] **T-45.1 Trace the consumer.** Establish that machine lowering keeps a fixed-address read in
      the accumulator, and that it refuses rather than miscompiles if a value is not there.
- [x] **T-45.2 Widen the elision.** Admit both read shapes through one named helper, and have the
      retention proof's own test share it.
- [x] **T-45.3 Find the real limitation.** Separate the correct generated code from the modelling
      gap, by instrumenting the proof rather than reading the emitted bytes.
- [x] **T-45.4 Follow the unwind.** Record the released count where it is known and apply it from
      the captured base, with the conservative answer kept for every other pointer write.

## Verification

| Check | Result |
| --- | --- |
| New elision controls, asserted on the memory map rather than on a size | **5/5** |
| New flag-proof controls: three depths, an unrecorded pointer write, an over-large release | **5/5** |
| Emulator proof of the elision, through a real CIA2 Timer A interrupt | **1/1** |
| Frozen interrupt oracles while part one shipped alone | **630/630**, unmoved |
| Compiler machine, services and layout tiers | **2,354/2,354** |
| All seven examples, four modes, after each part | **byte-identical** |

The elision controls assert the memory map, not a byte count, so a silent fallback to a private home
could not pass by behaving correctly for the ordinary reason. The emulator proof carries a
runtime-seeded byte through a real interrupt, where a dropped read publishes zero and a read left in
the wrong register publishes something else.

## Stop conditions observed

No frozen oracle was edited by either part and no specification file was touched. Part one shipped
with the retention gate still closed, and the frozen interrupt family was confirmed unmoved at that
point, so its effect is attributable on its own rather than entangled with the admission that
followed.
