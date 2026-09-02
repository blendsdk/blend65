import { afterEach, describe, expect, it, vi } from "vitest";

import type { FailureExecutionObservationV1 } from "./failure-execution-types.js";

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

describe("sequence-only confirmation coordination", () => {
  it("emits and records every ordered position before classifying stateful failure", async () => {
    const value = await createFailureExecutionSpecFixtureV1("sequence-only", {
      failingPosition: 2,
      sequenceLength: 2,
    });
    openFixtures.add(value);
    const evaluationsApi = await vi.importActual<
      typeof import("./failure-confirmation-evaluation.js")
    >("./failure-confirmation-evaluation.js");
    const context = success(
      call<Result<object>>(value.apis.internals, "createFailureConfirmationContextV1", {
        report: value.report,
        subject: value.subjectPosition,
        candidate: value.candidate,
        origin: value.origin,
        budget: value.budget,
      }),
    );
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
    const stepKinds: string[] = [];
    const positions: number[] = [];
    const sequenceLifecycle: FailureExecutionObservationV1[] = [];
    let discoveredPosition: number | undefined;
    let completed:
      | {
          readonly disposition: string;
          readonly sequenceEvidence?: {
            readonly failingPosition: number;
            readonly checkpoints: readonly {
              readonly position: number;
              readonly digest: string;
            }[];
          };
        }
      | undefined;
    for (let count = 0; count < 6 && completed === undefined; count += 1) {
      const next = success(
        call<
          Result<{
            readonly kind: string;
            readonly authority?: object;
            readonly result?: typeof completed;
          }>
        >(value.apis.internals, "nextFailureConfirmationStepV1", protocol, session),
      );
      stepKinds.push(next.kind);
      if (next.kind === "complete") {
        completed = next.result;
        break;
      }
      if (next.authority === undefined) throw new TypeError("confirmation step authority");
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
      discoveredPosition ??= state.discoveredPosition;
      if (next.kind === "execute-sequence-position") {
        positions.push(state.checkpoint.position);
        sequenceLifecycle.push(state.checkpoint);
      }
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

    expect(stepKinds).toEqual([
      "execute-candidate",
      "execute-candidate",
      "execute-sequence-position",
      "execute-sequence-position",
      "complete",
    ]);
    expect(discoveredPosition).toBe(2);
    expect(positions).toEqual([1, 2]);
    expect(sequenceLifecycle[0]?.workerIdentity).toBeDefined();
    expect(sequenceLifecycle[1]?.workerIdentity).toBe(sequenceLifecycle[0]?.workerIdentity);
    expect(sequenceLifecycle[0]?.isolateIdentity).toBeDefined();
    expect(sequenceLifecycle[1]?.isolateIdentity).toBe(sequenceLifecycle[0]?.isolateIdentity);
    expect(sequenceLifecycle[0]?.rootIdentity).toBeDefined();
    expect(sequenceLifecycle[1]?.rootIdentity).not.toBe(sequenceLifecycle[0]?.rootIdentity);
    expect(completed).toMatchObject({
      disposition: "stateful-sequence-failure",
      sequenceEvidence: { failingPosition: 2 },
    });
    const sequenceCheckpoints = completed?.sequenceEvidence?.checkpoints ?? [];
    expect(sequenceCheckpoints.map(({ position }) => position)).toEqual([1, 2]);
    expect(sequenceCheckpoints[0]?.digest).not.toBe(sequenceCheckpoints[1]?.digest);

    success(
      await call<Promise<Result<true>>>(
        value.apis.internals,
        "closeFailureExecutionProtocolV1",
        protocol,
      ),
    );
  });
});
