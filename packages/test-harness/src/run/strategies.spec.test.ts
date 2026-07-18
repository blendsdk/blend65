/**
 * Specification tests for the run strategies.
 *
 * These tests are derived directly from the strategies' documented behavior,
 * not from reading the implementation. The mandatory timeout guard is
 * unit-tested against a FAKE driver in CI; the three strategies are proven
 * against the real gate program on VICE (Local).
 *
 * The gate/strategy integration suite compiles the gate via ACME, so it gates
 * on `skipIf(!hasVice() || !hasAcme())`.
 */

import { afterAll, describe, expect, it } from "vitest";
import { FakeDriver, FakeMeasurementDriver } from "../testing/fake-driver.js";
import { buildGate, type BuiltGate } from "../testing/gate.js";
import { hasAcme, hasVice, setupEmulator } from "../fixture.js";
import {
  runFrames,
  runUntilLabel,
  runUntilLabelArrivals,
  runUntilMemory,
  TimeoutError,
} from "./strategies.js";
import type { EmulatorDriver, Registers } from "../emulator/driver.js";

/** VIC-II border-colour register. */
const BORDER = 0xd020;
/**
 * The read-back byte at $D020 after `poke(0xD020, 5)`. The VIC-II border register
 * has only 4 usable bits; its unused upper nibble reads back as 1s, so the byte is
 * 0xF5 (colour 5 in the low nibble), NOT 0x05 — pinned live against real VICE 3.10.
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

describe("Specification: runUntilLabelArrivals checkpoint lifecycle against a fake driver", () => {
  /** The armed loop-head address every case resolves through `symbols`. */
  const LOOP_HEAD = 0x0810;
  const symbols = new Map<string, number>([["loop", LOOP_HEAD]]);

  /** A register file whose PC sits at the armed address, as a clean stop reports. */
  function stoppedAtLoopHead(): Registers {
    return {
      a: 0,
      x: 0,
      y: 0,
      sp: 0,
      pc: LOOP_HEAD,
      flags: {
        carry: false,
        zero: false,
        interrupt: false,
        decimal: false,
        break_: false,
        overflow: false,
        negative: false,
      },
    };
  }

  it("should set one checkpoint, resume once per arrival, and delete the checkpoint on success", async () => {
    const driver = new FakeMeasurementDriver({ registers: stoppedAtLoopHead() });
    const registers = await runUntilLabelArrivals(driver, symbols, "loop", 3);
    expect(registers.pc).toBe(LOOP_HEAD);
    expect(driver.checkpointsSet).toEqual([LOOP_HEAD]);
    expect(driver.resumeCalls).toBe(3);
    expect(driver.checkpointsDeleted).toEqual([1]);
  });

  it("should still delete the checkpoint exactly once when the run times out", async () => {
    const driver = new FakeMeasurementDriver({ resume: "hang" });
    await expect(runUntilLabelArrivals(driver, symbols, "loop", 2, 50)).rejects.toBeInstanceOf(
      TimeoutError,
    );
    expect(driver.checkpointsSet).toEqual([LOOP_HEAD]);
    expect(driver.checkpointsDeleted).toEqual([1]);
  });

  it("should still delete the checkpoint exactly once when a resume stops for the wrong reason", async () => {
    const driver = new FakeMeasurementDriver({ resume: "exit" });
    await expect(runUntilLabelArrivals(driver, symbols, "loop", 2, 50)).rejects.toThrow(
      /resumed to 'exit'/,
    );
    expect(driver.checkpointsSet).toEqual([LOOP_HEAD]);
    expect(driver.checkpointsDeleted).toEqual([1]);
  });

  it("should reject an unknown label naming sample keys, before any checkpoint is set", () => {
    const driver = new FakeMeasurementDriver();
    expect(() => runUntilLabelArrivals(driver, symbols, "nope", 2)).toThrow(
      /'nope'.*Available: loop/,
    );
    expect(driver.checkpointsSet).toEqual([]);
  });

  it("should reject a driver without the measurement capabilities, naming the caller", () => {
    const driver = new FakeDriver();
    expect(() => runUntilLabelArrivals(driver, symbols, "loop", 2)).toThrow(
      /runUntilLabelArrivals.*cycle-measurement/,
    );
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
      // Relaunch a clean session for the label sync (a fresh relaunch per binary).
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
