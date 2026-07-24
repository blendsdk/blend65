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
import type { GenerationBudget } from "./generator-ir.js";
import {
  EMPTY_REPLAY_DIAGNOSTICS,
  replayDiagnostic,
  replayFailure,
  type ReplayDiagnostic,
  type ReplayEnvelopeParseResult,
  type ReplayEnvelopeV1,
} from "./replay-input-model.js";
import { isRuleModelId } from "./rule-model-registry.js";

const ENVELOPE_KEYS = [
  "schemaVersion",
  "campaign",
  "campaignDigest",
  "caseIdentity",
  "configuration",
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
const HANDLER_KEYS = ["handlerId", "contractVersion", "implementationRevision"] as const;
const CASE_KEYS = ["campaignDigest", "generationPath", "ordinal", "digest"] as const;
const CONFIGURATION_KEYS = [
  "caseCount",
  "maxInvalidCases",
  "enabledRuleIds",
  "spellings",
  "budget",
] as const;
const BUDGET_KEYS = [
  "maxModules",
  "maxDeclarations",
  "maxIrNodes",
  "maxStatements",
  "maxExpressionDepth",
  "maxLoopWork",
  "maxSourceBytes",
  "maxAttempts",
] as const;
const CANONICAL_UNSIGNED = /^(?:0|[1-9][0-9]*)$/u;

function escapePointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Reflect.ownKeys(value);
  return (
    actual.length === keys.length &&
    actual.every((key) => typeof key === "string" && keys.includes(key))
  );
}

function handlerSchemaProblem(value: unknown, path: string): ReplayDiagnostic | undefined {
  if (!isRecord(value) || !hasExactKeys(value, HANDLER_KEYS)) {
    return replayDiagnostic(
      "replay.schema.invalid",
      path,
      "Replay handler identity must use the exact closed shape.",
    );
  }
  if (!isRuleModelId(value.handlerId)) {
    return replayDiagnostic(
      "replay.schema.invalid",
      `${path}/handlerId`,
      "Replay handler ID is not canonical.",
    );
  }
  if (typeof value.contractVersion !== "string" || value.contractVersion.length === 0) {
    return replayDiagnostic(
      "replay.schema.invalid",
      `${path}/contractVersion`,
      "Replay handler contract version is not canonical.",
    );
  }
  if (!isSha256Digest(value.implementationRevision)) {
    return replayDiagnostic(
      "replay.schema.invalid",
      `${path}/implementationRevision`,
      "Replay handler revision is not canonical.",
    );
  }
  return undefined;
}

function campaignSchemaProblem(value: unknown): ReplayDiagnostic | undefined {
  if (!isRecord(value) || !hasExactKeys(value, CAMPAIGN_KEYS)) {
    return replayDiagnostic(
      "replay.schema.invalid",
      "/campaign",
      "Campaign identity does not use the closed version-one shape.",
    );
  }
  if (value.inventorySchemaVersion !== 1) {
    return replayDiagnostic(
      "replay.schema.invalid",
      "/campaign/inventorySchemaVersion",
      "Inventory schema version must be one.",
    );
  }
  for (const key of ["inventoryVersion", "specRevision", "ruleModelVersion"]) {
    if (typeof value[key] !== "string" || value[key].length === 0) {
      return replayDiagnostic(
        "replay.schema.invalid",
        `/campaign/${key}`,
        "Replay campaign version is not canonical.",
      );
    }
  }
  for (const key of [
    "inventoryDigest",
    "ruleModelDigest",
    "rendererRevision",
    "seed",
    "configurationDigest",
  ]) {
    if (!isSha256Digest(value[key])) {
      return replayDiagnostic(
        "replay.schema.invalid",
        `/campaign/${key}`,
        "Replay campaign digest is not canonical.",
      );
    }
  }
  const generatorProblem = handlerSchemaProblem(value.generator, "/campaign/generator");
  if (generatorProblem !== undefined) return generatorProblem;
  const boundaryProblem = handlerSchemaProblem(
    value.boundaryTransform,
    "/campaign/boundaryTransform",
  );
  if (boundaryProblem !== undefined) return boundaryProblem;
  if (
    value.target !== "c64" &&
    value.target !== "c64u" &&
    value.target !== "cx16" &&
    value.target !== "a800xl" &&
    value.target !== "a7800"
  ) {
    return replayDiagnostic(
      "replay.schema.invalid",
      "/campaign/target",
      "Replay campaign target is not supported.",
    );
  }
  if (value.prngAlgorithm !== "blend65-sha256-ctr-v1") {
    return replayDiagnostic(
      "replay.schema.invalid",
      "/campaign/prngAlgorithm",
      "Replay campaign PRNG algorithm is not supported.",
    );
  }
  return undefined;
}

