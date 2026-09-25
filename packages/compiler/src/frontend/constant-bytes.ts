import type { SemanticType, TypedExpr } from "./semantic-types.js";

/** Encode one checked scalar in packed little-endian layout order. */
export function encodeComptimeScalar(
  value: bigint | boolean,
  type: SemanticType,
): readonly number[] {
  const width = type.kind === "scalar" && (type.name === "word" || type.name === "sword") ? 2 : 1;
  const numeric = typeof value === "boolean" ? (value ? 1n : 0n) : value;
  const bits = BigInt.asUintN(width * 8, numeric);
  return Object.freeze(
    Array.from({ length: width }, (_, index) => Number((bits >> BigInt(index * 8)) & 0xffn)),
  );
}

/** Read a scalar subvalue without host-width or endianness dependence. */
export function decodeComptimeScalar(
  data: readonly number[],
  offset: number,
  type: SemanticType,
): bigint | boolean {
  const width = type.kind === "scalar" && (type.name === "word" || type.name === "sword") ? 2 : 1;
  let bits = 0n;
  for (let index = 0; index < width; index += 1) {
    bits |= BigInt(data[offset + index] ?? 0) << BigInt(index * 8);
  }
  if (type.kind === "scalar" && type.name === "boolean") return bits !== 0n;
  const signed = type.kind === "scalar" && (type.name === "sbyte" || type.name === "sword");
  return signed ? BigInt.asIntN(width * 8, bits) : bits;
}

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
    return encodeComptimeScalar(expression.constant, type);
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
  if (type.kind !== "array") return null;
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
