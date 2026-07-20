# Portfolio Roadmap: blend65.ri

> **Status**: Active
> **Last Updated**: 2026-07-20
> **Features**: 0 of 2 done
> **CodeOps Skills Version**: 3.0.0
>
> Per-feature detail — including the full per-slice/per-phase history — lives in each
> feature's own roadmap (linked below) and in the plan directories under
> `codeops/features/<feature>/plans/` and `codeops/_archive/`. This portfolio file keeps
> only the current stage summary per feature.

## Legend

⬜ Backlog · 🔄 In progress · ✅ Done · ⛔ Blocked · ⏸️ Deferred · 📦 Archived

## Features

| Feature | Roadmap | Stage Summary | Progress | Status | Last Updated |
|---------|---------|---------------|----------|--------|--------------|
| blend65-ri | [→](features/blend65-ri/00-roadmap.md) | **RD-18 ✅ CLOSED 2026-07-17** — frozen v3 compiles end-to-end (unoptimized); next: RD-13/RD-14 (`make_plan`) | 18/20 | 🔄 | 2026-07-17 |
| asm-parity | [→](features/asm-parity/00-roadmap.md) | **RD-01 ✅ done** (parity infra) · **RD-02 ✅ done** (#61 — 14-pair twin corpus, twin tier, committed SCOREBOARD.md baseline 4.83×/6.51×, routed audit, CI freshness gate) · **RD-04 ✅ CLOSED 2026-07-19** (#50 — compare-and-branch fusion, 5 phases/43 tasks; conditions branch on their comparison's flags, `!` is a free label swap, `&&`/`||` are CFG edges claiming no slot; corpus 4172→3896 B / 5340→5023 cyc, raster poll at 12 cycles, AC-1…AC-10 walked, #50 divergence rows gone from every pair; spun off #66) · **RD-05 🔬 PLAN PREFLIGHTED 2026-07-20** (#51 — block layout: fall-through elision, jump threading, unreachable-block removal, branch inversion, plus #65 branch-range relaxation; RD gate passed on 8 items, RD preflight raised 32 findings / 10 major. Plan: 5 phases / **58 tasks**, build-unwired-then-wire so the corpus regenerates exactly once, relaxation wired first as a provable no-op; plan gate added AR #34–#39. Plan preflight — 5 clusters + a hardening challenger — raised **27 findings / 6 major**, all applied as AR #40–#57: the sole proof of AC-7 sat in a package that cannot reach the `--optimize` gate; every program's `bytes` ratchet would have gone silently slack, costing `balloon` its only size gate; the permanent corpus scan saw only the missed-*elision* half of the tail decision, and the challenger caught that the obvious third invariant is textually identical to relaxation's own emitted form, so it ships with an `_rlx<N>` carve-out. Three findings were RD defects and were back-propagated — AC-10, AC-13 and a re-anchoring hazard rationale the observable tables refute. Architecture unchanged; scope creep zero; verify green) · **RD-05 ✅ CLOSED 2026-07-20** (#51 — block layout, 5 phases / 58 tasks, one commit per phase, corpus regenerated exactly once: trailing jumps elide into fall-through, branches invert when the true edge follows, trampoline chains thread through, unreachable blocks are not assembled. Corpus 4172→3896→**3616 B** and 5340→5023→**4724 cyc**; 4.23×→3.93× vs the twins. `rasterpoll`'s poll loop is now its twin instruction for instruction and its routing moved off #51; **#65 closed** — out-of-reach branches relax to the hand-written branch-over-jump form at a fixpoint. Four permanent corpus invariants, each seeded and watched to fail, with the `_rlx<N>` carve-out verified both ways. AR #58–#63 at execution; four reviews, no major findings) · **RD-03 🔄 EXECUTING 2026-07-20** (#49 placement slice — a const array whose address is taken is page-aligned, so the VIC reads the embedded sprite where it already sits. Grammar-free: no `spec/` change, no Language-Guard evaluation, and the earlier "blocked on copy()/v3.1" framing was refuted by measurement. RD preflight raised 29 findings / 2 critical / 7 major, all resolved — the trigger rule was undefined at the level that matters, since `&X` and an ordinary by-reference array argument emit the *same* IL `addrOf` operand, so an IL scan would have aligned `slice7b`/`slice8b` (+435 B); M1 is now the **syntactic** `&` set. Plan: 5 phases / **41 tasks**, mechanism-first so the 14 byte-identical goldens are a free proof the rule excludes by-ref arguments, with 7 decisions as AR #69–#75. Plan preflight — 5 clusters + a hardening challenger — raised **28 findings / 0 critical / 5 major**, all resolved and applied. Design unchanged, scope creep **zero**, and every empirical claim reproduced independently first (677 / 312 / **318 B**, `$0A67` / `$08FA` / **`$0900`**, sprite block 36, and all four rows of the ACME `!align` bitmask trap table on real ACME 0.97). Load-bearing catches: the marking set was described against **one of two** `LowerCtx` sites, so a module-scope `&` — confirmed live by compiling a probe — would never align while the whole planned suite passed; Phase 4 was CI-red by construction because the hard-fail scoreboard freshness gate rebuilds from `examples/` source while the ratchets sat a commit later, the root cause being a Verify command strictly weaker than CI; and two `[CI]` criteria rested on tests that would have *skipped* in CI rather than failed, or that cannot fail at all. Four RD defects back-propagated, and AC-9 relabelled `[CI]` → `[Review]` — CI has no `spec/` freeze step). **Executing** — 5 phases / 41 tasks, one commit per phase | 4/14 RDs | 🔄 | 2026-07-20 |

## Archived

| Feature | Roadmap | Completed | Last Updated |
|---------|---------|-----------|--------------|
| — | — | — | — |
