/**
 * Shared test support for the balloon-colour demo — the committed
 * `examples/balloon-color/` program: the same bouncing hires balloon as its
 * neighbour, repainted from a palette on every bounce.
 *
 * Deliberately outside the parity corpus, as its own source header states: no
 * golden, no hand-written twin, no size budget. What it does owe is a build,
 * so a typo in the sprite-pointer arithmetic cannot ship unnoticed.
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

/** The committed balloon-colour example directory. */
const DEMO_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "examples",
  "balloon-color",
);

/** A built demo: the build result + scratch-dir cleanup. */
export interface BuiltBalloonColor {
  readonly result: BuildResult;
  readonly cleanup: () => void;
}

/**
 * Builds the committed balloon-colour example through the real `build()`
 * pipeline (ACME included), staging `main.blend` + the sprite asset into a
 * fresh temp dir so source-relative `embed()` resolution is exercised for real.
 *
 * @returns The build result and a cleanup for its scratch directory.
 */
export async function buildBalloonColor(): Promise<BuiltBalloonColor> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-balloon-color-"));
  copyFileSync(join(DEMO_DIR, "main.blend"), join(cwd, "main.blend"));
  copyFileSync(join(DEMO_DIR, "balloon.bin"), join(cwd, "balloon.bin"));
  const result = await build({
    platform: "c64",
    cwd,
    sourceFiles: ["main.blend"],
    outDir: join(cwd, "out"),
  });
  return { result, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}
