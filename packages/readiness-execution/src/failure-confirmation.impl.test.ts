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

async function fixture(
  scenario: "sequence-only" | "standalone-stable" = "sequence-only",
): Promise<Fixture> {
  const value = await createFailureExecutionSpecFixtureV1(
    scenario,
    scenario === "sequence-only" ? { failingPosition: 2, sequenceLength: 2 } : undefined,
  );
  openFixtures.add(value);
  return value;
}

async function apis(): Promise<{
  readonly confirmation: Api;
  readonly context: Api;
  readonly execution: Api;
  readonly internals: Api;
  readonly isolation: Api;
  readonly readiness: Api;
  readonly reduction: Api;
  readonly routes: Api;
}> {
  const [confirmation, context, execution, internals, isolation, readiness, reduction, routes] =
    await Promise.all([
      vi.importActual<Api>("./failure-confirmation.js"),
      vi.importActual<Api>("./failure-confirmation-context.js"),
      vi.importActual<Api>("./index.js"),
      vi.importActual<Api>("./failure-execution-internals.js"),
      vi.importActual<Api>("./failure-execution-isolation.js"),
      vi.importActual<Api>("@blend65/readiness"),
      vi.importActual<Api>("@blend65/readiness/failure-reduction-internals"),
      vi.importActual<Api>("./failure-route-adapter.js"),
    ]);
  return {
    confirmation,
    context,
    execution,
    internals,
    isolation,
    readiness,
    reduction,
    routes,
  };
}

function confirmationContext(api: Awaited<ReturnType<typeof apis>>, value: Fixture): object {
  return success(
    call<Result<object>>(api.internals, "createFailureConfirmationContextV1", {
      report: value.report,
      subject: value.subjectPosition,
      candidate: value.candidate,
      origin: value.origin,
      budget: value.budget,
    }),
  );
}

function openProtocol(api: Awaited<ReturnType<typeof apis>>, context: object): object {
  return success(call<Result<object>>(api.internals, "openFailureExecutionProtocolV1", context));
}

function protocol(api: Awaited<ReturnType<typeof apis>>, value: Fixture): object {
  return openProtocol(api, confirmationContext(api, value));
}

function precedingOriginals(api: Awaited<ReturnType<typeof apis>>, value: Fixture): object[] {
  return value.reportPositions
    .slice(0, value.subjectIndex)
    .map((position) =>
      success(call<Result<object>>(api.internals, "getExecutionReportPositionRequestV1", position)),
    );
}

function invocation(
  api: Awaited<ReturnType<typeof apis>>,
  value: Fixture,
  purpose: "reduction" | "confirmation",
): object {
  return success(
    call<Result<object>>(
      api.reduction,
      "createReductionCandidateInvocationV1",
      value.candidate,
      purpose,
      purpose === "reduction" ? "catalog-edit" : "normalization",
    ),
  );
}

afterEach(async () => {
  for (const value of openFixtures) await value.cleanup();
  openFixtures.clear();
});

