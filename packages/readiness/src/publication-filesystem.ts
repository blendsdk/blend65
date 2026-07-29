import { constants } from "node:fs";
import { lstat, mkdir, open, opendir, rename, rm, type FileHandle } from "node:fs/promises";
import { isAbsolute, join, normalize, sep } from "node:path";

import { publicationFilesystemFaultPoint } from "./publication-conformance-v1.js";
import {
  publicationFailure,
  publicationSuccess,
  type PublicationResult,
} from "./publication-model.js";

/* v8 ignore next -- the fallback is exercised only on hosts that omit this platform constant. */
const NO_FOLLOW = "O_NOFOLLOW" in constants ? constants.O_NOFOLLOW : 0;
/* v8 ignore next -- the fallback is exercised only on hosts that omit this platform constant. */
const DIRECTORY_ONLY = "O_DIRECTORY" in constants ? constants.O_DIRECTORY : 0;
/* v8 ignore next -- the fallback is exercised only on hosts that omit this platform constant. */
const NON_BLOCKING = "O_NONBLOCK" in constants ? constants.O_NONBLOCK : 0;
const SELECTED_POINTER_SUFFIX = join("readiness", "publications", "current-publication.json");
const VERIFIED_POINTER_REPLACEMENTS = new WeakSet<object>();

interface DetachedSelectedPointer {
  readonly device: bigint;
  readonly inode: bigint;
  readonly size: bigint;
}

/** Stable identity retained for one verified real directory. */
export interface PublicationDirectoryIdentity {
  /** Canonical absolute directory path. */
  readonly path: string;
  /** Filesystem device identity. */
  readonly device: bigint;
  /** Filesystem inode identity. */
  readonly inode: bigint;
}

/** Bounded bytes read from one stable single-link regular file. */
export interface PublicationBoundedRead {
  /** Exact bytes read through the verified file handle. */
  readonly bytes: Uint8Array;
  /** Verified byte length. */
  readonly size: number;
}

/** Result of creating or reopening one pinned child directory. */
export interface PublicationChildDirectory {
  /** Stable child identity. */
  readonly identity: PublicationDirectoryIdentity;
  /** Whether this operation created the directory entry. */
  readonly created: boolean;
}

function isLinkTraversalError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "ELOOP" || error.code === "EMULTIHOP")
  );
}

function isAlreadyExists(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EEXIST" || error.code === "ENOTEMPTY")
  );
}

function durabilityUnsupported(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EINVAL" ||
      error.code === "ENOTSUP" ||
      error.code === "EOPNOTSUPP" ||
      error.code === "ENOSYS")
  );
}

function pathOpenFailure<T>(
  error: unknown,
  path: string,
  linkMessage: string,
  ioMessage: string,
): PublicationResult<T> {
  if (isLinkTraversalError(error)) {
    return publicationFailure("invalid", "publication.path.invalid", path, linkMessage);
  }
  return publicationFailure("io", "publication.io", path, ioMessage);
}

function synchronizationFailure<T>(
  error: unknown,
  path: string,
  unsupportedMessage: string,
  ioMessage: string,
): PublicationResult<T> {
  if (durabilityUnsupported(error)) {
    return publicationFailure(
      "durability-unsupported",
      "publication.durability-unsupported",
      path,
      unsupportedMessage,
    );
  }
  return publicationFailure("io", "publication.io", path, ioMessage);
}

function lexicalEntryName(name: string): boolean {
  return (
    name.length > 0 && name !== "." && name !== ".." && !name.includes("/") && !name.includes("\\")
  );
}

function sameIdentity(
  left: PublicationDirectoryIdentity,
  right: PublicationDirectoryIdentity,
): boolean {
  return left.device === right.device && left.inode === right.inode;
}

function isCanonicalSelectedPointerPath(path: string): boolean {
  return (
    isAbsolute(path) &&
    normalize(path) === path &&
    path.endsWith(`${sep}${SELECTED_POINTER_SUFFIX}`)
  );
}

function verifiedPointerReplacement<T>(path: string): PublicationResult<T> {
  const result = publicationFailure<T>(
    "invalid",
    "publication.path.invalid",
    path,
    "Selected publication pointer identity changed during verification.",
  );
  VERIFIED_POINTER_REPLACEMENTS.add(result);
  return result;
}

async function openedDirectoryIdentity(
  path: string,
  handle: FileHandle,
): Promise<PublicationResult<PublicationDirectoryIdentity>> {
  const stat = await handle.stat({ bigint: true });
  if (!stat.isDirectory()) {
    return publicationFailure(
      "invalid",
      "publication.path.invalid",
      path,
      "Publication path component must be a real directory.",
    );
  }
  return publicationSuccess({ path, device: stat.dev, inode: stat.ino });
}

