import { AsyncLocalStorage } from "node:async_hooks";

/** One exact mutation selection activated for an isolated production operation. */
export interface OracleMutationSelectionV1 {
  /** Stable mutant identity. */
  readonly mutantId: string;
  /** Closed production operation identity. */
  readonly operationId: string;
  /** Exact branch path within the operation. */
  readonly pathId: string;
  /** Closed mutation variant for the branch. */
  readonly variantId: string;
}

/** Additive direct-test selection whose stable identity is derived from its exact path. */
export type OracleMutationSelectionInputV1 =
  | OracleMutationSelectionV1
  | Omit<OracleMutationSelectionV1, "mutantId">;

/** Literal source marker for one reachable mutation dispatch branch. */
export interface OracleMutationDispatchMarkerV1 {
  /** Stable production operation identity. */
  readonly operationId: string;
  /** Exact reachable branch identity. */
  readonly pathId: string;
  /** Closed mutation variant for the branch. */
  readonly variantId: string;
}

const MUTATION_CONTEXT = new AsyncLocalStorage<OracleMutationSelectionV1>();
const ID_PATTERN = /^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/u;

/**
 * Marks one exact production mutation branch for static source verification.
 *
 * Arguments must remain literal strings so the source gate can exact-join every
 * real branch to the runtime registry and checked-in catalog.
 *
 * @param operationId Stable production operation identity.
 * @param pathId Exact reachable branch identity.
 * @param variantId Closed mutation variant for the branch.
 * @returns Immutable branch marker consumed by the runtime registry.
 *
 * @example
 * ```ts
 * const marker = oracleMutationDispatchMarker(
 *   "evaluator.normalize",
 *   "evaluator.normalize.byte",
 *   "integer-off-by-one-v1",
 * );
 * ```
 */
export function oracleMutationDispatchMarker(
  operationId: string,
  pathId: string,
  variantId: string,
): OracleMutationDispatchMarkerV1 {
  return Object.freeze({ operationId, pathId, variantId });
}

/**
 * Resolves one executable branch to its exact registered dispatch marker.
 *
 * Dynamic branch identities fail closed when their metadata is absent, so a
 * production route cannot silently fall back to baseline behavior.
 *
 * @param dispatches Complete marker manifest governing the operation.
 * @param operationId Stable operation identity.
 * @param pathId Exact reachable branch identity.
 * @param variantId Closed mutation variant for the branch.
 * @returns The immutable marker for the exact executable branch.
 *
 * @example
 * ```ts
 * const marker = requireOracleMutationDispatchMarker(
 *   markers,
 *   "evaluator.normalize",
 *   "evaluator.normalize.byte",
 *   "integer-off-by-one-v1",
 * );
 * ```
 */
export function requireOracleMutationDispatchMarker(
  dispatches: readonly OracleMutationDispatchMarkerV1[],
  operationId: string,
  pathId: string,
  variantId: string,
): OracleMutationDispatchMarkerV1 {
  const marker = dispatches.find(
    (candidate) =>
      candidate.operationId === operationId &&
      candidate.pathId === pathId &&
      candidate.variantId === variantId,
  );
  if (marker === undefined) {
    throw new TypeError("missing oracle mutation dispatch marker");
  }
  return marker;
}

function closeSelection(selection: OracleMutationSelectionInputV1): OracleMutationSelectionV1 {
  try {
    const mutantId = Object.hasOwn(selection, "mutantId")
      ? Reflect.get(selection, "mutantId")
      : `mutant.${selection.pathId}`;
    if (
      typeof selection !== "object" ||
      selection === null ||
      Object.getPrototypeOf(selection) !== Object.prototype ||
      typeof mutantId !== "string" ||
      !ID_PATTERN.test(mutantId) ||
      !ID_PATTERN.test(selection.operationId) ||
      !ID_PATTERN.test(selection.pathId) ||
      !ID_PATTERN.test(selection.variantId)
    ) {
      throw new TypeError("invalid oracle mutation selection");
    }
    return Object.freeze({
      mutantId,
      operationId: selection.operationId,
      pathId: selection.pathId,
      variantId: selection.variantId,
    });
  } catch {
    throw new TypeError("invalid oracle mutation selection");
  }
}

function equalSelection(
  left: OracleMutationSelectionV1,
  right: OracleMutationSelectionV1,
): boolean {
  return (
    left.mutantId === right.mutantId &&
    left.operationId === right.operationId &&
    left.pathId === right.pathId &&
    left.variantId === right.variantId
  );
}

/**
 * Runs and awaits one operation inside an isolated mutation selection.
 *
 * Identical nesting reuses the active selection. Incompatible nesting rejects
 * before invoking the nested operation, so one async chain can never combine
 * mutations.
 *
 * @param selection Exact operation, path, and closed mutation variant.
 * @param operation Production operation to invoke.
 * @returns The operation's unchanged awaited result.
 *
 * @example
 * ```ts
 * await runWithOracleMutationVariant(selection, () => evaluate());
 * ```
 */
export async function runWithOracleMutationVariant<T>(
  selection: OracleMutationSelectionInputV1,
  operation: () => T | Promise<T>,
): Promise<T> {
  const closed = closeSelection(selection);
  const active = MUTATION_CONTEXT.getStore();
  if (active !== undefined) {
    if (!equalSelection(active, closed)) {
      throw new TypeError("incompatible nested oracle mutation selection");
    }
    return operation();
  }
  return MUTATION_CONTEXT.run(closed, operation);
}

/**
 * Returns the selected mutation variant for one exact production branch.
 *
 * Production dispatch supplies the exact marker that also feeds the runtime
 * registry. The two-string form remains available only for isolated conformance
 * observation, while source validation rejects that form in production modules.
 *
 * @param marker Exact metadata for the executable branch.
 * @returns Active variant only for the exact pair, otherwise `undefined`.
 *
 * @example
 * ```ts
 * const variant = selectedOracleMutationVariant(marker);
 * ```
 */
export function selectedOracleMutationVariant(
  marker: OracleMutationDispatchMarkerV1,
): string | undefined;
export function selectedOracleMutationVariant(
  operationId: string,
  pathId: string,
): string | undefined;
export function selectedOracleMutationVariant(
  markerOrOperationId: OracleMutationDispatchMarkerV1 | string,
  optionalPathId?: string,
): string | undefined {
  const marker = typeof markerOrOperationId === "string" ? undefined : markerOrOperationId;
  const operationId =
    typeof markerOrOperationId === "string" ? markerOrOperationId : markerOrOperationId.operationId;
  const pathId =
    typeof markerOrOperationId === "string" ? optionalPathId : markerOrOperationId.pathId;
  const selection = MUTATION_CONTEXT.getStore();
  if (
    selection?.operationId !== operationId ||
    selection.pathId !== pathId ||
    (marker !== undefined && marker.variantId !== selection.variantId)
  ) {
    return undefined;
  }
  return selection.variantId;
}
