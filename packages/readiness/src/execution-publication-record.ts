import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, join, normalize, relative, resolve, sep } from "node:path";

import type { ExecutionOperationResultV1 } from "./execution-contracts.js";
import {
  EXECUTION_BINDINGS_V1_FILENAME,
  EXECUTION_MANIFEST_V1_FILENAME,
  EXECUTION_PARENT_V1_FILENAME,
  EXECUTION_PUBLICATION_MEMBER_FILENAMES,
  EXECUTION_PUBLICATION_MEMBER_LIMIT,
  EXECUTION_PUBLICATIONS_ROOT,
  EXECUTION_SEMANTIC_REVIEW_V1_FILENAME,
  computeExecutionPublicationDigest,
  digestExecutionPublicationBytes,
  executionFilesystemFailure,
  executionPublicationFailure,
  executionPublicationSuccess,
  parseExecutionBindingsV1,
  parseExecutionManifestV1,
  parseExecutionParentReferenceV1,
  parseExecutionSemanticReviewV1,
  sortExecutionPublicationText,
  type ExecutionPublicationBindingV1,
  type ValidatedExecutionPublicationV1,
} from "./execution-publication-model.js";
import {
  pinPublicationDirectory,
  readPublicationDirectoryNames,
  readPublicationRegularFile,
  verifyPublicationDirectory,
  type PublicationBoundedRead,
  type PublicationDirectoryIdentity,
} from "./publication-filesystem.js";
import { isExecutionDigest } from "./execution-validation.js";
import type { Sha256Digest } from "./model-registry-model.js";

const publishedExecutionReleaseRecordV1Brand = Symbol("publishedExecutionReleaseRecordV1");

/** Opaque authenticated bytes for one named execution-child release. */
export interface PublishedExecutionReleaseRecordV1 {
  readonly [publishedExecutionReleaseRecordV1Brand]: true;
}

/** Input for passive authentication of one exact digest-named execution-child release. */
export interface ResolvePublishedExecutionReleaseRecordInputV1 {
  /** Canonical absolute repository root containing the release. */
  readonly repositoryRoot: string;
  /** Exact content-derived child publication digest. */
  readonly publicationDigest: Sha256Digest;
}

/** One defensive member copy returned by the passive execution-child projection. */
export interface PublishedExecutionReleaseRecordMemberV1 {
  /** Closed canonical filename within the child release. */
  readonly path:
    | typeof EXECUTION_MANIFEST_V1_FILENAME
    | (typeof EXECUTION_PUBLICATION_MEMBER_FILENAMES)[number];
  /** Digest reconstructed from the exact stored bytes. */
  readonly digest: Sha256Digest;
  /** Exact stored byte length. */
  readonly byteLength: number;
  /** Fresh defensive copy of the authenticated bytes. */
  readonly bytes: Uint8Array;
}

/** Defensive passive facts reconstructed from one authenticated execution-child release. */
export interface PublishedExecutionReleaseRecordProjectionV1 {
  /** Execution-child wire schema version. */
  readonly schemaVersion: 1;
  /** Content-derived child publication digest. */
  readonly publicationDigest: Sha256Digest;
  /** Stored parent publication digest without any claim that the parent is executable. */
  readonly parentDigest: Sha256Digest;
  /** Digest of the canonical binding member. */
  readonly bindingDigest: Sha256Digest;
  /** Digest of the canonical semantic-review member. */
  readonly semanticReviewDigest: Sha256Digest;
  /** Specification revision authenticated by the semantic review. */
  readonly semanticReviewSpecRevision: string;
  /** Exact lexical six-row binding table. */
  readonly bindings: readonly ExecutionPublicationBindingV1[];
  /** Exact four-file release population in lexical filename order. */
  readonly members: readonly PublishedExecutionReleaseRecordMemberV1[];
}

/** Child-only authenticated state shared with executable-compatible resolution. */
export interface AuthenticatedExecutionReleaseRecordStateV1 {
  /** Reconstructed canonical release data and retained bytes. */
  readonly release: ValidatedExecutionPublicationV1;
  /** Pinned directory chain through the exact release directory. */
  readonly directories: readonly PublicationDirectoryIdentity[];
}

const RECORDS = new WeakMap<object, AuthenticatedExecutionReleaseRecordStateV1>();

function canonicalRepositoryRoot(root: unknown): ExecutionOperationResultV1<string> {
  if (
    typeof root !== "string" ||
    root.length === 0 ||
    !isAbsolute(root) ||
    normalize(root) !== root ||
    resolve(root) !== root
  ) {
    return executionPublicationFailure(
      "execution.invalid-schema",
      "/repositoryRoot",
      "Repository root must be an existing canonical absolute path.",
    );
  }
  return executionPublicationSuccess(root);
}

