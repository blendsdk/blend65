import type { ModelBindingDiagnostic, ModelBindingDiagnosticCode } from "./model-registry-model.js";
import { inspectPlainDataTree } from "./programmatic-input.js";

/** Closed executable-operation families referenced by canonical modeled facts. */
export type RuleModelOperationKind = "constructor" | "predicate" | "neighbor" | "boundary-family";

/** Executable operation registered under one stable model operation ID. */
export interface ExecutableRuleModelOperation {
  readonly operationId: string;
  readonly kind: RuleModelOperationKind;
  readonly implementation: (...args: never[]) => unknown;
}

const EXECUTABLE_OPERATION_REGISTRIES = new WeakSet<object>();

/** Immutable executable-operation table keyed by stable operation ID and kind. */
export interface ExecutableOperationRegistry {
  readonly operations: readonly ExecutableRuleModelOperation[];
  readonly operationIds: readonly string[];
  readonly get: (operationId: string) => ExecutableRuleModelOperation | undefined;
  readonly has: (kind: RuleModelOperationKind, operationId: string) => boolean;
}

/** Result of closing an executable-operation registry. */
export type ExecutableOperationRegistryResult =
  | {
      readonly ok: true;
      readonly registry: ExecutableOperationRegistry;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ModelBindingDiagnostic[];
    };

const MODEL_ID_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u;
const OPERATION_KINDS: ReadonlySet<string> = new Set([
  "constructor",
  "predicate",
  "neighbor",
  "boundary-family",
]);
const OPERATION_KEYS = ["operationId", "kind", "implementation"] as const;

/**
 * Reports whether a value is a canonical model identifier.
 *
 * @param value Candidate identifier.
 * @returns Whether the value follows the closed lexical grammar.
 *
 * @example
 * ```ts
 * isRuleModelId("predicate.scalar.range");
 * ```
 */
export function isRuleModelId(value: unknown): value is string {
  return typeof value === "string" && MODEL_ID_PATTERN.test(value);
}

function isOperationKind(value: unknown): value is RuleModelOperationKind {
  return typeof value === "string" && OPERATION_KINDS.has(value);
}

function isOperationImplementation(
  value: unknown,
): value is ExecutableRuleModelOperation["implementation"] {
  return typeof value === "function";
}

function diagnostic(
  code: ModelBindingDiagnosticCode,
  path: string,
  message: string,
): ModelBindingDiagnostic {
  return { code, path, message };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function normalizeOperation(
  value: unknown,
  index: number,
): ExecutableRuleModelOperation | ModelBindingDiagnostic {
  const base = `/operations/${index}`;
  if (!isRecord(value) || !hasExactKeys(value, OPERATION_KEYS)) {
    return diagnostic(
      "model.schema.invalid",
      base,
      "Executable operation must use the exact closed record shape.",
    );
  }
  if (!isRuleModelId(value.operationId)) {
    return diagnostic(
      "model.schema.invalid",
      `${base}/operationId`,
      "Operation ID is not canonical.",
    );
  }
  if (!isOperationKind(value.kind)) {
    return diagnostic("model.schema.invalid", `${base}/kind`, "Operation kind is not supported.");
  }
  if (!isOperationImplementation(value.implementation)) {
    return diagnostic(
      "model.schema.invalid",
      `${base}/implementation`,
      "Executable operation implementation is not callable.",
    );
  }
  return Object.freeze({
    operationId: value.operationId,
    kind: value.kind,
    implementation: value.implementation,
  });
}

/**
 * Reports whether a value is a registry produced by the executable-operation factory.
 *
 * @param value Candidate registry capability.
 * @returns Whether the value is the exact object returned by the registry factory.
 *
 * @example
 * ```ts
 * if (isExecutableOperationRegistry(value)) value.has("predicate", "predicate.scalar.range");
 * ```
 */
export function isExecutableOperationRegistry(
  value: unknown,
): value is ExecutableOperationRegistry {
  return typeof value === "object" && value !== null && EXECUTABLE_OPERATION_REGISTRIES.has(value);
}

function closeRegistry(
  operations: readonly ExecutableRuleModelOperation[],
): ExecutableOperationRegistry {
  const closedOperations = Object.freeze([...operations]);
  const operationIds = Object.freeze(closedOperations.map((operation) => operation.operationId));
  const byOperationId = new Map(
    closedOperations.map((operation) => [operation.operationId, operation]),
  );
  const idsByKind = new Map<RuleModelOperationKind, Set<string>>();
  for (const operation of closedOperations) {
    const ids = idsByKind.get(operation.kind) ?? new Set<string>();
    ids.add(operation.operationId);
    idsByKind.set(operation.kind, ids);
  }
  const registry: ExecutableOperationRegistry = Object.freeze({
    operations: closedOperations,
    operationIds,
    get: (operationId: string): ExecutableRuleModelOperation | undefined =>
      byOperationId.get(operationId),
    has: (kind: RuleModelOperationKind, operationId: string): boolean =>
      idsByKind.get(kind)?.has(operationId) === true,
  });
  EXECUTABLE_OPERATION_REGISTRIES.add(registry);
  return registry;
}

/**
 * Creates a duplicate-free immutable executable-operation registry.
 *
 * @param operations Executable operations to close over.
 * @returns The immutable registry or deterministic diagnostics.
 *
 * @example
 * ```ts
 * const result = createExecutableOperationRegistry([
 *   { operationId: "predicate.scalar.range", kind: "predicate", implementation: () => true },
 * ]);
 * ```
 */
export function createExecutableOperationRegistry(
  operations: unknown,
): ExecutableOperationRegistryResult {
  try {
    const structuralFailure = inspectPlainDataTree(operations, "/operations", (path) =>
      /^\/operations\/[0-9]+\/implementation$/u.test(path),
    );
    if (structuralFailure !== undefined) {
      return {
        ok: false,
        diagnostics: [
          diagnostic("model.schema.invalid", structuralFailure.path, structuralFailure.message),
        ],
      };
    }
    if (!Array.isArray(operations)) {
      return {
        ok: false,
        diagnostics: [
          diagnostic("model.schema.invalid", "/operations", "Operations must be an array."),
        ],
      };
    }

    const diagnostics: ModelBindingDiagnostic[] = [];
    const seenIds = new Set<string>();
    const normalized: ExecutableRuleModelOperation[] = [];
    operations.forEach((value, index) => {
      const operation = normalizeOperation(value, index);
      if ("code" in operation) {
        diagnostics.push(operation);
        return;
      }
      if (seenIds.has(operation.operationId)) {
        diagnostics.push(
          diagnostic(
            "model.schema.invalid",
            `/operations/${index}/operationId`,
            "Operation ID occurs more than once.",
          ),
        );
        return;
      }
      seenIds.add(operation.operationId);
      normalized.push(operation);
    });

    if (diagnostics.length > 0) {
      return { ok: false, diagnostics };
    }
    return { ok: true, registry: closeRegistry(normalized), diagnostics: [] };
  } catch {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "model.schema.invalid",
          "/operations",
          "Operation input could not be inspected safely.",
        ),
      ],
    };
  }
}
