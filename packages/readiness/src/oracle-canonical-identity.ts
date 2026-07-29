import {
  encodeCanonicalIdentity,
  type CanonicalIdentityDomain,
  type CanonicalIdentityField,
} from "./canonical-identity.js";

/** Domain separators reserved for authoritative oracle identities. */
export type OracleCanonicalIdentityDomain =
  | "blend65-oracle-source-content-v1"
  | "blend65-oracle-transformed-content-v1"
  | "blend65-oracle-initial-memory-v1"
  | "blend65-oracle-evaluation-v1";

const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const BYTE_LENGTH_GETTER = Reflect.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
)?.get;
const BUFFER_GETTER = Reflect.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer")?.get;

/**
 * Reads an isolated byte array's intrinsic length and rejects shared backing memory.
 *
 * @param value Candidate byte array.
 * @returns Its intrinsic byte length, or `undefined` when it is unsafe to retain.
 *
 * @example
 * ```ts
 * const length = oracleUint8ArrayByteLength(new Uint8Array(32));
 * ```
 */
export function oracleUint8ArrayByteLength(value: unknown): number | undefined {
  if (
    !(value instanceof Uint8Array) ||
    BYTE_LENGTH_GETTER === undefined ||
    BUFFER_GETTER === undefined
  ) {
    return undefined;
  }
  try {
    const buffer: unknown = BUFFER_GETTER.call(value);
    if (typeof SharedArrayBuffer !== "undefined" && buffer instanceof SharedArrayBuffer) {
      return undefined;
    }
    const byteLength: unknown = BYTE_LENGTH_GETTER.call(value);
    return typeof byteLength === "number" && Number.isSafeInteger(byteLength) && byteLength >= 0
      ? byteLength
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Copies private byte storage without consulting caller-controlled iteration.
 *
 * @param value Candidate byte array.
 * @param length Required byte length when the caller already established one.
 * @returns A private copy, or `undefined` for invalid or shared input.
 *
 * @example
 * ```ts
 * const bytes = copyOracleUint8Array(new Uint8Array([1]), 1);
 * ```
 */
export function copyOracleUint8Array(value: unknown, length?: number): Uint8Array | undefined {
  try {
    const byteLength = oracleUint8ArrayByteLength(value);
    if (byteLength === undefined || (length !== undefined && byteLength !== length)) {
      return undefined;
    }
    return Uint8Array.prototype.slice.call(value);
  } catch {
    return undefined;
  }
}

/**
 * Encodes one oracle-specific canonical identity without widening legacy identity authority.
 *
 * @param domain Versioned oracle domain separator.
 * @param fields Closed semantic fields in their canonical order.
 * @returns Newly allocated canonical preimage bytes.
 *
 * @example
 * ```ts
 * const bytes = encodeOracleCanonicalIdentity("blend65-oracle-source-content-v1", []);
 * ```
 */
export function encodeOracleCanonicalIdentity(
  domain: OracleCanonicalIdentityDomain,
  fields: readonly CanonicalIdentityField[],
): Uint8Array {
  return encodeCanonicalIdentity(domain as CanonicalIdentityDomain, fields);
}
