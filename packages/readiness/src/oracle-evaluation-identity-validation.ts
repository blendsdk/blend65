import {
  deriveCampaignIdentity,
  deriveCaseIdentity,
  deriveConfigurationIdentity,
  type CampaignIdentityInput,
  type HandlerIdentity,
} from "./case-identity.js";
import { isSha256Digest, normalizeGenerationConfiguration } from "./canonical-identity.js";
import { isOracleRecord, snapshotOracleInput } from "./oracle-input.js";
import type {
  OracleDiagnostic,
  Rd02ReplayProvenanceV1,
  SemanticRelationId,
} from "./oracle-model.js";
import type { Sha256Digest } from "./model-registry-model.js";
import { parseReplayEnvelope, REPLAY_V1_LIMITS } from "./replay-input.js";
import type {
  OracleIdentityResultV1,
  OracleValidationResultV1,
} from "./oracle-evaluation-identity.js";

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const TEXT_ENCODER = new TextEncoder();
const SEMANTIC_RELATION_IDS: ReadonlySet<string> = new Set([
  "relation.identifier-renaming",
  "relation.literal-to-local",
  "relation.local-to-parameter",
  "relation.algebraic-identity",
  "relation.independent-declaration-reordering",
]);
const stringifyJson: (
  value: unknown,
  replacer?: (this: unknown, key: string, value: unknown) => unknown,
) => string | undefined = JSON.stringify;

function handlerIdentity(value: unknown): HandlerIdentity | undefined {
  if (
    !isOracleRecord(value) ||
    typeof value.handlerId !== "string" ||
    typeof value.contractVersion !== "string" ||
    !isSha256Digest(value.implementationRevision)
  ) {
    return undefined;
  }
  return {
    handlerId: value.handlerId,
    contractVersion: value.contractVersion,
    implementationRevision: value.implementationRevision,
  };
}

function repairedCampaign(
  value: Readonly<Record<string, unknown>>,
  configurationDigest: Sha256Digest,
): CampaignIdentityInput | undefined {
  const generator = handlerIdentity(value.generator);
  const boundaryTransform = handlerIdentity(value.boundaryTransform);
  const target = value.target;
  if (
    value.inventorySchemaVersion !== 1 ||
    typeof value.inventoryVersion !== "string" ||
    !isSha256Digest(value.inventoryDigest) ||
    typeof value.specRevision !== "string" ||
    typeof value.ruleModelVersion !== "string" ||
    !isSha256Digest(value.ruleModelDigest) ||
    generator === undefined ||
    boundaryTransform === undefined ||
    !isSha256Digest(value.rendererRevision) ||
    (target !== "c64" &&
      target !== "c64u" &&
      target !== "cx16" &&
      target !== "a800xl" &&
      target !== "a7800") ||
    value.prngAlgorithm !== "blend65-sha256-ctr-v1" ||
    !isSha256Digest(value.seed)
  ) {
    return undefined;
  }
  return {
    inventorySchemaVersion: 1,
    inventoryVersion: value.inventoryVersion,
    inventoryDigest: value.inventoryDigest,
    specRevision: value.specRevision,
    ruleModelVersion: value.ruleModelVersion,
    ruleModelDigest: value.ruleModelDigest,
    generator,
    boundaryTransform,
    rendererRevision: value.rendererRevision,
    target,
    prngAlgorithm: "blend65-sha256-ctr-v1",
    seed: value.seed,
    configurationDigest,
  };
}

function numberArray(value: unknown): value is readonly number[] {
  return Array.isArray(value) && value.every((member) => typeof member === "number");
}

function normalizeReplayStructureWithoutIdentityCoherence(
  value: unknown,
): Rd02ReplayProvenanceV1 | undefined {
  if (!isOracleRecord(value)) return undefined;
  const campaign = value.campaign;
  const caseIdentity = value.caseIdentity;
  const configuration = value.configuration;
  if (
    !isOracleRecord(campaign) ||
    !isOracleRecord(caseIdentity) ||
    !isOracleRecord(configuration) ||
    !isSha256Digest(campaign.configurationDigest) ||
    !isSha256Digest(value.campaignDigest) ||
    !isSha256Digest(caseIdentity.campaignDigest) ||
    !isSha256Digest(caseIdentity.digest)
  ) {
    return undefined;
  }
  const normalizedConfiguration = normalizeGenerationConfiguration(configuration);
  if (!normalizedConfiguration.ok) return undefined;
  const configurationIdentity = deriveConfigurationIdentity(normalizedConfiguration.configuration);
  if (!configurationIdentity.ok) return undefined;
  const repairedCampaignValue = repairedCampaign(campaign, configurationIdentity.identity);
  if (repairedCampaignValue === undefined) return undefined;
  const campaignIdentity = deriveCampaignIdentity(repairedCampaignValue);
  if (!campaignIdentity.ok) return undefined;
  if (!numberArray(caseIdentity.generationPath) || typeof caseIdentity.ordinal !== "number") {
    return undefined;
  }
  const caseResult = deriveCaseIdentity(
    campaignIdentity.identity,
    caseIdentity.generationPath,
    caseIdentity.ordinal,
  );
  if (!caseResult.ok) return undefined;
  const repaired = {
    ...value,
    campaign: repairedCampaignValue,
    campaignDigest: campaignIdentity.identity,
    caseIdentity: {
      ...caseIdentity,
      campaignDigest: campaignIdentity.identity,
      digest: caseResult.identity.digest,
    },
  };
  const text = stringifyJson(repaired, (_key, member: unknown) =>
    typeof member === "bigint" ? member.toString(10) : member,
  );
  if (text === undefined) return undefined;
  const parsed = parseReplayEnvelope(TEXT_ENCODER.encode(text));
  if (!parsed.ok) return undefined;
  return Object.freeze({
    ...parsed.envelope,
    campaign: Object.freeze({
      ...parsed.envelope.campaign,
      configurationDigest: campaign.configurationDigest,
    }),
    campaignDigest: value.campaignDigest,
    caseIdentity: Object.freeze({
      ...parsed.envelope.caseIdentity,
      campaignDigest: caseIdentity.campaignDigest,
      digest: caseIdentity.digest,
    }),
  });
}

