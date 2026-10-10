import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticPlace } from "../semantic/operations.js";
import type { SourceSpan } from "../project/types.js";
import { lowerAggregateIndex, type AggregateIndexTerm } from "./lower-aggregate-index.js";
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
  isReturnedLocalPlace,
  loadA,
  loweredPlace,
  requestStorage,
  storeA,
  type AggregateAddressCache,
  type FunctionLoweringState,
  typeBytes,
} from "./lower-state.js";

/** Packed offset facts recovered from a place's declared root type. */
export interface AggregateAddressPlan {
  /** Existing effective-address displacement in the selected 16-bit address domain. */
  readonly staticOffset: number;
  /** Runtime ordinals that still need address formation. */
  readonly indices: readonly AggregateIndexTerm[];
  /** Every ordinal is a known in-extent constant and no offset has wrapped. */
  readonly fixedInBounds: boolean;
}

/** Recover packed field offsets and strides without losing the fixed-interval proof. */
export function aggregateAddressPlan(
  place: SemanticPlace,
  state: FunctionLoweringState,
  source: SourceSpan,
): AggregateAddressPlan {
  if (place.rootType === undefined) {
    throw loweringFailure("Indexed aggregate place is missing its declared root type", source);
  }
  let current = place.rootType;
  let staticOffset = 0;
  let fixedInBounds = true;
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
      fixedInBounds &&= staticOffset <= 0xffff;
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
      const offset = staticOffset + retained.value * stride;
      fixedInBounds &&= retained.value < current.length && offset <= 0xffff;
      staticOffset = offset & 0xffff;
    } else {
      fixedInBounds = false;
      indices.push(Object.freeze({ value: component.value, stride, extent: current.length }));
    }
    current = current.element;
  }
  return Object.freeze({ staticOffset, indices: Object.freeze(indices), fixedInBounds });
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

/** Keep a sole fixed-home call argument direct; otherwise form its exact address in a ZP pair. */
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
  const returnedRoot = isReturnedLocalPlace(place, state);
  const root = loweredPlace(place, typeBytes(place.rootType!), false, state);
  if (
    retainedId !== null &&
    state.singleUseValues.has(retainedId) &&
    state.aggregatePlaces.get(retainedId) === place &&
    plan.fixedInBounds &&
    plan.indices.length === 0 &&
    plan.staticOffset === 0 &&
    !returnedRoot &&
    root.kind === "storage" &&
    !root.requestId.includes(":parameter:") &&
    state.input.program.semantic.functions
      .find((fn) => bindingIdentityKey(fn.id) === bindingIdentityKey(state.owner))
      ?.blocks.find((block) => block.id === state.currentSemanticBlockId)
      ?.operations.some(
        (operation) => operation.kind === "call" && operation.arguments.includes(retainedId),
      )
  ) {
    // The existing call marshaller already distinguishes a data home from a
    // captured pointer. Keep that identity; no pointer bytes need materializing.
    return Object.freeze({ instructions: Object.freeze([]), pointer: root, displacement: 0 });
  }
  if (
    returnedRoot &&
    plan.indices.length === 0 &&
    (plan.staticOffset === 0 ||
      (retainedId === null && accessBytes > 0 && plan.staticOffset + accessBytes <= 256))
  ) {
    const root = loweredPlace(place, 2, false, state);
    if (root.kind !== "storage")
      throw loweringFailure("Returned local base is not a retained pointer", source);
    state.aggregateAddressCache = null;
    return Object.freeze({
      instructions: Object.freeze([]),
      pointer: root,
      displacement: plan.staticOffset,
    });
  }
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
  // Aggregate parameters contain a borrowed base address; copied scalar/enum
  // parameters contain the value itself, so their address names the SFA home.
  const parameterRoot =
    returnedRoot ||
    ((place.rootType?.kind === "array" || place.rootType?.kind === "struct") &&
      root.kind === "storage" &&
      root.requestId.includes(":parameter:"));
  const addressStaticOffset = cache === null ? plan.staticOffset : 0;
  const instructions: MachineInstruction[] = [];
  const term = plan.indices.length === 1 ? plan.indices[0]! : null;
  const ordinal = term === null ? undefined : state.values.get(term.value);
  const byteOrdinal =
    ordinal?.kind === "zero-extended"
      ? ordinal.low
      : ordinal !== undefined &&
          ordinal.kind !== "condition" &&
          ordinal.bytes === 1 &&
          ordinal.signed !== true
        ? ordinal
        : null;
  if (term?.stride === 1 && byteOrdinal !== null && (!parameterRoot || addressStaticOffset === 0)) {
    // Consume a live ordinal before loading the base. The carry from the low
    // sum enters the high byte, so this is still a full 16-bit address.
    appendLoadA(instructions, byteOrdinal, 0, state, source);
    instructions.push(
      machineInstruction(state.input.profile.cpu, "clc", "implied", null, [], source),
    );
    for (const addressByte of ["low", "high"] as const) {
      const offset = addressByte === "low" ? 0 : 1;
      const operand = parameterRoot
        ? operandForValue(root, offset)
        : root.kind === "storage"
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
        machineInstruction(
          state.input.profile.cpu,
          addressByte === "low" ? "adc" : "lda",
          parameterRoot ? modeForValue(root, offset) : "immediate",
          operand,
          [],
          source,
        ),
      );
      if (addressByte === "high") {
        instructions.push(
          machineInstruction(
            state.input.profile.cpu,
            "adc",
            "immediate",
            Object.freeze({ kind: "immediate", value: 0 }),
            [],
            source,
          ),
        );
      }
      instructions.push(storeA(pointer, offset, state, source));
    }
    if (cache !== null) state.aggregateAddressCache = cache;
    return Object.freeze({ instructions: Object.freeze(instructions), pointer, displacement });
  }
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
    const byteOffset = scaled.value.kind !== "condition" && scaled.value.bytes === 1;
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
        byteOffset ? "immediate" : modeForValue(scaled.value, 1),
        byteOffset
          ? Object.freeze({ kind: "immediate", value: 0 })
          : operandForValue(scaled.value, 1),
        [],
        source,
      ),
      storeA(pointer, 1, state, source),
    );
  }
  if (cache !== null) state.aggregateAddressCache = cache;
  return Object.freeze({ instructions: Object.freeze(instructions), pointer, displacement });
}
