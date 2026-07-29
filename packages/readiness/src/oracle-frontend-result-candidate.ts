import type { OracleResultV1, OracleSuite } from "./oracle-model.js";
import { evaluateFixedOracleCandidate } from "./oracle-candidate-adapter.js";

/**
 * Evaluates the selected frontend-result candidate through the complete source oracle.
 *
 * @param suite Accepted oracle authority.
 * @param request Hostile raw request.
 * @returns Closed raw oracle result.
 *
 * @example
 * ```ts
 * const result = evaluateFrontendResultCandidate(suite, request);
 * ```
 */
export function evaluateFrontendResultCandidate(
  suite: OracleSuite,
  request: unknown,
): OracleResultV1 {
  return evaluateFixedOracleCandidate(suite, "oracle.frontend-result", request);
}
