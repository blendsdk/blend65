import {
  getAuthorizedFailureEnvelopeStateV1,
  type AuthorizedFailureEnvelopeV1,
  type FailureEnvelopeInitialCandidateV1,
} from "./failure-envelope.js";
import { readExecutionRecord } from "./execution-validation.js";
import { readExecutionArray } from "./execution-validation.js";
import {
  failureTransformationTraceDigestV1,
  validateFailureTransformationTraceV1,
} from "./failure-trace-authority.js";
import { validateReductionCandidateDraftV1 } from "./reduction-candidate-validation.js";
import { digestReductionValueV1 } from "./reduction-value.js";

import type {
  ExecutionIssueV1,
  ExecutionOperationIssueCodeV1,
  ExecutionOperationResultV1,
} from "./execution-contracts.js";
import type { FailureObservationIdentityV1, FailurePredicateV1 } from "./failure-identity.js";
import type { FailureRouteContractV1 } from "./failure-identity.js";
import type { FailureReductionPolicyV1 } from "./failure-contracts.js";
import type { Sha256Digest } from "./model-registry-model.js";
import type { FailureTransformationTraceEntryV1 } from "./failure-transformation-model.js";

export { digestReductionValueV1, encodeReductionValueV1 } from "./reduction-value.js";

/** Closed family reduced by the deterministic engine. */
export type ReductionFamilyV1 = "typed-valid" | "typed-invalid" | "raw-malformed";

/** Lexicographically ordered termination measure for each reduction family. */
export type ReductionSizeV1 =
  | readonly [nodes: number, irBytes: number, sourceBytes: number, canonicalBytes: number]
  | readonly [baselineNodes: number, transformBytes: number, contractBytes: number]
  | readonly [tokens: number, sourceBytes: number, exactByteDigest: Sha256Digest];

/** Passive candidate draft accepted only after full family revalidation. */
export type ReductionCandidateDraftV1 = FailureEnvelopeInitialCandidateV1;

/** Closed family payload consumed only by the published execution adapter. */
export type ReductionExecutionPayloadV1 = FailureEnvelopeInitialCandidateV1;

/** Runtime brand for a fully revalidated reduction candidate. */
export const VALIDATED_REDUCTION_CANDIDATE_V1: unique symbol = Symbol(
  "validated-reduction-candidate-v1",
);

/** Opaque candidate whose size and family invariants are retained privately. */
export interface ValidatedReductionCandidateV1 {
  /** Compile-time marker paired with module-private state. */
  readonly [VALIDATED_REDUCTION_CANDIDATE_V1]: true;
}

/** Defensive passive view of one validated candidate. */
export interface ValidatedReductionCandidateProjectionV1 {
  /** Closed projection schema. */
  readonly revision: "validated-reduction-candidate-projection-v1";
  /** Candidate family. */
  readonly family: ReductionFamilyV1;
  /** Complete closed family data. */
  readonly draft: ReductionCandidateDraftV1;
  /** Strict termination tuple. */
  readonly size: ReductionSizeV1;
  /** Digest of canonical family content. */
  readonly contentDigest: Sha256Digest;
}

/** Runtime brand for immutable reusable candidate authority. */
export const REDUCTION_CANDIDATE_AUTHORITY_V1: unique symbol = Symbol(
  "reduction-candidate-authority-v1",
);

/** Opaque reusable candidate authority. */
export interface ReductionCandidateAuthorityV1 {
  /** Compile-time marker paired with canonical private state. */
  readonly [REDUCTION_CANDIDATE_AUTHORITY_V1]: true;
}

/** Runtime brand for one single-use candidate evaluation token. */
export const REDUCTION_EVALUATION_TOKEN_V1: unique symbol = Symbol("reduction-evaluation-token-v1");

/** Opaque single-use token bound to one candidate invocation. */
export interface ReductionEvaluationTokenV1 {
  /** Compile-time marker paired with module-private invocation state. */
  readonly [REDUCTION_EVALUATION_TOKEN_V1]: true;
}

