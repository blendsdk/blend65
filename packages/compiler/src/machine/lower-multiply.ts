import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BinaryOperation } from "../semantic/operations.js";
import {
  machineCost,
  machineInstruction,
  machineState,
  operandForValue,
  type LoweredValue,
} from "./lower-control.js";
import type { MachineInstruction, MachineTerminator } from "./machine-types.js";
import {
  appendLoadA,
  isSignedType,
  loweringFailure,
  requestStorage,
  storeA,
  type FunctionLoweringState,
  typeBytes,
} from "./lower.js";

/** One width-specific shift/add helper shared by all multiply sites in one function. */
export interface MultiplyHelper {
  /** JSR target. */
  readonly label: string;
  /** Multiplicand scratch. */
  readonly left: LoweredValue;
  /** Multiplier scratch. */
  readonly right: LoweredValue;
  /** Fixed-width result; byte multiplication reuses the multiplier home. */
  readonly result: LoweredValue;
  /** Exact SFA requests live while the helper executes. */
  readonly requestIds: readonly string[];
}

/** Make one branch with the flag and physical cost selected by the target CPU. */
function branch(
  opcode: "bcc" | "bne",
  target: string,
  fallthrough: string,
  state: FunctionLoweringState,
): MachineTerminator {
  return Object.freeze({
    kind: "branch",
    opcode,
    target,
    fallthrough,
    uses: machineState([], [opcode === "bcc" ? "c" : "z"]),
    cost: machineCost(state.input.profile.cpu, opcode, "relative"),
  });
}

/** Build the source-owned helper body once; it has no hidden runtime or data allocation. */
function createHelper(
  operation: BinaryOperation,
  width: 1 | 2,
  state: FunctionLoweringState,
): MultiplyHelper {
  const cpu = state.input.profile.cpu;
  const source = operation.span;
  const stem = `${state.currentSemanticBlockId}.multiply.${width}`;
  const leftRequest = requestStorage(
    state,
    `multiply:${width}:left`,
    "temporary",
    width,
    "zero-page-preferred",
    source,
    "Shared multiplicand scratch",
  );
  const rightRequest = requestStorage(
    state,
    `multiply:${width}:right`,
    "temporary",
    width,
    "zero-page-preferred",
    source,
    "Shared multiplier scratch",
  );
  const resultRequest =
    width === 2
      ? requestStorage(
          state,
          `multiply:${width}:result`,
          "temporary",
          width,
          "zero-page-preferred",
          source,
          "Shared multiply result scratch",
        )
      : null;
  const left: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: leftRequest.id,
    bytes: width,
    signed: false,
  });
  const right: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: rightRequest.id,
    bytes: width,
    signed: false,
  });
  const result: LoweredValue =
    resultRequest === null
      ? right
      : Object.freeze({
          kind: "storage",
          requestId: resultRequest.id,
          bytes: width,
          signed: false,
        });
  const loop = `${stem}.loop`;
  const add = `${stem}.add`;
  const shift = `${stem}.shift`;
  const finish = `${stem}.finish`;
  const implied = (opcode: string) => machineInstruction(cpu, opcode, "implied", null, [], source);
  const immediate = (opcode: string, value: number) =>
    machineInstruction(
      cpu,
      opcode,
      "immediate",
      Object.freeze({ kind: "immediate", value }),
      [],
      source,
    );
  const storage = (opcode: string, place: LoweredValue, offset: number) =>
    machineInstruction(cpu, opcode, "storage", operandForValue(place, offset), [], source);
  if (width === 1) {
    const skip = `${stem}.skip`;
    state.helperBlocks.push(
      Object.freeze({
        label: stem,
        instructions: Object.freeze([
          immediate("lda", 0),
          immediate("ldx", 8),
          storage("lsr", right, 0),
        ]),
        terminator: Object.freeze({ kind: "fallthrough", target: loop }),
      }),
      Object.freeze({
        label: loop,
        instructions: Object.freeze([]),
        terminator: branch("bcc", skip, add, state),
      }),
      Object.freeze({
        label: add,
        instructions: Object.freeze([implied("clc"), storage("adc", left, 0)]),
        terminator: Object.freeze({ kind: "fallthrough", target: skip }),
      }),
      Object.freeze({
        label: skip,
        instructions: Object.freeze([
          machineInstruction(cpu, "ror", "accumulator", null, [], source),
          storage("ror", right, 0),
          implied("dex"),
        ]),
        terminator: branch("bne", loop, finish, state),
      }),
      Object.freeze({
        label: finish,
        instructions: Object.freeze([storage("lda", right, 0)]),
        terminator: Object.freeze({
          kind: "return",
          opcode: "rts",
          cost: machineCost(cpu, "rts", "implied"),
        }),
      }),
    );
    return Object.freeze({
      label: stem,
      left,
      right,
      result,
      requestIds: Object.freeze([leftRequest.id, rightRequest.id]),
    });
  }
  const entryInstructions: MachineInstruction[] = [immediate("lda", 0)];
  for (let offset = 0; offset < width; offset += 1)
    entryInstructions.push(storeA(result, offset, state, source));
  entryInstructions.push(immediate("ldx", width * 8));
  const loopInstructions: MachineInstruction[] = [];
  if (width === 2) loopInstructions.push(storage("lsr", right, 1));
  loopInstructions.push(storage(width === 2 ? "ror" : "lsr", right, 0));
  const addInstructions: MachineInstruction[] = [
    storage("lda", result, 0),
    implied("clc"),
    storage("adc", left, 0),
    storeA(result, 0, state, source),
  ];
  if (width === 2)
    addInstructions.push(
      storage("lda", result, 1),
      storage("adc", left, 1),
      storeA(result, 1, state, source),
    );
  const shiftInstructions: MachineInstruction[] = [storage("asl", left, 0)];
  if (width === 2) shiftInstructions.push(storage("rol", left, 1));
  shiftInstructions.push(implied("dex"));
  const finishInstructions: MachineInstruction[] = [];
  if (width === 2) finishInstructions.push(storage("lda", result, 1), implied("tax"));
  finishInstructions.push(storage("lda", result, 0));
  state.helperBlocks.push(
    Object.freeze({
      label: stem,
      instructions: Object.freeze(entryInstructions),
      terminator: Object.freeze({ kind: "fallthrough", target: loop }),
    }),
    Object.freeze({
      label: loop,
      instructions: Object.freeze(loopInstructions),
      terminator: branch("bcc", shift, add, state),
    }),
    Object.freeze({
      label: add,
      instructions: Object.freeze(addInstructions),
      terminator: Object.freeze({ kind: "fallthrough", target: shift }),
    }),
    Object.freeze({
      label: shift,
      instructions: Object.freeze(shiftInstructions),
      terminator: branch("bne", loop, finish, state),
    }),
    Object.freeze({
      label: finish,
      instructions: Object.freeze(finishInstructions),
      terminator: Object.freeze({
        kind: "return",
        opcode: "rts",
        cost: machineCost(cpu, "rts", "implied"),
      }),
    }),
  );
  if (resultRequest === null) throw loweringFailure("Word multiply has no result home", source);
  return Object.freeze({
    label: stem,
    left,
    right,
    result,
    requestIds: Object.freeze([leftRequest.id, rightRequest.id, resultRequest.id]),
  });
}

