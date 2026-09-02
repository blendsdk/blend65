import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ONE = `sha256:${"1".repeat(64)}` as const;
const ORIGINAL_TWO = `sha256:${"2".repeat(64)}` as const;
const EXECUTION_ONE = `sha256:${"3".repeat(64)}` as const;
const EXECUTION_TWO = `sha256:${"4".repeat(64)}` as const;
const CANDIDATE = `sha256:${"5".repeat(64)}` as const;
const EVIDENCE = `sha256:${"6".repeat(64)}` as const;

afterEach(() => {
  vi.doUnmock("./execution-publication-catalog.js");
  vi.doUnmock("./execution-route-adapters.js");
  vi.doUnmock("./execution-report-provenance.js");
  vi.doUnmock("./failure-execution-isolation.js");
  vi.doUnmock("./failure-predicate-evidence.js");
  vi.resetModules();
});

describe("failure route subject identities", () => {
  it("preserves ordered original identities and reserves candidate identity for the terminal subject", async () => {
    const execution = {};
    const protocol = {};
    const isolation = {};
    const executor = {};
    const predicate = Object.freeze({
      routeContract: Object.freeze({ terminalTier: "frontend" }),
    });
    const policy = Object.freeze({ budget: Object.freeze({ routeMs: 1_000 }) });
    const result = Object.freeze({
      status: "failure",
      tier: "frontend",
      stage: "frontend",
      code: "compiler-ice",
      usage: Object.freeze({
        wallMs: 0,
        outputBytes: 0,
        evidenceBytes: 0,
        instructions: 0,
        cycles: 0,
        launchAttempts: 0,
      }),
      evidence: Object.freeze({ digest: EVIDENCE, retainedBytes: 0, truncated: false }),
    });
    const occurrence = (index: number, caseIdentity: string) =>
      Object.freeze({
        index,
        execution,
        request: Object.freeze({
          kind: "valid-envelope",
          route: Object.freeze({ caseIdentity, terminalTier: "frontend" }),
          policy,
        }),
        payload: Object.freeze({ kind: "typed-valid", sourceBytes: new Uint8Array([index + 1]) }),
      });
    const occurrences = [occurrence(0, ORIGINAL_ONE), occurrence(1, ORIGINAL_TWO)];
    let selectedOccurrence = occurrences[0];
    const protocolState = {
      execution,
      context: {
        predicate,
        subject: occurrences[1],
        report: {
          routeRecords: [
            { executionIdentity: EXECUTION_ONE },
            { executionIdentity: EXECUTION_TWO },
          ],
        },
      },
    };
    const adaptedIdentities: string[] = [];
    const dispatchedIdentities: string[] = [];

    vi.doMock("./execution-publication-catalog.js", () => ({
      getLiveExecutionContextStateV1(selected: object) {
        return selected === execution
          ? {
              handlers: {
                frontend: {
                  async execute(request: { readonly route: { readonly caseIdentity: string } }) {
                    dispatchedIdentities.push(request.route.caseIdentity);
                    return result;
                  },
                },
              },
            }
          : undefined;
      },
    }));
    vi.doMock("./execution-route-adapters.js", () => ({
      createCandidateExecutionRouteRequestV1(input: {
        readonly originalRequest: { readonly route: object };
        readonly subjectDigest: string;
      }) {
        adaptedIdentities.push(input.subjectDigest);
        return {
          ok: true,
          value: Object.freeze({
            kind: "reduction-candidate-internal",
            route: Object.freeze({
              ...input.originalRequest.route,
              caseIdentity: input.subjectDigest,
            }),
            policy,
          }),
        };
      },
    }));
    vi.doMock("./failure-execution-isolation.js", () => ({
      consumeFailureExecutionIsolationV1: vi.fn(),
      getFailureExecutionPredicateV1: () => predicate,
      getFailureExecutionIsolationOccurrenceV1: () => selectedOccurrence,
      getFailureExecutionProtocolStateV1: (selected: object) =>
        selected === protocol ? protocolState : undefined,
      getReductionExecutionIsolationStateV1: (selected: object) =>
        selected === isolation ? { protocol, executor } : undefined,
    }));
    vi.doMock("./execution-report-provenance.js", () => ({
      getExecutionReportOccurrencePayloadV1: (selected: { readonly payload?: unknown }) =>
        selected.payload,
    }));
    const sidecar = Object.freeze({
      revision: "failure-predicate-evidence-v1",
      digest: EVIDENCE,
    });
    vi.doMock("./failure-predicate-evidence.js", () => ({
      consumeHandledFailurePredicateEvidenceV1: () => sidecar,
    }));

    const routes = await import("./failure-route-adapter.js");
    expect(
      await routes.executeFailureOriginalRouteV1(
        execution as never,
        protocol as never,
        isolation as never,
      ),
    ).toMatchObject({ ok: true });
    selectedOccurrence = occurrences[1];
    expect(
      await routes.executeFailureOriginalRouteV1(
        execution as never,
        protocol as never,
        isolation as never,
      ),
    ).toMatchObject({ ok: true });
    expect(
      await routes.executeConsumedFailureCandidateV1(
        execution as never,
        protocol as never,
        isolation as never,
        {
          candidate: {
            originalRoute: predicate.routeContract,
            predicate,
            candidateExecutionIdentity: CANDIDATE,
          },
          payload: { kind: "typed-valid", sourceBytes: new Uint8Array([9]) },
        } as never,
      ),
    ).toMatchObject({ ok: true });

    expect(adaptedIdentities).toEqual([ORIGINAL_ONE, ORIGINAL_TWO, CANDIDATE]);
    expect(dispatchedIdentities).toEqual([ORIGINAL_ONE, ORIGINAL_TWO, CANDIDATE]);
    expect(adaptedIdentities).not.toContain(EXECUTION_ONE);
    expect(adaptedIdentities).not.toContain(EXECUTION_TWO);
    expect(routes.getFailureExecutionOriginalRequestV1({} as never)).toBeUndefined();
    expect(
      await routes.executeConsumedFailureCandidateV1(
        execution as never,
        protocol as never,
        isolation as never,
        {
          candidate: {
            originalRoute: { terminalTier: "vice" },
            predicate,
            candidateExecutionIdentity: CANDIDATE,
          },
          payload: { kind: "typed-valid", sourceBytes: new Uint8Array([9]) },
        } as never,
      ),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "execution.identity", path: "/candidate" }],
    });
  });
});
