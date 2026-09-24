import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { ConvertOperation } from "../semantic/operations.js";
import { machineInstruction, type LoweredValue } from "./lower-control.js";
import type { MachineInstruction } from "./machine-types.js";
import {
  appendLoadA,
  isSignedType,
  loweringFailure,
  requestStorage,
  storeA,
  type FunctionLoweringState,
  typeBytes,
} from "./lower.js";

/** Freeze a converted value only when its planned lifetime crosses a call or source write. */
function retainConvertedValue(
  operation: ConvertOperation,
  value: LoweredValue,
  instructions: readonly MachineInstruction[],
  state: FunctionLoweringState,
): readonly MachineInstruction[] {
  const requestId = `${bindingIdentityKey(state.owner)}:argument-stage:${operation.result}`;
  if (
    value.kind === "constant" ||
    !state.input.placement.homes.some((home) => home.requestId === requestId)
  ) {
    state.values.set(operation.result, value);
    return Object.freeze(instructions);
  }
  if (value.kind === "storage" && value.requestId === requestId) {
    state.values.set(operation.result, value);
    return Object.freeze(instructions);
  }
  const stage: LoweredValue = Object.freeze({
    kind: "storage",
    requestId,
    bytes: typeBytes(operation.type),
    signed: isSignedType(operation.type),
  });
  const staged = [...instructions];
  for (let offset = 0; offset < stage.bytes; offset += 1) {
    appendLoadA(staged, value, offset, state, operation.span);
    staged.push(storeA(stage, offset, state, operation.span));
  }
  state.values.set(operation.result, stage);
  return Object.freeze(staged);
}

/** Lower a fixed-width integer conversion without a runtime conversion helper. */
export function lowerConversion(
  operation: ConvertOperation,
  state: FunctionLoweringState,
): readonly MachineInstruction[] {
  const operand = state.values.get(operation.operand);
  if (operand === undefined)
    throw loweringFailure("Converted value was not lowered", operation.span);
  if (operand.kind === "condition") {
    throw loweringFailure("Condition cannot be converted as an integer", operation.span);
  }
  const bytes = typeBytes(operation.type);
  const signed = isSignedType(operation.type);
  if (operation.conversion === "identity" || operation.conversion === "reinterpret") {
    if (operand.bytes !== bytes) {
      throw loweringFailure("Integer reinterpretation changed width", operation.span);
    }
    return retainConvertedValue(operation, Object.freeze({ ...operand, signed }), [], state);
  }
  if (operation.conversion === "truncate") {
    if (bytes !== 1 || operand.bytes !== 2) {
      throw loweringFailure("Integer truncation has unsupported widths", operation.span);
    }
    const truncated: LoweredValue =
      operand.kind === "register"
        ? Object.freeze({ kind: "register", registers: "a", bytes: 1, signed })
        : operand.kind === "zero-extended"
          ? Object.freeze({ ...operand.low, signed })
          : Object.freeze({ ...operand, bytes: 1, signed });
    return retainConvertedValue(operation, truncated, [], state);
  }
  if (bytes !== 2 || operand.bytes !== 1) {
    throw loweringFailure("Integer extension has unsupported widths", operation.span);
  }
  if (operand.kind === "constant") {
    const low = operand.value & 0xff;
    return retainConvertedValue(
      operation,
      Object.freeze({
        kind: "constant",
        value: operation.conversion === "sign-extend" && low >= 0x80 ? low | 0xff00 : low,
        bytes: 2,
        signed,
      }),
      [],
      state,
    );
  }
  const instructions: MachineInstruction[] = [];
  let low = operand;
  if (low.kind === "register") {
    const stage = requestStorage(
      state,
      `conversion-input:${operation.result}`,
      "temporary",
      1,
      "ram",
      operation.span,
      "Preserve a byte converted to a word",
    );
    low = Object.freeze({ kind: "storage", requestId: stage.id, bytes: 1, signed: false });
    instructions.push(storeA(low, 0, state, operation.span));
  }
  if (operation.conversion === "zero-extend") {
    return retainConvertedValue(
      operation,
      Object.freeze({ kind: "zero-extended", low, bytes: 2, signed: false }),
      instructions,
      state,
    );
  }
  if (operation.conversion !== "sign-extend") {
    throw loweringFailure("Unsupported integer conversion", operation.span);
  }
  const plannedStageId = `${bindingIdentityKey(state.owner)}:argument-stage:${operation.result}`;
  const requestId = state.input.placement.homes.some((home) => home.requestId === plannedStageId)
    ? plannedStageId
    : requestStorage(
        state,
        `sign-extension:${operation.result}`,
        "temporary",
        2,
        "ram",
        operation.span,
        "Retain both bytes of a signed extension",
        operation.type,
      ).id;
  const result: LoweredValue = Object.freeze({ kind: "storage", requestId, bytes: 2, signed });
  appendLoadA(instructions, low, 0, state, operation.span);
  instructions.push(storeA(result, 0, state, operation.span));
  instructions.push(
    machineInstruction(
      state.input.profile.cpu,
      "cmp",
      "immediate",
      Object.freeze({ kind: "immediate", value: 0x80 }),
      [],
      operation.span,
    ),
    machineInstruction(
      state.input.profile.cpu,
      "lda",
      "immediate",
      Object.freeze({ kind: "immediate", value: 0 }),
      [],
      operation.span,
    ),
    machineInstruction(
      state.input.profile.cpu,
      "sbc",
      "immediate",
      Object.freeze({ kind: "immediate", value: 0 }),
      [],
      operation.span,
    ),
    machineInstruction(
      state.input.profile.cpu,
      "eor",
      "immediate",
      Object.freeze({ kind: "immediate", value: 0xff }),
      [],
      operation.span,
    ),
    storeA(result, 1, state, operation.span),
  );
  return retainConvertedValue(operation, result, instructions, state);
}
