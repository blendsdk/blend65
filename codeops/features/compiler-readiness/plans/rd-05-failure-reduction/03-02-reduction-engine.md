# Reduction Engine: RD-05 Failure Reduction

> **Document**: 03-02-reduction-engine.md
> **Parent**: [Index](00-index.md)

## Overview

This readiness-owned component admits separately authenticated raw malformed source, enumerates the
closed V1 transformation catalog, revalidates family invariants, and maintains a deterministic
reduction state machine. It performs no compiler, worker, filesystem, or external-tool operation;
execution drives it through opaque candidate/evaluation messages. (AR-P1, AR-P3, AR-P4)

## Proposed Modules

| Module | Responsibility |
|---|---|
| `malformed-diagnostic-case.ts` | Bounded raw-source authority and replay envelope |
| `failure-invariants.ts` | Typed-valid and complete typed-invalid preservation proofs |
| `failure-transform-catalog.ts` | Closed canonical V1 transformations and strict size tuples |
| `failure-reducer.ts` | Budgeted restart-to-fixed-point state machine |
| `reduction-candidate.ts` | Opaque candidate authority, trace, identity, and passive execution projection |

Purpose-limited candidate projection exports use a package subpath such as
`@blend65/readiness/failure-reduction-internals`, matching existing execution-internal authority
patterns. Ordinary callers receive opaque capabilities and passive result records only. (AR-P1,
AR-P5, AR-P11)

## Closed Callable Contract

AR-P19 closes the callable shapes needed by the implementation-blind specification. All operations
return `ExecutionOperationResultV1<T>`. Structural input uses `execution.invalid-schema`, a plain or
copied capability uses `unbound-capability`, digest/preimage disagreement uses
`execution.identity`, and a semantic invariant violation uses `invalid-evidence-input`. Canonical
failure paths start at `/malformedCase`, `/envelope`, `/resolver`, `/candidate`,
`/transformation`, `/invocation` or `/evaluation`. No operation accepts a callback, promise,
filesystem path, timestamp or ambient option.

### Published invalid-case restart seam

```ts
export interface PublishedDiagnosticCaseIntentV1 {
  readonly schemaVersion: 1;
  readonly ruleId: string;
  readonly seed: Sha256Digest;
  readonly configuration: GenerationConfiguration;
  readonly ordinal: number;
}

export function createPublishedDiagnosticCaseFromIntentV1(
  context: PublishedOracleContext,
  intent: unknown,
): OracleValidationResultV1<PublishedDiagnosticCaseV1>;
```

This purpose-limited operation lives on the existing published-oracle subpath. It authenticates the
context and derives the exact historical generator, boundary transform, renderer and modeled suite
from private selected-publication state. The caller supplies no handler, implementation, expected
diagnostic, memory, budget or observation. Campaign preparation is shared privately with ordinary
published request construction; only the opaque diagnostic-case authority escapes. (AR-P20)

### Root authority and history surface

