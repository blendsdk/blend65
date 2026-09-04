# Blend65 Expert Skillset — Implementation Plan

> **Feature**: Production-depth, C64-first `blend65-domain-expert` baseline `1.0.0`
> **Status**: Planning Complete
> **Created**: 2026-09-04
> **Implements**: blend65-expert-skillset/RD-01
> **CodeOps Artifact Schema**: 1

## Overview

This plan replaces the current thin-but-valid `blend65-domain-expert` content with one frozen,
selectively loaded expertise baseline. The baseline must be capable of guiding the later Blend65
recovery audit without assuming that the current compiler architecture is correct. It is deep for
NMOS 6502/6510 and the C64, preserves Static Frame Allocation (SFA) as the proven general frame
model, and records only portability constraints—not claimed target competence—for C64 Ultimate,
C128, Commander X16, Atari 8-bit, and Atari 7800.

The implementation is deliberately vertical. Each knowledge concern gets its qualification oracle
first, demonstrates the current skill's failure or insufficiency, receives the smallest sufficient
reference content, and must then pass its focused cases. At execution start, the old skill tree is
pinned, its four references become read-only migration evidence, and its router is versioned and
quarantined; its statements are not authority for new knowledge. The replacement is activated only
after an isolated Candidate Pre-delete Gate, then the old references are removed in the same
coherent live-tree change. No compiler source,
language specification, test harness, service, registry, generator, downloader, or publication
layer is created or changed.

The current compiler, its tests, roadmaps, readiness machinery, scoreboards, and game-feasibility
snapshot are inputs to a later audit only. They may supply realistic qualification prompts, but
they cannot determine skill doctrine, qualification oracles, or the future compiler architecture.
The skill is also not a runtime dependency of the finished compiler. It must teach the development
agent how to translate C64 game techniques into deterministic compiler algorithms, target facts,
zero-cost APIs, local contracts, diagnostics, and proofs that remain in the codebase after the
skill is no longer needed for ordinary use.

## Document Index

| # | Document | Purpose |
|---|---|---|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Thirty-four resolved decisions and the passed Zero-Ambiguity Gate |
| 00 | [Index](00-index.md) | Scope, navigation, and execution shape |
| 01 | [Requirements](01-requirements.md) | Thin implementation delta over approved RD-01 |
| 02 | [Current State](02-current-state.md) | Grounded skill, compiler, toolchain, and risk baseline |
| 03-01 | [Router and Baseline Governance](03-01-router-and-baseline-governance.md) | Public skill contract, selective loading, migration, freeze, and errata |
| 03-02 | [Blend65 Compiler Knowledge](03-02-blend65-compiler-knowledge.md) | Spec crosswalk, architecture, SFA/ABI, IL, and optimization knowledge |
| 03-03 | [6502 CPU and Lowering Knowledge](03-03-cpu-and-lowering-knowledge.md) | NMOS 6502/6510 model, 65C02 delta, operation/technique casebook, and cost reasoning |
| 03-04 | [C64 Platform and Game Knowledge](03-04-c64-platform-and-game-knowledge.md) | Memory/runtime, hardware, game-technique realization, and zero-cost APIs |
| 03-05 | [Toolchain, Portability, and Recovery Knowledge](03-05-toolchain-portability-and-recovery.md) | ACME/artifacts, future-target constraints, parity, and recovery method |
| 03-06 | [Evidence and Source Governance](03-06-evidence-and-source-governance.md) | Source hierarchy, claim traceability, pinned manifest, and conflicts |
| 03-07 | [Qualification and Release](03-07-qualification-and-release.md) | Coverage matrix, adversarial evaluation, independent review, and freeze |
| 07 | [Testing Strategy](07-testing-strategy.md) | Immutable qualification cases and validation commands |
| 99 | [Execution Plan](99-execution-plan.md) | Seven phases and task-by-task execution order |

## Delivery Shape