describe("failure confirmation capability hardening", () => {
  it("should reject cross-protocol controls, wrong modes, shutdown reuse, and retired token order", async () => {
    const value = await fixture("standalone-stable");
    const api = await apis();
    const context = confirmationContext(api, value);
    const firstProtocol = openProtocol(api, context);
    const secondProtocol = openProtocol(api, context);
    const contextState = call<{ readonly control?: { readonly request: object } }>(
      api.context,
      "getFailureConfirmationContextStateV1",
      context,
    );
    if (contextState.control === undefined) throw new TypeError("missing passing control");
    const control = success(
      call<Result<object>>(
        api.internals,
        "createFailureExecutionControlV1",
        firstProtocol,
        contextState.control.request,
      ),
    );
    failure(
      call<Result<unknown>>(
        api.internals,
        "mintStandaloneFailureExecutionIsolationV1",
        secondProtocol,
        control,
      ),
      "unbound-capability",
    );

    const campaign = success(
      call<Result<object>>(api.internals, "mintCampaignFailureExecutionIsolationV1", firstProtocol),
    );
    const wrongCampaignSubject = invocation(api, value, "confirmation");
    failure(
      call<Result<unknown>>(
        api.execution,
        "createReductionExecutionRouteRequestV1",
        value.parent,
        wrongCampaignSubject,
        campaign,
      ),
      "unbound-capability",
    );
    expect(
      call<boolean>(api.reduction, "abandonReductionCandidateInvocationV1", wrongCampaignSubject),
    ).toBe(true);

    const first = invocation(api, value, "reduction");
    const second = invocation(api, value, "reduction");
    failure(
      call<Result<unknown>>(
        api.execution,
        "createReductionExecutionRouteRequestV1",
        value.parent,
        second,
        campaign,
      ),
    );
    success(
      call<Result<object>>(
        api.execution,
        "createReductionExecutionRouteRequestV1",
        value.parent,
        first,
        campaign,
      ),
    );
    success(
      call<Result<object>>(
        api.execution,
        "createReductionExecutionRouteRequestV1",
        value.parent,
        invocation(api, value, "reduction"),
        campaign,
      ),
    );

    const wrongStandaloneSubject = invocation(api, value, "reduction");
    failure(
      call<Result<unknown>>(
        api.internals,
        "mintStandaloneFailureExecutionIsolationV1",
        firstProtocol,
        wrongStandaloneSubject,
      ),
      "unbound-capability",
    );
    expect(
      call<boolean>(api.reduction, "abandonReductionCandidateInvocationV1", wrongStandaloneSubject),
    ).toBe(true);

    failure(
      await call<Promise<Result<unknown>>>(
        api.internals,
        "shutdownFailureExecutionIsolationV1",
        secondProtocol,
        campaign,
      ),
      "unbound-capability",
    );
    success(
      await call<Promise<Result<true>>>(
        api.internals,
        "shutdownFailureExecutionIsolationV1",
        firstProtocol,
        campaign,
      ),
    );
    failure(
      await call<Promise<Result<unknown>>>(
        api.internals,
        "shutdownFailureExecutionIsolationV1",
        firstProtocol,
        campaign,
      ),
      "unbound-capability",
    );
  });

  it("should bind one fresh terminal candidate to ordered attempt positions", async () => {
    const value = await fixture();
    const api = await apis();
    const firstProtocol = protocol(api, value);
    const secondProtocol = protocol(api, value);
    const originals = precedingOriginals(api, value);
    const before = [...value.activity.workerThreads];

    for (const terminalCandidate of [{}, invocation(api, value, "reduction")]) {
      failure(
        call<Result<unknown>>(api.internals, "beginStatefulSequenceAttemptV1", firstProtocol, {
          attemptOrdinal: 1,
          precedingOriginals: originals,
          terminalCandidate,
          failingPosition: 2,
          caseLimit: 2,
        }),
        "unbound-capability",
      );
    }
    failure(
      call<Result<unknown>>(api.internals, "beginStatefulSequenceAttemptV1", firstProtocol, {
        attemptOrdinal: 1,
        precedingOriginals: Array.from({ length: 64 }, () => value.originalRequest),
        terminalCandidate: invocation(api, value, "confirmation"),
        failingPosition: 65,
        caseLimit: 65,
      }),
      "execution-plan-capacity",
    );
    expect(value.activity.workerThreads).toEqual(before);

    const firstAttempt = success(
      call<Result<object>>(api.internals, "beginStatefulSequenceAttemptV1", firstProtocol, {
        attemptOrdinal: 1,
        precedingOriginals: originals,
        terminalCandidate: invocation(api, value, "confirmation"),
        failingPosition: 2,
        caseLimit: 2,
      }),
    );
    const secondAttempt = success(
      call<Result<object>>(api.internals, "beginStatefulSequenceAttemptV1", firstProtocol, {
        attemptOrdinal: 2,
        precedingOriginals: originals,
        terminalCandidate: invocation(api, value, "confirmation"),
        failingPosition: 2,
        caseLimit: 2,
      }),
    );
    const next = success(
      call<Result<{ readonly kind: string; readonly position: object }>>(
        api.internals,
        "nextStatefulSequencePositionV1",
        firstProtocol,
        firstAttempt,
      ),
    );
    expect(next.kind).toBe("execute");
    failure(
      call<Result<unknown>>(
        api.internals,
        "nextStatefulSequencePositionV1",
        firstProtocol,
        firstAttempt,
      ),
      "unbound-capability",
    );
    failure(
      call<Result<unknown>>(
        api.internals,
        "recordStatefulSequencePositionV1",
        firstProtocol,
        secondAttempt,
        next.position,
        {},
      ),
      "unbound-capability",
    );
    failure(
      call<Result<unknown>>(
        api.internals,
        "recordStatefulSequencePositionV1",
        secondProtocol,
        firstAttempt,
        next.position,
        {},
      ),
      "unbound-capability",
    );
    failure(
      call<Result<true>>(
        api.internals,
        "recordStatefulSequencePositionV1",
        firstProtocol,
        firstAttempt,
        next.position,
        {},
      ),
      "unbound-capability",
    );
    failure(
      call<Result<unknown>>(
        api.internals,
        "recordStatefulSequencePositionV1",
        firstProtocol,
        firstAttempt,
        next.position,
        {},
      ),
      "unbound-capability",
    );
    expect(
      success(
        call<Result<{ readonly position: number }>>(
          api.internals,
          "getFailureExecutionObservationV1",
          firstProtocol,
          next.position,
        ),
      ).position,
    ).toBe(1);
  });

  it("should stop confirmation before worker activity when the shared route budget is exhausted", async () => {
    const value = await fixture();
    const api = await apis();
    const context = confirmationContext(api, value);
    const sessionProtocol = openProtocol(api, context);
    for (let count = 0; count < 1_024; count += 1) {
      success(
        call<Result<object>>(api.readiness, "chargeFailureCampaignBudgetV1", value.budget, {
          kind: "route-execution",
          purpose: "confirmation",
        }),
      );
    }
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
    const step = success(
      call<Result<{ readonly authority: object }>>(
        api.internals,
        "nextFailureConfirmationStepV1",
        sessionProtocol,
        session,
      ),
    );
    const before = [...value.activity.workerThreads];
    failure(
      await call<Promise<Result<unknown>>>(
        api.internals,
        "executeFailureConfirmationStepV1",
        sessionProtocol,
        session,
        step.authority,
      ),
      "execution-plan-capacity",
    );
    expect(value.activity.workerThreads).toEqual(before);
    failure(
      await call<Promise<Result<unknown>>>(api.confirmation, "confirmReducedFailureV1", context),
      "execution-plan-capacity",
    );
  });
});
