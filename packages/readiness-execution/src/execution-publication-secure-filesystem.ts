import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import type { ExecutionOperationResultV1 } from "@blend65/readiness";

/* v8 ignore next -- exercised only on hosts without the platform flag. */
const NO_FOLLOW = "O_NOFOLLOW" in constants ? constants.O_NOFOLLOW : 0;
/* v8 ignore next -- exercised only on hosts without the platform flag. */
const NON_BLOCKING = "O_NONBLOCK" in constants ? constants.O_NONBLOCK : 0;
/* v8 ignore next -- exercised only on hosts without the platform flag. */
const DIRECTORY_ONLY = "O_DIRECTORY" in constants ? constants.O_DIRECTORY : 0;

/** Retained canonical identity of the directory that owns one atomic selection. */
export interface SecureSelectionDirectoryIdentityV1 {
  readonly path: string;
  readonly device: bigint;
  readonly inode: bigint;
}

/** Retained identity of one newly created, synced selection record. */
export interface SecureSelectionFileIdentityV1 {
  readonly path: string;
  readonly device: bigint;
  readonly inode: bigint;
  readonly size: number;
}

/** Outcome of one exclusive no-clobber regular-file commit. */
export type SecureNoClobberCommitStateV1 = "committed" | "existing";

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function failure<T>(
  code: "execution.io" | "execution.identity" | "execution.reconciliation",
  path: string,
  message: string,
): ExecutionOperationResultV1<T> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([Object.freeze({ code, path, message })]) as readonly [
      Readonly<{ code: typeof code; path: string; message: string }>,
    ],
  });
}

/** Reads one exact bounded regular file while retaining its path and inode identity. */
export function readSecureSelectionFileV1(
  repositoryRoot: string,
  path: string,
  maximumBytes: number,
  expectedIdentity?: Readonly<{ device: bigint; inode: bigint; size: number }>,
): ExecutionOperationResultV1<Uint8Array> {
  let canonicalRoot: string;
  try {
    canonicalRoot = realpathSync(repositoryRoot);
  } catch {
    return failure("execution.io", path, "Repository root could not be resolved safely.");
  }
  const contained = relative(canonicalRoot, path);
  if (
    !isAbsolute(path) ||
    resolve(path) !== path ||
    contained === ".." ||
    contained.startsWith(`..${sep}`) ||
    isAbsolute(contained)
  ) {
    return failure("execution.identity", path, "Selected file escaped its repository.");
  }
  let descriptor: number | undefined;
  try {
    if (realpathSync(path) !== path) {
      return failure("execution.identity", path, "Selected file traverses a substituted path.");
    }
    const before = lstatSync(path, { bigint: true });
    if (
      before.isSymbolicLink() ||
      !before.isFile() ||
      before.nlink !== 1n ||
      before.size > BigInt(maximumBytes) ||
      (expectedIdentity !== undefined &&
        (before.dev !== expectedIdentity.device ||
          before.ino !== expectedIdentity.inode ||
          before.size !== BigInt(expectedIdentity.size)))
    ) {
      return failure(
        "execution.identity",
        path,
        "Selected file is not a bounded single-link regular file.",
      );
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
      return failure("execution.identity", path, "Selected file changed while opened.");
    }
    const bytes = new Uint8Array(Number(opened.size));
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = readSync(descriptor, bytes, offset, bytes.byteLength - offset, offset);
      if (count === 0) {
        return failure("execution.io", path, "Selected file changed while read.");
      }
      offset += count;
    }
    const completed = fstatSync(descriptor, { bigint: true });
    const after = lstatSync(path, { bigint: true });
    if (
      !completed.isFile() ||
      completed.nlink !== 1n ||
      completed.dev !== opened.dev ||
      completed.ino !== opened.ino ||
      completed.size !== opened.size ||
      after.isSymbolicLink() ||
      !after.isFile() ||
      after.nlink !== 1n ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== opened.size ||
      realpathSync(path) !== path
    ) {
      return failure(
        "execution.identity",
        path,
        "Selected file identity changed during final verification.",
      );
    }
    return success(bytes);
  } catch {
    return failure("execution.io", path, "Selected file could not be read safely.");
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // Closing cannot make bytes that failed identity checks authoritative.
      }
    }
  }
}

