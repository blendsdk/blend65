/**
 * Shared test support for the branch-reach probes — two programs whose
 * control flow deliberately stretches a 6502 conditional branch beyond the
 * relative reach of −128..+127 bytes: a `do…while` whose body pushes the
 * back-edge branch too far backwards, and a `switch` whose dispatch sits too
 * far ahead of its case bodies. Both must compile AND assemble; a compiler
 * that emits a bare short branch across those spans produces assembly ACME
 * rejects.
 *
 * These sources are unit-tier range probes with NO `examples/` counterpart:
 * do NOT add this module to the examples-sync suite's inlined-module table —
 * that suite pins inlined constants to published example files, and these
 * probes are intentionally not part of the published corpus, so listing them
 * there would fail it.
 *
 * Builds go through the compiler's real `build()` facade (ACME included) on
 * the c64 target; `emitAsm` exposes the ACME source without an assembler
 * run. Test-only: NOT re-exported from the package barrel.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, emitAsm, type BuildResult, type EmitResult } from "@blend65/compiler";
import type { ProgramObservables } from "./observables.js";

/**
 * A `do…while` whose body (40 pokes) makes the loop's backward conditional
 * branch overshoot the relative reach. `poke` takes literal addresses only,
 * hence the spelled-out run of `$0400..$0427`.
 *
 * After the loop it publishes the surviving counter to `$C001` and then a
 * settle sentinel to `$C000`. The counter is the sharp observable: it can only
 * read 3 if the back edge branched to the loop head exactly the right number of
 * times, which is precisely what a mis-encoded long branch would get wrong.
 */
export const DO_WHILE_RANGE_SRC = `module Main;

function main(): void {
  let n: byte = 0;
  do {
    poke($0400, 0);
    poke($0401, 1);
    poke($0402, 2);
    poke($0403, 3);
    poke($0404, 4);
    poke($0405, 5);
    poke($0406, 6);
    poke($0407, 7);
    poke($0408, 8);
    poke($0409, 9);
    poke($040A, 10);
    poke($040B, 11);
    poke($040C, 12);
    poke($040D, 13);
    poke($040E, 14);
    poke($040F, 15);
    poke($0410, 16);
    poke($0411, 17);
    poke($0412, 18);
    poke($0413, 19);
    poke($0414, 20);
    poke($0415, 21);
    poke($0416, 22);
    poke($0417, 23);
    poke($0418, 24);
    poke($0419, 25);
    poke($041A, 26);
    poke($041B, 27);
    poke($041C, 28);
    poke($041D, 29);
    poke($041E, 30);
    poke($041F, 31);
    poke($0420, 32);
    poke($0421, 33);
    poke($0422, 34);
    poke($0423, 35);
    poke($0424, 36);
    poke($0425, 37);
    poke($0426, 38);
    poke($0427, 39);
    n = n + 1;
  } while (n < 3);
  poke($C001, n);
  poke($C000, $5A);
}
`;

/**
 * A `switch` whose first two case bodies (40 pokes each) push the dispatch's
 * forward conditional branches to the later cases past the relative reach.
 * `poke` takes literal addresses only, hence the spelled-out runs.
 *
 * Every arm stamps its own tag into `$C002` and the program publishes a settle
 * sentinel to `$C003` afterwards. The tag says which arm the dispatch actually
 * reached — the one thing a long forward branch landing at the wrong offset
 * would change, and something no amount of screen-RAM inspection could tell
 * apart from a partially-run body.
 */
export const SWITCH_RANGE_SRC = `module Main;

function main(): void {
  let k: byte = 2;
  switch (k) {
    case 0: {
      poke($0400, 0);
      poke($0401, 1);
      poke($0402, 2);
      poke($0403, 3);
      poke($0404, 4);
      poke($0405, 5);
      poke($0406, 6);
      poke($0407, 7);
      poke($0408, 8);
      poke($0409, 9);
      poke($040A, 10);
      poke($040B, 11);
      poke($040C, 12);
      poke($040D, 13);
      poke($040E, 14);
      poke($040F, 15);
      poke($0410, 16);
      poke($0411, 17);
      poke($0412, 18);
      poke($0413, 19);
      poke($0414, 20);
      poke($0415, 21);
      poke($0416, 22);
      poke($0417, 23);
      poke($0418, 24);
      poke($0419, 25);
      poke($041A, 26);
      poke($041B, 27);
      poke($041C, 28);
      poke($041D, 29);
      poke($041E, 30);
      poke($041F, 31);
      poke($0420, 32);
      poke($0421, 33);
      poke($0422, 34);
      poke($0423, 35);
      poke($0424, 36);
      poke($0425, 37);
      poke($0426, 38);
      poke($0427, 39);
      poke($C002, 10);
    }
    case 1: {
      poke($0500, 0);
      poke($0501, 1);
      poke($0502, 2);
      poke($0503, 3);
      poke($0504, 4);
      poke($0505, 5);
      poke($0506, 6);
      poke($0507, 7);
      poke($0508, 8);
      poke($0509, 9);
      poke($050A, 10);
      poke($050B, 11);
      poke($050C, 12);
      poke($050D, 13);
      poke($050E, 14);
      poke($050F, 15);
      poke($0510, 16);
      poke($0511, 17);
      poke($0512, 18);
      poke($0513, 19);
      poke($0514, 20);
      poke($0515, 21);
      poke($0516, 22);
      poke($0517, 23);
      poke($0518, 24);
      poke($0519, 25);
      poke($051A, 26);
      poke($051B, 27);
      poke($051C, 28);
      poke($051D, 29);
      poke($051E, 30);
      poke($051F, 31);
      poke($0520, 32);
      poke($0521, 33);
      poke($0522, 34);
      poke($0523, 35);
      poke($0524, 36);
      poke($0525, 37);
      poke($0526, 38);
      poke($0527, 39);
      poke($C002, 11);
    }
    case 2: {
      poke($0600, 0);
      poke($0601, 1);
      poke($0602, 2);
      poke($0603, 3);
      poke($C002, 12);
    }
    default: {
      poke($D020, 7);
      poke($C002, 13);
    }
  }
  poke($C003, $5A);
}
`;

