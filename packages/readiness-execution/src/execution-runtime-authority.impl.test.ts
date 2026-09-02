import { createHash } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createPublishedRuntimeEvaluationAuthorityV1,
  evaluatePublishedRuntimeObservationV1,
  getExecutionCaseProjectionV1,
  getPublishedRuntimeEvaluationProjectionV1,
  type PublishedRuntimeEvaluationAuthorityV1,
  type PublishedOracleContext,
} from "@blend65/readiness";

import { createExecutionRouteRequestV1 } from "./execution-route-adapters.js";
import {
  claimBoundViceRouteV1,
  finalizeViceEvaluationEvidenceV1,
  getFinalViceResultObservationEvidenceV1,
  sealBoundViceRouteV1,
  type SealedViceBuildBaselineV1,
} from "./execution-vice-evaluation.js";
import { getFailureObservationEvidenceProjectionV1 } from "./failure-predicate-evidence.js";
import { FIXED_EVALUATED_VICE_HANDLER_IDENTITY_DIGEST_V1 } from "./execution-vice-handler-identity.js";
import { createViceExecutionRuntimeV1, executeEvaluatedViceRouteV1 } from "./execution-vice.js";
import { ViceExecutionCoordinator } from "./execution-vice-runtime.js";
import * as publicApi from "./index.js";
import type {
  ViceExecutionHostV1,
  ViceLeaseNodeIdentityV1,
  ViceLeaseSnapshotV1,
  ViceRouteRequestV1,
} from "./execution-vice-types.js";
import type { RouteApi } from "./test-fixtures/execution-adapters-safety-spec-fixture.js";
import {
  createRuntimeAcceptanceFixture,
  type RuntimeAcceptanceFixture,
} from "./test-fixtures/execution-runtime-acceptance-spec-fixture.js";

let fixture: RuntimeAcceptanceFixture | undefined;

beforeAll(async () => {
  const routeApi: RouteApi = {
    createExecutionRouteRequestV1(input) {
      const created = createExecutionRouteRequestV1(input);
      if (!created.ok) return created;
      if (created.value.kind !== "valid-envelope") {
        throw new TypeError("Expected a valid execution route.");
      }
      return {
        ok: true,
        value: {
          route: created.value.route,
          executionCase: created.value.executionCase,
          oracle: created.value.oracle,
          policy: created.value.policy,
        },
      };
    },
  };
  fixture = await createRuntimeAcceptanceFixture(routeApi);
});

afterAll(async () => {
  await fixture?.cleanup();
});

function runtimeFixture(): RuntimeAcceptanceFixture {
  if (fixture === undefined) throw new TypeError("Runtime fixture is unavailable.");
  return fixture;
}

function value<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false }): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError("Expected runtime authority success.");
  return result.value;
}

function authority(index = 0): PublishedRuntimeEvaluationAuthorityV1 {
  const current = runtimeFixture();
  const selected = current.cases[index];
  if (selected === undefined) throw new TypeError("Missing fixed runtime case.");
  return value(
    createPublishedRuntimeEvaluationAuthorityV1(current.context, selected.executionCase),
  );
}

function actual(
  evaluation: PublishedRuntimeEvaluationAuthorityV1,
  bytes: Uint8Array,
): Record<string, unknown> {
  const projection = value(getPublishedRuntimeEvaluationProjectionV1(evaluation));
  return projection.observation.kind === "scalar-bytes"
    ? {
        revision: "runtime-actual-observation-v1",
        sourceCaseDigest: projection.sourceCaseDigest,
        kind: "scalar-bytes",
        bytes,
      }
    : {
        revision: "runtime-actual-observation-v1",
        sourceCaseDigest: projection.sourceCaseDigest,
        kind: "direct-mmio",
        address: projection.observation.address,
        projectionRevision: projection.observation.projectionRevision,
        bytes,
      };
}

