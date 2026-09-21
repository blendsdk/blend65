import { randomUUID } from "node:crypto";
import { lstat, mkdir, readdir, rmdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  identifyPublicationFile,
  publicationFileContentMatches,
  readCurrentGeneration,
} from "./current-record.js";
import type { PublicationRootIdentity } from "./lock.js";
import { publicationCheckpoint, publicationRootMatches, withPublicationLock } from "./lock.js";
import type {
  GenerationPin,
  GenerationPinInput,
  GenerationPinResult,
  PublicationControls,
  PublicationOperationResult,
  PublishedGeneration,
} from "./publication.js";

const pinSnapshots = new WeakMap<GenerationPin, GenerationPinInput["snapshot"]>();

/** Create one directory if absent, then require an ordinary directory. */
async function ensureDirectory(path: string): Promise<boolean> {
  try {
    await mkdir(path);
  } catch {
    // An existing ordinary directory is accepted after non-following validation.
  }
  try {
    const metadata = await lstat(path);
    return metadata.isDirectory() && !metadata.isSymbolicLink();
  } catch {
    return false;
  }
}

/** Create one independent zero-byte generation pin while the publication lock is held. */
export async function createGenerationPinLocked(
  inputSnapshot: GenerationPinInput["snapshot"],
  generation: PublishedGeneration,
  controls: PublicationControls | undefined,
  root: PublicationRootIdentity,
): Promise<GenerationPinResult> {
  if (!(await publicationRootMatches(root))) {
    return Object.freeze({
      kind: "error",
      reason: "ownership",
      diagnostic: "The output root changed before pin creation; manual recovery is required",
    });
  }
  const pinsRoot = join(root.outputRoot, ".pins");
  const generationPins = join(pinsRoot, generation.generationId);
  if (!(await ensureDirectory(pinsRoot)) || !(await ensureDirectory(generationPins))) {
    return Object.freeze({
      kind: "error",
      reason: "pin",
      diagnostic:
        "The pin namespace is not an ordinary owned directory; manual recovery is required",
    });
  }
  const pinId = randomUUID();
  const pinPath = join(generationPins, `${pinId}.pin`);
  try {
    await writeFile(pinPath, new Uint8Array(), { flag: "wx" });
    const metadata = await lstat(pinPath);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size !== 0)
      throw new Error("invalid pin");
  } catch {
    return Object.freeze({
      kind: "error",
      reason: "pin",
      diagnostic: "The reader pin could not be created safely; manual recovery is required",
    });
  }
  const pin: GenerationPin = Object.freeze({
    ...generation,
    pinId,
    async release() {
      const result = await releaseGenerationPin(pin, controls);
      if (result.kind === "error") throw new Error(result.diagnostic);
    },
  });
  pinSnapshots.set(pin, inputSnapshot);
  return Object.freeze({ kind: "complete", pin });
}

/** Acquire an independent pin for the verified current generation. */
export async function pinGeneration(
  input: GenerationPinInput,
  controls?: PublicationControls,
): Promise<GenerationPinResult> {
  const result = await withPublicationLock(
    input.snapshot,
    "00000000-0000-4000-8000-000000000000",
    controls,
    input.signal,
    async (root) => {
      const current = await readCurrentGeneration(input.snapshot);
      if (current.kind === "error") return current;
      const pin = await createGenerationPinLocked(
        input.snapshot,
        current.generation,
        controls,
        root,
      );
      return pin.kind === "error"
        ? pin
        : Object.freeze({ kind: "complete" as const, value: pin.pin });
    },
  );
  return result.kind === "error" ? result : Object.freeze({ kind: "complete", pin: result.value });
}

/** Release one exact pin under the same publication lock. */
export async function releaseGenerationPin(
  pin: GenerationPin,
  controls?: PublicationControls,
): Promise<PublicationOperationResult> {
  const projectSnapshot = pinSnapshots.get(pin);
  if (projectSnapshot === undefined) {
    return Object.freeze({
      kind: "error",
      reason: "pin",
      diagnostic: "The pin owner is not available in this process; manual recovery is required",
    });
  }
  const result = await withPublicationLock(
    projectSnapshot,
    pin.generationId,
    controls,
    undefined,
    async (root) => {
      const pinDirectory = join(root.outputRoot, ".pins", pin.generationId);
      const pinPath = join(pinDirectory, `${pin.pinId}.pin`);
      try {
        const directoryMetadata = await lstat(pinDirectory, { bigint: true });
        if (!directoryMetadata.isDirectory() || directoryMetadata.isSymbolicLink()) {
          throw new Error("invalid pin directory");
        }
        const identifiedPin = await identifyPublicationFile(pinPath);
        if (identifiedPin === null || identifiedPin.bytes.byteLength !== 0) {
          throw new Error("invalid pin");
        }
        await publicationCheckpoint(controls, "before-pin-remove", pin.generationId, pinPath);
        if (!(await publicationRootMatches(root))) throw new Error("root changed");
        const currentDirectory = await lstat(pinDirectory, { bigint: true });
        if (
          !currentDirectory.isDirectory() ||
          currentDirectory.isSymbolicLink() ||
          currentDirectory.dev !== directoryMetadata.dev ||
          currentDirectory.ino !== directoryMetadata.ino
        ) {
          throw new Error("pin directory changed");
        }
        if (!(await publicationFileContentMatches(pinPath, identifiedPin, new Uint8Array()))) {
          throw new Error("pin changed");
        }
        await unlink(pinPath);
        pinSnapshots.delete(pin);
        if ((await readdir(pinDirectory)).length === 0) await rmdir(pinDirectory);
        return Object.freeze({ kind: "complete" as const, value: undefined });
      } catch {
        return Object.freeze({
          kind: "error" as const,
          reason: "pin" as const,
          diagnostic: "The exact reader pin could not be released; manual recovery is required",
        });
      }
    },
  );
  return result.kind === "error" ? result : Object.freeze({ kind: "complete" });
}
