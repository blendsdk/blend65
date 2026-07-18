# asm-parity — Requirements Documents

> **Project**: blend65 — Asm-Parity Initiative (Prime Directive audit program + parity tooling)
> **Status**: Draft — RDs are authored on pickup from GitHub issues #49–#64 (umbrella [#56](https://github.com/blendsdk/blend65/issues/56))
> **Created**: 2026-07-17
> **Architecture**: TypeScript monorepo (`@blend65/*` packages) + `scripts/` tooling; VICE 3.10 + ACME local tiers, ACME-only CI (AR-27)
> **CodeOps Skills Version**: 3.9.0

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
| **RD-01** | [Parity measurement infrastructure](RD-01-parity-measurement-infrastructure.md) | measureCycles, timing table, budgets, twin-diff, size gate, annotator, report integration ([#64](https://github.com/blendsdk/blend65/issues/64)) — 🔎 preflighted | — |
| **PF** | [Preflight Report](00-preflight-report.md) | RD-01 preflight audit (iteration 1: 8 findings, all resolved, fixes applied) | RD-01 |
| RD-02…RD-14, T-01 | *(not yet authored)* | Tracked as GitHub issues; see the [feature roadmap](../00-roadmap.md) for the full mapping | see roadmap |

## Dependency Graph

```
RD-01 (instruments) ──┬─→ RD-02 (twin audit + scoreboard: measured mode)
                      ├─→ RD-04 (compare-and-branch fusion: before/after numbers) ─→ RD-05 (block layout) ─┐
                      └─→ RD-07 (register-resident loop counters) ←── RD-06 (peephole seeds) ←─────────────┤
                                                                                                           └─→ RD-09 (Sweep D re-sweep)
RD-03 (memory & hardware epic) ←→ RD-11 (Sweep F)          RD-08, RD-10, RD-12, RD-13, RD-14: independent sweeps
```

Full dependency/blocker detail lives in the [feature roadmap](../00-roadmap.md).

## Suggested Implementation Order

| Phase | Documents | Description |
|-------|-----------|-------------|
| **A: Instruments** | RD-01 → RD-02 | Measurement infrastructure, then the twin corpus + scoreboard baseline (umbrella #56: "H early, E with it") |
| **B: Structural codegen** | RD-04 → RD-05 → RD-06 → RD-07 | Measured optimization work, ratcheting budgets as it lands |
| **C: Sweeps & epic** | RD-03, RD-08…RD-14, T-01 | Systematic audits (re-sweeping D/E after phase B) + the memory/hardware epic |

## Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 6502 timing table home | `@blend65/core` `timing/` | One table for annotator, resource report, and budget tier; R15-safe (AR #6) |
| Enforcement split | Static budgets assert in CI; measured cycles assert locally | AR-27: CI has ACME but no emulator (AR #5) |
| Regression posture | Hard-fail ratchet | Prime Directive: a regression is a defect, a budget bump is a deliberate act (AR #4, #12) |

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
