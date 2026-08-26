# Current State: RD-05 Failure Reduction

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

`@blend65/readiness` already owns immutable prepared campaigns, exact `ReplayEnvelopeV1`, typed
generated cases, invalid-neighbor metadata, canonical identities, published oracle authority,
opaque valid/diagnostic execution capabilities, and passive execution-publication contracts.
`@blend65/readiness-execution` owns route planning, the fixed six-handler catalog, compiler/CLI/
ACME/VICE adapters, bounded worker/process supervision, the canonical V1 authority report, secure
no-follow publication primitives, and campaign orchestration. (AR-P1)

No RD-05 production module exists. The report cannot reconstruct source or replay authority by
itself, reduced bytes cannot pass the current ordinal-bound constructors, raw malformed source has
no genuine ingress, and the selected execution child is content-bound to current handler bytes.
(AR-P3, AR-P5, AR-P9, AR-P13)

### Relevant Files

| File | Purpose | Changes Needed |
|---|---|---|
| `packages/readiness/src/execution-contracts.ts` | Closed RD-04 result/tier/stage vocabulary | Read only; RD-05 owns a separate disposition policy |
| `packages/readiness/src/replay-input-model.ts` | Typed campaign replay envelope | Compose into `FailureEnvelopeV1`; do not widen V1 |
| `packages/readiness/src/modeled-generator-model.ts` | Typed valid/invalid projections and metadata | Consume invariants without weakening the union |
| `packages/readiness/src/execution-case.ts` | Opaque valid execution authority | Reference pattern for new candidate authority |
| `packages/readiness/src/published-diagnostic-case.ts` | Ordinal-bound typed diagnostic authority | Reference pattern; add separate malformed authority |
| `packages/readiness/src/canonical-identity.ts` | Domain-separated canonical encoding/hashing | Add reviewed failure identity domains/helpers |
| `packages/readiness/src/index.ts` | Public readiness surface | Export only stable RD-05 contracts |
| `packages/readiness-execution/src/execution-route-adapters.ts` | Closed route request union and six handler implementations | Add authenticated candidate arm and shared validators |
| `packages/readiness-execution/src/execution-worker-executor.ts` | Reused bounded worker pool | Add/consume an explicit fresh single-job seam |
| `packages/readiness-execution/src/execution-orchestration.ts` | RD-04 campaign/report authority | Leave V1 behavior/bytes unchanged; reuse validators |
| `packages/readiness-execution/src/execution-publication-secure-filesystem.ts` | Pinned durable no-clobber filesystem operations | Generalize without weakening existing callers |
| `packages/readiness-execution/src/execution-handler-catalog.generated.ts` | Content-bound six-handler closure | Regenerate only after reviewed final code |
| `readiness/execution-publications/current-execution-publication.json` | Selected immutable execution child | Reselect after reviewed evidence and real rerun |

## Gaps Identified

### Gap 1: No failure-domain contract

**Current Behavior:** Result facts exist independently, with no shrink predicate, disposition,
promotion key, reduction policy, or historical failure envelope.
**Required Behavior:** Closed values and canonical identity for every RD-05 state.
**Fix Required:** Add focused readiness-owned contracts, parsers, canonical encodings, and collision
guards. (AR-P2)

### Gap 2: No authoritative transformed-case path

**Current Behavior:** Route requests accept genuine ordinal-derived valid or typed-invalid cases.
**Required Behavior:** Candidate bytes get a new identity while preserving the original route
contract.
**Fix Required:** Add opaque candidate/malformed authority and a dedicated published-handler request
arm. (AR-P3, AR-P5)

### Gap 3: No deterministic reducer or final isolation proof

**Current Behavior:** There is no transformation catalog, invariant revalidation, reduction state,
fresh confirmation, or sequence reproduction.
**Required Behavior:** One-minimal deterministic output or a closed bounded outcome.
**Fix Required:** Add a pure state machine in readiness and a fresh-worker coordinator in execution.
(AR-P4, AR-P7)

### Gap 4: No durable failure graph or active regression tier

**Current Behavior:** Execution publication is immutable, but failure artifacts and activation do
not exist.
**Required Behavior:** Secure content-addressed cores, append-only events, immutable activations,
and implementation-blind active tests.
**Fix Required:** Reuse generalized secure primitives and add fail-closed manifest discovery.
(AR-P6, AR-P8, AR-P14)

### Gap 5: Report-only history and selected-child invalidation

**Current Behavior:** V1 reports lack replay content; handler closures bind exact current bytes.
**Required Behavior:** Separate complete failure envelopes and a truthful final selected child.
**Fix Required:** Join genuine live authority without changing V1, then refresh the child only after
all code/review/evidence is final. (AR-P9, AR-P13)

## Dependencies

### Internal Dependencies

- RD-02 genuine campaigns, typed projections, replay registry, and canonical identity.
- RD-03 selected diagnostic/runtime oracle authority.
- RD-04 route plan, handlers, worker/process supervision, V1 report, and selected child publication.
- Node filesystem/process capabilities only through `@blend65/readiness-execution`.

### External Dependencies

- No new package dependency.
- Existing ACME 0.97 and VICE 3.10 local tools remain mandatory for final real acceptance.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Candidate path drifts from ordinary route semantics | Medium | Critical | Shared validators, cross-arm conformance, same published handlers (AR-P5) |
| Historical content becomes unavailable | Medium | Major | Immediate envelope materialization and explicit unavailable outcome (AR-P9) |
| Concurrent publication loses provenance | Low | Critical | Immutable core/event graph and no-clobber reconciliation (AR-P6) |
| Dynamic regression discovery silently skips data | Low | Critical | Fail-closed graph validation and zero/duplicate/missing tests (AR-P8) |
| Handler changes leave selected child stale | High | Critical | Mandatory final regeneration/review/real rerun/reselection (AR-P13) |
| Full reduction exceeds practical budgets | Medium | Major | Identity-bound selected limits and deterministic exhaustion (AR-P4) |
