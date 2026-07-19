/**
 * Specification test for the guards program on real VICE, consuming the
 * program's shared observable set — the same table the twin tier runs
 * against the hand-written twin.
 *
 * The four branch hazards in the update body each settle into their own
 * screen-RAM cell, so this suite is the behavioral record of what the
 * program's guards decide. It is deliberately blind to how those guards are
 * compiled: the values below must survive any change to the branch idiom,
 * which is exactly what makes it a before/after witness.
 *
 * The frame-loop head is the generated `Main_main_L0` (the label the
 * program's entry jumps to), resolved through the build's symbol map — the
 * run strategy fails loudly if the emitted labels ever change shape.
 *
 * The suite compiles via ACME AND runs on VICE, so it gates on
 * `skipIf(!hasVice() || !hasAcme())`.
 */

import { afterAll, describe, it } from "vitest";
import { buildGuards, GUARDS_OBSERVABLES, type BuiltGuards } from "./testing/guards.js";
import { assertObservables } from "./testing/observables.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import type { EmulatorDriver } from "./emulator/driver.js";

/** The generated frame-loop-head label (the entry's jump target). */
const LOOP_HEAD_LABEL = "Main_main_L0";
const LOCAL_TEST_TIMEOUT = 60000;

describe.skipIf(!(hasVice("c64") && hasAcme()))("Specification: guards on VICE", () => {
  let built: BuiltGuards | undefined;
  let driver: EmulatorDriver | undefined;

  afterAll(async () => {
    if (driver !== undefined) await driver.shutdown();
    built?.cleanup();
  });

  it(
    "lands the shared observable set at the stopped 2nd loop-head arrival",
    async () => {
      built = await buildGuards();
      const env = await setupEmulator({ build: built.result, platform: "c64" });
      driver = env.driver;

      await assertObservables(driver, GUARDS_OBSERVABLES, {
        symbols: env.symbols,
        loopHeadLabel: LOOP_HEAD_LABEL,
        timeout: LOCAL_TEST_TIMEOUT,
      });
    },
    LOCAL_TEST_TIMEOUT,
  );
});
