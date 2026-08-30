import { isDeepStrictEqual } from "node:util";

import { chargeFailureCampaignBudgetV1 } from "./failure-campaign-budget.js";
import {
  getAuthorizedFailureEnvelopeStateV1,
  type AuthorizedFailureEnvelopeV1,
} from "./failure-envelope.js";
import {
  applyFailureTransformationDraftV1,
  createFailureTransformationDescriptorSourceV1,
} from "./failure-transformation-drafts.js";
import { compareExecutionText } from "./execution-validation.js";
import {
  getValidatedReductionCandidateStateV1,
  validateReductionCandidateInvariantV1,
} from "./reduction-candidate.js";

import type { FailureCampaignBudgetAuthorityV1 } from "./failure-campaign-budget.js";
import type {
  FailureNormalizationResultV1,
  FailureTransformationProposalLookupV1,
  FailureTransformationProposalV1,
  FailureTransformationV1,
} from "./failure-transformation-model.js";
import type { ExecutionIssueV1, ExecutionOperationResultV1 } from "./execution-contracts.js";
import type { ReductionSizeV1, ValidatedReductionCandidateV1 } from "./reduction-candidate.js";

export type {
  FailureNormalizationResultV1,
  FailureTransformationProposalLookupV1,
  FailureTransformationProposalV1,
  FailureTransformationTraceEntryV1,
  FailureTransformationV1,
} from "./failure-transformation-model.js";

interface FailureTransformationCatalogState {
  readonly envelope: AuthorizedFailureEnvelopeV1;
  readonly family: "typed-valid" | "typed-invalid" | "raw-malformed";
  readonly sourceByteLength: number;
  readonly descriptors: ReturnType<typeof createFailureTransformationDescriptorSourceV1>;
  readonly proposals: FailureTransformationV1[];
  lastProposal: FailureTransformationProposalV1 | undefined;
  nextDescriptor: number;
  complete: boolean;
}

const CATALOGS = new WeakMap<object, FailureTransformationCatalogState>();
const FAILURE_CATALOG_INSPECTION_MAX_DESCRIPTORS_V1 = 4_096;
const FAILURE_CATALOG_INSPECTION_MAX_SOURCE_WORK_V1 = 16_777_216;

function failure<T>(path: string, message: string): ExecutionOperationResultV1<T> {
  const issues: readonly [ExecutionIssueV1] = [
    Object.freeze({ code: "invalid-evidence-input", path, message }),
  ];
  return Object.freeze({ ok: false, issues });
}

function capacityFailure<T>(message: string): ExecutionOperationResultV1<T> {
  const issues: readonly [ExecutionIssueV1] = [
    Object.freeze({ code: "execution-plan-capacity", path: "/catalog", message }),
  ];
  return Object.freeze({ ok: false, issues });
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

/** Bounds compatibility inspection APIs by both descriptor count and source-byte work. */
function inspectionDescriptorLimit(catalog: FailureTransformationCatalogState): number {
  const byteBound = Math.floor(
    FAILURE_CATALOG_INSPECTION_MAX_SOURCE_WORK_V1 / Math.max(1, catalog.sourceByteLength),
  );
  return Math.max(1, Math.min(FAILURE_CATALOG_INSPECTION_MAX_DESCRIPTORS_V1, byteBound));
}

/** Compares family-specific termination tuples lexicographically. */
function compareSizes(left: ReductionSizeV1, right: ReductionSizeV1): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const leftValue = left[index];
    const rightValue = right[index];
    if (leftValue === rightValue) continue;
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return leftValue - rightValue;
    }
    return String(leftValue) < String(rightValue) ? -1 : 1;
  }
  return left.length - right.length;
}

/** Creates or returns the one lazy catalog retained by a genuine candidate capability. */
function getCatalogState(
  candidate: ValidatedReductionCandidateV1,
): FailureTransformationCatalogState | undefined {
  if (typeof candidate !== "object" || candidate === null) return undefined;
  const retained = CATALOGS.get(candidate);
  if (retained !== undefined) return retained;
  const candidateState = getValidatedReductionCandidateStateV1(candidate);
  if (candidateState === undefined) return undefined;
  const envelopeState = getAuthorizedFailureEnvelopeStateV1(candidateState.envelope);
  if (envelopeState === undefined) return undefined;
  const catalog: FailureTransformationCatalogState = {
    envelope: candidateState.envelope,
    family: candidateState.projection.family,
    sourceByteLength: candidateState.projection.draft.sourceBytes.byteLength,
    descriptors: createFailureTransformationDescriptorSourceV1(
      candidateState.projection.draft,
      envelopeState.projection.policy.budget.transformationAttempts,
    ),
    proposals: [],
    lastProposal: undefined,
    nextDescriptor: 0,
    complete: false,
  };
  CATALOGS.set(candidate, catalog);
  return catalog;
}

