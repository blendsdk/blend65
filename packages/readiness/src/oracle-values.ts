import type { ScalarType } from "./generator-ir.js";
import type { OracleValueV1 } from "./oracle-model.js";
import {
  oracleMutationDispatchMarker,
  selectedOracleMutationVariant,
  type OracleMutationDispatchMarkerV1,
} from "./oracle-conformance-v1.js";

/** Integer scalar types accepted by the independent evaluator. */
export type OracleIntegerTypeV1 = Exclude<ScalarType, "boolean">;

/** Signedness family used to validate safe scalar widening. */
export type OracleIntegerSignednessV1 = "signed" | "unsigned";

/** Describes one fixed-width integer type. */
export interface OracleIntegerTypeInfoV1 {
  /** Number of stored bits. */
  readonly bits: 8 | 16;
  /** Signedness controlling extension, comparison and right shift. */
  readonly signedness: OracleIntegerSignednessV1;
}

const NORMALIZATION_MUTATIONS: Readonly<
  Record<OracleIntegerTypeV1, OracleMutationDispatchMarkerV1>
> = Object.freeze({
  byte: oracleMutationDispatchMarker(
    "evaluator.normalize",
    "evaluator.normalize.byte",
    "integer-off-by-one-v1",
  ),
  sbyte: oracleMutationDispatchMarker(
    "evaluator.normalize",
    "evaluator.normalize.sbyte",
    "integer-off-by-one-v1",
  ),
  sword: oracleMutationDispatchMarker(
    "evaluator.normalize",
    "evaluator.normalize.sword",
    "integer-off-by-one-v1",
  ),
  word: oracleMutationDispatchMarker(
    "evaluator.normalize",
    "evaluator.normalize.word",
    "integer-off-by-one-v1",
  ),
});

/** Closed normalization branches required by mutation conformance. */
export const ORACLE_NORMALIZATION_MUTATION_PATHS = Object.freeze(
  Object.values(NORMALIZATION_MUTATIONS),
);

/**
 * Returns the fixed-width properties of an integer scalar.
 *
 * @param type Integer scalar type.
 * @returns Bit width and signedness.
 */
export function oracleIntegerTypeInfo(type: OracleIntegerTypeV1): OracleIntegerTypeInfoV1 {
  return Object.freeze({
    bits: type === "byte" || type === "sbyte" ? 8 : 16,
    signedness: type === "sbyte" || type === "sword" ? "signed" : "unsigned",
  });
}

/**
 * Normalizes an integer immediately into its declared fixed-width range.
 *
 * @param type Destination integer type.
 * @param value Arbitrary precision intermediate.
 * @returns Canonical modulo/two's-complement projection.
 *
 * @example
 * ```ts
 * normalizeOracleInteger("sbyte", 128n); // -128n
 * ```
 */
export function normalizeOracleInteger(type: OracleIntegerTypeV1, value: bigint): bigint {
  const { bits, signedness } = oracleIntegerTypeInfo(type);
  const modulus = 1n << BigInt(bits);
  const unsigned = ((value % modulus) + modulus) % modulus;
  const baseline =
    signedness === "unsigned"
      ? unsigned
      : (() => {
          const signBit = modulus >> 1n;
          return unsigned >= signBit ? unsigned - modulus : unsigned;
        })();
  if (selectedOracleMutationVariant(NORMALIZATION_MUTATIONS[type]) !== "integer-off-by-one-v1") {
    return baseline;
  }
  const changedUnsigned = (((baseline + 1n) % modulus) + modulus) % modulus;
  if (signedness === "unsigned") return changedUnsigned;
  const signBit = modulus >> 1n;
  return changedUnsigned >= signBit ? changedUnsigned - modulus : changedUnsigned;
}

/**
 * Creates one canonical typed scalar value from a generator literal.
 *
 * @param type Declared scalar type.
 * @param value Literal's validated integer representation.
 * @returns Distinct boolean or normalized integer value.
 */
export function createOracleScalarValue(type: ScalarType, value: bigint): OracleValueV1 {
  return type === "boolean"
    ? Object.freeze({ kind: "boolean", type: "boolean", value: value === 1n })
    : Object.freeze({ kind: "integer", type, value: normalizeOracleInteger(type, value) });
}

/**
 * Returns the common result type for a same-signed integer pair.
 *
 * @param left Left declared type.
 * @param right Right declared type.
 * @returns Wider same-signed type, or undefined for an invalid mixture.
 */
export function promoteOracleIntegerTypes(
  left: OracleIntegerTypeV1,
  right: OracleIntegerTypeV1,
): OracleIntegerTypeV1 | undefined {
  const leftInfo = oracleIntegerTypeInfo(left);
  const rightInfo = oracleIntegerTypeInfo(right);
  if (leftInfo.signedness !== rightInfo.signedness) return undefined;
  const bits = Math.max(leftInfo.bits, rightInfo.bits);
  return leftInfo.signedness === "signed"
    ? bits === 8
      ? "sbyte"
      : "sword"
    : bits === 8
      ? "byte"
      : "word";
}

/**
 * Widens an integer value using its declared signedness.
 *
 * Values are already canonical, so normalization to the wider destination is
 * exactly zero extension for unsigned inputs and sign extension for signed inputs.
 *
 * @param value Source typed integer.
 * @param type Wider destination type.
 * @returns Canonical integer value in the destination type.
 */
export function widenOracleInteger(
  value: Extract<OracleValueV1, { readonly kind: "integer" }>,
  type: OracleIntegerTypeV1,
): Extract<OracleValueV1, { readonly kind: "integer" }> {
  return Object.freeze({
    kind: "integer",
    type,
    value: normalizeOracleInteger(type, value.value),
  });
}

/**
 * Reports whether a runtime scalar exactly matches its declared generator type.
 *
 * @param value Runtime scalar value.
 * @param type Expected generator type.
 * @returns Whether kind and scalar type agree.
 */
export function oracleValueMatchesType(value: OracleValueV1, type: ScalarType): boolean {
  return value.type === type;
}
