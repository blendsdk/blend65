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

`@blend65/readiness` exports opaque encode/parse capabilities for canonical failure core,
provenance event, and activation bytes. `@blend65/readiness-execution` consumes those capabilities
and a pinned evidence-root authority; callers cannot supply arbitrary paths or bytes. (AR-P6)

```text
readiness/failures/cores/<failure-core-digest>.json
readiness/failures/events/<failure-core-digest>/<event-digest>.json
readiness/failures/activations/<promoted-failure-key>.json
```

The execution publisher generalizes the existing secure publication filesystem primitives rather
than cloning their security logic. It pins directory identity, rejects symlinks and non-regular
files, writes a same-directory temporary file, syncs file and directory state, and creates the
destination with no-clobber semantics. Existing byte-identical content is idempotent success;
different bytes at the same identity are fatal. Partial temporary files are ignored and safely
reconciled, while orphan provenance events remain immutable but absent from derived projections.
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

```ts
export function loadActiveFailureRegressionsV1(
  evidenceRoot: ReadinessEvidenceRootAuthorityV1,
): ExecutionOperationResultV1<readonly ActiveFailureRegressionV1[]>;
```

The package specification test reads activation manifests dynamically, validates every closed
record and cross-reference, reconstructs the candidate from the core, and checks the unchanged
expectation through the public production route. Missing, malformed, duplicate, digest-mismatched,
non-ancestor, changed-candidate, or unsupported records fail closed. Zero activations is an explicit
valid state covered by the test, not a skipped suite. (AR-P8, AR-P14)

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
| Oversized, open, or unsupported record | Closed schema rejection | AR-P6 |
| Canary outside exact-source field | Validation/test failure; publish nothing | AR-P6 |
| Missing/malformed activation authority | Specification suite fails closed | AR-P8 |
| Activation references current/self commit | Reject; require already-green ancestor | AR-P14 |
| Activated compiler no longer satisfies expectation | Regression specification test fails | AR-P8 |

## Testing Requirements

- Two campaigns and different selected policies deduplicate to one core and distinct events under
  concurrent retry without mutable-index loss.
- Collision, schema, size, symlink, directory replacement, no-clobber, partial-write, durability,
  orphan-event, and idempotency faults fail closed.
- Secret/path canaries prove exact source round trips byte-for-byte while forbidden host/process
  data never appears elsewhere in canonical records.
- An inactive current defect remains outside test discovery; a valid activation is dynamically
  discovered, while malformed/missing/duplicate/non-ancestor activations fail the suite.
- Reintroducing an activated defect fails the unchanged specification expectation.
