import { isDeepStrictEqual } from "node:util";

import { isSha256Digest } from "./canonical-identity.js";
import {
  encodeFailureEnvelopeCanonicalV1,
  failureEnvelopeDigestV1,
} from "./failure-envelope-codec.js";
import {
  compareExecutionText,
  isExecutionIdentifier,
  readExecutionArray,
  readExecutionRecord,
} from "./execution-validation.js";

import type { FailureEnvelopeV1, FailureToolIdentityV1 } from "./failure-envelope-model.js";
import type { ExecutionOperationIssueCodeV1 } from "./execution-contracts.js";
import type { Sha256Digest } from "./model-registry-model.js";

const ENVELOPE_KEYS = [
  "revision",
  "family",
  "replay",
  "routePlanBytes",
  "routePlanDigest",
  "predicate",
  "policy",
  "observationBytes",
  "toolVersions",
  "initialCandidate",
  "authorityDigests",
  "digest",
] as const;
const TOOL_KEYS = ["kind", "name", "version", "digest"] as const;
const MAX_AUTHORITY_RECORDS = 32;

/** Internal validation failure returned without retaining hostile input. */
export interface FailureEnvelopeHistoryIssueV1 {
  readonly ok: false;
  readonly code: ExecutionOperationIssueCodeV1;
  readonly path: string;
  readonly message: string;
}

/** Identity-checked envelope header safe to use for historical availability lookup. */
export interface FailureEnvelopeIdentityV1 {
  readonly decoded: Readonly<Record<string, unknown>>;
  readonly family: FailureEnvelopeV1["family"];
  readonly authorityDigests: readonly Sha256Digest[];
  readonly digest: Sha256Digest;
}

/** Success-or-issue result for historical envelope validation. */
export type FailureEnvelopeHistoryResultV1<T> =
  | { readonly ok: true; readonly value: T }
  | FailureEnvelopeHistoryIssueV1;

function failure<T>(
  code: ExecutionOperationIssueCodeV1,
  path: string,
  message: string,
): FailureEnvelopeHistoryResultV1<T> {
  return Object.freeze({ ok: false, code, path, message });
}

function success<T>(value: T): FailureEnvelopeHistoryResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function isStrictlySortedUnique(values: readonly string[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (previous === undefined || current === undefined || previous >= current) return false;
  }
  return true;
}

/**
 * Closes the envelope schema and digest before any authority-availability classification.
 *
 * @param decoded Canonical decoder output.
 * @param retained Exact serialized bytes.
 * @returns Identity-checked header or a deterministic issue.
 */
export function validateFailureEnvelopeIdentityV1(
  decoded: unknown,
  retained: Uint8Array,
): FailureEnvelopeHistoryResultV1<FailureEnvelopeIdentityV1> {
  const envelope = readExecutionRecord(decoded, ENVELOPE_KEYS);
  if (
    envelope === undefined ||
    envelope.revision !== "failure-envelope-v1" ||
    (envelope.family !== "typed-valid" &&
      envelope.family !== "typed-invalid" &&
      envelope.family !== "raw-malformed") ||
    !isSha256Digest(envelope.digest)
  ) {
    return failure(
      "execution.invalid-schema",
      "/envelope",
      "Serialized envelope has an invalid canonical schema.",
    );
  }
  let canonical: Uint8Array;
  let expectedDigest: Sha256Digest;
  try {
    canonical = encodeFailureEnvelopeCanonicalV1(decoded);
    const withoutDigest = { ...envelope };
    delete withoutDigest.digest;
    expectedDigest = failureEnvelopeDigestV1(encodeFailureEnvelopeCanonicalV1(withoutDigest));
  } catch {
    return failure(
      "execution.invalid-schema",
      "/envelope",
      "Serialized envelope exceeds the supported canonical structure.",
    );
  }
  if (!isDeepStrictEqual(canonical, retained)) {
    return failure(
      "execution.invalid-schema",
      "/envelope",
      "Serialized envelope is not the canonical encoding of its data.",
    );
  }
  if (expectedDigest !== envelope.digest) {
    return failure(
      "execution.identity",
      "/envelope/digest",
      "Envelope digest does not match canonical fields.",
    );
  }
  const digestValues = readExecutionArray(envelope.authorityDigests, MAX_AUTHORITY_RECORDS);
  if (
    digestValues === undefined ||
    digestValues.some((value) => !isSha256Digest(value)) ||
    !isStrictlySortedUnique(digestValues.filter(isSha256Digest))
  ) {
    return failure(
      "execution.invalid-schema",
      "/envelope/authorityDigests",
      "Historical authority digests must be a sorted unique exact set.",
    );
  }
  return success(
    Object.freeze({
      decoded: envelope,
      family: envelope.family,
      authorityDigests: Object.freeze(digestValues.filter(isSha256Digest)),
      digest: envelope.digest,
    }),
  );
}

/** Returns a deeply normalized, sorted and duplicate-free tool list. */
export function normalizeFailureEnvelopeToolsV1(
  input: unknown,
): readonly FailureToolIdentityV1[] | undefined {
  const values = readExecutionArray(input, 64);
  if (values === undefined) return undefined;
  const tools: FailureToolIdentityV1[] = [];
  const identities = new Set<string>();
  for (const value of values) {
    const tool = readExecutionRecord(value, TOOL_KEYS);
    if (
      tool === undefined ||
      (tool.kind !== "compiler" && tool.kind !== "assembler" && tool.kind !== "emulator") ||
      !isExecutionIdentifier(tool.name) ||
      !isExecutionIdentifier(tool.version) ||
      !isSha256Digest(tool.digest)
    ) {
      return undefined;
    }
    const identity = `${tool.kind}:${tool.name}:${tool.version}:${tool.digest}`;
    if (identities.has(identity)) return undefined;
    identities.add(identity);
    tools.push(
      Object.freeze({
        kind: tool.kind,
        name: tool.name,
        version: tool.version,
        digest: tool.digest,
      }),
    );
  }
  tools.sort((left, right) =>
    compareExecutionText(
      `${left.kind}:${left.name}:${left.version}:${left.digest}`,
      `${right.kind}:${right.name}:${right.version}:${right.digest}`,
    ),
  );
  return Object.freeze(tools);
}
