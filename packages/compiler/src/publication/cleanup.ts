import { createHash } from "node:crypto";
import { lstat, readFile, readdir, rm, rmdir } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectSnapshot } from "../project/types.js";
import {
  generationIdentityMatches,
  identifyGenerationDirectory,
  readCurrentGenerationForMutation,
} from "./current-record.js";
import type { PublicationRootIdentity } from "./lock.js";
import { publicationCheckpoint, publicationRootMatches, withPublicationLock } from "./lock.js";
import type { PublicationControls, PublicationOperationResult } from "./publication.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PIN = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.pin$/u;
const predecessors = new Map<string, string | null>();

/** Return whether a filesystem error means that the exact path is absent. */
function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/** Remember the immediately prior current generation only for this live compiler process. */
export function rememberPredecessor(outputRoot: string, generationId: string | null): void {
  predecessors.set(outputRoot, generationId);
}

/** Scan the complete pin namespace and return every protected generation. */
async function protectedGenerations(outputRoot: string): Promise<Set<string> | null> {
  const protectedIds = new Set<string>();
  const pinIdentities = new Set<string>();
  const pinsRoot = join(outputRoot, ".pins");
  try {
    const rootMetadata = await lstat(pinsRoot);
    if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) return null;
  } catch (error) {
    return isNotFound(error) ? protectedIds : null;
  }
  for (const generationId of await readdir(pinsRoot)) {
    if (!UUID_V4.test(generationId)) return null;
    const directory = join(pinsRoot, generationId);
    const metadata = await lstat(directory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) return null;
    const entries = await readdir(directory);
    for (const entry of entries) {
      if (PIN.exec(entry) === null) return null;
      const pinMetadata = await lstat(join(directory, entry));
      if (!pinMetadata.isFile() || pinMetadata.isSymbolicLink() || pinMetadata.size !== 0)
        return null;
      const identity = `${pinMetadata.dev}:${pinMetadata.ino}`;
      if (pinIdentities.has(identity)) return null;
      pinIdentities.add(identity);
      protectedIds.add(generationId);
    }
  }
  return protectedIds;
}

/** Remove only validated, unpinned, non-current generations while the lock is held. */
export async function cleanupGenerationsLocked(
  snapshot: ProjectSnapshot,
  controls: PublicationControls | undefined,
  root: PublicationRootIdentity,
  explicitPredecessor?: string | null,
): Promise<PublicationOperationResult> {
  await publicationCheckpoint(
    controls,
    "before-cleanup-scan",
    "00000000-0000-4000-8000-000000000000",
    null,
  );
  if (!(await publicationRootMatches(root))) {
    return Object.freeze({
      kind: "error",
      reason: "ownership",
      diagnostic: "The output root changed before cleanup; manual recovery is required",
    });
  }
  const current = await readCurrentGenerationForMutation(snapshot);
  if (current.kind === "error") return current;
  const protectedIds = await protectedGenerations(root.outputRoot);
  if (protectedIds === null) {
    return Object.freeze({
      kind: "error",
      reason: "pin",
      diagnostic: "The pin namespace is malformed or aliased; manual recovery is required",
    });
  }
  const predecessor =
    explicitPredecessor === undefined ? predecessors.get(root.outputRoot) : explicitPredecessor;
  if (predecessor === undefined) {
    return Object.freeze({ kind: "complete" });
  }
  const keep = new Set([
    current.generation.generationId,
    ...(predecessor === null ? [] : [predecessor]),
    ...protectedIds,
  ]);
  for (const name of await readdir(root.outputRoot)) {
    if (!UUID_V4.test(name) || keep.has(name)) continue;
    const directory = join(root.outputRoot, name);
    const metadata = await lstat(directory, { bigint: true });
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      return Object.freeze({
        kind: "error",
        reason: "cleanup",
        diagnostic:
          "A generation candidate is not an owned ordinary directory; manual recovery is required",
      });
    }
    const buildPath = join(directory, ".build.json");
    const buildMetadata = await lstat(buildPath);
    if (!buildMetadata.isFile() || buildMetadata.isSymbolicLink()) {
      return Object.freeze({
        kind: "error",
        reason: "cleanup",
        diagnostic: "A generation candidate cannot be proven owned; manual recovery is required",
      });
    }
    const buildHash = createHash("sha256")
      .update(await readFile(buildPath))
      .digest("hex");
    const generation = await identifyGenerationDirectory(directory, name, buildHash);
    if (generation === null) {
      return Object.freeze({
        kind: "error",
        reason: "cleanup",
        diagnostic: "A generation candidate failed validation; manual recovery is required",
      });
    }
    await publicationCheckpoint(controls, "before-generation-remove", name, directory);
    if (!(await publicationRootMatches(root))) {
      return Object.freeze({
        kind: "error",
        reason: "ownership",
        diagnostic: "The output root changed during cleanup; manual recovery is required",
      });
    }
    const protectedAfterCheckpoint = await protectedGenerations(root.outputRoot);
    if (protectedAfterCheckpoint === null || protectedAfterCheckpoint.has(name)) {
      return Object.freeze({
        kind: "error",
        reason: "pin",
        diagnostic:
          "A generation became pinned or its protection state changed; manual recovery is required",
      });
    }
    const currentAfterCheckpoint = await readCurrentGenerationForMutation(snapshot);
    if (
      currentAfterCheckpoint.kind === "error" ||
      currentAfterCheckpoint.generation.generationId === name
    ) {
      return Object.freeze({
        kind: "error",
        reason: "cleanup",
        diagnostic: "The current generation changed during cleanup; manual recovery is required",
      });
    }
    if (!(await generationIdentityMatches(generation, directory))) {
      return Object.freeze({
        kind: "error",
        reason: "cleanup",
        diagnostic: "A generation candidate changed before removal; manual recovery is required",
      });
    }
    await rm(directory, { recursive: true });
    const pinDirectory = join(root.outputRoot, ".pins", name);
    try {
      if ((await readdir(pinDirectory)).length === 0) await rmdir(pinDirectory);
    } catch {
      // An absent empty pin directory needs no cleanup.
    }
  }
  return Object.freeze({ kind: "complete" });
}

/** Clean old generations conservatively under the shared publication lock. */
export async function cleanupGenerations(
  snapshot: ProjectSnapshot,
  controls?: PublicationControls,
): Promise<PublicationOperationResult> {
  const result = await withPublicationLock(
    snapshot,
    "00000000-0000-4000-8000-000000000000",
    controls,
    undefined,
    async (root) => {
      const cleanup = await cleanupGenerationsLocked(snapshot, controls, root);
      return cleanup.kind === "error"
        ? cleanup
        : Object.freeze({ kind: "complete" as const, value: undefined });
    },
  );
  return result.kind === "error" ? result : Object.freeze({ kind: "complete" });
}
