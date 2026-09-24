import type { BinaryOperation } from "../semantic/operations.js";
import {
  machineCost,
  machineInstruction,
  machineState,
  modeForValue,
  operandForValue,
  type LoweredValue,
} from "./lower-control.js";
import type { MachineBlock, MachineInstruction, MachineTerminator } from "./machine-types.js";
import {
  appendLoadA,
  isSignedType,
  loweringFailure,
  requestStorage,
  storeA,
  type FunctionLoweringState,
  typeBytes,
} from "./lower.js";

/** Make one branch with its actual flag use and selected NMOS cost. */
function branch(
  opcode: "bcs" | "beq" | "bne",
  target: string,
  fallthrough: string,
  state: FunctionLoweringState,
): MachineTerminator {
  return Object.freeze({
    kind: "branch",
    opcode,
    target,
    fallthrough,
    uses: machineState([], [opcode === "bcs" ? "c" : "z"]),
    cost: machineCost(state.input.profile.cpu, opcode, "relative"),
  });
}

/** Select one bit shift in place, with signed right shifts taking the old sign into carry. */
function shiftOne(
  operation: BinaryOperation,
  result: LoweredValue,
  width: number,
  state: FunctionLoweringState,
): readonly MachineInstruction[] {
  const cpu = state.input.profile.cpu;
  const source = operation.span;
  const instruction = (opcode: string, mode: string, offset: number) =>
    machineInstruction(cpu, opcode, mode, operandForValue(result, offset), [], source);
  if (operation.operator === "<<") {
    return width === 1
      ? Object.freeze([instruction("asl", "storage", 0)])
      : Object.freeze([instruction("asl", "storage", 0), instruction("rol", "storage", 1)]);
  }
  const high = width - 1;
  const instructions: MachineInstruction[] = [];
  if (isSignedType(operation.type)) {
    appendLoadA(instructions, result, high, state, source);
    instructions.push(
      machineInstruction(
        cpu,
        "cmp",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0x80 }),
        [],
        source,
      ),
      instruction("ror", "storage", high),
    );
  } else {
    instructions.push(instruction("lsr", "storage", high));
  }
  if (width === 2) instructions.push(instruction("ror", "storage", 0));
  return Object.freeze(instructions);
}

/** Build a saturated fixed-width result without repeating a potentially huge shift count. */
function saturatedShift(
  operation: BinaryOperation,
  result: LoweredValue,
  width: number,
  state: FunctionLoweringState,
): readonly MachineInstruction[] {
  const instructions: MachineInstruction[] = [];
  if (operation.operator === ">>" && isSignedType(operation.type)) {
    appendLoadA(instructions, result, width - 1, state, operation.span);
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
    );
  } else {
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "lda",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0 }),
        [],
        operation.span,
      ),
    );
  }
  for (let offset = 0; offset < width; offset += 1) {
    instructions.push(storeA(result, offset, state, operation.span));
  }
  return Object.freeze(instructions);
}

/** Lower a runtime-count shift into a bounded loop and a direct saturation path. */
export function lowerVariableShift(
  operation: BinaryOperation,
  state: FunctionLoweringState,
  entryLabel: string,
  prefix: readonly MachineInstruction[],
  ordinal: number,
): { readonly blocks: readonly MachineBlock[]; readonly continuation: string } {
  const left = state.values.get(operation.left);
  const right = state.values.get(operation.right);
  if (
    left === undefined ||
    right === undefined ||
    left.kind === "condition" ||
    right.kind === "condition"
  ) {
    throw loweringFailure("Variable shift operands were not retained", operation.span);
  }
  const width = typeBytes(operation.type);
  if (width !== 1 && width !== 2)
    throw loweringFailure("Variable shift needs a byte or word", operation.span);
  const source = operation.span;
  const cpu = state.input.profile.cpu;
  const stem = `${entryLabel}.shift.${ordinal}`;
  const lowLabel = `${stem}.low`;
  const zeroLabel = `${stem}.zero`;
  const loopLabel = `${stem}.loop`;
  const saturationLabel = `${stem}.saturated`;
  const continuation = `${stem}.continue`;
  const request = requestStorage(
    state,
    `variable-shift:${operation.result}`,
    "temporary",
    width,
    "ram",
    source,
    "Retain a runtime-count shifted value",
    operation.type,
  );
  const result: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: request.id,
    bytes: width,
    signed: isSignedType(operation.type),
  });
  state.values.set(operation.result, result);
  const entryInstructions = [...prefix];
  let count = right;
  if (right.kind === "register") {
    const countRequest = requestStorage(
      state,
      `variable-shift-count:${operation.result}`,
      "temporary",
      right.bytes,
      "ram",
      source,
      "Preserve a register shift count",
    );
    count = Object.freeze({
      kind: "storage",
      requestId: countRequest.id,
      bytes: right.bytes,
      signed: false,
    });
    for (let offset = 0; offset < right.bytes; offset += 1) {
      appendLoadA(entryInstructions, right, offset, state, source);
      entryInstructions.push(storeA(count, offset, state, source));
    }
  }
  for (let offset = 0; offset < width; offset += 1) {
    appendLoadA(entryInstructions, left, offset, state, source);
    entryInstructions.push(storeA(result, offset, state, source));
  }
  const blocks: MachineBlock[] = [];
  if (count.bytes === 2) {
    appendLoadA(entryInstructions, count, 1, state, source);
    blocks.push(
      Object.freeze({
        label: entryLabel,
        instructions: Object.freeze(entryInstructions),
        terminator: branch("bne", saturationLabel, lowLabel, state),
      }),
    );
  } else {
    blocks.push(
      Object.freeze({
        label: entryLabel,
        instructions: Object.freeze(entryInstructions),
        terminator: Object.freeze({ kind: "fallthrough", target: lowLabel }),
      }),
    );
  }
  blocks.push(
    Object.freeze({
      label: lowLabel,
      instructions: Object.freeze([
        machineInstruction(
          cpu,
          "ldx",
          modeForValue(count, 0),
          operandForValue(count, 0),
          [],
          source,
        ),
        machineInstruction(
          cpu,
          "cpx",
          "immediate",
          Object.freeze({ kind: "immediate", value: width * 8 }),
          [],
          source,
        ),
      ]),
      terminator: branch("bcs", saturationLabel, zeroLabel, state),
    }),
    Object.freeze({
      label: zeroLabel,
      instructions: Object.freeze([
        machineInstruction(
          cpu,
          "cpx",
          "immediate",
          Object.freeze({ kind: "immediate", value: 0 }),
          [],
          source,
        ),
      ]),
      terminator: branch("beq", continuation, loopLabel, state),
    }),
    Object.freeze({
      label: loopLabel,
      instructions: Object.freeze([
        ...shiftOne(operation, result, width, state),
        machineInstruction(cpu, "dex", "implied", null, [], source),
      ]),
      terminator: branch("bne", loopLabel, continuation, state),
    }),
    Object.freeze({
      label: saturationLabel,
      instructions: saturatedShift(operation, result, width, state),
      terminator: Object.freeze({
        kind: "jump",
        opcode: "jmp",
        target: continuation,
        cost: machineCost(cpu, "jmp", "absolute"),
      }),
    }),
  );
  return Object.freeze({ blocks: Object.freeze(blocks), continuation });
}
