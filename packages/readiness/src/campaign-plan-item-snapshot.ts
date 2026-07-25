import type { CampaignPlanItem } from "./campaign-model.js";

const PLAN_ITEM_KEYS = ["ordinal", "generationPath", "lane", "request", "renderOptions"] as const;
const MAX_PLAN_ITEM_VALUES = 4_096;

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function exactDataDescriptors(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, PropertyDescriptor>> | undefined {
  if (!isObject(value)) return undefined;
  try {
    if (Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    const ownKeys = Reflect.ownKeys(value);
    if (
      (prototype !== Object.prototype && prototype !== null) ||
      ownKeys.length !== keys.length ||
      ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))
    ) {
      return undefined;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return keys.every((key) => {
      const descriptor = descriptors[key];
      return descriptor !== undefined && "value" in descriptor && descriptor.enumerable;
    })
      ? descriptors
      : undefined;
  } catch {
    return undefined;
  }
}

function plainDataEqual(actual: unknown, expected: unknown): boolean {
  const pending: { readonly actual: unknown; readonly expected: unknown }[] = [
    { actual, expected },
  ];
  const matched = new WeakMap<object, object>();
  let visited = 0;
  try {
    while (pending.length > 0) {
      const pair = pending.pop();
      if (pair === undefined) break;
      visited += 1;
      if (visited > MAX_PLAN_ITEM_VALUES) return false;
      if (Object.is(pair.actual, pair.expected)) continue;
      if (!isObject(pair.actual) || !isObject(pair.expected)) return false;
      const retained = matched.get(pair.actual);
      if (retained !== undefined) {
        if (retained !== pair.expected) return false;
        continue;
      }
      matched.set(pair.actual, pair.expected);
      const actualArray = Array.isArray(pair.actual);
      if (actualArray !== Array.isArray(pair.expected)) return false;
      const expectedPrototype = Object.getPrototypeOf(pair.expected);
      const actualPrototype = Object.getPrototypeOf(pair.actual);
      if (actualPrototype !== expectedPrototype) return false;
      if (
        (!actualArray && actualPrototype !== Object.prototype && actualPrototype !== null) ||
        (actualArray && actualPrototype !== Array.prototype)
      ) {
        return false;
      }
      const actualKeys = Reflect.ownKeys(pair.actual);
      const expectedKeys = Reflect.ownKeys(pair.expected);
      if (
        actualKeys.length !== expectedKeys.length ||
        actualKeys.some((key, index) => key !== expectedKeys[index])
      ) {
        return false;
      }
      for (const key of actualKeys) {
        const actualDescriptor = Reflect.getOwnPropertyDescriptor(pair.actual, key);
        const expectedDescriptor = Reflect.getOwnPropertyDescriptor(pair.expected, key);
        if (
          actualDescriptor === undefined ||
          expectedDescriptor === undefined ||
          !("value" in actualDescriptor) ||
          !("value" in expectedDescriptor) ||
          actualDescriptor.enumerable !== expectedDescriptor.enumerable
        ) {
          return false;
        }
        pending.push({
          actual: actualDescriptor.value,
          expected: expectedDescriptor.value,
        });
      }
    }
    return true;
  } catch {
    return false;
  }
}

/** Reads only a safe own-data ordinal from an otherwise untrusted plan item. */
export function readCampaignPlanItemOrdinal(value: unknown): number | undefined {
  const descriptors = exactDataDescriptors(value, PLAN_ITEM_KEYS);
  if (descriptors === undefined) return undefined;
  const ordinal = descriptors.ordinal;
  return ordinal !== undefined &&
    "value" in ordinal &&
    Number.isSafeInteger(ordinal.value) &&
    ordinal.value >= 0
    ? ordinal.value
    : undefined;
}

/** Returns the trusted expected item only when untrusted plan data matches it exactly. */
export function snapshotCampaignPlanItem(
  value: unknown,
  expected: CampaignPlanItem,
): CampaignPlanItem | undefined {
  return plainDataEqual(value, expected) ? expected : undefined;
}
