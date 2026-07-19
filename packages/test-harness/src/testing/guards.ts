/**
 * Shared test support for the guards fixture — a frame-locked loop whose
 * update body is nothing but branch hazards: a compound unsigned window
 * check, a negated boolean, a signed velocity compare, and a short-circuit
 * whose right clause reads a hardware port. Each one settles into its own
 * screen-RAM cell, so the emulator tiers judge behavior rather than code
 * shape.
 *
 * Builds `examples/guards/main.blend` (inlined verbatim) to a real c64
 * `.prg` via the compiler's `build()` facade + real ACME, and emits the ACME
 * source via `emitAsm` for the golden tier. Test-only: NOT re-exported from
 * the package barrel.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, emitAsm, type BuildResult, type EmitResult } from "@blend65/compiler";
import type { ProgramObservables } from "./observables.js";

/** The guards Main module — verbatim `examples/guards/main.blend`. */
export const GUARDS_MAIN_SRC = `module Main;

function main(): void {
  // This loop owns the machine: silence CIA-1 so the KERNAL's keyboard scan
  // stops rewriting port A, then drive the port and park it — column 7 down,
  // every other line released — so the input guard reads a known value.
  poke($DC0D, $7F);
  poke($DC02, $FF);
  poke($DC00, $7F);

  let frame: byte = 0;
  let active: boolean = false;
  let armed: boolean = true;
  let dx: sbyte = -3;
  let dy: sbyte = 2;

  while (true) {
    // One update per PAL frame: hold until the raster reaches line 251, just
    // below the visible area. The update body takes longer than one raster
    // line, so this cannot double-fire within a frame.
    while (peek($D012) != 251) { }

    // Sprite window: walk the eight column probes and count the ones inside
    // the visible band. The upper bound is only asked about once the lower
    // bound holds — probe 0 never reaches it.
    let probe: byte = 0;
    let inBand: byte = 0;
    while (probe < 64) {
      if (probe >= 8 && probe < 40) { inBand = inBand + 1; }
      probe = probe + 8;
    }
    poke($0400, inBand);   // 4: probes 8, 16, 24, 32

    // Nothing to animate while the sprite is parked.
    if (!active) { poke($0401, 1); } else { poke($0401, 2); }

    // Signed velocity: is the drift steeper than the fall? Read as unsigned
    // bytes, -3 would be 253 and the answer would flip.
    if (dx < dy) { poke($0402, 3); } else { poke($0402, 4); }

    // The port is only read once the sprite is armed.
    if (armed && peek($DC00) == 127) { poke($0403, 5); } else { poke($0403, 6); }

    frame = frame + 1;
    poke($D020, frame);    // border: the frame heartbeat
  }
}
`;

/** A built guards fixture: the build result + scratch-dir cleanup. */
export interface BuiltGuards {
  readonly result: BuildResult;
  readonly cleanup: () => void;
}

/** Stages the fixture source into a fresh temp dir. */
function stageFixture(prefix: string): string {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  writeFileSync(join(cwd, "main.blend"), GUARDS_MAIN_SRC, "utf8");
  return cwd;
}

/**
 * Builds the fixture through the real `build()` pipeline (ACME included).
 * The outDir is absolute so the assembler's working directory resolves
 * consistently regardless of the test runner's own cwd.
 */
export async function buildGuards(): Promise<BuiltGuards> {
  const cwd = stageFixture("b65-guards-");
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
export function emitAsmGuards(): EmitResult {
  const cwd = stageFixture("b65-guards-asm-");
  try {
    return emitAsm({ platform: "c64", cwd, sourceFiles: ["main.blend"] });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

/**
 * The guards program's shared observable set: stopped at the 2nd arrival of
 * the frame-loop head, exactly one update body has run, so each guard has
 * decided exactly once and written its verdict.
 *
 * Every value below is fixed by the source alone, and each one flips if its
 * guard branches the wrong way — the signed compare is the sharpest: read as
 * unsigned bytes, `dx` (-3) would be 253 and `$0402` would read 4.
 */
export const GUARDS_OBSERVABLES: ProgramObservables = {
  landmarks: [{ kind: "loopHead", arrivals: 2 }],
  checks: [
    { address: 0x0400, value: 0x04, note: "window band: probes 8, 16, 24, 32 of 0..56" },
    { address: 0x0401, value: 0x01, note: "negated guard: the sprite is parked" },
    { address: 0x0402, value: 0x03, note: "signed compare: -3 < 2 (unsigned would read 4)" },
    { address: 0x0403, value: 0x05, note: "short circuit: armed, and the port reads $7F" },
    { address: 0xd020, value: 0xf1, note: "border poked to frame (1) — readback $F1" },
  ],
};
