import { describe, expect, it } from "vitest";

import {
  areDistinctFreshCheckpointsV1,
  createFailureConfirmationResultV1,
  hasInvariantSequenceCheckpointsV1,
  isCompleteStandaloneCheckpointV1,
} from "./failure-confirmation-checkpoints.js";
import type { FailureExecutionObservationV1 } from "./failure-execution-types.js";

const DIGEST = `sha256:${"1".repeat(64)}` as const;

type CheckpointOverrides = Omit<
  Partial<FailureExecutionObservationV1>,
  "rootIdentity" | "workerIdentity" | "isolateIdentity"
> & {
  readonly rootIdentity?: FailureExecutionObservationV1["rootIdentity"] | undefined;
  readonly workerIdentity?: FailureExecutionObservationV1["workerIdentity"] | undefined;
  readonly isolateIdentity?: FailureExecutionObservationV1["isolateIdentity"] | undefined;
};

function checkpoint(overrides: CheckpointOverrides = {}): FailureExecutionObservationV1 {
  const value: Record<string, unknown> = {
    revision: "failure-execution-observation-v1",
    mode: "standalone",
    admitted: true,
    launched: true,
    attemptOrdinal: 1,
    position: 0,
    reportPosition: 3,
    rootIdentity: DIGEST,
    workerIdentity: 10,
    isolateIdentity: DIGEST,
    checkpointDigest: DIGEST,
    ...overrides,
  };
  for (const key of ["rootIdentity", "workerIdentity", "isolateIdentity"] as const) {
    if (value[key] === undefined) delete value[key];
  }
  return Object.freeze(value) as unknown as FailureExecutionObservationV1;
}

describe("failure confirmation checkpoint classification", () => {
  it("projects fresh and optional sequence checkpoint references", () => {
    const first = checkpoint();
    const second = checkpoint({
      attemptOrdinal: 2,
      rootIdentity: `sha256:${"2".repeat(64)}`,
      workerIdentity: 11,
      isolateIdentity: `sha256:${"3".repeat(64)}`,
    });
    const withoutSequence = createFailureConfirmationResultV1(
      "confirmed-source-failure",
      [{ digest: DIGEST } as never, { digest: DIGEST } as never],
      [first, second],
    );
    expect(withoutSequence.sequenceEvidence).toBeUndefined();
    expect(withoutSequence.confirmationCheckpoints).toHaveLength(2);

    const withSequence = createFailureConfirmationResultV1(
      "stateful-sequence-failure",
      [],
      [],
      [DIGEST],
      [checkpoint({ mode: "sequence-attempt", position: 1, reportPosition: 1 })],
      1,
    );
    expect(withSequence.sequenceEvidence).toMatchObject({
      failingPosition: 1,
      evaluationDigests: [DIGEST],
      checkpoints: [{ reportPosition: 1, position: 1 }],
    });
  });

  it("requires every standalone launch field and two genuinely distinct lifetimes", () => {
    const first = checkpoint();
    const second = checkpoint({
      attemptOrdinal: 2,
      rootIdentity: `sha256:${"2".repeat(64)}`,
      workerIdentity: 11,
      isolateIdentity: `sha256:${"3".repeat(64)}`,
    });
    expect(isCompleteStandaloneCheckpointV1(first, 3)).toBe(true);
    for (const changed of [
      { mode: "campaign-shared" as const },
      { admitted: false },
      { launched: false },
      { position: 1 },
      { reportPosition: 2 },
      { attemptOrdinal: 0 },
      { rootIdentity: undefined },
      { workerIdentity: undefined },
      { isolateIdentity: undefined },
    ]) {
      expect(isCompleteStandaloneCheckpointV1(checkpoint(changed), 3)).toBe(false);
    }
    expect(areDistinctFreshCheckpointsV1([first, second])).toBe(true);
    expect(areDistinctFreshCheckpointsV1([])).toBe(false);
    for (const changed of [
      { attemptOrdinal: first.attemptOrdinal },
      { rootIdentity: first.rootIdentity },
      { workerIdentity: first.workerIdentity },
      { isolateIdentity: first.isolateIdentity },
    ]) {
      expect(areDistinctFreshCheckpointsV1([first, checkpoint({ ...second, ...changed })])).toBe(
        false,
      );
    }
  });

  it("requires ordered roots on one invariant sequence worker and isolate", () => {
    const first = checkpoint({
      mode: "sequence-attempt",
      position: 1,
      reportPosition: 1,
      rootIdentity: `sha256:${"4".repeat(64)}`,
    });
    const second = checkpoint({
      mode: "sequence-attempt",
      position: 2,
      reportPosition: 2,
      rootIdentity: `sha256:${"5".repeat(64)}`,
    });
    expect(hasInvariantSequenceCheckpointsV1([first, second], 2)).toBe(true);
    expect(hasInvariantSequenceCheckpointsV1([], 0)).toBe(false);
    expect(hasInvariantSequenceCheckpointsV1([first], 2)).toBe(false);
    for (const changed of [
      { mode: "standalone" as const },
      { admitted: false },
      { launched: false },
      { attemptOrdinal: 2 },
      { position: 3 },
      { reportPosition: 3 },
      { rootIdentity: undefined },
      { workerIdentity: 11 },
      { isolateIdentity: `sha256:${"6".repeat(64)}` as const },
      { rootIdentity: first.rootIdentity },
    ]) {
      expect(
        hasInvariantSequenceCheckpointsV1([first, checkpoint({ ...second, ...changed })], 2),
      ).toBe(false);
    }
  });
});
