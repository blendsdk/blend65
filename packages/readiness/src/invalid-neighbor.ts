import type {
  GenerationDiagnostic,
  InvalidNeighborOperation,
  NamedModelPredicate,
  NeighborResult,
} from "./generator-ir.js";
import { inspectGeneratorInput, validateGeneratorIr } from "./generator-ir-validator.js";

const INPUT_KEYS = ["baseline", "operation", "predicates"] as const;
const OPERATION_KEYS = ["neighborId", "targetPredicateId", "diagnosticFamily", "apply"] as const;
const PREDICATE_KEYS = ["predicateId", "evaluate"] as const;
const MODEL_ID_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u;
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isModelId(value: unknown): value is string {
  return typeof value === "string" && MODEL_ID_PATTERN.test(value);
}

function isPredicateEvaluator(value: unknown): value is NamedModelPredicate["evaluate"] {
  return typeof value === "function";
}

function isNeighborApply(value: unknown): value is InvalidNeighborOperation["apply"] {
  return typeof value === "function";
}

function diagnostic(path: string, message: string): GenerationDiagnostic {
  return Object.freeze({ code: "neighbor-invalid", path, message });
}

function failed(path: string, message: string): NeighborResult {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([diagnostic(path, message)]),
  });
}

function normalizeOperation(value: unknown): InvalidNeighborOperation | undefined {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, OPERATION_KEYS) ||
    !isModelId(value.neighborId) ||
    !isModelId(value.targetPredicateId) ||
    !isModelId(value.diagnosticFamily) ||
    !isNeighborApply(value.apply)
  ) {
    return undefined;
  }
  return Object.freeze({
    neighborId: value.neighborId,
    targetPredicateId: value.targetPredicateId,
    diagnosticFamily: value.diagnosticFamily,
    apply: value.apply,
  });
}

function normalizePredicates(
  values: readonly unknown[],
): readonly NamedModelPredicate[] | GenerationDiagnostic {
  if (values.length === 0) {
    return diagnostic("/predicates", "At least one model predicate is required.");
  }
  const predicates: NamedModelPredicate[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (
      !isRecord(value) ||
      !hasExactKeys(value, PREDICATE_KEYS) ||
      !isModelId(value.predicateId) ||
      !isPredicateEvaluator(value.evaluate)
    ) {
      return diagnostic(
        `/predicates/${index}`,
        "Model predicate must use the exact callable shape.",
      );
    }
    if (seen.has(value.predicateId)) {
      return diagnostic(`/predicates/${index}/predicateId`, "Model predicate IDs must be unique.");
    }
    seen.add(value.predicateId);
    predicates.push(
      Object.freeze({
        predicateId: value.predicateId,
        evaluate: value.evaluate,
      }),
    );
  }
  return Object.freeze(predicates);
}

function isDiagnostic(
  value: readonly NamedModelPredicate[] | GenerationDiagnostic,
): value is GenerationDiagnostic {
  return !Array.isArray(value);
}

function prefixBaselinePath(path: string): string {
  return path.length === 0 ? "/baseline" : `/baseline${path}`;
}

/**
 * Applies one named invalid-neighbor operation and proves that only its target becomes false.
 *
 * The baseline and changed module are validated snapshots. Capability functions are accepted only
 * as own data properties at their exact closed paths, and expected failures are returned as data.
 *
 * @param input Baseline, operation, and complete participating predicate set.
 * @returns A deeply immutable invalid neighbor or stable rejection diagnostics.
 *
 * @example
 * ```ts
 * const result = applyInvalidNeighbor({
 *   baseline,
 *   operation: {
 *     neighborId: "neighbor.rename-main",
 *     targetPredicateId: "predicate.main-present",
 *     diagnosticFamily: "missing-entrypoint",
 *     apply: renameMain,
 *   },
 *   predicates,
 * });
 * ```
 */
export function applyInvalidNeighbor(input: unknown): NeighborResult {
  try {
    const structuralFailure = inspectGeneratorInput(
      input,
      "",
      (path) => path === "/operation/apply" || /^\/predicates\/[0-9]+\/evaluate$/u.test(path),
    );
    if (structuralFailure !== undefined) {
      return failed(structuralFailure.path, structuralFailure.message);
    }
    if (!isRecord(input) || !hasExactKeys(input, INPUT_KEYS)) {
      return failed("", "Neighbor input must use the exact closed record shape.");
    }
    const baseline = validateGeneratorIr(input.baseline);
    if (!baseline.ok) {
      const first = baseline.diagnostics[0];
      return failed(
        prefixBaselinePath(first?.path ?? ""),
        first?.message ?? "Neighbor baseline is invalid.",
      );
    }
    const operation = normalizeOperation(input.operation);
    if (operation === undefined) {
      return failed("/operation", "Neighbor operation must use the exact callable shape.");
    }
    if (!Array.isArray(input.predicates)) {
      return failed("/predicates", "Model predicates must be an array.");
    }
    const predicates = normalizePredicates(input.predicates);
    if (isDiagnostic(predicates)) {
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([predicates]),
      });
    }
    const targetIndex = predicates.findIndex(
      (predicate) => predicate.predicateId === operation.targetPredicateId,
    );
    if (targetIndex < 0) {
      return failed(
        "/operation/targetPredicateId",
        "Neighbor target predicate is absent from the participating predicate set.",
      );
    }

    for (let index = 0; index < predicates.length; index += 1) {
      try {
        if (predicates[index]?.evaluate(baseline.module) !== true) {
          return failed(
            "/predicates",
            "Every participating predicate must be true for the baseline.",
          );
        }
      } catch {
        return failed(
          `/predicates/${index}/evaluate`,
          "Baseline predicate evaluation did not complete successfully.",
        );
      }
    }

    let changedInput: unknown;
    try {
      changedInput = operation.apply(baseline.module);
    } catch {
      return failed("/operation/apply", "Neighbor operation did not complete successfully.");
    }
    const changed = validateGeneratorIr(changedInput);
    if (!changed.ok) {
      return failed(
        "/operation/apply",
        "Neighbor operation must return a structurally valid generator module.",
      );
    }

    const after: boolean[] = [];
    for (let index = 0; index < predicates.length; index += 1) {
      try {
        after.push(predicates[index]?.evaluate(changed.module) === true);
      } catch {
        return failed(
          `/predicates/${index}/evaluate`,
          "Changed-module predicate evaluation did not complete successfully.",
        );
      }
    }
    const falseIndexes = after
      .map((value, index) => (value ? -1 : index))
      .filter((index) => index >= 0);
    if (falseIndexes.length !== 1 || falseIndexes[0] !== targetIndex) {
      return failed(
        "/predicates",
        "Neighbor operation must make exactly its named target predicate false.",
      );
    }

    return Object.freeze({
      ok: true,
      module: changed.module,
      neighborId: operation.neighborId,
      violatedPredicateId: operation.targetPredicateId,
      diagnosticFamily: operation.diagnosticFamily,
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  } catch {
    return failed("", "Neighbor input could not be inspected safely.");
  }
}
