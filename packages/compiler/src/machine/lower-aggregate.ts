import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticOperation, SemanticPlace } from "../semantic/operations.js";
import type { SourceSpan } from "../project/types.js";
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
  createAggregateAddressCache,
  isSignedType,
  loadA,
  loweredPlace,
  requestStorage,
  storeA,
  type AggregateAddressCache,
  type FunctionLoweringState,
  typeBytes,
} from "./lower.js";

/** One dynamic packed offset selected while walking an aggregate place. */
interface AggregateIndexTerm {
  readonly value: string;
  readonly stride: number;
}

/** Packed offset facts recovered from a place's declared root type. */
interface AggregateAddressPlan {
  readonly staticOffset: number;
  readonly indices: readonly AggregateIndexTerm[];
}

/**
 * Identify an indexed aggregate base that can remain in the shared address pair.
 * Register values are excluded because their contents may change without changing their identity.
 */
function reusableAggregateAddressCache(
  place: SemanticPlace,
  plan: AggregateAddressPlan,
  accessBytes: number,
  state: FunctionLoweringState,
): AggregateAddressCache | null {
  if (
    accessBytes <= 0 ||
    plan.indices.length === 0 ||
    plan.staticOffset < 0 ||
    plan.staticOffset + accessBytes > 0x100
  ) {
    return null;
  }
  const indices = plan.indices.map((term) => {
    const value = state.values.get(term.value);
    if (value?.kind !== "storage") return null;
    return Object.freeze({
      requestId: value.requestId,
      bytes: value.bytes,
      signed: value.signed === true,
      stride: term.stride,
    });
  });
  if (indices.some((index) => index === null)) return null;
  const rootBindingKey = bindingIdentityKey(place.root);
  return createAggregateAddressCache(
    rootBindingKey,
    indices.flatMap((index) => (index === null ? [] : [index])),
  );
}

/** Walk one packed field/index path and retain each exact element stride. */
function aggregateAddressPlan(
  place: SemanticPlace,
  state: FunctionLoweringState,
  source: SourceSpan,
): AggregateAddressPlan {
  if (place.rootType === undefined) {
    throw loweringFailure("Indexed aggregate place is missing its declared root type", source);
  }
  let current = place.rootType;
  let staticOffset = 0;
  const indices: AggregateIndexTerm[] = [];
  for (const component of place.path) {
    if (component.kind === "field") {
      if (current.kind !== "struct") {
        throw loweringFailure("Field selection does not follow a packed struct type", source);
      }
      const field = current.fields.find(({ name }) => name === component.name);
      if (field === undefined) {
        throw loweringFailure(`Packed struct has no field '${component.name}'`, source);
      }
      staticOffset += field.offset;
      current = field.type;
      continue;
    }
    if (current.kind !== "array") {
      throw loweringFailure("Index selection does not follow a fixed array type", source);
    }
    const stride = typeBytes(current.element);
    const retained = state.values.get(component.value);
    if (retained?.kind === "constant") {
      if (!Number.isSafeInteger(retained.value) || retained.value < 0) {
        throw loweringFailure("Aggregate index constant is outside the address domain", source);
      }
      staticOffset = (staticOffset + retained.value * stride) & 0xffff;
    } else {
      indices.push(Object.freeze({ value: component.value, stride }));
    }
    current = current.element;
  }
  return Object.freeze({ staticOffset, indices: Object.freeze(indices) });
}

/** Store one immediate byte without introducing a pseudo-instruction. */
function appendImmediateStore(
  instructions: MachineInstruction[],
  value: number,
  destination: LoweredValue,
  offset: number,
  state: FunctionLoweringState,
  source: SourceSpan,
): void {
  instructions.push(
    machineInstruction(
      state.input.profile.cpu,
      "lda",
      "immediate",
      Object.freeze({ kind: "immediate", value: value & 0xff }),
      [],
      source,
    ),
    storeA(destination, offset, state, source),
  );
}

