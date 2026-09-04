import { AsyncLocalStorage } from "node:async_hooks";

import {
  oracleMutationDispatchMarker,
  requireOracleMutationDispatchMarker,
  selectedOracleMutationVariant,
} from "./oracle-conformance-v1.js";
import type { SemanticRelationId } from "./oracle-model.js";
import { STRUCTURED_RELATION_MUTATION_PATHS } from "./structured-oracle-evaluator.js";
/** Stable precondition dispatch points used by relation conformance tests. */
export type SemanticRelationPreconditionPathId =
  | "relation.identifier-renaming.precondition"
  | "relation.literal-to-local.precondition"
  | "relation.local-to-parameter.precondition"
  | "relation.algebraic-identity.precondition"
  | "relation.independent-declaration-reordering.precondition"
  | "relation.loop-unrolling.precondition";

/** Stable rewrite dispatch points used by relation conformance tests. */
export type SemanticRelationRewritePathId =
  | "relation.identifier-renaming.rewrite"
  | "relation.literal-to-local.rewrite"
  | "relation.local-to-parameter.rewrite"
  | "relation.algebraic-identity.rewrite"
  | "relation.independent-declaration-reordering.rewrite"
  | "relation.loop-unrolling.rewrite";

/** Stable comparator dispatch points used by relation conformance tests. */
export type SemanticRelationComparatorPathId =
  | "relation.identifier-renaming.comparator"
  | "relation.literal-to-local.comparator"
  | "relation.local-to-parameter.comparator"
  | "relation.algebraic-identity.comparator"
  | "relation.independent-declaration-reordering.comparator"
  | "relation.loop-unrolling.comparator";

/** Every stable semantic-relation production path. */
export type SemanticRelationPathId =
  | SemanticRelationPreconditionPathId
  | SemanticRelationRewritePathId
  | SemanticRelationComparatorPathId;

/** Closed relation fault record accepted by the private production seam. */
export type SemanticRelationFaultV1 =
  | {
      readonly schemaVersion: 1;
      readonly pathId: SemanticRelationPreconditionPathId;
      readonly faultId:
        | "relation.fault.force-precondition-false"
        | "relation.fault.force-precondition-true";
    }
  | {
      readonly schemaVersion: 1;
      readonly pathId: SemanticRelationRewritePathId;
      readonly faultId:
        | "relation.fault.non-preserving-rewrite"
        | "relation.fault.semantic-closure-invalid-rewrite";
    }
  | {
      readonly schemaVersion: 1;
      readonly pathId: SemanticRelationComparatorPathId;
      readonly faultId: "relation.fault.omit-required-observable";
    };

/** Runtime input accepted by the private fault scope before correlation validation. */
export interface SemanticRelationFaultInputV1 {
  /** Conformance protocol version. */
  readonly schemaVersion: 1;
  /** Exact stable production checkpoint. */
  readonly pathId: SemanticRelationPathId;
  /** Closed fault selected for that checkpoint class. */
  readonly faultId:
    | "relation.fault.force-precondition-false"
    | "relation.fault.force-precondition-true"
    | "relation.fault.non-preserving-rewrite"
    | "relation.fault.semantic-closure-invalid-rewrite"
    | "relation.fault.omit-required-observable";
}

const RELATIONS = [
  "identifier-renaming",
  "literal-to-local",
  "local-to-parameter",
  "algebraic-identity",
  "independent-declaration-reordering",
  "loop-unrolling",
] as const;
const FAULT_CONTEXT = new AsyncLocalStorage<SemanticRelationFaultV1>();

