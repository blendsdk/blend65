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
/** Pinned home of the published result, in plain RAM. */
const RESULT_ADDRESS = 0xc000;

/**
 * A two-byte position walked by three, down across a borrow and back up across the carry.
 *
 * Three is deliberately not a power of two and does not divide the page, so the crossing does not
 * land on the boundary: going down from three hundred the low byte passes from two to two hundred
 * and fifty-five, and coming back up it passes the other way. Both crossings therefore exercise the
 * conditional high-byte step on a partial borrow rather than an exact one.
 *
 * A hundred steps each way returns the position to three hundred exactly. A high byte that never
 * moves leaves the descent at two hundred and fifty-six and publishes five hundred and fifty-six; a
 * branch taken in the wrong sense moves the high byte on almost every step instead of one in a
 * page, which overshoots immediately. Neither can publish three hundred.
 *
 * The result goes to plain RAM rather than a register, because the startup stub restores the bank
 * configuration it captured before handing control back, which can leave the register window
 * hidden at the return address this reads from.
 */
const walk = `module Game;
place(at: $C000) let result: word;
place(at: $2000) function main(): void {
  let i: word = 300;
  let n: word = 0;
  while (n < 200) {
    if (n < 100) { i = i - 3; } else { i = i + 3; }
    n = n + 1;
  }
  result = i;
}
`;

describe.sequential("a constant-stepped word position in native VICE", () => {
  for (const optimization of OPTIMIZATIONS) {
    it(`carries the high byte once in each direction at optimization ${optimization}`, async () => {
      await withProfileProject(walk, PROFILE, async (project) => {
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

          // Three hundred is $012C: the low byte proves the count, the high byte the matched pair
          // of one borrow and one carry taken in the right sense.
          expect([...(await monitor.readMemory(RESULT_ADDRESS, RESULT_ADDRESS + 1))]).toEqual([
            0x2c, 0x01,
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
