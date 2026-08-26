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
- Session tests cover normalization idempotence, byte-changing normalization evaluation,
  foreign/replayed/out-of-order evaluation tokens, cross-subject/purpose substitution, legitimate
  fresh-token candidate reuse,
  aggregate exact/next limits, collision injection, huge shallow structures, and no
  callback/accessor execution.
