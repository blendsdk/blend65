import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { scalarWarning } from "../frontend/constants.js";
import type { SemanticOperation } from "../semantic/operations.js";
import { lowerC64Operation } from "./lower-c64.js";
import { lowerConversion } from "./lower-conversion.js";
import { machineInstruction, type LoweredValue } from "./lower-control.js";
import { lowerMemoryRead, lowerMemoryWrite } from "./lower-memory.js";
import { advanceAggregateInductionAddress } from "./lower-induction.js";
import type { MachineInstruction } from "./machine-types.js";
import {
  lowerAggregate,
  lowerAggregateAddress,
  lowerAggregateLoad,
  lowerAggregateStore,
} from "./lower-aggregate.js";
import {
  lowerBitwise,
  lowerComparison,
  lowerConstantMultiply,
  lowerFixedShift,
} from "./lower-scalar.js";
import { lowerArithmetic } from "./lower-arithmetic.js";
import { lowerUnary } from "./lower-unary.js";
import { lowerRuntimeMultiply } from "./lower-multiply.js";
import { lowerRuntimeDivision } from "./lower-division.js";
import {
  loweringFailure,
  appendLoadA,
  bindingLabel,
  isSignedType,
  loweredPlace,
  requestStorage,
  retainMachineValue,
  storeA,
  type FunctionLoweringState,
  typeBytes,
} from "./lower.js";

/** Return the preplanned home used to preserve one loaded scalar, when required. */
function loadedValueStage(
  operation: Extract<SemanticOperation, { readonly kind: "load" }>,
  state: FunctionLoweringState,
): LoweredValue | null {
  const requestId = `${bindingIdentityKey(state.owner)}:argument-stage:${operation.result}`;
  if (!state.input.placement.homes.some((home) => home.requestId === requestId)) return null;
  return Object.freeze({
    kind: "storage",
    requestId,
    bytes: typeBytes(operation.type),
    signed: isSignedType(operation.type),
  });
}

