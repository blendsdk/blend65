import { lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import type { CompositeReadinessProjectionV1 } from "./execution-contracts.js";
import type { ExecutionOperationResultV1 } from "./execution-contracts.js";
import { retainPublishedExecutionReleaseStateV1 } from "./execution-publication-authority-state.js";
import {
  CURRENT_EXECUTION_PUBLICATION_FILENAME,
  EXECUTION_MANIFEST_V1_FILENAME,
  EXECUTION_PUBLICATION_RELEASE_LIMIT,
  EXECUTION_PUBLICATIONS_ROOT,
  digestExecutionPublicationBytes,
  executionFilesystemFailure,
  executionPublicationFailure,
  executionPublicationSuccess,
  parseExecutionPublicationPointerV1,
  sortExecutionPublicationText,
  type ExecutionPublicationBindingV1,
  type ValidatedExecutionPublicationV1,
} from "./execution-publication-model.js";
import {
  pinPublicationDirectory,
  readPublicationDirectoryNames,
  readPublicationRegularFile,
  type PublicationBoundedRead,
  type PublicationDirectoryIdentity,
} from "./publication-filesystem.js";
import {
  pinExecutionPublicationDirectoryChainV1,
  validateExecutionPublicationReleaseRecordStateV1,
  validateExecutionPublicationRepositoryRootV1,
  verifyExecutionPublicationDirectoryChainV1,
} from "./execution-publication-record.js";
import {
  isVerifiedExecutionPointerReplacementV1,
  readSelectedExecutionPublicationPointerV1,
} from "./execution-publication-pointer.js";
import {
  executionParentFailureV1,
  validateExecutionParentBindingsV1,
} from "./execution-publication-projection.js";
import { isExecutionDigest } from "./execution-validation.js";
import {
  getPublishedSnapshotAuthority,
  resolvePublishedSnapshotByDigest,
  type PublishedSnapshotAuthority,
} from "./publication-resolver.js";
import { PUBLICATION_POINTER_PATH, PUBLICATION_RELEASES_PATH } from "./publication-model.js";

export {
  pinExecutionPublicationDirectoryChainV1,
  validateExecutionPublicationRepositoryRootV1,
  verifyExecutionPublicationDirectoryChainV1,
} from "./execution-publication-record.js";
export { getPublishedExecutionReleaseDescriptorV1 } from "./execution-publication-authority-state.js";
export {
  createExecutionReviewCandidateProjectionV1,
  getCompositeReadinessAuthorityV2,
  getCompositeReadinessProjectionV1,
  getExecutionReviewCandidateProjectionDescriptorV1,
  resolveCompositeReadinessSnapshot,
} from "./execution-publication-projection.js";

declare const PUBLISHED_EXECUTION_RELEASE_BRAND: unique symbol;

/** Opaque executable-compatible authority for one fully revalidated immutable child release. */
export interface PublishedExecutionRelease {
  readonly [PUBLISHED_EXECUTION_RELEASE_BRAND]: true;
}

declare const COMPOSITE_READINESS_SNAPSHOT_BRAND: unique symbol;

/** Opaque combination of one exact parent snapshot and its reviewed child release. */
export interface CompositeReadinessSnapshot {
  readonly [COMPOSITE_READINESS_SNAPSHOT_BRAND]: true;
}

declare const EXECUTION_REVIEW_CANDIDATE_PROJECTION_BRAND: unique symbol;

/** Opaque parent/candidate projection that authorizes execution for review but not publication. */
export interface ExecutionReviewCandidateProjectionV1 {
  readonly [EXECUTION_REVIEW_CANDIDATE_PROJECTION_BRAND]: true;
}

/** Defensive facts retained for one genuine prepublication review projection. */
export interface ExecutionReviewCandidateProjectionDescriptorV1 {
  /** Canonical repository containing the selected parent. */
  readonly repositoryRoot: string;
  /** Exact selected parent digest used to validate the candidate bindings. */
  readonly parentDigest: string;
  /** Digest of the canonical six-row binding document. */
  readonly bindingDigest: string;
  /** Content-derived identity of campaign, orchestration, planning and report code. */
  readonly runnerRevision: string;
  /** Closed planner projection whose execution digest identifies the candidate. */
  readonly projection: CompositeReadinessProjectionV1;
}

/** Package-private executable-compatible release facts consumed by the live catalog owner. */
export interface PublishedExecutionReleaseDescriptorV1 {
  readonly repositoryRoot: string;
  readonly executionPublicationRoot: string;
  readonly executionReleaseRoot: string;
  readonly executionReleaseDevice: bigint;
  readonly executionReleaseInode: bigint;
  readonly executionPointerPath: string;
  readonly parentPointerPath: string;
  readonly digest: string;
  readonly parentDigest: string;
  readonly bindingDigest: string;
  readonly bindings: readonly ExecutionPublicationBindingV1[];
  readonly childReleaseFiles: readonly PublishedExecutionChildReleaseFileV1[];
  readonly parentFreshnessFiles: readonly PublishedExecutionParentFreshnessFileV1[];
}

/** Passive digest identity for one file used to prove the exact parent remains fresh. */
export interface PublishedExecutionParentFreshnessFileV1 {
  readonly path: string;
  readonly byteLength: number;
  readonly digest: string;
}

/** Passive exact-byte and filesystem identity for one immutable child release file. */
export interface PublishedExecutionChildReleaseFileV1 extends PublishedExecutionParentFreshnessFileV1 {
  readonly device: bigint;
  readonly inode: bigint;
}

/** Internal authenticated pair facts consumed by identity-only readiness providers. */
export interface CompositeReadinessAuthorityV2 {
  readonly projection: CompositeReadinessProjectionV1;
  readonly parentAuthority: PublishedSnapshotAuthority;
  readonly executionDigest: string;
}

const EXECUTION_SELECTED_POINTER_SUFFIX = join(
  EXECUTION_PUBLICATIONS_ROOT,
  CURRENT_EXECUTION_PUBLICATION_FILENAME,
);
interface ValidatedExecutionReleaseStateV1 {
  readonly release: ValidatedExecutionPublicationV1;
  readonly directories: readonly PublicationDirectoryIdentity[];
  readonly parentFreshnessFiles: readonly PublishedExecutionParentFreshnessFileV1[];
}

interface ResolvedParentAuthorityV1 {
  readonly authority: PublishedSnapshotAuthority;
  readonly freshnessFiles: readonly PublishedExecutionParentFreshnessFileV1[];
}

const PARENT_FRESHNESS_PATHS = Object.freeze([
  "readiness/inventory/compiler-readiness-v1.json",
  "readiness/inventory/rule-identities-v1.jsonl",
  "readiness/reviews/compiler-readiness-v1-review.json",
]);
const MAX_PARENT_FRESHNESS_FILES = 512;
const MAX_PARENT_FRESHNESS_FILE_BYTES = 8 * 1024 * 1024;
const MAX_PARENT_FRESHNESS_TOTAL_BYTES = 64 * 1024 * 1024;
const PARENT_MANIFEST_FILENAME = ["manifest", "json"].join(".");

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

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength && left.every((value, index) => value === right[index])
  );
}

