/**
 * Shared test support for the Slice 8b fixture — the data-surface program:
 * a PETSCII string const copied to screen RAM through a by-ref const
 * parameter, an embedded binary staged to an observable RAM block, a
 * bracketed string initialiser with a char-literal fill mutated through a
 * char store, and a char-literal comparison gating a flag byte. Every
 * observable is a deterministic memory range.
 *
 * Builds `examples/slice8b/main.blend` (inlined verbatim) to a real c64
 * `.prg` via the compiler's `build()` facade + real ACME, staging the
 * committed `table.bin` beside the temp source so source-relative
 * `embed()` resolution is exercised for real. Emits the ACME source via
 * `emitAsm` for the golden tier. Test-only: NOT re-exported from the
 * package barrel.
 */

import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, emitAsm, type BuildResult, type EmitResult } from "@blend65/compiler";

/** The committed 8-byte asset (`01 02 04 08 10 20 40 80`), hexdump-stable. */
const TABLE_BIN = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "examples",
  "slice8b",
  "table.bin",
);

/** The Slice 8b Main module — verbatim `examples/slice8b/main.blend`. */
export const SLICE8B_MAIN_SRC = `module Main;

const TITLE: byte[] = "HELLO C64!";        // 10 bytes, PETSCII-encoded
const TABLE: byte[] = embed("table.bin");  // 8 committed bytes: $01 02 04 08 10 20 40 80
let banner: byte[8] = ["HI"; '.'];         // bracketed string + char-literal fill
let title2: byte[10];                      // staging: the copied screen text
let table2: byte[8];                       // staging: the copied embed bytes

function copyBytes(src: const byte[], dst: byte[], len: byte): void {
  let last: byte = len - 1;
  for (let i: byte = 0 to last) {
    dst[i] = src[i];
  }
}

function main(): void {
  copyBytes(TITLE, title2, length(TITLE)); // by-ref const src, by-ref dst, length() fold
  copyBytes(TABLE, table2, length(TABLE)); // embedded bytes through the same copy path
  banner[0] = 'B';                         // mutable string mutation via a char literal

  poke($0400, title2[0]);                  // screen RAM: the copied title
  poke($0401, title2[1]);
  poke($0402, title2[2]);
  poke($0403, title2[3]);
  poke($0404, title2[4]);
  poke($0405, title2[5]);
  poke($0406, title2[6]);
  poke($0407, title2[7]);
  poke($0408, title2[8]);
  poke($0409, title2[9]);

  poke($C000, table2[0]);                  // the copied embed bytes
  poke($C001, table2[1]);
  poke($C002, table2[2]);
  poke($C003, table2[3]);
  poke($C004, table2[4]);
  poke($C005, table2[5]);
  poke($C006, table2[6]);
  poke($C007, table2[7]);

  poke($C010, banner[0]);                  // the mutated banner
  poke($C011, banner[1]);
  poke($C012, banner[2]);
  poke($C013, banner[3]);
  poke($C014, banner[4]);
  poke($C015, banner[5]);
  poke($C016, banner[6]);
  poke($C017, banner[7]);

  if (TITLE[0] == 'H') {                   // char-literal comparison against encoded data
    poke($C020, 1);
  }
}
`;

/** A built Slice 8b fixture: the build result + scratch-dir cleanup. */
export interface BuiltSlice8b {
  readonly result: BuildResult;
  readonly cleanup: () => void;
}

/** Stages the fixture source + the committed asset into a fresh temp dir. */
function stageFixture(prefix: string): string {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  writeFileSync(join(cwd, "main.blend"), SLICE8B_MAIN_SRC, "utf8");
  copyFileSync(TABLE_BIN, join(cwd, "table.bin"));
  return cwd;
}

/**
 * Builds the fixture through the real `build()` pipeline (ACME included).
 * The outDir is absolute so the assembler's working directory resolves
 * consistently regardless of the test runner's own cwd.
 */
export async function buildSlice8b(): Promise<BuiltSlice8b> {
  const cwd = stageFixture("b65-slice8b-");
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

/** Emits the fixture's ACME source (no assembler run) for the golden tier. */
export function emitAsmSlice8b(): EmitResult {
  const cwd = stageFixture("b65-slice8b-asm-");
  try {
    return emitAsm({ platform: "c64", cwd, sourceFiles: ["main.blend"] });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
