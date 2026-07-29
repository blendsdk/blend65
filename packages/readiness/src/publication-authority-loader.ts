import { dirname, join } from "node:path";

import type { GeneratedCandidateRevision } from "./modeled-candidate-revisions.generated.js";
import {
  type ImplementationRevisionInput,
  type ImplementationRevisionValidationResult,
  validateImplementationRevision,
} from "./implementation-revision.js";
import {
  pinPublicationDirectory,
  readPublicationRegularFile,
  verifyPublicationDirectory,
  type PublicationDirectoryIdentity,
} from "./publication-filesystem.js";
import {
  publicationFailure,
  publicationSuccess,
  type PublicationResult,
} from "./publication-model.js";

const MAX_AUTHORITY_FILES = 4_096;
const MAX_AUTHORITY_FILE_BYTES = 16_777_216;
const MAX_AUTHORITY_TOTAL_BYTES = 16_777_216;

function isCanonicalRelativePath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.includes("\u0000") &&
    path.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
  );
}

function authorityDirectories(repositoryRoot: string, paths: readonly string[]): readonly string[] {
  const directories = new Set<string>([repositoryRoot]);
  for (const path of paths) {
    const parent = dirname(path);
    if (parent === ".") continue;
    const segments = parent.split("/");
    let current = repositoryRoot;
    for (const segment of segments) {
      current = join(current, segment);
      directories.add(current);
    }
  }
  return Object.freeze([...directories].sort());
}

async function pinDirectories(
  paths: readonly string[],
): Promise<PublicationResult<readonly PublicationDirectoryIdentity[]>> {
  const identities: PublicationDirectoryIdentity[] = [];
  for (const path of paths) {
    const pinned = await pinPublicationDirectory(path);
    if (!pinned.ok) return pinned;
    identities.push(pinned.value);
  }
  return publicationSuccess(Object.freeze(identities));
}

async function verifyDirectories(
  directories: readonly PublicationDirectoryIdentity[],
): Promise<PublicationResult<true>> {
  for (const directory of directories) {
    const verified = await verifyPublicationDirectory(directory);
    if (!verified.ok) return verified;
  }
  return publicationSuccess(true);
}

/**
 * Reads a bounded lexical implementation closure once through stable regular-file handles.
 *
 * @param repositoryRoot Canonical repository root.
 * @param dependencyPaths Lexical, unique repository-relative paths.
 * @returns Exact retained bytes keyed by dependency path.
 *
 * @example
 * ```ts
 * const authority = await readPublicationAuthorityFiles(root, revision.dependencyPaths);
 * ```
 */
export async function readPublicationAuthorityFiles(
  repositoryRoot: string,
  dependencyPaths: readonly string[],
): Promise<PublicationResult<ReadonlyMap<string, Uint8Array>>> {
  if (
    !Array.isArray(dependencyPaths) ||
    dependencyPaths.length === 0 ||
    dependencyPaths.length > MAX_AUTHORITY_FILES ||
    dependencyPaths.some(
      (path, index) =>
        typeof path !== "string" ||
        !isCanonicalRelativePath(path) ||
        (index > 0 && dependencyPaths[index - 1] >= path),
    )
  ) {
    return publicationFailure(
      "invalid",
      "publication.input.invalid",
      "/dependencyPaths",
      "Implementation dependency paths must be a bounded lexical unique closure.",
    );
  }
  const directories = await pinDirectories(authorityDirectories(repositoryRoot, dependencyPaths));
  if (!directories.ok) return directories;

  const files = new Map<string, Uint8Array>();
  let totalBytes = 0;
  for (const path of dependencyPaths) {
    const read = await readPublicationRegularFile(
      join(repositoryRoot, path),
      MAX_AUTHORITY_FILE_BYTES,
    );
    if (!read.ok) return read;
    totalBytes += read.value.size;
    if (totalBytes > MAX_AUTHORITY_TOTAL_BYTES) {
      return publicationFailure(
        "invalid",
        "publication.input.limit",
        path,
        "Implementation dependency bytes exceed the aggregate authority limit.",
      );
    }
    files.set(path, read.value.bytes);
  }
  const verified = await verifyDirectories(directories.value);
  if (!verified.ok) return verified;
  return publicationSuccess(files);
}

/**
 * Validates one generated implementation claim against already retained exact bytes.
 *
 * @param revision Generated entrypoint, closure and claimed revision.
 * @param authority Exact bytes keyed by every generated dependency path.
 * @returns Fresh implementation authority or deterministic validation diagnostics.
 *
 * @example
 * ```ts
 * const freshness = validatePublicationImplementation(revision, authority);
 * ```
 */
export function validatePublicationImplementation(
  revision: GeneratedCandidateRevision,
  authority: ReadonlyMap<string, Uint8Array>,
): ImplementationRevisionValidationResult {
  const metadata: ImplementationRevisionInput = {
    contractVersion: "1.0.0",
    entryPath: revision.entryPath,
    files: revision.dependencyPaths.map((path) => ({
      path,
      content: authority.get(path) ?? new Uint8Array(),
    })),
  };
  if (revision.dependencyPaths.some((path) => !authority.has(path))) {
    return validateImplementationRevision({
      claimedRevision: revision.claimedRevision,
      metadata: { ...metadata, entryPath: "__missing_authority__" },
    });
  }
  return validateImplementationRevision({
    claimedRevision: revision.claimedRevision,
    metadata,
  });
}
