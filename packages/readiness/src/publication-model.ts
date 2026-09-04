import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import { printParseErrorCode, visit, type JSONPath } from "jsonc-parser";

import { isSha256Digest } from "./canonical-identity.js";
import type { PublishedSnapshot } from "./binding-model.js";
import type { HandlerKind, InventoryV1 } from "./model.js";
import type { Sha256Digest } from "./model-registry-model.js";
import type {
  PublicationDiagnostic,
  PublicationResult,
} from "./rule-family-publication-diagnostics.js";

export type {
  PublicationDiagnostic,
  PublicationResult,
} from "./rule-family-publication-diagnostics.js";

const PREPARED_PUBLICATION_REVIEW_BRAND: unique symbol = Symbol("prepared-publication-review");

/** Read-only capability returned with one independently reviewable publication request. */
export interface PreparedPublicationReview {
  /** Compile-time marker paired with module-private preparation authority. */
  readonly [PREPARED_PUBLICATION_REVIEW_BRAND]: true;
}

/** One staged semantic unit included in the publication review request. */
export interface PublicationReviewUnitV1 {
  /** Stable semantic review unit identifier. */
  readonly unitId: string;
  /** Digest of the staged semantic unit. */
  readonly semanticDigest: Sha256Digest;
  /** Exact lexical dependency-digest map for the unit. */
  readonly dependencyDigests: Readonly<Record<string, Sha256Digest>>;
}

/** Closed, digest-bound request supplied to an independent semantic reviewer. */
export interface PublicationReviewRequestV1 {
  /** Wire schema version. */
  readonly schemaVersion: 1;
  /** Digest covering the binding-promotion semantic change. */
  readonly semanticDigest: Sha256Digest;
  /** Frozen specification revision used by every review unit. */
  readonly specRevision: string;
  /** Exact top-level semantic dependencies. */
  readonly dependencyDigests: {
    readonly bindings: Sha256Digest;
    readonly inventory: Sha256Digest;
    readonly "rule-model": Sha256Digest;
    readonly "rule-model-review": Sha256Digest;
  };
  /** Lexically ordered unique handler identities promoted by this request. */
  readonly promotedHandlerIds: readonly string[];
  /** Lexically ordered staged inventory and binding review units. */
  readonly reviewUnits: readonly PublicationReviewUnitV1[];
}

/** Input accepted by the read-only publication-review preparation operation. */
export interface PrepareBindingPublicationReviewInput {
  /** Existing canonical absolute repository root. */
  readonly repositoryRoot: string;
}

/** Successful output of publication-review preparation. */
export interface PreparedBindingPublicationReview {
  /** Non-forgeable preparation capability. */
  readonly review: PreparedPublicationReview;
  /** Closed semantic review request. */
  readonly request: PublicationReviewRequestV1;
  /** Exact canonical LF-terminated request bytes. */
  readonly requestBytes: Uint8Array;
}

/** Input accepted by the indivisible publication transaction. */
export interface PublishBindingTransactionInput extends PrepareBindingPublicationReviewInput {
  /** Independently authored accepted semantic-review evidence. */
  readonly semanticReviewBytes: Uint8Array;
}

/** Successful output of the indivisible publication transaction. */
export interface PublishedBindingTransaction {
  /** Digest selecting the complete immutable release. */
  readonly publicationDigest: Sha256Digest;
  /** Opaque, fully verified selected publication. */
  readonly snapshot: PublishedSnapshot;
  /** Whether byte-identical immutable release content already existed. */
  readonly reusedExistingRelease: boolean;
}

/** Input accepted by the selected-publication resolver. */
export type ResolvePublishedSnapshotInput = PrepareBindingPublicationReviewInput;

/** Public immutable metadata available only through a genuine snapshot. */
export interface PublishedMetadata {
  /** Digest selecting the complete release. */
  readonly publicationDigest: Sha256Digest;
  /** Generation digest shared by inventory projections. */
  readonly inventoryGenerationDigest: Sha256Digest;
}

/** Fixed version-one resource policy for selected publications. */
export const PUBLICATION_V1_LIMITS = Object.freeze({
  maxPointerBytes: 256,
  maxManifestBytes: 16_384,
  maxBindingBytes: 1_048_576,
  maxSemanticReviewBytes: 1_048_576,
  maxMembers: 7,
  maxMemberBytes: 16_777_216,
  maxTotalReleaseBytes: 67_108_864,
  maxBindings: 4_096,
  maxJsonDepth: 16,
  maxJsonValues: 65_536,
  maxStringBytes: 65_536,
});

