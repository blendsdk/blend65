import { createHash } from "node:crypto";

import { copyUint8Array, uint8ArrayByteLength } from "./canonical-identity.js";
import { getPublishedOracleReductionAuthorityV1 } from "./published-oracle-context.js";
import {
  isExecutionIdentifier,
  readExecutionArray,
  readExecutionRecord,
} from "./execution-validation.js";
import { createUtf8ByteBoundaryIndex } from "./utf8-byte-boundaries.js";

import type {
  ExecutionIssueV1,
  ExecutionOperationIssueCodeV1,
  ExecutionOperationResultV1,
} from "./execution-contracts.js";
import type { Sha256Digest } from "./model-registry-model.js";
import type { PublishedOracleContext } from "./oracle-model.js";

/** Maximum exact source bytes accepted by malformed diagnostic ingress. */
export const MALFORMED_DIAGNOSTIC_SOURCE_MAX_BYTES_V1 = 1_048_576;

/** Maximum token spans retained as bounded malformed-source provenance. */
export const MALFORMED_DIAGNOSTIC_TOKEN_MAX_COUNT_V1 = 4_096;

/** One byte-addressed token, trivia, or unclassified span. */
export interface MalformedTokenSpanV1 {
  /** Closed span category. */
  readonly kind: "token" | "trivia" | "unknown";
  /** Inclusive UTF-8 byte offset. */
  readonly startByte: number;
  /** Exclusive UTF-8 byte offset. */
  readonly endByte: number;
}

/** Canonical bounded token provenance retained without duplicating source text. */
export interface MalformedTokenTextProvenanceV1 {
  /** Closed provenance schema. */
  readonly revision: "malformed-token-text-provenance-v1";
  /** Token offsets are measured over exact UTF-8 bytes. */
  readonly tokenizerRevision: "utf8-byte-spans-v1";
  /** Sorted, non-overlapping, non-empty source spans. */
  readonly tokens: readonly MalformedTokenSpanV1[];
}

/** Versioned malformed diagnostic constructor input. */
export interface CreateMalformedDiagnosticCaseInputV1 {
  /** Closed input schema. */
  readonly revision: "malformed-diagnostic-case-input-v1";
  /** Exact unnormalized source. */
  readonly sourceBytes: Uint8Array;
  /** Only strict UTF-8 is supported. */
  readonly encoding: "utf-8";
  /** Reviewed primary rule. */
  readonly ruleId: string;
  /** Bounded diagnostic obligation. */
  readonly obligation: string;
  /** Canonical byte-addressed token provenance. */
  readonly provenance: MalformedTokenTextProvenanceV1;
}

/** Replay-complete passive malformed-source envelope. */
export interface MalformedReplayEnvelopeV1 {
  /** Closed replay schema. */
  readonly revision: "malformed-replay-envelope-v1";
  /** Fresh copy of exact source bytes. */
  readonly sourceBytes: Uint8Array;
  /** Exact validated encoding. */
  readonly encoding: "utf-8";
  /** Reviewed primary rule. */
  readonly ruleId: string;
  /** Diagnostic evidence obligation. */
  readonly obligation: string;
  /** Selected diagnostic publication authority. */
  readonly diagnosticAuthorityDigest: Sha256Digest;
  /** Selected publication retaining the diagnostic contract. */
  readonly selectedReleaseDigest: Sha256Digest;
  /** Canonical token provenance. */
  readonly provenance: MalformedTokenTextProvenanceV1;
  /** Digest of exact source bytes. */
  readonly textDigest: Sha256Digest;
  /** Digest of the complete malformed replay identity. */
  readonly digest: Sha256Digest;
}

/** Runtime brand for separately authenticated malformed diagnostic source. */
export const MALFORMED_DIAGNOSTIC_CASE_V1: unique symbol = Symbol("malformed-diagnostic-case-v1");

/** Opaque authority proving malformed bytes are bound to selected diagnostic truth. */
export interface MalformedDiagnosticCaseV1 {
  /** Compile-time marker paired with module-private runtime state. */
  readonly [MALFORMED_DIAGNOSTIC_CASE_V1]: true;
}

interface MalformedDiagnosticCaseState {
  readonly replay: Omit<MalformedReplayEnvelopeV1, "sourceBytes">;
  readonly sourceBytes: Uint8Array;
}

const INPUT_KEYS = [
  "revision",
  "sourceBytes",
  "encoding",
  "ruleId",
  "obligation",
  "provenance",
] as const;
const PROVENANCE_KEYS = ["revision", "tokenizerRevision", "tokens"] as const;
const TOKEN_KEYS = ["kind", "startByte", "endByte"] as const;
const TEXT_ENCODER = new TextEncoder();
const MAX_OBLIGATION_BYTES = 512;
const STATES = new WeakMap<object, MalformedDiagnosticCaseState>();

