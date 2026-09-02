import { afterEach, describe, expect, it, vi } from "vitest";

const DIGEST = `sha256:${"a".repeat(64)}` as const;
const EMPTY_USAGE = Object.freeze({
  wallMs: 0,
  outputBytes: 0,
  evidenceBytes: 0,
  instructions: 0,
  cycles: 0,
  launchAttempts: 0,
});

afterEach(() => {
  vi.doUnmock("@blend65/readiness");
  vi.doUnmock("@blend65/readiness/published-oracle");
  vi.doUnmock("./execution-orchestration-conformance-v1.js");
  vi.doUnmock("./execution-predicate-contracts.js");
  vi.doUnmock("./execution-route-adapters.js");
  vi.doUnmock("./failure-predicate-evidence.js");
  vi.resetModules();
});

describe("execution route evidence boundaries", () => {
  it("rejects every unavailable or cross-arm route authority before dispatch", async () => {
    let diagnosticSucceeds = true;
    let executionCaseSucceeds = true;
    let requestSucceeds = true;
    let completionAvailable = true;
    vi.doMock("@blend65/readiness", () => ({
      createExecutionCaseV1: () =>
        executionCaseSucceeds ? { ok: true, value: { execution: true } } : { ok: false },
      generateCampaignCase: () => ({ ok: false }),
    }));
    vi.doMock("@blend65/readiness/published-oracle", () => ({
      createPublishedDiagnosticCaseV1: () =>
        diagnosticSucceeds ? { ok: true, value: { diagnostic: true } } : { ok: false },
    }));
    vi.doMock("./execution-orchestration-conformance-v1.js", () => ({
      snapshotExecutionResultForOrchestrationV1: (result: object) => result,
    }));
    vi.doMock("./execution-route-adapters.js", () => ({
      createExecutionRouteRequestV1: () =>
        requestSucceeds ? { ok: true, value: { request: true } } : { ok: false },
    }));
    vi.doMock("./execution-predicate-contracts.js", () => ({
      createFailurePredicateEvidenceCompletionV1: () =>
        completionAvailable ? { completion: true } : undefined,
    }));
    const evidence = await import("./execution-route-evidence.js");
    const route = {
      caseIdentity: DIGEST,
      ruleId: "scalar.literal",
      obligation: "frontend",
      prerequisiteTiers: [],
      terminalTier: "frontend",
    };
    const parent = {} as never;
    const execution = {} as never;
    const campaign = {} as never;
    const oracle = {} as never;
    const policy = {} as never;
    const authorities = new Map();
    const generatedCases = new Map();
    const prepare = (selectedRoute: object = route) =>
      evidence.prepareExecutionRouteEvidenceV1(
        selectedRoute as never,
        parent,
        execution,
        campaign,
        oracle,
        DIGEST,
        policy,
        generatedCases,
        authorities,
      );

    expect(prepare()).toBeUndefined();

    const generated = (validity: "valid" | "invalid", projection: object, choice: object) => ({
      modeledCase: { validity: { kind: validity }, projection },
      planItem: { request: { choice } },
    });
    generatedCases.set(
      DIGEST,
      Object.freeze({
        ordinal: 0,
        generated: generated("invalid", { kind: "invalid" }, { kind: "scalar" }),
      }),
    );
    expect(prepare({ ...route, terminalTier: "emit" } as never)).toBeUndefined();

    diagnosticSucceeds = false;
    expect(prepare()).toBeUndefined();
    diagnosticSucceeds = true;
    authorities.set(DIGEST, { kind: "execution", value: {} });
    expect(prepare()).toBeUndefined();
    authorities.clear();
    requestSucceeds = false;
    expect(prepare()).toBeUndefined();

    requestSucceeds = true;
    generatedCases.set(
      DIGEST,
      Object.freeze({
        ordinal: 0,
        generated: generated("valid", { kind: "invalid" }, { kind: "scalar" }),
      }),
    );
    authorities.clear();
    expect(prepare()).toBeUndefined();
    generatedCases.set(
      DIGEST,
      Object.freeze({
        ordinal: 0,
        generated: generated(
          "valid",
          { kind: "valid", module: { functions: [] } },
          { kind: "scalar" },
        ),
      }),
    );
    expect(prepare()).toBeUndefined();
    generatedCases.set(
      DIGEST,
      Object.freeze({
        ordinal: 0,
        generated: generated(
          "valid",
          { kind: "valid", module: { functions: [{ returnType: "void" }] } },
          { kind: "scalar" },
        ),
      }),
    );
    expect(prepare()).toBeUndefined();
    generatedCases.set(
      DIGEST,
      Object.freeze({
        ordinal: 0,
        generated: generated(
          "valid",
          { kind: "valid", module: { functions: [{ returnType: "void" }] } },
          { kind: "memory", ruleId: "memory.read", addressForm: "literal" },
        ),
      }),
    );
    expect(prepare()).toBeUndefined();

    generatedCases.set(
      DIGEST,
      Object.freeze({
        ordinal: 0,
        generated: generated(
          "valid",
          { kind: "valid", module: { functions: [{ returnType: "byte" }] } },
          { kind: "scalar" },
        ),
      }),
    );
    executionCaseSucceeds = false;
    expect(prepare()).toBeUndefined();
    executionCaseSucceeds = true;
    authorities.set(DIGEST, { kind: "diagnostic", value: {} });
    expect(prepare()).toBeUndefined();
    authorities.clear();
    requestSucceeds = false;
    expect(prepare()).toBeUndefined();
    requestSucceeds = true;
    completionAvailable = false;
    expect(prepare()).toBeUndefined();
    completionAvailable = true;
    expect(prepare()).toMatchObject({
      request: { request: true },
      completion: { completion: true },
    });

    authorities.clear();
    generatedCases.set(
      DIGEST,
      Object.freeze({
        ordinal: 0,
        generated: generated(
          "valid",
          { kind: "valid", module: { functions: [{ returnType: "word" }] } },
          { kind: "scalar" },
        ),
      }),
    );
    expect(prepare()).toBeDefined();

    authorities.clear();
    generatedCases.set(
      DIGEST,
      Object.freeze({
        ordinal: 0,
        generated: generated(
          "valid",
          { kind: "valid", module: { functions: [{ returnType: "void" }] } },
          { kind: "memory", ruleId: "memory.pokew-computed", addressForm: "computed" },
        ),
      }),
    );
    expect(prepare()).toBeDefined();
    expect(evidence.requiredExecutionRouteToolsV1(route as never)).toEqual([]);
  });

  it("attributes unavailable tools and refuses evidence without a predicate sidecar", async () => {
    let handledSidecar: object | undefined = { sidecar: true };
    let closedSidecar: object | undefined = { closed: true };
    vi.doMock("@blend65/readiness", () => ({
      createExecutionCaseV1: vi.fn(),
      generateCampaignCase: vi.fn(),
    }));
    vi.doMock("@blend65/readiness/published-oracle", () => ({
      createPublishedDiagnosticCaseV1: vi.fn(),
    }));
    vi.doMock("./execution-orchestration-conformance-v1.js", () => ({
      snapshotExecutionResultForOrchestrationV1: (result: object) => result,
    }));
    vi.doMock("./execution-predicate-contracts.js", () => ({
      createFailurePredicateEvidenceCompletionV1: vi.fn(),
    }));
    vi.doMock("./execution-route-adapters.js", () => ({
      createExecutionRouteRequestV1: vi.fn(),
    }));
    vi.doMock("./failure-predicate-evidence.js", () => ({
      consumeHandledFailurePredicateEvidenceV1: () => handledSidecar,
      createClosedNonExecutedFailurePredicateEvidenceV1: () => closedSidecar,
    }));
    const evidence = await import("./execution-route-evidence.js");
    const route = {
      caseIdentity: DIGEST,
      ruleId: "memory.poke-byte",
      obligation: "vice",
      prerequisiteTiers: ["acme"],
      terminalTier: "vice",
    } as never;
    const result = Object.freeze({
      status: "failure",
      tier: "vice",
      stage: "capability",
      code: "tier-unavailable",
      usage: EMPTY_USAGE,
      evidence: Object.freeze({ digest: DIGEST, retainedBytes: 0, truncated: false }),
    }) as never;
    const prepared = { parent: {}, execution: {}, request: {}, completion: {} } as never;
    const collections: {
      results: object[];
      records: object[];
      sidecars: object[];
      occurrences: object[];
    } = { results: [], records: [], sidecars: [], occurrences: [] };

    expect(evidence.requiredExecutionRouteToolsV1(route)).toEqual(["acme", "vice"]);
    expect(
      evidence.appendExecutionRouteEvidenceV1(
        route,
        DIGEST,
        [],
        prepared,
        result,
        collections as never,
      ),
    ).toBe(true);
    expect(collections.records[0]).toMatchObject({ unavailableTools: ["acme", "vice"] });

    expect(
      evidence.appendExecutionRouteEvidenceV1(
        route,
        DIGEST,
        ["vice"],
        prepared,
        result,
        collections as never,
        "tier-unavailable",
      ),
    ).toBe(true);
    handledSidecar = undefined;
    expect(
      evidence.appendExecutionRouteEvidenceV1(
        route,
        DIGEST,
        [],
        prepared,
        result,
        collections as never,
      ),
    ).toBe(false);
    closedSidecar = undefined;
    expect(
      evidence.appendExecutionRouteEvidenceV1(
        route,
        DIGEST,
        [],
        prepared,
        result,
        collections as never,
        "caught-compiler-ice",
      ),
    ).toBe(false);
  });
});
