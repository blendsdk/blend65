import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticOperation, SemanticPlace } from "../semantic/operations.js";
import {
  aggregateDestination,
  lowerAggregateAddress,
  restoreAggregateDestinationPage,
} from "./lower-aggregate.js";
import type { PackedHome } from "./lower-aggregate-copy.js";
import { lowerDirectionalCopyLoops } from "./lower-aggregate-direction.js";
import { machineInstruction, type LoweredValue } from "./lower-control.js";
import type { MachineBlock, MachineInstruction, MachineOperand } from "./machine-types.js";
import {
  appendLoadA,
  loweredPlace,
  loweringFailure,
  requestStorage,
  storeA,
  type FunctionLoweringState,
  typeBytes,
} from "./lower.js";

/** One member of a packed aggregate in its final byte position. */
interface MemberWrite {
  readonly valueId: string;
  readonly start: number;
  readonly bytes: number;
}

/** An existing aggregate object's bytes, rather than its lowered address value. */
interface MemberSource {
  readonly value: LoweredValue;
  readonly indirect: boolean;
}

/** Expand declared members into final offsets after their expressions were evaluated. */
function memberWrites(
  operation: Extract<SemanticOperation, { readonly kind: "aggregate" }>,
): readonly MemberWrite[] {
  if (operation.type.kind === "array") {
    if (operation.elements.length > operation.type.length) {
      throw loweringFailure(
        "Aggregate has more elements than its fixed array type",
        operation.span,
      );
    }
    const bytes = typeBytes(operation.type.element);
    return Object.freeze(
      Array.from({ length: operation.type.length }, (_, index) => {
        const valueId = operation.elements[index]?.value ?? operation.fill;
        if (valueId === null || valueId === undefined) {
          throw loweringFailure("Fixed array construction is missing an element", operation.span);
        }
        return Object.freeze({ valueId, start: index * bytes, bytes });
      }),
    );
  }
  if (operation.type.kind !== "struct") {
    throw loweringFailure("Aggregate construction requires an aggregate type", operation.span);
  }
  const byField = new Map(
    operation.elements.flatMap(({ field, value }) =>
      field === null ? [] : [[field, value] as const],
    ),
  );
  return Object.freeze(
    operation.type.fields.map((field) => {
      const valueId = byField.get(field.name);
      if (valueId === undefined) {
        throw loweringFailure(
          `Struct construction is missing field '${field.name}'`,
          operation.span,
        );
      }
      return Object.freeze({ valueId, start: field.offset, bytes: typeBytes(field.type) });
    }),
  );
}

/** Resolve a complete source object without interpreting its address bytes as content. */
function placeSource(
  place: SemanticPlace,
  bytes: number,
  valueId: string,
  state: FunctionLoweringState,
  operation: Extract<SemanticOperation, { readonly kind: "aggregate" | "place-address" }>,
): { readonly setup: readonly MachineInstruction[]; readonly source: MemberSource } {
  if (place.path.length === 0) {
    const value = loweredPlace(place, bytes, false, state);
    if (value.kind !== "storage" || !value.requestId.includes(":parameter:")) {
      return { setup: Object.freeze([]), source: { value, indirect: false } };
    }
  }
  const address = lowerAggregateAddress(
    place,
    state,
    operation.span,
    `construct-source:${valueId}`,
  );
  return {
    setup: address.instructions,
    source: { value: address.pointer, indirect: true },
  };
}