/** Validates an existing canonical repository directory without following a root link. */
export async function validateExecutionPublicationRepositoryRootV1(
  root: unknown,
): Promise<ExecutionOperationResultV1<string>> {
  const canonical = canonicalRepositoryRoot(root);
  if (!canonical.ok) return canonical;
  try {
    const stat = await lstat(canonical.value);
    const resolved = await realpath(canonical.value);
    if (!stat.isDirectory() || stat.isSymbolicLink() || resolved !== canonical.value) {
      return executionPublicationFailure(
        "execution.io",
        "/repositoryRoot",
        "Repository root must be one real directory.",
      );
    }
  } catch {
    return executionPublicationFailure(
      "execution.io",
      "/repositoryRoot",
      "Repository root could not be inspected safely.",
    );
  }
  const pinned = await pinPublicationDirectory(canonical.value);
  return pinned.ok ? canonical : executionFilesystemFailure(pinned, "/repositoryRoot");
}

/** Pins every canonical directory from the repository root through one execution target. */
export async function pinExecutionPublicationDirectoryChainV1(
  repositoryRoot: string,
  target: string,
): Promise<ExecutionOperationResultV1<readonly PublicationDirectoryIdentity[]>> {
  const relativeTarget = relative(repositoryRoot, target);
  if (
    !isAbsolute(target) ||
    normalize(target) !== target ||
    resolve(target) !== target ||
    relativeTarget.length === 0 ||
    relativeTarget === ".." ||
    relativeTarget.startsWith(`..${sep}`) ||
    isAbsolute(relativeTarget)
  ) {
    return executionPublicationFailure(
      "execution.identity",
      "",
      "Execution publication directory escaped its canonical repository root.",
    );
  }
  try {
    if (
      (await realpath(repositoryRoot)) !== repositoryRoot ||
      (await realpath(target)) !== target
    ) {
      return executionPublicationFailure(
        "execution.identity",
        "",
        "Execution publication directory traverses a substituted ancestor.",
      );
    }
  } catch {
    return executionPublicationFailure(
      "execution.io",
      "",
      "Execution publication directory chain could not be resolved safely.",
    );
  }
  const identities: PublicationDirectoryIdentity[] = [];
  let path = repositoryRoot;
  const root = await pinPublicationDirectory(path);
  if (!root.ok) return executionFilesystemFailure(root);
  identities.push(root.value);
  for (const segment of relativeTarget.split(sep)) {
    if (segment.length === 0 || segment === "." || segment === "..") {
      return executionPublicationFailure(
        "execution.identity",
        "",
        "Execution publication directory chain is not lexical.",
      );
    }
    path = join(path, segment);
    const pinned = await pinPublicationDirectory(path);
    if (!pinned.ok) return executionFilesystemFailure(pinned);
    identities.push(pinned.value);
  }
  return executionPublicationSuccess(Object.freeze(identities));
}

/** Revalidates every retained directory identity in one execution publication chain. */
export async function verifyExecutionPublicationDirectoryChainV1(
  directories: readonly PublicationDirectoryIdentity[],
): Promise<ExecutionOperationResultV1<true>> {
  for (const directory of directories) {
    const verified = await verifyPublicationDirectory(directory);
    if (!verified.ok) return executionFilesystemFailure(verified);
  }
  return executionPublicationSuccess(true);
}

async function readExecutionPublicationFile(
  path: string,
  limit: number,
  directories: readonly PublicationDirectoryIdentity[],
  expectedSize?: number,
): Promise<ExecutionOperationResultV1<PublicationBoundedRead>> {
  const before = await verifyExecutionPublicationDirectoryChainV1(directories);
  if (!before.ok) return before;
  const read = await readPublicationRegularFile(path, limit, expectedSize);
  if (!read.ok) return executionFilesystemFailure(read);
  const after = await verifyExecutionPublicationDirectoryChainV1(directories);
  return after.ok ? executionPublicationSuccess(read.value) : after;
}

/**
 * Authenticates one child release from its own exact files without reading parent or pointer state.
 *
 * @example
 * ```ts
 * const result = await validateExecutionPublicationReleaseRecordStateV1(
 *   repositoryRoot,
 *   releaseRoot,
 *   publicationDigest,
 * );
 * ```
 */
