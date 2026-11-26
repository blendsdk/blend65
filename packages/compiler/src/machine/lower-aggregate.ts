import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticOperation } from "../semantic/operations.js";
import type { FixedLoopFacts } from "../semantic/fixed-loop-facts.js";
import { declaredStorage } from "../storage/selection.js";
import { potentialValueInputs } from "../semantic/value-lifetimes.js";
import { selectedStoragePlace } from "../storage/selection.js";
import { machineInstruction, type LoweredValue } from "./lower-control.js";
import type { MachineInstruction } from "./machine-types.js";
import { aggregateAddressPlan, lowerAggregateAddress } from "./lower-aggregate-place.js";
import {
  loweringFailure,
  aggregateResultPointer,
  appendLoadA,
  isSignedType,
  isReturnedLocalPlace,
  loweredPlace,
  requestStorage,
  storeA,
  type FunctionLoweringState,
  typeBytes,
} from "./lower-state.js";

import {
  directAggregateAccess,
  directIndexInstructions,
  directIndexMaximum,
  directMode,
  directOperand,
  observeTypedAccess,
  storesItsOwnIndex,
} from "./lower-aggregate-direct.js";

export { lowerAggregateAddress } from "./lower-aggregate-place.js";
export { canUseFixedCounterIndex } from "./lower-aggregate-direct.js";
export { derivedIndicesAreInBounds } from "../semantic/aggregate-place-proof.js";

/**
 * Keep expanded body values inside their original dynamic iteration.
 * @param loop Original source loop, never a rewritten machine occurrence.
 * @param values Source values defined by the body being expanded.
 * @returns Whether no other block or terminator consumes a body-produced value.
 */
