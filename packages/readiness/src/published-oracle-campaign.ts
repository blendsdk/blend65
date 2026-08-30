import type { FreshCandidateRegistration } from "./binding-model.js";
import type { CampaignDependenciesV1, GeneratedCase, PreparedCampaign } from "./campaign-model.js";
import { createCampaignPlan } from "./campaign.js";
import { deriveConfigurationIdentity, type CampaignIdentityInput } from "./case-identity.js";
import type { GenerationConfiguration } from "./canonical-identity.js";
import { normalizeGenerationConfiguration } from "./canonical-identity.js";
import { generateCampaignCase } from "./generate-case.js";
import {
  hasExactOracleKeys,
  isOracleRecord,
  oracleFailure,
  snapshotOracleInput,
} from "./oracle-input.js";
import type { OracleValidationResultV1 } from "./oracle-evaluation-identity.js";
import type { OracleSuite } from "./oracle-model.js";
import { createOracleSuite } from "./oracle-suite.js";
import type { PublishedContextState } from "./published-oracle-state.js";
import { digestPublicationBytes } from "./publication-model.js";
import { createRevisionRegistry, type RevisionEntry } from "./revision-registry.js";
import { getRuleGenerationDomain } from "./modeled-generator-suite.js";
import { isRuleModelId } from "./rule-model-registry.js";
import { isSha256Digest } from "./canonical-identity.js";
import type { Sha256Digest } from "./model-registry-model.js";

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const CAMPAIGN_SPEC_REVISION_V1 = "spec-v3.0";
const CAMPAIGN_CASE_INTENT_KEYS = [
  "schemaVersion",
  "ruleId",
  "seed",
  "configuration",
  "ordinal",
] as const;

/** Semantic-only intent for one case generated from selected publication authority. */
export interface PublishedCampaignCaseIntentV1 {
  /** Closed intent schema. */
  readonly schemaVersion: 1;
  /** Reviewed modeled rule that must own the selected ordinal. */
  readonly ruleId: string;
  /** Deterministic campaign seed. */
  readonly seed: Sha256Digest;
  /** Complete bounded generation configuration. */
  readonly configuration: GenerationConfiguration;
  /** Zero-based generated-case ordinal. */
  readonly ordinal: number;
}

/** Internal genuine campaign and case retained for a publication-bound join. */
export interface PublishedCampaignCaseAuthorityV1 {
  /** Opaque prepared campaign carrying selected callable authority. */
  readonly campaign: PreparedCampaign;
  /** Exact generated case at the selected ordinal. */
  readonly generatedCase: GeneratedCase;
  /** Passive campaign identity used in replay provenance. */
  readonly campaignIdentity: CampaignIdentityInput;
  /** Canonical selected configuration. */
  readonly configuration: GenerationConfiguration;
}

/** Selected replay authority assembled from one authenticated publication context. */
export interface PublishedRequestAuthority {
  /** Oracle suite bound to the publication's reviewed contracts. */
  readonly suite: OracleSuite;
  /** Canonical generation configuration. */
  readonly configuration: GenerationConfiguration;
  /** Stable digest of the canonical generation configuration. */
  readonly configurationDigest: Sha256Digest;
  /** Published modeled-case generator. */
  readonly generator: FreshCandidateRegistration;
  /** Published boundary transform. */
  readonly boundary: FreshCandidateRegistration;
  /** Digests of diagnostic contracts used during evaluation. */
  readonly authorityDigests: {
    readonly diagnosticManifest: Sha256Digest;
    readonly bindingRejections: Sha256Digest;
  };
}

/**
 * Reconstructs the callable request authority selected by a genuine context.
 *
 * Keeping this operation behind the context's private state prevents passive digest fields from
 * being promoted into executable publication authority.
 */
