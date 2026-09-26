import type { MemoryReadOperation, SemanticOperation } from "../semantic/operations.js";
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
} from "./lower-state.js";

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
  if (
    operation.width === 1 &&
    operation.operator === "sub" &&
    left.kind === "register" &&
    left.registers === "a" &&
    right.kind === "register" &&
    right.registers === "x"
  ) {
    const scratch = requestStorage(
      state,
      `bcd-sub-right:${operation.result}`,
      "temporary",
      1,
      "ram",
      operation.span,
      "Preserve the second volatile byte for decimal subtraction",
      operation.type,
    );
    const stagedRight: LoweredValue = Object.freeze({
      kind: "storage",
      requestId: scratch.id,
      bytes: 1,
      signed: false,
    });
    instructions.push(
      machineInstruction(
        cpu,
        "stx",
        "storage",
        Object.freeze({ kind: "storage", requestId: scratch.id, offset: 0 }),
        [],
        operation.span,
      ),
    );
    emit("sed");
    emit("sec");
    instructions.push(
      machineInstruction(
        cpu,
        "sbc",
        modeForValue(stagedRight),
        operandForValue(stagedRight),
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

/**
 * Read one fixed-address word for a direct two-operand decimal operation.
 *
 * Addition stages the first low byte and retains its high byte in Y. Subtraction
 * retains the first word in A/Y, then stages the later low byte while its high byte
 * stays in X. The selected operation must consume the register layout directly.
 */
export function lowerBcdTwoReadWord(
  operation: MemoryReadOperation,
  state: FunctionLoweringState,
  role: "add-first" | "sub-first" | "sub-second",
): { readonly instructions: readonly MachineInstruction[]; readonly result: LoweredValue } {
  const address = state.values.get(operation.address);
  if (operation.width !== 2 || address?.kind !== "constant") {
    throw new Error("Direct word BCD arithmetic needs fixed-address word reads");
  }
  const cpu = state.input.profile.cpu;
  const low = address.value & 0xffff;
  const high = (low + 1) & 0xffff;
  const load = (opcode: "lda" | "ldx" | "ldy", at: number, order: number): MachineInstruction =>
    machineInstruction(
      cpu,
      opcode,
      "absolute",
      Object.freeze({ kind: "absolute", value: at }),
      [absoluteEffect("read", at, order)],
      operation.span,
    );
  if (role === "sub-first") {
    return Object.freeze({
      instructions: Object.freeze([load("lda", low, 0), load("ldy", high, 1)]),
      result: Object.freeze({ kind: "register", registers: "ay", bytes: 2, signed: false }),
    });
  }
  const scratch = requestStorage(
    state,
    `bcd-word:${operation.result}`,
    "temporary",
    1,
    "ram",
    operation.span,
    role === "add-first"
      ? "Retain the first decimal low byte"
      : "Retain the later decimal low byte",
  );
  const result: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: scratch.id,
    bytes: 1,
    signed: false,
  });
  const instructions: MachineInstruction[] = [load(role === "add-first" ? "lda" : "ldx", low, 0)];
  instructions.push(
    role === "add-first"
      ? storeA(result, 0, state, operation.span)
      : machineInstruction(
          cpu,
          "stx",
          "storage",
          Object.freeze({ kind: "storage", requestId: scratch.id, offset: 0 }),
          [],
          operation.span,
        ),
    load(role === "add-first" ? "ldy" : "ldx", high, 1),
  );
  return Object.freeze({ instructions: Object.freeze(instructions), result });
}

/**
 * Write a directly consumed word result while decimal carry connects its two bytes.
 * The selected input form owns either AX plus a constant, AX plus a staged addend,
 * or a one-byte reusable scratch with the other high byte still in Y/X.
 */
export function lowerBcdWordToConstantMemory(
  operation: Extract<SemanticOperation, { readonly kind: "bcd" }>,
  write: MemoryWriteOperation,
  left: LoweredValue,
  right: LoweredValue,
  address: number,
  state: FunctionLoweringState,
): readonly MachineInstruction[] {
  const laterOperandInAx =
    operation.operator === "add" &&
    left.kind === "storage" &&
    left.bytes === 2 &&
    right.kind === "register" &&
    right.registers === "ax";
  const addFirstHighInY =
    operation.operator === "add" &&
    left.kind === "storage" &&
    left.bytes === 1 &&
    right.kind === "register" &&
    right.registers === "ax";
  const subtractFirstHighInY =
    operation.operator === "sub" &&
    left.kind === "register" &&
    left.registers === "ay" &&
    right.kind === "storage" &&
    right.bytes === 1;
  if (
    operation.width !== 2 ||
    (!laterOperandInAx &&
      !addFirstHighInY &&
      !subtractFirstHighInY &&
      (left.kind !== "register" || left.registers !== "ax" || right.kind !== "constant")) ||
    write.width !== 2
  ) {
    throw new Error("Direct word BCD write needs one AX operand and a stable word operand");
  }
  if (addFirstHighInY || subtractFirstHighInY) {
    const cpu = state.input.profile.cpu;
    const scratch = addFirstHighInY ? left : right;
    if (scratch.kind !== "storage") throw new Error("Direct word BCD scratch was not retained");
    const opcode = addFirstHighInY ? "adc" : "sbc";
    const instructions: MachineInstruction[] = [
      machineInstruction(cpu, "sed", "implied", null, [], operation.span),
      machineInstruction(cpu, addFirstHighInY ? "clc" : "sec", "implied", null, [], operation.span),
      machineInstruction(
        cpu,
        opcode,
        modeForValue(scratch, 0),
        operandForValue(scratch, 0),
        [],
        operation.span,
      ),
      machineInstruction(
        cpu,
        "sta",
        "absolute",
        Object.freeze({ kind: "absolute", value: address & 0xffff }),
        [absoluteEffect("write", address & 0xffff, 0)],
        write.span,
      ),
      // The low scratch is dead after its arithmetic step. STY/STX leaves carry intact.
      machineInstruction(
        cpu,
        addFirstHighInY ? "sty" : "stx",
        "storage",
        Object.freeze({ kind: "storage", requestId: scratch.requestId, offset: 0 }),
        [],
        operation.span,
      ),
      machineInstruction(cpu, addFirstHighInY ? "txa" : "tya", "implied", null, [], operation.span),
      machineInstruction(
        cpu,
        opcode,
        modeForValue(scratch, 0),
        operandForValue(scratch, 0),
        [],
        operation.span,
      ),
      machineInstruction(
        cpu,
        "sta",
        "absolute",
        Object.freeze({ kind: "absolute", value: (address + 1) & 0xffff }),
        [absoluteEffect("write", (address + 1) & 0xffff, 1)],
        write.span,
      ),
      machineInstruction(cpu, "cld", "implied", null, [], operation.span),
    ];
    return Object.freeze(instructions);
  }
  const operand = laterOperandInAx ? left : right;
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
        modeForValue(operand, offset),
        operandForValue(operand, offset),
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
