import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BinaryOperation } from "../semantic/operations.js";
import {
  machineCost,
  machineInstruction,
  machineState,
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

/** One source-owned divider shared by quotient and remainder sites of the same width/sign. */
export interface DivideHelper {
  /** JSR target. */
  readonly label: string;
  /** Dividend on entry and quotient on return. */
  readonly quotient: LoweredValue;
  /** Divisor retained throughout the division. */
  readonly divisor: LoweredValue;
  /** Remainder on return. */
  readonly remainder: LoweredValue;
  /** Exact static scratch identities used by the helper. */
  readonly requestIds: readonly string[];
}

/** Build one physical instruction belonging to the selected arithmetic source site. */
function instructionsFor(operation: BinaryOperation, state: FunctionLoweringState) {
  const cpu = state.input.profile.cpu;
  const source = operation.span;
  return Object.freeze({
    implied: (opcode: string) => machineInstruction(cpu, opcode, "implied", null, [], source),
    immediate: (opcode: string, value: number) =>
      machineInstruction(
        cpu,
        opcode,
        "immediate",
        Object.freeze({ kind: "immediate", value }),
        [],
        source,
      ),
    storage: (opcode: string, value: LoweredValue, offset: number) =>
      machineInstruction(cpu, opcode, "storage", operandForValue(value, offset), [], source),
  });
}

/** Make one structured branch with the exact flag and selected NMOS cost. */
function branch(
  opcode: "bcc" | "bcs" | "beq" | "bne" | "bpl",
  target: string,
  fallthrough: string,
  state: FunctionLoweringState,
): MachineTerminator {
  const flag = opcode === "bcc" || opcode === "bcs" ? "c" : opcode === "bpl" ? "n" : "z";
  return Object.freeze({
    kind: "branch",
    opcode,
    target,
    fallthrough,
    uses: machineState([], [flag]),
    cost: machineCost(state.input.profile.cpu, opcode, "relative"),
  });
}

/** Append the two's-complement negation of one byte or little-endian word in place. */
function negate(
  value: LoweredValue,
  width: 1 | 2,
  operation: BinaryOperation,
  state: FunctionLoweringState,
): readonly MachineInstruction[] {
  const op = instructionsFor(operation, state);
  const result: MachineInstruction[] = [op.immediate("lda", 0), op.implied("sec")];
  for (let offset = 0; offset < width; offset += 1) {
    if (offset > 0) result.push(op.immediate("lda", 0));
    result.push(op.storage("sbc", value, offset), storeA(value, offset, state, operation.span));
  }
  return Object.freeze(result);
}

/** Allocate the source-owned scratch needed by one width/sign variant. */
function scratch(
  operation: BinaryOperation,
  state: FunctionLoweringState,
  key: string,
  bytes: 1 | 2,
): LoweredValue {
  const request = requestStorage(
    state,
    `divide:${key}`,
    "temporary",
    bytes,
    "zero-page-preferred",
    operation.span,
    "Software division scratch",
  );
  return Object.freeze({ kind: "storage", requestId: request.id, bytes, signed: false });
}

/** Construct the finite restoring divider; zero divisors also terminate without an injected check. */
function createHelper(
  operation: BinaryOperation,
  width: 1 | 2,
  signed: boolean,
  state: FunctionLoweringState,
): DivideHelper {
  const stem = `${state.currentSemanticBlockId}.divide.${width}.${signed ? "signed" : "unsigned"}`;
  const op = instructionsFor(operation, state);
  const quotient = scratch(operation, state, `${width}:${signed}:quotient`, width);
  const divisor = scratch(operation, state, `${width}:${signed}:divisor`, width);
  const remainder = scratch(operation, state, `${width}:${signed}:remainder`, width);
  const signQ = signed ? scratch(operation, state, `${width}:sign-quotient`, 1) : null;
  const signR = signed ? scratch(operation, state, `${width}:sign-remainder`, 1) : null;
  const requestIds = [quotient, divisor, remainder, signQ, signR]
    .filter(
      (value): value is Extract<LoweredValue, { readonly kind: "storage" }> =>
        value?.kind === "storage",
    )
    .map(({ requestId }) => requestId);
  const blocks: MachineBlock[] = [];
  const block = (
    label: string,
    body: readonly MachineInstruction[],
    terminator: MachineTerminator,
  ) => {
    blocks.push(Object.freeze({ label, instructions: Object.freeze(body), terminator }));
  };
  const fallthrough = (target: string): MachineTerminator =>
    Object.freeze({ kind: "fallthrough", target });
  const core = `${stem}.core`;
  const loop = `${stem}.loop`;
  const compare = `${stem}.compare`;
  const compareEqual = `${stem}.compare-equal`;
  const compareLow = `${stem}.compare-low`;
  const subtract = `${stem}.subtract`;
  const skip = `${stem}.skip`;
  const finish = signed ? `${stem}.sign-quotient` : `${stem}.return`;

  if (signed && signQ !== null && signR !== null) {
    const numeratorHigh = width - 1;
    const divisorCheck = `${stem}.divisor-check`;
    const negativeNumerator = `${stem}.negate-numerator`;
    const negativeDivisor = `${stem}.negate-divisor`;
    block(
      stem,
      [
        op.storage("lda", quotient, numeratorHigh),
        op.storage("eor", divisor, numeratorHigh),
        op.immediate("and", 0x80),
        storeA(signQ, 0, state, operation.span),
        op.storage("lda", quotient, numeratorHigh),
        op.immediate("and", 0x80),
        storeA(signR, 0, state, operation.span),
        op.storage("lda", quotient, numeratorHigh),
      ],
      branch("bpl", divisorCheck, negativeNumerator, state),
    );
    block(negativeNumerator, negate(quotient, width, operation, state), fallthrough(divisorCheck));
    block(
      divisorCheck,
      [op.storage("lda", divisor, numeratorHigh)],
      branch("bpl", core, negativeDivisor, state),
    );
    block(negativeDivisor, negate(divisor, width, operation, state), fallthrough(core));
  }

  const coreBody: MachineInstruction[] = [op.immediate("lda", 0)];
  for (let offset = 0; offset < width; offset += 1) {
    coreBody.push(storeA(remainder, offset, state, operation.span));
  }
  coreBody.push(op.immediate("ldx", width * 8));
  block(core, coreBody, fallthrough(loop));
  const shiftBody: MachineInstruction[] = [op.storage("asl", quotient, 0)];
  if (width === 2) shiftBody.push(op.storage("rol", quotient, 1));
  shiftBody.push(op.storage("rol", remainder, 0));
  if (width === 2) shiftBody.push(op.storage("rol", remainder, 1));
  block(loop, shiftBody, branch("bcs", subtract, compare, state));
  if (width === 1) {
    block(
      compare,
      [op.storage("lda", remainder, 0), op.storage("cmp", divisor, 0)],
      branch("bcc", skip, subtract, state),
    );
  } else {
    block(
      compare,
      [op.storage("lda", remainder, 1), op.storage("cmp", divisor, 1)],
      branch("bcc", skip, compareEqual, state),
    );
    block(compareEqual, [], branch("bne", subtract, compareLow, state));
    block(
      compareLow,
      [op.storage("lda", remainder, 0), op.storage("cmp", divisor, 0)],
      branch("bcc", skip, subtract, state),
    );
  }
  const subtractBody: MachineInstruction[] = [
    op.implied("sec"),
    op.storage("lda", remainder, 0),
    op.storage("sbc", divisor, 0),
    storeA(remainder, 0, state, operation.span),
  ];
  if (width === 2)
    subtractBody.push(
      op.storage("lda", remainder, 1),
      op.storage("sbc", divisor, 1),
      storeA(remainder, 1, state, operation.span),
    );
  subtractBody.push(op.storage("inc", quotient, 0));
  block(subtract, subtractBody, fallthrough(skip));
  block(skip, [op.implied("dex")], branch("bne", loop, finish, state));

  if (signed && signQ !== null && signR !== null) {
    const negateQ = `${stem}.negate-quotient`;
    const checkR = `${stem}.sign-remainder`;
    const negateR = `${stem}.negate-remainder`;
    const done = `${stem}.return`;
    block(finish, [op.storage("lda", signQ, 0)], branch("beq", checkR, negateQ, state));
    block(negateQ, negate(quotient, width, operation, state), fallthrough(checkR));
    block(checkR, [op.storage("lda", signR, 0)], branch("beq", done, negateR, state));
    block(negateR, negate(remainder, width, operation, state), fallthrough(done));
    block(
      done,
      [],
      Object.freeze({
        kind: "return",
        opcode: "rts",
        cost: machineCost(state.input.profile.cpu, "rts", "implied"),
      }),
    );
  } else {
    block(
      finish,
      [],
      Object.freeze({
        kind: "return",
        opcode: "rts",
        cost: machineCost(state.input.profile.cpu, "rts", "implied"),
      }),
    );
  }
  state.helperBlocks.push(...blocks);
  return Object.freeze({
    label: signed ? stem : core,
    quotient,
    divisor,
    remainder,
    requestIds: Object.freeze(requestIds),
  });
}

/** Select one bounded software divide/remainder helper for two runtime operands. */
export function lowerRuntimeDivision(
  operation: BinaryOperation,
  left: LoweredValue,
  right: LoweredValue,
  state: FunctionLoweringState,
  reuseResult = false,
): { readonly instructions: readonly MachineInstruction[]; readonly result: LoweredValue } {
  if (left.kind === "condition" || right.kind === "condition") {
    throw loweringFailure("Division operands were not retained", operation.span);
  }
  const width = typeBytes(operation.type);
  if (width !== 1 && width !== 2)
    throw loweringFailure("Division needs a byte or word", operation.span);
  const signed = isSignedType(operation.type);
  const key = `${width}:${signed}`;
  let helper = state.divideHelpers.get(key);
  if (helper === undefined) {
    if (reuseResult) throw loweringFailure("A reused divide has no prior helper", operation.span);
    helper = createHelper(operation, width, signed, state);
    state.divideHelpers.set(key, helper);
  }
  const instructions: MachineInstruction[] = [];
  const stage = (value: LoweredValue, destination: LoweredValue) => {
    for (let offset = 0; offset < width; offset += 1) {
      appendLoadA(instructions, value, offset, state, operation.span);
      instructions.push(storeA(destination, offset, state, operation.span));
    }
  };
  if (!reuseResult) {
    if (left.kind === "register" && right.kind !== "register") {
      stage(left, helper.quotient);
      stage(right, helper.divisor);
    } else {
      stage(right, helper.divisor);
      stage(left, helper.quotient);
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
  }
  const selected = operation.operator === "/" ? helper.quotient : helper.remainder;
  if (width === 2) {
    appendLoadA(instructions, selected, 1, state, operation.span);
    instructions.push(
      machineInstruction(state.input.profile.cpu, "tax", "implied", null, [], operation.span),
    );
  }
  appendLoadA(instructions, selected, 0, state, operation.span);
  if (!reuseResult) {
    state.helperUses.push(
      Object.freeze({
        id: `divide:${bindingIdentityKey(state.owner)}:${operation.result}`,
        requestIds: helper.requestIds,
      }),
    );
  }
  return Object.freeze({
    instructions: Object.freeze(instructions),
    result: Object.freeze({
      kind: "register",
      registers: width === 1 ? "a" : "ax",
      bytes: width,
      signed,
    }),
  });
}
