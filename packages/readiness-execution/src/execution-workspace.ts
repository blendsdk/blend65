import { constants, type BigIntStats } from "node:fs";
import {
  lstat,
  mkdtemp,
  open,
  opendir,
  realpath,
  rename,
  rmdir,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import type { ExecutionOperationResultV1 } from "@blend65/readiness";

import type { ExecutionCancellationV1 } from "./execution-worker-protocol.js";

/** Canonical identity pinned when a case root is acquired. */
export interface ExecutionWorkspaceIdentityV1 {
  readonly device: bigint;
  readonly inode: bigint;
  readonly uid: number;
}

/** Retained no-follow authority for one exact regular file. */
export interface ExecutionRetainedRegularFileV1 {
  readonly path: string;
  /** Descriptor-backed path that an external child opens as the retained inode. */
  readonly externalPath: string;
  readonly identity: Readonly<{
    readonly device: bigint;
    readonly inode: bigint;
    readonly uid: number;
    readonly size: bigint;
  }>;
  revalidate(): Promise<void>;
  close(): Promise<void>;
}

/** Parent-owned private workspace for one execution case. */
export interface ExecutionCaseWorkspaceV1 {
  readonly root: string;
  readonly identity: ExecutionWorkspaceIdentityV1;
  resolveRegularFile(relativePath: string): Promise<string>;
  /** Reads a regular artifact through its validated no-follow handle. */
  readRegularFile?(relativePath: string, maximumBytes: number): Promise<Uint8Array>;
  /** Exclusively creates an owned regular artifact through a no-follow handle. */
  writeFileExclusive?(relativePath: string, bytes: Uint8Array): Promise<string>;
  /** Retains and revalidates an exact regular-file inode across an external open. */
  retainRegularFile?(relativePath: string): Promise<ExecutionRetainedRegularFileV1>;
  dispose(deadlineMonotonicMs?: number, signal?: AbortSignal): Promise<void>;
}

/** Replaceable workspace acquisition boundary. */
export interface ExecutionWorkspaceProviderV1 {
  create(
    cancellation?: ExecutionCancellationV1,
  ): Promise<ExecutionOperationResultV1<ExecutionCaseWorkspaceV1>>;
}

const MAX_RELATIVE_PATH_BYTES = 1_024;
const MAX_COMPONENT_BYTES = 128;
const MAX_WORKSPACE_DEPTH = 8;
const MAX_WORKSPACE_ENTRIES = 64;
const MAX_WORKSPACE_BYTES = 16_777_216;
const MAX_ARTIFACT_BYTES = 8_388_608;
const ENCODER = new TextEncoder();

function failure<T>(path: string, message: string): ExecutionOperationResultV1<T> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([
      Object.freeze({ code: "execution.io" as const, path, message }),
    ]) as readonly [
      { readonly code: "execution.io"; readonly path: string; readonly message: string },
    ],
  });
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function isContained(root: string, candidate: string): boolean {
  const fromRoot = relative(root, candidate);
  return (
    fromRoot !== "" &&
    !fromRoot.startsWith(`..${sep}`) &&
    fromRoot !== ".." &&
    !isAbsolute(fromRoot)
  );
}

function isFlatArtifactName(input: unknown): input is string {
  return isExecutionRelativePathV1(input) && !input.includes("/");
}

/**
 * Validates a portable case-root-relative artifact path.
 *
 * Empty components, dot components and platform separators are rejected before filesystem use.
 */
export function isExecutionRelativePathV1(input: unknown): input is string {
  if (
    typeof input !== "string" ||
    input.length === 0 ||
    isAbsolute(input) ||
    input.includes("\\") ||
    ENCODER.encode(input).byteLength > MAX_RELATIVE_PATH_BYTES
  ) {
    return false;
  }
  return (
    input.split("/").length <= MAX_WORKSPACE_DEPTH &&
    input
      .split("/")
      .every(
        (component) =>
          component !== "" &&
          component !== "." &&
          component !== ".." &&
          ENCODER.encode(component).byteLength <= MAX_COMPONENT_BYTES &&
          /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(component),
      )
  );
}

