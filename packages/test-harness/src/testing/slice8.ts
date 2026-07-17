/**
 * Shared test support for the Slice 8 fixture — the hardware-surface
 * program: a raw-vector raster-interrupt demo. `main` masks the CIA-1
 * interrupt sources, flushes any latched request, installs the generated
 * IRQ and NMI handlers at the hardware vectors with `&`, banks the KERNAL
 * out so the vector fetch reads RAM, arms the VIC raster interrupt, and
 * spins forever (the non-terminating shim). Each raster interrupt
 * acknowledges the VIC and — until the zeropage counter saturates at 100 —
 * bumps the border color and the counter through an interrupt-only helper;
 * the mainline loop mirrors the zeropage counter into a RAM variable. The
 * saturating counter makes every observable settle deterministically: the
 * counter and its mirror stick at 100, and the border ends at
 * (boot + 100) mod 16.
 *
 * Builds `examples/slice8/main.blend` (inlined verbatim) to a real c64
 * `.prg` via the compiler's `build()` facade + real ACME, and emits its ACME
 * source via `emitAsm` for the golden tier. Test-only: NOT re-exported from
 * the package barrel.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, emitAsm, type BuildResult, type EmitResult } from "@blend65/compiler";

/** The Slice 8 Main module — verbatim `examples/slice8/main.blend`. */
export const SLICE8_MAIN_SRC = `module Main;

zeropage {
  frameCount: byte = 0;
}

let mirror: byte = 0;

interrupt function onIRQ() {
  poke($D019, $FF);
  bump();
}

interrupt function onNMI() { }

function bump(): void {
  if (frameCount < 100) {
    poke($D020, peek($D020) + 1);
    frameCount = frameCount + 1;
  }
}

function main(): void {
  asm_sei();
  poke($DC0D, $7F);
  mirror = peek($DC0D);
  pokew($FFFE, &onIRQ);
  pokew($FFFA, &onNMI);
  poke($01, $35);
  poke($D012, 100);
  poke($D011, peek($D011) & $7F);
  poke($D01A, $01);
  poke($D019, $FF);
  asm_cli();
  while (true) {
    mirror = frameCount;
  }
}
`;

/** A built Slice 8 fixture: the build result + scratch-dir cleanup. */
export interface BuiltSlice8 {
  readonly result: BuildResult;
  readonly cleanup: () => void;
}

/**
 * Builds the fixture through the real `build()` pipeline (ACME included).
 * The outDir is absolute so the assembler's working directory resolves
 * consistently regardless of the test runner's own cwd.
 */
export async function buildSlice8(): Promise<BuiltSlice8> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-slice8-"));
  writeFileSync(join(cwd, "main.blend"), SLICE8_MAIN_SRC, "utf8");
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
export function emitAsmSlice8(): EmitResult {
  const cwd = mkdtempSync(join(tmpdir(), "b65-slice8-asm-"));
  writeFileSync(join(cwd, "main.blend"), SLICE8_MAIN_SRC, "utf8");
  try {
    return emitAsm({ platform: "c64", cwd, sourceFiles: ["main.blend"] });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
