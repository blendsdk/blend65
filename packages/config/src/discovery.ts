/**
 * Config-file discovery: the upward walk for `blend65.json`.
 *
 * Pure and hermetically testable: the filesystem probe is an injected
 * predicate, so unit tests never touch the real filesystem and integration
 * callers pass `existsSync`.
 */

import { dirname, join } from "node:path";

/** The config file name fixed at the project root. */
export const CONFIG_FILE_NAME = "blend65.json";

/**
 * Walks from `startDir` toward the filesystem root, returning the first
 * `<dir>/blend65.json` for which `fileExists` returns true (the nearest
 * file wins). The root directory itself is checked too; returns `null` when
 * no directory on the walk has a config file.
 *
 * @param startDir Directory to start from (typically the resolved cwd).
 * @param fileExists Probe for a candidate path (injected).
 * @returns The winning candidate path, or `null` on a discovery miss.
 */
export function findConfigUpwards(
  startDir: string,
  fileExists: (path: string) => boolean,
): string | null {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, CONFIG_FILE_NAME);
    if (fileExists(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return null; // reached the filesystem root — walk exhausted
    }
    dir = parent;
  }
}
