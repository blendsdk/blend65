/**
 * Shared test support for the boing-ball demo — the committed
 * `examples/boing-ball/` program: four unexpanded multicolour sprites in a 2x2
 * block, animated by swapping pointers between four consecutive 64-byte blocks
 * rather than by touching pixels, bouncing on 9-bit X.
 *
 * Outside the parity corpus today, as its own source header states. That is
 * not permanent — it is the closest thing in the repo to real game code and is
 * the next candidate for a hand-written twin — but until then what it owes is
 * a build.
 *
 * Its single source of truth is the committed example directory — the files
 * are copied into a fresh temp dir and built through the real `build()` facade
 * plus real ACME. Generated output is never committed.
 * Test-only: NOT re-exported from the package barrel.
 */

import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, type BuildResult } from "@blend65/compiler";

/** The committed boing-ball example directory. */
const DEMO_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "examples",
  "boing-ball",
);

/** A built demo: the build result + scratch-dir cleanup. */
export interface BuiltBoingBall {
  readonly result: BuildResult;
  readonly cleanup: () => void;
}

/**
 * Builds the committed boing-ball example through the real `build()` pipeline
 * (ACME included), staging `main.blend` + the sprite asset into a fresh temp
 * dir so source-relative `embed()` resolution is exercised for real.
 *
 * @returns The build result and a cleanup for its scratch directory.
 */
export async function buildBoingBall(): Promise<BuiltBoingBall> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-boing-ball-"));
  copyFileSync(join(DEMO_DIR, "main.blend"), join(cwd, "main.blend"));
  copyFileSync(join(DEMO_DIR, "ball.bin"), join(cwd, "ball.bin"));
  const result = await build({
    platform: "c64",
    cwd,
    sourceFiles: ["main.blend"],
    outDir: join(cwd, "out"),
  });
  return { result, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}
