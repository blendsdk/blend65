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
| `execution-route-adapters.ts`, `execution-live-handlers.ts` | Route closed candidate payloads and consume private isolation/predicate capabilities |
| `execution-worker-executor.ts` | Construct isolated standalone and dedicated sequence-attempt workers |
| `execution-authority-report.ts`, `execution-orchestration.ts` | Bind ordered predicate sidecars to private report authority state |
| `execution-vice-build.ts`, `published-runtime-evaluation.ts` | Adapt candidate-relative runtime authority without forging `ExecutionCaseV1` |

The route adapter and worker executor already participate in generated execution-handler dependency
closures. Their changes therefore deliberately invalidate the selected handler child until the
publication refresh in the closeout phase. (AR-P13)

## Dedicated Candidate Route

```ts
export interface ReductionExecutionRouteRequestV1 {
  readonly kind: "reduction-candidate";
  readonly invocation: FailureExecutionInvocationV1;
  readonly isolation: ReductionExecutionIsolationV1;
}

export function createReductionExecutionRouteRequestV1(
  parent: PublishedSnapshot,
  invocation: FailureExecutionInvocationV1,
  isolation: ReductionExecutionIsolationV1,
): ExecutionOperationResultV1<ReductionExecutionRouteRequestV1>;

export function executeReductionCandidateV1(
  executor: ExecutionAuthorityContextV1,
  request: ReductionExecutionRouteRequestV1,
): Promise<ExecutionOperationResultV1<ReductionCandidateEvaluationV1>>;

export interface ReductionExecutionIsolationV1 {
  readonly [REDUCTION_EXECUTION_ISOLATION_V1]: true;
}
```

The execution package retains a closed private state behind that opaque capability:
`campaign-shared` is bound to one authenticated campaign executor and may be reused only for its
ordinary reduction evaluations; `standalone` owns one fresh executor/root/isolate and is consumed
by exactly one confirmation or control invocation; and `sequence-attempt` owns one dedicated
worker for positions 1–64 of exactly one attempt. Each mode has a distinct mint path and shutdown
rule. Cross-mode, cross-campaign, cross-attempt, used, or shut-down capabilities reject before
handler or worker activity.

The new arm is added to the existing closed route-request union. It preserves route kind, terminal
obligation and tier, policy, fixture, oracle semantics, tool identities, and ordered stage prefix.
It replaces only source-bound case/execution identities with the domain-separated candidate
execution identity. Original typed-case routes remain byte-compatible and keep their existing
validation behavior. (AR-P5)

The adapter validates the opaque candidate capability, fresh purpose-bound evaluation token,
historical envelope and route-contract digest before exposing a passive projection. It rejects
plain objects, replayed tokens, caller-selected handlers, changed routes, changed limits, and direct
compiler/worker callbacks.
Typed-valid, typed-invalid, and raw-malformed payloads use separate closed request variants; zero
source bytes are accepted only by the raw diagnostic variant. (AR-P3, AR-P5)

## Existing Published Handler Chain

Candidate requests enter the same execution entry point as generated cases. Capability routing
selects the published handler from the authenticated route kind and target, then runs the same
compiler, assembler, emulator, fixture, observation, comparison, and cleanup semantics required by
the original route. No candidate-only shortcut may bypass a terminal stage or oracle. (AR-P5)

The handler receives the candidate identity as the execution subject while retaining a reference
to the immutable original case identity for provenance only. Before it creates the ordinary
aggregate evidence digest, each frontend, diagnostic, and runtime arm creates a closed authenticated
`FailurePredicateEvidenceV1` sidecar containing only stable predicate ingredients. Ordinary and
candidate routes both mint this module-private capability without adding a field to
`ExecutionResultV1`. The orchestration join consumes an original-route sidecar immediately into the
historical envelope; each candidate evaluation returns its sidecar through the RD-05-only evaluation
record for predicate comparison and durable run evidence. Volatile workspace, timing, process,
route-plan, and candidate-specific evaluation identities never enter the sidecar. RD-04
result/report bytes remain unchanged; a historical result without a live sidecar is explicitly
unavailable rather than reverse-engineered from its aggregate digest.

When `authorizeExecutionAuthorityReportV1` snapshots a report, its module-private WeakMap state
also deep-freezes an ordered one-to-one sidecar collection bound to the exact route/result order and
report identity. A private RD-05 accessor validates that association during the later join. Missing,
reordered, copied, substituted, or pre-RD-05 report authority has no sidecar authority and returns
`historical-authority-unavailable`; no digest-keyed global cache or wire-format field is added.