/** Exact lexical release-member authority. */
export const PUBLICATION_MEMBER_PATHS = Object.freeze([
  "bindings-v1.json",
  "compiler-readiness-v1.json",
  "compiler-readiness.md",
  "declarations.ts",
  "rule-models-v1-review.json",
  "rule-models-v1.json",
  "semantic-review-v1.json",
] as const);

/** Relative root containing immutable publications and the selected pointer. */
export const PUBLICATION_ROOT_PATH = "readiness/publications";
/** Relative selected-publication pointer path. */
export const PUBLICATION_POINTER_PATH = `${PUBLICATION_ROOT_PATH}/current-publication.json`;
/** Relative immutable release directory path. */
export const PUBLICATION_RELEASES_PATH = `${PUBLICATION_ROOT_PATH}/releases`;

/** One serialized executable-binding metadata row. */
export interface PublicationBindingRow {
  readonly handlerId: string;
  readonly kind: HandlerKind;
  readonly contractVersion: string;
  readonly implementationRevision: Sha256Digest;
}

/** One member entry in the release manifest. */
export interface PublicationManifestMember {
  readonly path: (typeof PUBLICATION_MEMBER_PATHS)[number];
  readonly byteLength: number;
  readonly digest: Sha256Digest;
}

/** Closed release manifest. */
export interface PublicationManifestV1 {
  readonly schemaVersion: 1;
  readonly inventoryGenerationDigest: Sha256Digest;
  readonly members: readonly PublicationManifestMember[];
}

/** Closed selected-publication pointer. */
export interface PublicationPointerV1 {
  readonly schemaVersion: 1;
  readonly publicationDigest: Sha256Digest;
}

/** One complete staged release before durable promotion. */
export interface PublicationRelease {
  readonly inventory: InventoryV1;
  readonly inventoryGenerationDigest: Sha256Digest;
  readonly bindings: readonly PublicationBindingRow[];
  readonly members: ReadonlyMap<(typeof PUBLICATION_MEMBER_PATHS)[number], Uint8Array>;
  readonly manifest: PublicationManifestV1;
  readonly manifestBytes: Uint8Array;
  readonly publicationDigest: Sha256Digest;
}

interface PublicationLimitInput {
  readonly pointerBytes: number;
  readonly manifestBytes: number;
  readonly bindingBytes: number;
  readonly semanticReviewBytes: number;
  readonly memberCount: number;
  readonly memberBytes: number;
  readonly totalReleaseBytes: number;
}

class PublicationJsonAbort extends Error {
  public constructor(
    public readonly code: "publication.input.invalid" | "publication.input.limit",
    public readonly path: string,
    message: string,
  ) {
    super(message);
  }
}

const TEXT_ENCODER = new TextEncoder();
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const MAX_DIAGNOSTIC_BYTES = 512;
const HANDLER_KINDS: ReadonlySet<string> = new Set(["generator", "oracle", "transform"]);

function escapePointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function pointer(path: JSONPath): string {
  return path.map((segment) => `/${escapePointerSegment(String(segment))}`).join("");
}

function boundedMessage(message: string): string {
  const bytes = TEXT_ENCODER.encode(message);
  if (bytes.byteLength <= MAX_DIAGNOSTIC_BYTES) return message;
  return new TextDecoder().decode(bytes.subarray(0, MAX_DIAGNOSTIC_BYTES));
}

/** Creates one immutable bounded publication diagnostic. */
export function publicationDiagnostic(
  code: PublicationDiagnostic["code"],
  path: string,
  message: string,
): PublicationDiagnostic {
  return Object.freeze({ code, path, message: boundedMessage(message) });
}

/** Creates an immutable successful publication result. */
export function publicationSuccess<T>(value: T): PublicationResult<T> {
  return Object.freeze({ ok: true, value, diagnostics: EMPTY_DIAGNOSTICS });
}

/** Creates an immutable failed publication result. */
export function publicationFailure<T>(
  kind: Exclude<PublicationResult<T>, { readonly ok: true }>["kind"],
  code: PublicationDiagnostic["code"],
  path: string,
  message: string,
): PublicationResult<T> {
  return Object.freeze({
    ok: false,
    kind,
    diagnostics: Object.freeze([publicationDiagnostic(code, path, message)]),
  });
}

