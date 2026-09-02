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
  return result.value;
}

afterEach(async () => {
  for (const value of openFixtures) await value.cleanup();
  openFixtures.clear();
});

describe("typed-invalid direct-shrink confirmation", () => {
  it("classifies two exact fresh diagnostic mismatches as a confirmed source failure", async () => {
    const value = await createFailureExecutionSpecFixtureV1("direct-shrink-stable");
    openFixtures.add(value);
    const [comparison, checkpointsApi, contexts, evaluationsApi, evidence] = await Promise.all([
      vi.importActual<typeof import("./failure-confirmation-comparison.js")>(
        "./failure-confirmation-comparison.js",
      ),
      vi.importActual<typeof import("./failure-confirmation-checkpoints.js")>(
        "./failure-confirmation-checkpoints.js",
      ),
      vi.importActual<typeof import("./failure-confirmation-context.js")>(
        "./failure-confirmation-context.js",
      ),
      vi.importActual<typeof import("./failure-confirmation-evaluation.js")>(
        "./failure-confirmation-evaluation.js",
      ),
      vi.importActual<typeof import("./failure-predicate-evidence.js")>(
        "./failure-predicate-evidence.js",
      ),
    ]);
    const context = success(
      call<Result<object>>(value.apis.internals, "createFailureConfirmationContextV1", {
        report: value.report,
        subject: value.subjectPosition,
        candidate: value.candidate,
        origin: value.origin,
        budget: value.budget,
      }),
    );
    const contextState = contexts.getFailureConfirmationContextStateV1(context as never);
    expect(contextState?.disposition).toBe("direct-shrink");
    const protocol = success(
      call<Result<object>>(value.apis.internals, "openFailureExecutionProtocolV1", context),
    );
    const session = success(
      call<Result<object>>(
        value.apis.internals,
        "createFailureConfirmationSessionV1",
        protocol,
        value.candidate,
        value.origin,
        value.budget,
      ),
    );
    const evaluations = [];
    const checkpoints = [];
    for (let index = 0; index < 2; index += 1) {
      const next = success(
        call<Result<{ readonly kind: string; readonly authority: object }>>(
          value.apis.internals,
          "nextFailureConfirmationStepV1",
          protocol,
          session,
        ),
      );
      expect(next.kind).toBe("execute-candidate");
      const evaluated = success(
        await call<Promise<Result<object>>>(
          value.apis.internals,
          "executeFailureConfirmationStepV1",
          protocol,
          session,
          next.authority,
        ),
      );
      const state = evaluationsApi.getFailureConfirmationEvaluationStateV1(evaluated as never);
      if (state === undefined) throw new TypeError("confirmation evaluation state");
      evaluations.push(state.route);
      checkpoints.push(state.checkpoint);
      const projection = evidence.getFailurePredicateEvidenceProjectionV1(
        state.route.predicateEvidence,
      );
      expect(projection).toMatchObject({
        kind: "candidate-full-predicate",
        predicate: contextState?.predicate,
        observation: contextState?.predicate.observation,
        resultCode: "diagnostic-mismatch",
        outcome: {
          status: "failure",
          code: "diagnostic-mismatch",
          cleanup: "clear",
        },
      });
      expect(
        evidence.getFailurePredicateEvidenceObservationBytesV1(state.route.predicateEvidence),
      ).toEqual(contextState?.originProjection.observationBytes);
      success(
        call<Result<true>>(
          value.apis.internals,
          "recordFailureConfirmationStepV1",
          protocol,
          session,
          next.authority,
          evaluated,
        ),
      );
    }
    if (contextState === undefined) throw new TypeError("confirmation context state");
    expect(
      comparison.freshFailurePairReproducesPredicateV1(
        evaluations[0]!,
        evaluations[1]!,
        contextState.predicate,
        contextState.originProjection.observationBytes,
      ),
    ).toBe(true);
    expect(checkpoints).toHaveLength(2);
    expect(checkpoints[0]?.attemptOrdinal).toBe(1);
    expect(checkpoints[1]?.attemptOrdinal).toBe(2);
    expect(checkpoints[0]?.rootIdentity).toBeDefined();
    expect(checkpoints[1]?.rootIdentity).not.toBe(checkpoints[0]?.rootIdentity);
    expect(checkpoints[0]?.workerIdentity).toBeDefined();
    expect(checkpoints[1]?.workerIdentity).not.toBe(checkpoints[0]?.workerIdentity);
    expect(checkpoints[0]?.isolateIdentity).toBeDefined();
    expect(checkpoints[1]?.isolateIdentity).not.toBe(checkpoints[0]?.isolateIdentity);
    expect(checkpointsApi.areDistinctFreshCheckpointsV1(checkpoints)).toBe(true);
    const completed = success(
      call<Result<{ readonly kind: string; readonly result: { readonly disposition: string } }>>(
        value.apis.internals,
        "nextFailureConfirmationStepV1",
        protocol,
        session,
      ),
    );
    expect(completed).toMatchObject({
      kind: "complete",
      result: { disposition: "confirmed-source-failure" },
    });
    success(
      await call<Promise<Result<true>>>(
        value.apis.internals,
        "closeFailureExecutionProtocolV1",
        protocol,
      ),
    );
  }, 600_000);
});
