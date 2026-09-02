import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createFailureExecutionSpecFixtureV1,
  type FailureExecutionSpecApiV1 as Api,
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

function failure(result: Result<unknown>, code: string): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect([...(result.issues ?? []), ...(result.diagnostics ?? [])]).toContainEqual(
    expect.objectContaining({ code }),
  );
}

afterEach(async () => {
  for (const fixture of openFixtures) await fixture.cleanup();
  openFixtures.clear();
});

describe("report-position failure envelope authorization", () => {
  it("returns only genuine envelopes and rejects copied, pass, invalid-policy, and foreign positions", async () => {
    const fixture = await createFailureExecutionSpecFixtureV1("standalone-stable");
    openFixtures.add(fixture);
    const [internals, readiness, reduction] = await Promise.all([
      vi.importActual<Api>("./failure-execution-internals.js"),
      vi.importActual<Api>("@blend65/readiness"),
      vi.importActual<Api>("@blend65/readiness/failure-reduction-internals"),
    ]);
    const policy = readiness.FAILURE_REDUCTION_DEFAULT_POLICY_V1;
    const origin = success(
      call<Result<object>>(
        internals,
        "authorizeFailureEnvelopeFromReportPositionV1",
        fixture.subjectPosition,
        policy,
      ),
    );
    const projection = success(
      call<Result<{ readonly routePlanDigest: string }>>(
        readiness,
        "getFailureEnvelopeProjectionV1",
        origin,
      ),
    );
    expect(projection.routePlanDigest).toBe(Reflect.get(fixture.report, "routePlanDigest"));
    success(call<Result<object>>(reduction, "createInitialReductionCandidateV1", origin));

    failure(
      call<Result<unknown>>(
        internals,
        "authorizeFailureEnvelopeFromReportPositionV1",
        { ...fixture.subjectPosition },
        policy,
      ),
      "unbound-capability",
    );
    const reportResults = Reflect.get(fixture.report, "results");
    if (!Array.isArray(reportResults)) throw new TypeError("fixture report results");
    const passIndex = reportResults.findIndex(
      (result: unknown) =>
        typeof result === "object" && result !== null && Reflect.get(result, "status") === "pass",
    );
    if (passIndex < 0) throw new TypeError("fixture requires one passing report position");
    failure(
      call<Result<unknown>>(
        internals,
        "authorizeFailureEnvelopeFromReportPositionV1",
        fixture.reportPositions[passIndex],
        policy,
      ),
      "invalid-evidence-input",
    );
    failure(
      call<Result<unknown>>(
        internals,
        "authorizeFailureEnvelopeFromReportPositionV1",
        fixture.subjectPosition,
        {},
      ),
      "execution.invalid-schema",
    );

    vi.resetModules();
    const freshInternals = await vi.importActual<Api>("./failure-execution-internals.js");
    failure(
      call<Result<unknown>>(
        freshInternals,
        "authorizeFailureEnvelopeFromReportPositionV1",
        fixture.subjectPosition,
        policy,
      ),
      "unbound-capability",
    );
  });
});
