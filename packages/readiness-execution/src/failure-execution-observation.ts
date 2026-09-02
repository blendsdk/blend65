import { createHash } from "node:crypto";

import type { FailureExecutionObservationV1 } from "./failure-execution-types.js";

/** Closed private inputs for one path-free execution lifecycle checkpoint. */
export type FailureExecutionObservationInputV1 = Omit<
  FailureExecutionObservationV1,
  "revision" | "checkpointDigest"
>;

/** Derives one immutable checkpoint whose digest binds every lifecycle and position field. */
export function deriveFailureExecutionObservationV1(
  input: FailureExecutionObservationInputV1,
): FailureExecutionObservationV1 {
  const checkpointDigest = `sha256:${createHash("sha256")
    .update(
      JSON.stringify({
        revision: "failure-execution-observation-v1",
        mode: input.mode,
        admitted: input.admitted,
        launched: input.launched,
        attemptOrdinal: input.attemptOrdinal,
        position: input.position,
        reportPosition: input.reportPosition,
        rootIdentity: input.rootIdentity ?? null,
        workerIdentity: input.workerIdentity ?? null,
        isolateIdentity: input.isolateIdentity ?? null,
      }),
    )
    .digest("hex")}` as const;
  return Object.freeze({
    revision: "failure-execution-observation-v1",
    ...input,
    checkpointDigest,
  });
}
