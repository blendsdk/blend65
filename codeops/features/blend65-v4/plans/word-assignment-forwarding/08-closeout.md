# Word assignment forwarding — closeout

> **Owner**: T-37 / #168 · **CodeOps Artifact Schema**: 1
> **Status**: Complete · **Last Updated**: 2026-11-21
> **Plan**: [99-execution-plan.md](99-execution-plan.md) · **Findings**: [05-findings.md](05-findings.md)

## What shipped

A 16-bit addition or subtraction whose sole consumer is the adjacent whole-word assignment now
computes **into the destination**. The private scratch is never requested, and the store that used
to copy the pair out of it emits nothing.

| | Before | After |
| --- | --- | --- |
| `x = x + 2` | 11 instructions, incl. a four-instruction copy | **7 instructions** — `lda lo · clc · adc · sta lo · lda hi · adc · sta hi` |
| Cost per site | — | **−12 bytes, −16 cycles** |

The machine-code auditor confirmed the result is the lowering casebook's canonical word-add
sequence verbatim, and that the flag contract is **indistinguishable** from before rather than
merely compatible: both forms already contain the high-byte `adc`, and `sta` defines no flags.

## Measured outcome

| Mode | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `none` (release baseline) | 1,151 | **1,103** | **−48** |
| `balanced` / `speed` / `size` | 1,067 | **1,019** | **−48** |

The other six examples are **byte-identical by digest**, and nothing anywhere grew. The arithmetic
reconciles exactly: four word assignments × two pairs × 6 bytes = 48, and 64 cycles across the four
sites. The auditor added a non-obvious reason the figure holds in every mode: word homes are
deliberately kept out of zero page, so every removed pair is absolute — 6 bytes, never 4.

The frozen behaviour oracle `test/rd05/boing-ball-parity.spec.test.ts` passes, so the fixture still
produces identical VIC state to the hand-written twin at every sampled frame while costing less.

## The part worth remembering: a regression caused and fixed

The first implementation forwarded loop induction variables, which made a saved-input fixture grow
from **701 bytes to 2,018** — the exact outcome the plan said stops the unit. A variable a loop
advances is already represented far more cheaply than its declared word, as a single byte or a
register, and writing the declared word defeated that larger saving.

Three attempts were needed, and both failures were **wrong facts rather than wrong ideas**: the
counters named by the selection runtime are not populated in the pass where the forwarding fires,
and neither are the ones on the checked source facts. Reading the shape off the blocks restored 701
exactly. Excluding the loop's update alone was not enough either — the inner loop's *initializer*
also writes the counter, so a counter has to be excluded wherever it is written.

That cost real value, stated rather than buried: the exclusion withdrew two 12-byte wins the first
version had shown on other fixtures. Both were loop counters, so those oracles now pass unchanged
and the honest total is **48 bytes, not 72**.

It also settled a claim the preflight had already withdrawn. The plan had said the slice was worth
twice as much at `none`, resting on a pair tally rather than an inspection; measured, it is the same
48 bytes everywhere.

## Reviews

Four independent lenses across the unit. **0 critical.**

| Lens | Result |
| --- | --- |
| Plan preflight | 0 critical, **4 major** — all confirmed, all defects in the plan rather than the compiler, all repaired before any code existed |
| Correctness | 0 critical, 0 major, 6 minor |
| Machine code | 0 critical, **1 major** (MC-001), 4 minor |

The correctness lens verified the early-write soundness chain independently and confirmed the
`frame` derivation is suffix-stripped **equality**, not a prefix match that could be fooled. The
machine-code lens attacked the same argument from ten directions and found no hole, calling it the
strongest part of the change.

### The major, and what was done

**RV-003 / MC-001 — the loop-counter exclusion read only one loop shape.** It required the advancing
store to end its block and the block to jump back, which is how a counted loop lowers. A `do-while`
lowers the other way: its body jumps *forward* to the condition block, and the condition block
carries the backward branch while its last operation is the comparison. So a `do-while` counter
escaped entirely — the same failure mode as the 1,317-byte cliff.

**Fixed.** The recognizer now reads what a loop's own exit test depends on, taking both signals
because the two forms place that test differently, with the block-final rule kept as a third signal.
Verified both ways: the saved-input fixture still lands on 701, and a `do-while` counter now keeps
its scratch. This also answers what distinguishes a counter from any variable written in a loop —
being named by the loop's exit test — which is why an ordinary position updated in an endless loop
keeps the saving.

### Minors applied

| ID | Finding | Disposition |
| --- | --- | --- |
| RV-001 | The emitter's recorded outcome was read but never consumed, so an expanded loop's later occurrence could inherit an answer it never gave | **Fixed** — consumed once. No divergence was demonstrated; the invariant is now enforced rather than assumed |
| RV-002, RV-004 | Two comments claimed more completeness than the code delivered | **Fixed** — both now state what they actually guarantee, and the recognizer is described as a conservative backstop |
| RV-005 | A lookup was repeated that was already in scope | **Fixed** — reuses the existing local |
| RV-006 | The control's move detector undercounted twice: it missed the forced-absolute spelling the serializer emits when mode and address disagree, and its filter silently discarded the whole `$0700` page alongside the hardware window | **Fixed** — both spellings matched, register window named explicitly. This also softened the evidence it reported, so the earlier 5-and-1 counts were lower bounds |

## Residual debt, recorded not filed

Filing is outward-facing and was not authorized for these, so they are recorded here with their
measurements so nothing is lost.

| Residual | Measurement |
| --- | --- |
| The exclusion is still broader than the narrowing it protects — narrowing admits only a bound of 0–8 with a step of exactly +1, so an ordinary `for (i: word = 0; i < 100; i += 1)` or a `while (true)` accumulator is excluded for nothing | 12 bytes and 16 cycles per site forfeited. Remedy named by the auditor: export the recognizer's own admitted-shape predicate rather than re-deriving a proxy |
| The surviving memory-to-memory move stages a high byte for a hardware write | Same class, different owner: the already-shipped unary selection handles `lo` only, and its `hi` arm is simply absent |
| `x = x ± small constant` is still above the expert form, newly reachable *because* of this change | About 3 bytes / 7 cycles, and about 9 / 13 for `±1`, where `inc lo; bne +; inc hi` is casebook-backed. The frozen oracle already admits `inc`/`dec`, so no oracle edit would be needed |
| The RAM delta is unaccounted | Four withdrawn two-byte temporaries do not imply eight freed bytes, because those carry precise lifetimes and may already have shared addresses. The cost record is code-only and says so |

## Verification

| Check | Result |
| --- | --- |
| Frozen oracles, blobs unchanged (`e95f185c`, `fdf074cd`) | Shape **20/20** (was 10 RED) · emulator **9/9** |
| Frozen behaviour oracle against the hand-written twin | Passes |
| Examples, all four modes | boing-ball −48; the other six byte-identical; nothing grew |
| Neighbours that pin exact bytes or whole-PRG digests | All pass, including `optimizer-exact-output` |
| Controls | 3 passed; reverted-and-watched 5 moves before, 1 after |
| `packages/compiler` machine + storage + services | 135 files / 2,306 passed, 2 skipped |
| After the review fixes | Examples identical to the pre-fix measurement — no byte moved |

#168 stays open by design: this was one slice of a parity continuation and closes nothing.
