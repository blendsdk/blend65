import type { SemanticOperation } from "../semantic/operations.js";
import {
  machineInstruction,
  modeForValue,
  operandForValue,
  type LoweredValue,
} from "./lower-control.js";
import type { MachineInstruction } from "./machine-types.js";
import {
  loweringFailure,
  appendLoadA,
  isSignedType,
  requestStorage,
  storeA,
  type FunctionLoweringState,
  typeBytes,
} from "./lower.js";

/** Lower one admitted scalar unary operation without a runtime helper. */
export function lowerUnary(
  operation: Extract<SemanticOperation, { readonly kind: "unary" }>,
  state: FunctionLoweringState,
): { readonly instructions: readonly MachineInstruction[]; readonly result: LoweredValue } {
  const operand = state.values.get(operation.operand);
  if (operand === undefined || operand.kind === "condition") {
    throw loweringFailure("Unary operand was not lowered to a value", operation.span);
  }
  const width = typeBytes(operation.type);
  if (operation.operator === "+") {
    return Object.freeze({ instructions: Object.freeze([]), result: operand });
  }
  if (operation.operator === "lo" || operation.operator === "hi") {
    const offset = operation.operator === "lo" ? 0 : 1;
    if (offset >= operand.bytes) {
      throw loweringFailure("Byte extraction exceeds its operand width", operation.span);
    }
    const instructions: MachineInstruction[] = [];
    appendLoadA(instructions, operand, offset, state, operation.span);
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: Object.freeze({ kind: "register", registers: "a", bytes: 1, signed: false }),
    });
  }
  if (operation.operator === "!") {
    const instructions: MachineInstruction[] = [];
    appendLoadA(instructions, operand, 0, state, operation.span);
    for (let offset = 1; offset < operand.bytes; offset += 1) {
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "ora",
          modeForValue(operand),
          operandForValue(operand, offset),
          [],
          operation.span,
        ),
      );
    }
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "cmp",
        "immediate",
        Object.freeze({ kind: "immediate", value: 1 }),
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
        "adc",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0 }),
        [],
        operation.span,
      ),
      machineInstruction(
        state.input.profile.cpu,
        "eor",
        "immediate",
        Object.freeze({ kind: "immediate", value: 1 }),
        [],
        operation.span,
      ),
    );
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: Object.freeze({ kind: "register", registers: "a", bytes: 1, signed: false }),
    });
  }
  if (operation.operator !== "-" && operation.operator !== "~") {
    throw loweringFailure(`Unary operator '${operation.operator}' is not admitted`, operation.span);
  }

  const resultRequest =
    width === 1
      ? null
      : requestStorage(
          state,
          `unary:${operation.result}`,
          "temporary",
          width,
          "ram",
          operation.span,
          "Multi-byte unary result",
          operation.type,
        );
  const result: LoweredValue =
    resultRequest === null
      ? Object.freeze({
          kind: "register",
          registers: "a",
          bytes: 1,
          signed: isSignedType(operation.type),
        })
      : Object.freeze({
          kind: "storage",
          requestId: resultRequest.id,
          bytes: width,
          signed: isSignedType(operation.type),
        });
  const instructions: MachineInstruction[] = [];
  for (let offset = 0; offset < width; offset += 1) {
    appendLoadA(instructions, operand, offset, state, operation.span);
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "eor",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0xff }),
        [],
        operation.span,
      ),
    );
    if (operation.operator === "-") {
      if (offset === 0) {
        instructions.push(
          machineInstruction(state.input.profile.cpu, "clc", "implied", null, [], operation.span),
        );
      }
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "adc",
          "immediate",
          Object.freeze({ kind: "immediate", value: offset === 0 ? 1 : 0 }),
          [],
          operation.span,
        ),
      );
    }
    if (result.kind === "storage") instructions.push(storeA(result, offset, state, operation.span));
  }
  return Object.freeze({ instructions: Object.freeze(instructions), result });
}
