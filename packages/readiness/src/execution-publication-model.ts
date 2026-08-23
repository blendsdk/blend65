import { createHash } from "node:crypto";

import type {
  ExecutionIssueV1,
  ExecutionOperationIssueCodeV1,
  ExecutionOperationResultV1,
} from "./execution-contracts.js";
import { compareExecutionText, isExecutionDigest } from "./execution-validation.js";
import type { PublicationResult } from "./publication-model.js";

/** Repository-relative root of the isolated execution-publication family. */
export const EXECUTION_PUBLICATIONS_ROOT = "readiness/execution-publications";
/** Filename of the selected execution-publication pointer. */
export const CURRENT_EXECUTION_PUBLICATION_FILENAME = "current-execution-publication.json";
/** Filename of the execution release manifest. */
export const EXECUTION_MANIFEST_V1_FILENAME = "execution-manifest-v1.json";
/** Filename of the fixed execution binding table. */
export const EXECUTION_BINDINGS_V1_FILENAME = "execution-bindings-v1.json";
/** Filename of the exact parent-publication reference. */
export const EXECUTION_PARENT_V1_FILENAME = "execution-parent-v1.json";
/** Filename of accepted execution semantic-review evidence. */
export const EXECUTION_SEMANTIC_REVIEW_V1_FILENAME = "execution-semantic-review-v1.json";
/** Wire discriminator for an execution release manifest. */
export const EXECUTION_PUBLICATION_V1_KIND = "execution-publication-v1";

/** Maximum bytes accepted for one child publication member. */
export const EXECUTION_PUBLICATION_MEMBER_LIMIT = 256 * 1024;
/** Maximum child releases inspected in one bounded operation. */
export const EXECUTION_PUBLICATION_RELEASE_LIMIT = 4_096;

/** Exact lexical member order committed by every execution manifest. */
export const EXECUTION_PUBLICATION_MEMBER_FILENAMES = Object.freeze([
  EXECUTION_BINDINGS_V1_FILENAME,
  EXECUTION_PARENT_V1_FILENAME,
  EXECUTION_SEMANTIC_REVIEW_V1_FILENAME,
] as const);

/** Exact lexical capability order committed by the passive binding document. */
export const EXECUTION_BINDING_CAPABILITY_IDS = Object.freeze([
  "acme",
  "cli",
  "compiler-api",
  "emit",
  "frontend",
  "vice",
] as const);

/** One exact passive execution binding. */
export interface ExecutionPublicationBindingV1 {
  readonly capabilityId: (typeof EXECUTION_BINDING_CAPABILITY_IDS)[number];
  readonly contractVersion: "1.0.0";
  readonly implementationRevision: string;
}

/** Canonical fixed six-row execution binding document. */
export interface ExecutionBindingsDocumentV1 {
  readonly schemaVersion: 1;
  readonly kind: "execution-bindings-v1";
  readonly bindings: readonly ExecutionPublicationBindingV1[];
}

/** Accepted evidence report named by one semantic review. */
export interface ExecutionAcceptedReportV1 {
  readonly digest: string;
  readonly outcome: "accepted";
}

/** Canonical semantic review for one exact child release. */
export interface ExecutionSemanticReviewV1 {
  readonly schemaVersion: 1;
  readonly kind: "execution-semantic-review-v1";
  readonly specRevision: string;
  readonly parentDigest: string;
  readonly bindingDigest: string;
  readonly ciSafe: ExecutionAcceptedReportV1;
  readonly coverage: ExecutionAcceptedReportV1;
  readonly localAcmeVice: ExecutionAcceptedReportV1;
  readonly unresolvedCritical: 0;
  readonly unresolvedMajor: 0;
  readonly reviewer: string;
  readonly outcome: "accepted";
}

/** Canonical reference to the immutable parent publication. */
export interface ExecutionParentReferenceV1 {
  readonly schemaVersion: 1;
  readonly kind: "execution-parent-publication-v1";
  readonly parentDigest: string;
}

/** One exact manifest member descriptor. */
export interface ExecutionPublicationManifestMemberV1 {
  readonly path: (typeof EXECUTION_PUBLICATION_MEMBER_FILENAMES)[number];
  readonly byteLength: number;
  readonly digest: string;
}

/** Canonical execution child manifest. */
export interface ExecutionPublicationManifestV1 {
  readonly schemaVersion: 1;
  readonly kind: "execution-publication-v1";
  readonly parentDigest: string;
  readonly members: readonly ExecutionPublicationManifestMemberV1[];
}

