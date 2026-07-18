/**
 * Specification tests for `advanceInstructions` completion semantics.
 *
 * VICE answers ADVANCE_INSTRUCTIONS with its response frame immediately and
 * performs the stepping asynchronously; any follow-up command aborts the
 * stepping. The driver must therefore treat the stepping as complete only
 * when the machine has actually re-stopped — a follow-up command issued
 * immediately after the returned promise resolves must never cut the
 * advance short.
 *
 * Proven on the raster-IRQ demo program: its interrupt handler counts
 * frames, so a 30000-instruction advance (~3.8 PAL frames in the demo's
 * 5-cycle idle loop) must raise the frame counter by at least 3. Local
 * tier: real VICE + real ACME (`skipIf`), skipped in CI by design.
 */

import { afterAll, describe, expect, it } from "vitest";

import { hasAcme, hasVice, setupEmulator } from "../../fixture.js";
import { assembleIrqDemo, type AssembledIrqDemo } from "../../testing/irq-demo.js";
import { ViceDriver } from "./vice-driver.js";
import type { EmulatorDriver } from "../driver.js";

const LOCAL_TEST_TIMEOUT = 120000;

/** The demo's zero-page frame counter, incremented once per raster IRQ. */
const COUNTER_ADDR = 0x02;

describe.skipIf(!(hasVice("c64") && hasAcme()))("Specification: advanceInstructions completion", () => {
  let demo: AssembledIrqDemo | undefined;
  let driver: EmulatorDriver | undefined;

  afterAll(async () => {
    if (driver !== undefined) await driver.shutdown();
    demo?.cleanup();
  });

  it(
    "should have executed every instruction when a follow-up command arrives immediately",
    async () => {
      demo = assembleIrqDemo();
      const env = await setupEmulator({ binary: demo.prgPath });
      driver = env.driver;
      if (!(driver instanceof ViceDriver)) {
        throw new Error("expected the c64 platform to provide a ViceDriver");
      }

      // Stop in the idle loop, where the raster IRQ ticks the frame counter —
      // and DELETE the stop's checkpoint before stepping: an armed checkpoint
      // in the stepped path aborts an advance at its first hit, which is not
      // what this test measures.
      const idleAddress = env.symbols.get("demo_idle");
      if (idleAddress === undefined) {
        throw new Error("demo_idle is missing from the demo's label file");
      }
      const checkpoint = await driver.setCheckpoint(idleAddress);
      expect(await driver.resume()).toBe("breakpoint");
      await driver.deleteCheckpoint(checkpoint);

      const before = (await driver.readMemory(COUNTER_ADDR, 1))[0];

      // 30000 idle-loop instructions ≈ 75000 cycles ≈ 3.8 PAL frames. The
      // immediate register read must not abort the stepping.
      await driver.advanceInstructions(30000);
      await driver.readRegisters();

      const after = (await driver.readMemory(COUNTER_ADDR, 1))[0];
      expect((after - before) & 0xff).toBeGreaterThanOrEqual(3);
    },
    LOCAL_TEST_TIMEOUT,
  );
});