/** Widen and scale one ordinal into a reusable two-byte SFA temporary. */
function lowerAggregateIndex(
  term: AggregateIndexTerm,
  state: FunctionLoweringState,
  source: SourceSpan,
): { readonly instructions: readonly MachineInstruction[]; readonly value: LoweredValue } {
  const index = state.values.get(term.value);
  if (index === undefined || index.kind === "condition" || index.bytes > 2) {
    throw loweringFailure("Aggregate index has no retained byte/word value", source);
  }
  const candidateRequest = requestStorage(
    state,
    "aggregate-index-candidate",
    "temporary",
    2,
    "ram",
    source,
    "Widened and shifted aggregate index",
  );
  const candidate: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: candidateRequest.id,
    bytes: 2,
    signed: false,
  });
  const instructions: MachineInstruction[] = [];
  appendLoadA(instructions, index, 0, state, source);
  instructions.push(storeA(candidate, 0, state, source));
  if (index.bytes === 2) {
    appendLoadA(instructions, index, 1, state, source);
    instructions.push(storeA(candidate, 1, state, source));
  } else if (index.signed === true) {
    appendLoadA(instructions, index, 0, state, source);
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "cmp",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0x80 }),
        [],
        source,
      ),
      machineInstruction(
        state.input.profile.cpu,
        "lda",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0 }),
        [],
        source,
      ),
      machineInstruction(
        state.input.profile.cpu,
        "sbc",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0 }),
        [],
        source,
      ),
      machineInstruction(
        state.input.profile.cpu,
        "eor",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0xff }),
        [],
        source,
      ),
      storeA(candidate, 1, state, source),
    );
  } else {
    appendImmediateStore(instructions, 0, candidate, 1, state, source);
  }

  if (term.stride === 1) {
    return Object.freeze({ instructions: Object.freeze(instructions), value: candidate });
  }
  if ((term.stride & (term.stride - 1)) === 0) {
    for (let shift = 0; shift < Math.log2(term.stride); shift += 1) {
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "asl",
          "storage",
          operandForValue(candidate, 0),
          [],
          source,
        ),
        machineInstruction(
          state.input.profile.cpu,
          "rol",
          "storage",
          operandForValue(candidate, 1),
          [],
          source,
        ),
      );
    }
    return Object.freeze({ instructions: Object.freeze(instructions), value: candidate });
  }

  if (
    term.stride === 5 &&
    index.bytes === 1 &&
    index.signed !== true &&
    index.kind !== "register"
  ) {
    for (let shift = 0; shift < 2; shift += 1) {
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "asl",
          "storage",
          operandForValue(candidate, 0),
          [],
          source,
        ),
        machineInstruction(
          state.input.profile.cpu,
          "rol",
          "storage",
          operandForValue(candidate, 1),
          [],
          source,
        ),
      );
    }
    instructions.push(
      loadA(candidate, 0, state, source),
      machineInstruction(state.input.profile.cpu, "clc", "implied", null, [], source),
      machineInstruction(
        state.input.profile.cpu,
        "adc",
        modeForValue(index),
        operandForValue(index, 0),
        [],
        source,
      ),
      storeA(candidate, 0, state, source),
      loadA(candidate, 1, state, source),
      machineInstruction(
        state.input.profile.cpu,
        "adc",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0 }),
        [],
        source,
      ),
      storeA(candidate, 1, state, source),
    );
    return Object.freeze({ instructions: Object.freeze(instructions), value: candidate });
  }

  const resultRequest = requestStorage(
    state,
    "aggregate-index-result",
    "temporary",
    2,
    "ram",
    source,
    "Packed aggregate index scale accumulator",
  );
  const result: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: resultRequest.id,
    bytes: 2,
    signed: false,
  });
  appendImmediateStore(instructions, 0, result, 0, state, source);
  appendImmediateStore(instructions, 0, result, 1, state, source);
  let factor = term.stride;
  while (factor !== 0) {
    if ((factor & 1) !== 0) {
      instructions.push(
        loadA(result, 0, state, source),
        machineInstruction(state.input.profile.cpu, "clc", "implied", null, [], source),
        machineInstruction(
          state.input.profile.cpu,
          "adc",
          "storage",
          operandForValue(candidate, 0),
          [],
          source,
        ),
        storeA(result, 0, state, source),
        loadA(result, 1, state, source),
        machineInstruction(
          state.input.profile.cpu,
          "adc",
          "storage",
          operandForValue(candidate, 1),
          [],
          source,
        ),
        storeA(result, 1, state, source),
      );
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
          source,
        ),
        machineInstruction(
          state.input.profile.cpu,
          "rol",
          "storage",
          operandForValue(candidate, 1),
          [],
          source,
        ),
      );
    }
  }
  return Object.freeze({ instructions: Object.freeze(instructions), value: result });
}