/** Closed relation branches and variants required by mutation conformance. */
export const ORACLE_RELATION_MUTATION_PATHS = Object.freeze([
  ...STRUCTURED_RELATION_MUTATION_PATHS,
  oracleMutationDispatchMarker(
    "relation.algebraic-identity",
    "relation.algebraic-identity.comparator",
    "omit-required-observable-v1",
  ),
  oracleMutationDispatchMarker(
    "relation.algebraic-identity",
    "relation.algebraic-identity.precondition",
    "force-true-v1",
  ),
  oracleMutationDispatchMarker(
    "relation.algebraic-identity",
    "relation.algebraic-identity.rewrite",
    "non-preserving.add-zero-right",
  ),
  oracleMutationDispatchMarker(
    "relation.algebraic-identity",
    "relation.algebraic-identity.rewrite",
    "non-preserving.and-all-ones-right",
  ),
  oracleMutationDispatchMarker(
    "relation.algebraic-identity",
    "relation.algebraic-identity.rewrite",
    "non-preserving.divide-one-right",
  ),
  oracleMutationDispatchMarker(
    "relation.algebraic-identity",
    "relation.algebraic-identity.rewrite",
    "non-preserving.multiply-one-right",
  ),
  oracleMutationDispatchMarker(
    "relation.algebraic-identity",
    "relation.algebraic-identity.rewrite",
    "non-preserving.or-zero-right",
  ),
  oracleMutationDispatchMarker(
    "relation.algebraic-identity",
    "relation.algebraic-identity.rewrite",
    "non-preserving.shift-left-zero",
  ),
  oracleMutationDispatchMarker(
    "relation.algebraic-identity",
    "relation.algebraic-identity.rewrite",
    "non-preserving.shift-right-zero",
  ),
  oracleMutationDispatchMarker(
    "relation.algebraic-identity",
    "relation.algebraic-identity.rewrite",
    "non-preserving.subtract-zero-right",
  ),
  oracleMutationDispatchMarker(
    "relation.algebraic-identity",
    "relation.algebraic-identity.rewrite",
    "non-preserving.xor-zero-right",
  ),
  oracleMutationDispatchMarker(
    "relation.identifier-renaming",
    "relation.identifier-renaming.comparator",
    "omit-required-observable-v1",
  ),
  oracleMutationDispatchMarker(
    "relation.identifier-renaming",
    "relation.identifier-renaming.precondition",
    "force-true-v1",
  ),
  oracleMutationDispatchMarker(
    "relation.identifier-renaming",
    "relation.identifier-renaming.rewrite",
    "non-preserving.fresh-sibling-v1",
  ),
  oracleMutationDispatchMarker(
    "relation.independent-declaration-reordering",
    "relation.independent-declaration-reordering.comparator",
    "omit-required-observable-v1",
  ),
  oracleMutationDispatchMarker(
    "relation.independent-declaration-reordering",
    "relation.independent-declaration-reordering.precondition",
    "force-true-v1",
  ),
  oracleMutationDispatchMarker(
    "relation.independent-declaration-reordering",
    "relation.independent-declaration-reordering.rewrite",
    "non-preserving.swap-independent-constants-v1",
  ),
  oracleMutationDispatchMarker(
    "relation.literal-to-local",
    "relation.literal-to-local.comparator",
    "omit-required-observable-v1",
  ),
  oracleMutationDispatchMarker(
    "relation.literal-to-local",
    "relation.literal-to-local.precondition",
    "force-true-v1",
  ),
  oracleMutationDispatchMarker(
    "relation.literal-to-local",
    "relation.literal-to-local.rewrite",
    "non-preserving.introduce-local-v1",
  ),
  oracleMutationDispatchMarker(
    "relation.local-to-parameter",
    "relation.local-to-parameter.comparator",
    "omit-required-observable-v1",
  ),
  oracleMutationDispatchMarker(
    "relation.local-to-parameter",
    "relation.local-to-parameter.precondition",
    "force-true-v1",
  ),
  oracleMutationDispatchMarker(
    "relation.local-to-parameter",
    "relation.local-to-parameter.rewrite",
    "non-preserving.lift-entry-local-v1",
  ),
]);

function isPreconditionPath(
  pathId: SemanticRelationPathId,
): pathId is SemanticRelationPreconditionPathId {
  return RELATIONS.some((relation) => pathId === `relation.${relation}.precondition`);
}

