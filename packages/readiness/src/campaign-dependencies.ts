import { isFreshCandidateRegistration } from "./binding-validator.js";
import { isSha256Digest } from "./canonical-identity.js";
import type { CampaignIdentityInput } from "./case-identity.js";
import type {
  CampaignBoundaryBindingV1,
  CampaignGeneratorBindingV1,
  CampaignGeneratorId,
  CampaignInventoryAuthorityV1,
  CampaignRendererBindingV1,
  CampaignRuleModelAuthorityV1,
  CaseRendererV1,
} from "./campaign-model.js";
import type { PreparedCampaignDependencies } from "./campaign-state.js";
import {
  MODELED_GENERATOR_SUITE_CAPABILITY,
  type BoundaryVariantsHandlerV1,
  type GeneratorHandlerV1,
  type ModeledGeneratorSuite,
} from "./modeled-generator-model.js";
import { getModeledSuiteState } from "./modeled-generator-suite.js";
import { isResolvedFreshReplayBinding, type IdentityComponent } from "./revision-registry.js";

const GENERATOR_IDS: ReadonlySet<string> = new Set([
  "generator.frontend-cases",
  "generator.compiler-cases",
  "generator.runtime-cases",
]);
const INVENTORY_KEYS = [
  "schemaVersion",
  "inventoryVersion",
  "inventoryDigest",
  "specRevision",
] as const;
const RULE_MODEL_KEYS = ["schemaVersion", "ruleModelVersion", "ruleModelDigest", "suite"] as const;
const EXECUTABLE_KEYS = [
  "handlerId",
  "kind",
  "contractVersion",
  "implementationRevision",
  "implementation",
] as const;
const RENDERER_KEYS = ["implementationRevision", "implementation"] as const;
const DEPENDENCY_KEYS = [
  "inventory",
  "ruleModel",
  "generator",
  "boundaryTransform",
  "renderer",
] as const;

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

function hasSuiteMarker(value: unknown): value is ModeledGeneratorSuite {
  if (typeof value !== "object" || value === null) return false;
  try {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, MODELED_GENERATOR_SUITE_CAPABILITY);
    return descriptor !== undefined && "value" in descriptor && descriptor.value === true;
  } catch {
    return false;
  }
}

function isModeledGeneratorSuite(value: unknown): value is ModeledGeneratorSuite {
  return hasSuiteMarker(value) && getModeledSuiteState(value) !== undefined;
}

function inventoryAuthority(value: unknown): CampaignInventoryAuthorityV1 | undefined {
  const record = closedRecord(value, INVENTORY_KEYS);
  if (
    record === undefined ||
    record.schemaVersion !== 1 ||
    typeof record.inventoryVersion !== "string" ||
    record.inventoryVersion.length === 0 ||
    !isSha256Digest(record.inventoryDigest) ||
    typeof record.specRevision !== "string" ||
    record.specRevision.length === 0
  ) {
    return undefined;
  }
  return Object.freeze({
    schemaVersion: 1,
    inventoryVersion: record.inventoryVersion,
    inventoryDigest: record.inventoryDigest,
    specRevision: record.specRevision,
  });
}

function ruleModelAuthority(value: unknown): CampaignRuleModelAuthorityV1 | undefined {
  const record = closedRecord(value, RULE_MODEL_KEYS);
  if (
    record === undefined ||
    record.schemaVersion !== 1 ||
    typeof record.ruleModelVersion !== "string" ||
    record.ruleModelVersion.length === 0 ||
    !isSha256Digest(record.ruleModelDigest) ||
    !isModeledGeneratorSuite(record.suite)
  ) {
    return undefined;
  }
  const state = getModeledSuiteState(record.suite);
  if (
    state === undefined ||
    state.protocolVersion !== record.ruleModelVersion ||
    state.ruleModelDigest !== record.ruleModelDigest
  ) {
    return undefined;
  }
  return Object.freeze({
    schemaVersion: 1,
    ruleModelVersion: record.ruleModelVersion,
    ruleModelDigest: record.ruleModelDigest,
    suite: record.suite,
  });
}

function isGeneratorId(value: unknown): value is CampaignGeneratorId {
  return typeof value === "string" && GENERATOR_IDS.has(value);
}

