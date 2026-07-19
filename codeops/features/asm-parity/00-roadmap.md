# Roadmap: Asm-Parity Initiative

> **Feature-Set**: Asm-Parity Initiative
> **Status**: In Progress
> **Created**: 2026-07-17
> **Last Updated**: 2026-07-19 (RD-04 🔄 executing — phases 1–3/5 done (26/43 tasks). Phase 2: all five comparison framings translate `brcmp` to fused branch form behind one compare core; value form byte-identical, zero golden diffs (review 2🟡, both fixed). Phase 3: the `guards` acceptance pair — fixture, pre-fusion golden, hand-written twin, routing, budgets, scoreboard — VICE-green on the four hazard shapes; measured "before" is 347 bytes vs 128 hand-written (2.71×) and 404 static cycles vs 151 (2.68×), with a 43-cycle compound-guard window. Review 1🔴 discharged as a protocol flag + 3🟡 all accepted+fixed (all three on the twin, the parity bar). Next: phase 4 — the atomic flip: condition lowering + SFA + corpus supersession)
> **Progress**: 2 / 14 (14%)
> **CodeOps Skills Version**: 3.8.0
>
> Requirements for this feature live as **GitHub issues #49–#64** (umbrella: [#56](https://github.com/blendsdk/blend65/issues/56));
> each row links its issue. On pickup, the RD document is authored from the linked issue, then the
> standard per-item sequence runs: `preflight (RD) → make_plan → preflight (plan) → exec_plan`.
> Governing bar: the Prime Directive (project `CLAUDE.md`) — output parity with hand-written assembly.

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Depends-on / Blocker |
|----|-------|----|------|-------|--------|--------------|----------------------|
| RD-01 | Parity measurement infrastructure ([#64](https://github.com/blendsdk/blend65/issues/64)) | [RD](requirements/RD-01-parity-measurement-infrastructure.md) | [Plan](plans/rd-01-parity-measurement-infrastructure/00-index.md) | Done | ✅ | 2026-07-18 | — |
| RD-02 | Golden-corpus twin audit + scoreboard ([#61](https://github.com/blendsdk/blend65/issues/61)) | [RD](requirements/RD-02-golden-corpus-twin-audit.md) | [Plan](plans/rd-02-golden-corpus-twin-audit/00-index.md) | Done | ✅ | 2026-07-18 | — |
| RD-03 | Memory & hardware access epic ([#49](https://github.com/blendsdk/blend65/issues/49)) | — | — | Backlog | ⬜ | 2026-07-18 | split: placement → B1/B2 (grammar-free); copy() gated (v3.1 + Guard) — blocks balloon $0340 (~370 B, largest divergence) · Fable |
| RD-04 | Compare-and-branch fusion ([#50](https://github.com/blendsdk/blend65/issues/50)) | [RD](requirements/RD-04-compare-and-branch-fusion.md) | [Plan](plans/rd-04-compare-and-branch-fusion/00-index.md) | Executing | 🔄 | 2026-07-19 | **B1 lead** — cycle lever, audit #1 · Fable (design; exec → Opus) |
| RD-05 | Block layout: fall-through elision + jump threading ([#51](https://github.com/blendsdk/blend65/issues/51)) | — | — | Backlog | ⬜ | 2026-07-19 | B1 — depends on RD-04 (size-consequence); owns twin-idiom acceptance + #65 (branch range) |
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
