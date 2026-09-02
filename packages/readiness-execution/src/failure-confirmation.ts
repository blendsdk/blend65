import type {
  AuthorizedFailureEnvelopeV1,
  ExecutionOperationIssueCodeV1,
  ExecutionOperationResultV1,
  FailureCampaignBudgetAuthorityV1,
  Sha256Digest,
} from "@blend65/readiness";
import { chargeFailureCampaignBudgetV1 } from "@blend65/readiness";
import {
  chargeFailureSequenceRouteBudgetV1,
  createReductionCandidateInvocationV1,
  getReductionCandidateProjectionV1,
  type ReductionCandidateAuthorityV1,
  type ReductionCandidateInvocationV1,
} from "@blend65/readiness/failure-reduction-internals";

import { isGenuineExecutionRouteRequestV1 } from "./execution-route-adapters.js";
import {
  failureRouteReproducesPredicateV1,
  freshFailurePairReproducesPredicateV1,
} from "./failure-confirmation-comparison.js";
import {
  areDistinctFreshCheckpointsV1,
  createFailureConfirmationResultV1 as result,
  hasInvariantSequenceCheckpointsV1,
  isCompleteStandaloneCheckpointV1,
} from "./failure-confirmation-checkpoints.js";
import {
  getFailureConfirmationContextStateV1,
  type FailureConfirmationContextStateV1,
} from "./failure-confirmation-context.js";
import type { ExecutionReportOccurrenceStateV1 } from "./execution-report-provenance.js";
import {
  beginStatefulSequenceAttemptV1,
  consumeFailureExecutionIsolationV1,
  createFailureExecutionControlV1,
  getFailureExecutionProtocolStateV1,
  getStatefulSequenceAttemptStateV1,
  getStatefulSequencePositionStateV1,
  mintStandaloneFailureExecutionIsolationV1,
  nextStatefulSequencePositionV1,
  recordStatefulSequencePositionV1,
  closeFailureExecutionProtocolV1,
  openFailureExecutionProtocolV1,
  getFailureExecutionObservationV1,
} from "./failure-execution-isolation.js";
import {
  createFailureConfirmationEvaluationV1,
  getFailureConfirmationEvaluationStateV1,
} from "./failure-confirmation-evaluation.js";
import {
  consumeConfirmationInvocationV1,
  createReductionExecutionRouteRequestV1,
  executeConsumedFailureCandidateV1,
  executeFailureOriginalRouteV1,
  executeReductionCandidateV1,
  type FailureRouteEvaluationV1,
} from "./failure-route-adapter.js";
import {
  validateFailureConfirmationContextToolVersionsV1,
  validateFailureConfirmationToolVersionsV1,
} from "./failure-confirmation-tools.js";
import { historicalFailureExecutionIssueV1 } from "./failure-execution-operation.js";
import {
  FAILURE_CONFIRMATION_SESSION_V1,
  FAILURE_CONFIRMATION_STEP_AUTHORITY_V1,
  type FailureConfirmationNextV1,
  type FailureConfirmationResultV1,
  type FailureConfirmationContextAuthorityV1,
  type FailureConfirmationSessionV1,
  type FailureConfirmationStepAuthorityV1,
  type FailureExecutionControlAuthorityV1,
  type FailureExecutionObservationV1,
  type FailureExecutionOperationResultV1,
  type FailureExecutionProtocolV1,
  type FailureExecutionStepEvaluationV1,
  type ReductionExecutionIsolationV1,
  type StatefulSequenceAttemptAuthorityV1,
  type StatefulSequencePositionAuthorityV1,
} from "./failure-execution-types.js";

type StepKindV1 = "candidate" | "control" | "sequence";

