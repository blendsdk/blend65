import { lstat, mkdir, readdir, realpath, rmdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { ProjectSnapshot } from "../project/types.js";
import type {
  PublicationCheckpointPhase,
  PublicationControls,
  PublicationErrorReason,
} from "./publication.js";

/** Stable identity of the project and output directories during a publication operation. */
export interface PublicationRootIdentity {
  /** Canonical project root. */
  readonly projectRoot: string;
  /** Canonical output root. */
  readonly outputRoot: string;
  /** Output-root device identity. */
  readonly device: bigint;
  /** Output-root inode identity. */
  readonly inode: bigint;
}

/** Result returned by the small publication lock boundary. */
export type LockResult<T> =
  | { readonly kind: "complete"; readonly value: T }
  | {
      readonly kind: "error";
      readonly reason: PublicationErrorReason;
      readonly diagnostic: string;
    };

/** Invoke an optional deterministic test checkpoint. */
export async function publicationCheckpoint(
  controls: PublicationControls | undefined,
  phase: PublicationCheckpointPhase,
  generationId: string,
  path: string | null,
): Promise<void> {
  await controls?.onCheckpoint?.(Object.freeze({ phase, generationId, path }));
}

/** Resolve and validate the output root without trusting lexical containment alone. */
export async function identifyPublicationRoot(
  snapshot: ProjectSnapshot,
): Promise<PublicationRootIdentity | null> {
  try {
    if (!isAbsolute(snapshot.projectRoot) || !isAbsolute(snapshot.outDir)) return null;
    const projectRoot = await realpath(snapshot.projectRoot);
    const outputRoot = await realpath(snapshot.outDir);
    const containment = relative(projectRoot, outputRoot);
    if (
      containment === "" ||
      containment === ".." ||
      containment.startsWith(`..${sep}`) ||
      isAbsolute(containment)
    ) {
      return null;
    }
    const outputMetadata = await lstat(snapshot.outDir, { bigint: true });
    if (
      !outputMetadata.isDirectory() ||
      outputMetadata.isSymbolicLink() ||
      resolve(snapshot.outDir) !== outputRoot
    ) {
      return null;
    }
    return Object.freeze({
      projectRoot,
      outputRoot,
      device: outputMetadata.dev,
      inode: outputMetadata.ino,
    });
  } catch {
    return null;
  }
}

/** Confirm that the output root has not been replaced since identification. */
export async function publicationRootMatches(identity: PublicationRootIdentity): Promise<boolean> {
  try {
    const metadata = await lstat(identity.outputRoot, { bigint: true });
    return (
      metadata.isDirectory() &&
      !metadata.isSymbolicLink() &&
      metadata.dev === identity.device &&
      metadata.ino === identity.inode &&
      (await realpath(identity.outputRoot)) === identity.outputRoot
    );
  } catch {
    return false;
  }
}

/** Wait briefly without blocking cancellation delivery. */
function delay(milliseconds: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted === true) return Promise.resolve(false);
  return new Promise((resolveDelay) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolveDelay(true);
    }, milliseconds);
    const abort = () => {
      clearTimeout(timer);
      resolveDelay(false);
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

/**
 * Run one short filesystem mutation while holding the exact output-directory lock.
 *
 * Existing locks are never broken automatically. A bounded wait either observes normal release or
 * returns a manual-recovery diagnostic.
 */
export async function withPublicationLock<T>(
  snapshot: ProjectSnapshot,
  generationId: string,
  controls: PublicationControls | undefined,
  signal: AbortSignal | undefined,
  action: (root: PublicationRootIdentity) => Promise<LockResult<T>>,
): Promise<LockResult<T>> {
  await publicationCheckpoint(controls, "before-lock", generationId, null);
  const root = await identifyPublicationRoot(snapshot);
  if (root === null) {
    return Object.freeze({
      kind: "error",
      reason: "invalid-path",
      diagnostic: "The publication output root is not a stable contained directory",
    });
  }
  const lockPath = join(root.outputRoot, ".publish.lock");
  let acquired = false;
  let lockDevice: bigint | null = null;
  let lockInode: bigint | null = null;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (signal?.aborted === true) {
      return Object.freeze({
        kind: "error",
        reason: "cancelled",
        diagnostic: "Publication was cancelled while waiting for its lock",
      });
    }
    if (!(await publicationRootMatches(root))) {
      return Object.freeze({
        kind: "error",
        reason: "ownership",
        diagnostic: "The publication output root changed; manual recovery is required",
      });
    }
    try {
      await mkdir(lockPath);
      const metadata = await lstat(lockPath, { bigint: true });
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        return Object.freeze({
          kind: "error",
          reason: "ownership",
          diagnostic: "The publication lock identity is uncertain; manual recovery is required",
        });
      }
      lockDevice = metadata.dev;
      lockInode = metadata.ino;
      acquired = true;
      break;
    } catch {
      if (!(await delay(10, signal))) {
        return Object.freeze({
          kind: "error",
          reason: "cancelled",
          diagnostic: "Publication was cancelled while waiting for its lock",
        });
      }
    }
  }
  if (!acquired) {
    return Object.freeze({
      kind: "error",
      reason: "lock-timeout",
      diagnostic: "The publication lock remains owned or uncertain; manual recovery is required",
    });
  }

  try {
    await publicationCheckpoint(controls, "after-lock", generationId, lockPath);
    return await action(root);
  } finally {
    try {
      await publicationCheckpoint(controls, "before-lock-release", generationId, lockPath);
      const metadata = await lstat(lockPath, { bigint: true });
      const names = await readdir(lockPath);
      if (
        metadata.isDirectory() &&
        !metadata.isSymbolicLink() &&
        metadata.dev === lockDevice &&
        metadata.ino === lockInode &&
        names.length === 0 &&
        (await publicationRootMatches(root))
      ) {
        await rmdir(lockPath);
      }
    } catch {
      // A changed or nonempty lock is deliberately left for manual recovery.
    }
  }
}
