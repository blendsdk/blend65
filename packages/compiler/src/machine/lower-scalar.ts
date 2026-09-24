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
  loadA,
  requestStorage,
  storeA,
  type FunctionLoweringState,
  typeBytes,
} from "./lower.js";

/** Lower byte/word bit operations directly over their little-endian bytes. */
export function lowerBitwise(
  operation: Extract<SemanticOperation, { readonly kind: "binary" }>,
  left: LoweredValue,
  right: LoweredValue,
  state: FunctionLoweringState,
): { readonly instructions: readonly MachineInstruction[]; readonly result: LoweredValue } {
  if (left.kind === "condition" || right.kind === "condition") {
    throw loweringFailure("Bitwise operand was not lowered to a value", operation.span);
  }
  const opcode = operation.operator === "&" ? "and" : operation.operator === "|" ? "ora" : "eor";
  const width = typeBytes(operation.type);
  if (width !== 1 && width !== 2) {
    throw loweringFailure("Bitwise lowering requires a byte or word result", operation.span);
  }
  const request =
    width === 1
      ? null
      : requestStorage(
          state,
          `bitwise:${operation.result}`,
          "temporary",
          width,
          "ram",
          operation.span,
          "Multi-byte bitwise result",
          operation.type,
        );
  const result: LoweredValue =
    request === null
      ? Object.freeze({
          kind: "register",
          registers: "a",
          bytes: 1,
          signed: isSignedType(operation.type),
        })
      : Object.freeze({
          kind: "storage",
          requestId: request.id,
          bytes: width,
          signed: isSignedType(operation.type),
        });
  const instructions: MachineInstruction[] = [];
  for (let offset = 0; offset < width; offset += 1) {
    appendLoadA(instructions, left, offset, state, operation.span);
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        opcode,
        modeForValue(right, offset),
        operandForValue(right, offset),
        [],
        operation.span,
      ),
    );
    if (result.kind === "storage") instructions.push(storeA(result, offset, state, operation.span));
  }
  return Object.freeze({ instructions: Object.freeze(instructions), result });
}

/** Lower one compile-time shift count with saturated language semantics. */
export function lowerFixedShift(
  operation: Extract<SemanticOperation, { readonly kind: "binary" }>,
  value: LoweredValue,
  countInput: number,
  direction: "left" | "right",
  state: FunctionLoweringState,
): { readonly instructions: readonly MachineInstruction[]; readonly result: LoweredValue } {
  if (value.kind === "condition" || !Number.isInteger(countInput) || countInput < 0) {
    throw loweringFailure("Shift requires a value and non-negative constant count", operation.span);
  }
  const width = typeBytes(operation.type);
  if (width !== 1 && width !== 2) {
    throw loweringFailure("Shift lowering requires a byte or word result", operation.span);
  }
  const count = Math.min(countInput, width * 8);
  if (count === 0) {
    return Object.freeze({ instructions: Object.freeze([]), result: value });
  }
  const signedRight = direction === "right" && isSignedType(operation.type);
  const instructions: MachineInstruction[] = [];
  if (width === 1) {
    appendLoadA(instructions, value, 0, state, operation.span);
    for (let step = 0; step < count; step += 1) {
      if (signedRight) {
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
            "ror",
            "accumulator",
            null,
            [],
            operation.span,
          ),
        );
      } else {
        instructions.push(
          machineInstruction(
            state.input.profile.cpu,
            direction === "left" ? "asl" : "lsr",
            "accumulator",
            null,
            [],
            operation.span,
          ),
        );
      }
    }
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: Object.freeze({
        kind: "register",
        registers: "a",
        bytes: 1,
        signed: isSignedType(operation.type),
      }),
    });
  }

  const request = requestStorage(
    state,
    `shift:${operation.result}`,
    "temporary",
    width,
    "ram",
    operation.span,
    "Multi-byte shifted result",
    operation.type,
  );
  const result: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: request.id,
    bytes: width,
    signed: isSignedType(operation.type),
  });
  for (let offset = 0; offset < width; offset += 1) {
    appendLoadA(instructions, value, offset, state, operation.span);
    instructions.push(storeA(result, offset, state, operation.span));
  }
  for (let step = 0; step < count; step += 1) {
    if (direction === "left") {
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "asl",
          "storage",
          operandForValue(result, 0),
          [],
          operation.span,
        ),
        machineInstruction(
          state.input.profile.cpu,
          "rol",
          "storage",
          operandForValue(result, 1),
          [],
          operation.span,
        ),
      );
    } else {
      if (signedRight) {
        instructions.push(
          loadA(result, 1, state, operation.span),
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
            "ror",
            "storage",
            operandForValue(result, 1),
            [],
            operation.span,
          ),
        );
      } else {
        instructions.push(
          machineInstruction(
            state.input.profile.cpu,
            "lsr",
            "storage",
            operandForValue(result, 1),
            [],
            operation.span,
          ),
        );
      }
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "ror",
          "storage",
          operandForValue(result, 0),
          [],
          operation.span,
        ),
      );
    }
  }
  return Object.freeze({ instructions: Object.freeze(instructions), result });
}