/** Canonical selected-child pointer. */
export interface ExecutionPublicationPointerV1 {
  readonly schemaVersion: 1;
  readonly kind: "execution-publication-pointer-v1";
  readonly publicationDigest: string;
}

/** Validated final bytes and reconstructed authority for one immutable child release. */
export interface ValidatedExecutionPublicationV1 {
  readonly digest: string;
  readonly parentDigest: string;
  readonly bindingDigest: string;
  readonly semanticReviewDigest: string;
  readonly semanticReviewSpecRevision: string;
  readonly bindings: readonly ExecutionPublicationBindingV1[];
  readonly manifestBytes: Uint8Array;
  readonly members: ReadonlyMap<string, Uint8Array>;
}

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder("utf-8", { fatal: true });
const BINDING_DOCUMENT_KEYS = ["schemaVersion", "kind", "bindings"] as const;
const BINDING_KEYS = ["capabilityId", "contractVersion", "implementationRevision"] as const;
const PARENT_KEYS = ["schemaVersion", "kind", "parentDigest"] as const;
const REPORT_KEYS = ["digest", "outcome"] as const;
const REVIEW_KEYS = [
  "schemaVersion",
  "kind",
  "specRevision",
  "parentDigest",
  "bindingDigest",
  "ciSafe",
  "coverage",
  "localAcmeVice",
  "unresolvedCritical",
  "unresolvedMajor",
  "reviewer",
  "outcome",
] as const;
const MEMBER_KEYS = ["path", "byteLength", "digest"] as const;
const MANIFEST_KEYS = ["schemaVersion", "kind", "parentDigest", "members"] as const;
const POINTER_KEYS = ["schemaVersion", "kind", "publicationDigest"] as const;

/** Creates a deeply immutable success result. */
export function executionPublicationSuccess<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

/** Creates one deterministic passive execution failure. */
export function executionPublicationFailure<T>(
  code: ExecutionOperationIssueCodeV1,
  path: string,
  message: string,
): ExecutionOperationResultV1<T> {
  const issue: ExecutionIssueV1 = Object.freeze({
    code,
    path,
    message: message.length <= 512 ? message : `${message.slice(0, 509)}...`,
  });
  const issues = Object.freeze([issue]) as readonly [ExecutionIssueV1];
  return Object.freeze({ ok: false, issues });
}

/** Converts a hardened publication-filesystem failure without leaking host details. */
export function executionFilesystemFailure<T>(
  result: Exclude<PublicationResult<unknown>, { readonly ok: true }>,
  path = "",
): ExecutionOperationResultV1<T> {
  const diagnostic = result.diagnostics[0];
  return executionPublicationFailure(
    "execution.io",
    path,
    diagnostic?.message ?? "Execution publication filesystem operation failed safely.",
  );
}

/** Computes a lowercase SHA-256 digest over exact bytes. */
export function digestExecutionPublicationBytes(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

/** Renders compact canonical JSON with exactly one trailing line feed. */
export function renderExecutionPublicationJson(value: unknown): Uint8Array {
  return ENCODER.encode(`${JSON.stringify(value)}\n`);
}

/** Computes the content-addressed child release digest from canonical manifest bytes. */
export function computeExecutionPublicationDigest(manifestBytes: Uint8Array): string {
  return `sha256:${createHash("sha256")
    .update(ENCODER.encode("blend65-execution-publication-v1\0"))
    .update(manifestBytes)
    .digest("hex")}`;
}

/** Creates canonical pointer bytes for one selected child digest. */
export function renderExecutionPublicationPointer(digest: string): Uint8Array {
  return renderExecutionPublicationJson({
    schemaVersion: 1,
    kind: "execution-publication-pointer-v1",
    publicationDigest: digest,
  });
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const actual = Reflect.ownKeys(value);
  if (
    actual.length !== keys.length ||
    actual.some((key) => typeof key !== "string" || !keys.includes(key))
  ) {
    return undefined;
  }
  return value as Readonly<Record<string, unknown>>;
}

function canonicalJsonValue(bytes: Uint8Array): unknown | undefined {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > EXECUTION_PUBLICATION_MEMBER_LIMIT) {
    return undefined;
  }
  try {
    const value: unknown = JSON.parse(DECODER.decode(bytes));
    const canonical = renderExecutionPublicationJson(value);
    if (
      canonical.byteLength !== bytes.byteLength ||
      canonical.some((byte, index) => byte !== bytes[index])
    ) {
      return undefined;
    }
    return value;
  } catch {
    return undefined;
  }
}

