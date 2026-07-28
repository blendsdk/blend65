import { Buffer } from "node:buffer";

import { isSha256Digest } from "./canonical-identity.js";
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
  type DiagnosticContextV1,
  type DiagnosticOracleManifestParseResult,
  type DiagnosticOracleManifestV1,
  type DiagnosticOraclePhaseV1,
  type DiagnosticOracleRecordV1,
} from "./oracle-model.js";
import { isRuleModelId } from "./rule-model-registry.js";

interface DiagnosticCandidateRecord {
  readonly ruleId: string;
  readonly neighborId: string;
  readonly diagnosticContext?: string;
  readonly diagnosticCode: string;
  readonly phase: DiagnosticOraclePhaseV1;
  readonly severity: "error";
  readonly observableFields: readonly ["code", "phase", "severity"];
}

interface DiagnosticCandidateManifest {
  readonly schemaVersion: 1;
  readonly manifestVersion: "1.0.0";
  readonly specRevision: Sha256Digest;
  readonly policyRevision: "diagnostic-oracle-policy-v1";
  readonly records: readonly DiagnosticCandidateRecord[];
}

/** Structurally parsed diagnostic authority used by the exact suite join. */
export type DiagnosticOracleCandidateParseResult =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Closed candidate whose semantic fields still require exact joining. */
      readonly manifest: DiagnosticCandidateManifest;
      /** Digest of the exact supplied bytes. */
      readonly digest: Sha256Digest;
      /** Empty diagnostic tuple for success. */
      readonly diagnostics: readonly [];
    }
  | OracleFailure;

const MANIFEST_KEYS = [
  "schemaVersion",
  "manifestVersion",
  "specRevision",
  "policyRevision",
  "records",
] as const;
const BASE_RECORD_KEYS = [
  "ruleId",
  "neighborId",
  "diagnosticCode",
  "phase",
  "severity",
  "observableFields",
] as const;
const QUALIFIED_RECORD_KEYS = [
  "ruleId",
  "neighborId",
  "diagnosticContext",
  "diagnosticCode",
  "phase",
  "severity",
  "observableFields",
] as const;
const OBSERVABLE_FIELDS = ["code", "phase", "severity"] as const;
const DIAGNOSTIC_CODE_PATTERN = /^[A-Z][0-9]{5}$/u;
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);

function boundedIdentifier(value: unknown): value is string {
  return (
    isRuleModelId(value) && Buffer.byteLength(value, "utf8") <= ORACLE_V1_LIMITS.identifierBytes
  );
}

function isDiagnosticContext(value: unknown): value is DiagnosticContextV1 {
  return (
    value === "initializer" ||
    value === "assignment" ||
    value === "return-expression" ||
    value === "intrinsic-argument"
  );
}

function parseRecord(value: unknown, path: string): DiagnosticCandidateRecord | OracleFailure {
  if (!isOracleRecord(value)) {
    return oracleFailure(
      "oracle.input.invalid",
      path,
      "Diagnostic record must use the exact closed shape.",
    );
  }
  const qualified = Object.hasOwn(value, "diagnosticContext");
  if (!hasExactOracleKeys(value, qualified ? QUALIFIED_RECORD_KEYS : BASE_RECORD_KEYS)) {
    return oracleFailure(
      "oracle.input.invalid",
      path,
      "Diagnostic record must use the exact closed shape.",
    );
  }
  if (!boundedIdentifier(value.ruleId)) {
    return oracleFailure(
      "oracle.input.invalid",
      `${path}/ruleId`,
      "Diagnostic rule ID is not canonical.",
    );
  }
  if (!boundedIdentifier(value.neighborId)) {
    return oracleFailure(
      "oracle.input.invalid",
      `${path}/neighborId`,
      "Diagnostic neighbor ID is not canonical.",
    );
  }
  let diagnosticContext: string | undefined;
  if (qualified) {
    if (!boundedIdentifier(value.diagnosticContext)) {
      return oracleFailure(
        "oracle.input.invalid",
        `${path}/diagnosticContext`,
        "Diagnostic context is not canonical.",
      );
    }
    diagnosticContext = value.diagnosticContext;
  }
  if (
    typeof value.diagnosticCode !== "string" ||
    !DIAGNOSTIC_CODE_PATTERN.test(value.diagnosticCode)
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      `${path}/diagnosticCode`,
      "Diagnostic code is not canonical.",
    );
  }
  if (value.phase !== "lexer" && value.phase !== "parser" && value.phase !== "semantic") {
    return oracleFailure(
      "oracle.input.invalid",
      `${path}/phase`,
      "Diagnostic phase is not supported.",
    );
  }
  if (value.severity !== "error") {
    return oracleFailure(
      "oracle.input.invalid",
      `${path}/severity`,
      "Diagnostic severity must be error.",
    );
  }
  if (
    !Array.isArray(value.observableFields) ||
    value.observableFields.length !== OBSERVABLE_FIELDS.length ||
    !value.observableFields.every((field, index) => field === OBSERVABLE_FIELDS[index])
  ) {
    return oracleFailure(
      "oracle.input.invalid",
      `${path}/observableFields`,
      "Diagnostic observable fields must use the exact canonical tuple.",
    );
  }
  return Object.freeze({
    ruleId: value.ruleId,
    neighborId: value.neighborId,
    ...(diagnosticContext === undefined ? {} : { diagnosticContext }),
    diagnosticCode: value.diagnosticCode,
    phase: value.phase,
    severity: value.severity,
    observableFields: Object.freeze(["code", "phase", "severity"] as const),
  });
}

function compareRecordKeys(left: DiagnosticCandidateRecord, right: DiagnosticCandidateRecord) {
  return (
    left.ruleId.localeCompare(right.ruleId) ||
    left.neighborId.localeCompare(right.neighborId) ||
    (left.diagnosticContext ?? "").localeCompare(right.diagnosticContext ?? "")
  );
}