/** Form one exact 16-bit packed aggregate address in an SFA-owned ZP pair. */
export function lowerAggregateAddress(
  place: SemanticPlace,
  state: FunctionLoweringState,
  source: SourceSpan,
  retainedId: string | null = null,
  accessBytes = 0,
): {
  readonly instructions: readonly MachineInstruction[];
  readonly pointer: Extract<LoweredValue, { readonly kind: "storage" }>;
  readonly displacement: number;
} {
  const plan = aggregateAddressPlan(place, state, source);
  const cache =
    retainedId === null ? reusableAggregateAddressCache(place, plan, accessBytes, state) : null;
  const displacement = cache === null ? 0 : plan.staticOffset;
  const pointerRequest = requestStorage(
    state,
    retainedId === null ? "aggregate-address" : `aggregate-address:${retainedId}`,
    "pointer",
    2,
    "zero-page-required",
    source,
    "Page-safe packed aggregate address",
  );
  const pointer: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: pointerRequest.id,
    bytes: 2,
    signed: false,
  });
  if (cache !== null && state.aggregateAddressCache?.key === cache.key) {
    return Object.freeze({ instructions: Object.freeze([]), pointer, displacement });
  }
  if (retainedId === null) state.aggregateAddressCache = null;
  const root = loweredPlace(place, typeBytes(place.rootType!), false, state);
  const parameterRoot = root.kind === "storage" && root.requestId.includes(":parameter:");
  const addressStaticOffset = cache === null ? plan.staticOffset : 0;
  const instructions: MachineInstruction[] = [];
  if (parameterRoot) {
    instructions.push(
      loadA(root, 0, state, source),
      storeA(pointer, 0, state, source),
      loadA(root, 1, state, source),
      storeA(pointer, 1, state, source),
    );
  } else {
    for (const addressByte of ["low", "high"] as const) {
      const operand =
        root.kind === "storage"
          ? Object.freeze({
              kind: "storage" as const,
              requestId: root.requestId,
              offset: addressStaticOffset,
              addressByte,
            })
          : root.kind === "label"
            ? Object.freeze({
                kind: "label" as const,
                label: root.label,
                offset: addressStaticOffset,
                addressByte,
              })
            : null;
      if (operand === null) throw loweringFailure("Aggregate root has no stable address", source);
      instructions.push(
        machineInstruction(state.input.profile.cpu, "lda", "immediate", operand, [], source),
        storeA(pointer, addressByte === "low" ? 0 : 1, state, source),
      );
    }
  }

  if (parameterRoot && addressStaticOffset !== 0) {
    instructions.push(
      loadA(pointer, 0, state, source),
      machineInstruction(state.input.profile.cpu, "clc", "implied", null, [], source),
      machineInstruction(
        state.input.profile.cpu,
        "adc",
        "immediate",
        Object.freeze({ kind: "immediate", value: addressStaticOffset & 0xff }),
        [],
        source,
      ),
      storeA(pointer, 0, state, source),
      loadA(pointer, 1, state, source),
      machineInstruction(
        state.input.profile.cpu,
        "adc",
        "immediate",
        Object.freeze({ kind: "immediate", value: (addressStaticOffset >> 8) & 0xff }),
        [],
        source,
      ),
      storeA(pointer, 1, state, source),
    );
  }
  for (const term of plan.indices) {
    const scaled = lowerAggregateIndex(term, state, source);
    instructions.push(...scaled.instructions);
    instructions.push(
      loadA(pointer, 0, state, source),
      machineInstruction(state.input.profile.cpu, "clc", "implied", null, [], source),
      machineInstruction(
        state.input.profile.cpu,
        "adc",
        modeForValue(scaled.value),
        operandForValue(scaled.value, 0),
        [],
        source,
      ),
      storeA(pointer, 0, state, source),
      loadA(pointer, 1, state, source),
      machineInstruction(
        state.input.profile.cpu,
        "adc",
        modeForValue(scaled.value),
        operandForValue(scaled.value, 1),
        [],
        source,
      ),
      storeA(pointer, 1, state, source),
    );
  }
  if (cache !== null) state.aggregateAddressCache = cache;
  return Object.freeze({ instructions: Object.freeze(instructions), pointer, displacement });
}

/** Load one packed indexed place now, preserving source read order in an SFA value. */
export function lowerAggregateLoad(
  operation: Extract<SemanticOperation, { readonly kind: "load" }>,
  state: FunctionLoweringState,
): { readonly instructions: readonly MachineInstruction[]; readonly result: LoweredValue } {
  const bytes = typeBytes(operation.type);
  const address = lowerAggregateAddress(operation.place, state, operation.span, null, bytes);
  const resultRequest = requestStorage(
    state,
    `aggregate-load:${operation.result}`,
    "temporary",
    bytes,
    "ram",
    operation.span,
    "Materialized packed aggregate selection",
    operation.type,
  );
  const result: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: resultRequest.id,
    bytes,
    signed: isSignedType(operation.type),
  });
  const instructions = [...address.instructions];
  for (let offset = 0; offset < bytes; offset += 1) {
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "ldy",
        "immediate",
        Object.freeze({ kind: "immediate", value: address.displacement + offset }),
        [],
        operation.span,
      ),
      machineInstruction(
        state.input.profile.cpu,
        "lda",
        "indirect-indexed-y",
        Object.freeze({ kind: "indirect-y", requestId: address.pointer.requestId, offset: 0 }),
        [],
        operation.span,
      ),
      storeA(result, offset, state, operation.span),
    );
  }
  return Object.freeze({ instructions: Object.freeze(instructions), result });
}