/** One authenticated candidate execution request. */
export interface ReductionCandidateInvocationV1 {
  /** Closed invocation schema. */
  readonly revision: "reduction-candidate-invocation-v1";
  /** Candidate subject discriminator. */
  readonly subject: "candidate";
  /** Immutable reusable candidate authority. */
  readonly authority: ReductionCandidateAuthorityV1;
  /** Distinct single-use invocation token. */
  readonly token: ReductionEvaluationTokenV1;
  /** Closed use of candidate execution. */
  readonly purpose: "reduction" | "confirmation";
  /** Whether the proposal came from catalog reduction or normalization. */
  readonly proposalKind: "catalog-edit" | "normalization";
  /** Monotonic position under this candidate authority. */
  readonly sequence: number;
}

/** Predicate result returned for one authenticated candidate token. */
export interface ReductionCandidateEvaluationV1 {
  /** Closed evaluation schema. */
  readonly revision: "reduction-candidate-evaluation-v1";
  /** Token returned by the executed invocation. */
  readonly token: ReductionEvaluationTokenV1;
  /** Candidate digest observed by execution. */
  readonly candidateDigest: Sha256Digest;
  /** Purpose retained from the invocation. */
  readonly purpose: "reduction" | "confirmation";
  /** Whether the exact historical predicate reproduced. */
  readonly reproduced: boolean;
  /** Normalized observation identity produced by execution. */
  readonly observation: FailureObservationIdentityV1;
}

/**
 * Stable semantic content of a reduction candidate.
 *
 * This projection is suitable for deterministic reduction results. It deliberately excludes the
 * per-authority execution identity required when the candidate is launched.
 */
export interface ReductionCandidateContentProjectionV1 {
  /** Closed projection schema. */
  readonly revision: "reduction-candidate-projection-v1";
  /** Candidate family. */
  readonly family: ReductionFamilyV1;
  /** Fresh exact candidate source bytes. */
  readonly sourceBytes: Uint8Array;
  /** Candidate content and authority digest. */
  readonly candidateDigest: Sha256Digest;
  /** Immutable original published route semantics. */
  readonly originalRoute: FailureRouteContractV1;
  /** Immutable historical failure predicate. */
  readonly predicate: FailurePredicateV1;
  /** Selected reduction policy. */
  readonly policy: FailureReductionPolicyV1;
  /** Digest of the accepted transformation trace. */
  readonly traceDigest: Sha256Digest;
}

/** Passive execution payload derived from one candidate authority instance. */
export interface ReductionCandidateProjectionV1 extends ReductionCandidateContentProjectionV1 {
  /** Distinct execution identity for transformed bytes. */
  readonly candidateExecutionIdentity: Sha256Digest;
}

/** Passive result of consuming one genuine invocation exactly once. */
export interface ConsumedReductionInvocationV1 {
  /** Closed consumed projection schema. */
  readonly revision: "consumed-reduction-invocation-v1";
  /** Candidate projection supplied to execution. */
  readonly candidate: ReductionCandidateProjectionV1;
  /** Complete validated family payload required by the fixed execution route. */
  readonly payload: ReductionExecutionPayloadV1;
  /** Bound invocation purpose. */
  readonly purpose: "reduction" | "confirmation";
  /** Bound proposal phase. */
  readonly proposalKind: "catalog-edit" | "normalization";
  /** Bound candidate sequence. */
  readonly sequence: number;
}

interface CandidateState {
  readonly envelope: AuthorizedFailureEnvelopeV1;
  readonly projection: ValidatedReductionCandidateProjectionV1;
}

interface CandidateAuthorityState {
  readonly envelope: AuthorizedFailureEnvelopeV1;
  readonly projection: ReductionCandidateProjectionV1;
  readonly payload: ReductionExecutionPayloadV1;
  nextSequence: number;
  nextConsumableSequence: number;
  readonly retiredSequences: Set<number>;
}

interface InvocationState {
  readonly authority: ReductionCandidateAuthorityV1;
  readonly token: ReductionEvaluationTokenV1;
  readonly purpose: "reduction" | "confirmation";
  readonly proposalKind: "catalog-edit" | "normalization";
  readonly sequence: number;
  invocationConsumed: boolean;
  evaluationConsumed: boolean;
}

