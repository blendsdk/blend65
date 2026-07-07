/**
 * ACME executable discovery — `discoverAcme`.
 *
 * Resolves the path to the external ACME assembler using a fixed three-tier
 * strategy:
 *
 *   1. **Explicit** — a path from `--acme-path` / `blend65.json acmePath`. If set
 *      and executable, it wins; if set but not executable, that is a hard error
 *      (no silent fallback to PATH).
 *   2. **PATH probe** — search `PATH` for an `acme` executable.
 *   3. **Hard error** — neither resolves → emit `E10035` (`AcmeNotFound`) with an
 *      actionable message and return `null`.
 *
 * Filesystem and PATH access are injected through {@link AcmeProbes} so the logic
 * is pure and unit-testable without touching the real environment (no real ACME
 * binary is ever required). {@link defaultAcmeProbes} supplies the real
 * `node:fs` / `node:child_process`-free implementations for production use.
 *
 * Lives in `@blend65/compiler` — the integration layer that owns process/FS I/O,
 * keeping it out of `codegen`/`frontend`.
 */

import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";
import { DiagCode, type DiagnosticBag } from "@blend65/core";

/** The actionable message emitted when ACME cannot be located. */
export const ACME_NOT_FOUND_MESSAGE =
  "ACME assembler not found — install ACME and ensure it is on your PATH, " +
  "or set --acme-path / acmePath in blend65.json";

/** Configuration for {@link discoverAcme}: the explicit-path tier (tier 1). */
export interface AcmeDiscovery {
  /** Explicit path from `--acme-path` / `blend65.json acmePath` (highest priority). */
  readonly acmePath?: string;
}

/**
 * Injected environment probes — the seam that keeps {@link discoverAcme} pure and
 * testable. Production wiring uses {@link defaultAcmeProbes}.
 */
export interface AcmeProbes {
  /** Whether `path` exists and is executable. */
  readonly isExecutable: (path: string) => boolean;
  /** Resolve `name` against `PATH`, returning the absolute path or `null`. */
  readonly findOnPath: (name: string) => string | null;
}

/**
 * Resolve the ACME executable via the three-tier strategy.
 *
 * @param d The discovery configuration (explicit path tier).
 * @param bag Diagnostic sink — receives `AcmeNotFound` (E10035) on failure.
 * @param probes Injected FS/PATH probes (defaults to {@link defaultAcmeProbes}).
 * @returns The resolved ACME executable path, or `null` when unresolved (after a
 *   diagnostic has been added to `bag`).
 */
export function discoverAcme(
  d: AcmeDiscovery,
  bag: DiagnosticBag,
  probes: AcmeProbes = defaultAcmeProbes,
): string | null {
  // Tier 1: explicit path. If set, it is authoritative — a non-executable
  // explicit path is a hard error, never a silent fall-through to PATH.
  if (d.acmePath !== undefined) {
    if (probes.isExecutable(d.acmePath)) {
      return d.acmePath;
    }
    bag.addError(
      DiagCode.AcmeNotFound,
      null,
      `ACME path '${d.acmePath}' is not executable`,
    );
    return null;
  }

  // Tier 2: PATH probe for an `acme` executable.
  const onPath = probes.findOnPath("acme");
  if (onPath !== null) {
    return onPath;
  }

  // Tier 3: hard error — no silent fallback.
  bag.addError(DiagCode.AcmeNotFound, null, ACME_NOT_FOUND_MESSAGE);
  return null;
}

/**
 * Production {@link AcmeProbes}: real `node:fs`-backed executable check and a
 * cross-platform `PATH` scan (handles the Windows `acme.exe` variant). Pure
 * lookups — no spawning, no side effects beyond reading directory entries.
 */
export const defaultAcmeProbes: AcmeProbes = {
  isExecutable(path: string): boolean {
    try {
      accessSync(path, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  },
  findOnPath(name: string): string | null {
    const pathVar = process.env.PATH ?? "";
    // On Windows the executable is `acme.exe`; on POSIX it is bare `acme`.
    const candidates = process.platform === "win32" ? [`${name}.exe`, name] : [name];
    for (const dir of pathVar.split(delimiter)) {
      if (dir.length === 0) {
        continue;
      }
      for (const candidate of candidates) {
        const full = join(dir, candidate);
        try {
          accessSync(full, constants.X_OK);
          return full;
        } catch {
          // Not here — keep scanning.
        }
      }
    }
    return null;
  },
};
