# Word assignment forwarding (#168, parity slice)

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: T-37 / #168
> **Progress**: 4/7 tasks (57%) · [findings](05-findings.md)
> **Status**: Executing — preflight majors repaired, oracle frozen at reproduced RED. The gate is
> red by design until the implementation lands
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

**The push state.** Both the portfolio row and the T-168 tracker row *recorded* "No push" against
the local checkpoint `9bbc9ead`, and both are now repaired. The note was stale: `git merge-base --is-ancestor 9bbc9ead HEAD`
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

The four word assignments are `xr = x + 24` twice, `x = x + 2`, and `x = x - 2`, at
`examples/boing-ball/src/main.blend:77`, `:160` and `:110`.

| Mode | Copy pairs matching this pattern | Code bytes |
| --- | ---: | ---: |
| `balanced` / `speed` / `size` | 8, all inspected and uniform | 48 |
| `none` | **at most 8 of the 16 present** — to be attributed in the reopened exposure task | ≤ 96, not yet established |

An earlier draft claimed all 16 `none` pairs were this pattern and that every instance had been
inspected. **That was wrong, and the preflight caught it.** The 8 `size` pairs were inspected and
are uniform; the `none` count was taken from a tally and generalized. Re-listed by block, the 16
`none` pairs are spread across ten blocks — two each in the two self-assignment blocks, three each
in two others of which only one per block is this pattern, and one each in six further blocks that
are a different shape entirely. The remaining pairs are not this slice's to remove.

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

### What the existing model already guarantees — investigated 2026-11-21

The hazard above is real as a mechanism and **cannot occur for the shape this slice targets**. That
is worth establishing before designing a barrier against it, because it decides how much the slice
has to prove.

| Step | Evidence |
| --- | --- |
| Overlapping placement is permitted only between requests that do **not** interfere | `allocate.ts:157-170` — `placementBlocked` blocks an address only when `interfere(...)` holds for the pair |
| Interference is an intersection of live-position sets, and separately forced for persistent requests | `interference.ts:284-291`, `:459-462` |
| **Every source local and parameter is live at every position in its function** | `inventory.ts:563` and `:508` request `declaredLifetime`, whose `liveAt` is `functionPositions(fn)` — one entry per operation slot in the whole body (`inventory.ts:38-45`, `:69`) |

So any two source locals of one function always have intersecting live sets, always carry a
`lifetime` interference edge, and therefore can **never** be placed overlapping. A destination local
and an operand local cannot alias, at any offset, which is exactly the clobber the forwarded form
would otherwise risk.

Two gaps were checked. The first was **argued wrongly in an earlier draft and is corrected here**:
`lifetimesOverlap` returns `false` when two requests have different owners
(`interference.ts:286`), and the draft claimed cross-owner requests all set `persistent: true`.
They do not — the three cited sites are interrupt-predecessor words only. The correct reason the
cross-owner case is irrelevant is simpler: one arithmetic's destination and operands resolve to
homes owned by the **same** function, or to labels, so a cross-owner pair never arises here. There
is also no `global` storage class in this path, so module statics are not allocated against
function locals.

The second gap is **real and becomes a barrier obligation**. `requestStorage`
(`lower-state.ts:483-514`) creates machine-side requests with **no `domain`**, while
`lifetimesOverlap` returns `false` on any domain mismatch (`interference.ts:287`) and the explicit
cross-domain rule needs both domains defined (`:465-475`). So a domain-tagged destination local and
a domainless machine temporary have **no interference edge at all** and may be overlaid at an
offset. Today the private scratch is safe because scratch and operand temporary are both
domainless; forwarding into the local would trade that for a pair the edge builder does not relate.

That the gap exists at all looks like a pre-existing allocator weakness, latent only because
nothing currently writes a local before reading a temporary. It is not this unit's to fix, and it
must not be silently relied on either — hence the exclusion in the barrier below.

### The barrier, stated once and normatively

Earlier drafts expressed this three different ways, one of them undecidable. This is the single
statement the implementation task means, and every clause is checkable on the semantic operations
alone — no address or alias analysis, which must not be added.

Forward the word arithmetic result into the destination **only when all of these hold**:

| # | Condition | Why |
| --- | --- | --- |
| B1 | The store is the operation immediately after the arithmetic | Anything in between may read the old value |
| B2 | The arithmetic's result is used exactly once, by that store | A second consumer needs the value to still exist |
| B3 | The destination is a whole bare place — no index, no field path | A computed address can alias anything; the byte sibling enforces the same at `byte-write-forwarding.ts:90` |
| B4 | The destination resolves to a declared home owned by the same function, with the same `domain` and `activationRoot` | These are the exact preconditions of the non-overlap guarantee above |
| B5 | **No operand resolves to a machine-created (`machine:`) storage request** | Those carry no `domain`, so the edge builder relates them to nothing and the allocator may overlay them at an offset |
| B6 | The declared width, signedness and wrap flags match the two-byte unsigned wrapping form | The same discipline the byte sibling applies to its own width |

B1–B3 and B6 mirror the byte sibling. B4 and B5 are what the word case adds, and B5 exists only
because of the domain gap found above.

