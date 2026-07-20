/**
 * Specification tests for const-data placement: a const array whose address
 * the program takes is emitted at a 256-byte boundary, and one it merely
 * indexes is not.
 *
 * These assert on the REAL resolved addresses from a real ACME assembly, not
 * on the emitted directive alone. That distinction is the point of the suite.
 * ACME's `!align` takes a bitmask rather than a modulus, so a directive that
 * names the boundary itself assembles cleanly, appears in the output, and
 * aligns nothing — only reading back where the label actually landed can tell
 * the two apart.
 *
 * The fixture is `examples/align-mixed/`, a committed source built through the
 * real `build()` facade. It sits outside the parity corpus on purpose: it has
 * no golden and no hand-written twin, because a synthetic two-array program is
 * not an idiom anyone would hand-write a twin of.
 *
 * ACME only — no emulator is involved, so this runs in CI.
 */

import { afterAll, describe, expect, it } from "vitest";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, type BuildResult } from "@blend65/compiler";
import { hasAcme } from "./fixture.js";

/** The committed fixture directory. */
const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "examples",
  "align-mixed",
);

/** Both arrays are 4 bytes; the padding assertion reads the aligned one's length. */
const ALIGNED_LENGTH = 4;

const ALIGNED_LABEL = "__data_Main_ALIGNED";
const PLAIN_LABEL = "__data_Main_PLAIN";

/** Builds the committed fixture through the real pipeline, ACME included. */
async function buildAlignMixed(): Promise<{ result: BuildResult; cleanup: () => void }> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-align-mixed-"));
  copyFileSync(join(FIXTURE_DIR, "main.blend"), join(cwd, "main.blend"));
  const result = await build({
    platform: "c64",
    cwd,
    sourceFiles: ["main.blend"],
    outDir: join(cwd, "out"),
  });
  return { result, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

describe.skipIf(!hasAcme())("Specification: const-data page alignment (ST-C11..ST-C13)", () => {
  let built: { result: BuildResult; cleanup: () => void } | undefined;

  afterAll(() => built?.cleanup());

  /** Builds once and hands back the pieces every case needs. */
  async function buildOnce(): Promise<{ asm: string; symbols: Map<string, number> }> {
    built ??= await buildAlignMixed();
    expect(built.result.hasErrors).toBe(false);
    const asm = built.result.asmText;
    const symbols = built.result.symbolMap;
    expect(asm, "the build must emit assembly text").toBeTypeOf("string");
    expect(symbols, "the build must resolve a symbol map").toBeInstanceOf(Map);
    return { asm: asm as string, symbols: symbols as Map<string, number> };
  }

  it("ST-C11: emits one alignment directive, immediately before the addressed array", async () => {
    const { asm } = await buildOnce();
    const lines = asm.split("\n").map((line) => line.trim());

    // The rendered text is asserted here, not just the directive's presence:
    // this is the only place the bitmask form is visible at all, and at a real
    // program's addresses a 64-byte and a 256-byte boundary frequently coincide,
    // so no address assertion downstream can tell page from block.
    const alignIndexes = lines
      .map((line, i) => (line.startsWith("!align") ? i : -1))
      .filter((i) => i >= 0);
    expect(alignIndexes).toHaveLength(1);
    expect(lines[alignIndexes[0]!]).toBe("!align 255, 0, 0");
    expect(lines[alignIndexes[0]! + 1]).toBe(`${ALIGNED_LABEL}:`);
  });

  it("ST-C12: lands the addressed array on a page, and the other pays no padding", async () => {
    const { symbols } = await buildOnce();
    const aligned = symbols.get(ALIGNED_LABEL);
    const plain = symbols.get(PLAIN_LABEL);
    expect(aligned, `${ALIGNED_LABEL} must resolve`).toBeTypeOf("number");
    expect(plain, `${PLAIN_LABEL} must resolve`).toBeTypeOf("number");

    // The resolved address is what catches a directive that assembles but does
    // not align.
    expect(aligned! % 256).toBe(0);

    // The unaddressed array follows immediately, paying nothing for its
    // neighbour's boundary. Asserting `plain % 256 !== 0` instead would flake
    // the day an unrelated size change happens to land it on a boundary.
    expect(plain).toBe(aligned! + ALIGNED_LENGTH);
  });

  it("ST-C13: the sprite-pointer identity holds on the resolved address", async () => {
    const { symbols } = await buildOnce();
    const aligned = symbols.get(ALIGNED_LABEL)!;

    // Computing a sprite pointer as `hi(addr) * 4` is only the same thing as
    // `addr / 64` when the image is page-aligned. Both sides are computed from
    // the same resolved number, so this restates the identity on a real
    // address rather than probing the emitter independently.
    expect((aligned >> 8) * 4).toBe(aligned / 64);
  });
});
