import { createHash } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createFailureExecutionSpecFixtureV1,
  createFailureExecutionReportProjectionV1,
  type FailureExecutionCandidateEvaluationV1 as CandidateEvaluationV1,
  type FailureExecutionConfirmationResultV1 as ConfirmationResultV1,
  type FailureExecutionConfirmationStepV1 as ConfirmationStepV1,
  type FailureExecutionObservationV1 as ObservationV1,
  type FailureExecutionProtocolApisV1 as ProtocolApisV1,
  type FailureExecutionSpecApiV1 as Api,
  type FailureExecutionSpecDataV1 as Data,
  type FailureExecutionSpecFixtureV1,
  type FailureExecutionSpecResultV1 as Result,
  type FailureExecutionSpecScenarioV1,
} from "./test-fixtures/failure-execution-spec-fixture.js";

const openFixtures = new Set<FailureExecutionSpecFixtureV1>();
const ENCODER = new TextEncoder();

function digestBytes(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function call<T>(api: Api, name: string, ...arguments_: readonly unknown[]): T {
  const callable = api[name];
  if (typeof callable !== "function") throw new TypeError(`missing callable ${name}`);
  return Reflect.apply(callable, undefined, arguments_) as T;
}

function success<T>(result: Result<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError(JSON.stringify(result.issues ?? result.diagnostics ?? []));
  return result.value;
}

function failure(result: Result<unknown>, code?: string): void {
  expect(result.ok).toBe(false);
  expect(result).not.toHaveProperty("value");
  if (result.ok || code === undefined) return;
  const issues = result.issues ?? result.diagnostics ?? [];
  expect(issues.some((issue) => issue.code === code)).toBe(true);
}

function record(value: unknown, message: string): Data {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(message);
  }
  return value as Data;
}

function authority(value: unknown): object {
  if (typeof value !== "object" || value === null) throw new TypeError("report authority");
  if (Reflect.get(value, "ok") === true) {
    return success(value as Result<object>);
  }
  return value;
}

async function fixture(
  scenario: FailureExecutionSpecScenarioV1,
  options?: { readonly failingPosition?: number; readonly sequenceLength?: number },
): Promise<FailureExecutionSpecFixtureV1> {
  // Load APIs only after this helper: adapter installation resets the WeakMap authority registry.
  const created = await createFailureExecutionSpecFixtureV1(scenario, options);
  openFixtures.add(created);
  return created;
}

async function apis(): Promise<ProtocolApisV1> {
  const [execution, internals, readiness, reduction, reports] = await Promise.all([
    vi.importActual<Api>("./index.js"),
    vi.importActual<Api>("./failure-execution-internals.js"),
    vi.importActual<Api>("@blend65/readiness"),
    vi.importActual<Api>("@blend65/readiness/failure-reduction-internals"),
    vi.importActual<Api>("./execution-authority-report.js"),
  ]);
  for (const name of [
    "createReductionExecutionRouteRequestV1",
    "executeReductionCandidateV1",
    "confirmReducedFailureV1",
  ]) {
    if (typeof execution[name] !== "function") throw new TypeError(`missing callable ${name}`);
  }
  for (const name of [
    "openFailureExecutionProtocolV1",
    "mintCampaignFailureExecutionIsolationV1",
    "mintStandaloneFailureExecutionIsolationV1",
    "createFailureExecutionControlV1",
    "beginStatefulSequenceAttemptV1",
    "nextStatefulSequencePositionV1",
    "recordStatefulSequencePositionV1",
    "getFailureExecutionObservationV1",
    "getExecutionAuthorityReportPredicateSidecarsV1",
    "shutdownFailureExecutionIsolationV1",
    "closeFailureExecutionProtocolV1",
    "createFailureConfirmationSessionV1",
    "nextFailureConfirmationStepV1",
    "executeFailureConfirmationStepV1",
    "recordFailureConfirmationStepV1",
  ]) {
    if (typeof internals[name] !== "function") throw new TypeError(`missing callable ${name}`);
  }
  return { execution, internals, readiness, reduction, reports };
}

function invocation(
  api: ProtocolApisV1,
  candidate: object,
  purpose: "reduction" | "confirmation" = "reduction",
): object {
  return success(
    call<Result<object>>(
      api.reduction,
      "createReductionCandidateInvocationV1",
      candidate,
      purpose,
      purpose === "reduction" ? "catalog-edit" : "normalization",
    ),
  );
}