```ts
export interface MalformedTokenSpanV1 {
  readonly kind: "token" | "trivia" | "unknown";
  readonly startByte: number;
  readonly endByte: number;
}

export interface MalformedTokenTextProvenanceV1 {
  readonly revision: "malformed-token-text-provenance-v1";
  readonly tokenizerRevision: "utf8-byte-spans-v1";
  readonly tokens: readonly MalformedTokenSpanV1[];
}

export interface CreateMalformedDiagnosticCaseInputV1 {
  readonly revision: "malformed-diagnostic-case-input-v1";
  readonly sourceBytes: Uint8Array;
  readonly encoding: "utf-8";
  readonly ruleId: string;
  readonly obligation: string;
  readonly provenance: MalformedTokenTextProvenanceV1;
}

export type FailureEnvelopeSourceAuthorityV1 =
  | { readonly kind: "typed-valid"; readonly authority: ExecutionCaseV1 }
  | { readonly kind: "typed-invalid"; readonly authority: PublishedDiagnosticCaseV1 }
  | { readonly kind: "raw-malformed"; readonly authority: MalformedDiagnosticCaseV1 };

export interface FailureEnvelopeAuthorizationInputV1 {
  readonly revision: "failure-envelope-authorization-input-v1";
  readonly source: FailureEnvelopeSourceAuthorityV1;
  readonly routePlanBytes: Uint8Array;
  readonly routePlanDigest: Sha256Digest;
  readonly predicate: FailurePredicateV1;
  readonly policy: FailureReductionPolicyV1;
  readonly observationBytes: Uint8Array;
  readonly toolVersions: readonly FailureToolIdentityV1[];
}

export interface FailureHistoricalAuthorityRecordV1 {
  readonly revision: "failure-historical-authority-record-v1";
  readonly kind:
    | "campaign"
    | "generator"
    | "renderer"
    | "oracle"
    | "diagnostic"
    | "execution-publication"
    | "fixture";
  readonly contentRevision: string;
  readonly bytes: Uint8Array;
  readonly digest: Sha256Digest;
}

export interface FailureHistoricalAuthorityResolverV1 {
  readonly [FAILURE_HISTORICAL_AUTHORITY_RESOLVER_V1]: true;
}

export type FailureEnvelopeResolutionV1 =
  | {
      readonly outcome: "resolved";
      readonly envelope: AuthorizedFailureEnvelopeV1;
      readonly missingAuthorityDigests: readonly [];
    }
  | {
      readonly outcome: "historical-authority-unavailable";
      readonly missingAuthorityDigests: readonly Sha256Digest[];
    };

export function createMalformedDiagnosticCaseV1(
  oracle: PublishedOracleContext,
  input: unknown,
): ExecutionOperationResultV1<MalformedDiagnosticCaseV1>;
export function getMalformedDiagnosticCaseProjectionV1(
  authority: MalformedDiagnosticCaseV1,
): ExecutionOperationResultV1<MalformedReplayEnvelopeV1>;
export function authorizeFailureEnvelopeV1(
  input: unknown,
): ExecutionOperationResultV1<AuthorizedFailureEnvelopeV1>;
export function getFailureEnvelopeProjectionV1(
  envelope: AuthorizedFailureEnvelopeV1,
): ExecutionOperationResultV1<FailureEnvelopeV1>;
export function getFailureHistoricalAuthorityRecordsV1(
  envelope: AuthorizedFailureEnvelopeV1,
): ExecutionOperationResultV1<readonly FailureHistoricalAuthorityRecordV1[]>;
export function createFailureHistoricalAuthorityResolverV1(
  records: unknown,
): ExecutionOperationResultV1<FailureHistoricalAuthorityResolverV1>;
export function serializeFailureEnvelopeV1(envelope: AuthorizedFailureEnvelopeV1): Uint8Array;
export function parseFailureEnvelopeV1(
  bytes: Uint8Array,
  resolver: FailureHistoricalAuthorityResolverV1,
): ExecutionOperationResultV1<FailureEnvelopeResolutionV1>;
```

The malformed constructor derives its diagnostic-authority digest from a genuine
`PublishedOracleContext`; callers never supply it. Source is copied before validation, must be at
most 1,048,576 bytes, and must decode completely through a fatal UTF-8 decoder. Token spans are at
most 4,096, sorted, non-overlapping, non-empty half-open ranges on code-point boundaries within the
source; empty source has an empty token list. `textDigest` is derived from the exact bytes and is
not a caller field. Rule and obligation text must contain no unmatched UTF-16 surrogate; ingress,
historical normalization and direct replay-digest derivation enforce the same condition so distinct
JavaScript strings cannot alias through UTF-8 replacement encoding. (AR-P3, AR-P19, AR-P23)

Envelope authorization accepts only a genuine opaque source authority. It derives replay,
projection, source, authority references and canonical historical records from module-private
state; the caller supplies only the already-closed route, predicate, policy, observation and tool
facts. Route kind must be `valid-envelope` for typed-valid and `invalid-diagnostic` for the other
families. Typed source must be non-empty; raw source may be empty. Route-plan and observation
digests are checked rather than trusted: `observed.digest` and
`not-reached.terminalReasonDigest` each bind the exact retained observation bytes. Raw required
claims equal the source diagnostic rule exactly. Tool identities are lexically ordered,
duplicate-free and bounded. (AR-P3, AR-P9, AR-P19, AR-P23)

The resolver constructor accepts only a dense bounded array of exact canonical records, verifies
each digest before minting a WeakMap-backed capability, and rejects duplicate digests with unequal
bytes. Parsing first closes the envelope schema and digest, then asks the resolver for every named
record. A complete exact set returns `resolved`; an incomplete exact set returns the sorted
`historical-authority-unavailable` arm with no envelope. Malformed, oversized, extra-key or
digest-conflicting input is an operation failure, never an unavailable result, and current content
is never consulted. (AR-P9, AR-P19)

