import { createHash } from "node:crypto";

import type { PublishedSnapshot } from "./binding-model.js";
import {
  type CompositeReadinessProjectionV1,
  type ExecutionCapabilityProjectionV1,
  type ExecutionOperationResultV1,
  type ExecutionRuleProjectionV1,
  type ExecutionTierV1,
  isExecutionTierV1,
} from "./execution-contracts.js";
import { getPublishedExecutionReleaseStateV1 } from "./execution-publication-authority-state.js";
import {
  digestExecutionPublicationBytes,
  executionPublicationFailure,
  executionPublicationSuccess,
  parseExecutionBindingsV1,
  sortExecutionPublicationText,
  type ExecutionPublicationBindingV1,
} from "./execution-publication-model.js";
import type {
  CompositeReadinessAuthorityV2,
  CompositeReadinessSnapshot,
  ExecutionReviewCandidateProjectionDescriptorV1,
  ExecutionReviewCandidateProjectionV1,
  PublishedExecutionRelease,
} from "./execution-publication-resolver.js";
import { isExecutionDigest } from "./execution-validation.js";
import { MODELED_RULE_FACTS } from "./modeled-generator-facts.js";
import {
  getPublishedSnapshotAuthority,
  type PublishedSnapshotAuthority,
} from "./publication-resolver.js";

interface CompositeReadinessSnapshotStateV1 {
  readonly projection: CompositeReadinessProjectionV1;
  readonly parentAuthority: PublishedSnapshotAuthority;
  readonly executionDigest: string;
}

const COMPOSITES = new WeakMap<object, CompositeReadinessSnapshotStateV1>();
const REVIEW_CANDIDATE_PROJECTIONS = new WeakMap<
  object,
  ExecutionReviewCandidateProjectionDescriptorV1
>();

/** Produces the stable failure used when a child cannot join its exact parent. */
export function executionParentFailureV1<T>(path: string): ExecutionOperationResultV1<T> {
  return executionPublicationFailure(
    "execution.stale-authority",
    path,
    "Execution publication does not name one available compatible parent release.",
  );
}

/** Validates that child bindings exactly cover compatible unbound parent declarations. */
export function validateExecutionParentBindingsV1(
  parent: PublishedSnapshotAuthority,
  bindings: readonly ExecutionPublicationBindingV1[],
): ExecutionOperationResultV1<true> {
  const declarations = parent.inventory.evidenceCapabilityDeclarations;
  if (declarations.length !== bindings.length) return executionParentFailureV1("/bindings");
  for (let index = 0; index < bindings.length; index += 1) {
    const binding = bindings[index];
    const matches = declarations.filter((entry) => entry.id === binding?.capabilityId);
    const declaration = matches[0];
    if (matches.length !== 1 || declaration === undefined) {
      return executionParentFailureV1(`/bindings/${index}/capabilityId`);
    }
    if (
      declaration.contractVersion !== binding?.contractVersion ||
      declaration.binding !== "unbound"
    ) {
      return executionParentFailureV1(`/bindings/${index}/contractVersion`);
    }
  }
  return executionPublicationSuccess(true);
}

function boundaryFamilyId(
  fact: typeof MODELED_RULE_FACTS extends ReadonlyMap<string, infer T> ? T : never,
): string {
  return fact.kind === "scalar"
    ? `boundary.scalar.${fact.scalarType}`
    : `boundary.memory.${fact.intrinsic}`;
}

function projectModeledRules(
  parent: PublishedSnapshotAuthority,
): ExecutionOperationResultV1<readonly ExecutionRuleProjectionV1[]> {
  const projections: ExecutionRuleProjectionV1[] = [];
  const facts = [...MODELED_RULE_FACTS.values()].sort((left, right) =>
    left.ruleId < right.ruleId ? -1 : left.ruleId > right.ruleId ? 1 : 0,
  );
  for (const fact of facts) {
    const matches = parent.inventory.rules.filter((rule) => rule.ruleId === fact.ruleId);
    const rule = matches[0];
    if (matches.length !== 1 || rule === undefined) {
      return executionParentFailureV1(`/rules/${fact.ruleId}`);
    }
    const sortedObligations = sortExecutionPublicationText(rule.evidenceObligations);
    if (
      sortedObligations.length === 0 ||
      new Set(sortedObligations).size !== sortedObligations.length ||
      sortedObligations.some((obligation) => !isExecutionTierV1(obligation))
    ) {
      return executionParentFailureV1(`/rules/${fact.ruleId}/evidenceObligations`);
    }
    const obligations: ExecutionTierV1[] = [];
    for (const obligation of sortedObligations) {
      if (isExecutionTierV1(obligation)) obligations.push(obligation);
    }
    projections.push(
      Object.freeze({
        ruleId: fact.ruleId,
        applicability: rule.applicability,
        evidenceObligations: obligations,
        boundaryFamilyIds: Object.freeze([boundaryFamilyId(fact)]),
      }),
    );
  }
  return executionPublicationSuccess(Object.freeze(projections));
}

