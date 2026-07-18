/**
 * Shared test support for the Slice 7b fixture — the pointer-surface
 * program: a two-file module pair where `Game` exports two structs, an
 * unsized const table (its size inferred from the element list), a by-ref
 * mutator, a const-unsized-param sum, and a pass-through relay; `Main`
 * drives the by-ref mutation through the relay chain, the const table sum,
 * a tier-2 array written and read at a RUNTIME word index (the pointer
 * formation path) alongside a const-indexed access (the fold-to-absolute
 * coexistence proof), and a whole-struct copy through two by-ref params.
 * Builds `examples/slice7b/{game,main}.blend` (inlined verbatim, mirroring
 * `testing/slice7.ts`) to a real c64 `.prg` via the compiler's `build()`
 * facade + real ACME, and emits its ACME source via `emitAsm` for the golden
 * tier. Test-only: NOT re-exported from the package barrel.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, emitAsm, type BuildResult, type EmitResult } from "@blend65/compiler";
import type { ProgramObservables } from "./observables.js";

/** The Slice 7b Game module — verbatim `examples/slice7b/game.blend`. */
export const SLICE7B_GAME_SRC = `module Game;

export struct Point { x: byte; y: byte; }
export struct Enemy { pos: Point; hp: byte; }

export const TABLE: byte[] = [3, 5, 7];

// By-ref mutation: the caller's struct really changes.
export function resetEnemy(e: Enemy): void {
  e.hp = 0;
  e.pos.y = 42;
}

// Const + unsized: read-only sum with an explicit length.
export function sum(data: const byte[], len: byte): byte {
  let total: byte = 0;
  let i: byte = 0;
  while (i < len) {
    total += data[i];
    i += 1;
  }
  return total;
}

// Pass-through chain: forwards its by-ref param whole (no pair of its own).
export function relay(e: Enemy): void {
  resetEnemy(e);
}
`;

/** The Slice 7b Main module — verbatim `examples/slice7b/main.blend`. */
export const SLICE7B_MAIN_SRC = `module Main;
import { Enemy, Point, TABLE, resetEnemy, sum, relay } from Game;

let boss: Enemy;
let big: byte[300];
let a: Point;
let b: Point;

function copyPoint(dst: Point, src: const Point): void {
  dst = src;
}

function main(): void {
  boss.hp = 99;
  relay(boss);
  poke($C000, boss.hp);
  poke($C001, boss.pos.y);

  poke($C002, sum(TABLE, length(TABLE)));

  big[4] = 17;
  let idx: word = 260;
  big[idx] = 29;
  poke($C003, big[idx]);
  poke($C004, big[4]);

  a.x = 11; a.y = 22;
  copyPoint(b, a);
  a.x = 99;
  poke($C005, b.x);
  poke($C006, b.y);
}
`;

/** A built Slice 7b program plus a cleanup for its temp directory. */
export interface BuiltSlice7b {
  result: BuildResult;
  cleanup: () => void;
}

/** Writes both fixture files into `cwd`. */
function writeFixture(cwd: string): void {
  writeFileSync(join(cwd, "game.blend"), SLICE7B_GAME_SRC, "utf8");
  writeFileSync(join(cwd, "main.blend"), SLICE7B_MAIN_SRC, "utf8");
}

/**
 * Build the Slice 7b program to a real c64 `.prg` (absolute outDir so ACME's
 * cwd resolves consistently). Requires real ACME.
 *
 * @returns The {@link BuildResult} and a `cleanup()` that removes the temp dir.
 */
export async function buildSlice7b(): Promise<BuiltSlice7b> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-harness-slice7b-"));
  writeFixture(cwd);
  const result = await build({
    platform: "c64",
    cwd,
    sourceFiles: ["main.blend", "game.blend"],
    outDir: join(cwd, "out"),
  });
  return { result, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

/**
 * Emit the Slice 7b ACME source via `emitAsm` (the partial pipeline that
 * stops before the assembler — no ACME, no emulator, CI-runnable). Writes the
 * fixture to a scratch dir that is removed before returning.
 *
 * @returns The {@link EmitResult} (its `text` is the ACME source).
 */
export function emitAsmSlice7b(): EmitResult {
  const cwd = mkdtempSync(join(tmpdir(), "b65-golden-slice7b-"));
  writeFixture(cwd);
  try {
    return emitAsm({
      platform: "c64",
      cwd,
      sourceFiles: ["main.blend", "game.blend"],
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

/**
 * The Slice 7b program's shared observable set: every pointer-surface
 * result, including the tier-2 runtime word index at 260 and the low-range
 * integrity proof it must not alias.
 */
export const SLICE7B_OBSERVABLES: ProgramObservables = {
  landmarks: [{ kind: "memory", address: 0xc006, value: 0x16 }],
  checks: [
    { address: 0xc000, value: 0x00, note: "boss.hp after relay → resetEnemy" },
    { address: 0xc001, value: 0x2a, note: "boss.pos.y = 42 through the pair" },
    { address: 0xc002, value: 0x0f, note: "sum(TABLE, length(TABLE)) = 3+5+7" },
    { address: 0xc003, value: 0x1d, note: "big[260] via the runtime word index" },
    { address: 0xc004, value: 0x11, note: "big[4] via the const index — not aliased by 260" },
    { address: 0xc005, value: 0x0b, note: "b.x after copyPoint(b, a); a.x = 99 → still 11" },
    { address: 0xc006, value: 0x16, note: "b.y" },
  ],
};
