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
import { aggregateAddressPlan, lowerAggregateAddress } from "./lower-aggregate-place.js";
import {
  loweringFailure,
  aggregateResultPointer,
  appendLoadA,
  isSignedType,
  isReturnedLocalPlace,
  loadA,
  loweredPlace,
  requestStorage,
  storeA,
  type FunctionLoweringState,
  typeBytes,
} from "./lower-state.js";

export { lowerAggregateAddress } from "./lower-aggregate-place.js";

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
    isReturnedLocalPlace(place, state) ||
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
  const result: LoweredValue =
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
    );
    if (resultRequest !== null) instructions.push(storeA(result, offset, state, operation.span));
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
  const adjacentRead =
    state.adjacentByteRead?.value === operation.value ? state.adjacentByteRead : null;
  if (value.kind === "register" && adjacentRead === null) {
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
    if (adjacentRead !== null && offset === 0) {
      instructions.push(adjacentRead.instruction);
      delete state.adjacentByteRead;
    } else appendLoadA(instructions, value, offset, state, operation.span);
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

/** Select the final packed object and preserve its address for all writes. */
export function aggregateDestination(
  operation: Extract<SemanticOperation, { readonly kind: "aggregate" }>,
  state: FunctionLoweringState,
): {
  readonly instructions: MachineInstruction[];
  readonly result: LoweredValue;
  readonly indirect: boolean;
} {
  if (operation.type.kind !== "array" && operation.type.kind !== "struct") {
    throw loweringFailure("Aggregate construction requires an aggregate type", operation.span);
  }
  const instructions: MachineInstruction[] = [];
  let indirect = false;
  let result: LoweredValue;
  const fixed = freshAggregateHome(operation, state);
  if (fixed !== null && operation.destination?.kind === "place") {
    result = fixed;
    state.aggregatePlaces.set(operation.result, operation.destination.place);
  } else if (operation.destination?.kind === "caller") {
    result = aggregateResultPointer(state.owner, state, operation.span);
    indirect = true;
    state.directCallerResults.add(operation.result);
  } else if (
    operation.destination?.kind === "place" &&
    operation.destination.place.path.length === 0
  ) {
    const place = operation.destination.place;
    const home = loweredPlace(place, operation.type.size, false, state);
    if (
      home.kind === "storage" &&
      (home.requestId.includes(":parameter:") || isReturnedLocalPlace(place, state))
    ) {
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
  return { instructions, result, indirect };
}

/**
 * Select only a certified private local's complete, non-wrapping child interval.
 * The declaration supplies freshness/purity; the backend additionally proves the
 * concrete home and bounds. Missing proof falls back to ordinary address lowering.
 */
function freshAggregateHome(
  operation: Extract<SemanticOperation, { readonly kind: "aggregate" }>,
  state: FunctionLoweringState,
): Extract<LoweredValue, { readonly kind: "storage" }> | null {
  const destination = operation.destination;
  if (destination?.kind !== "place" || destination.freshConstant !== true) return null;
  const place = destination.place;
  if (place.rootType === undefined || place.asset !== undefined) return null;
  const bytes = typeBytes(operation.type);
  const rootBytes = typeBytes(place.rootType);
  const root = loweredPlace(place, rootBytes, false, state);
  if (
    root.kind !== "storage" ||
    !root.requestId.endsWith(`:local:${bindingIdentityKey(place.root)}`)
  )
    return null;
  const home = state.input.placement.homes.find(({ requestId }) => requestId === root.requestId);
  const plan = aggregateAddressPlan(place, state, operation.span);
  if (
    !plan.fixedInBounds ||
    plan.staticOffset + bytes > rootBytes ||
    home === undefined ||
    plan.staticOffset + bytes > home.bytes
  )
    return null;
  return Object.freeze({ ...root, bytes, offset: plan.staticOffset });
}

/** Return a retained indirect result pointer to the first byte after page writes. */
export function restoreAggregateDestinationPage(
  result: LoweredValue,
  indirect: boolean,
  advancedPages: number,
  operation: Extract<SemanticOperation, { readonly kind: "aggregate" }>,
  state: FunctionLoweringState,
): readonly MachineInstruction[] {
  const returnedRoot =
    operation.destination?.kind === "place" &&
    isReturnedLocalPlace(operation.destination.place, state);
  if (
    !indirect ||
    (!returnedRoot && !state.retainedAggregateResults.has(operation.result)) ||
    advancedPages === 0
  ) {
    return Object.freeze([]);
  }
  if (result.kind !== "storage") {
    throw loweringFailure("Aggregate result pointer has no home", operation.span);
  }
  const high = Object.freeze({ kind: "storage" as const, requestId: result.requestId, offset: 1 });
  const cpu = state.input.profile.cpu;
  if (advancedPages === 1) {
    return Object.freeze([machineInstruction(cpu, "dec", "storage", high, [], operation.span)]);
  }
  return Object.freeze([
    machineInstruction(cpu, "lda", "storage", high, [], operation.span),
    machineInstruction(cpu, "sec", "implied", null, [], operation.span),
    machineInstruction(
      cpu,
      "sbc",
      "immediate",
      Object.freeze({ kind: "immediate", value: advancedPages }),
      [],
      operation.span,
    ),
    machineInstruction(cpu, "sta", "storage", high, [], operation.span),
  ]);
}
