# Blend65 v4 — Requirements Documents

> **Project**: Blend65 v4 — clean-slate 6502 language, compiler, C64 platform, and developer tooling
> **Status**: Complete
> **Created**: 2026-09-10
> **Target Architecture**: TypeScript 7, Node 22, Yarn v1 workspaces, Turborepo, Vitest, ACME, and VICE
> **CodeOps Artifact Schema**: 1

---

## Overview

Blend65 v4 is a clean production design for a statically typed, ahead-of-time 6502 programming
language. It starts with C64 and keeps target boundaries explicit so C64 Ultimate and other
6502-family machines can follow without copying or weakening the compiler architecture. The source
language serves modern programmers; generated machine code is judged against expert 6502 assembly.

The ten requirement documents define one controlled language-and-skill authority transition, a
small deterministic monorepo, a playable first vertical slice, the complete correct unoptimized
compiler, eight C64 resident profiles, native assets and compile-time composition, one D64 loading
profile, exhaustive evidence-qualified optimization, Linux/Windows tooling, and the final production
qualification plus C64U handoff. Existing v3 code is salvage evidence only and creates no
compatibility obligation.

## Minimum-Sufficient Baseline

**Original goal:** Replace the parked v3 implementation with a modular production compiler whose
modern language can express real C64 software and games while producing assembly that meets or beats
expert hand-written work.

**Smallest viable design:** One active Specification 4 and expert baseline; one deterministic
compiler service; independently testable frontend, semantic, SFA, IL, CPU, machine, optimizer,
serializer, packager, CLI, LSP, and VS Code responsibilities; exactly eight resident C64 profiles;
one D64 profile; and native handling for the approved current asset identities.

**Excluded support machinery:** No v3 compatibility layer, public compiler-plugin framework,
general runtime, heap, dynamic arrays, game engine, readiness product, evidence database, pass DSL,
owned debugger adapter, visual designer, package manager, automatic tool downloader, fastloader,
compressor, or speculative future-target package.

**Approved complexity:** The material support surfaces and complexity escalations are resolved in
[the ambiguity register](00-ambiguity-register.md), AR-001 through AR-048.

## Mandatory Phase 0 Bootstrap

Before RD-01 begins, record the exact final v3 source commit and create
`/home/gevik/workdir/github/blend65.ri/v4` on `feature/v4-rebuild` from that commit. The current
checkout remains the parked v3 evidence worktree. RD-01 and every later v4 requirement execute in
the prepared v4 worktree. If the branch, path, or worktree already exists with a different
identity, stop without resetting, overwriting, moving, or deleting anything. This bootstrap creates
no compiler architecture, package, or compatibility obligation. (AR-005, AR-025)

## Domain Glossary

| Term | Definition |
|---|---|
| Specification 4 | The single language authority created and frozen by RD-01 before semantic implementation. |
| Expert baseline `2.0.0` | The single active Blend65 domain-expert skill requalified against Specification 4 by RD-01. |
| SFA | Static Frame Allocation: the sole general model for parameters, returns, locals, temporaries, spills, and function/helper scratch. |
| CPU contract | Instruction legality, registers, flags, cycles, and CPU-specific lowering facts independent of a machine. |
| Machine profile | One indivisible CPU, video, ROM, banking, interrupt, SID, memory, startup, artifact, and evidence identity. |
| Resident asset | Immutable program data placed in the primary PRG and available without a load operation. |
| Loadable asset | Typed immutable disk content that has no resident address until an explicit successful load publishes a destination. |
| Expert parity | Generated output is no worse than equivalent expert assembly for the selected local objective, with whole-program compiler wins also required. |
| Behavior oracle | Expected values and machine effects derived independently from language, CPU, and platform semantics. |
| Assembly/cost oracle | Independent expectation for instructions, bytes, cycles, placement, and complete resource costs. |
| HLE | A documented exception forced by hardware or the deliberately bounded target delivery model. |
| Production host | A native host on which the complete supported compiler, editor, ACME, and VICE workflow is qualified. |

