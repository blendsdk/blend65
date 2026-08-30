import { isDeepStrictEqual } from "node:util";

import { copyUint8Array, isSha256Digest, uint8ArrayByteLength } from "./canonical-identity.js";
import { failureEnvelopeDigestV1 } from "./failure-envelope-codec.js";
import {
  deriveMalformedReplayDigestV1,
  isWellFormedMalformedDiagnosticTextV1,
  malformedUtf8BoundariesV1,
} from "./malformed-diagnostic-case.js";
import {
  isExecutionIdentifier,
  readExecutionArray,
  readExecutionRecord,
} from "./execution-validation.js";

import type {
  FailureEnvelopeInitialCandidateV1,
  FailureReplayAuthorityV1,
} from "./failure-envelope-model.js";

const RAW_CANDIDATE_KEYS = ["revision", "kind", "sourceBytes", "tokens"] as const;
const RAW_REPLAY_KEYS = ["kind", "envelope"] as const;
const MALFORMED_KEYS = [
  "revision",
  "sourceBytes",
  "encoding",
  "ruleId",
  "obligation",
  "diagnosticAuthorityDigest",
  "selectedReleaseDigest",
  "provenance",
  "textDigest",
  "digest",
] as const;
const PROVENANCE_KEYS = ["revision", "tokenizerRevision", "tokens"] as const;
const TOKEN_KEYS = ["kind", "startByte", "endByte"] as const;
const SOURCE_MAX_BYTES = 1_048_576;
const MAX_TOKENS = 4_096;
const TEXT_ENCODER = new TextEncoder();

function boundedSourceBytes(input: unknown): Uint8Array | undefined {
  const length = uint8ArrayByteLength(input);
  return length === undefined || length > SOURCE_MAX_BYTES
    ? undefined
    : copyUint8Array(input, length);
}

function normalizeRawReplay(input: unknown): FailureReplayAuthorityV1 | undefined {
  const replay = readExecutionRecord(input, RAW_REPLAY_KEYS);
  const envelope =
    replay?.kind === "raw-malformed"
      ? readExecutionRecord(replay.envelope, MALFORMED_KEYS)
      : undefined;
  if (
    envelope === undefined ||
    envelope.revision !== "malformed-replay-envelope-v1" ||
    envelope.encoding !== "utf-8" ||
    !isExecutionIdentifier(envelope.ruleId) ||
    typeof envelope.obligation !== "string" ||
    envelope.obligation.length === 0 ||
    !isWellFormedMalformedDiagnosticTextV1(envelope.obligation) ||
    TEXT_ENCODER.encode(envelope.obligation).byteLength > 512 ||
    !isSha256Digest(envelope.diagnosticAuthorityDigest) ||
    !isSha256Digest(envelope.selectedReleaseDigest) ||
    !isSha256Digest(envelope.textDigest) ||
    !isSha256Digest(envelope.digest)
  ) {
    return undefined;
  }
  const sourceBytes = boundedSourceBytes(envelope.sourceBytes);
  const provenance = readExecutionRecord(envelope.provenance, PROVENANCE_KEYS);
  const boundaries = sourceBytes === undefined ? undefined : malformedUtf8BoundariesV1(sourceBytes);
  const tokenValues =
    provenance === undefined ? undefined : readExecutionArray(provenance.tokens, MAX_TOKENS);
  if (
    sourceBytes === undefined ||
    boundaries === undefined ||
    provenance?.revision !== "malformed-token-text-provenance-v1" ||
    provenance.tokenizerRevision !== "utf8-byte-spans-v1" ||
    tokenValues === undefined ||
    (sourceBytes.byteLength === 0 && tokenValues.length !== 0) ||
    failureEnvelopeDigestV1(sourceBytes) !== envelope.textDigest
  ) {
    return undefined;
  }
  const tokens: {
    readonly kind: "token" | "trivia" | "unknown";
    readonly startByte: number;
    readonly endByte: number;
  }[] = [];
  let previousEnd = 0;
  for (const value of tokenValues) {
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
      token.endByte > sourceBytes.byteLength ||
      !boundaries.has(token.startByte) ||
      !boundaries.has(token.endByte)
    ) {
      return undefined;
    }
    tokens.push(
      Object.freeze({ kind: token.kind, startByte: token.startByte, endByte: token.endByte }),
    );
    previousEnd = token.endByte;
  }
  const normalizedProvenance = Object.freeze({
    revision: "malformed-token-text-provenance-v1" as const,
    tokenizerRevision: "utf8-byte-spans-v1" as const,
    tokens: Object.freeze(tokens),
  });
  if (
    deriveMalformedReplayDigestV1(
      sourceBytes,
      envelope.ruleId,
      envelope.obligation,
      envelope.selectedReleaseDigest,
      envelope.diagnosticAuthorityDigest,
      normalizedProvenance,
    ) !== envelope.digest
  ) {
    return undefined;
  }
  return Object.freeze({
    kind: "raw-malformed" as const,
    envelope: Object.freeze({
      revision: "malformed-replay-envelope-v1" as const,
      sourceBytes,
      encoding: "utf-8" as const,
      ruleId: envelope.ruleId,
      obligation: envelope.obligation,
      diagnosticAuthorityDigest: envelope.diagnosticAuthorityDigest,
      selectedReleaseDigest: envelope.selectedReleaseDigest,
      provenance: normalizedProvenance,
      textDigest: envelope.textDigest,
      digest: envelope.digest,
    }),
  });
}

/** Deeply closes the raw replay and candidate pair carried by a projection record. */
export function normalizeMalformedFailureProjectionV1(
  replayInput: unknown,
  candidateInput: unknown,
):
  | {
      readonly replay: FailureReplayAuthorityV1;
      readonly candidate: FailureEnvelopeInitialCandidateV1;
    }
  | undefined {
  const replay = normalizeRawReplay(replayInput);
  const candidate = readExecutionRecord(candidateInput, RAW_CANDIDATE_KEYS);
  if (
    replay?.kind !== "raw-malformed" ||
    candidate?.revision !== "reduction-candidate-draft-v1" ||
    candidate.kind !== "raw-malformed"
  ) {
    return undefined;
  }
  const sourceBytes = boundedSourceBytes(candidate.sourceBytes);
  if (
    sourceBytes === undefined ||
    !isDeepStrictEqual(sourceBytes, replay.envelope.sourceBytes) ||
    !isDeepStrictEqual(candidate.tokens, replay.envelope.provenance.tokens)
  ) {
    return undefined;
  }
  return Object.freeze({
    replay,
    candidate: Object.freeze({
      revision: "reduction-candidate-draft-v1" as const,
      kind: "raw-malformed" as const,
      sourceBytes,
      tokens: replay.envelope.provenance.tokens,
    }),
  });
}
