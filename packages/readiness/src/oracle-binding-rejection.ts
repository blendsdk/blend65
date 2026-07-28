import { Buffer } from "node:buffer";

import type { Sha256Digest } from "./model-registry-model.js";
import {
  hasExactOracleKeys,
  isOracleRecord,
  oracleFailure,
  parseOracleAuthorityJson,
  type OracleFailure,
} from "./oracle-input.js";
import {
  ORACLE_V1_LIMITS,
  type BindingRejectionCodeV1,
  type BindingRejectionManifestParseResult,
  type BindingRejectionManifestV1,
  type BindingRejectionRecordV1,
} from "./oracle-model.js";
import { isRuleModelId } from "./rule-model-registry.js";

interface BindingCandidateRecord {
  readonly ruleId: string;
  readonly neighborId: string;
  readonly spelling: string;
  readonly rejectionCode: BindingRejectionCodeV1;
}

interface BindingCandidateManifest {
  readonly schemaVersion: 1;
  readonly manifestVersion: "1.0.0";
  readonly policyRevision: "binding-rejection-policy-v1";
  readonly records: readonly BindingCandidateRecord[];
}

/** Structurally parsed binding authority used by the exact suite join. */
export type BindingRejectionCandidateParseResult =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Candidate whose spelling still requires reviewed-family comparison. */
      readonly manifest: BindingCandidateManifest;
      /** Digest of the exact supplied bytes. */
      readonly digest: Sha256Digest;
      /** Empty diagnostic tuple for success. */
      readonly diagnostics: readonly [];
    }
  | OracleFailure;

const MANIFEST_KEYS = ["schemaVersion", "manifestVersion", "policyRevision", "records"] as const;
const RECORD_KEYS = ["ruleId", "neighborId", "spelling", "rejectionCode"] as const;
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);

function boundedIdentifier(value: unknown): value is string {
  return (
    isRuleModelId(value) && Buffer.byteLength(value, "utf8") <= ORACLE_V1_LIMITS.identifierBytes
  );
}

function isRejectionCode(value: unknown): value is BindingRejectionCodeV1 {
  return value === "binding.value.type-invalid" || value === "binding.value.range-invalid";
}

function parseRecord(value: unknown, path: string): BindingCandidateRecord | OracleFailure {
  if (!isOracleRecord(value) || !hasExactOracleKeys(value, RECORD_KEYS)) {
    return oracleFailure(
      "oracle.input.invalid",
      path,
      "Binding rejection record must use the exact closed shape.",
    );
  }
  if (!boundedIdentifier(value.ruleId)) {
    return oracleFailure(
      "oracle.input.invalid",
      `${path}/ruleId`,
      "Binding rejection rule ID is not canonical.",
    );
  }
  if (!boundedIdentifier(value.neighborId)) {
    return oracleFailure(
      "oracle.input.invalid",
      `${path}/neighborId`,
      "Binding rejection neighbor ID is not canonical.",
    );
  }
  if (
    typeof value.spelling !== "string" ||
    Buffer.byteLength(value.spelling, "utf8") > ORACLE_V1_LIMITS.identifierBytes
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      `${path}/spelling`,
      "Binding rejection spelling is not canonical.",
    );
  }
  if (!isRejectionCode(value.rejectionCode)) {
    return oracleFailure(
      "oracle.input.invalid",
      `${path}/rejectionCode`,
      "Binding rejection code is not supported.",
    );
  }
  return Object.freeze({
    ruleId: value.ruleId,
    neighborId: value.neighborId,
    spelling: value.spelling,
    rejectionCode: value.rejectionCode,
  });
}

function compareRecordKeys(left: BindingCandidateRecord, right: BindingCandidateRecord) {
  return (
    left.ruleId.localeCompare(right.ruleId) ||
    left.neighborId.localeCompare(right.neighborId) ||
    left.spelling.localeCompare(right.spelling)
  );
}

/**
 * Parses binding authority structure while leaving exact family comparison to the suite.
 *
 * @param bytes Raw authority bytes.
 * @param memberPath Stable suite-member pointer prefix.
 * @returns Closed structural candidate or bounded input diagnostics.
 */