/** Validates one descriptor once and returns only an applicable strictly smaller proposal. */
function prepareProposal(
  candidate: ValidatedReductionCandidateV1,
  catalog: FailureTransformationCatalogState,
  transformation: FailureTransformationV1,
  catalogOrdinal: number,
): FailureTransformationProposalV1 | undefined {
  const candidateState = getValidatedReductionCandidateStateV1(candidate);
  if (candidateState === undefined || candidateState.envelope !== catalog.envelope)
    return undefined;
  const nextDraft = applyFailureTransformationDraftV1(
    candidateState.projection.draft,
    transformation,
  );
  if (nextDraft === undefined) return undefined;
  const validated = validateReductionCandidateInvariantV1(catalog.envelope, nextDraft);
  if (!validated.ok) return undefined;
  const after = getValidatedReductionCandidateStateV1(validated.value);
  if (
    after === undefined ||
    compareSizes(after.projection.size, candidateState.projection.size) >= 0 ||
    after.projection.contentDigest === candidateState.projection.contentDigest
  ) {
    return undefined;
  }
  return Object.freeze({
    revision: "failure-transformation-proposal-v1",
    catalogOrdinal,
    transformation,
    candidate: validated.value,
  });
}

/** Advances descriptor validation only far enough to answer one requested ordinal. */
function ensureProposal(
  candidate: ValidatedReductionCandidateV1,
  catalog: FailureTransformationCatalogState,
  ordinal: number,
  budget: FailureCampaignBudgetAuthorityV1,
): FailureTransformationProposalV1 | "capacity" | undefined {
  if (catalog.lastProposal?.catalogOrdinal === ordinal) return catalog.lastProposal;
  while (!catalog.complete && catalog.proposals.length <= ordinal) {
    const transformation = catalog.descriptors.at(catalog.nextDescriptor);
    if (transformation === undefined) {
      catalog.complete = true;
      break;
    }
    const charged = chargeFailureCampaignBudgetV1(budget, { kind: "transformation-attempt" });
    if (!charged.ok) return "capacity";
    catalog.nextDescriptor += 1;
    const proposal = prepareProposal(candidate, catalog, transformation, catalog.proposals.length);
    if (proposal !== undefined) {
      catalog.proposals.push(transformation);
      if (proposal.catalogOrdinal === ordinal) {
        catalog.lastProposal = proposal;
        return proposal;
      }
    }
  }
  const transformation = catalog.proposals[ordinal];
  const proposal =
    transformation === undefined
      ? undefined
      : prepareProposal(candidate, catalog, transformation, ordinal);
  catalog.lastProposal = proposal;
  return proposal;
}

/**
 * Returns one authenticated applicable proposal without preparing the rest of the catalog.
 *
 * The catalog charges each potentially expensive descriptor preparation before applying it. A
 * closed completion result distinguishes a proved fixed point from malformed authority, capacity,
 * or ordinal input.
 *
 * @param original Exact envelope that owns the candidate.
 * @param candidate Genuine current candidate.
 * @param ordinal Zero-based applicable-proposal ordinal.
 * @returns One cached prevalidated proposal or a closed catalog-complete outcome.
 */
export function getFailureTransformationProposalV1(
  original: AuthorizedFailureEnvelopeV1,
  candidate: ValidatedReductionCandidateV1,
  ordinal: number,
  budget: FailureCampaignBudgetAuthorityV1,
): ExecutionOperationResultV1<FailureTransformationProposalLookupV1> {
  if (!Number.isSafeInteger(ordinal) || ordinal < 0) {
    return failure("/catalogOrdinal", "Catalog ordinal must be a non-negative safe integer.");
  }
  const catalog = getCatalogState(candidate);
  if (catalog === undefined || catalog.envelope !== original) {
    return failure("/candidate", "Candidate does not belong to the original envelope.");
  }
  const proposal = ensureProposal(candidate, catalog, ordinal, budget);
  if (proposal === "capacity") {
    return capacityFailure("Transformation descriptor preparation exhausted the campaign budget.");
  }
  return proposal === undefined
    ? success(
        Object.freeze({
          revision: "failure-transformation-proposal-lookup-v1",
          outcome: "catalog-complete",
        }),
      )
    : success(
        Object.freeze({
          revision: "failure-transformation-proposal-lookup-v1",
          outcome: "proposal",
          proposal,
        }),
      );
}

