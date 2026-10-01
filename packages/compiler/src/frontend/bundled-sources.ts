import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, openSync, readSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { projectDiagnostic, PROJECT_CODES, ProjectFailure } from "../project/diagnostics.js";
import { projectInputSha256 } from "../project/input-identity.js";
import { PROFILES } from "../project/manifest.js";
import { DEFAULT_LIMITS } from "../project/reads.js";
import type { ProjectDiagnostic, ProjectSnapshot, SourceRecord } from "../project/types.js";

/** Stable package-owned logical spelling, independent of where the compiler is installed. */
const LIBRARY_SOURCE_ID = "@blend65/stdlib/c64/input.blend";
/** Resolve the same fixed asset from either built modules or development source modules. */
const LIBRARY_PATH = fileURLToPath(new URL("../../stdlib/c64/input.blend", import.meta.url));

/** A complete internal analysis view, or safe diagnostics with no partially admitted library. */
type PreparedInputs =
  | { readonly kind: "complete"; readonly snapshot: ProjectSnapshot }
  | { readonly kind: "error"; readonly diagnostics: readonly ProjectDiagnostic[] };

/** Throw only logical-input diagnostics, never a private installed path or native exception. */
function reject(code: string, message: string): never {
  throw new ProjectFailure([
    projectDiagnostic(code, `Bundled source '${LIBRARY_SOURCE_ID}': ${message}`),
  ]);
}

/**
 * Read one regular installed file with a finite byte budget and exact UTF-8 decoding.
 * Chunk allocation is capped before each read, including the one overflow-detection byte.
 * Nonblocking/no-follow opens prevent a replaced FIFO or final symlink from hanging this call.
 */
function readLibrary(sourceId: string): SourceRecord {
  const resolvedPath = realpathSync(LIBRARY_PATH);
  const descriptor = openSync(
    resolvedPath,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
  );
  try {
    const before = fstatSync(descriptor);
    if (!before.isFile()) reject(PROJECT_CODES.read, "expected a regular file");
    const maximum = DEFAULT_LIMITS.sourceBytes;
    if (before.size > maximum) reject(PROJECT_CODES.limit, `source byte limit ${maximum} exceeded`);
    const chunks: Buffer[] = [];
    let byteLength = 0;
    for (;;) {
      const chunk = Buffer.alloc(Math.min(65_536, maximum - byteLength + 1));
      const count = readSync(descriptor, chunk, 0, chunk.length, null);
      if (count === 0) break;
      byteLength += count;
      if (byteLength > maximum)
        reject(PROJECT_CODES.limit, `source byte limit ${maximum} exceeded`);
      chunks.push(chunk.subarray(0, count));
    }
    const after = fstatSync(descriptor);
    if (
      after.size !== byteLength ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs
    ) {
      reject(PROJECT_CODES.read, "file changed while reading");
    }
    const bytes = Buffer.concat(chunks, byteLength);
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch {
      reject(PROJECT_CODES.utf8, "invalid UTF-8 bytes");
    }
    return Object.freeze({
      sourceId,
      text,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      byteLength,
      resolvedPath,
    });
  } finally {
    closeSync(descriptor);
  }
}

/**
 * Add the selected C64 profile's fixed installed source before module discovery.
 * User records and their logical names are never mutated or reinterpreted. The returned
 * view is request-local: callers reuse it internally rather than preparing it a second time.
 * @example const prepared = prepareAnalysisInputs(userSnapshot);
 */
export function prepareAnalysisInputs(snapshot: ProjectSnapshot): PreparedInputs {
  if (!PROFILES.some((profile) => profile === snapshot.effectiveTarget)) {
    return Object.freeze({ kind: "complete", snapshot });
  }
  const userIds = new Set(snapshot.sources.map(({ sourceId }) => sourceId));
  let sourceId = LIBRARY_SOURCE_ID;
  while (userIds.has(sourceId)) sourceId = "@" + sourceId;
  try {
    const library = readLibrary(sourceId);
    const sources = Object.freeze(
      [...snapshot.sources, library].sort((left, right) =>
        Buffer.compare(Buffer.from(left.sourceId, "utf8"), Buffer.from(right.sourceId, "utf8")),
      ),
    );
    return Object.freeze({
      kind: "complete",
      snapshot: Object.freeze({
        ...snapshot,
        sources,
        inputSha256: projectInputSha256(snapshot.manifestSource, sources, snapshot.overrides),
      }),
    });
  } catch (error) {
    return Object.freeze({
      kind: "error",
      diagnostics:
        error instanceof ProjectFailure
          ? error.diagnostics
          : Object.freeze([
              projectDiagnostic(
                PROJECT_CODES.read,
                `Cannot read bundled source '${LIBRARY_SOURCE_ID}'`,
              ),
            ]),
    });
  }
}
