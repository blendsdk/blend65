import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, join, normalize, sep } from "node:path";

import type {
  PublicationBoundedRead,
  PublicationDirectoryIdentity,
} from "./publication-filesystem.js";
import {
  publicationFailure,
  publicationSuccess,
  type PublicationResult,
} from "./publication-model.js";
import {
  CURRENT_EXECUTION_PUBLICATION_FILENAME,
  EXECUTION_PUBLICATIONS_ROOT,
} from "./execution-publication-model.js";

/* v8 ignore next -- exercised only on hosts without the platform flag. */
const NO_FOLLOW = "O_NOFOLLOW" in constants ? constants.O_NOFOLLOW : 0;
/* v8 ignore next -- exercised only on hosts without the platform flag. */
const NON_BLOCKING = "O_NONBLOCK" in constants ? constants.O_NONBLOCK : 0;
const SELECTED_EXECUTION_POINTER_SUFFIX = join(
  EXECUTION_PUBLICATIONS_ROOT,
  CURRENT_EXECUTION_PUBLICATION_FILENAME,
);
const VERIFIED_REPLACEMENTS = new WeakSet<object>();

interface DetachedExecutionPointerV1 {
  readonly device: bigint;
  readonly inode: bigint;
  readonly size: bigint;
}

function pathFailure<T>(path: string, message: string): PublicationResult<T> {
  return publicationFailure("invalid", "publication.path.invalid", path, message);
}

function verifyDirectories(
  directories: readonly PublicationDirectoryIdentity[],
): PublicationResult<true> {
  try {
    for (const directory of directories) {
      const current = lstatSync(directory.path, { bigint: true });
      if (
        current.isSymbolicLink() ||
        !current.isDirectory() ||
        current.dev !== directory.device ||
        current.ino !== directory.inode ||
        realpathSync(directory.path) !== directory.path
      ) {
        return pathFailure(
          directory.path,
          "Execution publication directory identity changed during pointer verification.",
        );
      }
    }
    return publicationSuccess(true);
  } catch {
    return publicationFailure(
      "io",
      "publication.io",
      "",
      "Execution publication directory chain could not be verified safely.",
    );
  }
}

function replacementFailure<T>(path: string): PublicationResult<T> {
  const result = pathFailure<T>(
    path,
    "Selected execution publication pointer identity changed during verification.",
  );
  VERIFIED_REPLACEMENTS.add(result);
  return result;
}

function readOpenedBytes(
  descriptor: number,
  size: number,
  path: string,
): PublicationResult<Uint8Array> {
  const bytes = new Uint8Array(size);
  let offset = 0;
  while (offset < bytes.byteLength) {
    const bytesRead = readSync(descriptor, bytes, offset, bytes.byteLength - offset, offset);
    if (bytesRead === 0) {
      return publicationFailure(
        "io",
        "publication.io",
        path,
        "Selected execution publication pointer changed while it was read.",
      );
    }
    offset += bytesRead;
  }
  return publicationSuccess(bytes);
}

function verifyReplacement(
  path: string,
  limit: number,
  detached: DetachedExecutionPointerV1,
  directories: readonly PublicationDirectoryIdentity[],
): PublicationResult<PublicationBoundedRead> {
  const before = verifyDirectories(directories);
  if (!before.ok) return before;
  try {
    const replacement = lstatSync(path, { bigint: true });
    if (
      replacement.isSymbolicLink() ||
      !replacement.isFile() ||
      replacement.nlink !== 1n ||
      replacement.size !== detached.size ||
      replacement.size > BigInt(limit) ||
      (replacement.dev === detached.device && replacement.ino === detached.inode)
    ) {
      return pathFailure(
        path,
        "Selected execution publication pointer replacement is not an exact regular file.",
      );
    }
    const ancestors = verifyDirectories(directories);
    if (!ancestors.ok) return ancestors;
    const final = lstatSync(path, { bigint: true });
    if (
      final.isSymbolicLink() ||
      !final.isFile() ||
      final.nlink !== 1n ||
      final.dev !== replacement.dev ||
      final.ino !== replacement.ino ||
      final.size !== replacement.size
    ) {
      return pathFailure(path, "Selected execution publication pointer changed more than once.");
    }
    return replacementFailure(path);
  } catch {
    return publicationFailure(
      "io",
      "publication.io",
      path,
      "Selected execution publication pointer replacement could not be inspected safely.",
    );
  }
}

