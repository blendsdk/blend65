import { isDeepStrictEqual } from "node:util";

import type { PreparedCampaign } from "./campaign-model.js";
import { getPreparedCampaignState, type PreparedCampaignState } from "./campaign-state.js";
import { generateCampaignCase } from "./generate-case.js";
import { deriveOracleSourceContentIdentity } from "./oracle-content-identity.js";
import type {
  DiagnosticObservationV1,
  OracleBudgetV1,
  PublishedOracleContext,
} from "./oracle-model.js";
import { ORACLE_V1_LIMITS } from "./oracle-model.js";
import { oracleFailure } from "./oracle-input.js";
import type { OracleValidationResultV1 } from "./oracle-evaluation-identity.js";
import type { Sha256Digest } from "./model-registry-model.js";
import {
  createPublishedDiagnosticOracleRequest,
  evaluatePublishedOracle,
} from "./published-oracle-context.js";

/** Runtime brand for an authenticated published invalid-source diagnostic case. */
export const PUBLISHED_DIAGNOSTIC_CASE_V1: unique symbol = Symbol("published-diagnostic-case-v1");

/** Opaque authority joining a genuine campaign case to selected published diagnostic truth. */
export interface PublishedDiagnosticCaseV1 {
  /** Compile-time brand paired with module-private runtime state. */
  readonly [PUBLISHED_DIAGNOSTIC_CASE_V1]: true;
}

/** Passive defensive projection used by parent-side execution classification. */
export interface PublishedDiagnosticCaseProjectionV1 {
  /** Closed projection schema. */
  readonly schemaVersion: 1;
  /** Invalid source transformations are the only compiler-diagnostic case kind. */
  readonly kind: "invalid-source-transform";
  /** Exact generated source-case identity. */
  readonly sourceCaseDigest: Sha256Digest;
  /** Fresh copy of the exact invalid source bytes. */
  readonly sourceBytes: Uint8Array;
  /** Exact selected published diagnostic observation. */
  readonly expectedDiagnostic: DiagnosticObservationV1;
  /** Joined publication and evaluation identities. */
  readonly authority: Readonly<{
    readonly joinPolicyRevision: "published-diagnostic-case-equivalence-v1";
    readonly selectedReleaseDigest: Sha256Digest;
    readonly selectedCampaignDigest: Sha256Digest;
    readonly selectedSourceCaseDigest: Sha256Digest;
    readonly evaluationIdentity: Sha256Digest;
    readonly sourceContentIdentity: Sha256Digest;
  }>;
}

interface PublishedDiagnosticCaseState {
  readonly projection: PublishedDiagnosticCaseProjectionV1;
}

const DIAGNOSTIC_CASES = new WeakMap<object, PublishedDiagnosticCaseState>();
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const DIAGNOSTIC_BUDGET: OracleBudgetV1 = Object.freeze({
  inputNodes: BigInt(ORACLE_V1_LIMITS.inputNodes),
  expressionDepth: BigInt(ORACLE_V1_LIMITS.inputDepth),
  evaluationSteps: ORACLE_V1_LIMITS.executionEvents,
  frames: ORACLE_V1_LIMITS.executionEvents,
  memoryCells: ORACLE_V1_LIMITS.memoryCells,
  effects: ORACLE_V1_LIMITS.executionEvents,
  transformedNodes: BigInt(ORACLE_V1_LIMITS.inputNodes),
});

function contractFailure<T>(path: string, message: string): OracleValidationResultV1<T> {
  return oracleFailure("oracle.contract.invalid", path, message);
}

function samePublishedEnvironment(
  caller: PreparedCampaignState["campaign"],
  selected: PreparedCampaignState["campaign"],
): boolean {
  return (
    caller.inventorySchemaVersion === selected.inventorySchemaVersion &&
    caller.inventoryVersion === selected.inventoryVersion &&
    caller.inventoryDigest === selected.inventoryDigest &&
    caller.specRevision === selected.specRevision &&
    caller.ruleModelVersion === selected.ruleModelVersion &&
    caller.ruleModelDigest === selected.ruleModelDigest &&
    caller.target === selected.target &&
    caller.prngAlgorithm === selected.prngAlgorithm &&
    caller.generator.handlerId === selected.generator.handlerId &&
    caller.generator.contractVersion === selected.generator.contractVersion &&
    caller.boundaryTransform.handlerId === selected.boundaryTransform.handlerId &&
    caller.boundaryTransform.contractVersion === selected.boundaryTransform.contractVersion
  );
}

function sameCallerReplayInput(
  callerCampaign: PreparedCampaignState["campaign"],
  callerConfiguration: PreparedCampaignState["configuration"],
  selectedCampaign: PreparedCampaignState["campaign"],
  selectedConfiguration: PreparedCampaignState["configuration"],
): boolean {
  return (
    selectedCampaign.seed === callerCampaign.seed &&
    selectedCampaign.configurationDigest === callerCampaign.configurationDigest &&
    isDeepStrictEqual(selectedConfiguration, callerConfiguration)
  );
}

/**
 * Authenticates one genuine invalid-source campaign case against a selected oracle publication.
 *
 * @param context Opaque selected published-oracle authority.
 * @param campaign Genuine prepared campaign containing the invalid case.
 * @param ordinal Zero-based invalid-source case ordinal.
 * @returns Opaque joined authority or a bounded validation failure.
 *
 * @example
 * ```ts
 * const diagnosticCase = createPublishedDiagnosticCaseV1(context, campaign, 12);
 * ```
 */
