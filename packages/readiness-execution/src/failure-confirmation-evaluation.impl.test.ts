import { describe, expect, it } from "vitest";

import {
  createFailureConfirmationEvaluationV1,
  getFailureConfirmationEvaluationStateV1,
  recordFailureSequenceEvaluationV1,
} from "./failure-confirmation-evaluation.js";
import {
  cloneFrozenFailureExecutionValueV1,
  equalFailureExecutionBytesV1,
} from "./failure-execution-immutable.js";

describe("failure confirmation evaluation authority", () => {
  it("binds one local checkpoint to its exact protocol, attempt, and position", () => {
    const protocol = {};
    const session = {};
    const step = {};
    const route = {};
    const attempt = {};
    const position = {};
    const checkpoint = { position: 3, result: { status: "failure" } };
    const evaluation = createFailureConfirmationEvaluationV1({
      protocol,
      session,
      step,
      route,
      checkpoint,
      attempt,
      position,
      discoveredPosition: 3,
    } as never);
    const state = getFailureConfirmationEvaluationStateV1(evaluation);
    expect(state).toMatchObject({
      protocol,
      session,
      step,
      route,
      attempt,
      position,
      discoveredPosition: 3,
      confirmationConsumed: false,
      sequenceRecorded: false,
    });
    expect(state?.checkpoint).not.toBe(checkpoint);
    expect(Object.isFrozen(state?.checkpoint)).toBe(true);
    expect(getFailureConfirmationEvaluationStateV1(null as never)).toBeUndefined();
    expect(getFailureConfirmationEvaluationStateV1({} as never)).toBeUndefined();

    expect(
      recordFailureSequenceEvaluationV1({}, protocol as never, attempt as never, position as never),
    ).toBeUndefined();
    expect(
      recordFailureSequenceEvaluationV1(
        evaluation,
        {} as never,
        attempt as never,
        position as never,
      ),
    ).toBeUndefined();
    expect(
      recordFailureSequenceEvaluationV1(
        evaluation,
        protocol as never,
        {} as never,
        position as never,
      ),
    ).toBeUndefined();
    expect(
      recordFailureSequenceEvaluationV1(
        evaluation,
        protocol as never,
        attempt as never,
        {} as never,
      ),
    ).toBeUndefined();
    const observed = recordFailureSequenceEvaluationV1(
      evaluation,
      protocol as never,
      attempt as never,
      position as never,
    );
    expect(observed).toEqual(checkpoint);
    expect(observed).not.toBe(state?.checkpoint);
    expect(Object.isFrozen(observed)).toBe(true);
    expect(
      recordFailureSequenceEvaluationV1(
        evaluation,
        protocol as never,
        attempt as never,
        position as never,
      ),
    ).toBeUndefined();

    const standalone = createFailureConfirmationEvaluationV1({
      protocol,
      session,
      step,
      route,
      checkpoint,
    } as never);
    expect(getFailureConfirmationEvaluationStateV1(standalone)).toMatchObject({
      confirmationConsumed: false,
      sequenceRecorded: false,
    });
  });
});

describe("failure execution immutable values", () => {
  it("detaches and recursively freezes protocol values while comparing exact bytes", () => {
    const source = {
      nested: { value: 1 },
      values: [{ value: 2 }],
      bytes: new Uint8Array([1, 2, 3]),
      nullable: null,
    };
    const cloned = cloneFrozenFailureExecutionValueV1(source);
    expect(cloned).toEqual(source);
    expect(cloned).not.toBe(source);
    expect(cloned.nested).not.toBe(source.nested);
    expect(cloned.bytes).not.toBe(source.bytes);
    expect(Object.isFrozen(cloned)).toBe(true);
    expect(Object.isFrozen(cloned.nested)).toBe(true);
    expect(Object.isFrozen(cloned.values)).toBe(true);
    expect(Object.isFrozen(cloned.values[0])).toBe(true);
    expect(Object.isFrozen(cloned.bytes)).toBe(false);
    expect(cloneFrozenFailureExecutionValueV1(7)).toBe(7);
    expect(equalFailureExecutionBytesV1(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(equalFailureExecutionBytesV1(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
    expect(equalFailureExecutionBytesV1(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(
      false,
    );
  });
});
