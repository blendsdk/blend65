import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { declaredStorage } from "../storage/selection.js";
import type { SemanticBlock, SemanticOperation } from "../semantic/operations.js";
import type { CpuFacts } from "../target/nmos6510.js";
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
  ensureStackX,
  isSignedType,
  loweredPlace,
  loadA,
  requestStorage,
  storeA,
  type FunctionLoweringState,
  typeBytes,
} from "./lower-state.js";

/** Recognize one official immediate byte operation without a memory effect. */
function immediateByte(
  instruction: MachineInstruction | undefined,
  opcode: "and" | "eor" | "ora",
): instruction is MachineInstruction & {
  readonly operand: { readonly kind: "immediate"; readonly value: number };
} {
  return (
    instruction?.opcode === opcode &&
    instruction.mode === "immediate" &&
    instruction.memory.length === 0 &&
    instruction.operand?.kind === "immediate" &&
    Number.isInteger(instruction.operand.value) &&
    instruction.operand.value >= 0 &&
    instruction.operand.value <= 0xff
  );
}

/**
 * Append a byte bitwise operation, composing only exact adjacent instruction tails.
 *
 * `(A ^ first) & mask ^ last` equals `(A & mask) ^ ((first & mask) ^ last)`.
 * Both forms finish with the same A/N/Z and leave every other register/flag alone.
 * ASL/ORA #1 also equals SEC/ROL: both keep the old bit seven in C and finish
 * with the same A/N/Z, leaving X/Y/V/D/I unchanged. These memory-free tails
 * cannot cross a read, store, call, flag observer or block edge. Keep source
 * ownership and use official selected-CPU instruction effects and costs.
 * @param instructions The current block's already-selected instruction prefix.
 * @param selected The current byte operation, with its original ordered effects.
 * @param cpu The exact selected CPU facts used to construct replacement opcodes.
 */
export function appendImmediateByteBitwise(
  instructions: MachineInstruction[],
  selected: readonly MachineInstruction[],
  cpu: CpuFacts,
): void {
  instructions.push(...selected);
  if (selected.length !== 1) return;
  const start = instructions.length - 3;
  const first = instructions[start];
  const mask = instructions[start + 1];
  const last = instructions[start + 2];
  if (
    immediateByte(last, "ora") &&
    last.operand.value === 1 &&
    mask?.opcode === "asl" &&
    mask.mode === "accumulator" &&
    mask.operand === null &&
    mask.memory.length === 0
  ) {
    instructions.splice(
      start + 1,
      2,
      machineInstruction(cpu, "sec", "implied", null, [], mask.source),
      machineInstruction(cpu, "rol", "accumulator", null, [], last.source),
    );
    return;
  }
  if (!immediateByte(first, "eor") || !immediateByte(mask, "and") || !immediateByte(last, "eor"))
    return;
  instructions.splice(
    start,
    3,
    mask,
    Object.freeze({
      ...last,
      operand: Object.freeze({
        kind: "immediate" as const,
        value: (first.operand.value & mask.operand.value) ^ last.operand.value,
      }),
    }),
  );
}

/**
 * Keep a sole adjacent byte sum/difference in A for a commutative bitwise use.
 * Only a stable private byte or constant may be the other operand. One direct
 * private load can intervene when its already-planned lowering emits nothing;
 * a staging home, selected address, call or other operation closes the window.
 * This tests the actual lowered operand, not equality of source variable names.
 * The owning loop supplies its index, avoiding another scan of the block prefix.
 */
