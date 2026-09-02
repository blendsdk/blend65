import type { ExecutionResultV1 } from "@blend65/readiness";

import {
  failurePredicateEvidenceMatchesResultV1,
  getFailurePredicateEvidenceStateV1,
  type FailurePredicateEvidenceAuthorityV1,
} from "./failure-predicate-evidence.js";

const CONSUMED_SIDECARS = new WeakSet<object>();

function outcomeMatchesResult(
  authority: FailurePredicateEvidenceAuthorityV1,
  result: ExecutionResultV1,
): boolean {
  const evidence = getFailurePredicateEvidenceStateV1(authority);
  if (evidence === undefined) return false;
  const outcome = evidence.outcome;
  return (
    outcome.status === result.status &&
    outcome.tier === result.tier &&
    outcome.stage === result.stage &&
    outcome.code === result.code &&
    outcome.evidenceDigest === result.evidence.digest &&
    outcome.cleanup ===
      (result.status === "failure" && result.cleanupBlocker !== undefined ? "blocked" : "clear") &&
    (result.status === "pass" || outcome.adapterSubcode === result.adapterSubcode)
  );
}

/** Validates and consumes an exact positional sidecar list for one source report. */
export function consumeExecutionReportPredicateSidecarsV1(
  reportResults: readonly ExecutionResultV1[],
  input: readonly unknown[],
  sourceResults: readonly unknown[],
): readonly FailurePredicateEvidenceAuthorityV1[] | undefined {
  if (input.length !== reportResults.length || sourceResults.length !== reportResults.length) {
    return undefined;
  }
  const seen = new Set<object>();
  const sidecars: FailurePredicateEvidenceAuthorityV1[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const authority = input[index];
    const result = reportResults[index];
    if (
      typeof authority !== "object" ||
      authority === null ||
      result === undefined ||
      seen.has(authority) ||
      CONSUMED_SIDECARS.has(authority) ||
      !failurePredicateEvidenceMatchesResultV1(authority, sourceResults[index]) ||
      !outcomeMatchesResult(authority as FailurePredicateEvidenceAuthorityV1, result)
    ) {
      return undefined;
    }
    seen.add(authority);
    sidecars.push(authority as FailurePredicateEvidenceAuthorityV1);
  }
  for (const sidecar of sidecars) CONSUMED_SIDECARS.add(sidecar);
  return Object.freeze(sidecars);
}