function repositoryRelativePath(repositoryRoot: string, absolutePath: string): string | undefined {
  const path = relative(repositoryRoot, absolutePath).replaceAll("\\", "/");
  return path.length > 0 && !path.startsWith("../") && !isAbsolute(path) ? path : undefined;
}

async function readParentFreshnessFile(
  repositoryRoot: string,
  path: string,
  expectedBytes?: Uint8Array,
): Promise<ExecutionOperationResultV1<Uint8Array>> {
  const absolutePath = resolve(repositoryRoot, path);
  if (repositoryRelativePath(repositoryRoot, absolutePath) !== path) {
    return executionPublicationFailure(
      "execution.identity",
      `/${path}`,
      "Parent freshness path escaped its canonical repository root.",
    );
  }
  const directories = await pinExecutionPublicationDirectoryChainV1(
    repositoryRoot,
    dirname(absolutePath),
  );
  if (!directories.ok) return directories;
  const read = await readExecutionPublicationFile(
    absolutePath,
    MAX_PARENT_FRESHNESS_FILE_BYTES,
    directories.value,
    expectedBytes?.byteLength,
  );
  if (!read.ok) return read;
  if (expectedBytes !== undefined && !equalBytes(read.value.bytes, expectedBytes)) {
    return executionPublicationFailure(
      "execution.stale-authority",
      `/${path}`,
      "Parent freshness file changed after exact parent resolution.",
    );
  }
  return executionPublicationSuccess(new Uint8Array(read.value.bytes));
}