The specification constructs a genuine oracle context only through
`createOraclePublicationSpecFixture()` → `resolvePublishedSnapshotByDigest()` →
`createPublishedOracleContext()`. It may copy the already-established preparation pattern from
`oracle-published-evidence.spec.test.ts` to obtain genuine typed authorities. No test-only context,
resolver or branding hook is added.

### Purpose-limited invariant and catalog surface

The following types and operations are exported only from
`@blend65/readiness/failure-reduction-internals`:

```ts
export type ReductionCandidateDraftV1 =
  | {
      readonly revision: "reduction-candidate-draft-v1";
      readonly kind: "typed-valid";
      readonly sourceBytes: Uint8Array;
      readonly module: GenModule;
      readonly parameterBindings: readonly ParameterValueBinding[];
      readonly primaryRuleId: string;
      readonly claimedRuleIds: readonly string[];
      readonly claimWitnesses: readonly FailureClaimWitnessV1[];
    }
  | {
      readonly revision: "reduction-candidate-draft-v1";
      readonly kind: "typed-invalid";
      readonly sourceBytes: Uint8Array;
      readonly baseline: GenModule;
      readonly transform: InvalidSourceTransform;
      readonly parameterBindings: readonly ParameterValueBinding[];
      readonly primaryRuleId: string;
      readonly claimedRuleIds: readonly string[];
      readonly claimWitnesses: readonly FailureClaimWitnessV1[];
      readonly neighborId: string;
      readonly violatedPredicateId: string;
      readonly diagnosticFamily: string;
    }
  | {
      readonly revision: "reduction-candidate-draft-v1";
      readonly kind: "raw-malformed";
      readonly sourceBytes: Uint8Array;
      readonly tokens: readonly MalformedTokenSpanV1[];
    };

export interface FailureClaimWitnessV1 {
  readonly ruleId: string;
  readonly path: string;
}

export interface ValidatedReductionCandidateV1 {
  readonly [VALIDATED_REDUCTION_CANDIDATE_V1]: true;
}

export interface ValidatedReductionCandidateProjectionV1 {
  readonly revision: "validated-reduction-candidate-projection-v1";
  readonly family: ReductionFamilyV1;
  readonly draft: ReductionCandidateDraftV1;
  readonly size: ReductionSizeV1;
  readonly contentDigest: Sha256Digest;
}

export type FailureTransformationV1 =
  | { readonly revision: "failure-transformation-v1"; readonly kind: "typed-statement-delete"; readonly path: string }
  | { readonly revision: "failure-transformation-v1"; readonly kind: "typed-expression-simplify"; readonly path: string; readonly replacement: "zero" | "false" | "left" | "right" | "operand" }
  | { readonly revision: "failure-transformation-v1"; readonly kind: "typed-literal-simplify"; readonly path: string; readonly value: string }
  | { readonly revision: "failure-transformation-v1"; readonly kind: "invalid-baseline-delete" | "invalid-baseline-simplify"; readonly path: string }
  | { readonly revision: "failure-transformation-v1"; readonly kind: "invalid-transform-target-rebase"; readonly path: string }
  | { readonly revision: "failure-transformation-v1"; readonly kind: "invalid-unused-binding-remove"; readonly parameterPath: string }
  | { readonly revision: "failure-transformation-v1"; readonly kind: "malformed-token-range-delete" | "malformed-byte-chunk-delete"; readonly startByte: number; readonly endByte: number };

export interface FailureNormalizationResultV1 {
  readonly revision: "failure-normalization-result-v1";
  readonly candidate: ValidatedReductionCandidateV1;
  readonly changed: boolean;
  readonly beforeDigest: Sha256Digest;
  readonly afterDigest: Sha256Digest;
  readonly requiresEvaluation: boolean;
}

export function createInitialReductionCandidateV1(
  envelope: AuthorizedFailureEnvelopeV1,
): ExecutionOperationResultV1<ValidatedReductionCandidateV1>;
export function validateReductionCandidateInvariantV1(
  original: AuthorizedFailureEnvelopeV1,
  candidate: unknown,
): ExecutionOperationResultV1<ValidatedReductionCandidateV1>;
export function getValidatedReductionCandidateProjectionV1(
  candidate: ValidatedReductionCandidateV1,
): ExecutionOperationResultV1<ValidatedReductionCandidateProjectionV1>;
export function enumerateFailureTransformationsV1(
  candidate: ValidatedReductionCandidateV1,
): readonly FailureTransformationV1[];
export function applyFailureTransformationV1(
  original: AuthorizedFailureEnvelopeV1,
  candidate: ValidatedReductionCandidateV1,
  transformation: unknown,
): ExecutionOperationResultV1<ValidatedReductionCandidateV1>;
export function normalizeFailureReductionCandidateV1(
  original: AuthorizedFailureEnvelopeV1,
  candidate: ValidatedReductionCandidateV1,
): ExecutionOperationResultV1<FailureNormalizationResultV1>;
```

