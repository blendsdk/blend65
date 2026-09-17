import { constants } from "node:fs";
import { open } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  checkLimit,
  escapeDiagnosticText,
  hostErrorCode,
  projectDiagnostic,
  PROJECT_CODES,
  ProjectChanged,
  ProjectFailure,
  throwReadFailure,
} from "./diagnostics.js";
import { resolveInput, sameIdentity, sameMetadata, throwPathFailure } from "./paths.js";
import type { ResolvedInput } from "./paths.js";
import type { LoadCheckpoint, ProjectLimits, ProjectLoadControls, SourceRecord } from "./types.js";

/** Fixed production host bounds; private test arguments can only reduce them. */
export const DEFAULT_LIMITS: ProjectLimits = Object.freeze({
  /** One MiB of raw manifest text. */
  manifestBytes: 1_048_576,
  /** Four MiB per raw source. */
  sourceBytes: 4_194_304,
  /** 256 MiB of unique manifest/source bytes. */
  totalBytes: 268_435_456,
  /** Maximum regular source inputs. */
  sourceFiles: 10_000,
  /** Maximum streamed directory entries. */
  visitedEntries: 100_000,
  /** Root depth is zero. */
  depth: 64,
  /** Includes the first complete attempt. */
  attempts: 3,
});

/** Per-attempt ordinary arguments, never an abstract host or replaceable reader. */
export interface LoadContext {
  /** Logical manifest directory used for relative names. */
  readonly logicalRoot: string;
  /** Canonical root used for containment. */
  readonly root: string;
  /** One-based attempt count. */
  readonly attempt: number;
  /** Fixed production bounds or trusted reductions. */
  readonly limits: ProjectLimits;
  /** Optional awaited fixture mutation, absent in production. */
  readonly onCheckpoint: ProjectLoadControls["onCheckpoint"];
}

/** Await an exact boundary; callback errors remain programmer failures. */
export async function checkpoint(
  context: LoadContext,
  phase: LoadCheckpoint["phase"],
  sourceId: string | null = null,
): Promise<void> {
  await context.onCheckpoint?.(Object.freeze({ phase, attempt: context.attempt, sourceId }));
}

/** Resolve again before/after native use, refusing observed path or metadata replacement. */
export async function guardPath(input: ResolvedInput, context: LoadContext): Promise<void> {
  const current = await resolveInput(
    input.logicalPath,
    context.logicalRoot,
    context.root,
    input.sourceId,
    true,
  );
  if (
    current.resolvedPath !== input.resolvedPath ||
    !sameMetadata(current.metadata, input.metadata)
  )
    throw new ProjectChanged();
}

/** Convert only actual handle-stat failures, not exceptions raised by fixture callbacks. */
async function handleMetadata(handle: FileHandle, input: ResolvedInput) {
  try {
    return await handle.stat({ bigint: true });
  } catch (error) {
    throwReadFailure(error, input.sourceId, true);
  }
}

/**
 * Read through a verified regular handle with finite allocation and fatal UTF-8 decoding.
 * No-follow rejects final-component swaps where the host supports it; nonblocking opens
 * prevent a replaced FIFO from hanging before the handle's regular-file check.
 * Callback exceptions propagate unchanged, while the finally block always closes the handle.
 */
export async function readInput(
  input: ResolvedInput,
  context: LoadContext,
  manifest: boolean,
  revalidation = false,
): Promise<SourceRecord> {
  const name = manifest ? "manifestBytes" : "sourceBytes";
  const maximum = context.limits[name];
  if (!input.metadata.isFile()) throwPathFailure(input.sourceId, "expected a regular file");
  checkLimit(name, maximum, Number(input.metadata.size));
  await checkpoint(context, "before-open", input.sourceId);
  await guardPath(input, context);
  let handle: FileHandle;
  try {
    handle = await open(
      input.resolvedPath,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
    );
  } catch (error) {
    if (hostErrorCode(error) === "ELOOP") throw new ProjectChanged();
    throwReadFailure(error, input.sourceId, true);
  }
  try {
    await checkpoint(context, "after-open", input.sourceId);
    const opened = await handleMetadata(handle, input);
    if (!opened.isFile()) throwPathFailure(input.sourceId, "expected a regular file");
    if (!sameIdentity(opened, input.metadata)) throw new ProjectChanged();
    checkLimit(name, maximum, Number(opened.size));
    const chunks: Buffer[] = [];
    let length = 0;
    for (;;) {
      // At most maximum+1 bytes can be admitted: the extra byte detects growth at the cap.
      const buffer = Buffer.alloc(Math.min(65_536, maximum - length + 1));
      let bytesRead: number;
      try {
        ({ bytesRead } = await handle.read(buffer, 0, buffer.length, null));
      } catch (error) {
        throwReadFailure(error, input.sourceId, true);
      }
      if (bytesRead === 0) break;
      length += bytesRead;
      checkLimit(name, maximum, length);
      chunks.push(buffer.subarray(0, bytesRead));
    }
    await checkpoint(context, "after-read", input.sourceId);
    if (revalidation) await checkpoint(context, "after-revalidation-read", input.sourceId);
    const after = await handleMetadata(handle, input);
    if (!sameMetadata(input.metadata, after) || !sameMetadata(opened, after))
      throw new ProjectChanged();
    await guardPath(input, context);
    const bytes = Buffer.concat(chunks, length);
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      throw new ProjectFailure([
        projectDiagnostic(
          PROJECT_CODES.utf8,
          "Input '" + escapeDiagnosticText(input.sourceId) + "' is not valid UTF-8",
          { sourceId: input.sourceId, start: 0, end: length },
        ),
      ]);
    }
    return Object.freeze({
      sourceId: input.sourceId,
      text,
      byteLength: length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      resolvedPath: input.resolvedPath,
    });
  } finally {
    await handle.close();
  }
}