interface ConfirmationStateV1 {
  readonly protocol: FailureExecutionProtocolV1;
  readonly candidate: ReductionCandidateAuthorityV1;
  readonly origin: AuthorizedFailureEnvelopeV1;
  readonly budget: FailureCampaignBudgetAuthorityV1;
  readonly fresh: FailureRouteEvaluationV1[];
  readonly freshCheckpoints: FailureExecutionObservationV1[];
  readonly sequenceDigests: Sha256Digest[];
  readonly sequenceCheckpoints: FailureExecutionObservationV1[];
  pending: FailureConfirmationStepAuthorityV1 | undefined;
  controlIssued: boolean;
  discoveredPosition?: number;
  sequenceAttempt?: StatefulSequenceAttemptAuthorityV1;
  result?: FailureConfirmationResultV1;
}

interface StepStateV1 {
  readonly session: FailureConfirmationSessionV1;
  readonly protocol: FailureExecutionProtocolV1;
  readonly kind: StepKindV1;
  readonly isolation: ReductionExecutionIsolationV1;
  readonly invocation?: ReductionCandidateInvocationV1;
  readonly control?: FailureExecutionControlAuthorityV1;
  readonly attempt?: StatefulSequenceAttemptAuthorityV1;
  readonly position?: StatefulSequencePositionAuthorityV1;
  executed: boolean;
  recorded: boolean;
}

const SESSIONS = new WeakMap<object, ConfirmationStateV1>();
const STEPS = new WeakMap<object, StepStateV1>();

function issue<T>(
  code: ExecutionOperationIssueCodeV1,
  path: string,
  message: string,
): ExecutionOperationResultV1<T> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([Object.freeze({ code, path, message })]) as readonly [
      Readonly<{ code: typeof code; path: string; message: string }>,
    ],
  });
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function sessionState(
  protocol: FailureExecutionProtocolV1,
  session: FailureConfirmationSessionV1,
): ConfirmationStateV1 | undefined {
  const state = typeof session === "object" && session !== null ? SESSIONS.get(session) : undefined;
  return state?.protocol === protocol && getFailureExecutionProtocolStateV1(protocol) !== undefined
    ? state
    : undefined;
}

function chargeRoute(
  state: ConfirmationStateV1,
  purpose: "confirmation" | "control",
): ExecutionOperationResultV1<true> {
  const charged = chargeFailureCampaignBudgetV1(state.budget, {
    kind: "route-execution",
    purpose,
  });
  return charged.ok ? success(true) : charged;
}

function chargeSequenceRoute(state: ConfirmationStateV1): ExecutionOperationResultV1<true> {
  const charged = chargeFailureSequenceRouteBudgetV1(state.budget);
  return charged.ok ? success(true) : charged;
}

function stepOccurrence(
  context: FailureConfirmationContextStateV1,
  step: StepStateV1,
): ExecutionReportOccurrenceStateV1 | undefined {
  if (step.kind === "candidate") return context.subject;
  if (step.kind === "control") return context.control;
  const position =
    step.position === undefined ? undefined : getStatefulSequencePositionStateV1(step.position);
  if (position === undefined) return undefined;
  return isGenuineExecutionRouteRequestV1(position.subject)
    ? context.preceding.find((occurrence) => occurrence.request === position.subject)
    : context.subject;
}

/** Creates a bounded confirmation session from matching candidate and envelope authority. */
export function createFailureConfirmationSessionV1(
  protocol: FailureExecutionProtocolV1,
  candidate: ReductionCandidateAuthorityV1,
  origin: AuthorizedFailureEnvelopeV1,
  campaignBudget: FailureCampaignBudgetAuthorityV1,
): ExecutionOperationResultV1<FailureConfirmationSessionV1> {
  const owner = getFailureExecutionProtocolStateV1(protocol);
  const projected = getReductionCandidateProjectionV1(candidate);
  if (
    owner === undefined ||
    owner.context.origin !== origin ||
    owner.context.candidate !== candidate ||
    owner.context.budget !== campaignBudget ||
    !projected.ok ||
    JSON.stringify(projected.value.originalRoute) !==
      JSON.stringify(owner.context.predicate.routeContract) ||
    JSON.stringify(projected.value.predicate) !== JSON.stringify(owner.context.predicate)
  ) {
    return issue(
      "unbound-capability",
      "/confirmation",
      "Candidate and protocol authority do not match.",
    );
  }
  const session: FailureConfirmationSessionV1 = Object.freeze({
    [FAILURE_CONFIRMATION_SESSION_V1]: true as const,
  });
  SESSIONS.set(session, {
    protocol,
    candidate,
    origin,
    budget: campaignBudget,
    fresh: [],
    freshCheckpoints: [],
    sequenceDigests: [],
    sequenceCheckpoints: [],
    pending: undefined,
    controlIssued: false,
  });
  return success(session);
}

