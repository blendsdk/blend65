import { realpath } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import { currentPublicationConformance } from "./publication-conformance-v1.js";
import {
  pinPublicationDirectory,
  readPublicationRegularFile,
  readSelectedPublicationPointer,
  verifyPublicationDirectory,
  type PublicationBoundedRead,
  type PublicationDirectoryIdentity,
} from "./publication-filesystem.js";
import {
  PUBLICATION_RELEASES_PATH,
  PUBLICATION_ROOT_PATH,
  digestPublicationBytes,
  publicationFailure,
  publicationSuccess,
  type PublicationResult,
} from "./publication-model.js";
import type { Sha256Digest } from "./model-registry-model.js";

/** Compares two bounded publication byte sequences without decoding them. */
export function equalPublicationBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength && left.every((value, index) => value === right[index])
  );
}

/** Deep-freezes an already detached publication value. */
export function deepFreezePublicationValue<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  const pending: object[] = [value];
  const seen = new Set<object>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined || seen.has(current)) continue;
    seen.add(current);
    for (const child of Object.values(current)) {
      if (typeof child === "object" && child !== null) pending.push(child);
    }
    Object.freeze(current);
  }
  return value;
}

/** Copies retained authority bytes so callers cannot mutate an authenticated snapshot. */
export function copyPublicationBytesMap(
  source: ReadonlyMap<string, Uint8Array> | undefined,
): ReadonlyMap<string, Uint8Array> | undefined {
  return source === undefined
    ? undefined
    : new Map([...source].map(([path, bytes]) => [path, bytes.slice()] as const));
}

/** Applies the installed publication digest conformance, with the canonical fallback. */
export function digestPublicationAuthority(domain: string, bytes: Uint8Array): Sha256Digest {
  return currentPublicationConformance()?.digest?.(domain, bytes) ?? digestPublicationBytes(bytes);
}

/** Resolves one canonical, non-symbolic repository root. */
export async function canonicalPublicationRepositoryRoot(
  repositoryRoot: string,
): Promise<PublicationResult<string>> {
  if (!isAbsolute(repositoryRoot) || resolve(repositoryRoot) !== repositoryRoot) {
    return publicationFailure(
      "invalid",
      "publication.path.invalid",
      "/repositoryRoot",
      "Repository root must be a canonical absolute path.",
    );
  }
  try {
    if ((await realpath(repositoryRoot)) !== repositoryRoot) {
      return publicationFailure(
        "invalid",
        "publication.path.invalid",
        "/repositoryRoot",
        "Repository root must not traverse a symbolic link.",
      );
    }
    return publicationSuccess(repositoryRoot);
  } catch {
    return publicationFailure(
      "io",
      "publication.io",
      "/repositoryRoot",
      "Repository root could not be resolved.",
    );
  }
}

/** Pins the complete directory chain used by one publication resolution. */
export async function pinPublicationDirectoryChain(
  repositoryRoot: string,
  publicationDigest?: Sha256Digest,
): Promise<PublicationResult<readonly PublicationDirectoryIdentity[]>> {
  const paths = [
    repositoryRoot,
    join(repositoryRoot, "readiness"),
    join(repositoryRoot, PUBLICATION_ROOT_PATH),
    join(repositoryRoot, PUBLICATION_RELEASES_PATH),
    ...(publicationDigest === undefined
      ? []
      : [join(repositoryRoot, PUBLICATION_RELEASES_PATH, publicationDigest)]),
  ];
  const identities: PublicationDirectoryIdentity[] = [];
  for (const path of paths) {
    const identity = await pinPublicationDirectory(path);
    if (!identity.ok) return identity;
    identities.push(identity.value);
  }
  return publicationSuccess(Object.freeze(identities));
}

/** Reads a bounded regular file while verifying every pinned directory before and after. */
export async function readPinnedPublicationFile(
  path: string,
  limit: number,
  directories: readonly PublicationDirectoryIdentity[],
  selectedPointer = false,
): Promise<PublicationResult<PublicationBoundedRead>> {
  for (const directory of directories) {
    const verified = await verifyPublicationDirectory(directory);
    if (!verified.ok) return verified;
  }
  const read = selectedPointer
    ? await readSelectedPublicationPointer(path, limit, directories)
    : await readPublicationRegularFile(path, limit);
  if (!read.ok) return read;
  for (const directory of directories) {
    const verified = await verifyPublicationDirectory(directory);
    if (!verified.ok) return verified;
  }
  return read;
}