/**
 * Reads the selected execution pointer without yielding and marks one verified replacement.
 *
 * @param path Canonical absolute execution-pointer path.
 * @param limit Maximum accepted pointer bytes.
 * @param directories Complete pinned ancestor chain.
 * @returns Stable pointer bytes or a closed privately marked replacement failure.
 */
export function readSelectedExecutionPublicationPointerV1(
  path: string,
  limit: number,
  directories: readonly PublicationDirectoryIdentity[],
): PublicationResult<PublicationBoundedRead> {
  if (
    !isAbsolute(path) ||
    normalize(path) !== path ||
    !path.endsWith(`${sep}${SELECTED_EXECUTION_POINTER_SUFFIX}`)
  ) {
    return pathFailure(path, "Selected execution publication pointer path is not canonical.");
  }
  const verified = verifyDirectories(directories);
  if (!verified.ok) return verified;
  let descriptor: number | undefined;
  try {
    const before = lstatSync(path, { bigint: true });
    if (
      before.isSymbolicLink() ||
      !before.isFile() ||
      before.nlink !== 1n ||
      before.size > BigInt(limit)
    ) {
      return pathFailure(path, "Selected execution publication pointer is not a bounded file.");
    }
    descriptor = openSync(path, constants.O_RDONLY | NO_FOLLOW | NON_BLOCKING);
    const opened = fstatSync(descriptor, { bigint: true });
    if (
      !opened.isFile() ||
      opened.nlink !== 1n ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size !== before.size
    ) {
      return pathFailure(path, "Selected execution publication pointer changed while opened.");
    }
    const read = readOpenedBytes(descriptor, Number(opened.size), path);
    if (!read.ok) return read;
    const completed = fstatSync(descriptor, { bigint: true });
    const after = lstatSync(path, { bigint: true });
    if (
      !completed.isFile() ||
      completed.dev !== opened.dev ||
      completed.ino !== opened.ino ||
      completed.size !== opened.size
    ) {
      return pathFailure(path, "Selected execution publication pointer changed while verified.");
    }
    if (
      completed.nlink === 0n ||
      after.isSymbolicLink() ||
      !after.isFile() ||
      after.nlink !== 1n ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== opened.size
    ) {
      return verifyReplacement(
        path,
        limit,
        { device: completed.dev, inode: completed.ino, size: completed.size },
        directories,
      );
    }
    if (completed.nlink !== 1n) {
      return pathFailure(path, "Selected execution publication pointer link count changed.");
    }
    const ancestors = verifyDirectories(directories);
    if (!ancestors.ok) return ancestors;
    const final = lstatSync(path, { bigint: true });
    if (
      final.isSymbolicLink() ||
      !final.isFile() ||
      final.nlink !== 1n ||
      final.dev !== opened.dev ||
      final.ino !== opened.ino ||
      final.size !== opened.size
    ) {
      return verifyReplacement(
        path,
        limit,
        { device: completed.dev, inode: completed.ino, size: completed.size },
        directories,
      );
    }
    return publicationSuccess({ bytes: read.value, size: read.value.byteLength });
  } catch {
    return publicationFailure(
      "io",
      "publication.io",
      path,
      "Selected execution publication pointer could not be opened safely.",
    );
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // Descriptor closure cannot turn unverified bytes into authority.
      }
    }
  }
}

/** Returns whether a failure proves one exact selected-pointer replacement race. */
export function isVerifiedExecutionPointerReplacementV1(result: unknown): boolean {
  return typeof result === "object" && result !== null && VERIFIED_REPLACEMENTS.has(result);
}

export {
  parseExecutionPublicationPointerV1,
  renderExecutionPublicationPointer,
} from "./execution-publication-model.js";
