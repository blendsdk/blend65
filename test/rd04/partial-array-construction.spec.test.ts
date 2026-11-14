import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import type { BuildSuccess } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

/** Observe the supplied element after the program returns, without reading any omitted element. */
async function expectStoredByte(
  built: BuildSuccess,
  profile: (typeof sourceLibraryProfiles)[number],
  expected: number,
): Promise<void> {
  const prgPath = join(built.generation.directory, built.generation.primaryArtifact);
  const runtime = await startVice(prgPath, 100_000_000, profile, false, false);
  if ("kind" in runtime) throw new Error(`VICE observation is Unknown: ${runtime.reason}`);
  try {
    const monitor = runtime.monitor;
    await monitor.setExecuteCheckpoint(0xe147);
    const stopped = monitor.waitForStop(20_000);
    await monitor.resume();
    expect(await stopped).toBe(0xe147);
    expect([...(await monitor.readMemory(0xc000, 0xc000))]).toEqual([expected]);
  } finally {
    await stopVice(runtime);
  }
}

/** Require a legal initializer's warning contract and execute its initialized first element. */
async function expectArrayProgram(
  source: string,
  profile: (typeof sourceLibraryProfiles)[number],
  expected: number,
  partial: boolean,
): Promise<void> {
  await withProfileProject(source, profile, async (project) => {
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error("Expected a legal array initializer");
    const codes = built.diagnostics.map((diagnostic) => diagnostic.code);
    if (partial) expect(codes).toContain("W10140");
    else expect(codes).not.toContain("W10140");
    await expectStoredByte(built, profile, expected);
  });
}

describe("partial fixed-array construction", () => {
  for (const profile of sourceLibraryProfiles) {
    // A partial local initializer is legal, warns, and stores its supplied element.
    it(`${profile}: should warn and store 7 when a local array is partially initialized`, async () => {
      await expectArrayProgram(
        `module Game;
function main(): void {
  let a: byte[2] = [7];
  poke($C000, a[0]);
}`,
        profile,
        7,
        true,
      );
    }, 60_000);

    // A partial global initializer stores its supplied element before main and warns.
    it(`${profile}: should warn and store 9 when a global array is partially initialized`, async () => {
      await expectArrayProgram(
        `module Game;
let values: byte[3] = [9];
function main(): void {
  poke($C000, values[0]);
}`,
        profile,
        9,
        true,
      );
    }, 60_000);

    // Omitting an outer element does not prevent construction of the supplied complete inner array.
    it(`${profile}: should warn and store 7 when only the first nested array is supplied`, async () => {
      await expectArrayProgram(
        `module Game;
function main(): void {
  let pairs: byte[2][2] = [[7, 8]];
  poke($C000, pairs[0][0]);
}`,
        profile,
        7,
        true,
      );
    }, 60_000);

    // An explicit fill completes the initializer, so the partial-initialization warning is absent.
    it(`${profile}: should store 7 without a partial warning when an explicit fill completes the array`, async () => {
      await expectArrayProgram(
        `module Game;
function main(): void {
  let a: byte[2] = [7; 0];
  poke($C000, a[0]);
}`,
        profile,
        7,
        false,
      );
    }, 60_000);
  }
});
