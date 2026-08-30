/**
 * Internal failure-reduction protocol operations used by the execution
 * orchestrator. Applications should consume the stable root envelope API.
 */
export {
  createInitialReductionCandidateV1,
  createReductionCandidateAuthorityV1,
  createReductionCandidateInvocationV1,
  consumeReductionCandidateInvocationV1,
  getReductionCandidateProjectionV1,
  getValidatedReductionCandidateProjectionV1,
  validateReductionCandidateInvariantV1,
} from "./reduction-candidate.js";
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
export type {
  ConsumedReductionInvocationV1,
  ReductionCandidateAuthorityV1,
  ReductionCandidateDraftV1,
  ReductionCandidateEvaluationV1,
  ReductionCandidateInvocationV1,
  ReductionCandidateProjectionV1,
  ReductionEvaluationTokenV1,
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
