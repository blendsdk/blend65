import { createCampaignPlan } from "./campaign.js";
import type { PublishedSnapshot } from "./binding-model.js";
import { deriveConfigurationIdentity, type CampaignIdentityInput } from "./case-identity.js";
import type { CampaignDependenciesV1, PreparedCampaign } from "./campaign-model.js";
import { getPreparedCampaignState } from "./campaign-state.js";
import {
  isSha256Digest,
  normalizeGenerationConfiguration,
  type GenerationConfiguration,
} from "./canonical-identity.js";
import type { ExecutionOperationResultV1 } from "./execution-contracts.js";
import { getRuleGenerationDomain } from "./modeled-generator-suite.js";
import { createModeledGeneratorSuite } from "./modeled-generator-suite.js";
import { hasExactOracleKeys, isOracleRecord, snapshotOracleInput } from "./oracle-input.js";
import { oracleFailure } from "./oracle-input.js";
import type { OracleValidationResultV1 } from "./oracle-evaluation-identity.js";
import { digestPublicationBytes } from "./publication-model.js";
import { getPublishedSnapshotAuthority } from "./publication-resolver.js";
import type { Sha256Digest } from "./model-registry-model.js";

/** Semantic-only input for an execution campaign bound to one genuine published snapshot. */
export interface PublishedExecutionCampaignIntentV1 {
  /** Request schema version. */
  readonly schemaVersion: 1;
  /** Fixed local execution target. */
  readonly target: "c64";
  /** Deterministic campaign seed. */
  readonly seed: Sha256Digest;
  /** Complete bounded generation configuration. */
  readonly configuration: GenerationConfiguration;
}

/** Passive execution identity authenticated by a genuine prepared campaign. */
export interface PreparedCampaignExecutionIdentityV1 {
  /** Closed projection revision. */
  readonly revision: "prepared-campaign-execution-identity-v1";
  /** Exact digest of the prepared campaign. */
  readonly campaignDigest: string;
  /** Seed retained verbatim from the campaign identity. */
  readonly seed: string;
  /** Target selected by the campaign identity. */
  readonly target: CampaignIdentityInput["target"];
}

const CAMPAIGN_INTENT_KEYS = ["schemaVersion", "target", "seed", "configuration"] as const;
const CAMPAIGN_SPEC_REVISION_V1 = "spec-v3.0";
const PUBLISHED_CAMPAIGN_PARENTS = new WeakMap<object, Sha256Digest>();

function campaignParentFailure(message: string): ExecutionOperationResultV1<true> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([
      Object.freeze({
        code: "execution.identity" as const,
        path: "/campaign/parentDigest",
        message,
      }),
    ] as const),
  });
}

/**
 * Prepares one campaign exclusively from a genuine publication snapshot's selected authority.
 *
 * The caller supplies campaign semantics only. Inventory, rule-model, generator, boundary and
 * renderer authority all come from the resolver-created snapshot and cannot be substituted.
 *
 * @param snapshot Genuine resolver-created selected or staged publication snapshot.
 * @param intent Hostile semantic-only campaign intent.
 * @returns Genuine prepared campaign or one closed authority/input failure.
 */
