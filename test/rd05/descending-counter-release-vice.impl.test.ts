import path from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { withProfileProject } from "./profile-fixture.js";

const PROFILE = "c64-pal-prg-kernal-6581";
const OPTIMIZATIONS = ["none", "balanced", "speed", "size"] as const;

/** Cooperative return address the startup stub hands control back to. */
const RETURN_PC = 0xe147;
/** Pinned entry so the emulator can stop at a known address before main runs. */
const ENTRY_PC = 0x2000;
/** Pinned home of the published iteration count, in plain RAM. */
const RESULT_ADDRESS = 0xc000;

/**
 * A countdown whose published value is its own trip count.
 *
 * The loop runs from one thousand down to zero stepping by one, and the body adds one to a
 * separate accumulator, so the accumulator ends at exactly one thousand if and only if the loop
 * ran exactly one thousand times.
 *
 * That makes the usual failures of a two-byte decrement visible rather than merely possible. A
 * high byte that never borrows leaves the counter stuck above zero and the loop runs for ever,
 * which the emulator reports as a timeout rather than a wrong number. A high byte that borrows on
 * every step sends the counter below zero almost at once and the loop ends early, publishing far
 * too small a count. An off-by-one at the exit test publishes 999 or 1001. Only a correct borrow
 * chain and a correct exit publishes 1000, which is $03E8 — a value needing both bytes, so the
 * high byte is checked as well as the low one.
 */
const SOURCE = `module Game;
place(at: $C000) let iterations: word;
place(at: $2000) function main(): void {
  let count: word = 0;
  for (let i: word = 1000; i > 0; i -= 1) { count = count + 1; }
  iterations = count;
}
`;

describe.sequential("a released descending counter in native VICE", () => {
  for (const optimization of OPTIMIZATIONS) {
    it(`counts down exactly once per iteration at optimization ${optimization}`, async () => {
      await withProfileProject(SOURCE, PROFILE, async (project) => {
        const built = await buildProject({ project, optimization });
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        const started = await startVice(
          path.join(built.generation.directory, built.generation.primaryArtifact),
          80_000_000,
          PROFILE,
        );
        if ("kind" in started) throw new Error(`VICE is required: ${started.reason}`);
        const monitor = started.monitor;
        const checkpoints: number[] = [];
        try {
          checkpoints.push(await monitor.setExecuteCheckpoint(ENTRY_PC));
          checkpoints.push(await monitor.setExecuteCheckpoint(RETURN_PC));
          // The monitor has to be listening before execution reaches each stop.
          let stopped = monitor.waitForStop(30_000);
          await monitor.resume();
          expect(await stopped).toBe(ENTRY_PC);
          stopped = monitor.waitForStop(30_000);
          await monitor.resume();
          expect(await stopped).toBe(RETURN_PC);

          // One thousand is $03E8: both bytes carry information, so neither half can be wrong.
          expect([...(await monitor.readMemory(RESULT_ADDRESS, RESULT_ADDRESS + 1))]).toEqual([
            0xe8, 0x03,
          ]);
        } finally {
          try {
            for (const checkpoint of checkpoints) await monitor.deleteCheckpoint(checkpoint);
          } finally {
            await stopVice(started);
          }
        }
      });
    }, 180_000);
  }
});
