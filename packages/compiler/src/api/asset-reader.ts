/**
 * The disk-backed asset reader for `embed()`.
 *
 * Resolution is strictly source-file-relative: the embed path resolves
 * against the directory of the source file containing the call, then must
 * stay inside the project root. Containment is checked twice — lexically
 * first, so a `..` escape is rejected without touching the filesystem
 * (whether or not the target exists), then on the CANONICAL (symlink-
 * resolved) path, so a symlink inside the project pointing outside it
 * cannot smuggle bytes in. The 65536-byte cap is enforced by `stat` BEFORE
 * the file is read (a size bomb is rejected without reading it) and
 * re-checked on the actual bytes afterwards, closing the stat→read race.
 *
 * Reads are binary end-to-end (`Uint8Array`) — a text decode would corrupt
 * bytes at or above `$80`.
 */

import { readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import type { AssetReader, AssetReadResult, SourceId } from "@blend65/core";

/** The largest embeddable file: nothing larger fits the address space. */
const MAX_EMBED_BYTES = 65536;

/** What the disk reader needs at construction. */
export interface DiskAssetReaderInput {
  /** SourceId → the absolute path of that source file (built at interning). */
  readonly sources: ReadonlyMap<SourceId, string>;
  /** The project root every resolved asset must stay inside. */
  readonly projectRoot: string;
}

/** A path literal the language accepts: printable ASCII, no escapes. */
function isValidPathLiteral(relPath: string): boolean {
  if (relPath.length === 0 || relPath.includes("\\")) return false;
  for (const ch of relPath) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x20 || cp > 0x7e) return false;
  }
  return true;
}

/**
 * Builds the disk-backed reader over the compilation's source-path map.
 *
 * @param input The source-path map and the project root.
 * @returns The reader `analyze()` consumes.
 */
export function createDiskAssetReader(input: DiskAssetReaderInput): AssetReader {
  const lexicalRoot = resolve(input.projectRoot) + sep;

  return {
    readAsset(sourceId: SourceId, relPath: string): AssetReadResult {
      // An absolute or escape-bearing/non-printable path literal is
      // rejected as invalid before any resolution.
      if (!isValidPathLiteral(relPath) || isAbsolute(relPath)) {
        return { kind: "not-found" };
      }

      const sourcePath = input.sources.get(sourceId);
      if (sourcePath === undefined) return { kind: "not-found" };
      const resolved = resolve(dirname(sourcePath), relPath);

      // Lexical containment first — needs no filesystem access, so a `..`
      // escape is rejected whether or not the target exists.
      if (!resolved.startsWith(lexicalRoot)) return { kind: "outside-root" };

      // Canonicalize, then re-check containment on the canonical path — a
      // lexical prefix check alone would pass an inside-the-project symlink
      // that points outside it.
      let canonical: string;
      let canonicalRoot: string;
      try {
        canonical = realpathSync(resolved);
        canonicalRoot = realpathSync(resolve(input.projectRoot)) + sep;
      } catch {
        return { kind: "not-found" };
      }
      if (!canonical.startsWith(canonicalRoot)) return { kind: "outside-root" };

      try {
        const size = statSync(canonical).size;
        if (size > MAX_EMBED_BYTES) return { kind: "too-large", size };
        const bytes = new Uint8Array(readFileSync(canonical));
        if (bytes.byteLength > MAX_EMBED_BYTES) {
          return { kind: "too-large", size: bytes.byteLength };
        }
        return { kind: "ok", bytes, resolvedPath: canonical };
      } catch {
        return { kind: "not-found" };
      }
    },
  };
}
