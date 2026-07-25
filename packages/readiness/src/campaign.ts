import { isDeepStrictEqual } from "node:util";

import {
  isSha256Digest,
  normalizeGenerationConfiguration,
  type GenerationConfiguration,
} from "./canonical-identity.js";
import {
  deriveCampaignIdentity,
  deriveCaseIdentity,
  deriveConfigurationIdentity,
  type CampaignIdentityInput,
  type CaseIdentity,
} from "./case-identity.js";
import { createBoundaryVariants } from "./boundary-variants.js";
import {
  type CampaignBoundaryBindingV1,
  type CampaignDiagnostic,
  type CampaignPlanSummary,
  type CampaignResult,
  type CreateCampaignPlanInput,
  type PreparedCampaign,
} from "./campaign-model.js";
import { deriveCampaignPlanItem } from "./campaign-plan-item.js";
import {
  campaignDependenciesMatch,
  normalizeCampaignDependencies,
  normalizeReplayDependencies,
} from "./campaign-dependencies.js";
import { createCampaignCollisionIndex, proveCampaignCaseIdentities } from "./campaign-collision.js";
import type { ScalarType } from "./generator-ir.js";
import { MODELED_RULE_FACTS } from "./modeled-generator-facts.js";
import type { ModeledCaseChoice } from "./modeled-generator-model.js";
import { getRuleGenerationDomain } from "./modeled-generator-suite.js";
import type { SourceRenderOptions } from "./roundtrip-model.js";
import {
  createReplayCampaignTargetCapability,
  type ReplayCampaignTarget,
} from "./replay-target.js";
import {
  createPreparedCampaignCapability,
  type CampaignDomain,
  type PreparedCampaignDependencies,
  type PreparedCampaignState,
} from "./campaign-state.js";

const MAX_CAMPAIGN_CASES = 100_000;
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const PLAN_INPUT_KEYS = ["campaign", "configuration", "dependencies"] as const;
const PLAN_INPUT_WITH_INDEX_KEYS = [
  "campaign",
  "configuration",
  "dependencies",
  "collisionIndex",
] as const;
const CAMPAIGN_KEYS = [
  "inventorySchemaVersion",
  "inventoryVersion",
  "inventoryDigest",
  "specRevision",
  "ruleModelVersion",
  "ruleModelDigest",
  "generator",
  "boundaryTransform",
  "rendererRevision",
  "target",
  "prngAlgorithm",
  "seed",
  "configurationDigest",
] as const;
const IDENTITY_HANDLER_KEYS = ["handlerId", "contractVersion", "implementationRevision"] as const;

interface PreparedCampaignData {
  readonly summary: CampaignPlanSummary;
  readonly state: PreparedCampaignState;
}

function diagnostic(
  code: CampaignDiagnostic["code"],
  path: string,
  message: string,
): CampaignDiagnostic {
  return Object.freeze({ code, path, message });
}

function failure<T>(
  code: CampaignDiagnostic["code"],
  path: string,
  message: string,
): CampaignResult<T> {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([diagnostic(code, path, message)]),
  });
}

function success<T>(value: T): CampaignResult<T> {
  return Object.freeze({ ok: true, value, diagnostics: EMPTY_DIAGNOSTICS });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function closedRecord(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  try {
    if (!isRecord(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))
    ) {
      return undefined;
    }
    const output: Record<string, unknown> = {};
    for (const key of keys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      output[key] = descriptor.value;
    }
    return output;
  } catch {
    return undefined;
  }
}

function isCampaignIdentity(value: unknown): value is CampaignIdentityInput {
  const record = closedRecord(value, CAMPAIGN_KEYS);
  if (record === undefined) return false;
  const generator = closedRecord(record.generator, IDENTITY_HANDLER_KEYS);
  const boundary = closedRecord(record.boundaryTransform, IDENTITY_HANDLER_KEYS);
  return (
    record.inventorySchemaVersion === 1 &&
    typeof record.inventoryVersion === "string" &&
    record.inventoryVersion.length > 0 &&
    isSha256Digest(record.inventoryDigest) &&
    typeof record.specRevision === "string" &&
    record.specRevision.length > 0 &&
    typeof record.ruleModelVersion === "string" &&
    record.ruleModelVersion.length > 0 &&
    isSha256Digest(record.ruleModelDigest) &&
    generator !== undefined &&
    typeof generator.handlerId === "string" &&
    typeof generator.contractVersion === "string" &&
    isSha256Digest(generator.implementationRevision) &&
    boundary !== undefined &&
    typeof boundary.handlerId === "string" &&
    typeof boundary.contractVersion === "string" &&
    isSha256Digest(boundary.implementationRevision) &&
    isSha256Digest(record.rendererRevision) &&
    (record.target === "c64" ||
      record.target === "c64u" ||
      record.target === "cx16" ||
      record.target === "a800xl" ||
      record.target === "a7800") &&
    record.prngAlgorithm === "blend65-sha256-ctr-v1" &&
    isSha256Digest(record.seed) &&
    isSha256Digest(record.configurationDigest)
  );
}

