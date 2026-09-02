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
| `failure-confirmation-context.ts` | Join one complete report occurrence to candidate, route, tool, control, order and budget authority |
| `execution-route-adapters.ts`, `execution-live-handlers.ts` | Route closed candidate payloads and consume private isolation/predicate capabilities |
| `execution-worker-executor.ts` | Construct isolated standalone and dedicated sequence-attempt workers |
| `execution-authority-report.ts`, `execution-orchestration.ts` | Bind ordered predicate sidecars to private report authority state |
| `execution-vice-build.ts`, `published-runtime-evaluation.ts` | Adapt candidate-relative runtime authority without forging `ExecutionCaseV1` |

The route adapter and worker executor already participate in generated execution-handler dependency
closures. Their changes therefore deliberately invalidate the selected handler child until the
publication refresh in the closeout phase. (AR-P13)

## Dedicated Candidate Route

### Package-private execution protocol

The immutable co-located specification and the production coordinator share one declared
package-private protocol at `failure-execution-internals.ts`. It is deliberately absent from the
package manifest and root barrel. The protocol opens only from a subject-bound opaque confirmation
context minted from a complete, normally authorized report and its exact private provenance. It
never accepts loose requests, route identifiers, handlers, callbacks, worker factories, paths or
isolation-mode discriminators. (AR-P36)

Envelope authorization uses the same private report-position boundary. A package-private bridge
accepts only a genuine non-pass position plus the selected reduction policy, derives the complete
source, route-plan, predicate, observation and tool provenance internally, and returns only the
existing opaque envelope authority. Report-wide route-plan bytes and tool identities are retained
once in private report provenance; no caller can retrieve canonical observation bytes or recombine
loose authorization fields. Forged, copied, foreign or pass positions and incomplete provenance fail
closed. (AR-P42)

