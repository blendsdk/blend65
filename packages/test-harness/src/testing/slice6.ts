/**
 * Shared test support for the Slice 6 fixture — the expression-system
 * program: mixed-width promotion with a compound assignment, a truncating
 * cast, shifts (constant byte + variable-count word), bitwise or, unary
 * complement and signed negation, mixed-width and signed comparisons, the
 * conditional operator, and the OBSERVABLE short-circuit guarantee (a
 * side-effecting helper provably not called on two short-circuit paths, then
 * called exactly once). Builds `examples/slice6/main.blend` (inlined
 * verbatim, mirroring `testing/slice5b.ts`) to a real c64 `.prg` via the
 * compiler's `build()` facade + real ACME, and emits its ACME source via
 * `emitAsm` for the golden tier. Test-only: NOT re-exported from the package
 * barrel.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, emitAsm, type BuildResult, type EmitResult } from "@blend65/compiler";

/** The Slice 6 program — verbatim `examples/slice6/main.blend`. */
export const SLICE6_MAIN_SRC = `module Main;

let witness: byte = 0;

function bump(): boolean {
  witness = witness + 1;
  return true;
}

function main(): void {
  // Mixed-width promotion + compound assignment
  let a: byte = 200;
  let base: word = 1000;
  let r: word = base + a;                      // byte zero-extends: 1200
  r += 55;                                     // word += byte literal: 1255 = $04E7
  pokew($C000, r);                             // $C000=$E7 $C001=$04

  // Cast (trunc), shift, bitwise, unary ~
  let w: word = $0304;
  let low: byte = <byte>(w);                   // truncate: $04
  let m: byte = (low << 3) | 5;                // 32|5 = 37
  poke($C002, ~m);                             // ~37 = 218 = $DA

  // Unary minus (signed), cross-sign cast
  let s: sbyte = -5;
  let t: sbyte = -s;                           // 5
  poke($C003, <byte>(t));                      // $05

  // Comparisons: mixed-width unsigned + signed; ternary
  let cond: boolean = (a < base) && (s < 0);   // true && true
  let pick: byte = cond ? 7 : 9;               // 7
  poke($C004, pick);                           // $07

  // Short-circuit suppression (the observable guarantee)
  let dead: boolean = (a > base) && bump();    // false && — bump SUPPRESSED
  let live: boolean = (a < base) || bump();    // true  || — bump SUPPRESSED
  poke($C005, witness);                        // $00 — proof neither ran
  let ran: boolean = dead || (a > base) || bump(); // all false — bump RUNS
  poke($C006, ran && live ? witness : $FF);    // true && true → witness = $01

  // Variable-count word shift
  let sh: byte = 2;
  let wide: word = $0011;
  let shifted: word = wide << sh;              // $0044
  pokew($C007, shifted);                       // $C007=$44 $C008=$00
}
`;

/** A built Slice 6 program plus a cleanup for its temp directory. */
export interface BuiltSlice6 {
  result: BuildResult;
  cleanup: () => void;
}

/** Writes the fixture file into `cwd`. */
function writeFixture(cwd: string): void {
  writeFileSync(join(cwd, "main.blend"), SLICE6_MAIN_SRC, "utf8");
}

/**
 * Build the Slice 6 program to a real c64 `.prg` (absolute outDir so ACME's
 * cwd resolves consistently). Requires real ACME.
 *
 * @returns The {@link BuildResult} and a `cleanup()` that removes the temp dir.
 */
export async function buildSlice6(): Promise<BuiltSlice6> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-harness-slice6-"));
  writeFixture(cwd);
  const result = await build({
    platform: "c64",
    cwd,
    sourceFiles: ["main.blend"],
    outDir: join(cwd, "out"),
  });
  return { result, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

/**
 * Emit the Slice 6 ACME source via `emitAsm` (the partial pipeline that stops
 * before the assembler — no ACME, no emulator, CI-runnable). Writes the
 * fixture to a scratch dir that is removed before returning.
 *
 * @returns The {@link EmitResult} (its `text` is the ACME source).
 */
export function emitAsmSlice6(): EmitResult {
  const cwd = mkdtempSync(join(tmpdir(), "b65-golden-slice6-"));
  writeFixture(cwd);
  try {
    return emitAsm({
      platform: "c64",
      cwd,
      sourceFiles: ["main.blend"],
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
