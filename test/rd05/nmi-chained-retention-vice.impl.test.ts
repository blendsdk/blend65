import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { readProfileArtifacts, withProfileProject } from "./profile-fixture.js";

const PROFILE = "c64-pal-prg-kernal-6581" as const;

/** Cooperative return address the startup stub hands control back to. */
const RETURN_PC = 0xe147;
/** First of the nine bytes mainline seeds for the handler to retain. */
const SEED_BASE = 0xc010;
/** First of the nine bytes the handler publishes, in reverse of the order it read them. */
const PUBLISHED_BASE = 0xc020;
/** Distinct, asymmetric seeds, so any scrambling of the retained frame is visible. */
const SEEDS = [0x31, 0x5a, 0x7e, 0xa3, 0xc5, 0xe1, 0x12, 0x4d, 0x96] as const;

/**
 * A chained handler retaining nine bytes, which forces the bulk frame unwind.
 *
 * Beyond six retained bytes the unwind stops popping one byte at a time and raises the stack
 * pointer in one go. On a route that returns from the interrupt that is unremarkable, because the
 * terminal instruction restores the status itself. This route does not return: it restores the
 * caller's status with an explicit `plp` and hands over to the previous handler. So the status
 * snapshot has to still be on the stack beneath everything the unwind released, and the previous
 * handler has to find exactly the frame it expects.
 *
 * The nine bytes are read in one order and published in the reverse order, which is what makes the
 * assertion sharp. Reading them back in the same order would pass even if the retained slots were
 * rotated; reversing means every slot has to be addressed individually and correctly. Mainline
 * seeds them at runtime, so none of it can be folded into the handler.
 *
 * The interrupt source is armed through the raw hardware boundary rather than the managed CIA2
 * API, because this route leaves the chip owned by the firmware it chains to — the managed calls
 * correctly refuse. Arming it from mainline keeps the handler straight-line, which the retention
 * proof requires, and keeps the chip writes out of the retained region.
 *
 * Reaching the cooperative return address at all is the other half of the proof. A status restored
 * from the wrong byte, or a pointer left anywhere but where the previous handler needs it, does not
 * come back to BASIC.
 */
const SOURCE = `module Game;
import { setNMI, restoreNMI } from c64.system;

place(at: $C000) let captured: boolean = false;
interrupt function handler(): void {
    let a: byte = peek($C010); let b: byte = peek($C011);
    let c: byte = peek($C012); let d: byte = peek($C013);
    let e: byte = peek($C014); let f: byte = peek($C015);
    let g: byte = peek($C016); let h: byte = peek($C017);
    let i: byte = peek($C018);
    poke($C020, i); poke($C021, h); poke($C022, g); poke($C023, f);
    poke($C024, e); poke($C025, d); poke($C026, c); poke($C027, b);
    poke($C028, a);
    captured = true;
}
function main(): void {
    poke($C010, $31); poke($C011, $5A); poke($C012, $7E);
    poke($C013, $A3); poke($C014, $C5); poke($C015, $E1);
    poke($C016, $12); poke($C017, $4D); poke($C018, $96);
    setNMI(&handler);
    poke($DD0D, $7F);
    poke($DD04, $FF);
    poke($DD05, $00);
    poke($DD0D, $81);
    poke($DD0E, $19);
    while (!captured) { asm_nop(); }
    poke($DD0D, $7F);
    restoreNMI();
}`;

/** Reduce the listing to its instruction stream alone. */
function instructions(assembly: string): readonly string[] {
  return assembly
    .split("\n")
    .map((line) => line.split(";")[0]?.trim() ?? "")
    .filter(
      (line) =>
        line !== "" && !line.endsWith(":") && !line.startsWith("*") && !line.startsWith("!"),
    );
}

describe.sequential("a chained NMI handler retaining nine bytes in native VICE", () => {
  it("should restore the entry status past a bulk frame unwind and hand over correctly", async () => {
    await withProfileProject(SOURCE, PROFILE, async (project) => {
      const built = await buildProject({ project, optimization: "none" });
      if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
      const artifacts = await readProfileArtifacts(built);
      const text = instructions(artifacts.assembly);

      // Asserted so this case cannot quietly stop covering what it exists for. If the retention
      // ever falls back to a run of pops, the bulk unwind is no longer under test and the reason
      // this program is interesting has gone.
      const unwind = text.findIndex((line) => line === "txs");
      expect(unwind, "no bulk frame unwind was emitted").toBeGreaterThanOrEqual(0);
      expect(
        text.slice(unwind + 1, unwind + 5),
        "the unwind is not followed by the register and status restore",
      ).toEqual(["pla", "tax", "pla", "plp"]);
      expect(text[unwind + 5], "the route does not hand over to a previous handler").toMatch(
        /^jmp \(\$[0-9a-f]+\)$/i,
      );

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
        // Returning here at all proves the status came back and the previous handler was handed
        // the frame it expects.
        expect(await stopped).toBe(RETURN_PC);

        expect([...(await monitor.readMemory(SEED_BASE, SEED_BASE + 8))]).toEqual([...SEEDS]);
        expect([...(await monitor.readMemory(PUBLISHED_BASE, PUBLISHED_BASE + 8))]).toEqual(
          [...SEEDS].reverse(),
        );
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