function sameIdentity(
  left: { readonly dev: bigint; readonly ino: bigint; readonly uid: bigint },
  right: { readonly dev: bigint; readonly ino: bigint; readonly uid: bigint },
): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid;
}

function isNormalizableArtifactMode(mode: bigint): boolean {
  const permissions = Number(mode & 0o777n);
  return (permissions & 0o600) === 0o600 && (permissions & 0o111) === 0;
}

async function validateComponents(root: string, relativePath: string): Promise<void> {
  const components = relativePath.split("/");
  let current = root;
  for (const component of components.slice(0, -1)) {
    current = resolve(current, component);
    const observed = await lstat(current, { bigint: true });
    if (!observed.isDirectory() || observed.isSymbolicLink()) {
      throw new TypeError("Artifact parent component is unsafe.");
    }
  }
}

interface CleanupQuota {
  entries: number;
  bytes: bigint;
}

interface CleanupEntryIdentity {
  readonly device: bigint;
  readonly inode: bigint;
  readonly uid: number;
  readonly size: bigint;
  readonly directory: boolean;
  readonly symbolicLink: boolean;
}

function cleanupCancelled(deadlineMonotonicMs: number, signal?: AbortSignal): boolean {
  return signal?.aborted === true || performance.now() > deadlineMonotonicMs;
}

async function validateCleanupTree(
  path: string,
  relativeRoot: string,
  uid: number,
  depth: number,
  quota: CleanupQuota,
  identities: Map<string, CleanupEntryIdentity>,
  deadlineMonotonicMs: number,
  signal?: AbortSignal,
): Promise<void> {
  if (cleanupCancelled(deadlineMonotonicMs, signal)) {
    throw new TypeError("Workspace cleanup exceeded its cancellation bound.");
  }
  if (depth > MAX_WORKSPACE_DEPTH) throw new TypeError("Workspace nesting quota is exhausted.");
  const directory = await opendir(path);
  try {
    for (;;) {
      if (cleanupCancelled(deadlineMonotonicMs, signal)) {
        throw new TypeError("Workspace cleanup exceeded its cancellation bound.");
      }
      const entry = await directory.read();
      if (entry === null) break;
      const name = entry.name;
      const candidate = join(path, name);
      const relativePath = relativeRoot === "" ? name : `${relativeRoot}/${name}`;
      const observed = await lstat(candidate, { bigint: true });
      if (Number(observed.uid) !== uid) throw new TypeError("Workspace contains an unowned entry.");
      quota.entries += 1;
      quota.bytes += observed.size;
      if (quota.entries > MAX_WORKSPACE_ENTRIES) {
        throw new TypeError("Workspace entry quota is exhausted.");
      }
      if (quota.bytes > BigInt(MAX_WORKSPACE_BYTES)) {
        throw new TypeError("Workspace byte quota is exhausted.");
      }
      const symbolicLink = observed.isSymbolicLink();
      const isDirectory = observed.isDirectory() && !symbolicLink;
      identities.set(relativePath, {
        device: observed.dev,
        inode: observed.ino,
        uid: Number(observed.uid),
        size: observed.size,
        directory: isDirectory,
        symbolicLink,
      });
      if (isDirectory) {
        await validateCleanupTree(
          candidate,
          relativePath,
          uid,
          depth + 1,
          quota,
          identities,
          deadlineMonotonicMs,
          signal,
        );
      }
    }
  } finally {
    await directory.close().catch(() => undefined);
  }
}

