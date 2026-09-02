import type { Sha256Digest } from "@blend65/readiness";

import type { FailureRouteEvaluationV1 } from "./failure-route-adapter.js";
import type {
  FailureConfirmationResultV1,
  FailureExecutionObservationV1,
} from "./failure-execution-types.js";

/** Builds one immutable classification with position-bound lifecycle checkpoint references. */
export function createFailureConfirmationResultV1(
  disposition: FailureConfirmationResultV1["disposition"],
  fresh: readonly FailureRouteEvaluationV1[],
  checkpoints: readonly FailureExecutionObservationV1[],
  sequenceDigests: readonly Sha256Digest[] = [],
  sequenceCheckpoints: readonly FailureExecutionObservationV1[] = [],
  failingPosition?: number,
): FailureConfirmationResultV1 {
  const reference = (checkpoint: FailureExecutionObservationV1) =>
    Object.freeze({
      digest: checkpoint.checkpointDigest,
      reportPosition: checkpoint.reportPosition,
      attemptOrdinal: checkpoint.attemptOrdinal,
      position: checkpoint.position,
    });
  return Object.freeze({
    revision: "failure-confirmation-result-v1",
    disposition,
    confirmationDigests: Object.freeze(fresh.map((evaluation) => evaluation.digest)),
    confirmationCheckpoints: Object.freeze(checkpoints.map(reference)),
    ...(failingPosition === undefined
      ? {}
      : {
          sequenceEvidence: Object.freeze({
            revision: "stateful-sequence-evidence-v1" as const,
            failingPosition,
            evaluationDigests: Object.freeze([...sequenceDigests]),
            checkpoints: Object.freeze(sequenceCheckpoints.map(reference)),
          }),
        }),
  });
}

/** Requires a launched standalone run bound to its exact historical report occurrence. */
export function isCompleteStandaloneCheckpointV1(
  checkpoint: FailureExecutionObservationV1,
  reportPosition: number,
): boolean {
  return (
    checkpoint.mode === "standalone" &&
    checkpoint.admitted &&
    checkpoint.launched &&
    checkpoint.position === 0 &&
    checkpoint.reportPosition === reportPosition &&
    checkpoint.attemptOrdinal > 0 &&
    checkpoint.rootIdentity !== undefined &&
    checkpoint.workerIdentity !== undefined &&
    checkpoint.isolateIdentity !== undefined
  );
}

/** Requires independent roots, workers, and isolates for the two fresh candidate runs. */
export function areDistinctFreshCheckpointsV1(
  checkpoints: readonly FailureExecutionObservationV1[],
): boolean {
  const first = checkpoints[0];
  const second = checkpoints[1];
  return (
    first !== undefined &&
    second !== undefined &&
    first.attemptOrdinal !== second.attemptOrdinal &&
    first.rootIdentity !== second.rootIdentity &&
    first.workerIdentity !== second.workerIdentity &&
    first.isolateIdentity !== second.isolateIdentity
  );
}

/** Requires one sequence worker/isolate and a distinct ordered root for every position. */
export function hasInvariantSequenceCheckpointsV1(
  checkpoints: readonly FailureExecutionObservationV1[],
  failingPosition: number,
): boolean {
  if (checkpoints.length !== failingPosition || checkpoints.length === 0) return false;
  const workerIdentity = checkpoints[0]?.workerIdentity;
  const isolateIdentity = checkpoints[0]?.isolateIdentity;
  const roots = new Set<string>();
  return checkpoints.every((checkpoint, index) => {
    if (
      checkpoint.mode !== "sequence-attempt" ||
      !checkpoint.admitted ||
      !checkpoint.launched ||
      checkpoint.attemptOrdinal !== 1 ||
      checkpoint.position !== index + 1 ||
      checkpoint.reportPosition !== index + 1 ||
      checkpoint.rootIdentity === undefined ||
      checkpoint.workerIdentity !== workerIdentity ||
      checkpoint.isolateIdentity !== isolateIdentity
    ) {
      return false;
    }
    roots.add(checkpoint.rootIdentity);
    return roots.size === index + 1;
  });
}
