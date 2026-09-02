import { isDeepStrictEqual } from "node:util";

import type { FailurePredicateV1 } from "@blend65/readiness";

import type { FailureRouteEvaluationV1 } from "./failure-route-adapter.js";
import { equalFailureExecutionBytesV1 } from "./failure-execution-immutable.js";
import {
  failurePredicateEvidenceMatchesResultV1,
  getFailurePredicateEvidenceObservationBytesV1,
  getFailurePredicateEvidenceProjectionV1,
} from "./failure-predicate-evidence.js";

function expectedCleanup(predicate: FailurePredicateV1): "clear" | "blocked" {
  return predicate.cleanup === "cleanup-clear" ? "clear" : "blocked";
}

/**
 * Compares one exact route evaluation with the complete historical failure predicate.
 *
 * Private canonical observation bytes are compared directly and never included in a digest-only
 * projection, serialized report, or diagnostic message.
 *
 * @example
 * ```ts
 * const reproduced = failureRouteReproducesPredicateV1(evaluation, predicate, observationBytes);
 * ```
 */
export function failureRouteReproducesPredicateV1(
  evaluation: FailureRouteEvaluationV1,
  predicate: FailurePredicateV1,
  historicalObservationBytes: Uint8Array,
): boolean {
  const evidence = getFailurePredicateEvidenceProjectionV1(evaluation.predicateEvidence);
  const observationBytes = getFailurePredicateEvidenceObservationBytesV1(
    evaluation.predicateEvidence,
  );
  return (
    evidence?.kind === "candidate-full-predicate" &&
    failurePredicateEvidenceMatchesResultV1(evaluation.predicateEvidence, evaluation.result) &&
    isDeepStrictEqual(evidence.predicate, predicate) &&
    evidence.resultCode === predicate.resultCode &&
    isDeepStrictEqual(evidence.observation, predicate.observation) &&
    evidence.outcome.status === "failure" &&
    evidence.outcome.code === predicate.resultCode &&
    evidence.outcome.tier === predicate.terminalTier &&
    evidence.outcome.stage === predicate.terminalStage &&
    evidence.outcome.cleanup === expectedCleanup(predicate) &&
    evaluation.result.status === "failure" &&
    evaluation.result.code === predicate.resultCode &&
    evaluation.result.tier === predicate.terminalTier &&
    evaluation.result.stage === predicate.terminalStage &&
    observationBytes !== undefined &&
    equalFailureExecutionBytesV1(observationBytes, historicalObservationBytes)
  );
}

/**
 * Requires both fresh evaluations to reproduce the historical predicate and each other's bytes.
 *
 * @example
 * ```ts
 * const reproduced = freshFailurePairReproducesPredicateV1(first, second, predicate, bytes);
 * ```
 */
export function freshFailurePairReproducesPredicateV1(
  first: FailureRouteEvaluationV1,
  second: FailureRouteEvaluationV1,
  predicate: FailurePredicateV1,
  historicalObservationBytes: Uint8Array,
): boolean {
  const firstBytes = getFailurePredicateEvidenceObservationBytesV1(first.predicateEvidence);
  const secondBytes = getFailurePredicateEvidenceObservationBytesV1(second.predicateEvidence);
  return (
    failureRouteReproducesPredicateV1(first, predicate, historicalObservationBytes) &&
    failureRouteReproducesPredicateV1(second, predicate, historicalObservationBytes) &&
    firstBytes !== undefined &&
    secondBytes !== undefined &&
    equalFailureExecutionBytesV1(firstBytes, secondBytes)
  );
}
