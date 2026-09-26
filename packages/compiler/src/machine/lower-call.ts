import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticOperation } from "../semantic/operations.js";
import { machineInstruction, type LoweredValue } from "./lower-control.js";
import { prepareAggregateCallResult } from "./lower-aggregate-return.js";
import type { MachineInstruction } from "./machine-types.js";
import {
  loweringFailure,
  appendLoadA,
  bindingLabel,
  isSignedType,
  loweredPlace,
  retainMachineValue,
  storeA,
  type FunctionLoweringState,
  typeBytes,
} from "./lower-state.js";

/** Copy an aggregate argument's address into its two-byte by-reference parameter home. */
function marshalAggregateAddress(
  instructions: MachineInstruction[],
  argument: LoweredValue,
  destination: LoweredValue,
  state: FunctionLoweringState,
  operation: Extract<SemanticOperation, { readonly kind: "call" }>,
): void {
  if (
    argument.kind === "storage" &&
    (argument.requestId.includes(":parameter:") ||
      argument.requestId.includes(":aggregate-address:"))
  ) {
    for (let offset = 0; offset < 2; offset += 1) {
      appendLoadA(instructions, argument, offset, state, operation.span);
      instructions.push(storeA(destination, offset, state, operation.span));
    }
    return;
  }
  if (argument.kind !== "storage" && argument.kind !== "label") {
    throw loweringFailure("Aggregate call argument has no materialized address", operation.span);
  }
  for (const addressByte of ["low", "high"] as const) {
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "lda",
        "immediate",
        argument.kind === "storage"
          ? Object.freeze({
              kind: "storage" as const,
              requestId: argument.requestId,
              offset: 0,
              addressByte,
            })
          : Object.freeze({
              kind: "label" as const,
              label: argument.label,
              offset: 0,
              addressByte,
            }),
        [],
        operation.span,
      ),
    );
    instructions.push(storeA(destination, addressByte === "low" ? 0 : 1, state, operation.span));
  }
}

/** Marshal one direct call and retain its scalar or caller-owned aggregate result. */
export function lowerDirectCall(
  operation: Extract<SemanticOperation, { readonly kind: "call" }>,
  state: FunctionLoweringState,
): readonly MachineInstruction[] {
  const callee = state.input.program.semantic.functions.find(
    ({ id }) => bindingIdentityKey(id) === bindingIdentityKey(operation.callee),
  );
  if (callee === undefined || callee.parameters.length !== operation.arguments.length) {
    throw loweringFailure("Direct call has no matching semantic parameter list", operation.span);
  }
  const instructions: MachineInstruction[] = [];
  for (let index = 0; index < operation.arguments.length; index += 1) {
    const argument = state.values.get(operation.arguments[index]!);
    const parameter = callee.parameters[index]!;
    if (argument === undefined || argument.kind === "condition") {
      throw loweringFailure("Direct-call argument was not retained", operation.span);
    }
    const destination = loweredPlace(
      Object.freeze({ root: parameter.id, path: Object.freeze([]), rootType: parameter.type }),
      parameter.type.kind === "array" || parameter.type.kind === "struct"
        ? 2
        : typeBytes(parameter.type),
      isSignedType(parameter.type),
      state,
    );
    if (destination.kind !== "storage") {
      throw loweringFailure("Callee parameter has no certified static home", operation.span);
    }
    if (parameter.type.kind === "array" || parameter.type.kind === "struct") {
      marshalAggregateAddress(instructions, argument, destination, state, operation);
      if (parameter.outerUnsized) {
        const count = operation.argumentArrayCounts?.[index];
        if (count === undefined || count === null) {
          throw loweringFailure(
            "Borrowed array argument has no outer element count",
            operation.span,
          );
        }
        const countValue: LoweredValue =
          count.kind === "fixed"
            ? Object.freeze({ kind: "constant", value: count.count, bytes: 2 })
            : Object.freeze({
                kind: "storage",
                requestId: `${bindingIdentityKey(state.owner)}:parameter:${bindingIdentityKey(count.binding)}`,
                offset: 2,
                bytes: 2,
              });
        for (let offset = 0; offset < 2; offset += 1) {
          appendLoadA(instructions, countValue, offset, state, operation.span);
          instructions.push(storeA(destination, offset + 2, state, operation.span));
        }
      }
    } else {
      for (let offset = 0; offset < typeBytes(parameter.type); offset += 1) {
        appendLoadA(instructions, argument, offset, state, operation.span);
        instructions.push(storeA(destination, offset, state, operation.span));
      }
    }
  }
  const aggregateResult =
    operation.result !== null &&
    (operation.type.kind === "array" || operation.type.kind === "struct")
      ? prepareAggregateCallResult(
          operation.result,
          operation.callee,
          operation.type,
          operation.aggregateDestination,
          state,
          operation.span,
        )
      : null;
  if (aggregateResult !== null) instructions.push(...aggregateResult.instructions);
  const label = bindingLabel("fn", operation.callee);
  instructions.push(
    machineInstruction(
      state.input.profile.cpu,
      "jsr",
      "absolute",
      Object.freeze({ kind: "label", label }),
      [],
      operation.span,
    ),
  );
  if (operation.result !== null) {
    if (aggregateResult !== null) {
      state.values.set(operation.result, aggregateResult.result);
      return Object.freeze(instructions);
    }
    const retained = retainMachineValue(
      operation.result,
      Object.freeze({
        kind: "register",
        registers: typeBytes(operation.type) === 1 ? "a" : "ax",
        bytes: typeBytes(operation.type) === 1 ? 1 : 2,
        signed: isSignedType(operation.type),
      }),
      instructions,
      operation.type,
      operation.span,
      state,
    );
    state.values.set(operation.result, retained.value);
    return retained.instructions;
  }
  return Object.freeze(instructions);
}
