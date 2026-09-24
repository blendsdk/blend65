import { bindingIdentityKey, type SemanticType } from "../frontend/semantic-types.js";
import type { SemanticOperation, SemanticPlace } from "../semantic/operations.js";
import type { SourceSpan } from "../project/types.js";
import {
  machineInstruction,
  modeForValue,
  operandForValue,
  type LoweredValue,
} from "./lower-control.js";
import type { MachineInstruction, MachineOperand } from "./machine-types.js";
import { lowerAggregateIndex, type AggregateIndexTerm } from "./lower-aggregate-index.js";
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

/** Packed offset facts recovered from a place's declared root type. */
interface AggregateAddressPlan {
  readonly staticOffset: number;
  readonly indices: readonly AggregateIndexTerm[];
}

/** A compile-time byte offset or an unsigned byte ordinal that needs no pointer pair. */
type DirectAggregateAccess =
  | {
      readonly kind: "fixed";
      readonly root: Extract<LoweredValue, { readonly kind: "storage" | "label" }>;
      readonly offset: number;
    }
  | {
      readonly kind: "indexed";
      readonly root: Extract<LoweredValue, { readonly kind: "storage" | "label" }>;
      readonly index: LoweredValue;
      readonly offset: number;
      readonly stride: number;
    };

/** Retain a relocation or certified home while adding a compile-time packed offset. */
function directOperand(access: DirectAggregateAccess, byteOffset = 0): MachineOperand {
  const offset = access.offset + (access.kind === "fixed" ? byteOffset : 0);
  return access.root.kind === "storage"
    ? Object.freeze({ kind: "storage", requestId: access.root.requestId, offset })
    : Object.freeze({ kind: "label", label: access.root.label, offset });
}

/** Keep the physical mode consistent for every byte of one direct access. */
function directMode(
  access: DirectAggregateAccess,
): "storage" | "zero-page" | "absolute" | "absolute-y" {
  return access.kind === "indexed"
    ? "absolute-y"
    : access.root.kind === "storage"
      ? "storage"
      : access.root.zeroPage
        ? "zero-page"
        : "absolute";
}

/** Keep simple static array accesses in the 6502's native absolute indexed mode. */
function directAggregateAccess(
  place: SemanticPlace,
  type: SemanticType,
  state: FunctionLoweringState,
  source: SourceSpan,
): DirectAggregateAccess | null {
  if (
    place.rootType === undefined ||
    (type.kind !== "scalar" && type.kind !== "enum") ||
    typeBytes(type) > 2
  ) {
    return null;
  }
  const root = loweredPlace(place, typeBytes(place.rootType), false, state);
  if (root.kind !== "storage" && root.kind !== "label") return null;
  if (root.kind === "storage" && root.requestId.includes(":parameter:")) return null;
  const plan = aggregateAddressPlan(place, state, source);
  if (plan.indices.length === 0) {
    return Object.freeze({ kind: "fixed", root, offset: plan.staticOffset });
  }
  if (plan.indices.length !== 1) return null;
  const term = plan.indices[0]!;
  if (term.stride > 1 && (!state.input.boundsCheck || term.extent * term.stride > 256)) return null;
  const index = state.values.get(plan.indices[0]!.value);
  if (index?.kind !== "storage" || index.bytes !== 1 || index.signed === true) {
    return null;
  }
  return Object.freeze({
    kind: "indexed",
    root,
    index,
    offset: plan.staticOffset,
    stride: term.stride,
  });
}

/**
 * Scale a range-checked byte ordinal in A, then leave its packed byte offset in Y.
 * Each binary digit doubles the current value and optionally adds the original ordinal.
 * The caller admits this path only when the checked maximum offset fits one byte.
 */