function isRewritePath(pathId: SemanticRelationPathId): pathId is SemanticRelationRewritePathId {
  return RELATIONS.some((relation) => pathId === `relation.${relation}.rewrite`);
}

function isComparatorPath(
  pathId: SemanticRelationPathId,
): pathId is SemanticRelationComparatorPathId {
  return RELATIONS.some((relation) => pathId === `relation.${relation}.comparator`);
}

function closeFault(fault: SemanticRelationFaultInputV1): SemanticRelationFaultV1 | undefined {
  if (fault.schemaVersion !== 1) return undefined;
  if (
    fault.faultId === "relation.fault.force-precondition-false" ||
    fault.faultId === "relation.fault.force-precondition-true"
  ) {
    return isPreconditionPath(fault.pathId)
      ? Object.freeze({
          schemaVersion: 1,
          pathId: fault.pathId,
          faultId: fault.faultId,
        })
      : undefined;
  }
  if (
    fault.faultId === "relation.fault.non-preserving-rewrite" ||
    fault.faultId === "relation.fault.semantic-closure-invalid-rewrite"
  ) {
    return isRewritePath(fault.pathId)
      ? Object.freeze({
          schemaVersion: 1,
          pathId: fault.pathId,
          faultId: fault.faultId,
        })
      : undefined;
  }
  return fault.faultId === "relation.fault.omit-required-observable" &&
    isComparatorPath(fault.pathId)
    ? Object.freeze({
        schemaVersion: 1,
        pathId: fault.pathId,
        faultId: fault.faultId,
      })
    : undefined;
}

/**
 * Runs one callback with an immutable operation-local relation fault.
 *
 * This conformance seam is intentionally absent from the package index. It uses
 * callback-scoped async context so concurrent baseline and mutant operations
 * cannot observe each other's faults.
 *
 * @param fault Closed relation path and fault identity.
 * @param operation Exact production operation to invoke.
 * @returns The callback's unchanged result.
 */
export function runWithSemanticRelationFault<T>(
  fault: SemanticRelationFaultInputV1,
  operation: () => T,
): T {
  const closed = closeFault(fault);
  if (closed === undefined) throw new TypeError("invalid semantic relation fault");
  return FAULT_CONTEXT.run(closed, operation);
}

/** Returns the stable precondition path for one closed relation ID. */
export function semanticRelationPreconditionPath(
  relationId:
    | "relation.identifier-renaming"
    | "relation.literal-to-local"
    | "relation.local-to-parameter"
    | "relation.algebraic-identity"
    | "relation.independent-declaration-reordering"
    | "relation.loop-unrolling",
): SemanticRelationPreconditionPathId {
  switch (relationId) {
    case "relation.identifier-renaming":
      return "relation.identifier-renaming.precondition";
    case "relation.literal-to-local":
      return "relation.literal-to-local.precondition";
    case "relation.local-to-parameter":
      return "relation.local-to-parameter.precondition";
    case "relation.algebraic-identity":
      return "relation.algebraic-identity.precondition";
    case "relation.independent-declaration-reordering":
      return "relation.independent-declaration-reordering.precondition";
    case "relation.loop-unrolling":
      return "relation.loop-unrolling.precondition";
  }
}

/** Returns the stable rewrite path for one closed relation ID. */
export function semanticRelationRewritePath(
  relationId:
    | "relation.identifier-renaming"
    | "relation.literal-to-local"
    | "relation.local-to-parameter"
    | "relation.algebraic-identity"
    | "relation.independent-declaration-reordering"
    | "relation.loop-unrolling",
): SemanticRelationRewritePathId {
  switch (relationId) {
    case "relation.identifier-renaming":
      return "relation.identifier-renaming.rewrite";
    case "relation.literal-to-local":
      return "relation.literal-to-local.rewrite";
    case "relation.local-to-parameter":
      return "relation.local-to-parameter.rewrite";
    case "relation.algebraic-identity":
      return "relation.algebraic-identity.rewrite";
    case "relation.independent-declaration-reordering":
      return "relation.independent-declaration-reordering.rewrite";
    case "relation.loop-unrolling":
      return "relation.loop-unrolling.rewrite";
  }
}