**This narrows the unit and is recorded as a plan correction, not as a reason to skip the barriers
oracle.** The guarantee covers whole scalar locals; it says nothing about an indexed destination, a
hardware-address destination, a multiply-used result, or a non-adjacent store, and each of those is
a way the forwarding could fire where it must not. The oracle still has to pin every one.

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
- [x] T-37.2 **Reopened after preflight, then closed on method.** Bound the byte-exact golden exposure a word-lowering change can shift, before any code.
      About twenty output oracles under `test/rd05` pin emitted form, and
      `test/rd08/optimizer-exact-output.impl.test.ts` pins artifacts byte-for-byte. Name which can
      reach a word arithmetic assignment. **Not by static prediction** — two attempts at that
      failed, and the honest method is empirical: run the affected tiers before and after and
      attribute every delta, keeping the over-inclusive list only as a watch list ✅ (method
      settled and the before-state established; the attribution itself belongs to T-37.5/T-37.6,
      where the change exists to attribute)
- [x] T-37.3 Author the specification oracle from the required behaviour only, implementation-blind,
      and reproduce RED. **Two halves, because a forwarding optimization's risk is firing when it
      must not**: the emitted shape for a word assignment, and the barriers — an intervening use, a
      non-adjacent store, a volatile destination, a partial or indexed place, a signed or
      non-wrapping width, and an operand that could share the destination's home. Freeze by hash
      ✅ (two files, frozen hashes and the reproduced RED split recorded below)
- [x] T-37.4 Preflight the plan and this oracle with the applicable specialist lens; resolve every
      critical and major finding before implementation ✅ (0 critical, 4 major all confirmed and
      repaired, 8 minors applied, 1 refuted on evidence — see the findings)
- [ ] T-37.5 Implement the smallest sound change: do not request the scratch when the barrier
      condition B1–B6 holds, and give the two existing stores the destination's lowered value.
      **The barrier predicate gets its own module**, as the byte sibling's did — `lower-state.ts`
      is already 884 lines and `lower-arithmetic.ts` 479, so neither may absorb a whole-body
      analysis. Reuse the existing request and place seams; add no second analyzer beyond that
      predicate
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

`test/rd05/boing-ball-parity-cost.impl.test.ts:21-28` documents its own contract as pins that move
down and may not drift up silently, so moving **that** one is sanctioned. That does not generalize:
the other cost oracles, including `stable-byte-classifier-cost` and `return-result-forwarding-cost`,
carry no such contract, so moving any of them needs its own justification recorded against it. The
frozen parity oracle proves the behaviour did not change while the pins moved.

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

## T-37.2 — reopened, and why the method changed

The first attempt was marked complete on an unsound enumeration and the preflight refuted it. The
detail is in the [findings](05-findings.md); what matters for the plan is the method, because two
different static detectors both failed:

| Attempt | How it failed |
| --- | --- |
| Scan whole test files for a word-typed name assigned an addition | Could not tell Blend source from the TypeScript around it. Two of its four "reaching" oracles were harness `for` loops. It also required a `;`, so it missed every `+=` in a loop header |
| Scan only Blend sources, and accept `+=` | Same `for`-header blind spot, so it still missed `for (let i: word = 0; i < 8; i += 1)` in the very fixture whose whole-PRG digest is pinned |
| Make the criterion safely over-inclusive | Returns **173 files, 120 of them frozen oracles** — the generic fixture name `game.blend` appears in most harnesses. That is the corpus, not an exposure set |

So static prediction is not reliable here and is abandoned rather than refined. **The exposure is
settled empirically**: run the affected tiers before and after the change and attribute every
delta, which is what the preceding unit did. The over-inclusive list survives as a watch list only.

One fact from it changes the risk and is carried forward: **120 of the candidates are frozen
`.spec.test.ts` oracles, which may never be edited.** If the change shifts even one, this slice is
blocked or must narrow until it does not — so that has to be proved absent, not assumed. Two were
named by the preflight as genuinely reaching and worth checking first:
`test/rd08/optimizer-exact-output.impl.test.ts`, which pins whole-PRG SHA-256 digests, and
`test/rd05/low-byte-write-forwarding.spec.test.ts`, which is frozen and contains
`value = value + 257`.

One oracle leaves the watch list on evidence rather than on hedging: `test/rd04/backend.spec.test.ts`
contains `total = quotient(value.second, word(peek($0400)) + 1)`, where the arithmetic's consumer is
a **call argument** rather than a whole-word store, so B1 and B2 exclude it.

## T-37.3 evidence — the frozen oracle and its reproduced RED

Two files, authored implementation-blind and frozen at these blobs:

| File | Blob | Lines | Result |
| --- | --- | ---: | --- |
| `test/rd05/word-assignment-forwarding.spec.test.ts` | `e95f185cd0f33fc47ec2f0a6b85d9afc526908e9` | 523 | **10 RED / 10 GREEN of 20** |
| `test/rd05/word-assignment-forwarding-vice.spec.test.ts` | `fdf074cdf8ae86a446f98a9f30d563764244ec13` | 341 | 9 GREEN of 9 |