function closeCampaign(input: CampaignIdentityInput): CampaignIdentityInput {
  return Object.freeze({
    inventorySchemaVersion: 1,
    inventoryVersion: input.inventoryVersion,
    inventoryDigest: input.inventoryDigest,
    specRevision: input.specRevision,
    ruleModelVersion: input.ruleModelVersion,
    ruleModelDigest: input.ruleModelDigest,
    generator: Object.freeze({ ...input.generator }),
    boundaryTransform: Object.freeze({ ...input.boundaryTransform }),
    rendererRevision: input.rendererRevision,
    target: input.target,
    prngAlgorithm: input.prngAlgorithm,
    seed: input.seed,
    configurationDigest: input.configurationDigest,
  });
}

function scalarTypesForRule(ruleId: string): readonly ScalarType[] | undefined {
  const fact = MODELED_RULE_FACTS.get(ruleId);
  if (fact === undefined) return undefined;
  if (fact.kind === "scalar") return Object.freeze([fact.scalarType]);
  return Object.freeze([...new Set(fact.parameterTypes)]);
}

/**
 * Compares a candidate boundary handler with every authoritative field for one rule.
 *
 * @param binding Exact candidate boundary binding.
 * @param ruleId Reviewed rule whose scalar types must agree.
 * @param spellings Campaign-permitted source spellings.
 * @returns Whether values, order, duplicates, spellings, depth, and diagnostics are exact.
 */
export function campaignBoundaryAgrees(
  binding: CampaignBoundaryBindingV1,
  ruleId: string,
  spellings: GenerationConfiguration["spellings"],
): boolean {
  const types = scalarTypesForRule(ruleId);
  if (types === undefined) return false;
  try {
    return types.every((type) => {
      const input = Object.freeze({
        type,
        spellings,
        minNestingDepth: 0,
        maxNestingDepth: 0,
        allowEmpty: false,
      });
      const expected = createBoundaryVariants(input);
      const actual = binding.implementation(input);
      return isDeepStrictEqual(actual, expected);
    });
  } catch {
    return false;
  }
}

function choicePermitted(
  choice: ModeledCaseChoice,
  spellings: GenerationConfiguration["spellings"],
): boolean {
  if (choice.kind === "scalar") return spellings.includes(choice.spelling);
  return (
    spellings.includes(choice.addressSpelling) &&
    (choice.valueSpelling === undefined || spellings.includes(choice.valueSpelling))
  );
}

function prepareDomains(
  configuration: GenerationConfiguration,
  dependencies: PreparedCampaignDependencies,
): CampaignResult<readonly CampaignDomain[]> {
  const domains: CampaignDomain[] = [];
  for (const ruleId of configuration.enabledRuleIds) {
    const resolved = getRuleGenerationDomain(dependencies.ruleModel.suite, ruleId);
    if (!resolved.ok || resolved.state !== "modeled") {
      return failure(
        "campaign.rule.unavailable",
        "/configuration/enabledRuleIds",
        `Enabled rule ${ruleId} has no reviewed generation domain.`,
      );
    }
    if (resolved.handlerId !== dependencies.generator.handlerId) {
      return failure(
        "campaign.dependency.mismatch",
        "/dependencies/generator/handlerId",
        "Every enabled rule must route to the campaign's exact generator.",
      );
    }
    const fact = MODELED_RULE_FACTS.get(ruleId);
    if (
      fact === undefined ||
      !campaignBoundaryAgrees(dependencies.boundaryTransform, ruleId, configuration.spellings)
    ) {
      return failure(
        "campaign.dependency.mismatch",
        "/dependencies/boundaryTransform",
        "Boundary families do not agree with the reviewed rule model.",
      );
    }
    const choices = Object.freeze(
      resolved.choices.filter((choice) => choicePermitted(choice, configuration.spellings)),
    );
    if (choices.length === 0) {
      return failure(
        "campaign.rule.unavailable",
        "/configuration/spellings",
        `Enabled rule ${ruleId} has no permitted construction spelling.`,
      );
    }
    domains.push(
      Object.freeze({
        ruleId,
        choices,
        neighborIds: Object.freeze([...fact.neighborIds]),
      }),
    );
  }
  if (domains.length === 0) {
    return failure(
      "campaign.rule.unavailable",
      "/configuration/enabledRuleIds",
      "A campaign must enable at least one reviewed rule.",
    );
  }
  return success(Object.freeze(domains));
}

