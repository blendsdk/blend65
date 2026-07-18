/**
 * Live-VICE specification for `runUntilLabelArrivals` — the stopped-machine
 * Nth-arrival strategy the shared observables runner builds on.
 *
 * This probe pins the semantics the strategy's whole design rests on:
 * resuming from a stop AT the armed address fires on the NEXT arrival, so
 * one tracked checkpoint plus n resumes stops exactly at the n-th arrival.
 * No other test exercises same-address re-arrival on real VICE, so this
 * spec must exist (and pass) before any suite depends on the strategy.
 *
 * Oracle: the rasterpoll program. Its entry jumps straight to the frame
 * loop head, so the first arrival precedes any frame body; at the stopped
 * 2nd arrival exactly one body has run and the screen heartbeat reads 1.
 * Local tier: real VICE + ACME, skipped in CI.
 */

import { afterEach, describe, expect, it } from "vitest";

import { hasAcme, hasVice, setupEmulator } from "../fixture.js";
import { buildRasterpoll, type BuiltRasterpoll } from "../testing/rasterpoll.js";
import { runUntilLabelArrivals } from "./strategies.js";
import type { EmulatorDriver } from "../emulator/driver.js";

const LOCAL_TEST_TIMEOUT = 60000;

/** The rasterpoll heartbeat cell: the frame counter poked to screen RAM. */
const SCREEN_HEARTBEAT = 0x0400;
/** JMP absolute — the opcode the program's entry uses to enter its frame loop. */
const JMP_ABSOLUTE = 0x4c;
/**
 * Instructions to advance while proving no checkpoint stayed armed: ~4-5
 * PAL frames' worth, so the loop head is re-crossed several times.
 */
const FREE_RUN_INSTRUCTIONS = 30000;

describe.skipIf(!(hasVice("c64") && hasAcme()))("Specification: runUntilLabelArrivals on the rasterpoll program", () => {
  let built: BuiltRasterpoll | undefined;
  let driver: EmulatorDriver | undefined;

  afterEach(async () => {
    if (driver !== undefined) {
      await driver.shutdown();
      driver = undefined;
    }
    built?.cleanup();
    built = undefined;
  });

  /**
   * Resolve the frame-loop head from the build itself: the entry label's
   * instruction is a JMP whose target IS the loop head. Deriving the label
   * from the emitted code keeps this suite honest across label renames.
   */
  async function resolveLoopHead(
    activeDriver: EmulatorDriver,
    symbols: Map<string, number>,
  ): Promise<string> {
    const entry = symbols.get("_main");
    expect(entry).toBeDefined();
    const bytes = await activeDriver.readMemory(entry!, 3);
    expect(bytes[0]).toBe(JMP_ABSOLUTE);
    const target = bytes[1] | (bytes[2] << 8);
    for (const [name, address] of symbols) {
      if (address === target && name !== "_main") {
        return name;
      }
    }
    throw new Error(`no symbol maps to the entry's JMP target $${target.toString(16)}`);
  }

  it(
    "should stop at the 2nd loop-head arrival with one frame body run, then leave no checkpoint armed",
    async () => {
      built = await buildRasterpoll();
      const env = await setupEmulator({ build: built.result, platform: "c64" });
      driver = env.driver;

      // Stop at the entry (1st arrival there), then derive the loop head.
      await runUntilLabelArrivals(driver, env.symbols, "_main", 1);
      const loopHead = await resolveLoopHead(driver, env.symbols);

      // From the entry stop: 1st arrival precedes any body, the 2nd follows
      // exactly one body. The machine returns STOPPED at the loop head.
      const registers = await runUntilLabelArrivals(driver, env.symbols, loopHead, 2);
      expect(registers.pc).toBe(env.symbols.get(loopHead));
      expect((await driver.readMemory(SCREEN_HEARTBEAT, 1))[0]).toBe(1);

      // The tracked checkpoint is gone: a free run re-crosses the loop head
      // repeatedly (heartbeat keeps counting) instead of aborting at the
      // 3rd arrival, which would freeze the heartbeat at 2.
      await driver.advanceInstructions(FREE_RUN_INSTRUCTIONS);
      expect((await driver.readMemory(SCREEN_HEARTBEAT, 1))[0]).toBeGreaterThanOrEqual(3);
    },
    LOCAL_TEST_TIMEOUT,
  );
});