function parseAcceptedReport(
  input: unknown,
  path: string,
): ExecutionOperationResultV1<ExecutionAcceptedReportV1> {
  const record = exactRecord(input, REPORT_KEYS);
  if (record === undefined || !isExecutionDigest(record.digest) || record.outcome !== "accepted") {
    return executionPublicationFailure(
      "execution.invalid-schema",
      path,
      "Review evidence must name one accepted SHA-256 report.",
    );
  }
  return executionPublicationSuccess(
    Object.freeze({ digest: record.digest, outcome: "accepted" as const }),
  );
}

/** Parses and validates the exact six-row passive binding bytes. */
export function parseExecutionBindingsV1(
  bytes: Uint8Array,
): ExecutionOperationResultV1<ExecutionBindingsDocumentV1> {
  const record = exactRecord(canonicalJsonValue(bytes), BINDING_DOCUMENT_KEYS);
  if (
    record === undefined ||
    record.schemaVersion !== 1 ||
    record.kind !== "execution-bindings-v1" ||
    !Array.isArray(record.bindings) ||
    record.bindings.length !== EXECUTION_BINDING_CAPABILITY_IDS.length
  ) {
    return executionPublicationFailure(
      "execution.invalid-schema",
      "/bindings",
      "Execution bindings must be the exact canonical six-row document.",
    );
  }
  const rows: ExecutionPublicationBindingV1[] = [];
  for (let index = 0; index < record.bindings.length; index += 1) {
    const row = exactRecord(record.bindings[index], BINDING_KEYS);
    if (row === undefined) {
      return executionPublicationFailure(
        "execution.invalid-schema",
        `/bindings/${index}`,
        "Execution binding rows have an exact closed shape.",
      );
    }
    const expectedId = EXECUTION_BINDING_CAPABILITY_IDS[index];
    if (row.capabilityId !== expectedId) {
      const duplicate = rows.some((candidate) => candidate.capabilityId === row.capabilityId);
      return executionPublicationFailure(
        duplicate ? "execution.invalid-schema" : "execution.stale-authority",
        `/bindings/${index}${duplicate ? "" : "/capabilityId"}`,
        duplicate
          ? "Execution binding capability identifiers must be unique."
          : "Execution binding does not name the declared lexical capability.",
      );
    }
    if (row.contractVersion !== "1.0.0") {
      return executionPublicationFailure(
        "execution.stale-authority",
        `/bindings/${index}/contractVersion`,
        "Execution binding contract version is incompatible with the parent declaration.",
      );
    }
    if (!isExecutionDigest(row.implementationRevision)) {
      return executionPublicationFailure(
        "execution.invalid-schema",
        `/bindings/${index}/implementationRevision`,
        "Execution implementation revision must be a canonical SHA-256 digest.",
      );
    }
    rows.push(
      Object.freeze({
        capabilityId: expectedId,
        contractVersion: "1.0.0" as const,
        implementationRevision: row.implementationRevision,
      }),
    );
  }
  return executionPublicationSuccess(
    Object.freeze({
      schemaVersion: 1 as const,
      kind: "execution-bindings-v1" as const,
      bindings: Object.freeze(rows),
    }),
  );
}

/** Parses the exact immutable parent-reference member. */
export function parseExecutionParentReferenceV1(
  bytes: Uint8Array,
): ExecutionOperationResultV1<ExecutionParentReferenceV1> {
  const record = exactRecord(canonicalJsonValue(bytes), PARENT_KEYS);
  if (
    record === undefined ||
    record.schemaVersion !== 1 ||
    record.kind !== "execution-parent-publication-v1" ||
    !isExecutionDigest(record.parentDigest)
  ) {
    return executionPublicationFailure(
      "execution.invalid-schema",
      "",
      "Execution parent member must have the exact canonical version-one shape.",
    );
  }
  return executionPublicationSuccess(
    Object.freeze({
      schemaVersion: 1 as const,
      kind: "execution-parent-publication-v1" as const,
      parentDigest: record.parentDigest,
    }),
  );
}

