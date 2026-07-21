# Roadmap: Asm-Parity Initiative

> **Feature-Set**: Asm-Parity Initiative
> **Status**: In Progress
> **Created**: 2026-07-17
> **Last Updated**: 2026-07-21 (**RD-13 🔬 PLAN PREFLIGHTED** — two iterations, a 5-cluster fan-out
> on a different model family plus two verification auditors: **30 findings (1 critical, 5 major)**,
> all resolved and applied; the plan is now 5 phases / **54 tasks** on AR #88–#99. The design
> survived intact — zero architectural changes, zero scope-creep findings — and every empirical
> claim reproduced: ~40 `file:line` refs exact, the spec quote verbatim, every ledger count right to
> the row, the 18→7→5-byte projection exact, the ACME precedence trap re-measured. The defects were
> **all in the oracles**. The critical was a shared blind spot: every scan audited the *translate-side*
> consumers of the new operand and none audited the *lowering-side* positions that wrap a result in
> `const`, where ten `materialise` sites funnel into a guard that ICEs on it — so `let b: byte =
> lo(&X);` and `v = hi(&X);`, which compile today, would have regressed **silently** at Phase 2, and
> Phase 4's own migration target could never have built. Three more majors were assertions that could
> not fail for the risk they gated: AC-3's slot-counter proof (a plain store never names its slot in
> the IL), ST-13j's assembled-byte oracle (`boing-ball`'s pointers are computed at runtime and exist
> nowhere in the PRG), and the Prime-Directive hand-review (aimed at golden hunks that cannot exist,
> now aimed at `balloon`'s assembly against its committed twin). Previously **T-02 ✅ DONE** —
> `examples/` could gain a program verified by
> nothing at all; `balloon-color` spent its whole life that way and `boing-ball` landed the same,
> both found by grep rather than a failing test. A committed manifest now tiers all 18 examples and
> a spec test asserts the manifest and the directory agree exactly, plus each tier's artifact
> obligations **including the negative ones**. Two self-inflicted defects were caught during
> execution — an inferred "has a suite" check that called 13 corpus fixtures unverified, and a
> prefix bug crediting `balloon` for `balloon-color`'s mentions — so the obligation is now named
> rather than inferred. Also **RD-13 📋 PLAN CREATED** — 5 phases / **52 tasks**, Zero-Ambiguity
> Gate passed on AR #88–#96. Phase order is **M3 → M1 → M2-unwired → migrate → ledgers**: the
> corpus regenerates exactly twice, and no intermediate commit ships the fixed four-instruction
> sprite-pointer idiom still carrying a warning that it generates a shift-and-add sequence. The
> load-bearing decision — how a byte-selected link-time address is carried — went to an independent
> challenger on a different model family *before* a preference was recorded, and it converged:
> **distinct variants in both unions**, because extending the existing ones fails *silently* at the
> two guards that already **accept** an address, while a distinct kind is TS2366-forced at both
> serializers. The challenger also surfaced **three pre-existing silent-failure holes** on the new
> operand's exact path — `leftIntoA` falls out of its if-chain emitting nothing, so a later `STA`
> stores a stale accumulator — closed with ICE guards in Phase 2 *before* the operand exists, so
> full-verify-green there is the proof of unreachability. Two RD defects found while grounding and
> scheduled for back-propagation: the "locals are already excluded upstream" claim is false, and M1
> needs no new legal IL position at all. A third migration site surfaced after the plan was written
> — the newly committed `examples/boing-ball` carries the same idiom in a **`let` initializer**, and
> it is the strongest of the three: its ball is four consecutive 64-byte blocks addressed as
> `base+0..3`, so the program already does 64-byte block arithmetic while naming its first block
> through a page-alignment identity that holds only by luck. AC-6 now migrates **all three** demos
> (AR #96). Previously, **RD-13 🔎 PREFLIGHTED** — a 5-cluster fan-out on a different model
> family raised **27 findings (0 critical, 8 major)**, all resolved and applied; two new issues
> filed ([#70](https://github.com/blendsdk/blend65/issues/70),
> [#71](https://github.com/blendsdk/blend65/issues/71)) and five runtime decisions recorded as
> AR #83–#87. The **architecture survived intact** — every central risk claim held under
> adversarial verification, several reproduced with the repo's own toolchain: the one-forced-site
> blast radius, the `lowerAddressOf` double side effect, the alignment/CI-blindness hazard, the
> TS2366 correction, the ledger counts, and the block-number identity. The defects were all in
> **test accounting and boundary precision**. Load-bearing catches: **the spec-test blast radius
> was understated three-fold** — `ST-9b` pins the exact frame-slot homing M1 abolishes and its
> module header states the rule normatively, while `ST-C14` pins the `LDA #>`/`ASL`/`ASL` run the
> idiom migration deletes, so the RD's bolded "the one place RD-13 touches a spec test" claim was
> false and the real set is four tests plus a header; **AC-3 could not fail** — it named a
> *frontend* suite that has no `&` fixture and cannot observe codegen's counter, reproducing the
> RD-03 preflight's own "proof that cannot fail" failure mode; and **the new operand's rendering
> silently miscompiled** — `#<(sprite+3 / 64)` assembles cleanly to `0x00` because ACME binds `/`
> tighter than `+`, so the offset field was dropped and the trap made unreachable. Also:
> `balloon-color` is a **second** migration site named nowhere and verified by nothing; M5's
> re-routing had no destination and no open issue owned the capability; and the RD cited `slice3a`
> as one of the 16 misrouted rows when its rows already route to #59/#60. The two most serious
> findings were raised by **two clusters independently**. Next: `make_plan`. — prior:
> **RD-13 ✏️ AUTHORED** — the symbolic-address slice of #58, gate passed on AR #78–#82. An address is a **link-time** constant ACME folds for free; the compiler
> materializes it at runtime instead, and three legal v3.0 source forms fail three different ways —
> `hi(&X) * 4` costs 8 instructions plus a spurious `W10172`, `lo(&X / 64)` emits **11 instructions
> and `JSR __rt_div16`** (a runtime 16-bit software division of a link-time constant), and
> `lo(&X >> 6)` is rejected outright with `E90001`. All three measured live, not estimated. The RD
> makes the byte-selects one instruction each, folds the divide/shift forms to `#<(sym / 64)`
> behind **one restricted** `InstrOperand` variant, and stops `W10172` firing where
> `spec/evaluations/F017-operators.md:442` forbids it verbatim. Three findings shaped it that the
> first draft did not have: the fix's seam **must** route through `lowerAddressOf` because that
> function also carries RD-03's alignment mark, and `examples/balloon`'s only `&` is this exact
> site — bypassing it silently unaligns the sprite with **nothing in CI able to notice**; the
> variant's blast radius is exactly **one** compiler-forced site, since `symbolText`'s explicit
> `: string` return makes a missing arm a hard TS2366 (an earlier note claiming it would render
> `undefined` silently was wrong and is corrected); and **16 of the 17 corpus rows routed to #58
> are misrouted** — they are local constant-propagation gaps in codegen dataflow, not symbolic-
> address defects, so RD-13 moves **1** routed row and re-routes the rest to their real owner. A
> challenger on a different model family endorsed the scope and corrected three more: don't
> full-fold `hi(&X) * 4` (its mod-256 wrap is *meaningful* — bless `lo(&X / 64)` instead),
> `W10172` is left deliberately producer-less because the spec's positive case has no
> implementation at all, and M1 is **not** shippable without M3. `const` declarations naming
> link-time addresses are excluded as **spec-blocked under D3**, not merely expensive. Next:
> `preflight` the RD. — prior: **RD-13 selected; #69 filed as RD-15** — an external review of the
> `balloon-color` demo's generated assembly was analysed against the register. Most of it was
> already owned or already shipped: its control-flow findings are RD-05's, closed; its
> address-materialization finding is #58's, filed; four of its nine points grade the compiler for
> things it does correctly — preserving MMIO store order and emitting `poke` as a raw store. Two
> were new. **[#69](https://github.com/blendsdk/blend65/issues/69)**: alignment granularity is 256
> bytes where a C64 sprite needs 64, costing **193 of 584 bytes (33%)** on that demo — and the
> finding is not the constant but that 64-byte alignment is *unusable*, since `hi(addr) * 4` is
> valid only at page alignment, `&X / 64` emits a runtime `JSR __rt_div16`, and `&X >> 6` is
> rejected. Filed as **RD-15, blocked on RD-13** (not on #58's frontend half — a scoping challenger
> corrected that attribution the same day; see the Resume section). And unsized until now: all 48 frame-variable
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
defect, and here it also costs a third of the binary. Unblocking it is RD-13's symbolic-operand fold.

**Correction, same day, from the RD-13 scoping challenger.** An earlier draft of this section
attributed the unblock to #58's *frontend* const-fold. That is wrong on checkable facts, all since
verified. The frontend already **accepts** `hi(&X) * 4` in `poke` position, and `E90001` on
`&X >> 6` is a **codegen** ICE (`translate.ts:839-842`), not a frontend diagnostic. The
8-instruction defect lives at `lower.ts:2570-2577`, where `emitHi` on an `&` expression homes the
whole address through a frame word slot before reading byte +1 — while `translate.ts:704,710`
**already** emits `LDA #>sym` via `symbolRef(…, byteSelect: "high")`. So the 8→4 parity fix needs
**no operand-model change at all**; only RD-15's `#(sym / 64)` fold does. #58's frontend scope
covers just the const-*declaration* position (`E10193`, `statement-typing.ts:253`), which no
measured defect depends on — and which carries a frozen-spec collision
(`spec/evaluations/F006-address-of.md:119` calls an address a compile-time constant, while
`spec/14-diagnostics.md:140`'s E10193 rejects exactly that as "not a compile-time constant
expression"), so under D3 it needs an AR resolved before it can execute.

Two hazards the challenger surfaced for the operand extension: `symbolText`
(`print-instr.ts:58-79`) is a switch with **no `never` arm** and `tsconfig.base.json:9` sets
`strict` without `noImplicitReturns`, so a new variant renders `undefined` into the asm with no
compile error; and the peephole catalog is still empty (`peephole.ts:75`, `V1_RULES = []`), which
makes now the cheapest moment to widen the union — before RD-06's rules pattern-match on it.

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

**The current pick is RD-13** ([#58](https://github.com/blendsdk/blend65/issues/58), symbolic
address arithmetic), taken on 2026-07-20 and **authored the same day** —
[`requirements/RD-13-symbolic-address-arithmetic.md`](requirements/RD-13-symbolic-address-arithmetic.md),
gate passed on AR #78–#82. It owns three things rather than one: both divergences RD-03 measured
and filed (the 8-instruction `hi(&X) * 4` materialization and the spurious `W10172`, routed out of
RD-03 by AR #67 — **that routing is now discharged**), and the fold that #69 needs before 64-byte
alignment is usable at all. That last dependency is what settled the order — #69 is the largest
single unowned win on the board (193 B on one fixture) and it cannot start until this lands.

> **Authoring corrected the size of the prize, and the correction should be read before the
> closeout.** 17 of the corpus's 53 routed divergence rows name #58, but exactly **one** is a
> symbolic-address defect. The other 16 are **misrouted** — they split 8/8 between
> *"constant-foldable program: full runtime machinery emitted where a hand version folds to direct
> stores"* and *"code-size consequence of the unfolded machinery"*. `slice3b` reaches
> `JSR __rt_mul8` for `5 * 3` because both operands live in frame slots; `slice5a` adds the
> cross-function case. Those are local constant-propagation and dead-store gaps in **codegen
> dataflow** — nothing to do with `packages/frontend` semantics or with link-time symbols.
> (`slice3a` shows the defect in its purest form — `let x: byte = 5; poke($D020, x)` stores to a
> frame slot then reloads the byte just stored — but **its rows already route to #59/#60**, so it
> is the clearest exhibit rather than a member of the population; the preflight caught that the
> RD had cited it as one.) They drive the corpus's worst ratios (`slice6` 8.70×, `slice3b` 8.32×,
> `slice7b` 7.40×, `slice5a` 7.12×), so leaving them filed under an audit sweep that would never
> fix them hides the **largest remaining parity gap on the board**. RD-13 re-routes them to
> **[#70](https://github.com/blendsdk/blend65/issues/70)**, filed for exactly this; it does not
> fix them, and it moves 1 routed row rather than 17.

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
| RD-13 | Symbolic address arithmetic ([#58](https://github.com/blendsdk/blend65/issues/58) slice) | [RD](requirements/RD-13-symbolic-address-arithmetic.md) | [Plan](plans/rd-13-symbolic-address-arithmetic/00-index.md) | Plan Preflighted | 🔬 | 2026-07-21 | **Plan preflighted 2026-07-21 — now 5 phases / 54 tasks, AR #88–#99.** Two iterations, a 5-cluster fan-out on a different model family plus two verification auditors: **30 findings (1 critical, 5 major, 15 minor, 9 observations)**, all resolved and applied. The empirical spine held completely — every one of ~40 `file:line` refs exact, `grep isAddr(` returning *exactly* the seven guards claimed, the `F017:442` spec quote verbatim, every ledger count right to the row (53 routed / 17 on #58 / split 8+8+1 / 15 budget programs / balloon 318 B), the 18→7→5-byte projection arithmetically exact, and the ACME precedence trap re-measured live. **Every defect was in the oracles, not the design** — no architectural change, zero scope-creep findings. The **critical**, found independently by both iteration-2 auditors and missed by all four of iteration 1 *and* the lead: §5 audited the translate-side consumers of the new operand exhaustively and never audited the **lowering-side** positions that wrap a result in `const`. Only a store source takes an operand raw; the other **ten** positions funnel through `materialise` (`lower.ts:2659-2666`) into `translateConst` (`:655-658`), which ICEs on a non-immediate — so `let b: byte = lo(&X);` and `v = hi(&X);`, both of which **compile today**, would have regressed silently at Phase 2 with no test catching it, and task 4.7's own migration target could never have built. Closed with one arm at the single choke point (AR #99). The plan had even cited that guard as *reassurance* the direct return avoided it. A near-identical hole was caught one iteration earlier in **index** position — `table[lo(&X)]` compiles today at 19 bytes and would have ICEd; its arm makes it **8** bytes, `LDX #<sym` · `LDA table,X` · `STA`, the hand idiom exactly (AR #97). Three more majors were unwritable oracles rather than wrong code: **AC-3's proof could not fail** — a plain-store `&` lowers with `direct = true`, so the slot name never reaches the IL text (the *second* failed AC-3 proof; now a homing site, `&helper + 2`); **ST-13j's oracle could not exist** — `boing-ball`'s four sprite pointers are computed at runtime from an animating `frame`, so those bytes are in VIC RAM and nowhere in the PRG (split into a link-time CI half and ST-13k on VICE, AR #98); and **the Prime-Directive hand-review pointed at nothing** — it reviewed "regenerated golden hunks", but no golden can change in any phase, and `balloon`, the one program this RD rewrites, has none. It now reads `balloon`'s assembly against `examples/balloon/balloon.asm`, its committed hand twin. Also caught: the fold's `k >= 8` half had no test while the neighbouring `log2Exact` call site masks to a byte, which would have regressed every divisor ≥ 256 to the runtime divide *still emitting `W10171`* — invisible. Earlier: **plan created 2026-07-21 — gate passed on AR #88–#96.** Ordering is **M3 → M1 → M2-unwired → migrate → ledgers**, so the corpus regenerates exactly twice and no intermediate commit ships the fixed four-instruction sprite-pointer idiom still carrying a warning that it generates a shift-and-add sequence. The load-bearing decision — how a byte-selected link-time address is carried — went to an independent challenger on a different model family **before** a preference was recorded, and it reached the same answer for the same reason: **distinct variants in both unions** (`addrByte` in IL, a no-offset `symbolExpr` in `InstrOperand`), because extending the existing variants fails *silently* at the two guards that already **accept** an address — `translateStore` (`translate.ts:698`) would emit the two-byte marshalling pair for a byte-typed value, writing one byte past a byte slot, and `rightSource` (`:1035`) derives `byteSelect` from `byteIndex`, so a high-select read at byte 0 emits `#<sym`. Both assemble cleanly. Distinct kinds are instead **TS2366-forced** at `print-il.ts:44` and `print-instr.ts:58`, and all seven `isAddr` guards stay untouched. The challenger also found **three pre-existing silent-failure holes** directly on the new operand's path — `leftIntoA` (`:920-950`) falls out of its if-chain emitting nothing, so a later `STA` stores whatever stale value sits in A; `bringValueIntoRegisters` (`:993-998`) has an `if (lo && hi)` with no else; `rightSource` (`:1052`) falls through to a bare `Implied` operand that only ACME notices. All three are unreachable today and are closed with trailing ICE guards in Phase 2 **before** the operand exists, so full-verify-green at that point is the proof of unreachability. Two RD defects found while grounding and scheduled for back-propagation: the RD's claim that a **local**'s `&` is *"already excluded upstream"* is false — `lowerAddressOf` resolves a local to a `__frame_*` symbol (`lower.ts:1851-1853`) and `emitHi`/`emitLo` reach it through the same branch, so M1 is uniform across all four operand kinds; and M1 needs **no** new legal IL position at all, since `emitLo`/`emitHi` return the operand directly the way they already do for a numeric literal, leaving `addr`'s two-position rule intact. Also decided: the fold accepts `k = 1..15` with `k = 0` degenerating to a plain byte-select and everything else falling through with **no new diagnostic**; a **named const** divisor folds (`lo(&X / BLOCK)`), because refusing it makes the more readable spelling the one that emits `JSR __rt_div16`; and `balloon-color` — referenced by **nothing** in `packages/`, `test/`, `scripts/` or `.github/`, grep-confirmed — gets its first CI signal as a build-only symbol-map check, staying outside the corpus as its own header asks. AC-6 migrates **all three** demos, `boing-ball` included (AR #96). Phase 3 lands the fold **unwired**, so the 14 byte-identical goldens are a free proof it changed nothing it was not asked to change. Earlier: **RD authored and preflighted 2026-07-20; gate passed on AR #78–#82, preflight raised 27 findings (8 major) resolved as AR #83–#87, spinning off [#70](https://github.com/blendsdk/blend65/issues/70) and [#71](https://github.com/blendsdk/blend65/issues/71).** An address is a link-time constant ACME folds for free; the compiler materializes it at runtime instead. **M1** `hi(&X)`/`lo(&X)` → one immediate byte-select (the existing `symbolRef.byteSelect` already expresses it — no new `InstrOperand` needed); the seam is `lowerAddressOf(arg, ctx, true)`, because that function also carries RD-03's alignment mark and the positional slot claim, and balloon's only `&` is this very site. **M2** one restricted `InstrOperand` variant (symbol + power-of-two shift) so `lo(&X / 64)` folds to `#<(sym/64)` instead of `JSR __rt_div16`, and `lo(&X >> 6)` builds at all instead of `E90001` — blast radius measured at **one** compiler-forced site (TS2366 at `print-instr.ts:58`). **M3** `W10172` stops firing on power-of-two multiplies, which `spec/evaluations/F017-operators.md:442` forbids verbatim; two spec-tier tests are re-derived from that text. Challenger-hardened on a different model family: it endorsed the scope and corrected three things — don't full-fold `hi(&X)*4` (the mod-256 wrap is *meaningful*; bless `lo(&X/64)` instead), `W10172` is left deliberately producer-less, and M1 is **not** shippable without M3. Deliberately excluded: `const` declarations naming link-time addresses — **spec-blocked under D3**, not merely expensive. Moves **1** of 53 routed rows; re-routes 16 misrouted ones. Blocks RD-15 · Fable |
| RD-14 | Sweep G: developer experience ([#63](https://github.com/blendsdk/blend65/issues/63)) | — | — | Backlog | ⬜ | 2026-07-17 | — |
| RD-16 | Parity corpus: hand-written twin for `boing-ball` ([#72](https://github.com/blendsdk/blend65/issues/72)) | — | — | Backlog | ⬜ | 2026-07-21 | **Filed 2026-07-21 from T-02.** The corpus is 14 synthetic slices plus `balloon`, several constant-*by-construction* so their twins fold the whole program in a way no game loop does — meaning the scoreboard's headline ratio is measured almost entirely against code no game contains. `boing-ball` is the closest thing in the repo to real game code: four unexpanded **multicolor** sprites in a 2x2 block, animation by **pointer swapping** rather than pixel work (each frame is four consecutive 64-byte blocks, `base+0..3`), a colour-swap trick giving eight visible steps from four stored frames, and 9-bit X bouncing across `$D000` + the `$D010` MSB. Measured today: 2,047 B total, `Main.main` 760 B / 949–993 cyc, of which 1,024 B is the image — so ≈1,023 B of code faces a twin, comparable to the rest of the corpus combined and none of it constant-foldable by construction. Deliverable is the **pair plus the routed inventory**, not the fixes. **Sequenced after RD-13**: `boing-ball` still uses `hi(&BALL) * 4` and RD-13 migrates it to `lo(&BALL / 64)`, which moves its bytes — authoring the twin first makes the pair stale on arrival. Promoting it also flips its `examples-coverage.json` row `demo` → `corpus`, and the T-02 gate enforces all four artifacts, so a partial promotion fails |
| RD-15 | Alignment granularity: 64-byte sprite blocks ([#69](https://github.com/blendsdk/blend65/issues/69)) | — | — | Backlog | ⬜ | 2026-07-20 | **Blocked on RD-13 (P2)** — 64-byte alignment is unusable until `&X / 64` folds to an ACME expression instead of `JSR __rt_div16`. Measured: 193 of 584 B (33%) padding on `balloon-color`, 1 B at 64-byte. Open design question: which boundary a given array needs (64 for sprites, 256 for indexed tables) — attribute vs. inference |
| T-01 | CLI bug: relative --out-dir breaks ACME ([#55](https://github.com/blendsdk/blend65/issues/55)) | — | — | Backlog | ⬜ | 2026-07-21 | **Independently reproduced 2026-07-21** while grounding T-02: `blendc build examples/boing-ball/main.blend --platform c64` fails with `E90001 … Cannot open toplevel file "build/main.asm"` even though that file exists, and the same build succeeds with an **absolute** `--out-dir`. Still backlog; noted because it is why T-02's gate does not compile examples |
| T-02 | Examples coverage manifest + completeness gate | — | [Task](plans/t-02-examples-coverage-manifest/99-execution-plan.md) | Done | ✅ | 2026-07-21 | **5/5 tasks, green first verify.** `examples/` could gain a program verified by nothing at all — `balloon-color` spent its whole life that way and `boing-ball` landed the same, both found by grep rather than a failing test. A committed manifest now tiers all **18** examples (`corpus` 14 · `measured` 1 · `probe` 1 · `demo` 2) and a spec test asserts the manifest and the directory agree exactly, plus each tier's artifact obligations **including the negative ones** — a `demo` that quietly acquires a golden has become a corpus fixture and now fails rather than silently costing every future edit a re-base. `balloon` is recorded as its own `measured` tier (twin + ratchet, no golden), which makes that gap visible instead of implicit. Two self-inflicted defects caught during execution: the first draft inferred "has a suite" by scanning test text for `examples/<name>`, which reported 13 corpus fixtures as unverified because fixtures are reached through inlined constants and joined paths that never spell the directory — the obligation is now scoped to the two tiers with no other coverage and the suite is **named** rather than inferred; and that scan carried a prefix bug, since `examples/balloon` is a prefix of `examples/balloon-color` and `slice7` of `slice7b`. All four failure modes seeded and watched to fail, each naming its offender. `balloon-color` and `boing-ball` sit in a stated `pendingSuite` waiver that RD-13 Phase 4 tasks 4.1/4.2 explicitly clear |
