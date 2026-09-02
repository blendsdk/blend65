import { createHash } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createFailureExecutionSpecFixtureV1,
  type FailureExecutionSpecApiV1 as Api,
  type FailureExecutionSpecDataV1 as Data,
  type FailureExecutionSpecFixtureV1 as Fixture,
  type FailureExecutionSpecResultV1 as Result,
} from "./test-fixtures/failure-execution-spec-fixture.js";

const ENCODER = new TextEncoder();
const openFixtures = new Set<Fixture>();
const RULE_IDS = Object.freeze([
  "rule.ch02.2-primitive-types.byte.range.0-255",
  "rule.ch02.2-primitive-types.sbyte.range.128-127",
  "rule.ch02.2-primitive-types.sword.range.32768-32767",
  "rule.ch02.2-primitive-types.word.range.0-65535",
]);
const CONFIGURATION = Object.freeze({
  caseCount: 72,
  maxInvalidCases: 24,
  enabledRuleIds: [...RULE_IDS].sort(),
  spellings: ["const", "literal", "local", "parameter"],
  budget: {
    maxModules: 4,
    maxDeclarations: 128,
    maxIrNodes: 512,
    maxStatements: 256,
    maxExpressionDepth: 16,
    maxLoopWork: 1n,
    maxSourceBytes: 65_536,
    maxAttempts: 128,
  },
});

function call<T>(api: Api, name: string, ...arguments_: readonly unknown[]): T {
  const operation = api[name];
  if (typeof operation !== "function") throw new TypeError(`missing operation ${name}`);
  return Reflect.apply(operation, undefined, arguments_) as T;
}

function success<T>(result: Result<T>): T {
  if (!result.ok) throw new TypeError(JSON.stringify(result.issues ?? result.diagnostics ?? []));
  expect(result.ok).toBe(true);
  return result.value;
}

function failure(result: Result<unknown>, code?: string): void {
  expect(result.ok).toBe(false);
  if (result.ok || code === undefined) return;
  expect([...(result.issues ?? []), ...(result.diagnostics ?? [])]).toContainEqual(
    expect.objectContaining({ code }),
  );
}

function digest(value: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function record(value: unknown): Data {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("record expected");
  }
  return value as Data;
}

async function fixture(): Promise<Fixture> {
  const value = await createFailureExecutionSpecFixtureV1("standalone-stable");
  openFixtures.add(value);
  return value;
}

async function apis(): Promise<{
  readonly execution: Api;
  readonly internals: Api;
  readonly published: Api;
  readonly readiness: Api;
  readonly reduction: Api;
  readonly runtime: Api;
}> {
  const [execution, internals, published, readiness, reduction, runtime] = await Promise.all([
    vi.importActual<Api>("./index.js"),
    vi.importActual<Api>("./failure-execution-internals.js"),
    vi.importActual<Api>("@blend65/readiness/published-oracle"),
    vi.importActual<Api>("@blend65/readiness"),
    vi.importActual<Api>("@blend65/readiness/failure-reduction-internals"),
    vi.importActual<Api>("@blend65/readiness/execution-runtime"),
  ]);
  return { execution, internals, published, readiness, reduction, runtime };
}

function predicate(
  readiness: Api,
  ruleId: string,
  originalRouteKind: "valid-envelope" | "invalid-diagnostic",
  observationBytes: Uint8Array,
  policy: unknown,
): object {
  return success(
    call<Result<{ readonly predicate: object }>>(readiness, "deriveFailurePredicateIdentityV1", {
      revision: "failure-predicate-v1",
      resultCode: "compiler-ice",
      terminalTier: "frontend",
      terminalStage: "frontend",
      observation: { kind: "observed", digest: digest(observationBytes) },
      cleanup: "cleanup-clear",
      primaryRuleId: ruleId,
      requiredClaimedRuleIds: [ruleId],
      target: "c64",
      routeContract: {
        originalRouteKind,
        terminalTier: "frontend",
        obligation: "frontend",
        prerequisiteTiers: [],
        policyDigest: digest(JSON.stringify(policy)),
        fixtureDigest: digest("candidate-impl-fixture"),
        oracleContractDigest: digest("candidate-impl-oracle"),
        toolContractDigests: [],
      },
    }),
  ).predicate;
}

