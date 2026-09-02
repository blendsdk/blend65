# Roadmap: Compiler Readiness

> **Feature-Set**: Compiler Readiness
> **Status**: In Progress
> **Created**: 2026-07-23
> **Last Updated**: 2026-09-02
> **Progress**: 4 / 8 (50%)
> **CodeOps Artifact Schema**: 1

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Depends-on / Blocker |
|---|---|---|---|---|---|---|---|
| RD-01 | Specification inventory and rule schema | [RD-01](requirements/RD-01-specification-inventory.md) | [Plan](plans/rd-01-specification-inventory/00-index.md) | Done | ✅ | 2026-07-24 | 69/69 tasks; 351 readiness tests; 95.17% branch coverage; quality gate resolved |
| RD-02 | Typed generative cases and deterministic replay | [RD-02](requirements/RD-02-generative-cases.md) | [Plan](plans/rd-02-generative-cases/00-index.md) | Done | ✅ | 2026-07-26 | 71/71 tasks; atomic publication selected; filesystem hardening independently accepted; 952 readiness tests and exact full verify green |
| RD-03 | Independent semantic, diagnostic and metamorphic oracles | [RD-03](requirements/RD-03-independent-oracles.md) | [Plan](plans/rd-03-independent-oracles/00-index.md) | Done | ✅ | 2026-07-29 | 72/72 tasks; nine-binding publication selected at `sha256:41557dde…e2706`; historical four-binding authority remains resolvable; 1,316 readiness tests; 90.11% branch coverage; exact full verify green |
| RD-04 | Tiered compiler, ACME and VICE execution | [RD-04](requirements/RD-04-tiered-execution.md) | [Plan](plans/rd-04-tiered-execution/00-index.md) | Done | ✅ | 2026-08-24 | 88/88 tasks; reviewed child `sha256:2afaa824…7d228` selected; canonical real authority 97/97 routes; exact full verification green; no expired deferral |
| RD-05 | Failure classification, shrinking and regression promotion | [RD-05](requirements/RD-05-failure-reduction.md) | [Plan](plans/rd-05-failure-reduction/00-index.md) | Deferred | ⏸️ | 2026-09-02 | 34/70 tasks; Phase 3 complete and exact verification GREEN; paused before Phase 4 to prevent further harness expansion while real generated-program coverage is prioritized |
| RD-08 | Complete C64 rule models, generator coverage and oracle-contract expansion | [RD-08](requirements/RD-08-complete-c64-rule-coverage.md) | — | RD Preflighted | 🔎 | 2026-09-02 | preflight passed; first phase is capped, minimum-sufficient arrays/calls/branches/loops semantic generation; needs `make-plan` |
| RD-06 | Readiness matrix, release gate and legacy evidence | [RD-06](requirements/RD-06-readiness-gate.md) | — | RD Drafted | ✏️ | 2026-07-23 | depends on RD-01–RD-05 and RD-08 |
| RD-07 | Non-functional safety, determinism and evolution | [RD-07](requirements/RD-07-non-functional.md) | — | RD Drafted | ✏️ | 2026-07-23 | depends on RD-01–RD-06 |
| T-01 | Manual remediation of rejected inventory rules | — | [Task](plans/t-01-manual-rule-remediation/99-execution-plan.md) | Done | ✅ | 2026-07-24 | 24-rule allowlist corrected and independently accepted; no broad regeneration; 95.23% branch coverage; full verify green |
| T-02 | Align RD-02 structural validation with compile-time constant purity | — | — | Backlog | ⬜ | 2026-07-28 | follow-up to RD-02; Phase 2 semantic closure now prevents illegal constants from entering oracle evaluation; RD-02 structural alignment remains owned here |