/** Computes a lowercase SHA-256 digest over exact bytes. */
export function digestPublicationBytes(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

/** Serializes one JSON value in its insertion order with exactly one trailing LF. */
export function renderPublicationJson(value: unknown): Uint8Array {
  return TEXT_ENCODER.encode(`${JSON.stringify(value)}\n`);
}

/** Parses strict bounded UTF-8 JSON with duplicate-key rejection. */
export function parsePublicationJson(bytes: Uint8Array): PublicationResult<unknown> {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return publicationFailure(
      "invalid",
      "publication.input.invalid",
      "",
      "Publication JSON is not valid UTF-8.",
    );
  }
  if (!text.endsWith("\n") || text.endsWith("\n\n") || text.includes("\r")) {
    return publicationFailure(
      "invalid",
      "publication.input.invalid",
      "",
      "Publication JSON must use LF and contain exactly one trailing newline.",
    );
  }

  const objectKeys: Set<string>[] = [];
  let depth = 0;
  let values = 0;
  const count = (path: JSONPath): void => {
    values += 1;
    if (values > PUBLICATION_V1_LIMITS.maxJsonValues) {
      throw new PublicationJsonAbort(
        "publication.input.limit",
        pointer(path),
        "Publication JSON value limit exceeded.",
      );
    }
  };
  try {
    visit(
      text,
      {
        onObjectBegin: (_offset, _length, _line, _column, pathSupplier) => {
          const path = pathSupplier();
          count(path);
          depth += 1;
          if (depth > PUBLICATION_V1_LIMITS.maxJsonDepth) {
            throw new PublicationJsonAbort(
              "publication.input.limit",
              pointer(path),
              "Publication JSON nesting limit exceeded.",
            );
          }
          objectKeys.push(new Set());
        },
        onObjectProperty: (property, _offset, _length, _line, _column, pathSupplier) => {
          const path = [...pathSupplier(), property];
          if (Buffer.byteLength(property, "utf8") > PUBLICATION_V1_LIMITS.maxStringBytes) {
            throw new PublicationJsonAbort(
              "publication.input.limit",
              pointer(path),
              "Publication JSON property exceeds the string byte limit.",
            );
          }
          const keys = objectKeys.at(-1);
          if (keys?.has(property) === true) {
            throw new PublicationJsonAbort(
              "publication.input.invalid",
              pointer(path),
              "Publication JSON property occurs more than once.",
            );
          }
          keys?.add(property);
        },
        onObjectEnd: () => {
          objectKeys.pop();
          depth -= 1;
        },
        onArrayBegin: (_offset, _length, _line, _column, pathSupplier) => {
          const path = pathSupplier();
          count(path);
          depth += 1;
          if (depth > PUBLICATION_V1_LIMITS.maxJsonDepth) {
            throw new PublicationJsonAbort(
              "publication.input.limit",
              pointer(path),
              "Publication JSON nesting limit exceeded.",
            );
          }
        },
        onArrayEnd: () => {
          depth -= 1;
        },
        onLiteralValue: (value: unknown, _offset, _length, _line, _column, pathSupplier) => {
          const path = pathSupplier();
          count(path);
          if (
            typeof value === "string" &&
            Buffer.byteLength(value, "utf8") > PUBLICATION_V1_LIMITS.maxStringBytes
          ) {
            throw new PublicationJsonAbort(
              "publication.input.limit",
              pointer(path),
              "Publication JSON string exceeds the byte limit.",
            );
          }
        },
        onComment: () => {
          throw new PublicationJsonAbort(
            "publication.input.invalid",
            "",
            "Publication JSON comments are not permitted.",
          );
        },
        onError: (error) => {
          throw new PublicationJsonAbort(
            "publication.input.invalid",
            "",
            `Invalid publication JSON: ${printParseErrorCode(error)}.`,
          );
        },
      },
      { allowTrailingComma: false, disallowComments: true },
    );
    return publicationSuccess(JSON.parse(text) as unknown);
  } catch (error) {
    if (error instanceof PublicationJsonAbort) {
      return publicationFailure("invalid", error.code, error.path, error.message);
    }
    return publicationFailure(
      "invalid",
      "publication.input.invalid",
      "",
      "Publication JSON could not be parsed safely.",
    );
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isCanonicalMemberPath(value: unknown): value is (typeof PUBLICATION_MEMBER_PATHS)[number] {
  return (
    typeof value === "string" &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    value.split("/").every((part) => part !== "" && part !== "." && part !== "..") &&
    PUBLICATION_MEMBER_PATHS.some((path) => path === value)
  );
}

/** Parses and validates the exact selected-pointer schema. */
export function parsePublicationPointer(
  bytes: Uint8Array,
): PublicationResult<PublicationPointerV1> {
  const parsed = parsePublicationJson(bytes);
  if (!parsed.ok) return parsed;
  const value = parsed.value;
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["schemaVersion", "publicationDigest"]) ||
    value.schemaVersion !== 1 ||
    !isSha256Digest(value.publicationDigest)
  ) {
    return publicationFailure(
      "invalid",
      "publication.input.invalid",
      PUBLICATION_POINTER_PATH,
      "Publication pointer does not satisfy its exact version-one schema.",
    );
  }
  return publicationSuccess(
    Object.freeze({ schemaVersion: 1, publicationDigest: value.publicationDigest }),
  );
}

