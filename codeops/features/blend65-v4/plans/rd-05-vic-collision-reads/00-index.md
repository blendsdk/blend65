# VIC-II collision reads implementation plan

> **Feature**: Two named consuming collision-latch reads
> **Status**: Plan Preflighted — not yet implemented
> **Created**: 2026-10-01
> **Implements**: blend65-v4/RD-05
> **CodeOps Artifact Schema**: 1

## Minimum-Sufficient Baseline

**Original goal:** Complete the two hardware collision reads owned by RD-05 R5.27.
**Smallest viable design:** Extend existing profile declarations, machine facts and direct
volatile-read lowering. Use existing compilation, assembly and sequential VICE test patterns.
**Excluded machinery:** Collision engine, result cache, runtime wrapper, new IR/pass or harness.
**Approved complexity:** None. Scope and verification authority: AR-P1–AR-P4.

## Document Index

| Document | Purpose |
|---|---|
| [Ambiguity register](00-ambiguity-register.md) | Approved contract and exact test exception |
| [Requirements](01-requirements.md) | RD-owned scope delta |
| [Current state](02-current-state.md) | Reusable paths and gaps |
| [Component contract](03-collision-reads.md) | Integration and preservation obligations |
| [Testing strategy](07-testing-strategy.md) | Independent behavior and output expectations |
| [Execution plan](99-execution-plan.md) | One phase, ten ordered tasks |

## Readiness

The authoring gate is passed. Required documents exist and tests precede implementation.
Preflight passed after the approved PF-001 impact-list correction; see the
[report](00-preflight-report.md). This document is not evidence of execution.
RD-05 remains partially delivered. This slice does not close its other requirements.

## Knowledge lineage

Use the expert identity and hardware references in the ambiguity register. Runtime and assembled
cost evidence remain **Unknown** until execution. No hardware qualification is claimed.
