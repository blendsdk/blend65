/**
 * Specification test for the MVP gate program on real VICE (ST-29, AR-H9/AR-43/44).
 *
 * Derived EXCLUSIVELY from RD-12 AR-H9 and the gate program (`examples/gate/main.blend`)
 * — never from reading the implementation (IMMUTABLE ORACLE RULE). Proves a real
 * Blend65 program compiled through ACME pokes the VIC-II border register on real
 * VICE — the whole point of RD-12 (C5 runtime verification).
 *
 * The suite compiles via ACME AND runs on VICE, so it gates on
 * `skipIf(!hasVice() || !hasAcme())` (PF-002). Register/memory are the assertion
 * surface (AR-25).
 */

import { afterAll, describe, expect, it } from "vitest";
import { buildGate, type BuiltGate } from "./testing/gate.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import { assertMemory, runUntilLabel, runUntilMemory } from "./index.js";
import type { EmulatorDriver } from "./emulator/driver.js";

const BORDER = 0xd020;
/** $D020 read-back after `poke(0xD020, 5)` — VIC-II unused upper nibble reads 1s (AR-H19). */
const BORDER_READBACK = 0xf5;
/** `_main`'s first opcode is `LDA #$05` = $A9 (symbolic assertMemory proof). */
const LDA_IMM = 0xa9;
const LOCAL_TEST_TIMEOUT = 30000;

describe.skipIf(!(hasVice("c64") && hasAcme()))("Specification: gate program on VICE (ST-29)", () => {
  let gate: BuiltGate | undefined;
  let driver: EmulatorDriver | undefined;

  afterAll(async () => {
    if (driver !== undefined) await driver.shutdown();
    gate?.cleanup();
  });

  it(
    "ST-29: pokes $D020 (border→5) and exposes _main symbolically on real VICE",
    async () => {
      gate = await buildGate();
      const env = await setupEmulator({ build: gate.result, platform: "c64" });
      driver = env.driver;

      // Primary proof (AR-H9): run until the border register holds the poked colour.
      await runUntilMemory(driver, BORDER, BORDER_READBACK);
      await assertMemory(driver, BORDER, BORDER_READBACK); // numeric (AC-08)
      // Symbolic path (AC-08): _main's first opcode is LDA #$05 = $A9.
      await assertMemory(driver, "_main", LDA_IMM, env.symbols);

      // Exercise the label breakpoint strategy on a fresh session (AC-03).
      await driver.shutdown();
      const env2 = await setupEmulator({ build: gate.result, platform: "c64" });
      driver = env2.driver;
      const regs = await runUntilLabel(driver, env2.symbols, "_main");
      expect(regs.pc).toBe(env2.symbols.get("_main"));
    },
    LOCAL_TEST_TIMEOUT,
  );
});