function issueStep(
  session: FailureConfirmationSessionV1,
  state: ConfirmationStateV1,
  input:
    | {
        readonly kind: "candidate";
        readonly invocation: ReductionCandidateInvocationV1;
        readonly isolation: ReductionExecutionIsolationV1;
      }
    | {
        readonly kind: "control";
        readonly control: FailureExecutionControlAuthorityV1;
        readonly isolation: ReductionExecutionIsolationV1;
      }
    | {
        readonly kind: "sequence";
        readonly isolation: ReductionExecutionIsolationV1;
        readonly attempt: StatefulSequenceAttemptAuthorityV1;
        readonly position: StatefulSequencePositionAuthorityV1;
      },
): FailureConfirmationStepAuthorityV1 {
  const authority: FailureConfirmationStepAuthorityV1 = Object.freeze({
    [FAILURE_CONFIRMATION_STEP_AUTHORITY_V1]: true as const,
  });
  STEPS.set(authority, {
    session,
    protocol: state.protocol,
    ...input,
    executed: false,
    recorded: false,
  });
  state.pending = authority;
  return authority;
}

function nextFreshStep(
  session: FailureConfirmationSessionV1,
  state: ConfirmationStateV1,
): ExecutionOperationResultV1<FailureConfirmationNextV1> {
  const invocation = createReductionCandidateInvocationV1(
    state.candidate,
    "confirmation",
    "normalization",
  );
  /* v8 ignore next -- a genuine retained candidate always mints the closed invocation shape */
  if (!invocation.ok) return invocation;
  const isolation = mintStandaloneFailureExecutionIsolationV1(state.protocol, invocation.value);
  /* v8 ignore next -- the just-validated live protocol owns the freshly minted invocation */
  if (!isolation.ok) return isolation;
  const authority = issueStep(session, state, {
    kind: "candidate",
    invocation: invocation.value,
    isolation: isolation.value,
  });
  return success(Object.freeze({ kind: "execute-candidate" as const, authority }));
}

function nextControlStep(
  session: FailureConfirmationSessionV1,
  state: ConfirmationStateV1,
): ExecutionOperationResultV1<FailureConfirmationNextV1> {
  const owner = getFailureExecutionProtocolStateV1(state.protocol);
  /* v8 ignore next -- session validation immediately precedes this synchronous control step */
  if (owner === undefined) return issue("unbound-capability", "/protocol", "Protocol is closed.");
  const controlRequest = owner.context.control?.request;
  if (controlRequest === undefined) {
    return issue("unbound-capability", "/control", "Passing control authority is unavailable.");
  }
  const control = createFailureExecutionControlV1(state.protocol, controlRequest);
  /* v8 ignore next -- the control is built from the protocol's exact retained request */
  if (!control.ok) return control;
  const isolation = mintStandaloneFailureExecutionIsolationV1(state.protocol, control.value);
  /* v8 ignore next -- the just-created control is owned by the same live protocol */
  if (!isolation.ok) return isolation;
  state.controlIssued = true;
  const authority = issueStep(session, state, {
    kind: "control",
    control: control.value,
    isolation: isolation.value,
  });
  return success(Object.freeze({ kind: "execute-control" as const, authority }));
}