export async function validateExecutionPublicationReleaseRecordStateV1(
  repositoryRoot: string,
  releaseRoot: string,
  expectedDigest: string,
): Promise<ExecutionOperationResultV1<AuthenticatedExecutionReleaseRecordStateV1>> {
  const directories = await pinExecutionPublicationDirectoryChainV1(repositoryRoot, releaseRoot);
  if (!directories.ok) return directories;
  const directory = directories.value.at(-1);
  if (directory === undefined) {
    return executionPublicationFailure(
      "execution.identity",
      "",
      "Execution release directory chain is incomplete.",
    );
  }
  const expectedNames = sortExecutionPublicationText([
    ...EXECUTION_PUBLICATION_MEMBER_FILENAMES,
    EXECUTION_MANIFEST_V1_FILENAME,
  ]);
  const beforeNames = await verifyExecutionPublicationDirectoryChainV1(directories.value);
  if (!beforeNames.ok) return beforeNames;
  const names = await readPublicationDirectoryNames(directory, expectedNames.length);
  if (!names.ok) return executionFilesystemFailure(names);
  const afterNames = await verifyExecutionPublicationDirectoryChainV1(directories.value);
  if (!afterNames.ok) return afterNames;
  const actualNames = sortExecutionPublicationText(names.value);
  if (
    actualNames.length !== expectedNames.length ||
    actualNames.some((name, index) => name !== expectedNames[index])
  ) {
    return executionPublicationFailure(
      "execution.invalid-schema",
      "",
      "Execution release directory must contain exactly the four canonical members.",
    );
  }
  const manifestRead = await readExecutionPublicationFile(
    join(releaseRoot, EXECUTION_MANIFEST_V1_FILENAME),
    EXECUTION_PUBLICATION_MEMBER_LIMIT,
    directories.value,
  );
  if (!manifestRead.ok) return manifestRead;
  const manifest = parseExecutionManifestV1(manifestRead.value.bytes);
  if (!manifest.ok) return manifest;
  if (computeExecutionPublicationDigest(manifestRead.value.bytes) !== expectedDigest) {
    return executionPublicationFailure(
      "execution.identity",
      "",
      "Execution release directory does not match its content-derived digest.",
    );
  }
  const memberBytes = new Map<string, Uint8Array>();
  for (const member of manifest.value.members) {
    const read = await readExecutionPublicationFile(
      join(releaseRoot, member.path),
      member.byteLength,
      directories.value,
      member.byteLength,
    );
    if (!read.ok) return read;
    if (digestExecutionPublicationBytes(read.value.bytes) !== member.digest) {
      return executionPublicationFailure(
        "execution.identity",
        `/${member.path}`,
        "Execution publication member digest does not match its final bytes.",
      );
    }
    memberBytes.set(member.path, new Uint8Array(read.value.bytes));
  }
  const bindingBytes = memberBytes.get(EXECUTION_BINDINGS_V1_FILENAME);
  const parentBytes = memberBytes.get(EXECUTION_PARENT_V1_FILENAME);
  const reviewBytes = memberBytes.get(EXECUTION_SEMANTIC_REVIEW_V1_FILENAME);
  if (bindingBytes === undefined || parentBytes === undefined || reviewBytes === undefined) {
    return executionPublicationFailure(
      "execution.invalid-schema",
      "",
      "Execution publication is missing a canonical member.",
    );
  }
  const bindings = parseExecutionBindingsV1(bindingBytes);
  if (!bindings.ok) return bindings;
  const parentReference = parseExecutionParentReferenceV1(parentBytes);
  if (!parentReference.ok) return parentReference;
  if (parentReference.value.parentDigest !== manifest.value.parentDigest) {
    return executionPublicationFailure(
      "execution.stale-authority",
      "/parentDigest",
      "Execution parent reference does not reconstruct the manifest parent.",
    );
  }
  const bindingDigest = digestExecutionPublicationBytes(bindingBytes);
  const review = parseExecutionSemanticReviewV1(
    reviewBytes,
    manifest.value.parentDigest,
    bindingDigest,
  );
  if (!review.ok) return review;
  const finalDirectories = await verifyExecutionPublicationDirectoryChainV1(directories.value);
  if (!finalDirectories.ok) return finalDirectories;
  return executionPublicationSuccess(
    Object.freeze({
      release: Object.freeze({
        digest: expectedDigest,
        parentDigest: manifest.value.parentDigest,
        bindingDigest,
        semanticReviewDigest: digestExecutionPublicationBytes(reviewBytes),
        semanticReviewSpecRevision: review.value.specRevision,
        bindings: bindings.value.bindings,
        manifestBytes: new Uint8Array(manifestRead.value.bytes),
        members: memberBytes,
      }),
      directories: directories.value,
    }),
  );
}

