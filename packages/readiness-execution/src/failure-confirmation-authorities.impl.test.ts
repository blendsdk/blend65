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
  it("should reject forged protocol, isolation, route, sequence, and confirmation authorities", async () => {
    const value = await fixture();
    const api = await apis();
    const context = confirmationContext(api, value);

    failure(
      call<Result<unknown>>(api.isolation, "openFailureExecutionProtocolV1", null),
      "unbound-capability",
    );
    failure(
      call<Result<unknown>>(api.isolation, "openFailureExecutionProtocolV1", {}),
      "unbound-capability",
    );
    failure(
      call<Result<unknown>>(api.isolation, "openFailureExecutionProtocolV1", { ...context }),
      "unbound-capability",
    );
    const owner = openProtocol(api, context);
    expect(
      call<unknown>(api.isolation, "getFailureExecutionProtocolStateV1", null),
    ).toBeUndefined();
    expect(
      call<unknown>(api.isolation, "getReductionExecutionIsolationStateV1", null),
    ).toBeUndefined();
    expect(call<unknown>(api.isolation, "getFailureExecutionControlStateV1", null)).toBeUndefined();
    expect(call<unknown>(api.isolation, "getStatefulSequenceAttemptStateV1", null)).toBeUndefined();
    expect(
      call<unknown>(api.isolation, "getStatefulSequencePositionStateV1", null),
    ).toBeUndefined();
    expect(
      call<unknown>(api.isolation, "getFailureExecutionOriginalPayloadV1", {}),
    ).toBeUndefined();
    expect(call<unknown>(api.isolation, "getFailureExecutionPredicateV1", {})).toBeUndefined();

    for (const operation of [
      "mintCampaignFailureExecutionIsolationV1",
      "mintFailureExecutionProbeIsolationV1",
    ]) {
      failure(call<Result<unknown>>(api.isolation, operation, {}), "unbound-capability");
    }
    failure(
      call<Result<unknown>>(
        api.isolation,
        "mintStandaloneFailureExecutionIsolationV1",
        owner,
        null,
      ),
      "unbound-capability",
    );
    failure(
      call<Result<unknown>>(api.isolation, "mintStandaloneFailureExecutionIsolationV1", owner, {}),
      "unbound-capability",
    );
    failure(
      call<Result<unknown>>(
        api.isolation,
        "createFailureExecutionControlV1",
        {},
        value.originalRequest,
      ),
      "unbound-capability",
    );
    failure(
      call<Result<unknown>>(api.isolation, "createFailureExecutionControlV1", owner, {}),
      "unbound-capability",
    );
    failure(
      call<Result<unknown>>(api.isolation, "getFailureExecutionObservationV1", {}, {}),
      "unbound-capability",
    );
    failure(
      call<Result<unknown>>(api.isolation, "getFailureExecutionObservationV1", owner, {}),
      "unbound-capability",
    );

    const campaign = success(
      call<Result<object>>(api.isolation, "mintCampaignFailureExecutionIsolationV1", owner),
    );
    const isolatedSubject = invocation(api, value, "confirmation");
    const standalone = success(
      call<Result<object>>(
        api.isolation,
        "mintStandaloneFailureExecutionIsolationV1",
        owner,
        isolatedSubject,
      ),
    );
    failure(
      call<Result<unknown>>(api.isolation, "consumeFailureExecutionIsolationV1", standalone, {}),
      "unbound-capability",
    );
    const mismatchedInvocation = invocation(api, value, "confirmation");
    failure(
      call<Result<unknown>>(
        api.routes,
        "createReductionExecutionRouteRequestV1",
        value.parent,
        mismatchedInvocation,
        standalone,
      ),
      "unbound-capability",
    );
    expect(
      call<boolean>(api.reduction, "abandonReductionCandidateInvocationV1", mismatchedInvocation),
    ).toBe(true);
    success(
      call<Result<object>>(
        api.isolation,
        "consumeFailureExecutionIsolationV1",
        standalone,
        isolatedSubject,
      ),
    );
    failure(
      call<Result<unknown>>(
        api.isolation,
        "consumeFailureExecutionIsolationV1",
        standalone,
        isolatedSubject,
      ),
      "unbound-capability",
    );
    expect(
      call<boolean>(api.reduction, "abandonReductionCandidateInvocationV1", isolatedSubject),
    ).toBe(false);
    success(
      call<Result<object>>(api.isolation, "consumeFailureExecutionIsolationV1", campaign, {}),
    );
    expect(
      success(
        call<Result<{ readonly attemptOrdinal: number; readonly position: number }>>(
          api.isolation,
          "getFailureExecutionObservationV1",
          owner,
          campaign,
        ),
      ),
    ).toMatchObject({ attemptOrdinal: 0, position: 0 });

    const terminal = invocation(api, value, "confirmation");
    const baseAttempt = {
      attemptOrdinal: 1,
      precedingOriginals: precedingOriginals(api, value),
      terminalCandidate: terminal,
      failingPosition: 2,
      caseLimit: 2,
    };
    for (const invalidAttempt of [
      null,
      { ...baseAttempt, extra: true },
      { ...baseAttempt, attemptOrdinal: 0 },
      { ...baseAttempt, attemptOrdinal: 1.5 },
      { ...baseAttempt, failingPosition: 0 },
      { ...baseAttempt, failingPosition: 1.5 },
      { ...baseAttempt, failingPosition: 65, caseLimit: 65 },
      { ...baseAttempt, caseLimit: 1.5 },
      { ...baseAttempt, caseLimit: 1 },
      { ...baseAttempt, precedingOriginals: {} },
      { ...baseAttempt, precedingOriginals: [] },
      { ...baseAttempt, precedingOriginals: [{}] },
    ]) {
      failure(
        call<Result<unknown>>(
          api.isolation,
          "beginStatefulSequenceAttemptV1",
          owner,
          invalidAttempt,
        ),
        "execution-plan-capacity",
      );
    }
    const wrongPurpose = invocation(api, value, "reduction");
    failure(
      call<Result<unknown>>(api.isolation, "beginStatefulSequenceAttemptV1", owner, {
        ...baseAttempt,
        terminalCandidate: wrongPurpose,
      }),
      "unbound-capability",
    );
    expect(
      call<boolean>(api.reduction, "abandonReductionCandidateInvocationV1", wrongPurpose),
    ).toBe(true);
    const attempt = success(
      call<Result<object>>(api.isolation, "beginStatefulSequenceAttemptV1", owner, baseAttempt),
    );
    failure(
      call<Result<unknown>>(api.isolation, "nextStatefulSequencePositionV1", {}, attempt),
      "unbound-capability",
    );
    failure(
      call<Result<unknown>>(api.isolation, "nextStatefulSequencePositionV1", owner, {}),
      "unbound-capability",
    );
    failure(
      call<Result<unknown>>(api.isolation, "nextStatefulSequencePositionV1", owner, null),
      "unbound-capability",
    );
    const position = success(
      call<Result<{ readonly kind: string; readonly position: object }>>(
        api.isolation,
        "nextStatefulSequencePositionV1",
        owner,
        attempt,
      ),
    ).position;
    failure(
      call<Result<unknown>>(api.isolation, "nextStatefulSequencePositionV1", owner, attempt),
      "unbound-capability",
    );
    failure(
      call<Result<unknown>>(
        api.isolation,
        "recordStatefulSequencePositionV1",
        owner,
        attempt,
        position,
        {},
      ),
      "unbound-capability",
    );
    failure(
      call<Result<unknown>>(
        api.isolation,
        "recordStatefulSequencePositionV1",
        owner,
        null,
        null,
        {},
      ),
      "unbound-capability",
    );
    failure(
      call<Result<unknown>>(api.isolation, "getFailureExecutionObservationV1", owner, null),
      "unbound-capability",
    );
    expect(
      success(
        call<Result<{ readonly attemptOrdinal: number; readonly position: number }>>(
          api.isolation,
          "getFailureExecutionObservationV1",
          owner,
          position,
        ),
      ),
    ).toMatchObject({ attemptOrdinal: 1, position: 1 });
    expect(call<boolean>(api.reduction, "abandonReductionCandidateInvocationV1", terminal)).toBe(
      true,
    );

    const invalidIsolationInvocation = invocation(api, value, "reduction");
    failure(
      call<Result<unknown>>(
        api.routes,
        "createReductionExecutionRouteRequestV1",
        value.parent,
        invalidIsolationInvocation,
        {},
      ),
      "unbound-capability",
    );
    expect(
      call<boolean>(
        api.reduction,
        "abandonReductionCandidateInvocationV1",
        invalidIsolationInvocation,
      ),
    ).toBe(true);
    const wrongParentInvocation = invocation(api, value, "reduction");
    failure(
      call<Result<unknown>>(
        api.routes,
        "createReductionExecutionRouteRequestV1",
        {},
        wrongParentInvocation,
        campaign,
      ),
      "unbound-capability",
    );
    expect(
      call<boolean>(api.reduction, "abandonReductionCandidateInvocationV1", wrongParentInvocation),
    ).toBe(true);
    const stale = invocation(api, value, "reduction");
    expect(call<boolean>(api.reduction, "abandonReductionCandidateInvocationV1", stale)).toBe(true);
    failure(
      call<Result<unknown>>(
        api.routes,
        "createReductionExecutionRouteRequestV1",
        value.parent,
        stale,
        campaign,
      ),
      "unbound-capability",
    );
    const attemptState = call<{ readonly isolation: object }>(
      api.isolation,
      "getStatefulSequenceAttemptStateV1",
      attempt,
    );
    const sequenceInvocation = invocation(api, value, "confirmation");
    failure(
      call<Result<unknown>>(
        api.routes,
        "createReductionExecutionRouteRequestV1",
        value.parent,
        sequenceInvocation,
        attemptState.isolation,
      ),
      "unbound-capability",
    );
    expect(
      call<boolean>(api.reduction, "abandonReductionCandidateInvocationV1", sequenceInvocation),
    ).toBe(true);

    const routed = success(
      call<Result<object>>(
        api.routes,
        "createReductionExecutionRouteRequestV1",
        value.parent,
        invocation(api, value, "reduction"),
        campaign,
      ),
    );
    failure(
      await call<Promise<Result<unknown>>>(api.routes, "executeReductionCandidateV1", {}, routed),
      "unbound-capability",
    );
    failure(
      await call<Promise<Result<unknown>>>(api.routes, "executeReductionCandidateV1", {}, routed),
      "unbound-capability",
    );
    failure(
      await call<Promise<Result<unknown>>>(api.routes, "executeReductionCandidateV1", {}, {}),
      "unbound-capability",
    );
    failure(
      await call<Promise<Result<unknown>>>(api.routes, "executeReductionCandidateV1", {}, null),
      "unbound-capability",
    );
    failure(
      await call<Promise<Result<unknown>>>(
        api.routes,
        "executeFailureOriginalRouteV1",
        value.execution,
        {},
        campaign,
      ),
      "unbound-capability",
    );
    failure(
      call<Result<unknown>>(api.routes, "consumeConfirmationInvocationV1", {}),
      "unbound-capability",
    );
    const consumedWrongPurpose = invocation(api, value, "reduction");
    failure(
      call<Result<unknown>>(api.routes, "consumeConfirmationInvocationV1", consumedWrongPurpose),
      "unbound-capability",
    );
    expect(call<unknown>(api.routes, "getFailureExecutionOriginalRequestV1", {})).toBeUndefined();
    expect(call<unknown>(api.routes, "getFailureRoutePredicateV1", {})).toBeUndefined();

    for (const invalidSession of [
      [{}, value.candidate, value.origin, value.budget],
      [owner, {}, value.origin, value.budget],
      [owner, value.candidate, {}, value.budget],
      [owner, value.candidate, value.origin, {}],
    ]) {
      failure(
        call<Result<unknown>>(
          api.confirmation,
          "createFailureConfirmationSessionV1",
          ...invalidSession,
        ),
        "unbound-capability",
      );
    }
    const session = success(
      call<Result<object>>(
        api.confirmation,
        "createFailureConfirmationSessionV1",
        owner,
        value.candidate,
        value.origin,
        value.budget,
      ),
    );
    failure(
      call<Result<unknown>>(api.confirmation, "nextFailureConfirmationStepV1", {}, session),
      "unbound-capability",
    );
    failure(
      call<Result<unknown>>(api.confirmation, "nextFailureConfirmationStepV1", owner, {}),
      "unbound-capability",
    );
    failure(
      call<Result<unknown>>(api.confirmation, "nextFailureConfirmationStepV1", owner, null),
      "unbound-capability",
    );
    const confirmationBlocker = invocation(api, value, "confirmation");
    const step = success(
      call<Result<{ readonly authority: object }>>(
        api.confirmation,
        "nextFailureConfirmationStepV1",
        owner,
        session,
      ),
    );
    failure(
      call<Result<unknown>>(api.confirmation, "nextFailureConfirmationStepV1", owner, session),
      "unbound-capability",
    );
    failure(
      await call<Promise<Result<unknown>>>(
        api.confirmation,
        "executeFailureConfirmationStepV1",
        owner,
        session,
        {},
      ),
      "unbound-capability",
    );
    failure(
      await call<Promise<Result<unknown>>>(
        api.confirmation,
        "executeFailureConfirmationStepV1",
        owner,
        session,
        null,
      ),
      "unbound-capability",
    );
    failure(
      call<Result<unknown>>(
        api.confirmation,
        "recordFailureConfirmationStepV1",
        owner,
        session,
        step.authority,
        {},
      ),
      "unbound-capability",
    );
    failure(
      call<Result<unknown>>(
        api.confirmation,
        "recordFailureConfirmationStepV1",
        owner,
        session,
        null,
        null,
      ),
      "unbound-capability",
    );
    failure(
      call<Result<unknown>>(
        api.confirmation,
        "recordFailureConfirmationStepV1",
        owner,
        session,
        step.authority,
        null,
      ),
      "unbound-capability",
    );
    failure(
      await call<Promise<Result<unknown>>>(
        api.confirmation,
        "executeFailureConfirmationStepV1",
        owner,
        session,
        step.authority,
      ),
      "execution.identity",
    );
    expect(
      call<boolean>(api.reduction, "abandonReductionCandidateInvocationV1", confirmationBlocker),
    ).toBe(true);

    failure(
      await call<Promise<Result<unknown>>>(api.confirmation, "confirmReducedFailureV1", {}),
      "unbound-capability",
    );
    failure(
      await call<Promise<Result<unknown>>>(api.confirmation, "confirmReducedFailureV1", {
        ...context,
      }),
      "unbound-capability",
    );

    failure(
      await call<Promise<Result<unknown>>>(
        api.isolation,
        "shutdownFailureExecutionIsolationV1",
        {},
        campaign,
      ),
      "unbound-capability",
    );
    failure(
      await call<Promise<Result<unknown>>>(
        api.isolation,
        "shutdownFailureExecutionIsolationV1",
        owner,
        null,
      ),
      "unbound-capability",
    );
    success(
      await call<Promise<Result<true>>>(
        api.isolation,
        "shutdownFailureExecutionIsolationV1",
        owner,
        campaign,
      ),
    );
    failure(
      await call<Promise<Result<unknown>>>(
        api.isolation,
        "shutdownFailureExecutionIsolationV1",
        owner,
        campaign,
      ),
      "unbound-capability",
    );
    success(
      await call<Promise<Result<true>>>(api.isolation, "closeFailureExecutionProtocolV1", owner),
    );
    failure(
      await call<Promise<Result<unknown>>>(api.isolation, "closeFailureExecutionProtocolV1", owner),
      "unbound-capability",
    );
    failure(
      await call<Promise<Result<unknown>>>(api.isolation, "closeFailureExecutionProtocolV1", null),
      "unbound-capability",
    );
    expect(
      call<unknown>(api.isolation, "getFailureExecutionProtocolStateV1", owner),
    ).toBeUndefined();
  });
});