async function snapshotParentFreshnessFiles(
  repositoryRoot: string,
  expected: ReadonlyMap<string, Uint8Array>,
): Promise<ExecutionOperationResultV1<readonly PublishedExecutionParentFreshnessFileV1[]>> {
  if (expected.size === 0 || expected.size > MAX_PARENT_FRESHNESS_FILES) {
    return executionPublicationFailure(
      "execution.stale-authority",
      "/parentDigest",
      "Parent freshness closure exceeds its file-count bound.",
    );
  }
  let totalBytes = 0;
  const files: PublishedExecutionParentFreshnessFileV1[] = [];
  for (const [path, expectedBytes] of [...expected].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  )) {
    const read = await readParentFreshnessFile(repositoryRoot, path, expectedBytes);
    if (!read.ok) return read;
    totalBytes += read.value.byteLength;
    if (totalBytes > MAX_PARENT_FRESHNESS_TOTAL_BYTES) {
      return executionPublicationFailure(
        "execution.stale-authority",
        "/parentDigest",
        "Parent freshness closure exceeds its aggregate byte bound.",
      );
    }
    files.push(
      Object.freeze({
        path,
        byteLength: read.value.byteLength,
        digest: digestExecutionPublicationBytes(read.value),
      }),
    );
  }
  return executionPublicationSuccess(Object.freeze(files));
}

function retainExpectedParentBytes(
  expected: Map<string, Uint8Array>,
  path: string,
  bytes: Uint8Array,
): ExecutionOperationResultV1<true> {
  const existing = expected.get(path);
  if (existing !== undefined && !equalBytes(existing, bytes)) {
    return executionPublicationFailure(
      "execution.stale-authority",
      `/${path}`,
      "Parent freshness sources disagree about one retained file.",
    );
  }
  expected.set(path, new Uint8Array(bytes));
  return executionPublicationSuccess(true);
}

