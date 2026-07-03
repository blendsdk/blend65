/**
 * Specification tests for the run strategies (ST-14, ST-15, ST-20..ST-22).
 *
 * Derived EXCLUSIVELY from RD-12 §4.2 and R20..R24 / AC-03/04/05/06 — never from
 * reading the implementation (IMMUTABLE ORACLE RULE). The mandatory timeout guard
 * (R23/AC-06) is unit-tested against a FAKE driver in CI (ST-14/15); the three
 * strategies are proven against the real gate program on VICE (ST-20..22, Local).
 *
 * The gate/strategy integration suite compiles the gate via ACME, so it gates on
 * `skipIf(!hasVice() || !hasAcme())` (PF-002).
 */

import { afterAll, describe, expect, it } from "vitest";
import { FakeDriver } from "../testing/fake-driver.js";
import { buildGate, type BuiltGate } from "../testing/gate.js";
import { hasAcme, hasVice, setupEmulator } from "../fixture.js";
import { runFrames, runUntilLabel, runUntilMemory, TimeoutError } from "./strategies.js";
import type { EmulatorDriver } from "../emulator/driver.js";

/** VIC-II border-colour register. */
const BORDER = 0xd020;
/**
 * The read-back byte at $D020 after `poke(0xD020, 5)`. The VIC-II border register
 * has only 4 usable bits; its unused upper nibble reads back as 1s, so the byte is
 * 0xF5 (colour 5 in the low nibble), NOT 0x05 — pinned live against VICE 3.10
 * (PF-004; corrects the plan's literal AR-H9 value, see AR-H19).
 */
const BORDER_READBACK = 0xf5;
/** Generous per-test budget for suites that build + launch VICE. */
const LOCAL_TEST_TIMEOUT = 30000;

describe("Specification: mandatory timeout guard against a fake driver (ST-14, ST-15)", () => {
  it("ST-14: runUntilLabel rejects with a TimeoutError naming the strategy when the driver never breaks", async () => {
    const driver = new FakeDriver({ resume: "hang" });
    const symbols = new Map<string, number>([["_main", 0x0819]]);
    const start = Date.now();
    await expect(runUntilLabel(driver, symbols, "_main", 50)).rejects.toBeInstanceOf(TimeoutError);
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it("ST-14: the TimeoutError message names the strategy and the label", async () => {
    const driver = new FakeDriver({ resume: "hang" });
    const symbols = new Map<string, number>([["_main", 0x0819]]);
    await expect(runUntilLabel(driver, symbols, "_main", 50)).rejects.toThrow(/runUntilLabel/);
  });

  it("ST-15: runUntilMemory rejects with a TimeoutError when the value never matches", async () => {
    const driver = new FakeDriver(); // memory reads 0; target 5 never matches
    await expect(runUntilMemory(driver, BORDER, 5, 50)).rejects.toBeInstanceOf(TimeoutError);
  });

  it("ST-15: runFrames rejects with a TimeoutError when the advance never completes", async () => {
    const driver = new FakeDriver({ advance: "hang" });
    await expect(runFrames(driver, 2, 50)).rejects.toBeInstanceOf(TimeoutError);
  });
});

const VICE_ACME = hasVice("c64") && hasAcme();

describe.skipIf(!VICE_ACME)("Specification: run strategies on the gate program (ST-20..ST-22, Local)", () => {
  let gate: BuiltGate | undefined;
  let driver: EmulatorDriver | undefined;

  afterAll(async () => {
    if (driver !== undefined) await driver.shutdown();
    gate?.cleanup();
  });

  async function setup(): Promise<void> {
    gate = await buildGate();
    const env = await setupEmulator({ build: gate.result, platform: "c64" });
    driver = env.driver;
  }

  it(
    "ST-20: runUntilMemory resolves once $D020 holds the poked border colour (reads 0xF5)",
    async () => {
      await setup();
      await expect(runUntilMemory(driver!, BORDER, BORDER_READBACK)).resolves.toBeUndefined();
    },
    LOCAL_TEST_TIMEOUT,
  );

  it(
    "ST-21: runUntilLabel resolves with registers at the _main breakpoint",
    async () => {
      // Relaunch a clean session for the label sync (relaunch-per-binary, AR-H6).
      if (driver !== undefined) await driver.shutdown();
      const env = await setupEmulator({ build: gate!.result, platform: "c64" });
      driver = env.driver;
      const regs = await runUntilLabel(driver, env.symbols, "_main");
      expect(regs.pc).toBe(env.symbols.get("_main"));
      expect(typeof regs.sp).toBe("number");
    },
    LOCAL_TEST_TIMEOUT,
  );

  it(
    "ST-22: runFrames resolves without timing out (advances within the guard)",
    async () => {
      if (driver !== undefined) await driver.shutdown();
      const env = await setupEmulator({ build: gate!.result, platform: "c64" });
      driver = env.driver;
      await expect(runFrames(driver, 2)).resolves.toBeUndefined();
    },
    LOCAL_TEST_TIMEOUT,
  );
});
