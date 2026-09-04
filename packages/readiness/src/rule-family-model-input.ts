/** Result of copying an untrusted rule-model value without invoking accessors. */
export type RuleModelInputInspectionV2 =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false };

const MAX_INPUT_NODES = 50_000;
const MAX_INPUT_DEPTH = 128;
const ARRAY_INDEX = /^(?:0|[1-9][0-9]*)$/u;

interface InspectionState {
  readonly seen: WeakSet<object>;
  nodes: number;
}

function copyArray(
  input: unknown[],
  depth: number,
  state: InspectionState,
): RuleModelInputInspectionV2 {
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some(
      (key) =>
        typeof key !== "string" ||
        (key !== "length" &&
          (!ARRAY_INDEX.test(key) || Number(key) >= input.length || String(Number(key)) !== key)),
    )
  ) {
    return { ok: false };
  }
  const copied: unknown[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      return { ok: false };
    }
    const child = copyDataValue(descriptor.value, depth + 1, state);
    if (!child.ok) return child;
    copied.push(child.value);
  }
  return { ok: true, value: copied };
}

function copyRecord(
  input: object,
  depth: number,
  state: InspectionState,
): RuleModelInputInspectionV2 {
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const copied: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string") return { ok: false };
    const descriptor = descriptors[key];
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      return { ok: false };
    }
    const child = copyDataValue(descriptor.value, depth + 1, state);
    if (!child.ok) return child;
    Object.defineProperty(copied, key, {
      value: child.value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return { ok: true, value: copied };
}

/**
 * Copies one untrusted data graph through own data descriptors only.
 *
 * Accessors, cycles, exotic prototypes and sparse arrays are rejected before semantic validation.
 * Reading descriptors keeps a hostile getter from running as a side effect of validation.
 */
function copyDataValue(
  input: unknown,
  depth: number,
  state: InspectionState,
): RuleModelInputInspectionV2 {
  if (
    input === null ||
    typeof input === "string" ||
    typeof input === "number" ||
    typeof input === "boolean"
  ) {
    return { ok: true, value: input };
  }
  if (typeof input !== "object" || depth > MAX_INPUT_DEPTH) return { ok: false };
  state.nodes += 1;
  if (state.nodes > MAX_INPUT_NODES || state.seen.has(input)) return { ok: false };
  state.seen.add(input);
  const prototype = Object.getPrototypeOf(input);
  if (Array.isArray(input)) {
    return prototype === Array.prototype ? copyArray(input, depth, state) : { ok: false };
  }
  return prototype === Object.prototype || prototype === null
    ? copyRecord(input, depth, state)
    : { ok: false };
}

/**
 * Produces a detached plain-data copy of an untrusted rule-model input.
 *
 * @param input Caller-controlled value to inspect.
 * @returns A detached copy, or a closed rejection without exposing thrown inspection errors.
 *
 * @example
 * ```ts
 * const inspected = inspectRuleModelInputV2(JSON.parse(bytes));
 * ```
 */
export function inspectRuleModelInputV2(input: unknown): RuleModelInputInspectionV2 {
  try {
    return copyDataValue(input, 0, { seen: new WeakSet(), nodes: 0 });
  } catch {
    return { ok: false };
  }
}