/** Lower one constant multiply as direct modulo-width shift and add operations. */
export function lowerConstantMultiply(
  operation: Extract<SemanticOperation, { readonly kind: "binary" }>,
  value: LoweredValue,
  constantInput: number,
  state: FunctionLoweringState,
): { readonly instructions: readonly MachineInstruction[]; readonly result: LoweredValue } {
  if (value.kind === "condition" || !Number.isInteger(constantInput)) {
    throw loweringFailure("Constant scaling requires an integer operand", operation.span);
  }
  const width = typeBytes(operation.type);
  if (width !== 1 && width !== 2) {
    throw loweringFailure("Constant scaling requires a byte or word result", operation.span);
  }
  const modulus = 2 ** (width * 8);
  let factor = ((constantInput % modulus) + modulus) % modulus;
  if (factor === 0) {
    return Object.freeze({
      instructions: Object.freeze([]),
      result: Object.freeze({ kind: "constant", value: 0, bytes: width, signed: false }),
    });
  }
  if (factor === 1) {
    return Object.freeze({ instructions: Object.freeze([]), result: value });
  }
  if ((factor & (factor - 1)) === 0) {
    return lowerFixedShift(operation, value, Math.log2(factor), "left", state);
  }
  if (width === 1 && factor === 255) {
    const instructions: MachineInstruction[] = [];
    appendLoadA(instructions, value, 0, state, operation.span);
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "eor",
        "immediate",
        Object.freeze({ kind: "immediate", value: 255 }),
        [],
        operation.span,
      ),
      machineInstruction(state.input.profile.cpu, "clc", "implied", null, [], operation.span),
      machineInstruction(
        state.input.profile.cpu,
        "adc",
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
  if (width === 1 && (factor === 3 || factor === 5 || factor === 10)) {
    const originalRequest = requestStorage(
      state,
      `scale-original:${operation.result}`,
      "temporary",
      1,
      "zero-page-preferred",
      operation.span,
      "Original byte retained for a short constant multiplication chain",
      operation.type,
    );
    const original: LoweredValue = Object.freeze({
      kind: "storage",
      requestId: originalRequest.id,
      bytes: 1,
      signed: isSignedType(operation.type),
    });
    const instructions: MachineInstruction[] = [];
    appendLoadA(instructions, value, 0, state, operation.span);
    instructions.push(storeA(original, 0, state, operation.span));
    for (let shift = 0; shift < (factor === 3 ? 1 : 2); shift += 1) {
      instructions.push(
        machineInstruction(state.input.profile.cpu, "asl", "accumulator", null, [], operation.span),
      );
    }
    instructions.push(
      machineInstruction(state.input.profile.cpu, "clc", "implied", null, [], operation.span),
      machineInstruction(
        state.input.profile.cpu,
        "adc",
        "storage",
        operandForValue(original, 0),
        [],
        operation.span,
      ),
    );
    if (factor === 10) {
      instructions.push(
        machineInstruction(state.input.profile.cpu, "asl", "accumulator", null, [], operation.span),
      );
    }
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: Object.freeze({
        kind: "register",
        registers: "a",
        bytes: 1,
        signed: isSignedType(operation.type),
      }),
    });
  }

  const candidateRequest = requestStorage(
    state,
    `scale-candidate:${operation.result}`,
    "temporary",
    width,
    "ram",
    operation.span,
    "Shifted constant-scale candidate",
    operation.type,
  );
  const resultRequest = requestStorage(
    state,
    `scale-result:${operation.result}`,
    "temporary",
    width,
    "ram",
    operation.span,
    "Constant-scale accumulator",
    operation.type,
  );
  const candidate: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: candidateRequest.id,
    bytes: width,
    signed: isSignedType(operation.type),
  });
  const result: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: resultRequest.id,
    bytes: width,
    signed: isSignedType(operation.type),
  });
  const instructions: MachineInstruction[] = [];
  for (let offset = 0; offset < width; offset += 1) {
    appendLoadA(instructions, value, offset, state, operation.span);
    instructions.push(
      storeA(candidate, offset, state, operation.span),
      machineInstruction(
        state.input.profile.cpu,
        "lda",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0 }),
        [],
        operation.span,
      ),
      storeA(result, offset, state, operation.span),
    );
  }
  while (factor !== 0) {
    if ((factor & 1) !== 0) {
      instructions.push(
        loadA(result, 0, state, operation.span),
        machineInstruction(state.input.profile.cpu, "clc", "implied", null, [], operation.span),
        machineInstruction(
          state.input.profile.cpu,
          "adc",
          "storage",
          operandForValue(candidate, 0),
          [],
          operation.span,
        ),
        storeA(result, 0, state, operation.span),
      );
      if (width === 2) {
        instructions.push(
          loadA(result, 1, state, operation.span),
          machineInstruction(
            state.input.profile.cpu,
            "adc",
            "storage",
            operandForValue(candidate, 1),
            [],
            operation.span,
          ),
          storeA(result, 1, state, operation.span),
        );
      }
    }
    factor = Math.floor(factor / 2);
    if (factor !== 0) {
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "asl",
          "storage",
          operandForValue(candidate, 0),
          [],
          operation.span,
        ),
      );
      if (width === 2) {
        instructions.push(
          machineInstruction(
            state.input.profile.cpu,
            "rol",
            "storage",
            operandForValue(candidate, 1),
            [],
            operation.span,
          ),
        );
      }
    }
  }
  return Object.freeze({ instructions: Object.freeze(instructions), result });
}

/** Lower equality or ordering to flags retained directly by a branch terminator. */
export function lowerComparison(
  operation: Extract<SemanticOperation, { readonly kind: "binary" }>,
  leftInput: LoweredValue,
  rightInput: LoweredValue,
  state: FunctionLoweringState,
): { readonly instructions: readonly MachineInstruction[]; readonly result: LoweredValue } {
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
  if (operator === "==" || operator === "!=") {
    appendLoadA(instructions, left, 0, state, operation.span);
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
