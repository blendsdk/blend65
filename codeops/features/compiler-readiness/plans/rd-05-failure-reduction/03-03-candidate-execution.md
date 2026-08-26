# Candidate Execution: RD-05 Failure Reduction

> **Document**: 03-03-candidate-execution.md
> **Parent**: [Index](00-index.md)

## Overview

`@blend65/readiness-execution` consumes only readiness-minted reduction-candidate authority. It
projects a new candidate execution identity into the original authenticated route contract, uses
the existing published compiler/ACME/VICE handler chain, and evaluates the unchanged failure
predicate. It never accepts unauthenticated source, invokes the compiler directly, mutates the
original case identity, or substitutes current authorities for historical content. (AR-P1, AR-P5)

## Proposed Modules

| Module | Responsibility |
|---|---|
| `failure-route-adapter.ts` | Validate candidate authority and derive the dedicated route request |
| `failure-confirmation.ts` | Two-run fresh-worker confirmation and bounded sequence reproduction |
| `execution-route-adapters.ts` | Add the closed reduction-candidate request arm to published routes |
| `execution-worker-executor.ts` | Construct a genuinely fresh executor and workspace for each confirmation |

The route adapter and worker executor already participate in generated execution-handler dependency
closures. Their changes therefore deliberately invalidate the selected handler child until the
publication refresh in the closeout phase. (AR-P13)

## Dedicated Candidate Route

```ts
export interface ReductionExecutionRouteRequestV1 {
  readonly kind: "reduction-candidate";
  readonly candidateAuthority: ReductionCandidateAuthorityV1;
}

export function createReductionExecutionRouteRequestV1(
  parent: ExecutionParentCapabilityV1,
  authority: ReductionCandidateAuthorityV1,
): ExecutionOperationResultV1<ReductionExecutionRouteRequestV1>;

export function executeReductionCandidateV1(
  executor: PublishedExecutionAuthorityV1,
  request: ReductionExecutionRouteRequestV1,
): Promise<ExecutionOperationResultV1<ReductionCandidateEvaluationV1>>;
```

The new arm is added to the existing closed route-request union. It preserves route kind, terminal
obligation and tier, policy, fixture, oracle semantics, tool identities, and ordered stage prefix.
It replaces only source-bound case/execution identities with the domain-separated candidate
execution identity. Original typed-case routes remain byte-compatible and keep their existing
validation behavior. (AR-P5)

The adapter validates the opaque candidate capability, historical envelope and route-contract
digest before exposing a passive projection. It rejects plain objects, replayed authorities,
caller-selected handlers, changed routes, changed limits, and direct compiler/worker callbacks.
Typed-valid, typed-invalid, and raw-malformed payloads use separate closed request variants; zero
source bytes are accepted only by the raw diagnostic variant. (AR-P3, AR-P5)

## Existing Published Handler Chain

Candidate requests enter the same execution entry point as generated cases. Capability routing
selects the published handler from the authenticated route kind and target, then runs the same
compiler, assembler, emulator, fixture, observation, comparison, and cleanup semantics required by
the original route. No candidate-only shortcut may bypass a terminal stage or oracle. (AR-P5)

The handler receives the candidate identity as the execution subject while retaining a reference
to the immutable original case identity for provenance only. Result normalization strips volatile
workspace, timing, process, and route-plan identities before predicate evaluation, without
rewriting exact source or stable diagnostic facts.

## Fresh Confirmation

```ts
export interface FailureConfirmationResultV1 {
  readonly revision: "failure-confirmation-result-v1";
  readonly disposition:
    | "confirmed-source-failure"
    | "stateful-sequence-failure"
    | "flaky-failure";
  readonly confirmationDigests: readonly Sha256Digest[];
  readonly sequenceEvidence?: StatefulSequenceEvidenceV1;
}

export function confirmReducedFailureV1(
  parent: ExecutionParentCapabilityV1,
  executorFactory: FreshExecutionWorkerFactoryV1,
  request: ReductionExecutionRouteRequestV1,
  origin: FailureEnvelopeV1,
): Promise<ExecutionOperationResultV1<FailureConfirmationResultV1>>;
```

Each of the two confirmation runs creates a new executor instance, fresh temporary root, fresh
process boundary, and reduced allowlisted environment. It cannot borrow campaign pools, worker
state, caches, leases, or mutable compiler processes. Both runs must reproduce byte-equal normalized
predicate observations. A same-route known-good control must pass before an infrastructure,
exhaustion, compiler-ICE, emission, assembler, or emulator-launch failure may become shrinkable.
(AR-P7)

When confirmation differs, the bounded sequence reproducer replays the authenticated originating
case order in fresh workers up to the selected case limit. A stable ordered sequence produces
`stateful-sequence-failure`; otherwise the result is `flaky-failure`. Neither result can mint
promotion authority. Exact-limit consumption succeeds and the next case returns closed exhaustion.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Plain or forged candidate object | Reject before route projection | AR-P5 |
| Original and candidate route contracts differ | `candidate-route-mismatch`; execute nothing | AR-P5 |
| Missing historical handler/tool authority | `historical-authority-unavailable`; no current fallback | AR-P9 |
| Empty typed source | Reject; only raw diagnostic request accepts it | AR-P3 |
| Candidate tries to choose a handler | Reject unknown/extra key before capability routing | AR-P5 |
| Fresh worker cannot be established | Campaign-only infrastructure result; never promotion | AR-P7 |
| Known-good control fails | Campaign-only infrastructure result | AR-P7 |
| Sequence budget exhausted | Retain bounded campaign evidence; never promotion | AR-P7 |

## Testing Requirements

- Cross-arm tests prove ordinary generated routes are unchanged while every candidate receives a
  distinct execution identity under the same route contract.
- Capability tests reject forged/replayed authority, direct compiler callbacks, altered route
  fields, extra keys, current-authority fallback, and raw bytes in typed request arms.
- Route tests exercise compiler, diagnostic, ACME, VICE, timeout/exhaustion, fixture, observation,
  comparison, and cleanup semantics through published handlers.
- Confirmation tests assert two different executor/workspace/process identities, no campaign-pool
  reuse, same-route known-good control, sequence classification, and flaky classification.
- Raw diagnostic tests cover empty input and exact-byte observation without typed IR.
