/**
 * Internal failure-reduction protocol operations used by the execution
 * orchestrator. Applications should consume the stable root envelope API.
 */
import type { PublishedSnapshot } from "./binding-model.js";
import { getPublishedSnapshotAuthority } from "./publication-resolver.js";

export {
  createInitialReductionCandidateV1,
  abandonReductionCandidateInvocationV1,
  createReductionCandidateAuthorityV1,
  createReductionCandidateInvocationV1,
  consumeReductionCandidateInvocationV1,
  getFreshReductionCandidateInvocationStateV1,
  getReductionCandidateProjectionV1,
  reductionCandidateAuthorityMatchesEnvelopeV1,
  isFreshReductionCandidateInvocationV1,
  getValidatedReductionCandidateProjectionV1,
  validateReductionCandidateInvariantV1,
} from "./reduction-candidate.js";
export { createCandidateRuntimeEvaluationAuthorityV1 } from "./published-runtime-evaluation.js";
export {
  applyFailureTransformationV1,
  enumerateFailureTransformationsV1,
  getFailureTransformationProposalV1,
  normalizeFailureReductionCandidateV1,
} from "./failure-transform-catalog.js";
export {
  createFailureReductionSessionV1,
  getFailureReductionTerminalCandidateAuthorityV1,
  nextFailureReductionStepV1,
  recordFailureReductionEvaluationV1,
} from "./failure-reducer.js";
export {
  failureEnvelopeSourceMatchesParentV1,
  getFailureEnvelopeSourceAuthorityV1,
  getFailureEnvelopeSourceCandidateV1,
  getFailureEnvelopeSourceClaimsV1,
} from "./failure-envelope.js";
export { parseFailurePredicateIngredientsV1 } from "./failure-predicate-ingredients.js";
export {
  chargeFailureSequenceRouteBudgetV1,
  getFailureCampaignBudgetPolicyV1,
} from "./failure-campaign-budget.js";
export type {
  ConsumedReductionInvocationV1,
  ReductionCandidateAuthorityV1,
  ReductionCandidateContentProjectionV1,
  ReductionCandidateDraftV1,
  ReductionCandidateEvaluationV1,
  ReductionCandidateInvocationV1,
  ReductionCandidateProjectionV1,
  ReductionEvaluationTokenV1,
  ReductionExecutionPayloadV1,
  ReductionFamilyV1,
  ReductionSizeV1,
  ValidatedReductionCandidateProjectionV1,
  ValidatedReductionCandidateV1,
} from "./reduction-candidate.js";
export type {
  FailureNormalizationResultV1,
  FailureTransformationProposalLookupV1,
  FailureTransformationProposalV1,
  FailureTransformationTraceEntryV1,
  FailureTransformationV1,
} from "./failure-transform-catalog.js";
export type {
  FailureReductionResultV1,
  FailureReductionSessionV1,
  FailureReductionStepV1,
} from "./failure-reducer.js";
export type { FailureClaimWitnessV1 } from "./failure-envelope.js";
export type { FailureEnvelopeSourceAuthorityV1 } from "./failure-envelope-model.js";
export type { FailurePredicateIngredientsV1 } from "./failure-predicate-ingredients.js";

/** Minimal selected-parent identity used to join retained execution authority. */
export interface FailureReductionParentIdentityV1 {
  /** Canonical filesystem root containing the selected release. */
  readonly repositoryRoot: string;
  /** Exact digest of the selected published readiness release. */
  readonly publicationDigest: string;
}

/** Returns minimal identity only for a genuine selected publication snapshot. */
export function getFailureReductionParentIdentityV1(
  snapshot: PublishedSnapshot,
): FailureReductionParentIdentityV1 | undefined {
  const authority = getPublishedSnapshotAuthority(snapshot);
  return authority === undefined
    ? undefined
    : Object.freeze({
        repositoryRoot: authority.repositoryRoot,
        publicationDigest: authority.publicationDigest,
      });
}