`validateReductionCandidateInvariantV1` always revalidates the complete family draft and never
trusts a caller size, digest, path, witness or violation count. Typed modules pass the existing
generator IR validator. A witness path resolves exactly once to live candidate data. Every required
predicate claim retains a witness; an incidental claim may disappear only when both its claim and
witness disappear. Typed-invalid metadata must equal the original neighbor/violation/diagnostic
tuple, the baseline remains valid, the transform remains exactly one closed invalid operation, all
transform and binding paths resolve exactly once after rebasing, and no extra violation field is
accepted. Raw tokens obey the malformed span rules and source identity always uses exact bytes.
(AR-P3, AR-P4)

Enumeration order is family, lexical RFC-6901 path, closed kind, then encoded replacement. Applying
a transformation must produce a candidate whose family tuple is lexicographically smaller; an
equal/increasing result, unknown edit, duplicate/cyclic state or invalid invariant fails at
`/transformation` before authority minting. Normalization is idempotent and separate: it canonicalizes
metadata/order only, never source semantics. `requiresEvaluation` is true exactly when executable
source/module bytes changed, and such a result cannot be adopted by a session before a matching
authenticated evaluation. Phase 2 canonical candidate validation makes that byte-changing branch
unreachable for every admitted V1 candidate; the branch is a fail-closed guard for a future
authenticated ingress that permits non-canonical executable bytes, not a test-only construction
seam. (AR-P4, AR-P19)

The array-returning enumeration and direct-apply operations are compatibility/inspection surfaces,
not the reducer's work queue. They inspect at most 4,096 descriptors and at most 16 MiB of aggregate
source-byte work; enumeration fails closed to an empty frozen list and direct application returns
`execution-plan-capacity` when proving the requested edit would cross that bound. The reducer uses
the lazy descriptor cursor directly. Raw descriptors retain only the budget-reachable prefix; typed
descriptor discovery stops at the envelope's authenticated transformation allowance. Every
potentially expensive descriptor application/revalidation is charged before work, including an
inapplicable descriptor, while a cheap end-of-source probe remains uncharged. (AR-P23)

### Candidate invocation and reducer surface

