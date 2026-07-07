/**
 * No-print enforcement witness (root `test/` tier).
 *
 * The compile-path packages (core/frontend/codegen/platforms/config/compiler)
 * MUST NOT print — they return structured diagnostics; only `@blend65/cli`
 * prints. This static scan is the second witness alongside the authoritative
 * ESLint `no-console` / `no-restricted-properties` gate (`eslint.config.mjs`),
 * mirroring the frontend/backend boundary test in `test/boundary.spec.test.ts`.
 * Test + test-support files are excluded (they legitimately spy on the process
 * streams).
 *
 * This witness is expected to pass immediately — it guards an already-clean
 * codebase, exactly like the boundary test.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Repo root — this file lives in `<root>/test/`. */
const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The compile-path packages that must never print. */
const COMPILE_PATH_PACKAGES = ["core", "frontend", "codegen", "platforms", "config", "compiler"];

/** Banned patterns: any `console.` call and any `process.stdout`/`stderr` reference. */
const BANNED = [/\bconsole\s*\./, /\bprocess\s*\.\s*stdout\b/, /\bprocess\s*\.\s*stderr\b/];

/** Whether a file is test or test-support code (excluded from the scan). */
function isExcluded(path: string): boolean {
  return (
    path.endsWith(".test.ts") ||
    path.endsWith("test-fixtures.ts") ||
    path.includes(`${"/"}testing${"/"}`) ||
    path.includes(`${"/"}test-fixtures${"/"}`)
  );
}

/** Collect production `.ts` source files under a package's `src/`. */
function productionSources(pkg: string): string[] {
  const srcDir = join(ROOT, "packages", pkg, "src");
  const entries = readdirSync(srcDir, { recursive: true, encoding: "utf8" });
  return entries
    .map((rel) => join(srcDir, rel))
    .filter((p) => p.endsWith(".ts") && !isExcluded(p));
}

describe("Specification: AC-18 no-print enforcement (ST-39)", () => {
  it("compile-path production sources contain no console/process.stdout/stderr use (ST-39)", () => {
    const offenders: string[] = [];
    for (const pkg of COMPILE_PATH_PACKAGES) {
      for (const file of productionSources(pkg)) {
        const text = readFileSync(file, "utf8");
        if (BANNED.some((pattern) => pattern.test(text))) {
          offenders.push(file.slice(ROOT.length));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
