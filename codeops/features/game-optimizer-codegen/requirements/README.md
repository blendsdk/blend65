# Commercial-Game Optimizer and Code Generator — Requirements

> **Project**: Blend65 — commercial-game-class optimizer and 6502 code generator
> **Status**: Complete
> **Created**: 2026-07-24
> **Architecture**: whole-program TypeScript optimizer, derived SSA/effect analysis, costed NMOS
> 6502 selection, verified superoptimization, ACME/VICE validation
> **CodeOps Artifact Schema**: 1

## Overview

Blend65 is intended to produce commercial-game-class C64 programs from modern source. Correct
output is only the floor: generated code must meet an expert 6502 programmer routine by routine
and beat realistic hand-written whole-program results through exhaustive consistency,
whole-program analysis, global allocation, placement and search.

This feature owns the optimizer and final code-generation quality contract. It consumes language
semantics and generated cases from `compiler-readiness`, implementation seams from `blend65-ri`,
and expert twins/cost measurements from `asm-parity`. Those authorities stay independent:
unoptimized compiler output cannot define correctness, and hand-written assembly cannot replace
the language specification.

The first acceptance target is the C64/NMOS 6502. Workloads model faithful commercial games in
the class of Commando, The Last Ninja and fast Super Mario Bros-style scrolling. An optimizer
cannot supply disk streaming, overlays, sound, missing language expressiveness or platform
libraries; these remain explicit portfolio dependencies rather than hidden optimizer promises.

## Domain Lenses

| Lens | Evidence |
|---|---|
| Compiler and language | IR equivalence, effects, passes, allocation, selection and target behavior |
| Data and migration | Versioned pass manifests, profiles, evidence, replay and invalidation |
| Distributed and concurrent | Parallel compiler/ACME/VICE campaigns and deterministic aggregation |

## Domain Glossary

| Term | Definition |
|---|---|
| Canonical IL | Existing mutable TAC `ILProgram` consumed and produced at optimizer boundaries |
| Optimization overlay | Derived SSA value graph, memory/effect graph, dominators and loop forest |
| Legalizer | Required transform that makes output representable; never skipped as an optimization |
| Optimization pass | Skippable semantics-preserving transform intended to improve a cost objective |
| Execution profile | Content-addressed reference, isolated, prefix or full pipeline configuration |
| Cost vector | Bytes, path cycles, ZP, RAM/frame, stack, padding, helper and frame/IRQ costs |
| Pareto regression | Output worse in at least one cost dimension without an authorized measured win |
| Assured pass | Pass whose semantic, interaction, replay and cost gates all pass |
| Game-shaped fixture | Original workload modeling behavior found in a commercial game engine |
| Commercial gate | Semantic assurance plus expert parity and whole-program workload acceptance |

## Document Index

| Document | Description | Depends on |
|---|---|---|
| [Ambiguity Register](00-ambiguity-register.md) | Authorized product and design decisions | — |
| [RD-01](RD-01-authority-cost-model.md) | Authorities, exact cost vector and commercial acceptance | — |
| [RD-02](RD-02-effects-optimization-overlay.md) | Effects, aliasing and derived SSA/value-memory overlay | RD-01 |
| [RD-03](RD-03-pass-manager-profiles.md) | Pass manifest, profiles, tracing, bisection and lifecycle | RD-01, RD-02 |
| [RD-04](RD-04-whole-program-analysis.md) | Call graph, specialization, inlining and internal ABI | RD-02, RD-03 |
| [RD-05](RD-05-scalar-dataflow.md) | SCCP, propagation, folding, CSE, DCE and algebraic transforms | RD-02–RD-04 |
| [RD-06](RD-06-control-flow-loops.md) | CFG cleanup, loop analysis and bounded loop transforms | RD-02–RD-05 |
| [RD-07](RD-07-memory-data-placement.md) | Alias-driven memory optimization and data placement | RD-02–RD-06 |
| [RD-08](RD-08-allocation.md) | A/X/Y, zero-page, static-frame and spill allocation | RD-02–RD-07 |
| [RD-09](RD-09-instruction-selection.md) | Costed 6502 instruction/addressing-mode selection | RD-01–RD-08 |
| [RD-10](RD-10-superoptimizer-peephole.md) | Verified bounded superoptimizer and rule catalog | RD-03, RD-09 |
| [RD-11](RD-11-scheduling-layout-link.md) | Scheduling, block/routine layout, relaxation and runtime pruning | RD-03–RD-10 |
| [RD-12](RD-12-profile-guided-optimization.md) | Deterministic VICE-backed profile-guided optimization | RD-03–RD-11 |
| [RD-13](RD-13-hardware-timing.md) | MMIO, interrupts, raster timing and hardware-aware generation | RD-02–RD-12 |
| [RD-14](RD-14-translation-validation.md) | Pass equivalence, independent oracles, target execution and reduction | RD-03–RD-13 |
| [RD-15](RD-15-game-corpus-commercial-gate.md) | Game-shaped corpus, expert twins and commercial gate | RD-01, RD-09–RD-14 |
| [RD-16](RD-16-reports-developer-control.md) | Optimization reports, budgets, profiles and developer diagnostics | RD-03, RD-15 |
| [RD-17](RD-17-toolchain-capability-integration.md) | External capabilities required for complete commercial games | RD-01, RD-15 |
| [RD-18](RD-18-non-functional-evolution.md) | Determinism, scale, security, evolution and release operation | RD-01–RD-17 |

