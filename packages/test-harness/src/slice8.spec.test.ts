/**
 * Specification tests for the Slice 8 acceptance bar: the raw-vector
 * raster-interrupt fixture assembles clean through real ACME (the handler
 * labels, the zeropage equate, and the interrupt pools all resolve), and on
 * real VICE the interrupt actually fires: the zeropage frame counter
 * saturates at 100 (the counter is saturating precisely so this settles
 * deterministically — an equality wait on a still-moving counter could skip
 * values), the mainline loop's RAM mirror settles at the same value (the
 * main loop and the handler genuinely interleave), and the border color has
 * moved off the boot color (each interrupt bumped it until saturation, so
 * it ends at (boot + 100) mod 16). The observable addresses are read from
 * the emitted source's own equates — never hardcoded.
 *
 * These tests are derived from the fixture's documented behavior, not from
 * reading the implementation. The assemble-clean suite compiles via ACME
 * (`skipIf(!hasAcme())`); the runtime suite additionally runs on VICE
 * (`skipIf(!(hasVice && hasAcme))`, skipped in CI — the golden tier guards
 * there).
 */

import { afterAll, describe, expect, it } from "vitest";
import { buildSlice8, emitAsmSlice8, type BuiltSlice8 } from "./testing/slice8.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import { assertMemory, runUntilMemory } from "./index.js";
import type { EmulatorDriver } from "./emulator/driver.js";

/** The saturation threshold the fixture's counter sticks at. */
const SATURATION = 100;
/** The VIC-II boot border color (light blue) on a stock c64. */
const BOOT_BORDER = 14;
const LOCAL_TEST_TIMEOUT = 120000;

/** Reads a symbol's equated address out of the emitted ACME source. */
function equateOf(text: string, symbol: string): number {
  const match = text.match(new RegExp(`${symbol} = \\$([0-9A-F]+)`));
  expect(match, `equate for ${symbol}`).not.toBeNull();
  return Number.parseInt(match![1]!, 16);
}

describe.skipIf(!hasAcme())("Specification: Slice 8 assemble-clean (ST-39)", () => {
  let built: BuiltSlice8 | undefined;

  afterAll(() => built?.cleanup());

  it("compiles the raster-interrupt fixture to a loadable c64 PRG (all hardware symbols resolve)", async () => {
    built = await buildSlice8();
    expect(built.result.hasErrors).toBe(false);
    expect(built.result.binary).toBeInstanceOf(Uint8Array);
  });
});

describe.skipIf(!(hasVice("c64") && hasAcme()))("Specification: Slice 8 on VICE (ST-41, ST-42)", () => {
  let built: BuiltSlice8 | undefined;
  let driver: EmulatorDriver | undefined;

  afterAll(async () => {
    if (driver !== undefined) await driver.shutdown();
    built?.cleanup();
  });

  it(
    "fires the raster interrupt: the ZP counter and its RAM mirror saturate, the border moved",
    async () => {
      const asm = emitAsmSlice8().text!;
      const counterAddr = equateOf(asm, "__zp_Main_frameCount");
      const mirrorAddr = equateOf(asm, "__var_Main_mirror");

      built = await buildSlice8();
      const env = await setupEmulator({ build: built.result, platform: "c64" });
      driver = env.driver;

      // The counter saturates, so waiting for equality is deterministic —
      // once it reaches 100 it never moves again.
      await runUntilMemory(driver, counterAddr, SATURATION, LOCAL_TEST_TIMEOUT);
      await assertMemory(driver, counterAddr, SATURATION);
      // The mainline loop mirrors the settled counter — main and the
      // handler really interleaved.
      await runUntilMemory(driver, mirrorAddr, SATURATION, LOCAL_TEST_TIMEOUT);
      // The border moved off the boot color (100 bumps → (boot+100) mod 16;
      // VIC unconnected bits read back 1, so mask to the color nybble).
      const border = (await driver.readMemory(0xd020, 1))[0]! & 0x0f;
      expect(border).not.toBe(BOOT_BORDER);
    },
    LOCAL_TEST_TIMEOUT,
  );
});
