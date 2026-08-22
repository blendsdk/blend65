/** Maximum UTF-8 length accepted for one execution identifier. */
export const EXECUTION_IDENTIFIER_MAX_BYTES = 512;

const TEXT_ENCODER = new TextEncoder();

/**
 * Reads an ordinary object using only own enumerable data properties.
 *
 * Accessors, symbols, exotic prototypes, arrays, and proxy failures are rejected so validation
 * never executes caller code while inspecting an execution record.
 */
export function readExecutionRecord(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  try {
    if (Array.isArray(input)) return undefined;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const ownKeys = Reflect.ownKeys(input);
    if (
      ownKeys.length !== expectedKeys.length ||
      ownKeys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
    ) {
      return undefined;
    }
    const output: Record<string, unknown> = {};
    for (const key of expectedKeys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      output[key] = descriptor.value;
    }
    return output;
  } catch {
    return undefined;
  }
}

/**
 * Copies a plain dense array without consulting an overridable iterator.
 *
 * @param input Candidate array.
 * @param maximumLength Hard item limit that bounds inspection work.
 * @returns A caller-owned array, or `undefined` for sparse, exotic, or oversized input.
 */
export function readExecutionArray(
  input: unknown,
  maximumLength: number,
): readonly unknown[] | undefined {
  try {
    if (!Array.isArray(input)) return undefined;
    if (Object.getPrototypeOf(input) !== Array.prototype) return undefined;
    const lengthDescriptor = Reflect.getOwnPropertyDescriptor(input, "length");
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      lengthDescriptor.value > maximumLength
    ) {
      return undefined;
    }
    const length: number = lengthDescriptor.value;
    const ownKeys = Reflect.ownKeys(input);
    if (ownKeys.length !== length + 1) return undefined;
    const output: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const key = String(index);
      const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      output.push(descriptor.value);
    }
    return output;
  } catch {
    return undefined;
  }
}

/** Returns whether a value is a canonical lowercase SHA-256 digest. */
export function isExecutionDigest(value: unknown): value is `sha256:${string}` {
  return typeof value === "string" && value.length === 71 && /^sha256:[0-9a-f]{64}$/u.test(value);
}

/** Returns whether a value is a bounded non-empty execution identifier. */
export function isExecutionIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= EXECUTION_IDENTIFIER_MAX_BYTES &&
    TEXT_ENCODER.encode(value).byteLength <= EXECUTION_IDENTIFIER_MAX_BYTES &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/** Performs a locale-independent UTF-16 ordinal comparison. */
export function compareExecutionText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Returns a frozen lexically ordered copy when all strings are unique and valid. */
export function normalizeExecutionStringSet(
  input: unknown,
  maximumLength: number,
  validate: (value: unknown) => value is string,
): readonly string[] | undefined {
  const array = readExecutionArray(input, maximumLength);
  if (array === undefined || array.some((value) => !validate(value))) return undefined;
  const values: string[] = [];
  const retained = new Set<string>();
  for (const value of array) {
    if (typeof value !== "string" || retained.has(value)) return undefined;
    retained.add(value);
    values.push(value);
  }
  values.sort(compareExecutionText);
  return Object.freeze(values);
}