function publicRecord(record: DiagnosticCandidateRecord): DiagnosticOracleRecordV1 {
  const common = {
    ruleId: record.ruleId,
    neighborId: record.neighborId,
    diagnosticCode: record.diagnosticCode,
    phase: record.phase,
    severity: record.severity,
    observableFields: record.observableFields,
  };
  if (record.diagnosticContext === undefined) return Object.freeze(common);
  if (!isDiagnosticContext(record.diagnosticContext)) {
    throw new TypeError("Diagnostic context was not accepted.");
  }
  return Object.freeze({ ...common, diagnosticContext: record.diagnosticContext });
}

/**
 * Parses diagnostic authority structure while leaving reviewed-family comparison to the suite.
 *
 * This separation lets suite construction distinguish structurally malformed JSON from a
 * well-formed but unaccepted authority population.
 *
 * @param bytes Raw authority bytes.
 * @param memberPath Stable suite-member pointer prefix.
 * @returns Closed structural candidate or bounded input diagnostics.
 */
export function parseDiagnosticOracleCandidate(
  bytes: unknown,
  memberPath: string,
): DiagnosticOracleCandidateParseResult {
  const parsed = parseOracleAuthorityJson(bytes, memberPath);
  if (!parsed.ok) return parsed;
  const value = parsed.value;
  if (!isOracleRecord(value) || !hasExactOracleKeys(value, MANIFEST_KEYS)) {
    return oracleFailure(
      "oracle.input.invalid",
      memberPath,
      "Diagnostic manifest must use the exact closed shape.",
    );
  }
  if (value.schemaVersion !== 1) {
    return oracleFailure(
      "oracle.input.invalid",
      `${memberPath}/schemaVersion`,
      "Diagnostic manifest schema version must be one.",
    );
  }
  if (value.manifestVersion !== "1.0.0") {
    return oracleFailure(
      "oracle.input.invalid",
      `${memberPath}/manifestVersion`,
      "Diagnostic manifest version is not supported.",
    );
  }
  if (!isSha256Digest(value.specRevision)) {
    return oracleFailure(
      "oracle.input.invalid",
      `${memberPath}/specRevision`,
      "Diagnostic specification revision is not canonical.",
    );
  }
  if (value.policyRevision !== "diagnostic-oracle-policy-v1") {
    return oracleFailure(
      "oracle.input.invalid",
      `${memberPath}/policyRevision`,
      "Diagnostic policy revision is not supported.",
    );
  }
  if (!Array.isArray(value.records)) {
    return oracleFailure(
      "oracle.input.invalid",
      `${memberPath}/records`,
      "Diagnostic records must be an array.",
    );
  }
  if (value.records.length > ORACLE_V1_LIMITS.authorityRecords) {
    return oracleFailure(
      "oracle.input.limit",
      `${memberPath}/records`,
      `Diagnostic authority exceeds ${ORACLE_V1_LIMITS.authorityRecords} records.`,
    );
  }
  const records: DiagnosticCandidateRecord[] = [];
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
      specRevision: value.specRevision,
      policyRevision: "diagnostic-oracle-policy-v1",
      records: Object.freeze(records),
    }),
    digest: parsed.digest,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Parses, validates, and deeply freezes one canonical diagnostic authority manifest.
 *
 * @param bytes Raw UTF-8 strict JSON bytes.
 * @returns Canonical manifest and exact digest, or bounded parser diagnostics.
 *
 * @example
 * ```ts
 * const result = parseDiagnosticOracleManifest(bytes);
 * ```
 */
export function parseDiagnosticOracleManifest(
  bytes: Uint8Array,
): DiagnosticOracleManifestParseResult {
  const candidate = parseDiagnosticOracleCandidate(bytes, "");
  if (!candidate.ok) return candidate;
  const records = candidate.manifest.records;
  const pairKinds = new Map<string, "generic" | "qualified">();
  const acceptedRecords: DiagnosticOracleRecordV1[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const current = records[index];
    const previous = records[index - 1];
    if (previous !== undefined && compareRecordKeys(previous, current) >= 0) {
      return oracleFailure(
        "oracle.input.invalid",
        `/records/${index}`,
        "Diagnostic records must be unique and lexically ordered.",
      );
    }
    if (
      current.diagnosticContext !== undefined &&
      !isDiagnosticContext(current.diagnosticContext)
    ) {
      return oracleFailure(
        "oracle.input.invalid",
        `/records/${index}/diagnosticContext`,
        "Diagnostic context is not supported.",
      );
    }
    const pair = `${current.ruleId}\u0000${current.neighborId}`;
    const kind = current.diagnosticContext === undefined ? "generic" : "qualified";
    const previousKind = pairKinds.get(pair);
    if (previousKind !== undefined && previousKind !== kind) {
      return oracleFailure(
        "oracle.input.invalid",
        `/records/${index}/diagnosticContext`,
        "Generic and context-qualified records cannot coexist for one diagnostic pair.",
      );
    }
    pairKinds.set(pair, kind);
    acceptedRecords.push(publicRecord(current));
  }
  const manifest: DiagnosticOracleManifestV1 = Object.freeze({
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
 * Converts one joined diagnostic candidate into its public manifest type.
 *
 * The suite calls this only after every record field agrees with reviewed authority.
 *
 * @param manifest Structurally valid and semantically joined manifest.
 * @returns Public immutable manifest.
 */
export function acceptedDiagnosticManifest(
  manifest: DiagnosticCandidateManifest,
): DiagnosticOracleManifestV1 {
  return Object.freeze({
    ...manifest,
    records: Object.freeze(manifest.records.map(publicRecord)),
  });
}
