import {
  canonicalUnsignedDecimal,
  copyUint8Array,
  encodeCanonicalIdentity,
  generationConfigurationFields,
  isSha256Digest,
  normalizeGenerationConfiguration,
  normalizeGenerationPath,
  uint8ArrayByteLength,
  type CanonicalIdentityField,
  type GenerationConfiguration,
} from "./canonical-identity.js";
import { inspectGeneratorInput } from "./generator-ir-validator.js";
import {
  deriveIdentityDigest,
  type IdentityCollisionRegistry,
} from "./identity-collision-registry.js";
import type { Sha256Digest } from "./model-registry-model.js";
import { isRuleModelId } from "./rule-model-registry.js";

export {
  createIdentityCollisionRegistry,
  IDENTITY_COLLISION_REGISTRY_LIMITS,
} from "./identity-collision-registry.js";
export type {
  IdentityCollisionRegistry,
  IdentityCollisionRegistryLimits,
  IdentityDigest,
} from "./identity-collision-registry.js";

/** Content identity for one executable campaign handler. */
export interface HandlerIdentity {
  /** Stable declaration identifier for the handler. */
  readonly handlerId: string;
  /** Contract version implemented by the handler revision. */
  readonly contractVersion: string;
  /** Content revision of the handler's complete production dependency closure. */
  readonly implementationRevision: Sha256Digest;
}

/** Complete closed input that shapes a deterministic campaign. */
export interface CampaignIdentityInput {
  /** Supported inventory wire-schema version. */
  readonly inventorySchemaVersion: 1;
  /** Semantic inventory version selected for the campaign. */
  readonly inventoryVersion: string;
  /** Content digest of the selected inventory. */
  readonly inventoryDigest: Sha256Digest;
  /** Frozen language specification revision. */
  readonly specRevision: string;
  /** Semantic rule-model registry version. */
  readonly ruleModelVersion: string;
  /** Content digest of the selected rule-model registry. */
  readonly ruleModelDigest: Sha256Digest;
  /** Fresh generator identity used for case construction. */
  readonly generator: HandlerIdentity;
  /** Fresh boundary-transform identity used for neighboring cases. */
  readonly boundaryTransform: HandlerIdentity;
  /** Content revision of the deterministic renderer. */
  readonly rendererRevision: Sha256Digest;
  /** Target platform for generated programs. */
  readonly target: "c64" | "c64u" | "cx16" | "a800xl" | "a7800";
  /** Pinned path-local deterministic choice algorithm. */
  readonly prngAlgorithm: "blend65-sha256-ctr-v1";
  /** Canonical campaign seed. */
  readonly seed: Sha256Digest;
  /** Digest of the complete generation configuration. */
  readonly configurationDigest: Sha256Digest;
}

/** Stable identity of one case within a content-addressed campaign. */
export interface CaseIdentity {
  /** Digest of the complete parent campaign. */
  readonly campaignDigest: Sha256Digest;
  /** Immutable path locating the case's generation branch. */
  readonly generationPath: readonly number[];
  /** Zero-based case ordinal within the campaign. */
  readonly ordinal: number;
  /** Digest binding campaign, path, and ordinal. */
  readonly digest: Sha256Digest;
}

/** Stable canonical-identity validation or collision failure. */
export interface IdentityDiagnostic {
  /** Stable machine-readable failure category. */
  readonly code:
    | "identity.input.invalid"
    | "identity.collision"
    | "identity.registry.limit"
    | "identity.registry.disposed";
  /** RFC 6901 pointer to the rejected identity data. */
  readonly path: string;
  /** Stable human-readable explanation of the failure. */
  readonly message: string;
}

/** Closed result returned by every canonical identity derivation. */
export type IdentityResult<T> =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Canonical identity derived from the complete input. */
      readonly identity: T;
      /** Defensive copy of the exact canonical bytes that were hashed. */
      readonly preimage: Uint8Array;
      /** Empty diagnostic tuple for the successful branch. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Failure discriminator. */
      readonly ok: false;
      /** Non-empty deterministic validation, limit, lifecycle, or collision failures. */
      readonly diagnostics: readonly IdentityDiagnostic[];
    };

/** Result of retaining one digest/preimage pair in a collision registry. */
export type IdentityRegistryResult =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Empty diagnostic tuple for an idempotent or newly retained pair. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Failure discriminator. */
      readonly ok: false;
      /** Non-empty deterministic registry failure list. */
      readonly diagnostics: readonly IdentityDiagnostic[];
    };

