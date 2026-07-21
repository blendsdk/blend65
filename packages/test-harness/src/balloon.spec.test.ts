/**
 * Specification tests for the balloon demo, in two suites.
 *
 * The **VICE suite** consumes the program's shared observable set — the same
 * table the twin tier runs against the hand-written twin. At the stopped 2nd
 * arrival of the frame-body block exactly one movement update has run under
 * the source's ±2-step / `>=`-`<=` bounce semantics: the sprite sits at
 * (174, 141) and every sprite register holds its source-mandated value. The
 * landmark is the body block and not the raster poll: the poll spins once per
 * raster line, so its second arrival lands inside the first frame with the
 * sprite still at its start position. The body block is reached exactly once
 * per frame. It also carries the two checks that left the shared table when
 * the sprite image moved to an allocator-chosen address — the pointer and the
 * image bytes, both resolved through the symbol map.
 *
 * The **build suite** needs only the assembler, so it runs everywhere: the
 * staging copy is gone, the image appears once, the pointer is derived from
 * the image's own address, and that address is page-aligned and in-bank. It
 * deliberately sits OUTSIDE the VICE guard — placed inside, these would skip
 * where no emulator exists rather than fail, and a skip raises no alarm.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { BALLOON_OBSERVABLES, buildBalloon, type BuiltBalloon } from "./testing/balloon.js";
import { assertObservables } from "./testing/observables.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import type { EmulatorDriver } from "./emulator/driver.js";

/** The generated frame-body block — the once-per-frame program point. */
const LOOP_HEAD_LABEL = "Main_main_L5";
const LOCAL_TEST_TIMEOUT = 60000;

describe.skipIf(!(hasVice("c64") && hasAcme()))("Specification: balloon on VICE", () => {
  let built: BuiltBalloon | undefined;
  let driver: EmulatorDriver | undefined;

  afterAll(async () => {
    if (driver !== undefined) await driver.shutdown();
    built?.cleanup();
  });

  it(
    "lands the shared observable set at the stopped 2nd loop-head arrival",
    async () => {
      built = await buildBalloon();
      const env = await setupEmulator({ build: built.result, platform: "c64" });
      driver = env.driver;

      await assertObservables(driver, BALLOON_OBSERVABLES, {
        symbols: env.symbols,
        loopHeadLabel: LOOP_HEAD_LABEL,
        timeout: LOCAL_TEST_TIMEOUT,
      });
    },
    LOCAL_TEST_TIMEOUT,
  );

  it(
    "ST-C18: points the VIC at the embedded image and finds the real sprite there",
    async () => {
      built ??= await buildBalloon();
      const env =
        driver !== undefined
          ? { driver, symbols: built.result.symbolMap! }
          : await setupEmulator({ build: built.result, platform: "c64" });
      driver = env.driver;

      const addr = env.symbols.get(SPRITE_LABEL);
      if (addr === undefined) throw new Error(`${SPRITE_LABEL} did not resolve`);

      // These two checks left the shared table when the image stopped living
      // at a source-chosen address — the allocator picks it now, so no fixed
      // number could be shared with the twin. The twin's own source DOES fix
      // both, and asserts them on its side of the twin tier; what differs is
      // the means, not the picture. Resolving the address from the symbol map
      // is what keeps this side honest.
      await assertObservables(
        driver,
        {
          landmarks: [{ kind: "loopHead", arrivals: 2 }],
          checks: [
            { address: 0x07f8, value: addr / 64, note: "sprite pointer = image block" },
            {
              address: addr,
              bytesFile: "examples/balloon/balloon.bin",
              note: "the VIC reads the embedded image itself",
            },
          ],
        },
        { symbols: env.symbols, loopHeadLabel: LOOP_HEAD_LABEL, timeout: LOCAL_TEST_TIMEOUT },
      );
    },
    LOCAL_TEST_TIMEOUT,
  );
});

/** The committed sprite asset the program embeds. */
const SPRITE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "examples",
  "balloon",
  "balloon.bin",
);

/** The label the embedded sprite image is emitted under. */
const SPRITE_LABEL = "__data_Main_BALLOON";

/** Index of `needle` in `haystack`, searching from `from`; -1 when absent. */
function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, from: number): number {
  outer: for (let i = from; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

describe.skipIf(!hasAcme())(
  "Specification: balloon reads its sprite in place (ST-C14, ST-C15)",
  () => {
    let built: BuiltBalloon | undefined;

    afterAll(() => built?.cleanup());

    /** Builds once; every case below reads from the same result. */
    async function buildOnce(): Promise<BuiltBalloon> {
      built ??= await buildBalloon();
      expect(built.result.hasErrors).toBe(false);
      return built;
    }

    it("ST-C14: stages nothing, embeds the sprite once, and points the VIC at it", async () => {
      const { result } = await buildOnce();
      const asm = result.asmText!;
      const binary = result.binary!;

      const lines = asm.split("\n").map((line) => line.trim());

      // Nothing is copied into the tape buffer any more. The whole block the
      // program used to stage into must see no store at all. The address is
      // matched with optional leading zeros because the serializer emits the
      // shortest hex that fits — `$340`, not `$0340`.
      for (let addr = 0x0340; addr <= 0x037e; addr++) {
        const hex = addr.toString(16).toUpperCase();
        const store = new RegExp(`^STA \\$0*${hex}$`);
        expect(
          lines.filter((line) => store.test(line)),
          `expected no store to $${hex}`,
        ).toEqual([]);
      }

      // The sprite exists exactly once in the binary. This does NOT prove the
      // copy is gone — the old staging copy happened at runtime, so it never
      // appeared in the PRG either, and this check passed before the rewrite
      // too. The store sweep above is what proves that. What this guards is a
      // second image being BAKED into the file.
      const sprite = new Uint8Array(readFileSync(SPRITE_PATH));
      const first = indexOfBytes(binary, sprite, 0);
      expect(first, "the embedded sprite must appear in the binary").toBeGreaterThanOrEqual(0);
      expect(indexOfBytes(binary, sprite, first + 1)).toBe(-1);

      // The sprite pointer is the image's own 64-byte block number, and the
      // assembler resolves it: the address and the division are both link-time,
      // so the program loads one immediate and stores it. Asserted as an ordered
      // subsequence rather than an exact run, so unrelated code between them
      // does not block it.
      const order = [new RegExp(`^LDA #<\\(${SPRITE_LABEL} / 64\\)$`), /^STA \$0*7F8$/];
      let at = 0;
      for (const want of order) {
        at = lines.findIndex((line, i) => i >= at && want.test(line)) + 1;
        expect(
          at,
          `expected ${want.source} after the preceding step of the pointer store`,
        ).toBeGreaterThan(0);
      }
    });

    it("ST-C15: places the sprite image on a page, inside the VIC's reach", async () => {
      const { result } = await buildOnce();
      const addr = result.symbolMap!.get(SPRITE_LABEL);
      expect(addr, `${SPRITE_LABEL} must resolve`).toBeTypeOf("number");

      // Page-aligned, so the sprite pointer is exactly the high byte times four.
      expect(addr! % 256).toBe(0);

      // Below $1000 keeps it clear of the character-ROM shadow, where the VIC
      // would read ROM instead of the image no matter what the pointer says.
      expect(addr!).toBeLessThan(0x1000);
    });
  },
);