```ts
export interface ReductionCandidateAuthorityV1 {
  readonly [REDUCTION_CANDIDATE_AUTHORITY_V1]: true;
}
export interface ReductionEvaluationTokenV1 {
  readonly [REDUCTION_EVALUATION_TOKEN_V1]: true;
}
export interface ReductionCandidateInvocationV1 {
  readonly revision: "reduction-candidate-invocation-v1";
  readonly subject: "candidate";
  readonly authority: ReductionCandidateAuthorityV1;
  readonly token: ReductionEvaluationTokenV1;
  readonly purpose: "reduction" | "confirmation";
  readonly proposalKind: "catalog-edit" | "normalization";
  readonly sequence: number;
}
export interface ReductionCandidateEvaluationV1 {
  readonly revision: "reduction-candidate-evaluation-v1";
  readonly token: ReductionEvaluationTokenV1;
  readonly candidateDigest: Sha256Digest;
  readonly purpose: "reduction" | "confirmation";
  readonly reproduced: boolean;
  readonly observation: FailureObservationIdentityV1;
}
export interface ConsumedReductionInvocationV1 {
  readonly revision: "consumed-reduction-invocation-v1";
  readonly candidate: ReductionCandidateProjectionV1;
  readonly purpose: "reduction" | "confirmation";
  readonly proposalKind: "catalog-edit" | "normalization";
  readonly sequence: number;
}

export function createReductionCandidateAuthorityV1(
  envelope: AuthorizedFailureEnvelopeV1,
  candidate: ValidatedReductionCandidateV1,
  trace: readonly FailureTransformationTraceEntryV1[],
): ExecutionOperationResultV1<ReductionCandidateAuthorityV1>;
export function getReductionCandidateProjectionV1(
  authority: ReductionCandidateAuthorityV1,
): ExecutionOperationResultV1<ReductionCandidateProjectionV1>;
export function createReductionCandidateInvocationV1(
  authority: ReductionCandidateAuthorityV1,
  purpose: "reduction" | "confirmation",
  proposalKind: "catalog-edit" | "normalization",
): ExecutionOperationResultV1<ReductionCandidateInvocationV1>;
export function consumeReductionCandidateInvocationV1(
  invocation: unknown,
): ExecutionOperationResultV1<ConsumedReductionInvocationV1>;

export interface FailureReductionSessionV1 {
  readonly [FAILURE_REDUCTION_SESSION_V1]: true;
}
export type FailureReductionStepV1 =
  | { readonly kind: "execute-candidate"; readonly invocation: ReductionCandidateInvocationV1 }
  | { readonly kind: "complete"; readonly result: FailureReductionResultV1 };
export type FailureReductionResultV1 =
  | { readonly revision: "failure-reduction-result-v1"; readonly outcome: "one-minimal"; readonly best: ReductionCandidateProjectionV1; readonly trace: readonly FailureTransformationTraceEntryV1[] }
  | { readonly revision: "failure-reduction-result-v1"; readonly outcome: "reduction-exhausted"; readonly best: ReductionCandidateProjectionV1; readonly trace: readonly FailureTransformationTraceEntryV1[]; readonly exhaustedAt: "transformation-attempt" | "oracle-evaluation" };
export function createFailureReductionSessionV1(
  envelope: AuthorizedFailureEnvelopeV1,
  campaignBudget: FailureCampaignBudgetAuthorityV1,
): ExecutionOperationResultV1<FailureReductionSessionV1>;
export function nextFailureReductionStepV1(
  session: FailureReductionSessionV1,
): ExecutionOperationResultV1<FailureReductionStepV1>;
export function getFailureReductionTerminalCandidateAuthorityV1(
  session: FailureReductionSessionV1,
): ExecutionOperationResultV1<ReductionCandidateAuthorityV1>;
export function recordFailureReductionEvaluationV1(
  session: FailureReductionSessionV1,
  evaluation: unknown,
): ExecutionOperationResultV1<FailureReductionStepV1>;
```

Candidate authority is immutable and reusable; every invocation receives a fresh WeakMap-backed
single-use token bound to candidate digest, purpose, proposal kind and monotonic session sequence.
Consumption is module-private in production and exported only from the internal subpath. Plain,
copied, replayed, foreign, out-of-order, wrong-purpose or candidate-substituted tokens fail at
`/invocation` or `/evaluation` before token/session mutation. A failed validation does not consume
the token. The same candidate may be invoked again only through a newly minted token. Phase 3 adds
control and sequence subjects without widening this candidate token. (AR-P5, AR-P19)

The session charges `transformation-attempt` before proposing each catalog edit and
`oracle-evaluation` before accepting each evaluation. It derives policy only from the envelope,
starts from `createInitialReductionCandidateV1`, performs normalization before each catalog pass,
accepts only a matching reproduced evaluation, and restarts at catalog ordinal zero after every
accepted smaller candidate. `next` is idempotent while one invocation is outstanding. A complete
pass returns `one-minimal`; exact budget use succeeds and the next needed charge returns the
`reduction-exhausted` result with the retained best and bounded trace rather than an operation
failure. (AR-P4, AR-P15, AR-P19)

More precisely, one transformation-attempt charge covers each descriptor whose applicability must
be established, so skipped/inapplicable descriptors cannot hide unmetered render, validation or
hash work. Completion exposes the current candidate through the terminal-only authority operation;
an active or forged session fails closed. This hands Phase 3 the genuine final candidate/trace pair
without moving route execution or confirmation into Phase 2. Private evaluation and trace checks
reuse retained candidate digests/sizes rather than cloning full public projections. (AR-P23)

## Raw Malformed Authority

```ts
export interface MalformedReplayEnvelopeV1 {
  readonly revision: "malformed-replay-envelope-v1";
  readonly sourceBytes: Uint8Array;
  readonly encoding: "utf-8";
  readonly ruleId: string;
  readonly obligation: string;
  readonly diagnosticAuthorityDigest: Sha256Digest;
  readonly provenance: MalformedTokenTextProvenanceV1;
  readonly digest: Sha256Digest;
}

export interface MalformedDiagnosticCaseV1 {
  readonly [MALFORMED_DIAGNOSTIC_CASE_V1]: true;
}

export function createMalformedDiagnosticCaseV1(
  oracle: PublishedOracleContext,
  input: unknown,
): ExecutionOperationResultV1<MalformedDiagnosticCaseV1>;
```

