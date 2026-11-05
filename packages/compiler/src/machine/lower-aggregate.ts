import { bindingIdentityKey, type SemanticType } from "../frontend/semantic-types.js";
import type { SemanticOperation, SemanticPlace } from "../semantic/operations.js";
import type { SourceSpan } from "../project/types.js";
import type { FixedLoopFacts } from "../semantic/fixed-loop-facts.js";
import { declaredStorage } from "../storage/selection.js";
import { potentialValueInputs } from "../semantic/value-lifetimes.js";
import { selectedStoragePlace } from "../storage/selection.js";
import {
  machineInstruction,
  modeForValue,
  operandForValue,
  type LoweredValue,
} from "./lower-control.js";
import type { MachineInstruction, MachineOperand, MachineObserverOrigin } from "./machine-types.js";
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
      /** A proved held counter needs no Y setup and may index through X. */
      readonly register?: "x" | "y";
    };

/** Retain the actual typed construction without inventing a numeric pointer or widening its bound. */
/** Prove the scaled byte index of one direct indexed access from existing ordinal bounds. */
function directIndexMaximum(
  operation: Extract<SemanticOperation, { readonly kind: "load" | "store" }>,
  direct: DirectAggregateAccess | null,
  state: FunctionLoweringState,
): number | undefined {
  if (direct?.kind !== "indexed" || state.ordinalBounds === undefined || direct.stride < 1)
    return undefined;
  const values = operation.place.path.flatMap((path) =>
    path.kind === "index" ? [path.value] : [],
  );
  if (values.length !== 1) return undefined;
  const maximum = state.ordinalBounds.get(values[0]!);
  if (maximum === undefined || maximum < 0n) return undefined;
  const scaled = maximum * BigInt(direct.stride);
  return scaled <= 0xffn ? Number(scaled) : undefined;
}