function candidate(
  readiness: Api,
  reduction: Api,
  source: object,
  sourceKind: "typed-invalid" | "raw-malformed",
  route: object,
  routePredicate: object,
  policy: unknown,
  observationBytes: Uint8Array,
): { readonly origin: object; readonly candidate: object } {
  const routePlanBytes = ENCODER.encode(`${JSON.stringify(route)}\n`);
  const origin = success(
    call<Result<object>>(readiness, "authorizeFailureEnvelopeV1", {
      revision: "failure-envelope-authorization-input-v1",
      source: { kind: sourceKind, authority: source },
      routePlanBytes,
      routePlanDigest: digest(routePlanBytes),
      predicate: routePredicate,
      policy,
      observationBytes,
      toolVersions: [],
    }),
  );
  const initial = success(
    call<Result<object>>(reduction, "createInitialReductionCandidateV1", origin),
  );
  return {
    origin,
    candidate: success(
      call<Result<object>>(reduction, "createReductionCandidateAuthorityV1", origin, initial, []),
    ),
  };
}

async function executeCandidate(
  api: Awaited<ReturnType<typeof apis>>,
  value: Fixture,
  originalRequest: object,
  origin: object,
  candidateAuthority: object,
): Promise<Result<Data>> {
  const opened = call<Result<object>>(api.internals, "openFailureExecutionProtocolV1", {
    parent: value.parent,
    execution: value.execution,
    originalRequest,
    origin,
  });
  if (!opened.ok) return opened;
  const protocol = opened.value;
  const isolation = success(
    call<Result<object>>(api.internals, "mintCampaignFailureExecutionIsolationV1", protocol),
  );
  const invocation = success(
    call<Result<object>>(
      api.reduction,
      "createReductionCandidateInvocationV1",
      candidateAuthority,
      "reduction",
      "catalog-edit",
    ),
  );
  const request = success(
    call<Result<object>>(
      api.execution,
      "createReductionExecutionRouteRequestV1",
      value.parent,
      invocation,
      isolation,
    ),
  );
  return call<Promise<Result<Data>>>(
    api.execution,
    "executeReductionCandidateV1",
    value.execution,
    request,
  );
}

afterEach(async () => {
  for (const value of openFixtures) await value.cleanup();
  openFixtures.clear();
});