## Document Index

| # | Document | Description | Depends On |
|---|---|---|---|
| **AR** | [Ambiguity Register](00-ambiguity-register.md) | Forty-eight resolved product, language, architecture, target, evidence, and workflow decisions | — |
| **RD-01** | [Specification 4.0 and Expert Authority Freeze](RD-01-specification-4-and-expert-authority-freeze.md) | Applies accepted language changes once, qualifies expert `2.0.0`, and freezes both authorities in the prepared v4 worktree | Phase 0 bootstrap |
| **RD-02** | [Clean V4 Foundation and Deterministic Project Model](RD-02-clean-v4-foundation-and-deterministic-project-model.md) | Creates the clean monorepo, package boundaries, project model, diagnostics, and immutable-generation build foundation | RD-01 |
| **RD-03** | [Playable M1 Complete Pipeline](RD-03-playable-m1-complete-pipeline.md) | Delivers a playable Space Invaders-style vertical proof through real assets, ACME, and VICE | RD-01, RD-02 |
| **RD-04** | [Complete Language and Correct Unoptimized Compiler](RD-04-complete-language-correct-unoptimized-compiler.md) | Implements all Specification 4 semantics and correct `optimization: none` output | RD-01, RD-02, RD-03 |
| **RD-05** | [C64 Platform Profiles and Game-Workload Compiler Support](RD-05-c64-platform-profiles-and-game-workload-compiler-support.md) | Implements eight C64 profiles and proves user-authored game workloads without shipping an engine | RD-01 through RD-04 |
| **RD-06** | [Native Assets, Compile-Time Composition, and Resident Layout](RD-06-native-assets-compile-time-composition-and-resident-layout.md) | Adds exact asset handlers, typed compile-time refinement, and one-copy resident placement | RD-01 through RD-05 |
| **RD-07** | [Loadable Assets and D64 Delivery](RD-07-loadable-assets-and-d64-delivery.md) | Adds explicit loadable values, one deterministic D64 profile, and bounded KERNAL loading | RD-01 through RD-06 |
| **RD-08** | [Optimization and Expert Output](RD-08-optimization-and-expert-output.md) | Exhausts the qualified modern-plus-6502 frontier for balanced, speed, and size goals | RD-01 through RD-07 |
| **RD-09** | [Developer Tooling and Debug Evidence](RD-09-developer-tooling-and-debug-evidence.md) | Completes the compiler API, CLI, LSP, thin VS Code client, formatter, and portable debug evidence | RD-04 to start; RD-05 through RD-08 to close |
| **RD-10** | [Production Qualification and C64U Handoff](RD-10-production-qualification-and-c64u-handoff.md) | Closes the Linux/Windows C64 production claim and hands proved architecture seams to the C64U feature | RD-05 through RD-09 |

## Dependency Graph

```text
Phase 0  Record final v3 commit and create the v4 worktree
  └─ RD-01  Specification and expert authority
       └─ RD-02  Foundation and project model
            └─ RD-03  Playable M1 pipeline
                 └─ RD-04  Complete correct unoptimized compiler
                      ├─ RD-09  Tooling starts; final integration waits RD-05..08 ┐
                      └─ RD-05  C64 profiles and workload support                 │
                           └─ RD-06  Native assets and resident layout            │
                                └─ RD-07  Loadable assets and D64                  │
                                     └─ RD-08  Optimization and expert output     │
                                                                                    ├─ RD-10
                           RD-05 ──────────────────────────────────────────────────┤
                                RD-06 ──────────────────────────────────────────────┤
                                     RD-07 ─────────────────────────────────────────┘
```

RD-09 has two explicit milestones. Its bounded frontend/editor work can proceed in parallel after
RD-04 is stable. Its final build/debug integration and closeout require the platform, asset,
load-unit, optimizer, and final-location handoffs from RD-05 through RD-08. RD-10 begins only after
RD-05 through RD-09 are complete. The separate `blend65-c64u/RD-01` remains dependent on RD-10's
evidence handoff.

