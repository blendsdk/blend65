import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { SemanticOperation, SemanticPlace, ValueId } from "./operations.js";

/** One value definition retained for static address and index resolution. */
export type Definitions = ReadonlyMap<string, SemanticOperation>;

/**
 * Resolve the integer value of one constant expression, or null when it is
 * not compile-time known. Conversions preserve the mathematical value except
 * for truncation, which masks to the converted scalar width.
 */
export function constantValue(
  operation: SemanticOperation | undefined,
  definitions: Definitions,
): number | null {
  if (operation?.kind === "constant")
    return typeof operation.value === "boolean"
      ? operation.value
        ? 1
        : 0
      : Number(operation.value);
  if (operation?.kind !== "convert") return null;
  const value = constantValue(definitions.get(operation.operand), definitions);
  if (value === null) return null;
  if (operation.conversion !== "truncate") return value;
  const bits = semanticTypeSize(operation.type) * 8;
  const mask = 2 ** bits - 1;
  return value & mask;
}

/**
 * Follow only bit-preserving conversions. A narrowing or value-changing
 * conversion means the value is no longer the object's full address, so the
 * block-index shape does not apply.
 */
export function throughConversions(
  value: ValueId,
  definitions: Definitions,
): SemanticOperation | undefined {
  let current = definitions.get(value);
  for (;;) {
    if (
      current?.kind !== "convert" ||
      (current.conversion !== "identity" && current.conversion !== "reinterpret")
    )
      return current;
    current = definitions.get(current.operand);
  }
}

/** Follow widening conversions too; they preserve the numeric value of a selector half. */
export function throughWidening(
  value: ValueId,
  definitions: Definitions,
): SemanticOperation | undefined {
  let current = definitions.get(value);
  for (;;) {
    if (current?.kind !== "convert") return current;
    if (current.conversion === "truncate") return current;
    current = definitions.get(current.operand);
  }
}

/** Locate the address-of operation behind one value, following preserving conversions. */
export function addressOperation(
  value: ValueId,
  definitions: Definitions,
): Extract<SemanticOperation, { readonly kind: "place-address" }> | undefined {
  const operation = throughConversions(value, definitions);
  return operation?.kind === "place-address" ? operation : undefined;
}

/** Locate the operand of a `hi` unary operation behind one preserving conversion. */
export function highByteOperand(value: ValueId, definitions: Definitions): ValueId | null {
  const operation = throughWidening(value, definitions);
  return operation?.kind === "unary" && operation.operator === "hi" ? operation.operand : null;
}

/** Locate the operand of a `lo` unary operation behind one preserving conversion. */
export function lowByteOperand(value: ValueId, definitions: Definitions): ValueId | null {
  const operation = throughWidening(value, definitions);
  return operation?.kind === "unary" && operation.operator === "lo" ? operation.operand : null;
}

/**
 * Compute the static byte offset of one place, or null when a runtime index
 * decides it. Only field offsets and constant element indices are provable;
 * a runtime index is left outside the inference domain.
 */
export function staticPlaceOffset(place: SemanticPlace, definitions: Definitions): number | null {
  let type: SemanticType | undefined = place.rootType;
  let offset = 0;
  for (const step of place.path) {
    if (step.kind === "field") {
      if (type?.kind !== "struct") return null;
      const field = type.fields.find(({ name }) => name === step.name);
      if (field === undefined) return null;
      offset += field.offset;
      type = field.type;
      continue;
    }
    if (type?.kind !== "array") return null;
    const index = constantValue(definitions.get(step.value), definitions);
    if (index === null || index < 0 || index >= type.length) return null;
    offset += semanticTypeSize(type.element) * index;
    type = type.element;
  }
  return offset;
}
