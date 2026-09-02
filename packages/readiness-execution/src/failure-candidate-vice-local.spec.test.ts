import { afterEach, describe, expect, it } from "vitest";

import {
  createFailureExecutionSpecFixtureV1,
  type FailureExecutionConfirmationResultV1 as ConfirmationResultV1,
  type FailureExecutionConfirmationStepV1 as ConfirmationStepV1,
  type FailureExecutionObservationV1 as ObservationV1,
  type FailureExecutionProtocolApisV1 as ProtocolApisV1,
  type FailureExecutionSpecApiV1 as Api,
  type FailureExecutionSpecDataV1 as Data,
  type FailureExecutionSpecFixtureV1,
  type FailureExecutionSpecResultV1 as Result,
} from "./test-fixtures/failure-execution-spec-fixture.js";
import {
  armFailureCandidateViceShimV1,
  hasFailureCandidateViceLocalRuntimeV1,
  synchronizeFailureCandidateViceShimV1,
} from "./test-fixtures/failure-candidate-vice-local-support.js";

const openFixtures = new Set<FailureExecutionSpecFixtureV1>();

function call<T>(api: Api, name: string, ...arguments_: readonly unknown[]): T {
  const callable = api[name];
  if (typeof callable !== "function") throw new TypeError(`missing callable ${name}`);
  return Reflect.apply(callable, undefined, arguments_) as T;
}

function success<T>(result: Result<T>): T {
  if (!result.ok) throw new TypeError(JSON.stringify(result.issues ?? result.diagnostics ?? []));
  expect(result.ok).toBe(true);
  return result.value;
}

function record(value: unknown, message: string): Data {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(message);
  }
  return value as Data;
}

function confirmationContext(api: ProtocolApisV1, value: FailureExecutionSpecFixtureV1): object {
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
    }),
  );
}

function protocol(api: ProtocolApisV1, value: FailureExecutionSpecFixtureV1): object {
  return success(
    call<Result<object>>(
      api.internals,
      "openFailureExecutionProtocolV1",
      confirmationContext(api, value),
    ),
  );
}

async function driveConfirmation(
  api: ProtocolApisV1,
  value: FailureExecutionSpecFixtureV1,
): Promise<{
  readonly result: ConfirmationResultV1;
  readonly observations: readonly ObservationV1[];
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
  const observations: ObservationV1[] = [];
  let sequencePosition = 0;
  for (let count = 0; count < 512; count += 1) {
    const step = success(
      call<Result<ConfirmationStepV1>>(
        api.internals,
        "nextFailureConfirmationStepV1",
        sessionProtocol,
        session,
      ),
    );
    if (step.kind === "complete") {
      if (step.result === undefined) throw new TypeError("confirmation result");
      return { result: step.result, observations };
    }
    if (step.authority === undefined) throw new TypeError("confirmation step authority");
    if (step.kind === "execute-sequence-position") {
      sequencePosition += 1;
      if (sequencePosition === value.expectedFailingPosition) {
        armFailureCandidateViceShimV1();
      }
    }
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
    if (step.kind === "execute-sequence-position" && step.position !== undefined) {
      observations.push(
        success(
          call<Result<ObservationV1>>(
            api.internals,
            "getFailureExecutionObservationV1",
            sessionProtocol,
            step.position,
          ),
        ),
      );
    }
  }
  throw new TypeError("confirmation did not terminate within the bounded machine");
}

afterEach(async () => {
  for (const value of openFixtures) await value.cleanup();
  openFixtures.clear();
});

describe("failure candidate local VICE oracle", () => {
  // Runtime preparation for a sequence position uses its attempt-owned worker all the way to VICE.
  it.skipIf(!hasFailureCandidateViceLocalRuntimeV1())(
    "should keep candidate VICE preparation on the dedicated attempt worker instead of the global pool",
    async () => {
      const value = await createFailureExecutionSpecFixtureV1("sequence-only", {
        subjectTier: "vice",
      });
      openFixtures.add(value);
      const evidence = record(value.localViceEvidence, "local VICE baseline evidence");
      const preparations = record(evidence.preparations, "local VICE preparations");
      expect(preparations).toMatchObject({
        ok: true,
        issue: null,
        subjectPosition: expect.any(Number),
        controlPosition: expect.any(Number),
        sameFixtureContract: true,
        controlPreparation: { ok: true, issue: null },
      });
      expect(preparations.controlPosition).toBe(preparations.subjectPosition);
      expect(record(evidence.baselineSubject, "baseline subject")).toMatchObject({
        status: "pass",
        tier: "vice",
        cleanupBlocker: null,
      });
      expect(record(evidence.baselineControl, "baseline control")).toMatchObject({
        status: "pass",
        tier: "vice",
        cleanupBlocker: null,
      });
      expect(record(evidence.baselineLease, "baseline lease")).toMatchObject({
        state: "clear",
        childAbsent: true,
      });
      expect(record(evidence.injectedLease, "injected lease")).toMatchObject({
        state: "clear",
        childAbsent: true,
      });

      const driven = await driveConfirmation(value.apis, value);
      expect(driven.result.disposition).toBe("stateful-sequence-failure");
      expect(driven.observations.map((observation) => observation.position)).toEqual(
        Array.from({ length: value.expectedFailingPosition ?? 0 }, (_, index) => index + 1),
      );
      expect(
        driven.observations.every((observation) => observation.mode === "sequence-attempt"),
      ).toBe(true);
      expect(
        driven.observations.every((observation) => observation.admitted && observation.launched),
      ).toBe(true);
      expect(
        new Set(driven.observations.map((observation) => observation.workerIdentity)).size,
      ).toBe(1);

      const shim = await synchronizeFailureCandidateViceShimV1();
      expect(shim).toEqual({
        injectionCount: 2,
        markerPresent: false,
        consumedPresent: true,
      });
      expect(value.activity.viceLauncherInjections).toEqual([1, 2]);
      expect(value.activity.viceLauncherArmTransitions).toEqual([
        "armed",
        "consumed",
        "armed",
        "consumed",
      ]);
      expect(
        success(
          await call<Promise<Result<Data>>>(
            value.apis.execution,
            "inspectViceLeaseV1",
            "c64",
            AbortSignal.timeout(15_000),
          ),
        ),
      ).toMatchObject({ state: "clear", childAbsent: true });
    },
    900_000,
  );
});
