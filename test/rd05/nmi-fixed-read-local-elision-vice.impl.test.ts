import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import {
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

const PROFILE = "c64-pal-prg-kernal-6581" as const;

/** Where the handler publishes the byte it carried through the accumulator. */
const PUBLISHED = 0xc001;
/** Where mainline seeds that byte, at runtime, so the handler cannot fold it. */
const SEED_ADDRESS = 0xc010;
/** A value with no zero or high-bit symmetry, so a wrong register or a dropped read is visible. */
const SEED = 0x5a;
/** Cooperative return address the startup stub hands control back to. */
const RETURN_PC = 0xe147;

/**
 * A handler whose only local is read from a fixed address and written straight out.
 *
 * This is the shape the register-only rule admits: the byte arrives in the accumulator from one
 * load and leaves through one store, so the local needs no memory. Proving it on real hardware
 * matters because the rule's whole claim is about the accumulator staying live across the gap,
 * which no amount of inspecting the memory map can confirm.
 *
 * The published byte is seeded by mainline at runtime rather than written as a literal, so it
 * cannot be constant-folded into the handler. A dropped read publishes zero, a read left in the
 * wrong register publishes whatever that register happened to hold, and a read moved after the
 * store publishes the uninitialized byte — none of which is the seed.
 */
const SOURCE = `module Game;
import { setNMIExclusive, restoreNMI } from c64.system;
import { writeTimerALatch, configureTimerA, enableInterruptSources,
    disableInterruptSources, readAndClearPendingSources } from c64.cia2;
import { sourceAll, sourceTimerA, timerLoad, timerOneShot, timerStart } from c64.cia1;

place(at: $C000) let timerFinished: boolean = false;
interrupt function timerHandler(): void {
    if ((readAndClearPendingSources() & sourceTimerA) != 0) {
        let sample: byte = peek($C010);
        poke($C001, sample);
        timerFinished = true;
    }
}
function main(): void {
    poke($C010, $5A);
    setNMIExclusive(&timerHandler);
    disableInterruptSources(sourceAll);
    readAndClearPendingSources();
    configureTimerA(timerOneShot);
    writeTimerALatch($00FF);
    enableInterruptSources(sourceTimerA);
    configureTimerA(timerLoad | timerOneShot | timerStart);
    while (!timerFinished) { asm_nop(); }
    restoreNMI();
}`;

/** Generated identity of the handler, as the memory map names its owners. */
const HANDLER = "src/game.blend::Game.timerHandler";

/** Collect every invocation-private data interval the handler or its helpers own. */
function handlerPrivateHomes(memory: Record<string, unknown>): unknown[] {
  const privateKinds = new Set(["sfa", "zeroPage", "scratch"]);
  return profileRecords(memory.intervals).filter((interval) => {
    if (!privateKinds.has(String(interval.kind))) return false;
    const owner = profileRecord(interval.owner);
    if (typeof owner.id !== "string") throw new TypeError("Missing interval owner identity");
    const owners: unknown = owner.id.startsWith("overlay:")
      ? JSON.parse(owner.id.slice("overlay:".length))
      : [owner.id];
    if (!Array.isArray(owners) || !owners.every((id) => typeof id === "string"))
      throw new TypeError("Malformed interval owner associations");
    return owners.some((id: string) => id === HANDLER || id.startsWith(`${HANDLER}::`));
  });
}

describe.sequential("an elided NMI local in native VICE", () => {
  it("should carry the fixed-address read through the accumulator to its write", async () => {
    await withProfileProject(SOURCE, PROFILE, async (project) => {
      const built = await buildProject({ project, optimization: "none" });
      if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
      const artifacts = await readProfileArtifacts(built);

      // Stated here as well as in the host-tier controls, so this case cannot pass by silently
      // falling back to a private home and behaving correctly for the ordinary reason.
      expect(handlerPrivateHomes(artifacts.memory), "the local kept a home").toEqual([]);

      const started = await startVice(
        join(built.generation.directory, built.generation.primaryArtifact),
        200_000_000,
        PROFILE,
      );
      if ("kind" in started) throw new Error(`VICE is required: ${started.reason}`);
      const monitor = started.monitor;
      const checkpoints: number[] = [];
      try {
        checkpoints.push(await monitor.setExecuteCheckpoint(RETURN_PC));
        // The monitor has to be listening before execution reaches the stop.
        const stopped = monitor.waitForStop(60_000);
        await monitor.resume();
        expect(await stopped).toBe(RETURN_PC);

        // The handler ran at all, and the byte it published is the one mainline seeded.
        expect([...(await monitor.readMemory(SEED_ADDRESS, SEED_ADDRESS))]).toEqual([SEED]);
        expect([...(await monitor.readMemory(PUBLISHED, PUBLISHED))]).toEqual([SEED]);
      } finally {
        try {
          for (const checkpoint of checkpoints) await monitor.deleteCheckpoint(checkpoint);
        } finally {
          await stopVice(started);
        }
      }
    });
  }, 240_000);
});
