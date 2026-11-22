# Reading a byte the store beside it just wrote

> **Owner**: #123, with rulings recorded for #115 and #116 · **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Status**: Complete for the optimized candidate; canonical reference deliberately unchanged
> **Progress**: 5/5 tasks in scope (100%)
> **Last Updated**: 2026-11-22

## What was wrong

An ordinary typed guard emitted a load it did not need:

```asm
lda seed
sta ordinal
lda ordinal     ; the store already left this byte in A
cmp #64
bcs reject
```

`STA` changes neither the accumulator nor any flag, so the comparison can use
what the store wrote. The second load is pure traffic.

Measured on the issue's own program before any change, and reproduced at every
optimization goal including `balanced` — this was not a `none`-tier artifact.

## The fix

The machinery that omits exactly this window already existed. Eligibility simply
required the producer to be a **volatile raw memory read**, which an ordinary
typed load is not: it carries no memory effect at all, which is precisely what
distinguishes the two. Both producers are now admitted, each proved on its own
terms rather than by relaxing one test into the other.

| Goal | Before | After |
| --- | ---: | ---: |
| `balanced`, `speed`, `size` | 247 bytes | **245 bytes** |
| `none` | 240 bytes | 240 bytes, unchanged by design |

The saving is two bytes rather than the three the issue projected, because the
candidate construction homes this local in zero page where the issue measured an
absolute address. No claim is made about the whole-input limits.

## Why the two producers keep separate proofs

A raw read names a fixed address which may turn out to be the very home it is
about to fill. Its proof must exclude that aliasing and every other observer of
the address, and it exempts the capture's own read while doing so. That path is
untouched.

A typed load names its source through the type system and performs no raw access,
so there is no address to alias and no exemption to grant. Reusing the raw proof
would have been the obvious move and it was wrong twice over: it refuses the
issue's own witness, because the surrounding `data[i]` writes trip an
index-escape barrier that exists for the aliasing hazard this case does not have,
and passing it would have meant relaxing a barrier to suit the new caller.

What the typed case actually needs is narrower and is stated directly. The two
instructions are adjacent, so nothing generated runs between them; the only way
the home could change in between is an interrupt whose handler writes it. The
omission therefore requires that every reachable body and every executable
initializer is main-domain only — no author code runs asynchronously at all.

A program that installs a handler keeps its reload. Proving that a particular
handler cannot reach one particular compiler-chosen home is a different question,
and homes are not even allocated at this point, so it is not answered here.

## The canonical reference is left alone, deliberately

Only the optimized candidate omits the reload. `optimization: "none"` output is
byte-for-byte unchanged.

This repository has already recorded the rule, in the word-assignment forwarding
work: `none` is the reference contract a build is measured against, and an
improvement there moves the baseline rather than meets it — "not a defect and
must not be fixed". The issue's own text agrees, requiring canonical `none` to be
preserved absent a separately approved exception. Two oracles pin a none-tier
image hash, so an ungated change would also have broken them.

## Tasks

- [x] **Measure before trusting the filing.** All four goals, the issue's exact
      sources, instruction sequences and image sizes.
- [x] **Find the real gate.** The volatile-read requirement on the producer, not
      a missing proof.
- [x] **Prove the typed case on its own terms**, after confirming by probe that
      the raw proof both refuses the witness and would have to be weakened.
- [x] **Oracle**, one case per claim on four profiles, including a paired control.
- [x] **Verify, and record the two rulings this batch also owned.**

## Verification

| Check | Result |
| --- | --- |
| New four-profile oracle | **20/20** |
| Compiler package: machine, services and frontend | **158 files / 2,770 tests** |
| Compiler package: storage, semantic, layout, project and artifacts | **84 files / 1,393 tests** |
| Root tier, incl. every size frontier guard, the specification-integrity anchor and both none-tier hash oracles | **71 files / 979 tests** |
| `spec/` and every frozen oracle | untouched |

The oracle pins five separate facts rather than one: the reload gone; the home
kept, because the shift after the branch still reads it; the cross-block reload
after the branch retained, since the accumulator is not provably the byte once a
branch has been taken; the canonical reference untouched; and a live-handler
program that differs from its control in nothing but the handler, so the handler
is demonstrably what decides the outcome.

## Two rulings the batch also owned

### #115 — already delivered where optimization is requested

The issue's expert sequence is what the compiler emits today at `balanced`,
`speed` and `size`:

```asm
lda answer
clc
adc i
sta answer
```

The capture, its reload and its home are all absent. The redundant pair survives
only in canonical `none`, which is the frozen reference contract above, and the
issue's own text freezes it too.

Not asserted: **why** the two constructions differ. A trace showed the forwarding
selector admits the value in both, so the retention at `none` is enforced further
down the canonical path rather than by the selector declining. The byte-write
forwarding work is the corroborating record; the exact mechanism was not pinned
and is not claimed.

The issue's figures no longer resolve — it reported a 156-byte reference and a
116-byte selected image, where the same source now measures 165 and 151. That is
baseline growth since October, measured rather than inferred, and it is why the
instruction-level witness rather than the byte counts decided this.

### #116 — not reachable through any public build

The held-register form the issue describes, `stx snapshot` before the arithmetic,
does not appear at any optimization goal for the issue's own source: the counter
stays in RAM and the addition reads it from there. The `x`/`y` counter
representation exists only inside the size-candidate internals, whose tests
synthesize their input directly.

Claimed only as measured. A drivable path may exist — the issue's own
24-image baseline was produced somehow — so the issue stays open. The defect
becomes measurable through a public build exactly when the `size` candidate
construction completes, which is the dependency its row now names.

## Stop conditions observed

No specification file and no frozen oracle was edited; the one new oracle is
additive. The volatile-read path keeps identical semantics. Canonical `none`
output is unchanged on every profile. No claim is made against the whole-input
byte limits, which the issue itself insists neither filing nor a local meet can
close.