async function resolveParentAuthority(
  repositoryRoot: string,
  parentDigest: string,
  directories: readonly PublicationDirectoryIdentity[],
): Promise<ExecutionOperationResultV1<ResolvedParentAuthorityV1>> {
  if (!isExecutionDigest(parentDigest)) return executionParentFailureV1("/parentDigest");
  const parentManifestPath = join(
    PUBLICATION_RELEASES_PATH,
    parentDigest,
    PARENT_MANIFEST_FILENAME,
  ).replaceAll("\\", "/");
  const baseline = new Map<string, Uint8Array>();
  for (const path of [...PARENT_FRESHNESS_PATHS, parentManifestPath]) {
    const read = await readParentFreshnessFile(repositoryRoot, path);
    if (!read.ok) return read;
    baseline.set(path, read.value);
  }
  const before = await verifyExecutionPublicationDirectoryChainV1(directories);
  if (!before.ok) return before;
  const parent = await resolvePublishedSnapshotByDigest({
    repositoryRoot,
    publicationDigest: parentDigest,
  });
  if (!parent.ok) return executionParentFailureV1("/parentDigest");
  const after = await verifyExecutionPublicationDirectoryChainV1(directories);
  if (!after.ok) return after;
  const authority = getPublishedSnapshotAuthority(parent.value);
  if (authority === undefined) return executionParentFailureV1("/parentDigest");
  const expected = new Map(baseline);
  for (const [path, bytes] of authority.memberBytes) {
    const retained = retainExpectedParentBytes(
      expected,
      join(PUBLICATION_RELEASES_PATH, parentDigest, path).replaceAll("\\", "/"),
      bytes,
    );
    if (!retained.ok) return retained;
  }
  for (const source of [
    authority.candidateAuthorityBytes,
    authority.rendererAuthorityBytes,
    authority.publicationImplementationAuthority?.authorityBytes,
  ]) {
    if (source === undefined) continue;
    for (const [path, bytes] of source) {
      const retained = retainExpectedParentBytes(expected, path, bytes);
      if (!retained.ok) return retained;
    }
  }
  const freshnessFiles = await snapshotParentFreshnessFiles(repositoryRoot, expected);
  return freshnessFiles.ok
    ? executionPublicationSuccess(
        Object.freeze({ authority, freshnessFiles: freshnessFiles.value }),
      )
    : freshnessFiles;
}

/**
 * Revalidates one release directory from exact final bytes.
 *
 * This package-private operation is shared by staging validation and named resolution. It never
 * creates opaque authority by itself.
 */
async function validateExecutionPublicationReleaseStateV1(
  repositoryRoot: string,
  releaseRoot: string,
  expectedDigest: string,
): Promise<ExecutionOperationResultV1<ValidatedExecutionReleaseStateV1>> {
  const record = await validateExecutionPublicationReleaseRecordStateV1(
    repositoryRoot,
    releaseRoot,
    expectedDigest,
  );
  if (!record.ok) return record;
  const parent = await resolveParentAuthority(
    repositoryRoot,
    record.value.release.parentDigest,
    record.value.directories,
  );
  if (!parent.ok) return parent;
  if (
    record.value.release.semanticReviewSpecRevision !==
    parent.value.authority.inventory.specRevision
  ) {
    return executionPublicationFailure(
      "execution.stale-authority",
      "/specRevision",
      "Execution semantic review names a different parent inventory revision.",
    );
  }
  const declarationJoin = validateExecutionParentBindingsV1(
    parent.value.authority,
    record.value.release.bindings,
  );
  if (!declarationJoin.ok) return declarationJoin;
  const finalDirectories = await verifyExecutionPublicationDirectoryChainV1(
    record.value.directories,
  );
  if (!finalDirectories.ok) return finalDirectories;
  return executionPublicationSuccess(
    Object.freeze({
      release: record.value.release,
      directories: record.value.directories,
      parentFreshnessFiles: parent.value.freshnessFiles,
    }),
  );
}

export async function validateExecutionPublicationReleaseDirectoryV1(
  repositoryRoot: string,
  releaseRoot: string,
  expectedDigest: string,
): Promise<ExecutionOperationResultV1<ValidatedExecutionPublicationV1>> {
  const validated = await validateExecutionPublicationReleaseStateV1(
    repositoryRoot,
    releaseRoot,
    expectedDigest,
  );
  return validated.ok ? executionPublicationSuccess(validated.value.release) : validated;
}