function isGeneratorImplementation(value: unknown): value is GeneratorHandlerV1 {
  return typeof value === "function";
}

function generatorBinding(value: unknown): CampaignGeneratorBindingV1 | undefined {
  const record = closedRecord(value, EXECUTABLE_KEYS);
  if (
    record === undefined ||
    !isGeneratorId(record.handlerId) ||
    record.kind !== "generator" ||
    record.contractVersion !== "1.0.0" ||
    !isSha256Digest(record.implementationRevision) ||
    !isGeneratorImplementation(record.implementation)
  ) {
    return undefined;
  }
  return Object.freeze({
    handlerId: record.handlerId,
    contractVersion: "1.0.0",
    implementationRevision: record.implementationRevision,
    implementation: record.implementation,
  });
}

function isBoundaryImplementation(value: unknown): value is BoundaryVariantsHandlerV1 {
  return typeof value === "function";
}

function boundaryBinding(value: unknown): CampaignBoundaryBindingV1 | undefined {
  const record = closedRecord(value, EXECUTABLE_KEYS);
  if (
    record === undefined ||
    record.handlerId !== "transform.boundary-variants" ||
    record.kind !== "transform" ||
    record.contractVersion !== "1.0.0" ||
    !isSha256Digest(record.implementationRevision) ||
    !isBoundaryImplementation(record.implementation)
  ) {
    return undefined;
  }
  return Object.freeze({
    handlerId: "transform.boundary-variants",
    contractVersion: "1.0.0",
    implementationRevision: record.implementationRevision,
    implementation: record.implementation,
  });
}

function isRendererImplementation(value: unknown): value is CaseRendererV1 {
  return typeof value === "function";
}

function rendererBinding(value: unknown): CampaignRendererBindingV1 | undefined {
  const record = closedRecord(value, RENDERER_KEYS);
  if (
    record === undefined ||
    !isSha256Digest(record.implementationRevision) ||
    !isRendererImplementation(record.implementation)
  ) {
    return undefined;
  }
  return Object.freeze({
    implementationRevision: record.implementationRevision,
    implementation: record.implementation,
  });
}

/** Closes public campaign dependencies while requiring freshness registration capabilities. */
export function normalizeCampaignDependencies(
  value: unknown,
): PreparedCampaignDependencies | undefined {
  const record = closedRecord(value, DEPENDENCY_KEYS);
  if (record === undefined) return undefined;
  const inventory = inventoryAuthority(record.inventory);
  const ruleModel = ruleModelAuthority(record.ruleModel);
  const generator = isFreshCandidateRegistration(record.generator)
    ? generatorBinding(record.generator.binding)
    : undefined;
  const boundaryTransform = isFreshCandidateRegistration(record.boundaryTransform)
    ? boundaryBinding(record.boundaryTransform.binding)
    : undefined;
  const renderer = rendererBinding(record.renderer);
  if (
    inventory === undefined ||
    ruleModel === undefined ||
    generator === undefined ||
    boundaryTransform === undefined ||
    renderer === undefined
  ) {
    return undefined;
  }
  return Object.freeze({ inventory, ruleModel, generator, boundaryTransform, renderer });
}

/** Closes replay dependencies only when executable values retain registry provenance. */
export function normalizeReplayDependencies(
  value: unknown,
  campaign: CampaignIdentityInput,
): PreparedCampaignDependencies | undefined {
  const resolved = resolveReplayCampaignDependencies(value, campaign);
  return resolved.ok ? resolved.dependencies : undefined;
}

/** Exact replay dependency authority or the first content/key disagreement. */
export type ReplayCampaignDependencyResult =
  | {
      readonly ok: true;
      readonly dependencies: PreparedCampaignDependencies;
    }
  | {
      readonly ok: false;
      readonly missing: Exclude<IdentityComponent, "configuration">;
    };

/**
 * Resolves replay dependencies and classifies the first content/key disagreement.
 *
 * @param value Five exact values returned by a revision registry.
 * @param campaign Carried campaign identity those values must describe.
 * @returns Closed dependencies or the exact incompatible component.
 */