function evaluatedRoute(evaluation: PublishedRuntimeEvaluationAuthorityV1): ViceRouteRequestV1 {
  const projection = value(getPublishedRuntimeEvaluationProjectionV1(evaluation));
  const resultAddresses =
    projection.observation.kind === "scalar-bytes"
      ? Array.from({ length: projection.observation.byteLength }, (_, index) => 0x2000 + index)
      : [];
  return {
    binary: Uint8Array.of(0x60),
    loadAddress: 0x0801,
    entryAddress: 0x0810,
    fixture: projection.fixture,
    layout: {
      revision: "execution-observation-layout-v1",
      resultSymbols: resultAddresses.map((_, index) => `result-${index}`),
      resultAddresses,
      completionSymbol: "completion",
      completionAddress: 0x2004,
      postEntryStores: [
        ...resultAddresses.map((address, index) => ({
          instructionAddress: 0x0812 + index * 3,
          targetAddress: address,
          kind: "observation-byte" as const,
          byteIndex: index as 0 | 1,
        })),
        {
          instructionAddress: 0x0820,
          targetAddress: 0x2004,
          kind: "completion" as const,
          value: 165 as const,
        },
      ],
      proofDigest: "a".repeat(64),
    },
    observation: projection.observation,
    policy: {
      revision: "execution-policy-v1",
      budget: {
        operationMs: 60_000,
        launchAttemptMs: 15_000,
        routeMs: 120_000,
        cleanupGraceMs: 3_000,
        outputBytes: 1_048_576,
        evidenceBytes: 16_777_216,
        instructions: 65_535,
        cycles: 100_000_000,
        launchAttempts: 1,
      },
    },
  };
}

function buildBaseline(
  route: ViceRouteRequestV1,
  usage: Partial<SealedViceBuildBaselineV1["usage"]> = {},
): SealedViceBuildBaselineV1 {
  const evidenceBytes = usage.evidenceBytes ?? 0;
  return Object.freeze({
    startedAtMonotonicMs: 0,
    workDeadlineMonotonicMs: route.policy.budget.routeMs - route.policy.budget.cleanupGraceMs,
    hardDeadlineMonotonicMs: route.policy.budget.routeMs,
    usage: Object.freeze({
      wallMs: 0,
      outputBytes: 0,
      evidenceBytes,
      instructions: 0,
      cycles: 0,
      launchAttempts: 0,
      ...usage,
    }),
    evidence: Object.freeze({
      digest: `sha256:${"b".repeat(64)}`,
      retainedBytes: evidenceBytes,
      truncated: false,
    }),
  });
}

function productionDeadlineHost(now: { value: number }): {
  readonly host: ViceExecutionHostV1;
  readonly endpointCalls: () => number;
} {
  const directory: ViceLeaseNodeIdentityV1 = {
    device: 1n,
    inode: 2n,
    uid: 1000,
    mode: 0o700,
    links: 1,
  };
  const file: ViceLeaseNodeIdentityV1 = {
    device: 1n,
    inode: 3n,
    uid: 1000,
    mode: 0o600,
    links: 1,
  };
  let endpoints = 0;
  let snapshot: ViceLeaseSnapshotV1 = { kind: "absent", directory };
  const present = (bytes: Uint8Array): Extract<ViceLeaseSnapshotV1, { kind: "present" }> => {
    const owned = bytes.slice();
    const reference = {
      directory,
      file,
      bytesDigest: createHash("sha256").update(owned).digest("hex"),
    };
    return { kind: "present", directory, file, bytes: owned, reference };
  };
  const host: ViceExecutionHostV1 = {
    platform: async () => ({ ok: true, value: "linux" }),
    effectiveUid: async () => ({ ok: true, value: 1000 }),
    nowMonotonicMilliseconds: () => now.value,
    delay: async () => "elapsed",
    randomBytes: () => new Uint8Array(32).fill(7),
    observeLease: async () => ({ ok: true, value: snapshot }),
    tryCreateLease: async (_target, _expectedDirectory, bytes) => {
      snapshot = present(bytes);
      return { ok: true, value: { kind: "created", snapshot } };
    },
    compareReplaceLease: async () => ({ ok: true, value: { kind: "changed" } }),
    compareRemoveLease: async () => {
      snapshot = { kind: "absent", directory };
      return { ok: true, value: { kind: "removed" } };
    },
    compareRemoveLaunchArtifact: async () => ({ ok: true, value: "missing" }),
    observeProcess: async () => ({ ok: true, value: null }),
    allocateLoopbackEndpoints: async () => {
      endpoints += 1;
      return { ok: true, value: { binaryPort: 20_000, textPort: 20_001 } };
    },
    createControlAttempt: async () => {
      throw new TypeError("A deadline failure must not create a monitor host.");
    },
    revalidateAndTerminateVice: async () => ({ ok: true, value: "already-exited" }),
  };
  return Object.freeze({ host, endpointCalls: () => endpoints });
}