/**
 * Pins one existing directory without accepting a symbolic-link component.
 *
 * On hosts without `O_NOFOLLOW`, the surrounding `lstat` and handle identity comparison provides
 * the portable compensating check. A later identity mismatch fails the transaction before pointer
 * replacement.
 */
export async function pinPublicationDirectory(
  path: string,
): Promise<PublicationResult<PublicationDirectoryIdentity>> {
  let handle: FileHandle | undefined;
  try {
    const before = await lstat(path, { bigint: true });
    if (!before.isDirectory() || before.isSymbolicLink()) {
      return publicationFailure(
        "invalid",
        "publication.path.invalid",
        path,
        "Publication path component must be a real directory.",
      );
    }
    await publicationFilesystemFaultPoint("after-directory-lstat", path);
    handle = await open(path, constants.O_RDONLY | NO_FOLLOW | DIRECTORY_ONLY);
    const opened = await openedDirectoryIdentity(path, handle);
    if (!opened.ok || opened.value.device !== before.dev || opened.value.inode !== before.ino) {
      return publicationFailure(
        "invalid",
        "publication.path.invalid",
        path,
        "Publication directory identity changed while it was opened.",
      );
    }
    const after = await lstat(path, { bigint: true });
    if (
      after.isSymbolicLink() ||
      !after.isDirectory() ||
      after.dev !== opened.value.device ||
      after.ino !== opened.value.inode
    ) {
      return publicationFailure(
        "invalid",
        "publication.path.invalid",
        path,
        "Publication directory identity changed during verification.",
      );
    }
    return opened;
  } catch (error) {
    return pathOpenFailure(
      error,
      path,
      "Publication path component must not be a symbolic link.",
      "Publication directory could not be inspected safely.",
    );
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

/** Verifies that a retained directory path still names the same real directory. */
export async function verifyPublicationDirectory(
  expected: PublicationDirectoryIdentity,
): Promise<PublicationResult<true>> {
  const current = await pinPublicationDirectory(expected.path);
  if (!current.ok) return current;
  if (!sameIdentity(current.value, expected)) {
    return publicationFailure(
      "invalid",
      "publication.path.invalid",
      expected.path,
      "Publication directory identity was substituted.",
    );
  }
  return publicationSuccess(true);
}

/** Synchronizes one retained directory and proves its identity before and after the sync. */
export async function syncPublicationDirectory(
  expected: PublicationDirectoryIdentity,
): Promise<PublicationResult<true>> {
  let handle: FileHandle | undefined;
  try {
    const before = await verifyPublicationDirectory(expected);
    if (!before.ok) return before;
    handle = await open(expected.path, constants.O_RDONLY | NO_FOLLOW | DIRECTORY_ONLY);
    const opened = await openedDirectoryIdentity(expected.path, handle);
    if (!opened.ok || !sameIdentity(opened.value, expected)) {
      return publicationFailure(
        "invalid",
        "publication.path.invalid",
        expected.path,
        "Publication directory identity changed before synchronization.",
      );
    }
    await publicationFilesystemFaultPoint("before-directory-sync", expected.path);
    await handle.sync();
    const afterHandle = await openedDirectoryIdentity(expected.path, handle);
    if (!afterHandle.ok || !sameIdentity(afterHandle.value, expected)) {
      return publicationFailure(
        "invalid",
        "publication.path.invalid",
        expected.path,
        "Publication directory identity changed during synchronization.",
      );
    }
    return verifyPublicationDirectory(expected);
  } catch (error) {
    return synchronizationFailure(
      error,
      expected.path,
      "Filesystem does not support required directory synchronization.",
      "Publication directory could not be synchronized safely.",
    );
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

/**
 * Creates one direct child without recursive traversal and synchronizes its parent when created.
 */
export async function ensurePublicationChildDirectory(
  parent: PublicationDirectoryIdentity,
  name: string,
  mode = 0o700,
): Promise<PublicationResult<PublicationChildDirectory>> {
  if (!lexicalEntryName(name)) {
    return publicationFailure(
      "invalid",
      "publication.path.invalid",
      name,
      "Publication directory name must be one lexical path segment.",
    );
  }
  const before = await verifyPublicationDirectory(parent);
  if (!before.ok) return before;
  const path = join(parent.path, name);
  let created = false;
  try {
    await mkdir(path, { mode });
    created = true;
  } catch (error) {
    if (!isAlreadyExists(error)) {
      return publicationFailure(
        "io",
        "publication.io",
        path,
        "Publication directory could not be created.",
      );
    }
  }
  const parentAfter = await verifyPublicationDirectory(parent);
  if (!parentAfter.ok) return parentAfter;
  const child = await pinPublicationDirectory(path);
  if (!child.ok) return child;
  if (created) {
    const synced = await syncPublicationDirectory(parent);
    if (!synced.ok) return synced;
  }
  return publicationSuccess({ identity: child.value, created });
}

/**
 * Reads one bounded regular file through a stable handle.
 *
 * @param path Absolute file path.
 * @param limit Maximum allocation and read length.
 * @param expectedSize Optional exact length known from trusted staged bytes.
 */
async function readPublicationRegularFileInternal(
  path: string,
  limit: number,
  expectedSize?: number,
  selectedPointer = false,
): Promise<PublicationResult<PublicationBoundedRead> | DetachedSelectedPointer> {
  let handle: FileHandle | undefined;
  try {
    const before = await lstat(path, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n) {
      return publicationFailure(
        "invalid",
        "publication.path.invalid",
        path,
        "Publication artifact must be a single-link regular file.",
      );
    }
    const limitBigInt = BigInt(limit);
    if (
      before.size > limitBigInt ||
      (expectedSize !== undefined && before.size !== BigInt(expectedSize))
    ) {
      return publicationFailure(
        "invalid",
        "publication.input.limit",
        path,
        expectedSize === undefined
          ? `Publication artifact exceeds its ${limit}-byte limit.`
          : "Publication artifact does not have its exact expected byte length.",
      );
    }
    await publicationFilesystemFaultPoint("after-file-lstat", path);
    handle = await open(path, constants.O_RDONLY | NO_FOLLOW | NON_BLOCKING);
    await publicationFilesystemFaultPoint("after-file-open", path);
    const opened = await handle.stat({ bigint: true });
    if (
      !opened.isFile() ||
      opened.nlink !== 1n ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size !== before.size
    ) {
      return publicationFailure(
        "invalid",
        "publication.path.invalid",
        path,
        "Publication artifact identity changed while it was opened.",
      );
    }
    const size = Number(opened.size);
    const bytes = new Uint8Array(size);
    let offset = 0;
    await publicationFilesystemFaultPoint("before-file-read", path);
    while (offset < bytes.byteLength) {
      const read = await handle.read(bytes, offset, bytes.byteLength - offset, offset);
      if (read.bytesRead === 0) {
        return publicationFailure(
          "io",
          "publication.io",
          path,
          "Publication artifact changed while it was being read.",
        );
      }
      offset += read.bytesRead;
    }
    await publicationFilesystemFaultPoint("after-file-read", path);
    const completed = await handle.stat({ bigint: true });
    if (
      !completed.isFile() ||
      completed.dev !== opened.dev ||
      completed.ino !== opened.ino ||
      completed.size !== opened.size
    ) {
      return publicationFailure(
        "io",
        "publication.io",
        path,
        "Publication artifact changed while it was being verified.",
      );
    }
    if (selectedPointer && completed.nlink === 0n) {
      return Object.freeze({
        device: completed.dev,
        inode: completed.ino,
        size: completed.size,
      });
    }
    if (completed.nlink !== 1n) {
      return publicationFailure(
        "invalid",
        "publication.path.invalid",
        path,
        "Publication artifact must remain a single-link regular file.",
      );
    }
    const after = await lstat(path, { bigint: true });
    const exactIdentity =
      !after.isSymbolicLink() &&
      after.isFile() &&
      after.dev === opened.dev &&
      after.ino === opened.ino &&
      after.size === opened.size &&
      after.nlink === 1n &&
      completed.nlink === 1n;
    if (!exactIdentity) {
      return publicationFailure(
        "invalid",
        "publication.path.invalid",
        path,
        "Publication artifact path was substituted during verification.",
      );
    }
    return publicationSuccess({ bytes, size });
  } catch (error) {
    return pathOpenFailure(
      error,
      path,
      "Publication artifact must not traverse a symbolic link.",
      "Publication artifact could not be opened safely.",
    );
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

/**
 * Reads one ordinary bounded regular file without pointer-replacement retry authority.
 *
 * @param path Absolute file path.
 * @param limit Maximum allocation and read length.
 * @param expectedSize Optional exact length known from trusted staged bytes.
 * @returns Exact stable bytes or a closed ordinary filesystem failure.
 */
export async function readPublicationRegularFile(
  path: string,
  limit: number,
  expectedSize?: number,
): Promise<PublicationResult<PublicationBoundedRead>> {
  const result = await readPublicationRegularFileInternal(path, limit, expectedSize);
  return "device" in result
    ? publicationFailure(
        "invalid",
        "publication.path.invalid",
        path,
        "Publication artifact path was substituted during verification.",
      )
    : result;
}

/**
 * Reads the canonical selected pointer and privately marks only verified identity replacement.
 *
 * @param path Canonical absolute selected-pointer path.
 * @param limit Maximum allocation and read length.
 * @param directories Every retained directory identity that led to the selected pointer.
 * @returns Exact stable pointer bytes or a closed filesystem failure.
 *
 * @example
 * ```ts
 * const pointer = await readSelectedPublicationPointer(canonicalPointerPath, 256, directories);
 * ```
 */
export async function readSelectedPublicationPointer(
  path: string,
  limit: number,
  directories: readonly PublicationDirectoryIdentity[],
): Promise<PublicationResult<PublicationBoundedRead>> {
  if (!isCanonicalSelectedPointerPath(path)) {
    return publicationFailure(
      "invalid",
      "publication.path.invalid",
      path,
      "Selected publication pointer path is not canonical.",
    );
  }
  const result = await readPublicationRegularFileInternal(path, limit, undefined, true);
  if (!("device" in result)) return result;
  for (const directory of directories) {
    const verified = await verifyPublicationDirectory(directory);
    if (!verified.ok) return verified;
  }
  try {
    await publicationFilesystemFaultPoint("before-selected-pointer-replacement-lstat", path);
    const replacement = await lstat(path, { bigint: true });
    if (
      replacement.isSymbolicLink() ||
      !replacement.isFile() ||
      replacement.nlink !== 1n ||
      replacement.size !== result.size ||
      replacement.size > BigInt(limit) ||
      (replacement.dev === result.device && replacement.ino === result.inode)
    ) {
      return publicationFailure(
        "invalid",
        "publication.path.invalid",
        path,
        "Selected publication pointer replacement is not an exact single-link regular file.",
      );
    }
  } catch {
    return publicationFailure(
      "io",
      "publication.io",
      path,
      "Selected publication pointer replacement could not be inspected safely.",
    );
  }
  for (const directory of directories) {
    const verified = await verifyPublicationDirectory(directory);
    if (!verified.ok) return verified;
  }
  return verifiedPointerReplacement(path);
}

/**
 * Tests whether a closed filesystem failure carries private verified pointer-replacement authority.
 *
 * @param result Closed filesystem result.
 * @returns `true` only for the exact privately branded result object.
 *
 * @example
 * ```ts
 * if (isVerifiedSelectedPointerReplacement(result)) {
 *   // Restart the complete selected resolution once.
 * }
 * ```
 */
export function isVerifiedSelectedPointerReplacement(result: unknown): boolean {
  return typeof result === "object" && result !== null && VERIFIED_POINTER_REPLACEMENTS.has(result);
}

/** Creates, completely writes and synchronizes one direct regular-file child. */
export async function writePublicationRegularFile(
  parent: PublicationDirectoryIdentity,
  name: string,
  bytes: Uint8Array,
  mode = 0o600,
): Promise<PublicationResult<true>> {
  if (!lexicalEntryName(name)) {
    return publicationFailure(
      "invalid",
      "publication.path.invalid",
      name,
      "Publication file name must be one lexical path segment.",
    );
  }
  const parentBefore = await verifyPublicationDirectory(parent);
  if (!parentBefore.ok) return parentBefore;
  const path = join(parent.path, name);
  let handle: FileHandle | undefined;
  try {
    handle = await open(
      path,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | NO_FOLLOW,
      mode,
    );
    await publicationFilesystemFaultPoint("after-output-open", path);
    const created = await handle.stat({ bigint: true });
    if (!created.isFile() || created.nlink !== 1n || created.size !== 0n) {
      return publicationFailure(
        "invalid",
        "publication.path.invalid",
        path,
        "Publication output must begin as one empty single-link regular file.",
      );
    }
    let offset = 0;
    while (offset < bytes.byteLength) {
      const written = await handle.write(bytes, offset, bytes.byteLength - offset, offset);
      if (written.bytesWritten === 0) {
        return publicationFailure(
          "io",
          "publication.io",
          path,
          "Publication file could not be written completely.",
        );
      }
      offset += written.bytesWritten;
    }
    await handle.sync();
    await publicationFilesystemFaultPoint("after-file-sync", path);
    const completed = await handle.stat({ bigint: true });
    if (
      !completed.isFile() ||
      completed.dev !== created.dev ||
      completed.ino !== created.ino ||
      completed.nlink !== 1n ||
      completed.size !== BigInt(bytes.byteLength)
    ) {
      return publicationFailure(
        "io",
        "publication.io",
        path,
        "Publication output identity changed while it was written.",
      );
    }
    const parentAfter = await verifyPublicationDirectory(parent);
    if (!parentAfter.ok) return parentAfter;
    const linked = await lstat(path, { bigint: true });
    if (
      linked.isSymbolicLink() ||
      !linked.isFile() ||
      linked.dev !== completed.dev ||
      linked.ino !== completed.ino ||
      linked.nlink !== 1n ||
      linked.size !== completed.size
    ) {
      return publicationFailure(
        "invalid",
        "publication.path.invalid",
        path,
        "Publication output path was substituted after synchronization.",
      );
    }
    return publicationSuccess(true);
  } catch (error) {
    return synchronizationFailure(
      error,
      path,
      "Filesystem does not support required file synchronization.",
      "Publication file could not be created and synchronized.",
    );
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

/** Enumerates at most `limit` stable child names from one retained directory. */
export async function readPublicationDirectoryNames(
  directory: PublicationDirectoryIdentity,
  limit: number,
): Promise<PublicationResult<readonly string[]>> {
  const before = await verifyPublicationDirectory(directory);
  if (!before.ok) return before;
  let handle: Awaited<ReturnType<typeof opendir>> | undefined;
  try {
    handle = await opendir(directory.path);
    const names: string[] = [];
    for await (const entry of handle) {
      names.push(entry.name);
      if (names.length > limit) {
        return publicationFailure(
          "invalid",
          "publication.input.limit",
          directory.path,
          "Publication directory contains too many entries.",
        );
      }
    }
    handle = undefined;
    await publicationFilesystemFaultPoint("after-directory-enumeration", directory.path);
    const after = await verifyPublicationDirectory(directory);
    if (!after.ok) return after;
    return publicationSuccess(Object.freeze(names));
  } catch {
    return publicationFailure(
      "io",
      "publication.io",
      directory.path,
      "Publication directory could not be enumerated safely.",
    );
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

/** Renames one entry only while both retained parent identities remain stable. */
export async function renamePublicationEntry(
  sourceParent: PublicationDirectoryIdentity,
  sourceName: string,
  destinationParent: PublicationDirectoryIdentity,
  destinationName: string,
): Promise<PublicationResult<true>> {
  if (!lexicalEntryName(sourceName) || !lexicalEntryName(destinationName)) {
    return publicationFailure(
      "invalid",
      "publication.path.invalid",
      sourceName,
      "Publication rename names must each be one lexical path segment.",
    );
  }
  for (const parent of [sourceParent, destinationParent]) {
    const verified = await verifyPublicationDirectory(parent);
    if (!verified.ok) return verified;
  }
  try {
    await rename(
      join(sourceParent.path, sourceName),
      join(destinationParent.path, destinationName),
    );
  } catch (error) {
    const destination = join(destinationParent.path, destinationName);
    if (isAlreadyExists(error)) {
      return publicationFailure(
        "collision",
        "publication.collision",
        destination,
        "Publication release entry already exists.",
      );
    }
    return publicationFailure(
      "io",
      "publication.io",
      destination,
      "Publication entry could not be renamed.",
    );
  }
  for (const parent of [sourceParent, destinationParent]) {
    const verified = await verifyPublicationDirectory(parent);
    if (!verified.ok) return verified;
  }
  return publicationSuccess(true);
}

/** Removes one direct child only while its retained parent identity remains stable. */
export async function removePublicationEntry(
  parent: PublicationDirectoryIdentity,
  name: string,
  recursive = false,
): Promise<PublicationResult<true>> {
  if (!lexicalEntryName(name)) {
    return publicationFailure(
      "invalid",
      "publication.path.invalid",
      name,
      "Publication cleanup name must be one lexical path segment.",
    );
  }
  const before = await verifyPublicationDirectory(parent);
  if (!before.ok) return before;
  try {
    await publicationFilesystemFaultPoint("before-remove", join(parent.path, name));
    await rm(join(parent.path, name), { recursive, force: true });
  } catch {
    return publicationFailure(
      "io",
      "publication.io",
      join(parent.path, name),
      "Publication temporary entry could not be removed.",
    );
  }
  return verifyPublicationDirectory(parent);
}
