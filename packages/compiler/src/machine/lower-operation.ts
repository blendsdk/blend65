import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { scalarWarning } from "../frontend/constants.js";
import type { SemanticOperation } from "../semantic/operations.js";
import type { InterruptRoute } from "../semantic/whole-program.js";
import { lowerConversion } from "./lower-conversion.js";
import { machineInstruction, type LoweredValue } from "./lower-control.js";
import { lowerMemoryRead, lowerMemoryWrite } from "./lower-memory.js";
import { advanceAggregateInductionAddress } from "./lower-induction.js";
import { lowerAggregatePlaceCopy } from "./lower-aggregate-copy.js";
import { lowerAggregate, lowerCapturedAggregatePlace } from "./lower-aggregate-build.js";
import type { MachineInstruction } from "./machine-types.js";
import {
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
import {
  lowerArithmetic,
  lowerBcdArithmetic,
  lowerBcdTwoReadWord,
  lowerBcdWordToConstantMemory,
} from "./lower-arithmetic.js";
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
} from "./lower-state.js";

import { lowerDirectCall } from "./lower-call.js";
import { lowerPlatformOperation } from "./lower-platform.js";

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

/** Select the direct machine form of one typed operation, preserving source order. */
export function lowerOperation(
  operation: SemanticOperation,
  state: FunctionLoweringState,
  selectedInterruptRoute?: InterruptRoute,
): readonly MachineInstruction[] {
  if (
    operation.kind === "call" ||
    operation.kind === "indirect-call" ||
    operation.kind === "memory-write" ||
    operation.kind === "platform" ||
    operation.kind === "cpu-control" ||
    operation.kind === "bcd" ||
    (operation.kind === "binary" && operation.operator !== "/" && operation.operator !== "%")
  ) {
    state.divisionReuse = null;
  } else if (operation.kind === "store" && state.divisionReuse !== null) {
    const written = bindingIdentityKey(operation.place.root);
    if (written === state.divisionReuse.left || written === state.divisionReuse.right) {
      state.divisionReuse = null;
    }
  }
  let advancesAggregateInduction = false;
  if (
    operation.kind === "call" ||
    operation.kind === "indirect-call" ||
    operation.kind === "memory-write"
  ) {
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
  if (operation.kind === "cpu-control") {
    const opcode = operation.control.slice(4);
    return Object.freeze([
      machineInstruction(state.input.profile.cpu, opcode, "implied", null, [], operation.span),
    ]);
  }
  if (operation.kind === "bcd") {
    const left = state.values.get(operation.left);
    const right = state.values.get(operation.right);
    if (left === undefined || right === undefined) {
      throw loweringFailure("BCD operand was not lowered", operation.span);
    }
    const directWrite = state.directBcdWrites.get(operation.result);
    if (directWrite !== undefined) {
      const address = state.values.get(directWrite.address);
      if (address?.kind !== "constant") {
        throw loweringFailure("Direct word BCD write has no fixed address", directWrite.span);
      }
      return lowerBcdWordToConstantMemory(
        operation,
        directWrite,
        left,
        right,
        address.value,
        state,
      );
    }
    const lowered = lowerBcdArithmetic(operation, left, right, state);
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
  if (operation.kind === "array-count") {
    const parameter = state.input.program.semantic.functions
      .find(({ id }) => bindingIdentityKey(id) === bindingIdentityKey(state.owner))
      ?.parameters.find(
        ({ id }) => bindingIdentityKey(id) === bindingIdentityKey(operation.parameter),
      );
    if (!parameter?.outerUnsized) {
      throw loweringFailure("Array count has no borrowed parameter home", operation.span);
    }
    state.values.set(
      operation.result,
      Object.freeze({
        kind: "storage",
        requestId: `${bindingIdentityKey(state.owner)}:parameter:${bindingIdentityKey(operation.parameter)}`,
        offset: 2,
        bytes: 2,
        signed: false,
      }),
    );
    return Object.freeze([]);
  }
  if (operation.kind === "load") {
    if (operation.place.path.length === 0) {
      state.loadOrigins.set(operation.result, bindingIdentityKey(operation.place.root));
    }
    const width = typeBytes(operation.type);
    let source: LoweredValue;
    let instructions: readonly MachineInstruction[] = Object.freeze([]);
    if (operation.place.path.length > 0) {
      const lowered = lowerAggregateLoad(operation, state);
      const retained = retainMachineValue(
        operation.result,
        lowered.result,
        lowered.instructions,
        operation.type,
        operation.span,
        state,
      );
      source = retained.value;
      instructions = retained.instructions;
    } else {
      source = loweredPlace(operation.place, width, isSignedType(operation.type), state);
    }
    const stage =
      operation.type.kind === "array" || operation.type.kind === "struct"
        ? null
        : loadedValueStage(operation, state);
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
    const aggregateSource = state.aggregatePlaces.get(operation.value);
    if (aggregateSource !== undefined) {
      return lowerAggregatePlaceCopy(operation, aggregateSource, state);
    }
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
      // An adjacent forwarded byte read already owns Z for its closed terminal
      // choice. Reuse only that proved flag; ordinary call results and stored
      // Boolean values still need the normal comparison machinery.
      const readOwnsZero =
        (operation.operator === "==" || operation.operator === "!=") &&
        left.kind === "register" &&
        left.registers === "a" &&
        left.bytes === 1 &&
        right.kind === "constant" &&
        right.bytes === 1 &&
        right.value === 0 &&
        state.forwardedRegisterValues.has(operation.left) &&
        state.branchConditions.has(operation.result) &&
        !state.materializedValues.has(operation.result);
      lowered = readOwnsZero
        ? Object.freeze({
            instructions: Object.freeze([]),
            result: Object.freeze({
              kind: "condition" as const,
              whenTrue: operation.operator === "==" ? ("beq" as const) : ("bne" as const),
              usesFlag: "z" as const,
            }),
          })
        : lowerComparison(operation, left, right, state);
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
        const leftOrigin = state.loadOrigins.get(operation.left);
        const rightOrigin = state.loadOrigins.get(operation.right);
        const helper = `${typeBytes(operation.type)}:${isSignedType(operation.type)}`;
        const reusable =
          leftOrigin !== undefined &&
          rightOrigin !== undefined &&
          state.divisionReuse?.left === leftOrigin &&
          state.divisionReuse.right === rightOrigin &&
          state.divisionReuse.helper === helper;
        lowered = lowerRuntimeDivision(operation, left, right, state, reusable);
        selectedHelper = reusable ? null : "division";
        state.divisionReuse =
          leftOrigin === undefined || rightOrigin === undefined
            ? null
            : Object.freeze({ left: leftOrigin, right: rightOrigin, helper });
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
    if (
      (operation.operator === "/" || operation.operator === "%") &&
      right.kind !== "constant" &&
      state.input.divisionZeroCheck !== true
    ) {
      const divisorName =
        operation.rightSpan === undefined
          ? "divisor"
          : state.input.sourceText?.(operation.rightSpan).trim() || "divisor";
      state.warnings.push(
        scalarWarning(
          "W10173",
          `Runtime divisor '${divisorName}' is not proven nonzero — zero has an unspecified valid-width result; guard it or use '--division-zero-check'`,
          operation.rightSpan ?? operation.span,
        ),
      );
    }
    return retained.instructions;
  }
  if (operation.kind === "memory-read") {
    if (
      state.wordAddLeftHighInY.has(operation.result) ||
      state.wordSubtractLeftHighInY.has(operation.result) ||
      state.wordSubtractRightLowStaged.has(operation.result)
    ) {
      const lowered = lowerBcdTwoReadWord(
        operation,
        state,
        state.wordAddLeftHighInY.has(operation.result)
          ? "add-first"
          : state.wordSubtractLeftHighInY.has(operation.result)
            ? "sub-first"
            : "sub-second",
      );
      state.values.set(operation.result, lowered.result);
      return lowered.instructions;
    }
    const instructions = lowerMemoryRead(operation, {
      cpu: state.input.profile.cpu,
      owner: state.owner,
      values: state.values,
      byteRegister: state.subtractRightInX.has(operation.result) ? "x" : "a",
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
        registers:
          operation.width === 1 ? (state.subtractRightInX.has(operation.result) ? "x" : "a") : "ax",
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
    if (state.directBcdWrites.get(operation.value) === operation) return Object.freeze([]);
    const value = state.values.get(operation.value);
    if (value?.kind === "register" && !state.forwardedRegisterValues.has(operation.value)) {
      throw loweringFailure("Raw-memory register value was not proved current", operation.span);
    }
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
  if (operation.kind === "platform")
    return lowerPlatformOperation(operation, state, selectedInterruptRoute);
  if (operation.kind === "call") return lowerDirectCall(operation, state);
  if (operation.kind === "embedded-address") {
    state.values.set(
      operation.result,
      Object.freeze({ kind: "label", label: `asset.${operation.asset}`, bytes: 2, signed: false }),
    );
    return Object.freeze([]);
  }
  if (operation.kind === "function-address") {
    state.values.set(
      operation.result,
      Object.freeze({
        kind: "symbol-address",
        label: bindingLabel("fn", operation.function),
        bytes: 2,
      }),
    );
    return Object.freeze([]);
  }
  if (operation.kind === "place-address") {
    if (operation.captureValue === true) {
      const captured = lowerCapturedAggregatePlace(operation, state);
      state.values.set(operation.result, captured.result);
      return captured.instructions;
    }
    if (operation.type.kind === "array" || operation.type.kind === "struct") {
      state.aggregatePlaces.set(operation.result, operation.place);
    }
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
