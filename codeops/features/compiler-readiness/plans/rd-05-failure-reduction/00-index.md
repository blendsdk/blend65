# RD-05 Failure Reduction Implementation Plan

> **Feature**: Classify, minimize, confirm, persist, and promote compiler-readiness failures
> **Status**: Executing
> **Created**: 2026-08-26
> **Implements**: compiler-readiness/RD-05
> **CodeOps Artifact Schema**: 1

## Overview

This plan implements the failure-reduction layer between the completed typed campaign/execution
system and the later readiness gate. It preserves the exact historical route and oracle contract,
derives truthful candidate authority for every transformed source, and reduces only failures proven
to be source-dependent. The deterministic engine supports typed valid cases, complete typed-invalid
tuples, and separately authenticated raw malformed source. (AR-P1–AR-P5)

Confirmed failures publish as immutable campaign-independent cores with append-only discovery
events; every envelope, outcome, sequence, and summary also has an immutable content-addressed
record so replay survives restart. An inactive candidate becomes an active specification regression only through a fail-closed
activation-rooted manifest referencing an already-green commit. Final route changes refresh the selected
content-bound execution child instead of bypassing or leaving stale authority. (AR-P6–AR-P9,
AR-P13–AR-P14)

## Document Index

| # | Document | Description |
|---|---|---|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate and delegated decisions |
| 00 | [Index](00-index.md) | Overview and navigation |
| 01 | [Requirements](01-requirements.md) | RD-05 scope delta |
| 02 | [Current State](02-current-state.md) | Existing code, seams, and risks |
| 03-01 | [Contracts and History](03-01-contracts-and-history.md) | Disposition, identity, policy, and envelopes |
| 03-02 | [Reduction Engine](03-02-reduction-engine.md) | Malformed ingress, invariants, catalog, and reducer |
| 03-03 | [Candidate Execution](03-03-candidate-execution.md) | Candidate authority, routes, workers, and confirmation |
| 03-04 | [Evidence and Regressions](03-04-evidence-and-regressions.md) | Immutable storage, deduplication, and activation |
| 03-05 | [Orchestration and Closeout](03-05-orchestration-and-closeout.md) | RD-04 join, reduction flow, publication refresh, closeout |
| 07 | [Testing Strategy](07-testing-strategy.md) | Immutable ST cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Six phases and task checklist |

## Quick Reference

### Public flow

```ts
const reduced = await reduceReadinessFailuresV1({
  parent,
  execution,
  oracle,
  campaign,
  report,
  reductionPolicy,
});
```

The orchestrator validates the join, chooses and embeds policy once, materializes and publishes
complete envelopes, applies the closed disposition policy, charges one shared campaign budget,
drives deterministic reduction through published route handlers, confirms in isolated workers, and
passes authorized canonical run/core/event/summary records to the secure publisher. (AR-P4–AR-P9)

### Key Decisions

| Decision | Outcome |
|---|---|
| Package ownership | Domain in readiness; host execution/publication in readiness-execution (AR-P1) |
| RD-04 compatibility | Separate joined failure envelope; unchanged V1 report (AR-P9) |
| Candidate execution | New authenticated request arm through existing published handlers (AR-P5) |
| Persistence | Immutable envelope/run/summary/core/event/activation graph with execution-owned secure writes (AR-P6) |
| Regression activation | Activation-rooted fail-closed runner and two-checkpoint commit protocol (AR-P8, AR-P14) |
| Handler publication | Regenerate/check each participating phase; final review/real-rerun/reselect only at closeout (AR-P13) |

## Related Files

- `packages/readiness/src/failure-*.ts`
- `packages/readiness/src/reduction-*.ts`
- `packages/readiness-execution/src/failure-*.ts`
- `packages/readiness-execution/src/execution-route-adapters.ts`
- `packages/readiness-execution/src/execution-handler-catalog.generated.ts`
- `readiness/failures/`