async function removeCleanupTree(
  path: string,
  relativeRoot: string,
  identities: ReadonlyMap<string, CleanupEntryIdentity>,
  deadlineMonotonicMs: number,
  signal?: AbortSignal,
): Promise<void> {
  const directory = await opendir(path);
  try {
    for (;;) {
      if (cleanupCancelled(deadlineMonotonicMs, signal)) {
        throw new TypeError("Workspace cleanup exceeded its cancellation bound.");
      }
      const entry = await directory.read();
      if (entry === null) break;
      const relativePath = relativeRoot === "" ? entry.name : `${relativeRoot}/${entry.name}`;
      const expected = identities.get(relativePath);
      if (expected === undefined)
        throw new TypeError("Workspace changed after cleanup validation.");
      const candidate = join(path, entry.name);
      const observed = await lstat(candidate, { bigint: true });
      if (
        observed.dev !== expected.device ||
        observed.ino !== expected.inode ||
        Number(observed.uid) !== expected.uid ||
        observed.size !== expected.size ||
        observed.isSymbolicLink() !== expected.symbolicLink ||
        (observed.isDirectory() && !observed.isSymbolicLink()) !== expected.directory
      ) {
        throw new TypeError("Workspace entry identity changed before cleanup.");
      }
      if (expected.directory) {
        await removeCleanupTree(candidate, relativePath, identities, deadlineMonotonicMs, signal);
        await rmdir(candidate);
      } else {
        await unlink(candidate);
      }
    }
  } finally {
    await directory.close().catch(() => undefined);
  }
}

