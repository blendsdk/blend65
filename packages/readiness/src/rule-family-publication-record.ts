import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import type { CompatiblePublicationResult } from "./compatible-publication-model.js";
import { isSha256Digest } from "./canonical-identity.js";
import type { Sha256Digest } from "./model-registry-model.js";
import {
  pinPublicationDirectory,
  readPublicationDirectoryNames,
  readPublicationRegularFile,
  verifyPublicationDirectory,
  type PublicationDirectoryIdentity,
} from "./publication-filesystem.js";
import {
  PUBLICATION_RELEASES_PATH,
  PUBLICATION_V1_LIMITS,
  computePublicationDigest,
  digestPublicationBytes,
  parsePublicationBindings,
  parsePublicationJson,
  parsePublicationManifest,
  publicationFailure,
  publicationSuccess,
  renderPublicationJson,
  renderPublicationManifest,
  type PublicationBindingRow,
  type PublicationManifestMember,
  type PublicationResult,
} from "./publication-model.js";

/** Exact lexical members of a version-two rule-family publication. */
export const RULE_FAMILY_PUBLICATION_V2_MEMBER_PATHS = Object.freeze([
  "binding-rejections-v1.json",
  "bindings-v2.json",
  "compiler-readiness-v1.json",
  "diagnostic-oracle-v1.json",
  "embed-fixtures-v2.json",
  "first-vertical-v2.json",
  "migration-v2.json",
  "rule-model-seed-v1.json",
  "rule-models-v2-review.json",
  "rule-models-v2.json",
  "semantic-review-v2.json",
  "structured-execution-exemplar-v2.json",
] as const);

/** Supported persisted rule-family publication formats. */
export type PublishedRuleFamilyFormatVersion = 1 | 2;

declare const publishedRuleFamilyRecordBrand: unique symbol;

/** Opaque capability for digest-authenticated historical publication bytes. */
export interface PublishedRuleFamilyRecord {
  readonly [publishedRuleFamilyRecordBrand]: true;
}

/** Defensive historical publication bytes and binding metadata. */
export interface PublishedRuleFamilyRecordProjectionV2 {
  readonly schemaVersion: PublishedRuleFamilyFormatVersion;
  readonly publicationDigest: Sha256Digest;
  readonly predecessorPublicationDigest?: Sha256Digest;
  readonly bindings: readonly PublicationBindingRow[];
  readonly members: readonly {
    readonly path: string;
    readonly digest: Sha256Digest;
    readonly byteLength: number;
    readonly bytes: Uint8Array;
  }[];
}

/** Input for passive named historical publication resolution. */
export interface ResolvePublishedRuleFamilyRecordInputV2 {
  readonly repositoryRoot: string;
  readonly publicationDigest: Sha256Digest;
}

/** Version-two publication manifest with an explicit predecessor. */
export interface RuleFamilyPublicationManifestV2 {
  readonly schemaVersion: 2;
  readonly kind: "rule-family-publication-v2";
  readonly predecessorPublicationDigest: Sha256Digest;
  readonly members: readonly PublicationManifestMemberV2[];
}

/** Version-two selected parent pointer. */
export interface RuleFamilyPublicationPointerV2 {
  readonly schemaVersion: 2;
  readonly kind: "rule-family-publication-pointer-v2";
  readonly publicationDigest: Sha256Digest;
}

/** One named immutable member in a version-two manifest. */
export interface PublicationManifestMemberV2 {
  readonly path: (typeof RULE_FAMILY_PUBLICATION_V2_MEMBER_PATHS)[number];
  readonly byteLength: number;
  readonly digest: Sha256Digest;
}

/** Package-private authenticated facts retained behind a passive record. */
export interface PublishedRuleFamilyRecordAuthorityV2 {
  readonly repositoryRoot: string;
  readonly schemaVersion: PublishedRuleFamilyFormatVersion;
  readonly publicationDigest: Sha256Digest;
  readonly predecessorPublicationDigest?: Sha256Digest;
  readonly bindings: readonly PublicationBindingRow[];
  readonly members: ReadonlyMap<string, Uint8Array>;
  readonly memberDigests: ReadonlyMap<string, Sha256Digest>;
}