export function selectPublishedRequestAuthority(
  state: PublishedContextState,
  ruleId: string,
  configurationInput: unknown,
): PublishedRequestAuthority | ReturnType<typeof oracleFailure> {
  const normalized = normalizeGenerationConfiguration(configurationInput);
  if (!normalized.ok) {
    return oracleFailure(
      "oracle.input.invalid",
      `/configuration${normalized.problem.path}`,
      normalized.problem.message,
    );
  }
  const configuration = normalized.configuration;
  const configurationIdentity = deriveConfigurationIdentity(configuration);
  if (!configurationIdentity.ok) {
    return oracleFailure(
      "oracle.input.invalid",
      "/configuration",
      "Generation configuration identity could not be derived.",
    );
  }
  const domain = getRuleGenerationDomain(state.modeledSuite, ruleId);
  if (!domain.ok || domain.state !== "modeled") {
    return oracleFailure(
      "oracle.contract.invalid",
      "/ruleId",
      "Requested rule has no reviewed modeled source generator.",
    );
  }
  const generator = state.candidates.get(domain.handlerId);
  const boundary = state.candidates.get("transform.boundary-variants");
  if (generator === undefined || boundary === undefined) {
    return oracleFailure(
      "oracle.authority.missing",
      "/context",
      "Published generation participants are unavailable.",
    );
  }
  const inventoryBytes = state.authority.memberBytes.get("compiler-readiness-v1.json");
  if (inventoryBytes === undefined) {
    return oracleFailure(
      "oracle.authority.missing",
      "/context",
      "Inventory bytes are unavailable.",
    );
  }
  const inventoryDigest = digestPublicationBytes(inventoryBytes);
  const specRevision = CAMPAIGN_SPEC_REVISION_V1;
  const entries: RevisionEntry[] = [
    {
      component: "inventory",
      revision: inventoryDigest,
      value: Object.freeze({
        schemaVersion: 1,
        inventoryVersion: state.authority.inventory.inventoryVersion,
        inventoryDigest,
        specRevision,
      }),
    },
    {
      component: "rule-model",
      revision: state.ruleModelDigest,
      value: state.modeledSuite,
    },
    {
      component: "generator",
      revision: generator.binding.implementationRevision,
      value: generator,
    },
    {
      component: "boundary-transform",
      revision: boundary.binding.implementationRevision,
      value: boundary,
    },
    {
      component: "renderer",
      revision: state.authority.renderer.implementationRevision,
      value: state.authority.renderer,
    },
    {
      component: "configuration",
      revision: configurationIdentity.identity,
      value: configuration,
    },
  ];
  const registry = createRevisionRegistry(entries);
  if (!registry.ok) {
    return oracleFailure(
      "oracle.authority.not-accepted",
      "/context",
      registry.diagnostics[0]?.message ?? "Published replay registry could not be created.",
    );
  }
  const suite = createOracleSuite({
    modeledSuite: state.modeledSuite,
    replayRegistry: registry.registry,
    inventory: state.authority.inventory,
    diagnosticManifestBytes: state.authority.diagnosticManifestBytes,
    bindingRejectionBytes: state.authority.bindingRejectionBytes,
  });
  if (!suite.ok) return suite;
  return Object.freeze({
    suite: suite.suite,
    configuration,
    configurationDigest: configurationIdentity.identity,
    generator,
    boundary,
    authorityDigests: suite.authorityDigests,
  });
}

/**
 * Prepares one publication-bound campaign case from already authenticated context state.
 *
 * The caller must obtain `state` from the context module's private weak map. This helper never
 * accepts passive publication identifiers as a substitute for that authority.
 */
