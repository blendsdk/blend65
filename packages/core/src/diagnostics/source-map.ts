/**
 * The {@link SourceMap} — the process-wide registry mapping interned
 * {@link SourceId}s back to file paths and contents.
 *
 * RD-11a deliberately kept spans as tiny numeric triples with no back-pointer
 * to their file (see `source-span.ts`); this registry closes that loop. It is
 * also the owner of the per-source {@link LineMap} cache (R14, PF-006), so
 * consumers never rebuild line tables for a file they have already resolved.
 *
 * Covers RD-11 §4.2 as amended by AR-104 (adds `has`) · R13/R14 · AR-Q7.
 */

import type { SourceId } from "./source-span.js";
import { LineMap } from "./line-map.js";

/**
 * Registry of interned source files, keyed by path.
 *
 * Obtain an instance via {@link createSourceMap}. Interning is path-keyed:
 * the same path always yields the same id, and re-interning with changed
 * content replaces the stored content in place (the LSP re-edit path, AR-78).
 * The throwing getters are for ids the caller *knows* are interned; renderers
 * facing untrusted ids (e.g. the RD-16 config sentinel `-2`) must probe with
 * {@link SourceMap.has} first and degrade (R51).
 */
export interface SourceMap {
  /**
   * Interns a source file, returning its {@link SourceId}.
   *
   * Path-keyed: a new path is assigned the next sequential id (starting at 0);
   * a known path returns its existing id. If the content differs from what is
   * stored, the content is replaced and the cached {@link LineMap} invalidated
   * (rebuilt lazily on the next {@link SourceMap.getLineMap}).
   *
   * @param path The file path identifying the source.
   * @param content The full source text.
   * @returns The id for this path — stable across re-interns.
   */
  intern(path: string, content: string): SourceId;
  /**
   * `true` iff `id` was returned by a previous {@link SourceMap.intern} call.
   * A non-throwing probe (R51) — safe for negatives, fractions, any number.
   */
  has(id: SourceId): boolean;
  /** Path for an interned id. Throws on an unknown id (programmer error). */
  getPath(id: SourceId): string;
  /** Content for an interned id. Throws on an unknown id (programmer error). */
  getContent(id: SourceId): string;
  /**
   * Get-or-build the cached {@link LineMap} for an interned id (R14).
   * Throws on an unknown id (programmer error).
   */
  getLineMap(id: SourceId): LineMap;
}

/** Per-source record held by the registry. */
interface SourceEntry {
  path: string;
  content: string;
  /** Lazily built and cached; reset to null when content is replaced. */
  lineMap: LineMap | null;
}

/**
 * Creates a fresh, empty {@link SourceMap}.
 *
 * Closure-based factory, matching the {@link createDiagnosticBag} idiom used
 * throughout the diagnostics core.
 *
 * @returns A new registry with no sources interned; ids start at 0 and are
 *   assigned in intern order (deterministic — H5).
 */
export function createSourceMap(): SourceMap {
  // Entries indexed by id; ids are dense (0..n-1) so an array suffices.
  const entries: SourceEntry[] = [];
  // Path → id lookup for the path-keyed intern semantics.
  const idByPath = new Map<string, SourceId>();

  /** Returns the entry for `id`, or throws the AR-Q7 programmer error. */
  function requireEntry(id: SourceId): SourceEntry {
    // Integer check guards against fractional ids indexing into the array
    // (e.g. entries[0.5] is undefined, but entries[0] would wrongly match 0.0
    // vs a fractional probe like 0.5 — Number.isInteger rejects both cleanly).
    const entry = Number.isInteger(id) ? entries[id] : undefined;
    if (entry === undefined) {
      throw new Error(`Unknown SourceId: ${id}`);
    }
    return entry;
  }

  function intern(path: string, content: string): SourceId {
    const existing = idByPath.get(path);
    if (existing !== undefined) {
      const entry = entries[existing];
      if (entry.content !== content) {
        // Re-edit: replace in place and drop the stale LineMap so the next
        // getLineMap() rebuilds against the new content (AR-Q7, AR-78).
        entry.content = content;
        entry.lineMap = null;
      }
      return existing;
    }

    const id = entries.length;
    entries.push({ path, content, lineMap: null });
    idByPath.set(path, id);
    return id;
  }

  function has(id: SourceId): boolean {
    return Number.isInteger(id) && id >= 0 && id < entries.length;
  }

  function getPath(id: SourceId): string {
    return requireEntry(id).path;
  }

  function getContent(id: SourceId): string {
    return requireEntry(id).content;
  }

  function getLineMap(id: SourceId): LineMap {
    const entry = requireEntry(id);
    if (entry.lineMap === null) {
      entry.lineMap = new LineMap(id, entry.content);
    }
    return entry.lineMap;
  }

  return { intern, has, getPath, getContent, getLineMap };
}