interface NormalizedCampaign {
  readonly input: CampaignIdentityInput;
  readonly fields: readonly CanonicalIdentityField[];
}

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
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
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const TEXT_ENCODER = new TextEncoder();
const MAX_VERSION_BYTES = 512;

function diagnostic(
  code: IdentityDiagnostic["code"],
  path: string,
  message: string,
): IdentityDiagnostic {
  return Object.freeze({ code, path, message });
}

function failure(
  code: IdentityDiagnostic["code"],
  path: string,
  message: string,
): IdentityResult<never> {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([diagnostic(code, path, message)]),
  });
}

function identitySuccess<T>(identity: T, preimage: Uint8Array): IdentityResult<T> {
  const preimageByteLength = uint8ArrayByteLength(preimage);
  const isolatedPreimage =
    preimageByteLength === undefined ? undefined : copyUint8Array(preimage, preimageByteLength);
  if (isolatedPreimage === undefined) {
    return failure(
      "identity.input.invalid",
      "/digest",
      "Canonical identity preimage could not be copied safely.",
    );
  }
  return Object.freeze({
    ok: true,
    identity,
    preimage: isolatedPreimage,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isVersion(value: unknown): value is string {
  return (
    typeof value === "string" &&
    VERSION_PATTERN.test(value) &&
    TEXT_ENCODER.encode(value).byteLength <= MAX_VERSION_BYTES
  );
}

function isTarget(value: unknown): value is CampaignIdentityInput["target"] {
  return (
    value === "c64" ||
    value === "c64u" ||
    value === "cx16" ||
    value === "a800xl" ||
    value === "a7800"
  );
}

function normalizeHandler(
  value: unknown,
  path: string,
):
  | { readonly ok: true; readonly handler: HandlerIdentity }
  | { readonly ok: false; readonly diagnostic: IdentityDiagnostic } {
  if (!isRecord(value) || !hasExactKeys(value, HANDLER_KEYS)) {
    return {
      ok: false,
      diagnostic: diagnostic(
        "identity.input.invalid",
        path,
        "Handler identity must use the exact closed shape.",
      ),
    };
  }
  if (!isRuleModelId(value.handlerId)) {
    return {
      ok: false,
      diagnostic: diagnostic(
        "identity.input.invalid",
        `${path}/handlerId`,
        "Handler ID is not canonical.",
      ),
    };
  }
  if (!isVersion(value.contractVersion)) {
    return {
      ok: false,
      diagnostic: diagnostic(
        "identity.input.invalid",
        `${path}/contractVersion`,
        "Handler contract version is not canonical.",
      ),
    };
  }
  if (!isSha256Digest(value.implementationRevision)) {
    return {
      ok: false,
      diagnostic: diagnostic(
        "identity.input.invalid",
        `${path}/implementationRevision`,
        "Handler implementation revision is not canonical.",
      ),
    };
  }
  return {
    ok: true,
    handler: Object.freeze({
      handlerId: value.handlerId,
      contractVersion: value.contractVersion,
      implementationRevision: value.implementationRevision,
    }),
  };
}

function campaignProblem(
  path: string,
  message: string,
): { readonly ok: false; readonly diagnostic: IdentityDiagnostic } {
  return { ok: false, diagnostic: diagnostic("identity.input.invalid", path, message) };
}

function normalizeCampaign(
  input: unknown,
):
  | { readonly ok: true; readonly campaign: NormalizedCampaign }
  | { readonly ok: false; readonly diagnostic: IdentityDiagnostic } {
  const structuralFailure = inspectGeneratorInput(input, "/campaign", () => false);
  if (structuralFailure !== undefined) {
    return campaignProblem(structuralFailure.path, structuralFailure.message);
  }
  if (!isRecord(input) || !hasExactKeys(input, CAMPAIGN_KEYS)) {
    return campaignProblem("/campaign", "Campaign identity must use the exact closed shape.");
  }
  if (input.inventorySchemaVersion !== 1) {
    return campaignProblem(
      "/campaign/inventorySchemaVersion",
      "Inventory schema version must be one.",
    );
  }
  for (const [key, value] of [
    ["inventoryVersion", input.inventoryVersion],
    ["specRevision", input.specRevision],
    ["ruleModelVersion", input.ruleModelVersion],
  ]) {
    if (!isVersion(value)) {
      return campaignProblem(`/campaign/${key}`, "Campaign version is not canonical.");
    }
  }
  for (const [key, value] of [
    ["inventoryDigest", input.inventoryDigest],
    ["ruleModelDigest", input.ruleModelDigest],
    ["rendererRevision", input.rendererRevision],
    ["seed", input.seed],
    ["configurationDigest", input.configurationDigest],
  ]) {
    if (!isSha256Digest(value)) {
      return campaignProblem(`/campaign/${key}`, "Campaign digest is not canonical.");
    }
  }
  const generator = normalizeHandler(input.generator, "/campaign/generator");
  if (!generator.ok) return generator;
  const boundaryTransform = normalizeHandler(
    input.boundaryTransform,
    "/campaign/boundaryTransform",
  );
  if (!boundaryTransform.ok) return boundaryTransform;
  if (!isTarget(input.target)) {
    return campaignProblem("/campaign/target", "Campaign target is not supported.");
  }
  if (input.prngAlgorithm !== "blend65-sha256-ctr-v1") {
    return campaignProblem("/campaign/prngAlgorithm", "Campaign PRNG algorithm is not supported.");
  }
  if (
    !isVersion(input.inventoryVersion) ||
    !isSha256Digest(input.inventoryDigest) ||
    !isVersion(input.specRevision) ||
    !isVersion(input.ruleModelVersion) ||
    !isSha256Digest(input.ruleModelDigest) ||
    !isSha256Digest(input.rendererRevision) ||
    !isSha256Digest(input.seed) ||
    !isSha256Digest(input.configurationDigest)
  ) {
    return campaignProblem("/campaign", "Campaign identity is invalid.");
  }

  const closedInput: CampaignIdentityInput = Object.freeze({
    inventorySchemaVersion: 1,
    inventoryVersion: input.inventoryVersion,
    inventoryDigest: input.inventoryDigest,
    specRevision: input.specRevision,
    ruleModelVersion: input.ruleModelVersion,
    ruleModelDigest: input.ruleModelDigest,
    generator: generator.handler,
    boundaryTransform: boundaryTransform.handler,
    rendererRevision: input.rendererRevision,
    target: input.target,
    prngAlgorithm: "blend65-sha256-ctr-v1",
    seed: input.seed,
    configurationDigest: input.configurationDigest,
  });
  const fields: readonly CanonicalIdentityField[] = Object.freeze([
    Object.freeze({ name: "inventorySchemaVersion", value: "1" }),
    Object.freeze({ name: "inventoryVersion", value: closedInput.inventoryVersion }),
    Object.freeze({ name: "inventoryDigest", value: closedInput.inventoryDigest }),
    Object.freeze({ name: "specRevision", value: closedInput.specRevision }),
    Object.freeze({ name: "ruleModelVersion", value: closedInput.ruleModelVersion }),
    Object.freeze({ name: "ruleModelDigest", value: closedInput.ruleModelDigest }),
    Object.freeze({ name: "generator.handlerId", value: closedInput.generator.handlerId }),
    Object.freeze({
      name: "generator.contractVersion",
      value: closedInput.generator.contractVersion,
    }),
    Object.freeze({
      name: "generator.implementationRevision",
      value: closedInput.generator.implementationRevision,
    }),
    Object.freeze({
      name: "boundaryTransform.handlerId",
      value: closedInput.boundaryTransform.handlerId,
    }),
    Object.freeze({
      name: "boundaryTransform.contractVersion",
      value: closedInput.boundaryTransform.contractVersion,
    }),
    Object.freeze({
      name: "boundaryTransform.implementationRevision",
      value: closedInput.boundaryTransform.implementationRevision,
    }),
    Object.freeze({ name: "rendererRevision", value: closedInput.rendererRevision }),
    Object.freeze({ name: "target", value: closedInput.target }),
    Object.freeze({ name: "prngAlgorithm", value: closedInput.prngAlgorithm }),
    Object.freeze({ name: "seed", value: closedInput.seed }),
    Object.freeze({ name: "configurationDigest", value: closedInput.configurationDigest }),
  ]);
  return {
    ok: true,
    campaign: Object.freeze({ input: closedInput, fields }),
  };
}

/**
 * Derives the content identity of a complete closed generation configuration.
 *
 * @param configuration Unknown configuration data to normalize and hash.
 * @param registry Optional collision-retention capability.
 * @returns The digest and canonical preimage, or stable diagnostics.
 *
 * @example
 * ```ts
 * const result = deriveConfigurationIdentity(configuration);
 * ```
 */
export function deriveConfigurationIdentity(
  configuration: GenerationConfiguration,
  registry?: IdentityCollisionRegistry,
): IdentityResult<Sha256Digest> {
  try {
    const normalized = normalizeGenerationConfiguration(configuration);
    if (!normalized.ok) {
      return failure("identity.input.invalid", normalized.problem.path, normalized.problem.message);
    }
    const preimage = encodeCanonicalIdentity(
      "blend65-configuration-v1",
      generationConfigurationFields(normalized.configuration),
    );
    return deriveIdentityDigest(preimage, registry);
  } catch {
    return failure(
      "identity.input.invalid",
      "/configuration",
      "Configuration identity could not be derived safely.",
    );
  }
}

/**
 * Derives the content identity of every case-shaping campaign field.
 *
 * @param input Closed campaign identity input.
 * @param registry Optional collision-retention capability.
 * @returns The digest and canonical preimage, or stable diagnostics.
 *
 * @example
 * ```ts
 * const result = deriveCampaignIdentity(campaign);
 * ```
 */
export function deriveCampaignIdentity(
  input: CampaignIdentityInput,
  registry?: IdentityCollisionRegistry,
): IdentityResult<Sha256Digest> {
  try {
    const normalized = normalizeCampaign(input);
    if (!normalized.ok) {
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([normalized.diagnostic]),
      });
    }
    const preimage = encodeCanonicalIdentity("blend65-campaign-v1", normalized.campaign.fields);
    return deriveIdentityDigest(preimage, registry);
  } catch {
    return failure(
      "identity.input.invalid",
      "/campaign",
      "Campaign identity could not be derived safely.",
    );
  }
}

/**
 * Derives one case identity from a campaign digest, path and ordinal.
 *
 * @param campaignDigest Exact parent campaign digest.
 * @param generationPath Stable random-access generation path.
 * @param ordinal Stable case ordinal.
 * @param registry Optional collision-retention capability.
 * @returns An immutable case identity and canonical preimage, or stable diagnostics.
 *
 * @example
 * ```ts
 * const result = deriveCaseIdentity(campaignDigest, [1, 2], 0);
 * ```
 */
export function deriveCaseIdentity(
  campaignDigest: Sha256Digest,
  generationPath: readonly number[],
  ordinal: number,
  registry?: IdentityCollisionRegistry,
): IdentityResult<CaseIdentity> {
  try {
    if (!isSha256Digest(campaignDigest)) {
      return failure(
        "identity.input.invalid",
        "/campaignDigest",
        "Campaign digest is not canonical.",
      );
    }
    const structuralFailure = inspectGeneratorInput(generationPath, "/generationPath", () => false);
    if (structuralFailure !== undefined) {
      return failure("identity.input.invalid", structuralFailure.path, structuralFailure.message);
    }
    const normalizedPath = normalizeGenerationPath(generationPath, "/generationPath", 64);
    if (!normalizedPath.ok) {
      return failure(
        "identity.input.invalid",
        normalizedPath.problem.path,
        normalizedPath.problem.message,
      );
    }
    if (!Number.isSafeInteger(ordinal) || ordinal < 0) {
      return failure(
        "identity.input.invalid",
        "/ordinal",
        "Case ordinal must be a non-negative safe integer.",
      );
    }
    const preimage = encodeCanonicalIdentity("blend65-case-v1", [
      { name: "campaignDigest", value: campaignDigest },
      { name: "generationPath", value: normalizedPath.encoded },
      { name: "ordinal", value: canonicalUnsignedDecimal(ordinal) },
    ]);
    const derived = deriveIdentityDigest(preimage, registry);
    if (!derived.ok) return derived;
    const identity: CaseIdentity = Object.freeze({
      campaignDigest,
      generationPath: normalizedPath.path,
      ordinal,
      digest: derived.identity,
    });
    return identitySuccess(identity, preimage);
  } catch {
    return failure(
      "identity.input.invalid",
      "/generationPath",
      "Case identity could not be derived safely.",
    );
  }
}

export type { GenerationConfiguration, Sha256Digest };
