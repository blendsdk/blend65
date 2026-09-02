import { createHash } from "node:crypto";

import type { ExecutionResultV1, ExecutionRoutePlanItemV1 } from "@blend65/readiness";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExecutionRouteRequestV1 } from "./execution-route-adapters.js";
import {
  createFailureExecutionSpecFixtureV1,
  type FailureExecutionSpecFixtureV1,
} from "./test-fixtures/failure-execution-spec-fixture.js";

const openFixtures = new Set<FailureExecutionSpecFixtureV1>();
const USAGE = Object.freeze({
  wallMs: 0,
  outputBytes: 0,
  evidenceBytes: 0,
  instructions: 0,
  cycles: 0,
  launchAttempts: 0,
});

function digest(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function fixture(): Promise<FailureExecutionSpecFixtureV1> {
  const value = await createFailureExecutionSpecFixtureV1("standalone-stable");
  openFixtures.add(value);
  return value;
}

function pass(tier: ExecutionRoutePlanItemV1["terminalTier"]): ExecutionResultV1 {
  return Object.freeze({
    status: "pass",
    tier,
    stage: tier === "vice" ? "compare" : tier,
    code: "pass",
    usage: USAGE,
    evidence: Object.freeze({ digest: digest("pass"), retainedBytes: 0, truncated: false }),
  });
}

function compilerIce(tier: ExecutionRoutePlanItemV1["terminalTier"]): ExecutionResultV1 {
  return Object.freeze({
    status: "failure",
    tier,
    stage: tier === "vice" ? "compare" : tier,
    code: "compiler-ice",
    usage: USAGE,
    evidence: Object.freeze({ digest: digest("ice"), retainedBytes: 0, truncated: false }),
  });
}

afterEach(async () => {
  for (const value of openFixtures) await value.cleanup();
  openFixtures.clear();
});

describe("failure predicate evidence authority", () => {
  it("projects the logical observed payload length while retaining canonical identity bytes", async () => {
    const evidence = await vi.importActual<typeof import("./failure-predicate-evidence.js")>(
      "./failure-predicate-evidence.js",
    );
    const payload = new Uint8Array([0x10, 0x20, 0x30]);
    const first = evidence.createObservedFailureObservationEvidenceV1({
      kind: "scalar-bytes",
      bytes: payload,
    });
    const second = evidence.createObservedFailureObservationEvidenceV1({
      kind: "scalar-bytes",
      bytes: payload.slice(),
    });

    expect(evidence.getFailureObservationEvidenceProjectionV1(first!)).toMatchObject({
      revision: "failure-observation-evidence-projection-v1",
      kind: "observed",
      byteLength: payload.byteLength,
    });
    expect(evidence.getFailureObservationEvidenceProjectionV1(second!)).toEqual(
      evidence.getFailureObservationEvidenceProjectionV1(first!),
    );
  });

  it("binds ordinary and closed evidence to one exact result and consumes registrations once", async () => {
    const value = await fixture();
    const readiness =
      await vi.importActual<typeof import("@blend65/readiness")>("@blend65/readiness");
    const contracts = await vi.importActual<typeof import("./execution-predicate-contracts.js")>(
      "./execution-predicate-contracts.js",
    );
    const evidence = await vi.importActual<typeof import("./failure-predicate-evidence.js")>(
      "./failure-predicate-evidence.js",
    );
    const association = await vi.importActual<
      typeof import("./execution-report-predicate-association.js")
    >("./execution-report-predicate-association.js");
    const request = value.originalRequest as ExecutionRouteRequestV1;
    const origin = readiness.getFailureEnvelopeProjectionV1(value.origin as never);
    expect(origin.ok).toBe(true);
    if (!origin.ok) throw new TypeError("Expected failure envelope projection.");
    const completion = contracts.createFailurePredicateEvidenceCompletionV1(
      request.route,
      origin.value.predicate.routeContract.oracleContractDigest,
    );
    expect(completion).toBeDefined();
    if (completion === undefined) throw new TypeError("Expected predicate completion.");

    const handledResult = pass(request.route.terminalTier);
    expect(evidence.registerHandledFailurePredicateEvidenceV1(request, handledResult)).toBe(true);
    expect(evidence.registerHandledFailurePredicateEvidenceV1(request, handledResult)).toBe(false);
    const ordinary = evidence.consumeHandledFailurePredicateEvidenceV1(
      handledResult,
      handledResult,
      completion,
    );
    expect(ordinary).toBeDefined();
    expect(
      evidence.consumeHandledFailurePredicateEvidenceV1(handledResult, handledResult, completion),
    ).toBe(undefined);
    expect(evidence.getFailurePredicateEvidenceProjectionV1(ordinary!)).toMatchObject({
      kind: "ordinary-route-facts",
      subjectDigest: request.route.caseIdentity,
      predicateBasis: { kind: "pass" },
      outcome: { code: "pass", cleanup: "clear" },
    });

    const substituted = pass(request.route.terminalTier);
    const substitutedSidecar = evidence.createClosedNonExecutedFailurePredicateEvidenceV1(
      request,
      substituted,
      substituted,
      "injected-substitution",
      completion,
    );
    expect(evidence.getFailurePredicateEvidenceProjectionV1(substitutedSidecar!)).toMatchObject({
      kind: "closed-non-executed",
      disposition: "injected-substitution",
      predicateBasis: { kind: "pass" },
    });

    const caught = compilerIce(request.route.terminalTier);
    const caughtSidecar = evidence.createClosedNonExecutedFailurePredicateEvidenceV1(
      request,
      caught,
      caught,
      "caught-compiler-ice",
      completion,
    );
    expect(evidence.getFailurePredicateEvidenceProjectionV1(caughtSidecar!)).toMatchObject({
      kind: "closed-non-executed",
      disposition: "caught-compiler-ice",
      predicateBasis: {
        kind: "failure-ingredients",
        value: {
          resultCode: "compiler-ice",
          requiredClaimedRuleIds: [request.route.ruleId],
        },
      },
    });
    expect(evidence.failurePredicateEvidenceMatchesResultV1(caughtSidecar, caught)).toBe(true);
    expect(evidence.failurePredicateEvidenceMatchesResultV1(caughtSidecar, { ...caught })).toBe(
      false,
    );

    expect(evidence.isPredicateEvidenceAuthenticatedResultV1(caught)).toBe(true);
    expect(evidence.isPredicateEvidenceAuthenticatedResultV1(null)).toBe(false);
    expect(evidence.getFailurePredicateEvidenceProjectionV1({} as never)).toBeUndefined();
    expect(evidence.getFailurePredicateEvidenceProjectionV1(null as never)).toBeUndefined();
    expect(evidence.getFailurePredicateEvidenceStateV1(null)).toBeUndefined();
    expect(evidence.failurePredicateEvidenceMatchesResultV1(null, caught)).toBe(false);
    expect(evidence.failurePredicateEvidenceMatchesResultV1(caughtSidecar, null)).toBe(false);
    expect(evidence.registerHandledFailurePredicateEvidenceV1(request, null as never)).toBe(false);
    expect(
      evidence.consumeHandledFailurePredicateEvidenceV1(null as never, caught),
    ).toBeUndefined();

    const delayed = pass(request.route.terminalTier);
    expect(evidence.registerHandledFailurePredicateEvidenceV1(request, delayed)).toBe(true);
    expect(evidence.consumeHandledFailurePredicateEvidenceV1(delayed, delayed)).toBeUndefined();
    expect(
      evidence.consumeHandledFailurePredicateEvidenceV1(delayed, delayed, completion),
    ).toBeDefined();

    const bareDigestResult = Object.freeze({
      ...pass(request.route.terminalTier),
      evidence: Object.freeze({ digest: "b".repeat(64), retainedBytes: 32, truncated: false }),
    });
    const canonicalDigestResult = Object.freeze({
      ...bareDigestResult,
      evidence: Object.freeze({
        ...bareDigestResult.evidence,
        digest: `sha256:${bareDigestResult.evidence.digest}`,
      }),
    });
    expect(evidence.registerHandledFailurePredicateEvidenceV1(request, bareDigestResult)).toBe(
      true,
    );
    const canonicalSidecar = evidence.consumeHandledFailurePredicateEvidenceV1(
      bareDigestResult,
      canonicalDigestResult,
      completion,
    );
    expect(evidence.getFailurePredicateEvidenceProjectionV1(canonicalSidecar!)).toMatchObject({
      outcome: { evidenceDigest: canonicalDigestResult.evidence.digest },
    });
    expect(
      association.consumeExecutionReportPredicateSidecarsV1(
        [canonicalDigestResult],
        [canonicalSidecar],
        [canonicalDigestResult],
      ),
    ).toEqual([canonicalSidecar]);

    for (const invalidRequest of [
      { ...request, kind: "reduction-candidate-internal" },
      { ...request, kind: "valid-envelope", executionCase: {} },
      { ...request, kind: "invalid-diagnostic", diagnosticCase: {} },
      { ...request, kind: "raw-malformed", malformedCase: {} },
      { ...request, route: { ...request.route, caseIdentity: "not-a-digest" } },
    ]) {
      expect(
        evidence.createClosedNonExecutedFailurePredicateEvidenceV1(
          invalidRequest as ExecutionRouteRequestV1,
          caught,
          caught,
          "caught-compiler-ice",
          completion,
        ),
      ).toBeUndefined();
    }

    const invalidCompletion = {
      oracleContractDigest: "not-a-digest",
      toolContractDigests: [],
    } as never;
    expect(
      evidence.createClosedNonExecutedFailurePredicateEvidenceV1(
        request,
        compilerIce(request.route.terminalTier),
        caught,
        "caught-compiler-ice",
        invalidCompletion,
      ),
    ).toBeUndefined();
    const blocked = Object.freeze({
      ...compilerIce(request.route.terminalTier),
      adapterSubcode: "adapter.crash",
      cleanupBlocker: Object.freeze({ code: "cleanup", message: "blocked" }),
    }) as unknown as ExecutionResultV1;
    const blockedSidecar = evidence.createClosedNonExecutedFailurePredicateEvidenceV1(
      request,
      blocked,
      blocked,
      "caught-compiler-ice",
      completion,
    );
    expect(evidence.getFailurePredicateEvidenceProjectionV1(blockedSidecar!)).toMatchObject({
      outcome: { adapterSubcode: "adapter.crash", cleanup: "blocked" },
    });

    const viceBuildEvidenceBytes = new TextEncoder().encode("sealed VICE build evidence");
    const viceFailure = Object.freeze({
      ...compilerIce("vice"),
      usage: Object.freeze({ ...USAGE, evidenceBytes: viceBuildEvidenceBytes.byteLength }),
      evidence: Object.freeze({
        digest: digest(new TextDecoder().decode(viceBuildEvidenceBytes)),
        retainedBytes: viceBuildEvidenceBytes.byteLength,
        truncated: false,
      }),
    });
    expect(
      evidence.registerHandledFailurePredicateEvidenceV1(
        request,
        viceFailure,
        evidence.createNotReachedFailureObservationEvidenceV1(viceFailure),
      ),
    ).toBe(true);
    const viceSidecar = evidence.consumeHandledFailurePredicateEvidenceV1(
      viceFailure,
      viceFailure,
      completion,
    );
    expect(viceSidecar).toBeDefined();
    const firstViceBytes = evidence.getFailurePredicateEvidenceObservationBytesV1(viceSidecar!);
    const expectedTerminalBytes = new TextEncoder().encode(
      JSON.stringify({
        revision: "terminal-observation-facts-v1",
        stage: viceFailure.stage,
        code: viceFailure.code,
        adapterSubcode: null,
      }),
    );
    expect(firstViceBytes).toEqual(expectedTerminalBytes);
    if (firstViceBytes === undefined) throw new TypeError("Expected retained VICE evidence bytes.");
    firstViceBytes[0] = 0xff;
    expect(evidence.getFailurePredicateEvidenceObservationBytesV1(viceSidecar!)).toEqual(
      expectedTerminalBytes,
    );

    expect(
      association.consumeExecutionReportPredicateSidecarsV1([], [ordinary], []),
    ).toBeUndefined();
    expect(
      association.consumeExecutionReportPredicateSidecarsV1(
        [handledResult],
        [null],
        [handledResult],
      ),
    ).toBeUndefined();
    expect(
      association.consumeExecutionReportPredicateSidecarsV1(
        [substituted, substituted],
        [substitutedSidecar, substitutedSidecar],
        [substituted, substituted],
      ),
    ).toBeUndefined();
    expect(
      association.consumeExecutionReportPredicateSidecarsV1([caught], [caughtSidecar], [caught]),
    ).toEqual([caughtSidecar]);
    expect(
      association.consumeExecutionReportPredicateSidecarsV1([blocked], [blockedSidecar], [blocked]),
    ).toEqual([blockedSidecar]);
    expect(
      association.consumeExecutionReportPredicateSidecarsV1(
        [handledResult],
        [ordinary],
        [handledResult],
      ),
    ).toEqual([ordinary]);
    expect(
      association.consumeExecutionReportPredicateSidecarsV1(
        [handledResult],
        [ordinary],
        [handledResult],
      ),
    ).toBeUndefined();
    expect(
      association.consumeExecutionReportPredicateSidecarsV1(
        [caught],
        [substitutedSidecar],
        [substituted],
      ),
    ).toBeUndefined();
  });
});
