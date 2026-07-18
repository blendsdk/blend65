/**
 * Shared test support for the Slice 5b fixture — the module-system program:
 * one module spanning TWO files (both declare `module Math`), an import-less
 * qualified call and qualified word read/write from Main, a module-variable
 * initializer chain that crosses modules (Main's `combo` reads Math's
 * `scaled`, which folds a const), and the generated init routine running
 * before `main`. Builds `examples/slice5b/{main,math,math2}.blend` (inlined
 * verbatim, mirroring `testing/slice5a.ts`) to a real c64 `.prg` via the
 * compiler's `build()` facade + real ACME, and emits its ACME source via
 * `emitAsm` for the golden tier. Test-only: NOT re-exported from the package
 * barrel.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, emitAsm, type BuildResult, type EmitResult } from "@blend65/compiler";
import type { ProgramObservables } from "./observables.js";

/** The Slice 5b Main module — verbatim `examples/slice5b/main.blend`. */
export const SLICE5B_MAIN_SRC = `module Main;

import { add } from Math;

let combo: byte = Math.scaled + 1;

function main(): void {
  poke($C000, add(2, 3));
  poke($C001, Math.twice(4));
  poke($C002, combo);
  pokew($C003, Math.base);
  Math.base = Math.base + 1;
  pokew($C005, Math.base);
}
`;

/** The Slice 5b Math module, file 1 — verbatim `examples/slice5b/math.blend`. */
export const SLICE5B_MATH_SRC = `module Math;

export const SCALE: byte = 3;
export let base: word = $0102;

export function add(a: byte, b: byte): byte {
  return a + b;
}
`;

/** The Slice 5b Math module, file 2 — verbatim `examples/slice5b/math2.blend`. */
export const SLICE5B_MATH2_SRC = `module Math;

export let scaled: byte = SCALE * 2;

export function twice(v: byte): byte {
  return add(v, v);
}
`;

/** A built Slice 5b program plus a cleanup for its temp directory. */
export interface BuiltSlice5b {
  result: BuildResult;
  cleanup: () => void;
}

/** Writes the three fixture files into `cwd`. */
function writeFixture(cwd: string): void {
  writeFileSync(join(cwd, "main.blend"), SLICE5B_MAIN_SRC, "utf8");
  writeFileSync(join(cwd, "math.blend"), SLICE5B_MATH_SRC, "utf8");
  writeFileSync(join(cwd, "math2.blend"), SLICE5B_MATH2_SRC, "utf8");
}

/**
 * Build the Slice 5b program to a real c64 `.prg` (absolute outDir so ACME's
 * cwd resolves consistently). Requires real ACME.
 *
 * @returns The {@link BuildResult} and a `cleanup()` that removes the temp dir.
 */
export async function buildSlice5b(): Promise<BuiltSlice5b> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-harness-slice5b-"));
  writeFixture(cwd);
  const result = await build({
    platform: "c64",
    cwd,
    sourceFiles: ["main.blend", "math.blend", "math2.blend"],
    outDir: join(cwd, "out"),
  });
  return { result, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

/**
 * Emit the Slice 5b ACME source via `emitAsm` (the partial pipeline that stops
 * before the assembler — no ACME, no emulator, CI-runnable). Writes the fixture
 * to a scratch dir that is removed before returning.
 *
 * @returns The {@link EmitResult} (its `text` is the ACME source).
 */
export function emitAsmSlice5b(): EmitResult {
  const cwd = mkdtempSync(join(tmpdir(), "b65-golden-slice5b-"));
  writeFixture(cwd);
  try {
    return emitAsm({
      platform: "c64",
      cwd,
      sourceFiles: ["main.blend", "math.blend", "math2.blend"],
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

/**
 * The Slice 5b program's shared observable set: the module-system results —
 * add(2,3)=5, Math.twice(4)=8, combo=7 (initialized from Math.scaled+1
 * BEFORE main), Math.base=$0102 then base+1=$0103 little-endian.
 */
export const SLICE5B_OBSERVABLES: ProgramObservables = {
  landmarks: [{ kind: "memory", address: 0xc005, value: 0x03 }],
  checks: [
    { address: 0xc000, value: 0x05, note: "add(2, 3) = 5" },
    { address: 0xc001, value: 0x08, note: "Math.twice(4) = add(4, 4) = 8" },
    { address: 0xc002, value: 0x07, note: "combo = Math.scaled + 1 = 7 (init order)" },
    { address: 0xc003, value: 0x02, note: "Math.base = $0102 — lo byte" },
    { address: 0xc004, value: 0x01, note: "Math.base hi byte" },
    { address: 0xc005, value: 0x03, note: "Math.base + 1 = $0103 — lo byte" },
    { address: 0xc006, value: 0x01, note: "Math.base + 1 hi byte" },
  ],
};
