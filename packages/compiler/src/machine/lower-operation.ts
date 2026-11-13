import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { scalarWarning } from "../frontend/constants.js";
import type { SemanticBlock, SemanticOperation } from "../semantic/operations.js";
import type { InterruptRoute } from "../semantic/whole-program.js";
import { nmiLocalElisionKey } from "../semantic/nmi-register-locals.js";
import { lowerConversion } from "./lower-conversion.js";
import { machineInstruction, type LoweredValue } from "./lower-control.js";
import { lowerMemoryRead, lowerMemoryWrite } from "./lower-memory.js";
import { advanceAggregateInductionAddress } from "./lower-induction.js";
import { lowerAggregatePlaceCopy } from "./lower-aggregate-copy.js";
import { lowerAggregate, lowerCapturedAggregatePlace } from "./lower-aggregate-build.js";
import { fixedAggregateSource } from "./lower-aggregate-place.js";
import type { MachineInstruction } from "./machine-types.js";
import {
  lowerAggregateAddress,
  lowerAggregateLoad,
  lowerAggregateStore,
} from "./lower-aggregate.js";
import {
  canForwardByteArithmetic,
  lowerBitwise,
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
import { lowerComparison } from "./lower-comparison.js";
import { lowerRuntimeMultiply } from "./lower-multiply.js";
import { lowerRuntimeDivision } from "./lower-division.js";
import {
  loweringFailure,
  appendLoadA,
  bindingLabel,
  isSignedType,
  isReturnedLocalPlace,
  loweredPlace,
  requestStorage,
  retainMachineValue,
  storeA,
  type FunctionLoweringState,
  typeBytes,
} from "./lower-state.js";

import { potentialValueInputs } from "../semantic/value-lifetimes.js";
import { lowerDirectCall } from "./lower-call.js";
import { lowerPlatformOperation } from "./lower-platform.js";
import { lowerLoadUnit } from "./lower-load-unit.js";
import { declaredStorage } from "../storage/selection.js";

/** Return the preplanned home used to preserve one loaded scalar, when required. */
function loadedValueStage(
  operation: Extract<SemanticOperation, { readonly kind: "load" }>,
  state: FunctionLoweringState,
): LoweredValue | null {
  const requestId = `${bindingIdentityKey(state.owner)}:argument-stage:${operation.result}`;
  if (declaredStorage(state.input, (id) => id === requestId) === undefined) return null;
  return Object.freeze({
    kind: "storage",
    requestId,
    bytes: typeBytes(operation.type),
    signed: isSignedType(operation.type),
  });
}

/**
 * Select one typed operation, preserving source order. The owning block, when
 * supplied by the function selector, proves immediate branch consumption. Its
 * byte-return-arm proof permits a disposable index only at that terminal consumer.
 * Its loop index proves bounded arithmetic adjacency without rescanning the block.
 */
export function lowerOperation(
  operation: SemanticOperation,
  state: FunctionLoweringState,
  selectedInterruptRoute?: InterruptRoute,
  block?: SemanticBlock,
  byteReturnArms = false,
  operationIndex?: number,
): readonly MachineInstruction[] {
  if (
    operation.kind === "call" ||
    operation.kind === "indirect-call" ||
    operation.kind === "memory-write" ||
    operation.kind === "platform" ||
    operation.kind === "load-unit" ||
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
      if (
        state.elidedLocalBindings.has(
          nmiLocalElisionKey(
            state.interruptDepth.domain,
            state.interruptDepth.activationRoot,
            bindingIdentityKey(operation.place.root),
          ),
        )
      ) {
        // The inventory omitted this local's home. A constant initializer is
        // resolved from the single preceding store; a direct read is still in A
        // and the single consumer can use it directly.
        const initializer =
          block === undefined || operationIndex === undefined
            ? undefined
            : block.operations
                .slice(0, operationIndex)
                .reverse()
                .find(
                  (candidate): candidate is Extract<SemanticOperation, { kind: "store" }> =>
                    candidate.kind === "store" &&
                    candidate.place.path.length === 0 &&
                    bindingIdentityKey(candidate.place.root) ===
                      bindingIdentityKey(operation.place.root),
                );
        const stored = initializer === undefined ? undefined : state.values.get(initializer.value);
        if (stored?.kind === "constant") {
          state.values.set(operation.result, stored);
          return Object.freeze([]);
        }
        state.values.set(
          operation.result,
          Object.freeze({ kind: "register", registers: "a", bytes: 1, signed: false }),
        );
        state.forwardedRegisterValues.add(operation.result);
        state.zeroFlagValues.add(operation.result);
        return Object.freeze([]);
      }
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
    if (
      aggregateSource !== undefined &&
      aggregateSource.path.length === 0 &&
      operation.place.path.length === 0 &&
      isReturnedLocalPlace(operation.place, state) &&
      bindingIdentityKey(aggregateSource.root) === bindingIdentityKey(operation.place.root)
    )
      return Object.freeze([]);
    if (aggregateSource !== undefined) {
      return lowerAggregatePlaceCopy(operation, aggregateSource, state);
    }
    if (
      operation.place.path.length === 0 &&
      state.elidedLocalBindings.has(
        nmiLocalElisionKey(
          state.interruptDepth.domain,
          state.interruptDepth.activationRoot,
          bindingIdentityKey(operation.place.root),
        ),
      )
    ) {
      // The only store of this NMI local is its initializer. A constant needs
      // no runtime value; a direct read is already in A. The home was omitted
      // before allocation, so the store emits nothing.
      if (
        value.kind !== "constant" &&
        (value.kind !== "register" || value.registers !== "a" || value.bytes !== 1)
      )
        throw loweringFailure(
          "Elided NMI local store is not a constant or direct-read initializer",
          operation.span,
        );
      return Object.freeze([]);
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
    const lowered = lowerUnary(operation, state, block, byteReturnArms);
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
    const constantComparison =
      comparison &&
      (operation.operator === "==" || operation.operator === "!=") &&
      left.kind === "constant" &&
      right.kind === "constant" &&
      left.bytes === right.bytes &&
      state.materializedValues.has(operation.result);
    if (constantComparison) {
      const equal =
        left.kind === "constant" && right.kind === "constant" && left.value === right.value;
      const value = operation.operator === "==" ? equal : !equal;
      // The result is a compile-time constant. Emitting no instruction keeps
      // every consumer free to materialize it with its own load; forwarding a
      // register here would assume an adjacency the comparison does not prove.
      lowered = Object.freeze({
        instructions: Object.freeze([]),
        result: Object.freeze({
          kind: "constant" as const,
          value: value ? 1 : 0,
          bytes: 1,
          signed: false,
        }),
      });
    } else if (comparison) {
      // An adjacent forwarded byte read already owns Z for its closed terminal
      // choice. Reuse only that proved flag; ordinary call results and stored
      // Boolean values still need the normal comparison machinery.
      const zeroOwner =
        left.kind === "register" && left.registers === "a" && left.bytes === 1
          ? left
          : left.kind === "zero-extended" &&
              left.low.kind === "register" &&
              left.low.registers === "a" &&
              left.low.bytes === 1
            ? left.low
            : null;
      const readOwnsZero =
        (operation.operator === "==" || operation.operator === "!=") &&
        zeroOwner !== null &&
        right.kind === "constant" &&
        right.value === 0 &&
        state.forwardedRegisterValues.has(operation.left) &&
        state.zeroFlagValues.has(operation.left) &&
        state.branchConditions.has(operation.result) &&
        !state.materializedValues.has(operation.result);
      const booleanMasked =
        state.booleanShiftValues.has(operation.left) || state.booleanValues.has(operation.left)
          ? operation.left
          : state.booleanShiftValues.has(operation.right)
            ? operation.right
            : undefined;
      const booleanShift =
        booleanMasked === undefined
          ? undefined
          : (state.booleanShiftValues.get(booleanMasked) ??
            (state.booleanValues.has(booleanMasked) ? 0 : undefined));
      const maskedValue = booleanMasked === operation.left ? left : right;
      const zeroValue = booleanMasked === operation.left ? right : left;
      const maskedRegister =
        maskedValue.kind === "register" && maskedValue.registers === "a" && maskedValue.bytes === 1
          ? maskedValue
          : maskedValue.kind === "zero-extended" &&
              maskedValue.low.kind === "register" &&
              maskedValue.low.registers === "a" &&
              maskedValue.low.bytes === 1
            ? maskedValue.low
            : null;
      const booleanIdentity =
        (operation.operator === "==" || operation.operator === "!=") &&
        booleanMasked !== undefined &&
        maskedRegister !== null &&
        zeroValue.kind === "constant" &&
        zeroValue.value === 0 &&
        booleanShift !== undefined &&
        state.materializedValues.has(operation.result);
      const booleanIdentityInstructions = (() => {
        if (!booleanIdentity || booleanShift === undefined) return null;
        const instructions: MachineInstruction[] = [];
        for (let shift = 0; shift < booleanShift; shift += 1)
          instructions.push(
            machineInstruction(
              state.input.profile.cpu,
              "lsr",
              "accumulator",
              null,
              [],
              operation.span,
            ),
          );
        if (operation.operator === "==")
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
        return Object.freeze(instructions);
      })();
      lowered = readOwnsZero
        ? Object.freeze({
            instructions: Object.freeze([]),
            result: Object.freeze({
              kind: "condition" as const,
              whenTrue: operation.operator === "==" ? ("beq" as const) : ("bne" as const),
              usesFlag: "z" as const,
            }),
          })
        : booleanIdentityInstructions !== null
          ? Object.freeze({
              instructions: booleanIdentityInstructions,
              result: Object.freeze({
                kind: "register" as const,
                registers: "a" as const,
                bytes: 1,
                signed: false,
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
    const maskMerge = (() => {
      if (
        operation.operator !== "&" ||
        operation.integer === null ||
        operation.integer.width !== 8 ||
        block === undefined ||
        operationIndex === undefined
      )
        return false;
      const consumer = block.operations
        .slice(operationIndex + 1)
        .find((next) => potentialValueInputs(next).includes(operation.result));
      if (consumer?.kind !== "binary" || consumer.operator !== "|") return false;
      const other = potentialValueInputs(consumer).find((value) => value !== operation.result);
      const otherAnd = block.operations.find(
        (next) => next.kind === "binary" && next.operator === "&" && next.result === other,
      );
      if (otherAnd?.kind !== "binary") return false;
      const literal = (value: string) => {
        const definition = block.operations.find(
          (next) => "result" in next && next.result === value,
        );
        return definition?.kind === "constant" ? String(definition.value) : undefined;
      };
      const left = literal(operation.right),
        right = literal(otherAnd.right);
      return left !== undefined && left === right;
    })();
    const retained = canForwardByteArithmetic(operation, block, state, operationIndex)
      ? { instructions: lowered.instructions, value: lowered.result }
      : retainMachineValue(
          operation.result,
          lowered.result,
          lowered.instructions,
          operation.type,
          operation.span,
          state,
          { zeroPagePreferred: maskMerge },
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
      observerEvidence: state.input.observerEvidence === true,
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
        if (declaredStorage(state.input, (id) => id === requestId) === undefined) {
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
      observerEvidence: state.input.observerEvidence === true,
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
  if (operation.kind === "load-unit") return lowerLoadUnit(operation, state);
  if (operation.kind === "call") return lowerDirectCall(operation, state);
  if (operation.kind === "embedded-address") {
    state.values.set(
      operation.result,
      Object.freeze({
        kind: "symbol-address",
        label: `asset.${operation.asset}`,
        bytes: 2,
      }),
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
    if (
      state.staticRawAddresses?.has(operation.result) &&
      operation.place.path.length === 0 &&
      (operation.place.rootType?.kind === "array" || operation.place.rootType?.kind === "struct") &&
      !isReturnedLocalPlace(operation.place, state)
    ) {
      const owner = state.input.program.semantic.functions.find(
        ({ id }) => bindingIdentityKey(id) === bindingIdentityKey(state.owner),
      );
      const parameter = owner?.parameters.some(
        ({ id }) => bindingIdentityKey(id) === bindingIdentityKey(operation.place.root),
      );
      const placed = loweredPlace(operation.place, 2, false, state);
      if (!parameter && placed.kind === "storage") {
        state.values.set(
          operation.result,
          Object.freeze({
            kind: "static-address" as const,
            requestId: placed.requestId,
            offset: placed.offset ?? 0,
            bytes: 2 as const,
            signed: false as const,
          }),
        );
        return Object.freeze([]);
      }
      if (!parameter && placed.kind === "label") {
        state.values.set(
          operation.result,
          Object.freeze({
            kind: "static-address" as const,
            label: placed.label,
            offset: placed.offset ?? 0,
            bytes: 2,
            signed: false,
            ...(placed.zeroPage === true ? { zeroPage: true } : {}),
          }),
        );
        return Object.freeze([]);
      }
    }
    if (operation.type.kind === "array" || operation.type.kind === "struct") {
      state.aggregatePlaces.set(operation.result, operation.place);
      if (operation.place.path.length === 0 && isReturnedLocalPlace(operation.place, state)) {
        state.values.set(operation.result, loweredPlace(operation.place, 2, false, state));
        state.directCallerResults.add(operation.result);
        return Object.freeze([]);
      }
      const fixed = fixedAggregateSource(operation.place, state, operation.span, operation.result);
      if (fixed !== null) {
        state.values.set(operation.result, fixed);
        return Object.freeze([]);
      }
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
