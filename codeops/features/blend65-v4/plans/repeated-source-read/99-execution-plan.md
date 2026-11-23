# Reading one source byte once

> **Owner**: [#180](https://github.com/blendsdk/blend65/issues/180) · **Type**: Task (lightweight)
> **CodeOps Artifact Schema**: 1
> **Status**: Complete for named module data; canonical reference unchanged by design
> **Progress**: 5/5 tasks in scope (100%)
> **Last Updated**: 2026-11-23

## What was wrong

One module byte was fetched from memory twice for a single value, with nothing
but a store to somewhere else standing between the two reads:

```asm
lda seed          ; 3 bytes / 4 cycles
sta first         ; writes neither A nor any flag
lda seed          ; 3 bytes / 4 cycles of nothing
sta second
```

Measured on three witnesses at every optimization goal, bounds checks off and
on, before anything was changed.

## Why this one needed no flag proof

The preceding `LDA` already set N and Z from the very byte the repeat would
fetch, and a store writes no register and no flag. So by the time the second
load would run, the accumulator already holds the byte **and the flags already
describe it**. Dropping it is architecturally a complete no-op, not a value the
consumer could merely have taken from a register.

That is the whole difference from the delivery repaired alongside it, where the
omitted load's flags had to be proved dead across a control edge. Here there is
nothing to prove about flags at all, and what remains is the one thing generated
code cannot settle from its own instructions: whether anything can write the
source in between. Only an interrupt can run there, so the existing adjacency
proof carries the entire weight.

## The fix

A new admission, `canOmitRepeatedSourceLoad`, stated on its own terms beside the
capture window rather than as a widening of it. The two proofs run in opposite
directions and cannot both fire: the older one removes a reload of the home a
store just filled and is proved **from the store**; this one removes a repeat of
a read and is proved **from the earlier load**.

Conservative on everything it cannot establish from the instructions themselves:

| Shape | Answer | Why |
| --- | --- | --- |
| `lda S; sta elsewhere; lda S` | omit | A and N/Z already hold S |
| Canonical `none` construction | retain | the reference a build is measured against |
| An installed interrupt handler | retain | a handler can write S in between |
| The store writes `S` itself | retain | the source is gone |
| Any raw or volatile access in the window | retain | a volatile read is two bus accesses by contract |
| Either read reached through an index register | retain | the byte depends on a register |
| The two reads addressed differently | retain | not provably one byte |
| A different name, or another byte of the same object | retain | a different byte |
| One byte of an address, or a layout-resolved relation | retain | not a plain data byte |
| The repeat is the operation's only instruction | retain | a different claim from this one |

A call cannot appear inside the window at all: the proof looks at exactly three
adjacent instructions.

## Measured result

Three witnesses, four profiles, bounds off / on:

| Witness | `none` | optimized before | optimized after |
| --- | ---: | ---: | ---: |
| Two plain stores of one source | 111 | 103 | **100** |
| Masked second read | 115 | 107 | **104** |
| Shifted operand and its count | 131 | 131 | **128** |

Three bytes and four cycles on every repeat, identical at `balanced`, `speed`
and `size` and unaffected by bounds checking. Canonical `none` is byte-identical.

The delivered shape is what an expert would have written by hand:

```asm
lda seed
sta first
sta second
```

Every refusal witness is byte-identical before and after: a store to the source,
a call between the reads, an installed handler, a raw write between the reads, a
private-home source, and a volatile hardware source.

## Tasks

- [x] T-180.1 Measure the filed witness and seven controls at all four goals, bounds off and on.
- [x] T-180.2 Confirm which operation emits the repeat before designing the admission.
- [x] T-180.3 Author the admission beside the capture window, wired at the existing call site.
- [x] T-180.4 Author the four-profile oracle, proved red before the fix, and the unit cases.
- [x] T-180.5 Compiler, host and root checkpoints.

## Acceptance

| Area | Oracle |
| --- | --- |
| Two destinations, one source | `lda seed; sta first; sta second` exactly |
| Repeat feeding arithmetic | the mask consumes the byte already held |
| Shifted operand sharing a source | the source is read once |
| Every optimized goal | `speed` and `size` read it once as well |
| Bounds checks on | the same single read, measured not assumed |
| Canonical reference | `none` still reads the source twice |
| Store to the source | both reads survive |
| Call between the reads | both reads survive |
| Installed handler | both reads survive |
| Volatile hardware source | both accesses survive |

## Verification

| Tier | Result |
| --- | --- |
| Oracle red before the fix | 20 failed / 20 passed — every failure a delivery case, every pass a retention control |
| `test/rd04/repeated-source-read.spec.test.ts` | 40/40 on four profiles |
| `byte-capture-observers.impl.test.ts` | 45/45, every new guard proved load-bearing by removal |
| Compiler machine tier | 90 files / 1,252 |
| Compiler services + frontend | 68 files / 1,553 |
| Compiler storage, semantic, layout, project, artifacts, assets, target, tools | 103 files / 1,623 |
| Root host tier | recorded below |

Each guard was removed in turn and failed exactly its own cases and nothing else:

| Guard removed | Cases that failed |
| --- | --- |
| Lone-instruction refusal | the lone instruction |
| Memory-effect refusal | the three raw and volatile windows |
| Repeat addressing mode | the indexed read and the mismatched pair |
| Store addressing mode | the indexed store |
| Same named byte | the different name and the different offset |
| Store writes elsewhere | the store to the source |
| Asynchronous interleaving | the installed handler |

## Residuals

Two shapes are the same waste and are refused for two different reasons. Both
were measured, and neither is hidden behind the delivered case.

**A private or parameter home read twice.** A local and a parameter both live in
a compiler-chosen home rather than named data:

```asm
lda $04         ; a local, or an incoming parameter
sta $02
lda $04         ; 2 bytes / 3 cycles of nothing
and #$07
```

Named data is proved disjoint from a compiler-chosen home by allocation, which
is what lets this unit compare two operands and stop. Two private homes need a
different argument — that distinct requests cannot share one final address while
both are live — so it is not folded in on an assumption.

**An aggregate element read twice.** The byte is named module data and the
operand comparison would admit it:

```asm
lda data + $0002
sta first
lda data + $0002   ; 3 bytes / 4 cycles of nothing
sta second
```

It is refused by the lone-instruction guard instead. A whole-binding load
contributes no instructions of its own, so its `LDA` arrives at the head of the
consuming operation and there is always something left after the drop. An
element load emits that `LDA` as its own only instruction, so omitting it would
leave an operation contributing no code at all. The compiler already does
exactly that elsewhere, when an incoming edge proves A still holds the byte, so
the shape is precedented rather than forbidden — but it is a different claim
from the one proved here and needs its own measurement.
