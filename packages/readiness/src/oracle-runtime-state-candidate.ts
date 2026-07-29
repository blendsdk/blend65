import type { OracleResultV1, OracleSuite } from "./oracle-model.js";
import { evaluateFixedOracleCandidate } from "./oracle-candidate-adapter.js";

/**
 * Evaluates the selected runtime-state candidate through the complete source oracle.
 *
 * @param suite Accepted oracle authority.
 * @param request Hostile raw request.
 * @returns Closed raw oracle result.
 *
 * @example
 * ```ts
 * const result = evaluateRuntimeStateCandidate(suite, request);
 * ```
 */
export function evaluateRuntimeStateCandidate(
  suite: OracleSuite,
  request: unknown,
): OracleResultV1 {
  return evaluateFixedOracleCandidate(suite, "oracle.runtime-state", request);
}