/** Pins one canonical directory identity for a subsequent no-yield transaction. */
export function pinSecureSelectionDirectoryV1(
  path: string,
): ExecutionOperationResultV1<SecureSelectionDirectoryIdentityV1> {
  try {
    if (realpathSync(path) !== path) {
      return failure("execution.identity", path, "Selection directory is not canonical.");
    }
    const stat = lstatSync(path, { bigint: true });
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      return failure("execution.identity", path, "Selection directory is not real.");
    }
    return success(Object.freeze({ path, device: stat.dev, inode: stat.ino }));
  } catch {
    return failure("execution.io", path, "Selection directory could not be pinned.");
  }
}

/** Revalidates one previously pinned canonical directory identity. */
export function verifySecureSelectionDirectoryV1(
  identity: SecureSelectionDirectoryIdentityV1,
): boolean {
  try {
    const stat = lstatSync(identity.path, { bigint: true });
    return (
      !stat.isSymbolicLink() &&
      stat.isDirectory() &&
      stat.dev === identity.device &&
      stat.ino === identity.inode &&
      realpathSync(identity.path) === identity.path
    );
  } catch {
    return false;
  }
}

/** Creates, writes, and syncs one exclusive temporary selection record. */
export function writeSecureSelectionFileV1(
  directory: SecureSelectionDirectoryIdentityV1,
  temporaryPath: string,
  bytes: Uint8Array,
): ExecutionOperationResultV1<SecureSelectionFileIdentityV1> {
  let descriptor: number | undefined;
  try {
    if (!verifySecureSelectionDirectoryV1(directory) || dirname(temporaryPath) !== directory.path) {
      return failure("execution.identity", temporaryPath, "Selection directory changed.");
    }
    descriptor = openSync(
      temporaryPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | NO_FOLLOW,
      0o600,
    );
    const opened = fstatSync(descriptor, { bigint: true });
    if (!opened.isFile() || opened.nlink !== 1n || opened.size !== 0n) {
      return failure("execution.identity", temporaryPath, "Selection temporary is not new.");
    }
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = writeSync(descriptor, bytes, offset, bytes.byteLength - offset, offset);
      if (count === 0) {
        return failure("execution.io", temporaryPath, "Selection temporary write stopped.");
      }
      offset += count;
    }
    fsyncSync(descriptor);
    const completed = fstatSync(descriptor, { bigint: true });
    const linked = lstatSync(temporaryPath, { bigint: true });
    if (
      !completed.isFile() ||
      completed.nlink !== 1n ||
      completed.dev !== opened.dev ||
      completed.ino !== opened.ino ||
      completed.size !== BigInt(bytes.byteLength) ||
      linked.isSymbolicLink() ||
      !linked.isFile() ||
      linked.nlink !== 1n ||
      linked.dev !== opened.dev ||
      linked.ino !== opened.ino ||
      linked.size !== completed.size
    ) {
      return failure("execution.identity", temporaryPath, "Selection temporary changed.");
    }
    return success(
      Object.freeze({
        path: temporaryPath,
        device: completed.dev,
        inode: completed.ino,
        size: bytes.byteLength,
      }),
    );
  } catch {
    return failure("execution.io", temporaryPath, "Selection temporary could not be synced.");
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // A synced temporary remains non-authoritative until it is renamed.
      }
    }
  }
}

/**
 * Exclusively links one verified temporary into its final name without replacing existing bytes.
 *
 * The temporary and directory identities are revalidated immediately before the hard-link commit.
 * A successful link is followed by removal of the temporary name and exact target revalidation.
 *
 * @param repositoryRoot Canonical repository root containing both names.
 * @param directory Pinned identity of their common parent directory.
 * @param temporary Verified, synchronized temporary file.
 * @param target Canonical final path in the same directory.
 * @param bytes Exact bytes expected in both names.
 * @returns Whether this operation committed or observed an existing target.
 */