function ensureSequenceAttempt(
  state: ConfirmationStateV1,
): ExecutionOperationResultV1<StatefulSequenceAttemptAuthorityV1> {
  if (state.sequenceAttempt !== undefined) return success(state.sequenceAttempt);
  const owner = getFailureExecutionProtocolStateV1(state.protocol);
  const failingPosition = state.discoveredPosition;
  /* v8 ignore next -- callers enter only with a live session and an authenticated discovery */
  if (owner === undefined || failingPosition === undefined) {
    return issue(
      "unbound-capability",
      "/sequence",
      "No authenticated failing position is available.",
    );
  }
  const invocation = createReductionCandidateInvocationV1(
    state.candidate,
    "confirmation",
    "normalization",
  );
  /* v8 ignore next -- a genuine retained candidate always mints the closed invocation shape */
  if (!invocation.ok) return invocation;
  const attempt = beginStatefulSequenceAttemptV1(state.protocol, {
    attemptOrdinal: 1,
    precedingOriginals: owner.context.preceding.map((occurrence) => occurrence.request),
    terminalCandidate: invocation.value,
    failingPosition,
    caseLimit: failingPosition,
  });
  /* v8 ignore next -- the authenticated discovery already satisfies the sequence bounds */
  if (!attempt.ok) return attempt;
  state.sequenceAttempt = attempt.value;
  return attempt;
}

/** Returns exactly one next legal confirmation action or the immutable terminal result. */
export function nextFailureConfirmationStepV1(
  protocol: FailureExecutionProtocolV1,
  session: FailureConfirmationSessionV1,
): ExecutionOperationResultV1<FailureConfirmationNextV1> {
  const state = sessionState(protocol, session);
  if (state === undefined || state.pending !== undefined) {
    return issue(
      "unbound-capability",
      "/confirmation/step",
      "Confirmation step is foreign or out of order.",
    );
  }
  if (state.result !== undefined) {
    return success(Object.freeze({ kind: "complete" as const, result: state.result }));
  }
  if (state.fresh.length < 2) return nextFreshStep(session, state);
  const predicate = getFailureExecutionProtocolStateV1(protocol)?.context.predicate;
  /* v8 ignore next -- sessionState proved this protocol live in the same synchronous turn */
  if (predicate === undefined)
    return issue("unbound-capability", "/protocol", "Protocol is closed.");
  const freshReproduced =
    freshFailurePairReproducesPredicateV1(
      state.fresh[0]!,
      state.fresh[1]!,
      predicate,
      getFailureExecutionProtocolStateV1(protocol)!.context.originProjection.observationBytes,
    ) &&
    state.freshCheckpoints.every((checkpoint) =>
      isCompleteStandaloneCheckpointV1(
        checkpoint,
        getFailureExecutionProtocolStateV1(protocol)!.context.subject.index + 1,
      ),
    ) &&
    areDistinctFreshCheckpointsV1(state.freshCheckpoints);
  const disposition = getFailureExecutionProtocolStateV1(protocol)?.context.disposition;
  if (freshReproduced && disposition === "direct-shrink") {
    state.result = result("confirmed-source-failure", state.fresh, state.freshCheckpoints);
    return success(Object.freeze({ kind: "complete" as const, result: state.result }));
  }
  if (freshReproduced && disposition === "fresh-confirm" && !state.controlIssued) {
    return nextControlStep(session, state);
  }
  if (state.discoveredPosition !== undefined) {
    const attempt = ensureSequenceAttempt(state);
    /* v8 ignore next -- discovery and the retained candidate satisfy attempt construction */
    if (!attempt.ok) return attempt;
    const next = nextStatefulSequencePositionV1(protocol, attempt.value);
    /* v8 ignore next -- the coordinator exclusively owns attempt order and pending positions */
    if (!next.ok) return next;
    /* v8 ignore next -- recording the terminal discovered position sets the session result first */
    if (next.value.kind === "complete") {
      state.result = result("flaky-failure", state.fresh, state.freshCheckpoints);
      return success(Object.freeze({ kind: "complete" as const, result: state.result }));
    }
    const sequenceIsolation = getStatefulSequenceAttemptStateV1(attempt.value)?.isolation;
    /* v8 ignore next -- every genuine attempt retains its isolation for the protocol lifetime */
    if (sequenceIsolation === undefined) {
      return issue(
        "unbound-capability",
        "/sequence/isolation",
        "Sequence isolation is unavailable.",
      );
    }
    const authority = issueStep(session, state, {
      kind: "sequence",
      isolation: sequenceIsolation,
      attempt: attempt.value,
      position: next.value.position,
    });
    return success(
      Object.freeze({
        kind: "execute-sequence-position" as const,
        authority,
        attempt: attempt.value,
        position: next.value.position,
      }),
    );
  }
  state.result = result("flaky-failure", state.fresh, state.freshCheckpoints);
  return success(Object.freeze({ kind: "complete" as const, result: state.result }));
}