export function preparePublishedCampaignCaseWithAuthority(
  state: PublishedContextState,
  intent: unknown,
): OracleValidationResultV1<PublishedCampaignCaseAuthorityV1> {
  const snapshot = snapshotOracleInput(intent, "/intent");
  if (
    !snapshot.ok ||
    !isOracleRecord(snapshot.value) ||
    !hasExactOracleKeys(snapshot.value, CAMPAIGN_CASE_INTENT_KEYS)
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      "/intent",
      "Published campaign-case intent must use the exact semantic-only shape.",
    );
  }
  const value = snapshot.value;
  if (
    value.schemaVersion !== 1 ||
    !isRuleModelId(value.ruleId) ||
    !isSha256Digest(value.seed) ||
    typeof value.ordinal !== "number" ||
    !Number.isSafeInteger(value.ordinal) ||
    value.ordinal < 0
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      "/intent",
      "Published campaign-case intent contains invalid scalar fields.",
    );
  }
  const selected = selectPublishedRequestAuthority(state, value.ruleId, value.configuration);
  if ("ok" in selected) return selected;
  if (!selected.configuration.enabledRuleIds.includes(value.ruleId)) {
    return oracleFailure(
      "oracle.input.invalid",
      "/intent/ruleId",
      "Requested rule is not enabled by the generation configuration.",
    );
  }
  if (value.ordinal >= selected.configuration.caseCount) {
    return oracleFailure(
      "oracle.input.invalid",
      "/intent/ordinal",
      "Requested ordinal exceeds the configured campaign.",
    );
  }
  const inventoryBytes = state.authority.memberBytes.get("compiler-readiness-v1.json");
  if (inventoryBytes === undefined) {
    return oracleFailure(
      "oracle.authority.missing",
      "/context",
      "Inventory bytes are unavailable.",
    );
  }
  const dependencies: CampaignDependenciesV1 = {
    inventory: {
      schemaVersion: 1,
      inventoryVersion: state.authority.inventory.inventoryVersion,
      inventoryDigest: digestPublicationBytes(inventoryBytes),
      specRevision: CAMPAIGN_SPEC_REVISION_V1,
    },
    ruleModel: {
      schemaVersion: 1,
      ruleModelVersion: "rule-model-v1",
      ruleModelDigest: state.ruleModelDigest,
      suite: state.modeledSuite,
    },
    generator: selected.generator,
    boundaryTransform: selected.boundary,
    renderer: state.authority.renderer,
  };
  const campaignIdentity: CampaignIdentityInput = Object.freeze({
    inventorySchemaVersion: 1,
    inventoryVersion: dependencies.inventory.inventoryVersion,
    inventoryDigest: dependencies.inventory.inventoryDigest,
    specRevision: dependencies.inventory.specRevision,
    ruleModelVersion: dependencies.ruleModel.ruleModelVersion,
    ruleModelDigest: dependencies.ruleModel.ruleModelDigest,
    generator: Object.freeze({
      handlerId: selected.generator.binding.handlerId,
      contractVersion: selected.generator.binding.contractVersion,
      implementationRevision: selected.generator.binding.implementationRevision,
    }),
    boundaryTransform: Object.freeze({
      handlerId: selected.boundary.binding.handlerId,
      contractVersion: selected.boundary.binding.contractVersion,
      implementationRevision: selected.boundary.binding.implementationRevision,
    }),
    rendererRevision: state.authority.renderer.implementationRevision,
    target: "c64",
    prngAlgorithm: "blend65-sha256-ctr-v1",
    seed: value.seed,
    configurationDigest: selected.configurationDigest,
  });
  const prepared = createCampaignPlan({
    campaign: campaignIdentity,
    configuration: selected.configuration,
    dependencies,
  });
  if (!prepared.ok) {
    return oracleFailure(
      "oracle.contract.invalid",
      "/intent/configuration",
      prepared.diagnostics[0]?.message ?? "Published campaign could not be prepared.",
    );
  }
  const generated = generateCampaignCase(prepared.value, value.ordinal);
  if (!generated.ok) {
    return oracleFailure(
      "oracle.contract.invalid",
      "/intent/ordinal",
      generated.diagnostics[0]?.message ?? "Published case could not be generated.",
    );
  }
  if (generated.value.modeledCase.primaryRuleId !== value.ruleId) {
    return oracleFailure(
      "oracle.contract.invalid",
      "/intent/ordinal",
      "Generated case does not match the requested primary rule.",
    );
  }
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      campaign: prepared.value,
      generatedCase: generated.value,
      campaignIdentity,
      configuration: selected.configuration,
    }),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}
