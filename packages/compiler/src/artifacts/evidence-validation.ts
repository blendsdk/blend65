import { createHash } from "node:crypto";

const HASH = /^[0-9a-f]{64}$/u;
const LOWER_HEX = /^(?:[0-9a-f]{2})*$/u;

/** Compare strings by unsigned UTF-8 bytes without locale-dependent behavior. */
export function compareEvidenceText(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

/** Return whether a value is a plain JSON object. */
export function isEvidenceRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Check one closed object key set. */
export function hasExactEvidenceKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const actual = Object.keys(value);
  if (required.some((key) => !actual.includes(key))) return false;
  const admitted = new Set([...required, ...optional]);
  return actual.every((key) => admitted.has(key));
}

/** Return whether a value is a nonempty string. */
export function isEvidenceText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Return whether a value is a nonnegative safe JSON integer. */
export function isEvidenceCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Return whether a value is a positive safe JSON integer. */
export function isPositiveEvidenceCount(value: unknown): value is number {
  return isEvidenceCount(value) && value > 0;
}

/** Return whether a value is a lowercase SHA-256 string. */
export function isEvidenceHash(value: unknown): value is string {
  return typeof value === "string" && HASH.test(value);
}

/** Return whether a value is an even-length lowercase hexadecimal byte string. */
export function isEvidenceHex(value: unknown): value is string {
  return typeof value === "string" && LOWER_HEX.test(value);
}

/** Return whether an array is strictly ordered and duplicate-free by one stable key. */
export function isEvidenceOrdered<T>(values: readonly T[], key: (value: T) => string): boolean {
  return values.every(
    (value, index) => index === 0 || compareEvidenceText(key(values[index - 1]!), key(value)) < 0,
  );
}

/** Return whether strings are sorted by portable byte order and contain no duplicates. */
export function areEvidenceStringsOrdered(values: unknown): values is readonly string[] {
  return (
    Array.isArray(values) &&
    values.every(isEvidenceText) &&
    isEvidenceOrdered(values, (value) => value)
  );
}

/** Return whether integer indexes are strictly ascending and in bounds. */
export function areEvidenceIndexes(
  values: unknown,
  upperBound: number,
): values is readonly number[] {
  return (
    Array.isArray(values) &&
    values.every(
      (value, index) =>
        isEvidenceCount(value) && value < upperBound && (index === 0 || value > values[index - 1]!),
    )
  );
}

/** Return whether a path is a contained portable relative evidence path. */
export function isEvidencePath(value: unknown): value is string {
  if (!isEvidenceText(value) || value.startsWith("/") || value.includes("\\")) return false;
  const parts = value.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

/** Return whether a number is a nonzero power of two. */
export function isEvidencePowerOfTwo(value: unknown): value is number {
  if (!isPositiveEvidenceCount(value)) return false;
  let remaining = value;
  while (remaining % 2 === 0) remaining /= 2;
  return remaining === 1;
}

/** Serialize a validated JSON value with keys ordered by unsigned UTF-8 bytes. */
export function canonicalEvidenceJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalEvidenceJson).join(",")}]`;
  if (isEvidenceRecord(value)) {
    const fields = Object.entries(value).sort(([left], [right]) =>
      compareEvidenceText(left, right),
    );
    return `{${fields
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalEvidenceJson(nested)}`)
      .join(",")}}`;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  throw new Error("Evidence contains a non-JSON value");
}

/** Return the content identity of one canonical JSON value without a trailing newline. */
export function canonicalEvidenceHash(value: unknown): string {
  return createHash("sha256").update(canonicalEvidenceJson(value)).digest("hex");
}
