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

/** The Slice 3b source — verbatim `examples/slice3b/main.blend`. */
export const SLICE3B_SRC = `module Main;

let accB: byte;
let accW: word;

function main(): void {
    let a: byte = 5;
    let b: byte = 3;
    let c: byte = 2;
    accB = a * b + c;
    poke(0xC000, accB);

    let x: word = 300;
    let y: word = 2;
    accW = x * y;
    pokew(0xC001, accW);
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
