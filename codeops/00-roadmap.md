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
| asm-parity | [→](features/asm-parity/00-roadmap.md) | **RD-01 ✅ done** (parity infra) · **RD-02 ✅ done** (#61 — 14-pair twin corpus, twin tier, committed SCOREBOARD.md baseline 4.83×/6.51×, routed audit, CI freshness gate) · **RD-04 ✅ CLOSED 2026-07-19** (#50 — compare-and-branch fusion, 5 phases/43 tasks; conditions branch on their comparison's flags, `!` is a free label swap, `&&`/`||` are CFG edges claiming no slot; corpus 4172→3896 B / 5340→5023 cyc, raster poll at 12 cycles, AC-1…AC-10 walked, #50 divergence rows gone from every pair; spun off #66) · **RD-05 🔬 PLAN PREFLIGHTED 2026-07-20** (#51 — block layout: fall-through elision, jump threading, unreachable-block removal, branch inversion, plus #65 branch-range relaxation; RD gate passed on 8 items, RD preflight raised 32 findings / 10 major. Plan: 5 phases / **58 tasks**, build-unwired-then-wire so the corpus regenerates exactly once, relaxation wired first as a provable no-op; plan gate added AR #34–#39. Plan preflight — 5 clusters + a hardening challenger — raised **27 findings / 6 major**, all applied as AR #40–#57: the sole proof of AC-7 sat in a package that cannot reach the `--optimize` gate; every program's `bytes` ratchet would have gone silently slack, costing `balloon` its only size gate; the permanent corpus scan saw only the missed-*elision* half of the tail decision, and the challenger caught that the obvious third invariant is textually identical to relaxation's own emitted form, so it ships with an `_rlx<N>` carve-out. Three findings were RD defects and were back-propagated — AC-10, AC-13 and a re-anchoring hazard rationale the observable tables refute. Architecture unchanged; scope creep zero; verify green) · **RD-05 🔄 EXECUTING 2026-07-20** — Phase 1 of 5 (branch relaxation, wired first as a provable corpus no-op; closes #65) | 3/14 RDs | 🔄 | 2026-07-20 |

## Archived

| Feature | Roadmap | Completed | Last Updated |
|---------|---------|-----------|--------------|
| — | — | — | — |