## Dependency Graph

```text
RD-01 Authority + Cost
  └─ RD-02 Effects + Optimization Overlay
      └─ RD-03 Pass Manager + Profiles
          ├─ RD-04 Whole-Program Analysis
          │   └─ RD-05 Scalar/Dataflow
          │       └─ RD-06 CFG/Loops
          │           └─ RD-07 Memory/Placement
          │               └─ RD-08 Allocation
          │                   └─ RD-09 Instruction Selection
          │                       └─ RD-10 Superoptimizer/Peephole
          │                           └─ RD-11 Scheduling/Layout/Link
          │                               └─ RD-12 PGO
          │                                   └─ RD-13 Hardware/Timing
          └───────────────────────────────────────┴─ RD-14 Validation
                                                       └─ RD-15 Game Gate
                                                           ├─ RD-16 Reports
                                                           ├─ RD-17 Integrations
                                                           └─ RD-18 Non-functional
```

## Suggested Implementation Order

| Phase | Documents | Outcome |
|---|---|---|
| A: Authority | RD-01–RD-03 | Measurable costs, semantic model and attributable pipeline |
| B: Global optimizer | RD-04–RD-08 | Whole-program analysis, transforms, placement and allocation |
| C: Expert backend | RD-09–RD-11 | Costed selection, verified local optimum and linked layout |
| D: Game specialization | RD-12–RD-13 | Workload feedback and hardware/timing correctness |
| E: Proof and acceptance | RD-14–RD-16 | Independent correctness, commercial corpus and diagnostics |
| F: Product integration | RD-17–RD-18 | Explicit dependencies, deterministic evolution and release |

## Governing Acceptance Rules

| Rule | Requirement |
|---|---|
| Semantic floor | Every enabled transform preserves all specified observable behavior |
| Local parity | No routine is worse than its expert-equivalent implementation without a filed defect |
| Whole-program win | Default optimized game-shaped programs beat realistic expert results on the active objective |
| No hidden trade | A bytes/cycles/RAM regression is explicit, budgeted and measured |
| Modern source | Users express game intent; compiler/platform libraries own hardware lore |
| Honest capability | Missing streaming, overlay, sound, math or expressiveness remains separately visible |
| Exact provenance | Every result names case, compiler, pass manifest, profile, target and tool revisions |
| Target honesty | Shared mechanisms are target-driven; each target earns its own commercial claim |

## External Commercial-Game Capability Dependencies

| Capability | Current ownership / required follow-on |
|---|---|
| Language correctness and computed-memory expressiveness | `blend65-conformance` |
| Semantic generation, replay and target execution | `compiler-readiness` |
| Hand twins, byte/cycle ratios and parity debt | `asm-parity` |
| Indirect calls and platform ABI | Conformance/compiler follow-on |
| VIC/CIA/SID, IRQ, raster, sprite and input APIs | Platform-library follow-on |
| Asset conversion, compression, packing and placement | Asset-pipeline follow-on |
| Fixed-point and lookup-table math | Math-library follow-on |
| SID/tracker playback and interrupt-safe scheduling | Sound-library follow-on |
| Disk I/O, fast loaders and streamed data | Storage/streaming follow-on |
| Code/data overlays and relocation | Linker/overlay follow-on |
| Source debugging, profiling and cycle traces | Tooling follow-on |
| PRG/D64/CRT packaging and real-hardware proof | Release-tooling follow-on |

## Comparable-System Lessons

| System | Adopted principle |
|---|---|
| Alive2 | Validate before/after transformations independently and retain counterexamples |
| LLVM OptBisect | Identify skippable transforms and the first failing pass invocation |
| Csmith | Generate only defined programs for semantic differential testing |
| YARPGen | Compare identical computations across optimization configurations |
| Compiler reducers | Minimize the program and the transformation sequence |

## Final Requirements Check

| Concern | Disposition |
|---|---|
| Input/path validation | RD-03, RD-12, RD-14 and RD-18 use closed allowlists and canonical roots |
| Command injection | RD-14/RD-18 require argument arrays and prohibit generated shell authority |
| Authentication/rate limiting | N/A — local compiler/toolchain, no service |
| Secrets/PII/encryption | N/A — artifacts contain generated programs and measurements only |
| Concurrency/recovery | RD-12, RD-14 and RD-18 define bounded workers, cancellation and atomic evidence |
| Audit trail | RD-03/RD-18 content-address all passes, profiles and publications |
| Export/reporting | RD-16 requires stable JSON and human-readable reports |
| Backup/migration | RD-18 requires exact replay, deterministic migration or explicit invalidation |
| Accessibility/mobile/i18n | N/A — compiler/library/CLI; machine output remains stable and documented |