/** Read one byte from either an object home or a retained page pointer. */
function readMemberByte(
  instructions: MachineInstruction[],
  source: MemberSource,
  offset: number,
  state: FunctionLoweringState,
  operation: Extract<SemanticOperation, { readonly kind: "aggregate" | "place-address" }>,
): void {
  if (!source.indirect) {
    appendLoadA(instructions, source.value, offset, state, operation.span);
    return;
  }
  if (source.value.kind !== "storage") {
    throw loweringFailure("Aggregate source has no pointer home", operation.span);
  }
  if (offset > 0 && (offset & 0xff) === 0) {
    instructions.push(
      machineInstruction(
        state.input.profile.cpu,
        "inc",
        "storage",
        Object.freeze({ kind: "storage", requestId: source.value.requestId, offset: 1 }),
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
      Object.freeze({ kind: "immediate", value: offset & 0xff }),
      [],
      operation.span,
    ),
    machineInstruction(
      state.input.profile.cpu,
      "lda",
      "indirect-indexed-y",
      Object.freeze({ kind: "indirect-y", requestId: source.value.requestId, offset: 0 }),
      [],
      operation.span,
    ),
  );
}

/** Capture an aggregate source at its evaluation point before later effects run. */
export function lowerCapturedAggregatePlace(
  operation: Extract<SemanticOperation, { readonly kind: "place-address" }>,
  state: FunctionLoweringState,
): { readonly instructions: readonly MachineInstruction[]; readonly result: LoweredValue } {
  const bytes = typeBytes(operation.type);
  const request = requestStorage(
    state,
    `construct-capture:${operation.result}`,
    "temporary",
    bytes,
    "ram",
    operation.span,
    "Preserve an evaluated aggregate member before later effects",
    operation.type,
  );
  const result: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: request.id,
    bytes,
    signed: false,
  });
  const source = placeSource(operation.place, bytes, operation.result, state, operation);
  const instructions: MachineInstruction[] = [...source.setup];
  for (let offset = 0; offset < bytes; offset += 1) {
    readMemberByte(instructions, source.source, offset, state, operation);
    instructions.push(storeA(result, offset, state, operation.span));
  }
  return Object.freeze({ instructions: Object.freeze(instructions), result });
}

/** Determine whether an aggregate contains a member that needs a counted copy. */
export function hasLargeAggregateMember(
  operation: Extract<SemanticOperation, { readonly kind: "aggregate" }>,
): boolean {
  return memberWrites(operation).some(({ bytes }) => bytes >= 8);
}

/** Form a stable two-byte pointer without changing the source value's own address. */
function copyAddressToPointer(
  value: LoweredValue,
  indirect: boolean,
  offset: number,
  role: "source" | "target",
  operation: Extract<SemanticOperation, { readonly kind: "aggregate" | "place-address" }>,
  state: FunctionLoweringState,
): PackedHome {
  const request = requestStorage(
    state,
    `construct-member-${role}:${operation.result}`,
    "pointer",
    2,
    "zero-page-required",
    operation.span,
    "Address one nested aggregate member during its copy",
  );
  const pointer: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: request.id,
    bytes: 2,
    signed: false,
  });
  const instructions: MachineInstruction[] = [];
  for (const addressByte of ["low", "high"] as const) {
    if (indirect) {
      appendLoadA(instructions, value, addressByte === "low" ? 0 : 1, state, operation.span);
    } else {
      let operand: MachineOperand;
      if (value.kind === "storage") {
        operand = Object.freeze({
          kind: "storage",
          requestId: value.requestId,
          offset: value.offset ?? 0,
          addressByte,
        });
      } else if (value.kind === "label") {
        operand = Object.freeze({ kind: "label", label: value.label, offset: 0, addressByte });
      } else {
        throw loweringFailure("Nested aggregate has no addressable home", operation.span);
      }
      instructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "lda",
          "immediate",
          operand,
          [],
          operation.span,
        ),
      );
    }
    instructions.push(storeA(pointer, addressByte === "low" ? 0 : 1, state, operation.span));
  }
  if (offset > 0) {
    instructions.push(
      machineInstruction(state.input.profile.cpu, "clc", "implied", null, [], operation.span),
      machineInstruction(
        state.input.profile.cpu,
        "lda",
        "storage",
        Object.freeze({ kind: "storage", requestId: request.id, offset: 0 }),
        [],
        operation.span,
      ),
      machineInstruction(
        state.input.profile.cpu,
        "adc",
        "immediate",
        Object.freeze({ kind: "immediate", value: offset & 0xff }),
        [],
        operation.span,
      ),
      storeA(pointer, 0, state, operation.span),
      machineInstruction(
        state.input.profile.cpu,
        "lda",
        "storage",
        Object.freeze({ kind: "storage", requestId: request.id, offset: 1 }),
        [],
        operation.span,
      ),
      machineInstruction(
        state.input.profile.cpu,
        "adc",
        "immediate",
        Object.freeze({ kind: "immediate", value: (offset >> 8) & 0xff }),
        [],
        operation.span,
      ),
      storeA(pointer, 1, state, operation.span),
    );
  }
  return Object.freeze({
    instructions: Object.freeze(instructions),
    value: pointer,
    indirect: true,
  });
}

