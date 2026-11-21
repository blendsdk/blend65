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
 * A counted loop whose exit test compares against a literal above the counter-narrowing range.
 *
 * Such a counter keeps its declared word home either way, so whole-word assignment forwarding
 * computes its advance directly into that home instead of through a scratch. The accumulator makes
 * the trip count observable: a hundred iterations of three is three hundred, which also carries out
 * of the low byte, so a broken carry chain or a miscounted loop both show up in the published pair.
 *
 * The result is published to plain RAM rather than a register, because the startup stub restores
 * the bank configuration it captured before handing control back, which can leave the register
 * window hidden at the return address this reads from.
 */
const releasedCounter = `module Game;
place(at: $C000) let result: word;
place(at: $2000) function main(): void {
  let acc: word = 0;
  for (let i: word = 0; i < 100; i += 1) { acc = acc + 3; }
  result = acc;
}
`;

describe.sequential("a released loop counter in native VICE", () => {
  for (const optimization of OPTIMIZATIONS) {
    it(`counts exactly one hundred times and carries, at optimization ${optimization}`, async () => {
      await withProfileProject(releasedCounter, PROFILE, async (project) => {
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

          // Three hundred is $012C, so the high byte proves the carry and the low byte the count.
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