function prepareCampaignData(
  record: Readonly<Record<string, unknown>>,
  dependencies: PreparedCampaignDependencies,
): CampaignResult<PreparedCampaignData> {
  try {
    const normalized = normalizeGenerationConfiguration(record.configuration);
    if (!normalized.ok) {
      return failure("campaign.input.invalid", normalized.problem.path, normalized.problem.message);
    }
    if (normalized.configuration.caseCount > MAX_CAMPAIGN_CASES) {
      return failure(
        "campaign.input.invalid",
        "/configuration/caseCount",
        `Campaigns contain at most ${MAX_CAMPAIGN_CASES} cases.`,
      );
    }
    if (!isCampaignIdentity(record.campaign)) {
      return failure(
        "campaign.input.invalid",
        "/campaign",
        "Campaign identity must use the exact closed shape.",
      );
    }
    const campaignIdentity = deriveCampaignIdentity(record.campaign);
    if (!campaignIdentity.ok) {
      const problem = campaignIdentity.diagnostics[0];
      return failure(
        "campaign.input.invalid",
        problem?.path ?? "/campaign",
        problem?.message ?? "Campaign identity is invalid.",
      );
    }
    const configurationIdentity = deriveConfigurationIdentity(normalized.configuration);
    if (!configurationIdentity.ok) {
      return failure(
        "campaign.input.invalid",
        "/configuration",
        "Configuration identity is invalid.",
      );
    }
    const campaign = closeCampaign(record.campaign);
    if (configurationIdentity.identity !== campaign.configurationDigest) {
      return failure(
        "campaign.identity.mismatch",
        "/campaign/configurationDigest",
        "Campaign configuration digest does not match its closed configuration.",
      );
    }
    if (!campaignDependenciesMatch(campaign, dependencies)) {
      return failure(
        "campaign.dependency.mismatch",
        "/dependencies",
        "Campaign dependencies do not match the carried identities.",
      );
    }
    const preparedDomains = prepareDomains(normalized.configuration, dependencies);
    if (!preparedDomains.ok) return preparedDomains;
    const coverageChoices = Object.freeze(
      preparedDomains.value.flatMap((domain) => domain.choices),
    );
    const invalidChoicesByDomain = Object.freeze(
      preparedDomains.value.map((domain) =>
        Object.freeze(
          normalized.configuration.spellings.map((spelling) =>
            Object.freeze(
              domain.choices.filter((choice) =>
                choice.kind === "scalar"
                  ? choice.spelling === spelling
                  : choice.addressSpelling === spelling || choice.valueSpelling === spelling,
              ),
            ),
          ),
        ),
      ),
    );
    if (coverageChoices.length > normalized.configuration.caseCount) {
      return failure(
        "campaign.coverage.insufficient",
        "/configuration/caseCount",
        "Case count cannot hold mandatory valid spelling coverage.",
      );
    }
    const remaining = normalized.configuration.caseCount - coverageChoices.length;
    const invalidCount = Math.min(normalized.configuration.maxInvalidCases, remaining);
    const randomValidCount = remaining - invalidCount;

    const renderOptions: SourceRenderOptions = Object.freeze({
      maxSourceBytes: normalized.configuration.budget.maxSourceBytes,
      literalSpellings: Object.freeze([]),
    });
    const summary = Object.freeze({
      schemaVersion: 1 as const,
      campaignDigest: campaignIdentity.identity,
      totalCaseCount: normalized.configuration.caseCount,
      validCaseCount: coverageChoices.length + randomValidCount,
      invalidCaseCount: invalidCount,
    });
    const state: PreparedCampaignState = Object.freeze({
      campaign,
      configuration: normalized.configuration,
      dependencies,
      campaignDigest: campaignIdentity.identity,
      domains: preparedDomains.value,
      coverageChoices,
      invalidChoicesByDomain,
      coverageCount: coverageChoices.length,
      randomValidCount,
      invalidCount,
      renderOptions,
    });
    return success(Object.freeze({ summary, state }));
  } catch {
    return failure("campaign.input.invalid", "", "Campaign input could not be inspected safely.");
  }
}

function prepareCampaign(
  record: Readonly<Record<string, unknown>>,
  dependencies: PreparedCampaignDependencies,
): CampaignResult<PreparedCampaign> {
  const prepared = prepareCampaignData(record, dependencies);
  if (!prepared.ok) return prepared;
  const collisionIndex =
    Object.hasOwn(record, "collisionIndex") &&
    typeof record.collisionIndex === "object" &&
    record.collisionIndex !== null
      ? record.collisionIndex
      : undefined;
  const collisionProof = proveCampaignCaseIdentities(
    collisionIndex,
    prepared.value.state.campaignDigest,
    prepared.value.state.configuration.caseCount,
    prepared.value.state.coverageCount,
    prepared.value.state.randomValidCount,
  );
  if (!collisionProof.ok) return collisionProof;
  return success(createPreparedCampaignCapability(prepared.value.summary, prepared.value.state));
}