function directIndexInstructions(
  access: Extract<DirectAggregateAccess, { readonly kind: "indexed" }>,
  state: FunctionLoweringState,
  source: SourceSpan,
): readonly MachineInstruction[] {
  const cpu = state.input.profile.cpu;
  if (access.stride === 1) {
    return Object.freeze([
      machineInstruction(
        cpu,
        "ldy",
        modeForValue(access.index),
        operandForValue(access.index),
        [],
        source,
      ),
    ]);
  }
  const instructions: MachineInstruction[] = [loadA(access.index, 0, state, source)];
  const bits = access.stride.toString(2).slice(1);
  for (const bit of bits) {
    instructions.push(machineInstruction(cpu, "asl", "accumulator", null, [], source));
    if (bit === "1") {
      instructions.push(
        machineInstruction(cpu, "clc", "implied", null, [], source),
        machineInstruction(
          cpu,
          "adc",
          modeForValue(access.index),
          operandForValue(access.index),
          [],
          source,
        ),
      );
    }
  }
  instructions.push(machineInstruction(cpu, "tay", "implied", null, [], source));
  return Object.freeze(instructions);
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
      indices.push(Object.freeze({ value: component.value, stride, extent: current.length }));
    }
    current = current.element;
  }
  return Object.freeze({ staticOffset, indices: Object.freeze(indices) });
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
        modeForValue(scaled.value, 1),
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
  const direct = directAggregateAccess(operation.place, operation.type, state, operation.span);
  if (direct !== null) {
    const instructions: MachineInstruction[] = [];
    if (direct.kind === "indexed")
      instructions.push(...directIndexInstructions(direct, state, operation.span));
    const resultRequest =
      bytes === 1
        ? null
        : requestStorage(
            state,
            `aggregate-load:${operation.result}`,
            "temporary",
            bytes,
            "ram",
            operation.span,
            "Materialized packed aggregate selection",
            operation.type,
          );
    for (let offset = 0; offset < bytes; offset += 1) {
      if (offset > 0 && direct.kind === "indexed")
        instructions.push(
          machineInstruction(state.input.profile.cpu, "iny", "implied", null, [], operation.span),
        );
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "lda",
          directMode(direct),
          directOperand(direct, offset),
          [],
          operation.span,
        ),
      );
      if (resultRequest !== null)
        instructions.push(
          storeA(
            { kind: "storage", requestId: resultRequest.id, bytes, signed: false },
            offset,
            state,
            operation.span,
          ),
        );
    }
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result:
        resultRequest === null
          ? Object.freeze({
              kind: "register",
              registers: "a",
              bytes: 1,
              signed: isSignedType(operation.type),
            })
          : Object.freeze({
              kind: "storage",
              requestId: resultRequest.id,
              bytes,
              signed: isSignedType(operation.type),
            }),
    });
  }
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
  const direct = directAggregateAccess(operation.place, operation.type, state, operation.span);
  if (direct !== null) {
    if (valueInput.kind === "condition") {
      throw loweringFailure("Packed aggregate store value was not materialized", operation.span);
    }
    const instructions: MachineInstruction[] = [];
    let value = valueInput;
    if (direct.kind === "indexed" && direct.stride > 1 && value.kind === "register") {
      const staged = requestStorage(
        state,
        `aggregate-store:${operation.span.start}`,
        "temporary",
        value.bytes,
        "ram",
        operation.span,
        "Value preserved while scaling an aggregate ordinal",
        operation.type,
      );
      const home: LoweredValue = Object.freeze({
        kind: "storage",
        requestId: staged.id,
        bytes: value.bytes,
      });
      instructions.push(storeA(home, 0, state, operation.span));
      if (value.bytes === 2) {
        instructions.push(
          machineInstruction(state.input.profile.cpu, "txa", "implied", null, [], operation.span),
          storeA(home, 1, state, operation.span),
        );
      }
      value = home;
    }
    if (direct.kind === "indexed")
      instructions.push(...directIndexInstructions(direct, state, operation.span));
    for (let offset = 0; offset < typeBytes(operation.type); offset += 1) {
      if (offset > 0 && direct.kind === "indexed")
        instructions.push(
          machineInstruction(state.input.profile.cpu, "iny", "implied", null, [], operation.span),
        );
      appendLoadA(instructions, value, offset, state, operation.span);
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "sta",
          directMode(direct),
          directOperand(direct, offset),
          [],
          operation.span,
        ),
      );
    }
    return Object.freeze(instructions);
  }
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
  if (operation.type.kind === "scalar" || operation.type.kind === "enum") {
    throw loweringFailure("Aggregate construction requires an aggregate type", operation.span);
  }
  const instructions: MachineInstruction[] = [];
  let indirect = false;
  let result: LoweredValue;
  if (operation.destination?.kind === "caller") {
    const requestId = `${bindingIdentityKey(state.owner)}:pointer:aggregate-return-destination`;
    if (!state.input.placement.homes.some((home) => home.requestId === requestId)) {
      throw loweringFailure(
        "Aggregate return destination has no certified pointer home",
        operation.span,
      );
    }
    result = Object.freeze({ kind: "storage", requestId, bytes: 2, signed: false });
    indirect = true;
    state.directCallerResults.add(operation.result);
  } else if (
    operation.destination?.kind === "place" &&
    operation.destination.place.path.length === 0
  ) {
    const place = operation.destination.place;
    const home = loweredPlace(place, operation.type.size, false, state);
    if (home.kind === "storage" && home.requestId.includes(":parameter:")) {
      const address = lowerAggregateAddress(
        place,
        state,
        operation.span,
        `construct:${operation.result}`,
      );
      instructions.push(...address.instructions);
      result = address.pointer;
      indirect = true;
    } else {
      result = home;
    }
    state.aggregatePlaces.set(operation.result, place);
  } else if (operation.destination?.kind === "place") {
    const place = operation.destination.place;
    const address = lowerAggregateAddress(
      place,
      state,
      operation.span,
      `construct:${operation.result}`,
    );
    instructions.push(...address.instructions);
    result = address.pointer;
    indirect = true;
    state.aggregatePlaces.set(operation.result, place);
  } else {
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
    result = Object.freeze({
      kind: "storage",
      requestId: request.id,
      bytes: operation.type.size,
      signed: false,
    });
  }
  const writeValue = (valueId: string, start: number, bytes: number): void => {
    const value = state.values.get(valueId);
    if (value === undefined || value.kind === "condition" || value.bytes < bytes) {
      throw loweringFailure("Aggregate element has no complete lowered value", operation.span);
    }
    for (let offset = 0; offset < bytes; offset += 1) {
      appendLoadA(instructions, value, offset, state, operation.span);
      if (indirect) {
        if (result.kind !== "storage")
          throw loweringFailure("Aggregate destination has no pointer home", operation.span);
        if (start + offset > 0 && ((start + offset) & 0xff) === 0) {
          instructions.push(
            machineInstruction(
              state.input.profile.cpu,
              "inc",
              "storage",
              Object.freeze({ kind: "storage", requestId: result.requestId, offset: 1 }),
              [],
              operation.span,
            ),
          );
        }
        instructions.push(
          machineInstruction(
            state.input.profile.cpu,
            "ldy",
            "immediate",
            Object.freeze({ kind: "immediate", value: (start + offset) & 0xff }),
            [],
            operation.span,
          ),
          machineInstruction(
            state.input.profile.cpu,
            "sta",
            "indirect-indexed-y",
            Object.freeze({ kind: "indirect-y", requestId: result.requestId, offset: 0 }),
            [],
            operation.span,
          ),
        );
      } else {
        instructions.push(storeA(result, start + offset, state, operation.span));
      }
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