export function resolveReplayCampaignDependencies(
  value: unknown,
  campaign: CampaignIdentityInput,
): ReplayCampaignDependencyResult {
  const record = closedRecord(value, DEPENDENCY_KEYS);
  if (record === undefined) return Object.freeze({ ok: false, missing: "inventory" });
  const inventory = inventoryAuthority(record.inventory);
  if (
    inventory === undefined ||
    campaign.inventorySchemaVersion !== inventory.schemaVersion ||
    campaign.inventoryVersion !== inventory.inventoryVersion ||
    campaign.inventoryDigest !== inventory.inventoryDigest ||
    campaign.specRevision !== inventory.specRevision
  ) {
    return Object.freeze({ ok: false, missing: "inventory" });
  }
  const suite = isModeledGeneratorSuite(record.ruleModel) ? record.ruleModel : undefined;
  const suiteState = suite === undefined ? undefined : getModeledSuiteState(suite);
  if (
    suite === undefined ||
    suiteState === undefined ||
    suiteState.protocolVersion !== campaign.ruleModelVersion ||
    suiteState.ruleModelDigest !== campaign.ruleModelDigest
  ) {
    return Object.freeze({ ok: false, missing: "rule-model" });
  }
  const generator = isResolvedFreshReplayBinding(record.generator, "generator")
    ? generatorBinding(record.generator)
    : undefined;
  if (
    generator === undefined ||
    campaign.generator.handlerId !== generator.handlerId ||
    campaign.generator.contractVersion !== generator.contractVersion ||
    campaign.generator.implementationRevision !== generator.implementationRevision
  ) {
    return Object.freeze({ ok: false, missing: "generator" });
  }
  const boundaryTransform = isResolvedFreshReplayBinding(
    record.boundaryTransform,
    "boundary-transform",
  )
    ? boundaryBinding(record.boundaryTransform)
    : undefined;
  if (
    boundaryTransform === undefined ||
    campaign.boundaryTransform.handlerId !== boundaryTransform.handlerId ||
    campaign.boundaryTransform.contractVersion !== boundaryTransform.contractVersion ||
    campaign.boundaryTransform.implementationRevision !== boundaryTransform.implementationRevision
  ) {
    return Object.freeze({ ok: false, missing: "boundary-transform" });
  }
  const renderer = rendererBinding(record.renderer);
  if (renderer === undefined || campaign.rendererRevision !== renderer.implementationRevision) {
    return Object.freeze({ ok: false, missing: "renderer" });
  }
  const ruleModel: CampaignRuleModelAuthorityV1 = Object.freeze({
    schemaVersion: 1,
    ruleModelVersion: campaign.ruleModelVersion,
    ruleModelDigest: campaign.ruleModelDigest,
    suite,
  });
  return Object.freeze({
    ok: true,
    dependencies: Object.freeze({
      inventory,
      ruleModel,
      generator,
      boundaryTransform,
      renderer,
    }),
  });
}

/** Reports whether closed dependencies match every carried campaign identity component. */
export function campaignDependenciesMatch(
  campaign: CampaignIdentityInput,
  dependencies: PreparedCampaignDependencies,
): boolean {
  return (
    campaign.inventorySchemaVersion === dependencies.inventory.schemaVersion &&
    campaign.inventoryVersion === dependencies.inventory.inventoryVersion &&
    campaign.inventoryDigest === dependencies.inventory.inventoryDigest &&
    campaign.specRevision === dependencies.inventory.specRevision &&
    campaign.ruleModelVersion === dependencies.ruleModel.ruleModelVersion &&
    campaign.ruleModelDigest === dependencies.ruleModel.ruleModelDigest &&
    campaign.generator.handlerId === dependencies.generator.handlerId &&
    campaign.generator.contractVersion === dependencies.generator.contractVersion &&
    campaign.generator.implementationRevision === dependencies.generator.implementationRevision &&
    campaign.boundaryTransform.handlerId === dependencies.boundaryTransform.handlerId &&
    campaign.boundaryTransform.contractVersion === dependencies.boundaryTransform.contractVersion &&
    campaign.boundaryTransform.implementationRevision ===
      dependencies.boundaryTransform.implementationRevision &&
    campaign.rendererRevision === dependencies.renderer.implementationRevision
  );
}
