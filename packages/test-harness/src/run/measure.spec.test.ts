/**
 * Specification tests for `measureCycles` — exact elapsed machine cycles
 * between two labeled program points, read from VICE's stopwatch at both
 * checkpoint stops.
 *
 * The oracle is the raster-IRQ demo program's hand-computed window
 * (transcribed from the committed ACME source + the documented NMOS 6502
 * datasheet timings — no implementation logic consulted):
 *
 *   straight-line sum demo_from..demo_to:
 *     ldy #40                                     2
 *     40 outer iterations:
 *       ldx #0                                    2
 *       inner: 256 × (dex 2 + bne 3/2) = 255*5+4 = 1279
 *       dey                                       2
 *       bne outer          3 taken (×39) / 2 on the final fall-through
 *     = 2 + 39*1286 + 1285                      = 51441
 *   plus 3 raster IRQs × (7-cycle interrupt sequence + 24-cycle handler)
 *     = 3 × 31                                  = 93
 *   expected total                              = 51534
 *
 * Equality to this sum proves the measurement is IRQ-inclusive (a count
 * that excluded interrupt time would read 51441); equality across two
 * fresh emulator processes proves cross-process determinism for a
 * phase-locked window. Local tier: real VICE + ACME, skipped in CI.
 */

import { afterAll, afterEach, describe, expect, it } from "vitest";

import { hasAcme, hasVice, setupEmulator } from "../fixture.js";
import { TimeoutError } from "./strategies.js";
import { measureCycles } from "./measure.js";
import type { EmulatorDriver } from "../emulator/driver.js";
import { assembleIrqDemo, type AssembledIrqDemo } from "../testing/irq-demo.js";

const LOCAL_TEST_TIMEOUT = 120000;
/** Generous guard for one measurement run (autostart + ~2.6 emulated frames). */
const MEASURE_TIMEOUT = 60000;

/** The demo's zero-page frame counter, incremented once per raster IRQ. */
const COUNTER_ADDR = 0x02;
/** The hand-computed window total (see the module comment). */
const EXPECTED_WINDOW_CYCLES = 51441 + 3 * 31;

describe.skipIf(!(hasVice("c64") && hasAcme()))("Specification: measureCycles on the IRQ demo", () => {
  let demo: AssembledIrqDemo | undefined;
  let driver: EmulatorDriver | undefined;

  afterEach(async () => {
    if (driver !== undefined) {
      await driver.shutdown();
      driver = undefined;
    }
  });

  afterAll(() => demo?.cleanup());

  it(
    "should measure the identical IRQ-inclusive hand-computed count across two fresh processes",
    async () => {
      demo = assembleIrqDemo();
      const counts: number[] = [];

      for (let run = 0; run < 2; run++) {
        const env = await setupEmulator({ binary: demo.prgPath });
        driver = env.driver;

        counts.push(
          await measureCycles(driver, env.symbols, "demo_from", "demo_to", MEASURE_TIMEOUT),
        );

        // The raster handler really ran: the frame counter moved.
        const frames = (await driver.readMemory(COUNTER_ADDR, 1))[0];
        expect(frames).toBeGreaterThanOrEqual(1);

        await driver.shutdown();
        driver = undefined;
      }

      // Deterministic across fresh emulator processes, and equal to the
      // hand-computed sum INCLUDING the three interrupts' cycles.
      expect(counts[0]).toBe(counts[1]);
      expect(counts[0]).toBe(EXPECTED_WINDOW_CYCLES);
    },
    LOCAL_TEST_TIMEOUT,
  );

  it(
    "should reject with a timeout when the to-label is never reached",
    async () => {
      demo ??= assembleIrqDemo();
      const env = await setupEmulator({ binary: demo.prgPath });
      driver = env.driver;

      await expect(
        measureCycles(driver, env.symbols, "demo_idle", "demo_unreached", 2000),
      ).rejects.toThrowError(TimeoutError);
    },
    LOCAL_TEST_TIMEOUT,
  );
});
