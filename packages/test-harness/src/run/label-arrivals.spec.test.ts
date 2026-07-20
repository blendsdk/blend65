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
 * Oracle: the rasterpoll program, armed on its frame-**body** block. The
 * first arrival there precedes any completed body; at the stopped 2nd
 * arrival exactly one body has run and the screen heartbeat reads 1. The
 * body block is the only program point in that program reached exactly once
 * per frame — the raster poll above it spins once per raster line, and the
 * entry falls straight into the poll with no instruction of its own, so
 * neither can serve as a per-frame landmark.
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
/** The rasterpoll frame-body block — its once-per-frame program point. */
const FRAME_BODY_LABEL = "Main_main_L5";
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

  it(
    "should stop at the 2nd frame-body arrival with one frame body run, then leave no checkpoint armed",
    async () => {
      built = await buildRasterpoll();
      const env = await setupEmulator({ build: built.result, platform: "c64" });
      driver = env.driver;

      // Stop at the entry (1st arrival there). The entry label and the poll
      // block now sit at the same address — the entry emits no instruction of
      // its own — so this suite names the body block directly rather than
      // recovering it from the emitted code. A reverse address→name lookup
      // could no longer distinguish them.
      await runUntilLabelArrivals(driver, env.symbols, "_main", 1);
      expect(env.symbols.get(FRAME_BODY_LABEL)).toBeDefined();

      // From the entry stop: 1st arrival precedes any body, the 2nd follows
      // exactly one body. The machine returns STOPPED at the body block.
      const registers = await runUntilLabelArrivals(driver, env.symbols, FRAME_BODY_LABEL, 2);
      expect(registers.pc).toBe(env.symbols.get(FRAME_BODY_LABEL));
      expect((await driver.readMemory(SCREEN_HEARTBEAT, 1))[0]).toBe(1);

      // The tracked checkpoint is gone: a free run re-crosses the body block
      // repeatedly (heartbeat keeps counting) instead of aborting at the
      // 3rd arrival, which would freeze the heartbeat at 2.
      await driver.advanceInstructions(FREE_RUN_INSTRUCTIONS);
      expect((await driver.readMemory(SCREEN_HEARTBEAT, 1))[0]).toBeGreaterThanOrEqual(3);
    },
    LOCAL_TEST_TIMEOUT,
  );
});