/** Executes one issued step through fixed published handlers without accepting callbacks. */
export async function executeFailureConfirmationStepV1(
  protocol: FailureExecutionProtocolV1,
  session: FailureConfirmationSessionV1,
  authority: FailureConfirmationStepAuthorityV1,
): Promise<FailureExecutionOperationResultV1<FailureExecutionStepEvaluationV1>> {
  const state = sessionState(protocol, session);
  const step =
    typeof authority === "object" && authority !== null ? STEPS.get(authority) : undefined;
  if (
    state === undefined ||
    step?.session !== session ||
    step.protocol !== protocol ||
    state.pending !== authority ||
    step.executed
  ) {
    return issue(
      "unbound-capability",
      "/confirmation/step",
      "Confirmation step is foreign or replayed.",
    );
  }
  step.executed = true;
  const owner = getFailureExecutionProtocolStateV1(protocol);
  /* v8 ignore next -- sessionState proved this protocol live in the same synchronous turn */
  if (owner === undefined) return issue("unbound-capability", "/protocol", "Protocol is closed.");
  const occurrence = stepOccurrence(owner.context, step);
  if (
    occurrence === undefined ||
    !(await validateFailureConfirmationToolVersionsV1(owner.context, occurrence))
  ) {
    return historicalFailureExecutionIssueV1(
      "/confirmation/tools",
      "Historical execution tool versions are unavailable or changed.",
    );
  }
  const charged =
    step.kind === "sequence"
      ? chargeSequenceRoute(state)
      : chargeRoute(state, step.kind === "control" ? "control" : "confirmation");
  if (!charged.ok) return charged;
  let evaluated: ExecutionOperationResultV1<FailureRouteEvaluationV1>;
  if (step.kind === "candidate" && step.invocation !== undefined) {
    const request = createReductionExecutionRouteRequestV1(
      owner.parent,
      step.invocation,
      step.isolation,
    );
    if (!request.ok) return request;
    const candidate = await executeReductionCandidateV1(owner.execution, request.value);
    evaluated = candidate.ok
      ? success({
          result: candidate.value.result,
          predicateEvidence: candidate.value.predicateEvidence,
          digest: candidate.value.digest,
        })
      : candidate;
  } else if (step.kind === "control" && step.control !== undefined) {
    const consumed = consumeFailureExecutionIsolationV1(step.isolation, step.control);
    /* v8 ignore next -- issueStep pairs the exact control with its fresh single-use isolation */
    if (!consumed.ok) return consumed;
    evaluated = await executeFailureOriginalRouteV1(owner.execution, protocol, step.isolation);
  } else if (step.kind === "sequence" && step.position !== undefined) {
    const position = getStatefulSequencePositionStateV1(step.position);
    /* v8 ignore next -- sequence steps retain the exact issued position until recording */
    if (position === undefined) {
      return issue("unbound-capability", "/sequence/position", "Sequence position is unavailable.");
    }
    if (isGenuineExecutionRouteRequestV1(position.subject)) {
      evaluated = await executeFailureOriginalRouteV1(owner.execution, protocol, step.isolation);
    } else {
      const consumed = consumeConfirmationInvocationV1(position.subject);
      /* v8 ignore next -- a terminal position contains the fresh invocation minted for its attempt */
      if (!consumed.ok) return consumed;
      evaluated = await executeConsumedFailureCandidateV1(
        owner.execution,
        protocol,
        step.isolation,
        consumed.value,
      );
    }
  } /* v8 ignore next -- issueStep creates only the three exhaustive subject-bearing variants */ else {
    return issue(
      "unbound-capability",
      "/confirmation/step",
      "Confirmation step subject is unavailable.",
    );
  }
  if (!evaluated.ok) return evaluated;
  let discoveredPosition: number | undefined;
  if (step.kind === "candidate" && state.fresh.length === 1) {
    if (
      !freshFailurePairReproducesPredicateV1(
        state.fresh[0]!,
        evaluated.value,
        owner.context.predicate,
        owner.context.originProjection.observationBytes,
      )
    ) {
      discoveredPosition = owner.context.subject.index + 1;
    }
  }
  const observed = getFailureExecutionObservationV1(protocol, step.position ?? step.isolation);
  if (!observed.ok) return observed;
  const output = createFailureConfirmationEvaluationV1({
    protocol,
    session,
    step: authority,
    route: evaluated.value,
    checkpoint: observed.value,
    ...(step.attempt === undefined ? {} : { attempt: step.attempt }),
    ...(step.position === undefined ? {} : { position: step.position }),
    ...(discoveredPosition === undefined ? {} : { discoveredPosition }),
  });
  return success(output);
}

