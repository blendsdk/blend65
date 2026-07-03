/**
 * Implementation tests for the run strategies — the timeout guard's halting
 * behaviour and per-call custom timeouts (R24). Written AFTER the strategies;
 * these run in CI against the fake driver (no emulator).
 */

import { describe, expect, it } from "vitest";
import { FakeDriver } from "../testing/fake-driver.js";
import { runFrames, runUntilLabel, runUntilMemory, TimeoutError } from "./strategies.js";

/** A short sleep for the "loop halted" observation. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("timeout guard — custom per-call timeout (R24)", () => {
  it("honours a short per-call timeout instead of the 5s default", async () => {
    const driver = new FakeDriver({ resume: "hang" });
    const symbols = new Map<string, number>([["_main", 0x0819]]);
    const start = Date.now();
    await expect(runUntilLabel(driver, symbols, "_main", 30)).rejects.toBeInstanceOf(TimeoutError);
    // Well under the 5s default — proves the per-call override took effect.
    expect(Date.now() - start).toBeLessThan(500);
  });

  it("the TimeoutError message reports the elapsed budget", async () => {
    const driver = new FakeDriver({ advance: "hang" });
    await expect(runFrames(driver, 4, 25)).rejects.toThrow(/25ms/);
  });
});

describe("timeout guard — halts the polling loop (no runaway work)", () => {
  it("runUntilMemory stops advancing the driver once it has timed out", async () => {
    const driver = new FakeDriver(); // never matches → polls until the deadline
    await expect(runUntilMemory(driver, 0xd020, 5, 40)).rejects.toBeInstanceOf(TimeoutError);
    const callsAtTimeout = driver.advanceCalls;
    // The deadline-bounded loop self-terminates: no further advances after rejection.
    await delay(80);
    expect(driver.advanceCalls).toBe(callsAtTimeout);
  });
});

describe("runUntilLabel — unknown label guard (DEF-2 class)", () => {
  it("throws a helpful error listing available keys before any driver call", () => {
    const driver = new FakeDriver();
    const symbols = new Map<string, number>([["_main", 0x0819], ["__startup", 0x080d]]);
    expect(() => runUntilLabel(driver, symbols, "_missing", 50)).toThrow(/_missing/);
    expect(() => runUntilLabel(driver, symbols, "_missing", 50)).toThrow(/_main/);
    // No breakpoint was set — the guard fired before touching the driver.
    expect(driver.breakpoints).toHaveLength(0);
  });
});