/** Capture a large value before a later effect using one bounded forward copy loop. */
export function lowerLargeCapturedAggregatePlace(
  operation: Extract<SemanticOperation, { readonly kind: "place-address" }>,
  state: FunctionLoweringState,
  entryLabel: string,
  prefix: readonly MachineInstruction[],
  ordinal: number,
): { readonly blocks: readonly MachineBlock[]; readonly continuation: string } {
  const bytes = typeBytes(operation.type);
  const request = requestStorage(
    state,
    `construct-capture:${operation.result}`,
    "temporary",
    bytes,
    "ram",
    operation.span,
    "Preserve an evaluated aggregate member before later effects",
    operation.type,
  );
  const result: LoweredValue = Object.freeze({
    kind: "storage",
    requestId: request.id,
    bytes,
    signed: false,
  });
  const source = placeSource(operation.place, bytes, operation.result, state, operation);
  const from = copyAddressToPointer(
    source.source.value,
    source.source.indirect,
    0,
    "source",
    operation,
    state,
  );
  const to = copyAddressToPointer(result, false, 0, "target", operation, state);
  state.values.set(operation.result, result);
  return lowerDirectionalCopyLoops(
    from,
    to,
    bytes,
    state,
    entryLabel,
    [...prefix, ...source.setup, ...from.instructions, ...to.instructions],
    ordinal,
    operation.span,
    true,
  );
}

/** Return a known field offset, or null when a runtime index decides the address. */
function staticPlaceOffset(place: SemanticPlace): number | null {
  let type = place.rootType;
  let offset = 0;
  for (const step of place.path) {
    if (step.kind !== "field" || type?.kind !== "struct") return null;
    const field = type.fields.find(({ name }) => name === step.name);
    if (field === undefined) return null;
    offset += field.offset;
    type = field.type;
  }
  return offset;
}

/** Stage a later source only if an earlier member write could destroy its bytes. */
function earlierWriteMayOverlap(
  source: SemanticPlace,
  sourceBytes: number,
  earlier: readonly MemberWrite[],
  target: SemanticPlace | null,
): boolean {
  if (earlier.length === 0) return false;
  if (target === null || bindingIdentityKey(source.root) !== bindingIdentityKey(target.root)) {
    return true;
  }
  const sourceStart = staticPlaceOffset(source);
  const targetStart = staticPlaceOffset(target);
  if (sourceStart === null || targetStart === null) return true;
  return earlier.some(
    ({ start, bytes }) =>
      sourceStart < targetStart + start + bytes && targetStart + start < sourceStart + sourceBytes,
  );
}