**RED reproduced by the parent, not taken on the author's report.** Every one of the ten shape
failures is the same assertion and the same cause —
`no copy into the destination: expected [ 'lda $09c7 / sta $09c9', … ] to deeply equal []` — which
is precisely the scratch-to-destination copy this slice removes. The ten are four profiles × both
operators, plus both separate-destination cases.

The ten shape-tier acceptance cases pass: a module-level word destination, a `word[]` element, a
struct field, a `poke` destination, a signed word, chained arithmetic, an escaped address, an
installed interrupt, a helper-returned operand and a word parameter operand. The nine emulator
cases pass on the real CPU across all four optimization modes, covering carry past 256, a borrow,
a separate destination leaving its operand alone, an intervening statement with a reused result,
an array element and struct field with their neighbours proved untouched, chained arithmetic, and a
signed word descending through zero.

Those are GREEN **before** implementation, which is the right shape for a barrier: they describe
behaviour that is already correct, and the risk is a forwarding that starts firing on them. The
emulator tier was run isolated, per this plan's own rule about load-sensitive emulator timeouts.

Checked independently of the author's report: both files import only vitest, the shared profile
fixture and the emulator runtime, so they reach no implementation source; neither carries a plan,
task or issue identifier; `prettier --check` is clean and `tsc --noEmit -p tsconfig.json` exits 0.

### The destination's home is resolved from the debug report, not from the instructions

Worth recording because it is what makes the oracle survive the change it is judging: the
destination's address is looked up by declaration span in `.debug.json` rather than inferred from
the stores that write it. An oracle that located the home by pattern-matching those stores would
break the moment their shape changed — which is exactly what this slice does to them.

### The gate is red by design from here

Freezing at RED means the integration tier and `yarn test` **fail until the implementation lands**.
That is intended, and is recorded so a later reader does not read it as a regression. The last
fully green gate is the preceding unit's, at `5f6fe990`.

## T-37.2 — closed on method, with the attribution where it belongs

The deliverable is the method and the before-state, both settled. Static prediction is abandoned
for the reasons above; the exposure is attributed empirically when there is a change to attribute,
which is T-37.5 and T-37.6.

The before-state is established rather than assumed: every file changed between the preceding
unit's clean full gate at `5f6fe990` and the start of this work is under `codeops/`, so that gate
is still the valid baseline and no redundant full run was needed. From the freeze onward the
baseline is "green except the ten pinned RED cases", and any *other* failure is this slice's to
explain.

## Out of scope

| Item | Why |
| --- | --- |
| Whole-frame steady-state timing | The compiler publishes no cycle count for this non-returning loop; it needs that capability first and is its own unit |
| Word locals in zero page | `inventory.ts:559-562` deliberately leaves word homes in RAM because they cost two scarce zero-page bytes. Worth a measured 34 bytes here and its premise is questionable with 132 zero-page bytes free, but it is a separate policy decision and it helps no `none` build. **The interaction has a direction, so it is stated rather than left as "would confound":** zero-page homes make each copy pair 4 bytes instead of 6, so doing that first would cut this slice's optimized value from about 48 bytes to about 32, while leaving `none` untouched. This slice's 48-byte figure is therefore conditional on the current RAM-home policy |
| Enabling zero page in `none` | The issue explicitly requires the canonical `none` reference contract to stay intact |
| The remaining ~150 absolute accesses and the register-residency gap | The structural half of cause 3; a register-allocation capability, not a slice |
| Commenting the corrected figures on #168 | Outward-facing; the user's call |

## Design decisions

| # | Decision | Status |
| --- | --- | --- |
| D-1 | A specification oracle **is** authored, in two halves, including barriers | Settled against the advice to rely on the parity oracle alone, and the preflight agreed on the merits. The parity oracle proves behaviour is unchanged for *this fixture*; it cannot prove the forwarding declines to fire on shapes the fixture does not contain, which is exactly where a forwarding bug hides. The sibling byte slice shipped a 237-line barriers oracle for the same reason |
| D-2 | The scratch request is **not created** when the destination's home can carry the result; the two existing stores are given the destination's lowered value | Rewritten after preflight. The first version said the home was "redirected", which is not available — a request's home is assigned later by storage closure, not by lowering. `loweredPlace` (`lower-state.ts:548-573`) already hands back the destination's own request id at the point the scratch is requested, so not requesting it is both correct and smaller. The low byte still survives high-byte arithmetic, in the destination |
| D-3 | The barrier is semantic, not address-based | Forced: selection precedes storage closure by design, so no address is available to inspect |
| D-4 | Evidence is a justified decrease per golden, not byte-neutrality | Settled, and stated so a reviewer judges the deltas rather than expecting zero |
| D-5 | `none` is included in the acceptance, not just the optimized modes | Settled on the first ground only. The roadmap records `none` as the release baseline, so it belongs in the acceptance. **The claim that the slice is worth twice as much there is withdrawn** — it rested on the 16-pair tally the preflight refuted, and the real figure follows the attribution in the reopened exposure task |
