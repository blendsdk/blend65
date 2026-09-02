import {
  isExecutionDigestV1,
  type ExecutionRoutePlanItemV1,
  type Sha256Digest,
} from "@blend65/readiness";

import { getGeneratedExecutionImplementationRevisionV1 } from "./execution-publication-catalog.js";
import type { FailurePredicateEvidenceCompletionV1 } from "./failure-predicate-evidence.js";

/** Resolves route-relevant contract revisions from the authenticated generated handler catalog. */
export function createFailurePredicateEvidenceCompletionV1(
  route: ExecutionRoutePlanItemV1,
  oracleContractDigest: unknown,
): FailurePredicateEvidenceCompletionV1 | undefined {
  if (!isExecutionDigestV1(oracleContractDigest)) return undefined;
  const tiers = new Set([...route.prerequisiteTiers, route.terminalTier]);
  const digests: Sha256Digest[] = [];
  for (const tier of tiers) {
    const implementationRevision = getGeneratedExecutionImplementationRevisionV1(tier);
    if (
      implementationRevision === undefined ||
      /* v8 ignore next -- generated catalog rows are validated canonical digests */
      !isExecutionDigestV1(implementationRevision)
    )
      return undefined;
    digests.push(implementationRevision as Sha256Digest);
  }
  digests.sort();
  /* v8 ignore next -- generated capability revisions are unique by construction */
  if (new Set(digests).size !== digests.length) return undefined;
  return Object.freeze({
    oracleContractDigest: oracleContractDigest as Sha256Digest,
    toolContractDigests: Object.freeze(digests),
  });
}
