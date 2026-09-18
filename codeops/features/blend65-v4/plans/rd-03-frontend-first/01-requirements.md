# Requirements: RD-03 Frontend First

> **Parent**: [Index](00-index.md)
> **Source**: [RD-03](../../requirements/RD-03-playable-m1-complete-pipeline.md) — owning requirements document

## Scope of This Plan

| Parent coverage | In this partial plan |
|---|---|
| R3.5–R3.6 | Source tokenization and admitted syntax |
| R3.7 | Project module headers, merged declarations, reachable source graph and entry |
| R3.8–R3.10 | Asset-independent admitted semantic forms and proving diagnostics |
| R3.11 | Typed syntax facts consumed by current semantic checks; no machine representation |
| R3.13 | Direct-call recursion and initializer dependencies only; not helper/SFA graph closure |
| R3.17, R3.34–R3.35 | Frontend neutrality, impact-based tests and no speculative target machinery |

AR-P1–AR-P7 govern this decomposition. The precise admitted and unchecked surfaces
are owned by [Semantic analysis §Admitted slice](03-02-semantic-analysis.md#admitted-slice).
Source loading is already RD-02 work; this plan consumes it without reopening
host paths, races, manifest rules or native Windows acceptance.

## Outside This Plan

R3.1–R3.4, backend/control-flow lowering and SFA closure, qualified profile modules,
character maps, native/raw asset loading, placement, ACME, artifact publication,
VICE, editor integration, expert cost comparison and full RD closeout remain
outside AR-P1's approved partial scope. Their owning RDs and existing acceptance
criteria are unchanged; this is not a new deferral or a waiver.

## Plan-Local Acceptance

1. Every case in [Testing strategy](07-testing-strategy.md) passes using direct
   compiler services and real project snapshots for integration cases.
2. Only complete admitted analysis exposes a typed program. Unchecked forms,
   missing profile/asset obligations, poison and truncated checks cannot appear
   accepted. Independently proved errors survive incomplete results (AR-P4).
3. Existing foundation/CLI behavior and frontend/backend import restrictions pass.
4. No frozen authority, dependency, workspace, CLI/editor API, machine artifact,
   runtime or generalized support mechanism is added.
5. Record a partial closeout and remaining parent obligations. Do not mark any
   whole R3.8/R3.10/R3.13 or RD-03 acceptance checkbox complete on partial evidence.

No coverage percentage or wall-clock threshold is introduced. All ST cases and
their listed parameter rows are required. Host timing/memory are observations
only, under upstream AR-026 and AR-P7.
