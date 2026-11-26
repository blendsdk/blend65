import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { readProfileArtifacts, withProfileProject } from "../rd05/profile-fixture.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { labelAddresses } from "./emitted-routine-support.js";

/** The one selected target this behavior oracle runs on. */
const target = "c64-pal-prg-kernal-6581";

/** Address the destination array is placed at, so its bytes can be read back exactly. */
const destination = 0x3400;

/**
 * A fill whose value is read from a global and whose destination has neighbors.
 *
 * `prepare` writes a different value into the global than its declaration gave
 * it, so a value captured too early is visible in the result, and fences the
 * array on both sides, so a store one element short or one too far overwrites a
 * byte that is checked. `work` keeps the plain counted-fill shape.
 */
const source = `module Game;
place(at: $3400) let cells: byte[10] = [;0];
let value: byte = 170;
function prepare(): void { cells[0] = 5; cells[9] = 6; value = 85; }
function work(): void {
  for (let i: word = 0; i < 8; i += 1) { cells[i + 1] = value; }
}
function main(): void { prepare(); work(); }
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
        // The fences either side of the array must be untouched, and every
        // element must hold the value the global held when the loop ran.
        expect([...(await started.monitor.readMemory(destination, destination + 9))]).toEqual([
          5,
          ...Array.from({ length: 8 }, () => 85),
          6,
        ]);
      } finally {
        await stopVice(started);
      }
    });
  }, 180_000);
});