/** Lower large nested members with bounded page loops and only needed staging. */
export function lowerLargeAggregateBuild(
  operation: Extract<SemanticOperation, { readonly kind: "aggregate" }>,
  state: FunctionLoweringState,
  entryLabel: string,
  prefix: readonly MachineInstruction[],
  ordinal: number,
): {
  readonly blocks: readonly MachineBlock[];
  readonly continuation: string;
  readonly continuationInstructions: readonly MachineInstruction[];
} {
  const destination = aggregateDestination(operation, state);
  const writes = memberWrites(operation);
  const memberUseCounts = new Map<string, number>();
  for (const { valueId } of writes) {
    memberUseCounts.set(valueId, (memberUseCounts.get(valueId) ?? 0) + 1);
  }
  const targetPlace = operation.destination?.kind === "place" ? operation.destination.place : null;
  const blocks: MachineBlock[] = [];
  let currentLabel = entryLabel;
  let pending: MachineInstruction[] = [...prefix, ...destination.instructions];
  let copyIndex = 0;
  const staged = new Map<string, MemberSource>();

  const emitLargeCopy = (
    source: MemberSource,
    setup: readonly MachineInstruction[],
    target: MemberSource,
    targetOffset: number,
    bytes: number,
    knownForward: boolean,
    directTargetPointer = false,
  ): void => {
    const from: PackedHome = source.indirect
      ? Object.freeze({ instructions: Object.freeze([]), value: source.value, indirect: true })
      : copyAddressToPointer(source.value, false, 0, "source", operation, state);
    const to: PackedHome =
      directTargetPointer && target.indirect
        ? Object.freeze({ instructions: Object.freeze([]), value: target.value, indirect: true })
        : copyAddressToPointer(
            target.value,
            target.indirect,
            targetOffset,
            "target",
            operation,
            state,
          );
    const moved = lowerDirectionalCopyLoops(
      from,
      to,
      bytes,
      state,
      currentLabel,
      [...pending, ...setup, ...from.instructions, ...to.instructions],
      ordinal * 100 + copyIndex,
      operation.span,
      knownForward,
    );
    blocks.push(...moved.blocks);
    currentLabel = moved.continuation;
    pending = [];
    copyIndex += 1;
  };

  // Only values that a preceding field write may overwrite need a snapshot.
  for (const [index, { valueId, bytes }] of writes.entries()) {
    if (staged.has(valueId) || bytes === 0) continue;
    const place = state.aggregatePlaces.get(valueId);
    if (place === undefined) continue;
    const root = loweredPlace(place, bytes, false, state);
    const borrowedRoot = root.kind === "storage" && root.requestId.includes(":parameter:");
    const mayAlias =
      destination.indirect ||
      borrowedRoot ||
      (targetPlace !== null &&
        bindingIdentityKey(targetPlace.root) === bindingIdentityKey(place.root));
    const mustStage =
      (bytes < 8 && mayAlias) ||
      (index > 0 &&
        mayAlias &&
        earlierWriteMayOverlap(place, bytes, writes.slice(0, index), targetPlace));
    if (!mustStage) continue;
    const resolved = placeSource(place, bytes, valueId, state, operation);
    const request = requestStorage(
      state,
      `construct-snapshot:${valueId}`,
      "temporary",
      bytes,
      "ram",
      operation.span,
      "Preserve a nested member needed after an overlapping write",
    );
    const snapshot: LoweredValue = Object.freeze({
      kind: "storage",
      requestId: request.id,
      bytes,
      signed: false,
    });
    if (bytes >= 8) {
      emitLargeCopy(
        resolved.source,
        resolved.setup,
        { value: snapshot, indirect: false },
        0,
        bytes,
        true,
      );
    } else {
      pending.push(...resolved.setup);
      for (let offset = 0; offset < bytes; offset += 1) {
        readMemberByte(pending, resolved.source, offset, state, operation);
        pending.push(storeA(snapshot, offset, state, operation.span));
      }
    }
    staged.set(valueId, { value: snapshot, indirect: false });
  }

  for (const { valueId, start, bytes } of writes) {
    if (bytes === 0) continue;
    const place = staged.has(valueId) ? undefined : state.aggregatePlaces.get(valueId);
    const retained = state.values.get(valueId);
    // A sole consumer may advance the evaluated address itself. A second consumer
    // must keep that address intact, so it receives a separate working pointer.
    const useEvaluatedPointer =
      place !== undefined &&
      state.singleUseValues.has(valueId) &&
      memberUseCounts.get(valueId) === 1 &&
      retained?.kind === "storage" &&
      retained.requestId.endsWith(`:aggregate-address:${valueId}`);
    const resolved =
      place === undefined
        ? null
        : useEvaluatedPointer
          ? { setup: Object.freeze([]), source: { value: retained, indirect: true } }
          : placeSource(place, bytes, valueId, state, operation);
    const source =
      staged.get(valueId) ??
      resolved?.source ??
      (retained === undefined ? null : { value: retained, indirect: false });
    if (
      source === null ||
      source.value.kind === "condition" ||
      (!source.indirect && source.value.bytes < bytes)
    ) {
      throw loweringFailure("Aggregate member has no complete lowered value", operation.span);
    }
    if (bytes >= 8) {
      const knownForward =
        staged.has(valueId) ||
        (place !== undefined &&
          targetPlace !== null &&
          !destination.indirect &&
          !source.indirect &&
          bindingIdentityKey(place.root) !== bindingIdentityKey(targetPlace.root));
      emitLargeCopy(
        source,
        resolved?.setup ?? [],
        { value: destination.result, indirect: destination.indirect },
        start,
        bytes,
        knownForward,
        writes.length === 1 && start === 0 && !state.retainedAggregateResults.has(operation.result),
      );
      continue;
    }
    pending.push(...(resolved?.setup ?? []));
    const targetPointer = destination.indirect
      ? copyAddressToPointer(destination.result, true, start, "target", operation, state)
      : null;
    if (targetPointer !== null) pending.push(...targetPointer.instructions);
    for (let offset = 0; offset < bytes; offset += 1) {
      readMemberByte(pending, source, offset, state, operation);
      if (targetPointer === null) {
        pending.push(storeA(destination.result, start + offset, state, operation.span));
      } else {
        if (targetPointer.value.kind !== "storage") {
          throw loweringFailure("Nested member pointer has no home", operation.span);
        }
        pending.push(
          machineInstruction(
            state.input.profile.cpu,
            "ldy",
            "immediate",
            Object.freeze({ kind: "immediate", value: offset }),
            [],
            operation.span,
          ),
          machineInstruction(
            state.input.profile.cpu,
            "sta",
            "indirect-indexed-y",
            Object.freeze({
              kind: "indirect-y",
              requestId: targetPointer.value.requestId,
              offset: 0,
            }),
            [],
            operation.span,
          ),
        );
      }
    }
  }
  state.values.set(operation.result, destination.result);
  return Object.freeze({
    blocks: Object.freeze(blocks),
    continuation: currentLabel,
    continuationInstructions: Object.freeze(pending),
  });
}

