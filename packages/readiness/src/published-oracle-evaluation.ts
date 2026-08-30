import { deriveOracleSourceContentIdentity } from "./oracle-content-identity.js";
import { evaluateCompilerResultCandidate } from "./oracle-compiler-result-candidate.js";
import { evaluateEmittedProgramCandidate } from "./oracle-emitted-program-candidate.js";
import {
  deriveOracleEvaluationIdentity,
  deriveOracleInitialMemoryIdentity,
  type OracleEvaluationParticipantV1,
} from "./oracle-evaluation-identity.js";
import {
  hasExactOracleKeys,
  isOracleRecord,
  oracleFailure,
  snapshotOracleInput,
} from "./oracle-input.js";
import { evaluateFrontendResultCandidate } from "./oracle-frontend-result-candidate.js";
import type {
  OracleHandlerIdV1,
  OracleResultV1,
  OracleSuite,
  PublishedOracleEvaluationResultV1,
} from "./oracle-model.js";
import { prepareOracleRequest } from "./oracle-request.js";
import { evaluateRuntimeStateCandidate } from "./oracle-runtime-state-candidate.js";
import type { PublishedContextState } from "./published-oracle-state.js";
import { selectPublishedRequestAuthority } from "./published-oracle-campaign.js";
import { isRuleModelId } from "./rule-model-registry.js";

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const ORACLE_EVALUATORS: Readonly<
  Record<OracleHandlerIdV1, (suite: OracleSuite, request: unknown) => OracleResultV1>
> = Object.freeze({
  "oracle.compiler-result": evaluateCompilerResultCandidate,
  "oracle.emitted-program": evaluateEmittedProgramCandidate,
  "oracle.frontend-result": evaluateFrontendResultCandidate,
  "oracle.runtime-state": evaluateRuntimeStateCandidate,
});
const REQUEST_KEYS = [
  "schemaVersion",
  "handlerId",
  "ruleId",
  "sourceProvenance",
  "case",
  "entryFunction",
  "memory",
  "budget",
  "observable",
] as const;

/** Returns whether a hostile value names one of the four published raw oracle façades. */
export function isPublishedOracleHandlerId(value: unknown): value is OracleHandlerIdV1 {
  return (
    value === "oracle.frontend-result" ||
    value === "oracle.compiler-result" ||
    value === "oracle.emitted-program" ||
    value === "oracle.runtime-state"
  );
}

/**
 * Evaluates a raw request against already authenticated publication state.
 *
 * The state must come from the context module's private weak map. All request bytes remain hostile
 * and are snapshotted and validated before any selected handler is invoked.
 */
export function evaluatePublishedOracleWithAuthority(
  state: PublishedContextState,
  request: unknown,
): PublishedOracleEvaluationResultV1 {
  const snapshot = snapshotOracleInput(request);
  if (
    !snapshot.ok ||
    !isOracleRecord(snapshot.value) ||
    !hasExactOracleKeys(snapshot.value, REQUEST_KEYS) ||
    !isPublishedOracleHandlerId(snapshot.value.handlerId) ||
    !isRuleModelId(snapshot.value.ruleId) ||
    !isOracleRecord(snapshot.value.sourceProvenance)
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      "",
      "Published oracle request must use the exact raw request shape.",
    );
  }
  const provenance = snapshot.value.sourceProvenance;
  const selected = selectPublishedRequestAuthority(
    state,
    snapshot.value.ruleId,
    provenance.configuration,
  );
  if ("ok" in selected) return selected;
  const campaign = provenance.campaign;
  if (
    !isOracleRecord(campaign) ||
    !isOracleRecord(campaign.generator) ||
    !isOracleRecord(campaign.boundaryTransform) ||
    campaign.generator.handlerId !== selected.generator.binding.handlerId ||
    campaign.generator.implementationRevision !==
      selected.generator.binding.implementationRevision ||
    campaign.boundaryTransform.handlerId !== selected.boundary.binding.handlerId ||
    campaign.boundaryTransform.implementationRevision !==
      selected.boundary.binding.implementationRevision ||
    campaign.rendererRevision !== state.authority.renderer.implementationRevision
  ) {
    return oracleFailure(
      "oracle.authority.stale",
      "/sourceProvenance/campaign",
      "Request provenance does not match selected published participants.",
    );
  }
  const binding = state.candidates.get(snapshot.value.handlerId);
  if (binding === undefined) {
    return oracleFailure(
      "oracle.authority.missing",
      "/handlerId",
      "Selected oracle handler is unavailable.",
    );
  }
  const evaluate = ORACLE_EVALUATORS[snapshot.value.handlerId];
  if (binding.binding.implementation !== evaluate) {
    return oracleFailure(
      "oracle.authority.stale",
      "/handlerId",
      "Selected oracle implementation does not match its typed handler adapter.",
    );
  }
  const result = evaluate(selected.suite, snapshot.value);
  if (!result.ok) {
    return Object.freeze({
      ok: false,
      diagnostics: result.diagnostics,
    });
  }
  const prepared = prepareOracleRequest(selected.suite, snapshot.value.handlerId, snapshot.value);
  if ("ok" in prepared) {
    if (!prepared.ok) {
      return Object.freeze({
        ok: false,
        diagnostics: prepared.diagnostics,
      });
    }
    return oracleFailure(
      "oracle.contract.invalid",
      "",
      "Published request preparation returned an unexpected terminal result.",
    );
  }
  const sourceIdentity = deriveOracleSourceContentIdentity(prepared.generatedCase.sourceBytes);
  if (!sourceIdentity.ok) return sourceIdentity;
  const memoryIdentity = deriveOracleInitialMemoryIdentity(prepared.request.memory);
  if (!memoryIdentity.ok) return memoryIdentity;
  const participants: OracleEvaluationParticipantV1[] = [
    selected.generator.binding,
    selected.boundary.binding,
    binding.binding,
  ].map(({ handlerId, contractVersion, implementationRevision }) =>
    Object.freeze({ handlerId, contractVersion, implementationRevision }),
  );
  const evaluationIdentity = deriveOracleEvaluationIdentity({
    schemaVersion: 1,
    sourceProvenance: prepared.request.sourceProvenance,
    sourceContentIdentity: sourceIdentity.identity,
    entryFunction: prepared.request.entryFunction,
    initialMemoryIdentity: memoryIdentity.identity,
    diagnosticManifestDigest: selected.authorityDigests.diagnosticManifest,
    bindingRejectionDigest: selected.authorityDigests.bindingRejections,
    budget: prepared.request.budget,
    policyRevision: "oracle-policy-v1",
    observableProjectionId: `oracle.${prepared.request.observable.kind}`,
    participants,
  });
  if (!evaluationIdentity.ok) return evaluationIdentity;
  return Object.freeze({
    ok: true,
    result,
    evaluationIdentity: evaluationIdentity.identity,
    sourceProvenance: prepared.request.sourceProvenance,
    contentIdentities: Object.freeze({ source: sourceIdentity.identity }),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}