/** Returns the stable comparator path for one closed relation ID. */
export function semanticRelationComparatorPath(
  relationId:
    | "relation.identifier-renaming"
    | "relation.literal-to-local"
    | "relation.local-to-parameter"
    | "relation.algebraic-identity"
    | "relation.independent-declaration-reordering"
    | "relation.loop-unrolling",
): SemanticRelationComparatorPathId {
  switch (relationId) {
    case "relation.identifier-renaming":
      return "relation.identifier-renaming.comparator";
    case "relation.literal-to-local":
      return "relation.literal-to-local.comparator";
    case "relation.local-to-parameter":
      return "relation.local-to-parameter.comparator";
    case "relation.algebraic-identity":
      return "relation.algebraic-identity.comparator";
    case "relation.independent-declaration-reordering":
      return "relation.independent-declaration-reordering.comparator";
    case "relation.loop-unrolling":
      return "relation.loop-unrolling.comparator";
  }
}

/**
 * Returns the active fault only when it belongs to the exact production path.
 *
 * @param pathId Production checkpoint being executed.
 * @returns Matching immutable fault, or `undefined` for the normal path.
 */
export function currentSemanticRelationFault(
  pathId: SemanticRelationPathId,
): SemanticRelationFaultV1 | undefined {
  const fault = FAULT_CONTEXT.getStore();
  return fault?.pathId === pathId ? fault : undefined;
}

/**
 * Applies the exact mutation-aware decision at a relation precondition boundary.
 *
 * @param relationId Relation that owns the precondition.
 * @param baseline Result of the real semantic precondition.
 * @returns Baseline result, forced false for legacy conformance, or forced true for mutation proof.
 */
export function semanticRelationPreconditionAccepted(
  relationId: SemanticRelationId | "relation.loop-unrolling",
  baseline: boolean,
): boolean {
  const pathId = semanticRelationPreconditionPath(relationId);
  if (currentSemanticRelationFault(pathId)?.faultId === "relation.fault.force-precondition-false") {
    return false;
  }
  if (currentSemanticRelationFault(pathId)?.faultId === "relation.fault.force-precondition-true") {
    return true;
  }
  return selectedOracleMutationVariant(
    requireOracleMutationDispatchMarker(
      ORACLE_RELATION_MUTATION_PATHS,
      relationId,
      pathId,
      "force-true-v1",
    ),
  ) === "force-true-v1"
    ? true
    : baseline;
}

/**
 * Returns the active closed non-preserving rewrite variant for one relation request.
 *
 * @param relationId Relation that owns the rewrite.
 * @param baselineVariantId Exact ordinary rewrite variant being applied.
 * @returns Whether that exact rewrite branch is selected for mutation.
 */
export function semanticRelationRewriteIsMutated(
  relationId: SemanticRelationId | "relation.loop-unrolling",
  baselineVariantId: string,
): boolean {
  return (
    selectedOracleMutationVariant(
      requireOracleMutationDispatchMarker(
        ORACLE_RELATION_MUTATION_PATHS,
        relationId,
        semanticRelationRewritePath(relationId),
        `non-preserving.${baselineVariantId}`,
      ),
    ) === `non-preserving.${baselineVariantId}`
  );
}

/** Reports whether the structured rewrite must violate semantic closure. */
export function structuredLoopClosureRewriteIsMutated(): boolean {
  return (
    selectedOracleMutationVariant(
      requireOracleMutationDispatchMarker(
        ORACLE_RELATION_MUTATION_PATHS,
        "relation.loop-unrolling",
        "relation.loop-unrolling.rewrite",
        "semantic-closure-invalid-v1",
      ),
    ) === "semantic-closure-invalid-v1"
  );
}
