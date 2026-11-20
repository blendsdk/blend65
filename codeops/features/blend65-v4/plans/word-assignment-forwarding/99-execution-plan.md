# Word assignment forwarding (#168, parity slice)

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: T-37 / #168
> **Progress**: 2/7 tasks (29%)
> **Status**: Executing — baselines captured and golden exposure enumerated; oracle and
> preflight next, both before any code
> **Last Updated**: 2026-11-20
> **Baseline**: plan authored at `825778f2`, clean `feature/v4-rebuild`
> **Scope**: strict; the result home of a word arithmetic operation whose sole consumer is an
> adjacent whole-word assignment
> **Reasoning**: high — a lowering change that writes a destination earlier than before, where a
> wrong barrier produces a miscompile rather than a refusal
> **Commit mode**: `--auto-commit` (commit and push after each verified task; a critical or major
> review finding still stops for a ruling)
> **Created**: 2026-11-20

## Why this unit exists

Issue #168 is a parity continuation, not a single defect. This unit delivers **one measured slice**
of it and closes nothing: #168 stays open afterwards by design.

## Corrected starting state

Two recorded facts were stale and are corrected here before anything is built on them.

**The push state.** Both the portfolio row and the T-168 tracker row record "No push" against the
local checkpoint `9bbc9ead`. That is no longer true: `git merge-base --is-ancestor 9bbc9ead HEAD`
succeeds and `git branch -r --contains 9bbc9ead` lists `origin/feature/v4-rebuild`. The work was
pushed; only the notes lag.

**The measurement.** The issue body reports 1,599 code bytes against a 402-byte twin, a 3.98× gap,
and states that the compiler "reports `zeroPage = 0`". Measured now:

| Mode | Code bytes | Zero page | Gap to the 442-byte twin |
| --- | ---: | ---: | --- |
| `none` (the release baseline) | 1,151 | 0 | 709 bytes, 2.60× |
| `balanced` / `speed` / `size` | 1,067 | 10 | 625 bytes, 2.41× |

So two of the issue's three named causes are already answered:

| Cause | State |
| --- | --- |
| 1. The volatile raster `peek` is spooled and reloaded | **Discharged.** The poll is now `lda $d012; eor #$fb; bne` — 7 bytes, exactly the issue's own acceptance line |
| 2. No zero-page allocation | **Delivered as designed.** Zero page is allocated in all three optimized modes, 10 bytes against the twin's 12. It is off in `none` because `size-selection.ts:363` gates it on `optimization !== "none"`, which is precisely the issue's requirement to leave the canonical `none` reference contract alone. This is not a defect and must not be "fixed" |
| 3. Block/edge lowering leaves repeated loads and jumps | **Open.** This unit takes one bounded piece of it |

The remaining gap is dominated by load/store traffic: of 440 emitted instructions in `size` mode,
228 are loads and stores.

## The slice

A word arithmetic operation whose sole consumer is an adjacent whole-word assignment computes its
result into a private two-byte temporary and then **copies that temporary into the destination**.
Measured in the emitted assembly, `x = x + 2`:

```
lda $2442      ; x lo
clc
adc #$02
sta $243a      ; arithmetic temporary, low
lda $2443      ; x high
adc #$00
sta $243b      ; arithmetic temporary, high
lda $243a      ; reload
sta $2442      ; copy into x low
lda $243b      ; reload
sta $2443      ; copy into x high
```

An expert writes the destination directly and stops at the sixth instruction. The last four are
pure copy, 12 bytes and 16 cycles per assignment.

**Uniform across every instance, verified by inspecting all of them**: 8 pairs in `size` mode and
16 in `none`, in four word assignments — `xr = x + 24` twice, `x = x + 2`, and `x = x - 2`. No pair
is a legitimate source-level copy; every one is this pattern.

| Mode | Copy pairs | Code bytes | Also freed |
| --- | ---: | ---: | --- |
| `none` | 16 | 96 | the four two-byte temporaries, 8 bytes of RAM |
| `balanced` / `speed` / `size` | 8 | 48 | same |

The temporary is not itself waste. `lower-arithmetic.ts:102-110` requests it for a stated reason —
*"Low byte must survive high-byte arithmetic"* — and that constraint is real: the accumulator is
reused for the high byte, so the low result must be somewhere. The waste is that the home is
**private** rather than the destination's own, when the destination is where the value is going
anyway.

## The design risk, which is the whole of this unit's difficulty

Writing the destination's low byte **before** reading the source's high byte is only sound while
the destination cannot overlap a source operand at a different offset.