function diagnostic(path: string, message: string): OracleDiagnostic {
  return Object.freeze({ code: "oracle.input.invalid", path, message: message.slice(0, 512) });
}

/** Creates one closed validation failure shared by evaluation-identity entry points. */
export function failure<T>(
  path: string,
  message: string,
): Extract<OracleValidationResultV1<T>, { readonly ok: false }> {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([diagnostic(path, message)]),
  });
}

/** Creates one closed identity derivation failure. */
export function identityFailure(path: string, message: string): OracleIdentityResultV1 {
  return failure(path, message);
}

/** Detaches an exact plain data record without invoking accessors. */
export function exactDataRecord(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  try {
    const prototype = Object.getPrototypeOf(value);
    const ownKeys = Reflect.ownKeys(value);
    if (
      (prototype !== Object.prototype && prototype !== null) ||
      ownKeys.length !== keys.length ||
      ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))
    ) {
      return undefined;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const closed: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      closed[key] = descriptor.value;
    }
    return Object.freeze(closed);
  } catch {
    return undefined;
  }
}

/** Compares identifiers by their UTF-8 byte representation. */
export function compareUtf8(left: string, right: string): number {
  const leftBytes = TEXT_ENCODER.encode(left);
  const rightBytes = TEXT_ENCODER.encode(right);
  const length = Math.min(leftBytes.byteLength, rightBytes.byteLength);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftBytes[index] ?? 0) - (rightBytes[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return leftBytes.byteLength - rightBytes.byteLength;
}

/** Narrows an unknown stable relation identity. */
export function isSemanticRelationId(value: unknown): value is SemanticRelationId {
  return typeof value === "string" && SEMANTIC_RELATION_IDS.has(value);
}

/** Snapshots and canonicalizes replay provenance used by evaluation identities. */
export function normalizeReplayProvenance(
  value: unknown,
): OracleValidationResultV1<Rd02ReplayProvenanceV1> {
  const snapshot = snapshotOracleInput(value, "/sourceProvenance");
  if (!snapshot.ok) return Object.freeze({ ok: false, diagnostics: snapshot.diagnostics });
  try {
    const text = stringifyJson(snapshot.value, (_key, member: unknown) =>
      typeof member === "bigint" ? member.toString(10) : member,
    );
    if (text === undefined) {
      return failure("/sourceProvenance", "Replay provenance is not canonical data.");
    }
    const bytes = TEXT_ENCODER.encode(text);
    if (bytes.byteLength > REPLAY_V1_LIMITS.maxInputBytes) {
      return failure("/sourceProvenance", "Replay provenance exceeds its fixed byte limit.");
    }
    const parsed = parseReplayEnvelope(bytes);
    if (!parsed.ok) {
      const structurallyNormalized = normalizeReplayStructureWithoutIdentityCoherence(
        snapshot.value,
      );
      if (structurallyNormalized !== undefined) {
        return Object.freeze({
          ok: true,
          value: structurallyNormalized,
          diagnostics: EMPTY_DIAGNOSTICS,
        });
      }
      const first = parsed.diagnostics[0];
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([
          Object.freeze({
            code:
              first?.code === "replay.input.limit"
                ? ("oracle.input.limit" as const)
                : ("oracle.input.invalid" as const),
            path: `/sourceProvenance${first?.path ?? ""}`,
            message: (first?.message ?? "Replay provenance is invalid.").slice(0, 512),
          }),
        ]),
      });
    }
    return Object.freeze({
      ok: true,
      value: parsed.envelope,
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  } catch {
    return failure("/sourceProvenance", "Replay provenance could not be normalized safely.");
  }
}