/**
 * Authenticates one exact digest-named execution child without acquiring executable authority.
 *
 * @example
 * ```ts
 * const result = await resolvePublishedExecutionReleaseRecordByDigestV1({
 *   repositoryRoot,
 *   publicationDigest,
 * });
 * ```
 */
export async function resolvePublishedExecutionReleaseRecordByDigestV1(
  input: ResolvePublishedExecutionReleaseRecordInputV1,
): Promise<ExecutionOperationResultV1<PublishedExecutionReleaseRecordV1>> {
  if (typeof input !== "object" || input === null) {
    return executionPublicationFailure(
      "execution.invalid-schema",
      "",
      "Passive execution release input must be one exact object.",
    );
  }
  const repository = await validateExecutionPublicationRepositoryRootV1(input.repositoryRoot);
  if (!repository.ok) return repository;
  if (!isExecutionDigest(input.publicationDigest)) {
    return executionPublicationFailure(
      "execution.invalid-schema",
      "/publicationDigest",
      "Execution release digest must be canonical SHA-256.",
    );
  }
  const state = await validateExecutionPublicationReleaseRecordStateV1(
    repository.value,
    join(repository.value, EXECUTION_PUBLICATIONS_ROOT, "releases", input.publicationDigest),
    input.publicationDigest,
  );
  if (!state.ok) return state;
  const record = Object.freeze<PublishedExecutionReleaseRecordV1>({
    [publishedExecutionReleaseRecordV1Brand]: true,
  });
  RECORDS.set(record, state.value);
  return executionPublicationSuccess(record);
}

function projectedDigest(value: string): Sha256Digest | undefined {
  return isExecutionDigest(value) ? value : undefined;
}

/**
 * Returns fresh defensive bytes and identity facts for a genuine passive execution-child record.
 *
 * @example
 * ```ts
 * const projection = getPublishedExecutionReleaseRecordProjectionV1(record);
 * ```
 */
export function getPublishedExecutionReleaseRecordProjectionV1(
  record: PublishedExecutionReleaseRecordV1,
): ExecutionOperationResultV1<PublishedExecutionReleaseRecordProjectionV1> {
  const state = typeof record === "object" && record !== null ? RECORDS.get(record) : undefined;
  if (state === undefined) {
    return executionPublicationFailure(
      "execution.identity",
      "/record",
      "A genuine passive execution release record is required.",
    );
  }
  const publicationDigest = projectedDigest(state.release.digest);
  const parentDigest = projectedDigest(state.release.parentDigest);
  const bindingDigest = projectedDigest(state.release.bindingDigest);
  const semanticReviewDigest = projectedDigest(state.release.semanticReviewDigest);
  const manifestDigest = projectedDigest(
    digestExecutionPublicationBytes(state.release.manifestBytes),
  );
  if (
    publicationDigest === undefined ||
    parentDigest === undefined ||
    bindingDigest === undefined ||
    semanticReviewDigest === undefined ||
    manifestDigest === undefined
  ) {
    return executionPublicationFailure(
      "execution.identity",
      "/record",
      "Passive execution release identity is not canonical.",
    );
  }
  const manifestMember = Object.freeze({
    path: EXECUTION_MANIFEST_V1_FILENAME,
    digest: manifestDigest,
    byteLength: state.release.manifestBytes.byteLength,
    bytes: new Uint8Array(state.release.manifestBytes),
  });
  const members: PublishedExecutionReleaseRecordMemberV1[] = [manifestMember];
  for (const path of EXECUTION_PUBLICATION_MEMBER_FILENAMES) {
    const bytes = state.release.members.get(path);
    if (bytes === undefined) {
      return executionPublicationFailure(
        "execution.identity",
        "/record",
        "Passive execution release is missing retained member bytes.",
      );
    }
    const digest = projectedDigest(digestExecutionPublicationBytes(bytes));
    if (digest === undefined) {
      return executionPublicationFailure(
        "execution.identity",
        "/record",
        "Passive execution release member identity is not canonical.",
      );
    }
    members.push(
      Object.freeze({
        path,
        digest,
        byteLength: bytes.byteLength,
        bytes: new Uint8Array(bytes),
      }),
    );
  }
  members.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  return executionPublicationSuccess(
    Object.freeze({
      schemaVersion: 1 as const,
      publicationDigest,
      parentDigest,
      bindingDigest,
      semanticReviewDigest,
      semanticReviewSpecRevision: state.release.semanticReviewSpecRevision,
      bindings: Object.freeze(
        state.release.bindings.map((binding) => Object.freeze({ ...binding })),
      ),
      members: Object.freeze(members),
    }),
  );
}