/** Store one complete value through a packed aggregate address. */
export function lowerAggregateStore(
  operation: Extract<SemanticOperation, { readonly kind: "store" }>,
  valueInput: LoweredValue,
  state: FunctionLoweringState,
): readonly MachineInstruction[] {
  let value = valueInput;
  const instructions: MachineInstruction[] = [];
  if (value.kind === "register") {
    const stagingRequest = requestStorage(
      state,
      `aggregate-store:${operation.span.start}`,
      "temporary",
      1,
      "ram",
      operation.span,
      "Accumulator value staged before address formation",
      operation.type,
    );
    value = Object.freeze({ kind: "storage", requestId: stagingRequest.id, bytes: 1 });
    instructions.push(storeA(value, 0, state, operation.span));
  }
  if (value.kind === "condition") {
    throw loweringFailure("Packed aggregate store value was not materialized", operation.span);
  }
  const bytes = typeBytes(operation.type);
  const address = lowerAggregateAddress(operation.place, state, operation.span, null, bytes);
  instructions.push(...address.instructions);
  for (let offset = 0; offset < bytes; offset += 1) {
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "ldy",
        "immediate",
        Object.freeze({ kind: "immediate", value: address.displacement + offset }),
        [],
        operation.span,
      ),
    );
    appendLoadA(instructions, value, offset, state, operation.span);
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "sta",
        "indirect-indexed-y",
        Object.freeze({ kind: "indirect-y", requestId: address.pointer.requestId, offset: 0 }),
        [],
        operation.span,
      ),
    );
  }
  return Object.freeze(instructions);
}

/** Lower one fixed aggregate into a direct SFA-owned packed temporary. */
export function lowerAggregate(
  operation: Extract<SemanticOperation, { readonly kind: "aggregate" }>,
  state: FunctionLoweringState,
): { readonly instructions: readonly MachineInstruction[]; readonly result: LoweredValue } {
  if (operation.type.kind === "scalar") {
    throw loweringFailure("Aggregate construction requires an aggregate type", operation.span);
  }
  const request = requestStorage(
    state,
    `aggregate:${operation.result}`,
    "temporary",
    operation.type.size,
    "ram",
    operation.span,
    "Packed aggregate construction",
    operation.type,
  );
  const result: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: request.id,
    bytes: operation.type.size,
    signed: false,
  });
  const instructions: MachineInstruction[] = [];
  const writeValue = (valueId: string, start: number, bytes: number): void => {
    const value = state.values.get(valueId);
    if (value === undefined || value.kind === "condition" || value.bytes < bytes) {
      throw loweringFailure("Aggregate element has no complete lowered value", operation.span);
    }
    for (let offset = 0; offset < bytes; offset += 1) {
      appendLoadA(instructions, value, offset, state, operation.span);
      instructions.push(storeA(result, start + offset, state, operation.span));
    }
  };

  if (operation.type.kind === "array") {
    const elementBytes = typeBytes(operation.type.element);
    if (operation.elements.length > operation.type.length) {
      throw loweringFailure(
        "Aggregate has more elements than its fixed array type",
        operation.span,
      );
    }
    for (let index = 0; index < operation.type.length; index += 1) {
      const element = operation.elements[index]?.value ?? operation.fill;
      if (element === null || element === undefined) {
        throw loweringFailure("Fixed array construction is missing an element", operation.span);
      }
      writeValue(element, index * elementBytes, elementBytes);
    }
  } else {
    const byField = new Map(
      operation.elements.flatMap(({ field, value }) =>
        field === null ? [] : [[field, value] as const],
      ),
    );
    for (const field of operation.type.fields) {
      const value = byField.get(field.name);
      if (value === undefined) {
        throw loweringFailure(
          `Struct construction is missing field '${field.name}'`,
          operation.span,
        );
      }
      writeValue(value, field.offset, typeBytes(field.type));
    }
  }
  return Object.freeze({ instructions: Object.freeze(instructions), result });
}