```ts
export interface FailureExecutionProtocolV1 {
  readonly [FAILURE_EXECUTION_PROTOCOL_V1]: true;
}

export interface ExecutionReportPositionAuthorityV1 {
  readonly [EXECUTION_REPORT_POSITION_AUTHORITY_V1]: true;
}

export interface FailureConfirmationContextAuthorityV1 {
  readonly [FAILURE_CONFIRMATION_CONTEXT_AUTHORITY_V1]: true;
}

export interface ReductionExecutionIsolationV1 {
  readonly [REDUCTION_EXECUTION_ISOLATION_V1]: true;
}

export interface FailureExecutionControlAuthorityV1 {
  readonly [FAILURE_EXECUTION_CONTROL_AUTHORITY_V1]: true;
}

export interface StatefulSequenceAttemptAuthorityV1 {
  readonly [STATEFUL_SEQUENCE_ATTEMPT_AUTHORITY_V1]: true;
}

export interface StatefulSequencePositionAuthorityV1 {
  readonly [STATEFUL_SEQUENCE_POSITION_AUTHORITY_V1]: true;
}

export interface FailureConfirmationSessionV1 {
  readonly [FAILURE_CONFIRMATION_SESSION_V1]: true;
}

export interface FailureConfirmationStepAuthorityV1 {
  readonly [FAILURE_CONFIRMATION_STEP_AUTHORITY_V1]: true;
}

export interface FailureExecutionStepEvaluationV1 {
  readonly [FAILURE_EXECUTION_STEP_EVALUATION_V1]: true;
}

export interface FailureExecutionObservationV1 {
  readonly revision: "failure-execution-observation-v1";
  readonly mode: "campaign-shared" | "standalone" | "sequence-attempt";
  readonly admitted: boolean;
  readonly launched: boolean;
  readonly attemptOrdinal: number;
  readonly position: number;
  readonly reportPosition: number;
  readonly rootIdentity?: Sha256Digest;
  readonly workerIdentity?: number;
  readonly isolateIdentity?: Sha256Digest;
  readonly checkpointDigest: Sha256Digest;
}

export interface FailureObservationEvidenceProjectionV1 {
  readonly revision: "failure-observation-evidence-projection-v1";
  readonly kind: "observed" | "not-reached";
  readonly digest: Sha256Digest;
  readonly byteLength: number;
}

export function getExecutionAuthorityReportPositionsV1(
  report: ExecutionAuthorityReportV1,
): ExecutionOperationResultV1<readonly ExecutionReportPositionAuthorityV1[]>;

export function getExecutionReportPositionRequestV1(
  position: ExecutionReportPositionAuthorityV1,
): ExecutionOperationResultV1<ExecutionRouteRequestV1>;

export function authorizeFailureEnvelopeFromReportPositionV1(
  position: ExecutionReportPositionAuthorityV1,
  policy: FailureReductionPolicyV1,
): ExecutionOperationResultV1<AuthorizedFailureEnvelopeV1>;

export function createFailureConfirmationContextV1(input: {
  readonly report: ExecutionAuthorityReportV1;
  readonly subject: ExecutionReportPositionAuthorityV1;
  readonly control?: ExecutionReportPositionAuthorityV1;
  readonly candidate: ReductionCandidateAuthorityV1;
  readonly origin: AuthorizedFailureEnvelopeV1;
  readonly budget: FailureCampaignBudgetAuthorityV1;
}): ExecutionOperationResultV1<FailureConfirmationContextAuthorityV1>;

export function openFailureExecutionProtocolV1(
  context: FailureConfirmationContextAuthorityV1,
): ExecutionOperationResultV1<FailureExecutionProtocolV1>;

export function mintCampaignFailureExecutionIsolationV1(
  protocol: FailureExecutionProtocolV1,
): ExecutionOperationResultV1<ReductionExecutionIsolationV1>;

export function mintStandaloneFailureExecutionIsolationV1(
  protocol: FailureExecutionProtocolV1,
  subject: ReductionCandidateInvocationV1 | FailureExecutionControlAuthorityV1,
): ExecutionOperationResultV1<ReductionExecutionIsolationV1>;

export function createFailureExecutionControlV1(
  protocol: FailureExecutionProtocolV1,
  request: ExecutionRouteRequestV1,
): ExecutionOperationResultV1<FailureExecutionControlAuthorityV1>;

export function beginStatefulSequenceAttemptV1(
  protocol: FailureExecutionProtocolV1,
  input: {
    readonly attemptOrdinal: number;
    readonly precedingOriginals: readonly ExecutionRouteRequestV1[];
    readonly terminalCandidate: ReductionCandidateInvocationV1;
    readonly failingPosition: number;
    readonly caseLimit: number;
  },
): ExecutionOperationResultV1<StatefulSequenceAttemptAuthorityV1>;

export function nextStatefulSequencePositionV1(
  protocol: FailureExecutionProtocolV1,
  attempt: StatefulSequenceAttemptAuthorityV1,
): ExecutionOperationResultV1<
  | { readonly kind: "execute"; readonly position: StatefulSequencePositionAuthorityV1 }
  | { readonly kind: "complete" }
>;

export function recordStatefulSequencePositionV1(
  protocol: FailureExecutionProtocolV1,
  attempt: StatefulSequenceAttemptAuthorityV1,
  position: StatefulSequencePositionAuthorityV1,
  evaluation: FailureExecutionStepEvaluationV1,
): ExecutionOperationResultV1<true>;

export function createFailureConfirmationSessionV1(
  protocol: FailureExecutionProtocolV1,
  candidate: ReductionCandidateAuthorityV1,
  origin: AuthorizedFailureEnvelopeV1,
  campaignBudget: FailureCampaignBudgetAuthorityV1,
): ExecutionOperationResultV1<FailureConfirmationSessionV1>;

export function nextFailureConfirmationStepV1(
  protocol: FailureExecutionProtocolV1,
  session: FailureConfirmationSessionV1,
): ExecutionOperationResultV1<
  | {
      readonly kind: "execute-candidate" | "execute-control";
      readonly authority: FailureConfirmationStepAuthorityV1;
    }
  | {
      readonly kind: "execute-sequence-position";
      readonly authority: FailureConfirmationStepAuthorityV1;
      readonly attempt: StatefulSequenceAttemptAuthorityV1;
      readonly position: StatefulSequencePositionAuthorityV1;
    }
  | { readonly kind: "complete"; readonly result: FailureConfirmationResultV1 }
>;

export function executeFailureConfirmationStepV1(
  protocol: FailureExecutionProtocolV1,
  session: FailureConfirmationSessionV1,
  authority: FailureConfirmationStepAuthorityV1,
): Promise<ExecutionOperationResultV1<FailureExecutionStepEvaluationV1>>;

export function recordFailureConfirmationStepV1(
  protocol: FailureExecutionProtocolV1,
  session: FailureConfirmationSessionV1,
  authority: FailureConfirmationStepAuthorityV1,
  evaluation: FailureExecutionStepEvaluationV1,
): ExecutionOperationResultV1<true>;

export function getFailureExecutionObservationV1(
  protocol: FailureExecutionProtocolV1,
  subject:
    | ReductionExecutionIsolationV1
    | StatefulSequenceAttemptAuthorityV1
    | StatefulSequencePositionAuthorityV1,
): ExecutionOperationResultV1<FailureExecutionObservationV1>;

export function getExecutionAuthorityReportPredicateSidecarsV1(
  report: ExecutionAuthorityReportV1,
): ExecutionOperationResultV1<readonly FailurePredicateEvidenceV1[]>;

export function shutdownFailureExecutionIsolationV1(
  protocol: FailureExecutionProtocolV1,
  isolation: ReductionExecutionIsolationV1,
): Promise<ExecutionOperationResultV1<true>>;

export function closeFailureExecutionProtocolV1(
  protocol: FailureExecutionProtocolV1,
): Promise<ExecutionOperationResultV1<true>>;
```

