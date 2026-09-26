import type { SemanticOperation } from "../semantic/operations.js";
import type { MemoryWriteOperation } from "../semantic/operations.js";
import {
  machineInstruction,
  modeForValue,
  operandForValue,
  type LoweredValue,
} from "./lower-control.js";
import type { MachineInstruction } from "./machine-types.js";
import { absoluteEffect } from "./lower-memory.js";
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

/** Emit one complete decimal region; ordinary address work is kept outside SED–CLD. */
export function lowerBcdArithmetic(
  operation: Extract<SemanticOperation, { readonly kind: "bcd" }>,
  left: LoweredValue,
  right: LoweredValue,
  state: FunctionLoweringState,
): { readonly instructions: readonly MachineInstruction[]; readonly result: LoweredValue } {
  const instructions: MachineInstruction[] = [];
  const cpu = state.input.profile.cpu;
  const opcode = operation.operator === "add" ? "adc" : "sbc";
  const emit = (name: string): void => {
    instructions.push(machineInstruction(cpu, name, "implied", null, [], operation.span));
  };
  if (operation.width === 1 && operation.operator === "add" && right.kind === "register") {
    // Decimal addition is commutative, so the later evaluated operand may stay in A.
    // The earlier operand is already stable and can be read by ADC without another home.
    if (left.kind === "register" || right.registers !== "a") {
      throw new Error("BCD add needs one stable operand beside the accumulator");
    }
    emit("sed");
    emit("clc");
    instructions.push(
      machineInstruction(
        cpu,
        "adc",
        modeForValue(left),
        operandForValue(left, 0),
        [],
        operation.span,
      ),
    );
    emit("cld");
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: Object.freeze({ kind: "register", registers: "a", bytes: 1, signed: false }),
    });
  }
  appendLoadA(instructions, left, 0, state, operation.span);
  emit("sed");
  emit(operation.operator === "add" ? "clc" : "sec");
  instructions.push(
    machineInstruction(
      cpu,
      opcode,
      modeForValue(right),
      operandForValue(right, 0),
      [],
      operation.span,
    ),
  );
  if (operation.width === 1) {
    emit("cld");
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: Object.freeze({ kind: "register", registers: "a", bytes: 1, signed: false }),
    });
  }
  const scratch = requestStorage(
    state,
    `bcd:${operation.result}`,
    "temporary",
    2,
    "ram",
    operation.span,
    "Low decimal byte must survive high-byte arithmetic",
    operation.type,
  );
  const result: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: scratch.id,
    bytes: 2,
    signed: false,
  });
  instructions.push(storeA(result, 0, state, operation.span));
  appendLoadA(instructions, left, 1, state, operation.span);
  instructions.push(
    machineInstruction(
      cpu,
      opcode,
      modeForValue(right, 1),
      operandForValue(right, 1),
      [],
      operation.span,
    ),
    storeA(result, 1, state, operation.span),
  );
  emit("cld");
  return Object.freeze({ instructions: Object.freeze(instructions), result });
}

/** Write a directly consumed word result while decimal carry still connects its two bytes. */
export function lowerBcdWordToConstantMemory(
  operation: Extract<SemanticOperation, { readonly kind: "bcd" }>,
  write: MemoryWriteOperation,
  left: LoweredValue,
  right: LoweredValue,
  address: number,
  state: FunctionLoweringState,
): readonly MachineInstruction[] {
  if (
    operation.width !== 2 ||
    left.kind !== "register" ||
    left.registers !== "ax" ||
    right.kind !== "constant" ||
    write.width !== 2
  ) {
    throw new Error("Direct word BCD write needs AX, a constant operand and word destination");
  }
  const cpu = state.input.profile.cpu;
  const opcode = operation.operator === "add" ? "adc" : "sbc";
  const instructions: MachineInstruction[] = [
    machineInstruction(cpu, "sed", "implied", null, [], operation.span),
    machineInstruction(
      cpu,
      operation.operator === "add" ? "clc" : "sec",
      "implied",
      null,
      [],
      operation.span,
    ),
  ];
  for (let offset = 0; offset < 2; offset += 1) {
    if (offset === 1) {
      // TXA updates N/Z, not carry; the low-byte decimal carry reaches the high byte.
      instructions.push(machineInstruction(cpu, "txa", "implied", null, [], operation.span));
    }
    instructions.push(
      machineInstruction(
        cpu,
        opcode,
        modeForValue(right, offset),
        operandForValue(right, offset),
        [],
        operation.span,
      ),
      machineInstruction(
        cpu,
        "sta",
        "absolute",
        Object.freeze({ kind: "absolute", value: (address + offset) & 0xffff }),
        [absoluteEffect("write", (address + offset) & 0xffff, offset)],
        write.span,
      ),
    );
  }
  instructions.push(machineInstruction(cpu, "cld", "implied", null, [], operation.span));
  return Object.freeze(instructions);
}