interface ConsumedInvocationState {
  readonly authority: ReductionCandidateAuthorityV1;
  readonly candidate: ReductionCandidateProjectionV1;
  readonly payload: ReductionExecutionPayloadV1;
  runtimeEvaluationClaimed: boolean;
}

const INVOCATION_KEYS = [
  "revision",
  "subject",
  "authority",
  "token",
  "purpose",
  "proposalKind",
  "sequence",
] as const;
const STATES = new WeakMap<object, CandidateState>();
const AUTHORITIES = new WeakMap<object, CandidateAuthorityState>();
const INVOCATIONS = new WeakMap<object, InvocationState>();
const TOKENS = new WeakMap<object, InvocationState>();
const CONSUMED_INVOCATIONS = new WeakMap<object, ConsumedInvocationState>();
let nextCandidateAuthorityOrdinal = 0;

/** Returns an authority digest without cloning its execution payload. */
export function getReductionCandidateAuthorityDigestV1(
  authority: ReductionCandidateAuthorityV1,
): Sha256Digest | undefined {
  return typeof authority === "object" && authority !== null
    ? AUTHORITIES.get(authority)?.projection.candidateDigest
    : undefined;
}

function issue<T>(
  code: ExecutionOperationIssueCodeV1,
  path: string,
  message: string,
): ExecutionOperationResultV1<T> {
  const issues: readonly [ExecutionIssueV1] = [Object.freeze({ code, path, message })];
  return Object.freeze({ ok: false, issues });
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function createCandidate(
  envelope: AuthorizedFailureEnvelopeV1,
  projection: ValidatedReductionCandidateProjectionV1,
): ValidatedReductionCandidateV1 {
  const candidate: ValidatedReductionCandidateV1 = Object.freeze({
    [VALIDATED_REDUCTION_CANDIDATE_V1]: true as const,
  });
  STATES.set(candidate, Object.freeze({ envelope, projection }));
  return candidate;
}

/** Creates the fully validated starting candidate retained by an envelope. */
export function createInitialReductionCandidateV1(
  envelope: AuthorizedFailureEnvelopeV1,
): ExecutionOperationResultV1<ValidatedReductionCandidateV1> {
  const state = getAuthorizedFailureEnvelopeStateV1(envelope);
  if (state === undefined)
    return issue("unbound-capability", "/envelope", "Failure envelope is not genuine.");
  const projection = validateReductionCandidateDraftV1(envelope, state.projection.initialCandidate);
  return projection === undefined
    ? issue(
        "invalid-evidence-input",
        "/candidate",
        "Envelope initial candidate violates its family invariant.",
      )
    : success(createCandidate(envelope, projection));
}

/** Revalidates a complete hostile candidate against immutable envelope invariants. */
export function validateReductionCandidateInvariantV1(
  original: AuthorizedFailureEnvelopeV1,
  input: unknown,
): ExecutionOperationResultV1<ValidatedReductionCandidateV1> {
  const projection = validateReductionCandidateDraftV1(original, input);
  return projection === undefined
    ? issue(
        "invalid-evidence-input",
        "/candidate",
        "Candidate violates the original family invariant.",
      )
    : success(createCandidate(original, projection));
}

/** Returns a defensive candidate projection. */
export function getValidatedReductionCandidateProjectionV1(
  candidate: ValidatedReductionCandidateV1,
): ExecutionOperationResultV1<ValidatedReductionCandidateProjectionV1> {
  const state =
    typeof candidate === "object" && candidate !== null ? STATES.get(candidate) : undefined;
  return state === undefined
    ? issue("unbound-capability", "/candidate", "Validated candidate is not genuine.")
    : success(structuredClone(state.projection));
}

/** Returns module-private candidate state to catalog and reducer modules. */
export function getValidatedReductionCandidateStateV1(
  candidate: ValidatedReductionCandidateV1,
): CandidateState | undefined {
  return typeof candidate === "object" && candidate !== null ? STATES.get(candidate) : undefined;
}

/** Creates immutable reusable candidate authority from one genuine validated candidate. */
export function createReductionCandidateAuthorityV1(
  envelope: AuthorizedFailureEnvelopeV1,
  candidate: ValidatedReductionCandidateV1,
  trace: readonly FailureTransformationTraceEntryV1[],
): ExecutionOperationResultV1<ReductionCandidateAuthorityV1> {
  return createReductionCandidateAuthorityInternalV1(envelope, candidate, trace, 0, true);
}

/** Creates candidate authority whose first token starts at one reducer-owned sequence. */
export function createReductionCandidateAuthorityAtSequenceV1(
  envelope: AuthorizedFailureEnvelopeV1,
  candidate: ValidatedReductionCandidateV1,
  trace: readonly FailureTransformationTraceEntryV1[],
  initialSequence: number,
): ExecutionOperationResultV1<ReductionCandidateAuthorityV1> {
  return createReductionCandidateAuthorityInternalV1(
    envelope,
    candidate,
    trace,
    initialSequence,
    false,
  );
}

/** Creates one authority after applying public or reducer-owned trace constraints. */
function createReductionCandidateAuthorityInternalV1(
  envelope: AuthorizedFailureEnvelopeV1,
  candidate: ValidatedReductionCandidateV1,
  trace: readonly FailureTransformationTraceEntryV1[],
  initialSequence: number,
  requireFinalTrace: boolean,
): ExecutionOperationResultV1<ReductionCandidateAuthorityV1> {
  const candidateState = getValidatedReductionCandidateStateV1(candidate);
  const envelopeState = getAuthorizedFailureEnvelopeStateV1(envelope);
  if (
    candidateState === undefined ||
    envelopeState === undefined ||
    candidateState.envelope !== envelope ||
    !Number.isSafeInteger(initialSequence) ||
    initialSequence < 0
  ) {
    return issue(
      "unbound-capability",
      "/candidate",
      "Candidate and envelope authority do not match.",
    );
  }
  const traceValues = readExecutionArray(
    trace,
    envelopeState.projection.policy.budget.transformationAttempts,
  );
  if (
    traceValues === undefined ||
    !validateFailureTransformationTraceV1(
      envelope,
      traceValues,
      candidateState.projection.contentDigest,
      requireFinalTrace,
    )
  ) {
    return issue("invalid-evidence-input", "/candidate/trace", "Reduction trace is not genuine.");
  }
  if (
    requireFinalTrace &&
    traceValues.length === 0 &&
    candidateState.projection.contentDigest !==
      digestReductionValueV1(envelopeState.projection.initialCandidate)
  ) {
    return issue(
      "invalid-evidence-input",
      "/candidate/trace",
      "A transformed candidate requires its reducer-owned trace.",
    );
  }
  const traceDigest = failureTransformationTraceDigestV1(traceValues);
  if (traceDigest === undefined) {
    return issue("invalid-evidence-input", "/candidate/trace", "Reduction trace is incomplete.");
  }
  const authorityOrdinal = nextCandidateAuthorityOrdinal;
  nextCandidateAuthorityOrdinal += 1;
  const candidateDigest = digestReductionValueV1({
    envelope: envelopeState.projection.digest,
    content: candidateState.projection.contentDigest,
    traceDigest,
  });
  const payload = candidateState.projection.draft;
  const projection: ReductionCandidateProjectionV1 = Object.freeze({
    revision: "reduction-candidate-projection-v1",
    family: candidateState.projection.family,
    sourceBytes: payload.sourceBytes,
    candidateDigest,
    candidateExecutionIdentity: digestReductionValueV1({
      candidateDigest,
      authorityOrdinal,
      purpose: "execution",
    }),
    originalRoute: envelopeState.projection.predicate.routeContract,
    predicate: envelopeState.projection.predicate,
    policy: envelopeState.projection.policy,
    traceDigest,
  });
  const authority: ReductionCandidateAuthorityV1 = Object.freeze({
    [REDUCTION_CANDIDATE_AUTHORITY_V1]: true as const,
  });
  AUTHORITIES.set(authority, {
    envelope,
    projection,
    payload,
    nextSequence: initialSequence,
    nextConsumableSequence: initialSequence,
    retiredSequences: new Set(),
  });
  return success(authority);
}

/** Reports whether one genuine candidate authority belongs to one exact envelope authority. */
export function reductionCandidateAuthorityMatchesEnvelopeV1(
  authority: ReductionCandidateAuthorityV1,
  envelope: AuthorizedFailureEnvelopeV1,
): boolean {
  return (
    typeof authority === "object" &&
    authority !== null &&
    AUTHORITIES.get(authority)?.envelope === envelope
  );
}

/** Returns defensive candidate execution data. */
export function getReductionCandidateProjectionV1(
  authority: ReductionCandidateAuthorityV1,
): ExecutionOperationResultV1<ReductionCandidateProjectionV1> {
  const state =
    typeof authority === "object" && authority !== null ? AUTHORITIES.get(authority) : undefined;
  return state === undefined
    ? issue("unbound-capability", "/candidate", "Reduction candidate authority is not genuine.")
    : success(structuredClone(state.projection));
}

/** Mints one distinct subject-and-purpose-bound candidate invocation. */
export function createReductionCandidateInvocationV1(
  authority: ReductionCandidateAuthorityV1,
  purpose: "reduction" | "confirmation",
  proposalKind: "catalog-edit" | "normalization",
): ExecutionOperationResultV1<ReductionCandidateInvocationV1> {
  const authorityState =
    typeof authority === "object" && authority !== null ? AUTHORITIES.get(authority) : undefined;
  if (authorityState === undefined)
    return issue(
      "unbound-capability",
      "/candidate",
      "Reduction candidate authority is not genuine.",
    );
  if (
    (purpose !== "reduction" && purpose !== "confirmation") ||
    (proposalKind !== "catalog-edit" && proposalKind !== "normalization")
  ) {
    return issue(
      "execution.invalid-schema",
      "/invocation",
      "Invocation purpose and proposal kind must be closed.",
    );
  }
  const token: ReductionEvaluationTokenV1 = Object.freeze({
    [REDUCTION_EVALUATION_TOKEN_V1]: true as const,
  });
  const sequence = authorityState.nextSequence;
  authorityState.nextSequence += 1;
  const invocation: ReductionCandidateInvocationV1 = Object.freeze({
    revision: "reduction-candidate-invocation-v1",
    subject: "candidate",
    authority,
    token,
    purpose,
    proposalKind,
    sequence,
  });
  const state: InvocationState = {
    authority,
    token,
    purpose,
    proposalKind,
    sequence,
    invocationConsumed: false,
    evaluationConsumed: false,
  };
  INVOCATIONS.set(invocation, state);
  TOKENS.set(token, state);
  return success(invocation);
}

/** Consumes one genuine invocation in candidate-local sequence order. */
export function consumeReductionCandidateInvocationV1(
  input: unknown,
): ExecutionOperationResultV1<ConsumedReductionInvocationV1> {
  const record = readExecutionRecord(input, INVOCATION_KEYS);
  if (record === undefined)
    return issue(
      "execution.invalid-schema",
      "/invocation",
      "Invocation must use the exact version-one shape.",
    );
  const state = typeof input === "object" && input !== null ? INVOCATIONS.get(input) : undefined;
  if (state === undefined || state.invocationConsumed)
    return issue("unbound-capability", "/invocation", "Invocation is forged or already consumed.");
  const authorityState = AUTHORITIES.get(state.authority);
  if (
    authorityState === undefined ||
    record.authority !== state.authority ||
    record.token !== state.token ||
    record.purpose !== state.purpose ||
    record.proposalKind !== state.proposalKind ||
    record.sequence !== state.sequence
  ) {
    return issue(
      "execution.identity",
      "/invocation",
      "Invocation fields or sequence do not match authority.",
    );
  }
  if (authorityState.nextConsumableSequence !== state.sequence) {
    return issue(
      "execution.identity",
      "/invocation",
      "Invocation was presented out of candidate sequence.",
    );
  }
  state.invocationConsumed = true;
  authorityState.nextConsumableSequence += 1;
  while (authorityState.retiredSequences.delete(authorityState.nextConsumableSequence)) {
    authorityState.nextConsumableSequence += 1;
  }
  const consumed: ConsumedReductionInvocationV1 = Object.freeze({
    revision: "consumed-reduction-invocation-v1",
    candidate: authorityState.projection,
    payload: authorityState.payload,
    purpose: state.purpose,
    proposalKind: state.proposalKind,
    sequence: state.sequence,
  });
  CONSUMED_INVOCATIONS.set(consumed, {
    authority: state.authority,
    candidate: authorityState.projection,
    payload: authorityState.payload,
    runtimeEvaluationClaimed: false,
  });
  return success(consumed);
}

/** Claims one genuine typed-valid consumed payload for a candidate-relative runtime evaluation. */
export function claimConsumedCandidateRuntimeInputV1(consumed: ConsumedReductionInvocationV1):
  | Readonly<{
      candidate: ReductionCandidateProjectionV1;
      payload: Extract<ReductionExecutionPayloadV1, { readonly kind: "typed-valid" }>;
    }>
  | undefined {
  const state =
    typeof consumed === "object" && consumed !== null
      ? CONSUMED_INVOCATIONS.get(consumed)
      : undefined;
  if (
    state === undefined ||
    state.runtimeEvaluationClaimed ||
    state.candidate.family !== "typed-valid" ||
    state.payload.kind !== "typed-valid"
  ) {
    return undefined;
  }
  state.runtimeEvaluationClaimed = true;
  return Object.freeze({ candidate: state.candidate, payload: state.payload });
}

/** Retires one unused invocation so a rejected capability cannot block later fresh work. */
export function abandonReductionCandidateInvocationV1(input: unknown): boolean {
  const state = typeof input === "object" && input !== null ? INVOCATIONS.get(input) : undefined;
  if (state === undefined || state.invocationConsumed) return false;
  const authorityState = AUTHORITIES.get(state.authority);
  if (authorityState === undefined) return false;
  state.invocationConsumed = true;
  authorityState.retiredSequences.add(state.sequence);
  while (authorityState.retiredSequences.delete(authorityState.nextConsumableSequence)) {
    authorityState.nextConsumableSequence += 1;
  }
  return true;
}

/** Resolves token state for the reducer without exposing token mutation. */
export function getReductionEvaluationTokenStateV1(token: unknown): InvocationState | undefined {
  return typeof token === "object" && token !== null ? TOKENS.get(token) : undefined;
}

/** Reports whether an invocation is a genuine, not-yet-consumed candidate capability. */
export function isFreshReductionCandidateInvocationV1(input: unknown): boolean {
  const state = typeof input === "object" && input !== null ? INVOCATIONS.get(input) : undefined;
  return state !== undefined && !state.invocationConsumed;
}

/** Returns authority-retained facts for one fresh package-internal candidate invocation. */
export function getFreshReductionCandidateInvocationStateV1(input: unknown):
  | Readonly<{
      candidate: ReductionCandidateProjectionV1;
      purpose: ReductionCandidateInvocationV1["purpose"];
      proposalKind: ReductionCandidateInvocationV1["proposalKind"];
      sequence: number;
    }>
  | undefined {
  const state = typeof input === "object" && input !== null ? INVOCATIONS.get(input) : undefined;
  const authority = state === undefined ? undefined : AUTHORITIES.get(state.authority);
  if (state === undefined || state.invocationConsumed || authority === undefined) return undefined;
  return Object.freeze({
    candidate: authority.projection,
    purpose: state.purpose,
    proposalKind: state.proposalKind,
    sequence: state.sequence,
  });
}

/** Marks one matching token evaluation consumed after all session checks pass. */
export function consumeReductionEvaluationTokenV1(token: ReductionEvaluationTokenV1): boolean {
  const state = getReductionEvaluationTokenStateV1(token);
  if (state === undefined || !state.invocationConsumed || state.evaluationConsumed) return false;
  state.evaluationConsumed = true;
  return true;
}