/** Parses and validates the exact release-manifest schema and ordering. */
export function parsePublicationManifest(
  bytes: Uint8Array,
): PublicationResult<PublicationManifestV1> {
  const parsed = parsePublicationJson(bytes);
  if (!parsed.ok) return parsed;
  const value = parsed.value;
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["schemaVersion", "inventoryGenerationDigest", "members"]) ||
    value.schemaVersion !== 1 ||
    !isSha256Digest(value.inventoryGenerationDigest) ||
    !Array.isArray(value.members) ||
    value.members.length !== PUBLICATION_MEMBER_PATHS.length
  ) {
    return publicationFailure(
      "invalid",
      "publication.input.invalid",
      "manifest.json",
      "Publication manifest does not satisfy its exact version-one schema.",
    );
  }
  const members: PublicationManifestMember[] = [];
  for (let index = 0; index < value.members.length; index += 1) {
    const member = value.members[index];
    if (
      !isRecord(member) ||
      !hasExactKeys(member, ["path", "byteLength", "digest"]) ||
      !isCanonicalMemberPath(member.path) ||
      member.path !== PUBLICATION_MEMBER_PATHS[index] ||
      !Number.isSafeInteger(member.byteLength) ||
      Number(member.byteLength) < 0 ||
      !isSha256Digest(member.digest)
    ) {
      return publicationFailure(
        "invalid",
        "publication.path.invalid",
        `/members/${index}`,
        "Manifest member is not an exact lexical contained release member.",
      );
    }
    members.push(
      Object.freeze({
        path: member.path,
        byteLength: Number(member.byteLength),
        digest: member.digest,
      }),
    );
  }
  return publicationSuccess(
    Object.freeze({
      schemaVersion: 1,
      inventoryGenerationDigest: value.inventoryGenerationDigest,
      members: Object.freeze(members),
    }),
  );
}

/** Parses the closed serialized binding registry. */
export function parsePublicationBindings(
  bytes: Uint8Array,
): PublicationResult<readonly PublicationBindingRow[]> {
  const parsed = parsePublicationJson(bytes);
  if (!parsed.ok) return parsed;
  const value = parsed.value;
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["schemaVersion", "bindings"]) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.bindings) ||
    value.bindings.length > PUBLICATION_V1_LIMITS.maxBindings
  ) {
    return publicationFailure(
      "invalid",
      value &&
        typeof value === "object" &&
        "bindings" in value &&
        Array.isArray(value.bindings) &&
        value.bindings.length > PUBLICATION_V1_LIMITS.maxBindings
        ? "publication.input.limit"
        : "publication.binding.invalid",
      "bindings-v1.json",
      "Binding registry does not satisfy its exact version-one schema.",
    );
  }
  const rows: PublicationBindingRow[] = [];
  for (let index = 0; index < value.bindings.length; index += 1) {
    const row = value.bindings[index];
    if (
      !isRecord(row) ||
      !hasExactKeys(row, ["handlerId", "kind", "contractVersion", "implementationRevision"]) ||
      typeof row.handlerId !== "string" ||
      typeof row.kind !== "string" ||
      !HANDLER_KINDS.has(row.kind) ||
      typeof row.contractVersion !== "string" ||
      row.contractVersion.length === 0 ||
      !isSha256Digest(row.implementationRevision) ||
      (index > 0 &&
        typeof value.bindings[index - 1] === "object" &&
        value.bindings[index - 1] !== null &&
        "handlerId" in value.bindings[index - 1] &&
        String(value.bindings[index - 1].handlerId) >= row.handlerId)
    ) {
      return publicationFailure(
        "invalid",
        "publication.binding.invalid",
        `/bindings/${index}`,
        "Binding row must be exact, compatible, lexical and unique.",
      );
    }
    rows.push(
      Object.freeze({
        handlerId: row.handlerId,
        kind: row.kind as HandlerKind,
        contractVersion: row.contractVersion,
        implementationRevision: row.implementationRevision,
      }),
    );
  }
  return publicationSuccess(Object.freeze(rows));
}