function protocol(api: ProtocolApisV1, value: FailureExecutionSpecFixtureV1): object {
  return success(
    call<Result<object>>(api.internals, "openFailureExecutionProtocolV1", {
      parent: value.parent,
      execution: value.execution,
      originalRequest: value.originalRequest,
      origin: value.origin,
    }),
  );
}

async function executeCandidate(
  api: ProtocolApisV1,
  value: FailureExecutionSpecFixtureV1,
  owner: object,
  mode: "campaign" | "standalone" = "campaign",
): Promise<{
  readonly evaluation: CandidateEvaluationV1;
  readonly isolation: object;
  readonly request: object;
}> {
  const token = invocation(api, owner);
  const session = protocol(api, value);
  const isolation =
    mode === "campaign"
      ? success(
          call<Result<object>>(api.internals, "mintCampaignFailureExecutionIsolationV1", session),
        )
      : success(
          call<Result<object>>(
            api.internals,
            "mintStandaloneFailureExecutionIsolationV1",
            session,
            token,
          ),
        );
  const request = success(
    call<Result<object>>(
      api.execution,
      "createReductionExecutionRouteRequestV1",
      value.parent,
      token,
      isolation,
    ),
  );
  const evaluation = success(
    await call<Promise<Result<CandidateEvaluationV1>>>(
      api.execution,
      "executeReductionCandidateV1",
      value.execution,
      request,
    ),
  );
  return { evaluation, isolation, request };
}

async function driveConfirmation(
  api: ProtocolApisV1,
  value: FailureExecutionSpecFixtureV1,
): Promise<{
  readonly result: ConfirmationResultV1;
  readonly steps: readonly ConfirmationStepV1[];
  readonly protocol: object;
}> {
  const sessionProtocol = protocol(api, value);
  const session = success(
    call<Result<object>>(
      api.internals,
      "createFailureConfirmationSessionV1",
      sessionProtocol,
      value.candidate,
      value.origin,
      value.budget,
    ),
  );
  const steps: ConfirmationStepV1[] = [];
  for (let count = 0; count < 512; count += 1) {
    const step = success(
      call<Result<ConfirmationStepV1>>(
        api.internals,
        "nextFailureConfirmationStepV1",
        sessionProtocol,
        session,
      ),
    );
    steps.push(step);
    if (step.kind === "complete") {
      if (step.result === undefined) throw new TypeError("confirmation result");
      return { result: step.result, steps, protocol: sessionProtocol };
    }
    if (step.authority === undefined) throw new TypeError("confirmation step authority");
    const evaluation = success(
      await call<Promise<Result<object>>>(
        api.internals,
        "executeFailureConfirmationStepV1",
        sessionProtocol,
        session,
        step.authority,
      ),
    );
    success(
      call<Result<true>>(
        api.internals,
        "recordFailureConfirmationStepV1",
        sessionProtocol,
        session,
        step.authority,
        evaluation,
      ),
    );
  }
  throw new TypeError("confirmation did not terminate within the bounded machine");
}

afterEach(async () => {
  for (const value of openFixtures) await value.cleanup();
  openFixtures.clear();
});

