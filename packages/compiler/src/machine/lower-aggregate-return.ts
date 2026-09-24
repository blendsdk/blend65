import {
  bindingIdentityKey,
  type BindingId,
  type SemanticType,
} from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import type { AggregateDestination, SemanticPlace } from "../semantic/operations.js";
import { lowerAggregateAddress } from "./lower-aggregate.js";
import { machineInstruction, type LoweredValue } from "./lower-control.js";
import type { MachineInstruction } from "./machine-types.js";
import {
  appendLoadA,
  loweredPlace,
  loweringFailure,
  requestStorage,
  storeA,
  type FunctionLoweringState,
} from "./lower.js";

/** Find the closed two-byte destination home of a fixed-aggregate result. */
function resultPointer(
  owner: BindingId,
  state: FunctionLoweringState,
  source: SourceSpan,
): Extract<LoweredValue, { readonly kind: "storage" }> {
  const requestId = `${bindingIdentityKey(owner)}:pointer:aggregate-return-destination`;
  if (!state.input.placement.homes.some((home) => home.requestId === requestId)) {
    throw loweringFailure("Aggregate return destination has no certified pointer home", source);
  }
  return Object.freeze({ kind: "storage", requestId, bytes: 2, signed: false });
}

/** Copy the contents of one already materialized pointer into another. */
function copyPointer(
  instructions: MachineInstruction[],
  from: LoweredValue,
  to: LoweredValue,
  state: FunctionLoweringState,
  source: SourceSpan,
): void {
  for (let offset = 0; offset < 2; offset += 1) {
    appendLoadA(instructions, from, offset, state, source);
    instructions.push(storeA(to, offset, state, source));
  }
}

/** Store the address of a direct data home into the callee's hidden destination pointer. */
function addressOfDirectHome(
  instructions: MachineInstruction[],
  home: Extract<LoweredValue, { readonly kind: "storage" | "label" }>,
  pointer: LoweredValue,
  state: FunctionLoweringState,
  source: SourceSpan,
): void {
  for (const addressByte of ["low", "high"] as const) {
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "lda",
        "immediate",
        home.kind === "storage"
          ? Object.freeze({
              kind: "storage" as const,
              requestId: home.requestId,
              offset: 0,
              addressByte,
            })
          : Object.freeze({ kind: "label" as const, label: home.label, offset: 0, addressByte }),
        [],
        source,
      ),
      storeA(pointer, addressByte === "low" ? 0 : 1, state, source),
    );
  }
}

/** Resolve one source place to direct bytes or a retained indirect pointer. */
function sourcePlace(
  place: SemanticPlace,
  bytes: number,
  state: FunctionLoweringState,
  source: SourceSpan,
  valueId: string,
): {
  readonly instructions: readonly MachineInstruction[];
  readonly value: LoweredValue;
  readonly indirect: boolean;
} {
  if (place.path.length === 0) {
    const value = loweredPlace(place, bytes, false, state);
    if (value.kind !== "storage" || !value.requestId.includes(":parameter:")) {
      return Object.freeze({ instructions: Object.freeze([]), value, indirect: false });
    }
  }
  const address = lowerAggregateAddress(place, state, source, `return-source:${valueId}`);
  return Object.freeze({
    instructions: address.instructions,
    value: address.pointer,
    indirect: true,
  });
}

/** Load one source byte, preserving full 16-bit address formation for indirect places. */
function appendSourceByte(
  instructions: MachineInstruction[],
  value: LoweredValue,
  indirect: boolean,
  offset: number,
  state: FunctionLoweringState,
  source: SourceSpan,
): void {
  if (!indirect) {
    appendLoadA(instructions, value, offset, state, source);
    return;
  }
  if (value.kind !== "storage")
    throw loweringFailure("Indirect aggregate has no pointer home", source);
  instructions.push(
    machineInstruction(
      state.input.profile.cpu,
      "ldy",
      "immediate",
      Object.freeze({ kind: "immediate", value: offset & 0xff }),
      [],
      source,
    ),
    machineInstruction(
      state.input.profile.cpu,
      "lda",
      "indirect-indexed-y",
      Object.freeze({ kind: "indirect-y", requestId: value.requestId, offset: 0 }),
      [],
      source,
    ),
  );
}