export function parseBindingRejectionCandidate(
  bytes: unknown,
  memberPath: string,
): BindingRejectionCandidateParseResult {
  const parsed = parseOracleAuthorityJson(bytes, memberPath);
  if (!parsed.ok) return parsed;
  const value = parsed.value;
  if (!isOracleRecord(value) || !hasExactOracleKeys(value, MANIFEST_KEYS)) {
    return oracleFailure(
      "oracle.input.invalid",
      memberPath,
      "Binding rejection manifest must use the exact closed shape.",
    );
  }
  if (value.schemaVersion !== 1) {
    return oracleFailure(
      "oracle.input.invalid",
      `${memberPath}/schemaVersion`,
      "Binding rejection schema version must be one.",
    );
  }
  if (value.manifestVersion !== "1.0.0") {
    return oracleFailure(
      "oracle.input.invalid",
      `${memberPath}/manifestVersion`,
      "Binding rejection manifest version is not supported.",
    );
  }
  if (value.policyRevision !== "binding-rejection-policy-v1") {
    return oracleFailure(
      "oracle.input.invalid",
      `${memberPath}/policyRevision`,
      "Binding rejection policy revision is not supported.",
    );
  }
  if (!Array.isArray(value.records)) {
    return oracleFailure(
      "oracle.input.invalid",
      `${memberPath}/records`,
      "Binding rejection records must be an array.",
    );
  }
  if (value.records.length > ORACLE_V1_LIMITS.authorityRecords) {
    return oracleFailure(
      "oracle.input.limit",
      `${memberPath}/records`,
      `Binding authority exceeds ${ORACLE_V1_LIMITS.authorityRecords} records.`,
    );
  }
  const records: BindingCandidateRecord[] = [];
  for (let index = 0; index < value.records.length; index += 1) {
    const record = parseRecord(value.records[index], `${memberPath}/records/${index}`);
    if (!("ruleId" in record)) return record;
    records.push(record);
  }
  return Object.freeze({
    ok: true,
    manifest: Object.freeze({
      schemaVersion: 1,
      manifestVersion: "1.0.0",
      policyRevision: "binding-rejection-policy-v1",
      records: Object.freeze(records),
    }),
    digest: parsed.digest,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Parses, validates, and deeply freezes canonical binding-rejection authority bytes.
 *
 * @param bytes Raw UTF-8 strict JSON bytes.
 * @returns Canonical manifest and exact digest, or bounded parser diagnostics.
 *
 * @example
 * ```ts
 * const result = parseBindingRejectionManifest(bytes);
 * ```
 */
export function parseBindingRejectionManifest(
  bytes: Uint8Array,
): BindingRejectionManifestParseResult {
  const candidate = parseBindingRejectionCandidate(bytes, "");
  if (!candidate.ok) return candidate;
  const records = candidate.manifest.records;
  for (let index = 0; index < records.length; index += 1) {
    const current = records[index];
    const previous = records[index - 1];
    if (current.spelling !== "parameter") {
      return oracleFailure(
        "oracle.input.invalid",
        `/records/${index}/spelling`,
        "Binding rejection spelling must be parameter.",
      );
    }
    if (previous !== undefined && compareRecordKeys(previous, current) >= 0) {
      return oracleFailure(
        "oracle.input.invalid",
        `/records/${index}`,
        "Binding rejection records must be unique and lexically ordered.",
      );
    }
  }
  const acceptedRecords: BindingRejectionRecordV1[] = records.map((record) =>
    Object.freeze({
      ruleId: record.ruleId,
      neighborId: record.neighborId,
      spelling: "parameter",
      rejectionCode: record.rejectionCode,
    }),
  );
  const manifest: BindingRejectionManifestV1 = Object.freeze({
    ...candidate.manifest,
    records: Object.freeze(acceptedRecords),
  });
  return Object.freeze({
    ok: true,
    manifest,
    digest: candidate.digest,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Converts one joined binding candidate into its public manifest type.
 *
 * @param manifest Structurally valid and semantically joined manifest.
 * @returns Public immutable manifest.
 */
export function acceptedBindingManifest(
  manifest: BindingCandidateManifest,
): BindingRejectionManifestV1 {
  const records: BindingRejectionRecordV1[] = manifest.records.map((record) =>
    Object.freeze({
      ruleId: record.ruleId,
      neighborId: record.neighborId,
      spelling: "parameter",
      rejectionCode: record.rejectionCode,
    }),
  );
  return Object.freeze({ ...manifest, records: Object.freeze(records) });
}