function isCampaignIdentityInput(value: unknown): value is CampaignIdentityInput {
  return campaignSchemaProblem(value) === undefined;
}

function normalizeWireConfiguration(
  value: unknown,
):
  | { readonly ok: true; readonly configuration: GenerationConfiguration }
  | { readonly ok: false; readonly diagnostic: ReplayDiagnostic } {
  if (!isRecord(value) || !hasExactKeys(value, CONFIGURATION_KEYS)) {
    return {
      ok: false,
      diagnostic: replayDiagnostic(
        "replay.schema.invalid",
        "/configuration",
        "Replay configuration must use the exact closed shape.",
      ),
    };
  }
  if (!isRecord(value.budget) || !hasExactKeys(value.budget, BUDGET_KEYS)) {
    return {
      ok: false,
      diagnostic: replayDiagnostic(
        "replay.schema.invalid",
        "/configuration/budget",
        "Replay generation budget must use the exact closed shape.",
      ),
    };
  }
  const encodedLoopWork = value.budget.maxLoopWork;
  if (typeof encodedLoopWork !== "string" || !CANONICAL_UNSIGNED.test(encodedLoopWork)) {
    return {
      ok: false,
      diagnostic: replayDiagnostic(
        "replay.schema.invalid",
        "/configuration/budget/maxLoopWork",
        "Loop-work budget must be an unsigned canonical decimal string.",
      ),
    };
  }
  const budget: GenerationBudget = {
    maxModules: typeof value.budget.maxModules === "number" ? value.budget.maxModules : 0,
    maxDeclarations:
      typeof value.budget.maxDeclarations === "number" ? value.budget.maxDeclarations : 0,
    maxIrNodes: typeof value.budget.maxIrNodes === "number" ? value.budget.maxIrNodes : 0,
    maxStatements: typeof value.budget.maxStatements === "number" ? value.budget.maxStatements : 0,
    maxExpressionDepth:
      typeof value.budget.maxExpressionDepth === "number" ? value.budget.maxExpressionDepth : 0,
    maxLoopWork: BigInt(encodedLoopWork),
    maxSourceBytes:
      typeof value.budget.maxSourceBytes === "number" ? value.budget.maxSourceBytes : 0,
    maxAttempts: typeof value.budget.maxAttempts === "number" ? value.budget.maxAttempts : 0,
  };
  const candidate = {
    caseCount: value.caseCount,
    maxInvalidCases: value.maxInvalidCases,
    enabledRuleIds: value.enabledRuleIds,
    spellings: value.spellings,
    budget,
  };
  const normalized = normalizeGenerationConfiguration(candidate);
  if (!normalized.ok) {
    return {
      ok: false,
      diagnostic: replayDiagnostic(
        "replay.schema.invalid",
        normalized.problem.path,
        normalized.problem.message,
      ),
    };
  }
  return { ok: true, configuration: normalized.configuration };
}