export function createPublishedExecutionCampaignV1(
  snapshot: PublishedSnapshot,
  intent: unknown,
): OracleValidationResultV1<PreparedCampaign> {
  const authority = getPublishedSnapshotAuthority(snapshot);
  if (
    authority === undefined ||
    authority.bindingRows.length !== 9 ||
    new Set(authority.bindingRows.map(({ handlerId }) => handlerId)).size !== 9 ||
    authority.seedContractBytes === undefined ||
    authority.renderer === undefined
  ) {
    return oracleFailure(
      "oracle.authority.missing",
      "/snapshot",
      "Published execution campaign requires one genuine nine-binding snapshot.",
    );
  }
  const captured = snapshotOracleInput(intent, "/intent");
  if (
    !captured.ok ||
    !isOracleRecord(captured.value) ||
    !hasExactOracleKeys(captured.value, CAMPAIGN_INTENT_KEYS) ||
    captured.value.schemaVersion !== 1 ||
    captured.value.target !== "c64" ||
    !isSha256Digest(captured.value.seed)
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      "/intent",
      "Published execution campaign intent must use the exact semantic-only shape.",
    );
  }
  const normalized = normalizeGenerationConfiguration(captured.value.configuration);
  if (!normalized.ok) {
    return oracleFailure(
      "oracle.input.invalid",
      `/intent/configuration${normalized.problem.path}`,
      normalized.problem.message,
    );
  }
  const configurationIdentity = deriveConfigurationIdentity(normalized.configuration);
  if (!configurationIdentity.ok) {
    return oracleFailure(
      "oracle.input.invalid",
      "/intent/configuration",
      "Published execution campaign configuration identity could not be derived.",
    );
  }
  const ruleModelBytes = authority.memberBytes.get("rule-models-v1.json");
  const ruleModelReviewBytes = authority.memberBytes.get("rule-models-v1-review.json");
  const inventoryBytes = authority.memberBytes.get("compiler-readiness-v1.json");
  if (
    ruleModelBytes === undefined ||
    ruleModelReviewBytes === undefined ||
    inventoryBytes === undefined
  ) {
    return oracleFailure(
      "oracle.authority.missing",
      "/snapshot",
      "Published execution campaign members are incomplete.",
    );
  }
  const modeled = createModeledGeneratorSuite({
    inventory: authority.inventory,
    seedContractBytes: authority.seedContractBytes,
    ruleModelBytes,
    reviewEvidenceBytes: ruleModelReviewBytes,
  });
  if (!modeled.ok) {
    return oracleFailure(
      "oracle.authority.not-accepted",
      "/snapshot",
      modeled.diagnostics[0]?.message ?? "Published rule-model authority could not be loaded.",
    );
  }
  const candidates = new Map(
    authority.candidates.map((candidate) => [candidate.binding.handlerId, candidate]),
  );
  let generatorId: string | undefined;
  for (const [index, ruleId] of normalized.configuration.enabledRuleIds.entries()) {
    const domain = getRuleGenerationDomain(modeled.suite, ruleId);
    if (!domain.ok || domain.state !== "modeled") {
      return oracleFailure(
        "oracle.route.invalid",
        `/intent/configuration/enabledRuleIds/${index}`,
        "Enabled rule has no selected published generation route.",
      );
    }
    generatorId ??= domain.handlerId;
    if (generatorId !== domain.handlerId) {
      return oracleFailure(
        "oracle.route.invalid",
        `/intent/configuration/enabledRuleIds/${index}`,
        "Enabled rules must share one selected published generation route.",
      );
    }
  }
  const generator = generatorId === undefined ? undefined : candidates.get(generatorId);
  const boundaryTransform = candidates.get("transform.boundary-variants");
  if (generator === undefined || boundaryTransform === undefined) {
    return oracleFailure(
      "oracle.authority.missing",
      "/snapshot",
      "Published execution campaign participants are unavailable.",
    );
  }
  const dependencies: CampaignDependenciesV1 = {
    inventory: {
      schemaVersion: 1,
      inventoryVersion: authority.inventory.inventoryVersion,
      inventoryDigest: digestPublicationBytes(inventoryBytes),
      specRevision: CAMPAIGN_SPEC_REVISION_V1,
    },
    ruleModel: {
      schemaVersion: 1,
      ruleModelVersion: "rule-model-v1",
      ruleModelDigest: modeled.ruleModelDigest,
      suite: modeled.suite,
    },
    generator,
    boundaryTransform,
    renderer: authority.renderer,
  };
  const campaign: CampaignIdentityInput = Object.freeze({
    inventorySchemaVersion: 1,
    inventoryVersion: dependencies.inventory.inventoryVersion,
    inventoryDigest: dependencies.inventory.inventoryDigest,
    specRevision: dependencies.inventory.specRevision,
    ruleModelVersion: dependencies.ruleModel.ruleModelVersion,
    ruleModelDigest: dependencies.ruleModel.ruleModelDigest,
    generator: Object.freeze({
      handlerId: generator.binding.handlerId,
      contractVersion: generator.binding.contractVersion,
      implementationRevision: generator.binding.implementationRevision,
    }),
    boundaryTransform: Object.freeze({
      handlerId: boundaryTransform.binding.handlerId,
      contractVersion: boundaryTransform.binding.contractVersion,
      implementationRevision: boundaryTransform.binding.implementationRevision,
    }),
    rendererRevision: authority.renderer.implementationRevision,
    target: "c64",
    prngAlgorithm: "blend65-sha256-ctr-v1",
    seed: captured.value.seed,
    configurationDigest: configurationIdentity.identity,
  });
  const prepared = createCampaignPlan({
    campaign,
    configuration: normalized.configuration,
    dependencies,
  });
  if (!prepared.ok) {
    return oracleFailure(
      "oracle.contract.invalid",
      "/intent/configuration",
      prepared.diagnostics[0]?.message ?? "Published execution campaign could not be prepared.",
    );
  }
  PUBLISHED_CAMPAIGN_PARENTS.set(prepared.value, authority.publicationDigest);
  return prepared;
}

/**
 * Proves that a genuine published execution campaign was minted by the exact selected parent.
 *
 * @param campaign Opaque prepared campaign supplied to execution orchestration.
 * @param parentDigest Exact selected publication digest.
 * @returns `true` only for the private campaign-to-parent capability join.
 */
export function authenticatePublishedExecutionCampaignParentV1(
  campaign: PreparedCampaign,
  parentDigest: string,
): ExecutionOperationResultV1<true> {
  const retained = PUBLISHED_CAMPAIGN_PARENTS.get(campaign);
  if (retained === undefined) {
    return campaignParentFailure("Published execution campaign parent authority is unavailable.");
  }
  if (retained !== parentDigest) {
    return campaignParentFailure("Published execution campaign names a different parent.");
  }
  return Object.freeze({ ok: true, value: true });
}

/**
 * Projects the passive identity facts needed to orchestrate a genuine prepared campaign.
 *
 * @param campaign Opaque campaign returned by the campaign preparation API.
 * @returns A new frozen identity projection, or a stable issue for a forged capability.
 *
 * @example
 * ```ts
 * const identity = getPreparedCampaignExecutionIdentityV1(campaign);
 * if (identity.ok) console.log(identity.value.campaignDigest);
 * ```
 */
export function getPreparedCampaignExecutionIdentityV1(
  campaign: PreparedCampaign,
): ExecutionOperationResultV1<PreparedCampaignExecutionIdentityV1> {
  const state = getPreparedCampaignState(campaign);
  if (state === undefined) {
    return Object.freeze({
      ok: false as const,
      issues: Object.freeze([
        Object.freeze({
          code: "execution.identity" as const,
          path: "/campaign",
          message: "Prepared campaign authority is not genuine.",
        }),
      ]) as readonly [
        {
          readonly code: "execution.identity";
          readonly path: "/campaign";
          readonly message: "Prepared campaign authority is not genuine.";
        },
      ],
    });
  }

  return Object.freeze({
    ok: true as const,
    value: Object.freeze({
      revision: "prepared-campaign-execution-identity-v1" as const,
      campaignDigest: state.campaignDigest,
      seed: state.campaign.seed,
      target: state.campaign.target,
    }),
  });
}
