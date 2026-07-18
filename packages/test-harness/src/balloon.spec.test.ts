/**
 * Specification test for the balloon demo on real VICE, consuming the
 * program's shared observable set — the same table the twin tier runs
 * against the hand-written twin.
 *
 * At the stopped 2nd arrival of the frame-loop head exactly one movement
 * update has run under the source's ±2-step / `>=`-`<=` bounce semantics:
 * the sprite sits at (174, 141), its image block matches the committed
 * asset byte-for-byte, and every sprite register holds its source-mandated
 * value. The loop head is the generated `Main_main_L0` (the label the
 * post-init code jumps to), resolved through the build's symbol map.
 *
 * The suite compiles via ACME AND runs on VICE, so it gates on
 * `skipIf(!hasVice() || !hasAcme())`.
 */

import { afterAll, describe, it } from "vitest";
import { BALLOON_OBSERVABLES, buildBalloon, type BuiltBalloon } from "./testing/balloon.js";
import { assertObservables } from "./testing/observables.js";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import type { EmulatorDriver } from "./emulator/driver.js";

/** The generated frame-loop-head label (the post-init jump target). */
const LOOP_HEAD_LABEL = "Main_main_L0";
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
});
