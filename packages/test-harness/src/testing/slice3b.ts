/**
 * Shared test support for the Slice 3b fixture (module + local scalars,
 * same-type byte/word arithmetic, `poke`/`pokew` to plain RAM). Builds
 * `examples/slice3b/main.blend` (inlined verbatim, mirroring `testing/slice3a.ts`)
 * to a real c64 `.prg` via the compiler's `build()` facade + real ACME, and
 * emits its ACME source via `emitAsm` for the golden tier. Test-only: NOT
 * re-exported from the package barrel.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, emitAsm, type BuildResult, type EmitResult } from "@blend65/compiler";
import type { ProgramObservables } from "./observables.js";

/** The Slice 3b source — verbatim `examples/slice3b/main.blend`. */
export const SLICE3B_SRC = `module Main;

let accB: byte;              // module-level scalar (no init — spec VAR-2, AR-2) → __var_Main_accB
let accW: word;              // module-level scalar → __var_Main_accW

function main(): void {
    let a: byte = 5;
    let b: byte = 3;
    let c: byte = 2;
    accB = a * b + c;        // byte: (5*3)+2 = 17 = $11  (a*b via __rt_mul8)
    poke(0xC000, accB);      // observable: $C000 == $11

    let x: word = 300;       // word literal (>255 → i16u, the width fix)
    let y: word = 2;
    accW = x * y;            // word: 300*2 = 600 = $0258  (via __rt_mul16)
    pokew(0xC001, accW);     // observable: $C001 == $58, $C002 == $02  (little-endian)
}
`;

/** A built Slice 3b program plus a cleanup for its temp directory. */
export interface BuiltSlice3b {
  result: BuildResult;
  cleanup: () => void;
}

/**
 * Build the Slice 3b program to a real c64 `.prg` (absolute outDir so ACME's cwd
 * resolves consistently). Requires real ACME.
 *
 * @returns The {@link BuildResult} and a `cleanup()` that removes the temp dir.
 */
export async function buildSlice3b(): Promise<BuiltSlice3b> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-harness-slice3b-"));
  writeFileSync(join(cwd, "main.blend"), SLICE3B_SRC, "utf8");
  const result = await build({
    platform: "c64",
    cwd,
    sourceFiles: ["main.blend"],
    outDir: join(cwd, "out"),
  });
  return { result, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

/**
 * Emit the Slice 3b ACME source via `emitAsm` (the partial pipeline that stops
 * before the assembler — no ACME, no emulator, CI-runnable). Writes the fixture to
 * a scratch dir that is removed before returning.
 *
 * @returns The {@link EmitResult} (its `text` is the ACME source).
 */
export function emitAsmSlice3b(): EmitResult {
  const cwd = mkdtempSync(join(tmpdir(), "b65-golden-slice3b-"));
  writeFileSync(join(cwd, "main.blend"), SLICE3B_SRC, "utf8");
  try {
    return emitAsm({ platform: "c64", cwd, sourceFiles: ["main.blend"] });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

/**
 * The Slice 3b program's shared observable set: the computed byte and word
 * results settle into plain RAM — accB = (5*3)+2 = 17 at $C000, and
 * accW = 300*2 = 600 = $0258 little-endian at $C001/$C002.
 */
export const SLICE3B_OBSERVABLES: ProgramObservables = {
  landmarks: [{ kind: "memory", address: 0xc000, value: 0x11 }],
  checks: [
    { address: 0xc000, value: 0x11, note: "accB = (5*3)+2 = 17" },
    { address: 0xc001, value: 0x58, note: "accW = 600 = $0258 — lo byte" },
    { address: 0xc002, value: 0x02, note: "accW hi byte" },
  ],
};