/** Parses accepted review evidence and reconstructs its binding and parent joins. */
export function parseExecutionSemanticReviewV1(
  bytes: Uint8Array,
  expectedParentDigest: string,
  expectedBindingDigest: string,
): ExecutionOperationResultV1<ExecutionSemanticReviewV1> {
  const record = exactRecord(canonicalJsonValue(bytes), REVIEW_KEYS);
  if (
    record === undefined ||
    record.schemaVersion !== 1 ||
    record.kind !== "execution-semantic-review-v1" ||
    !isExecutionDigest(record.specRevision) ||
    !isExecutionDigest(record.parentDigest) ||
    !isExecutionDigest(record.bindingDigest) ||
    record.unresolvedCritical !== 0 ||
    record.unresolvedMajor !== 0 ||
    typeof record.reviewer !== "string" ||
    record.reviewer.length === 0 ||
    ENCODER.encode(record.reviewer).byteLength > 512 ||
    /[\u0000-\u001f\u007f]/u.test(record.reviewer) ||
    record.outcome !== "accepted"
  ) {
    return executionPublicationFailure(
      "execution.invalid-schema",
      "",
      "Execution semantic review must be exact, accepted, bounded, and issue-free.",
    );
  }
  if (record.parentDigest !== expectedParentDigest) {
    return executionPublicationFailure(
      "execution.stale-authority",
      "/parentDigest",
      "Execution semantic review names a different parent publication.",
    );
  }
  if (record.bindingDigest !== expectedBindingDigest) {
    return executionPublicationFailure(
      "execution.stale-authority",
      "/bindingDigest",
      "Execution semantic review does not reconstruct the binding bytes.",
    );
  }
  const ciSafe = parseAcceptedReport(record.ciSafe, "/ciSafe");
  if (!ciSafe.ok) return ciSafe;
  const coverage = parseAcceptedReport(record.coverage, "/coverage");
  if (!coverage.ok) return coverage;
  const localAcmeVice = parseAcceptedReport(record.localAcmeVice, "/localAcmeVice");
  if (!localAcmeVice.ok) return localAcmeVice;
  return executionPublicationSuccess(
    Object.freeze({
      schemaVersion: 1 as const,
      kind: "execution-semantic-review-v1" as const,
      specRevision: record.specRevision,
      parentDigest: record.parentDigest,
      bindingDigest: record.bindingDigest,
      ciSafe: ciSafe.value,
      coverage: coverage.value,
      localAcmeVice: localAcmeVice.value,
      unresolvedCritical: 0 as const,
      unresolvedMajor: 0 as const,
      reviewer: record.reviewer,
      outcome: "accepted" as const,
    }),
  );
}

/** Parses and reconstructs one exact execution release manifest. */
export function parseExecutionManifestV1(
  bytes: Uint8Array,
): ExecutionOperationResultV1<ExecutionPublicationManifestV1> {
  const record = exactRecord(canonicalJsonValue(bytes), MANIFEST_KEYS);
  if (
    record === undefined ||
    record.schemaVersion !== 1 ||
    record.kind !== EXECUTION_PUBLICATION_V1_KIND ||
    !isExecutionDigest(record.parentDigest) ||
    !Array.isArray(record.members) ||
    record.members.length !== EXECUTION_PUBLICATION_MEMBER_FILENAMES.length
  ) {
    return executionPublicationFailure(
      "execution.invalid-schema",
      "",
      "Execution manifest must have the exact canonical version-one shape.",
    );
  }
  const members: ExecutionPublicationManifestMemberV1[] = [];
  for (let index = 0; index < record.members.length; index += 1) {
    const member = exactRecord(record.members[index], MEMBER_KEYS);
    const expectedPath = EXECUTION_PUBLICATION_MEMBER_FILENAMES[index];
    if (
      member === undefined ||
      member.path !== expectedPath ||
      !Number.isSafeInteger(member.byteLength) ||
      typeof member.byteLength !== "number" ||
      member.byteLength <= 0 ||
      member.byteLength > EXECUTION_PUBLICATION_MEMBER_LIMIT ||
      !isExecutionDigest(member.digest)
    ) {
      return executionPublicationFailure(
        "execution.invalid-schema",
        `/members/${index}`,
        "Execution manifest members must be exact, lexical, bounded, and content-addressed.",
      );
    }
    members.push(
      Object.freeze({
        path: expectedPath,
        byteLength: member.byteLength,
        digest: member.digest,
      }),
    );
  }
  return executionPublicationSuccess(
    Object.freeze({
      schemaVersion: 1 as const,
      kind: EXECUTION_PUBLICATION_V1_KIND,
      parentDigest: record.parentDigest,
      members: Object.freeze(members),
    }),
  );
}