```text
approved RD-01
    ↓
spec/project-derived oracles freeze; external-fact cases remain draft
    ↓  current skill insufficiencies/pre-passers are recorded
pinned primary evidence freezes external-fact oracles
    ↓
thirteen focused reference modules + content-focused evaluation
    ↓
integrated candidate router + independent review and corrections
    ↓
definitive blind full-suite evaluation of the isolated candidate
    ↓
isolated Candidate Pre-delete Gate
    ↓
atomic live router migration + deletion of four superseded references
    ↓
formal live gates bind the byte-identical candidate evidence
    ↓
immutable content commit
    ↓
qualification/release.md binds the v1.0.0 commit and freezes the baseline
```

## Non-Negotiable Invariants

| Invariant | Plan consequence |
|---|---|
| SFA is the sole general function-frame model | The final function-storage plan closes over parameters, returns, locals, temporaries, spills, and function/helper scratch. Platform layout/packaging separately owns globals, assets, banking, alignment, segments, loaders, and artifacts. |
| Modern source in, expert 6502 output out | Ergonomics and generated-code parity are graded separately and both must pass. |
| C64 first, multi-target from the seams | C64 receives production depth; other targets constrain separation only and are labelled unqualified. |
| Facts before architecture preference | Frozen spec and primary hardware/toolchain evidence govern; current implementation shapes are live audit inputs only. |
| Peepholes are residual | Legalization, instruction selection, resource binding, layout, branch repair, and target optimization remain explicit responsibilities. |
| One skill, selective references | `SKILL.md` stays a concise router; knowledge depth lives in exactly thirteen linked references. |
| Zero material qualification failures | No average score or percentage can hide one unsafe semantic or hardware misconception. |
| One active qualified baseline | Every substantive skill change increments the version by at least a patch, is requalified before atomic activation, and triggers only dependency-traced downstream review. Git preserves earlier versions. |
| Minimum sufficient mechanism | Markdown plus existing validators and repo commands; no bespoke framework or runtime. |
| Implementation independence | Existing compiler behavior and support artifacts never become skill authority; discrepancies are recorded for the later audit. |
| VICE-first development | VICE 3.10 is the automated runtime oracle; targeted real-hardware QA settles only physical/revision-sensitive claims and provisional results are labelled. |
| Knowledge becomes compiler behavior | Every game technique receives a deterministic compiler/API disposition plus independent behavior and assembly/cost proof; the shipped compiler never consults AI or skill prose. |

## Planned Runtime Artifact Tree

```text
.agents/skills/blend65-domain-expert/
├── SKILL.md
├── agents/openai.yaml
├── references/
│   ├── blend65-semantics.md
│   ├── compiler-architecture.md
│   ├── sfa-and-abi.md
│   ├── il-and-optimization.md
│   ├── mos-6502-family.md
│   ├── 6502-lowering-casebook.md
│   ├── c64-memory-and-runtime.md
│   ├── c64-hardware.md
│   ├── c64-game-engineering.md
│   ├── acme-and-artifacts.md
│   ├── target-portability.md
│   ├── evidence-parity-and-recovery.md
│   └── source-manifest.md
└── qualification/
    ├── coverage-matrix.md
    ├── cases/
    │   ├── routing-and-evidence.md
    │   ├── language-architecture-and-sfa.md
    │   ├── cpu-lowering-and-optimization.md
    │   ├── c64-platform-and-games.md
    │   └── parity-recovery-and-portability.md
    └── release.md
```

## Modification Boundary

The execution may modify only:

- `.agents/skills/blend65-domain-expert/**`;
- `codeops/features/blend65-expert-skillset/**`; and
- the portfolio roadmap only when CodeOps branch policy permits its lifecycle cascade.

The execution must not change `packages/`, `examples/`, `spec/`, `.github/`, dependencies, or
existing Blend65 feature roadmaps. The live compiler is evidence for cases, not an implementation
target in this feature.

## Completion Definition

The feature plan is implemented only when every RD-01 acceptance criterion has evidence, the
independent specification-consistency prerequisite has reconciled all material semantic conflicts,
all mandatory cases pass blind evaluation with no material open finding, all old rules have an
explicit migration disposition, and the old broad references are gone. The complete skill-specific
structural, source, path, freeze, and qualification checks must pass; the unrelated compiler suite
is not run for this Markdown-only feature. The content is then committed and
`qualification/release.md` binds that exact v1.0.0 commit as the single active frozen baseline.