/** Copy an aggregate argument's address into its two-byte by-reference parameter home. */
function marshalAggregateAddress(
  instructions: MachineInstruction[],
  argument: LoweredValue,
  destination: LoweredValue,
  state: FunctionLoweringState,
  operation: Extract<SemanticOperation, { readonly kind: "call" }>,
): void {
  if (argument.kind === "storage" && argument.requestId.includes(":parameter:")) {
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

/**
 * Convert one retained zero-flag condition into the language's canonical boolean byte.
 * Direct branches keep using the flag. A value that is stored or passed must instead become
 * `0` or `1` without adding a helper call or control-flow block.
 */
function materializeCondition(
  result: LoweredValue,
  instructionsInput: readonly MachineInstruction[],
  operation: Extract<SemanticOperation, { readonly kind: "platform" }>,
  state: FunctionLoweringState,
): { readonly instructions: readonly MachineInstruction[]; readonly result: LoweredValue } {
  if (
    result.kind !== "condition" ||
    operation.result === null ||
    !state.materializedValues.has(operation.result)
  ) {
    return Object.freeze({ instructions: instructionsInput, result });
  }
  if (result.usesFlag !== "z" || (result.whenTrue !== "beq" && result.whenTrue !== "bne")) {
    throw loweringFailure("Platform condition cannot be materialized as a boolean", operation.span);
  }

  const instructions = [
    ...instructionsInput,
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
  ];
  if (result.whenTrue === "beq") {
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

export function lowerOperation(
  operation: SemanticOperation,
  state: FunctionLoweringState,
): readonly MachineInstruction[] {
  let advancesAggregateInduction = false;
  if (operation.kind === "call" || operation.kind === "memory-write") {
    state.aggregateAddressCache = null;
  } else if (operation.kind === "store" && state.aggregateAddressCache !== null) {
    const storedRoot = loweredPlace(
      operation.place,
      typeBytes(operation.place.rootType ?? operation.type),
      isSignedType(operation.type),
      state,
    );
    const changesCachedIndex =
      storedRoot.kind === "storage" &&
      state.aggregateAddressCache.indexRequestIds.includes(storedRoot.requestId);
    if (changesCachedIndex) {
      const induction = state.aggregateInduction;
      advancesAggregateInduction =
        induction !== null &&
        operation.span.start === induction.updateSourceStart &&
        storedRoot.kind === "storage" &&
        storedRoot.requestId === induction.indexRequestId &&
        state.aggregateAddressCache.key === induction.cache.key;
      if (!advancesAggregateInduction) state.aggregateAddressCache = null;
    }
  }
  if (operation.kind === "constant") {
    const width = typeBytes(operation.type) === 1 ? 1 : 2;
    const value =
      typeof operation.value === "boolean" ? Number(operation.value) : Number(operation.value);
    state.values.set(
      operation.result,
      Object.freeze({
        kind: "constant",
        value,
        bytes: width,
        signed: isSignedType(operation.type),
      }),
    );
    return Object.freeze([]);
  }
  if (operation.kind === "load") {
    const width = typeBytes(operation.type);
    let source: LoweredValue;
    let instructions: readonly MachineInstruction[] = Object.freeze([]);
    if (operation.place.path.length > 0) {
      const lowered = lowerAggregateLoad(operation, state);
      source = lowered.result;
      instructions = lowered.instructions;
    } else {
      source = loweredPlace(operation.place, width, isSignedType(operation.type), state);
    }
    const stage =
      operation.type.kind === "scalar" || operation.type.kind === "enum"
        ? loadedValueStage(operation, state)
        : null;
    if (stage === null) {
      state.values.set(operation.result, source);
      return instructions;
    }
    const staged = [...instructions];
    for (let offset = 0; offset < width; offset += 1) {
      appendLoadA(staged, source, offset, state, operation.span);
      staged.push(storeA(stage, offset, state, operation.span));
    }
    state.values.set(operation.result, stage);
    return Object.freeze(staged);
  }
  if (operation.kind === "store") {
    const value = state.values.get(operation.value);
    if (value === undefined) throw loweringFailure("Stored value was not lowered", operation.span);
    if (operation.place.path.length > 0) {
      return lowerAggregateStore(operation, value, state);
    }
    const place = loweredPlace(
      operation.place,
      typeBytes(operation.type),
      isSignedType(operation.type),
      state,
    );
    const instructions: MachineInstruction[] = [];
    for (let offset = 0; offset < typeBytes(operation.type); offset += 1) {
      appendLoadA(instructions, value, offset, state, operation.span);
      instructions.push(storeA(place, offset, state, operation.span));
    }
    if (advancesAggregateInduction && state.aggregateInduction !== null) {
      instructions.push(
        ...advanceAggregateInductionAddress(state.aggregateInduction, state, operation.span),
      );
    }
    return Object.freeze(instructions);
  }
  if (operation.kind === "convert") return lowerConversion(operation, state);
  if (operation.kind === "unary") {
    const lowered = lowerUnary(operation, state);
    const retained = retainMachineValue(
      operation.result,
      lowered.result,
      lowered.instructions,
      operation.type,
      operation.span,
      state,
    );
    state.values.set(operation.result, retained.value);
    return retained.instructions;
  }
  if (operation.kind === "aggregate") {
    const lowered = lowerAggregate(operation, state);
    const retained = retainMachineValue(
      operation.result,
      lowered.result,
      lowered.instructions,
      operation.type,
      operation.span,
      state,
    );
    state.values.set(operation.result, retained.value);
    return retained.instructions;
  }
  if (operation.kind === "merge") {
    const bytes = typeBytes(operation.type);
    const request = requestStorage(
      state,
      `merge:${operation.result}`,
      "temporary",
      bytes,
      "ram",
      operation.span,
      "Value selected by mutually exclusive predecessors",
      operation.type,
    );
    const destination: LoweredValue = Object.freeze({
      kind: "storage",
      requestId: request.id,
      bytes,
      signed: isSignedType(operation.type),
    });
    state.values.set(operation.result, destination);
    for (const incoming of operation.incoming) {
      state.mergeCopies.push({
        predecessor: incoming.block,
        incoming: incoming.value,
        destination,
        bytes,
        source: operation.span,
      });
    }
    return Object.freeze([]);
  }
  if (operation.kind === "binary") {
    const left = state.values.get(operation.left);
    const right = state.values.get(operation.right);
    if (left === undefined || right === undefined) {
      throw loweringFailure("Binary operand was not lowered", operation.span);
    }
    const comparison = ["<", "<=", ">", ">=", "==", "!="].includes(operation.operator);
    let lowered: {
      readonly instructions: readonly MachineInstruction[];
      readonly result: LoweredValue;
    };
    let selectedHelper: "multiply" | "division" | null = null;
    let selectedConstantMultiply: number | null = null;
    if (comparison) {
      lowered = lowerComparison(operation, left, right, state);
    } else if (operation.operator === "+" || operation.operator === "-") {
      lowered = lowerArithmetic(operation, left, right, state);
    } else if (["&", "|", "^"].includes(operation.operator)) {
      lowered = lowerBitwise(operation, left, right, state);
    } else if (operation.operator === "<<" || operation.operator === ">>") {
      if (right.kind !== "constant") {
        throw loweringFailure(
          "This lowering slice requires a constant shift count",
          operation.span,
        );
      }
      lowered = lowerFixedShift(
        operation,
        left,
        right.value,
        operation.operator === "<<" ? "left" : "right",
        state,
      );
    } else if (operation.operator === "*") {
      if (right.kind === "constant") {
        lowered = lowerConstantMultiply(operation, left, right.value, state);
        selectedConstantMultiply = right.value;
      } else if (left.kind === "constant") {
        lowered = lowerConstantMultiply(operation, right, left.value, state);
        selectedConstantMultiply = left.value;
      } else {
        lowered = lowerRuntimeMultiply(operation, left, right, state);
        selectedHelper = "multiply";
      }
    } else if (operation.operator === "/" || operation.operator === "%") {
      const divisor = right.kind === "constant" ? right.value : null;
      if (
        !isSignedType(operation.type) &&
        divisor !== null &&
        divisor > 0 &&
        Number.isInteger(divisor) &&
        (divisor & (divisor - 1)) === 0
      ) {
        lowered =
          operation.operator === "/"
            ? lowerFixedShift(operation, left, Math.log2(divisor), "right", state)
            : lowerBitwise(
                { ...operation, operator: "&" },
                left,
                Object.freeze({
                  kind: "constant",
                  value: divisor - 1,
                  bytes: typeBytes(operation.type),
                  signed: false,
                }),
                state,
              );
      } else {
        lowered = lowerRuntimeDivision(operation, left, right, state);
        selectedHelper = "division";
      }
    } else {
      throw loweringFailure(
        `Binary operator '${operation.operator}' is not admitted by this lowering slice`,
        operation.span,
      );
    }
    const retained = retainMachineValue(
      operation.result,
      lowered.result,
      lowered.instructions,
      operation.type,
      operation.span,
      state,
    );
    state.values.set(operation.result, retained.value);
    const callSiteCycles = retained.instructions.reduce(
      (cycles, instruction) => cycles + instruction.cost.maxCycles,
      0,
    );
    const width = typeBytes(operation.type) * 8;
    if (selectedHelper === "multiply") {
      // The bounded shift/add loop runs once per result bit; about half the bits take its add path.
      const helperCycles = width === 8 ? 150 : 630;
      state.warnings.push(
        scalarWarning(
          "W10170",
          `Runtime multiply uses a software sequence of about ${helperCycles + callSiteCycles} cycles for ${width}-bit operands`,
          operation.span,
        ),
      );
    } else if (selectedHelper === "division") {
      // The restoring loop runs once per bit, including its compare and usual subtract path.
      const helperCycles =
        (width === 8 ? 310 : 910) + (isSignedType(operation.type) ? (width === 8 ? 70 : 100) : 0);
      state.warnings.push(
        scalarWarning(
          "W10171",
          `Runtime division or remainder uses a software sequence of about ${helperCycles + callSiteCycles} cycles for ${width}-bit operands`,
          operation.span,
        ),
      );
      if (right.kind !== "constant" && state.input.divisionZeroCheck !== true) {
        const divisorName =
          operation.rightSpan === undefined
            ? "divisor"
            : state.input.sourceText?.(operation.rightSpan).trim() || "divisor";
        state.warnings.push(
          scalarWarning(
            "W10173",
            `Runtime divisor '${divisorName}' is not proven nonzero — zero has an unspecified valid-width result; guard it or use '--division-zero-check'`,
            operation.span,
          ),
        );
      }
    } else if (selectedConstantMultiply !== null) {
      const hasShift = lowered.instructions.some(
        ({ opcode }) => opcode === "asl" || opcode === "rol",
      );
      const hasAdd = lowered.instructions.some(
        ({ opcode }) => opcode === "adc" || opcode === "sbc",
      );
      if (hasShift && hasAdd) {
        state.warnings.push(
          scalarWarning(
            "W10172",
            `Multiply by ${selectedConstantMultiply} uses a shift-and-add sequence of about ${callSiteCycles} cycles — consider a power-of-two stride when practical`,
            operation.span,
          ),
        );
      }
    }
    return retained.instructions;
  }
  if (operation.kind === "memory-read") {
    const instructions = lowerMemoryRead(operation, {
      cpu: state.input.profile.cpu,
      owner: state.owner,
      values: state.values,
      pointerRequest: (source) =>
        requestStorage(
          state,
          "dynamic-memory-pointer",
          "pointer",
          2,
          "zero-page-required",
          source.span,
          "Page-safe indirect address pair",
        ),
      lowByteRequest: (source) => {
        const requestId = `${bindingIdentityKey(state.owner)}:temporary:word-read-low:${source.result}`;
        if (!state.input.placement.homes.some((home) => home.requestId === requestId)) {
          throw loweringFailure("Word raw-memory read has no certified low-byte home", source.span);
        }
        return requestId;
      },
    });
    const retained = retainMachineValue(
      operation.result,
      Object.freeze({
        kind: "register",
        registers: operation.width === 1 ? "a" : "ax",
        bytes: operation.width,
        signed: operation.integer?.signed ?? false,
      }),
      instructions,
      operation.type,
      operation.span,
      state,
    );
    state.values.set(operation.result, retained.value);
    return retained.instructions;
  }
  if (operation.kind === "memory-write") {
    return lowerMemoryWrite(operation, {
      cpu: state.input.profile.cpu,
      owner: state.owner,
      values: state.values,
      pointerRequest: (source) =>
        requestStorage(
          state,
          "dynamic-memory-pointer",
          "pointer",
          2,
          "zero-page-required",
          source.span,
          "Page-safe indirect address pair",
        ),
    });
  }
  if (operation.kind === "platform") {
    try {
      const lowered = lowerC64Operation(operation, state.values, state.input.profile, {
        requestScratch: (suffix, bytes, source, reason) =>
          requestStorage(state, suffix, "temporary", bytes, "ram", source, reason),
      });
      for (const data of lowered.data) {
        const existing = state.generatedData.get(data.id);
        if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(data)) {
          throw new Error(`Generated data identity '${data.id}' changed contents`);
        }
        state.generatedData.set(data.id, data);
      }
      if (operation.result !== null && lowered.result !== null) {
        const materialized = materializeCondition(
          lowered.result,
          lowered.instructions,
          operation,
          state,
        );
        const retained = retainMachineValue(
          operation.result,
          materialized.result,
          materialized.instructions,
          operation.type,
          operation.span,
          state,
        );
        state.values.set(operation.result, retained.value);
        return retained.instructions;
      }
      return lowered.instructions;
    } catch (error) {
      throw loweringFailure(
        error instanceof Error ? error.message : "Cannot lower platform operation",
        operation.span,
      );
    }
  }
  if (operation.kind === "call") {
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
        parameter.type.kind === "scalar" || parameter.type.kind === "enum"
          ? typeBytes(parameter.type)
          : 2,
        isSignedType(parameter.type),
        state,
      );
      if (destination.kind !== "storage") {
        throw loweringFailure("Callee parameter has no certified static home", operation.span);
      }
      if (parameter.type.kind !== "scalar" && parameter.type.kind !== "enum") {
        marshalAggregateAddress(instructions, argument, destination, state, operation);
      } else {
        for (let offset = 0; offset < typeBytes(parameter.type); offset += 1) {
          appendLoadA(instructions, argument, offset, state, operation.span);
          instructions.push(storeA(destination, offset, state, operation.span));
        }
      }
    }
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
  if (operation.kind === "embedded-address") {
    state.values.set(
      operation.result,
      Object.freeze({ kind: "label", label: `asset.${operation.asset}`, bytes: 2, signed: false }),
    );
    return Object.freeze([]);
  }
  if (operation.kind === "place-address") {
    if (operation.place.rootType === undefined) {
      state.values.set(
        operation.result,
        Object.freeze({
          kind: "label",
          label: bindingLabel("global", operation.place.root),
          bytes: 2,
          signed: false,
        }),
      );
      return Object.freeze([]);
    }
    const address = lowerAggregateAddress(operation.place, state, operation.span, operation.result);
    state.values.set(operation.result, address.pointer);
    return address.instructions;
  }
  throw loweringFailure("Semantic operation needs a storage form not admitted by this phase", null);
}
