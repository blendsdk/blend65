import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { readProfileArtifacts, withProfileProject } from "../rd05/profile-fixture.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { labelAddresses } from "./emitted-routine-support.js";

/** The one selected target this behavior oracle runs on. */
const target = "c64-pal-prg-kernal-6581";

/** First byte of the region read back: the guard placed ahead of the array. */
const region = 0x33ff;

/**
 * A fill in exactly the shape this register-counted transformation applies to.
 *
 * Nothing in the program disturbs that shape: the guards either side of the
 * array are placed rather than written, so the fill's store is the only indexed
 * store anywhere, and the stored value is set in `main` before the call. That
 * last part is what makes an early capture visible — the global is declared 170
 * and the loop has to store 85.
 *
 * Running the right construction is not incidental here. A program that falls
 * back to the generic counted form would still fill correctly, so this oracle
 * would pass while testing a routine this work never touched.
 */
const source = `module Game;
place(at: $33ff) let guardBefore: byte = 1;
place(at: $3400) let cells: byte[8] = [;0];
place(at: $3408) let guardAfter: byte = 2;
let value: byte = 170;
function work(): void {
  for (let i: word = 0; i < 8; i += 1) { cells[i] = value; }
}
function main(): void { value = 85; work(); }
`;

/** Resolve the address the program returns to once its own code has finished. */
function programReturnAddress(labels: string): number {
  const suffix = Buffer.from("startup.restore").toString("hex");
  const pattern = new RegExp(`^b65_[A-Za-z0-9_]+_${suffix}$`, "u");
  const addresses = new Set(
    [...labelAddresses(labels)]
      .filter(([label]) => pattern.test(label))
      .map(([, address]) => address),
  );
  expect([...addresses], "program return address").toHaveLength(1);
  return [...addresses][0]!;
}

// Serialized: a second emulator instance may not run alongside this one.
describe.sequential("an invariant fill writes exactly the elements it was given", () => {
  it("leaves every element holding the byte the loop was told to store", async () => {
    await withProfileProject(source, target, async (project) => {
      const built = await buildProject({ project, optimization: "balanced" });
      expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
      if (built.kind !== "success") throw new Error("Expected a complete fill build");
      const artifacts = await readProfileArtifacts(built);

      // The construction under test, confirmed before anything is executed.
      // Hoisting the load does not reorder the instructions, only which block
      // they sit in, so the instruction sequence is identical either way and
      // says nothing at all. What moves is the loop's entry: the block the
      // closing branch jumps back to begins with the store once the load has
      // been hoisted, and with the load while it has not.
      const fill = artifacts.assembly.slice(artifacts.assembly.indexOf('; routine "Game.work"'));
      const branch = /^\s+bcc\s+(\S+)\s*$/mu.exec(fill);
      expect(branch?.[1], `emitted fill:\n${fill.slice(0, 700)}`).toBeDefined();
      const entry = fill.slice(fill.indexOf(`${branch?.[1] ?? "?"}:`));
      const body = entry.slice(entry.indexOf("\n"));
      expect(
        /^\s{2}([a-z]{3})[+\s-]/mu.exec(body)?.[1],
        `first instruction of the repeated block:\n${body.slice(0, 200)}`,
      ).toBe("sta");

      const returnAddress = programReturnAddress(artifacts.labels);
      const started = await startVice(
        join(built.generation.directory, built.generation.primaryArtifact),
      );
      if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
      try {
        await started.monitor.setExecuteCheckpoint(returnAddress);
        const stopped = started.monitor.waitForStop(20_000);
        await started.monitor.resume();
        expect(await stopped).toBe(returnAddress);
        // The guards either side of the array must be untouched, and every
        // element must hold the value the global held when the loop ran rather
        // than the value it was declared with.
        expect([...(await started.monitor.readMemory(region, region + 9))]).toEqual([
          1,
          ...Array.from({ length: 8 }, () => 85),
          2,
        ]);
      } finally {
        await stopVice(started);
      }
    });
  }, 180_000);
});