function normalizeCaseIdentity(
  value: unknown,
):
  | { readonly ok: true; readonly identity: CaseIdentity }
  | { readonly ok: false; readonly diagnostic: ReplayDiagnostic } {
  if (!isRecord(value) || !hasExactKeys(value, CASE_KEYS)) {
    return {
      ok: false,
      diagnostic: replayDiagnostic(
        "replay.schema.invalid",
        "/caseIdentity",
        "Case identity must use the exact closed shape.",
      ),
    };
  }
  if (!isSha256Digest(value.campaignDigest)) {
    return {
      ok: false,
      diagnostic: replayDiagnostic(
        "replay.schema.invalid",
        "/caseIdentity/campaignDigest",
        "Case campaign digest is not canonical.",
      ),
    };
  }
  if (!Array.isArray(value.generationPath)) {
    return {
      ok: false,
      diagnostic: replayDiagnostic(
        "replay.schema.invalid",
        "/caseIdentity/generationPath",
        "Case generation path must be an array.",
      ),
    };
  }
  const path: number[] = [];
  for (let index = 0; index < value.generationPath.length; index += 1) {
    const component = value.generationPath[index];
    if (
      typeof component !== "number" ||
      !Number.isSafeInteger(component) ||
      component < 0 ||
      component > 0xffff_ffff
    ) {
      return {
        ok: false,
        diagnostic: replayDiagnostic(
          "replay.schema.invalid",
          `/caseIdentity/generationPath/${index}`,
          "Case generation path component must be an unsigned 32-bit integer.",
        ),
      };
    }
    path.push(component);
  }
  if (
    typeof value.ordinal !== "number" ||
    !Number.isSafeInteger(value.ordinal) ||
    value.ordinal < 0
  ) {
    return {
      ok: false,
      diagnostic: replayDiagnostic(
        "replay.schema.invalid",
        "/caseIdentity/ordinal",
        "Case ordinal must be a non-negative safe integer.",
      ),
    };
  }
  if (!isSha256Digest(value.digest)) {
    return {
      ok: false,
      diagnostic: replayDiagnostic(
        "replay.schema.invalid",
        "/caseIdentity/digest",
        "Case digest is not canonical.",
      ),
    };
  }
  return {
    ok: true,
    identity: Object.freeze({
      campaignDigest: value.campaignDigest,
      generationPath: Object.freeze(path),
      ordinal: value.ordinal,
      digest: value.digest,
    }),
  };
}

function cloneCampaign(input: CampaignIdentityInput): CampaignIdentityInput {
  return Object.freeze({
    inventorySchemaVersion: 1,
    inventoryVersion: input.inventoryVersion,
    inventoryDigest: input.inventoryDigest,
    specRevision: input.specRevision,
    ruleModelVersion: input.ruleModelVersion,
    ruleModelDigest: input.ruleModelDigest,
    generator: Object.freeze({
      handlerId: input.generator.handlerId,
      contractVersion: input.generator.contractVersion,
      implementationRevision: input.generator.implementationRevision,
    }),
    boundaryTransform: Object.freeze({
      handlerId: input.boundaryTransform.handlerId,
      contractVersion: input.boundaryTransform.contractVersion,
      implementationRevision: input.boundaryTransform.implementationRevision,
    }),
    rendererRevision: input.rendererRevision,
    target: input.target,
    prngAlgorithm: "blend65-sha256-ctr-v1",
    seed: input.seed,
    configurationDigest: input.configurationDigest,
  });
}

/**
 * Closes parsed replay JSON and verifies configuration, campaign and case identities.
 *
 * @param value Materialized strict-JSON replay value.
 * @returns A deeply immutable replay envelope or deterministic diagnostics.
 *
 * @example
 * ```ts
 * const normalized = normalizeReplayEnvelope(JSON.parse(json));
 * ```
 */
