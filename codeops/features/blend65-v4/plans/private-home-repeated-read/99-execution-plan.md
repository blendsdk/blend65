# Reading one home byte once

> **Owner**: [#183](https://github.com/blendsdk/blend65/issues/183) · **Type**: Task (lightweight)
> **CodeOps Artifact Schema**: 1
> **Status**: Complete; canonical reference unchanged by design
> **Progress**: 6/6 tasks in scope (100%)
> **Last Updated**: 2026-11-23

## What was wrong

The repeated-source admission delivered earlier removes a second read of one
byte when nothing but a store to somewhere else stands between the two reads. It
admitted declared module data and refused a compiler-chosen home, so the
identical waste survived whenever the source was a local or an incoming
parameter. The parameter form is the plainest:

```asm
lda $02
sta first
lda $02         ; 2 bytes / 3 cycles of nothing
sta second
```

## Why the refusal was right, and what it was missing

The delivered proof compares two operands and stops, and it can do that because
declared data and a compiler-chosen home are disjoint by allocation: a store to a
private home cannot be the byte a module global names, and two different names
are two different objects.

Neither half of that argument survives when the source is itself a home. The
question becomes whether two distinct storage requests can occupy the same final
address, which is a property of allocation rather than of the two instructions —
and nothing stops the allocator from giving one address to two homes whose
lifetimes do not overlap. Refusing was the honest answer, not a placeholder for a
fact already in hand.

## The fact that was missing, and where it comes from

An interference edge between two storage requests *is* the statement that they
can never share one address, and allocation is what enforces it. So the edges the
allocator was handed are now carried into lowering as
`MachineLoweringInput.storageInterference`, and the admission reads the answer
off them rather than inferring it from no conflict having been reported.

Two properties make that sound to consult during lowering rather than after it.
The graph is derived from the checked program, which lowering does not change.
And later allocation rounds only ever *add* edges — helper-call demand and
interrupt overlap both contribute more conflicts, never fewer — so an edge
present when the decision is made is present in the final placement too.

Carrying the edges was chosen over reading the provisional placement's addresses,
which looked simpler and is not sound: the same file re-allocates after lowering,
and two homes separated by first fit rather than by a conflict could be coalesced
in that later round. The candidate lowering also receives no placement at all, so
an address comparison would have silently never fired on that path.

`writesElsewhere` now settles all four pairings. Three of them need nothing new:
a home and declared data are placed apart from each other in either direction,
and two different declared names are two different objects. Only two homes
consult the graph, and they must additionally be different requests — a store to
the very home being read ends the window.

## Measured before anything was changed

Seven witnesses, every optimization goal, bounds checks off and on, ACME 0.97, on
the four cooperative KERNAL PRG profiles. Each figure is a whole-image PRG size.

| Witness | Before | After | Saved |
| --- | --- | --- | --- |
| A local read twice across a store to a second local | 147 | 145 | 2 |
| An incoming parameter read twice | 104 | 102 | 2 |
| Both homes still read after the window | 155 | 153 | 2 |
| Declared data read twice (already delivered) | 100 | 100 | — |
| The store writes the source home itself | 105 | 105 | — |
| An installed handler can run between the reads | 217 | 217 | — |
| Canonical reference for all of the above | — | — | byte-identical |

Two bytes and three cycles on every repeat from a zero-page home, identical at
`balanced`, `speed` and `size`, and unchanged by bounds checking. Of fifty-six
generated artifacts compared as text before and after, exactly the eighteen that
save differ — the three witnesses above at three optimized goals with bounds
either way — and the other thirty-eight are byte-identical, including every
canonical `none`.

## One pinned answer that moved, and it is not an oracle

`byte-capture-observers.impl.test.ts` carried
`refuses a window where the source is a private home rather than named data`.
That is an implementation test, not a specification oracle, and the issue named it
in advance as the one to move. It is now
`refuses a window where two private homes carry no stated conflict between them`
— the same window and the same refusal, named for the barrier that actually holds
it rather than for one that no longer does. No `*.spec.test.ts` oracle was edited
in this session.

## A guard that had to be pinned rather than deleted

Requiring the two requests to be different looked redundant: a real conflict
graph never names a home against itself, so removing that test changed no result.
Deleting it would have left the window's end resting on a property of another
subsystem's output rather than on anything stated here. It is kept, and pinned by
a case that builds a self-conflict by hand — the barrier then holds for whatever
a later pass might hand in, not merely for what allocation emits today.

## Tasks

- [x] T-183.1 Measure the filed witnesses and four controls at all four goals, bounds off and on.
- [x] T-183.2 Settle where a stated disjointness fact can come from, and why not from placement.
- [x] T-183.3 Carry the allocator's conflicts into lowering.
- [x] T-183.4 Extend the store's elsewhere proof to two homes behind that fact.
- [x] T-183.5 Author the four-profile oracle, proved red before the fix, and the unit cases.
- [x] T-183.6 Compiler, host and root checkpoints.

## Acceptance

| Area | Oracle |
| --- | --- |
| A local read twice | the repeat is gone, the byte in A is used as it stands |
| An incoming parameter read twice | `lda`, `sta first`, `sta second`, `rts` |
| Both homes still live | the repeat is gone and the later read survives |
| Every optimized goal | `speed` and `size` read it once too |
| Bounds checks on | the same single read, measured not assumed |
| Canonical reference | `none` still reads the home twice |
| The store writes the home itself | both reads kept, matching the reference |
| An installed handler | both reads kept |
| A call between the reads | both reads kept; the window cannot even form |

## Verification

| Tier | Result |
| --- | --- |
| Oracle red before the fix | 20 failed / 16 passed — every failure a delivery case, every pass a retention or reference control |
| `test/rd04/private-home-repeated-read.spec.test.ts` | 36/36 on four profiles |
| `test/rd04/repeated-source-read.spec.test.ts` | 40/40, the declared-data shape unchanged |
| `byte-capture-observers.impl.test.ts` | 60/60, every new guard proved load-bearing by removal |
| Compiler machine, services and storage tiers | 140 files / 2,433 passed, 2 skipped |
| `test/rd08/optimizer-saved-output.spec.test.ts` (VICE) | 17/17, including its byte-exact payload pins |
| Root host tier | 275 files / 5,837, green on the first run |

Each new guard was removed in turn and failed exactly its own cases:

| Guard removed | Cases that failed |
| --- | --- |
| The conflict-edge requirement | the moved case, no conflict stated, a conflict naming an unrelated pair |
| The address-byte check on a home operand | the source naming one byte of a home address, and the store doing so |
| The same-byte identity check | a different byte, another byte of the same object, another byte of the same home, a different home |
| The two requests being different | the constructed self-conflict |

## A control the measurement corrected

The call-between-the-reads witness was written expecting a refusal to pin, and
there is nothing to refuse: the window the proof reasons about spans one load,
one store and the repeat, and a call does not fit between them. The case now
pins what is actually true — the read after the call survives, and the window is
never a candidate — which is a weaker statement than the one first written and
the only honest one.