/** A built range-probe fixture: the build result + scratch-dir cleanup. */
export interface BuiltRangeFixture {
  readonly result: BuildResult;
  readonly cleanup: () => void;
}

/** Stages the given source into a fresh temp dir as `main.blend`. */
function stageFixture(prefix: string, source: string): string {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  writeFileSync(join(cwd, "main.blend"), source, "utf8");
  return cwd;
}

/**
 * Builds a staged source through the real `build()` pipeline (ACME
 * included). The outDir is absolute so the assembler's working directory
 * resolves consistently regardless of the test runner's own cwd.
 */
async function buildSource(prefix: string, source: string): Promise<BuiltRangeFixture> {
  const cwd = stageFixture(prefix, source);
  const result = await build({
    platform: "c64",
    cwd,
    sourceFiles: ["main.blend"],
    outDir: join(cwd, "out"),
  });
  return {
    result,
    cleanup: () => rmSync(cwd, { recursive: true, force: true }),
  };
}

/** Emits a staged source's ACME text (no assembler run). */
function emitSource(prefix: string, source: string): EmitResult {
  const cwd = stageFixture(prefix, source);
  try {
    return emitAsm({ platform: "c64", cwd, sourceFiles: ["main.blend"] });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

/** Builds the `do…while` range probe through real ACME. */
export function buildDoWhileRange(): Promise<BuiltRangeFixture> {
  return buildSource("b65-range-dowhile-", DO_WHILE_RANGE_SRC);
}

/** Builds the `switch` range probe through real ACME. */
export function buildSwitchRange(): Promise<BuiltRangeFixture> {
  return buildSource("b65-range-switch-", SWITCH_RANGE_SRC);
}

/** Emits the `do…while` range probe's ACME source (no assembler run). */
export function emitAsmDoWhileRange(): EmitResult {
  return emitSource("b65-range-dowhile-asm-", DO_WHILE_RANGE_SRC);
}

/** Emits the `switch` range probe's ACME source (no assembler run). */
export function emitAsmSwitchRange(): EmitResult {
  return emitSource("b65-range-switch-asm-", SWITCH_RANGE_SRC);
}

/**
 * The `do…while` probe's observable set: settle on the `$C000` sentinel, then
 * read the surviving loop counter and the far end of the loop body.
 *
 * `$C001 == 3` is the whole point — three iterations, no more and no fewer, so
 * the backward branch reached its head every time and stopped when the
 * condition said to.
 */
export const DO_WHILE_RANGE_OBSERVABLES: ProgramObservables = {
  landmarks: [{ kind: "memory", address: 0xc000, value: 0x5a }],
  checks: [
    { address: 0xc000, value: 0x5a, note: "settle sentinel — the program ran to completion" },
    { address: 0xc001, value: 0x03, note: "loop counter: exactly three iterations" },
    { address: 0x0427, value: 0x27, note: "last write of the loop body" },
  ],
};

/**
 * The `switch` probe's observable set: settle on the `$C003` sentinel, then
 * read the arm tag and the third arm's own writes.
 *
 * `$C002 == 12` names the arm the dispatch reached; the `$0600` run confirms
 * that arm's body ran, not merely that its label was entered.
 */
export const SWITCH_RANGE_OBSERVABLES: ProgramObservables = {
  landmarks: [{ kind: "memory", address: 0xc003, value: 0x5a }],
  checks: [
    { address: 0xc003, value: 0x5a, note: "settle sentinel — the program ran to completion" },
    { address: 0xc002, value: 0x0c, note: "arm tag: the dispatch reached case 2" },
    { address: 0x0600, value: 0x00, note: "case 2 body, first write" },
    { address: 0x0603, value: 0x03, note: "case 2 body, last write" },
  ],
};
