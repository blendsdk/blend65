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
 * A two-byte counter advanced past the point where its low byte wraps.
 *
 * Three hundred iterations is the shape that makes the increment selection falsifiable. The low
 * byte wraps once, at the step from `$00FF` to `$0100`, so the high byte must be incremented on
 * exactly that iteration and on no other. A carry that never fires leaves the counter trapped
 * below two hundred and fifty-six, where the exit test can never be satisfied; a carry that fires
 * every time overshoots immediately. Either way the published word differs, and a loop that fails
 * to terminate at all is caught by the emulator's cycle limit rather than by an assertion.
 *
 * The result is published to plain RAM rather than a register, because the startup stub restores
 * the bank configuration it captured before handing control back, which can leave the register
 * window hidden at the return address this reads from.
 */
const crossing = `module Game;
place(at: $C000) let result: word;
place(at: $2000) function main(): void {
  let i: word = 0;
  while (i < 300) { i = i + 1; }
  result = i;
}
`;

describe.sequential("a unit-incremented word counter in native VICE", () => {
  for (const optimization of OPTIMIZATIONS) {
    it(`carries once across the low byte at optimization ${optimization}`, async () => {
      await withProfileProject(crossing, PROFILE, async (project) => {
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

          // Three hundred is $012C: the low byte proves the count, the high byte the single carry.
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
