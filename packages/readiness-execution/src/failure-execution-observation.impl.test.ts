import { describe, expect, it } from "vitest";

import { deriveFailureExecutionObservationV1 } from "./failure-execution-observation.js";

const DIGEST = `sha256:${"7".repeat(64)}` as const;

describe("failure execution observation identity", () => {
  it("binds every present lifecycle field and owns optional absence", () => {
    const input = {
      mode: "standalone" as const,
      admitted: true,
      launched: true,
      attemptOrdinal: 1,
      position: 0,
      reportPosition: 4,
      rootIdentity: DIGEST,
      workerIdentity: 12,
      isolateIdentity: DIGEST,
    };
    const first = deriveFailureExecutionObservationV1(input);
    expect(deriveFailureExecutionObservationV1({ ...input })).toEqual(first);
    expect(first).toMatchObject({
      revision: "failure-execution-observation-v1",
      checkpointDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
    });
    for (const changed of [
      { admitted: false },
      { launched: false },
      { attemptOrdinal: 2 },
      { position: 1 },
      { reportPosition: 5 },
      { rootIdentity: `sha256:${"8".repeat(64)}` as const },
      { workerIdentity: 13 },
      { isolateIdentity: `sha256:${"9".repeat(64)}` as const },
    ]) {
      expect(
        deriveFailureExecutionObservationV1({ ...input, ...changed }).checkpointDigest,
      ).not.toBe(first.checkpointDigest);
    }

    const absent = deriveFailureExecutionObservationV1({
      mode: "campaign-shared",
      admitted: false,
      launched: false,
      attemptOrdinal: 0,
      position: 0,
      reportPosition: 4,
    });
    expect(absent.rootIdentity).toBeUndefined();
    expect(absent.workerIdentity).toBeUndefined();
    expect(absent.isolateIdentity).toBeUndefined();
    expect(absent.checkpointDigest).not.toBe(first.checkpointDigest);
  });
});
