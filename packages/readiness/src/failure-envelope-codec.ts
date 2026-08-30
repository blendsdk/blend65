import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { compareExecutionText, readExecutionRecord } from "./execution-validation.js";

import type { Sha256Digest } from "./model-registry-model.js";
import type { FailureHistoricalAuthorityRecordV1 } from "./failure-envelope-model.js";

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder("utf-8", { fatal: true });

/** Returns the canonical content digest used by historical failure records. */
export function failureEnvelopeDigestV1(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

/**
 * Encodes ordinary acyclic data with stable object-key and binary-value handling.
 *
 * @param value Closed data to encode.
 * @returns Canonical UTF-8 JSON bytes with one trailing newline.
 * @throws {TypeError} When the value contains cycles or non-data properties.
 */
export function encodeFailureEnvelopeCanonicalV1(value: unknown): Uint8Array {
  const seen = new Set<object>();
  const normalize = (current: unknown): unknown => {
    if (typeof current === "bigint") return { $bigint: current.toString() };
    if (current instanceof Uint8Array) {
      return { $bytes: Buffer.from(current).toString("base64") };
    }
    if (Array.isArray(current)) return current.map(normalize);
    if (typeof current !== "object" || current === null) return current;
    if (seen.has(current)) throw new TypeError("Canonical failure data must be acyclic.");
    seen.add(current);
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(current).sort(compareExecutionText)) {
      const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        throw new TypeError("Canonical failure data must contain ordinary data properties.");
      }
      normalized[key] = normalize(descriptor.value);
    }
    seen.delete(current);
    return normalized;
  };
  return ENCODER.encode(`${JSON.stringify(normalize(value))}\n`);
}

/** Decodes canonical failure JSON, restoring explicit binary and bigint wrappers. */
export function decodeFailureEnvelopeCanonicalV1(bytes: Uint8Array): unknown {
  return JSON.parse(DECODER.decode(bytes), (_key, value: unknown) => {
    const bigintRecord = readExecutionRecord(value, ["$bigint"]);
    if (
      bigintRecord !== undefined &&
      typeof bigintRecord.$bigint === "string" &&
      /^-?(?:0|[1-9][0-9]*)$/u.test(bigintRecord.$bigint)
    ) {
      return BigInt(bigintRecord.$bigint);
    }
    const byteRecord = readExecutionRecord(value, ["$bytes"]);
    if (
      byteRecord !== undefined &&
      typeof byteRecord.$bytes === "string" &&
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(byteRecord.$bytes)
    ) {
      return Uint8Array.from(Buffer.from(byteRecord.$bytes, "base64"));
    }
    return value;
  });
}

/** Decodes one historical record only when its bytes are already canonical. */
export function decodeCanonicalHistoricalRecordV1(
  record: FailureHistoricalAuthorityRecordV1,
): unknown | undefined {
  try {
    const decoded = decodeFailureEnvelopeCanonicalV1(record.bytes);
    return isDeepStrictEqual(encodeFailureEnvelopeCanonicalV1(decoded), record.bytes)
      ? decoded
      : undefined;
  } catch {
    return undefined;
  }
}

/** Reads one ordinary enumerable data property without invoking caller code. */
export function readFailureEnvelopeDataPropertyV1(input: unknown, key: string): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
  try {
    const prototype = Object.getPrototypeOf(input);
    const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
    return (prototype === Object.prototype || prototype === null) &&
      descriptor !== undefined &&
      "value" in descriptor &&
      descriptor.enumerable
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}
