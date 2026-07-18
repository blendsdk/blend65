/**
 * Shared test support for the Slice 5a fixture — the first multi-function,
 * multi-module program: cross-module imported calls (byte and word
 * parameters/returns), a same-module call to a later-declared function, and
 * a two-level call chain, with results poked to observable RAM. Builds
 * `examples/slice5a/{main,math}.blend` (inlined verbatim, mirroring
 * `testing/slice4b.ts`) to a real c64 `.prg` via the compiler's `build()`
 * facade + real ACME, and emits its ACME source via `emitAsm` for the golden
 * tier. Test-only: NOT re-exported from the package barrel.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, emitAsm, type BuildResult, type EmitResult } from "@blend65/compiler";
import type { ProgramObservables } from "./observables.js";

/** The Slice 5a Math module — verbatim `examples/slice5a/math.blend`. */
export const SLICE5A_MATH_SRC = `module Math;

export function add(a: byte, b: byte): byte {
    return a + b;
}

export function triple(v: word): word {
    return v * 3;
}
`;

/** The Slice 5a Main module — verbatim `examples/slice5a/main.blend`. */
export const SLICE5A_MAIN_SRC = `module Main;

import { add, triple } from Math;

let r1: byte;
let r2: word;
let r3: byte;

function main(): void {
    let x: byte = 10;
    r1 = add(x, 7);
    poke(0xC000, r1);

    r2 = triple(300);
    pokew(0xC001, r2);

    r3 = combo(5);
    poke(0xC003, r3);
}

function combo(n: byte): byte {
    let t: byte = add(n, 3);
    return t + t;
}
`;

/** A built Slice 5a program plus a cleanup for its temp directory. */
export interface BuiltSlice5a {
  result: BuildResult;
  cleanup: () => void;
}

/** Writes both fixture files into `cwd`. */
function writeFixture(cwd: string): void {
  writeFileSync(join(cwd, "main.blend"), SLICE5A_MAIN_SRC, "utf8");
  writeFileSync(join(cwd, "math.blend"), SLICE5A_MATH_SRC, "utf8");
}

/**
 * Build the Slice 5a program to a real c64 `.prg` (absolute outDir so ACME's
 * cwd resolves consistently). Requires real ACME.
 *
 * @returns The {@link BuildResult} and a `cleanup()` that removes the temp dir.
 */
export async function buildSlice5a(): Promise<BuiltSlice5a> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-harness-slice5a-"));
  writeFixture(cwd);
  const result = await build({
    platform: "c64",
    cwd,
    sourceFiles: ["main.blend", "math.blend"],
    outDir: join(cwd, "out"),
  });
  return { result, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

/**
 * Emit the Slice 5a ACME source via `emitAsm` (the partial pipeline that stops
 * before the assembler — no ACME, no emulator, CI-runnable). Writes the fixture
 * to a scratch dir that is removed before returning.
 *
 * @returns The {@link EmitResult} (its `text` is the ACME source).
 */
export function emitAsmSlice5a(): EmitResult {
  const cwd = mkdtempSync(join(tmpdir(), "b65-golden-slice5a-"));
  writeFixture(cwd);
  try {
    return emitAsm({ platform: "c64", cwd, sourceFiles: ["main.blend", "math.blend"] });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

/**
 * The Slice 5a program's shared observable set: the three call results —
 * add(10,7)=17 at $C000, triple(300)=900=$0384 little-endian at $C001/$C002,
 * combo(5)=16 at $C003 (the last write, so it anchors the settle wait).
 */
export const SLICE5A_OBSERVABLES: ProgramObservables = {
  landmarks: [{ kind: "memory", address: 0xc003, value: 0x10 }],
  checks: [
    { address: 0xc000, value: 0x11, note: "add(10, 7) = 17" },
    { address: 0xc001, value: 0x84, note: "triple(300) = 900 = $0384 — lo byte" },
    { address: 0xc002, value: 0x03, note: "triple hi byte" },
    { address: 0xc003, value: 0x10, note: "combo(5): t = add(5,3) = 8; t + t = 16" },
  ],
};
