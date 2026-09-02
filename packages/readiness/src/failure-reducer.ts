import { isDeepStrictEqual } from "node:util";

import {
  chargeFailureCampaignBudgetV1,
  getFailureCampaignBudgetPolicyV1,
  type FailureCampaignBudgetAuthorityV1,
} from "./failure-campaign-budget.js";
import {
  getAuthorizedFailureEnvelopeStateV1,
  type AuthorizedFailureEnvelopeV1,
} from "./failure-envelope.js";
import {
  getFailureTransformationProposalV1,
  normalizeFailureReductionCandidateV1,
  type FailureTransformationTraceEntryV1,
  type FailureTransformationV1,
} from "./failure-transform-catalog.js";
import { createFailureTransformationTraceEntryV1 } from "./failure-trace-authority.js";
import {
  consumeReductionEvaluationTokenV1,
  createInitialReductionCandidateV1,
  createReductionCandidateAuthorityAtSequenceV1,
  createReductionCandidateAuthorityV1,
  createReductionCandidateInvocationV1,
  getReductionCandidateProjectionV1,
  getReductionCandidateAuthorityDigestV1,
  getReductionEvaluationTokenStateV1,
  getValidatedReductionCandidateStateV1,
  type ReductionCandidateEvaluationV1,
  type ReductionCandidateAuthorityV1,
  type ReductionCandidateContentProjectionV1,
  type ReductionCandidateInvocationV1,
  type ValidatedReductionCandidateV1,
} from "./reduction-candidate.js";
import { readExecutionRecord } from "./execution-validation.js";

import type { ExecutionIssueV1, ExecutionOperationResultV1 } from "./execution-contracts.js";
import type { Sha256Digest } from "./model-registry-model.js";

/** Runtime brand for one deterministic restart-to-fixed-point reduction session. */
export const FAILURE_REDUCTION_SESSION_V1: unique symbol = Symbol("failure-reduction-session-v1");

/** Opaque mutable protocol state driven only through free operations. */
export interface FailureReductionSessionV1 {
  /** Compile-time marker paired with module-private state. */
  readonly [FAILURE_REDUCTION_SESSION_V1]: true;
}

/** Terminal deterministic reduction result. */
export type FailureReductionResultV1 =
  | {
      readonly revision: "failure-reduction-result-v1";
      readonly outcome: "one-minimal";
      readonly best: ReductionCandidateContentProjectionV1;
      readonly trace: readonly FailureTransformationTraceEntryV1[];
    }
  | {
      readonly revision: "failure-reduction-result-v1";
      readonly outcome: "reduction-exhausted";
      readonly best: ReductionCandidateContentProjectionV1;
      readonly trace: readonly FailureTransformationTraceEntryV1[];
      readonly exhaustedAt: "transformation-attempt" | "oracle-evaluation";
    };

/** Next pure protocol action or terminal result. */
export type FailureReductionStepV1 =
  | {
      readonly kind: "execute-candidate";
      readonly invocation: ReductionCandidateInvocationV1;
    }
  | { readonly kind: "complete"; readonly result: FailureReductionResultV1 };

interface OutstandingProposal {
  readonly candidate: ValidatedReductionCandidateV1;
  readonly transformation: FailureTransformationV1 | undefined;
  readonly catalogOrdinal: number;
  readonly invocation: ReductionCandidateInvocationV1;
  readonly candidateDigest: Sha256Digest;
}

interface FailureReductionSessionState {
  readonly envelope: AuthorizedFailureEnvelopeV1;
  readonly budget: FailureCampaignBudgetAuthorityV1;
  current: ValidatedReductionCandidateV1;
  cursor: number;
  trace: FailureTransformationTraceEntryV1[];
  outstanding: OutstandingProposal | undefined;
  terminal: FailureReductionResultV1 | undefined;
  normalizationChecked: boolean;
  nextProposalSequence: number;
}

