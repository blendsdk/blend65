# Roadmap: Commercial-Game Optimizer and Code Generator

> **Feature-Set**: Commercial-Game Optimizer and Code Generator
> **Status**: In Progress
> **Created**: 2026-07-24
> **Last Updated**: 2026-07-24
> **Progress**: 0 / 18 (0%)
> **CodeOps Artifact Schema**: 1

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Depends-on / Blocker |
|---|---|---|---|---|---|---|---|
| RD-01 | Authority and exact commercial cost model | [RD-01](requirements/RD-01-authority-cost-model.md) | — | RD Preflighted | 🔎 | 2026-07-24 | Requirements preflight passed; implementation plan next |
| RD-02 | Effect system and optimization overlay | [RD-02](requirements/RD-02-effects-optimization-overlay.md) | — | RD Preflighted | 🔎 | 2026-07-24 | RD-01 |
| RD-03 | Pass manager, profiles and bisection | [RD-03](requirements/RD-03-pass-manager-profiles.md) | — | RD Preflighted | 🔎 | 2026-07-24 | RD-01–RD-02 |
| RD-04 | Whole-program analysis and internal ABI | [RD-04](requirements/RD-04-whole-program-analysis.md) | — | RD Preflighted | 🔎 | 2026-07-24 | RD-02–RD-03 |
| RD-05 | Scalar and dataflow optimization | [RD-05](requirements/RD-05-scalar-dataflow.md) | — | RD Preflighted | 🔎 | 2026-07-24 | RD-02–RD-04 |
| RD-06 | Control-flow and loop optimization | [RD-06](requirements/RD-06-control-flow-loops.md) | — | RD Preflighted | 🔎 | 2026-07-24 | RD-02–RD-05 |
| RD-07 | Memory optimization and data placement | [RD-07](requirements/RD-07-memory-data-placement.md) | — | RD Preflighted | 🔎 | 2026-07-24 | RD-02–RD-06 |
| RD-08 | Register, zero-page and frame allocation | [RD-08](requirements/RD-08-allocation.md) | — | RD Preflighted | 🔎 | 2026-07-24 | RD-02–RD-07 |
| RD-09 | Costed NMOS 6502 instruction selection | [RD-09](requirements/RD-09-instruction-selection.md) | — | RD Preflighted | 🔎 | 2026-07-24 | RD-01–RD-08 |
| RD-10 | Verified superoptimizer and peephole catalog | [RD-10](requirements/RD-10-superoptimizer-peephole.md) | — | RD Preflighted | 🔎 | 2026-07-24 | RD-03, RD-09 |
| RD-11 | Scheduling, layout and link-time optimization | [RD-11](requirements/RD-11-scheduling-layout-link.md) | — | RD Preflighted | 🔎 | 2026-07-24 | RD-03–RD-10 |
| RD-12 | Deterministic profile-guided optimization | [RD-12](requirements/RD-12-profile-guided-optimization.md) | — | RD Preflighted | 🔎 | 2026-07-24 | RD-03–RD-11 |
| RD-13 | Hardware, interrupt and raster timing | [RD-13](requirements/RD-13-hardware-timing.md) | — | RD Preflighted | 🔎 | 2026-07-24 | RD-02–RD-12 |
| RD-14 | Translation validation and failure reduction | [RD-14](requirements/RD-14-translation-validation.md) | — | RD Preflighted | 🔎 | 2026-07-24 | RD-03–RD-13 |
| RD-15 | Game-shaped corpus and commercial gate | [RD-15](requirements/RD-15-game-corpus-commercial-gate.md) | — | RD Preflighted | 🔎 | 2026-07-24 | RD-01, RD-09–RD-14 |
| RD-16 | Reports and developer control | [RD-16](requirements/RD-16-reports-developer-control.md) | — | RD Preflighted | 🔎 | 2026-07-24 | RD-03, RD-15 |
| RD-17 | Commercial-game capability integration | [RD-17](requirements/RD-17-toolchain-capability-integration.md) | — | RD Preflighted | 🔎 | 2026-07-24 | RD-01, RD-15 |
| RD-18 | Determinism, scale, security and evolution | [RD-18](requirements/RD-18-non-functional-evolution.md) | — | RD Preflighted | 🔎 | 2026-07-24 | RD-01–RD-17 |
