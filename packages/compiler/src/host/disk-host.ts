/**
 * Disk-backed {@link CompilerHost} for the CLI (RD-15 R12/R14/R47).
 *
 * Implements file discovery over the real filesystem: `include`/`exclude` glob
 * expansion via `tinyglobby` (AR-V3), a `projectRoot` containment filter
 * (RD-13 R37 — the config package validates *patterns*, the host validates
 * *results*), and lexicographic sorting (the determinism guarantee R21's
 * `outName` derivation relies on). The buffer-overlay host for the LSP (RD-14)
 * is a separate implementation of the same interface.
 *
 * Lives in `@blend65/compiler` (AR-V9). The three-tier discovery *strategy*
 * (explicit files → config globs → default) composes in the facade
 * (`api/run-frontend.ts`), not here — this host owns only tiers 2/3 expansion.
 */

import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { globSync } from "tinyglobby";
import type { CompilerHost } from "@blend65/core";

/**
 * Config-derived construction inputs for {@link createDiskCompilerHost}.
 *
 * Built AFTER `loadConfig` resolves (AR-V6): every field comes from the merged
 * {@link BlendConfig}.
 */
export interface DiskHostOptions {
  /** `BlendConfig.projectRoot` (absolute). */
  readonly projectRoot: string;
  /** `BlendConfig.include` — validated glob patterns (RD-16 R29). */
  readonly include: string[];
  /** `BlendConfig.exclude` — validated glob patterns. */
  readonly exclude: string[];
}

/**
 * Create a disk-backed {@link CompilerHost} (R12).
 *
 * @param options Config-derived project root and include/exclude patterns.
 * @returns A {@link CompilerHost} that discovers and reads `.blend` files under
 *   `projectRoot`.
 */
export function createDiskCompilerHost(options: DiskHostOptions): CompilerHost {
  const { projectRoot, include, exclude } = options;
  // Containment boundary (RD-13 R37): a result is in scope iff its resolved path
  // sits strictly under `projectRoot` (prefix check on the `sep`-terminated root).
  const rootPrefix = resolve(projectRoot) + sep;

  return {
    listSourceFiles(): string[] {
      // Tier-2 expansion: `include` globs minus `exclude` (via `ignore`),
      // resolved against `projectRoot`, returned absolute (R47). The current
      // tinyglobby@^0.2 signature is `globSync(patterns, options)`; the
      // single-object `{ patterns, … }` overload is deprecated (PF-006).
      const matches = globSync(include, {
        ignore: exclude,
        cwd: projectRoot,
        absolute: true,
      });

      // Root-scope filter: drop any result outside `projectRoot` (a `../`-escaping
      // pattern was config-valid, but the *result* is out of scope — R47/R37), then
      // sort lexicographically (feeds R21's `outName` derivation).
      return matches
        .map((p) => resolve(p))
        .filter((p) => p.startsWith(rootPrefix))
        .sort();
    },

    readFile(path: string): string | undefined {
      // R14 contract: never throws — any fs error (missing, unreadable, TOCTOU)
      // becomes `undefined`.
      try {
        return readFileSync(path, "utf8");
      } catch {
        return undefined;
      }
    },

    resolvePath(path: string): string {
      return resolve(projectRoot, path);
    },
  };
}
