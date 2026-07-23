import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { Ajv2020, type AnySchemaObject, type ErrorObject } from "ajv/dist/2020.js";
import { createDiagnostic, sortDiagnostics } from "./diagnostics.js";
import { INVENTORY_V1_LIMITS } from "./limits.js";
import type { InventoryDiagnostic, InventoryV1, ValidationResult } from "./model.js";

function isSchemaObject(value: unknown): value is AnySchemaObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadSchema(): AnySchemaObject {
  const schemaPath = new URL("../../../readiness/schema/inventory-v1.schema.json", import.meta.url);
  const parsed: unknown = JSON.parse(readFileSync(schemaPath, "utf8"));
  if (!isSchemaObject(parsed)) {
    throw new TypeError("The inventory schema must contain a JSON object.");
  }
  return parsed;
}

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  discriminator: true,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
});
const validateV1 = ajv.compile<InventoryV1>(loadSchema());

function isInventoryV1(value: unknown): value is InventoryV1 {
  return validateV1(value) === true;
}

function escapePointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function errorPath(error: ErrorObject): string {
  if (error.keyword === "discriminator") {
    return `${error.instancePath}/disposition`;
  }
  if (error.keyword === "required") {
    const missingProperty = String(error.params.missingProperty);
    return `${error.instancePath}/${escapePointerSegment(missingProperty)}`;
  }
  if (error.keyword === "additionalProperties") {
    const additionalProperty = String(error.params.additionalProperty);
    return `${error.instancePath}/${escapePointerSegment(additionalProperty)}`;
  }
  return error.instancePath;
}

function errorCode(keyword: string): string {
  const names: Readonly<Record<string, string>> = {
    additionalProperties: "schema.additional-property",
    enum: "schema.enum",
    maxItems: "schema.max-items",
    maxLength: "schema.max-length",
    pattern: "schema.pattern",
    required: "schema.required",
    discriminator: "schema.enum",
  };
  return names[keyword] ?? `schema.${keyword}`;
}

function normalizeAjvError(error: ErrorObject): InventoryDiagnostic {
  const code =
    error.keyword === "discriminator" && error.message?.includes("must be string") === true
      ? "schema.required"
      : errorCode(error.keyword);
  return createDiagnostic({
    phase: "schema",
    code,
    path: errorPath(error),
    message: String(error.message),
  });
}

function suppressCascades(
  diagnostics: readonly InventoryDiagnostic[],
): readonly InventoryDiagnostic[] {
  const invalidApplicabilityParents = new Set(
    diagnostics
      .filter(
        (diagnostic) =>
          diagnostic.path.endsWith("/applicability") &&
          (diagnostic.code === "schema.enum" || diagnostic.code === "schema.required"),
      )
      .map((diagnostic) => diagnostic.path.slice(0, -"/applicability".length)),
  );
  const oneOfParentsWithSpecificErrors = new Set(
    diagnostics
      .filter(
        (diagnostic) =>
          diagnostic.code === "schema.oneOf" &&
          diagnostics.some(
            (candidate) =>
              candidate !== diagnostic && candidate.path.startsWith(`${diagnostic.path}/`),
          ),
      )
      .map((diagnostic) => diagnostic.path),
  );
  return diagnostics.filter((diagnostic) => {
    if (diagnostic.code === "schema.if") {
      return false;
    }
    if (
      oneOfParentsWithSpecificErrors.has(diagnostic.path) &&
      (diagnostic.code === "schema.oneOf" || diagnostic.code === "schema.type")
    ) {
      return false;
    }
    return ![...invalidApplicabilityParents].some(
      (parent) =>
        diagnostic.code === "schema.required" &&
        diagnostic.path === `${parent}/applicabilityReason`,
    );
  });
}

interface PendingValue {
  readonly kind: "value";
  readonly value: unknown;
  readonly path: string;
  readonly depth: number;
}

interface PendingLeave {
  readonly kind: "leave";
  readonly value: object;
}

type PendingTraversal = PendingValue | PendingLeave;

// Every JSON value consumes at least one byte in the authoritative input representation.
const MAX_PREFLIGHT_VALUES = INVENTORY_V1_LIMITS.maxInputBytes;

