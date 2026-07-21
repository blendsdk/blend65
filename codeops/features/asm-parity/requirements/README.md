# asm-parity — Requirements Documents

> **Project**: blend65 — Asm-Parity Initiative (Prime Directive audit program + parity tooling)
> **Status**: Draft — RDs are authored on pickup from GitHub issues #49–#64 (umbrella [#56](https://github.com/blendsdk/blend65/issues/56))
> **Created**: 2026-07-17 · **Last Updated**: 2026-07-21 (RD-05 ✅ closed; RD-03 ✅ closed; RD-13 ✅ closed — 54/54 tasks; **RD-15 alignment-granularity drafted and preflighted** (18 findings, 0 critical / 2 major, all resolved, fixes applied), RD gate on AR #101–#110 plus #111–#112 surfaced during authoring; RD-03's M2 boundary value annotated as superseded; ambiguity register at 60 items, all resolved)
> **Architecture**: TypeScript monorepo (`@blend65/*` packages) + `scripts/` tooling; VICE 3.10 + ACME local tiers, ACME-only CI (AR-27)
> **CodeOps Skills Version**: 3.11.0

---

## Overview

The Prime Directive (project `CLAUDE.md`) demands output parity with hand-written 6502
assembly. This feature operationalizes it in two strands: **instruments** (measurement
infrastructure, budgets, twin-diff tooling) and **audits/fixes** (systematic sweeps of every
pipeline stage, plus the structural codegen improvements the first audit found).

Unlike blend65-ri, this feature's requirements originate as GitHub issues. The feature
roadmap (`../00-roadmap.md`) maps all 14 RDs + 1 task to their issues; an RD document is
authored here only when its item is picked up, following
`preflight (RD) → make_plan → preflight (plan) → exec_plan`.

## Domain Glossary

| Term | Definition |
|------|-----------|
| Golden | Committed expected `.asm` output for a fixture (`packages/test-harness/test/golden/<fixture>.asm.golden`), byte-exact asserted |
| Twin | Hand-written assembly functionally identical to a fixture, authored by an expert (`<fixture>.twin.asm`; balloon: `examples/balloon/balloon.asm`) |
| Parity ratio | generated ÷ hand-written, per metric (bytes, static cycles); 1.00 = parity, higher = worse |
| Budget | Recorded byte/cycle ceiling for a fixture or labeled window; exceeding it fails the tier |
| Ratchet | Budgets start at current cost exactly; regressions fail, optimizations tighten the budget in the same change |
| Straight-line cycles | Static estimate counting each instruction once (min–max spans branch/page-cross variance); loops not multiplied |
| Cycle window | A `fromLabel`→`toLabel` region measured or estimated for a cycle budget |
| Sweep | One audit area of umbrella #56 (A–H), delivered as findings/issues plus an area report |

## Document Index

| # | Document | Description | Depends On |
|---|----------|-------------|------------|
| **AR** | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions (audit trail; grows per RD) | — |
| **RD-01** | [Parity measurement infrastructure](RD-01-parity-measurement-infrastructure.md) | measureCycles, timing table, budgets, twin-diff, size gate, annotator, report integration ([#64](https://github.com/blendsdk/blend65/issues/64)) — ✅ done 2026-07-18 | — |
| **PF-13** | [Preflight Report — RD-13](00-preflight-report-rd-13.md) | RD-13 audit (27 findings: 0 critical, 8 major, 14 minor, 5 observations — 5-cluster fan-out on a different model family) — all resolved, fixes applied | RD-13 |
| **PF** | [Preflight Report](00-preflight-report.md) | RD-01 audit (8) + RD-02 audit (5, PF-009…PF-013) + RD-04 audit (4, PF-014…PF-017) + RD-05 audit (30, PF-018…PF-047 — 10 major, 5-cluster fan-out) — all resolved, fixes applied | RD-01, RD-02, RD-04, RD-05 |
| **RD-02** | [Golden-corpus twin audit + scoreboard](RD-02-golden-corpus-twin-audit.md) | 13 new twins, permanent VICE twin tier, committed SCOREBOARD.md + CI freshness gate, routed divergence inventory ([#61](https://github.com/blendsdk/blend65/issues/61)) — ✅ done 2026-07-18 | RD-01 |
| **RD-04** | [Compare-and-branch fusion](RD-04-compare-and-branch-fusion.md) | Fused compare-and-branch IL terminator + condition-position lowering (`&&`/`||`/`!` slot-free, literal folds); twin-idiom acceptance transferred to #51 ([#50](https://github.com/blendsdk/blend65/issues/50)) — ✅ done 2026-07-19, #50 closed | RD-01, RD-02 |
| **RD-05** | [Block layout — fall-through elision + jump threading](RD-05-block-layout.md) | Layout-aware emission: fall-through elision, branch inversion, jump threading, unreachable-block removal, plus branch-range relaxation ([#65](https://github.com/blendsdk/blend65/issues/65)); discharges RD-04's transferred twin-idiom criterion ([#51](https://github.com/blendsdk/blend65/issues/51)) — ✅ closed 2026-07-20 (preflighted 2026-07-19, 30 findings applied) | RD-01, RD-02, RD-04 |
| **RD-03** | [Placement — align const data and read it in place](RD-03-placement.md) | A const array whose address is taken is page-aligned, so hardware reads it where it already sits instead of the program copying it there. Grammar-free — no `spec/` change, no Guard evaluation. Closes the corpus's largest single divergence ([#49](https://github.com/blendsdk/blend65/issues/49), placement slice only; `copy()` stays gated) — ✅ closed 2026-07-20 | RD-01, RD-02 |
| **RD-13** | [Symbolic address arithmetic](RD-13-symbolic-address-arithmetic.md) | An address is a link-time constant the assembler folds for free; the compiler materializes it at runtime instead. Makes `hi(&X)`/`lo(&X)` one instruction, folds `lo(&X / 2^k)` and `lo(&X >> k)` to an ACME expression instead of `JSR __rt_div16` / `E90001`, and stops `W10172` firing where the frozen spec forbids it. Grammar-free; unblocks RD-15 ([#58](https://github.com/blendsdk/blend65/issues/58), symbolic slice only) — 🔎 preflighted 2026-07-20 (27 findings applied; spun off [#70](https://github.com/blendsdk/blend65/issues/70), [#71](https://github.com/blendsdk/blend65/issues/71)) · 📋 [plan](../plans/rd-13-symbolic-address-arithmetic/00-index.md) created 2026-07-21 (5 phases / 52 tasks, gate passed on AR #88–#96) · ✅ closed 2026-07-21 (54/54 tasks) | RD-01, RD-02, RD-03 |
| **RD-15** | [Alignment granularity — 64-byte sprite blocks](RD-15-alignment-granularity.md) | A const image is aligned to what the hardware actually reads: the boundary is derived from the divisor the source already writes, so `lo(&X / 64)` gets 64 and a bare `&X` keeps 256, combined coarsest-wins so `hi(&X) * 4` cannot break. Grammar-free — no `spec/` change, no Guard evaluation. **Not a byte-saving RD**: the corpus delta is 0 and the deliverable is the bound (pad < 64), which caps byte-ratchet noise at 63 instead of 255 ([#69](https://github.com/blendsdk/blend65/issues/69)) — 🔎 preflighted 2026-07-21 (18 findings: 0 critical, 2 major; all resolved, fixes applied) | RD-01, RD-02, RD-03, RD-13 |
| RD-06…RD-12, RD-14, RD-16, T-01, T-03 | *(not yet authored)* | Tracked as GitHub issues; see the [feature roadmap](../00-roadmap.md) for the full mapping | see roadmap |

## Dependency Graph

```
RD-01 (instruments) ──┬─→ RD-02 (twin audit + scoreboard: measured mode)
                      ├─→ RD-04 (compare-and-branch fusion: before/after numbers) ─→ RD-05 (block layout) ─┐
                      └─→ RD-07 (register-resident loop counters) ←── RD-06 (peephole seeds) ←─────────────┤
                                                                                                           └─→ RD-09 (Sweep D re-sweep)
RD-03 (placement: address-taken alignment) ─→ RD-13 (symbolic address arithmetic) ─→ RD-15 (alignment granularity)
RD-03 ←→ RD-11 (Sweep F)                                   RD-08, RD-10, RD-12, RD-14: independent sweeps
```

The RD-03 → RD-13 → RD-15 chain is a genuine unblock, not a convenience ordering. RD-03 chose a
256-byte boundary *because* page alignment was the only thing making the sprite block expressible
without new syntax (AR #68); RD-13 made `lo(&X / 64)` fold at link time, which dissolved that
premise; RD-15 then re-opens the boundary decision RD-03 settled. Each link is load-bearing.

Full dependency/blocker detail lives in the [feature roadmap](../00-roadmap.md).

## Suggested Implementation Order

**Corpus-driven priority (post-RD-02).** The scoreboard baseline is 4.83× bytes / **6.51× cycles**
(cycles are the worse metric). Two causes carry most of the raw ratio — #58 constant-materialization
(8/14 fixtures, every 7–9× case, ≈65% of excess bytes) and #59 startup/ABI (12/14) — but **both
ratios are inflated by the fixture mix**: the #58 fixtures are constant-*by-construction* parity
probes (their twins fold the whole program; a real game loop does not), and #59's byte cost is a
tiny fixed startup shim. So sequence by *representative* impact × risk, not raw ratio — and note the
#58 fixtures already *contain* the #50/#51/#52 patterns, so the hot-loop wave reaches them too.

| Wave | Documents (issue) | Description |
|------|-------------------|-------------|
| **A: Instruments** ✅ | RD-01 → RD-02 | Measurement infra, twin corpus + scoreboard baseline (done) |
| **B1: Hot-loop + seam-filling** (lead) | RD-04 (#50) · RD-06 (#52) *Rule 1 only* · **RD-05 (#51)** · conservative pure-IL const-fold (split from #58) — *RD-05 before const-fold: the const-fold pass orphans blocks by folding and depends on RD-05's `removeUnreachableBlocks`, which AR #29 assigned to RD-05 precisely so there is only one implementation. The dependency is one-way.* | Lead with **RD-04 compare-and-branch fusion** — audit finding #1, the hot-path *and* cycle lever. Add #52 **Rule 1** (INC/DEC, MMIO-guarded); defer #52 Rules 2–3 (value-tracking, same MMIO hazard that defers #58). Ship a **conservative const-fold** to fill the empty `optimize-il` seam. Low-risk, corpus-wide reach. |
| **B2: Biggest lever + placement** | whole-loop const-*evaluation* + DCE + SFA slot-elision (rest of #58 **+** #60, one lever) · placement slice of RD-03 (#49) · **RD-15 (#69)** — placement's follow-on: RD-03 aligns, RD-15 aligns to the granularity the hardware actually reads · RD-07 (#53) | Whole-program const-evaluation is what actually closes the 7–9× fixtures — design-laden (termination/budget), gated on a **type-conformance** audit (byte-wrap/cast-truncation is the real hazard, not MMIO). **Placement** (grammar-free) serves in-place const tables (slice7/7b/8b). RD-07 register-counters is demoted — 1 fixture. |
| **B3: Structural cycle lever** | RD-10 (#59) | Split #59: cheap one-time **startup trim** vs the **calling-convention/ABI** rework — per-call, cycle-heavy, already proven hot (balloon ≈13 instr/call). Higher risk (touches SFA + every call site); scope carefully. |
| **Gate: `copy()`** | copy() slice of RD-03 (#49) | Still gated on the **v3.1 + Language-Guard** decision (FUT-012), but **no longer blocking**: RD-03's placement slice closes the balloon divergence without it, by aligning the embedded sprite so the VIC reads it in place. `copy()` reverts to being an optimization rather than the only way to express the program. |
| **C: Remaining sweeps** | RD-08 (#54) · RD-11 (#62) · RD-12 (#57) · RD-13 residual (#58) · RD-14 (#63) · T-01 (#55) · re-sweep D/E (#60/#61) | Systematic audits; re-sweep D/E after B moves the baseline. |

## Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 6502 timing table home | `@blend65/core` `timing/` | One table for annotator, resource report, and budget tier; R15-safe (AR #6) |
| Enforcement split | Static budgets assert in CI; measured cycles assert locally | AR-27: CI has ACME but no emulator (AR #5) |
| Regression posture | Hard-fail ratchet | Prime Directive: a regression is a defect, a budget bump is a deliberate act (AR #4, #12) |
| Twin verification | Permanent local VICE tier, assertions shared with fixture suites | Twins are a live regression baseline; rot fails loudly (AR #16) |
| Scoreboard freshness | Committed beside goldens, CI regenerates + diffs | Golden-style honesty for "the number"; measured values from committed data keep CI VICE-free (AR #15, #17) |
| Lead lever (post-RD-02) | Executed-loop quality over raw ratio | #58/#59 ratios are inflated (constant-by-construction fixtures + tiny-fixture startup); a game dev writes folded loops, so the KPI overstates them. Weight by representativeness × risk; cycles (6.51×) rank above bytes (4.83×) |
| Constant-materialization | One lever (#58 + #60), two passes | Conservative pure-IL const-fold ships early (fills `optimize-il` seam, safe); whole-loop const-*evaluation* + SFA slot-elision is the design-laden pass that closes the 7–9× fixtures. Correctness hazard = type-conformance (byte-wrap/cast), not MMIO |
| Placement ≠ copy() | Split RD-03 (#49) | **Corrected 2026-07-20.** The earlier reading — that the balloon needs `copy()` because $0340 is below the PRG load base — assumed the sprite must live at $0340. It must not: a sprite pointer names any 64-byte block in the VIC bank, and the embedded data already lands at $0830, inside bank 0. What was missing is alignment, not a copy. Placement (grammar-free) therefore serves the balloon too, and `copy()` is no longer on the critical path (AR #64, #65) |
| Calling convention | In scope now (not "if hot") | #59's per-call ABI is a hot cycle lever (balloon ≈13 instr/call), distinct from the fixture-inflated one-time startup; scoped as a structural pass |
| Condition lowering | Fused compare-and-branch IL terminator + slot-free condition-position lowering | Fusion true by construction (no unfiring heuristic); composes with the const-fold pass and #51 threading; materialization stays for value contexts; branch-range relaxation routed to #51 via [#65](https://github.com/blendsdk/blend65/issues/65) (AR #20–#25) |
| Layout transform placement | Split by seam: threading + unreachable-removal as IL passes; fall-through elision + branch inversion as one tail decision at translation; relaxation as a new unconditional stage | Each transform sits where its facts exist — the IL cannot represent fall-through, and block adjacency exists only in the translator's block loop. The instruction peephole is non-viable (its rule contract excludes labels from windows) and is #52's home (AR #26) |
| Alignment granularity | Derived from the source's own divisor, combined coarsest-wins | The program already states the granularity (`lo(&X / 64)` *is* "hardware reads this in 64-byte units") and RD-13 put that divisor in hand at the marking site — so no attribute and no `spec/` change (D3). Taking the maximum of a symbol's demands keeps `hi(&X) * 4` correct **by construction** rather than by caution. The demand set is an allowlist of hardware granularities, not the divisor itself: `lo(&X / 16384)` is a VIC-bank *read*, not a request for 16 KB alignment (AR #102, #103, #104) |
| Alignment as measurement hygiene | Bound the pad, don't count the bytes | Padding to 256 makes every image's pad a 0–255 draw that re-rolls on unrelated edits — noise larger than most optimizations, and the reason RD-13's real 13-byte win left the binary unchanged. RD-15's corpus byte delta is **0** and its acceptance criteria say so; the deliverable is the bound (AR #101, #108) |
| Layout gating | Unconditional — not behind `--optimize` | A jump to the next instruction is a defect, not a withheld optimization; and relaxation is correctness that must measure the geometry actually emitted, so the two cannot be gated differently (AR #30) |

## Non-Functional Requirements

This feature adds no runtime product surface — its RDs are compiler-internal quality gates and
dev tooling. Non-functional requirements are governed by blend65-ri/RD-13 (compiler NFRs) and
the Prime Directive itself (the parity bar *is* this feature's performance requirement); no
separate NFR document is maintained here.

## How to Use These Documents

1. Pick the next item from the [feature roadmap](../00-roadmap.md) (respect Depends-on)
2. Author its RD here from the linked GitHub issue (make_requirements, add mode)
3. `preflight` the RD → `make_plan` → `preflight` the plan → `exec_plan`
4. On completion: tick the issue's checklist, post the area report, sync the roadmap