describe("failure candidate execution hardening", () => {
  it("should reject a raw candidate outside a genuine report-bound context", async () => {
    const value = await fixture();
    const api = await apis();
    const context = success(
      call<Result<object>>(api.published, "createPublishedOracleContext", value.parent),
    );
    const originalPolicy = record(value.originalRequest).policy;
    const failurePolicy = api.readiness.FAILURE_REDUCTION_DEFAULT_POLICY_V1;
    const observationBytes = ENCODER.encode("failure-observation");

    const malformed = success(
      call<Result<object>>(api.readiness, "createMalformedDiagnosticCaseV1", context, {
        revision: "malformed-diagnostic-case-input-v1",
        sourceBytes: new Uint8Array(),
        encoding: "utf-8",
        ruleId: "diagnostic.malformed-source",
        obligation: "frontend",
        provenance: {
          revision: "malformed-token-text-provenance-v1",
          tokenizerRevision: "utf8-byte-spans-v1",
          tokens: [],
        },
      }),
    );
    const malformedProjection = success(
      call<Result<Data>>(api.readiness, "getMalformedDiagnosticCaseProjectionV1", malformed),
    );
    const rawRoute = {
      caseIdentity: malformedProjection.textDigest,
      ruleId: malformedProjection.ruleId,
      obligation: "frontend",
      terminalTier: "frontend",
      prerequisiteTiers: [],
      rankDigest: digest("raw-candidate-route"),
    };
    const rawRequest = success(
      call<Result<object>>(api.execution, "createExecutionRouteRequestV1", {
        kind: "raw-malformed",
        route: rawRoute,
        malformedCase: malformed,
        policy: originalPolicy,
      }),
    );
    const raw = candidate(
      api.readiness,
      api.reduction,
      malformed,
      "raw-malformed",
      rawRoute,
      predicate(
        api.readiness,
        String(malformedProjection.ruleId),
        "invalid-diagnostic",
        observationBytes,
        originalPolicy,
      ),
      failurePolicy,
      observationBytes,
    );
    expect(await executeCandidate(api, value, rawRequest, raw.origin, raw.candidate)).toMatchObject(
      {
        ok: false,
        issues: [{ code: "unbound-capability", path: "/context" }],
      },
    );
  }, 600_000);

  it("should reject a typed-invalid candidate outside a genuine report-bound context", async () => {
    const typedValue = await fixture();
    const typedApi = await apis();
    const typedContext = success(
      call<Result<object>>(typedApi.published, "createPublishedOracleContext", typedValue.parent),
    );
    const typedOriginalPolicy = record(typedValue.originalRequest).policy;
    const typedFailurePolicy = typedApi.readiness.FAILURE_REDUCTION_DEFAULT_POLICY_V1;
    const observationBytes = ENCODER.encode("failure-observation");

    let diagnosticCase: object | undefined;
    for (const ruleId of RULE_IDS) {
      for (let ordinal = 0; ordinal < CONFIGURATION.caseCount; ordinal += 1) {
        const created = call<Result<object>>(
          typedApi.published,
          "createPublishedDiagnosticCaseFromIntentV1",
          typedContext,
          {
            schemaVersion: 1,
            ruleId,
            seed: digest("typed-invalid-candidate"),
            configuration: CONFIGURATION,
            ordinal,
          },
        );
        if (created.ok) {
          diagnosticCase = created.value;
          break;
        }
      }
      if (diagnosticCase !== undefined) break;
    }
    expect(diagnosticCase).toBeDefined();
    if (diagnosticCase === undefined) throw new TypeError("invalid diagnostic authority");
    const diagnosticProjection = success(
      call<Result<Data>>(
        typedApi.published,
        "getPublishedDiagnosticCaseProjectionV1",
        diagnosticCase,
      ),
    );
    const expectedDiagnostic = record(diagnosticProjection.expectedDiagnostic);
    const typedInvalidRoute = {
      caseIdentity: diagnosticProjection.sourceCaseDigest,
      ruleId: expectedDiagnostic.ruleId,
      obligation: "frontend",
      terminalTier: "frontend",
      prerequisiteTiers: [],
      rankDigest: digest("typed-invalid-candidate-route"),
    };
    const typedInvalidRequest = success(
      call<Result<object>>(typedApi.execution, "createExecutionRouteRequestV1", {
        kind: "invalid-diagnostic",
        route: typedInvalidRoute,
        diagnosticCase,
        policy: typedOriginalPolicy,
      }),
    );
    const typedInvalid = candidate(
      typedApi.readiness,
      typedApi.reduction,
      diagnosticCase,
      "typed-invalid",
      typedInvalidRoute,
      predicate(
        typedApi.readiness,
        String(expectedDiagnostic.ruleId),
        "invalid-diagnostic",
        observationBytes,
        typedOriginalPolicy,
      ),
      typedFailurePolicy,
      observationBytes,
    );
    expect(
      await executeCandidate(
        typedApi,
        typedValue,
        typedInvalidRequest,
        typedInvalid.origin,
        typedInvalid.candidate,
      ),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "unbound-capability", path: "/context" }],
    });
  }, 600_000);

  it("should bind candidate runtime truth to one genuine consumed typed-valid invocation", async () => {
    const value = await fixture();
    const api = await apis();
    const context = success(
      call<Result<object>>(api.published, "createPublishedOracleContext", value.parent),
    );
    const invocation = success(
      call<Result<object>>(
        api.reduction,
        "createReductionCandidateInvocationV1",
        value.candidate,
        "confirmation",
        "normalization",
      ),
    );
    const consumed = success(
      call<Result<object>>(api.reduction, "consumeReductionCandidateInvocationV1", invocation),
    );
    const created = call<Result<object>>(
      api.runtime,
      "createCandidateRuntimeEvaluationAuthorityV1",
      context,
      record(value.originalRequest).executionCase,
      consumed,
    );
    const authority = success(created);
    const projection = success(
      call<Result<Data>>(api.runtime, "getPublishedRuntimeEvaluationProjectionV1", authority),
    );
    const candidateProjection = success(
      call<Result<Data>>(api.reduction, "getReductionCandidateProjectionV1", value.candidate),
    );
    expect(projection).toMatchObject({
      sourceCaseDigest: candidateProjection.candidateExecutionIdentity,
      selectedReleaseDigest: record(context).selectedReleaseDigest,
    });
    failure(
      call<Result<unknown>>(
        api.runtime,
        "createCandidateRuntimeEvaluationAuthorityV1",
        context,
        record(value.originalRequest).executionCase,
        consumed,
      ),
      "oracle.authority.missing",
    );
  }, 600_000);
});
