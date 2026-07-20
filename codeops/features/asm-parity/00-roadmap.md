# Roadmap: Asm-Parity Initiative

> **Feature-Set**: Asm-Parity Initiative
> **Status**: In Progress
> **Created**: 2026-07-17
> **Last Updated**: 2026-07-20 (**RD-05 ✅ CLOSED** — block layout landed across 5 phases / 58 tasks, one commit per phase, with the whole corpus regenerating exactly once. The emitter no longer writes jumps a hand-coder would not: a block's trailing jump disappears when one of its edges is simply the next block, and the branch inverts when it is the *true* edge that falls through — one decision, taken where block adjacency exists, compared on IL labels so the entry block's separate naming scheme never enters it. Branches onto jump-only blocks go straight to the end of the chain; blocks control cannot reach are not assembled at all. **Corpus 3896 → 3616 bytes and 5023 → 4724 static cycles, 4.23× → 3.93× and 5.53× → 5.20× against the hand-written twins**, with no fixture regressing and the five branch-free ones byte-identical. `rasterpoll`'s poll loop is now its twin instruction for instruction — LDA/CMP/BNE onto its own head, 3 instructions, 7 bytes, 9 cycles — and its routing rows moved off #51 to #59, because what is left of its gap is startup ceremony rather than layout; `balloon`'s layout row moved to #49, its residual being the unrolled pokes the `copy()` gap forces. **#65 closed**: an out-of-reach branch now relaxes to the inverted-branch-over-jump form a hand-coder writes, iterating to a fixpoint because the inserted bytes can push a neighbour out of range. Measured first, before any code changed: the old failure was loud (`Target out of range (-219; 91 too far)`, no binary), so #65's severity stood. The phase shape earned itself — relaxation wired first as a provable corpus no-op, everything else built unwired and wired once. Four permanent invariants now guard the corpus (ST-B39/B40/B43/B44, 43 assertions); each was seeded and watched to fail, and the `_rlx<N>` carve-out was checked in **both** directions so it bans the missed-inversion trigram without forbidding legal relaxed code. Six execution-time resolutions, AR #58–#63, three of which added specification tests that did not exist; one came from a **correctness defect the Phase 2 review caught** — a trampoline chain dead-ending in a missing label was followed rather than abandoned, turning one broken edge into two and moving the translator's eventual error off its own cause. Four phase reviews on a different model family: **no critical or major findings**, five minor, all applied. Verify green throughout; `spec/` untouched. Next: RD-06 (#52) or RD-13 (#58). — prior: **RD-05 🔬 PLAN PREFLIGHTED** — 5-cluster fan-out on a different model family plus a hardening challenger over the major batch raised **27 findings (6 major)**, all resolved and applied; the plan is now 5 phases / **58 tasks**. The architecture survived intact — build-unwired/wire-once, relaxation first, the filler-block mechanism — and scope creep returned **zero** findings; the defects clustered in oracle placement, oracle wording, and two committed gates that quietly under-enforced. Load-bearing catches: **ST-B27, the sole proof of AC-7, could not be written where it was assigned** — `@blend65/codegen` cannot import `@blend65/compiler`, where the `--optimize` gate lives (found independently by three clusters; moved to the test-harness tier and its assertions enumerated). **Every program's `bytes` ratchet would have gone permanently slack** — the plan re-derived only the four cycle windows, so ten shrinking programs would have kept loose budgets with no red test, and `balloon`, which has no golden, would have lost its only size gate. **The permanent corpus scan covered only half the tail decision** — a missed *inversion* leaves a shape neither invariant sees; the challenger then caught that the obvious third invariant is textually identical to relaxation's own minted output, so it ships with an `_rlx<N>` carve-out that would otherwise have banned legitimate relaxed code from the corpus forever. Also: `invertBranch` shipped wired in Phase 1 with its oracle two phases later (and Phase 3's "verify red" therefore unachievable); the 16-bit unsigned inversion named a call site that cannot reach the branch it must invert, which is emitted inside a helper shared with the value tail; **ST-B32 specified an input a correct implementation would fail**; and an unused `cpu` parameter would have failed `no-unused-vars`, so Phase 1 could not have ended green. Three findings were defects in the **RD** and were back-propagated: AC-13's invariant list, AC-10's impossible "mutually displacing branches", and a re-anchoring hazard rationale that the observable tables refute — the decision it justified stands, but AC-12 is now discharged by the existing body-written checks. 18 resolutions recorded as AR #40–#57. Verify green. Next: `exec_plan`. — prior: **RD-05 📋 PLAN CREATED** — block layout (#51). 5 phases / 54 tasks under `plans/rd-05-block-layout/`. The plan's own gate raised **6 items (AR #34–#39)**, two of which are RD gaps the preflight did not reach because they are only visible from the code: `run/label-arrivals.spec.test.ts` derives the frame-loop head by reading `_main`'s first byte and asserting `$4C`, the very jump this RD elides — a **fourth** label-anchored artifact, and one on the local VICE tier, so CI would stay green while it rots; and `instr/translate.impl.test.ts` carries three hand-built fixtures where the true target is also the next block, so inversion breaks two assertions. Both resolved by the interposed-filler-block mechanism AR #31 already established. The load-bearing decision was the phase shape: every transform changes the emitted asm the moment it is wired, yet the RD demands the corpus regenerate once. Resolution — build unwired, wire once — with a challenger correction that moved **relaxation to Phase 1**, because with no out-of-range branch anywhere in the corpus it is a provable no-op, so wiring it first costs nothing and turns the byte-exact goldens into a free proof that it is the identity on in-range code. Prior: **RD-05 🔎 PREFLIGHTED** — Zero-Ambiguity Gate passed on 8 items (AR #26–#33), the architectural one challenger-hardened; then a 5-cluster preflight fan-out on a different model family raised **32 findings (10 major)**, all resolved. It caught a self-contradiction between two acceptance criteria, a set of emulator landmarks anchored to a label this RD deletes (whose obvious repair would have silently gutted the balloon observables), a relaxation form that is not representable in the instruction model, and two of the author's own supporting rationales — the register's AR #26/#28/#31 notes were corrected in step. Transforms split by seam: jump threading + unreachable-block removal as IL passes, fall-through elision + branch inversion as one tail decision at translation, branch relaxation as a new unconditional stage — the instruction peephole ruled non-viable (its rule contract excludes labels from windows) and left to #52. Layout is unconditional, not `--optimize`-gated, because #65 relaxation is correctness and must measure the emitted geometry. Measured baseline: 105 `JMP`s corpus-wide, **47 fall-through** and **13 trampoline blocks**; `guards` emits 23 `JMP`s against its twin's 1. Both RD-04's transferred twin-idiom criterion and #65 are written as ACs. Next: `preflight` the RD. — prior: **RD-04 ✅ CLOSED** — all 5 phases / 43 tasks. Conditions branch on their comparison's own flags: `!` is a free label swap, `&&`/`||` are CFG edges claiming no frame slot, boolean literals fold to a jump; the SFA slot rule moved in step, position-dependent, still with no codegen import. 8 of 14 goldens regenerated and hand-reviewed; `slice6` — all value-position — did not move a byte, the corpus-level proof fusion stayed in condition position. Corpus 4172→3896 bytes, 5340→5023 static cycles; rasterpoll poll path 12 cycles; guards compound guard 43→24; balloon measured frame 162→133. The #50 divergence rows are gone from every pair that carried them. AC-1…AC-10 walked against committed artifacts; area report posted on #50. Spun off #66 — a pre-existing switch-on-ternary ICE. Next: RD-05 (#51 block layout), unblocked — note #51 is the dominant *structural* divergence, not the largest by row count (#59 and #58 carry more), which is why the wave sequences by representativeness × risk)
> **Progress**: 4 / 14 (29%)
> **CodeOps Skills Version**: 3.8.0
>
> Requirements for this feature live as **GitHub issues #49–#64** (umbrella: [#56](https://github.com/blendsdk/blend65/issues/56));
> each row links its issue. On pickup, the RD document is authored from the linked issue, then the
> standard per-item sequence runs: `preflight (RD) → make_plan → preflight (plan) → exec_plan`.
> Governing bar: the Prime Directive (project `CLAUDE.md`) — output parity with hand-written assembly.

## ▶ Resume here (2026-07-20)

One open thread.

**RD-05 is fully closed out.** Task 5.6 posted on authorisation: the block-layout area report is
on [#51](https://github.com/blendsdk/blend65/issues/51)
([comment](https://github.com/blendsdk/blend65/issues/51#issuecomment-5022094039)), which stays
**open** for the block *reordering* this slice scoped out — the five `guards` if/else-arm jumps.
[#65](https://github.com/blendsdk/blend65/issues/65) is **closed**
([comment](https://github.com/blendsdk/blend65/issues/65#issuecomment-5022095419)). 58/58 tasks.

**RD-03 is planned — next step is `preflight` on the plan, then `exec_plan`.** The plan is
5 phases / 40 tasks under [`plans/rd-03-placement/`](plans/rd-03-placement/00-index.md), with 7
plan-stage decisions recorded as AR #69–#75. Its load-bearing shape: **the mechanism lands before
the balloon rewrite, and its acceptance is that nothing moves** — no fixture takes a const array's
address today, so the 14 byte-identical goldens are a free proof that the rule excludes
by-reference arguments. Two decisions were challenger-hardened: the hand-written twin **stays
unchanged** (its copy targets `$0340`, below the PRG load base — an idiom placement cannot reach,
not a defect), and the new emission is proven by a **CI-tier in-test fixture rather than a golden**
(a golden containing the silently-wrong `!align 256, 0` would look plausible and pass; only a
resolved-address assertion catches it).

**RD-03 was preflighted first.** The scan raised **29 findings (2 critical,
7 major)**, all resolved and applied to the RD and the register
([report](requirements/00-preflight-report-rd-03.md)). The thesis held under measurement —
balloon **677 → 318 bytes, 2.70× → 1.27×**, sprite block 36 at `$0900`, mechanism proven end to
end — but two defects would have sunk the implementation:

- **The trigger rule was undefined at exactly the level that matters.** `&X` and an ordinary
  by-reference array argument emit the *same* IL `addrOf` operand — `slice7b.asm.golden:89,91`
  already contains the instruction pair the RD cited as its own verification. An IL-operand scan
  would have aligned `slice7b`/`slice8b` (+435 B) and tried to page-align `slice8`'s function
  labels. M1 is now pinned to the **syntactic** `&` set, marked in `lowerAddressOf` gated on
  `sym.kind === "constant"` — free, and with no AST pass.
- **AC-5 was unachievable.** balloon's observable table is the *shared* twin-equivalence
  contract, and two of its rows are welded to `$0340`/block 13; the twin keeps staging there. The
  table now splits per the doctrine `observables.ts` already states (new M6).

Also settled: **padding visibility is scoped out** (the build summary's segment reporting is
unwired and its layout is spec-transcribed — needs its own RD); **`$1000–$1FFF` is char-ROM
shadow to the VIC**, so "any aligned address in the bank works" was false and AC-1 now pins
balloon below `$1000`; and a **new mixed-alignment fixture** turns three vacuous criteria
(AC-2/AC-7 + M1's negative half) into discriminating ones.

Two follow-ups were spun off: **[#67](https://github.com/blendsdk/blend65/issues/67)**
(build-summary segment sizes declared but never populated — all four segment lines print zeros)
and **[#68](https://github.com/blendsdk/blend65/issues/68)** (page-aligned const data can land in
the VIC char-ROM shadow or outside the bank, silently).

Still open from before: **the `E10193`/symbolic-fold gap needs an owner.**
`const BLOCK: byte = hi(&SPRITE) * 4;` is rejected because `&SPRITE` is a *link-time* symbol — it
cannot fold to a literal, only to an emitted ACME expression. A different mechanism from #49 ①'s
numeric fold, unscoped today; route it to #58/#60 at RD-03 closeout. Measurements are on
[#49](https://github.com/blendsdk/blend65/issues/49#issuecomment-5021941029).

After RD-03: **#49 Phase 1 as one RD** — item ①'s const-evaluated half + item ③ + item ⑤, with
the runtime-address half of `poke`/`peek` split into its own later RD. Sequenced second because
it is byte-neutral by its own acceptance criterion, and because doing RD-03 first *shrinks* item
③'s balloon diff (RD-03 deletes the `$0340-$037E` staging pokes; ③ then renames only the ~10
register accesses). Note ③ cannot ship as a drop-in library: there is no module search path in
`packages/config/src` or `packages/cli/src` — imports resolve as sibling files — so "zero
compiler change" holds only for copy-the-file-into-your-project distribution.

Alternatives to RD-03 if priorities shift: RD-06 (#52, INC/DEC peephole — smallest) or RD-13
(#58, const-fold — whose groundwork RD-05 deliberately built as a separately schedulable pass).
Note also that **#59 is now the top divergence by breadth** (17 rows across 13 of 14 pairs) while
the roadmap still tiers it B3 — that tiering no longer matches the data and is worth revisiting.

---

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Depends-on / Blocker |
|----|-------|----|------|-------|--------|--------------|----------------------|
| RD-01 | Parity measurement infrastructure ([#64](https://github.com/blendsdk/blend65/issues/64)) | [RD](requirements/RD-01-parity-measurement-infrastructure.md) | [Plan](plans/rd-01-parity-measurement-infrastructure/00-index.md) | Done | ✅ | 2026-07-18 | — |
| RD-02 | Golden-corpus twin audit + scoreboard ([#61](https://github.com/blendsdk/blend65/issues/61)) | [RD](requirements/RD-02-golden-corpus-twin-audit.md) | [Plan](plans/rd-02-golden-corpus-twin-audit/00-index.md) | Done | ✅ | 2026-07-18 | — |
| RD-03 | Placement: align const data, read it in place ([#49](https://github.com/blendsdk/blend65/issues/49)) | [RD](requirements/RD-03-placement.md) | [Plan](plans/rd-03-placement/00-index.md) | Plan Created | 📋 | 2026-07-20 | Placement slice only; `copy()` (FUT-012) stays gated but is **no longer blocking**. Grammar-free — no `spec/` change, no Guard. **Measured** target: balloon 677→**318 B** (2.70×→**1.27×**), zero runtime copy — beats the twin at runtime, not on bytes. [Preflight](requirements/00-preflight-report-rd-03.md): 29 findings (2 critical, 7 major), all resolved. AR #64–#68 + addenda · Fable |
| RD-04 | Compare-and-branch fusion ([#50](https://github.com/blendsdk/blend65/issues/50)) | [RD](requirements/RD-04-compare-and-branch-fusion.md) | [Plan](plans/rd-04-compare-and-branch-fusion/00-index.md) | Done | ✅ | 2026-07-19 | AC-1…AC-10 all walked; corpus 4172→3896 B / 5340→5023 cyc; **#50 closed**; spun off [#66](https://github.com/blendsdk/blend65/issues/66) |
| RD-05 | Block layout: fall-through elision + jump threading ([#51](https://github.com/blendsdk/blend65/issues/51)) | [RD](requirements/RD-05-block-layout.md) | [Plan](plans/rd-05-block-layout/00-index.md) | Done | ✅ | 2026-07-20 | AC-1…AC-13 all walked ([closeout](plans/rd-05-block-layout/08-closeout.md)); corpus 3896→3616 B / 5023→4724 cyc; **#65 closed**; AR #58–#63 at execution |
| RD-06 | Peephole seed catalog: INC/DEC, loads, staging ([#52](https://github.com/blendsdk/blend65/issues/52)) | — | — | Backlog | ⬜ | 2026-07-18 | B1 — **Rule 1 (INC/DEC) only**; R2–3 deferred (MMIO); seam blend65-ri/RD-08 |
| RD-07 | Register-resident loop counters ([#53](https://github.com/blendsdk/blend65/issues/53)) | — | — | Backlog | ⬜ | 2026-07-18 | B2 — **demoted** (1 fixture); after RD-04, RD-06 |
| RD-08 | Game-relevant completeness gaps ([#54](https://github.com/blendsdk/blend65/issues/54)) | — | — | Backlog | ⬜ | 2026-07-17 | — |
| RD-09 | Sweep D: lowering & instruction selection ([#60](https://github.com/blendsdk/blend65/issues/60)) | — | — | Backlog | ⬜ | 2026-07-18 | #60 = #58 const lever (→B2); + re-sweep after B |
| RD-10 | Sweep C: memory, ABI, interrupts, startup ([#59](https://github.com/blendsdk/blend65/issues/59)) | — | — | Backlog | ⬜ | 2026-07-18 | B3 — ABI hot cycle lever (balloon ≈13 instr/call); startup trim cheap · Fable |
| RD-11 | Sweep F: intrinsics & runtime routines ([#62](https://github.com/blendsdk/blend65/issues/62)) | — | — | Backlog | ⬜ | 2026-07-17 | interacts with RD-03 |
| RD-12 | Sweep A: frontend conformance & diagnostics ([#57](https://github.com/blendsdk/blend65/issues/57)) | — | — | Backlog | ⬜ | 2026-07-17 | — |
| RD-13 | Sweep B: semantics & const-evaluation ([#58](https://github.com/blendsdk/blend65/issues/58)) | — | — | Backlog | ⬜ | 2026-07-18 | split: const-fold → B1; whole-loop eval + SFA slot-elision → B2 (type-conformance audit) · Fable |
| RD-14 | Sweep G: developer experience ([#63](https://github.com/blendsdk/blend65/issues/63)) | — | — | Backlog | ⬜ | 2026-07-17 | — |
| T-01 | CLI bug: relative --out-dir breaks ACME ([#55](https://github.com/blendsdk/blend65/issues/55)) | — | — | Backlog | ⬜ | 2026-07-17 | — |