/** Returns whether text contains no unmatched UTF-16 surrogate code units. */
export function isWellFormedMalformedDiagnosticTextV1(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const trailing = value.charCodeAt(index + 1);
      if (trailing < 0xdc00 || trailing > 0xdfff) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function digest(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function issue<T>(
  code: ExecutionOperationIssueCodeV1,
  path: string,
  message: string,
): ExecutionOperationResultV1<T> {
  const issues: readonly [ExecutionIssueV1] = [Object.freeze({ code, path, message })];
  return Object.freeze({ ok: false, issues });
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

/** Returns every legal UTF-8 byte boundary without trusting caller tokenization. */
export function malformedUtf8BoundariesV1(bytes: Uint8Array): ReadonlySet<number> | undefined {
  return createUtf8ByteBoundaryIndex(bytes);
}

function normalizeTokens(
  input: unknown,
  sourceLength: number,
  boundaries: ReadonlySet<number>,
): readonly MalformedTokenSpanV1[] | undefined {
  const values = readExecutionArray(input, MALFORMED_DIAGNOSTIC_TOKEN_MAX_COUNT_V1);
  if (values === undefined || (sourceLength === 0 && values.length !== 0)) return undefined;
  const tokens: MalformedTokenSpanV1[] = [];
  let previousEnd = 0;
  for (const value of values) {
    const token = readExecutionRecord(value, TOKEN_KEYS);
    if (
      token === undefined ||
      (token.kind !== "token" && token.kind !== "trivia" && token.kind !== "unknown") ||
      typeof token.startByte !== "number" ||
      !Number.isSafeInteger(token.startByte) ||
      typeof token.endByte !== "number" ||
      !Number.isSafeInteger(token.endByte) ||
      token.startByte < previousEnd ||
      token.startByte < 0 ||
      token.endByte <= token.startByte ||
      token.endByte > sourceLength ||
      !boundaries.has(token.startByte) ||
      !boundaries.has(token.endByte)
    ) {
      return undefined;
    }
    tokens.push(
      Object.freeze({
        kind: token.kind,
        startByte: token.startByte,
        endByte: token.endByte,
      }),
    );
    previousEnd = token.endByte;
  }
  return Object.freeze(tokens);
}

/** Derives a collision-resistant identity for a validated malformed replay envelope. */
export function deriveMalformedReplayDigestV1(
  sourceBytes: Uint8Array,
  ruleId: string,
  obligation: string,
  selectedReleaseDigest: Sha256Digest,
  diagnosticAuthorityDigest: Sha256Digest,
  provenance: MalformedTokenTextProvenanceV1,
): Sha256Digest {
  if (
    !isWellFormedMalformedDiagnosticTextV1(ruleId) ||
    !isWellFormedMalformedDiagnosticTextV1(obligation)
  ) {
    throw new TypeError("Malformed replay identity text must be well-formed Unicode.");
  }
  const hash = createHash("sha256");
  const updateField = (tag: string, value: Uint8Array | string): void => {
    const bytes = typeof value === "string" ? TEXT_ENCODER.encode(value) : value;
    const length = Uint8Array.of(
      Math.floor(bytes.byteLength / 0x100_0000),
      Math.floor(bytes.byteLength / 0x1_0000) & 0xff,
      Math.floor(bytes.byteLength / 0x100) & 0xff,
      bytes.byteLength & 0xff,
    );
    hash.update(TEXT_ENCODER.encode(tag));
    hash.update(length);
    hash.update(bytes);
  };
  updateField("domain", "malformed-replay-envelope-v1");
  updateField("source", sourceBytes);
  updateField("rule", ruleId);
  updateField("obligation", obligation);
  updateField("release", selectedReleaseDigest);
  updateField("diagnostic", diagnosticAuthorityDigest);
  updateField("provenance", JSON.stringify(provenance));
  return `sha256:${hash.digest("hex")}`;
}

/**
 * Binds exact malformed source to one genuine selected diagnostic publication.
 *
 * @param oracle Genuine published oracle context.
 * @param input Hostile malformed-source input.
 * @returns Opaque authority or one deterministic validation issue.
 *
 * @example
 * ```ts
 * const result = createMalformedDiagnosticCaseV1(context, {
 *   revision: "malformed-diagnostic-case-input-v1",
 *   sourceBytes: new Uint8Array(),
 *   encoding: "utf-8",
 *   ruleId: "diagnostic.empty-source",
 *   obligation: "reject empty input",
 *   provenance: {
 *     revision: "malformed-token-text-provenance-v1",
 *     tokenizerRevision: "utf8-byte-spans-v1",
 *     tokens: [],
 *   },
 * });
 * ```
 */
export function createMalformedDiagnosticCaseV1(
  oracle: PublishedOracleContext,
  input: unknown,
): ExecutionOperationResultV1<MalformedDiagnosticCaseV1> {
  const authority = getPublishedOracleReductionAuthorityV1(oracle);
  if (authority === undefined) {
    return issue("unbound-capability", "/malformedCase/oracle", "Published oracle is not genuine.");
  }
  const record = readExecutionRecord(input, INPUT_KEYS);
  if (record === undefined) {
    return issue(
      "execution.invalid-schema",
      "/malformedCase",
      "Malformed diagnostic input must use the exact version-one shape.",
    );
  }
  const sourceByteLength = uint8ArrayByteLength(record.sourceBytes);
  const sourceBytes =
    sourceByteLength !== undefined && sourceByteLength <= MALFORMED_DIAGNOSTIC_SOURCE_MAX_BYTES_V1
      ? copyUint8Array(record.sourceBytes)
      : undefined;
  const provenanceRecord = readExecutionRecord(record.provenance, PROVENANCE_KEYS);
  if (
    record.revision !== "malformed-diagnostic-case-input-v1" ||
    record.encoding !== "utf-8" ||
    sourceBytes === undefined ||
    !isExecutionIdentifier(record.ruleId) ||
    typeof record.obligation !== "string" ||
    record.obligation.length === 0 ||
    !isWellFormedMalformedDiagnosticTextV1(record.obligation) ||
    TEXT_ENCODER.encode(record.obligation).byteLength > MAX_OBLIGATION_BYTES ||
    provenanceRecord === undefined ||
    provenanceRecord.revision !== "malformed-token-text-provenance-v1" ||
    provenanceRecord.tokenizerRevision !== "utf8-byte-spans-v1"
  ) {
    return issue(
      "execution.invalid-schema",
      "/malformedCase",
      "Malformed diagnostic input contains an invalid closed field.",
    );
  }
  const boundaries = malformedUtf8BoundariesV1(sourceBytes);
  if (boundaries === undefined) {
    return issue(
      "invalid-evidence-input",
      "/malformedCase/sourceBytes",
      "Malformed diagnostic source must be complete strict UTF-8.",
    );
  }
  const tokens = normalizeTokens(provenanceRecord.tokens, sourceBytes.byteLength, boundaries);
  if (tokens === undefined) {
    return issue(
      "invalid-evidence-input",
      "/malformedCase/provenance/tokens",
      "Malformed token spans must be ordered UTF-8 byte ranges.",
    );
  }
  const provenance = Object.freeze({
    revision: "malformed-token-text-provenance-v1" as const,
    tokenizerRevision: "utf8-byte-spans-v1" as const,
    tokens,
  });
  const textDigest = digest(sourceBytes);
  const replay = Object.freeze({
    revision: "malformed-replay-envelope-v1" as const,
    encoding: "utf-8" as const,
    ruleId: record.ruleId,
    obligation: record.obligation,
    diagnosticAuthorityDigest: authority.diagnosticAuthorityDigest,
    selectedReleaseDigest: authority.selectedReleaseDigest,
    provenance,
    textDigest,
    digest: deriveMalformedReplayDigestV1(
      sourceBytes,
      record.ruleId,
      record.obligation,
      authority.selectedReleaseDigest,
      authority.diagnosticAuthorityDigest,
      provenance,
    ),
  });
  const capability: MalformedDiagnosticCaseV1 = Object.freeze({
    [MALFORMED_DIAGNOSTIC_CASE_V1]: true as const,
  });
  STATES.set(capability, Object.freeze({ replay, sourceBytes }));
  return success(capability);
}

/**
 * Returns a defensive replay projection for genuine malformed authority.
 *
 * @param authority Candidate opaque authority.
 * @returns Exact replay data or an unbound-capability issue.
 */
export function getMalformedDiagnosticCaseProjectionV1(
  authority: MalformedDiagnosticCaseV1,
): ExecutionOperationResultV1<MalformedReplayEnvelopeV1> {
  const state =
    typeof authority === "object" && authority !== null ? STATES.get(authority) : undefined;
  if (state === undefined) {
    return issue(
      "unbound-capability",
      "/malformedCase",
      "Malformed diagnostic authority is not genuine.",
    );
  }
  return success(Object.freeze({ ...state.replay, sourceBytes: state.sourceBytes.slice() }));
}
