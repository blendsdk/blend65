# Reading one element byte once

> **Owner**: [#184](https://github.com/blendsdk/blend65/issues/184) · **Type**: Task (lightweight)
> **CodeOps Artifact Schema**: 1
> **Status**: Complete; canonical reference unchanged by design
> **Progress**: 6/6 tasks in scope (100%)
> **Last Updated**: 2026-11-23

## What was wrong

An array element is declared module data, and the repeated-source admission's
operand comparison would have accepted it, but the omission was refused by a
different guard and the waste survived:

```asm
lda data + $0002
sta first
lda data + $0002   ; 3 bytes / 4 cycles of nothing
sta second
```

## Where the lda actually comes from, which the issue had the right of

A whole binding contributes no load of its own. Its byte arrives at the head of
the *consuming* operation, so dropping that head always leaves the rest of the
operation behind. A fixed element is different: it emits its load as its own only
instruction, so omitting the repeat means that operation contributes no generated
code at all, and the repeated-source admission refuses that outright rather than
reasoning about it.

A probe written to test the opposite hypothesis settled this. The element repeat
is refused even when it feeds arithmetic rather than a bare store — `lda data+2;
and #$07` is not a lone instruction — which rules out the consuming operation as
the place the load lives. The load belongs to the element read itself in both
cases.

## The route already existed

The question the issue left open was whether an operation contributing no
generated code is supported on this path, or whether the element load had to be
reshaped. It is supported, and not narrowly: five routes in the load lowering
already return no instructions and hand their byte over in the accumulator, and
one of them does so for exactly a constant-indexed element place. So this repair
is a sixth sibling beside them rather than a new capability.

The shape fact is settled where its neighbours are, over the semantic
operations: one fixed element read, then a store of that same byte to a different
object, then an identical read whose only consumer is adjacent. Reading the
emitted instructions was not an option — the load path is not handed the prefix
emitted before it — and reading the operations is the better fit anyway, because
a constant ordinal is what makes two reads provably the same element.

Three things that read as one condition are deliberately three. The store must
write the very byte the earlier read produced, which is what leaves that byte
still in the accumulator. It must write a different object, since the same one
would end the window. And the repeat must have a single consumer, so nothing else
depends on a load that is no longer there.

The two admissions that are not about shape are settled once per body rather than
at every element read: the omission belongs to the optimized candidate, and
nothing asynchronous may run between the two reads. Both come from the proof
already used by the declared-data admission.

## Measured before anything was changed

Nine witnesses, every optimization goal, bounds checks off and on, ACME 0.97, on
the four cooperative KERNAL PRG profiles. Each figure is a whole-image PRG size.

| Witness | Before | After | Saved |
| --- | --- | --- | --- |
| Two bare stores of one element | 110 | 107 | 3 |
| The repeat feeds arithmetic | 112 | 109 | 3 |
| Three readers of one element | 119 | 113 | 6 |
| Element zero, whose address carries no offset | 110 | 107 | 3 |
| The element is chosen at run time | 672 | 672 | — |
| The store writes the array being read | 112 | 112 | — |
| An installed handler can run between the reads | 186 | 186 | — |
| A call stands between the reads | 126 | 126 | — |
| A declared whole binding (delivered elsewhere) | 100 | 100 | — |

Three bytes and four cycles on every repeat, identical at `balanced`, `speed` and
`size`, and unchanged by bounds checking. The three-reader witness saves six,
which is the point worth noting: the window carries on past its own repeat rather
than firing once.

Of seventy-two generated artifacts compared as text before and after, exactly the
twenty-four that save differ — the four delivering witnesses at three optimized
goals with bounds either way — and the other forty-eight are byte-identical,
including every canonical `none`.

## No pinned answer moved, and that is a correction

The issue named the unit case `refuses a lone instruction whose head is the
repeat` as the one this work would move. It does not move, and should not. The
repair does not relax that guard; it delivers the element repeat on a different
path entirely, so the lone-instruction refusal remains the correct answer where
it is asked. That case is untouched and green, which makes it the one piece of
evidence that this repair reached its target rather than widening a neighbour.

## Tasks

- [x] T-184.1 Measure the filed witness and controls at all four goals, bounds off and on.
- [x] T-184.2 Establish where the element's load is actually emitted, by probe rather than by argument.
- [x] T-184.3 Establish whether an operation emitting nothing is already supported here.
- [x] T-184.4 State the repeat as a selection fact and consume it in the load path.
- [x] T-184.5 Author the four-profile oracle, proved red before the fix, and the unit cases.
- [x] T-184.6 Compiler, host and root checkpoints.

## Acceptance

| Area | Oracle |
| --- | --- |
| Two bare stores | `lda data + $0002`, `sta first`, `sta second` |
| The repeat feeds arithmetic | the mask applies to the byte already held |
| Three readers | one load, three stores |
| Element zero | read once, with no offset in the address |
| Every optimized goal | `speed` and `size` read it once too |
| Bounds checks on | the same single read, measured not assumed |
| Canonical reference | `none` still reads the element twice |
| A run-time ordinal | both reads kept |
| The store writes the array | both reads kept |
| An installed handler | both reads kept |
| A call between the reads | both reads kept |

## Verification

| Tier | Result |
| --- | --- |
| Oracle red before the fix | 24 failed / 20 passed — every failure a delivery case, every pass a retention or reference control |
| `test/rd04/element-repeated-read.spec.test.ts` | 44/44 on four profiles |
| `test/rd04/repeated-source-read.spec.test.ts` | 40/40, the declared-data shape unchanged |
| `test/rd04/private-home-repeated-read.spec.test.ts` | 36/36, the home shape unchanged |
| `lower-register-forwarding.impl.test.ts` | 30/30, every guard proved load-bearing by removal |
| Compiler machine tier | 92 files / 1,314 |
| `test/rd08/optimizer-saved-output.spec.test.ts` (VICE) | 17/17, including its byte-exact payload pins |
| Root host tier | 276 files / 5,881, green on the first run |

Each guard was removed in turn and failed exactly its own case:

| Guard removed | Case that failed |
| --- | --- |
| The whole-binding exclusion | the whole-binding read, which is removed on the other path |
| The constant-path requirement | the element reached through a run-time ordinal |
| The store writing the loaded byte | the store of some other value |
| The store writing a different object | the store into the array itself |
| The repeat having one consumer | the repeat with more than one consumer |
| The same-place identity | the repeat reading a different element |
| The read's own width | the two-byte read surrounded by single bytes |

Two notes on that table. The first mutation written for the whole-binding
exclusion silently matched an identical line in a neighbouring selection, so the
guard appeared redundant when it is not; repeated against its own line, it fails
its own case. And the read's own width is masked by the width checks on the store
and the repeat, so it is pinned by a window built by hand — no lowering produces a
two-byte read whose store and repeat are single bytes, but the width that decides
whether a byte lives in the accumulator alone is this read's own, not that of
whatever is done with it afterwards.