The constructor accepts exact valid UTF-8 from zero bytes through the selected diagnostic-byte
limit, a reviewed rule/obligation, selected diagnostic authority, and bounded canonical token/text
provenance. It rejects environment/command/path fields, arbitrary expected prose, extra keys,
forged oracle contexts, source subclasses, and invalid encoding. The source bytes are copied before
validation and never normalized or redacted. Empty source is valid only in this arm. (AR-P3)

## Family Invariants

```ts
export type ReductionFamilyV1 = "typed-valid" | "typed-invalid" | "raw-malformed";

export type ReductionSizeV1 =
  | readonly [nodes: number, irBytes: number, sourceBytes: number, canonicalBytes: number]
  | readonly [baselineNodes: number, transformBytes: number, contractBytes: number]
  | readonly [tokens: number, sourceBytes: number, exactByteDigest: Sha256Digest];

export function validateReductionCandidateInvariantV1(
  original: AuthorizedFailureEnvelopeV1,
  candidate: ReductionCandidateDraftV1,
): ExecutionOperationResultV1<ValidatedReductionCandidateV1>;
```

Typed-valid candidates must remain syntactically well formed, type-correct, renderable, and bound
to the original primary rule plus immutable required-claim subset. Typed-invalid candidates retain
the valid baseline, validity kind, primary/required claims, complete type-correct bindings, neighbor,
violated predicate, diagnostic family/context, exactly one intentional violation, and rebased paths
that resolve exactly once. Incidental claims outside the predicate may disappear only with their
witness. (AR-P3, AR-P4)

Raw-malformed candidates retain exact bytes/encoding/rule/obligation/oracle authority. Token
metadata may canonicalize; source identity always hashes the exact candidate bytes. Every raw edit
is enumerated only on UTF-8 code-point boundaries and the complete edited buffer is decoded with a
strict fatal UTF-8 validator before candidate authority is minted. Invalid edits are deterministically
filtered and still participate in fixed-point/trace accounting. (AR-P3)

## Closed Transformation Catalog

```ts
export type FailureTransformationV1 =
  | TypedStatementOrSubtreeDeleteV1
  | TypedExpressionSimplifyV1
  | TypedLiteralSimplifyV1
  | InvalidBaselineDeleteOrSimplifyV1
  | InvalidTransformTargetRebaseV1
  | InvalidUnusedBindingRemoveV1
  | MalformedTokenRangeDeleteV1
  | MalformedByteChunkDeleteV1;

export interface FailureTransformationTraceEntryV1 {
  readonly revision: "failure-transformation-trace-entry-v1";
  readonly catalogOrdinal: number;
  readonly transformation: FailureTransformationV1;
  readonly beforeSize: ReductionSizeV1;
  readonly afterSize: ReductionSizeV1;
  readonly candidateDigest: Sha256Digest;
}

export function enumerateFailureTransformationsV1(
  candidate: ValidatedReductionCandidateV1,
): readonly FailureTransformationV1[];
```

Enumeration is total and canonical: family, structural path in lexical pointer order, operation
kind, then encoded replacement. Every catalog edit must strictly decrease the family tuple.
Idempotent normalization is a separate phase with its own canonical trace and never masquerades as
an equal-size catalog edit. Unknown transformations and catalog revisions fail closed. Catalog and
normalization revisions participate in candidate/run identity. (AR-P4)

Typed literal simplification uses a finite ordered set derived from type boundaries already present
in the candidate; it does not introduce new language behavior or hardware lore. Raw byte-chunk
deletion uses deterministic decreasing chunk sizes and left-to-right offsets, followed by token
range deletion in canonical token order. (AR-P4)

## Pure Reduction State Machine

```ts
export interface FailureReductionSessionV1 {
  readonly [FAILURE_REDUCTION_SESSION_V1]: true;
}

export type FailureReductionStepV1 =
  | { readonly kind: "execute-candidate"; readonly invocation: ReductionCandidateInvocationV1 }
  | { readonly kind: "complete"; readonly result: FailureReductionResultV1 };

export function createFailureReductionSessionV1(
  envelope: AuthorizedFailureEnvelopeV1,
  campaignBudget: FailureCampaignBudgetAuthorityV1,
): ExecutionOperationResultV1<FailureReductionSessionV1>;

export function nextFailureReductionStepV1(
  session: FailureReductionSessionV1,
): ExecutionOperationResultV1<FailureReductionStepV1>;

export function recordFailureReductionEvaluationV1(
  session: FailureReductionSessionV1,
  evaluation: ReductionCandidateEvaluationV1,
): ExecutionOperationResultV1<FailureReductionStepV1>;
```