const EVALUATION_KEYS = [
  "revision",
  "token",
  "candidateDigest",
  "purpose",
  "reproduced",
  "observation",
] as const;
const STATES = new WeakMap<object, FailureReductionSessionState>();

function failure<T>(path: string, message: string): ExecutionOperationResultV1<T> {
  const issues: readonly [ExecutionIssueV1] = [
    Object.freeze({ code: "execution.identity", path, message }),
  ];
  return Object.freeze({ ok: false, issues });
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function bestProjection(
  state: FailureReductionSessionState,
): ReductionCandidateContentProjectionV1 {
  const authority = createReductionCandidateAuthorityV1(state.envelope, state.current, state.trace);
  // Module-private session state retains a genuine envelope/candidate pair.
  /* v8 ignore next */
  if (!authority.ok) throw new TypeError(authority.issues[0].message);
  const projection = getReductionCandidateProjectionV1(authority.value);
  /* v8 ignore next */
  if (!projection.ok) throw new TypeError(projection.issues[0].message);
  return Object.freeze({
    revision: projection.value.revision,
    family: projection.value.family,
    sourceBytes: projection.value.sourceBytes,
    candidateDigest: projection.value.candidateDigest,
    originalRoute: projection.value.originalRoute,
    predicate: projection.value.predicate,
    policy: projection.value.policy,
    traceDigest: projection.value.traceDigest,
  });
}

function complete(
  state: FailureReductionSessionState,
  result: FailureReductionResultV1,
): FailureReductionStepV1 {
  state.terminal = result;
  return Object.freeze({ kind: "complete", result });
}

function completeOneMinimal(state: FailureReductionSessionState): FailureReductionStepV1 {
  return complete(
    state,
    Object.freeze({
      revision: "failure-reduction-result-v1",
      outcome: "one-minimal",
      best: bestProjection(state),
      trace: Object.freeze([...state.trace]),
    }),
  );
}

function completeExhausted(
  state: FailureReductionSessionState,
  exhaustedAt: "transformation-attempt" | "oracle-evaluation",
): FailureReductionStepV1 {
  return complete(
    state,
    Object.freeze({
      revision: "failure-reduction-result-v1",
      outcome: "reduction-exhausted",
      best: bestProjection(state),
      trace: Object.freeze([...state.trace]),
      exhaustedAt,
    }),
  );
}

function propose(
  state: FailureReductionSessionState,
  candidate: ValidatedReductionCandidateV1,
  proposalKind: "catalog-edit" | "normalization",
  catalogOrdinal: number,
  transformation?: FailureTransformationV1,
): FailureReductionStepV1 {
  const authority = createReductionCandidateAuthorityAtSequenceV1(
    state.envelope,
    candidate,
    state.trace,
    state.nextProposalSequence,
  );
  // Proposals receive only candidates validated under this session's envelope.
  /* v8 ignore next */
  if (!authority.ok) throw new TypeError(authority.issues[0].message);
  const invocation = createReductionCandidateInvocationV1(
    authority.value,
    "reduction",
    proposalKind,
  );
  /* v8 ignore next */
  if (!invocation.ok) throw new TypeError(invocation.issues[0].message);
  const candidateDigest = getReductionCandidateAuthorityDigestV1(authority.value);
  /* v8 ignore next */
  if (candidateDigest === undefined) {
    throw new TypeError("Reducer-owned candidate authority lost its private identity.");
  }
  state.nextProposalSequence += 1;
  state.outstanding = Object.freeze({
    candidate,
    transformation,
    catalogOrdinal,
    invocation: invocation.value,
    candidateDigest,
  });
  return Object.freeze({ kind: "execute-candidate", invocation: invocation.value });
}

function drive(state: FailureReductionSessionState): FailureReductionStepV1 {
  if (state.terminal !== undefined)
    return Object.freeze({ kind: "complete", result: state.terminal });
  if (state.outstanding !== undefined) {
    return Object.freeze({ kind: "execute-candidate", invocation: state.outstanding.invocation });
  }
  if (!state.normalizationChecked) {
    const normalized = normalizeFailureReductionCandidateV1(state.envelope, state.current);
    // Current candidates are minted and retained solely by this reducer.
    /* v8 ignore next */
    if (!normalized.ok) return completeExhausted(state, "transformation-attempt");
    state.normalizationChecked = true;
    if (normalized.value.changed && normalized.value.requiresEvaluation) {
      return propose(state, normalized.value.candidate, "normalization", -1);
    }
    state.current = normalized.value.candidate;
    state.cursor = 0;
  }
  while (true) {
    const catalogOrdinal = state.cursor;
    const lookup = getFailureTransformationProposalV1(
      state.envelope,
      state.current,
      catalogOrdinal,
      state.budget,
    );
    if (!lookup.ok) return completeExhausted(state, "transformation-attempt");
    if (lookup.value.outcome === "catalog-complete") return completeOneMinimal(state);
    return propose(
      state,
      lookup.value.proposal.candidate,
      "catalog-edit",
      lookup.value.proposal.catalogOrdinal,
      lookup.value.proposal.transformation,
    );
  }
}

/**
 * Creates a deterministic reduction session from one historical envelope and shared budget.
 *
 * @param envelope Genuine failure envelope.
 * @param campaignBudget Shared campaign-wide budget authority.
 * @returns Opaque session or one authority/invariant issue.
 */
export function createFailureReductionSessionV1(
  envelope: AuthorizedFailureEnvelopeV1,
  campaignBudget: FailureCampaignBudgetAuthorityV1,
): ExecutionOperationResultV1<FailureReductionSessionV1> {
  const envelopeState = getAuthorizedFailureEnvelopeStateV1(envelope);
  if (envelopeState === undefined) {
    return failure("/envelope", "Failure envelope authority is not genuine.");
  }
  const budgetPolicy = getFailureCampaignBudgetPolicyV1(campaignBudget);
  if (
    budgetPolicy === undefined ||
    !isDeepStrictEqual(budgetPolicy, envelopeState.projection.policy)
  ) {
    return failure(
      "/campaignBudget",
      "Campaign budget policy does not match the failure envelope policy.",
    );
  }
  const initial = createInitialReductionCandidateV1(envelope);
  // Genuine envelopes contain an initial candidate validated during authorization.
  /* v8 ignore next */
  if (!initial.ok) return initial;
  const session: FailureReductionSessionV1 = Object.freeze({
    [FAILURE_REDUCTION_SESSION_V1]: true as const,
  });
  STATES.set(session, {
    envelope,
    budget: campaignBudget,
    current: initial.value,
    cursor: 0,
    trace: [],
    outstanding: undefined,
    terminal: undefined,
    normalizationChecked: false,
    nextProposalSequence: 0,
  });
  return success(session);
}

/** Returns the current proposal, next canonical proposal, or terminal result. */
export function nextFailureReductionStepV1(
  session: FailureReductionSessionV1,
): ExecutionOperationResultV1<FailureReductionStepV1> {
  const state = typeof session === "object" && session !== null ? STATES.get(session) : undefined;
  return state === undefined
    ? failure("/session", "Failure reduction session is not genuine.")
    : success(drive(state));
}

/**
 * Mints the final candidate authority only after the reducer reaches a terminal state.
 *
 * @param session Genuine completed reduction session.
 * @returns Authority bound to the final candidate and complete accepted trace.
 */
export function getFailureReductionTerminalCandidateAuthorityV1(
  session: FailureReductionSessionV1,
): ExecutionOperationResultV1<ReductionCandidateAuthorityV1> {
  const state = typeof session === "object" && session !== null ? STATES.get(session) : undefined;
  if (state === undefined) {
    return failure("/session", "Failure reduction session is not genuine.");
  }
  if (state.terminal === undefined) {
    return failure("/session/terminal", "Failure reduction session has not completed.");
  }
  return createReductionCandidateAuthorityV1(state.envelope, state.current, state.trace);
}

function recordAcceptedTrace(
  state: FailureReductionSessionState,
  proposal: OutstandingProposal,
): void {
  if (proposal.transformation === undefined) return;
  const before = getValidatedReductionCandidateStateV1(state.current);
  const after = getValidatedReductionCandidateStateV1(proposal.candidate);
  /* v8 ignore next */
  if (before === undefined || after === undefined) {
    throw new TypeError("Accepted reduction trace could not be projected.");
  }
  state.trace.push(
    createFailureTransformationTraceEntryV1(
      state.envelope,
      state.trace,
      before.projection.contentDigest,
      after.projection.contentDigest,
      proposal.catalogOrdinal,
      proposal.transformation,
      before.projection.size,
      after.projection.size,
      proposal.candidateDigest,
    ),
  );
}

/**
 * Records one authenticated predicate result and advances the deterministic state machine.
 *
 * @param session Genuine active reduction session.
 * @param input Hostile closed evaluation record.
 * @returns Next proposal or terminal result without accepting token replay/substitution.
 */
export function recordFailureReductionEvaluationV1(
  session: FailureReductionSessionV1,
  input: unknown,
): ExecutionOperationResultV1<FailureReductionStepV1> {
  const state = typeof session === "object" && session !== null ? STATES.get(session) : undefined;
  const evaluation = readExecutionRecord(input, EVALUATION_KEYS);
  const outstanding = state?.outstanding;
  if (
    state === undefined ||
    outstanding === undefined ||
    evaluation === undefined ||
    evaluation.revision !== "reduction-candidate-evaluation-v1" ||
    typeof evaluation.reproduced !== "boolean"
  ) {
    return failure("/evaluation", "Evaluation does not match one outstanding session proposal.");
  }
  const tokenState = getReductionEvaluationTokenStateV1(evaluation.token);
  const envelope = getAuthorizedFailureEnvelopeStateV1(state.envelope);
  if (
    tokenState === undefined ||
    tokenState.token !== outstanding.invocation.token ||
    !tokenState.invocationConsumed ||
    tokenState.evaluationConsumed ||
    evaluation.purpose !== outstanding.invocation.purpose ||
    evaluation.candidateDigest !== outstanding.candidateDigest ||
    envelope === undefined ||
    !isDeepStrictEqual(evaluation.observation, envelope.projection.predicate.observation)
  ) {
    return failure(
      "/evaluation",
      "Evaluation token, candidate, purpose, or predicate was substituted.",
    );
  }
  const charged = chargeFailureCampaignBudgetV1(state.budget, { kind: "oracle-evaluation" });
  if (!charged.ok) {
    if (!consumeReductionEvaluationTokenV1(outstanding.invocation.token)) {
      return failure("/evaluation/token", "Evaluation token was already consumed.");
    }
    state.outstanding = undefined;
    return success(completeExhausted(state, "oracle-evaluation"));
  }
  // The preceding token-state check proves this genuine token is still unconsumed.
  /* v8 ignore next */
  if (!consumeReductionEvaluationTokenV1(outstanding.invocation.token)) {
    return failure("/evaluation/token", "Evaluation token was already consumed.");
  }
  state.outstanding = undefined;
  if (evaluation.reproduced) {
    recordAcceptedTrace(state, outstanding);
    state.current = outstanding.candidate;
    state.normalizationChecked = false;
    state.cursor = 0;
  } else {
    if (outstanding.transformation === undefined) {
      state.normalizationChecked = true;
      state.cursor = 0;
    } else {
      state.cursor += 1;
    }
  }
  return success(drive(state));
}

/** Compile-time assertion that the public evaluation model stays closed. */
const _EVALUATION_MODEL: ReductionCandidateEvaluationV1 | undefined = undefined;
void _EVALUATION_MODEL;
