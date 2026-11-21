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
 * A two-byte position walked down past a borrow and then back up past the matching carry.
 *
 * Both directions use the conditional-arm shape the step selection serves, which is also the
 * ordinary idiom this exists for. Starting at three hundred, the first three hundred iterations
 * step down to zero and the next three hundred step back up, so the low byte borrows exactly once
 * going down and carries exactly once coming back, and the published word must be three hundred
 * again.
 *
 * The arithmetic makes every plausible defect visible rather than merely possible. A high byte that
 * never borrows leaves the descent at two hundred and fifty-six instead of zero and the final word
 * at five hundred and fifty-six; a high byte that borrows on every step underflows immediately; and
 * the two decrements taken in the wrong order would borrow on each step rather than one in two
 * hundred and fifty-six. None of those can publish three hundred.
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
  while (n < 600) {
    if (n < 300) { i = i - 1; } else { i = i + 1; }
    n = n + 1;
  }
  result = i;
}
`;

describe.sequential("a unit-decremented word position in native VICE", () => {
  for (const optimization of OPTIMIZATIONS) {
    it(`borrows once across the low byte at optimization ${optimization}`, async () => {
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
          // of one borrow and one carry.
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