/** Parses the selected execution-publication pointer. */
export function parseExecutionPublicationPointerV1(
  bytes: Uint8Array,
): ExecutionOperationResultV1<ExecutionPublicationPointerV1> {
  const record = exactRecord(canonicalJsonValue(bytes), POINTER_KEYS);
  if (
    record === undefined ||
    record.schemaVersion !== 1 ||
    record.kind !== "execution-publication-pointer-v1" ||
    !isExecutionDigest(record.publicationDigest)
  ) {
    return executionPublicationFailure(
      "execution.invalid-schema",
      "",
      "Execution publication pointer must have the exact canonical version-one shape.",
    );
  }
  return executionPublicationSuccess(
    Object.freeze({
      schemaVersion: 1 as const,
      kind: "execution-publication-pointer-v1" as const,
      publicationDigest: record.publicationDigest,
    }),
  );
}

/** Builds canonical final release bytes after all passive joins validate. */
export function createExecutionPublicationV1(input: {
  readonly parentDigest: string;
  readonly bindingBytes: Uint8Array;
  readonly semanticReviewBytes: Uint8Array;
}): ExecutionOperationResultV1<ValidatedExecutionPublicationV1> {
  if (
    !isExecutionDigest(input.parentDigest) ||
    !(input.bindingBytes instanceof Uint8Array) ||
    !(input.semanticReviewBytes instanceof Uint8Array) ||
    input.bindingBytes.byteLength === 0 ||
    input.bindingBytes.byteLength > EXECUTION_PUBLICATION_MEMBER_LIMIT ||
    input.semanticReviewBytes.byteLength === 0 ||
    input.semanticReviewBytes.byteLength > EXECUTION_PUBLICATION_MEMBER_LIMIT
  ) {
    return executionPublicationFailure(
      "execution.invalid-schema",
      "",
      "Execution publication members and parent must be exact and bounded.",
    );
  }
  const bindingBytes = new Uint8Array(input.bindingBytes);
  const semanticReviewBytes = new Uint8Array(input.semanticReviewBytes);
  const bindings = parseExecutionBindingsV1(bindingBytes);
  if (!bindings.ok) return bindings;
  const bindingDigest = digestExecutionPublicationBytes(bindingBytes);
  const review = parseExecutionSemanticReviewV1(
    semanticReviewBytes,
    input.parentDigest,
    bindingDigest,
  );
  if (!review.ok) return review;
  const parentBytes = renderExecutionPublicationJson({
    schemaVersion: 1,
    kind: "execution-parent-publication-v1",
    parentDigest: input.parentDigest,
  });
  const members = new Map<string, Uint8Array>([
    [EXECUTION_BINDINGS_V1_FILENAME, bindingBytes],
    [EXECUTION_PARENT_V1_FILENAME, parentBytes],
    [EXECUTION_SEMANTIC_REVIEW_V1_FILENAME, semanticReviewBytes],
  ]);
  const descriptors = EXECUTION_PUBLICATION_MEMBER_FILENAMES.map((path) => {
    const bytes = members.get(path);
    if (bytes === undefined) throw new TypeError("Execution publication member is missing.");
    return {
      path,
      byteLength: bytes.byteLength,
      digest: digestExecutionPublicationBytes(bytes),
    };
  });
  const manifestBytes = renderExecutionPublicationJson({
    schemaVersion: 1,
    kind: EXECUTION_PUBLICATION_V1_KIND,
    parentDigest: input.parentDigest,
    members: descriptors,
  });
  return executionPublicationSuccess(
    Object.freeze({
      digest: computeExecutionPublicationDigest(manifestBytes),
      parentDigest: input.parentDigest,
      bindingDigest,
      semanticReviewDigest: digestExecutionPublicationBytes(semanticReviewBytes),
      semanticReviewSpecRevision: review.value.specRevision,
      bindings: bindings.value.bindings,
      manifestBytes,
      members,
    }),
  );
}

/** Compares exact byte arrays without invoking caller-defined iteration. */
export function equalExecutionPublicationBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

/** Returns a lexical copy without locale-sensitive ordering. */
export function sortExecutionPublicationText(values: readonly string[]): readonly string[] {
  return Object.freeze([...values].sort(compareExecutionText));
}
