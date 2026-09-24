import type { SemanticType, TypedExpr } from "../frontend/semantic-types.js";

/** Encode a complete constant initializer in packed little-endian layout order. */
export function initializerBytes(
  expression: TypedExpr,
  type: SemanticType,
): readonly number[] | null {
  if (expression.encodedBytes !== undefined) {
    return expression.encodedBytes.length ===
      (type.kind === "struct" || type.kind === "array" ? type.size : 0)
      ? expression.encodedBytes
      : null;
  }
  if (type.kind === "scalar") {
    if (expression.constant === null || type.name === "void") return null;
    const bytes = type.name === "word" || type.name === "sword" ? 2 : 1;
    const value =
      typeof expression.constant === "boolean"
        ? expression.constant
          ? 1n
          : 0n
        : BigInt.asUintN(bytes * 8, expression.constant);
    return Object.freeze(
      Array.from({ length: bytes }, (_, offset) => Number((value >> BigInt(offset * 8)) & 0xffn)),
    );
  }
  if (type.kind === "enum") {
    return typeof expression.constant === "bigint"
      ? Object.freeze([Number(BigInt.asUintN(8, expression.constant))])
      : null;
  }
  if (type.kind === "struct") {
    if (expression.kind !== "struct-literal" || expression.fields === undefined) return null;
    const bytes: number[] = [];
    for (const field of type.fields) {
      const value = expression.fields.find((candidate) => candidate.name === field.name)?.value;
      if (value === undefined) return null;
      const encoded = initializerBytes(value, field.type);
      if (encoded === null) return null;
      bytes.push(...encoded);
    }
    return Object.freeze(bytes);
  }
  if (expression.kind !== "array-literal" || expression.elements === undefined) return null;
  const values = [...expression.elements];
  while (values.length < type.length) {
    if (expression.fill === undefined || expression.fill === null) return null;
    values.push(expression.fill);
  }
  if (values.length !== type.length) return null;
  const bytes: number[] = [];
  for (const value of values) {
    const encoded = initializerBytes(value, type.element);
    if (encoded === null) return null;
    bytes.push(...encoded);
  }
  return Object.freeze(bytes);
}
