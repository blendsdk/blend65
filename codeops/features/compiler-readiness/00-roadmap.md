# Roadmap: Compiler Readiness

> **Feature-Set**: Compiler Readiness
> **Status**: In Progress
> **Created**: 2026-07-23
> **Last Updated**: 2026-07-28
> **Progress**: 2 / 8 (25%)
> **CodeOps Artifact Schema**: 1

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Depends-on / Blocker |
|---|---|---|---|---|---|---|---|
| RD-01 | Specification inventory and rule schema | [RD-01](requirements/RD-01-specification-inventory.md) | [Plan](plans/rd-01-specification-inventory/00-index.md) | Done | ✅ | 2026-07-24 | 69/69 tasks; 351 readiness tests; 95.17% branch coverage; quality gate resolved |
| RD-02 | Typed generative cases and deterministic replay | [RD-02](requirements/RD-02-generative-cases.md) | [Plan](plans/rd-02-generative-cases/00-index.md) | Done | ✅ | 2026-07-26 | 71/71 tasks; atomic publication selected; filesystem hardening independently accepted; 952 readiness tests and exact full verify green |
| RD-03 | Independent semantic, diagnostic and metamorphic oracles | [RD-03](requirements/RD-03-independent-oracles.md) | [Plan](plans/rd-03-independent-oracles/00-index.md) | Executing | 🔄 | 2026-07-28 | depends on RD-01, RD-02; Phases 1–3 verified; semantic relations and fault seam independently reviewed; 36/72 tasks complete |
| RD-04 | Tiered compiler, ACME and VICE execution | [RD-04](requirements/RD-04-tiered-execution.md) | — | RD Drafted | ✏️ | 2026-07-23 | depends on RD-02, RD-03 |
| RD-05 | Failure classification, shrinking and regression promotion | [RD-05](requirements/RD-05-failure-reduction.md) | — | RD Drafted | ✏️ | 2026-07-23 | depends on RD-02, RD-04 |
| RD-08 | Complete C64 rule models, generator coverage and oracle-contract expansion | — | — | Backlog | ⬜ | 2026-07-27 | depends on RD-02, RD-03; owns arrays, nested calls, branches, loops, loop-unrolling relations and the remaining 2,103 rule models |
| RD-06 | Readiness matrix, release gate and legacy evidence | [RD-06](requirements/RD-06-readiness-gate.md) | — | RD Drafted | ✏️ | 2026-07-23 | depends on RD-01–RD-05 and RD-08 |
| RD-07 | Non-functional safety, determinism and evolution | [RD-07](requirements/RD-07-non-functional.md) | — | RD Drafted | ✏️ | 2026-07-23 | depends on RD-01–RD-06 |
| T-01 | Manual remediation of rejected inventory rules | — | [Task](plans/t-01-manual-rule-remediation/99-execution-plan.md) | Done | ✅ | 2026-07-24 | 24-rule allowlist corrected and independently accepted; no broad regeneration; 95.23% branch coverage; full verify green |
| T-02 | Align RD-02 structural validation with compile-time constant purity | — | — | Backlog | ⬜ | 2026-07-28 | follow-up to RD-02; Phase 2 semantic closure now prevents illegal constants from entering oracle evaluation; RD-02 structural alignment remains owned here |
