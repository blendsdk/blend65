import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticOperation, SemanticPlace } from "../semantic/operations.js";
import { aggregateDestination, lowerAggregateAddress } from "./lower-aggregate.js";
import { machineInstruction, type LoweredValue } from "./lower-control.js";
import type { MachineInstruction } from "./machine-types.js";
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
  operation: Extract<SemanticOperation, { readonly kind: "aggregate" }>,
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
  operation: Extract<SemanticOperation, { readonly kind: "aggregate" }>,
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
  return Object.freeze({ instructions: Object.freeze(instructions), result: destination.result });
}