```ts
export type FailurePredicateEvidenceV1 =
  | FrontendPredicateEvidenceV1
  | DiagnosticPredicateEvidenceV1
  | RuntimePredicateEvidenceV1;

export interface ReductionCandidateEvaluationV1 {
  readonly revision: "reduction-candidate-evaluation-v1";
  readonly evaluationTokenDigest: Sha256Digest;
  readonly result: ExecutionResultV1;
  readonly predicateEvidence: FailurePredicateEvidenceV1;
  readonly digest: Sha256Digest;
}
```

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
  parent: PublishedSnapshot,
  execution: ExecutionAuthorityContextV1,
  candidate: ReductionCandidateAuthorityV1,
  origin: FailureEnvelopeV1,
  campaignBudget: FailureCampaignBudgetAuthorityV1,
): Promise<ExecutionOperationResultV1<FailureConfirmationResultV1>>;
```

Each of the two confirmation runs creates a new executor instance, fresh temporary root, fresh
worker-thread/V8 isolate, and reduced allowlisted environment. The execution package mints a
module-private `ReductionExecutionIsolationV1` consumed by the fixed content-bound handler resolver;
callers cannot select an executor. This dedicated path bypasses the campaign pool and its eight-case
retirement rule. External ACME/VICE subprocesses and leases retain their existing per-route
isolation. Both runs must reproduce byte-equal normalized predicate observations. A same-route
known-good control must pass before an infrastructure,
exhaustion, compiler-ICE, emission, assembler, or emulator-launch failure may become shrinkable.
(AR-P7)

Candidate confirmations receive fresh candidate tokens; controls receive tokens bound to a distinct
genuine known-good authority. A sequence token binds either its exact preceding originating case or
the reduced candidate at the original failing position, plus the attempt and position. Every
attempt contains exactly one terminal reduced-candidate subject and therefore proves the minimized
candidate under the retained state rather than merely replaying the original failure. When
confirmation differs, each bounded sequence attempt creates one dedicated worker-thread/V8 isolate
and reuses it across that authenticated order so cross-case state can reproduce. Its lifetime is
the validated selected sequence limit, independent of `MAX_CASES_PER_WORKER`, through the exact
hard maximum of 64; case 65 is rejected before launch. Ordinary per-case workspace creation and
cleanup still occurs inside that worker. Independent sequence attempts and standalone
confirmations never share a worker thread, isolate, or temporary root. A stable ordered sequence
produces `stateful-sequence-failure`;
otherwise the result is `flaky-failure`. Neither result can mint promotion authority. Ordered case
identities, batch/worker identity, and the failing position are retained. Every invocation charges
the shared campaign budget; exact aggregate consumption succeeds and the next case returns closed
exhaustion before launch.

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
- Capability tests reject forged/replayed evaluation tokens, direct compiler callbacks, altered route
  fields, extra keys, current-authority fallback, and raw bytes in typed request arms.
- Route tests exercise compiler, diagnostic, ACME, VICE, timeout/exhaustion, fixture, observation,
  comparison, and cleanup semantics through published handlers.
- Confirmation tests assert two different standalone executor/workspace/worker-thread identities, no
  campaign-pool reuse, same-route known-good control, and fresh-token reuse of one candidate.
  Sequence tests assert one dedicated worker thread per complete attempt, per-case workspace
  cleanup, isolation between attempts, failures at positions 2–9, exactly one terminal reduced
  candidate at its original failing position, original/candidate and position-substitution
  rejection, exact 64-case lifetime, pre-launch rejection of case 65, sequence classification, and
  flaky classification. Isolation-capability tests reject every cross-mode, cross-campaign,
  cross-attempt, replayed, and post-shutdown use.
- Cross-arm conformance tests prove each handler supplies the stable predicate sidecar before
  aggregate hashing, report authority preserves exact ordered association, and copy/reorder/missing
  or pre-RD-05 sidecars fail closed. Candidate payload tests cover typed-valid, typed-invalid, raw,
  ACME, and VICE seams and prove transformed runtime expectations derive from the authenticated
  candidate model rather than original expected bytes.
- Raw diagnostic tests cover empty input and exact-byte observation without typed IR.