For the measured cases it is plainly sound: `x = x + 2` writes `x` low and then reads `x` high,
which the low write does not disturb, and `xr = x + 24` writes a different binding. But the
allocator shares homes by lifetime — `allocate.ts` carries interference edges precisely so that a
dead binding's home may be reused. A destination whose home the allocator later overlaps with a
still-live source operand, at an offset, would be clobbered by the early write. The temporary form
is immune to that; the forwarded form is not.

Selection runs **before** storage closure, by deliberate design (`byte-write-forwarding.ts:14-15`),
so the decision cannot inspect addresses. It must therefore be conservative at the semantic level:
forward only when the destination and every operand are the same binding or are distinct bindings
whose homes cannot be made to overlap. Getting that condition right, and proving it does not fire
anywhere else, is the unit.

## Authority and precedent

The byte analogue is already delivered: `9bbc9ead` "forward adjacent byte assignments without
captures", which touched `byte-write-forwarding.ts` and moved this same cost pin. Its emitted byte
form is already the expert one — `lda $2446; sec; sbc #$02; sta $2446`, a direct write-back — which
is the authority for what the word form should look like.

The **mechanism** differs, and that is stated so nobody plans on reusing it. The byte case works by
keeping the result in the accumulator for its adjacent store (`byte-write-forwarding.ts:94-95`); a
two-byte value cannot survive its own high-byte carry chain in A, so the word case cannot retain a
register and must instead direct the existing stores at the destination home.

## Tasks

- [x] T-37.1 Record the corrected starting state as evidence and repair the two stale "No push"
      notes. Capture pre-change baselines: the seven examples plus boing-ball in all four modes,
      digesting emitted bytes only ✅ (evidence below; reproduced across two independent runs)
- [x] T-37.2 Enumerate the byte-exact goldens a word-lowering change can shift, before any code.
      About twenty output oracles under `test/rd05` pin emitted form, and
      `test/rd08/optimizer-exact-output.impl.test.ts` pins artifacts byte-for-byte. Name which can
      reach a word arithmetic assignment and why the rest cannot ✅ (4 of 25; evidence below)
- [ ] T-37.3 Author the specification oracle from the required behaviour only, implementation-blind,
      and reproduce RED. **Two halves, because a forwarding optimization's risk is firing when it
      must not**: the emitted shape for a word assignment, and the barriers — an intervening use, a
      non-adjacent store, a volatile destination, a partial or indexed place, a signed or
      non-wrapping width, and an operand that could share the destination's home. Freeze by hash
- [ ] T-37.4 Preflight the plan and this oracle with the applicable specialist lens; resolve every
      critical and major finding before implementation
- [ ] T-37.5 Implement the smallest sound change: direct the word arithmetic result at the
      destination home when the barrier condition holds, reusing the existing request seam rather
      than adding a second analyzer
- [ ] T-37.6 Add implementation tests for the same witnesses plus the non-regression controls the
      public oracle cannot express, and move the cost pins in the same commit as the fix, with the
      delta stated per mode
- [ ] T-37.7 Independent reviews for the affected contracts — machine code and base correctness at
      minimum — then the closeout. A critical or major finding stops for a ruling

## Verify

Per task: the targeted suites for the files touched, from the owning package
(`packages/compiler` needs its own config; the root config only includes `test/**`). Before each
commit: `yarn test:changed --host` and `yarn test`.

**The VICE-backed parity oracle `test/rd05/boing-ball-parity.spec.test.ts` must stay green at every
slice** and is run **isolated**, because the recorded gate intermittents are load-sensitive
emulator timeouts.

## This unit is deliberately not byte-neutral

T-36's discipline was that no emitted byte may move. Here the opposite holds: the point is to move
bytes **down**. So the evidence obligation inverts — every changed golden must be a named, justified
decrease, and any increase anywhere is a regression that stops the unit. Baselines are captured for
exactly that comparison, not to prove they are unchanged.

The cost impl test documents its own contract as pins that move down and may not drift up silently,
so moving them is sanctioned; the frozen parity oracle proves the behaviour did not change while
they moved.

## T-37.1 evidence — baselines before any change

Captured at `24a12aa7`. Digests are the first 16 hex digits of a SHA-256 over emitted bytes only,
excluding `.build.json` and `current.json`, which record the generation identity and change on
every run. **Both tables were produced twice from independent runs and agree exactly.**