/** Advance a retained page base after 256 copied bytes. */
function advancePointerPage(
  instructions: MachineInstruction[],
  value: LoweredValue,
  state: FunctionLoweringState,
  source: SourceSpan,
): void {
  if (value.kind !== "storage")
    throw loweringFailure("Aggregate page base has no pointer home", source);
  instructions.push(
    machineInstruction(
      state.input.profile.cpu,
      "inc",
      "storage",
      Object.freeze({ kind: "storage", requestId: value.requestId, offset: 1 }),
      [],
      source,
    ),
  );
}

/** Supply the callee's hidden pointer from a final object or a caller-owned temporary. */
export function prepareAggregateCallResult(
  resultId: string,
  callee: BindingId,
  type: Extract<SemanticType, { readonly kind: "array" | "struct" }>,
  destination: AggregateDestination | undefined,
  state: FunctionLoweringState,
  source: SourceSpan,
): { readonly instructions: readonly MachineInstruction[]; readonly result: LoweredValue } {
  const pointer = resultPointer(callee, state, source);
  const instructions: MachineInstruction[] = [];
  if (destination?.kind === "caller") {
    const ownerPointer = resultPointer(state.owner, state, source);
    copyPointer(instructions, ownerPointer, pointer, state, source);
    state.directCallerResults.add(resultId);
    return Object.freeze({ instructions: Object.freeze(instructions), result: ownerPointer });
  }
  if (destination?.kind === "place") {
    const place = destination.place;
    const root = loweredPlace(place, type.size, false, state);
    if (
      place.path.length === 0 &&
      (root.kind === "storage" || root.kind === "label") &&
      (root.kind !== "storage" || !root.requestId.includes(":parameter:"))
    ) {
      addressOfDirectHome(instructions, root, pointer, state, source);
      state.aggregatePlaces.set(resultId, place);
      return Object.freeze({ instructions: Object.freeze(instructions), result: root });
    }
    const address = lowerAggregateAddress(place, state, source, `call-destination:${resultId}`);
    instructions.push(...address.instructions);
    copyPointer(instructions, address.pointer, pointer, state, source);
    state.aggregatePlaces.set(resultId, place);
    return Object.freeze({ instructions: Object.freeze(instructions), result: address.pointer });
  }
  const request = requestStorage(
    state,
    `aggregate-result:${resultId}`,
    "temporary",
    type.size,
    "ram",
    source,
    "Caller-owned aggregate expression result",
    type,
  );
  const result: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: request.id,
    bytes: type.size,
    signed: false,
  });
  addressOfDirectHome(instructions, result, pointer, state, source);
  return Object.freeze({ instructions: Object.freeze(instructions), result });
}

/** Deliver a complete fixed result into the pointer provided by its caller. */
export function lowerAggregateReturn(
  valueId: string,
  type: Extract<SemanticType, { readonly kind: "array" | "struct" }>,
  state: FunctionLoweringState,
  source: SourceSpan,
): readonly MachineInstruction[] {
  if (state.directCallerResults.has(valueId)) return Object.freeze([]);
  const destination = resultPointer(state.owner, state, source);
  const place = state.aggregatePlaces.get(valueId);
  const resolved =
    place === undefined ? null : sourcePlace(place, type.size, state, source, valueId);
  const value = resolved?.value ?? state.values.get(valueId);
  if (value === undefined || value.kind === "condition") {
    throw loweringFailure("Aggregate return value was not retained", source);
  }
  const indirect = resolved?.indirect ?? false;
  const instructions: MachineInstruction[] = [...(resolved?.instructions ?? [])];
  for (let offset = 0; offset < type.size; offset += 1) {
    if (offset > 0 && (offset & 0xff) === 0) {
      if (indirect) advancePointerPage(instructions, value, state, source);
      advancePointerPage(instructions, destination, state, source);
    }
    appendSourceByte(instructions, value, indirect, offset, state, source);
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "ldy",
        "immediate",
        Object.freeze({ kind: "immediate", value: offset & 0xff }),
        [],
        source,
      ),
      machineInstruction(
        state.input.profile.cpu,
        "sta",
        "indirect-indexed-y",
        Object.freeze({ kind: "indirect-y", requestId: destination.requestId, offset: 0 }),
        [],
        source,
      ),
    );
  }
  return Object.freeze(instructions);
}
