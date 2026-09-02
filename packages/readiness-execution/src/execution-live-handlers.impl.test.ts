import { afterEach, describe, expect, it, vi } from "vitest";

const DIGEST = `sha256:${"1".repeat(64)}` as const;
const WORKER_EXECUTOR = Object.freeze({
  async start() {
    throw new TypeError("The preparation spy owns worker execution.");
  },
  async shutdown() {},
});
const EXECUTION_CASE = Object.freeze({ revision: "execution-case-v1" });
const ORACLE = Object.freeze({ revision: "published-oracle-context-v1" });
const EVALUATION = Object.freeze({ revision: "published-runtime-evaluation-authority-v1" });
const PREPARED_REQUEST = Object.freeze({ revision: "bound-evaluated-vice-route-v1" });
const LEASE = Object.freeze({ revision: "vice-lease-handle-v1" });
const POLICY = Object.freeze({
  revision: "execution-policy-v1",
  budget: Object.freeze({ routeMs: 10_000, evidenceBytes: 1_024 }),
});
const PASS = Object.freeze({
  status: "pass" as const,
  tier: "vice" as const,
  stage: "compare" as const,
  code: "pass" as const,
  usage: Object.freeze({
    wallMs: 0,
    outputBytes: 0,
    evidenceBytes: 0,
    instructions: 0,
    cycles: 0,
    launchAttempts: 1,
  }),
  evidence: Object.freeze({ digest: DIGEST, retainedBytes: 0, truncated: false }),
});

afterEach(() => {
  vi.doUnmock("@blend65/readiness/execution-runtime");
  vi.doUnmock("./execution-route-adapters.js");
  vi.doUnmock("./execution-vice-build.js");
  vi.doUnmock("./execution-vice-evaluation.js");
  vi.doUnmock("./execution-vice.js");
  vi.doUnmock("./failure-predicate-evidence.js");
  vi.resetModules();
});

describe("live VICE historical replay", () => {
  it("uses isolated original preparation without weakening consumed candidate preparation", async () => {
    const isolatedPrepare = vi.fn(async () => ({
      ok: true as const,
      value: Object.freeze({ request: PREPARED_REQUEST, evidence: Object.freeze({}) }),
    }));
    const candidatePrepare = vi.fn(async () => ({
      ok: true as const,
      value: Object.freeze({ request: PREPARED_REQUEST, evidence: Object.freeze({}) }),
    }));
    const ordinaryPrepare = vi.fn();
    const createEvaluation = vi.fn(() => ({ ok: true as const, value: EVALUATION }));
    const execute = vi.fn(async () => PASS);
    const acquire = vi.fn(async () => ({ ok: true as const, value: LEASE }));
    const registerEvidence = vi.fn();
    const viceObservation = Object.freeze({
      revision: "failure-observation-evidence-authority-v1" as const,
    });
    const consumed = Object.freeze({ revision: "consumed-reduction-invocation-v1" });
    const originalRequest = Object.freeze({
      kind: "valid-envelope" as const,
      route: Object.freeze({ caseIdentity: DIGEST, terminalTier: "vice" as const }),
      executionCase: EXECUTION_CASE,
      oracle: ORACLE,
      policy: POLICY,
    });
    const retained = { consumed: undefined as object | undefined };
    const request = Object.freeze({
      kind: "reduction-candidate-internal" as const,
      route: Object.freeze({ caseIdentity: DIGEST, terminalTier: "vice" as const }),
      policy: POLICY,
    });

    vi.doMock("@blend65/readiness/execution-runtime", async () => ({
      ...(await vi.importActual<Record<string, unknown>>("@blend65/readiness/execution-runtime")),
      createPublishedRuntimeEvaluationAuthorityV1: createEvaluation,
    }));
    vi.doMock("./execution-route-adapters.js", () => ({
      createExecutionRouteHandlersV1: (dependencies: {
        readonly vice: { readonly execute: (value: object, cancellation: object) => unknown };
      }) => Object.freeze({ vice: dependencies.vice }),
      getCandidateExecutionRouteStateV1: () =>
        Object.freeze({
          family: "typed-valid" as const,
          payload: Object.freeze({
            kind: "typed-valid" as const,
            sourceBytes: new Uint8Array([1]),
          }),
          predicate: Object.freeze({}),
          subjectDigest: DIGEST,
          originalRequest,
          workerExecutor: WORKER_EXECUTOR,
          ...(retained.consumed === undefined ? {} : { consumed: retained.consumed }),
        }),
    }));
    vi.doMock("./execution-vice-build.js", () => ({
      prepareCandidateEvaluatedViceRouteV1: candidatePrepare,
      prepareIsolatedEvaluatedViceRouteV1: isolatedPrepare,
    }));
    vi.doMock("./execution-vice-evaluation.js", () => ({
      getFinalViceResultObservationEvidenceV1: (result: object) =>
        result === PASS ? viceObservation : undefined,
    }));
    vi.doMock("./execution-vice.js", () => ({
      acquireViceLeaseV1: acquire,
      executeEvaluatedViceRouteV1: execute,
      prepareEvaluatedViceRouteV1: ordinaryPrepare,
    }));
    vi.doMock("./failure-predicate-evidence.js", () => ({
      registerHandledFailurePredicateEvidenceV1: registerEvidence,
    }));

    const { createLiveExecutionHandlersV1 } = await import("./execution-live-handlers.js");
    const handler = createLiveExecutionHandlersV1().vice;
    const first = await handler.execute(request as never, {
      signal: new AbortController().signal,
      deadlineMonotonicMs: performance.now() + 10_000,
    });

    expect(first).toBe(PASS);
    expect(createEvaluation).toHaveBeenCalledWith(ORACLE, EXECUTION_CASE);
    expect(isolatedPrepare).toHaveBeenCalledWith(
      EXECUTION_CASE,
      EVALUATION,
      POLICY,
      expect.any(AbortSignal),
      WORKER_EXECUTOR,
    );
    expect(candidatePrepare).not.toHaveBeenCalled();
    expect(ordinaryPrepare).not.toHaveBeenCalled();

    retained.consumed = consumed;
    const second = await handler.execute(request as never, {
      signal: new AbortController().signal,
      deadlineMonotonicMs: performance.now() + 10_000,
    });

    expect(second).toBe(PASS);
    expect(candidatePrepare).toHaveBeenCalledWith(
      EXECUTION_CASE,
      ORACLE,
      consumed,
      POLICY,
      expect.any(AbortSignal),
      WORKER_EXECUTOR,
    );
    expect(isolatedPrepare).toHaveBeenCalledTimes(1);
    expect(acquire).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(registerEvidence).toHaveBeenCalledTimes(2);
    expect(registerEvidence).toHaveBeenNthCalledWith(1, request, PASS, viceObservation);
    expect(registerEvidence).toHaveBeenNthCalledWith(2, request, PASS, viceObservation);
  });
});