const RECORDS = new WeakMap<object, PublishedRuleFamilyRecordAuthorityV2>();
const MAX_RELEASE_BYTES = 96 * 1024 * 1024;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function success<T>(value: T): CompatiblePublicationResult<T> {
  return Object.freeze({ ok: true, value, diagnostics: Object.freeze([]) as readonly [] });
}

function failure<T>(
  code:
    | "publication.input.invalid"
    | "publication.path.invalid"
    | "publication.record.invalid"
    | "publication.version.unsupported"
    | "publication.digest.mismatch"
    | "publication.release.not-found"
    | "publication.io",
  path: string,
  message: string,
  kind: "invalid" | "not-found" | "io" = "invalid",
): CompatiblePublicationResult<T> {
  return Object.freeze({
    ok: false,
    kind,
    diagnostics: Object.freeze([Object.freeze({ code, path, message })]),
  });
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}

function exactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

/** Computes the content address of one canonical version-two manifest. */
export function computeRuleFamilyPublicationDigestV2(manifestBytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash("sha256")
    .update("blend65-rule-family-publication-v2\0", "utf8")
    .update(manifestBytes)
    .digest("hex")}`;
}

/** Renders one exact version-two parent pointer. */
export function renderRuleFamilyPublicationPointerV2(publicationDigest: Sha256Digest): Uint8Array {
  return renderPublicationJson({
    schemaVersion: 2,
    kind: "rule-family-publication-pointer-v2",
    publicationDigest,
  });
}

/** Parses one exact version-two selected parent pointer. */
export function parseRuleFamilyPublicationPointerV2(
  bytes: Uint8Array,
): PublicationResult<RuleFamilyPublicationPointerV2> {
  const parsed = parsePublicationJson(bytes);
  if (!parsed.ok) return parsed;
  const value = parsed.value;
  if (
    !isRecord(value) ||
    !exactKeys(value, ["schemaVersion", "kind", "publicationDigest"]) ||
    value.schemaVersion !== 2 ||
    value.kind !== "rule-family-publication-pointer-v2" ||
    !isSha256Digest(value.publicationDigest)
  ) {
    return publicationFailure(
      "invalid",
      "publication.record.invalid",
      "readiness/publications/current-publication.json",
      "Version-two parent pointer has an invalid closed shape.",
    );
  }
  return publicationSuccess(
    Object.freeze({
      schemaVersion: 2,
      kind: "rule-family-publication-pointer-v2",
      publicationDigest: value.publicationDigest,
    }),
  );
}

/** Parses one exact version-two manifest from hostile bytes. */
export function parseRuleFamilyPublicationManifestV2(
  bytes: Uint8Array,
): PublicationResult<RuleFamilyPublicationManifestV2> {
  const parsed = parsePublicationJson(bytes);
  if (!parsed.ok) return parsed;
  const value = parsed.value;
  if (
    !isRecord(value) ||
    !exactKeys(value, ["schemaVersion", "kind", "predecessorPublicationDigest", "members"]) ||
    value.schemaVersion !== 2 ||
    value.kind !== "rule-family-publication-v2" ||
    !isSha256Digest(value.predecessorPublicationDigest) ||
    !Array.isArray(value.members) ||
    value.members.length !== RULE_FAMILY_PUBLICATION_V2_MEMBER_PATHS.length
  ) {
    return publicationFailure(
      "invalid",
      "publication.record.invalid",
      "manifest.json",
      "Version-two publication manifest has an invalid closed shape.",
    );
  }
  const members: PublicationManifestMemberV2[] = [];
  for (let index = 0; index < value.members.length; index += 1) {
    const row = value.members[index];
    const path = RULE_FAMILY_PUBLICATION_V2_MEMBER_PATHS[index];
    if (
      path === undefined ||
      !isRecord(row) ||
      !exactKeys(row, ["path", "byteLength", "digest"]) ||
      row.path !== path ||
      !Number.isSafeInteger(row.byteLength) ||
      Number(row.byteLength) < 0 ||
      !isSha256Digest(row.digest)
    ) {
      return publicationFailure(
        "invalid",
        "publication.record.invalid",
        `/members/${index}`,
        "Version-two manifest members must be exact, lexical and unique.",
      );
    }
    members.push(Object.freeze({ path, byteLength: Number(row.byteLength), digest: row.digest }));
  }
  return publicationSuccess(
    Object.freeze({
      schemaVersion: 2,
      kind: "rule-family-publication-v2",
      predecessorPublicationDigest: value.predecessorPublicationDigest,
      members: Object.freeze(members),
    }),
  );
}

/** Renders one canonical version-two manifest. */
export function renderRuleFamilyPublicationManifestV2(
  manifest: RuleFamilyPublicationManifestV2,
): Uint8Array {
  return renderPublicationJson({
    schemaVersion: 2,
    kind: "rule-family-publication-v2",
    predecessorPublicationDigest: manifest.predecessorPublicationDigest,
    members: manifest.members.map(({ path, byteLength, digest }) => ({
      path,
      byteLength,
      digest,
    })),
  });
}

function parseBindingsV2(bytes: Uint8Array): PublicationResult<readonly PublicationBindingRow[]> {
  const parsed = parsePublicationJson(bytes);
  if (!parsed.ok) return parsed;
  const value = parsed.value;
  if (
    !isRecord(value) ||
    !exactKeys(value, ["schemaVersion", "kind", "bindings"]) ||
    value.schemaVersion !== 2 ||
    value.kind !== "rule-family-bindings-v2" ||
    !Array.isArray(value.bindings) ||
    value.bindings.length !== 9
  ) {
    return publicationFailure(
      "invalid",
      "publication.record.invalid",
      "bindings-v2.json",
      "Version-two binding registry has an invalid closed shape.",
    );
  }
  const rows: PublicationBindingRow[] = [];
  for (let index = 0; index < value.bindings.length; index += 1) {
    const row = value.bindings[index];
    if (
      !isRecord(row) ||
      !exactKeys(row, ["handlerId", "kind", "contractVersion", "implementationRevision"]) ||
      typeof row.handlerId !== "string" ||
      (row.kind !== "generator" && row.kind !== "oracle" && row.kind !== "transform") ||
      row.contractVersion !== "1.0.0" ||
      !isSha256Digest(row.implementationRevision) ||
      (index > 0 && rows[index - 1]!.handlerId >= row.handlerId)
    ) {
      return publicationFailure(
        "invalid",
        "publication.record.invalid",
        `/bindings/${index}`,
        "Version-two binding rows must be canonical, lexical and unique.",
      );
    }
    rows.push(
      Object.freeze({
        handlerId: row.handlerId,
        kind: row.kind,
        contractVersion: row.contractVersion,
        implementationRevision: row.implementationRevision,
      }),
    );
  }
  return publicationSuccess(Object.freeze(rows));
}

function createRecord(authority: PublishedRuleFamilyRecordAuthorityV2): PublishedRuleFamilyRecord {
  const record = Object.freeze({}) as PublishedRuleFamilyRecord;
  RECORDS.set(
    record,
    Object.freeze({
      ...authority,
      bindings: Object.freeze(authority.bindings.map((row) => Object.freeze({ ...row }))),
      members: new Map(
        [...authority.members].map(([path, bytes]) => [path, bytes.slice()] as const),
      ),
      memberDigests: new Map(authority.memberDigests),
    }),
  );
  return record;
}

/**
 * Mints a passive record from already validated staged bytes.
 *
 * This internal seam lets the transaction expose a staged record without making an unfinished
 * release visible in the immutable release directory.
 */
export function createStagedPublishedRuleFamilyRecordV2(
  authority: PublishedRuleFamilyRecordAuthorityV2,
): PublishedRuleFamilyRecord {
  return createRecord(authority);
}

async function verifyDirectoryChain(
  directories: readonly PublicationDirectoryIdentity[],
): Promise<PublicationResult<true>> {
  for (const directory of directories) {
    const verified = await verifyPublicationDirectory(directory);
    if (!verified.ok) return verified;
  }
  return publicationSuccess(true);
}

async function pinRecordDirectoryChain(
  repositoryRoot: string,
  publicationDigest: Sha256Digest,
): Promise<PublicationResult<readonly PublicationDirectoryIdentity[]>> {
  const paths = [
    repositoryRoot,
    join(repositoryRoot, "readiness"),
    join(repositoryRoot, "readiness/publications"),
    join(repositoryRoot, PUBLICATION_RELEASES_PATH),
    join(repositoryRoot, PUBLICATION_RELEASES_PATH, publicationDigest),
  ];
  const identities: PublicationDirectoryIdentity[] = [];
  for (const path of paths) {
    const pinned = await pinPublicationDirectory(path);
    if (!pinned.ok) return pinned;
    identities.push(pinned.value);
  }
  return publicationSuccess(Object.freeze(identities));
}

async function readPinnedRegularFile(
  path: string,
  maximumBytes: number,
  directories: readonly PublicationDirectoryIdentity[],
  expectedSize?: number,
): Promise<PublicationResult<Uint8Array>> {
  const before = await verifyDirectoryChain(directories);
  if (!before.ok) return before;
  const read = await readPublicationRegularFile(path, maximumBytes, expectedSize);
  if (!read.ok) return read;
  const after = await verifyDirectoryChain(directories);
  return after.ok ? publicationSuccess(read.value.bytes.slice()) : after;
}

async function readPinnedDirectoryNames(
  directory: PublicationDirectoryIdentity,
  maximumNames: number,
  directories: readonly PublicationDirectoryIdentity[],
): Promise<PublicationResult<readonly string[]>> {
  const before = await verifyDirectoryChain(directories);
  if (!before.ok) return before;
  const names = await readPublicationDirectoryNames(directory, maximumNames);
  if (!names.ok) return names;
  const after = await verifyDirectoryChain(directories);
  return after.ok ? names : after;
}

/**
 * Resolves a historical publication without loading or substituting executable callables.
 *
 * @param input Canonical repository root and exact content digest.
 * @returns Opaque passive record after every stored byte and digest authenticates.
 */
export async function resolvePublishedRuleFamilyRecordByDigestV2(
  input: ResolvePublishedRuleFamilyRecordInputV2,
): Promise<CompatiblePublicationResult<PublishedRuleFamilyRecord>> {
  if (
    !isRecord(input) ||
    !exactKeys(input, ["repositoryRoot", "publicationDigest"]) ||
    typeof input.repositoryRoot !== "string" ||
    !isAbsolute(input.repositoryRoot) ||
    resolve(input.repositoryRoot) !== input.repositoryRoot ||
    !isSha256Digest(input.publicationDigest)
  ) {
    return publicationFailure(
      "invalid",
      "publication.input.invalid",
      "/publicationDigest",
      "Passive publication input must contain a canonical root and digest.",
    );
  }
  try {
    if ((await realpath(input.repositoryRoot)) !== input.repositoryRoot) {
      return failure(
        "publication.path.invalid",
        "/repositoryRoot",
        "Repository root must not traverse a symbolic link.",
      );
    }
    const releaseRoot = join(
      input.repositoryRoot,
      PUBLICATION_RELEASES_PATH,
      input.publicationDigest,
    );
    const releaseMetadata = await lstat(releaseRoot);
    if (!releaseMetadata.isDirectory() || releaseMetadata.isSymbolicLink()) {
      return failure(
        "publication.path.invalid",
        "/publicationDigest",
        "Publication release must be a real directory.",
      );
    }
    const directories = await pinRecordDirectoryChain(
      input.repositoryRoot,
      input.publicationDigest,
    );
    if (!directories.ok) return directories;
    const manifestRead = await readPinnedRegularFile(
      join(releaseRoot, "manifest.json"),
      PUBLICATION_V1_LIMITS.maxManifestBytes,
      directories.value,
    );
    if (!manifestRead.ok) {
      return failure(
        "publication.record.invalid",
        "manifest.json",
        "Publication manifest is absent or unsafe.",
      );
    }
    const manifestBytes = manifestRead.value;
    const rawManifest = parsePublicationJson(manifestBytes);
    if (!rawManifest.ok || !isRecord(rawManifest.value)) {
      return failure(
        "publication.record.invalid",
        "manifest.json",
        "Publication manifest is not strict JSON.",
      );
    }
    const schemaVersion = rawManifest.value.schemaVersion;
    let predecessorPublicationDigest: Sha256Digest | undefined;
    let members: readonly (PublicationManifestMember | PublicationManifestMemberV2)[];
    if (schemaVersion === 1 && !Object.hasOwn(rawManifest.value, "kind")) {
      const parsed = parsePublicationManifest(manifestBytes);
      if (!parsed.ok || !equalBytes(manifestBytes, renderPublicationManifest(parsed.value))) {
        return failure(
          "publication.record.invalid",
          "manifest.json",
          "Version-one manifest is invalid or non-canonical.",
        );
      }
      if (computePublicationDigest(parsed.value) !== input.publicationDigest) {
        return failure(
          "publication.digest.mismatch",
          "manifest.json",
          "Version-one release digest does not match its directory.",
        );
      }
      members = parsed.value.members;
    } else if (schemaVersion === 2 && rawManifest.value.kind === "rule-family-publication-v2") {
      const parsed = parseRuleFamilyPublicationManifestV2(manifestBytes);
      if (
        !parsed.ok ||
        !equalBytes(manifestBytes, renderRuleFamilyPublicationManifestV2(parsed.value))
      ) {
        return failure(
          "publication.record.invalid",
          "manifest.json",
          "Version-two manifest is invalid or non-canonical.",
        );
      }
      if (computeRuleFamilyPublicationDigestV2(manifestBytes) !== input.publicationDigest) {
        return failure(
          "publication.digest.mismatch",
          "manifest.json",
          "Version-two release digest does not match its directory.",
        );
      }
      predecessorPublicationDigest = parsed.value.predecessorPublicationDigest;
      members = parsed.value.members;
    } else {
      return failure(
        "publication.version.unsupported",
        "manifest.json",
        "Publication manifest version and kind are unsupported.",
      );
    }
    const expectedNames = [...members.map(({ path }) => path), "manifest.json"].sort();
    const releaseDirectory = directories.value.at(-1);
    if (releaseDirectory === undefined) {
      return failure(
        "publication.record.invalid",
        releaseRoot,
        "Publication directory chain is incomplete.",
      );
    }
    const names = await readPinnedDirectoryNames(
      releaseDirectory,
      expectedNames.length,
      directories.value,
    );
    if (!names.ok) return names;
    const actualNames = [...names.value].sort();
    if (
      actualNames.length !== expectedNames.length ||
      actualNames.some((name, index) => name !== expectedNames[index])
    ) {
      return failure(
        "publication.record.invalid",
        releaseRoot,
        "Publication release contains an unexpected member population.",
      );
    }
    const memberBytes = new Map<string, Uint8Array>();
    const memberDigests = new Map<string, Sha256Digest>();
    let totalBytes = manifestBytes.byteLength;
    for (const member of members) {
      const read = await readPinnedRegularFile(
        join(releaseRoot, member.path),
        MAX_RELEASE_BYTES,
        directories.value,
        member.byteLength,
      );
      if (!read.ok || digestPublicationBytes(read.value) !== member.digest) {
        return failure(
          "publication.digest.mismatch",
          member.path,
          "Publication member bytes do not match the manifest.",
        );
      }
      const bytes = read.value;
      totalBytes += bytes.byteLength;
      if (totalBytes > MAX_RELEASE_BYTES) {
        return failure(
          "publication.record.invalid",
          releaseRoot,
          "Publication release exceeds its aggregate byte limit.",
        );
      }
      memberBytes.set(member.path, bytes);
      memberDigests.set(member.path, member.digest);
    }
    const bindingPath = schemaVersion === 1 ? "bindings-v1.json" : "bindings-v2.json";
    const bindingBytes = memberBytes.get(bindingPath);
    const bindings =
      bindingBytes === undefined
        ? failure<readonly PublicationBindingRow[]>(
            "publication.record.invalid",
            bindingPath,
            "Publication binding member is absent.",
          )
        : schemaVersion === 1
          ? parsePublicationBindings(bindingBytes)
          : parseBindingsV2(bindingBytes);
    if (!bindings.ok) return bindings;
    return success(
      createRecord({
        repositoryRoot: input.repositoryRoot,
        schemaVersion,
        publicationDigest: input.publicationDigest,
        ...(predecessorPublicationDigest === undefined ? {} : { predecessorPublicationDigest }),
        bindings: bindings.value,
        members: memberBytes,
        memberDigests,
      }),
    );
  } catch (error) {
    const missing = isRecord(error) && (error.code === "ENOENT" || error.code === "ENOTDIR");
    return failure(
      missing ? "publication.release.not-found" : "publication.io",
      "/publicationDigest",
      missing
        ? "Named publication release was not found."
        : "Publication could not be read safely.",
      missing ? "not-found" : "io",
    );
  }
}

/** Returns a fresh passive projection for a genuine historical record. */
export function getPublishedRuleFamilyRecordProjectionV2(
  record: PublishedRuleFamilyRecord,
): PublicationResult<PublishedRuleFamilyRecordProjectionV2> {
  const authority = getPublishedRuleFamilyRecordAuthorityV2(record);
  if (authority === undefined) {
    return publicationFailure(
      "invalid",
      "publication.record.invalid",
      "/record",
      "A genuine passive publication record is required.",
    );
  }
  return publicationSuccess(
    Object.freeze({
      schemaVersion: authority.schemaVersion,
      publicationDigest: authority.publicationDigest,
      ...(authority.predecessorPublicationDigest === undefined
        ? {}
        : { predecessorPublicationDigest: authority.predecessorPublicationDigest }),
      bindings: Object.freeze(authority.bindings.map((row) => Object.freeze({ ...row }))),
      members: Object.freeze(
        [...authority.members.entries()].map(([path, bytes]) => {
          const digest = authority.memberDigests.get(path);
          if (digest === undefined) {
            throw new TypeError("Authenticated publication member digest is unavailable.");
          }
          return Object.freeze({
            path,
            digest,
            byteLength: bytes.byteLength,
            bytes: authority.schemaVersion === 1 ? Buffer.from(bytes) : bytes.slice(),
          });
        }),
      ),
    }),
  );
}

/** Returns retained passive authority only for a genuine record capability. */
export function getPublishedRuleFamilyRecordAuthorityV2(
  record: PublishedRuleFamilyRecord,
): PublishedRuleFamilyRecordAuthorityV2 | undefined {
  const authority = typeof record === "object" && record !== null ? RECORDS.get(record) : undefined;
  return authority === undefined
    ? undefined
    : Object.freeze({
        ...authority,
        bindings: Object.freeze(authority.bindings.map((row) => Object.freeze({ ...row }))),
        members: new Map(
          [...authority.members].map(([path, bytes]) => [path, bytes.slice()] as const),
        ),
        memberDigests: new Map(authority.memberDigests),
      });
}
