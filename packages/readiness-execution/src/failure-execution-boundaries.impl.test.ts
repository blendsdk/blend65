import { createHash } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExecutionRoutePlanItemV1, Sha256Digest } from "@blend65/readiness";
import type { ExecutionRouteRequestV1 } from "./execution-route-adapters.js";
import type { CreateCandidateExecutionRouteRequestInputV1 } from "./failure-candidate-route-state.js";
import {
  createFailureExecutionSpecFixtureV1,
  type FailureExecutionSpecFixtureV1,
} from "./test-fixtures/failure-execution-spec-fixture.js";

const openFixtures = new Set<FailureExecutionSpecFixtureV1>();

function digest(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function fixture(): Promise<FailureExecutionSpecFixtureV1> {
  const value = await createFailureExecutionSpecFixtureV1("standalone-stable");
  openFixtures.add(value);
  return value;
}

afterEach(async () => {
  for (const value of openFixtures) await value.cleanup();
  openFixtures.clear();
});

describe("failure execution boundary coverage", () => {
  it("rejects hostile exact-input shapes and unknown predicate contracts", async () => {
    const operation = await vi.importActual<typeof import("./failure-execution-operation.js")>(
      "./failure-execution-operation.js",
    );
    const contracts = await vi.importActual<typeof import("./execution-predicate-contracts.js")>(
      "./execution-predicate-contracts.js",
    );

    expect(operation.failureExecutionIssueV1("unbound-capability", "/x", "x")).toMatchObject({
      ok: false,
      issues: [{ code: "unbound-capability" }],
    });
    expect(operation.failureExecutionSuccessV1(1)).toEqual({ ok: true, value: 1 });
    expect(operation.historicalFailureExecutionIssueV1("/x", "x")).toMatchObject({
      ok: false,
      issues: [{ code: "historical-authority-unavailable" }],
    });
    expect(operation.snapshotExactFailureExecutionInputV1(null, [])).toBeUndefined();
    expect(operation.snapshotExactFailureExecutionInputV1([], [])).toBeUndefined();
    expect(operation.snapshotExactFailureExecutionInputV1(new (class {})(), [])).toBeUndefined();
    expect(operation.snapshotExactFailureExecutionInputV1({ x: 1, y: 2 }, ["x"])).toBeUndefined();
    expect(
      operation.snapshotExactFailureExecutionInputV1(
        Object.defineProperty({}, "x", { get: () => 1, enumerable: true }),
        ["x"],
      ),
    ).toBeUndefined();
    expect(
      operation.snapshotExactFailureExecutionInputV1(
        Object.defineProperty({}, "x", { value: 1, enumerable: false }),
        ["x"],
      ),
    ).toBeUndefined();
    expect(
      operation.snapshotExactFailureExecutionInputV1(
        new Proxy(
          {},
          {
            ownKeys: () => {
              throw new TypeError("hostile");
            },
          },
        ),
        [],
      ),
    ).toBeUndefined();
    expect(
      operation.snapshotExactFailureExecutionInputV1(Object.assign(Object.create(null), { x: 1 }), [
        "x",
      ]),
    ).toEqual({ x: 1 });

    const route = {
      terminalTier: "frontend",
      prerequisiteTiers: [],
    } as unknown as ExecutionRoutePlanItemV1;
    expect(
      contracts.createFailurePredicateEvidenceCompletionV1(route, "not-a-digest"),
    ).toBeUndefined();
    expect(
      contracts.createFailurePredicateEvidenceCompletionV1(
        { ...route, terminalTier: "unknown-tier" } as unknown as ExecutionRoutePlanItemV1,
        digest("oracle"),
      ),
    ).toBeUndefined();
    expect(
      contracts.createFailurePredicateEvidenceCompletionV1(route, digest("oracle")),
    ).toMatchObject({
      oracleContractDigest: digest("oracle"),
    });
  });

  it("guards candidate route construction before private state is retained", async () => {
    const value = await fixture();
    const readiness =
      await vi.importActual<typeof import("@blend65/readiness")>("@blend65/readiness");
    const candidateRoutes = await vi.importActual<
      typeof import("./failure-candidate-route-state.js")
    >("./failure-candidate-route-state.js");
    const origin = readiness.getFailureEnvelopeProjectionV1(value.origin as never);
    expect(origin.ok).toBe(true);
    if (!origin.ok) throw new TypeError("Expected failure envelope projection.");
    const originalRequest = value.originalRequest as ExecutionRouteRequestV1;
    const workerExecutor = Object.freeze({
      async start() {
        throw new TypeError("not launched");
      },
      async shutdown() {},
    });
    const input: CreateCandidateExecutionRouteRequestInputV1 = {
      originalRequest,
      payload: origin.value.initialCandidate,
      predicate: origin.value.predicate,
      subjectDigest: originalRequest.route.caseIdentity as Sha256Digest,
      workerExecutor,
    };

    expect(candidateRoutes.getCandidateExecutionRouteStateV1(null as never)).toBeUndefined();
    expect(
      candidateRoutes.createCandidateExecutionRouteRequestV1({
        ...input,
        originalRequest: {} as ExecutionRouteRequestV1,
      }),
    ).toMatchObject({ ok: false });
    expect(
      candidateRoutes.createCandidateExecutionRouteRequestV1({
        ...input,
        subjectDigest: "not-a-digest" as never,
      }),
    ).toMatchObject({ ok: false });
    expect(
      candidateRoutes.createCandidateExecutionRouteRequestV1({
        ...input,
        payload: { ...origin.value.initialCandidate, sourceBytes: new Uint8Array() },
      }),
    ).toMatchObject({ ok: false });

    const created = candidateRoutes.createCandidateExecutionRouteRequestV1(input);
    expect(created.ok).toBe(true);
    if (!created.ok) throw new TypeError("Expected candidate route.");
    expect(candidateRoutes.getCandidateExecutionRouteStateV1(created.value)).toMatchObject({
      subjectDigest: originalRequest.route.caseIdentity,
    });
    expect(
      candidateRoutes.createCandidateExecutionRouteRequestV1({
        ...input,
        originalRequest: created.value,
      }),
    ).toMatchObject({ ok: false });
  }, 600_000);
});