/** Lower one fixed aggregate directly into its final packed object. */
export function lowerAggregate(
  operation: Extract<SemanticOperation, { readonly kind: "aggregate" }>,
  state: FunctionLoweringState,
): { readonly instructions: readonly MachineInstruction[]; readonly result: LoweredValue } {
  const destination = aggregateDestination(operation, state);
  const writes = memberWrites(operation);
  const instructions: MachineInstruction[] = [...destination.instructions];
  const sources = new Map<string, MemberSource>();

  // A member expression is evaluated before construction starts. Snapshot only sources
  // that can be overwritten by this destination or whose indirect page pointer is mutable.
  for (const { valueId, bytes } of writes) {
    if (sources.has(valueId) || bytes === 0) continue;
    const place = state.aggregatePlaces.get(valueId);
    if (place === undefined) continue;
    const resolved = placeSource(place, bytes, valueId, state, operation);
    instructions.push(...resolved.setup);
    const targetPlace =
      operation.destination?.kind === "place" ? operation.destination.place : null;
    const mayAlias =
      destination.indirect ||
      (targetPlace !== null &&
        bindingIdentityKey(targetPlace.root) === bindingIdentityKey(place.root));
    if (!mayAlias && !resolved.source.indirect) {
      sources.set(valueId, resolved.source);
      continue;
    }
    const request = requestStorage(
      state,
      `construct-snapshot:${valueId}`,
      "temporary",
      bytes,
      "ram",
      operation.span,
      "Preserve a nested aggregate value",
    );
    const staged: LoweredValue = Object.freeze({
      kind: "storage",
      requestId: request.id,
      bytes,
      signed: false,
    });
    for (let offset = 0; offset < bytes; offset += 1) {
      readMemberByte(instructions, resolved.source, offset, state, operation);
      instructions.push(storeA(staged, offset, state, operation.span));
    }
    sources.set(valueId, { value: staged, indirect: false });
  }

  let destinationPage = 0;
  for (const { valueId, start, bytes } of writes) {
    const retained = state.values.get(valueId);
    const source =
      sources.get(valueId) ??
      (retained === undefined ? null : { value: retained, indirect: false });
    if (source === null || source.value.kind === "condition" || source.value.bytes < bytes) {
      throw loweringFailure("Aggregate element has no complete lowered value", operation.span);
    }
    for (let offset = 0; offset < bytes; offset += 1) {
      readMemberByte(instructions, source, offset, state, operation);
      if (destination.indirect) {
        if (destination.result.kind !== "storage") {
          throw loweringFailure("Aggregate destination has no pointer home", operation.span);
        }
        const nextPage = Math.floor((start + offset) / 256);
        while (destinationPage < nextPage) {
          instructions.push(
            machineInstruction(
              state.input.profile.cpu,
              "inc",
              "storage",
              Object.freeze({
                kind: "storage",
                requestId: destination.result.requestId,
                offset: 1,
              }),
              [],
              operation.span,
            ),
          );
          destinationPage += 1;
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
            Object.freeze({
              kind: "indirect-y",
              requestId: destination.result.requestId,
              offset: 0,
            }),
            [],
            operation.span,
          ),
        );
      } else {
        instructions.push(storeA(destination.result, start + offset, state, operation.span));
      }
    }
  }
  instructions.push(
    ...restoreAggregateDestinationPage(
      destination.result,
      destination.indirect,
      destinationPage,
      operation,
      state,
    ),
  );
  return Object.freeze({ instructions: Object.freeze(instructions), result: destination.result });
}