export function canForwardByteArithmetic(
  operation: Extract<SemanticOperation, { readonly kind: "binary" }>,
  block: SemanticBlock | undefined,
  state: FunctionLoweringState,
  operationIndex: number | undefined,
): boolean {
  if (
    !["+", "-"].includes(operation.operator) ||
    typeBytes(operation.type) !== 1 ||
    !state.singleUseValues.has(operation.result) ||
    state.values.get(operation.right)?.kind !== "constant" ||
    block === undefined ||
    operationIndex === undefined ||
    block.operations[operationIndex] !== operation
  )
    return false;
  let index = operationIndex + 1;
  /** Literal identities emit no instruction and cannot overwrite live A. */
  const next = (): SemanticOperation | undefined => {
    while (block.operations[index]?.kind === "constant") index += 1;
    return block.operations[index];
  };
  let consumer = next();
  let privateLoad: { readonly result: string; readonly value: LoweredValue } | undefined;
  if (consumer?.kind === "load" && consumer.place.path.length === 0) {
    const stage = `${bindingIdentityKey(state.owner)}:argument-stage:${consumer.result}`;
    const value = loweredPlace(consumer.place, typeBytes(consumer.type), false, state);
    if (
      value.kind !== "storage" ||
      value.bytes !== 1 ||
      declaredStorage(state.input, (id) => id === stage) !== undefined
    )
      return false;
    privateLoad = { result: consumer.result, value };
    index += 1;
    consumer = next();
  }
  if (
    consumer?.kind !== "binary" ||
    !["&", "|", "^"].includes(consumer.operator) ||
    typeBytes(consumer.type) !== 1
  )
    return false;
  const other =
    consumer.left === operation.result
      ? consumer.right
      : consumer.right === operation.result
        ? consumer.left
        : null;
  const value = other === privateLoad?.result ? privateLoad.value : state.values.get(other ?? "");
  return (
    value !== undefined &&
    (value.kind === "storage" || value.kind === "constant") &&
    value.bytes === 1
  );
}

/**
 * Append scalar code, omitting an exact arithmetic/comparison private reload.
 * The immediately preceding store contains A, and its adjacent LDA/AND/ORA/EOR
 * establishes N/Z from that same A. Thus removing the identical private LDA
 * preserves values and all flags. Comparisons additionally require the caller's
 * bounded source/domain observer proof; without it their private reload remains.
 * Raw addresses, labels, memory effects, byte
 * address transforms and other producers remain unchanged, including decimal
 * arithmetic whose NMOS N/Z need not describe its result.
 */
