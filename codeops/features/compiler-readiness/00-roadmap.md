# Roadmap: Compiler Readiness

> **Feature-Set**: Compiler Readiness
> **Status**: In Progress
> **Created**: 2026-07-23
> **Last Updated**: 2026-07-23
> **Progress**: 0 / 7 (0%)
> **CodeOps Artifact Schema**: 1

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Depends-on / Blocker |
|---|---|---|---|---|---|---|---|
| RD-01 | Specification inventory and rule schema | [RD-01](requirements/RD-01-specification-inventory.md) | — | RD Preflighted | 🔎 | 2026-07-23 | — |
| RD-02 | Typed generative cases and deterministic replay | [RD-02](requirements/RD-02-generative-cases.md) | — | RD Drafted | ✏️ | 2026-07-23 | depends on RD-01 |
| RD-03 | Independent semantic, diagnostic and metamorphic oracles | [RD-03](requirements/RD-03-independent-oracles.md) | — | RD Drafted | ✏️ | 2026-07-23 | depends on RD-01 |
| RD-04 | Tiered compiler, ACME and VICE execution | [RD-04](requirements/RD-04-tiered-execution.md) | — | RD Drafted | ✏️ | 2026-07-23 | depends on RD-02, RD-03 |
| RD-05 | Failure classification, shrinking and regression promotion | [RD-05](requirements/RD-05-failure-reduction.md) | — | RD Drafted | ✏️ | 2026-07-23 | depends on RD-02, RD-04 |
| RD-06 | Readiness matrix, release gate and legacy evidence | [RD-06](requirements/RD-06-readiness-gate.md) | — | RD Drafted | ✏️ | 2026-07-23 | depends on RD-01–RD-05 |
| RD-07 | Non-functional safety, determinism and evolution | [RD-07](requirements/RD-07-non-functional.md) | — | RD Drafted | ✏️ | 2026-07-23 | depends on RD-01–RD-06 |