## Suggested Implementation Order

| Phase | Documents | Outcome |
|---|---|---|
| **0: Worktree bootstrap** | AR-005, AR-025 | Final v3 commit recorded; v4 branch/worktree created non-destructively; parked v3 checkout preserved |
| **A: Authority freeze** | RD-01 | One internally consistent Specification 4 and one qualified expert `2.0.0` baseline |
| **B: Foundation** | RD-02 | Prepared v4 worktree verified; deterministic monorepo, project model, diagnostics, and public compiler service established |
| **C: First vertical proof** | RD-03 | Small playable M1 through compiler, SpritePad asset, ACME, PRG, and VICE |
| **D: Complete unoptimized capability** | RD-04 → RD-05 → RD-06 → RD-07 | Complete language, C64 platform, native resident assets, and explicit disk delivery before optional optimization |
| **E: Optimization and tooling** | RD-08 and RD-09 | Expert-quality optimized output plus the production CLI/editor workflow; RD-09 may start after RD-04 but closes only after RD-05 through RD-08 |
| **F: Production qualification** | RD-10 | Bounded C64 production claim, targeted physical QA, deferral closure, and C64U handoff |

M1 is a development milestone, not a reduced production language or a game framework. Production
completion requires the entire active language and approved C64 surface.

## Key Architecture Decisions

| Decision | Choice | Authority |
|---|---|---|
| Compatibility | V4 has no v3 source, API, package, artifact, or test compatibility obligation | AR-025 |
| Language authority | One active Specification 4; no implementation-only semantic overrides | AR-014 |
| Expert authority | One active expert `2.0.0`, qualified and activated atomically with Specification 4 | AR-034 |
| Source/output standard | Modern-language ergonomics in; expert 6502 assembly out | AR-002, AR-003 |
| Function storage | SFA is the sole general function-execution storage model, not a whole-machine allocator | AR-007, AR-018 |
| Target structure | Explicit CPU, machine, serializer, packager, asset, optimizer, and tooling responsibilities without a public plugin framework | AR-012, AR-035 |
| Arrays and aggregates | Fixed arrays and structs have normal value semantics; no heap or dynamic arrays | AR-016, AR-017 |
| Assembly escape surface | Five curated `asm_*` controls only; no free-form inline or external assembly ABI | AR-006 |
| C64 production | Eight exact resident PRG profiles and one PAL/KERNAL/6581 D64 profile | AR-024, AR-029 |
| Assets | Exact built-in current-format handlers plus ordinary typed compile-time refinement | AR-019, AR-037, AR-040 |
| Product boundary | Compiler, language, platform operations, and asset conversion—not a game engine | AR-038 |
| Optimization | Correct `none` first; then one finite qualified frontier exhausted under three cost orderings | AR-023, AR-045, AR-046 |
| Developer tooling | Public compiler service, frontend-only LSP, thin trusted VS Code client, and portable debug evidence | AR-010, AR-021, AR-047 |
| Production hosts | Node 22 on Linux x64 and Windows x64; machine-local tools configuration followed only by normal process-`PATH` ACME/VICE discovery | AR-048 |
| Verification | Directed checks during work, complete relevant boundary at major checkpoints, targeted physical QA near release | AR-008, AR-011, AR-024, AR-026 |

## Final Requirements Validation

