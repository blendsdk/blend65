# RD-03 Frontend-First Implementation Plan

> **Feature**: Asset-independent source, syntax and semantic services for the M1 slice
> **Status**: Plan Preflighted — partial RD-03; ready for frontend execution
> **Created**: 2026-09-18
> **Implements**: blend65-v4/RD-03
> **Coverage**: Partial; this plan cannot close RD-03
> **CodeOps Artifact Schema**: 1

## Overview

Build the real target-neutral frontend over the existing project snapshot, before
the SpritePad handoff. The approved boundary is [AR-P1 and AR-P5](00-ambiguity-register.md).
The parent [RD-03](../../requirements/RD-03-playable-m1-complete-pipeline.md)
still owns the complete playable pipeline. Completing this plan delivers internal
frontend services, not a runnable program or a finished `blendc check` command.

## Minimum-Sufficient Baseline

**Original goal:** Plan source reading, parsing and semantic analysis first.
**Smallest viable design:** Focused modules inside the existing compiler, immutable
RD-02 inputs, one Pratt parser, a typed syntax tree and direct analysis functions.
**Excluded machinery:** Extra workspace, pass registry, generic IR, new harness,
profile/asset framework and infrastructure.
**Approved complexity:** None beyond ordinary frontend feature code; AR-P2.

## Document Index

| Document | Owner |
|---|---|
| [Ambiguity register](00-ambiguity-register.md) | Decisions and gate |
| [Requirements](01-requirements.md) | Partial coverage and acceptance |
| [Current state](02-current-state.md) | Inspected repository facts |
| [Source and syntax](03-01-source-and-syntax.md) | Lexer, parser, recovery and syntax contracts |
| [Semantic analysis](03-02-semantic-analysis.md) | Modules, types, effects and completion contracts |
| [Testing strategy](07-testing-strategy.md) | Independent expected results |
| [Execution plan](99-execution-plan.md) | Only mutable task-progress authority |

## Quick Reference

The [corrective preflight](00-preflight-report.md) passed on 2026-09-18.
All three findings are resolved; no implementation task is completed yet.

Use the existing loader, then internal `analyzeProject(snapshot)` from
`packages/compiler/src/frontend/service.ts`. The result contract is owned by
[Semantic analysis §Service boundary](03-02-semantic-analysis.md#service-boundary).
No compiler-root export or CLI change is part of this plan (AR-P4).

Expert lineage and evidence limits remain in the register. No assembly, memory
allocation, runtime or expert-parity result is claimed by these plan documents.

## Related Files

New feature files live in `packages/compiler/src/frontend/`, with colocated
specification and implementation tests. Existing source record/position services
and import-boundary checks are reused, not rewritten. See component ownership
below rather than pre-creating empty future files.
