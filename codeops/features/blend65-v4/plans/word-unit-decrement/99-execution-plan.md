# Word unit decrement — the other half of the step selection

> **Owner**: T-42 · **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Status**: Complete
> **Progress**: 5/5 tasks (100%)
> **Last Updated**: 2026-11-21
> **Predecessor**: [word-unit-increment](../word-unit-increment/99-execution-plan.md)

## Why, and why the earlier reason for deferring it was wrong

The step selection shipped the increment only, and recorded decrement as held back because its
canonical form loads the low byte to test it and so leaves the accumulator holding that byte's old
value — described at the time as needing a different accumulator-liveness argument.

The machine-code review corrected that, and the correction is why this unit is small. The chain
being replaced **also** ends with the accumulator overwritten, by its own high result. So the
accumulator is already dead across this operation wherever the chain would have been emitted, and
replacing one accumulator-clobbering form with another cannot break a reader the chain did not
already break. The discharge is the same block-closure argument the increment uses, with no new
machinery.

On flags the decrement is in fact the **better-behaved** of the two directions. Both of its arms end
on the same low-byte decrement, so sign and zero uniformly describe the new low byte with no path
dependence at all — whereas the increment leaves them describing whichever half it last touched.

## What is emitted

```
      lda <low>          ; A = old low byte, zero flag set when it is about to borrow
      bne <join>         ; low byte nonzero, so no borrow is due
      dec <high>
<join>: dec <low>
```

| Home | Chain | This form |
| --- | ---: | ---: |
| absolute | 17 bytes, 22 cycles | **11 bytes**, 13 or 18 cycles |
| zero page | 13 bytes, 18 cycles | **8 bytes**, 11 or 15 cycles |

Dearer than the increment's eight bytes, because the low byte must be read before it changes. There
is no accumulator-free variant: the zero test has to happen *before* the decrement. Where an index
register is provably free, loading into it would preserve the accumulator at identical cost — a
register-pressure refinement, not a correctness one, and deliberately not attempted.

## The one structural difference, and the seam it needed

The increment steps the low byte *before* the test, so its branch skips the high byte and nothing
has to follow the join. The decrement must *test* the low byte before it changes, so the low
decrement belongs after the join where both paths reach it.

The emitter therefore hands that trailing instruction back as pending work for the caller to begin
the continuation with, rather than emitting it as a block of its own. That keeps the edge count the
same as the increment's and avoids a third block that layout would have to bridge. It is a one-field
addition to the existing `{ blocks, continuation }` contract.

## Measured

The shape this serves is a position moved one way or the other under a condition — the ordinary
game idiom, where each arm closes its own block by jumping to the join:

```
if (rising) { x = x + 1; } else { x = x - 1; }
```

| Subject | Before | After | Verdict |
| --- | ---: | ---: | --- |
| Bidirectional position fixture | 442 | **436** | −6 bytes on the downward arm |
| The same fixture's upward arm | — | unchanged | already the increment form |
| All seven examples, all four modes | — | **byte-identical** | no example is in the admitted shape |

## What this does *not* reach, stated plainly

**The most natural decrement idiom is not improved**, and that is a real limit rather than an
oversight:

```
for (let i: word = 1000; i > 0; i -= 1) { ... }   // still the full subtraction chain
```

Such a counter never reaches this selection, because it is excluded from in-place whole-word
forwarding before the selection sees it. The exclusion marks a loop's control variable as an
induction root whenever its extent cannot be read, and an extent is only derived from a `<`
comparison — so a descending loop's `>` test yields no extent and the variable is excluded
conservatively. Measured directly: the descending `for` and the equivalent `while` both still copy
through a scratch pair, and instrumentation attributes both rejections to that one premise.

Widening it belongs to the counter-exclusion family rather than here: it moves the threshold between
a protected and a released counter, which is the boundary two shipped controls pin either side of,
and it needs its own representation proof. Recorded as the named prerequisite for ever reaching
descending counters.

## Scope

A step of exactly one, down. `x = x - N` for `N > 1` keeps its low-byte subtraction and replaces
only the high half with a borrow-conditional decrement — a different proof, because it clobbers the
carry and its branch consumes the borrow the subtraction just produced rather than a zero flag.
**Since delivered as its own unit**, see word-constant-step. A control here pins that a step by two
does not take the dedicated unit form.

## Tasks

- [x] **T-42.1 Establish the admitted shape.** Find which downward steps are already in place, and
      attribute the ones that are not to their exact rejecting premise.
- [x] **T-42.2 Controls.** Five cases: the expert form emitted; the emitted order proved correct
      against transposition; the chain kept when the step is not block-final; the chain kept when
      the block returns; a step by two left alone.
- [x] **T-42.3 Implement.** Admit the subtraction operator, emit the borrow form, and seed the
      continuation with the low decrement through a new field on the existing split contract.
- [x] **T-42.4 Measure.** Before and after on the same fixture, plus the examples digest.
- [x] **T-42.5 Verify.** Frozen shape and behaviour oracles, the increment half's own controls and
      cost pins, the exact-byte neighbours, and an emulator proof of the borrow.

## Verification

| Check | Result |
| --- | --- |
| New decrement controls | **5/5** |
| Emulator proof, all four modes: a position walked down three hundred steps and back up publishes three hundred | **4/4** |
| The increment half's controls, unit 1's controls, the predecessors' controls and the qualification expectation | **26/26** |
| Frozen shape and behaviour oracles | **122/122**, untouched |
| Exact-byte neighbours | **9/9** |
| All seven examples, four modes | **byte-identical** |

The emulator proof is a real proof rather than an invariance net. The walk borrows exactly once
going down and carries exactly once coming back, so a high byte that never borrows publishes five
hundred and fifty-six instead of three hundred, one that borrows every step underflows at once, and
the two decrements taken in the wrong order would borrow on every step. None of those can publish
the expected word.

The emitted join was checked rather than assumed, because a shared join would have been a
miscompile: the downward arm's branch targets its **own** continuation, and the upward arm jumps
straight past it to the if-end block, so the low decrement runs on both of the downward arm's paths
and on neither of the upward arm's.

## Stop conditions observed

No frozen oracle was edited and no specification file was touched. Every "before" figure was
produced by toggling the gitignored build output only, and the final measurement re-confirms the
shipped state.
