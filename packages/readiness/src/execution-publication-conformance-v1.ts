import { AsyncLocalStorage } from "node:async_hooks";
import { isAbsolute, posix } from "node:path";

import type { ExecutionOperationResultV1 } from "./execution-contracts.js";
import {
  executionPublicationFailure,
  executionPublicationSuccess,
} from "./execution-publication-model.js";

/** Closed durable boundaries exposed only to operation-scoped conformance tests. */
export type ExecutionPublicationFaultPointV1 =
  | "after-member-sync"
  | "after-staging-sync"
  | "before-review-validation"
  | "after-review-validation"
  | "before-release-rename"
  | "after-release-rename"
  | "after-releases-sync"
  | "before-pointer-write"
  | "after-pointer-file-sync"
  | "before-pointer-rename"
  | "after-pointer-rename"
  | "after-pointer-directory-sync"
  | "during-reconciliation";

/** Bounded observation emitted while classifying a failed durable commit. */
export interface ExecutionPublicationReconciliationObservationV1 {
  readonly operation: "execution-publication-selection";
  readonly expectedDigest: string;
  readonly selectedDigest?: string;
  readonly state: "committed" | "prior-selection" | "ambiguous";
}

/** Operation-local passive fault and observation hooks. */
export interface ExecutionPublicationConformanceHooksV1 {
  readonly atFaultPoint?: (
    point: ExecutionPublicationFaultPointV1,
    context: Readonly<Record<string, unknown>>,
  ) => void | Promise<void>;
  readonly atReconciliationObservation?: (
    observation: ExecutionPublicationReconciliationObservationV1,
  ) => void | Promise<void>;
}

/** One production source supplied to the pure execution-authority boundary validator. */
export interface ExecutionPublicationBoundaryFileV1 {
  readonly path: string;
  readonly source: string;
}

declare global {
  // Vitest loads package public exports from built files while conformance hooks are imported from
  // source. A process-local slot keeps both module instances in the same isolated async scope.
  var __blend65ExecutionPublicationConformanceV1:
    | AsyncLocalStorage<ExecutionPublicationConformanceHooksV1>
    | undefined;
}

const CONFORMANCE =
  globalThis.__blend65ExecutionPublicationConformanceV1 ??
  new AsyncLocalStorage<ExecutionPublicationConformanceHooksV1>();
globalThis.__blend65ExecutionPublicationConformanceV1 = CONFORMANCE;
const EXECUTION_PUBLICATION_OWNERS = new Set([
  "execution-publication-conformance-v1.ts",
  "execution-publication-model.ts",
  "execution-publication-pointer.ts",
  "execution-publication-resolver.ts",
  "execution-publication-transaction.ts",
]);
const EXECUTION_PUBLICATION_LITERAL =
  /(?:readiness\/execution-publications|current-execution-publication\.json|execution-manifest-v1\.json|execution-bindings-v1\.json|execution-parent-v1\.json|execution-semantic-review-v1\.json|execution-publication-v1|EXECUTION_PUBLICATIONS_ROOT|CURRENT_EXECUTION_PUBLICATION_FILENAME|EXECUTION_MANIFEST_V1_FILENAME|EXECUTION_BINDINGS_V1_FILENAME|EXECUTION_PARENT_V1_FILENAME|EXECUTION_SEMANTIC_REVIEW_V1_FILENAME|EXECUTION_PUBLICATION_V1_KIND)/u;
const EXACT_HISTORICAL_PUBLICATION_LITERAL =
  /(["'])(?:readiness\/publications|current-publication\.json|compiler-readiness-v1\.json|bindings-v1\.json|rule-models-v1(?:-review)?\.json|semantic-review-v1\.json|manifest\.json|publication-v1)\1/u;

function normalizedPackagePath(path: string): string | undefined {
  if (
    path.length === 0 ||
    path.includes("\\") ||
    isAbsolute(path) ||
    posix.normalize(path) !== path ||
    path === ".." ||
    path.startsWith("../") ||
    path.startsWith("./")
  ) {
    return undefined;
  }
  return path;
}

/**
 * Runs one operation with async-isolated passive publication conformance hooks.
 *
 * The hooks can observe or fail named durability boundaries but cannot receive a release,
 * callback, pointer authority, or live handler.
 */
export function runWithExecutionPublicationConformanceV1<T>(
  hooks: ExecutionPublicationConformanceHooksV1,
  operation: () => T | Promise<T>,
): Promise<T> {
  const closed = Object.freeze({ ...hooks });
  return Promise.resolve(CONFORMANCE.run(closed, operation));
}

/** Invokes one operation-local publication fault boundary when configured. */
export async function executionPublicationFaultPointV1(
  point: ExecutionPublicationFaultPointV1,
  context: Readonly<Record<string, unknown>> = Object.freeze({}),
): Promise<void> {
  await CONFORMANCE.getStore()?.atFaultPoint?.(point, Object.freeze({ ...context }));
}

/** Emits a frozen bounded reconciliation observation. */
export async function executionPublicationReconciliationObservationV1(
  observation: ExecutionPublicationReconciliationObservationV1,
): Promise<void> {
  await CONFORMANCE.getStore()?.atReconciliationObservation?.(Object.freeze({ ...observation }));
}

/**
 * Confines the execution-publication literal family to its exact readiness owners.
 *
 * @param files Bounded complete or synthetic production-source records.
 * @returns Success only when every authority literal remains in an approved module.
 */
export function validateExecutionPublicationModuleBoundaryV1(
  files: readonly ExecutionPublicationBoundaryFileV1[],
): ExecutionOperationResultV1<true> {
  if (!Array.isArray(files) || files.length > 512) {
    return executionPublicationFailure(
      "execution.invalid-schema",
      "/files",
      "Execution publication boundary input must be a bounded source array.",
    );
  }
  const seen = new Set<string>();
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const normalized =
      typeof file === "object" && file !== null && typeof file.path === "string"
        ? normalizedPackagePath(file.path)
        : undefined;
    if (
      typeof file !== "object" ||
      file === null ||
      normalized === undefined ||
      typeof file.source !== "string" ||
      seen.has(normalized)
    ) {
      return executionPublicationFailure(
        "execution.invalid-schema",
        `/files/${index}`,
        "Execution publication sources must have unique paths and ordinary source text.",
      );
    }
    seen.add(normalized);
    if (
      EXECUTION_PUBLICATION_LITERAL.test(file.source) &&
      !EXECUTION_PUBLICATION_OWNERS.has(normalized)
    ) {
      return executionPublicationFailure(
        "execution.identity",
        file.path,
        "Execution publication authority literal escaped its owning module family.",
      );
    }
    if (
      EXECUTION_PUBLICATION_OWNERS.has(normalized) &&
      EXACT_HISTORICAL_PUBLICATION_LITERAL.test(file.source)
    ) {
      return executionPublicationFailure(
        "execution.identity",
        file.path,
        "Execution publication owner contains exact historical publication authority.",
      );
    }
  }
  return executionPublicationSuccess(true);
}
