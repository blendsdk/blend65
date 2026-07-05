/**
 * Shared test support for the RD-18 Slice 3a fixture (a `main` with one local
 * `byte` poked into the VIC-II border register). Builds `examples/slice3a/main.blend`
 * (inlined verbatim, mirroring `testing/gate.ts` / PF-007) to a real c64 `.prg` via
 * the RD-15 `build()` facade + real ACME, and emits its ACME source via `emitAsm`
 * for the golden tier. Test-only: NOT re-exported from the package barrel.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, emitAsm, type BuildResult, type EmitResult } from "@blend65/compiler";

/** The Slice 3a source — verbatim `examples/slice3a/main.blend` (AR-2/SR-1). */
export const SLICE3A_SRC = `module Main;

function main(): void {
    let x: byte = 5;
    poke(0xD020, x);   // read the local's frame slot into the VIC-II border register
}
`;

/** A built Slice 3a program plus a cleanup for its temp directory. */
export interface BuiltSlice3a {
  result: BuildResult;
  cleanup: () => void;
}

/**
 * Build the Slice 3a program to a real c64 `.prg` (absolute outDir so ACME's cwd
 * resolves consistently). Requires real ACME.
 *
 * @returns The {@link BuildResult} and a `cleanup()` that removes the temp dir.
 */
export async function buildSlice3a(): Promise<BuiltSlice3a> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-harness-slice3a-"));
  writeFileSync(join(cwd, "main.blend"), SLICE3A_SRC, "utf8");
  const result = await build({
    platform: "c64",
    cwd,
    sourceFiles: ["main.blend"],
    outDir: join(cwd, "out"),
  });
  return { result, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

/**
 * Emit the Slice 3a ACME source via `emitAsm` (the partial pipeline that stops
 * before the assembler — no ACME, no emulator, CI-runnable). Writes the fixture to
 * a scratch dir that is removed before returning.
 *
 * @returns The {@link EmitResult} (its `text` is the ACME source).
 */
export function emitAsmSlice3a(): EmitResult {
  const cwd = mkdtempSync(join(tmpdir(), "b65-golden-slice3a-"));
  writeFileSync(join(cwd, "main.blend"), SLICE3A_SRC, "utf8");
  try {
    return emitAsm({ platform: "c64", cwd, sourceFiles: ["main.blend"] });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
