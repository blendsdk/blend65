import { isDeepStrictEqual } from "node:util";

import {
  currentSemanticRelationFault,
  ORACLE_RELATION_MUTATION_PATHS,
  semanticRelationComparatorPath,
} from "./semantic-relation-conformance.js";
import {
  requireOracleMutationDispatchMarker,
  selectedOracleMutationVariant,
} from "./oracle-conformance-v1.js";
import type { OracleValueV1, OracleObservationV1, SemanticRelationId } from "./oracle-model.js";

function alternateNumericType(
  type: Extract<OracleValueV1, { readonly kind: "integer" }>["type"],
): Extract<OracleValueV1, { readonly kind: "integer" }>["type"] {
  switch (type) {
    case "byte":
      return "sbyte";
    case "sbyte":
      return "byte";
    case "word":
      return "sword";
    case "sword":
      return "word";
  }
}

/**
 * Applies the deterministic comparator-omission witness at one exact path.
 *
 * The witness changes only a numeric return type. The injected comparator
 * deliberately omits that type while the immutable specification can still see
 * both complete observations in the rich result.
 *
 * @param relationId Relation selecting the comparator path.
 * @param observation Real transformed observation.
 * @returns Real observation or immutable type-only mismatch witness.
 */
export function semanticRelationComparatorWitness(
  relationId: SemanticRelationId,
  observation: OracleObservationV1,
): OracleObservationV1 {
  const pathId = semanticRelationComparatorPath(relationId);
  const fault = currentSemanticRelationFault(pathId);
  if (
    fault?.faultId !== "relation.fault.omit-required-observable" &&
    selectedOracleMutationVariant(
      requireOracleMutationDispatchMarker(
        ORACLE_RELATION_MUTATION_PATHS,
        relationId,
        pathId,
        "omit-required-observable-v1",
      ),
    ) !== "omit-required-observable-v1"
  ) {
    return observation;
  }
  if (observation.kind === "diagnostic") {
    return Object.freeze({ ...observation, code: `${observation.code}.omitted-witness` });
  }
  if (observation.kind === "binding-rejection") {
    return Object.freeze({
      ...observation,
      rejectionCode:
        observation.rejectionCode === "binding.value.type-invalid"
          ? "binding.value.range-invalid"
          : "binding.value.type-invalid",
    });
  }
  if (observation.returnValue === null) {
    return Object.freeze({
      ...observation,
      finalMemory: Object.freeze([
        ...observation.finalMemory,
        Object.freeze({ address: 0xffffn, value: 0n }),
      ]),
    });
  }
  if (observation.returnValue.kind === "boolean") {
    return Object.freeze({
      ...observation,
      returnValue: Object.freeze({
        ...observation.returnValue,
        value: !observation.returnValue.value,
      }),
    });
  }
  return Object.freeze({
    ...observation,
    returnValue: Object.freeze({
      ...observation.returnValue,
      type: alternateNumericType(observation.returnValue.type),
    }),
  });
}

function compareFaultWitness(
  source: OracleObservationV1,
  transformed: OracleObservationV1,
): boolean {
  if (source.kind !== transformed.kind) return false;
  if (source.kind === "diagnostic" && transformed.kind === "diagnostic") {
    return (
      source.ruleId === transformed.ruleId &&
      source.neighborId === transformed.neighborId &&
      source.phase === transformed.phase &&
      source.severity === transformed.severity
    );
  }
  if (source.kind === "binding-rejection" && transformed.kind === "binding-rejection") {
    return (
      source.ruleId === transformed.ruleId &&
      source.neighborId === transformed.neighborId &&
      source.spelling === transformed.spelling
    );
  }
  if (source.kind === "value-state" && transformed.kind === "value-state") {
    if (source.returnValue === null || transformed.returnValue === null) {
      return (
        source.returnValue === transformed.returnValue &&
        isDeepStrictEqual(source.effects, transformed.effects)
      );
    }
    if (source.returnValue.kind === "boolean" && transformed.returnValue.kind === "boolean") {
      return (
        isDeepStrictEqual(source.effects, transformed.effects) &&
        isDeepStrictEqual(source.finalMemory, transformed.finalMemory)
      );
    }
    return (
      source.returnValue.kind === transformed.returnValue.kind &&
      source.returnValue.value === transformed.returnValue.value &&
      isDeepStrictEqual(source.effects, transformed.effects) &&
      isDeepStrictEqual(source.finalMemory, transformed.finalMemory)
    );
  }
  return false;
}

function compareExactValueState(
  source: OracleObservationV1,
  transformed: OracleObservationV1,
): boolean {
  return (
    source.kind === "value-state" &&
    transformed.kind === "value-state" &&
    isDeepStrictEqual(source, transformed)
  );
}

function compareIdentifierProjection(
  source: OracleObservationV1,
  transformed: OracleObservationV1,
): boolean {
  if (source.kind !== transformed.kind) return false;
  if (source.kind === "value-state" && transformed.kind === "value-state") {
    return isDeepStrictEqual(source, transformed);
  }
  if (source.kind === "diagnostic" && transformed.kind === "diagnostic") {
    return (
      source.code === transformed.code &&
      source.phase === transformed.phase &&
      source.severity === transformed.severity
    );
  }
  return (
    source.kind === "binding-rejection" &&
    transformed.kind === "binding-rejection" &&
    source.ruleId === transformed.ruleId &&
    source.neighborId === transformed.neighborId &&
    source.spelling === transformed.spelling &&
    source.rejectionCode === transformed.rejectionCode
  );
}

/**
 * Compares the exact observable projection owned by one relation.
 *
 * @param relationId Relation selecting the comparator path.
 * @param source Complete source observation.
 * @param transformed Complete transformed observation or conformance witness.
 * @returns Whether the relation-specific projection is exactly equivalent.
 */
export function compareSemanticRelationObservations(
  relationId: SemanticRelationId,
  source: OracleObservationV1,
  transformed: OracleObservationV1,
): boolean {
  const pathId = semanticRelationComparatorPath(relationId);
  const fault = currentSemanticRelationFault(pathId);
  if (
    fault?.faultId === "relation.fault.omit-required-observable" ||
    selectedOracleMutationVariant(
      requireOracleMutationDispatchMarker(
        ORACLE_RELATION_MUTATION_PATHS,
        relationId,
        pathId,
        "omit-required-observable-v1",
      ),
    ) === "omit-required-observable-v1"
  ) {
    return compareFaultWitness(source, transformed);
  }
  switch (relationId) {
    case "relation.identifier-renaming":
    case "relation.independent-declaration-reordering":
      return compareIdentifierProjection(source, transformed);
    case "relation.literal-to-local":
    case "relation.local-to-parameter":
    case "relation.algebraic-identity":
      return compareExactValueState(source, transformed);
  }
}