describe("published runtime evaluation authority implementation", () => {
  it("requires exact post-build binding on the production facade", async () => {
    const evaluation = authority();
    const route = evaluatedRoute(evaluation);

    await expect(
      Reflect.apply(executeEvaluatedViceRouteV1, undefined, [
        { route, evaluation },
        {},
        new AbortController().signal,
      ]),
    ).resolves.toMatchObject({
      status: "failure",
      stage: "input",
      code: "invalid-evidence-input",
    });
  });

  it("does not expose any raw route or handler-based production minting seam", () => {
    expect(publicApi).not.toHaveProperty("bindEvaluatedViceRouteV1");
    expect(publicApi).not.toHaveProperty("sealBoundViceRouteV1");
    expect(publicApi).not.toHaveProperty("createEvaluatedViceHandlersV1");
    expect(publicApi).not.toHaveProperty("getFinalViceResultObservationEvidenceV1");
    expect(Reflect.apply(claimBoundViceRouteV1, undefined, [null])).toBeUndefined();
  });

  it("rejects a sealed production capability on an injected host without host effects", async () => {
    const selected = runtimeFixture().cases[0]!;
    const execution = value(getExecutionCaseProjectionV1(selected.executionCase));
    const evaluation = authority();
    const sealed = value(
      sealBoundViceRouteV1({
        sourceCaseDigest: execution.sourceCaseDigest,
        routeIdentity: `sha256:${"4".repeat(64)}`,
        handlerIdentityDigest: FIXED_EVALUATED_VICE_HANDLER_IDENTITY_DIGEST_V1,
        route: evaluatedRoute(evaluation),
        evaluation,
        baseline: buildBaseline(evaluatedRoute(evaluation)),
      }),
    );
    const hostileHost = new Proxy(
      {},
      {
        get: () => {
          throw new TypeError("Injected host must not be consulted.");
        },
      },
    ) as ViceExecutionHostV1;
    const runtime = createViceExecutionRuntimeV1(hostileHost);
    await expect(
      Reflect.apply(runtime.executeEvaluatedViceRoute, runtime, [
        sealed,
        {},
        new AbortController().signal,
      ]),
    ).resolves.toMatchObject({
      status: "failure",
      stage: "input",
      code: "invalid-evidence-input",
    });
  });

  it("uses the sealed preparation deadline and cumulative build usage", async () => {
    const now = { value: 0 };
    const fixture = productionDeadlineHost(now);
    const runtime = new ViceExecutionCoordinator(fixture.host);
    const lease = value(await runtime.acquireViceLease("c64", new AbortController().signal));
    const selected = runtimeFixture().cases[0]!;
    const execution = value(getExecutionCaseProjectionV1(selected.executionCase));
    const evaluation = authority();
    const route = evaluatedRoute(evaluation);
    const evidenceBytes = new TextEncoder().encode("0123456789");
    const initialBaseline = buildBaseline(route, {
      wallMs: 5,
      outputBytes: 23,
      evidenceBytes: evidenceBytes.byteLength,
    });
    const baseline = Object.freeze({
      ...initialBaseline,
      evidence: Object.freeze({
        ...initialBaseline.evidence,
        digest: `sha256:${createHash("sha256").update(evidenceBytes).digest("hex")}`,
      }),
    });
    const sealed = value(
      sealBoundViceRouteV1({
        sourceCaseDigest: execution.sourceCaseDigest,
        routeIdentity: `sha256:${"7".repeat(64)}`,
        handlerIdentityDigest: FIXED_EVALUATED_VICE_HANDLER_IDENTITY_DIGEST_V1,
        route,
        evaluation,
        baseline,
      }),
    );
    now.value = baseline.workDeadlineMonotonicMs + 1;

    const result = await runtime.executeBoundEvaluatedViceRoute(
      sealed,
      lease,
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      status: "failure",
      stage: "vice-launch",
      code: "wall-time-exhaustion",
      usage: {
        wallMs: baseline.workDeadlineMonotonicMs + 1,
        outputBytes: 23,
        evidenceBytes: expect.any(Number),
        launchAttempts: 0,
      },
      evidence: { retainedBytes: expect.any(Number), truncated: false },
    });
    const observation = getFinalViceResultObservationEvidenceV1(result);
    expect(getFailureObservationEvidenceProjectionV1(observation!)).toMatchObject({
      revision: "failure-observation-evidence-projection-v1",
      kind: "not-reached",
      digest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      byteLength: expect.any(Number),
    });
    expect(getFinalViceResultObservationEvidenceV1({ ...result })).toBeUndefined();
    expect(fixture.endpointCalls()).toBe(0);
  });

  it("reproduces terminal evidence across fresh builds and distinguishes terminal facts", () => {
    const terminal = Object.freeze({
      status: "failure" as const,
      tier: "vice" as const,
      stage: "vice-launch" as const,
      code: "emulator-launch-failure" as const,
      usage: Object.freeze({
        wallMs: 1,
        outputBytes: 2,
        evidenceBytes: 3,
        instructions: 4,
        cycles: 5,
        launchAttempts: 1,
      }),
      evidence: Object.freeze({
        digest: `sha256:${"a".repeat(64)}`,
        retainedBytes: 3,
        truncated: false,
      }),
    });
    const fresh = Object.freeze({
      ...terminal,
      usage: Object.freeze({ ...terminal.usage, wallMs: 9_999, outputBytes: 99 }),
      evidence: Object.freeze({
        digest: `sha256:${"b".repeat(64)}`,
        retainedBytes: 999,
        truncated: false,
      }),
    });
    const historical = finalizeViceEvaluationEvidenceV1(terminal, 1_024);
    const candidate = finalizeViceEvaluationEvidenceV1(fresh, 1_024);
    expect(
      getFailureObservationEvidenceProjectionV1(
        getFinalViceResultObservationEvidenceV1(historical)!,
      ),
    ).toEqual(
      getFailureObservationEvidenceProjectionV1(
        getFinalViceResultObservationEvidenceV1(candidate)!,
      ),
    );
    expect(historical.evidence).toEqual(candidate.evidence);

    for (const mismatch of [
      Object.freeze({ ...terminal, stage: "vice-handshake" as const }),
      Object.freeze({ ...terminal, code: "emulator-handshake-failure" as const }),
      Object.freeze({ ...terminal, adapterSubcode: "adapter.timeout" }),
    ]) {
      const finalized = finalizeViceEvaluationEvidenceV1(mismatch, 1_024);
      expect(
        getFailureObservationEvidenceProjectionV1(
          getFinalViceResultObservationEvidenceV1(finalized)!,
        ),
      ).not.toEqual(
        getFailureObservationEvidenceProjectionV1(
          getFinalViceResultObservationEvidenceV1(historical)!,
        ),
      );
    }
    const blockedOne = finalizeViceEvaluationEvidenceV1(
      Object.freeze({
        ...terminal,
        cleanupBlocker: Object.freeze({
          code: "emulator-lease-recovery-blocked" as const,
          evidenceDigest: `sha256:${"1".repeat(64)}`,
        }),
      }),
      1_024,
    );
    const blockedTwo = finalizeViceEvaluationEvidenceV1(
      Object.freeze({
        ...fresh,
        cleanupBlocker: Object.freeze({
          code: "emulator-lease-recovery-blocked" as const,
          evidenceDigest: `sha256:${"2".repeat(64)}`,
        }),
      }),
      1_024,
    );
    expect(
      getFailureObservationEvidenceProjectionV1(
        getFinalViceResultObservationEvidenceV1(blockedOne)!,
      ),
    ).toEqual(
      getFailureObservationEvidenceProjectionV1(
        getFinalViceResultObservationEvidenceV1(blockedTwo)!,
      ),
    );
    const exhausted = finalizeViceEvaluationEvidenceV1(terminal, 1);
    expect(exhausted).toMatchObject({
      status: "failure",
      stage: "compare",
      code: "evidence-exhaustion",
      usage: { evidenceBytes: 0 },
      evidence: { retainedBytes: 0, truncated: false },
    });
    expect(
      getFailureObservationEvidenceProjectionV1(
        getFinalViceResultObservationEvidenceV1(exhausted)!,
      ),
    ).toMatchObject({ kind: "not-reached" });
  });

  it("reserves evaluated evidence capacity from the sealed build baseline", async () => {
    const now = { value: 0 };
    const fixture = productionDeadlineHost(now);
    const runtime = new ViceExecutionCoordinator(fixture.host);
    const lease = value(await runtime.acquireViceLease("c64", new AbortController().signal));
    const selected = runtimeFixture().cases[1]!;
    const execution = value(getExecutionCaseProjectionV1(selected.executionCase));
    const evaluation = authority(1);
    const route = evaluatedRoute(evaluation);
    const baseline = buildBaseline(route, {
      outputBytes: 31,
      evidenceBytes: route.policy.budget.evidenceBytes - 31,
    });
    const sealed = value(
      sealBoundViceRouteV1({
        sourceCaseDigest: execution.sourceCaseDigest,
        routeIdentity: `sha256:${"8".repeat(64)}`,
        handlerIdentityDigest: FIXED_EVALUATED_VICE_HANDLER_IDENTITY_DIGEST_V1,
        route,
        evaluation,
        baseline,
      }),
    );

    await expect(
      runtime.executeBoundEvaluatedViceRoute(sealed, lease, new AbortController().signal),
    ).resolves.toMatchObject({
      status: "failure",
      stage: "compare",
      code: "evidence-exhaustion",
      usage: {
        outputBytes: 31,
        evidenceBytes: expect.any(Number),
        launchAttempts: 0,
      },
    });
    expect(fixture.endpointCalls()).toBe(0);
  });

  it("seals only an exact source pair and consumes a rejected cross-pair", async () => {
    const selected = runtimeFixture().cases[2]!;
    const evaluation = authority(2);
    const execution = value(getExecutionCaseProjectionV1(selected.executionCase));
    const route = evaluatedRoute(evaluation);
    const sealed = value(
      sealBoundViceRouteV1({
        sourceCaseDigest: execution.sourceCaseDigest,
        routeIdentity: `sha256:${"1".repeat(64)}`,
        handlerIdentityDigest: FIXED_EVALUATED_VICE_HANDLER_IDENTITY_DIGEST_V1,
        route,
        evaluation,
        baseline: buildBaseline(route),
      }),
    );
    expect(Object.keys(sealed)).toEqual([]);

    await expect(
      executeEvaluatedViceRouteV1({ ...sealed }, {} as never, new AbortController().signal),
    ).resolves.toMatchObject({
      status: "failure",
      stage: "input",
      code: "invalid-evidence-input",
    });

    const crossPaired = authority(2);
    expect(
      sealBoundViceRouteV1({
        sourceCaseDigest: `sha256:${"0".repeat(64)}`,
        routeIdentity: `sha256:${"2".repeat(64)}`,
        handlerIdentityDigest: FIXED_EVALUATED_VICE_HANDLER_IDENTITY_DIGEST_V1,
        route: evaluatedRoute(crossPaired),
        evaluation: crossPaired,
        baseline: buildBaseline(evaluatedRoute(crossPaired)),
      }),
    ).toMatchObject({ ok: false });
    expect(getPublishedRuntimeEvaluationProjectionV1(crossPaired)).toMatchObject({ ok: false });

    const staleDependencies = authority(2);
    expect(
      sealBoundViceRouteV1({
        sourceCaseDigest: execution.sourceCaseDigest,
        routeIdentity: `sha256:${"3".repeat(64)}`,
        handlerIdentityDigest: `sha256:${"f".repeat(64)}`,
        route: evaluatedRoute(staleDependencies),
        evaluation: staleDependencies,
        baseline: buildBaseline(evaluatedRoute(staleDependencies)),
      }),
    ).toMatchObject({ ok: false });
    expect(getPublishedRuntimeEvaluationProjectionV1(staleDependencies)).toMatchObject({
      ok: false,
    });

    const malformedIdentity = authority(2);
    const malformedIdentityRoute = evaluatedRoute(malformedIdentity);
    expect(
      sealBoundViceRouteV1({
        sourceCaseDigest: execution.sourceCaseDigest,
        routeIdentity: "not-a-digest",
        handlerIdentityDigest: FIXED_EVALUATED_VICE_HANDLER_IDENTITY_DIGEST_V1,
        route: malformedIdentityRoute,
        evaluation: malformedIdentity,
        baseline: buildBaseline(malformedIdentityRoute),
      }),
    ).toMatchObject({ ok: false });
    expect(getPublishedRuntimeEvaluationProjectionV1(malformedIdentity)).toMatchObject({
      ok: true,
    });

    const malformedBaseline = authority(2);
    const malformedBaselineRoute = evaluatedRoute(malformedBaseline);
    const baseline = buildBaseline(malformedBaselineRoute);
    expect(
      sealBoundViceRouteV1({
        sourceCaseDigest: execution.sourceCaseDigest,
        routeIdentity: `sha256:${"9".repeat(64)}`,
        handlerIdentityDigest: FIXED_EVALUATED_VICE_HANDLER_IDENTITY_DIGEST_V1,
        route: malformedBaselineRoute,
        evaluation: malformedBaseline,
        baseline: {
          ...baseline,
          evidence: { ...baseline.evidence, truncated: true },
        },
      }),
    ).toMatchObject({ ok: false });
    expect(getPublishedRuntimeEvaluationProjectionV1(malformedBaseline)).toMatchObject({
      ok: false,
    });
  });

  it("returns only passive identity, fixture and observation facts", () => {
    const projection = value(getPublishedRuntimeEvaluationProjectionV1(authority()));
    expect(Object.keys(projection).sort()).toEqual([
      "evaluationIdentity",
      "fixture",
      "observation",
      "schemaVersion",
      "selectedReleaseDigest",
      "sourceCaseDigest",
    ]);
    expect(projection).not.toHaveProperty("expectedBytes");
    expect(projection).not.toHaveProperty("expectedObservation");
  });

  it.each([
    [0, Uint8Array.of(0xf1)],
    [1, Uint8Array.of(0xf1, 0xf1)],
    [2, Uint8Array.of(0xf0)],
    [3, Uint8Array.of(0xf0, 0xf0)],
  ])("decodes and matches the fixed byte shape for case %i", (index, bytes) => {
    const evaluation = authority(index);
    expect(
      evaluatePublishedRuntimeObservationV1(evaluation, actual(evaluation, bytes)),
    ).toMatchObject({ ok: true, value: { outcome: "match" } });
  });

  it("returns semantic mismatch for a wrong source identity and consumes the authority", () => {
    const evaluation = authority();
    const candidate = actual(evaluation, Uint8Array.of(0xf1));
    candidate.sourceCaseDigest = `sha256:${"0".repeat(64)}`;
    expect(evaluatePublishedRuntimeObservationV1(evaluation, candidate)).toMatchObject({
      ok: true,
      value: { outcome: "semantic-mismatch" },
    });
    expect(evaluatePublishedRuntimeObservationV1(evaluation, candidate)).toMatchObject({
      ok: false,
    });
    expect(getPublishedRuntimeEvaluationProjectionV1(evaluation)).toMatchObject({ ok: false });
  });

  it("rejects forged constructor and projection authorities", () => {
    const current = runtimeFixture();
    expect(createPublishedRuntimeEvaluationAuthorityV1(current.context, {} as never)).toMatchObject(
      { ok: false },
    );
    expect(
      createPublishedRuntimeEvaluationAuthorityV1(
        {} as PublishedOracleContext,
        current.cases[0]!.executionCase,
      ),
    ).toMatchObject({ ok: false });
    expect(
      Reflect.apply(getPublishedRuntimeEvaluationProjectionV1, undefined, [null]),
    ).toMatchObject({ ok: false });
    expect(
      Reflect.apply(evaluatePublishedRuntimeObservationV1, undefined, [null, null]),
    ).toMatchObject({ ok: false });
  });

  it("consumes before rejecting malformed hostile actual input", () => {
    const evaluation = authority();
    expect(
      evaluatePublishedRuntimeObservationV1(evaluation, { kind: "scalar-bytes" }),
    ).toMatchObject({ ok: false });
    expect(
      evaluatePublishedRuntimeObservationV1(evaluation, actual(authority(), Uint8Array.of(0xf1))),
    ).toMatchObject({ ok: false });
  });

  it("rejects accessors, extra keys, byte subclasses and forged authority", () => {
    const accessor = Object.defineProperty({}, "kind", {
      enumerable: true,
      get: () => "scalar-bytes",
    });
    expect(evaluatePublishedRuntimeObservationV1(authority(), accessor)).toMatchObject({
      ok: false,
    });

    const withExtra = actual(authority(), Uint8Array.of(0xf1));
    withExtra.extra = true;
    expect(evaluatePublishedRuntimeObservationV1(authority(), withExtra)).toMatchObject({
      ok: false,
    });

    const buffered = actual(authority(), Buffer.from([0xf1]));
    expect(evaluatePublishedRuntimeObservationV1(authority(), buffered)).toMatchObject({
      ok: false,
    });

    expect(Reflect.apply(getPublishedRuntimeEvaluationProjectionV1, undefined, [{}])).toMatchObject(
      { ok: false },
    );
  });

  it.each([
    ["null", () => null],
    ["array", () => []],
    ["null prototype", () => Object.create(null)],
    [
      "prototype trap",
      () =>
        new Proxy(
          {},
          {
            getPrototypeOf: () => {
              throw new TypeError("blocked");
            },
          },
        ),
    ],
    ["unknown kind", () => ({ kind: "unknown" })],
    [
      "non-enumerable kind",
      () => Object.defineProperty({}, "kind", { value: "scalar-bytes", enumerable: false }),
    ],
    [
      "accessor revision",
      (base: Record<string, unknown>) =>
        Object.defineProperty({ ...base }, "revision", {
          enumerable: true,
          get: () => "runtime-actual-observation-v1",
        }),
    ],
    ["wrong revision", (base: Record<string, unknown>) => ({ ...base, revision: "wrong" })],
    ["non-string identity", (base: Record<string, unknown>) => ({ ...base, sourceCaseDigest: 1 })],
    ["array bytes", (base: Record<string, unknown>) => ({ ...base, bytes: [0xf1] })],
    ["empty bytes", (base: Record<string, unknown>) => ({ ...base, bytes: new Uint8Array() })],
    [
      "oversized bytes",
      (base: Record<string, unknown>) => ({ ...base, bytes: Uint8Array.of(1, 2, 3) }),
    ],
    ["symbol key", (base: Record<string, unknown>) => ({ ...base, [Symbol("unexpected")]: true })],
  ])("consumes the authority before rejecting hostile %s input", (_name, createCandidate) => {
    const evaluation = authority();
    const base = actual(evaluation, Uint8Array.of(0xf1));
    expect(evaluatePublishedRuntimeObservationV1(evaluation, createCandidate(base))).toMatchObject({
      ok: false,
    });
    expect(getPublishedRuntimeEvaluationProjectionV1(evaluation)).toMatchObject({ ok: false });
  });

  it.each([
    ["non-number address", (base: Record<string, unknown>) => ({ ...base, address: "53280" })],
    ["negative address", (base: Record<string, unknown>) => ({ ...base, address: -1 })],
    ["oversized address", (base: Record<string, unknown>) => ({ ...base, address: 65_536 })],
    [
      "wrong projection",
      (base: Record<string, unknown>) => ({ ...base, projectionRevision: "unknown" }),
    ],
  ])("rejects a direct observation with %s", (_name, mutate) => {
    const evaluation = authority(2);
    const base = actual(evaluation, Uint8Array.of(0xf0));
    expect(evaluatePublishedRuntimeObservationV1(evaluation, mutate(base))).toMatchObject({
      ok: false,
    });
  });

  it("returns semantic mismatch for valid but wrong observation shape and bytes", () => {
    const wrongWidth = authority();
    expect(
      evaluatePublishedRuntimeObservationV1(
        wrongWidth,
        actual(wrongWidth, Uint8Array.of(0xf1, 0xf1)),
      ),
    ).toMatchObject({ ok: true, value: { outcome: "semantic-mismatch" } });

    const wrongKind = authority();
    const projection = value(getPublishedRuntimeEvaluationProjectionV1(wrongKind));
    expect(
      evaluatePublishedRuntimeObservationV1(wrongKind, {
        revision: "runtime-actual-observation-v1",
        sourceCaseDigest: projection.sourceCaseDigest,
        kind: "direct-mmio",
        address: 0xd020,
        projectionRevision: "c64-vic-color-observation-v1",
        bytes: Uint8Array.of(0xf1),
      }),
    ).toMatchObject({ ok: true, value: { outcome: "semantic-mismatch" } });

    const wrongBytes = authority();
    expect(
      evaluatePublishedRuntimeObservationV1(wrongBytes, actual(wrongBytes, Uint8Array.of(0xf0))),
    ).toMatchObject({ ok: true, value: { outcome: "semantic-mismatch" } });
  });

  it("owns actual bytes before returning the closed decision", () => {
    const evaluation = authority();
    const bytes = Uint8Array.of(0xf1);
    const decision = evaluatePublishedRuntimeObservationV1(evaluation, actual(evaluation, bytes));
    bytes[0] = 0;
    expect(decision).toMatchObject({ ok: true, value: { outcome: "match" } });
    expect(decision).not.toHaveProperty("value.actual");
    expect(decision).not.toHaveProperty("value.expected");
  });
});
