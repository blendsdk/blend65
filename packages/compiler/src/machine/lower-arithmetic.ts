import type { SemanticOperation } from "../semantic/operations.js";
import {
  machineInstruction,
  modeForValue,
  operandForValue,
  type LoweredValue,
} from "./lower-control.js";
import type { MachineInstruction } from "./machine-types.js";
import {
  appendLoadA,
  requestStorage,
  storeA,
  type FunctionLoweringState,
  typeBytes,
} from "./lower.js";

/** Lower wrapping add/subtract with explicit carry ownership and low-to-high order. */
export function lowerArithmetic(
  operation: Extract<SemanticOperation, { readonly kind: "binary" }>,
  left: LoweredValue,
  right: LoweredValue,
  state: FunctionLoweringState,
): { readonly instructions: readonly MachineInstruction[]; readonly result: LoweredValue } {
  const subtract = operation.operator === "-";
  const opcode = subtract ? "sbc" : "adc";
  const instructions: MachineInstruction[] = [];
  appendLoadA(instructions, left, 0, state, operation.span);
  instructions.push(
    machineInstruction(
      state.input.profile.cpu,
      subtract ? "sec" : "clc",
      "implied",
      null,
      [],
      operation.span,
    ),
    machineInstruction(
      state.input.profile.cpu,
      opcode,
      modeForValue(right),
      operandForValue(right, 0),
      [],
      operation.span,
    ),
  );
  if (typeBytes(operation.type) === 1) {
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: Object.freeze({
        kind: "register",
        registers: "a",
        bytes: 1,
        signed: operation.integer?.signed ?? false,
      }),
    });
  }
  const scratch = requestStorage(
    state,
    `arithmetic:${operation.result}`,
    "temporary",
    2,
    "ram",
    operation.span,
    "Low byte must survive high-byte arithmetic",
    operation.type,
  );
  const result: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: scratch.id,
    bytes: 2,
    signed: operation.integer?.signed ?? false,
  });
  instructions.push(storeA(result, 0, state, operation.span));
  appendLoadA(instructions, left, 1, state, operation.span);
  instructions.push(
    machineInstruction(
      state.input.profile.cpu,
      opcode,
      modeForValue(right, 1),
      operandForValue(right, 1),
      [],
      operation.span,
    ),
    storeA(result, 1, state, operation.span),
  );
  return Object.freeze({ instructions: Object.freeze(instructions), result });
}
