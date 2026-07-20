# Roadmap: Asm-Parity Initiative

> **Feature-Set**: Asm-Parity Initiative
> **Status**: In Progress
> **Created**: 2026-07-17
> **Last Updated**: 2026-07-20 (**RD-13 selected; #69 filed as RD-15** — an external review of the
> `balloon-color` demo's generated assembly was analysed against the register. Most of it was
> already owned or already shipped: its control-flow findings are RD-05's, closed; its
> address-materialization finding is #58's, filed; four of its nine points grade the compiler for
> things it does correctly — preserving MMIO store order and emitting `poke` as a raw store. Two
> were new. **[#69](https://github.com/blendsdk/blend65/issues/69)**: alignment granularity is 256
> bytes where a C64 sprite needs 64, costing **193 of 584 bytes (33%)** on that demo — and the
> finding is not the constant but that 64-byte alignment is *unusable*, since `hi(addr) * 4` is
> valid only at page alignment, `&X / 64` emits a runtime `JSR __rt_div16`, and `&X >> 6` is
> rejected. Filed as **RD-15, blocked on RD-13/#58**. And unsized until now: all 48 frame-variable
> accesses are absolute at `$2000` where zero page saves a byte and a cycle each — **−48 B**,
> strengthening #59. `--optimize` was confirmed a **no-op** today: it gates only the empty peephole
> catalog, so RD-04 and RD-05 are always-on and the review was assessing current best output. Two
> fixes committed: the demo enabled `$D015` before writing coordinates (a defect in the example,
> not codegen), and three translator diagnostics leaked an internal planning ID into the user's
> terminal. **Next: RD-13** — it now gates #69 as well as owning both RD-03 divergences. — prior:
> **RD-03 🔬 PLAN PREFLIGHTED** — 5-cluster fan-out on a different model family plus a hardening challenger over the major batch raised **28 findings (0 critical, 5 major)**, all resolved and applied; the plan is now 5 phases / **41 tasks**. The design survived intact — no architectural change recommended, and scope creep returned **zero** findings. Every empirical claim was reproduced independently before the scan began: 677 / 312 / 318 bytes, `$0A67` / `$08FA` / `$0900`, the 8-instruction `hi(&X)*4` sequence, the spurious `W10172`, and all four rows of the ACME `!align` trap table against real ACME 0.97. The defects clustered in oracles, sequencing and plumbing prose. Load-bearing catches: **the marking set was described against one of two lowering contexts** — `LowerCtx` is built at `lower.ts:294` (`__init`) and `:363` (per function), and adding a field forces both literals to supply one but not to *share* one, so a module-scope `let ptr: word = &TABLE;` (confirmed live by compiling a probe) would never align while the entire planned suite passed; **Phase 4 was CI-red by construction** — the scoreboard freshness gate hard-fails and rebuilds every pair from `examples/` source, yet the ratchets, routing prose and scoreboard sat in the next commit, contradicting both M4's "in the same change" and AR #73's own wording, with the root cause that the plan's Verify command was strictly weaker than CI; **two `[CI]` acceptance criteria were proven by tests that could not run or could not fail** — ST-C14/ST-C15 were unfiled beside a VICE-only example and would have *skipped* in CI rather than failed while AC-1/AC-4 read green, and ST-C13 computes both sides from the same symbol-map number so it is arithmetically implied by ST-C12 and inspects no emitted instruction; and **the RD's only new artifact had no creation task, name, or home**. Also: `twins.json` carries **four** falsified balloon routing rows, not one, and the gate is blind to prose; only **two** of the three `print-instr.ts` sites carry a `never` arm, so `isColumnZeroDirective` fails silently at the wrong indent; and no test pinned two address-taken arrays both aligning — the canonical two-sprite shape. Three new ST rows close the "passes the whole suite while the emitted code is wrong" class. Four findings were defects in the **RD** and were back-propagated: slice8b's S1 justification (the copies go into *mutable staging arrays*, and `$C000` is **above** the load base, not below), `slice7` mislabelled a by-ref negative control (it reads `__data_Gfx_TABLE,X` directly indexed and materializes no address), residual "new fixture's pair registration" contradicting AC-7, and the three-exhaustive-switches claim. AC-9 was relabelled `[CI]` → `[Review]`: CI has no `spec/` freeze step, and the porcelain check passes a *committed* spec edit clean. `spec/` untouched. Next: `exec_plan`. — prior: **RD-05 ✅ CLOSED** — block layout landed across 5 phases / 58 tasks, one commit per phase, with the whole corpus regenerating exactly once. The emitter no longer writes jumps a hand-coder would not: a block's trailing jump disappears when one of its edges is simply the next block, and the branch inverts when it is the *true* edge that falls through — one decision, taken where block adjacency exists, compared on IL labels so the entry block's separate naming scheme never enters it. Branches onto jump-only blocks go straight to the end of the chain; blocks control cannot reach are not assembled at all. **Corpus 3896 → 3616 bytes and 5023 → 4724 static cycles, 4.23× → 3.93× and 5.53× → 5.20× against the hand-written twins**, with no fixture regressing and the five branch-free ones byte-identical. `rasterpoll`'s poll loop is now its twin instruction for instruction — LDA/CMP/BNE onto its own head, 3 instructions, 7 bytes, 9 cycles — and its routing rows moved off #51 to #59, because what is left of its gap is startup ceremony rather than layout; `balloon`'s layout row moved to #49, its residual being the unrolled pokes the `copy()` gap forces. **#65 closed**: an out-of-reach branch now relaxes to the inverted-branch-over-jump form a hand-coder writes, iterating to a fixpoint because the inserted bytes can push a neighbour out of range. Measured first, before any code changed: the old failure was loud (`Target out of range (-219; 91 too far)`, no binary), so #65's severity stood. The phase shape earned itself — relaxation wired first as a provable corpus no-op, everything else built unwired and wired once. Four permanent invariants now guard the corpus (ST-B39/B40/B43/B44, 43 assertions); each was seeded and watched to fail, and the `_rlx<N>` carve-out was checked in **both** directions so it bans the missed-inversion trigram without forbidding legal relaxed code. Six execution-time resolutions, AR #58–#63, three of which added specification tests that did not exist; one came from a **correctness defect the Phase 2 review caught** — a trampoline chain dead-ending in a missing label was followed rather than abandoned, turning one broken edge into two and moving the translator's eventual error off its own cause. Four phase reviews on a different model family: **no critical or major findings**, five minor, all applied. Verify green throughout; `spec/` untouched. Next: RD-06 (#52) or RD-13 (#58). — prior: **RD-05 🔬 PLAN PREFLIGHTED** — 5-cluster fan-out on a different model family plus a hardening challenger over the major batch raised **27 findings (6 major)**, all resolved and applied; the plan is now 5 phases / **58 tasks**. The architecture survived intact — build-unwired/wire-once, relaxation first, the filler-block mechanism — and scope creep returned **zero** findings; the defects clustered in oracle placement, oracle wording, and two committed gates that quietly under-enforced. Load-bearing catches: **ST-B27, the sole proof of AC-7, could not be written where it was assigned** — `@blend65/codegen` cannot import `@blend65/compiler`, where the `--optimize` gate lives (found independently by three clusters; moved to the test-harness tier and its assertions enumerated). **Every program's `bytes` ratchet would have gone permanently slack** — the plan re-derived only the four cycle windows, so ten shrinking programs would have kept loose budgets with no red test, and `balloon`, which has no golden, would have lost its only size gate. **The permanent corpus scan covered only half the tail decision** — a missed *inversion* leaves a shape neither invariant sees; the challenger then caught that the obvious third invariant is textually identical to relaxation's own minted output, so it ships with an `_rlx<N>` carve-out that would otherwise have banned legitimate relaxed code from the corpus forever. Also: `invertBranch` shipped wired in Phase 1 with its oracle two phases later (and Phase 3's "verify red" therefore unachievable); the 16-bit unsigned inversion named a call site that cannot reach the branch it must invert, which is emitted inside a helper shared with the value tail; **ST-B32 specified an input a correct implementation would fail**; and an unused `cpu` parameter would have failed `no-unused-vars`, so Phase 1 could not have ended green. Three findings were defects in the **RD** and were back-propagated: AC-13's invariant list, AC-10's impossible "mutually displacing branches", and a re-anchoring hazard rationale that the observable tables refute — the decision it justified stands, but AC-12 is now discharged by the existing body-written checks. 18 resolutions recorded as AR #40–#57. Verify green. Next: `exec_plan`. — prior: **RD-05 📋 PLAN CREATED** — block layout (#51). 5 phases / 54 tasks under `plans/rd-05-block-layout/`. The plan's own gate raised **6 items (AR #34–#39)**, two of which are RD gaps the preflight did not reach because they are only visible from the code: `run/label-arrivals.spec.test.ts` derives the frame-loop head by reading `_main`'s first byte and asserting `$4C`, the very jump this RD elides — a **fourth** label-anchored artifact, and one on the local VICE tier, so CI would stay green while it rots; and `instr/translate.impl.test.ts` carries three hand-built fixtures where the true target is also the next block, so inversion breaks two assertions. Both resolved by the interposed-filler-block mechanism AR #31 already established. The load-bearing decision was the phase shape: every transform changes the emitted asm the moment it is wired, yet the RD demands the corpus regenerate once. Resolution — build unwired, wire once — with a challenger correction that moved **relaxation to Phase 1**, because with no out-of-range branch anywhere in the corpus it is a provable no-op, so wiring it first costs nothing and turns the byte-exact goldens into a free proof that it is the identity on in-range code. Prior: **RD-05 🔎 PREFLIGHTED** — Zero-Ambiguity Gate passed on 8 items (AR #26–#33), the architectural one challenger-hardened; then a 5-cluster preflight fan-out on a different model family raised **32 findings (10 major)**, all resolved. It caught a self-contradiction between two acceptance criteria, a set of emulator landmarks anchored to a label this RD deletes (whose obvious repair would have silently gutted the balloon observables), a relaxation form that is not representable in the instruction model, and two of the author's own supporting rationales — the register's AR #26/#28/#31 notes were corrected in step. Transforms split by seam: jump threading + unreachable-block removal as IL passes, fall-through elision + branch inversion as one tail decision at translation, branch relaxation as a new unconditional stage — the instruction peephole ruled non-viable (its rule contract excludes labels from windows) and left to #52. Layout is unconditional, not `--optimize`-gated, because #65 relaxation is correctness and must measure the emitted geometry. Measured baseline: 105 `JMP`s corpus-wide, **47 fall-through** and **13 trampoline blocks**; `guards` emits 23 `JMP`s against its twin's 1. Both RD-04's transferred twin-idiom criterion and #65 are written as ACs. Next: `preflight` the RD. — prior: **RD-04 ✅ CLOSED** — all 5 phases / 43 tasks. Conditions branch on their comparison's own flags: `!` is a free label swap, `&&`/`||` are CFG edges claiming no frame slot, boolean literals fold to a jump; the SFA slot rule moved in step, position-dependent, still with no codegen import. 8 of 14 goldens regenerated and hand-reviewed; `slice6` — all value-position — did not move a byte, the corpus-level proof fusion stayed in condition position. Corpus 4172→3896 bytes, 5340→5023 static cycles; rasterpoll poll path 12 cycles; guards compound guard 43→24; balloon measured frame 162→133. The #50 divergence rows are gone from every pair that carried them. AC-1…AC-10 walked against committed artifacts; area report posted on #50. Spun off #66 — a pre-existing switch-on-ternary ICE. Next: RD-05 (#51 block layout), unblocked — note #51 is the dominant *structural* divergence, not the largest by row count (#59 and #58 carry more), which is why the wave sequences by representativeness × risk)
> **Progress**: 5 / 15 (33%)
> **CodeOps Skills Version**: 3.8.0
>
> Requirements for this feature live as **GitHub issues #49–#64** (umbrella: [#56](https://github.com/blendsdk/blend65/issues/56)),
> plus spin-offs filed during execution (#65–#69);
> each row links its issue. On pickup, the RD document is authored from the linked issue, then the
> standard per-item sequence runs: `preflight (RD) → make_plan → preflight (plan) → exec_plan`.
> Governing bar: the Prime Directive (project `CLAUDE.md`) — output parity with hand-written assembly.

## ▶ Resume here (2026-07-20)

No open threads — RD-03 and RD-05 are both fully closed out. The next decision is which RD to pick
up (see the end of this section).

**RD-05 is fully closed out.** Task 5.6 posted on authorisation: the block-layout area report is
on [#51](https://github.com/blendsdk/blend65/issues/51)
([comment](https://github.com/blendsdk/blend65/issues/51#issuecomment-5022094039)), which stays
**open** for the block *reordering* this slice scoped out — the five `guards` if/else-arm jumps.
[#65](https://github.com/blendsdk/blend65/issues/65) is **closed**
([comment](https://github.com/blendsdk/blend65/issues/65#issuecomment-5022095419)). 58/58 tasks.

**RD-03 is closed out** — 41/41 tasks, 5 phases, one commit per phase
([closeout](plans/rd-03-placement/08-closeout.md)). **balloon 677 → 318 B, 2.70× → 1.27×**, its
sprite image page-aligned at `$0900` (block 36) and read in place with **no runtime copy at all**;
corpus 3616 → **3257 B** and 4724 → **4237 cyc**, 3.93× → **3.54×**. Every other fixture is
unchanged to the byte and all 14 goldens are byte-identical across the whole range. The residual
67 B decomposes as +61 code stream (→ #52/#58) and **+6 page padding**, which is the only cost
placement itself adds and re-rolls anywhere in 0–255. Two runtime decisions, AR #76–#77; four phase
reviews on a different model family — **no critical, one major** (a debug probe committed by
accident), rest minor. Task 5.6 posted on authorisation: the placement area report is on
[#49](https://github.com/blendsdk/blend65/issues/49)
([comment](https://github.com/blendsdk/blend65/issues/49#issuecomment-5024737189)), and it retracts
the issue's own 2026-07-18 framing — "`copy()` is required for the balloon, placement can't
substitute" — whose premise (`$0340` sits below the PRG load base) was true and whose conclusion was
not: the twin's author *chose* a block there, and placement alone removed the copy. **#49 stays
open** (this was its placement slice only — ①/③/⑤, runtime-address `poke` and the format handlers
are untouched). The plan is
5 phases / **41 tasks** under [`plans/rd-03-placement/`](plans/rd-03-placement/00-index.md), with 7
plan-stage decisions recorded as AR #69–#75. Its load-bearing shape: **the mechanism lands before
the balloon rewrite, and its acceptance is that nothing moves** — no fixture takes a const array's
address today, so the 14 byte-identical goldens are a free proof that the rule excludes
by-reference arguments. Two decisions were challenger-hardened: the hand-written twin **stays
unchanged** (its copy targets `$0340`, below the PRG load base — an idiom placement cannot reach,
not a defect), and the new emission is proven by a **CI-tier in-test fixture rather than a golden**
(a golden containing the silently-wrong `!align 256, 0` would look plausible and pass; only a
resolved-address assertion catches it).

**The plan then passed preflight — 28 findings (0 critical, 5 major), all resolved and applied**
([report](plans/rd-03-placement/00-preflight-report.md)). Five auditor clusters on a different
model family plus a hardening challenger over the whole major batch. **The design survived
intact**: no architectural change was recommended, and scope creep returned **zero** findings. Every
empirical claim was reproduced independently before the scan — 677 / 312 / 318 bytes,
`$0A67` / `$08FA` / `$0900`, the 8-instruction `hi(&X)*4` sequence, the spurious `W10172`, and all
four rows of the ACME `!align` trap table against real ACME 0.97. The defects were in oracles,
sequencing and plumbing prose:

- **The marking set was described against one of two lowering contexts.** `LowerCtx` is built at
  `lower.ts:294` (`__init`) and `:363` (per function); adding a field forces both literals to
  supply one but **not to share one**. A module-scope `let ptr: word = &TABLE;` lowers through the
  init path (`:336`) — confirmed by compiling a probe — so a per-context set passes the entire
  planned suite while that array silently never aligns. The set is now created in `lowerToIL` and
  threaded into both, with ST-C19b as the row that catches it.
- **Phase 4 was CI-red by construction.** The scoreboard freshness gate is a *hard-fail* CI step
  that rebuilds every pair from `examples/` source, but the ratchets, routing prose and scoreboard
  sat in the next commit — so the plan contradicted both M4's "in the same change" and AR #73's
  own "regenerates exactly once, at the balloon rewrite". Root cause: the plan's Verify command was
  strictly weaker than CI and could not see the gate. All four corpus tasks moved into Phase 4, and
  the gate is now part of Verify for corpus-touching phases.
- **Two `[CI]` acceptance criteria were proven by tests that could not run or could not fail.**
  ST-C14/ST-C15 were unfiled next to a VICE-only example, so they would have *skipped* in CI — not
  failed — while AC-1/AC-4 read green; and ST-C13 computes both sides from the same symbol-map
  number, so it is implied by ST-C12 and inspects no emitted instruction. Now: a dual-block
  `skipIf(!hasAcme())` home matching four sibling suites, and an ordered-subsequence assertion on
  the emitted pointer store.
- **The RD's only new artifact had no creation task, name, or home.** The mixed-alignment fixture
  is now `examples/align-mixed/main.blend` + `align-mixed.spec.test.ts`, with the address-taken
  array declared first (ST-C12's padding claim needs the anchor) and a header comment marking it
  deliberately outside the corpus.

Four findings were defects in the **RD** and are back-propagated: slice8b's S1 justification (the
copies go into mutable staging arrays, and `$C000` is *above* the load base), `slice7` mislabelled
a by-ref negative control, residual "new fixture's pair registration" contradicting AC-7, and
"three exhaustive switches" when `isColumnZeroDirective` has no `never` arm and fails silently.
AC-9's `[CI]` label was corrected to `[Review]` — CI has no `spec/` freeze step.

**RD-03's RD was preflighted first.** That scan raised **29 findings (2 critical,
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

A third followed on 2026-07-20, from an external review of `balloon-color`'s generated assembly:
**[#69](https://github.com/blendsdk/blend65/issues/69)** — the alignment granularity is 256 bytes
where a C64 sprite needs 64, and on that demo **193 of 584 bytes (33%) are padding**. RD-03's
closeout already said the padding "re-rolls anywhere in 0–255"; #69 is that dice roll measured at
the bad end, against `balloon`'s lucky 6. The finding is not the constant, though — it is that
**64-byte alignment cannot be used today**. `hi(addr) * 4 === addr / 64` holds only at page
alignment, so the one expressible sprite-block idiom depends on the very alignment that costs the
bytes; `&X / 64` compiles to a runtime `JSR __rt_div16` to divide a link-time constant, and
`&X >> 6` is rejected outright. A restriction that forces un-idiomatic user code is itself the
defect, and here it also costs a third of the binary. Unblocking it is #58's symbolic fold.

**The `E10193`/symbolic-fold gap now has an owner: [#58](https://github.com/blendsdk/blend65/issues/58).**
`const BLOCK: byte = hi(&SPRITE) * 4;` is rejected because `&SPRITE` is a *link-time* symbol — it
cannot fold to a literal, only to an emitted ACME expression, which is a different mechanism from
#49 ①'s numeric fold. RD-03 routed it at closeout and gave it its first measured, committed
instance: the balloon's sprite pointer costs **8 instructions where the twin's author writes 4**,
because the whole 16-bit address is homed into a synthetic frame pair before its high byte is read.
The spurious `W10172` rides along with it. Measurements are on
[#49](https://github.com/blendsdk/blend65/issues/49#issuecomment-5021941029) and
[#49](https://github.com/blendsdk/blend65/issues/49#issuecomment-5024737189).

After RD-03: **#49 Phase 1 as one RD** — item ①'s const-evaluated half + item ③ + item ⑤, with
the runtime-address half of `poke`/`peek` split into its own later RD. Sequenced second because
it is byte-neutral by its own acceptance criterion, and because doing RD-03 first *shrinks* item
③'s balloon diff (RD-03 deletes the `$0340-$037E` staging pokes; ③ then renames only the ~10
register accesses). Note ③ cannot ship as a drop-in library: there is no module search path in
`packages/config/src` or `packages/cli/src` — imports resolve as sibling files — so "zero
compiler change" holds only for copy-the-file-into-your-project distribution.

**The next pick is RD-13** ([#58](https://github.com/blendsdk/blend65/issues/58), symbolic
const-evaluation), taken on 2026-07-20. Its groundwork was deliberately built by RD-05 as a
separately schedulable pass, and it now owns three things rather than one: both divergences RD-03
measured and filed (the 8-instruction `hi(&X) * 4` materialization and the spurious `W10172`), and
the fold that #69 needs before 64-byte alignment is usable at all. That last dependency is what
settled the order — #69 is the largest single unowned win on the board (192 B on one fixture) and
it cannot start until #58 lands.

Not chosen, and why: RD-06 (#52, INC/DEC peephole) is the smaller entry and owns the +61-byte
code-stream half of balloon's residual, but its Rules 2–3 — redundant loads and staging
elimination, which is where the external review's Priority 1 examples actually land — are
currently deferred over MMIO concerns, so the in-scope slice is narrow. RD-10 (#59) remains
**the top divergence by breadth** (17 rows across 13 of 14 pairs) while still tiered B3; that
tiering does not match the data and the re-tier is still owed. The same review independently
measured a fourth item nobody had sized: all 48 frame-variable accesses in `balloon-color` are
absolute at `$2000` where zero page would cost one byte and one cycle less each — **−48 B**, which
strengthens #59's case further.

---

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Depends-on / Blocker |
|----|-------|----|------|-------|--------|--------------|----------------------|
| RD-01 | Parity measurement infrastructure ([#64](https://github.com/blendsdk/blend65/issues/64)) | [RD](requirements/RD-01-parity-measurement-infrastructure.md) | [Plan](plans/rd-01-parity-measurement-infrastructure/00-index.md) | Done | ✅ | 2026-07-18 | — |
| RD-02 | Golden-corpus twin audit + scoreboard ([#61](https://github.com/blendsdk/blend65/issues/61)) | [RD](requirements/RD-02-golden-corpus-twin-audit.md) | [Plan](plans/rd-02-golden-corpus-twin-audit/00-index.md) | Done | ✅ | 2026-07-18 | — |
| RD-03 | Placement: align const data, read it in place ([#49](https://github.com/blendsdk/blend65/issues/49)) | [RD](requirements/RD-03-placement.md) | [Plan](plans/rd-03-placement/00-index.md) | Done | ✅ | 2026-07-20 | Placement slice only; `copy()` (FUT-012) stays gated but is **no longer blocking**. Grammar-free — no `spec/` change, no Guard. **Measured** target: balloon 677→**318 B** (2.70×→**1.27×**), zero runtime copy — beats the twin at runtime, not on bytes. **Executed**: 5 phases / **41 of 41 tasks** — balloon 677→**318 B** at `$0900` (block 36), zero runtime copy; corpus 3616→**3257 B**, 3.93×→**3.54×**. [Closeout](plans/rd-03-placement/08-closeout.md). AR #76–#77 at execution. [Area report](https://github.com/blendsdk/blend65/issues/49#issuecomment-5024737189) posted 2026-07-20 — it retracts the issue's own 2026-07-18 "`copy()` is required, placement can't substitute" framing, which measurement refuted. **#49 stays open** — placement slice only; ①/③/⑤, runtime-address `poke` and the format handlers are untouched. [Plan preflight](plans/rd-03-placement/00-preflight-report.md): 28 findings (0 critical, 5 major), all resolved **and applied**; 4 back-propagated to the RD. Earlier [RD preflight](requirements/00-preflight-report-rd-03.md): 29 findings (2 critical, 7 major), all resolved. AR #64–#75 + addenda · Fable |
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
| RD-15 | Alignment granularity: 64-byte sprite blocks ([#69](https://github.com/blendsdk/blend65/issues/69)) | — | — | Backlog | ⬜ | 2026-07-20 | **Blocked on RD-13/#58** — 64-byte alignment is unusable until `&X / 64` folds to an ACME expression instead of `JSR __rt_div16`. Measured: 193 of 584 B (33%) padding on `balloon-color`, 1 B at 64-byte. Open design question: which boundary a given array needs (64 for sprites, 256 for indexed tables) — attribute vs. inference |
| T-01 | CLI bug: relative --out-dir breaks ACME ([#55](https://github.com/blendsdk/blend65/issues/55)) | — | — | Backlog | ⬜ | 2026-07-17 | — |
