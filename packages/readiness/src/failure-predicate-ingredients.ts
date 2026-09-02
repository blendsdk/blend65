import type { ExecutionOperationResultV1 } from "./execution-contracts.js";
import { deriveFailurePredicateIdentityV1, type FailurePredicateV1 } from "./failure-identity.js";

/** Data-only failure facts from which durable predicate authority may later be derived. */
export type FailurePredicateIngredientsV1 = Omit<FailurePredicateV1, "revision"> & {
  /** Closed ingredients schema revision. */
  readonly revision: "failure-predicate-ingredients-v1";
};

const INGREDIENT_KEYS = [
  "revision",
  "resultCode",
  "terminalTier",
  "terminalStage",
  "observation",
  "cleanup",
  "primaryRuleId",
  "requiredClaimedRuleIds",
  "target",
  "routeContract",
] as const;
const INGREDIENT_KEY_SET: ReadonlySet<string> = new Set(INGREDIENT_KEYS);

function failure(): ExecutionOperationResultV1<FailurePredicateIngredientsV1> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([
      Object.freeze({
        code: "invalid-evidence-input" as const,
        path: "/ingredients",
        message: "Failure predicate ingredients must use the exact version-one shape.",
      }),
    ]) as readonly [
      Readonly<{
        readonly code: "invalid-evidence-input";
        readonly path: "/ingredients";
        readonly message: "Failure predicate ingredients must use the exact version-one shape.";
      }>,
    ],
  });
}

/**
 * Validates and deeply normalizes stable predicate ingredients without granting envelope authority.
 *
 * @param input Untrusted data-only predicate ingredients.
 * @returns Frozen normalized ingredients or a closed validation issue.
 *
 * @example
 * ```ts
 * const parsed = parseFailurePredicateIngredientsV1(candidate);
 * if (!parsed.ok) throw new TypeError(parsed.issues[0].message);
 * ```
 */
export function parseFailurePredicateIngredientsV1(
  input: unknown,
): ExecutionOperationResultV1<FailurePredicateIngredientsV1> {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return failure();
    const prototype = Object.getPrototypeOf(input);
    const keys = Reflect.ownKeys(input);
    if (
      (prototype !== Object.prototype && prototype !== null) ||
      keys.length !== INGREDIENT_KEYS.length ||
      keys.some((key) => typeof key !== "string" || !INGREDIENT_KEY_SET.has(key))
    ) {
      return failure();
    }
    const values: Record<string, unknown> = {};
    for (const key of INGREDIENT_KEYS) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return failure();
      }
      values[key] = descriptor.value;
    }
    if (values.revision !== "failure-predicate-ingredients-v1") return failure();
    const normalized = deriveFailurePredicateIdentityV1({
      ...values,
      revision: "failure-predicate-v1",
    });
    if (!normalized.ok) return failure();
    return Object.freeze({
      ok: true,
      value: Object.freeze({
        ...normalized.value.predicate,
        revision: "failure-predicate-ingredients-v1" as const,
      }),
    });
  } catch {
    return failure();
  }
}