function createPublishedExecutionRelease(
  repositoryRoot: string,
  release: ValidatedExecutionPublicationV1,
  releaseDirectory: PublicationDirectoryIdentity,
  parentFreshnessFiles: readonly PublishedExecutionParentFreshnessFileV1[],
): PublishedExecutionRelease {
  const childReleaseFiles = [
    {
      path: repositoryRelativePath(
        repositoryRoot,
        join(releaseDirectory.path, EXECUTION_MANIFEST_V1_FILENAME),
      ),
      bytes: release.manifestBytes,
    },
    ...[...release.members].map(([path, bytes]) => ({
      path: repositoryRelativePath(repositoryRoot, join(releaseDirectory.path, path)),
      bytes,
    })),
  ]
    .map(({ path, bytes }) => {
      if (path === undefined) {
        throw new TypeError("Execution release member escaped its canonical repository root.");
      }
      const absolutePath = resolve(repositoryRoot, path);
      const identity = lstatSync(absolutePath, { bigint: true });
      if (
        identity.isSymbolicLink() ||
        !identity.isFile() ||
        identity.nlink !== 1n ||
        identity.size !== BigInt(bytes.byteLength) ||
        realpathSync(absolutePath) !== absolutePath
      ) {
        throw new TypeError("Execution release member changed before authority minting.");
      }
      return Object.freeze({
        path,
        byteLength: bytes.byteLength,
        digest: digestExecutionPublicationBytes(bytes),
        device: identity.dev,
        inode: identity.ino,
      });
    })
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  const capability = Object.freeze({}) as PublishedExecutionRelease;
  retainPublishedExecutionReleaseStateV1(
    capability,
    Object.freeze({
      repositoryRoot,
      executionPublicationRoot: join(repositoryRoot, EXECUTION_PUBLICATIONS_ROOT),
      executionReleaseRoot: releaseDirectory.path,
      executionReleaseDevice: releaseDirectory.device,
      executionReleaseInode: releaseDirectory.inode,
      executionPointerPath: join(repositoryRoot, EXECUTION_SELECTED_POINTER_SUFFIX),
      parentPointerPath: join(repositoryRoot, PUBLICATION_POINTER_PATH),
      digest: release.digest,
      parentDigest: release.parentDigest,
      bindingDigest: release.bindingDigest,
      semanticReviewDigest: release.semanticReviewDigest,
      bindings: release.bindings,
      childReleaseFiles: Object.freeze(childReleaseFiles),
      parentFreshnessFiles,
      memberBytes: release.members,
    }),
  );
  return capability;
}

const RETRY_SELECTED_EXECUTION_RESOLUTION = Object.freeze({ retry: true as const });

function readSelectedDigest(
  repositoryRoot: string,
  directories: readonly PublicationDirectoryIdentity[],
): ExecutionOperationResultV1<string> | typeof RETRY_SELECTED_EXECUTION_RESOLUTION {
  const pointerPath = join(
    repositoryRoot,
    EXECUTION_PUBLICATIONS_ROOT,
    CURRENT_EXECUTION_PUBLICATION_FILENAME,
  );
  const read = readSelectedExecutionPublicationPointerV1(pointerPath, 512, directories);
  if (!read.ok) {
    return isVerifiedExecutionPointerReplacementV1(read)
      ? RETRY_SELECTED_EXECUTION_RESOLUTION
      : executionFilesystemFailure(read);
  }
  const pointer = parseExecutionPublicationPointerV1(read.value.bytes);
  return pointer.ok ? executionPublicationSuccess(pointer.value.publicationDigest) : pointer;
}

async function resolveNamedExecutionRelease(
  repositoryRoot: string,
  releaseDigest: string,
): Promise<ExecutionOperationResultV1<PublishedExecutionRelease>> {
  const release = await validateExecutionPublicationReleaseStateV1(
    repositoryRoot,
    join(repositoryRoot, EXECUTION_PUBLICATIONS_ROOT, "releases", releaseDigest),
    releaseDigest,
  );
  if (!release.ok) return release;
  const final = await verifyExecutionPublicationDirectoryChainV1(release.value.directories);
  return final.ok
    ? executionPublicationSuccess(
        createPublishedExecutionRelease(
          repositoryRoot,
          release.value.release,
          release.value.directories.at(-1)!,
          release.value.parentFreshnessFiles,
        ),
      )
    : final;
}

async function resolveSelectedExecutionReleaseAttempt(
  repositoryRoot: string,
): Promise<
  ExecutionOperationResultV1<PublishedExecutionRelease> | typeof RETRY_SELECTED_EXECUTION_RESOLUTION
