/**
 * Specification tests for the folded symbolic-address operand, assembled.
 *
 * A sprite's 64-byte block number is its address divided by 64 — arithmetic on
 * a link-time constant, which an assembler does for free. `lo(&X / 64)` must
 * therefore cost one immediate load and nothing else, and `lo(&X >> 6)` must
 * mean the identical byte: two spellings of one value, not two code paths.
 *
 * The oracle is the **assembled byte**, read out of the linked binary and
 * compared against the symbol map — never the presence of an operand in the
 * emitted text. A plausible-looking operand can assemble cleanly and mean
 * something else entirely, which is the failure mode these tests exist to
 * catch; asserting that the operand appeared would not catch it.
 *
 * Assembles for real (`skipIf(!hasAcme())`); ACME is installed in CI.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { build, type BuildResult } from "@blend65/compiler";
import { hasAcme } from "./fixture.js";

/** Builds one inline program through the real `build()` facade and ACME. */
async function buildSource(source: string): Promise<{ result: BuildResult; cleanup: () => void }> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-symaddr-"));
  writeFileSync(join(cwd, "main.blend"), source);
  const result = await build({
    platform: "c64",
    cwd,
    sourceFiles: ["main.blend"],
    outDir: join(cwd, "out"),
  });
  return { result, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

/**
 * The immediate byte an `LDA #imm` / `STA $07F8` pair puts in the binary.
 *
 * Found by its opcode bytes — `A9 xx 8D F8 07` — so what is read is the value
 * the assembler actually resolved, not anything the compiler claimed.
 */
function blockByteStoredTo07F8(binary: Uint8Array): number {
  for (let i = 0; i + 4 < binary.length; i++) {
    if (
      binary[i] === 0xa9 &&
      binary[i + 2] === 0x8d &&
      binary[i + 3] === 0xf8 &&
      binary[i + 4] === 0x07
    ) {
      return binary[i + 1];
    }
  }
  throw new Error("no `LDA #imm` / `STA $07F8` pair found in the assembled binary");
}

/** A program whose only statement stores `expr` to the sprite-pointer byte. */
function program(expr: string): string {
  return [
    "module Main;",
    "const SPRITE: byte[64] = [",
    "  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,",
    "  17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,",
    "  33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48,",
    "  49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64",
    "];",
    "function main(): void {",
    `  poke($07F8, ${expr});`,
    "}",
    "",
  ].join("\n");
}

describe.skipIf(!hasAcme())(
  "Specification: the folded block number assembles (ST-13d, ST-13e)",
  () => {
    it("ST-13d: lo(&X / 64) assembles to the image's own block number", async () => {
      const { result, cleanup } = await buildSource(program("lo(&SPRITE / 64)"));
      try {
        expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
        const address = result.symbolMap!.get("__data_Main_SPRITE");
        expect(address, "__data_Main_SPRITE must resolve").toBeTypeOf("number");

        // The block number truncates on purpose: above $4000 the quotient no
        // longer fits a byte, and the low byte IS the correct within-bank block.
        expect(blockByteStoredTo07F8(result.binary!)).toBe(Math.floor(address! / 64) & 0xff);

        // A link-time division must not become a runtime one.
        expect(result.asmText).not.toContain("__rt_div16");
        expect(result.diagnostics.map((d) => d.code)).not.toContain("W10171");
      } finally {
        cleanup();
      }
    });

    it("ST-13e: lo(&X >> 6) builds and means the same byte as the divide form", async () => {
      const shifted = await buildSource(program("lo(&SPRITE >> 6)"));
      const divided = await buildSource(program("lo(&SPRITE / 64)"));
      try {
        expect(shifted.result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
        const address = shifted.result.symbolMap!.get("__data_Main_SPRITE");
        const byte = blockByteStoredTo07F8(shifted.result.binary!);

        // Anchored externally against the symbol map, so this is not merely a
        // comparison of the two forms against each other.
        expect(byte).toBe(Math.floor(address! / 64) & 0xff);
        expect(byte).toBe(blockByteStoredTo07F8(divided.result.binary!));
      } finally {
        shifted.cleanup();
        divided.cleanup();
      }
    });
  },
);