/** Records one exact fixed-handler evaluation and advances confirmation state once. */
export function recordFailureConfirmationStepV1(
  protocol: FailureExecutionProtocolV1,
  session: FailureConfirmationSessionV1,
  authority: FailureConfirmationStepAuthorityV1,
  evaluation: FailureExecutionStepEvaluationV1,
): ExecutionOperationResultV1<true> {
  const state = sessionState(protocol, session);
  const step =
    typeof authority === "object" && authority !== null ? STEPS.get(authority) : undefined;
  const evaluated =
    typeof evaluation === "object" && evaluation !== null
      ? getFailureConfirmationEvaluationStateV1(evaluation)
      : undefined;
  if (
    state === undefined ||
    step?.session !== session ||
    state.pending !== authority ||
    !step.executed ||
    step.recorded ||
    evaluated?.session !== session ||
    evaluated.step !== authority ||
    evaluated.confirmationConsumed
  ) {
    return issue(
      "unbound-capability",
      "/confirmation/evaluation",
      "Evaluation is foreign or replayed.",
    );
  }
  if (step.kind === "candidate") {
    state.fresh.push(evaluated.route);
    state.freshCheckpoints.push(evaluated.checkpoint);
    if (evaluated.discoveredPosition !== undefined)
      state.discoveredPosition = evaluated.discoveredPosition;
  } else if (step.kind === "control") {
    const controlPosition = getFailureExecutionProtocolStateV1(protocol)?.context.control?.index;
    state.result =
      evaluated.route.result.status === "pass" &&
      controlPosition !== undefined &&
      isCompleteStandaloneCheckpointV1(evaluated.checkpoint, controlPosition + 1) &&
      state.freshCheckpoints.every(
        (checkpoint) =>
          checkpoint.rootIdentity !== evaluated.checkpoint.rootIdentity &&
          checkpoint.workerIdentity !== evaluated.checkpoint.workerIdentity &&
          checkpoint.isolateIdentity !== evaluated.checkpoint.isolateIdentity,
      )
        ? result("confirmed-source-failure", state.fresh, state.freshCheckpoints)
        : result("flaky-failure", state.fresh, state.freshCheckpoints);
  } else if (step.attempt !== undefined && step.position !== undefined) {
    const recorded = recordStatefulSequencePositionV1(
      protocol,
      step.attempt,
      step.position,
      evaluation,
    );
    /* v8 ignore next -- the evaluated route and position are exact products of this pending step */
    if (!recorded.ok) return recorded;
    state.sequenceDigests.push(evaluated.route.digest);
    state.sequenceCheckpoints.push(evaluated.checkpoint);
    const position = getStatefulSequencePositionStateV1(step.position)?.position;
    if (position === state.discoveredPosition) {
      const predicate = getFailureExecutionProtocolStateV1(protocol)?.context.predicate;
      state.result =
        predicate !== undefined &&
        hasInvariantSequenceCheckpointsV1(state.sequenceCheckpoints, state.discoveredPosition!) &&
        failureRouteReproducesPredicateV1(
          evaluated.route,
          predicate,
          getFailureExecutionProtocolStateV1(protocol)!.context.originProjection.observationBytes,
        )
          ? result(
              "stateful-sequence-failure",
              state.fresh,
              state.freshCheckpoints,
              state.sequenceDigests,
              state.sequenceCheckpoints,
              state.discoveredPosition,
            )
          : result("flaky-failure", state.fresh, state.freshCheckpoints);
    }
  }
  step.recorded = true;
  evaluated.confirmationConsumed = true;
  state.pending = undefined;
  return success(true);
}

