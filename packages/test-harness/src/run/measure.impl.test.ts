/**
 * Implementation tests for `measureCycles` / `quiesce` internals on real
 * VICE: same-label traversal semantics, checkpoint cleanup on the timeout
 * and wrong-stop error paths (proven behaviorally — a leaked checkpoint
 * aborts a subsequent instruction advance at its first hit), and the exact
 * machine-state writes `quiesce` performs. Local tier, skipped in CI.
 */

import { afterEach, describe, expect, it } from "vitest";

import { hasAcme, hasVice, setupEmulator } from "../fixture.js";
import { ViceDriver } from "../emulator/vice/vice-driver.js";
import { TimeoutError } from "./strategies.js";
import { measureCycles, quiesce } from "./measure.js";
import { assembleIrqDemo, type AssembledIrqDemo } from "../testing/irq-demo.js";

const LOCAL_TEST_TIMEOUT = 120000;
const MEASURE_TIMEOUT = 60000;

/** The VIC-II control register holding the display-enable (DEN) bit. */
const VIC_CONTROL_1 = 0xd011;

describe.skipIf(!(hasVice("c64") && hasAcme()))("Implementation: measureCycles/quiesce on VICE", () => {
  let demo: AssembledIrqDemo | undefined;
  let driver: ViceDriver | undefined;

  afterEach(async () => {
    if (driver !== undefined) {
      await driver.shutdown();
      driver = undefined;
    }
    demo?.cleanup();
    demo = undefined;
  });

  /** Launch the demo and return the driver (narrowed) + symbols. */
  async function launchDemo(): Promise<{ vice: ViceDriver; symbols: Map<string, number> }> {
    demo = assembleIrqDemo();
    const env = await setupEmulator({ binary: demo.prgPath });
    if (!(env.driver instanceof ViceDriver)) {
      throw new Error("expected the c64 platform to provide a ViceDriver");
    }
    driver = env.driver;
    return { vice: env.driver, symbols: env.symbols };
  }

  /** Stop at `label` via a tracked checkpoint that is deleted afterwards. */
  async function stopCleanlyAt(
    vice: ViceDriver,
    symbols: Map<string, number>,
    label: string,
  ): Promise<void> {
    const address = symbols.get(label);
    if (address === undefined) {
      throw new Error(`label '${label}' missing from the demo's label file`);
    }
    const checkpoint = await vice.setCheckpoint(address);
    expect(await vice.resume()).toBe("breakpoint");
    await vice.deleteCheckpoint(checkpoint);
  }

  /**
   * Advance 100 idle-loop instructions and return the elapsed cycles. With no
   * checkpoint armed this is ≥250 cycles (50 nop+jmp traversals); a leaked
   * checkpoint in the loop aborts the advance at its first hit (≤ ~10).
   */
  async function advanceElapsed(vice: ViceDriver): Promise<number> {
    const start = await vice.readStopwatch();
    await vice.advanceInstructions(100);
    const end = await vice.readStopwatch();
    return end - start;
  }

  it(
    "should measure one full traversal for from === to, quiesced to exactness",
    async () => {
      const { vice, symbols } = await launchDemo();
      await stopCleanlyAt(vice, symbols, "demo_idle");
      // Mask interrupts so no raster IRQ can land inside the 5-cycle window.
      await quiesce(vice);
      const cycles = await measureCycles(vice, symbols, "demo_idle", "demo_idle", MEASURE_TIMEOUT);
      // nop (2) + jmp (3): one arrival-to-arrival traversal of the idle loop.
      expect(cycles).toBe(5);
    },
    LOCAL_TEST_TIMEOUT,
  );

  it(
    "should leave no checkpoint armed after a timeout",
    async () => {
      const { vice, symbols } = await launchDemo();
      await expect(
        measureCycles(vice, symbols, "demo_idle", "demo_unreached", 1500),
      ).rejects.toThrowError(TimeoutError);
      // The machine is still running after the timeout; stop it cleanly, then
      // prove the idle-loop path is checkpoint-free.
      await stopCleanlyAt(vice, symbols, "demo_idle");
      expect(await advanceElapsed(vice)).toBeGreaterThanOrEqual(240);
    },
    LOCAL_TEST_TIMEOUT,
  );

  it(
    "should leave no checkpoint armed after a wrong-stop error",
    async () => {
      const { vice, symbols } = await launchDemo();
      // With the from-label unreachable, the first stop lands on the to-label
      // checkpoint instead — a loud wrong-address error (error exit path).
      await expect(
        measureCycles(vice, symbols, "demo_unreached", "demo_idle", MEASURE_TIMEOUT),
      ).rejects.toThrowError(/stopped at PC/);
      // That stop left the machine at demo_idle; the loop must be clean.
      expect(await advanceElapsed(vice)).toBeGreaterThanOrEqual(240);
    },
    LOCAL_TEST_TIMEOUT,
  );

  it(
    "should set the interrupt flag always and clear DEN only when asked",
    async () => {
      const { vice, symbols } = await launchDemo();
      await stopCleanlyAt(vice, symbols, "demo_idle");
      // The demo blanks the display itself; turn it back on so the DEN
      // transitions are observable.
      await vice.writeMemory(VIC_CONTROL_1, Uint8Array.of(0x1b));

      await quiesce(vice);
      expect((await vice.readRegisters()).flags.interrupt).toBe(true);
      expect((await vice.readMemory(VIC_CONTROL_1, 1))[0] & 0x10).toBe(0x10);

      await quiesce(vice, { blankDisplay: true });
      expect((await vice.readMemory(VIC_CONTROL_1, 1))[0] & 0x10).toBe(0);
    },
    LOCAL_TEST_TIMEOUT,
  );
});
