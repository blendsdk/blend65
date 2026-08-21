# RD-04 Tiered Compiler, ACME and VICE Execution Implementation Plan

> **Feature**: Deterministic compiler-readiness execution through frontend, compiler, CLI, emit, ACME and VICE tiers
> **Status**: Planning Complete
> **Created**: 2026-08-21
> **Implements**: compiler-readiness/RD-04
> **CodeOps Artifact Schema**: 1

## Overview

RD-04 turns the selected RD-02/RD-03 generated cases and independent expectations into actual
compiler evidence. It plans every route before execution, runs the cheapest decisive tier for every
case, selects bounded representatives for expensive obligations, and records one closed result for
each rule/obligation. The initial runtime target is the C64 through ACME and real VICE.

The implementation preserves `@blend65/readiness` as a toolchain-independent authority core. A new
private `@blend65/readiness-execution` package composes that core with real frontend, compiler, CLI,
ACME and VICE adapters. Six content-derived route bindings are reviewed and selected in a separate
child execution publication keyed to the exact immutable nine-binding parent publication. (AR-P1,
AR-P2, AR-P5)

## Document Index

| # | Document | Description |
|---|---|---|
| AR | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate and delegated decisions |
| 00 | [Index](00-index.md) | Overview and navigation |
| 01 | [Requirements](01-requirements.md) | Thin RD-04 scope delta |
| 02 | [Current State](02-current-state.md) | Grounded implementation analysis |
| 03-01 | [Contracts and Routing](03-01-execution-contracts-routing.md) | Tiers, budgets, result state machine and selector |
| 03-02 | [Envelope, Identity and Observation](03-02-envelope-identity-observation.md) | Executable wrapper, fixture and layout proof |
| 03-03 | [Publication and Composite Authority](03-03-execution-publication.md) | Six bindings, atomic selection and parent projection |
| 03-04 | [Toolchain Adapters](03-04-toolchain-adapters.md) | Frontend/compiler/CLI/emit/ACME evidence routes |
| 03-05 | [Process and Filesystem Safety](03-05-process-filesystem-safety.md) | Workers, child processes, evidence caps and cleanup |
| 03-06 | [VICE Control and Lease](03-06-vice-control-lease.md) | Monitor substrate, positive identity and crash recovery |
| 03-07 | [Orchestration and Acceptance](03-07-orchestration-acceptance.md) | End-to-end execution, comparison, blockers and publication |
| 07 | [Testing Strategy](07-testing-strategy.md) | Immutable ST cases and verification tiers |
| 99 | [Execution Plan](99-execution-plan.md) | Seven phases and task checklist |

## Quick Reference

### Evidence flow

```text
selected parent publication + prepared campaign + selected oracle context
        ↓
deterministic ExecutionRoutePlanV1
        ↓
valid envelope / unchanged invalid source
        ↓
frontend → compiler API or CLI → emit → ACME → VICE
        ↓
actual observation ↔ host-side RD-03 expectation
        ↓
ExecutionResultV1 + retained blockers and bounded evidence
```

### Key Decisions

| Decision | Outcome |
|---|---|
| Authority boundary | Pure readiness core plus private toolchain composition package (AR-P2) |
| Diagnostic phase | Accepted-diagnostic sidecar; ordinary diagnostics/renderers unchanged (AR-P3) |
| Expensive selection | Digest-ranked stratified selector with fail-closed capacity (AR-P6) |
| Executable source | Separate envelope IR and compiler-allocated observation globals (AR-P7) |
| Runtime input | Real-VICE-gated `$D020..$D022` projection (AR-P8) |
| VICE ownership | Shared cancellable control subpath plus Linux positive-identity lease (AR-P4, AR-P11) |
| Route authority | Separate content-addressed child publication keyed to one parent digest (AR-P5) |

## Related Files

The principal implementation surfaces are `packages/readiness/src/execution-*.ts`, the new
`packages/readiness-execution/` workspace, additive compiler/CLI evidence seams,
`packages/test-harness/src/emulator/vice/` control modules, and
`readiness/execution-publications/`. Exact file ownership is defined in the component documents and
execution tasks.