export function commitSecureSelectionFileNoClobberV1(
  repositoryRoot: string,
  directory: SecureSelectionDirectoryIdentityV1,
  temporary: SecureSelectionFileIdentityV1,
  target: string,
  bytes: Uint8Array,
): ExecutionOperationResultV1<SecureNoClobberCommitStateV1> {
  if (
    dirname(temporary.path) !== directory.path ||
    dirname(target) !== directory.path ||
    temporary.size !== bytes.byteLength ||
    !verifySecureSelectionDirectoryV1(directory)
  ) {
    return failure("execution.identity", target, "Selection commit directory changed.");
  }
  const retainedTemporary = readSecureSelectionFileV1(
    repositoryRoot,
    temporary.path,
    bytes.byteLength,
    temporary,
  );
  if (!retainedTemporary.ok) return retainedTemporary;
  if (
    retainedTemporary.value.byteLength !== bytes.byteLength ||
    retainedTemporary.value.some((value, index) => value !== bytes[index])
  ) {
    return failure("execution.identity", target, "Selection temporary bytes changed.");
  }
  try {
    linkSync(temporary.path, target);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST") {
      return success("existing");
    }
    return failure("execution.io", target, "Selection no-clobber commit failed safely.");
  }
  try {
    unlinkSync(temporary.path);
    const retainedTarget = readSecureSelectionFileV1(
      repositoryRoot,
      target,
      bytes.byteLength,
      temporary,
    );
    if (
      !retainedTarget.ok ||
      retainedTarget.value.byteLength !== bytes.byteLength ||
      retainedTarget.value.some((value, index) => value !== bytes[index]) ||
      !verifySecureSelectionDirectoryV1(directory)
    ) {
      return failure(
        "execution.reconciliation",
        target,
        "Committed selection file could not be revalidated.",
      );
    }
    return success("committed");
  } catch {
    return failure(
      "execution.reconciliation",
      target,
      "Committed selection file requires reconciliation.",
    );
  }
}

/** Establishes directory durability with one bounded retry after a completed rename. */
export function synchronizeSecureSelectionDirectoryV1(
  directory: SecureSelectionDirectoryIdentityV1,
  shouldFailAttempt: (attempt: number) => boolean,
): ExecutionOperationResultV1<true> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let descriptor: number | undefined;
    try {
      if (!verifySecureSelectionDirectoryV1(directory)) continue;
      descriptor = openSync(directory.path, constants.O_RDONLY | NO_FOLLOW | DIRECTORY_ONLY);
      const opened = fstatSync(descriptor, { bigint: true });
      if (
        !opened.isDirectory() ||
        opened.dev !== directory.device ||
        opened.ino !== directory.inode ||
        shouldFailAttempt(attempt)
      ) {
        continue;
      }
      fsyncSync(descriptor);
      const completed = fstatSync(descriptor, { bigint: true });
      if (
        completed.isDirectory() &&
        completed.dev === directory.device &&
        completed.ino === directory.inode &&
        verifySecureSelectionDirectoryV1(directory)
      ) {
        return success(true);
      }
    } catch {
      // The bounded retry below is the only recovery path for an unproven directory sync.
    } finally {
      if (descriptor !== undefined) {
        try {
          closeSync(descriptor);
        } catch {
          // A close error leaves this attempt unproven; the bounded loop decides the result.
        }
      }
    }
  }
  return failure(
    "execution.reconciliation",
    "",
    "Selection is visible but directory durability is indeterminate.",
  );
}

/** Removes one uncommitted temporary without following a replaced directory. */
export function cleanupSecureSelectionFileV1(
  path: string,
  directory: SecureSelectionDirectoryIdentityV1,
): ExecutionOperationResultV1<true> {
  try {
    if (dirname(path) !== directory.path || !verifySecureSelectionDirectoryV1(directory)) {
      return failure(
        "execution.identity",
        path,
        "Selection temporary cleanup directory changed and residue may remain.",
      );
    }
    unlinkSync(path);
    return success(true);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return success(true);
    }
    return failure(
      "execution.io",
      path,
      "Selection temporary cleanup failed and residue may remain.",
    );
  }
}
