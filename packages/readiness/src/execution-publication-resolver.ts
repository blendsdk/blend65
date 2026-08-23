import { lstat, realpath } from "node:fs/promises";
import { lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";

import type { PublishedSnapshot } from "./binding-model.js";
import {
  type CompositeReadinessProjectionV1,
  type ExecutionCapabilityProjectionV1,
  type ExecutionOperationResultV1,
  type ExecutionRuleProjectionV1,
  isExecutionTierV1,
} from "./execution-contracts.js";
import {
  CURRENT_EXECUTION_PUBLICATION_FILENAME,
  EXECUTION_BINDINGS_V1_FILENAME,
  EXECUTION_MANIFEST_V1_FILENAME,
  EXECUTION_PARENT_V1_FILENAME,
  EXECUTION_PUBLICATION_MEMBER_FILENAMES,
  EXECUTION_PUBLICATION_MEMBER_LIMIT,
  EXECUTION_PUBLICATION_RELEASE_LIMIT,
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
  parseExecutionPublicationPointerV1,
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
import {
  isVerifiedExecutionPointerReplacementV1,
  readSelectedExecutionPublicationPointerV1,
} from "./execution-publication-pointer.js";
import { MODELED_RULE_FACTS } from "./modeled-generator-facts.js";
import type { ExecutionTierV1 } from "./execution-contracts.js";
import { isExecutionDigest } from "./execution-validation.js";
import {
  getPublishedSnapshotAuthority,
  resolvePublishedSnapshotByDigest,
  type PublishedSnapshotAuthority,
} from "./publication-resolver.js";
import { PUBLICATION_POINTER_PATH, PUBLICATION_RELEASES_PATH } from "./publication-model.js";

declare const PUBLISHED_EXECUTION_RELEASE_BRAND: unique symbol;

/** Opaque passive authority for one fully revalidated immutable child release. */
export interface PublishedExecutionRelease {
  readonly [PUBLISHED_EXECUTION_RELEASE_BRAND]: true;
}

declare const COMPOSITE_READINESS_SNAPSHOT_BRAND: unique symbol;

/** Opaque combination of one exact parent snapshot and its reviewed child release. */
export interface CompositeReadinessSnapshot {
  readonly [COMPOSITE_READINESS_SNAPSHOT_BRAND]: true;
}

/** Package-private passive release facts consumed by the live catalog owner. */
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

interface PublishedExecutionReleaseState extends PublishedExecutionReleaseDescriptorV1 {
  readonly semanticReviewDigest: string;
  readonly memberBytes: ReadonlyMap<string, Uint8Array>;
}

interface CompositeReadinessSnapshotState {
  readonly projection: CompositeReadinessProjectionV1;
}

const RELEASES = new WeakMap<object, PublishedExecutionReleaseState>();
const COMPOSITES = new WeakMap<object, CompositeReadinessSnapshotState>();
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

function parentFailure<T>(path: string): ExecutionOperationResultV1<T> {
  return executionPublicationFailure(
    "execution.stale-authority",
    path,
    "Execution publication does not name one available compatible parent release.",
  );
}

function exactParentBindings(
  parent: PublishedSnapshotAuthority,
  bindings: readonly ExecutionPublicationBindingV1[],
): ExecutionOperationResultV1<true> {
  const declarations = parent.inventory.evidenceCapabilityDeclarations;
  if (declarations.length !== bindings.length) return parentFailure("/bindings");
  for (let index = 0; index < bindings.length; index += 1) {
    const binding = bindings[index];
    const matches = declarations.filter((entry) => entry.id === binding.capabilityId);
    const declaration = matches[0];
    if (matches.length !== 1 || declaration === undefined) {
      return parentFailure(`/bindings/${index}/capabilityId`);
    }
    if (
      declaration.contractVersion !== binding.contractVersion ||
      declaration.binding !== "unbound"
    ) {
      return parentFailure(`/bindings/${index}/contractVersion`);
    }
  }
  return executionPublicationSuccess(true);
}

async function resolveParentAuthority(
  repositoryRoot: string,
  parentDigest: string,
  directories: readonly PublicationDirectoryIdentity[],
): Promise<ExecutionOperationResultV1<ResolvedParentAuthorityV1>> {
  if (!isExecutionDigest(parentDigest)) return parentFailure("/parentDigest");
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
  if (!parent.ok) return parentFailure("/parentDigest");
  const after = await verifyExecutionPublicationDirectoryChainV1(directories);
  if (!after.ok) return after;
  const authority = getPublishedSnapshotAuthority(parent.value);
  if (authority === undefined) return parentFailure("/parentDigest");
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
 * creates passive authority by itself.
 */
async function validateExecutionPublicationReleaseStateV1(
  repositoryRoot: string,
  releaseRoot: string,
  expectedDigest: string,
): Promise<ExecutionOperationResultV1<ValidatedExecutionReleaseStateV1>> {
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
    return parentFailure("/parentDigest");
  }
  const bindingDigest = digestExecutionPublicationBytes(bindingBytes);
  const review = parseExecutionSemanticReviewV1(
    reviewBytes,
    manifest.value.parentDigest,
    bindingDigest,
  );
  if (!review.ok) return review;
  const parent = await resolveParentAuthority(
    repositoryRoot,
    manifest.value.parentDigest,
    directories.value,
  );
  if (!parent.ok) return parent;
  if (review.value.specRevision !== parent.value.authority.inventory.specRevision) {
    return executionPublicationFailure(
      "execution.stale-authority",
      "/specRevision",
      "Execution semantic review names a different parent inventory revision.",
    );
  }
  const declarationJoin = exactParentBindings(parent.value.authority, bindings.value.bindings);
  if (!declarationJoin.ok) return declarationJoin;
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
        throw new TypeError("Execution release member changed before passive authority minting.");
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
  RELEASES.set(
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
      "Selected execution publication changed immediately before passive authority minting.",
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
 * Resolves one named or selected immutable execution release into passive opaque authority.
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

function boundaryFamilyId(
  fact: typeof MODELED_RULE_FACTS extends ReadonlyMap<string, infer T> ? T : never,
): string {
  return fact.kind === "scalar"
    ? `boundary.scalar.${fact.scalarType}`
    : `boundary.memory.${fact.intrinsic}`;
}

function projectModeledRules(
  parent: PublishedSnapshotAuthority,
): ExecutionOperationResultV1<readonly ExecutionRuleProjectionV1[]> {
  const projections: ExecutionRuleProjectionV1[] = [];
  const facts = [...MODELED_RULE_FACTS.values()].sort((left, right) =>
    left.ruleId < right.ruleId ? -1 : left.ruleId > right.ruleId ? 1 : 0,
  );
  for (const fact of facts) {
    const matches = parent.inventory.rules.filter((rule) => rule.ruleId === fact.ruleId);
    const rule = matches[0];
    if (matches.length !== 1 || rule === undefined) return parentFailure(`/rules/${fact.ruleId}`);
    const sortedObligations = sortExecutionPublicationText(rule.evidenceObligations);
    if (
      sortedObligations.length === 0 ||
      new Set(sortedObligations).size !== sortedObligations.length ||
      sortedObligations.some((obligation) => !isExecutionTierV1(obligation))
    ) {
      return parentFailure(`/rules/${fact.ruleId}/evidenceObligations`);
    }
    const obligations: ExecutionTierV1[] = [];
    for (const obligation of sortedObligations) {
      if (isExecutionTierV1(obligation)) obligations.push(obligation);
    }
    projections.push(
      Object.freeze({
        ruleId: fact.ruleId,
        applicability: rule.applicability,
        evidenceObligations: obligations,
        boundaryFamilyIds: Object.freeze([boundaryFamilyId(fact)]),
      }),
    );
  }
  return executionPublicationSuccess(Object.freeze(projections));
}

/** Resolves an exact parent-child pair into opaque passive composite authority. */
export function resolveCompositeReadinessSnapshot(
  parent: PublishedSnapshot,
  execution: PublishedExecutionRelease,
): ExecutionOperationResultV1<CompositeReadinessSnapshot> {
  const parentState = getPublishedSnapshotAuthority(parent);
  const childState =
    typeof execution === "object" && execution !== null ? RELEASES.get(execution) : undefined;
  if (parentState === undefined || childState === undefined) {
    return executionPublicationFailure(
      "execution.identity",
      "",
      "A genuine parent snapshot and execution release are required.",
    );
  }
  if (
    parentState.repositoryRoot !== childState.repositoryRoot ||
    parentState.publicationDigest !== childState.parentDigest
  ) {
    return parentFailure("/parentDigest");
  }
  const joined = exactParentBindings(parentState, childState.bindings);
  if (!joined.ok) return joined;
  const rules = projectModeledRules(parentState);
  if (!rules.ok) return rules;
  const capabilities: ExecutionCapabilityProjectionV1[] = [];
  for (const declaration of parentState.inventory.evidenceCapabilityDeclarations) {
    const binding = childState.bindings.find((row) => row.capabilityId === declaration.id);
    if (binding === undefined || declaration.binding !== "unbound") {
      return parentFailure(`/capabilities/${declaration.id}`);
    }
    capabilities.push(Object.freeze({ capabilityId: binding.capabilityId, state: "bound" }));
  }
  const projection: CompositeReadinessProjectionV1 = Object.freeze({
    parentDigest: parentState.publicationDigest,
    executionDigest: childState.digest,
    capabilities: Object.freeze(capabilities),
    rules: rules.value,
  });
  const composite = Object.freeze({}) as CompositeReadinessSnapshot;
  COMPOSITES.set(composite, Object.freeze({ projection }));
  return executionPublicationSuccess(composite);
}

/** Returns the immutable closed planner projection only for a genuine composite capability. */
export function getCompositeReadinessProjectionV1(
  composite: CompositeReadinessSnapshot,
): ExecutionOperationResultV1<CompositeReadinessProjectionV1> {
  const state =
    typeof composite === "object" && composite !== null ? COMPOSITES.get(composite) : undefined;
  return state === undefined
    ? executionPublicationFailure(
        "execution.identity",
        "",
        "A genuine composite readiness snapshot is required.",
      )
    : executionPublicationSuccess(state.projection);
}

/** Returns defensive passive release facts for the dependency-safe live package handoff. */
export function getPublishedExecutionReleaseDescriptorV1(
  release: PublishedExecutionRelease,
): PublishedExecutionReleaseDescriptorV1 | undefined {
  const state = typeof release === "object" && release !== null ? RELEASES.get(release) : undefined;
  if (state === undefined) return undefined;
  return Object.freeze({
    repositoryRoot: state.repositoryRoot,
    executionPublicationRoot: state.executionPublicationRoot,
    executionReleaseRoot: state.executionReleaseRoot,
    executionReleaseDevice: state.executionReleaseDevice,
    executionReleaseInode: state.executionReleaseInode,
    executionPointerPath: state.executionPointerPath,
    parentPointerPath: state.parentPointerPath,
    digest: state.digest,
    parentDigest: state.parentDigest,
    bindingDigest: state.bindingDigest,
    bindings: Object.freeze(state.bindings.map((row) => Object.freeze({ ...row }))),
    childReleaseFiles: Object.freeze(
      state.childReleaseFiles.map((file) => Object.freeze({ ...file })),
    ),
    parentFreshnessFiles: Object.freeze(
      state.parentFreshnessFiles.map((file) => Object.freeze({ ...file })),
    ),
  });
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
