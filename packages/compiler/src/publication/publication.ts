import { randomUUID } from "node:crypto";
import { lstat, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import type { ProjectSnapshot } from "../project/types.js";
import { cleanupGenerationsLocked, rememberPredecessor } from "./cleanup.js";
import {
  encodeCurrentRecord,
  generationIdentityMatches,
  identifyGenerationDirectory,
  identifyPublicationFile,
  publicationFileContentMatches,
  readCurrentGenerationForMutation,
} from "./current-record.js";
import type { IdentifiedGeneration } from "./current-record.js";
import { publicationCheckpoint, publicationRootMatches, withPublicationLock } from "./lock.js";
import { createGenerationPinLocked } from "./pins.js";

/** One expected immutable file prepared before publication begins. */
export interface PublishedFileExpectation {
  /** Single generation-relative filename. */
  readonly path: string;
  /** Exact expected byte count. */
  readonly bytes: number;
  /** Lowercase SHA-256 of the complete file. */
  readonly sha256: string;
}

/** Complete staging input consumed by one publication attempt. */
export interface PreparedGeneration {
  /** Stable project and output-root snapshot. */
  readonly snapshot: ProjectSnapshot;
  /** Canonical lowercase UUID v4 generation identity. */
  readonly generationId: string;
  /** Exact owned staging directory. */
  readonly stagingDirectory: string;
  /** Exact eight-file expectation set. */
  readonly files: readonly PublishedFileExpectation[];
  /** Generation-relative primary artifact filename. */
  readonly primaryArtifact: string;
  /** SHA-256 of `.build.json`. */
  readonly buildJsonSha256: string;
  /** Whether publication must create a reader pin before releasing the lock. */
  readonly pinForRun?: boolean;
  /** Optional cancellation signal. */
  readonly signal?: AbortSignal;
}

/** One completely verified immutable generation. */
export interface PublishedGeneration {
  /** Canonical generation identity. */
  readonly generationId: string;
  /** Absolute immutable generation directory. */
  readonly directory: string;
  /** SHA-256 of the generation's build sidecar. */
  readonly buildJsonSha256: string;
  /** Generation-relative primary artifact filename. */
  readonly primaryArtifact: string;
}

/** Independent reader ownership of one immutable generation. */
export interface GenerationPin extends PublishedGeneration {
  /** Unique lowercase UUID v4 pin identity. */
  readonly pinId: string;
  /** Release only this reader's pin after its owned work stops. */
  readonly release: () => Promise<void>;
}

/** Mutation boundary exposed only for deterministic filesystem tests. */
export type PublicationCheckpointPhase =
  | "before-lock"
  | "after-lock"
  | "before-generation-rename"
  | "after-generation-rename"
  | "before-current-replace"
  | "after-current-replace"
  | "after-pin-create"
  | "before-cleanup-scan"
  | "before-generation-remove"
  | "before-pin-remove"
  | "before-lock-release";

/** One deterministic publication mutation boundary. */
export interface PublicationCheckpoint {
  /** Boundary discriminator. */
  readonly phase: PublicationCheckpointPhase;
  /** Generation involved in the operation. */
  readonly generationId: string;
  /** Exact affected path when one exists. */
  readonly path: string | null;
}

/** Optional test-only checkpoint observer. */
export interface PublicationControls {
  /** Observe or pause immediately before/after documented mutation boundaries. */
  readonly onCheckpoint?: (checkpoint: PublicationCheckpoint) => void | Promise<void>;
}

/** Closed publication failure categories shared by publication, lookup, pins, and cleanup. */
export type PublicationErrorReason =
  | "invalid-path"
  | "ownership"
  | "lock-timeout"
  | "cancelled"
  | "invalid-staging"
  | "current"
  | "pin"
  | "cleanup"
  | "committed-recovery";

/** Inputs to current-generation pin acquisition. */
export interface GenerationPinInput {
  /** Stable project and output-root snapshot. */
  readonly snapshot: ProjectSnapshot;
  /** Optional cancellation signal. */
  readonly signal?: AbortSignal;
}

/** Current-generation lookup result. */
export type PublicationLookupResult =
  | { readonly kind: "complete"; readonly generation: PublishedGeneration }
  | {
      readonly kind: "error";
      readonly reason: PublicationErrorReason;
      readonly diagnostic: string;
    };

/** Reader-pin acquisition result. */
export type GenerationPinResult =
  | { readonly kind: "complete"; readonly pin: GenerationPin }
  | {
      readonly kind: "error";
      readonly reason: PublicationErrorReason;
      readonly diagnostic: string;
    };

/** Mutation result without a returned generation. */
export type PublicationOperationResult =
  | { readonly kind: "complete" }
  | {
      readonly kind: "error";
      readonly reason: PublicationErrorReason;
      readonly diagnostic: string;
    };

/** Complete publication result. */
export type PublicationResult =
  | {
      readonly kind: "complete";
      readonly generation: PublishedGeneration;
      readonly pin: GenerationPin | null;
    }
  | {
      readonly kind: "error";
      readonly reason: PublicationErrorReason;
      readonly diagnostic: string;
    };

/** Return one immutable publication failure. */
function failure(reason: PublicationErrorReason, diagnostic: string): PublicationResult {
  return Object.freeze({ kind: "error", reason, diagnostic });
}

/** Remove only an exact owned pre-commit staging directory. */
async function removeStaging(path: string): Promise<void> {
  try {
    await rm(path, { recursive: true, force: true });
  } catch {
    // The primary failure remains authoritative; leftover staging is safe crash debris.
  }
}

/** Return whether caller-supplied publication inputs have the exact direct shape. */
function validInput(input: PreparedGeneration): boolean {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
  const hash = /^[0-9a-f]{64}$/u;
  const paths = input.files.map(({ path }) => path);
  return (
    uuid.test(input.generationId) &&
    hash.test(input.buildJsonSha256) &&
    isAbsolute(input.stagingDirectory) &&
    dirname(input.stagingDirectory) === input.snapshot.outDir &&
    basename(input.stagingDirectory) === `.staging-${input.generationId}` &&
    input.files.length === 8 &&
    new Set(paths).size === paths.length &&
    input.files.every(
      ({ path, bytes, sha256 }) =>
        basename(path) === path &&
        path.length > 0 &&
        Number.isSafeInteger(bytes) &&
        bytes >= 0 &&
        hash.test(sha256),
    ) &&
    paths.includes(".build.json") &&
    paths.includes(input.primaryArtifact)
  );
}

/** Read cancellation state at the exact mutation boundary without retaining stale narrowing. */
function isCancelled(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

/** Return whether a filesystem error means that the exact path is absent. */
function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/**
 * Atomically publish one already verified staging directory and replace only `current.json`.
 *
 * Compilation and assembly are deliberately outside this function. Before the generation rename,
 * cancellation removes only the caller-owned staging tree. Once current is replaced, every error
 * preserves the complete committed generation for manual recovery.
 */
export async function publishGeneration(
  input: PreparedGeneration,
  controls?: PublicationControls,
): Promise<PublicationResult> {
  if (!validInput(input))
    return failure("invalid-staging", "Prepared publication input is invalid");
  let committed = false;
  let mayRemoveStaging = true;
  let identifiedStaging: IdentifiedGeneration | null = null;
  const result = await withPublicationLock(
    input.snapshot,
    input.generationId,
    controls,
    input.signal,
    async (root) => {
      if (!(await publicationRootMatches(root))) {
        return Object.freeze({
          kind: "error" as const,
          reason: "ownership" as const,
          diagnostic: "The output root changed before publication; manual recovery is required",
        });
      }
      const staged = await identifyGenerationDirectory(
        input.stagingDirectory,
        input.generationId,
        input.buildJsonSha256,
        input.files,
        input.snapshot,
      );
      if (staged === null) {
        mayRemoveStaging = false;
        return Object.freeze({
          kind: "error" as const,
          reason: "invalid-staging" as const,
          diagnostic: "The prepared generation failed its exact file or cross-hash checks",
        });
      }
      identifiedStaging = staged;
      if (staged.generation.primaryArtifact !== input.primaryArtifact) {
        return Object.freeze({
          kind: "error" as const,
          reason: "invalid-staging" as const,
          diagnostic: "The prepared generation has the wrong primary artifact",
        });
      }
      const prior = await readCurrentGenerationForMutation(input.snapshot);
      const priorGeneration = prior.kind === "complete" ? prior.generation.generationId : null;
      if (prior.kind === "error") {
        try {
          await lstat(join(root.outputRoot, "current.json"));
          return prior;
        } catch (error) {
          // A genuinely absent current record is valid only for the first publication.
          if (!isNotFound(error)) return prior;
        }
      }

      const generationDirectory = join(root.outputRoot, input.generationId);
      await publicationCheckpoint(
        controls,
        "before-generation-rename",
        input.generationId,
        generationDirectory,
      );
      if (isCancelled(input.signal)) {
        return Object.freeze({
          kind: "error" as const,
          reason: "cancelled" as const,
          diagnostic: "Publication was cancelled before generation commit",
        });
      }
      if (!(await publicationRootMatches(root))) {
        return Object.freeze({
          kind: "error" as const,
          reason: "ownership" as const,
          diagnostic:
            "The output root changed before generation commit; manual recovery is required",
        });
      }
      if (!(await generationIdentityMatches(staged, input.stagingDirectory))) {
        mayRemoveStaging = false;
        return Object.freeze({
          kind: "error" as const,
          reason: "ownership" as const,
          diagnostic: "The prepared generation changed before commit; manual recovery is required",
        });
      }
      try {
        await lstat(generationDirectory);
        return Object.freeze({
          kind: "error" as const,
          reason: "ownership" as const,
          diagnostic: "The immutable generation target already exists",
        });
      } catch {
        // Absence is required immediately before the single generation rename.
      }
      try {
        await rename(input.stagingDirectory, generationDirectory);
        committed = true;
      } catch {
        return Object.freeze({
          kind: "error" as const,
          reason: "invalid-staging" as const,
          diagnostic: "The prepared generation could not be committed",
        });
      }
      await publicationCheckpoint(
        controls,
        "after-generation-rename",
        input.generationId,
        generationDirectory,
      );
      if (isCancelled(input.signal)) {
        return Object.freeze({
          kind: "error" as const,
          reason: "cancelled" as const,
          diagnostic:
            "Publication was cancelled after generation commit and before current replacement",
        });
      }
      if (!(await generationIdentityMatches(staged, generationDirectory))) {
        return Object.freeze({
          kind: "error" as const,
          reason: "committed-recovery" as const,
          diagnostic:
            "The committed generation changed before current replacement; manual recovery is required",
        });
      }

      const committedGeneration = await identifyGenerationDirectory(
        generationDirectory,
        input.generationId,
        input.buildJsonSha256,
        input.files,
        input.snapshot,
      );
      if (committedGeneration === null) {
        return Object.freeze({
          kind: "error" as const,
          reason: "committed-recovery" as const,
          diagnostic: "The committed generation failed validation; manual recovery is required",
        });
      }

      const candidate = join(root.outputRoot, `.current-${randomUUID()}.tmp`);
      const currentPath = join(root.outputRoot, "current.json");
      const currentBytes = encodeCurrentRecord(
        Object.freeze({
          schemaVersion: 1,
          generationId: input.generationId,
          buildJsonSha256: input.buildJsonSha256,
        }),
      );
      let candidateIdentity: Awaited<ReturnType<typeof identifyPublicationFile>> = null;
      try {
        await writeFile(candidate, currentBytes, { flag: "wx" });
        candidateIdentity = await identifyPublicationFile(candidate);
        if (candidateIdentity === null) throw new Error("candidate identity");
        await publicationCheckpoint(
          controls,
          "before-current-replace",
          input.generationId,
          currentPath,
        );
        if (isCancelled(input.signal)) {
          if (await publicationFileContentMatches(candidate, candidateIdentity, currentBytes)) {
            await rm(candidate, { force: true });
          }
          return Object.freeze({
            kind: "error" as const,
            reason: "cancelled" as const,
            diagnostic:
              "Publication was cancelled after generation commit and before current replacement",
          });
        }
        if (!(await publicationRootMatches(root))) throw new Error("root changed");
        if (!(await generationIdentityMatches(committedGeneration, generationDirectory))) {
          throw new Error("generation changed");
        }
        if (!(await publicationFileContentMatches(candidate, candidateIdentity, currentBytes))) {
          throw new Error("candidate changed");
        }
        if (isCancelled(input.signal)) {
          if (await publicationFileContentMatches(candidate, candidateIdentity, currentBytes)) {
            await rm(candidate, { force: true });
          }
          return Object.freeze({
            kind: "error" as const,
            reason: "cancelled" as const,
            diagnostic:
              "Publication was cancelled after generation commit and before current replacement",
          });
        }
        await rename(candidate, currentPath);
      } catch {
        if (
          candidateIdentity !== null &&
          (await publicationFileContentMatches(candidate, candidateIdentity, currentBytes))
        ) {
          await rm(candidate, { force: true });
        }
        return Object.freeze({
          kind: "error" as const,
          reason: "committed-recovery" as const,
          diagnostic: "The generation committed but current replacement needs manual recovery",
        });
      }
      await publicationCheckpoint(
        controls,
        "after-current-replace",
        input.generationId,
        currentPath,
      );
      if (!(await generationIdentityMatches(committedGeneration, generationDirectory))) {
        return Object.freeze({
          kind: "error" as const,
          reason: "committed-recovery" as const,
          diagnostic: "The committed current generation changed; manual recovery is required",
        });
      }
      const generation = committedGeneration.generation;

      let pin: GenerationPin | null = null;
      if (input.pinForRun === true) {
        const acquired = await createGenerationPinLocked(
          input.snapshot,
          generation,
          controls,
          root,
        );
        if (acquired.kind === "error") return acquired;
        pin = acquired.pin;
        await publicationCheckpoint(controls, "after-pin-create", input.generationId, null);
      }
      rememberPredecessor(root.outputRoot, priorGeneration);
      const cleanup = await cleanupGenerationsLocked(
        input.snapshot,
        controls,
        root,
        priorGeneration,
      );
      if (cleanup.kind === "error") return cleanup;
      return Object.freeze({
        kind: "complete" as const,
        value: Object.freeze({ generation, pin }),
      });
    },
  );
  if (result.kind === "error") {
    if (
      !committed &&
      mayRemoveStaging &&
      identifiedStaging !== null &&
      (await generationIdentityMatches(identifiedStaging, input.stagingDirectory))
    ) {
      await removeStaging(input.stagingDirectory);
    }
    return failure(result.reason, result.diagnostic);
  }
  return Object.freeze({
    kind: "complete",
    generation: result.value.generation,
    pin: result.value.pin,
  });
}