| Check | Result |
|---|---|
| Document inventory | 10 RDs, 438 Must requirements, 23 Should requirements, 75 explicit exclusions, and 358 acceptance criteria |
| Ambiguity gate | AR-001 through AR-048 are all `✅ Resolved`; no deferred or assumed executable decision remains |
| Dependencies | Every declared RD exists; dependency graph is acyclic; implementation order respects prerequisites |
| Cross-references | Every local Markdown link and every referenced AR identity resolves |
| Ownership | Language, SFA, CPU, machine, assets, layout, loading, optimizer, tooling, qualification, and C64U handoff each have one named owner |
| Scope consistency | No RD requires v3 compatibility, a runtime/heap, game engine, readiness product, public plugin framework, owned debugger, or premature C64U implementation |
| Security | Every RD covers local input validation, containment/injection, atomic failure, secrets, authorization applicability, resource bounds, and negative verification |
| Verification economy | Skill/docs work avoids compiler/emulator suites; implementation uses directed checks and one complete relevant boundary at each major checkpoint |
| Specification state | Existing `spec/` remains frozen until RD-01 performs the one authorized Specification 4 transition |
| Roadmap | All ten rows are at `RD Drafted`; implementation progress remains 0/10 until plans execute |

## Commonly Forgotten Requirements — Final Check

| Concern group | Disposition | Owner |
|---|---|---|
| Audit trail, export, observability | Immutable build generations plus versioned debug/asset/memory/cost/build/release evidence; no server audit service | RD-02, RD-03, RD-06 through RD-10 |
| API and artifact versioning | Specification, package, independent sidecar schema, profile, asset, debug, tool, and evidence identities are explicit | RD-01, RD-02, RD-06, RD-09, RD-10 |
| Errors, empty states, onboarding | Stable diagnostics, empty/new-project behavior, first-project docs, examples, and actionable remedies | RD-02 through RD-10 |
| Loading/progress/cancellation/offline use | Bounded local progress, publication as the build no-return point, and owned process-tree cancellation; builds require no network or automatic download | RD-02, RD-07, RD-09, RD-10 |
| Accessibility, localization, timezones | Textual diagnostics/evidence are keyboard accessible; target text encodings are explicit; host locale/time/path cannot change output | RD-01, RD-02, RD-05, RD-09, RD-10 |
| Backup, deletion, disaster recovery | Local source control remains the backup authority; immutable generations retain current, active pins, and one unpinned predecessor; no hosted data exists | RD-02, RD-09, RD-10 |
| Search, pagination, mobile, email, admin UI | N/A: Blend65 exposes no web/mobile application, list service, mailer, or administrator surface | Product boundary |
| Accounts, sessions, privacy, GDPR, retention | N/A: no accounts, authentication service, personal-data store, telemetry service, or remote API | Every RD security section |
| Configuration and feature selection | One contained `blend65.json`, one optional machine-local `tools.jsonc` schema version 1, closed profile/mode/safety values | RD-02, RD-08 through RD-10 |
| Input validation and injection | Closed schemas/allowlists, canonical contained paths, structured ACME/process arguments, no shell or executable project hooks | RD-02, RD-03, RD-06, RD-07, RD-09, RD-10 |
| Rate limiting and resource exhaustion | Remote rate limiting is N/A; local parser/evaluator/process/output/retry/concurrency budgets are bounded | RD-01, RD-02, RD-06 through RD-10 |
| Secrets, encryption, infrastructure | No secrets or sensitive network transport; least-privilege local/CI execution; no daemon, database, or public listener | Every RD security section |
| Security testing | Negative malformed-input, path, injection, stale-output, cancellation, tool, emulator, and binary-format cases are explicit | RD-02 through RD-10 |

## How to Use These Documents

1. Preflight the complete requirements set before implementation planning.
2. Perform the mandatory Phase 0 bootstrap and verify the parked and v4 worktree identities.
3. In the prepared v4 worktree, start with RD-01 and create its implementation plan.
4. Preflight that plan, then execute it using impact-based verification.
5. Update the roadmap at each lifecycle transition.
6. Do not begin semantic compiler implementation until RD-01 has frozen Specification 4 and the
   expert `2.0.0` baseline together.
7. Continue in dependency order. RD-09's bounded frontend/editor milestone may overlap after RD-04
   is stable; do not close RD-09 until RD-05 through RD-08 have supplied their required schemas and
   final evidence handoffs.
