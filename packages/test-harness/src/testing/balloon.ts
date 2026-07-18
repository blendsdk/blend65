/**
 * Shared test support for the balloon demo — the committed
 * `examples/balloon/` program: a hires sprite staged to block 13, then a
 * frame-locked movement loop (poll `$D012` for line 251, update position,
 * bounce at the borders). Its hand-written twin lives beside it as
 * `balloon.asm`.
 *
 * Unlike the slice fixtures (whose sources are inlined as documentation),
 * the balloon's single source of truth is the committed example directory —
 * the files are copied into a fresh temp dir and built through the real
 * `build()` facade + real ACME. Generated output is never committed.
 * Test-only: NOT re-exported from the package barrel.
 */

import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, type BuildResult } from "@blend65/compiler";
import type { ProgramObservables } from "./observables.js";

/** The committed balloon example directory. */
const BALLOON_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "examples",
  "balloon",
);

/** A built balloon: the build result + scratch-dir cleanup. */
export interface BuiltBalloon {
  readonly result: BuildResult;
  readonly cleanup: () => void;
}

/**
 * Builds the committed balloon example through the real `build()` pipeline
 * (ACME included), staging `main.blend` + the sprite asset into a fresh
 * temp dir so source-relative `embed()` resolution is exercised for real.
 */
export async function buildBalloon(): Promise<BuiltBalloon> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-balloon-"));
  copyFileSync(join(BALLOON_DIR, "main.blend"), join(cwd, "main.blend"));
  copyFileSync(join(BALLOON_DIR, "balloon.bin"), join(cwd, "balloon.bin"));
  const result = await build({
    platform: "c64",
    cwd,
    sourceFiles: ["main.blend"],
    outDir: join(cwd, "out"),
  });
  return {
    result,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

/**
 * The balloon program's shared observable set: stopped at the 2nd arrival
 * of the frame-loop head, exactly one movement update has run under the
 * source's ±2-step / `>=`-`<=` bounce semantics. Everything here is
 * source-mandated sprite state — position, pointer, enable, colour, size
 * flags, and the staged sprite block compared against the committed asset.
 */
export const BALLOON_OBSERVABLES: ProgramObservables = {
  landmarks: [{ kind: "loopHead", arrivals: 2 }],
  checks: [
    { address: 0xd000, value: 174, note: "sprite 0 x: 172 + one +2 step" },
    { address: 0xd010, value: 0, note: "x MSB clear (174 < 256)" },
    { address: 0xd001, value: 141, note: "sprite 0 y: 139 + one +2 step" },
    { address: 0x07f8, value: 13, note: "sprite pointer: block 13 = $0340" },
    { address: 0xd015, value: 1, note: "sprite 0 enabled" },
    { address: 0xd027, value: 0xf1, note: "sprite 0 colour 1 — readback $F1" },
    { address: 0xd017, value: 0, note: "no y-expand" },
    { address: 0xd01c, value: 0, note: "hires — no multicolour" },
    { address: 0xd01d, value: 0, note: "no x-expand" },
    { address: 0x0340, bytesFile: "examples/balloon/balloon.bin", note: "staged sprite image" },
  ],
};