/** Renders exact canonical binding-registry bytes without serializing callables. */
export function renderPublicationBindings(rows: readonly PublicationBindingRow[]): Uint8Array {
  return renderPublicationJson({
    schemaVersion: 1,
    bindings: rows.map((row) => ({
      handlerId: row.handlerId,
      kind: row.kind,
      contractVersion: row.contractVersion,
      implementationRevision: row.implementationRevision,
    })),
  });
}

/** Renders exact canonical pointer bytes. */
export function renderPublicationPointer(publicationDigest: Sha256Digest): Uint8Array {
  return renderPublicationJson({ schemaVersion: 1, publicationDigest });
}

/** Renders exact canonical release-manifest bytes. */
export function renderPublicationManifest(manifest: PublicationManifestV1): Uint8Array {
  return renderPublicationJson({
    schemaVersion: 1,
    inventoryGenerationDigest: manifest.inventoryGenerationDigest,
    members: manifest.members.map((member) => ({
      path: member.path,
      byteLength: member.byteLength,
      digest: member.digest,
    })),
  });
}

/** Computes the canonical content-addressed publication digest. */
export function computePublicationDigest(manifest: PublicationManifestV1): Sha256Digest {
  return digestPublicationBytes(publicationDigestPreimage(manifest));
}

/** Encodes the exact canonical publication digest preimage. */
export function publicationDigestPreimage(manifest: PublicationManifestV1): Uint8Array {
  const fields: { readonly name: string; readonly value: string }[] = [
    { name: "schemaVersion", value: "1" },
    { name: "inventoryGenerationDigest", value: manifest.inventoryGenerationDigest },
    { name: "memberCount", value: manifest.members.length.toString(10) },
  ];
  manifest.members.forEach((member, index) => {
    fields.push(
      { name: `member.${index}.path`, value: member.path },
      { name: `member.${index}.byteLength`, value: member.byteLength.toString(10) },
      { name: `member.${index}.digest`, value: member.digest },
    );
  });
  const u32 = (value: number): Uint8Array =>
    Uint8Array.of(
      Math.floor(value / 0x100_0000),
      Math.floor(value / 0x1_0000) & 0xff,
      Math.floor(value / 0x100) & 0xff,
      value & 0xff,
    );
  const chunks: Uint8Array[] = [];
  const pushLengthPrefixed = (value: Uint8Array): void => {
    chunks.push(u32(value.byteLength), value);
  };
  pushLengthPrefixed(TEXT_ENCODER.encode("blend65-publication-v1"));
  chunks.push(u32(fields.length));
  for (const field of fields) {
    pushLengthPrefixed(TEXT_ENCODER.encode(field.name));
    pushLengthPrefixed(TEXT_ENCODER.encode(field.value));
  }
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

/** Creates the module-private prepared-review capability. */
export function createPreparedPublicationReview(): PreparedPublicationReview {
  return Object.freeze({
    [PREPARED_PUBLICATION_REVIEW_BRAND]: true as const,
  });
}

/** Applies all fixed publication aggregate limits without touching the filesystem. */
export function inspectPublicationLimits(input: PublicationLimitInput): PublicationResult<true> {
  const entries = [
    ["pointerBytes", input.pointerBytes, PUBLICATION_V1_LIMITS.maxPointerBytes],
    ["manifestBytes", input.manifestBytes, PUBLICATION_V1_LIMITS.maxManifestBytes],
    ["bindingBytes", input.bindingBytes, PUBLICATION_V1_LIMITS.maxBindingBytes],
    [
      "semanticReviewBytes",
      input.semanticReviewBytes,
      PUBLICATION_V1_LIMITS.maxSemanticReviewBytes,
    ],
    ["memberCount", input.memberCount, PUBLICATION_V1_LIMITS.maxMembers],
    ["memberBytes", input.memberBytes, PUBLICATION_V1_LIMITS.maxMemberBytes],
    ["totalReleaseBytes", input.totalReleaseBytes, PUBLICATION_V1_LIMITS.maxTotalReleaseBytes],
  ] as const;
  for (const [name, value, limit] of entries) {
    if (!Number.isSafeInteger(value) || value < 0) {
      return publicationFailure(
        "invalid",
        "publication.input.invalid",
        `/${name}`,
        "Publication limit input must be a non-negative safe integer.",
      );
    }
    if (value > limit) {
      return publicationFailure(
        "invalid",
        "publication.input.limit",
        `/${name}`,
        `Publication ${name} exceeds the version-one limit of ${limit}.`,
      );
    }
  }
  return publicationSuccess(true);
}
