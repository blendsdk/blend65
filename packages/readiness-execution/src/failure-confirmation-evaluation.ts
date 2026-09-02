import type { FailureRouteEvaluationV1 } from "./failure-route-adapter.js";
import {
  FAILURE_EXECUTION_STEP_EVALUATION_V1,
  type FailureConfirmationSessionV1,
  type FailureConfirmationStepAuthorityV1,
  type FailureExecutionObservationV1,
  type FailureExecutionProtocolV1,
  type FailureExecutionStepEvaluationV1,
  type StatefulSequenceAttemptAuthorityV1,
  type StatefulSequencePositionAuthorityV1,
} from "./failure-execution-types.js";

/** Private exact binding retained behind one opaque confirmation evaluation. */
export interface FailureConfirmationEvaluationStateV1 {
  readonly protocol: FailureExecutionProtocolV1;
  readonly session: FailureConfirmationSessionV1;
  readonly step: FailureConfirmationStepAuthorityV1;
  readonly route: FailureRouteEvaluationV1;
  readonly checkpoint: FailureExecutionObservationV1;
  readonly attempt?: StatefulSequenceAttemptAuthorityV1;
  readonly position?: StatefulSequencePositionAuthorityV1;
  readonly discoveredPosition?: number;
  confirmationConsumed: boolean;
  sequenceRecorded: boolean;
}

const EVALUATIONS = new WeakMap<object, FailureConfirmationEvaluationStateV1>();

/**
 * Mints one opaque evaluation bound to its exact protocol, step, route, and local checkpoint.
 *
 * @example
 * ```ts
 * const evaluation = createFailureConfirmationEvaluationV1(binding);
 * ```
 */
export function createFailureConfirmationEvaluationV1(
  input: Omit<FailureConfirmationEvaluationStateV1, "confirmationConsumed" | "sequenceRecorded">,
): FailureExecutionStepEvaluationV1 {
  const evaluation: FailureExecutionStepEvaluationV1 = Object.freeze({
    [FAILURE_EXECUTION_STEP_EVALUATION_V1]: true as const,
  });
  EVALUATIONS.set(evaluation, {
    ...input,
    checkpoint: Object.freeze({ ...input.checkpoint }),
    confirmationConsumed: false,
    sequenceRecorded: false,
  });
  return evaluation;
}

/** Resolves private evaluation state only for a genuine opaque authority. */
export function getFailureConfirmationEvaluationStateV1(
  evaluation: FailureExecutionStepEvaluationV1,
): FailureConfirmationEvaluationStateV1 | undefined {
  return typeof evaluation === "object" && evaluation !== null
    ? EVALUATIONS.get(evaluation)
    : undefined;
}

/**
 * Records one exact position/evaluation association without consuming confirmation ownership.
 *
 * Rejected copied, foreign, reordered, or replayed inputs leave the genuine evaluation reusable by
 * its owning confirmation step.
 */
export function recordFailureSequenceEvaluationV1(
  evaluation: object,
  protocol: FailureExecutionProtocolV1,
  attempt: StatefulSequenceAttemptAuthorityV1,
  position: StatefulSequencePositionAuthorityV1,
): FailureExecutionObservationV1 | undefined {
  const state =
    typeof evaluation === "object" && evaluation !== null ? EVALUATIONS.get(evaluation) : undefined;
  if (
    state === undefined ||
    state.protocol !== protocol ||
    state.attempt !== attempt ||
    state.position !== position ||
    state.sequenceRecorded
  ) {
    return undefined;
  }
  state.sequenceRecorded = true;
  return Object.freeze({ ...state.checkpoint });
}
