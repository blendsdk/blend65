# Evidence and Regressions: RD-05 Failure Reduction

> **Document**: 03-04-evidence-and-regressions.md
> **Parent**: [Index](00-index.md)

## Overview

Confirmed unique failures become immutable, content-addressed inactive regressions. Readiness owns
their canonical contracts; execution owns durable no-clobber publication beneath the configured
evidence root. Activation is a separate immutable marker discovered by an implementation-blind
specification runner and can reference only an unchanged candidate plus a previously green commit.
(AR-P2, AR-P6, AR-P8, AR-P14)

## Canonical Readiness Records

```ts
export interface FailureCoreV1 {
  readonly revision: "failure-core-v1";
  readonly promotedFailureKey: PromotedFailureKeyV1;
  readonly minimizedReplay: MinimizedReplayAuthorityV1;
  readonly predicate: FailurePredicateV1;
  readonly expectation: RegressionExpectationV1;
  readonly catalogRevision: "failure-reduction-catalog-v1";
  readonly normalizationRevision: FailureNormalizationRevisionV1;
  readonly digest: Sha256Digest;
}

export interface FailureProvenanceEventV1 {
  readonly revision: "failure-provenance-event-v1";
  readonly failureCoreDigest: Sha256Digest;
  readonly historicalEnvelopeDigest: Sha256Digest;
  readonly runRecordDigest: Sha256Digest;
  readonly policy: FailureReductionPolicyV1;
  readonly trace: readonly FailureTransformationTraceEntryV1[];
  readonly confirmationIdentity: Sha256Digest;
  readonly campaignIdentity: Sha256Digest;
  readonly digest: Sha256Digest;
}

export interface FailureActivationV1 {
  readonly revision: "failure-activation-v1";
  readonly promotedFailureKey: PromotedFailureKeyV1;
  readonly failureCoreDigest: Sha256Digest;
  readonly candidateDigest: Sha256Digest;
  readonly verifiedCommit: string;
  readonly digest: Sha256Digest;
}

export interface FailureEnvelopeRecordV1 {
  readonly revision: "failure-envelope-record-v1";
  readonly envelope: FailureEnvelopeV1;
  readonly digest: Sha256Digest;
}

export interface FailureRunRecordV1 {
  readonly revision: "failure-run-record-v1";
  readonly source: FailureRunSourceV1;
  readonly outcome: FailureReductionOutcomeV1;
  readonly sequenceEvidence?: StatefulSequenceEvidenceV1;
  readonly usage: FailureCampaignUsageAttributionV1;
  readonly digest: Sha256Digest;
}

export type FailureRunSourceV1 =
  | {
      readonly kind: "resolved-envelope";
      readonly envelopeDigest: Sha256Digest;
    }
  | {
      readonly kind: "historical-authority-unavailable";
      readonly identity: FailureUnavailableRunIdentityV1;
    };

export type FailureUnavailableAuthorityV1 =
  | "predicate-sidecar"
  | "historical-handler"
  | "historical-tool"
  | "historical-fixture"
  | "historical-oracle";

export interface FailureUnavailableRouteProjectionV1 {
  readonly revision: "failure-unavailable-route-projection-v1";
  readonly caseIdentity: Sha256Digest;
  readonly executionIdentity: Sha256Digest;
  readonly routeOrdinal: number;
  readonly canonicalRouteRecordBytes: Uint8Array;
}

export interface FailureUnavailableRunIdentityV1 {
  readonly revision: "failure-unavailable-run-identity-v1";
  readonly reportDigest: Sha256Digest;
  readonly route: FailureUnavailableRouteProjectionV1;
  readonly canonicalTerminalResultBytes: Uint8Array;
  readonly missingAuthorities: readonly FailureUnavailableAuthorityV1[];
  readonly digest: Sha256Digest;
}

export interface FailureCampaignSummaryRecordV1 {
  readonly revision: "failure-campaign-summary-record-v1";
  readonly runRecordDigests: readonly Sha256Digest[];
  readonly summary: FailureDispositionSummaryV1;
  readonly digest: Sha256Digest;
}
```

