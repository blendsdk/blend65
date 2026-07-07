/**
 * Shared test support for the MVP gate program. Builds
 * `examples/gate/main.blend` (inlined verbatim) to a real c64 `.prg` via the
 * compiler's `build()` facade + real ACME, for the Local-tier integration
 * suites (strategies, fixture, gate). Test-only: NOT re-exported from the
 * package barrel.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, type BuildResult } from "@blend65/compiler";

/** The MVP gate source — verbatim `examples/gate/main.blend`. */
export const GATE_SRC = `module Main;

function main(): void {
    poke(0xD020, 5);   // VIC-II border color; literal lives in the example, not core (P3)
}
`;

/** A built gate program plus a cleanup for its temp directory. */
export interface BuiltGate {
  result: BuildResult;
  cleanup: () => void;
}

/**
 * Build the gate program to a real c64 `.prg` (absolute outDir so ACME's cwd
 * resolves consistently). Requires real ACME.
 *
 * @returns The {@link BuildResult} and a `cleanup()` that removes the temp dir.
 */
export async function buildGate(): Promise<BuiltGate> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-harness-gate-"));
  writeFileSync(join(cwd, "main.blend"), GATE_SRC, "utf8");
  const result = await build({
    platform: "c64",
    cwd,
    sourceFiles: ["main.blend"],
    outDir: join(cwd, "out"),
  });
  return { result, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}