/**
 * Prepares immutable campaign authority and proves every planned case identity.
 *
 * @param input Campaign identity, configuration, exact dependencies and optional collision index.
 * @returns Opaque cursor-free campaign or deterministic diagnostics.
 *
 * @example
 * ```ts
 * const prepared = createCampaignPlan({ campaign, configuration, dependencies });
 * ```
 */
export function createCampaignPlan(
  input: CreateCampaignPlanInput,
): CampaignResult<PreparedCampaign> {
  try {
    const keys =
      isRecord(input) && Object.hasOwn(input, "collisionIndex")
        ? PLAN_INPUT_WITH_INDEX_KEYS
        : PLAN_INPUT_KEYS;
    const record = closedRecord(input, keys);
    if (record === undefined) {
      return failure("campaign.input.invalid", "", "Campaign input must use the exact shape.");
    }
    const dependencies = normalizeCampaignDependencies(record.dependencies);
    if (dependencies === undefined) {
      return failure(
        "campaign.input.invalid",
        "/dependencies",
        "Campaign dependencies require exact freshness-gated executable registrations.",
      );
    }
    return prepareCampaign(record, dependencies);
  } catch {
    return failure("campaign.input.invalid", "", "Campaign input could not be inspected safely.");
  }
}

/**
 * Prepares replay using only exact values retained by a factory revision registry.
 *
 * @param input Parsed campaign data and privately provenance-verified resolved values.
 * @returns Opaque cursor-free campaign or deterministic diagnostics.
 *
 * @example
 * ```ts
 * const prepared = createReplayCampaignPlan({ campaign, configuration, dependencies });
 * ```
 */
export function createReplayCampaignPlan(input: unknown): CampaignResult<PreparedCampaign> {
  try {
    const keys =
      isRecord(input) && Object.hasOwn(input, "collisionIndex")
        ? PLAN_INPUT_WITH_INDEX_KEYS
        : PLAN_INPUT_KEYS;
    const record = closedRecord(input, keys);
    if (record === undefined || !isCampaignIdentity(record.campaign)) {
      return failure("campaign.input.invalid", "", "Replay campaign input is invalid.");
    }
    const dependencies = normalizeReplayDependencies(record.dependencies, record.campaign);
    if (dependencies === undefined) {
      return failure(
        "campaign.input.invalid",
        "/dependencies",
        "Replay dependencies lack exact registry provenance.",
      );
    }
    return prepareCampaign(record, dependencies);
  } catch {
    return failure(
      "campaign.input.invalid",
      "",
      "Replay campaign input could not be inspected safely.",
    );
  }
}

/**
 * Prepares and verifies only the single item requested by an exact replay envelope.
 *
 * @param input Parsed campaign data and provenance-verified resolved values.
 * @param carriedIdentity Complete case identity carried by the replay envelope.
 * @returns Distinct target-only capability without a campaign-wide identity scan.
 */
export function createReplayCampaignTarget(
  input: unknown,
  carriedIdentity: CaseIdentity,
): CampaignResult<ReplayCampaignTarget> {
  try {
    const record = closedRecord(input, PLAN_INPUT_KEYS);
    if (record === undefined || !isCampaignIdentity(record.campaign)) {
      return failure("campaign.input.invalid", "", "Replay campaign target input is invalid.");
    }
    const dependencies = normalizeReplayDependencies(record.dependencies, record.campaign);
    if (dependencies === undefined) {
      return failure(
        "campaign.input.invalid",
        "/dependencies",
        "Replay dependencies lack exact registry provenance.",
      );
    }
    const prepared = prepareCampaignData(record, dependencies);
    if (!prepared.ok) return prepared;
    const item = deriveCampaignPlanItem(prepared.value.state, carriedIdentity.ordinal);
    if (!item.ok) return item;
    const identity = deriveCaseIdentity(
      prepared.value.state.campaignDigest,
      item.value.generationPath,
      item.value.ordinal,
    );
    if (!identity.ok || !isDeepStrictEqual(identity.identity, carriedIdentity)) {
      return failure(
        "campaign.identity.mismatch",
        "/caseIdentity",
        "Replay target identity does not match its derived campaign item.",
      );
    }
    return success(
      createReplayCampaignTargetCapability(prepared.value.state, item.value, identity.identity),
    );
  } catch {
    return failure(
      "campaign.input.invalid",
      "",
      "Replay campaign target could not be inspected safely.",
    );
  }
}

export { createCampaignCollisionIndex };
export { getCampaignPlanItem } from "./campaign-plan-item.js";