/**
 * Drives bounded isolated confirmation through the retained published handlers.
 *
 * @example
 * ```ts
 * const confirmed = await confirmReducedFailureV1(
 *   parent,
 *   execution,
 *   candidate,
 *   origin,
 *   campaignBudget,
 * );
 * if (confirmed.ok) console.log(confirmed.value.disposition);
 * ```
 */
export async function confirmReducedFailureV1(
  context: FailureConfirmationContextAuthorityV1,
): Promise<FailureExecutionOperationResultV1<FailureConfirmationResultV1>> {
  const retainedContext = getFailureConfirmationContextStateV1(context);
  if (retainedContext === undefined) {
    return issue("unbound-capability", "/context", "Confirmation context is not genuine.");
  }
  if (!(await validateFailureConfirmationContextToolVersionsV1(retainedContext))) {
    return historicalFailureExecutionIssueV1(
      "/confirmation/tools",
      "Historical execution tool versions are unavailable or changed.",
    );
  }
  const opened = openFailureExecutionProtocolV1(context);
  if (!opened.ok) return opened;
  const owner = getFailureExecutionProtocolStateV1(opened.value);
  if (owner === undefined) return issue("unbound-capability", "/protocol", "Protocol is closed.");
  let confirmed: FailureExecutionOperationResultV1<FailureConfirmationResultV1>;
  try {
    confirmed = await driveFailureConfirmationV1(opened.value, owner.context);
  } catch (error) {
    await closeFailureExecutionProtocolV1(opened.value);
    throw error;
  }
  const closed = await closeFailureExecutionProtocolV1(opened.value);
  return closed.ok ? confirmed : closed;
}

async function driveFailureConfirmationV1(
  protocol: FailureExecutionProtocolV1,
  context: FailureConfirmationContextStateV1,
): Promise<FailureExecutionOperationResultV1<FailureConfirmationResultV1>> {
  const created = createFailureConfirmationSessionV1(
    protocol,
    context.candidate,
    context.origin,
    context.budget,
  );
  if (!created.ok) return created;
  for (let count = 0; count < 512; count += 1) {
    const next = nextFailureConfirmationStepV1(protocol, created.value);
    /* v8 ignore next -- the driver exclusively preserves the confirmation machine's step order */
    if (!next.ok) return next;
    if (next.value.kind === "complete") return success(next.value.result);
    const evaluated = await executeFailureConfirmationStepV1(
      protocol,
      created.value,
      next.value.authority,
    );
    if (!evaluated.ok) return evaluated;
    const recorded = recordFailureConfirmationStepV1(
      protocol,
      created.value,
      next.value.authority,
      evaluated.value,
    );
    /* v8 ignore next -- the driver records the exact evaluation returned for its pending step */
    if (!recorded.ok) return recorded;
  }
  /* v8 ignore next -- bounded confirmation completes in fewer than 512 issued steps */
  return issue("execution-plan-capacity", "/confirmation", "Confirmation exceeded its step bound.");
}