The context constructor validates one complete cross-domain join before any execution authority is
minted. The subject is an exact report occurrence rather than a digest or first registry match. Its
candidate must belong to the exact historical envelope and parent; its complete predicate, route
contract, route-plan identity, handler revision and tool contracts must match the retained report
provenance. Ordered preceding occurrences come from that same report. A control is selected only for
the existing `fresh-confirm` disposition classes and must be a distinct genuine passing execution
occurrence under the same complete semantic route configuration: route kind, tier, obligation,
prerequisites, policy, fixture, oracle, tools and diagnostic semantics. It may come from a separately
authenticated report under the same parent, route plan and exact tool versions when the subject report
intentionally injects the failure and therefore cannot contain an exact-fixture pass. Only
source/campaign and report-occurrence identities are excluded from semantic matching. The complete
authenticated required-rule subset is retained and must contain the primary rule. Missing exact
history, tools, claims, order or control returns `historical-authority-unavailable`; current authority
is never substituted. (AR-P36, AR-P76, AR-P79)

The sequence state machine, rather than a caller-selected position, issues the only next legal
subject. Position capabilities are context-, attempt-, position- and subject-bound and single-use.
The selected `sequenceCases` budget is the exact lifetime, capped at 64; an over-limit attempt or
next position charges nothing and rejects before any root, worker or isolate checkpoint exists.
Every admitted position charges one `sequence-case` and one route execution before launch. Each
position retains only checkpoints recorded by its own opaque evaluation; it never inherits the
shared isolation's preceding activity. Root identities are path-free digests, worker identities are
Node worker-thread identities, and isolate identities are domain-separated from the worker launch.

The confirmation state machine is the sole binder between authenticated standalone, control and
sequence observations and the final disposition. It issues one opaque step at a time, accepts only
the exact opaque evaluation returned by its fixed published-handler executor, charges the shared
budget before admission,
and exposes the result only from its terminal arm. `confirmReducedFailureV1` drives this same
protocol to completion internally; the co-located immutable specification may drive it explicitly
to exercise substitution, ordering, limit and classification boundaries without a handler callback
or fabricated result. A copied, foreign, repeated or out-of-order step rejects before advancing the
session.

### Immutable confirmation fixtures

The co-located specification owns fixed external-boundary fixtures in
`test-fixtures/failure-execution-spec-fixture.ts` plus dedicated worker-thread and subprocess entry
files. The fixture may replace only the worker-executor and process-runtime adapter modules before
the genuine execution catalog is loaded in a fresh Vitest module graph. It must not replace the
live handlers, publication catalog, route adapters, protocol, confirmation logic or authority
constructors. The resolved review context and fixed published handler chain therefore remain
genuine while the true external worker/process behavior is controlled.