/** Acquires a canonical empty root, pins an open handle, and returns guarded file operations. */
async function createWorkspace(
  cancellation?: ExecutionCancellationV1,
): Promise<ExecutionOperationResultV1<ExecutionCaseWorkspaceV1>> {
  let createdRoot: string | undefined;
  let rootHandle: FileHandle | undefined;
  try {
    const acquisitionCancelled = (): boolean => cancellation?.signal.aborted === true;
    if (acquisitionCancelled()) throw new TypeError("Workspace acquisition was cancelled.");
    if (constants.O_NOFOLLOW === undefined || constants.O_DIRECTORY === undefined) {
      throw new TypeError("No-follow workspace primitives are unavailable.");
    }
    const lexicalRoot = await mkdtemp(join(tmpdir(), "blend65-execution-"));
    createdRoot = lexicalRoot;
    if (acquisitionCancelled()) throw new TypeError("Workspace acquisition was cancelled.");
    const root = await realpath(lexicalRoot);
    if (basename(root) !== basename(lexicalRoot)) {
      throw new TypeError("Workspace canonical name changed during acquisition.");
    }
    rootHandle = await open(
      root,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    const acquired = await rootHandle.stat({ bigint: true });
    const lexical = await lstat(root, { bigint: true });
    if (acquisitionCancelled()) throw new TypeError("Workspace acquisition was cancelled.");
    const expectedUid =
      typeof process.getuid === "function" ? process.getuid() : Number(acquired.uid);
    if (
      !acquired.isDirectory() ||
      acquired.nlink !== 2n ||
      !sameIdentity(acquired, lexical) ||
      Number(acquired.mode & 0o777n) !== 0o700 ||
      Number(acquired.uid) !== expectedUid
    ) {
      throw new TypeError("Workspace ownership, identity, or mode is unsafe.");
    }
    const identity: ExecutionWorkspaceIdentityV1 = Object.freeze({
      device: acquired.dev,
      inode: acquired.ino,
      uid: expectedUid,
    });
    let disposePromise: Promise<void> | undefined;

    const validateRoot = async (): Promise<void> => {
      const [handleState, pathState] = await Promise.all([
        rootHandle?.stat({ bigint: true }),
        lstat(root, { bigint: true }),
      ]);
      if (
        handleState === undefined ||
        !handleState.isDirectory() ||
        !sameIdentity(handleState, pathState) ||
        handleState.dev !== identity.device ||
        handleState.ino !== identity.inode ||
        Number(handleState.uid) !== identity.uid
      ) {
        throw new TypeError("Workspace identity changed during use.");
      }
    };

    const openRegularHandle = async (
      relativePath: string,
    ): Promise<{
      readonly handle: FileHandle;
      readonly candidate: string;
      readonly before: BigIntStats;
    }> => {
      if (disposePromise !== undefined) throw new TypeError("Workspace is closing.");
      if (!isFlatArtifactName(relativePath)) {
        throw new TypeError("Artifact path is not a safe flat relative path.");
      }
      const candidate = resolve(root, relativePath);
      if (!isContained(root, candidate))
        throw new TypeError("Artifact path escapes the case root.");
      await validateRoot();
      await validateComponents(root, relativePath);
      const handle = await open(candidate, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        let before = await handle.stat({ bigint: true });
        const lexicalBefore = await lstat(candidate, { bigint: true });
        if (
          !before.isFile() ||
          before.nlink !== 1n ||
          !sameIdentity(before, lexicalBefore) ||
          before.dev !== identity.device ||
          Number(before.uid) !== identity.uid
        ) {
          throw new TypeError("Artifact is not an owned single-link regular file.");
        }
        if (!isNormalizableArtifactMode(before.mode)) {
          throw new TypeError("Artifact mode is unsafe.");
        }
        if (Number(before.mode & 0o777n) !== 0o600) {
          await handle.chmod(0o600);
          const secured = await handle.stat({ bigint: true });
          const lexicalSecured = await lstat(candidate, { bigint: true });
          if (
            !sameIdentity(before, secured) ||
            !sameIdentity(secured, lexicalSecured) ||
            secured.size !== before.size ||
            Number(secured.mode & 0o777n) !== 0o600
          ) {
            throw new TypeError("Artifact identity changed while securing its mode.");
          }
          before = secured;
        }
        return { handle, candidate, before };
      } catch (error) {
        await handle.close().catch(() => undefined);
        throw error;
      }
    };

    const revalidateRegularHandle = async (
      handle: FileHandle,
      candidate: string,
      before: BigIntStats,
    ): Promise<void> => {
      const [after, lexicalAfter] = await Promise.all([
        handle.stat({ bigint: true }),
        lstat(candidate, { bigint: true }),
      ]);
      if (
        !sameIdentity(before, after) ||
        !sameIdentity(after, lexicalAfter) ||
        before.size !== after.size ||
        after.nlink !== 1n ||
        Number(before.mode & 0o777n) !== Number(after.mode & 0o777n) ||
        Number(after.mode & 0o777n) !== 0o600
      ) {
        throw new TypeError("Artifact identity changed during validation.");
      }
      await validateRoot();
      await validateComponents(root, relative(root, candidate));
    };

    const withRegularHandle = async <T>(
      relativePath: string,
      use: (handle: FileHandle, size: bigint) => Promise<T>,
    ): Promise<T> => {
      const { handle, candidate, before } = await openRegularHandle(relativePath);
      try {
        const result = await use(handle, before.size);
        await revalidateRegularHandle(handle, candidate, before);
        return result;
      } finally {
        await handle.close();
      }
    };

    const workspace: ExecutionCaseWorkspaceV1 = Object.freeze({
      root,
      identity,
      async resolveRegularFile(relativePath: string): Promise<string> {
        return withRegularHandle(relativePath, async () => resolve(root, relativePath));
      },
      async readRegularFile(relativePath: string, maximumBytes: number): Promise<Uint8Array> {
        if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
          throw new TypeError("Artifact read bound is invalid.");
        }
        return withRegularHandle(relativePath, async (handle, size) => {
          if (size > BigInt(Math.min(maximumBytes, MAX_ARTIFACT_BYTES))) {
            throw new TypeError("Artifact exceeds its read bound.");
          }
          const length = Number(size);
          const bytes = new Uint8Array(length);
          let offset = 0;
          while (offset < length) {
            const read = await handle.read(bytes, offset, length - offset, offset);
            if (read.bytesRead === 0) throw new TypeError("Artifact shrank during bounded read.");
            offset += read.bytesRead;
          }
          const afterRead = await handle.stat({ bigint: true });
          if (afterRead.size !== size) throw new TypeError("Artifact grew during bounded read.");
          return bytes;
        });
      },
      async writeFileExclusive(relativePath: string, bytes: Uint8Array): Promise<string> {
        if (disposePromise !== undefined) throw new TypeError("Workspace is closing.");
        if (
          !isFlatArtifactName(relativePath) ||
          !(bytes instanceof Uint8Array) ||
          bytes.byteLength > MAX_ARTIFACT_BYTES
        ) {
          throw new TypeError("Artifact write input is invalid.");
        }
        const candidate = resolve(root, relativePath);
        if (!isContained(root, candidate))
          throw new TypeError("Artifact path escapes the case root.");
        await validateRoot();
        await validateComponents(root, relativePath);
        const handle = await open(
          candidate,
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
          0o600,
        );
        try {
          const before = await handle.stat({ bigint: true });
          if (
            !before.isFile() ||
            before.nlink !== 1n ||
            before.dev !== identity.device ||
            Number(before.uid) !== identity.uid ||
            Number(before.mode & 0o777n) !== 0o600
          ) {
            throw new TypeError("Artifact write handle is unsafe.");
          }
          await handle.writeFile(bytes);
          const [after, lexicalAfter] = await Promise.all([
            handle.stat({ bigint: true }),
            lstat(candidate, { bigint: true }),
          ]);
          if (
            !sameIdentity(before, after) ||
            !sameIdentity(after, lexicalAfter) ||
            after.size !== BigInt(bytes.byteLength)
          ) {
            throw new TypeError("Artifact identity changed during write.");
          }
          await validateRoot();
          await validateComponents(root, relativePath);
          return candidate;
        } finally {
          await handle.close();
        }
      },
      async retainRegularFile(relativePath: string): Promise<ExecutionRetainedRegularFileV1> {
        if (process.platform !== "linux") {
          throw new TypeError("Descriptor-backed external file paths are unavailable.");
        }
        const { handle, candidate, before } = await openRegularHandle(relativePath);
        let closePromise: Promise<void> | undefined;
        return Object.freeze({
          path: candidate,
          externalPath: `/proc/${process.pid}/fd/${handle.fd}`,
          identity: Object.freeze({
            device: before.dev,
            inode: before.ino,
            uid: Number(before.uid),
            size: before.size,
          }),
          revalidate: () => revalidateRegularHandle(handle, candidate, before),
          close(): Promise<void> {
            closePromise ??= handle.close();
            return closePromise;
          },
        });
      },
      async dispose(
        deadlineMonotonicMs = Number.POSITIVE_INFINITY,
        signal?: AbortSignal,
      ): Promise<void> {
        if (disposePromise !== undefined) return disposePromise;
        disposePromise = (async () => {
          try {
            if (
              (!Number.isFinite(deadlineMonotonicMs) && deadlineMonotonicMs !== Infinity) ||
              cleanupCancelled(deadlineMonotonicMs, signal)
            ) {
              throw new TypeError("Workspace cleanup bound is invalid or exhausted.");
            }
            await validateRoot();
            const quarantine = join(dirname(root), `.${basename(root)}.cleanup`);
            await rename(root, quarantine);
            const moved = await lstat(quarantine, { bigint: true });
            const pinned = await rootHandle?.stat({ bigint: true });
            if (
              pinned === undefined ||
              !sameIdentity(pinned, moved) ||
              pinned.dev !== identity.device ||
              pinned.ino !== identity.inode
            ) {
              throw new TypeError("Workspace identity changed before cleanup.");
            }
            await rootHandle?.chmod(0o700);
            const identities = new Map<string, CleanupEntryIdentity>();
            await validateCleanupTree(
              quarantine,
              "",
              identity.uid,
              1,
              { entries: 0, bytes: 0n },
              identities,
              deadlineMonotonicMs,
              signal,
            );
            if (cleanupCancelled(deadlineMonotonicMs, signal)) {
              throw new TypeError("Workspace cleanup exceeded its cancellation bound.");
            }
            await rootHandle?.close();
            rootHandle = undefined;
            await removeCleanupTree(quarantine, "", identities, deadlineMonotonicMs, signal);
            await rmdir(quarantine);
          } catch (error) {
            await rootHandle?.close().catch(() => undefined);
            rootHandle = undefined;
            throw error;
          }
        })();
        return disposePromise;
      },
    });
    return success(workspace);
  } catch (error) {
    await rootHandle?.close().catch(() => undefined);
    if (createdRoot !== undefined) {
      await rmdir(createdRoot).catch(() => undefined);
    }
    return failure(
      "/workspace",
      error instanceof Error ? error.message : "Workspace acquisition failed.",
    );
  }
}

/** Production provider for private canonical temporary workspaces. */
export const defaultExecutionWorkspaceProviderV1: ExecutionWorkspaceProviderV1 = Object.freeze({
  create: createWorkspace,
});