| Mode | Code bytes | Zero page | Program bytes | Artifact digest |
| --- | ---: | ---: | ---: | --- |
| `none` | 1,151 | 0 | 7,167 | `75fecef4c692b1eb` |
| `balanced` | 1,067 | 10 | 7,167 | `b0e0c7c9a8125564` |
| `speed` | 1,067 | 10 | 7,167 | `d6de884a648d300e` |
| `size` | 1,067 | 10 | 7,167 | `a9fd33484fc6af3b` |

| Example | Code bytes | Digest |
| --- | ---: | --- |
| `boing-ball` | 1,151 | `75fecef4c692b1eb` |
| `foundation` | 72 | `aafbc004571cc57c` |
| `m1` | 3,153 | `edcd65feab8c43c5` |
| `rd06-assets` | 659 | `93b812b661aac655` |
| `rd06-charpad` | 632 | `c9eb256171b24324` |
| `rd06-spritepad` | 640 | `a4d7702851e776a4` |
| `rd07-loadable` | 682 | `811dd3d3e6d7d011` |

The six non-boing examples carry **the same digests the preceding unit recorded**, which is an
independent check that the method is stable across units rather than merely self-consistent within
one.

`m1` at 3,153 code bytes is the largest corpus member and the most likely place for an unintended
delta to show up, so it is the one to watch alongside boing-ball.

## T-37.2 evidence — which goldens this change can reach

136 test files declare a word local. Of those, **25 also pin exact output** — a byte count, an exact
instruction sequence, or a structural equality. Of those 25, only **4** contain the source shape
this slice can affect, a word-typed variable assigned an addition or subtraction:

| Oracle | The reaching source | What it pins |
| --- | --- | --- |
| `test/rd05/sprite-publication-forwarding.spec.test.ts` | `address = load + offset - 2;` | **The one to watch.** Exact instruction bytes at computed offsets, plus the register-capture set. Frozen, so it may never be edited |
| `test/rd05/input-call-guards.spec.test.ts` | `selector = 1 - selector;` | Emulator memory contents — behavioural, so an optimization that preserves behaviour cannot move it |
| `test/rd08/input-loop-storage.spec.test.ts` | `other = column + 1;` | Evidence-record key sets and occupancy, not byte counts |
| `test/rd04/backend.spec.test.ts` | `word(peek($0400)) + 1` as a call argument | Assembly comment patterns and staging names. The arithmetic's consumer is a call rather than a whole-word store, so it is probably outside the pattern |

The other 21 declare a word local but never assign it an addition or subtraction, so they cannot
reach the pattern at all.

**No oracle pins a global code-byte total that a general improvement would shift**, which is the
result that matters: the frozen oracles assert behaviour and located shapes, and the byte totals
live in impl tests whose documented contract is that they move down. So the slice is not blocked by
a frozen pin it would have to edit. That was a real risk worth checking before writing code rather
than discovering at the gate.

## Out of scope

| Item | Why |
| --- | --- |
| Whole-frame steady-state timing | The compiler publishes no cycle count for this non-returning loop; it needs that capability first and is its own unit |
| Word locals in zero page | `inventory.ts:559-562` deliberately leaves word homes in RAM because they cost two scarce zero-page bytes. Worth a measured 34 bytes here and its premise is questionable with 132 zero-page bytes free, but it is a separate policy decision, it helps no `none` build, and it would confound this slice's measurement |
| Enabling zero page in `none` | The issue explicitly requires the canonical `none` reference contract to stay intact |
| The remaining ~150 absolute accesses and the register-residency gap | The structural half of cause 3; a register-allocation capability, not a slice |
| Commenting the corrected figures on #168 | Outward-facing; the user's call |

## Design decisions

| # | Decision | Status |
| --- | --- | --- |
| D-1 | A specification oracle **is** authored, in two halves, including barriers | Settled against the advice to rely on the parity oracle alone. The parity oracle proves behaviour is unchanged for *this fixture*; it cannot prove the forwarding declines to fire on shapes the fixture does not contain, which is exactly where a forwarding bug hides. The sibling byte slice shipped a 237-line barriers oracle for the same reason |
| D-2 | The temporary keeps existing; only its home is redirected | Settled — its stated purpose, that the low byte must survive high-byte arithmetic, is real and unchanged |
| D-3 | The barrier is semantic, not address-based | Forced: selection precedes storage closure by design, so no address is available to inspect |
| D-4 | Evidence is a justified decrease per golden, not byte-neutrality | Settled, and stated so a reviewer judges the deltas rather than expecting zero |
| D-5 | `none` is included in the acceptance, not just the optimized modes | Settled — the roadmap records `none` as the release baseline, and this slice is worth twice as much there |
