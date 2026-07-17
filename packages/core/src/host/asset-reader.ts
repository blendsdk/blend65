/**
 * The binary asset-reading seam for `embed()`.
 *
 * The frontend owns no file paths — spans carry a `SourceId` only, and the
 * source map interns project-relative display paths — so the reader is
 * keyed by the SourceId of the source file containing the `embed()` call.
 * All path knowledge (source-file locations, project-root containment,
 * canonicalization) lives in the implementation; the `resolvedPath` in the
 * ok arm is how analysis learns an asset's canonical path.
 *
 * The byte contract is `Uint8Array` end-to-end: a text-decoding read
 * corrupts bytes at or above `$80`, so the text-oriented host interface is
 * deliberately not reused here.
 */

import type { SourceId } from "../diagnostics/source-span.js";

/** The outcome of resolving + reading one embedded asset. */
export type AssetReadResult =
  /** The asset's bytes plus its canonical absolute path. */
  | { readonly kind: "ok"; readonly bytes: Uint8Array; readonly resolvedPath: string }
  /** The path is invalid or the file does not exist. */
  | { readonly kind: "not-found" }
  /** The resolved (canonical) path lands outside the project root. */
  | { readonly kind: "outside-root" }
  /** The file exceeds the 65536-byte cap (nothing larger fits the address space). */
  | { readonly kind: "too-large"; readonly size: number };

/**
 * Resolves and reads a binary asset referenced from a source file.
 * Injected into analysis by compiler-layer hosts; absent in hosts without
 * disk access (tests, editors), where an `embed()` poisons silently.
 */
export interface AssetReader {
  /**
   * Reads the asset `relPath` names, resolved relative to the source file
   * identified by `sourceId`.
   */
  readAsset(sourceId: SourceId, relPath: string): AssetReadResult;
}