The exact Vitest substitutions are closed: `./execution-worker-executor.js` retains every actual
export but replaces `defaultExecutionWorkerExecutorV1`, `createExecutionWorkerExecutorV1()` and the
new package-private `createDedicatedExecutionWorkerExecutorV1(caseLimit)` with fixed fixture
executors implementing `start(request, cancellation)` and `shutdown()`; `./execution-process.js`
retains every actual export but replaces `defaultExecutionProcessRuntimeV1` and
`createExecutionProcessRuntimeV1(...)` with the fixed fixture runtime implementing
`start(request, sink, cancellation)`. The fixture installs both through `vi.doMock` before importing
the execution catalog/protocol and restores modules/environment during `cleanup`. No other module
specifier or export may be substituted.

```ts
export type FailureExecutionSpecScenarioV1 =
  | "standalone-stable"
  | "sequence-only"
  | "flaky"
  | "infrastructure-with-passing-control";

export function createFailureExecutionSpecFixtureV1(
  scenario: FailureExecutionSpecScenarioV1,
  options?: { readonly failingPosition?: number; readonly sequenceLength?: number },
): Promise<{
  readonly report: ExecutionAuthorityReportV1;
  readonly reportPositions: readonly ExecutionReportPositionAuthorityV1[];
  readonly subjectPosition: ExecutionReportPositionAuthorityV1;
  readonly confirmationControlPosition?: ExecutionReportPositionAuthorityV1;
  readonly origin: AuthorizedFailureEnvelopeV1;
  readonly candidate: ReductionCandidateAuthorityV1;
  readonly budget: FailureCampaignBudgetAuthorityV1;
  readonly expectedDisposition: FailureConfirmationResultV1["disposition"];
  readonly expectedFailingPosition?: number;
  readonly activity: {
    readonly workerThreads: readonly number[];
    readonly isolateIdentities: readonly Sha256Digest[];
    readonly rootIdentities: readonly Sha256Digest[];
    readonly processLaunches: number;
  };
  readonly cleanup: () => Promise<void>;
}>;
```

The four scenarios are fixed contracts, not callbacks. `standalone-stable` returns the same
predicate failure from two independent workers; `sequence-only` retains state only inside one
attempt worker and fails at the requested position after authenticated preceding originals;
`flaky` deterministically disagrees across fresh/sequence runs; and
`infrastructure-with-passing-control` returns the same infrastructure-like candidate failure twice
while the distinct same-route control passes. The fixture records actual worker-thread, isolate,
root and subprocess checkpoints. Unsupported scenario names and out-of-range positions reject
before loading production modules. No fixture API or asset is emitted from a production barrel or
package export.

`sequence-only` uses the fixed all-typed-valid 56-case, one-spelling memory campaign from AR-P59.
Its authentic 68-position route plan supplies a distinct later passing same-route control for every
required selected position: 2→3 through 9→10, plus 64→65. The historical subject is a
`compiler-ice`; both standalone candidate attempts pass so the state machine discovers the original
position, then only the terminal reduced candidate reproduces the failure inside the dedicated ordered
attempt. Direct-shrink typed-invalid candidates use the same two fresh standalone confirmations but do not
require a known-good control.

The VICE isolation case from AR-P60 is a locally gated true-external facet. Observing wrappers delegate
to the real worker executors and process runtime, use the reviewed local VICE resource policy, and inject
only the exact selected VICE launcher start failure after genuine emit and ACME preparation. A CI-safe
handoff assertion remains, but the local case must prove the candidate-relative attempt worker, exact
launch failure, passing control and complete cleanup together. A VICE-bearing campaign cannot authorize
its report until a bounded read-only inspection observes the process-wide namespace at generation zero,
with no nonce and the child absent. A still-active child or recoverable generation tombstone therefore
fails closed instead of producing report authority that precedes durable cleanup. (AR-P82)

