import { describe, expect, it } from "vitest";

import type {
  FailureExecutionCandidateEvaluationV1 as CandidateEvaluationV1,
  FailureExecutionSpecDataV1 as Data,
  FailureExecutionSpecResultV1 as Result,
} from "./test-fixtures/failure-execution-spec-fixture.js";
import {
  ENCODER,
  authority,
  call,
  digestBytes,
  executeCandidate,
  failure,
  fixture,
  invocation,
  protocol,
  record,
  success,
} from "./failure-candidate-execution-spec-support.js";

describe("failure candidate execution oracle", () => {
  // Observation evidence has an explicit closed arm and cannot absorb execution identities or cleanup.
  it("should normalize explicit observed and not-reached evidence independently of source, route, build, timing, and cleanup", async () => {
    const observedFixture = await fixture("standalone-stable");
    const api = observedFixture.apis;
    const observedBytes = new Uint8Array([0x10, 0x20, 0x30]);
    const firstObserved = call<object | undefined>(
      api.internals,
      "createObservedFailureObservationEvidenceV1",
      { kind: "scalar-bytes", bytes: observedBytes },
    );
    const secondObserved = call<object | undefined>(
      api.internals,
      "createObservedFailureObservationEvidenceV1",
      { kind: "scalar-bytes", bytes: new Uint8Array(observedBytes) },
    );
    if (firstObserved === undefined || secondObserved === undefined) {
      throw new TypeError("observed evidence authority");
    }
    const project = (authority: object): Data => {
      const projection = call<Data | undefined>(
        api.internals,
        "getFailureObservationEvidenceProjectionV1",
        authority,
      );
      if (projection === undefined) throw new TypeError("observation evidence projection");
      return projection;
    };
    const firstProjection = project(firstObserved);
    expect(firstProjection).toEqual({
      revision: "failure-observation-evidence-projection-v1",
      kind: "observed",
      digest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      byteLength: observedBytes.byteLength,
    });
    expect(project(secondObserved)).toEqual(firstProjection);
    expect(JSON.stringify(firstProjection)).not.toMatch(
      /(?:source|case|candidate|execution|route|build|timing|workspace|cleanup)/iu,
    );

    const records = record(observedFixture.report, "report").routeRecords;
    if (!Array.isArray(records)) throw new TypeError("report route records");
    const subjectResult = record(
      record(records[observedFixture.subjectIndex], "subject route record").result,
      "subject result",
    );
    const terminalProjection = (result: unknown): Data => {
      const terminal = call<object | undefined>(
        api.internals,
        "createNotReachedFailureObservationEvidenceV1",
        result,
      );
      if (terminal === undefined) throw new TypeError("not-reached evidence authority");
      const projection = call<Data | undefined>(
        api.internals,
        "getFailureObservationEvidenceProjectionV1",
        terminal,
      );
      if (projection === undefined) throw new TypeError("not-reached evidence projection");
      return projection;
    };
    const firstTerminal = terminalProjection(subjectResult);
    const cleanupVariant = terminalProjection({
      ...subjectResult,
      cleanupBlocker: { code: "emulator-lease-recovery-blocked" },
    });
    const terminalFactVariant = terminalProjection({
      ...subjectResult,
      adapterSubcode:
        subjectResult.adapterSubcode === "fixture-terminal-reason-b"
          ? "fixture-terminal-reason-a"
          : "fixture-terminal-reason-b",
    });
    expect(firstTerminal).toMatchObject({
      revision: "failure-observation-evidence-projection-v1",
      kind: "not-reached",
      digest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      byteLength: expect.any(Number),
    });
    expect(cleanupVariant).toEqual(firstTerminal);
    expect(terminalFactVariant.kind).toBe("not-reached");
    expect(terminalFactVariant.digest).not.toBe(firstTerminal.digest);
    expect(firstTerminal).not.toHaveProperty("cleanup");
  }, 600_000);

  // Private predicate evidence is immutable and remains outside the complete report wire format.
  it("should bind immutable ordered predicate sidecars to one complete report without serialization authority for partial shells", async () => {
    const value = await fixture("standalone-stable");
    const api = value.apis;
    const report = value.report;
    const before = call<Uint8Array>(api.execution, "serializeExecutionAuthorityReportV1", report);
    const sidecars = success(
      call<Result<readonly Data[]>>(
        api.internals,
        "getExecutionAuthorityReportPredicateSidecarsV1",
        report,
      ),
    );
    const retained = structuredClone(sidecars);
    const subjectSidecar = record(sidecars[value.subjectIndex], "subject sidecar");
    const basis = record(subjectSidecar.predicateBasis, "predicate basis");
    const ingredients = record(basis.value, "predicate ingredients");
    const routeContract = record(ingredients.routeContract, "predicate route contract");
    Reflect.set(ingredients, "cleanup", "cleanup-blocked");
    if (Array.isArray(routeContract.toolContractDigests)) {
      try {
        routeContract.toolContractDigests.push(`sha256:${"f".repeat(64)}`);
      } catch {
        // Deep freezing and defensive copies are both valid ways to protect retained authority.
      }
    }
    expect(
      success(
        call<Result<readonly Data[]>>(
          api.internals,
          "getExecutionAuthorityReportPredicateSidecarsV1",
          report,
        ),
      ),
    ).toEqual(retained);
    expect(call<Uint8Array>(api.execution, "serializeExecutionAuthorityReportV1", report)).toEqual(
      before,
    );
    const reportText = new TextDecoder().decode(before);
    expect(reportText).not.toContain("predicateSidecar");
    expect(reportText).not.toContain("normalizedObservationBytes");
    expect(reportText).not.toContain("failure-observation");

    const historical = authority(
      call<unknown>(api.reports, "authorizeExecutionAuthorityReportV1", structuredClone(report)),
    );
    failure(
      call<Result<unknown>>(
        api.internals,
        "getExecutionAuthorityReportPredicateSidecarsV1",
        historical,
      ),
      "historical-authority-unavailable",
    );
    const reportResults = record(report, "report").results;
    if (!Array.isArray(reportResults)) throw new TypeError("complete report results");
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
    expect(() =>
      call<Uint8Array>(
        api.execution,
        "serializeExecutionAuthorityReportV1",
        authority(
          call<unknown>(
            api.reports,
            "authorizeExecutionAuthorityReportV1",
            {
              revision: "execution-authority-report-v1",
              results: [reportResults[value.subjectIndex]],
            },
            [sidecars[value.subjectIndex]],
          ),
        ),
      ),
    ).toThrow();
  });

  // Empty bytes are a legal raw diagnostic payload but never a typed program payload.
  it("should execute an empty raw malformed candidate and reject empty typed candidates", async () => {
    const value = await fixture("standalone-stable");
    const api = value.apis;
    const context = success(
      call<Result<object>>(api.published, "createPublishedOracleContext", value.parent),
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
        toolVersions: source.toolVersions,
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
    const api = value.apis;
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
    const api = value.apis;
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
    expect(second.candidateDigest).toBe(first.candidateDigest);
    expect(second.candidateExecutionIdentity).not.toBe(first.candidateExecutionIdentity);
    expect(
      success(call<Result<Data>>(api.readiness, "getFailureEnvelopeProjectionV1", value.origin)),
    ).toEqual(before);
  });

  // Execution replaces only source-bound identity and preserves the authenticated route contract.
  it("should execute through the original route with obligation, tier, policy, fixture, oracle, tools, and predicate unchanged", async () => {
    const value = await fixture("standalone-stable");
    const api = value.apis;
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
    const originPredicate = record(origin.predicate, "origin predicate");
    const evaluatedPredicate = record(
      record(executed.evaluation.predicateEvidence, "predicate evidence").predicate,
      "evaluated predicate",
    );
    const requiredClaims = originPredicate.requiredClaimedRuleIds;
    if (!Array.isArray(requiredClaims) || requiredClaims.length < 1) {
      throw new TypeError("authenticated required claim set");
    }
    expect(new Set(requiredClaims).size).toBe(requiredClaims.length);
    expect(evaluatedPredicate.requiredClaimedRuleIds).toEqual(requiredClaims);
    expect(evaluatedPredicate.primaryRuleId).toBe(originPredicate.primaryRuleId);
    expect(requiredClaims).toContain(originPredicate.primaryRuleId);
  });

  // No callback, handler, path, or extra field may enter the authenticated route boundary.
  it("should reject callbacks, forged authority, caller handlers, and extra keys before activity", async () => {
    const value = await fixture("standalone-stable");
    const api = value.apis;
    const before = [...value.activity.workerThreads];
    const forgedInputs: readonly Data[] = [
      { report: { ...value.report } },
      { candidate: { ...record(value.candidate, "candidate") } },
      { handler: () => undefined },
      { workerFactory: () => undefined },
      { repositoryRoot: "/tmp/hostile" },
    ];
    for (const hostile of forgedInputs) {
      failure(
        call<Result<unknown>>(api.internals, "createFailureConfirmationContextV1", {
          report: value.report,
          subject: value.subjectPosition,
          candidate: value.candidate,
          origin: value.origin,
          budget: value.budget,
          ...hostile,
        }),
      );
    }
    expect(value.activity.workerThreads).toEqual(before);
  });

  // Both typed validity families use their exact already-published handler chain.
  it("should route typed-valid and typed-invalid candidates through the existing published chain", async () => {
    for (const candidateFamily of ["typed-valid", "typed-invalid"] as const) {
      const value = await fixture("standalone-stable", { candidateFamily });
      const api = value.apis;
      const originalRoute = record(
        record(value.originalRequest, "original request").route,
        "original route",
      );
      const expectedTier = originalRoute.terminalTier;
      const workerRequestCount = value.activity.workerRequests.length;
      const workerThreadCount = value.activity.workerThreads.length;
      const isolateCount = value.activity.isolateIdentities.length;
      const priorWorkerThreads = new Set(value.activity.workerThreads);
      const priorIsolates = new Set(value.activity.isolateIdentities);
      const evaluation = await executeCandidate(api, value, value.candidate);
      expect(evaluation.evaluation.result).toMatchObject({ tier: expectedTier });
      expect(value.activity.workerRequests.slice(workerRequestCount)).toEqual([
        expect.objectContaining({ tier: expectedTier }),
      ]);
      expect(value.activity.workerThreads.slice(workerThreadCount)).toHaveLength(1);
      expect(value.activity.isolateIdentities.slice(isolateCount)).toHaveLength(1);
      expect(priorWorkerThreads.has(value.activity.workerThreads[workerThreadCount])).toBe(false);
      expect(priorIsolates.has(value.activity.isolateIdentities[isolateCount])).toBe(false);
    }
  }, 600_000);

  // Raw diagnostic bytes never acquire a typed execution-case or typed intermediate representation.
  it("should route zero and nonzero raw diagnostic bytes without typed intermediate representation", async () => {
    const value = await fixture("standalone-stable");
    const api = value.apis;
    const context = success(
      call<Result<object>>(api.published, "createPublishedOracleContext", value.parent),
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
    const api = value.apis;
    const before = ENCODER.encode(`${JSON.stringify(value.originalRequest)}\n`);
    await executeCandidate(api, value, value.candidate);
    const after = ENCODER.encode(`${JSON.stringify(value.originalRequest)}\n`);
    expect(after).toEqual(before);
  });

  // A confirmation context joins the complete historical predicate, observation, and cleanup.
});
