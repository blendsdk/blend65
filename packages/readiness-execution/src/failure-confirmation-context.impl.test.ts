import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createFailureExecutionSpecFixtureV1,
  type FailureExecutionSpecApiV1 as Api,
  type FailureExecutionSpecDataV1 as Data,
  type FailureExecutionSpecFixtureV1 as Fixture,
  type FailureExecutionSpecResultV1 as Result,
} from "./test-fixtures/failure-execution-spec-fixture.js";

const openFixtures = new Set<Fixture>();

function call<T>(api: Api, name: string, ...arguments_: readonly unknown[]): T {
  const operation = api[name];
  if (typeof operation !== "function") throw new TypeError(`missing operation ${name}`);
  return Reflect.apply(operation, undefined, arguments_) as T;
}

function success<T>(result: Result<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError(JSON.stringify(result.issues ?? result.diagnostics ?? []));
  return result.value;
}

function failure(result: Result<unknown>): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.issues).toContainEqual(
    expect.objectContaining({ code: "historical-authority-unavailable" }),
  );
}

function record(value: unknown, message: string): Data {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(message);
  }
  return value as Data;
}

afterEach(async () => {
  for (const fixture of openFixtures) await fixture.cleanup();
  openFixtures.clear();
});

describe("failure confirmation context joins", () => {
  it("covers every exact report, envelope, candidate, observation, route, and tool comparison", async () => {
    const fixture = await createFailureExecutionSpecFixtureV1("standalone-stable", {
      includeForeignToolOrigin: true,
    });
    openFixtures.add(fixture);
    const [internals, readiness, reduction, contextApi] = await Promise.all([
      vi.importActual<Api>("./failure-execution-internals.js"),
      vi.importActual<Api>("@blend65/readiness"),
      vi.importActual<Api>("@blend65/readiness/failure-reduction-internals"),
      vi.importActual<Api>("./failure-confirmation-context.js"),
    ]);
    const input = {
      report: fixture.report,
      subject: fixture.subjectPosition,
      candidate: fixture.candidate,
      origin: fixture.origin,
      budget: fixture.budget,
    };
    const context = success(
      call<Result<object>>(internals, "createFailureConfirmationContextV1", input),
    );
    expect(call<unknown>(contextApi, "getFailureConfirmationContextStateV1", context)).toEqual(
      expect.objectContaining({ report: fixture.report, origin: fixture.origin }),
    );
    expect(call<unknown>(contextApi, "getFailureConfirmationContextStateV1", {})).toBeUndefined();
    expect(call<unknown>(contextApi, "getFailureConfirmationContextStateV1", null)).toBeUndefined();

    const positionRequests = fixture.reportPositions.map((position) =>
      success(call<Result<object>>(internals, "getExecutionReportPositionRequestV1", position)),
    );
    expect(fixture.subjectIndex).toBeGreaterThan(0);
    const subjectRequest = positionRequests[fixture.subjectIndex];
    if (subjectRequest === undefined) throw new TypeError("subject report request");
    const mixedPreceding = positionRequests.slice(0, fixture.subjectIndex);
    mixedPreceding[0] = subjectRequest;
    const mixedInvocation = success(
      call<Result<object>>(
        reduction,
        "createReductionCandidateInvocationV1",
        fixture.candidate,
        "confirmation",
        "normalization",
      ),
    );
    const mixedProtocol = success(
      call<Result<object>>(internals, "openFailureExecutionProtocolV1", context),
    );
    const mixedAttempt = call<Result<unknown>>(
      internals,
      "beginStatefulSequenceAttemptV1",
      mixedProtocol,
      {
        attemptOrdinal: 1,
        precedingOriginals: mixedPreceding,
        terminalCandidate: mixedInvocation,
        failingPosition: fixture.subjectIndex + 1,
        caseLimit: fixture.subjectIndex + 1,
      },
    );
    expect(mixedAttempt).toMatchObject({
      ok: false,
      issues: [{ code: "execution-plan-capacity", path: "/sequence" }],
    });
    expect(call<boolean>(reduction, "abandonReductionCandidateInvocationV1", mixedInvocation)).toBe(
      true,
    );

    failure(
      call<Result<unknown>>(internals, "createFailureConfirmationContextV1", {
        ...input,
        unexpected: true,
      }),
    );

    const routeRecords = fixture.report.routeRecords;
    if (!Array.isArray(routeRecords)) throw new TypeError("report route records");
    const passingIndex = routeRecords.findIndex((routeRecord) => {
      const routeRecordData = record(routeRecord, "route record");
      const result = record(routeRecordData.result, "route result");
      return result.status === "pass";
    });
    const passingPosition = fixture.reportPositions[passingIndex];
    if (passingPosition === undefined) throw new TypeError("passing report position");
    failure(
      call<Result<unknown>>(internals, "createFailureConfirmationContextV1", {
        ...input,
        subject: passingPosition,
      }),
    );

    const candidateFor = (origin: object): object => {
      const initial = success(
        call<Result<object>>(reduction, "createInitialReductionCandidateV1", origin),
      );
      return success(
        call<Result<object>>(reduction, "createReductionCandidateAuthorityV1", origin, initial, []),
      );
    };
    for (const origin of [
      fixture.mismatchAuthorities.predicate,
      fixture.mismatchAuthorities.cleanup,
      fixture.mismatchAuthorities.routePlan,
    ]) {
      failure(
        call<Result<unknown>>(internals, "createFailureConfirmationContextV1", {
          ...input,
          origin,
          candidate: candidateFor(origin),
        }),
      );
    }

    const originalProjection = success(
      call<Result<Data>>(readiness, "getFailureEnvelopeProjectionV1", fixture.origin),
    );
    const observationProjection = success(
      call<Result<Data>>(
        readiness,
        "getFailureEnvelopeProjectionV1",
        fixture.mismatchAuthorities.observation,
      ),
    );
    const originalBytes = originalProjection.observationBytes;
    const foreignBytes = observationProjection.observationBytes;
    expect(originalBytes).toBeInstanceOf(Uint8Array);
    expect(foreignBytes).toBeInstanceOf(Uint8Array);
    expect(foreignBytes).not.toEqual(originalBytes);
    failure(
      call<Result<unknown>>(internals, "createFailureConfirmationContextV1", {
        ...input,
        origin: fixture.mismatchAuthorities.observation,
        candidate: candidateFor(fixture.mismatchAuthorities.observation),
      }),
    );

    const foreignToolOrigin = fixture.mismatchAuthorities.tool;
    if (foreignToolOrigin === undefined) throw new TypeError("foreign tool authority");
    failure(
      call<Result<unknown>>(internals, "createFailureConfirmationContextV1", {
        ...input,
        origin: foreignToolOrigin,
        candidate: candidateFor(foreignToolOrigin),
      }),
    );
    failure(
      call<Result<unknown>>(internals, "createFailureConfirmationContextV1", {
        ...input,
        candidate: fixture.mismatchAuthorities.candidate,
      }),
    );

    const wrongPosition = fixture.reportPositions.find(
      (position) => position !== fixture.subjectPosition,
    );
    if (wrongPosition === undefined) throw new TypeError("wrong report position");
    failure(
      call<Result<unknown>>(internals, "createFailureConfirmationContextV1", {
        ...input,
        subject: wrongPosition,
      }),
    );
    failure(
      call<Result<unknown>>(internals, "createFailureConfirmationContextV1", {
        ...input,
        report: { ...fixture.report },
      }),
    );
    failure(
      call<Result<unknown>>(internals, "createFailureConfirmationContextV1", {
        ...input,
        control: {},
      }),
    );

    const originalPredicate = record(originalProjection.predicate, "origin predicate");
    const originalRoute = record(originalPredicate.routeContract, "origin route contract");
    if (!Array.isArray(originalProjection.toolVersions)) {
      throw new TypeError("complete origin tool identities");
    }
    const toolDigests = originalProjection.toolVersions
      .map((tool) => record(tool, "tool identity").digest)
      .sort();
    expect(toolDigests).toEqual(originalRoute.toolContractDigests);
  }, 600_000);
});
