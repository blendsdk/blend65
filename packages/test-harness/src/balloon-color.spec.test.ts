/**
 * Specification tests for the balloon-colour demo (ST-13f).
 *
 * The demo sits outside the parity corpus on purpose — no golden, no twin, no
 * size budget — so nothing else in the tree would notice if its sprite pointer
 * stopped pointing at its sprite. This is the check that would: build it for
 * real, then read the byte the program stores to the VIC's sprite-0 pointer
 * and compare it against the address the linker actually gave the image.
 *
 * Build-only (`skipIf(!hasAcme())`); ACME is installed in CI, VICE is not.
 */

import { describe, expect, it } from "vitest";
import { hasAcme } from "./fixture.js";
import { buildBalloonColor } from "./testing/balloon-color.js";

/** The image label the sprite pointer must resolve against. */
const SPRITE_LABEL = "__data_Main_BALLOON";

/**
 * The immediate byte an `LDA #imm` / `STA $07F8` pair puts in the binary —
 * found by its opcode bytes, so what is read is the value the assembler
 * resolved rather than anything the compiler claimed.
 */
function spritePointerByte(binary: Uint8Array): number {
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

describe.skipIf(!hasAcme())(
  "Specification: balloon-color points at its own sprite (ST-13f)",
  () => {
    it("ST-13f: builds, aligns its image, and stores that image's block number", async () => {
      const { result, cleanup } = await buildBalloonColor();
      try {
        expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
        const address = result.symbolMap!.get(SPRITE_LABEL);
        expect(address, `${SPRITE_LABEL} must resolve`).toBeTypeOf("number");

        // The program names its image as a 64-byte block — the unit the VIC
        // dereferences a sprite in — so that is the boundary it earns. Below
        // the character-ROM shadow too, where the VIC would read ROM instead
        // of the image no matter what the pointer said.
        expect(address! % 64).toBe(0);
        expect(address!).toBeLessThan(0x1000);

        // The rendered directive is load-bearing rather than belt-and-braces:
        // a multiple of 256 is already a multiple of 64, so the address check
        // above cannot fail if the demand silently coarsened back to a page.
        // ACME's `!align` takes a bitmask, so 64 renders as 63.
        const lines = result.asmText!.split("\n").map((line) => line.trim());
        const labelIndex = lines.indexOf(`${SPRITE_LABEL}:`);
        expect(labelIndex, `${SPRITE_LABEL}: must appear in the assembly`).toBeGreaterThan(0);
        expect(lines[labelIndex - 1]).toBe("!align 63, 0, 0");

        // The stored byte is the image's own 64-byte block number. Truncation is
        // deliberate: above $4000 the quotient no longer fits a byte, and the low
        // byte IS the correct within-bank block.
        expect(spritePointerByte(result.binary!)).toBe(Math.floor(address! / 64) & 0xff);
      } finally {
        cleanup();
      }
    });
  },
);
