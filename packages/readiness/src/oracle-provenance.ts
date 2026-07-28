import { isDeepStrictEqual } from "node:util";

import type { GeneratedCase } from "./campaign-model.js";
import type { ModeledGeneratorSuite } from "./modeled-generator-model.js";
import { validateGeneratedConstruction } from "./modeled-construction-templates.js";
import { isOracleRecord, oracleFailure, type OracleFailure } from "./oracle-input.js";
import type { Rd02ReplayProvenanceV1 } from "./oracle-model.js";
import { parseReplayEnvelope } from "./replay-input.js";
import { replayCase } from "./replay.js";
import { resolveReplayRevisions, type RevisionRegistry } from "./revision-registry.js";

/** Successful proof that a supplied case is exactly reproducible from its complete provenance. */
export interface OracleReplayValidationSuccess {
  /** Success discriminator. */
  readonly ok: true;
  /** Identity-verified immutable replay envelope. */
  readonly provenance: Rd02ReplayProvenanceV1;
  /** Exact regenerated campaign case. */
  readonly generatedCase: GeneratedCase;
}

/** Closed result of complete replay-provenance validation and regeneration. */
export type OracleReplayValidationResult = OracleReplayValidationSuccess | OracleFailure;

interface OracleReplayValidationInput {
  readonly sourceProvenance: unknown;
  readonly generatedCase: unknown;
  readonly registry: RevisionRegistry;
  readonly modeledSuite: ModeledGeneratorSuite;
  readonly inventoryVersion: string;
}

const encoder = new TextEncoder();

function replayBytes(value: unknown): Uint8Array | undefined {
  try {
    const encoded = JSON.stringify(value, (_key, member: unknown) =>
      typeof member === "bigint" ? member.toString(10) : member,
    );
    return encoded === undefined ? undefined : encoder.encode(encoded);
  } catch {
    return undefined;
  }
}

function campaignInventoryMatches(value: unknown, inventoryVersion: string): boolean {
  return (
    isOracleRecord(value) &&
    value.schemaVersion === 1 &&
    value.inventoryVersion === inventoryVersion
  );
}

function replayFailure(missing: string): OracleFailure {
  return oracleFailure(
    "oracle.authority.stale",
    "/sourceProvenance",
    `Replay dependency ${missing} is unavailable or stale.`,
  );
}

/**
 * Verifies complete provenance, resolves all replay revisions, and regenerates the exact case.
 *
 * @param input Snapshotted provenance and case plus suite-owned replay authority.
 * @returns Verified replay envelope and regenerated case, or a closed failure.
 *
 * @example
 * ```ts
 * const verified = validateOracleReplay({
 *   sourceProvenance,
 *   generatedCase,
 *   registry,
 *   modeledSuite,
 *   inventoryVersion,
 * });
 * ```
 */
export function validateOracleReplay(
  input: OracleReplayValidationInput,
): OracleReplayValidationResult {
  const bytes = replayBytes(input.sourceProvenance);
  if (bytes === undefined) {
    return oracleFailure(
      "oracle.input.invalid",
      "/sourceProvenance",
      "Replay provenance cannot be encoded canonically.",
    );
  }
  const parsed = parseReplayEnvelope(bytes);
  if (!parsed.ok) {
    const problem = parsed.diagnostics[0];
    return oracleFailure(
      problem?.code === "replay.input.limit" ? "oracle.input.limit" : "oracle.input.invalid",
      `/sourceProvenance${problem?.path ?? ""}`,
      problem?.message ?? "Replay provenance is invalid.",
    );
  }

  const revisions = resolveReplayRevisions(parsed.envelope, input.registry);
  if (!revisions.ok) return replayFailure(revisions.missing);
  if (!campaignInventoryMatches(revisions.resolved.inventory, input.inventoryVersion)) {
    return replayFailure("inventory");
  }
  if (revisions.resolved["rule-model"] !== input.modeledSuite) {
    return replayFailure("rule-model");
  }

  const replayed = replayCase({ envelopeBytes: bytes, registry: input.registry });
  if (!replayed.ok) {
    return replayed.kind === "replay-incompatible"
      ? replayFailure(replayed.missing)
      : oracleFailure(
          "oracle.input.invalid",
          `/sourceProvenance${replayed.diagnostics[0]?.path ?? ""}`,
          replayed.diagnostics[0]?.message ?? "Replay regeneration failed.",
        );
  }
  if (
    !validateGeneratedConstruction(input.generatedCase) ||
    !isDeepStrictEqual(replayed.case.modeledCase, input.generatedCase)
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      "/case",
      "Supplied case does not match the exact regenerated modeled case.",
    );
  }
  // The full modeled-case comparison includes the external parameter bindings and invalid
  // binding replacement, so neither can be substituted independently of replay identity.
  const generatedCase: GeneratedCase = replayed.case;
  return Object.freeze({
    ok: true,
    provenance: parsed.envelope,
    generatedCase,
  });
}