> {
  const baseDirectories = await pinExecutionPublicationDirectoryChainV1(
    repositoryRoot,
    join(repositoryRoot, EXECUTION_PUBLICATIONS_ROOT),
  );
  if (!baseDirectories.ok) return baseDirectories;
  const selected = readSelectedDigest(repositoryRoot, baseDirectories.value);
  if ("retry" in selected) return selected;
  if (!selected.ok) return selected;
  const release = await validateExecutionPublicationReleaseStateV1(
    repositoryRoot,
    join(repositoryRoot, EXECUTION_PUBLICATIONS_ROOT, "releases", selected.value),
    selected.value,
  );
  if (!release.ok) return release;
  const finalSelected = readSelectedDigest(repositoryRoot, release.value.directories);
  if ("retry" in finalSelected) return finalSelected;
  if (!finalSelected.ok) return finalSelected;
  if (finalSelected.value !== selected.value) {
    return executionPublicationFailure(
      "execution.stale-authority",
      "",
      "Selected execution publication changed during complete resolution.",
    );
  }
  const finalDirectories = await verifyExecutionPublicationDirectoryChainV1(
    release.value.directories,
  );
  if (!finalDirectories.ok) return finalDirectories;
  const commitSelected = readSelectedDigest(repositoryRoot, release.value.directories);
  if ("retry" in commitSelected) return commitSelected;
  if (!commitSelected.ok) return commitSelected;
  if (commitSelected.value !== selected.value) {
    return executionPublicationFailure(
      "execution.stale-authority",
      "",
      "Selected execution publication changed before executable-compatible authority minting.",
    );
  }
  return executionPublicationSuccess(
    createPublishedExecutionRelease(
      repositoryRoot,
      release.value.release,
      release.value.directories.at(-1)!,
      release.value.parentFreshnessFiles,
    ),
  );
}

/**
 * Resolves one named or selected immutable execution release into executable-compatible authority.
 *
 * @param root Canonical repository root.
 * @param digest Optional exact child digest; absence resolves the selected pointer.
 */
export async function resolvePublishedExecutionRelease(
  root: string,
  digest?: string,
): Promise<ExecutionOperationResultV1<PublishedExecutionRelease>> {
  const repository = await validateExecutionPublicationRepositoryRootV1(root);
  if (!repository.ok) return repository;
  if (digest === undefined) {
    const first = await resolveSelectedExecutionReleaseAttempt(repository.value);
    if (!("retry" in first)) return first;
    const second = await resolveSelectedExecutionReleaseAttempt(repository.value);
    return "retry" in second
      ? executionPublicationFailure(
          "execution.stale-authority",
          "",
          "Selected execution publication changed more than once during resolution.",
        )
      : second;
  }
  if (!isExecutionDigest(digest)) {
    return executionPublicationFailure(
      "execution.invalid-schema",
      "/digest",
      "Execution release digest must be canonical SHA-256.",
    );
  }
  return resolveNamedExecutionRelease(repository.value, digest);
}

/** Lists digest-named immutable child directories without resolving or selecting them. */
export async function listExecutionPublicationReleaseDigestsV1(
  repositoryRoot: string,
): Promise<ExecutionOperationResultV1<readonly string[]>> {
  const root = join(repositoryRoot, EXECUTION_PUBLICATIONS_ROOT, "releases");
  const directory = await pinPublicationDirectory(root);
  if (!directory.ok) return executionFilesystemFailure(directory);
  const names = await readPublicationDirectoryNames(
    directory.value,
    EXECUTION_PUBLICATION_RELEASE_LIMIT,
  );
  if (!names.ok) return executionFilesystemFailure(names);
  return executionPublicationSuccess(
    sortExecutionPublicationText(names.value.filter((name) => /^sha256:[0-9a-f]{64}$/u.test(name))),
  );
}
