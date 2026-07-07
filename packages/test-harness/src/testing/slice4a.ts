/**
 * Shared test support for the Slice 4a fixture (conditionals + loops + the
 * multi-block CFG codegen keystone). Builds `examples/slice4a/main.blend` (inlined
 * verbatim, mirroring `testing/slice3b.ts`) to a real c64 `.prg` via the
 * compiler's `build()` facade + real ACME, and emits its ACME source via
 * `emitAsm` for the golden tier. Test-only: NOT re-exported from the package
 * barrel.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, emitAsm, type BuildResult, type EmitResult } from "@blend65/compiler";

/** The Slice 4a source — verbatim `examples/slice4a/main.blend`. */
export const SLICE4A_SRC = `module Main;

let result: byte;               // module scalar → __var_Main_result

function main(): void {
    let sum: byte = 0;

    // for-loop (to, Pattern A) with an inner if + break + continue
    for (let i: byte = 1 to 10) {
        if (i == 7) {
            break;              // stop before adding 7,8,9,10
        }
        if (i == 3) {
            continue;           // skip adding 3
        }
        sum = sum + i;          // adds 1,2,4,5,6 = 18
    }

    // while-loop
    let n: byte = 3;
    while (n > 0) {
        sum = sum + 1;          // adds 1 three times = +3
        n = n - 1;
    }

    result = sum;               // 18 + 3 = 21 = $15
    poke(0xC000, result);       // observable: $C000 == $15

    // if/else (two-armed — proves both arms' codegen)
    if (result > 20) {
        poke(0xC001, 1);        // taken (21 > 20) → $C001 == $01
    } else {
        poke(0xC001, 2);        // not taken
    }
}
`;

/** A built Slice 4a program plus a cleanup for its temp directory. */
export interface BuiltSlice4a {
  result: BuildResult;
  cleanup: () => void;
}

/**
 * Build the Slice 4a program to a real c64 `.prg` (absolute outDir so ACME's cwd
 * resolves consistently). Requires real ACME.
 *
 * @returns The {@link BuildResult} and a `cleanup()` that removes the temp dir.
 */
export async function buildSlice4a(): Promise<BuiltSlice4a> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-harness-slice4a-"));
  writeFileSync(join(cwd, "main.blend"), SLICE4A_SRC, "utf8");
  const result = await build({
    platform: "c64",
    cwd,
    sourceFiles: ["main.blend"],
    outDir: join(cwd, "out"),
  });
  return { result, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

/**
 * Emit the Slice 4a ACME source via `emitAsm` (the partial pipeline that stops
 * before the assembler — no ACME, no emulator, CI-runnable). Writes the fixture to
 * a scratch dir that is removed before returning.
 *
 * @returns The {@link EmitResult} (its `text` is the ACME source).
 */
export function emitAsmSlice4a(): EmitResult {
  const cwd = mkdtempSync(join(tmpdir(), "b65-golden-slice4a-"));
  writeFileSync(join(cwd, "main.blend"), SLICE4A_SRC, "utf8");
  try {
    return emitAsm({ platform: "c64", cwd, sourceFiles: ["main.blend"] });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