/** Enumerates the bounded structural catalog in canonical deterministic order. */
export function enumerateFailureTransformationsV1(
  candidate: ValidatedReductionCandidateV1,
): readonly FailureTransformationV1[] {
  const catalog = getCatalogState(candidate);
  if (catalog === undefined) return Object.freeze([]);
  const limit = inspectionDescriptorLimit(catalog);
  const transformations: FailureTransformationV1[] = [];
  for (let descriptorOrdinal = 0; descriptorOrdinal < limit; descriptorOrdinal += 1) {
    const transformation = catalog.descriptors.at(descriptorOrdinal);
    if (transformation === undefined) return Object.freeze(transformations);
    if (catalog.family === "typed-invalid") {
      transformations.push(structuredClone(transformation));
      continue;
    }
    const proposal = prepareProposal(candidate, catalog, transformation, transformations.length);
    if (proposal !== undefined) transformations.push(proposal.transformation);
  }
  return catalog.descriptors.at(limit) === undefined
    ? Object.freeze(transformations)
    : Object.freeze([]);
}

/** Applies one closed edit using its cached, fully revalidated proposal capability. */
export function applyFailureTransformationV1(
  original: AuthorizedFailureEnvelopeV1,
  candidate: ValidatedReductionCandidateV1,
  input: unknown,
): ExecutionOperationResultV1<ValidatedReductionCandidateV1> {
  const catalog = getCatalogState(candidate);
  if (catalog === undefined || catalog.envelope !== original) {
    return failure("/transformation", "Candidate does not belong to the original envelope.");
  }
  const limit = inspectionDescriptorLimit(catalog);
  for (let descriptorOrdinal = 0; descriptorOrdinal < limit; descriptorOrdinal += 1) {
    const transformation = catalog.descriptors.at(descriptorOrdinal);
    if (transformation === undefined) break;
    if (!isDeepStrictEqual(transformation, input)) continue;
    const proposal = prepareProposal(candidate, catalog, transformation, 0);
    return proposal === undefined
      ? failure(
          "/transformation",
          "Transformation is inapplicable or does not strictly reduce this candidate.",
        )
      : success(proposal.candidate);
  }
  if (catalog.descriptors.at(limit) !== undefined) {
    return capacityFailure("Transformation inspection exceeds its bounded byte-work allowance.");
  }
  return failure(
    "/transformation",
    "Transformation is unknown, malformed, inapplicable, or not canonical for this candidate.",
  );
}

/** Canonicalizes metadata separately from semantic catalog edits and proves idempotence. */
export function normalizeFailureReductionCandidateV1(
  original: AuthorizedFailureEnvelopeV1,
  candidate: ValidatedReductionCandidateV1,
): ExecutionOperationResultV1<FailureNormalizationResultV1> {
  const candidateState = getValidatedReductionCandidateStateV1(candidate);
  if (candidateState === undefined || candidateState.envelope !== original) {
    return failure("/candidate", "Candidate does not belong to the original envelope.");
  }
  const before = candidateState.projection;
  const current = before.draft;
  const draft =
    current.kind === "raw-malformed"
      ? current
      : {
          ...current,
          claimedRuleIds: Object.freeze([...current.claimedRuleIds].sort(compareExecutionText)),
          claimWitnesses: Object.freeze(
            [...current.claimWitnesses].sort((left, right) =>
              compareExecutionText(left.ruleId, right.ruleId),
            ),
          ),
        };
  const validated = validateReductionCandidateInvariantV1(original, draft);
  if (!validated.ok) {
    return failure("/candidate", "Normalized candidate no longer satisfies its family invariant.");
  }
  const after = getValidatedReductionCandidateStateV1(validated.value);
  if (after === undefined) {
    return failure("/candidate", "Normalized candidate could not be projected.");
  }
  const changed = before.contentDigest !== after.projection.contentDigest;
  const sourceChanged = !isDeepStrictEqual(
    before.draft.sourceBytes,
    after.projection.draft.sourceBytes,
  );
  return success(
    Object.freeze({
      revision: "failure-normalization-result-v1",
      candidate: validated.value,
      changed,
      beforeDigest: before.contentDigest,
      afterDigest: after.projection.contentDigest,
      requiresEvaluation: changed && sourceChanged,
    }),
  );
}
