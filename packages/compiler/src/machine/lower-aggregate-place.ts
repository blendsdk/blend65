import type { SemanticPlace } from "../semantic/operations.js";
import type { SourceSpan } from "../project/types.js";
import type { AggregateIndexTerm } from "./lower-aggregate-index.js";
import { loweringFailure, typeBytes, type FunctionLoweringState } from "./lower-state.js";

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