/** Select one source-owned software multiply helper for two runtime operands. */
export function lowerRuntimeMultiply(
  operation: BinaryOperation,
  left: LoweredValue,
  right: LoweredValue,
  state: FunctionLoweringState,
): { readonly instructions: readonly MachineInstruction[]; readonly result: LoweredValue } {
  if (left.kind === "condition" || right.kind === "condition") {
    throw loweringFailure("Runtime multiply operands were not retained", operation.span);
  }
  const width = typeBytes(operation.type);
  if (width !== 1 && width !== 2)
    throw loweringFailure("Runtime multiply needs a byte or word", operation.span);
  let helper = state.multiplyHelpers.get(width);
  if (helper === undefined) {
    helper = createHelper(operation, width, state);
    state.multiplyHelpers.set(width, helper);
  }
  const instructions: MachineInstruction[] = [];
  const stage = (value: LoweredValue, destination: LoweredValue) => {
    for (let offset = 0; offset < width; offset += 1) {
      appendLoadA(instructions, value, offset, state, operation.span);
      instructions.push(storeA(destination, offset, state, operation.span));
    }
  };
  if (left.kind === "register" && right.kind !== "register") {
    stage(left, helper.left);
    stage(right, helper.right);
  } else {
    stage(right, helper.right);
    stage(left, helper.left);
  }
  instructions.push(
    machineInstruction(
      state.input.profile.cpu,
      "jsr",
      "absolute",
      Object.freeze({ kind: "label", label: helper.label }),
      [],
      operation.span,
    ),
  );
  state.helperUses.push(
    Object.freeze({
      id: `multiply:${bindingIdentityKey(state.owner)}:${operation.result}`,
      requestIds: helper.requestIds,
    }),
  );
  return Object.freeze({
    instructions: Object.freeze(instructions),
    result: Object.freeze({
      kind: "register",
      registers: width === 1 ? "a" : "ax",
      bytes: width,
      signed: isSignedType(operation.type),
    }),
  });
}