AR-P63 supersedes the provisional AR-P61/AR-P62 fixture architecture. Genuine admission retains the
selected position-11 route. A complete un-injected baseline report supplies a separate passing execution
of that exact same route as the control; the injected report's position 11 supplies the subject. Position
12 remains a useful same-tier campaign occurrence but is not exact-fixture control evidence.
The locally gated case places an exact executable shim named `x64sc` first on the launcher-provided path. The
shim passes exact version probes and unarmed launches through by `execve`, consumes only owner-only markers
for the reviewed two-attempt launcher invocation, preserves the launcher's environment allowlist and audits
each semantic injection. It uses no module mock, facade, reset or dynamic substitution. The separate local
specification owns only this true external facet; the ordinary oracle retains the other 27 cases.

`authorizeExecutionAuthorityReportV1` accepts the ordered handler-minted predicate sidecars and
route-occurrence provenance only while authorizing a complete RD-04 report. It validates their
route/result association before retaining deeply immutable private projections beside that report.
Serialization continues to use only the unchanged complete report snapshot. Calls that omit the
private provenance create compatible pre-RD-05 report authority which still serializes but returns
`historical-authority-unavailable` from the accessors above. A partial sidecar assembly shell uses a
separate opaque builder authority and can never enter the normal serialization registry. (AR-P36)

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

One private evidence authority is the sole owner of canonical normalized observation bytes needed for
literal equality. The runtime mints an explicit `observed` arm at the actual oracle boundary or a
`not-reached` arm at the terminal boundary; stage and cleanup never infer the arm. Observed bytes contain
only oracle facts and not-reached bytes only stable terminal facts, excluding source/candidate/route/build/
timing identities. Cleanup stays a separate predicate axis. Capture validates digest and bounds against the
selected `evidenceBytes` limit and execution hard maximum. Provenance stores only the opaque authority and
returns a defensive copy for the genuine selected occurrence; these bytes never enter the public sidecar,
report, serializer, diagnostic or log. Confirmation compares exact lengths and contents against history and
both fresh runs; digest equality alone is insufficient. (AR-P37, AR-P73, AR-P74)

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
  readonly confirmationCheckpoints: readonly FailureExecutionCheckpointReferenceV1[];
  readonly sequenceEvidence?: StatefulSequenceEvidenceV1;
}

export interface FailureExecutionCheckpointReferenceV1 {
  readonly digest: Sha256Digest;
  readonly reportPosition: number;
  readonly attemptOrdinal: number;
  readonly position: number;
}

export interface StatefulSequenceEvidenceV1 {
  readonly revision: "stateful-sequence-evidence-v1";
  readonly failingPosition: number;
  readonly evaluationDigests: readonly Sha256Digest[];
  readonly checkpoints: readonly FailureExecutionCheckpointReferenceV1[];
}