export function bodyValuesStayLocal(loop: FixedLoopFacts, values: ReadonlySet<string>): boolean {
  for (const block of loop.function.blocks) {
    if (block === loop.body) continue;
    if (
      block.operations.some((operation) =>
        potentialValueInputs(operation).some((value) => values.has(value)),
      )
    )
      return false;
    const edge = block.terminator;
    if (
      (edge.kind === "branch" && values.has(edge.condition)) ||
      (edge.kind === "return" && edge.value !== null && values.has(edge.value))
    )
      return false;
  }
  return true;
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
      const access = machineInstruction(
        state.input.profile.cpu,
        "lda",
        directMode(direct),
        directOperand(direct, offset),
        [],
        operation.span,
      );
      instructions.push(
        observeTypedAccess(
          access,
          operation,
          state,
          offset,
          direct,
          0,
          directIndexMaximum(operation, direct, state),
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
    // A short borrowed-field construction may already establish this exact Y.
    // No instruction intervenes before the read, so reloading zero is redundant.
    if (address.zeroIndexInY !== true || offset !== 0 || address.displacement !== 0)
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
    const access = machineInstruction(
      state.input.profile.cpu,
      "lda",
      "indirect-indexed-y",
      Object.freeze({ kind: "indirect-y", requestId: address.pointer.requestId, offset: 0 }),
      [],
      operation.span,
    );
    instructions.push(
      observeTypedAccess(access, operation, state, offset, null, address.displacement),
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
  if (
    process.env.BLEND65_DEBUG_STORE === "1" &&
    operation.span.start > 14600 &&
    operation.span.start < 16400
  )
    process.stderr.write(
      `STORE span=${operation.span.start} direct=${JSON.stringify(direct)} placeRootType=${operation.place.rootType?.kind ?? "none"} path=${JSON.stringify(operation.place.path)} value=${JSON.stringify(operation.value)}\n`,
    );
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
    const indexInA =
      direct.kind === "indexed" && storesItsOwnIndex(direct, value, operation.type, state);
    if (indexInA) {
      appendLoadA(instructions, value, 0, state, operation.span);
      instructions.push(
        machineInstruction(state.input.profile.cpu, "tay", "implied", null, [], operation.span),
      );
    } else if (direct.kind === "indexed")
      instructions.push(...directIndexInstructions(direct, state, operation.span));
    for (let offset = 0; offset < typeBytes(operation.type); offset += 1) {
      if (offset > 0 && direct.kind === "indexed")
        instructions.push(
          machineInstruction(state.input.profile.cpu, "iny", "implied", null, [], operation.span),
        );
      if (offset > 0 || !indexInA) appendLoadA(instructions, value, offset, state, operation.span);
      const access = machineInstruction(
        state.input.profile.cpu,
        "sta",
        directMode(direct),
        directOperand(direct, offset),
        [],
        operation.span,
      );
      instructions.push(
        observeTypedAccess(
          access,
          operation,
          state,
          offset,
          direct,
          0,
          directIndexMaximum(operation, direct, state),
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
    // Value loading below writes A only; this construction-owned Y remains zero.
    if (address.zeroIndexInY !== true || offset !== 0 || address.displacement !== 0)
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
    const access = machineInstruction(
      state.input.profile.cpu,
      "sta",
      "indirect-indexed-y",
      Object.freeze({ kind: "indirect-y", requestId: address.pointer.requestId, offset: 0 }),
      [],
      operation.span,
    );
    instructions.push(
      observeTypedAccess(access, operation, state, offset, null, address.displacement),
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
    state.aggregatePlaces.set(
      operation.result,
      state.input.sourceFacts?.objectOnly === true
        ? selectedStoragePlace(operation.destination.place, state.sourceFacts?.storage)
        : operation.destination.place,
    );
  } else if (operation.destination?.kind === "caller") {
    const selected = state.sourceFacts?.storage?.result;
    result =
      selected === undefined || selected === null
        ? aggregateResultPointer(state.owner, state, operation.span)
        : loweredPlace(selected.origin.place, operation.type.size, false, state);
    indirect = selected === undefined || selected === null;
    state.directCallerResults.add(operation.result);
  } else if (
    operation.destination?.kind === "place" &&
    operation.destination.place.path.length === 0
  ) {
    const place = operation.destination.place;
    const objectOnly = state.input.sourceFacts?.objectOnly === true;
    const selected = selectedStoragePlace(place, state.sourceFacts?.storage);
    const replaced = objectOnly && isReturnedLocalPlace(place, state) && selected !== place;
    const home = loweredPlace(
      objectOnly && replaced ? selected : place,
      operation.type.size,
      false,
      state,
    );
    if (
      home.kind === "storage" &&
      (home.requestId.includes(":parameter:") ||
        (!replaced && isReturnedLocalPlace(place, state) && selected === place))
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
    state.aggregatePlaces.set(operation.result, objectOnly && replaced ? selected : place);
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
 * Select a fresh private local's complete, non-wrapping child interval.
 * Check its declared byte width and bounds, not an unallocated physical address.
 * Physical placement is certified later; missing proof retains ordinary lowering.
 */
function freshAggregateHome(
  operation: Extract<SemanticOperation, { readonly kind: "aggregate" }>,
  state: FunctionLoweringState,
): Extract<LoweredValue, { readonly kind: "storage" }> | null {
  const destination = operation.destination;
  if (destination?.kind !== "place" || destination.freshConstant !== true) return null;
  const place = destination.place;
  const selectedPlace =
    state.input.sourceFacts?.objectOnly === true
      ? selectedStoragePlace(place, state.sourceFacts?.storage)
      : place;
  if (selectedPlace.rootType === undefined || selectedPlace.asset !== undefined) return null;
  const bytes = typeBytes(operation.type);
  const rootBytes = typeBytes(selectedPlace.rootType);
  const root = loweredPlace(selectedPlace, rootBytes, false, state);
  if (
    root.kind !== "storage" ||
    !root.requestId.endsWith(`:local:${bindingIdentityKey(selectedPlace.root)}`)
  )
    return null;
  const home = declaredStorage(state.input, (id) => id === root.requestId);
  const plan = aggregateAddressPlan(selectedPlace, state, operation.span);
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