export function createPublishedDiagnosticCaseV1(
  context: PublishedOracleContext,
  campaign: PreparedCampaign,
  ordinal: number,
): OracleValidationResultV1<PublishedDiagnosticCaseV1> {
  const campaignState = getPreparedCampaignState(campaign);
  if (campaignState === undefined || !Number.isSafeInteger(ordinal) || ordinal < 0) {
    return contractFailure("/campaign", "Published diagnostic campaign input is invalid.");
  }
  const generated = generateCampaignCase(campaign, ordinal);
  if (!generated.ok) {
    return contractFailure("/ordinal", "Published diagnostic case could not be regenerated.");
  }
  const modeled = generated.value.modeledCase;
  if (
    modeled.validity.kind !== "invalid" ||
    modeled.projection.kind !== "invalid" ||
    modeled.projection.transform.kind === "parameter-binding-replace"
  ) {
    return contractFailure(
      "/ordinal",
      "Published diagnostic authority requires an invalid source transformation.",
    );
  }
  const request = createPublishedDiagnosticOracleRequest(context, {
    schemaVersion: 1,
    ruleId: modeled.primaryRuleId,
    seed: campaignState.campaign.seed,
    configuration: campaignState.configuration,
    ordinal,
    memory: { schemaVersion: 1, cells: [] },
    budget: DIAGNOSTIC_BUDGET,
    observable: { kind: "diagnostic" },
  });
  if (!request.ok) return request;
  const selectedProvenance = request.value.sourceProvenance;
  if (!samePublishedEnvironment(campaignState.campaign, selectedProvenance.campaign)) {
    return contractFailure(
      "/campaign",
      "Published diagnostic campaign does not match the selected replay environment.",
    );
  }
  if (
    !sameCallerReplayInput(
      campaignState.campaign,
      campaignState.configuration,
      selectedProvenance.campaign,
      selectedProvenance.configuration,
    )
  ) {
    return contractFailure(
      "/campaign",
      "Published diagnostic replay did not preserve the authenticated campaign input.",
    );
  }
  if (!isDeepStrictEqual(request.value.case, modeled)) {
    return contractFailure(
      "/campaign",
      "Published oracle request did not reproduce the supplied modeled case.",
    );
  }
  const evaluated = evaluatePublishedOracle(context, request.value);
  if (
    !evaluated.ok ||
    !evaluated.result.ok ||
    evaluated.result.outcome !== "modeled" ||
    evaluated.result.observation.kind !== "diagnostic"
  ) {
    return contractFailure(
      "/ordinal",
      "Published oracle did not produce diagnostic authority for the supplied case.",
    );
  }
  const expected = evaluated.result.observation;
  if (
    expected.ruleId !== modeled.primaryRuleId ||
    expected.neighborId !== modeled.validity.neighborId
  ) {
    return contractFailure("/ordinal", "Published diagnostic authority does not match the case.");
  }
  const contentIdentity = deriveOracleSourceContentIdentity(generated.value.sourceBytes);
  if (!contentIdentity.ok || contentIdentity.identity !== evaluated.contentIdentities.source) {
    return contractFailure(
      "/sourceBytes",
      "Published diagnostic source identity does not match regenerated bytes.",
    );
  }
  const projection: PublishedDiagnosticCaseProjectionV1 = Object.freeze({
    schemaVersion: 1,
    kind: "invalid-source-transform",
    sourceCaseDigest: generated.value.identity.digest,
    sourceBytes: generated.value.sourceBytes.slice(),
    expectedDiagnostic: expected,
    authority: Object.freeze({
      joinPolicyRevision: "published-diagnostic-case-equivalence-v1",
      selectedReleaseDigest: context.selectedReleaseDigest,
      selectedCampaignDigest: selectedProvenance.campaignDigest,
      selectedSourceCaseDigest: selectedProvenance.caseIdentity.digest,
      evaluationIdentity: evaluated.evaluationIdentity,
      sourceContentIdentity: contentIdentity.identity,
    }),
  });
  const capability: PublishedDiagnosticCaseV1 = Object.freeze({
    [PUBLISHED_DIAGNOSTIC_CASE_V1]: true as const,
  });
  DIAGNOSTIC_CASES.set(capability, Object.freeze({ projection }));
  return Object.freeze({ ok: true, value: capability, diagnostics: EMPTY_DIAGNOSTICS });
}

/**
 * Returns a defensive passive projection for an authenticated diagnostic case.
 *
 * @param value Opaque diagnostic-case authority.
 * @returns Fresh source bytes and immutable joined diagnostic facts.
 *
 * @example
 * ```ts
 * const projection = getPublishedDiagnosticCaseProjectionV1(diagnosticCase);
 * ```
 */
export function getPublishedDiagnosticCaseProjectionV1(
  value: PublishedDiagnosticCaseV1,
): OracleValidationResultV1<PublishedDiagnosticCaseProjectionV1> {
  const state =
    typeof value === "object" && value !== null ? DIAGNOSTIC_CASES.get(value) : undefined;
  if (state === undefined) {
    return oracleFailure(
      "oracle.authority.missing",
      "/diagnosticCase",
      "Published diagnostic case authority is not authentic.",
    );
  }
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      ...state.projection,
      sourceBytes: state.projection.sourceBytes.slice(),
    }),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}
