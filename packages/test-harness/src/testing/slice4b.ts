/**
 * Shared test support for the Slice 4b fixture (the `switch` sub-machine — a
 * `brcond` compare-chain over the Slice 4a multi-block CFG keystone, with a
 * multi-value case, an explicit `fallthrough`, an auto-break case, and a
 * `default`). Builds `examples/slice4b/main.blend` (inlined verbatim, mirroring
 * `testing/slice4a.ts`) to a real c64 `.prg` via the compiler's `build()`
 * facade + real ACME, and emits its ACME source via `emitAsm` for the golden
 * tier. Test-only: NOT re-exported from the package barrel.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, emitAsm, type BuildResult, type EmitResult } from "@blend65/compiler";

/** The Slice 4b source — verbatim `examples/slice4b/main.blend`. */
export const SLICE4B_SRC = `module Main;

let out1: byte;                 // module scalar → __var_Main_out1
let out2: byte;                 // module scalar → __var_Main_out2

function main(): void {
    let sel: byte = 2;
    let acc: byte = 0;

    // Switch A — multi-value case + explicit fallthrough + auto-break + default.
    switch (sel) {
        case 1:
            acc = 10;           // not matched
        case 2, 3:              // multi-value: sel == 2 matches this shared body
            acc = 20;
            fallthrough;        // falls into the case-4 body (skips the case-4 test)
        case 4:
            acc = acc + 5;      // reached via fallthrough → 20 + 5 = 25
        default:
            acc = acc + 1;      // NOT executed (case 4 auto-breaks to the join)
    }
    out1 = acc;                 // 25 = $19
    poke(0xC000, out1);         // observable: $C000 == $19

    // Switch B — the default path (no case matches).
    let sel2: byte = 9;
    switch (sel2) {
        case 1:
            acc = 100;          // not matched
        default:
            acc = 7;            // sel2 matches no case → default
    }
    out2 = acc;                 // 7 = $07
    poke(0xC001, out2);         // observable: $C001 == $07
}
`;

/** A built Slice 4b program plus a cleanup for its temp directory. */
export interface BuiltSlice4b {
  result: BuildResult;
  cleanup: () => void;
}

/**
 * Build the Slice 4b program to a real c64 `.prg` (absolute outDir so ACME's cwd
 * resolves consistently). Requires real ACME.
 *
 * @returns The {@link BuildResult} and a `cleanup()` that removes the temp dir.
 */
export async function buildSlice4b(): Promise<BuiltSlice4b> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-harness-slice4b-"));
  writeFileSync(join(cwd, "main.blend"), SLICE4B_SRC, "utf8");
  const result = await build({
    platform: "c64",
    cwd,
    sourceFiles: ["main.blend"],
    outDir: join(cwd, "out"),
  });
  return { result, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

/**
 * Emit the Slice 4b ACME source via `emitAsm` (the partial pipeline that stops
 * before the assembler — no ACME, no emulator, CI-runnable). Writes the fixture to
 * a scratch dir that is removed before returning.
 *
 * @returns The {@link EmitResult} (its `text` is the ACME source).
 */
export function emitAsmSlice4b(): EmitResult {
  const cwd = mkdtempSync(join(tmpdir(), "b65-golden-slice4b-"));
  writeFileSync(join(cwd, "main.blend"), SLICE4B_SRC, "utf8");
  try {
    return emitAsm({ platform: "c64", cwd, sourceFiles: ["main.blend"] });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
