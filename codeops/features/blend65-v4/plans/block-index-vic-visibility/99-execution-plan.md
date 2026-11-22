# A block the video chip can actually read

> **Owner**: T-159 (#159), visibility slice · **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Status**: Complete for automatic placement; explicit placement blocked by the missing warning contract
> **Progress**: 5/5 tasks in scope (100%)
> **Last Updated**: 2026-11-22

## What was actually wrong

The session opened expecting a diagnostic question. It was not one. The compiler was choosing
sprite-block homes the hardware cannot read.

Measured before any change, on `c64-pal-prg-kernal-6581`:

| Program | Where the buffer landed | What the VIC sees |
| --- | --- | --- |
| Automatic placement, nothing below it | `$0A80` | correct |
| Automatic placement, pushed up by other data | **`$1400`** | character ROM, not the buffer |
| Automatic placement, more data below it | **`$1E00`** | character ROM, not the buffer |

The VIC fetches only inside its own 16K bank, and inside `$1000-$1FFF` it reads character ROM
instead of the RAM underneath. The alignment pass proved the buffer 64-aligned, then placement put
it in that window. Nobody asked for that address — the compiler picked it. A sprite pointing there
displays character shapes, and the program builds without a word.

That is not a missing diagnostic. It is the compiler getting the answer wrong, and it needs no
diagnostic to fix: state the demand and placement satisfies it.

## The fix

A block index already caused one demand to be recorded against its object: 64-byte alignment. It
now records a second, VIC visibility, which placement already knows how to satisfy — the region
`c64.vic.bank0-ram` keeps an object inside the bank and steps it over the character-ROM window.
Both the region and the recovery already existed for load destinations, so this is the same
statement made by one more consumer rather than new machinery.

| Program | Before | After |
| --- | --- | --- |
| Automatic, pushed up | `$1400`, invisible | `$2040`, visible |
| Automatic, more data below | `$1E00`, invisible | `$2000`, visible |

## Only a proved consumer, which cost a correction mid-session

The first implementation attached visibility to the *shape* `&x / 64`, as the alignment demand
already does. A probe showed what that means: `poke($C000, lo(&buffer / 64))` — ordinary address
arithmetic with no hardware consumer at all — had its buffer moved too. Confining an object to
`$0200-$0FFF` or `$2000-$3FFF` because of how the author divided a number is a new restriction on
ordinary arithmetic, which both issues explicitly forbid.

So visibility is gated on proof that the video chip receives the value: the computed block number
must reach a `c64.vic.*` capability as an argument, followed through the narrowing `lo(...)` that
a block index normally passes through on the way. Alignment keeps its existing shape-driven
behavior; only the new demand is consumer-gated.

The third oracle case pins this as a statement about the consumer rather than about `/ 64`: the
same program with `poke` instead of `setSpritePointer` keeps a different, unmoved address.

## What is deliberately still silent

An explicit `place(at:)` the chip cannot reach is accepted exactly as written.

This is not an oversight and it is not laziness; it is the same wall that blocks #158. Two frozen
oracles pin the acceptance:

| Oracle | Witness | Pins |
| --- | --- | --- |
| `test/rd04/block-index-alignment.spec.test.ts:170-185` | `place(at: $0B50)`, misaligned | accepted |
| `test/rd04/block-index-immediate-fold.spec.test.ts:74-80` | `place(at: $C040)`, outside the bank | accepted, runtime path kept |

The second was found by running the tests, not by reading them: an earlier draft of this change
did apply the demand to explicit placements, and that oracle refused it. Since the program is
accepted today and that acceptance is pinned, reporting it could only ever be a warning — and no
warning contract for a hardware advisory exists. That is exactly errata **E-10**, which now covers
two instances of one missing contract rather than one.

So the honest statement is: where the compiler chooses the address, it now chooses a reachable one;
where the author chooses it, the compiler still says nothing, and that silence has a named owner.

## Tasks

- [x] **T-159.6a Measure the real behavior.** Probe automatic and explicit placement against the
      bank and the character-ROM window rather than inheriting the issue's framing.
- [x] **T-159.6b State the visibility demand.** One region demand on the object, satisfied by the
      placement machinery that already serves load destinations.
- [x] **T-159.6c Gate it on a proved consumer.** Correcting the first attempt, which moved ordinary
      arithmetic.
- [x] **T-159.6d Oracle.** Four profiles, including the counter-case that keeps the claim honest.
- [x] **T-159.6e Verify, and record what stays silent.**

## Verification

| Check | Result |
| --- | --- |
| New four-profile oracle | **16/16** |
| Block-index oracles (alignment, runtime, immediate fold) | **96/96**, including both frozen explicit-placement witnesses |
| Compiler package: semantic and layout | **44 files / 644 tests** |
| Compiler package: machine, services and frontend | **158 files / 2,770 tests** |
| Root tier: all of rd04, both size frontier guards, the optimizer pair | **70 files / 951 tests** |
| `spec/` | untouched; no diagnostic code added or changed |

No emitted-byte claim is made and none is possible: moving an object changes addresses by
construction. What is held instead is that every size frontier guard and every artifact oracle
still passes, so nothing grew.

## One unrelated thing removed

`machine/lower-operation.ts` carried an env-gated `console.error` in the division lowering path —
debug scaffolding from the fold work, printing to stderr in a production code path. It is deleted.
It was in the seam and was not going to be noticed from anywhere else.

## Stop conditions observed

No specification file and no frozen oracle was edited; the one new oracle is additive. The pass
still emits no diagnostic of its own. Ordinary address arithmetic is provably untouched, which the
oracle checks rather than asserts.
