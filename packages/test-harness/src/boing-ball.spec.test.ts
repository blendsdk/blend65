/**
 * Specification tests for the boing-ball demo (ST-13j, ST-13k), in two suites.
 *
 * The demo animates by pointer swapping: its ball is four consecutive 64-byte
 * blocks, and each frame points the four sprites at `base + frame*4 + 0..3`.
 * That divides the program's evidence cleanly in two.
 *
 * The **build suite** proves everything that exists at link time — the image
 * sits on a sprite block and in the VIC's reach, and the `base` initialiser's assembled
 * immediate is that image's own block number. It also proves the value is still
 * usable as a BLOCK base, structurally, through the `+1`/`+2`/`+3` chain that
 * feeds the three sibling pointers. It runs wherever ACME does, which includes
 * CI.
 *
 * The **VICE suite** proves the half that link time structurally cannot. The
 * four pointer bytes live in VIC pointer RAM at `$07F8`–`$07FB`, outside the
 * load image — they exist in no PRG at any frame, because they are computed at
 * run time from an animating counter. Only a running program has them.
 */

import { afterAll, describe, expect, it } from "vitest";
import { buildBoingBall, type BuiltBoingBall } from "./testing/boing-ball.js";
import { assertObservables } from "./testing/observables.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import type { EmulatorDriver } from "./emulator/driver.js";

/** The image label every pointer must resolve against. */
const BALL_LABEL = "__data_Main_BALL";
/** The frame slot the migrated block number initialises. */
const BASE_SLOT = "__frame_Main_main_base";
/** The generated frame-body block — the once-per-frame program point. */
const LOOP_HEAD_LABEL = "Main_main_L9";
const LOCAL_TEST_TIMEOUT = 60000;

/**
 * The immediate byte an `LDA #imm` / `STA <target>` pair puts in the binary.
 *
 * Located by opcode bytes and the target's resolved address, so what is read is
 * the value the assembler produced — not an operand the compiler claims to have
 * emitted, which can be present and still mean the wrong number.
 */
function immediateStoredTo(binary: Uint8Array, target: number): number {
  const lo = target & 0xff;
  const hi = (target >> 8) & 0xff;
  for (let i = 0; i + 4 < binary.length; i++) {
    if (
      binary[i] === 0xa9 &&
      binary[i + 2] === 0x8d &&
      binary[i + 3] === lo &&
      binary[i + 4] === hi
    ) {
      return binary[i + 1];
    }
  }
  throw new Error(`no \`LDA #imm\` / \`STA $${target.toString(16)}\` pair in the assembled binary`);
}

describe.skipIf(!hasAcme())("Specification: boing-ball's block base is link-time (ST-13j)", () => {
  it("ST-13j: builds, aligns its image, and bases its pointers on that image's block", async () => {
    const { result, cleanup } = await buildBoingBall();
    try {
      expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
      const address = result.symbolMap!.get(BALL_LABEL);
      const baseSlot = result.symbolMap!.get(BASE_SLOT);
      expect(address, `${BALL_LABEL} must resolve`).toBeTypeOf("number");
      expect(baseSlot, `${BASE_SLOT} must resolve`).toBeTypeOf("number");

      // The program names its image as a 64-byte block, the unit the VIC
      // dereferences a sprite in, so that is the boundary it earns.
      expect(address! % 64).toBe(0);
      expect(address!).toBeLessThan(0x1000);

      // The rendered directive is load-bearing rather than belt-and-braces: a
      // multiple of 256 is already a multiple of 64, so the address check above
      // cannot fail if the demand silently coarsened back to a page. ACME's
      // `!align` takes a bitmask, so 64 renders as 63.
      const alignLines = result.asmText!.split("\n").map((line) => line.trim());
      const ballLabelIndex = alignLines.indexOf(`${BALL_LABEL}:`);
      expect(ballLabelIndex, `${BALL_LABEL}: must appear in the assembly`).toBeGreaterThan(0);
      expect(alignLines[ballLabelIndex - 1]).toBe("!align 63, 0, 0");

      // The initialiser's own assembled byte, read back out of the binary.
      expect(immediateStoredTo(result.binary!, baseSlot!)).toBe(Math.floor(address! / 64) & 0xff);

      // And the value is still usable as a BLOCK base: the three siblings are
      // reached by adding 1, 2 and 3 to it, which is only meaningful if it
      // numbers 64-byte blocks rather than anything else.
      const asm = result.asmText!;
      for (const [addend, target] of [
        [1, "$07F9"],
        [2, "$07FA"],
        [3, "$07FB"],
      ] as const) {
        const chain = new RegExp(`ADC #\\$0${addend}[\\s\\S]{0,80}?STA \\$0*${target.slice(2)}`);
        expect(asm, `the +${addend} sibling pointer`).toMatch(chain);
      }
    } finally {
      cleanup();
    }
  });
});

describe.skipIf(!(hasVice("c64") && hasAcme()))("Specification: boing-ball on VICE", () => {
  let built: BuiltBoingBall | undefined;
  let driver: EmulatorDriver | undefined;

  afterAll(async () => {
    if (driver !== undefined) await driver.shutdown();
    built?.cleanup();
  });

  it(
    "ST-13k: the four sprite pointers land one 64-byte block apart",
    async () => {
      built ??= await buildBoingBall();
      const env = await setupEmulator({ build: built.result, platform: "c64" });
      driver = env.driver;

      // Run to the once-per-frame program point, asserting nothing yet — the
      // pointer values depend on which frame the machine stopped in, which is
      // exactly why this half cannot be proved at link time.
      await assertObservables(
        driver,
        { landmarks: [{ kind: "loopHead", arrivals: 2 }], checks: [] },
        { symbols: env.symbols, loopHeadLabel: LOOP_HEAD_LABEL, timeout: LOCAL_TEST_TIMEOUT },
      );

      const pointers = await driver.readMemory(0x07f8, 4);
      for (const offset of [1, 2, 3]) {
        expect(pointers[offset], `sprite ${offset}'s pointer`).toBe((pointers[0] + offset) & 0xff);
      }

      // And the run-time base is still the link-time one the build suite read,
      // so the two halves are describing the same number.
      const address = env.symbols.get(BALL_LABEL);
      if (address === undefined) throw new Error(`${BALL_LABEL} did not resolve`);
      const baseSlot = env.symbols.get(BASE_SLOT);
      if (baseSlot === undefined) throw new Error(`${BASE_SLOT} did not resolve`);
      const stored = await driver.readMemory(baseSlot, 1);
      expect(stored[0]).toBe(Math.floor(address / 64) & 0xff);

      // And the pointers are that base, not merely four consecutive bytes: the
      // frame counter advances the block by four at a time, so whichever frame
      // the machine stopped in, the first pointer is the base plus a multiple
      // of four. Without this the four could be consecutive from garbage.
      expect([0, 4, 8, 12]).toContain((pointers[0] - stored[0] + 256) % 256);
    },
    LOCAL_TEST_TIMEOUT,
  );
});
