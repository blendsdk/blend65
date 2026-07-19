# 03-04 — Corpus Supersession, Re-Anchoring, and Oracle Dispositions

> Complexity: **M**, sensitivity **high** · Phase 4 — the single corpus commit
> This is the phase where a careless edit produces a **green test asserting nothing**. Every
> item below is specified as a semantic re-derivation, never a textual substitution.

## Order of operations inside the phase

Reversing 1 and 2 would regenerate goldens against a half-wired pipeline.

1. Wire the branch tail into the four emission sites; register the two IL passes (and update the
   three doc comments the registration falsifies).
2. Re-anchor the label-dependent artifacts (§2) — **before** regenerating, so nothing is
   re-anchored by reading a diff.
3. Fix the four oracle files (§3), using the pre-stated switch shape rather than the output.
4. Regenerate the 14 goldens; hand-review each against its twin.
5. Re-derive the four budget windows, the two hand-derived constants, **and every program's
   `bytes` ratchet** from the regenerated artifacts (§4).
6. Update routing at source; regenerate the scoreboard (§5).
7. Local emulator tiers, including balloon's measured re-measurement.

**If the hand review at step 4 rejects a shape**, attribute it before changing anything. The four
transforms are separably wired, so unregistering a pass at `emit.ts:108` or skipping one consult
site bisects them in the working tree, and the per-transform spec suites from Phases 1–3 say which
decision procedure is at fault. Rollback is not the concern — the review precedes the commit
(AR #57).

## 2. Label re-anchoring

`Main_main_L0` is a pure trampoline in `rasterpoll`, `guards` and `balloon` and is deleted.

**The trap.** After threading, the frame back-edge *and* the poll back-edge both land on the
**poll** block. Anchoring an `arrivals` landmark there counts poll iterations, so the machine stops
inside the first frame with **no body update run**. The correct anchor is the surviving
**once-per-frame** program point: the post-poll frame-body block (`Main_main_L5` in all three
fixtures, already used as balloon `frameUpdate.fromLabel` at `budgets.json:55`).

**How that trap actually fails, corrected at preflight** (AR #46). The earlier wording here — and
the corresponding hazard text in the RD — said a poll-anchored landmark would leave "every
observable assertion still passing, against a state that means nothing". That is **false** for
these three fixtures, and the correction matters because it decides what AC-12 needs. All three
observable tables assert *body-written* state: `rasterpoll` checks `$0400 == 1` ("heartbeat: frame
counter after one body") and the border readback; `guards` checks four guard verdicts at
`$0400-$0403`; `balloon` checks sprite x/y at `174/141`, "one +2 step" from the start position.
Stopping at the 2nd poll arrival is *before* the first body runs, so those checks read pre-body
state and **fail loudly**. A careless re-anchor is caught, not silently absorbed.

The re-anchoring decision is unchanged — anchoring on the poll block would break the suites, which
is reason enough. What changes is AC-12's proof obligation: the existing check set **is** the
once-per-frame witness (poll-anchored it reads 0 ≠ 1 and fails; body-anchored it reads 1 and
passes), so AC-12 is discharged by those checks rather than by a new assertion nobody has written.

**The property this depends on, to be preserved deliberately.** The hazard is defeated only because
these three check sets happen to include first-body-written values. `balloon`'s table also carries
init-only checks (`$07f8`, `$d015`, `$d027`), and a fixture whose observables were *entirely*
init-state would make the originally-feared silent green real. So: **every re-anchored fixture's
check set must include at least one value written by the frame body.** That is now a stated
property, not luck.

Arrival counts stay as they are. Today `Main_main_L0`'s 2nd arrival means "one complete frame
body has run"; the frame-body block's 2nd arrival means "one complete frame body has run, at the
start of the second" — the same memory state.

| Artifact | Change |
|---|---|
| `test-harness/src/rasterpoll.spec.test.ts:21` | `LOOP_HEAD_LABEL` → the frame-body label; docstring rewritten |
| `test-harness/src/guards.spec.test.ts:27` | same |
| `test-harness/src/balloon.spec.test.ts:24` | same |
| `test-harness/test/golden/budgets.json:56` | balloon `frameUpdate.toLabel` → the threaded back-edge's new target |
| `test-harness/src/run/label-arrivals.spec.test.ts` | **AR #35** — delete `resolveLoopHead` and `JMP_ABSOLUTE`; anchor directly on the frame-body label; rewrite the docstring, whose claim that "its entry jumps straight to the frame loop head" becomes false |
| `test-harness/src/testing/observables.ts:115` · `src/run/strategies.ts:115` | **AR #54** — two JSDoc usage examples hard-code `"Main_main_L0"`, the trampoline this change deletes. No test reads them, so nothing fails; but AR #35 exists precisely because an artifact list was incomplete, and these escaped the same sweep. A reader copying either example gets the stops-inside-the-first-frame semantics documented above |

Balloon's `frameUpdate` is the one window that needs a second look. `windowSlice`
(`budgets.spec.test.ts:139-159`) resolves a back-edge window by walking forward from `fromLabel`
to the **first** transfer instruction whose operand is `toLabel`'s address. The plan verifies
that no earlier transfer inside the frame body targets the new `toLabel`; if one does, the window
is re-scoped rather than silently measuring a shorter slice.

## 3. Oracle dispositions — one decision per file, taken here, not at red-test time

| File | Disposition |
|---|---|
| `codegen/src/instr/translate-brcmp.spec.test.ts` | **Preserved** (AR #31). `fusedFn` (`:86-99`) builds exactly three blocks with the entry pinned at index 0, so no *ordering* of three blocks can keep a target non-adjacent — preservation is achieved by **interposing a non-target filler block** between `_entry` and `_L1`. All 47 per-row `expected` arrays stay byte-identical; only `expectFused`'s rendered trailing scaffold (`:143-153`) and the fixture's doc comment change. This works *here* precisely because the scaffold is centralized in `expectFused` — contrast the impl file below. The filler survives because this suite calls `translateFunction` directly, so the IL passes never run. The matrix exists because a fused branch "would still look plausible in isolation; only the pair pins it" — and inversion *is* a polarity flip, so it must not be folded into the polarity oracle. |
| `codegen/src/instr/switch-translate.spec.test.ts:63-64` | **Superseded in writing** (AR #24 procedure). It drives the real pipeline and asserts `CMP / BEQ / JMP`, a shape elision rewrites. The post-layout shape is **pre-stated below** so the replacement is derived from RD-05 semantics, not read off the output. |
| `codegen/src/instr/translate.impl.test.ts` | **Filler block** (AR #36, **corrected at preflight**), same mechanism, at `:449-463` and `:499-527`. The `:454-455` **branch-pair lines** stay byte-identical, and the `:526` `toContain` is untouched. The `:449` assertion is a full-text `toBe` that inlines the whole rendered function, so the filler's label and `RTS` land *inside* its expected array, which grows by two lines — that growth is the recorded scaffold change, not a drifted expectation. The earlier claim that "both affected assertions stay byte-identical" was wrong and would have handed the Phase 4 executor a contradiction against a standing rule. These fixtures exist to test block-boundary register reset and translator totality; rewriting their *expectations* would quietly convert them into layout tests, which is still forbidden. |
| `codegen/src/il/multiblock-translate.spec.test.ts` | **Unaffected**, re-verified at plan time (`:58`, `:70` are loose and back-edge jumps survive). Re-checked after regeneration rather than trusted. |

**The switch oracle's post-layout shape, pre-stated** (AR #55). The task that rewrites it runs after
the wiring tasks, so without this the replacement assertions would be authored with the
implementation's output on screen — at exactly the moment an oracle is being re-authored, and
against `07`'s rule that spec expectations never come from running the implementation. The shape is
derivable now, from RD-05 semantics plus the committed golden.

A dispatch test lowers to `brcmp eq · discriminant, k → bodyBlock, nextTestBlock`, and the
committed `slice4b` golden shows the **next test block is the next emitted block**:

```
    CMP #$01
    BEQ Main_main_L1        ; body
    JMP Main_main_L5        ; next dispatch test — and L5 is the next emitted block
Main_main_L5:
```

So `F === N` and the elision arm of the tail decision fires: the trailing `JMP` disappears and the
next test's own load follows the branch directly. The superseded assertions therefore expect
`CMP #<k>` · `BEQ <body-label>` with **no intervening `JMP`** — not an inversion, because the
*false* edge, not the true edge, is the fall-through. If regeneration instead produces the inverted
form, the prediction was wrong and that is a finding to investigate, not an expectation to adjust.

## 4. Budgets — all four windows **and all fifteen byte ratchets**, in the same change

Ratchet discipline: budgets start at the current cost exactly, regressions fail, and an
optimization tightens the budget in the same change (AR #12, #17).

**The byte ratchets are part of that discipline and were missing from this plan** (AR #56).
`budgets.json` carries a per-program `bytes` budget for **all 15 programs**, and
`budgets.spec.test.ts:242` asserts `checkCostWithinBudget(name, "assembled bytes", bytes,
program.bytes)` for every one of them. The check is a pure `actual > budget` test, so a program that
*shrinks* passes silently. Re-deriving only the four cycle windows would leave at least ten byte
ratchets permanently slack: nothing goes red, no gate complains, and the discipline is violated in
a way that no test will ever report — the same silent-green class this document exists to prevent.

Two things make it worth the extra column rather than a nice-to-have. It converts AC-9's "no
individual fixture regresses" from closeout narrative into a committed gate. And **`balloon` has no
golden**, so its byte ratchet is the *only* size gate it has; leaving that one slack removes
balloon's sole protection.

Every program's `bytes` is therefore re-derived from the regenerated binary. The five branch-free
programs must re-derive to their **current** values exactly — a free cross-check on the
byte-unchanged claim, and a byte moving there is a stop, not a budget bump.

| Program | Window | Today | Expected direction |
|---|---|---|---|
| `rasterpoll` | `pollIter` | 15 | ↓ — the slice becomes the three-instruction poll |
| `guards` | `compoundGuard` | 24 | ↓ — two inversions remove two jumps from the slice |
| `slice8b` | `copyLoop` | 60 | ↓ — the slice carries both an inversion and an elision site |
| `balloon` | `frameUpdate` | static 235, measured 133 | ↓ both |

Every value is **re-derived from the regenerated golden**, never predicted. The two hand-derived
constants live in TypeScript with their derivations in comments
(`test-harness/src/budgets.spec.test.ts:73,86`), not only in `budgets.json`; both files change
and the derivation comments are re-transcribed from the regenerated output.

`balloon.frameUpdate.measuredMaxCycles` is VICE-derived and cannot be re-measured in CI
(AR-27). VICE 3.10 is present on this machine, so it is a scheduled local task — not a deferral.

## 5. Routing and scoreboard

Routing lives in `test-harness/test/golden/twins.json`, **not** in the generated
`SCOREBOARD.md`. Seven rows are affected:

| Pair | Category | Issue | Action |
|---|---|---|---|
| `guards` | instruction selection | 51 | delete, or retarget to the residual divergence |
| `guards` | layout | 51 | delete or retarget |
| `guards` | instruction selection | 59 | **move to 51** — "unreachable epilogue: main never returns, yet an RTS is still emitted past the frame loop" is exactly what the removal pass fixes |
| `rasterpoll` | instruction selection · layout | 51 | delete or retarget |
| `balloon` | instruction selection · layout | 51 | delete or retarget |

The free-text notes ("JMP 23 vs 1", "JMP 7 vs 1", "JMP 21 vs 3") are **not** validated by the
freshness gate — `scripts/gen-parity-scoreboard.mjs:97-107` checks routing categories only — so
refreshing them is a hand-review item CI cannot catch. Stale counts here are a documentation
defect that no test will ever report.

`SCOREBOARD.md` is regenerated and its freshness gate must be green.

## 6. Corpus-level expectations (AC-9)

Corpus **total** bytes and static cycles both strictly decrease, and no individual fixture
regresses on either metric. The five branch-free goldens (`gate`, `slice3a`, `slice3b`,
`slice5a`, `slice5b` — 0 jumps each) are expected to be **unchanged**, not improved; a byte
moving in any of them is a defect, not a win. Baseline: corpus 3896 bytes / 5023 static cycles.
`balloon` has no golden and is measured from its live compile.
