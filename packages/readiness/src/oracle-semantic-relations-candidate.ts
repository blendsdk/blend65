import type { OracleSuite } from "./oracle-model.js";
import type { SemanticRelationResultV1 } from "./semantic-relation-model.js";
import { evaluateSemanticRelation } from "./semantic-relations.js";

/**
 * Evaluates the selected semantic-relation candidate through the complete relation proof.
 *
 * @param suite Accepted oracle authority.
 * @param request Hostile raw relation request.
 * @returns Closed relation result.
 *
 * @example
 * ```ts
 * const result = evaluateSemanticRelationsCandidate(suite, request);
 * ```
 */
export function evaluateSemanticRelationsCandidate(
  suite: OracleSuite,
  request: unknown,
): SemanticRelationResultV1 {
  return evaluateSemanticRelation(suite, request);
}
