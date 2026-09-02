import { afterEach, describe, expect, it, vi } from "vitest";

interface EvidenceStub {
  readonly projection?: Record<string, unknown> | undefined;
  readonly result?: object;
  readonly bytes?: Uint8Array | undefined;
  readonly byteReads?: (Uint8Array | undefined)[];
}

afterEach(() => {
  vi.doUnmock("./failure-predicate-evidence.js");
  vi.resetModules();
});

describe("failure confirmation predicate comparison", () => {
  it("compares every authenticated predicate, outcome, result, and byte field", async () => {
    vi.doMock("./failure-predicate-evidence.js", () => ({
      getFailurePredicateEvidenceProjectionV1(authority: EvidenceStub) {
        return authority.projection;
      },
      getFailurePredicateEvidenceObservationBytesV1(authority: EvidenceStub) {
        if (authority.byteReads !== undefined && authority.byteReads.length > 0) {
          return authority.byteReads.shift();
        }
        return authority.bytes;
      },
      failurePredicateEvidenceMatchesResultV1(authority: EvidenceStub, result: object) {
        return authority.result === result;
      },
    }));
    const comparison = await import("./failure-confirmation-comparison.js");
    const bytes = new Uint8Array([1, 2, 3]);
    const predicate = {
      resultCode: "compiler-ice",
      terminalTier: "frontend",
      terminalStage: "frontend",
      observation: { kind: "not-reached", stage: "frontend", terminalReasonDigest: "digest" },
      cleanup: "cleanup-clear",
    };
    const result = {
      status: "failure",
      code: "compiler-ice",
      tier: "frontend",
      stage: "frontend",
    };
    const projection = {
      kind: "candidate-full-predicate",
      predicate,
      resultCode: "compiler-ice",
      observation: predicate.observation,
      outcome: {
        status: "failure",
        code: "compiler-ice",
        tier: "frontend",
        stage: "frontend",
        cleanup: "clear",
      },
    };
    const evaluation = (
      options: {
        readonly projection?: Record<string, unknown> | undefined;
        readonly result?: object;
        readonly associatedResult?: object;
        readonly observationBytes?: Uint8Array | undefined;
        readonly byteReads?: (Uint8Array | undefined)[];
      } = {},
    ) => {
      const selectedResult = options.result ?? result;
      const evidence: EvidenceStub = {
        ...(options.projection === undefined && "projection" in options
          ? {}
          : { projection: options.projection ?? structuredClone(projection) }),
        result: options.associatedResult ?? selectedResult,
        ...(options.observationBytes === undefined && "observationBytes" in options
          ? {}
          : { bytes: options.observationBytes ?? bytes.slice() }),
        ...(options.byteReads === undefined ? {} : { byteReads: [...options.byteReads] }),
      };
      return { result: selectedResult, predicateEvidence: evidence };
    };
    const reproduces = (routeEvaluation: object, expected = predicate, expectedBytes = bytes) =>
      comparison.failureRouteReproducesPredicateV1(
        routeEvaluation as never,
        expected as never,
        expectedBytes,
      );

    expect(reproduces(evaluation())).toBe(true);
    const blockedPredicate = { ...predicate, cleanup: "cleanup-blocked" };
    const blockedProjection = structuredClone(projection);
    blockedProjection.predicate = blockedPredicate;
    blockedProjection.outcome.cleanup = "blocked";
    expect(reproduces(evaluation({ projection: blockedProjection }), blockedPredicate)).toBe(true);

    const changedProjection = (
      mutate: (value: typeof projection) => void,
    ): Record<string, unknown> => {
      const value = structuredClone(projection);
      mutate(value);
      return value;
    };
    for (const rejected of [
      evaluation({ projection: undefined }),
      evaluation({
        projection: changedProjection((value) => (value.kind = "ordinary-route-facts")),
      }),
      evaluation({ associatedResult: {} }),
      evaluation({
        projection: changedProjection((value) => (value.predicate.resultCode = "other")),
      }),
      evaluation({ projection: changedProjection((value) => (value.resultCode = "other")) }),
      evaluation({
        projection: changedProjection((value) => (value.observation.kind = "observed")),
      }),
      evaluation({ projection: changedProjection((value) => (value.outcome.status = "pass")) }),
      evaluation({ projection: changedProjection((value) => (value.outcome.code = "other")) }),
      evaluation({ projection: changedProjection((value) => (value.outcome.tier = "cli")) }),
      evaluation({ projection: changedProjection((value) => (value.outcome.stage = "cli")) }),
      evaluation({ projection: changedProjection((value) => (value.outcome.cleanup = "blocked")) }),
      evaluation({ result: { ...result, status: "pass" } }),
      evaluation({ result: { ...result, code: "other" } }),
      evaluation({ result: { ...result, tier: "cli" } }),
      evaluation({ result: { ...result, stage: "cli" } }),
      evaluation({ observationBytes: undefined }),
      evaluation({ observationBytes: new Uint8Array([1, 2, 4]) }),
    ]) {
      expect(reproduces(rejected)).toBe(false);
    }

    const pair = (first: object, second: object) =>
      comparison.freshFailurePairReproducesPredicateV1(
        first as never,
        second as never,
        predicate as never,
        bytes,
      );
    expect(pair(evaluation(), evaluation())).toBe(true);
    expect(pair(evaluation({ observationBytes: new Uint8Array([9]) }), evaluation())).toBe(false);
    expect(pair(evaluation(), evaluation({ observationBytes: new Uint8Array([9]) }))).toBe(false);
    expect(pair(evaluation({ byteReads: [undefined, bytes] }), evaluation())).toBe(false);
    expect(pair(evaluation(), evaluation({ byteReads: [undefined, bytes] }))).toBe(false);
    expect(
      pair(
        evaluation({ byteReads: [new Uint8Array([1]), bytes] }),
        evaluation({ byteReads: [new Uint8Array([2]), bytes] }),
      ),
    ).toBe(false);
  });
});
