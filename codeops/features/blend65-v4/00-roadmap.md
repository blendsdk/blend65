# Roadmap: Blend65 v4

> **Feature-Set**: Blend65 v4
> **Status**: In Progress
> **Created**: 2026-09-10
> **Last Updated**: 2026-09-25
> **Progress**: 1 / 10 (10%)
> **Execution Prerequisite**: Phase 0 complete; see
> [bootstrap and session handoff](00-phase-0-handoff.md)
> **CodeOps Artifact Schema**: 1

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Depends-on / Blocker |
|---|---|---|---|---|---|---|---|
| RD-01 | Specification 4.0 and Expert Authority Freeze | [RD-01](requirements/RD-01-specification-4-and-expert-authority-freeze.md) | [Plan](plans/rd-01-specification-4-and-expert-authority-freeze/00-index.md) | Done | ✅ | 2026-09-14 | — |
| RD-02 | Clean V4 Foundation and Deterministic Project Model | [RD-02](requirements/RD-02-clean-v4-foundation-and-deterministic-project-model.md) | [Plan](plans/rd-02-clean-v4-foundation-and-deterministic-project-model/00-index.md) | ⛔ Blocked (was: Executing) | ⛔ | 2026-09-19 | Linux implementation complete, with formal closeout waiting on DEF-1 at RD-10 and not blocking RD-03–RD-09 |
| ↳ DEF-1 | Actual Node 22 Windows x64 foundation qualification | — | [Evidence](plans/rd-02-clean-v4-foundation-and-deterministic-project-model/08-closeout.md) | Deferred | ⏸️ | 2026-09-19 | Run during RD-10 native Windows qualification when the user supplies access, with no earlier host request or new infrastructure |
| RD-03 | Playable M1 Complete Pipeline | [RD-03](requirements/RD-03-playable-m1-complete-pipeline.md) | [Frontend](plans/rd-03-frontend-first/00-index.md) · [Pipeline completion](plans/rd-03-pipeline-completion/00-index.md) | ⛔ Blocked (Linux execution complete) | ⛔ | 2026-09-23 | Frontend (64/64) and pipeline completion (79/79) are complete. ACME 0.97 and VICE 3.10 pass the exact 441-input generated-versus-expert rendered journey. Formal Done waits only on DEF-3 native Windows qualification during RD-10 and does not block RD-04–RD-09. SpritePad stays in RD-06. |
| ↳ DEF-2 | Parser syntax diagnostic authority decision | — | [Decision](plans/rd-03-frontend-first/00-ambiguity-register.md) | Done | ✅ | 2026-09-18 | User approved `PARSE_SYNTAX_ERROR`; narrow R3.10 exception recorded. |
| ↳ DEF-3 | Native Node 22 Windows x64 RD-03 qualification | — | [Decision](plans/rd-03-pipeline-completion/00-ambiguity-register.md) | Deferred | ⏸️ | 2026-09-23 | Run publication, pin/cleanup, tool/process and editor smoke during RD-10 when the user supplies Windows access; Linux implementation is complete and RD-04–RD-09 remain unblocked. |
| RD-04 | Complete Language and Correct Unoptimized Compiler | [RD-04](requirements/RD-04-complete-language-correct-unoptimized-compiler.md) | [Plan](plans/rd-04-language-completion/00-index.md) | Executing | 🔄 | 2026-09-25 | Phases 1–6 and 72/99 tasks verified. Compile-time evaluation, integer trigonometry and fixed aggregate results are complete; the next task is dynamic memory access and size/count queries. AR-P19 moved only source-visible profile facts to RD-05. Phase 6 two minor evidence/stack precision notes remain for RD-04 qualification. Unsafe NMI sinks (AR-P16) and handler-side IRQ vector updates (AR-P17) reject with E10245; RD-05 owns both valid forms. Phase 5 parity debt remains tracked in [#83](https://github.com/blendsdk/blend65/issues/83) and [#84](https://github.com/blendsdk/blend65/issues/84); Phase 6 meet-only debt in [#85](https://github.com/blendsdk/blend65/issues/85). Native Windows remains deferred to RD-10. |
| ↳ DEF-10 | Source-visible selected-profile facts ownership | — | [Decision](plans/rd-04-language-completion/00-ambiguity-register.md) | Done | ✅ | 2026-09-25 | AR-P19 approved: RD-05 R5.3/AC-03 retains source-visible selected-profile facts and branch removal; RD-04 keeps its memory, size, CPU, BCD and embed work. |
| ↳ DEF-9 | Internal compile-time evaluator test entry | — | [Decision](plans/rd-04-language-completion/00-ambiguity-register.md) | Done | ✅ | 2026-09-25 | AR-P18 approved: test-only reduced limits and typed-result observation; production limits stay fixed. |
| ↳ DEF-4 | Coverage-key contract for the static completion check | — | [Decision](plans/rd-04-language-completion/00-ambiguity-register.md) | Done | ✅ | 2026-09-23 | User approved the minimal named-item key scheme; Phase 1 resumed. |
| ↳ DEF-5 | Obsolete partial-parser spec-test authority | — | [Decision](plans/rd-04-language-completion/00-ambiguity-register.md) | Done | ✅ | 2026-09-23 | User approved AR-P11: supersede four temporary RD-03 `unchecked` expectations with frozen Specification 4 grammar expectations. |
| ↳ DEF-6 | Asset-aware overlay API and old synchronous tests | — | [Decision](plans/rd-04-language-completion/00-ambiguity-register.md) | Done | ✅ | 2026-09-24 | User approved AR-P12: use one awaited asset-aware overlay path and update five old synchronous expectations. |
| ↳ DEF-7 | Qualified cooperative NMI sink contract | — | [Decision](plans/rd-04-language-completion/00-ambiguity-register.md) | Deferred to RD-05 | ⏸️ | 2026-09-25 | AR-P16: unbounded NMI self-reentry and non-atomic NMINV update make selected-profile sinks unsafe. RD-05 R5.15–R5.17 owns finite-source/update proof and any separately authorized frozen-spec correction. This does not block safe Phase 6 IRQ work. |
| ↳ DEF-8 | Handler-side IRQ vector updates | — | [Decision](plans/rd-04-language-completion/00-ambiguity-register.md) | Deferred to RD-05 | ⏸️ | 2026-09-25 | AR-P17: mainline IRQ installs work; handler-side installs/restores reject with E10245 until RD-05 R5.16 proves distinct live predecessor links and finite chain contexts. The user-visible gap is recorded in the expressiveness ledger. |
| RD-05 | C64 Platform Profiles and Game-Workload Compiler Support | [RD-05](requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md) | — | RD Preflighted | 🔎 | 2026-09-11 | depends on RD-04 |
| RD-06 | Native Assets, Compile-Time Composition, and Resident Layout | [RD-06](requirements/RD-06-native-assets-compile-time-composition-and-resident-layout.md) | — | RD Preflighted | 🔎 | 2026-09-20 | depends on RD-04, RD-05; owns deferred SpritePad 3.80 producer evidence and native import |
| RD-07 | Loadable Assets and D64 Delivery | [RD-07](requirements/RD-07-loadable-assets-and-d64-delivery.md) | — | RD Preflighted | 🔎 | 2026-09-11 | depends on RD-04, RD-05, RD-06 |
| RD-08 | Optimization and Expert Output | [RD-08](requirements/RD-08-optimization-and-expert-output.md) | — | RD Preflighted | 🔎 | 2026-09-11 | depends on RD-04, RD-05, RD-06, RD-07 |
| RD-09 | Developer Tooling and Debug Evidence | [RD-09](requirements/RD-09-developer-tooling-and-debug-evidence.md) | — | RD Preflighted | 🔎 | 2026-09-11 | starts after RD-04; closes after RD-05, RD-06, RD-07, and RD-08 |
| RD-10 | Production Qualification and C64U Handoff | [RD-10](requirements/RD-10-production-qualification-and-c64u-handoff.md) | — | RD Preflighted | 🔎 | 2026-09-19 | depends on RD-05 through RD-09 and closes DEF-1 during native Windows qualification |
