/**
 * Shared test support for the Slice 7 fixture — the aggregate-surface
 * program: a two-file module pair where `Gfx` exports a struct, an enum, and
 * a const table whose size is a constant expression (`DIM + sizeof(Point)`),
 * and `Main` drives indexed reads/writes, nested member access, a scaled
 * struct-array element access, an enum-dispatch switch, the three query
 * folds, a cross-module const-table read, whole-struct copy semantics, and a
 * single-step enum→word cast. Builds `examples/slice7/{gfx,main}.blend`
 * (inlined verbatim, mirroring `testing/slice6.ts`) to a real c64 `.prg` via
 * the compiler's `build()` facade + real ACME, and emits its ACME source via
 * `emitAsm` for the golden tier. Test-only: NOT re-exported from the package
 * barrel.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, emitAsm, type BuildResult, type EmitResult } from "@blend65/compiler";
import type { ProgramObservables } from "./observables.js";

/** The Slice 7 Gfx module — verbatim `examples/slice7/gfx.blend`. */
export const SLICE7_GFX_SRC = `module Gfx;

export struct Point { x: byte; y: byte; }

export enum Direction { UP, DOWN = 3, LEFT, RIGHT }

export const DIM: byte = 4;

export const TABLE: byte[DIM + sizeof(Point)] = [10, 20, 30; 5];
`;

/** The Slice 7 Main module — verbatim `examples/slice7/main.blend`. */
export const SLICE7_MAIN_SRC = `module Main;

import { Point, Direction, TABLE } from Gfx;

struct Player { pos: Point; hp: byte; }

function main(): void {
  // $C000 — indexed read/write loop sum over a list+fill array:
  // 1+2+3+4+4 = 14 = $0E
  let arr: byte[5] = [1, 2, 3; 4];
  let sum: byte = 0;
  for (let i: byte = 0 to 4) {
    sum = sum + arr[i];
  }
  poke($C000, sum);

  // $C001 — nested member write/read through a struct-in-struct: $2A
  let player: Player = Player { pos: Point { x: 7, y: 0 }, hp: 9 };
  player.pos.y = 42;
  poke($C001, player.pos.y);

  // $C002 — struct-in-array element via a runtime (scaled) index: $08
  let pts: Point[2] = [Point { x: 5, y: 6 }, Point { x: 8, y: 9 }];
  let j: byte = 1;
  poke($C002, pts[j].x);

  // $C003 — enum-dispatch switch (auto-break): DOWN → 2
  let d: Direction = Direction.DOWN;
  let dispatch: byte = 0;
  switch (d) {
    case Direction.UP: dispatch = 1;
    case Direction.DOWN: dispatch = 2;
    default: dispatch = 9;
  }
  poke($C003, dispatch);

  // $C004/$C005/$C006 — compile-time query folds: 6 / 2 / 1
  poke($C004, length(TABLE));
  poke($C005, sizeof(Point));
  poke($C006, offsetof(Point, y));

  // $C007 — cross-module const-table read with a runtime index: TABLE[1] = 20 = $14
  let k: byte = 1;
  poke($C007, Gfx.TABLE[k]);

  // $C008 — whole-struct copy semantics (a copy, never aliasing): $0B
  let a: Point = Point { x: 11, y: 0 };
  let b: Point = a;
  a.x = 99;
  poke($C008, b.x);

  // $C009 — single-step enum→word cast; the low byte is the enum's backing: $03
  let w: word = <word>(d);
  poke($C009, <byte>(w));
}
`;

/** A built Slice 7 program plus a cleanup for its temp directory. */
export interface BuiltSlice7 {
  result: BuildResult;
  cleanup: () => void;
}

/** Writes both fixture files into `cwd`. */
function writeFixture(cwd: string): void {
  writeFileSync(join(cwd, "gfx.blend"), SLICE7_GFX_SRC, "utf8");
  writeFileSync(join(cwd, "main.blend"), SLICE7_MAIN_SRC, "utf8");
}

/**
 * Build the Slice 7 program to a real c64 `.prg` (absolute outDir so ACME's
 * cwd resolves consistently). Requires real ACME.
 *
 * @returns The {@link BuildResult} and a `cleanup()` that removes the temp dir.
 */
export async function buildSlice7(): Promise<BuiltSlice7> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-harness-slice7-"));
  writeFixture(cwd);
  const result = await build({
    platform: "c64",
    cwd,
    sourceFiles: ["main.blend", "gfx.blend"],
    outDir: join(cwd, "out"),
  });
  return { result, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

/**
 * Emit the Slice 7 ACME source via `emitAsm` (the partial pipeline that stops
 * before the assembler — no ACME, no emulator, CI-runnable). Writes the
 * fixture to a scratch dir that is removed before returning.
 *
 * @returns The {@link EmitResult} (its `text` is the ACME source).
 */
export function emitAsmSlice7(): EmitResult {
  const cwd = mkdtempSync(join(tmpdir(), "b65-golden-slice7-"));
  writeFixture(cwd);
  try {
    return emitAsm({
      platform: "c64",
      cwd,
      sourceFiles: ["main.blend", "gfx.blend"],
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

/**
 * The Slice 7 program's shared observable set: every aggregate-surface
 * result, from the indexed loop sum to the enum→word cast's low byte.
 */
export const SLICE7_OBSERVABLES: ProgramObservables = {
  landmarks: [{ kind: "memory", address: 0xc009, value: 0x03 }],
  checks: [
    { address: 0xc000, value: 0x0e, note: "1+2+3+4+4 over byte[5] = [1,2,3;4]" },
    { address: 0xc001, value: 0x2a, note: "player.pos.y = 42" },
    { address: 0xc002, value: 0x08, note: "pts[1].x = 8 (runtime index × 2)" },
    { address: 0xc003, value: 0x02, note: "case Direction.DOWN → 2" },
    { address: 0xc004, value: 0x06, note: "length(TABLE) = 6" },
    { address: 0xc005, value: 0x02, note: "sizeof(Point) = 2" },
    { address: 0xc006, value: 0x01, note: "offsetof(Point, y) = 1" },
    { address: 0xc007, value: 0x14, note: "Gfx.TABLE[1] = 20" },
    { address: 0xc008, value: 0x0b, note: "b.x after b = a; a.x = 99 → still 11 (copy)" },
    { address: 0xc009, value: 0x03, note: "<byte>(<word>(Direction.DOWN)) = 3 — the sentinel" },
  ],
};
