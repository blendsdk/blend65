import type { GenerationConfiguration } from "./canonical-identity.js";
import type { CampaignIdentityInput, CaseIdentity } from "./case-identity.js";
import type { Sha256Digest } from "./model-registry-model.js";

/** Closed version-one replay envelope carried between fresh processes. */
export interface ReplayEnvelopeV1 {
  /** Supported replay wire-schema version. */
  readonly schemaVersion: 1;
  /** Complete content-addressed campaign identity. */
  readonly campaign: CampaignIdentityInput;
  /** Canonical digest of the campaign identity. */
  readonly campaignDigest: Sha256Digest;
  /** Exact path-local case identity selected for replay. */
  readonly caseIdentity: CaseIdentity;
  /** Complete generation configuration matching the campaign digest. */
  readonly configuration: GenerationConfiguration;
}

/** Stable bounded-input, schema or identity failure for replay data. */
export interface ReplayDiagnostic {
  /** Stable machine-readable failure category. */
  readonly code:
    | "replay.input.invalid-json"
    | "replay.input.invalid-utf8"
    | "replay.input.limit"
    | "replay.schema.invalid"
    | "replay.identity.mismatch";
  /** RFC 6901 pointer to the rejected replay value. */
  readonly path: string;
  /** Stable human-readable explanation of the failure. */
  readonly message: string;
}

/** Result of parsing and identity-checking a replay envelope. */
export type ReplayEnvelopeParseResult =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Deeply immutable identity-verified replay envelope. */
      readonly envelope: ReplayEnvelopeV1;
      /** Empty diagnostic tuple for the successful branch. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Failure discriminator. */
      readonly ok: false;
      /** Non-empty deterministic input, schema, limit, or identity failures. */
      readonly diagnostics: readonly ReplayDiagnostic[];
    };

/** Fixed resource policy applied before replay JSON is materialized. */
export interface ReplayInputLimits {
  /** Maximum encoded replay envelope size. */
  readonly maxInputBytes: number;
  /** Maximum JSON container nesting depth. */
  readonly maxDepth: number;
  /** Maximum UTF-8 byte length of one property name or string value. */
  readonly maxStringBytes: number;
  /** Maximum aggregate JSON values and containers. */
  readonly maxValues: number;
  /** Maximum enabled rule identifiers. */
  readonly maxRuleIds: number;
  /** Maximum generation-path components. */
  readonly maxPathComponents: number;
  /** Maximum source spelling families. */
  readonly maxSpellings: number;
}

/**
 * Immutable version-one replay input limits.
 *
 * @example
 * ```ts
 * const maximumBytes = REPLAY_V1_LIMITS.maxInputBytes;
 * ```
 */
export const REPLAY_V1_LIMITS: ReplayInputLimits = Object.freeze({
  maxInputBytes: 1_048_576,
  maxDepth: 12,
  maxStringBytes: 512,
  maxValues: 4_096,
  maxRuleIds: 4_096,
  maxPathComponents: 64,
  maxSpellings: 32,
});

/**
 * Shared immutable empty diagnostic tuple for successful internal replay results.
 *
 * @example
 * ```ts
 * const success = { ok: true, diagnostics: EMPTY_REPLAY_DIAGNOSTICS };
 * ```
 */
export const EMPTY_REPLAY_DIAGNOSTICS: readonly [] = Object.freeze([]);

/**
 * Creates one immutable replay diagnostic.
 *
 * @param code Stable machine-readable replay failure category.
 * @param path RFC 6901 pointer to the rejected value.
 * @param message Stable human-readable failure explanation.
 * @returns An immutable replay diagnostic.
 *
 * @example
 * ```ts
 * const problem = replayDiagnostic("replay.schema.invalid", "/schemaVersion", "Unsupported.");
 * ```
 */
export function replayDiagnostic(
  code: ReplayDiagnostic["code"],
  path: string,
  message: string,
): ReplayDiagnostic {
  return Object.freeze({ code, path, message });
}

/**
 * Creates an immutable single-diagnostic replay failure result.
 *
 * @param code Stable machine-readable replay failure category.
 * @param path RFC 6901 pointer to the rejected value.
 * @param message Stable human-readable failure explanation.
 * @returns A closed failed replay parse result.
 *
 * @example
 * ```ts
 * const failed = replayFailure("replay.input.invalid-json", "", "Invalid JSON.");
 * ```
 */
export function replayFailure(
  code: ReplayDiagnostic["code"],
  path: string,
  message: string,
): ReplayEnvelopeParseResult {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([replayDiagnostic(code, path, message)]),
  });
}