`FailureCoreV1` excludes campaign identity, selected reduction limits, historical envelopes,
confirmation runs, route-plan identity, and discovery-specific candidate authority. Equivalent
promoted keys therefore produce byte-identical cores. Every discovery remains independently
auditable through its append-only event. Expectations come only from authenticated inventory and
oracle contracts, never from failing observed output. (AR-P2, AR-P6)

All schemas are closed and size bounded. They permit exact replay source only in the source field
and structurally exclude environment values, command lines, absolute host paths, arbitrary host
files, raw process streams, and unstructured diagnostic prose. Tool evidence is an allowlisted
typed projection. Field-aware normalization never applies substring redaction to authoritative
source bytes. (AR-P6)

## Authorized Encoding and Publication

The unavailable identity constructor hashes a versioned canonical preimage containing the exact
authenticated report digest; the canonical projection of the complete
`ExecutionRouteAuthorityRecordV1`, including case identity, execution identity, and report route
ordinal; the canonical terminal `ExecutionResultV1` bytes; and the complete missing-authority set.
That set is derived from all resolver failures, uses the closed enum order shown above, contains no
duplicates, and is serialized in enum order regardless of discovery order. Thus equal terminal
results from different cases remain distinct while equivalent failures remain byte-identical across
restart. The unavailable arm never synthesizes an envelope digest or retains messages, host paths,
raw caller fields, or current-authority fallback.

`@blend65/readiness` exports opaque encode/parse capabilities for canonical envelopes, runs,
summaries, failure cores, provenance events, and activation bytes. `@blend65/readiness-execution`
consumes those capabilities and a pinned evidence-root authority; callers cannot supply arbitrary
paths or bytes. Every promotable and non-promotable outcome—including unavailable, exhausted,
stateful, flaky, and unsupported results—gets a durable run record. (AR-P6)

```text
readiness/failures/envelopes/<envelope-digest>.json
readiness/failures/runs/<run-record-digest>.json
readiness/failures/summaries/<summary-record-digest>.json
readiness/failures/cores/<failure-core-digest>.json
readiness/failures/events/<failure-core-digest>/<event-digest>.json
readiness/failures/activations/<promoted-failure-key>.json
```

The execution publisher generalizes the existing secure publication filesystem primitives rather
than cloning their security logic. It pins directory identity, rejects symlinks and non-regular
files, writes a same-directory temporary file, syncs file and directory state, and creates the
destination with no-clobber semantics. Existing byte-identical content is idempotent success;
different bytes at the same identity are fatal. Resolved envelope records publish before their
dependent runs; unavailable-source runs publish independently without a fake envelope. Run records
publish before dependent event/summary records. Restart resolution validates every
content reference and fails closed on missing or revision-drifted dependencies. Partial temporary
files are ignored and safely reconciled. Valid unreferenced provenance events remain immutable but
absent from active projections and produce only non-authoritative reconciliation diagnostics.
(AR-P6)

## Inactive and Active Regression Lifecycle

Publication of a confirmed source failure immediately creates the immutable failure core and event.
That state is inactive and is not discovered by `yarn test`, so a current compiler defect never
turns a green checkpoint red. The candidate content, predicate, expectation, promoted key, and core
digest can never change after publication. (AR-P8)

Activation is a two-checkpoint protocol: (1) the separately owned compiler fix or already-passing
case completes the full repository verification and is committed; (2) a later activation marker
references that known-green ancestor commit and the byte-identical candidate, after which the
implementation-blind regression runner discovers it. This avoids a self-referential commit hash and
does not let activation alter the oracle. (AR-P14)

`verifiedCommit` is exactly one lowercase 40-hex Git object ID. Validation uses fixed executable
and argv arrays only: `git cat-file -e <id>^{commit}` must find a commit and
`git merge-base --is-ancestor <id> HEAD` must return success. Missing/shallow objects, malformed
IDs, non-ancestor commits, command failures, and ambiguous exit states fail closed. CI checkout
must use `actions/checkout@v4` with `fetch-depth: 0`; detached pull-request heads remain supported
because ancestry is checked against `HEAD`, not a branch name. (AR-P14)

```ts
export function loadActiveFailureRegressionsV1(
  evidenceRoot: ReadinessEvidenceRootAuthorityV1,
): ExecutionOperationResultV1<readonly ActiveFailureRegressionV1[]>;

export function createReadinessEvidenceRootAuthorityV1(
  execution: ExecutionAuthorityContextV1,
): ExecutionOperationResultV1<ReadinessEvidenceRootAuthorityV1>;
```

