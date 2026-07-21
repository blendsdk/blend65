/**
 * Specification tests for alignment granularity: the boundary a const image is
 * emitted on follows the arithmetic the program writes around its address.
 *
 * `lo(&X / 64)` — or the same value spelled `lo(&X >> 6)` — names a sprite
 * block, so the image owes a 64-byte boundary. Every other way of taking a
 * const's address (bare `&X`, `lo(&X)`, `hi(&X)`, any other divisor) owes a
 * full page. A symbol named more than one way keeps the coarsest demand it
 * collected, and `&` on a mutable variable or a function demands nothing.
 *
 * Directive TEXT is asserted alongside the resolved address, and that is not
 * belt-and-braces: ACME's `!align` takes a bitmask, not a modulus. A 64-byte
 * boundary renders as `!align 63, 0, 0` and a page as `!align 255, 0, 0`,
 * while a directive naming the boundary itself (`!align 64, 0, 0`) assembles
 * cleanly, appears in the listing, and aligns nothing. Compounding the trap,
 * 64- and 256-byte boundaries coincide on most real addresses, so an address
 * check alone can prove neither page-instead-of-block nor the reverse. Every
 * case therefore pins the rendered directive AND where the label actually
 * landed, wherever both are available.
 *
 * Assembles for real (`skipIf(!hasAcme())`); ACME is installed in CI.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { build, type BuildResult } from "@blend65/compiler";
import { hasAcme } from "./fixture.js";

/** Generous ceiling for the cases that run several real builds inside one test. */
const MULTI_BUILD_TIMEOUT = 120_000;

const SPRITE_LABEL = "__data_Main_SPRITE";

