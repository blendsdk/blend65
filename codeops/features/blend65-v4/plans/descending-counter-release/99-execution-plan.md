# Descending counter release — reaching the countdown idiom

> **Owner**: T-44 · **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Status**: Complete
> **Progress**: 5/5 tasks (100%)
> **Last Updated**: 2026-11-21
> **Predecessors**: [word-unit-increment](../word-unit-increment/99-execution-plan.md),
> [word-unit-decrement](../word-unit-decrement/99-execution-plan.md),
> [word-constant-step](../word-constant-step/99-execution-plan.md)

## Why

The three stepping units delivered the increment, the decrement and the constant step, and all
three recorded the same limit: the most common countdown in game code reached none of them.

```
for (let i: word = 1000; i > 0; i -= 1) { ... }
```

Such a counter was excluded from in-place whole-word forwarding, so every iteration computed its
update in a scratch pair and copied it back — and because it was never an in-place step, none of the
step selections could reach it either. The two savings were lost together, which is why this one
change is worth twenty-one bytes rather than nine.

## The exclusion, and the exact premise that was one-sided

A loop's control variable is excluded wherever it is written whenever its extent cannot be read.
That is sound: a variable a narrower representation might claim has to keep one consistent
representation across the whole loop, so the protection is about not fighting narrowing over the
counter's representation.

The one-sided part was how an extent could be derived. It came only from a less-than comparison
against a literal, and a countdown's test supplies no extent at all — `i > 0` is satisfied by one
and by sixty thousand alike. It bounds the counter from below and says nothing about how large it
gets. So the derivation failed and the conservative default protected the counter.

This was confirmed by instrumentation before anything was changed, rather than assumed: the
comparison reaching the recognizer is exactly `>` with a whole unsigned-word load on the left and
the constant zero on the right.

## What actually bounds a countdown

Where it starts. A variable seeded once with a literal and thereafter only ever reduced can never
exceed that literal, so the seed is the extent — plus one, because an extent is an exclusive bound
and the seed is itself a value the counter takes.

Both halves of that argument are checked rather than assumed, and this is the whole soundness
content of the unit:

| Required | Why, and what fails without it |
| --- | --- |
| Exactly one constant seed | A second seed means the counter can restart from a value this reasoning never saw, so the first seed bounds nothing |
| Every other store is a subtraction of a positive literal from the counter itself | Anything else means it can grow again, and the seed stops being an upper bound |
| The test compares a whole unsigned-word load against literal zero | Matching the ascending recognizer's discipline. `i >= 1` says the same thing and is deliberately not recognized, so no off-by-one argument has to be settled here |

Failing any of these leaves the counter unrecognized, which keeps it protected. The case that makes
this matter is a counter decremented in the loop and added to on some other path: it has a seed and
a reduction, and it is still rejected, because it also has a store that is neither.

## What the extent then buys — unchanged, and now symmetric

Nothing downstream was touched. A counter whose extent exceeds the bound a narrower representation
admits has no cheaper representation to lose, so the copy through a scratch is pure loss and the
destination is taken; a counter inside that bound keeps its scratch. The asymmetry removed was in
*deriving* the extent, not in what the extent is worth.

| Subject | Before | After | Verdict |
| --- | ---: | ---: | --- |
| `for (i = 1000; i > 0; i -= 1)` | 428 | **407** | −21: twelve for the scratch copy, nine for the decrement form |
| The same countdown as a `while` loop | — | **410** | released; the two loop forms place their test differently and both are read |
| `for (i = 999; i > 0; i -= 3)` | — | **410** | released; the seed bounds the counter whatever the step size |
| `for (i = 5; i > 0; i -= 1)` | — | **425** | **protected**, exactly as a small count up is |
| A counter also added to on another path | — | **469** | **protected**; the soundness case |
| `for (i = 0; i < 1000; i += 1)` | 404 | **404** | ascending path untouched |

## Scope

A word counter. The byte case has its own narrowing and is not touched. The recognizer reads only
the canonical countdown spelling; a test against a nonzero literal, an inclusive test, and a
reversed test are all unrecognized and leave their counter protected.

## Tasks

- [x] **T-44.1 Attribute the exclusion.** Instrument the recognizer and establish the exact premise
      that rejects a countdown, rather than inferring it from the emitted code.
- [x] **T-44.2 Derive the extent.** Recognize the canonical countdown and credit it the seed plus
      one, with the two conditions that make the seed an upper bound checked rather than assumed.
- [x] **T-44.3 Controls.** Six cases: both loop forms released, the small countdown still
      protected, the counter that can grow still protected, a countdown by three, and the ascending
      counter pinned at its exact byte count.
- [x] **T-44.4 Measure.** Before and after on each shape, plus the examples digest.
- [x] **T-44.5 Verify.** Full gate on both corpora, and an emulator proof of the trip count.

## Verification

| Check | Result |
| --- | --- |
| New descending-counter controls | **6/6** |
| Emulator proof, all four modes: a countdown publishes its own trip count as `$03E8` | **4/4** |
| Full gate, both corpora | **266 files / 5,530 tests** |
| All seven examples, four modes | **byte-identical** |

The emulator proof is a real proof rather than an invariance net. The loop body counts its own
iterations, so a high byte that never borrows leaves the counter above zero and the loop runs for
ever — reported as a timeout, not a wrong number; a high byte that borrows on every step sends the
counter below zero at once and the loop ends early; and an off-by-one at the exit test publishes 999
or 1001. One thousand needs both bytes, so neither half can be wrong unnoticed.

No example moved, because no example counts down over a word. The gain is real for the idiom and is
measured on fixtures rather than claimed from the corpus.

## Stop conditions observed

No frozen oracle was edited and no specification file was touched. The ascending counter's exact
byte count is asserted by a new control as well as by its existing pins, because the recognizer this
change extends runs on the same walk.
