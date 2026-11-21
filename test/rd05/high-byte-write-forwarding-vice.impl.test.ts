import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { buildProfileSource } from "./profile-fixture.js";

const PROFILE = "c64-pal-prg-kernal-6581";
const OPTIMIZATIONS = ["none", "balanced", "speed", "size"] as const;
/** Sprite 1 Y position: an ordinary writable register that reads back what was written. */
const ANCHOR = 0xd005;

/**
 * A high byte extracted from a named word and written straight to a fixed hardware address.
 *
 * The word advances by one in each half, so both halves change every iteration and the high byte
 * is never incidentally correct: starting at `$12A5` the first write must deliver `$13`, the second
 * `$14`. A forwarding that delivered the low byte, a stale byte, or the byte before the advance
 * would all show up immediately in the register.
 */
const source = `module Game; function main():void {
  let value:word=$12A5;
  while(true){value=value+257;poke($D005,hi(value));}
}`;

/**
 * Locate the single absolute store to the anchor and return the address just past it.
 *
 * Read out of the delivered image rather than the listing, so the stop lands on the instruction
 * the processor will actually execute. A duplicate or missing store is a failure rather than a
 * guess, because stopping after the wrong one would prove nothing about the forwarded write.
 */
function afterAnchorStore(prg: Buffer): number {
  const origin = prg.readUInt16LE(0);
  const found: number[] = [];
  for (let offset = 2; offset + 2 < prg.length; offset += 1) {
    if (prg[offset] === 0x8d && prg.readUInt16LE(offset + 1) === ANCHOR)
      found.push(origin + offset - 2);
  }
  expect(found, "exactly one absolute store to the anchor").toHaveLength(1);
  const store = found[0];
  if (store === undefined) throw new Error("Missing absolute store to the anchor");
  return store + 3;
}

describe.sequential("a forwarded high-byte hardware write in native VICE", () => {
  for (const optimization of OPTIMIZATIONS) {
    it(`delivers the word's own high byte at optimization ${optimization}`, async () => {
      const artifacts = await buildProfileSource(source, PROFILE, optimization);
      const settled = afterAnchorStore(artifacts.prg);
      const root = await mkdtemp(join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "high-byte-vice-"));
      try {
        const prgPath = join(root, "program.prg");
        await writeFile(prgPath, artifacts.prg);
        const started = await startVice(prgPath, 100_000_000, PROFILE);
        if ("kind" in started) throw new Error(`VICE is required: ${started.reason}`);
        const monitor = started.monitor;
        const checkpoints: number[] = [];
        try {
          checkpoints.push(await monitor.setExecuteCheckpoint(settled));
          const observed: number[] = [];
          for (let pass = 0; pass < 2; pass += 1) {
            // The monitor has to be listening before execution reaches the stop.
            const stopped = monitor.waitForStop(30_000);
            await monitor.resume();
            expect(await stopped).toBe(settled);
            observed.push((await monitor.readIo(ANCHOR, ANCHOR))[0]!);
          }

          expect(observed).toEqual([0x13, 0x14]);
        } finally {
          try {
            for (const checkpoint of checkpoints) await monitor.deleteCheckpoint(checkpoint);
          } finally {
            await stopVice(started);
          }
        }
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }, 180_000);
  }
});