function observeTypedAccess(
  instruction: MachineInstruction,
  operation: Extract<SemanticOperation, { readonly kind: "load" | "store" }>,
  state: FunctionLoweringState,
  byte: number,
  direct: DirectAggregateAccess | null,
  displacement = 0,
  indexValueMaximum?: number,
): MachineInstruction {
  if (!state.input.observerEvidence) return instruction;
  const origin: MachineObserverOrigin = {
    kind: "typed",
    operation,
    position: byte,
    byte,
    length: typeBytes(operation.type),
    recipe:
      direct === null
        ? "typed-indirect"
        : direct.kind === "indexed"
          ? "typed-indexed"
          : "typed-fixed",
    place: selectedStoragePlace(operation.place, state.sourceFacts?.storage),
    indexRegister:
      direct?.kind === "indexed" ? (direct.register ?? "y") : direct === null ? "y" : null,
    displacement: direct?.offset ?? displacement,
    stride: direct?.kind === "indexed" ? direct.stride : 0,
    ...(state.ordinalBounds === undefined ? {} : { indexBounds: state.ordinalBounds }),
    ...(indexValueMaximum === undefined ? {} : { indexValueMaximum }),
  };
  return Object.freeze({ ...instruction, observerOrigins: Object.freeze([Object.freeze(origin)]) });
}

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
): "storage" | "zero-page" | "absolute" | "absolute-y" | "absolute-x" {
  return access.kind === "indexed"
    ? access.register === "x"
      ? "absolute-x"
      : "absolute-y"
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
  // A pointer home names the address, not the object bytes. Returned-local
  // members that resolve to the caller's direct global use the label path.
  if (
    root.kind === "storage" &&
    (root.requestId.includes(":parameter:") || root.requestId.includes(":pointer:"))
  )
    return null;
  const plan = aggregateAddressPlan(place, state, source);
  if (plan.indices.length === 0) {
    return Object.freeze({ kind: "fixed", root, offset: plan.staticOffset });
  }
  if (plan.indices.length !== 1) return null;
  const term = plan.indices[0]!;
  if (term.stride > 1 && (!state.input.boundsCheck || term.extent * term.stride > 256)) return null;
  const retained = state.values.get(plan.indices[0]!.value);
  const held = state.fixedLoops?.indexViews.get(term.value);
  if (
    held !== undefined &&
    held.counter.register !== null &&
    retained !== undefined &&
    (held.consumer.kind === "load" || held.consumer.kind === "store") &&
    held.consumer.place === place &&
    term.stride === 1 &&
    typeBytes(type) === 1
  ) {
    state.fixedLoops?.consumedIndices.add(term.value);
    return Object.freeze({
      kind: "indexed",
      root,
      index: retained,
      offset: plan.staticOffset,
      stride: 1,
      register: held.counter.register,
    });
  }
  const rootKey = state.loadOrigins.get(term.value);
  const counter = rootKey === undefined ? undefined : state.fixedLoops?.counters.get(rootKey);
  /**
   * A bounded word ordinal can use its low byte directly. The loop certificate
   * already proves the high byte is zero, so `absolute-y` addresses the same
   * byte without materializing a 16-bit pointer.
   */
  const ordinalMaximum = state.ordinalBounds?.get(term.value);
  const index =
    retained?.kind === "zero-extended" && !retained.signed
      ? retained.low.kind === "storage" && retained.low.bytes === 1 && retained.low.signed !== true
        ? retained.low
        : counter?.home === retained.low
          ? retained.low
          : retained
      : root.kind === "label" &&
          (isReturnedLocalPlace(place, state) ||
            state.input.program.semantic.functions.some(
              (fn) =>
                bindingIdentityKey(fn.id) === bindingIdentityKey(state.owner) &&
                fn.parameters.some(
                  (parameter) =>
                    bindingIdentityKey(parameter.id) === bindingIdentityKey(place.root) &&
                    (parameter.type.kind === "array" || parameter.type.kind === "struct"),
                ),
            )) &&
          retained?.kind === "storage" &&
          retained.bytes === 2 &&
          retained.signed !== true &&
          ordinalMaximum !== undefined &&
          ordinalMaximum >= 0n &&
          ordinalMaximum < 256n
        ? Object.freeze({ ...retained, bytes: 1 })
        : retained;
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
  if (access.register !== undefined) return Object.freeze([]);
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
 * Check the exact typed byte access before lending a counter register to it.
 * Its proved range removes any guard that would need a materialized ordinal.
 * @param place Original typed source place.
 * @param type Scalar element type of the actual consumer.
 * @param value Exact ordinal source value consumed once at this place.
 * @param maximum Nonnegative source maximum under retained loop premises.
 * @param state Current fixed-object and storage representations.
 * @param source Owning source access, retained for invariant diagnostics.
 * @returns Whether direct absolute indexing uses the held register without setup.
 */
export function canUseFixedCounterIndex(
  place: SemanticPlace,
  type: SemanticType,
  value: string,
  maximum: bigint | undefined,
  state: FunctionLoweringState,
  source: SourceSpan,
): boolean {
  if (
    maximum === undefined ||
    maximum < 0n ||
    place.rootType === undefined ||
    typeBytes(type) !== 1 ||
    (isReturnedLocalPlace(place, state) &&
      selectedStoragePlace(place, state.sourceFacts?.storage) === place)
  )
    return false;
  const root = loweredPlace(place, typeBytes(place.rootType), false, state);
  if (
    (root.kind !== "storage" && root.kind !== "label") ||
    (root.kind === "storage" && root.requestId.includes(":parameter:"))
  )
    return false;
  const plan = aggregateAddressPlan(place, state, source);
  const index = plan.indices[0];
  return (
    plan.indices.length === 1 &&
    index?.value === value &&
    index.stride === 1 &&
    maximum < BigInt(index.extent)
  );
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
    if (direct.kind === "indexed")
      instructions.push(...directIndexInstructions(direct, state, operation.span));
    for (let offset = 0; offset < typeBytes(operation.type); offset += 1) {
      if (offset > 0 && direct.kind === "indexed")
        instructions.push(
          machineInstruction(state.input.profile.cpu, "iny", "implied", null, [], operation.span),
        );
      appendLoadA(instructions, value, offset, state, operation.span);
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
    state.aggregatePlaces.set(operation.result, operation.destination.place);
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
    const home = loweredPlace(place, operation.type.size, false, state);
    if (
      home.kind === "storage" &&
      (home.requestId.includes(":parameter:") ||
        (isReturnedLocalPlace(place, state) &&
          selectedStoragePlace(place, state.sourceFacts?.storage) === place))
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
  if (place.rootType === undefined || place.asset !== undefined) return null;
  const bytes = typeBytes(operation.type);
  const rootBytes = typeBytes(place.rootType);
  const root = loweredPlace(place, rootBytes, false, state);
  if (
    root.kind !== "storage" ||
    !root.requestId.endsWith(`:local:${bindingIdentityKey(place.root)}`)
  )
    return null;
  const home = declaredStorage(state.input, (id) => id === root.requestId);
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
