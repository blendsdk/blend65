import type { GenStructuredParameter, ScalarType } from "./generator-ir.js";

/** Returns the scalar type of a scalar parameter and rejects array parameters. */
export function structuredScalarParameterType(
  parameter: GenStructuredParameter,
): ScalarType | undefined {
  return "kind" in parameter && parameter.kind === "array-parameter" ? undefined : parameter.type;
}

/** Returns whether a scalar type is one of the four integer types. */
export function isStructuredIntegerType(type: ScalarType): boolean {
  return type !== "boolean";
}

/** Returns whether a scalar type is an unsigned integer accepted for indexing and shift counts. */
export function isStructuredUnsignedIntegerType(type: ScalarType): boolean {
  return type === "byte" || type === "word";
}

/** Returns whether a scalar type is a signed integer accepted by unary negation. */
export function isStructuredSignedIntegerType(type: ScalarType): boolean {
  return type === "sbyte" || type === "sword";
}

/** Returns whether a value of `source` may be stored in `target` without loss or sign change. */
export function isStructuredTypeCompatible(target: ScalarType, source: ScalarType): boolean {
  return (
    target === source ||
    (target === "word" && source === "byte") ||
    (target === "sword" && source === "sbyte")
  );
}

/** Returns the mathematical range accepted by one structured scalar type. */
export function structuredScalarRange(type: ScalarType): {
  readonly minimum: bigint;
  readonly maximum: bigint;
} {
  switch (type) {
    case "boolean":
      return { minimum: 0n, maximum: 1n };
    case "byte":
      return { minimum: 0n, maximum: 255n };
    case "sbyte":
      return { minimum: -128n, maximum: 127n };
    case "word":
      return { minimum: 0n, maximum: 65_535n };
    case "sword":
      return { minimum: -32_768n, maximum: 32_767n };
  }
}

function integerWidth(type: ScalarType): 8 | 16 {
  return type === "byte" || type === "sbyte" ? 8 : 16;
}

/**
 * Finds the common result type for two same-signedness integer operands.
 *
 * @param left Left operand type.
 * @param right Right operand type.
 * @returns Promoted integer type, or `undefined` for incompatible operands.
 *
 * @example
 * ```ts
 * const result = promotedStructuredIntegerType("byte", "word");
 * ```
 */
export function promotedStructuredIntegerType(
  left: ScalarType,
  right: ScalarType,
): ScalarType | undefined {
  if (!isStructuredIntegerType(left) || !isStructuredIntegerType(right)) return undefined;
  const bothSigned = isStructuredSignedIntegerType(left) && isStructuredSignedIntegerType(right);
  const bothUnsigned =
    isStructuredUnsignedIntegerType(left) && isStructuredUnsignedIntegerType(right);
  if (!bothSigned && !bothUnsigned) return undefined;
  const width = Math.max(integerWidth(left), integerWidth(right));
  if (bothSigned) return width === 8 ? "sbyte" : "sword";
  return width === 8 ? "byte" : "word";
}
