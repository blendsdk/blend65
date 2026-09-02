import { createHash } from "node:crypto";

import { afterEach, expect } from "vitest";

import {
  createFailureExecutionSpecFixtureV1,
  type FailureExecutionCandidateEvaluationV1 as CandidateEvaluationV1,
  type FailureExecutionConfirmationResultV1 as ConfirmationResultV1,
  type FailureExecutionConfirmationStepV1 as ConfirmationStepV1,
  type FailureExecutionObservationV1 as ObservationV1,
  type FailureExecutionProtocolApisV1 as ProtocolApisV1,
  type FailureExecutionSpecApiV1 as Api,
  type FailureExecutionSpecDataV1 as Data,
  type FailureExecutionSpecFixtureOptionsV1,
  type FailureExecutionSpecFixtureV1,
  type FailureExecutionSpecResultV1 as Result,
  type FailureExecutionSpecScenarioV1,
} from "./test-fixtures/failure-execution-spec-fixture.js";

export type {
  Api,
  CandidateEvaluationV1,
  ConfirmationResultV1,
  ConfirmationStepV1,
  Data,
  ObservationV1,
  Result,
};

const openFixtures = new Set<FailureExecutionSpecFixtureV1>();
export const ENCODER = new TextEncoder();

export function digestBytes(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function call<T>(api: Api, name: string, ...arguments_: readonly unknown[]): T {
  const callable = api[name];
  if (typeof callable !== "function") throw new TypeError(`missing callable ${name}`);
  return Reflect.apply(callable, undefined, arguments_) as T;
}

export function success<T>(result: Result<T>): T {
  if (!result.ok) throw new TypeError(JSON.stringify(result.issues ?? result.diagnostics ?? []));
  expect(result.ok).toBe(true);
  return result.value;
}

export function failure(result: Result<unknown>, code?: string): void {
  expect(result.ok).toBe(false);
  expect(result).not.toHaveProperty("value");
  if (result.ok || code === undefined) return;
  const issues = result.issues ?? result.diagnostics ?? [];
  expect(issues.some((issue) => issue.code === code)).toBe(true);
}

export function record(value: unknown, message: string): Data {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(message);
  }
  return value as Data;
}

export function authority(value: unknown): object {
  if (typeof value !== "object" || value === null) throw new TypeError("report authority");
  if (Reflect.get(value, "ok") === true) {
    return success(value as Result<object>);
  }
  return value;
}

export async function fixture(
  scenario: FailureExecutionSpecScenarioV1,
  options?: FailureExecutionSpecFixtureOptionsV1,
): Promise<FailureExecutionSpecFixtureV1> {
  // Missing declared protocol APIs are a specification failure and do not require fixture work.
  await assertPlannedApis();
  const created = await createFailureExecutionSpecFixtureV1(scenario, options);
  openFixtures.add(created);
  return created;
}

async function assertPlannedApis(): Promise<void> {
  const [execution, internals, readiness, reduction, reports] = await Promise.all([
    import("./index.js") as Promise<unknown> as Promise<Api>,
    import("./failure-execution-internals.js") as Promise<unknown> as Promise<Api>,
    import("@blend65/readiness") as Promise<unknown> as Promise<Api>,
    import("@blend65/readiness/failure-reduction-internals") as Promise<unknown> as Promise<Api>,
    import("./execution-authority-report.js") as Promise<unknown> as Promise<Api>,
  ]);
  void readiness;
  void reduction;
  void reports;
  for (const name of [
    "createReductionExecutionRouteRequestV1",
    "executeReductionCandidateV1",
    "confirmReducedFailureV1",
  ]) {
    if (typeof execution[name] !== "function") throw new TypeError(`missing callable ${name}`);
  }
  for (const name of [
    "openFailureExecutionProtocolV1",
    "getExecutionAuthorityReportPositionsV1",
    "createFailureConfirmationContextV1",
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
    "createObservedFailureObservationEvidenceV1",
    "createNotReachedFailureObservationEvidenceV1",
    "getFailureObservationEvidenceProjectionV1",
  ]) {
    if (typeof internals[name] !== "function") throw new TypeError(`missing callable ${name}`);
  }
}

export function invocation(
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

export function protocol(api: ProtocolApisV1, value: FailureExecutionSpecFixtureV1): object {
  const context = confirmationContext(api, value);
  return success(call<Result<object>>(api.internals, "openFailureExecutionProtocolV1", context));
}

export function confirmationContext(
  api: ProtocolApisV1,
  value: FailureExecutionSpecFixtureV1,
  changes: Readonly<Record<string, unknown>> = {},
): object {
  return success(
    call<Result<object>>(api.internals, "createFailureConfirmationContextV1", {
      report: value.report,
      subject: value.subjectPosition,
      candidate: value.candidate,
      origin: value.origin,
      budget: value.budget,
      ...(value.confirmationControlPosition === undefined
        ? {}
        : { control: value.confirmationControlPosition }),
      ...changes,
    }),
  );
}

export async function executeCandidate(
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

export async function driveConfirmation(
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
