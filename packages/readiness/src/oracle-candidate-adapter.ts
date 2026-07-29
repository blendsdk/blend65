import { evaluateSourceOracleCase } from "./oracle-handlers.js";
import { isOracleRecord, oracleFailure, snapshotOracleInput } from "./oracle-input.js";
import type { OracleHandlerIdV1, OracleResultV1, OracleSuite } from "./oracle-model.js";

/**
 * Evaluates one candidate only when the snapshotted request names its fixed handler identity.
 *
 * @param suite Accepted oracle authority.
 * @param expectedHandlerId Handler identity owned by the candidate entrypoint.
 * @param request Hostile raw request.
 * @returns Closed raw result or a route diagnostic at the handler discriminator.
 *
 * @example
 * ```ts
 * evaluateFixedOracleCandidate(suite, "oracle.frontend-result", request);
 * ```
 */
export function evaluateFixedOracleCandidate(
  suite: OracleSuite,
  expectedHandlerId: OracleHandlerIdV1,
  request: unknown,
): OracleResultV1 {
  const snapshot = snapshotOracleInput(request);
  if (!snapshot.ok) return snapshot;
  if (!isOracleRecord(snapshot.value) || snapshot.value.handlerId !== expectedHandlerId) {
    return oracleFailure(
      "oracle.route.invalid",
      "/handlerId",
      "Oracle request does not name this candidate handler.",
    );
  }
  return evaluateSourceOracleCase(suite, snapshot.value);
}
