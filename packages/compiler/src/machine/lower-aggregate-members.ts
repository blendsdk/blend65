import type { SemanticOperation, SemanticPlace } from "../semantic/operations.js";
import { lowerAggregateAddress } from "./lower-aggregate.js";
import { machineInstruction, type LoweredValue } from "./lower-control.js";
import type { MachineInstruction } from "./machine-types.js";
import {
  appendLoadA,
  loweredPlace,
  loweringFailure,
  typeBytes,
  type FunctionLoweringState,
} from "./lower-state.js";

/** One member of a packed aggregate in its final byte position. */
export interface MemberWrite {
  /** Previously evaluated source value. */
  readonly valueId: string;
  /** Member start relative to the destination object. */
  readonly start: number;
  /** Complete packed member extent. */
  readonly bytes: number;
}

/** An existing aggregate object's bytes, rather than its lowered address value. */
export interface MemberSource {
  /** Direct object home or retained pointer to the object. */
  readonly value: LoweredValue;
  /** Whether the value is an address pair instead of object bytes. */
  readonly indirect: boolean;
}

/** Expand declared members into final offsets after their expressions were evaluated. */
export function memberWrites(
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
export function placeSource(
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
  return { setup: address.instructions, source: { value: address.pointer, indirect: true } };
}

/** Read one byte from either an object home or a retained page pointer. */
export function readMemberByte(
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

/**
 * Exclude a child only when its entire completed object is already the final member.
 * Equal root names or overlapping intervals are not enough: both direct homes,
 * request identities, starts and complete extents must match before staging begins.
 */
export function remainingMemberWrites(
  operation: Extract<SemanticOperation, { readonly kind: "aggregate" }>,
  destination: { readonly result: LoweredValue; readonly indirect: boolean },
  state: FunctionLoweringState,
): readonly MemberWrite[] {
  const writes = memberWrites(operation);
  if (
    operation.destination?.kind !== "place" ||
    operation.destination.freshConstant !== true ||
    destination.indirect ||
    destination.result.kind !== "storage"
  )
    return writes;
  const target = destination.result;
  return Object.freeze(
    writes.filter(({ valueId, start, bytes }) => {
      const source = state.values.get(valueId);
      const completed =
        state.aggregatePlaces.has(valueId) &&
        source?.kind === "storage" &&
        source.requestId === target.requestId &&
        source.bytes === bytes &&
        (source.offset ?? 0) === (target.offset ?? 0) + start &&
        start >= 0 &&
        start + bytes <= target.bytes;
      return !completed;
    }),
  );
}

/**
 * Append one proved private construction, reusing only an identical immediate A load.
 * A local STA preserves A/N/Z. Every other instruction or memory observer invalidates
 * that proof. The caller starts each block with no proof and clears it at unrelated
 * source operations and split control flow; this is not a general register optimizer.
 */
export function appendConstantConstruction(
  target: MachineInstruction[],
  selected: readonly MachineInstruction[],
  literalInA: number | null,
  requestId: string,
): number | null {
  for (const instruction of selected) {
    const operand = instruction.operand;
    if (
      instruction.opcode === "lda" &&
      instruction.mode === "immediate" &&
      operand?.kind === "immediate" &&
      instruction.memory.length === 0
    ) {
      if (literalInA === operand.value) continue;
      literalInA = operand.value;
    } else if (
      !(
        instruction.opcode === "sta" &&
        instruction.mode === "storage" &&
        operand?.kind === "storage" &&
        operand.requestId === requestId &&
        instruction.memory.every(({ volatile }) => !volatile)
      )
    ) {
      literalInA = null;
    }
    target.push(instruction);
  }
  return literalInA;
}