The session derives its selected policy solely from the authenticated envelope. It owns one current
accepted candidate, the catalog cursor, reduction trace, normalization trace, and per-session usage
attribution while every operation consumes the shared campaign budget. Before catalog enumeration
and after every accepted decreasing edit it applies the closed idempotent normalization exactly
once. If normalization changes execution-bearing bytes, the coordinator evaluates those bytes
through the ordinary authenticated predicate route before adopting them. `next` proposes only the
next invariant-valid strictly smaller catalog edit and mints immutable candidate authority plus a
fresh single-use evaluation token. A predicate-preserving result accepts the candidate and restarts
with normalization; a rejection advances the cursor. A complete pass with no acceptance returns
one-minimal proof. (AR-P4, AR-P5)

The state machine does not accept caller callbacks, promises, filesystem paths, timestamps, or
ambient configuration. Duplicate/out-of-order/foreign evaluation tokens fail before state changes;
legitimate reuse of one immutable candidate through newly minted tokens is permitted for reduction
and confirmation invocations only. Controls and sequence positions use their own subject-bound
authorities and single-use tokens.
Exact-limit consumption succeeds; the next request returns `reduction-exhausted` with the retained
best candidate and complete bounded trace, never promotion authority. (AR-P4)

## Candidate Authority

```ts
export interface ReductionCandidateAuthorityV1 {
  readonly [REDUCTION_CANDIDATE_AUTHORITY_V1]: true;
}

export interface ReductionCandidateInvocationV1 {
  readonly subject: "candidate";
  readonly authority: ReductionCandidateAuthorityV1;
  readonly token: ReductionEvaluationTokenV1;
  readonly purpose: "reduction" | "confirmation";
}

export type AuthenticatedSequenceSubjectV1 =
  | {
      readonly kind: "originating-case";
      readonly authority: AuthenticatedSequenceCaseV1;
    }
  | {
      readonly kind: "reduced-candidate";
      readonly authority: ReductionCandidateAuthorityV1;
      readonly originalCaseIdentity: Sha256Digest;
      readonly candidateDigest: Sha256Digest;
    };

export type FailureExecutionInvocationV1 =
  | ReductionCandidateInvocationV1
  | {
      readonly subject: "known-good-control";
      readonly authority: KnownGoodControlAuthorityV1;
      readonly token: ControlEvaluationTokenV1;
      readonly purpose: "control";
    }
  | {
      readonly subject: "sequence-position";
      readonly authority: AuthenticatedSequenceSubjectV1;
      readonly token: SequenceEvaluationTokenV1;
      readonly purpose: "sequence";
      readonly attemptIdentity: Sha256Digest;
      readonly position: number;
    };

export type ReductionExecutionPayloadV1 =
  | TypedValidReductionExecutionPayloadV1
  | TypedInvalidReductionExecutionPayloadV1
  | RawDiagnosticReductionExecutionPayloadV1;

export interface FailureExecutionFixtureProjectionV1 {
  readonly revision: "failure-execution-fixture-projection-v1";
  readonly canonicalBytes: Uint8Array;
  readonly digest: Sha256Digest;
}

export interface FailureExecutionOracleProjectionV1 {
  readonly revision: "failure-execution-oracle-projection-v1";
  readonly observationContractBytes: Uint8Array;
  readonly expectedSemanticBytes: Uint8Array;
  readonly digest: Sha256Digest;
}

export interface TypedValidReductionExecutionPayloadV1 {
  readonly kind: "typed-valid";
  readonly sourceBytes: Uint8Array;
  readonly semanticModelBytes: Uint8Array;
  readonly fixture: FailureExecutionFixtureProjectionV1;
  readonly oracle: FailureExecutionOracleProjectionV1;
}

export interface TypedInvalidReductionExecutionPayloadV1 {
  readonly kind: "typed-invalid";
  readonly sourceBytes: Uint8Array;
  readonly validBaselineBytes: Uint8Array;
  readonly transformContractBytes: Uint8Array;
  readonly diagnosticContractBytes: Uint8Array;
  readonly fixture: FailureExecutionFixtureProjectionV1;
  readonly oracle: FailureExecutionOracleProjectionV1;
}

export interface RawDiagnosticReductionExecutionPayloadV1 {
  readonly kind: "raw-diagnostic";
  readonly sourceBytes: Uint8Array;
  readonly ruleId: string;
  readonly obligation: string;
  readonly diagnosticAuthorityDigest: Sha256Digest;
  readonly oracle: FailureExecutionOracleProjectionV1;
}

export interface ReductionCandidateRuntimeAuthorityV1 {
  readonly [REDUCTION_CANDIDATE_RUNTIME_AUTHORITY_V1]: true;
}

export interface ReductionCandidateProjectionV1 {
  readonly revision: "reduction-candidate-projection-v1";
  readonly family: ReductionFamilyV1;
  readonly sourceBytes: Uint8Array;
  readonly candidateDigest: Sha256Digest;
  readonly candidateExecutionIdentity: Sha256Digest;
  readonly originalRoute: FailureRouteContractV1;
  readonly predicate: FailurePredicateV1;
  readonly policy: FailureReductionPolicyV1;
  readonly traceDigest: Sha256Digest;
  readonly executionPayload: ReductionExecutionPayloadV1;
  readonly runtimeAuthority?: ReductionCandidateRuntimeAuthorityV1;
}
```