describe("failure candidate execution oracle", () => {
  // Predicate evidence is private authority bound one-to-one to unchanged report result order.
  it("should bind ordered predicate sidecars without changing report bytes and reject unavailable or substituted associations", async () => {
    const value = await fixture("standalone-stable");
    const api = await apis();
    const first = await executeCandidate(api, value, value.candidate);
    const second = await executeCandidate(api, value, value.candidate);
    const reportResults = [first.evaluation.result, second.evaluation.result] as const;
    const projection = createFailureExecutionReportProjectionV1(reportResults);
    const report = authority(
      call<unknown>(api.reports, "authorizeExecutionAuthorityReportV1", projection, [
        first.evaluation.predicateEvidence,
        second.evaluation.predicateEvidence,
      ]),
    );
    const before = call<Uint8Array>(api.execution, "serializeExecutionAuthorityReportV1", report);
    expect(
      success(
        call<Result<readonly Data[]>>(
          api.internals,
          "getExecutionAuthorityReportPredicateSidecarsV1",
          report,
        ),
      ),
    ).toEqual([first.evaluation.predicateEvidence, second.evaluation.predicateEvidence]);
    expect(call<Uint8Array>(api.execution, "serializeExecutionAuthorityReportV1", report)).toEqual(
      before,
    );
    expect(new TextDecoder().decode(before)).not.toContain("predicateSidecar");

    const historical = authority(
      call<unknown>(api.reports, "authorizeExecutionAuthorityReportV1", projection),
    );
    failure(
      call<Result<unknown>>(
        api.internals,
        "getExecutionAuthorityReportPredicateSidecarsV1",
        historical,
      ),
      "historical-authority-unavailable",
    );
    for (const hostile of [
      { ...record(report, "report") },
      { ...record(report, "report"), results: [...reportResults].reverse() },
      { ...record(report, "report"), results: [...reportResults] },
    ]) {
      failure(
        call<Result<unknown>>(
          api.internals,
          "getExecutionAuthorityReportPredicateSidecarsV1",
          hostile,
        ),
      );
    }
    const substituted = call<Result<unknown>>(
      api.reports,
      "authorizeExecutionAuthorityReportV1",
      createFailureExecutionReportProjectionV1([first.evaluation.result]),
      [second.evaluation.predicateEvidence],
    );
    failure(substituted);
  });

  // Empty bytes are a legal raw diagnostic payload but never a typed program payload.
  it("should execute an empty raw malformed candidate and reject empty typed candidates", async () => {
    const value = await fixture("standalone-stable");
    const api = await apis();
    const context = success(
      call<Result<object>>(
        await vi.importActual<Api>("@blend65/readiness/published-oracle"),
        "createPublishedOracleContext",
        value.parent,
      ),
    );
    const malformed = success(
      call<Result<object>>(api.readiness, "createMalformedDiagnosticCaseV1", context, {
        revision: "malformed-diagnostic-case-input-v1",
        sourceBytes: new Uint8Array(),
        encoding: "utf-8",
        ruleId: "diagnostic.malformed-source",
        obligation: "reject malformed language input",
        provenance: {
          revision: "malformed-token-text-provenance-v1",
          tokenizerRevision: "utf8-byte-spans-v1",
          tokens: [],
        },
      }),
    );
    const source = success(
      call<Result<Data>>(api.readiness, "getFailureEnvelopeProjectionV1", value.origin),
    );
    const typedPredicate = record(source.predicate, "typed predicate");
    const typedRoute = record(typedPredicate.routeContract, "typed route contract");
    const observationBytes = new Uint8Array();
    const routePlanBytes = ENCODER.encode(
      '{"kind":"invalid-diagnostic","obligation":"frontend"}\n',
    );
    const rawPredicate = success(
      call<Result<{ readonly predicate: Data }>>(
        api.readiness,
        "deriveFailurePredicateIdentityV1",
        {
          revision: "failure-predicate-v1",
          resultCode: typedPredicate.resultCode,
          terminalTier: typedPredicate.terminalTier,
          terminalStage: typedPredicate.terminalStage,
          observation: { kind: "observed", digest: digestBytes(observationBytes) },
          cleanup: typedPredicate.cleanup,
          primaryRuleId: "diagnostic.malformed-source",
          requiredClaimedRuleIds: ["diagnostic.malformed-source"],
          target: typedPredicate.target,
          routeContract: {
            originalRouteKind: "invalid-diagnostic",
            terminalTier: typedRoute.terminalTier,
            obligation: typedRoute.obligation,
            prerequisiteTiers: typedRoute.prerequisiteTiers,
            policyDigest: typedRoute.policyDigest,
            fixtureDigest: typedRoute.fixtureDigest,
            oracleContractDigest: typedRoute.oracleContractDigest,
            toolContractDigests: typedRoute.toolContractDigests,
          },
        },
      ),
    ).predicate;
    const rawOrigin = success(
      call<Result<object>>(api.readiness, "authorizeFailureEnvelopeV1", {
        revision: "failure-envelope-authorization-input-v1",
        source: { kind: "raw-malformed", authority: malformed },
        routePlanBytes,
        routePlanDigest: digestBytes(routePlanBytes),
        predicate: rawPredicate,
        policy: source.policy,
        observationBytes,
        toolVersions: [],
      }),
    );
    const rawInitial = success(
      call<Result<object>>(api.reduction, "createInitialReductionCandidateV1", rawOrigin),
    );
    const rawCandidate = success(
      call<Result<object>>(
        api.reduction,
        "createReductionCandidateAuthorityV1",
        rawOrigin,
        rawInitial,
        [],
      ),
    );
    expect(
      success(call<Result<Data>>(api.reduction, "getReductionCandidateProjectionV1", rawCandidate)),
    ).toMatchObject({ family: "raw-malformed", sourceBytes: new Uint8Array() });

    const typed = success(
      call<Result<Data>>(api.reduction, "getReductionCandidateProjectionV1", value.candidate),
    );
    failure(
      call<Result<unknown>>(api.reduction, "validateReductionCandidateInvariantV1", value.origin, {
        ...typed,
        sourceBytes: new Uint8Array(),
      }),
    );
  });

  // Route and isolation capabilities are single-use, ordered, subject-bound, and mode-bound.
  it("should reject foreign, replayed, out-of-order, cross-subject, cross-purpose, and cross-mode route capabilities", async () => {
    const value = await fixture("standalone-stable");
    const api = await apis();
    const session = protocol(api, value);
    const first = invocation(api, value.candidate);
    const second = invocation(api, value.candidate);
    const confirmation = invocation(api, value.candidate, "confirmation");
    const campaign = success(
      call<Result<object>>(api.internals, "mintCampaignFailureExecutionIsolationV1", session),
    );
    const standalone = success(
      call<Result<object>>(
        api.internals,
        "mintStandaloneFailureExecutionIsolationV1",
        session,
        confirmation,
      ),
    );
    failure(
      call<Result<unknown>>(
        api.execution,
        "createReductionExecutionRouteRequestV1",
        value.parent,
        second,
        campaign,
      ),
    );
    failure(
      call<Result<unknown>>(
        api.execution,
        "createReductionExecutionRouteRequestV1",
        value.parent,
        first,
        standalone,
      ),
    );
    const request = success(
      call<Result<object>>(
        api.execution,
        "createReductionExecutionRouteRequestV1",
        value.parent,
        first,
        campaign,
      ),
    );
    success(
      await call<Promise<Result<CandidateEvaluationV1>>>(
        api.execution,
        "executeReductionCandidateV1",
        value.execution,
        request,
      ),
    );
    failure(
      await call<Promise<Result<unknown>>>(
        api.execution,
        "executeReductionCandidateV1",
        value.execution,
        request,
      ),
    );
    const fresh = await executeCandidate(api, value, value.candidate);
    expect(fresh.evaluation.revision).toBe("reduction-candidate-evaluation-v1");
  });

  // Candidate identity is derived in a new domain while the authenticated original stays immutable.
  it("should leave the original immutable and derive a new identity for every candidate", async () => {
    const value = await fixture("standalone-stable");
    const api = await apis();
    const before = success(
      call<Result<Data>>(api.readiness, "getFailureEnvelopeProjectionV1", value.origin),
    );
    const first = success(
      call<Result<Data>>(api.reduction, "getReductionCandidateProjectionV1", value.candidate),
    );
    const secondAuthority = success(
      call<Result<object>>(
        api.reduction,
        "createReductionCandidateAuthorityV1",
        value.origin,
        success(
          call<Result<object>>(api.reduction, "createInitialReductionCandidateV1", value.origin),
        ),
        [],
      ),
    );
    const second = success(
      call<Result<Data>>(api.reduction, "getReductionCandidateProjectionV1", secondAuthority),
    );
    expect(first.candidateDigest).not.toBe(before.digest);
    expect(second.candidateDigest).not.toBe(before.digest);
    expect(second.candidateDigest).not.toBe(first.candidateDigest);
    expect(
      success(call<Result<Data>>(api.readiness, "getFailureEnvelopeProjectionV1", value.origin)),
    ).toEqual(before);
  });

  // Execution replaces only source-bound identity and preserves the authenticated route contract.
  it("should execute through the original route with obligation, tier, policy, fixture, oracle, tools, and predicate unchanged", async () => {
    const value = await fixture("standalone-stable");
    const api = await apis();
    const origin = success(
      call<Result<Data>>(api.readiness, "getFailureEnvelopeProjectionV1", value.origin),
    );
    const executed = await executeCandidate(api, value, value.candidate);
    expect(executed.evaluation).toMatchObject({
      revision: "reduction-candidate-evaluation-v1",
      evaluationTokenDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      predicateEvidence: expect.objectContaining({
        predicate: origin.predicate,
      }),
    });
    expect(record(executed.evaluation.result, "execution result").tier).toBe(
      record(record(value.originalRequest, "request").route, "route").terminalTier,
    );
  });

  // No callback, handler, path, or extra field may enter the authenticated route boundary.
  it("should reject callbacks, forged authority, caller handlers, and extra keys before activity", async () => {
    const value = await fixture("standalone-stable");
    const api = await apis();
    const before = [...value.activity.workerThreads];
    const forgedInputs = [
      { ...record(value.originalRequest, "request") },
      { ...record(value.originalRequest, "request"), handler: () => undefined },
      { ...record(value.originalRequest, "request"), workerFactory: () => undefined },
      { ...record(value.originalRequest, "request"), repositoryRoot: "/tmp/hostile" },
    ];
    for (const originalRequest of forgedInputs) {
      failure(
        call<Result<unknown>>(api.internals, "openFailureExecutionProtocolV1", {
          parent: value.parent,
          execution: value.execution,
          originalRequest,
          origin: value.origin,
        }),
      );
    }
    expect(value.activity.workerThreads).toEqual(before);
  });

  // Both typed validity families use the already-published frontend handler chain.
  it("should route typed-valid and typed-invalid candidates through the existing published chain", async () => {
    const value = await fixture("standalone-stable");
    const api = await apis();
    const valid = await executeCandidate(api, value, value.candidate);
    expect(valid.evaluation.result).toMatchObject({ tier: "frontend" });
    expect(value.activity.workerThreads.length).toBeGreaterThan(0);
    expect(new Set(value.activity.isolateIdentities).size).toBe(
      value.activity.isolateIdentities.length,
    );
  });

  // Raw diagnostic bytes never acquire a typed execution-case or typed intermediate representation.
  it("should route zero and nonzero raw diagnostic bytes without typed intermediate representation", async () => {
    const value = await fixture("standalone-stable");
    const api = await apis();
    const context = success(
      call<Result<object>>(
        await vi.importActual<Api>("@blend65/readiness/published-oracle"),
        "createPublishedOracleContext",
        value.parent,
      ),
    );
    for (const sourceBytes of [new Uint8Array(), ENCODER.encode("@")]) {
      const malformed = success(
        call<Result<object>>(api.readiness, "createMalformedDiagnosticCaseV1", context, {
          revision: "malformed-diagnostic-case-input-v1",
          sourceBytes,
          encoding: "utf-8",
          ruleId: "diagnostic.malformed-source",
          obligation: "reject malformed language input",
          provenance: {
            revision: "malformed-token-text-provenance-v1",
            tokenizerRevision: "utf8-byte-spans-v1",
            tokens:
              sourceBytes.length === 0
                ? []
                : [{ kind: "unknown", startByte: 0, endByte: sourceBytes.length }],
          },
        }),
      );
      const projection = success(
        call<Result<Data>>(api.readiness, "getMalformedDiagnosticCaseProjectionV1", malformed),
      );
      expect(projection).toMatchObject({ sourceBytes });
      expect(projection).not.toHaveProperty("executionCase");
      expect(projection).not.toHaveProperty("typedIr");
    }
  });

  // Observing candidate support must not alter the canonical ordinary route representation.
  it("should keep equivalent ordinary generated-route behavior byte-compatible", async () => {
    const value = await fixture("standalone-stable");
    const api = await apis();
    const before = ENCODER.encode(`${JSON.stringify(value.originalRequest)}\n`);
    await executeCandidate(api, value, value.candidate);
    const after = ENCODER.encode(`${JSON.stringify(value.originalRequest)}\n`);
    expect(after).toEqual(before);
  });

  // Standalone confirmation owns two distinct workers, roots, and V8 isolates.
  it("should confirm stable predicates twice in genuinely distinct standalone isolates", async () => {
    const value = await fixture("standalone-stable");
    const api = await apis();
    const driven = await driveConfirmation(api, value);
    expect(driven.result).toMatchObject({
      revision: "failure-confirmation-result-v1",
      disposition: "confirmed-source-failure",
      confirmationDigests: [
        expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      ],
    });
    expect(new Set(value.activity.workerThreads).size).toBeGreaterThanOrEqual(2);
    expect(new Set(value.activity.rootIdentities).size).toBeGreaterThanOrEqual(2);
    expect(new Set(value.activity.isolateIdentities).size).toBeGreaterThanOrEqual(2);
  });

  // A sequence attempt authenticates ordered originals and exactly one terminal candidate.
  it("should bind failures at positions two through nine, isolate attempts, accept 64, and reject 65 before launch", async () => {
    for (const failingPosition of [2, 3, 4, 5, 6, 7, 8, 9, 64]) {
      const value = await fixture("sequence-only", {
        failingPosition,
        sequenceLength: failingPosition,
      });
      const api = await apis();
      const driven = await driveConfirmation(api, value);
      const positions: number[] = [];
      for (const step of driven.steps) {
        if (step.kind !== "execute-sequence-position" || step.position === undefined) continue;
        positions.push(
          success(
            call<Result<ObservationV1>>(
              api.internals,
              "getFailureExecutionObservationV1",
              driven.protocol,
              step.position,
            ),
          ).position,
        );
      }
      expect(positions).toEqual(Array.from({ length: failingPosition }, (_, index) => index + 1));
      expect(driven.result.disposition).toBe("stateful-sequence-failure");
      expect(
        new Set(
          driven.steps
            .filter((step) => step.kind === "execute-sequence-position")
            .map((step) => step.attempt),
        ).size,
      ).toBeGreaterThanOrEqual(1);
      await value.cleanup();
      openFixtures.delete(value);
    }

    const overLimit = await fixture("sequence-only", {
      failingPosition: 64,
      sequenceLength: 64,
    });
    const api = await apis();
    const session = protocol(api, overLimit);
    const before = [...overLimit.activity.workerThreads];
    failure(
      call<Result<unknown>>(api.internals, "beginStatefulSequenceAttemptV1", session, {
        attemptOrdinal: 1,
        precedingOriginals: Array.from({ length: 64 }, () => overLimit.originalRequest),
        terminalCandidate: invocation(api, overLimit.candidate, "confirmation"),
        failingPosition: 65,
        caseLimit: 65,
      }),
    );
    expect(overLimit.activity.workerThreads).toEqual(before);
  }, 900_000);

  // Fresh-run or sequence disagreement is flaky and never promotable beyond the campaign.
  it("should classify unstable fresh or sequence runs as flaky and keep them campaign-only", async () => {
    const value = await fixture("flaky");
    const api = await apis();
    const direct = success(
      await call<Promise<Result<ConfirmationResultV1>>>(
        api.execution,
        "confirmReducedFailureV1",
        value.parent,
        value.execution,
        value.candidate,
        value.origin,
        value.budget,
      ),
    );
    expect(direct).toMatchObject({ disposition: "flaky-failure" });
    expect(direct).not.toHaveProperty("promotionAuthority");
    expect(direct).not.toHaveProperty("sequenceEvidence.promotionAuthority");
  });

  // Infrastructure-like candidate failure is confirmed only after a passing same-route control.
  it("should require two infrastructure reproductions and a distinct passing same-route control", async () => {
    const value = await fixture("infrastructure-with-passing-control");
    const api = await apis();
    const driven = await driveConfirmation(api, value);
    expect(driven.result.disposition).toBe("confirmed-source-failure");
    expect(driven.steps.filter((step) => step.kind === "execute-candidate")).toHaveLength(2);
    expect(driven.steps.filter((step) => step.kind === "execute-control")).toHaveLength(1);
    expect(new Set(value.activity.workerThreads).size).toBeGreaterThanOrEqual(3);
  });

  // Missing retained handler or tool authority is closed and never replaced by current authority.
  it("should fail closed without current handler or tool fallback when historical authority is missing", async () => {
    const value = await fixture("standalone-stable");
    const api = await apis();
    const before = [...value.activity.workerThreads];
    const copiedParent = { ...record(value.parent, "parent") };
    failure(
      call<Result<unknown>>(api.internals, "openFailureExecutionProtocolV1", {
        parent: copiedParent,
        execution: value.execution,
        originalRequest: value.originalRequest,
        origin: value.origin,
      }),
      "historical-authority-unavailable",
    );
    expect(value.activity.workerThreads).toEqual(before);
  });
});
