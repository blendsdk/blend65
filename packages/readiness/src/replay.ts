import { isDeepStrictEqual } from "node:util";

import { normalizeGenerationConfiguration } from "./canonical-identity.js";
import { createReplayCampaignPlan, createReplayCampaignTarget } from "./campaign.js";
import { resolveReplayCampaignDependencies } from "./campaign-dependencies.js";
import type { CampaignCollisionIndex, GeneratedCase } from "./campaign-model.js";
import { generateCampaignCase, generateReplayTargetCase } from "./generate-case.js";
import { parseReplayEnvelope, type ReplayDiagnostic } from "./replay-input.js";
import {
  resolveReplayRevisions,
  type IdentityComponent,
  type RevisionRegistry,
} from "./revision-registry.js";

/** Closed exact-replay success, incompatibility or invalid-input result. */
export type ReplayResult =
  | { readonly ok: true; readonly case: GeneratedCase; readonly source: Uint8Array }
  | {
      readonly ok: false;
      readonly kind: "replay-incompatible";
      readonly missing: IdentityComponent;
    }
  | {
      readonly ok: false;
      readonly kind: "replay-invalid";
      readonly diagnostics: readonly ReplayDiagnostic[];
    };

interface ReplayCaseInput {
  readonly envelopeBytes: Uint8Array;
  readonly registry: RevisionRegistry;
  readonly collisionIndex?: CampaignCollisionIndex;
}

const INPUT_KEYS = ["envelopeBytes", "registry"] as const;
const INPUT_WITH_INDEX_KEYS = ["envelopeBytes", "registry", "collisionIndex"] as const;

function diagnostic(
  code: ReplayDiagnostic["code"],
  path: string,
  message: string,
): ReplayDiagnostic {
  return Object.freeze({ code, path, message });
}

function invalid(code: ReplayDiagnostic["code"], path: string, message: string): ReplayResult {
  return Object.freeze({
    ok: false,
    kind: "replay-invalid",
    diagnostics: Object.freeze([diagnostic(code, path, message)]),
  });
}

function incompatible(missing: IdentityComponent): ReplayResult {
  return Object.freeze({ ok: false, kind: "replay-incompatible", missing });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function closeInput(value: unknown): Readonly<Record<string, unknown>> | undefined {
  try {
    if (!isRecord(value)) return undefined;
    const keys: readonly string[] = Object.hasOwn(value, "collisionIndex")
      ? INPUT_WITH_INDEX_KEYS
      : INPUT_KEYS;
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))
    ) {
      return undefined;
    }
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return undefined;
  }
}

function isRevisionRegistry(value: unknown): value is RevisionRegistry {
  if (typeof value !== "object" || value === null) return false;
  try {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, "resolve");
    return (
      descriptor !== undefined && "value" in descriptor && typeof descriptor.value === "function"
    );
  } catch {
    return false;
  }
}

function isByteArray(value: unknown): value is Uint8Array {
  try {
    return value instanceof Uint8Array;
  } catch {
    return false;
  }
}

function isCollisionIndex(value: unknown): value is CampaignCollisionIndex {
  return typeof value === "object" && value !== null;
}

function parsedConfigurationIncompatibility(diagnostics: readonly ReplayDiagnostic[]): boolean {
  return diagnostics.some(
    (problem) =>
      (problem.code === "replay.identity.mismatch" &&
        problem.path === "/campaign/configurationDigest") ||
      (problem.code === "replay.schema.invalid" &&
        problem.path === "/configuration" &&
        problem.message === "Replay envelope is missing its carried configuration."),
  );
}

/**
 * Reconstructs one exact ordinal after bounded parsing and six-revision resolution.
 *
 * @param input Replay bytes, exact registry and optional fresh collision index.
 * @returns Exact case and its existing byte array, or one closed replay failure.
 *
 * @example
 * ```ts
 * const replayed = replayCase({ envelopeBytes, registry });
 * ```
 */
export function replayCase(input: ReplayCaseInput): ReplayResult {
  const closed = closeInput(input);
  if (closed === undefined) {
    return invalid("replay.schema.invalid", "", "Replay input must use the exact closed shape.");
  }
  if (!isByteArray(closed.envelopeBytes)) {
    return invalid("replay.schema.invalid", "/envelopeBytes", "Replay bytes are invalid.");
  }
  const parsed = parseReplayEnvelope(closed.envelopeBytes);
  if (!parsed.ok) {
    return parsedConfigurationIncompatibility(parsed.diagnostics)
      ? incompatible("configuration")
      : Object.freeze({
          ok: false,
          kind: "replay-invalid",
          diagnostics: parsed.diagnostics,
        });
  }
  if (!isRevisionRegistry(closed.registry)) {
    return invalid("replay.schema.invalid", "/registry", "Revision registry is invalid.");
  }
  const resolved = resolveReplayRevisions(parsed.envelope, closed.registry);
  if (!resolved.ok) return resolved;

  const configuration = normalizeGenerationConfiguration(resolved.resolved.configuration);
  if (
    !configuration.ok ||
    !isDeepStrictEqual(configuration.configuration, parsed.envelope.configuration)
  ) {
    return incompatible("configuration");
  }
  const replayDependencies = {
    inventory: resolved.resolved.inventory,
    ruleModel: resolved.resolved["rule-model"],
    generator: resolved.resolved.generator,
    boundaryTransform: resolved.resolved["boundary-transform"],
    renderer: resolved.resolved.renderer,
  };
  const compatibleDependencies = resolveReplayCampaignDependencies(
    replayDependencies,
    parsed.envelope.campaign,
  );
  if (!compatibleDependencies.ok) return incompatible(compatibleDependencies.missing);
  const collisionIndex =
    Object.hasOwn(closed, "collisionIndex") && isCollisionIndex(closed.collisionIndex)
      ? closed.collisionIndex
      : undefined;
  const campaignInput = {
    campaign: parsed.envelope.campaign,
    configuration: configuration.configuration,
    dependencies: replayDependencies,
  };
  const generated =
    collisionIndex === undefined
      ? (() => {
          const target = createReplayCampaignTarget(campaignInput, parsed.envelope.caseIdentity);
          return target.ok ? generateReplayTargetCase(target.value) : target;
        })()
      : (() => {
          const prepared = createReplayCampaignPlan({
            ...campaignInput,
            collisionIndex,
          });
          return prepared.ok
            ? generateCampaignCase(prepared.value, parsed.envelope.caseIdentity.ordinal)
            : prepared;
        })();
  if (!generated.ok) {
    const problem = generated.diagnostics[0];
    return invalid(
      problem?.path === "/caseIdentity" ? "replay.identity.mismatch" : "replay.schema.invalid",
      problem?.path ?? "/caseIdentity/ordinal",
      problem?.message ?? "Replay case could not be generated.",
    );
  }
  if (!isDeepStrictEqual(generated.value.identity, parsed.envelope.caseIdentity)) {
    return invalid(
      "replay.identity.mismatch",
      "/caseIdentity",
      "Regenerated case identity does not match the complete carried identity.",
    );
  }
  return Object.freeze({
    ok: true,
    case: generated.value,
    source: generated.value.sourceBytes,
  });
}