export function appendScalarPrefix(
  instructions: MachineInstruction[],
  selected: readonly MachineInstruction[],
  operation: SemanticOperation,
  comparisonCaptureUnobserved = false,
): void {
  const load = selected[0];
  const store = instructions.at(-1);
  const producer = instructions.at(-2);
  const arithmeticPrefix =
    operation.kind === "binary" &&
    ["+", "-"].includes(operation.operator) &&
    typeBytes(operation.type) === 1 &&
    selected.length >= 3 &&
    selected[1]?.opcode === (operation.operator === "-" ? "sec" : "clc") &&
    selected[2]?.opcode === (operation.operator === "-" ? "sbc" : "adc");
  const comparisonPrefix =
    comparisonCaptureUnobserved &&
    operation.kind === "binary" &&
    ["==", "!=", "<", "<=", ">", ">="].includes(operation.operator);
  const samePrivateByte =
    (arithmeticPrefix || comparisonPrefix) &&
    load?.opcode === "lda" &&
    store?.opcode === "sta" &&
    load.mode === "storage" &&
    store.mode === "storage" &&
    load.memory.length === 0 &&
    store.memory.length === 0 &&
    load.operand?.kind === "storage" &&
    store.operand?.kind === "storage" &&
    load.operand.addressByte === undefined &&
    store.operand.addressByte === undefined &&
    load.operand.requestId === store.operand.requestId &&
    (load.operand.offset ?? 0) === (store.operand.offset ?? 0) &&
    producer !== undefined &&
    ["lda", "and", "ora", "eor"].includes(producer.opcode) &&
    producer.defines.registers.includes("a") &&
    producer.defines.flags.includes("n") &&
    producer.defines.flags.includes("z");
  instructions.push(...(samePrivateByte ? selected.slice(1) : selected));
}

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
  const widthMask = width === 1 ? 0xff : 0xffff;
  // A zero mask clears every bit regardless of the other operand. Evaluation is
  // already complete, so the volatile read or call still happened exactly once.
  if (
    opcode === "and" &&
    ((left.kind === "constant" && left.value === 0) ||
      (right.kind === "constant" && right.value === 0))
  ) {
    return Object.freeze({
      instructions: Object.freeze([]),
      result: Object.freeze({
        kind: "constant" as const,
        value: 0,
        bytes: width,
        signed: isSignedType(operation.type),
      }),
    });
  }
  // Two compile-time operands need no runtime instruction. This also lets a
  // single-use constant local fold through its bit test.
  if (left.kind === "constant" && right.kind === "constant") {
    const leftBits = left.value & widthMask;
    const rightBits = right.value & widthMask;
    const value =
      opcode === "and"
        ? leftBits & rightBits
        : opcode === "ora"
          ? leftBits | rightBits
          : leftBits ^ rightBits;
    return Object.freeze({
      instructions: Object.freeze([]),
      result: Object.freeze({
        kind: "constant" as const,
        value,
        bytes: width,
        signed: isSignedType(operation.type),
      }),
    });
  }
  // Evaluation is already complete. A sole adjacent arithmetic result can be
  // the source-right value in A; commute only its stable private/constant peer.
  // A directly addressable placed byte is equally stable: it is a label, not a
  // register or a live temporary.
  if (
    width === 1 &&
    right.kind === "register" &&
    right.registers === "a" &&
    (left.kind === "storage" ||
      left.kind === "constant" ||
      left.kind === "label" ||
      left.kind === "static-address")
  )
    [left, right] = [right, left];
  // A byte retained on the handler's own stack is a direct ALU operand. The
  // other operand is made current in A first (a register value emits nothing),
  // then one stack-pointer read makes the slot addressable. The volatile read
  // which produced the other operand already happened once at its source point.
  if (width === 1 && (left.kind === "stack" || right.kind === "stack")) {
    const stackOperand = left.kind === "stack" ? left : right;
    if (stackOperand.kind === "stack") {
      const other = left.kind === "stack" ? right : left;
      const instructions: MachineInstruction[] = [];
      appendLoadA(instructions, other, 0, state, operation.span);
      ensureStackX(instructions, state, operation.span);
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          opcode,
          "absolute-x",
          Object.freeze({
            kind: "absolute" as const,
            value: 0x0100 + state.stackDepth - stackOperand.slot + 1,
          }),
          [],
          operation.span,
        ),
      );
      return Object.freeze({
        instructions: Object.freeze(instructions),
        result: Object.freeze({
          kind: "register" as const,
          registers: "a" as const,
          bytes: 1 as const,
          signed: isSignedType(operation.type),
        }),
      });
    }
  }
  // A byte-sized AND mask proves the word's high byte is zero. Keep the
  // source word width, but do not compute or store that already-known byte.
  const byteMask = (value: LoweredValue): boolean =>
    value.kind === "constant" && value.value >= 0 && value.value <= 0xff;
  const zeroHigh = width === 2 && opcode === "and" && (byteMask(left) || byteMask(right));
  if (zeroHigh && byteMask(left) && !byteMask(right)) [left, right] = [right, left];
  // A mask confined to the high byte needs no low-byte load or join; the high
  // byte's masked value is the whole word value.
  const wordMaskTest = state.booleanMaskTests.get(operation.result);
  const constantSide = left.kind === "constant" ? left : right.kind === "constant" ? right : null;
  if (
    wordMaskTest?.form === "word-high" &&
    opcode === "and" &&
    width === 2 &&
    constantSide !== null
  ) {
    const operand = left.kind === "constant" ? right : left;
    const instructions: MachineInstruction[] = [];
    appendLoadA(instructions, operand, 1, state, operation.span);
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "and",
        "immediate",
        Object.freeze({ kind: "immediate", value: wordMaskTest.highMask ?? 0 }),
        [],
        operation.span,
      ),
    );
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: Object.freeze({
        kind: "register" as const,
        registers: "a" as const,
        bytes: 1 as const,
        signed: false,
      }),
    });
  }
  if (
    wordMaskTest?.form === "word-align" &&
    opcode === "and" &&
    width === 2 &&
    constantSide !== null
  ) {
    const mask = constantSide.value;
    const bitPosition = (value: number): number => {
      let position = 0;
      while ((value & (1 << position)) === 0) position += 1;
      return position;
    };
    const lowPosition = bitPosition(mask & 0xff);
    const highPosition = bitPosition((mask >> 8) & 0xff);
    const firstOffset = lowPosition >= highPosition ? 0 : 1;
    const otherOffset = firstOffset === 0 ? 1 : 0;
    const shift = Math.abs(lowPosition - highPosition);
    const operand = left.kind === "constant" ? right : left;
    const instructions: MachineInstruction[] = [];
    appendLoadA(instructions, operand, firstOffset, state, operation.span);
    for (let step = 0; step < shift; step += 1)
      instructions.push(
        machineInstruction(state.input.profile.cpu, "lsr", "accumulator", null, [], operation.span),
      );
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: Object.freeze({
        kind: "word-aligned" as const,
        first: operand,
        firstOffset,
        shift,
        other: operand,
        otherOffset,
        combine: wordMaskTest.constant === 0 ? ("ora" as const) : ("and" as const),
        normalize: Math.min(lowPosition, highPosition),
        bytes: 2 as const,
        signed: isSignedType(operation.type),
      }),
    });
  }
  // A selected wide word mask keeps only the low masked byte in A. The join
  // lowers the high masked byte at the comparison, so no two-byte temporary is
  // requested and the operand's high byte must stay reloadable.
  if (wordMaskTest?.form === "word" && opcode === "and" && width === 2 && constantSide !== null) {
    const mask = constantSide.value;
    const operand = left.kind === "constant" ? right : left;
    const lowMask = mask & 0xff;
    const instructions: MachineInstruction[] = [];
    appendLoadA(instructions, operand, 0, state, operation.span);
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "and",
        "immediate",
        Object.freeze({ kind: "immediate", value: lowMask }),
        [],
        operation.span,
      ),
    );
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: Object.freeze({
        kind: "masked-word" as const,
        operand,
        highMask: wordMaskTest.highMask ?? (mask >> 8) & 0xff,
        lowMask,
        bytes: 2 as const,
        signed: isSignedType(operation.type),
      }),
    });
  }
  const request =
    width === 1 || zeroHigh
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
  const result: LoweredValue = zeroHigh
    ? Object.freeze({
        kind: "zero-extended",
        low: Object.freeze({ kind: "register", registers: "a", bytes: 1, signed: false }),
        bytes: 2,
        signed: isSignedType(operation.type),
      })
    : request === null
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
  const adjacentRead =
    width === 1 && state.adjacentByteRead?.value === operation.right
      ? state.adjacentByteRead.instruction
      : null;
  for (let offset = 0; offset < (zeroHigh ? 1 : width); offset += 1) {
    appendLoadA(instructions, left, offset, state, operation.span);
    // The exact address consumer uses only A; an all-ones mask changes nothing.
    // Do not extend flag ownership to other live-register consumers.
    const ordinalIdentity =
      zeroHigh &&
      right.kind === "constant" &&
      right.value === 0xff &&
      state.forwardedRegisterValues.has(operation.result) &&
      state.addressValues.has(operation.result);
    const allOnesMask =
      opcode === "and" &&
      adjacentRead === null &&
      right.kind === "constant" &&
      ((right.value >> (offset * 8)) & 0xff) === 0xff;
    if (!ordinalIdentity && !allOnesMask)
      instructions.push(
        Object.freeze({
          ...machineInstruction(
            state.input.profile.cpu,
            opcode,
            adjacentRead?.mode ?? modeForValue(right, offset),
            adjacentRead?.operand ?? operandForValue(right, offset),
            adjacentRead?.memory ?? [],
            adjacentRead?.source ?? operation.span,
          ),
          ...(adjacentRead?.observerOrigins === undefined
            ? {}
            : { observerOrigins: adjacentRead.observerOrigins }),
        }),
      );
    if (result.kind === "storage") instructions.push(storeA(result, offset, state, operation.span));
  }
  if (adjacentRead !== null) delete state.adjacentByteRead;
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
  if (width === 1 && (factor === 3 || factor === 5 || factor === 7 || factor === 10)) {
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
    for (let shift = 0; shift < (factor === 3 ? 1 : factor === 7 ? 3 : 2); shift += 1) {
      instructions.push(
        machineInstruction(state.input.profile.cpu, "asl", "accumulator", null, [], operation.span),
      );
    }
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        factor === 7 ? "sec" : "clc",
        "implied",
        null,
        [],
        operation.span,
      ),
      machineInstruction(
        state.input.profile.cpu,
        factor === 7 ? "sbc" : "adc",
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
