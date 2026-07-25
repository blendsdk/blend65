import { createHash } from "node:crypto";

import { copyUint8Array, isSha256Digest } from "./canonical-identity.js";
import { deriveCaseIdentity } from "./case-identity.js";
import {
  CAMPAIGN_COLLISION_INDEX_CAPABILITY,
  type CampaignCollisionIndex,
  type CampaignDiagnostic,
  type CampaignResult,
} from "./campaign-model.js";
import type { Sha256Digest } from "./model-registry-model.js";

interface CollisionIndexState {
  readonly campaignDigest: Sha256Digest;
  readonly digest?: (preimage: Uint8Array) => Uint8Array;
  readonly witnesses: Map<Sha256Digest, string>;
  used: boolean;
}

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const COLLISION_STATES = new WeakMap<object, CollisionIndexState>();
const INPUT_KEYS = ["campaignDigest"] as const;
const INPUT_WITH_DIGEST_KEYS = ["campaignDigest", "digest"] as const;

function failure<T>(
  code: CampaignDiagnostic["code"],
  path: string,
  message: string,
): CampaignResult<T> {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([Object.freeze({ code, path, message })]),
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

function isCollisionDigest(value: unknown): value is (preimage: Uint8Array) => Uint8Array {
  return typeof value === "function";
}

function sha256Digest(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function conformanceDigest(
  digest: (preimage: Uint8Array) => Uint8Array,
  preimage: Uint8Array,
): Sha256Digest | undefined {
  try {
    const bytes = copyUint8Array(digest(preimage), 32);
    if (bytes === undefined) return undefined;
    let hexadecimal = "";
    for (const byte of bytes) hexadecimal += byte.toString(16).padStart(2, "0");
    return `sha256:${hexadecimal}`;
  } catch {
    return undefined;
  }
}

function pathForOrdinal(
  ordinal: number,
  coverageCount: number,
  randomValidCount: number,
): readonly [0 | 1 | 2, number] {
  if (ordinal < coverageCount) return Object.freeze([0, ordinal]);
  if (ordinal < coverageCount + randomValidCount) {
    return Object.freeze([1, ordinal - coverageCount]);
  }
  return Object.freeze([2, ordinal - coverageCount - randomValidCount]);
}

/**
 * Creates a fresh single-use collision proof for one campaign.
 *
 * @param input Exact campaign digest and optional conformance digest.
 * @returns Opaque campaign-specific collision index.
 *
 * @example
 * ```ts
 * const index = createCampaignCollisionIndex({ campaignDigest });
 * ```
 */
export function createCampaignCollisionIndex(input: {
  readonly campaignDigest: Sha256Digest;
  readonly digest?: (preimage: Uint8Array) => Uint8Array;
}): CampaignResult<CampaignCollisionIndex> {
  try {
    const keys =
      isRecord(input) && Object.hasOwn(input, "digest") ? INPUT_WITH_DIGEST_KEYS : INPUT_KEYS;
    const record = closedRecord(input, keys);
    if (
      record === undefined ||
      !isSha256Digest(record.campaignDigest) ||
      (Object.hasOwn(record, "digest") && !isCollisionDigest(record.digest))
    ) {
      return failure(
        "campaign.input.invalid",
        "",
        "Collision index input must use the exact closed shape.",
      );
    }
    const capability: CampaignCollisionIndex = Object.freeze({
      [CAMPAIGN_COLLISION_INDEX_CAPABILITY]: true as const,
    });
    COLLISION_STATES.set(capability, {
      campaignDigest: record.campaignDigest,
      ...(isCollisionDigest(record.digest) ? { digest: record.digest } : {}),
      witnesses: new Map(),
      used: false,
    });
    return success(capability);
  } catch {
    return failure(
      "campaign.input.invalid",
      "",
      "Collision index input could not be inspected safely.",
    );
  }
}

/**
 * Consumes one fresh index and proves every path/ordinal witness before campaign publication.
 *
 * @param supplied Optional caller-provided collision index.
 * @param campaignDigest Exact derived parent campaign digest.
 * @param total Total number of case witnesses.
 * @param coverageCount Mandatory valid prefix length.
 * @param randomValidCount Random-valid lane length.
 * @returns Success only after all case witnesses are collision-free.
 */
export function proveCampaignCaseIdentities(
  supplied: unknown,
  campaignDigest: Sha256Digest,
  total: number,
  coverageCount: number,
  randomValidCount: number,
): CampaignResult<true> {
  let index: CollisionIndexState | undefined;
  if (supplied === undefined) {
    const created = createCampaignCollisionIndex({ campaignDigest });
    if (!created.ok) return created;
    index = COLLISION_STATES.get(created.value);
  } else if (typeof supplied === "object" && supplied !== null) {
    index = COLLISION_STATES.get(supplied);
  }
  if (index === undefined) {
    return failure(
      "campaign.input.invalid",
      "/collisionIndex",
      "Collision index capability is invalid.",
    );
  }
  if (index.used) {
    return failure("campaign.input.invalid", "/collisionIndex", "Collision index is not fresh.");
  }
  if (index.campaignDigest !== campaignDigest) {
    return failure(
      "campaign.identity.mismatch",
      "/collisionIndex",
      "Collision index belongs to a different campaign.",
    );
  }
  index.used = true;
  try {
    for (let ordinal = 0; ordinal < total; ordinal += 1) {
      const path = pathForOrdinal(ordinal, coverageCount, randomValidCount);
      const identity = deriveCaseIdentity(campaignDigest, path, ordinal);
      if (!identity.ok) {
        return failure(
          "campaign.choice.invalid",
          "/generationPath",
          "A planned case identity could not be derived.",
        );
      }
      const digest =
        index.digest === undefined
          ? sha256Digest(identity.preimage)
          : conformanceDigest(index.digest, identity.preimage);
      if (digest === undefined) {
        return failure(
          "campaign.input.invalid",
          "/collisionIndex/digest",
          "Collision digest must return exactly 32 bytes.",
        );
      }
      const witness = `${path[0]}.${path[1]}|${ordinal}`;
      const retained = index.witnesses.get(digest);
      if (retained !== undefined && retained !== witness) {
        return failure(
          "campaign.identity.collision",
          "/collisionIndex",
          "Unequal campaign case witnesses produced the same digest.",
        );
      }
      if (retained === undefined) index.witnesses.set(digest, witness);
    }
    return success(true);
  } finally {
    index.witnesses.clear();
  }
}