export function normalizeReplayEnvelope(value: unknown): ReplayEnvelopeParseResult {
  if (!isRecord(value) || !hasExactKeys(value, ENVELOPE_KEYS)) {
    if (isRecord(value)) {
      const unknown = Object.keys(value).find(
        (key) => !ENVELOPE_KEYS.some((allowed) => allowed === key),
      );
      if (unknown !== undefined) {
        return replayFailure(
          "replay.schema.invalid",
          `/${escapePointerSegment(unknown)}`,
          "Replay envelope contains an unknown property.",
        );
      }
    }
    return replayFailure(
      "replay.schema.invalid",
      "",
      "Replay envelope must use the exact closed shape.",
    );
  }
  if (value.schemaVersion !== 1) {
    return replayFailure(
      "replay.schema.invalid",
      "/schemaVersion",
      "Replay schema version must be one.",
    );
  }
  const campaignProblem = campaignSchemaProblem(value.campaign);
  if (campaignProblem !== undefined) {
    return Object.freeze({
      ok: false,
      diagnostics: Object.freeze([campaignProblem]),
    });
  }
  if (!isCampaignIdentityInput(value.campaign)) {
    return replayFailure("replay.schema.invalid", "/campaign", "Replay campaign is invalid.");
  }
  const campaign = cloneCampaign(value.campaign);
  const derivedCampaign = deriveCampaignIdentity(campaign);
  if (!derivedCampaign.ok) {
    const first = derivedCampaign.diagnostics[0];
    return replayFailure(
      "replay.schema.invalid",
      first?.path ?? "/campaign",
      first?.message ?? "Campaign identity is invalid.",
    );
  }
  if (!isSha256Digest(value.campaignDigest)) {
    return replayFailure(
      "replay.schema.invalid",
      "/campaignDigest",
      "Replay campaign digest is not canonical.",
    );
  }
  if (derivedCampaign.identity !== value.campaignDigest) {
    return replayFailure(
      "replay.identity.mismatch",
      "/campaignDigest",
      "Replay campaign digest does not match its canonical campaign bytes.",
    );
  }

  const configuration = normalizeWireConfiguration(value.configuration);
  if (!configuration.ok) {
    return Object.freeze({
      ok: false,
      diagnostics: Object.freeze([configuration.diagnostic]),
    });
  }
  const derivedConfiguration = deriveConfigurationIdentity(configuration.configuration);
  if (!derivedConfiguration.ok) {
    const first = derivedConfiguration.diagnostics[0];
    return replayFailure(
      "replay.schema.invalid",
      first?.path ?? "/configuration",
      first?.message ?? "Replay configuration is invalid.",
    );
  }
  if (derivedConfiguration.identity !== campaign.configurationDigest) {
    return replayFailure(
      "replay.identity.mismatch",
      "/campaign/configurationDigest",
      "Replay configuration content does not match its campaign digest.",
    );
  }

  const caseIdentity = normalizeCaseIdentity(value.caseIdentity);
  if (!caseIdentity.ok) {
    return Object.freeze({
      ok: false,
      diagnostics: Object.freeze([caseIdentity.diagnostic]),
    });
  }
  if (caseIdentity.identity.campaignDigest !== value.campaignDigest) {
    return replayFailure(
      "replay.identity.mismatch",
      "/caseIdentity/campaignDigest",
      "Case identity does not belong to the replay campaign.",
    );
  }
  const derivedCase = deriveCaseIdentity(
    value.campaignDigest,
    caseIdentity.identity.generationPath,
    caseIdentity.identity.ordinal,
  );
  if (!derivedCase.ok || derivedCase.identity.digest !== caseIdentity.identity.digest) {
    return replayFailure(
      "replay.identity.mismatch",
      "/caseIdentity/digest",
      "Case digest does not match its canonical case bytes.",
    );
  }

  const envelope: ReplayEnvelopeV1 = Object.freeze({
    schemaVersion: 1,
    campaign,
    campaignDigest: value.campaignDigest,
    caseIdentity: caseIdentity.identity,
    configuration: configuration.configuration,
  });
  return Object.freeze({
    ok: true,
    envelope,
    diagnostics: EMPTY_REPLAY_DIAGNOSTICS,
  });
}
