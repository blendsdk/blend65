import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { readProfileArtifacts, withProfileProject } from "../rd05/profile-fixture.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { globalAddress, labelAddresses } from "./emitted-routine-support.js";

/** The one selected target this behavior oracle runs on. */
const target = "c64-pal-prg-kernal-6581";

/**
 * One program exercising every word view and word update this oracle covers.
 *
 * Each function has exactly the shape its construction applies to, and `main`
 * drives them with inputs chosen to tell a correct result from a plausible
 * wrong one:
 *
 * - `scan` starts its full-word counter at 256, 65535 and 8, none of which may
 *   write anything, then at 5, which writes the last three elements. A counter
 *   or index truncated to its low byte would write element 0 for 256.
 * - `nested` indexes with a counter seeded from another counter, so each
 *   element ends holding the largest outer value below its own index.
 * - `touch` updates a module word 300 times, so the carry into its high byte
 *   is exercised and the result reads 300 rather than 44.
 * - `span` counts from 250 to 300, so its private counter steps from 255 to
 *   256 and the step must carry into the high byte for the loop to end at the
 *   right place.
 */
const source = `module Game;
let data: byte[8] = [;0];
let tri: byte[8] = [;0];
let total: word = 0;
let counted: word = 0;
function scan(seed: word): void {
  for (let i: word = seed; i < 8; i += 1) { data[i] = byte(i); }
}
function nested(): void {
  for (let i: word = 0; i < 8; i += 1) {
    for (let j: word = i + 1; j < 8; j += 1) { tri[j] = byte(i); }
  }
}
function touch(): void { total += 1; }
function span(seed: word): word {
  let n: word = 0;
  for (let i: word = seed; i < 300; i += 1) { n += 1; }
  return n;
}
function main(): void {
  scan(256);
  scan(65535);
  scan(8);
  scan(5);
  nested();
  for (let k: word = 0; k < 300; k += 1) { touch(); }
  counted = span(250);
}
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

/** The emitted text of one routine, up to the next routine or the end. */
function routineText(assembly: string, name: string): string {
  const start = assembly.indexOf(`; routine "Game.${name}"`);
  expect(start, `routine ${name}`).toBeGreaterThanOrEqual(0);
  const next = assembly.indexOf("; routine ", start + 1);
  return assembly.slice(start, next < 0 ? undefined : next);
}

// Serialized: a second emulator instance may not run alongside this one.
describe.sequential("word views and word updates compute what the source says", () => {
  it("fills, counts and accumulates exactly as the source describes", async () => {
    await withProfileProject(source, target, async (project) => {
      const built = await buildProject({ project, optimization: "balanced" });
      expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
      if (built.kind !== "success") throw new Error("Expected a complete build");
      const artifacts = await readProfileArtifacts(built);

      // The constructions under test, confirmed before anything is executed:
      // a program that fell back to the generic forms would compute the same
      // values, and this oracle would then pass while testing none of them.
      const scan = routineText(artifacts.assembly, "scan");
      expect(scan, "index byte reused as the stored value").toMatch(/^\s+tay\s*$/mu);
      expect(scan, "absolute-indexed store").toMatch(/^\s+sta\+2\s+b65_Game_data_\S*,y\s*$/mu);
      expect(scan, "counter stepped in place").toMatch(/^\s+inc\s/mu);
      const nested = routineText(artifacts.assembly, "nested");
      expect(nested, "absolute-indexed store").toMatch(/^\s+sta\+2\s+b65_Game_tri_\S*,y\s*$/mu);
      expect(nested, "no pointer store").not.toMatch(/\),y\s*$/mu);
      const touch = routineText(artifacts.assembly, "touch");
      const touchStores = [...touch.matchAll(/^\s+sta\S*\s+(\S+)/gmu)].map((match) => match[1]);
      expect(touchStores, `global update writes only its own two bytes:\n${touch}`).toHaveLength(2);
      expect(touchStores.every((operand) => operand!.startsWith("b65_Game_total_"))).toBe(true);
      expect(routineText(artifacts.assembly, "span"), "counter stepped in place").toMatch(
        /^\s+inc\s/mu,
      );

      const labels = labelAddresses(artifacts.labels);
      const data = globalAddress(labels, "data");
      const tri = globalAddress(labels, "tri");
      const total = globalAddress(labels, "total");
      const counted = globalAddress(labels, "counted");
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
        const read = async (address: number, length: number) => [
          ...(await started.monitor.readMemory(address, address + length - 1)),
        ];
        expect(await read(data, 8), "scan").toEqual([0, 0, 0, 0, 0, 5, 6, 7]);
        expect(await read(tri, 8), "nested").toEqual([0, 0, 1, 2, 3, 4, 5, 6]);
        expect(await read(total, 2), "touch").toEqual([300 & 0xff, 300 >> 8]);
        expect(await read(counted, 2), "span").toEqual([50, 0]);
      } finally {
        await stopVice(started);
      }
    });
  }, 180_000);
});
