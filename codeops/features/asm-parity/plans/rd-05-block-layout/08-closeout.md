# Closeout — Block Layout (RD-05)

> **Implements**: asm-parity/RD-05 · [#51](https://github.com/blendsdk/blend65/issues/51), [#65](https://github.com/blendsdk/blend65/issues/65)
> **Completed**: 2026-07-20 · 5 phases / 58 tasks
> **Commits**: `868700c` (relaxation, wired) · `e925640` (IL passes, unwired) · `32d7e9e` (tail decision, unwired) · `3fed25e` (the corpus commit) · this one (invariants + closeout)

## Delta record (AC-9)

Every figure below is read from a committed artifact after regeneration, never predicted.
`balloon` has no golden and is measured from its live compile.

| Program | bytes before | after | Δ | static cycles before | after | Δ |
|---|---|---|---|---|---|---|
| gate | 30 | 30 | 0 | — | — | — |
| slice3a | 36 | 36 | 0 | — | — | — |
| slice3b | 233 | 233 | 0 | — | — | — |
| slice4a | 176 | 143 | −33 | 211 | 178 | −33 |
| slice4b | 176 | 149 | −27 | 210 | 183 | −27 |
| slice5a | 235 | 235 | 0 | — | — | — |
| slice5b | 151 | 151 | 0 | — | — | — |
| slice6 | 535 | 487 | −48 | 695 | 647 | −48 |
| slice7 | 328 | 310 | −18 | 398 | 380 | −18 |
| slice7b | 361 | 355 | −6 | 514 | 508 | −6 |
| slice8 | 166 | 153 | −13 | 252 | 234 | −18 |
| slice8b | 402 | 387 | −15 | 510 | 495 | −15 |
| guards | 263 | 211 | −52 | 305 | 248 | −57 |
| rasterpoll | 75 | 59 | −16 | 87 | 66 | −21 |
| balloon | 729 | 677 | −52 | 843 | 787 | −56 |
| **Corpus** | **3896** | **3616** | **−280** | **5023** | **4724** | **−299** |

Ratio against the hand-written twins: **4.23× → 3.93×** bytes, **5.53× → 5.20×** static cycles.
`balloon`'s measured frame update: **133 → 125** cycles on VICE 3.10 (1.37× → 1.29×).

No fixture regressed on either metric. The five branch-free programs are byte-identical and
their ratchets re-derived to their existing values **exactly** — the cross-check AR #56 exists
for.

Budget windows, all re-derived from the regenerated goldens:

| Window | before | after |
|---|---|---|
| `rasterpoll` `pollIter` | 15 | **9** |
| `guards` `compoundGuard` | 24 | **18** |
| `slice8b` `copyLoop` | 60 | **54** |
| `balloon` `frameUpdate` | 235 static / 133 measured | **200 / 125** |

## Acceptance-criteria walk

The **Kind** column from [07](07-testing-strategy.md) is respected: a hand-reviewed artifact is
never cited as a committed test.

| AC | Verdict | Evidence |
|---|---|---|
| 1 — no fall-through jumps | ✅ | `golden-layout.spec.test.ts` ST-B39 over all 14 goldens, green. Baseline was 47 across 9 goldens; the scan now reports zero. Seeded a violation and watched it fail (task 5.2) |
| 2 — no trampoline blocks | ✅ | ST-B40 over all 14, green; seeded and watched fail. **Baseline discrepancy, stated rather than smoothed over**: run against the pre-change corpus the committed scan counts **12**, not the RD's hand-counted 13 (`slice4a` 2, `slice4b` 2, `slice7` 1, `slice8` 1, `guards` 3, `rasterpoll` 3). The same run reproduces the fall-through baseline of 47 exactly, so the parser is not under-reading. The one-count gap is **not reconciled** — the RD's figure was a hand count and the discrepancy is plausibly a jump-only *entry* block, which the invariant deliberately excludes, but that has not been verified and is not claimed. It does not affect the verdict: the post-change count is zero on either baseline |
| 3 — raster idiom | ✅ | `rasterpoll.asm.golden` is `LDA $D012` · `CMP #$FB` · `BNE Main_main_L3` — 3 instructions, 7 bytes, 9 cycles taken (4+2+3), matching its twin instruction for instruction. Committed test: ST-B25. `pollIter` re-derived 15 → 9 |
| 4 — unreachable removed, labels preserved | ✅ | The dead `RTS` epilogue is gone from both `rasterpoll` and `guards`. Committed: ST-B10/B11/B14/B41/B42/B46. Label survival is proven by the budget tier resolving every window and by the three emulator suites resolving their landmarks |
| 5 — inversion fires in `guards` | ✅ | *(hand review + ratchet)* `BCS L11 / JMP L10` → `BCC L10` and `BCC L9 / JMP L10` → `BCS L10`; the signed compare `BMI L15 / JMP L17` → `BPL L17`. `compoundGuard` re-derived downward in both files, 24 → **18** — the figure predicted in `02-current-state.md` before regeneration, reached exactly |
| 6 — out-of-range assembles and runs | ✅ | ST-B36/B37 assemble under ACME in CI; ST-B38 pins that in-range branches stay short **and** that each probe still contains a branch that cannot. Execution green on VICE 3.10: the loop counter reads exactly 3, the switch arm tag names case 2 |
| 7 — gating uniform | ✅ | ST-B27a/b/c: the raster-poll emission is clean under all three shape predicates with `optimize` on **and** off, the surviving block-label sets are identical, the dead epilogue is absent from both, and all four range builds assemble |
| 8 — oracles resolved as specified | ✅ | `translate-brcmp.spec.test.ts`: all 57 tests green with every per-row array byte-identical; only the filler's scaffold lines were added. `switch-translate.spec.test.ts` superseded to the shape pre-stated in `03-04` §3 — elision, and it came out exactly so. `translate.impl.test.ts` branch-pair lines byte-identical |
| 9 — corpus health | ✅ | Table above. Committed for per-fixture bytes and windows (including all 15 ratchets); **hand-computed** for the corpus totals. Goldens hand-reviewed against their twins; routing updated at source; `SCOREBOARD.md` regenerated with the freshness gate green; local emulator tiers green |
| 10 — boundary and safety | ✅ | Root boundary tier 33/33 (R15 holds). ST-B4 threading terminates on a cyclic ring; ST-B32 relaxation terminates on a displacement cascade; ST-B34/B46/B47 cover unresolvable and dangling targets. No truncated offset: ST-B29…B31 plus the ACME tier, which is what rejects a bad displacement |
| 11 — printed IL honest | ✅ | ST-B45: `emitIl` on raster-poll shows no trampoline and no `ret` block, and its block set equals the set `emitAsm` emits. CI-runnable |
| 12 — landmarks re-anchored correctly | ✅ | *(local tier)* All three suites green on `Main_main_L5` with their **existing** body-written checks — `rasterpoll` `$0400 == 1`, `guards` `$0400-$0403`, `balloon` sprite 174/141. Anchored on the poll block those read pre-body state and fail, so the check set **is** the once-per-frame witness (AR #46) |
| 13 — invariants self-enforcing | ✅ | ST-B39/B40/B43/B44 committed, 43 assertions. Each of the three shapes was seeded and observed to fail; the non-vacuity check fires on a mangled function marker; and the `_rlx<N>` carve-out was verified in **both** directions — it bans the missed-inversion trigram and permits the legal long-branch form |

## Residual divergence, for the next wave *(Should-Have)*

Where each pair's dominant remaining cause now sits, so the next item inherits an accurate
picture rather than a stale one:

- **`rasterpoll`** — layout is finished here. Its frame loop *is* the twin. The 23-byte gap is
  now entirely ceremony: the startup shim and the separate `__init` function, where the twin
  initialises inline. Both routing rows moved from #51 to **#59**.
- **`guards`** — five function-local jumps survive, all of them an if/else arm exiting to a join
  that is not the next block. Closing them needs the blocks *reordered*, which RD-05 scoped out
  (AR #27). Stays on **#51**, which is the right issue for block layout; the note now says so.
- **`balloon`** — jump count is essentially at parity (4 vs 3). The remaining 426-byte gap is
  dominated by the 63 unrolled pokes the missing `copy()` forces, so its layout row moved to
  **#49**. That makes `balloon` an RD-03 fixture now, not an RD-05 one.
- Corpus-wide, the largest remaining lever visible from here is **`slice6`** (8.70×) and
  **`slice7b`** (7.40×), neither of which is layout-bound.

## Execution-time resolutions

Six items the plan did not determine were resolved during execution and recorded as
**AR #58–#63** in [00-ambiguity-register.md](00-ambiguity-register.md). Three added specification
tests that did not exist (**ST-B46**, **ST-B47**, **ST-B48**); one — AR #62 — came from a
**correctness defect the Phase 2 review caught**, where a trampoline chain dead-ending in a
missing label was followed rather than abandoned, turning one broken edge into two and moving the
translator's eventual error off the block that caused it.

## Reviews

Each phase was reviewed on a different model family over its own diff. **No critical or major
findings across all four reviewed phases.** Five minor findings, all applied: one correctness
defect (AR #62), one coverage gap (a load-bearing negative sat behind an ACME gate it did not
need), and three stale comments.
