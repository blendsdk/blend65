# Roadmap: Asm-Parity Initiative

> **Feature-Set**: Asm-Parity Initiative
> **Status**: In Progress
> **Created**: 2026-07-17
> **Last Updated**: 2026-07-19 (**RD-05 ✏️ DRAFTED** — block layout (#51). Zero-Ambiguity Gate passed on 8 items (AR #26–#33), the architectural one challenger-hardened. Transforms split by seam: jump threading + unreachable-block removal as IL passes, fall-through elision + branch inversion as one tail decision at translation, branch relaxation as a new unconditional stage — the instruction peephole ruled non-viable (its rule contract excludes labels from windows) and left to #52. Layout is unconditional, not `--optimize`-gated, because #65 relaxation is correctness and must measure the emitted geometry. Measured baseline: 105 `JMP`s corpus-wide, **47 fall-through** and **13 trampoline blocks**; `guards` emits 23 `JMP`s against its twin's 1. Both RD-04's transferred twin-idiom criterion and #65 are written as ACs. Next: `preflight` the RD. — prior: **RD-04 ✅ CLOSED** — all 5 phases / 43 tasks. Conditions branch on their comparison's own flags: `!` is a free label swap, `&&`/`||` are CFG edges claiming no frame slot, boolean literals fold to a jump; the SFA slot rule moved in step, position-dependent, still with no codegen import. 8 of 14 goldens regenerated and hand-reviewed; `slice6` — all value-position — did not move a byte, the corpus-level proof fusion stayed in condition position. Corpus 4172→3896 bytes, 5340→5023 static cycles; rasterpoll poll path 12 cycles; guards compound guard 43→24; balloon measured frame 162→133. The #50 divergence rows are gone from every pair that carried them. AC-1…AC-10 walked against committed artifacts; area report posted on #50. Spun off #66 — a pre-existing switch-on-ternary ICE. Next: RD-05 (#51 block layout), unblocked — note #51 is the dominant *structural* divergence, not the largest by row count (#59 and #58 carry more), which is why the wave sequences by representativeness × risk)
> **Progress**: 3 / 14 (21%)
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
| RD-04 | Compare-and-branch fusion ([#50](https://github.com/blendsdk/blend65/issues/50)) | [RD](requirements/RD-04-compare-and-branch-fusion.md) | [Plan](plans/rd-04-compare-and-branch-fusion/00-index.md) | Done | ✅ | 2026-07-19 | AC-1…AC-10 all walked; corpus 4172→3896 B / 5340→5023 cyc; **#50 closed**; spun off [#66](https://github.com/blendsdk/blend65/issues/66) |
| RD-05 | Block layout: fall-through elision + jump threading ([#51](https://github.com/blendsdk/blend65/issues/51)) | [RD](requirements/RD-05-block-layout.md) | — | RD Drafted | ✏️ | 2026-07-19 | B1 — twin-idiom acceptance (AR #20) + [#65](https://github.com/blendsdk/blend65/issues/65) branch range now written as ACs; gate passed (AR #26–#33) |
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
