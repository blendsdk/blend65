# Roadmap: Blend65 v4

> **Feature-Set**: Blend65 v4
> **Status**: In Progress
> **Created**: 2026-09-10
> **Last Updated**: 2026-09-13
> **Progress**: 0 / 10 (0%)
> **Execution Prerequisite**: Phase 0 complete; see
> [bootstrap and session handoff](00-phase-0-handoff.md)
> **CodeOps Artifact Schema**: 1

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Depends-on / Blocker |
|---|---|---|---|---|---|---|---|
| RD-01 | Specification 4.0 and Expert Authority Freeze | [RD-01](requirements/RD-01-specification-4-and-expert-authority-freeze.md) | [Plan](plans/rd-01-specification-4-and-expert-authority-freeze/00-index.md) | Executing | 🔄 | 2026-09-13 | — |
| RD-02 | Clean V4 Foundation and Deterministic Project Model | [RD-02](requirements/RD-02-clean-v4-foundation-and-deterministic-project-model.md) | — | RD Preflighted | 🔎 | 2026-09-11 | depends on RD-01 |
| RD-03 | Playable M1 Complete Pipeline | [RD-03](requirements/RD-03-playable-m1-complete-pipeline.md) | — | RD Preflighted | 🔎 | 2026-09-11 | depends on RD-02 |
| RD-04 | Complete Language and Correct Unoptimized Compiler | [RD-04](requirements/RD-04-complete-language-correct-unoptimized-compiler.md) | — | RD Preflighted | 🔎 | 2026-09-11 | depends on RD-03 |
| RD-05 | C64 Platform Profiles and Game-Workload Compiler Support | [RD-05](requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md) | — | RD Preflighted | 🔎 | 2026-09-11 | depends on RD-04 |
| RD-06 | Native Assets, Compile-Time Composition, and Resident Layout | [RD-06](requirements/RD-06-native-assets-compile-time-composition-and-resident-layout.md) | — | RD Preflighted | 🔎 | 2026-09-11 | depends on RD-04, RD-05 |
| RD-07 | Loadable Assets and D64 Delivery | [RD-07](requirements/RD-07-loadable-assets-and-d64-delivery.md) | — | RD Preflighted | 🔎 | 2026-09-11 | depends on RD-04, RD-05, RD-06 |
| RD-08 | Optimization and Expert Output | [RD-08](requirements/RD-08-optimization-and-expert-output.md) | — | RD Preflighted | 🔎 | 2026-09-11 | depends on RD-04, RD-05, RD-06, RD-07 |
| RD-09 | Developer Tooling and Debug Evidence | [RD-09](requirements/RD-09-developer-tooling-and-debug-evidence.md) | — | RD Preflighted | 🔎 | 2026-09-11 | starts after RD-04; closes after RD-05, RD-06, RD-07, and RD-08 |
| RD-10 | Production Qualification and C64U Handoff | [RD-10](requirements/RD-10-production-qualification-and-c64u-handoff.md) | — | RD Preflighted | 🔎 | 2026-09-11 | depends on RD-05, RD-06, RD-07, RD-08, RD-09 |