/** Builds one inline program through the real `build()` facade and ACME. */
async function buildSource(source: string): Promise<{ result: BuildResult; cleanup: () => void }> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-align-gran-"));
  writeFileSync(join(cwd, "main.blend"), source);
  const result = await build({
    platform: "c64",
    cwd,
    sourceFiles: ["main.blend"],
    outDir: join(cwd, "out"),
  });
  return { result, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

/** No build in this suite may error; every case asserts that before anything else. */
function expectNoErrors(result: BuildResult): void {
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
}

/** The emitted assembly, trimmed line by line, guarded so a missing emission fails loudly. */
function assemblyLines(result: BuildResult): string[] {
  expect(result.asmText, "the build must emit assembly text").toBeTypeOf("string");
  return (result.asmText as string).split("\n").map((line) => line.trim());
}

/** Indexes of every `!align` line — most cases demand exactly one, one case demands none. */
function alignIndexes(lines: string[]): number[] {
  return lines.map((line, i) => (line.startsWith("!align") ? i : -1)).filter((i) => i >= 0);
}

/** A label's resolved address out of the build's symbol map. */
function resolvedAddress(result: BuildResult, label: string): number {
  expect(result.symbolMap, "the build must resolve a symbol map").toBeInstanceOf(Map);
  const address = result.symbolMap!.get(label);
  expect(address, `${label} must resolve`).toBeTypeOf("number");
  return address!;
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

/**
 * A single-module program around the 64-byte sprite image: `extraDecls` land
 * at module scope, `statements` form `main`'s body.
 */
function spriteProgram(statements: string[], extraDecls: string[] = []): string {
  return [
    "module Main;",
    ...extraDecls,
    "const SPRITE: byte[64] = [",
    "  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,",
    "  17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,",
    "  33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48,",
    "  49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64",
    "];",
    "function main(): void {",
    ...statements.map((statement) => `  ${statement}`),
    "}",
    "",
  ].join("\n");
}

/** Two 4-byte images, both fold-named; `withFiller` shifts where the data starts. */
function twoImagesProgram(withFiller: boolean): string {
  const filler = [
    "function filler(): void {",
    "  poke($D020, 1);",
    "  poke($D021, 2);",
    "  poke($D022, 3);",
    "}",
  ];
  return [
    "module Main;",
    "const A: byte[4] = [1, 2, 3, 4];",
    "const B: byte[4] = [5, 6, 7, 8];",
    ...(withFiller ? filler : []),
    "function main(): void {",
    ...(withFiller ? ["  filler();"] : []),
    "  poke($07F8, lo(&A / 64));",
    "  poke($07F9, lo(&B / 64));",
    "}",
    "",
  ].join("\n");
}

describe.skipIf(!hasAcme())(
  "Specification: alignment granularity follows the address arithmetic (ST-15a..ST-15g)",
  () => {
    it("ST-15a: the block fold renders the 64-byte bitmask once, directly on the image", async () => {
      const { result, cleanup } = await buildSource(
        spriteProgram(["poke($07F8, lo(&SPRITE / 64));"]),
      );
      try {
        expectNoErrors(result);
        const lines = assemblyLines(result);
        const aligns = alignIndexes(lines);

        // Exactly one directive, its exact bitmask text, and the image's label
        // directly under it. A 64-byte demand rendered any other way either
        // over-pads (255) or — the modulus trap — assembles and aligns nothing
        // (64), so both wrong spellings are pinned out explicitly.
        expect(aligns).toHaveLength(1);
        expect(lines[aligns[0]!]).toBe("!align 63, 0, 0");
        expect(lines[aligns[0]! + 1]).toBe(`${SPRITE_LABEL}:`);
        expect(result.asmText).not.toContain("!align 255, 0, 0");
        expect(result.asmText).not.toContain("!align 64, 0, 0");
      } finally {
        cleanup();
      }
    });

    it(
      "ST-15b: the fold earns a block boundary; a bare address earns a full page",
      async () => {
        const fold = await buildSource(spriteProgram(["poke($07F8, lo(&SPRITE / 64));"]));
        // `p` is spent byte by byte so the address is genuinely live, but the
        // only `&` in the program stays the bare one — nothing names a block.
        const bare = await buildSource(
          spriteProgram(["let p: word = &SPRITE;", "poke($07F8, lo(p));", "poke($07F9, hi(p));"]),
        );
        try {
          expectNoErrors(fold.result);
          expectNoErrors(bare.result);
          expect(resolvedAddress(fold.result, SPRITE_LABEL) % 64).toBe(0);
          expect(resolvedAddress(bare.result, SPRITE_LABEL) % 256).toBe(0);
        } finally {
          fold.cleanup();
          bare.cleanup();
        }
      },
      MULTI_BUILD_TIMEOUT,
    );

    it(
      "ST-15c: two block-aligned images pack 64 bytes apart, from either starting offset",
      async () => {
        for (const withFiller of [false, true]) {
          const { result, cleanup } = await buildSource(twoImagesProgram(withFiller));
          try {
            expectNoErrors(result);
            const a = resolvedAddress(result, "__data_Main_A");
            const b = resolvedAddress(result, "__data_Main_B");

            // Exactly 64 apart: a delta of 256 would mean the block demand was
            // never applied (page padding kept), a delta of 4 that alignment
            // was dropped entirely. The filler variant moves the starting
            // offset, so a delta that only holds from one lucky address
            // cannot pass both builds.
            expect(b, withFiller ? "with filler" : "without filler").toBe(a + 64);
          } finally {
            cleanup();
          }
        }
      },
      MULTI_BUILD_TIMEOUT,
    );

    it(
      "ST-15d: named both ways, the coarser page demand wins in either source order",
      async () => {
        const statements = ["poke($07F8, lo(&SPRITE / 64));", "poke($D000, hi(&SPRITE) * 4);"];
        for (const order of [statements, [...statements].reverse()]) {
          const label = order.join(" ");
          const { result, cleanup } = await buildSource(spriteProgram(order));
          try {
            expectNoErrors(result);
            const lines = assemblyLines(result);
            const aligns = alignIndexes(lines);
            expect(aligns, label).toHaveLength(1);
            expect(lines[aligns[0]!], label).toBe("!align 255, 0, 0");

            const address = resolvedAddress(result, SPRITE_LABEL);
            expect(address % 256, label).toBe(0);

            // The block byte still assembles to the image's own block number,
            // and on the same resolved address the two idioms name the same
            // block. The `hi(&X) * 4` side is computed at runtime by shifts
            // and leaves no second immediate to read out, so the identity on
            // the resolved address is the property available to check.
            expect(blockByteStoredTo07F8(result.binary!), label).toBe(
              Math.floor(address / 64) & 0xff,
            );
            expect((address >> 8) * 4, label).toBe(address / 64);
          } finally {
            cleanup();
          }
        }
      },
      MULTI_BUILD_TIMEOUT,
    );

    it("ST-15d: the fold alone keeps the finer block demand", async () => {
      const { result, cleanup } = await buildSource(
        spriteProgram(["poke($07F8, lo(&SPRITE / 64));"]),
      );
      try {
        expectNoErrors(result);
        const lines = assemblyLines(result);
        const aligns = alignIndexes(lines);

        // The contrast case: with the page-demanding naming removed, the
        // demand must drop back to the 64-byte bitmask. Coarsening has to come
        // from the source's arithmetic, not be the emitter's blanket habit.
        expect(aligns).toHaveLength(1);
        expect(lines[aligns[0]!]).toBe("!align 63, 0, 0");
      } finally {
        cleanup();
      }
    });

    it(
      "ST-15e: every other divisor and both bare byte-halves demand a full page",
      async () => {
        // `/ 1` and `/ 32768` are the extremes the fold accepts. `/ 16384` is
        // a VIC-bank read — correct wherever the image lands — and must never
        // be honored as a placement demand: honoring it would spend up to
        // 16 KB of padding to answer a question.
        const forms = [
          "lo(&SPRITE / 1)",
          "lo(&SPRITE / 128)",
          "lo(&SPRITE / 16384)",
          "lo(&SPRITE / 32768)",
          "lo(&SPRITE)",
          "hi(&SPRITE)",
        ];
        for (const form of forms) {
          const { result, cleanup } = await buildSource(spriteProgram([`poke($07F8, ${form});`]));
          try {
            expectNoErrors(result);
            const lines = assemblyLines(result);
            const aligns = alignIndexes(lines);
            expect(aligns, form).toHaveLength(1);
            expect(lines[aligns[0]!], form).toBe("!align 255, 0, 0");
            expect(resolvedAddress(result, SPRITE_LABEL) % 256, form).toBe(0);
          } finally {
            cleanup();
          }
        }
      },
      MULTI_BUILD_TIMEOUT,
    );

    it(
      "ST-15f: the demand keys on the normalized shift, not the divisor's spelling",
      async () => {
        const spellings: Array<{ expr: string; decls: string[] }> = [
          { expr: "lo(&SPRITE / 64)", decls: [] },
          { expr: "lo(&SPRITE >> 6)", decls: [] },
          { expr: "lo(&SPRITE / BLOCK)", decls: ["const BLOCK: byte = 64;"] },
        ];
        const storedBytes: number[] = [];
        for (const { expr, decls } of spellings) {
          const { result, cleanup } = await buildSource(
            spriteProgram([`poke($07F8, ${expr});`], decls),
          );
          try {
            expectNoErrors(result);
            const lines = assemblyLines(result);
            const aligns = alignIndexes(lines);
            expect(aligns, expr).toHaveLength(1);
            expect(lines[aligns[0]!], expr).toBe("!align 63, 0, 0");

            const address = resolvedAddress(result, SPRITE_LABEL);
            expect(address % 64, expr).toBe(0);

            // Each immediate is anchored against its own program's symbol map
            // first, so the agreement asserted below cannot be three copies of
            // one wrong byte.
            const byte = blockByteStoredTo07F8(result.binary!);
            expect(byte, expr).toBe(Math.floor(address / 64) & 0xff);
            storedBytes.push(byte);
          } finally {
            cleanup();
          }
        }

        // One value, three spellings: the divide, the shift, and the named
        // constant are the same arithmetic and must store the same immediate.
        expect(new Set(storedBytes).size).toBe(1);
      },
      MULTI_BUILD_TIMEOUT,
    );

    it("ST-15g: a mutable array and a function register no demand and no directive", async () => {
      const source = [
        "module Main;",
        "let buf: byte[64];",
        "function helper(): void {",
        "  poke($D021, 0);",
        "}",
        "function main(): void {",
        "  poke($07F8, lo(&buf / 64));",
        "  poke($D020, lo(&helper / 64));",
        "}",
        "",
      ].join("\n");
      const { result, cleanup } = await buildSource(source);
      try {
        expectNoErrors(result);

        // Placement demands exist for const images only. Padding RAM the
        // program writes at runtime buys nothing, so no directive of any
        // granularity may be emitted at all.
        expect(alignIndexes(assemblyLines(result))).toHaveLength(0);

        // The fold arithmetic itself stays untouched: the byte reaching the
        // sprite pointer is still the low byte of the variable's address
        // divided by 64, exactly as the symbol map resolves it.
        const address = resolvedAddress(result, "__var_Main_buf");
        expect(blockByteStoredTo07F8(result.binary!)).toBe(Math.floor(address / 64) & 0xff);
      } finally {
        cleanup();
      }
    });
  },
);