function collectionLimit(path: string): number {
  const field = path.slice(path.lastIndexOf("/") + 1);
  if (field === "normativeSources") return INVENTORY_V1_LIMITS.maxSources;
  if (field === "sections") return INVENTORY_V1_LIMITS.maxSectionsPerSource;
  if (field === "clauseLedger") return INVENTORY_V1_LIMITS.maxFragments;
  if (field === "rules") return INVENTORY_V1_LIMITS.maxRules;
  if (field === "prerequisiteRuleIds" || field === "relatedRuleIds") {
    return INVENTORY_V1_LIMITS.maxRelationshipsPerRule;
  }
  return INVENTORY_V1_LIMITS.maxArrayItems;
}

function findResourceDiagnostic(value: unknown): InventoryDiagnostic | undefined {
  const pending: PendingTraversal[] = [{ kind: "value", value, path: "", depth: 0 }];
  const ancestors = new WeakSet<object>();
  let visitedValues = 0;

  while (pending.length > 0) {
    const current = pending[pending.length - 1];
    pending.length -= 1;
    if (current.kind === "leave") {
      ancestors.delete(current.value);
      continue;
    }
    visitedValues += 1;
    if (visitedValues > MAX_PREFLIGHT_VALUES) {
      return createDiagnostic({
        phase: "schema",
        code: "schema.value-limit",
        path: current.path,
        message: `Inventory traversal exceeds ${MAX_PREFLIGHT_VALUES} values.`,
      });
    }
    if (typeof current.value === "string") {
      if (Buffer.byteLength(current.value, "utf8") > INVENTORY_V1_LIMITS.maxStringBytes) {
        return createDiagnostic({
          phase: "schema",
          code: "schema.max-length",
          path: current.path,
          message: `String exceeds ${INVENTORY_V1_LIMITS.maxStringBytes} UTF-8 bytes.`,
        });
      }
      continue;
    }
    if (typeof current.value !== "object" || current.value === null) {
      continue;
    }
    if (ancestors.has(current.value)) {
      return createDiagnostic({
        phase: "schema",
        code: "schema.cyclic-value",
        path: current.path,
        message: "Inventory values must form an acyclic JSON tree.",
      });
    }
    ancestors.add(current.value);
    pending.push({ kind: "leave", value: current.value });
    if (current.depth >= INVENTORY_V1_LIMITS.maxDepth) {
      return createDiagnostic({
        phase: "schema",
        code: "schema.depth-limit",
        path: current.path,
        message: `Value nesting exceeds ${INVENTORY_V1_LIMITS.maxDepth}.`,
      });
    }
    if (Array.isArray(current.value)) {
      const limit = collectionLimit(current.path);
      if (current.value.length > limit) {
        return createDiagnostic({
          phase: "schema",
          code: "schema.max-items",
          path: current.path,
          message: `Array contains more than ${limit} items.`,
        });
      }
      for (let index = 0; index < current.value.length; index += 1) {
        pending.push({
          kind: "value",
          value: current.value[index],
          path: `${current.path}/${index}`,
          depth: current.depth + 1,
        });
      }
      continue;
    }
    let ownProperties = 0;
    for (const key in current.value) {
      if (!Object.hasOwn(current.value, key)) continue;
      ownProperties += 1;
      if (ownProperties > INVENTORY_V1_LIMITS.maxArrayItems) {
        return createDiagnostic({
          phase: "schema",
          code: "schema.max-properties",
          path: current.path,
          message: `Object contains more than ${INVENTORY_V1_LIMITS.maxArrayItems} properties.`,
        });
      }
      pending.push({
        kind: "value",
        value: Reflect.get(current.value, key),
        path: `${current.path}/${escapePointerSegment(key)}`,
        depth: current.depth + 1,
      });
    }
  }
  return undefined;
}

/**
 * Validates an already parsed value against the closed inventory v1 schema.
 *
 * @param value Candidate inventory value.
 * @returns A typed inventory on success or deterministically ordered schema diagnostics.
 *
 * @example
 * ```ts
 * const result = validateInventorySchema({ schemaVersion: 1 });
 * ```
 */
export function validateInventorySchema(value: unknown): ValidationResult {
  const resourceDiagnostic = findResourceDiagnostic(value);
  if (resourceDiagnostic !== undefined) {
    return {
      ok: false,
      diagnostics: [resourceDiagnostic],
      blockingReasons: [],
    };
  }
  if (!isInventoryV1(value)) {
    const diagnostics = sortDiagnostics(
      suppressCascades([...(validateV1.errors ?? []).map(normalizeAjvError)]),
    );
    return {
      ok: false,
      diagnostics,
      blockingReasons: [],
    };
  }
  return {
    ok: true,
    diagnostics: [],
    inventory: value,
    blockingReasons: [],
  };
}