The evidence-root capability is execution-owned and derives the canonical `readiness/failures`
root from genuine live or review-candidate execution context state. The public orchestration API
does not accept a caller path. Standalone regression loading receives only this opaque capability;
plain/copy/foreign contexts fail before filesystem access.

The package specification test treats valid activation manifests as the only active-discovery
roots. It traverses and validates every reachable activation/core cross-reference, reconstructs the
embedded minimized candidate from the core, and checks the unchanged expectation through the public
production route. Missing, malformed, duplicate, digest-mismatched,
non-ancestor, changed-candidate, or unsupported reachable records fail closed. Valid unreferenced
events are ignored for active discovery and surfaced only as reconciliation diagnostics. Zero
activations is an explicit valid state covered by the test, not a skipped suite. (AR-P8, AR-P14)

Active discovery uses immutable V1 limits: at most 256 activation roots, 512 reachable
activation/core records, 1,024 edges, depth 4, 67,108,864 bytes per record, and 134,217,728 aggregate
bytes. The canonical traversal counts before allocation where possible, detects cycles, and fails
closed at the next root/record/edge/depth/byte. Historical envelope/run/event records are not active
test dependencies; the core already contains the minimized replay and expectation.

## Concurrency and Recovery

Core and event identities are computed before filesystem mutation. Concurrent attempts to publish
the same bytes converge idempotently; a content collision never overwrites. Events do not update a
shared mutable index, so simultaneous campaigns cannot lose provenance. Derived summaries enumerate
verified immutable records and are disposable, non-authoritative projections. (AR-P6)

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Same identity, different canonical bytes | Fatal publication conflict; preserve accepted bytes | AR-P6 |
| Symlink/non-regular target or replaced directory | Fail before/at pinned operation; accept nothing | AR-P6 |
| Partial temporary file | Ignore or safely reconcile after validating identity | AR-P6 |
| Missing/revision-drifted envelope or run record | Fail closed for dependent graph; retain independent bytes | AR-P6 |
| Valid event unreachable from every activation | Exclude from active projection; emit diagnostic | AR-P6, AR-P8 |
| Active graph exceeds fixed V1 root/node/edge/depth/byte limit | Deterministic fail-closed discovery result | AR-P8 |
| Oversized, open, or unsupported record | Closed schema rejection | AR-P6 |
| Canary outside exact-source field | Validation/test failure; publish nothing | AR-P6 |
| Missing/malformed activation authority | Specification suite fails closed | AR-P8 |
| Activation references current/self commit | Reject; require already-green ancestor | AR-P14 |
| Activated compiler no longer satisfies expectation | Regression specification test fails | AR-P8 |

## Testing Requirements

- Two campaigns and different selected policies deduplicate to one core and distinct events under
  concurrent retry without mutable-index loss.
- Collision, schema, size, symlink, directory replacement, no-clobber, partial-write, durability,
  reachable-orphan, and idempotency faults fail closed; valid unreferenced events remain inactive.
- Restart tests resolve durable envelope/run/summary records for every outcome and reject missing,
  orphaned dependency, and revision-drift cases without current-authority fallback.
- Unavailable-run vectors mutate every identity preimage field, distinguish equal terminal results
  from different cases and route ordinals, reject incomplete or duplicate authority sets, normalize
  resolver order, and reproduce identical identity and run bytes after restart.
- Secret/path canaries prove exact source round trips byte-for-byte while forbidden host/process
  data never appears elsewhere in canonical records.
- An inactive current defect remains outside test discovery; a valid activation is dynamically
  discovered, while malformed/missing/duplicate/non-ancestor activations fail the suite.
- Git ancestry tests cover valid ancestors, malformed/non-lowercase IDs, missing and shallow
  objects, detached pull-request heads, and non-ancestors through fixed argv-only probes.
- Active graph tests cover exact/next root, record, edge, depth, per-record and aggregate-byte
  limits, canonical wide/deep traversal and cycle rejection.
- Reintroducing an activated defect fails the unchanged specification expectation.