/** Builds the common closed planner projection after parent and binding authentication. */
function createExecutionProjection(
  parent: PublishedSnapshotAuthority,
  bindings: readonly ExecutionPublicationBindingV1[],
  executionDigest: string,
): ExecutionOperationResultV1<CompositeReadinessProjectionV1> {
  const joined = validateExecutionParentBindingsV1(parent, bindings);
  if (!joined.ok) return joined;
  const rules = projectModeledRules(parent);
  if (!rules.ok) return rules;
  const capabilities: ExecutionCapabilityProjectionV1[] = [];
  for (const declaration of parent.inventory.evidenceCapabilityDeclarations) {
    const binding = bindings.find((row) => row.capabilityId === declaration.id);
    if (binding === undefined || declaration.binding !== "unbound") {
      return executionParentFailureV1(`/capabilities/${declaration.id}`);
    }
    capabilities.push(Object.freeze({ capabilityId: binding.capabilityId, state: "bound" }));
  }
  return executionPublicationSuccess(
    Object.freeze({
      parentDigest: parent.publicationDigest,
      executionDigest,
      capabilities: Object.freeze(capabilities),
      rules: rules.value,
    }),
  );
}

/** Resolves an exact parent-child pair into opaque composite authority. */
export function resolveCompositeReadinessSnapshot(
  parent: PublishedSnapshot,
  execution: PublishedExecutionRelease,
): ExecutionOperationResultV1<CompositeReadinessSnapshot> {
  const parentState = getPublishedSnapshotAuthority(parent);
  const childState = getPublishedExecutionReleaseStateV1(execution);
  if (parentState === undefined || childState === undefined) {
    return executionPublicationFailure(
      "execution.identity",
      "",
      "A genuine parent snapshot and execution release are required.",
    );
  }
  if (
    parentState.repositoryRoot !== childState.repositoryRoot ||
    parentState.publicationDigest !== childState.parentDigest
  ) {
    return executionParentFailureV1("/parentDigest");
  }
  const projected = createExecutionProjection(parentState, childState.bindings, childState.digest);
  if (!projected.ok) return projected;
  const composite = Object.freeze({}) as CompositeReadinessSnapshot;
  COMPOSITES.set(
    composite,
    Object.freeze({
      projection: projected.value,
      parentAuthority: parentState,
      executionDigest: childState.digest,
    }),
  );
  return executionPublicationSuccess(composite);
}

/**
 * Authenticates exact candidate binding bytes against a genuine parent for review execution only.
 *
 * The returned capability cannot be passed to composite resolution or publication selection.
 */
export function createExecutionReviewCandidateProjectionV1(
  parent: PublishedSnapshot,
  bindingBytes: Uint8Array,
  runnerRevision: string,
): ExecutionOperationResultV1<ExecutionReviewCandidateProjectionV1> {
  const parentState = getPublishedSnapshotAuthority(parent);
  if (
    parentState === undefined ||
    !(bindingBytes instanceof Uint8Array) ||
    !isExecutionDigest(runnerRevision)
  ) {
    return executionPublicationFailure(
      "execution.identity",
      "",
      "A genuine parent and canonical execution review candidate are required.",
    );
  }
  const retainedBytes = new Uint8Array(bindingBytes);
  const parsed = parseExecutionBindingsV1(retainedBytes);
  if (!parsed.ok) return parsed;
  const bindingDigest = digestExecutionPublicationBytes(retainedBytes);
  const candidateDigest = `sha256:${createHash("sha256")
    .update("blend65-execution-review-candidate-v1\0")
    .update(parentState.publicationDigest)
    .update("\0")
    .update(bindingDigest)
    .update("\0")
    .update(runnerRevision)
    .digest("hex")}`;
  const projection = createExecutionProjection(parentState, parsed.value.bindings, candidateDigest);
  if (!projection.ok) return projection;
  const candidate = Object.freeze({}) as ExecutionReviewCandidateProjectionV1;
  REVIEW_CANDIDATE_PROJECTIONS.set(
    candidate,
    Object.freeze({
      repositoryRoot: parentState.repositoryRoot,
      parentDigest: parentState.publicationDigest,
      bindingDigest,
      runnerRevision,
      projection: projection.value,
    }),
  );
  return executionPublicationSuccess(candidate);
}

/** Returns defensive candidate facts only for a genuine review-only projection. */
export function getExecutionReviewCandidateProjectionDescriptorV1(
  candidate: ExecutionReviewCandidateProjectionV1,
): ExecutionReviewCandidateProjectionDescriptorV1 | undefined {
  return typeof candidate === "object" && candidate !== null
    ? REVIEW_CANDIDATE_PROJECTIONS.get(candidate)
    : undefined;
}

/** Returns the immutable closed planner projection only for a genuine composite capability. */
export function getCompositeReadinessProjectionV1(
  composite: CompositeReadinessSnapshot,
): ExecutionOperationResultV1<CompositeReadinessProjectionV1> {
  const state =
    typeof composite === "object" && composite !== null ? COMPOSITES.get(composite) : undefined;
  return state === undefined
    ? executionPublicationFailure(
        "execution.identity",
        "",
        "A genuine composite readiness snapshot is required.",
      )
    : executionPublicationSuccess(state.projection);
}

/** Returns authenticated pair facts only for a genuine composite capability. */
export function getCompositeReadinessAuthorityV2(
  composite: CompositeReadinessSnapshot,
): CompositeReadinessAuthorityV2 | undefined {
  return typeof composite === "object" && composite !== null
    ? COMPOSITES.get(composite)
    : undefined;
}