export function confirmReducedFailureV1(
  context: FailureConfirmationContextAuthorityV1,
): Promise<ExecutionOperationResultV1<FailureConfirmationResultV1>>;
```

The execution package first revalidates the current Node version and every external tool version that
the complete confirmation route may execute. Only after all subject, preceding-sequence and control
tools match the authenticated report values does each of the two confirmation runs create a new
executor instance, fresh temporary root, fresh worker-thread/V8 isolate, and reduced allowlisted
environment. It then mints a module-private `ReductionExecutionIsolationV1` consumed by the fixed
content-bound handler resolver;
callers cannot select an executor. This dedicated path bypasses the campaign pool and its eight-case
retirement rule. A standalone executor has exact one-case capacity, while a sequence executor has
the exact terminal position as its capacity; neither inherits ordinary pool retirement. External
ACME/VICE subprocesses and leases retain their existing per-route
isolation. Both runs must match the complete authenticated predicate and one another's byte-equal
normalized observation, including cleanup. Every minimized failure, including `direct-shrink`, receives
these two fresh candidate runs. A distinct same-route known-good control must additionally pass for every
`fresh-confirm` class—compiler ICE, emission/assembler/emulator failure, handshake failure and
instruction/cycle/wall/output/evidence exhaustion—before the result may become shrinkable.
(AR-P7, AR-P36, AR-P75)

Candidate confirmations receive fresh candidate tokens; controls receive tokens bound to a distinct
genuine known-good authority. A sequence token binds either its exact preceding originating case or
the reduced candidate at the original failing position, plus the attempt and position. Every
attempt contains exactly one terminal reduced-candidate subject and therefore proves the minimized
candidate under the retained state rather than merely replaying the original failure. Whenever the
two-run confirmation does not produce the required exact pair, each bounded sequence attempt creates
one dedicated worker-thread/V8 isolate
and reuses it across that authenticated order so cross-case state can reproduce. Its lifetime is
the validated selected sequence limit, independent of `MAX_CASES_PER_WORKER`, through the exact
hard maximum of 64; case 65 is rejected before launch. Ordinary per-case workspace creation and
cleanup still occurs inside that worker. Independent sequence attempts and standalone
confirmations never share a worker thread, isolate, or temporary root. A stable ordered sequence
produces `stateful-sequence-failure`;
otherwise the result is `flaky-failure`. Neither result can mint promotion authority. Ordered
report-occurrence identities, attempt/position ordinals, checkpoint digests, batch/worker identity, and the
failing position are retained. Classification requires distinct launched standalone roots/workers/isolates,
or one invariant sequence worker/isolate with distinct ordered per-case roots. The complete tool-version
preflight occurs before any root, worker, isolate or controlled process allocation, so late-position or
control drift cannot leave partial isolation state. Every position charges both the selected sequence-case
allowance and route execution before launch; exact
aggregate consumption succeeds and the next case returns closed exhaustion before launch.

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
| One or more worker shutdowns reject | Settle every owner, close protocol authority, then return one count-only `execution.io` at `/isolation/shutdown` | AR-P37 |

## Testing Requirements

- Cross-arm tests prove ordinary generated routes are unchanged while every candidate receives a
  distinct execution identity under the same route contract.
- Capability tests reject forged/replayed evaluation tokens, direct compiler callbacks, altered route
  fields, extra keys, current-authority fallback, and raw bytes in typed request arms.
- Route tests exercise compiler, diagnostic, ACME, VICE, timeout/exhaustion, fixture, observation,
  comparison, and cleanup semantics through published handlers.
- Confirmation tests assert two different standalone executor/workspace/worker-thread identities, no
  campaign-pool reuse, complete predicate/observation/cleanup equality, a genuinely distinct
  same-route passing control for every fresh-confirm class, no control for direct-shrink classes,
  and fresh-token reuse of one candidate. They reject equal code/tier/stage with changed observation
  or cleanup and reject current, first-match, wrong-envelope, wrong-route-plan, wrong-handler or
  wrong-tool authority.
  Sequence tests assert one dedicated worker thread per complete attempt, per-case workspace
  cleanup, isolation between attempts, exact mixed originating report order, failures at positions
  2–9, exactly one terminal reduced
  candidate at its original failing position, original/candidate and position-substitution
  rejection, foreign authenticated evaluation rejection, position-local checkpoint evidence,
  selected-limit and exact 64-case lifetime, pre-launch rejection of the next case, sequence
  classification, and flaky classification. Each probe/replay proves both budget charges occurred
  before launch. Isolation-capability tests reject every cross-mode, cross-campaign, cross-attempt,
  replayed, and post-shutdown use. Rejecting shutdown tests prove every later executor is attempted,
  protocol authority closes, and one deterministic cleanup issue is returned only after settlement.
- Cross-arm conformance tests prove each handler supplies the stable predicate sidecar before
  aggregate hashing, report authority preserves exact ordered association, and copy/reorder/missing
  or pre-RD-05 sidecars fail closed. They mutate every nested predicate field and prove the retained
  authority cannot change, and prove a partial sidecar assembly shell has no normal serialization
  authority. Candidate payload tests cover typed-valid, typed-invalid, raw,
  ACME, and VICE seams and prove transformed runtime expectations derive from the authenticated
  candidate model rather than original expected bytes. VICE sequence cases prove all positions use
  the attempt-owned worker and cannot queue behind the ordinary global pool.
- Raw diagnostic tests cover empty input and exact-byte observation without typed IR.
