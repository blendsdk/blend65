import type { SemanticOperation } from "../semantic/operations.js";
import {
  machineInstruction,
  modeForValue,
  operandForValue,
  type LoweredValue,
} from "./lower-control.js";
import type { MachineInstruction } from "./machine-types.js";
import { appendLoadA, requestStorage, storeA, type FunctionLoweringState } from "./lower-state.js";

/** Lower equality or ordering to flags retained directly by a branch terminator. */
export function lowerComparison(
  operation: Extract<SemanticOperation, { readonly kind: "binary" }>,
  leftInput: LoweredValue,
  rightInput: LoweredValue,
  state: FunctionLoweringState,
): { readonly instructions: readonly MachineInstruction[]; readonly result: LoweredValue } {
  const byteSignTest =
    leftInput.kind === "storage" &&
    leftInput.bytes === 1 &&
    !leftInput.signed &&
    rightInput.kind === "constant" &&
    rightInput.bytes === 1 &&
    !rightInput.signed &&
    ((rightInput.value === 128 && ["<", ">="].includes(operation.operator)) ||
      (rightInput.value === 127 && [">", "<="].includes(operation.operator))) &&
    state.branchConditions.has(operation.result) &&
    !state.materializedValues.has(operation.result);
  if (byteSignTest) {
    const instructions: MachineInstruction[] = [];
    // Only our fresh LDA proves N is bit 7 of the unsigned byte. A returned
    // register may carry unrelated flags; signed and wider operands fall back.
    appendLoadA(instructions, leftInput, 0, state, operation.span);
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: Object.freeze({
        kind: "condition",
        whenTrue: operation.operator === "<" || operation.operator === "<=" ? "bpl" : "bmi",
        usesFlag: "n",
      }),
    });
  }
  let left = leftInput;
  let right = rightInput;
  let operator = operation.operator;
  if (operator === ">" || operator === "<=") {
    [left, right] = [right, left];
    operator = operator === ">" ? "<" : ">=";
  }
  const signed = left.kind === "condition" ? false : (left.signed ?? false);
  const width = Math.max(
    left.kind === "condition" ? 1 : left.bytes,
    right.kind === "condition" ? 1 : right.bytes,
  );
  const instructions: MachineInstruction[] = [];
  if (
    !signed &&
    width === 2 &&
    left.kind === "storage" &&
    right.kind === "constant" &&
    (right.value === 128 || right.value === 256) &&
    (operator === "<" || operator === ">=") &&
    state.branchConditions.has(operation.result) &&
    !state.materializedValues.has(operation.result)
  ) {
    // These unsigned limits need one Z test, not a full-word subtraction.
    // Below 128 requires both a zero high byte and a clear low-byte sign bit.
    // Only private addressable homes participate; other representations fall back.
    appendLoadA(instructions, left, right.value === 256 ? 1 : 0, state, operation.span);
    if (right.value === 128)
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "and",
          "immediate",
          Object.freeze({ kind: "immediate", value: 0x80 }),
          [],
          operation.span,
        ),
        machineInstruction(
          state.input.profile.cpu,
          "ora",
          modeForValue(left, 1),
          operandForValue(left, 1),
          [],
          operation.span,
        ),
      );
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: Object.freeze({
        kind: "condition",
        whenTrue: operator === "<" ? "beq" : "bne",
        usesFlag: "z",
      }),
    });
  }
  if (operator === "==" || operator === "!=") {
    appendLoadA(instructions, left, 0, state, operation.span);
    // A fresh LDA already sets exactly the N/Z that EOR #0 would leave.
    // A live register alone is insufficient: a call may return A with other flags.
    const loadedZeroTest =
      width === 1 &&
      right.kind === "constant" &&
      right.value === 0 &&
      instructions.at(-1)?.opcode === "lda";
    if (!loadedZeroTest)
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "eor",
          modeForValue(right),
          operandForValue(right, 0),
          [],
          operation.span,
        ),
      );
    if (width === 2) {
      const scratch = requestStorage(
        state,
        `equality:${operation.result}`,
        "temporary",
        1,
        "ram",
        operation.span,
        "Low-byte difference for word equality",
      );
      const difference: LoweredValue = Object.freeze({
        kind: "storage",
        requestId: scratch.id,
        bytes: 1,
        signed: false,
      });
      instructions.push(storeA(difference, 0, state, operation.span));
      appendLoadA(instructions, left, 1, state, operation.span);
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "eor",
          modeForValue(right, 1),
          operandForValue(right, 1),
          [],
          operation.span,
        ),
        machineInstruction(
          state.input.profile.cpu,
          "ora",
          "storage",
          operandForValue(difference),
          [],
          operation.span,
        ),
      );
    }
    if (!state.materializedValues.has(operation.result)) {
      return Object.freeze({
        instructions: Object.freeze(instructions),
        result: Object.freeze({
          kind: "condition",
          whenTrue: operator === "==" ? "beq" : "bne",
          usesFlag: "z",
        }),
      });
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
    );
    if (operator === "==") {
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "eor",
          "immediate",
          Object.freeze({ kind: "immediate", value: 1 }),
          [],
          operation.span,
        ),
      );
    }
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: Object.freeze({ kind: "register", registers: "a", bytes: 1, signed: false }),
    });
  }
  let comparisonRight = right;
  if (signed) {
    const scratch = requestStorage(
      state,
      `signed-compare:${operation.result}`,
      "temporary",
      1,
      "ram",
      operation.span,
      "Biased high byte for signed comparison",
    );
    comparisonRight = Object.freeze({ kind: "storage", requestId: scratch.id, bytes: 1 });
    appendLoadA(instructions, right, width - 1, state, operation.span);
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "eor",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0x80 }),
        [],
        operation.span,
      ),
      storeA(comparisonRight, 0, state, operation.span),
    );
  }
  if (width === 1) {
    appendLoadA(instructions, left, 0, state, operation.span);
    if (signed) {
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "eor",
          "immediate",
          Object.freeze({ kind: "immediate", value: 0x80 }),
          [],
          operation.span,
        ),
      );
    }
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "cmp",
        modeForValue(comparisonRight),
        operandForValue(comparisonRight),
        [],
        operation.span,
      ),
    );
  } else {
    appendLoadA(instructions, left, 0, state, operation.span);
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "cmp",
        modeForValue(right),
        operandForValue(right, 0),
        [],
        operation.span,
      ),
    );
    appendLoadA(instructions, left, 1, state, operation.span);
    if (signed) {
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "eor",
          "immediate",
          Object.freeze({ kind: "immediate", value: 0x80 }),
          [],
          operation.span,
        ),
      );
    }
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "sbc",
        modeForValue(comparisonRight, signed ? 0 : 1),
        operandForValue(comparisonRight, signed ? 0 : 1),
        [],
        operation.span,
      ),
    );
  }
  const whenTrue =
    operator === "<" ? "bcc" : operator === ">=" ? "bcs" : operator === "!=" ? "bne" : "beq";
  if (
    state.materializedValues.has(operation.result) &&
    (whenTrue === "bcc" || whenTrue === "bcs")
  ) {
    instructions.push(
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
    );
    if (whenTrue === "bcc") {
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "eor",
          "immediate",
          Object.freeze({ kind: "immediate", value: 1 }),
          [],
          operation.span,
        ),
      );
    }
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: Object.freeze({ kind: "register", registers: "a", bytes: 1, signed: false }),
    });
  }
  return Object.freeze({
    instructions: Object.freeze(instructions),
    result: Object.freeze({
      kind: "condition",
      whenTrue,
      usesFlag: whenTrue === "bcc" || whenTrue === "bcs" ? "c" : "z",
    }),
  });
}
