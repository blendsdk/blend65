/**
 * Shared test support for the rasterpoll fixture — the minimal frame-locked
 * program: poll `$D012` until the raster reaches line 251 (just below the
 * visible area), run a small frame-update body (heartbeat counter to screen
 * RAM + border colour), loop forever. The emitted poll loop anchors the
 * per-iteration cycle budget window.
 *
 * Builds `examples/rasterpoll/main.blend` (inlined verbatim) to a real c64
 * `.prg` via the compiler's `build()` facade + real ACME, and emits the ACME
 * source via `emitAsm` for the golden tier. Test-only: NOT re-exported from
 * the package barrel.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, emitAsm, type BuildResult, type EmitResult } from "@blend65/compiler";
import type { ProgramObservables } from "./observables.js";

/** The rasterpoll Main module — verbatim `examples/rasterpoll/main.blend`. */
export const RASTERPOLL_MAIN_SRC = `module Main;

let frame: byte = 0;

function main(): void {
  while (true) {
    // One iteration per PAL frame: hold until the raster reaches line 251,
    // just below the visible area. The update body outlasts one raster
    // line, so it cannot double-fire within a frame.
    while (peek($D012) != 251) { }

    frame = frame + 1;
    poke($0400, frame);   // heartbeat in screen RAM
    poke($D020, frame);   // border colour: the classic raster-poll proof
  }
}
`;

/** A built rasterpoll fixture: the build result + scratch-dir cleanup. */
export interface BuiltRasterpoll {
  readonly result: BuildResult;
  readonly cleanup: () => void;
}

/** Stages the fixture source into a fresh temp dir. */
function stageFixture(prefix: string): string {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  writeFileSync(join(cwd, "main.blend"), RASTERPOLL_MAIN_SRC, "utf8");
  return cwd;
}

/**
 * Builds the fixture through the real `build()` pipeline (ACME included).
 * The outDir is absolute so the assembler's working directory resolves
 * consistently regardless of the test runner's own cwd.
 */
export async function buildRasterpoll(): Promise<BuiltRasterpoll> {
  const cwd = stageFixture("b65-rasterpoll-");
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

/** Emits the fixture's ACME source (no assembler run) for the golden tier. */
export function emitAsmRasterpoll(): EmitResult {
  const cwd = stageFixture("b65-rasterpoll-asm-");
  try {
    return emitAsm({ platform: "c64", cwd, sourceFiles: ["main.blend"] });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

/**
 * The rasterpoll program's shared observable set: stopped at the 2nd
 * arrival of the frame-loop head, exactly one frame body has run — the
 * heartbeat reads 1 and the border readback is $F1 (colour 1 in the low
 * nibble; the VIC-II unused upper nibble reads 1s). State mutates every
 * frame, so only a stopped machine yields deterministic checks — each
 * consumer supplies its own loop-head label.
 */
export const RASTERPOLL_OBSERVABLES: ProgramObservables = {
  landmarks: [{ kind: "loopHead", arrivals: 2 }],
  checks: [
    { address: 0x0400, value: 0x01, note: "heartbeat: frame counter after one body" },
    { address: 0xd020, value: 0xf1, note: "border poked to frame (1) — readback $F1" },
  ],
};