Authority identity hashes the authenticated failure-envelope digest, exact candidate content,
canonical trace, predicate, original route contract, and complete selected policy. It is distinct
from original case, campaign, route-plan, promotion, and core identities. Projection returns fresh
source copies and only typed fixture/oracle/diagnostic facts needed by execution. Candidate
authority is immutable and reusable only through the bounded coordinator; every actual invocation
uses a distinct subject-and-purpose-bound, single-use evaluation token. The minimized candidate is
reused only for reduction and confirmation. Controls bind a genuine known-good case. A sequence
contains authenticated preceding originating cases followed by exactly one terminal
reduced-candidate subject at the original failing position; its token binds the attempt, position,
original case identity, candidate digest, and subject kind. Position changes, original/candidate
substitution, a missing or repeated reduced candidate, and positions after the terminal candidate
fail before execution. Token subjects cannot be substituted across purposes. (AR-P5)

The closed execution payload carries authenticated candidate source/IR, fixture and observation
contracts, original route semantics, and only the family-specific diagnostic or runtime authority
needed by existing handlers. Typed-valid and typed-invalid candidates derive a candidate-relative
semantic model and oracle projection from the transformed program under the original oracle
contract; they never reuse expected runtime bytes from the original generated case. The
purpose-limited runtime authority adapts that model to existing worker, ACME, VICE-build, and
runtime-evaluation consumers without minting a forged `ExecutionCaseV1`. Raw payloads contain no
typed IR or runtime authority.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Empty typed source | Invariant rejection; raw arm remains valid | AR-P3 |
| Invalid UTF-8 or oversized malformed source | Closed ingress rejection | AR-P3 |
| Path fails to rebase/resolve exactly once | Candidate rejection before execution | AR-P4 |
| Multiple/no intentional invalid violations | Candidate rejection before execution | AR-P4 |
| Non-decreasing edit or normalization cycle | Catalog-contract failure; session stops closed | AR-P4 |
| Budget next-operation overflow | `reduction-exhausted`; retain best, never promote | AR-P4 |
| Forged/replayed evaluation token | Identity failure before session mutation | AR-P5 |

## Testing Requirements

- Known-reducible fixtures for all three families must shrink strictly and reach byte-identical
  one-minimal results in repeated/fresh processes.
- Property-style implementation tests must prove every accepted edit decreases the declared tuple
  and catalog restarts cannot cycle.
- Typed-invalid fixtures must exercise every existing invalid transform kind, path rebasing, binding
  removal, and exactly-one-violation failure.
- Raw malformed tests include zero bytes, malformed language text that is valid UTF-8,
  multibyte and BOM-adjacent deletion boundaries, path-like/secret-like literals, token/byte ties,
  exact-byte round trips, and strict invalid UTF-8 rejection after every edit and before authority
  minting.
- Session tests cover normalization idempotence, the admitted V1 precondition of the fail-closed
  byte-changing normalization evaluation guard,
  foreign/replayed/out-of-order evaluation tokens, cross-subject/purpose substitution, legitimate
  fresh-token candidate reuse,
  aggregate exact/next limits, collision injection, huge shallow structures, and no
  callback/accessor execution.
