import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import type { BuildSuccess } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { withProfileProject } from "./profile-fixture.js";
import { sourceLibraryProfiles } from "./source-library-fixture.js";

/** Observe the called function's result after the program returns through the native SYS path. */
async function expectCallResult(
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

/** Build and execute a call whose target was established by ordinary typed control flow. */
async function expectCallableProgram(
  source: string,
  profile: (typeof sourceLibraryProfiles)[number],
  expected: number,
): Promise<void> {
  await withProfileProject(source, profile, async (project) => {
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error("Expected a proved callable target");
    await expectCallResult(built, profile, expected);
  });
}

/** Reject unproved callable storage with its semantic diagnostic rather than a lowering error. */
async function expectUnprovedCall(
  source: string,
  profile: (typeof sourceLibraryProfiles)[number],
): Promise<void> {
  await withProfileProject(source, profile, async (project) => {
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built.diagnostics)).not.toBe("success");
    const codes = built.diagnostics.map((diagnostic) => diagnostic.code);
    expect(codes, JSON.stringify(built.diagnostics)).toContain("E10277");
    expect(codes).not.toContain("COMPILER_LOWERING");
  });
}

describe("callable assignment through helpers", () => {
  for (const profile of sourceLibraryProfiles) {
    // A directly called helper definitely assigns the global before the later callable invocation.
    it(`${profile}: should call chosen when a directly called helper assigns the callback first`, async () => {
      await expectCallableProgram(
        `module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
export function prepare(): void { callback = &chosen; }
export function invoke(): byte { return callback(); }
function main(): void { prepare(); poke($C000, invoke()); }`,
        profile,
        37,
      );
    }, 60_000);

    // A definite assignment remains proved through an additional ordinary helper call.
    it(`${profile}: should call chosen when a transitive helper assigns the callback first`, async () => {
      await expectCallableProgram(
        `module Game;
let callback: fn(): byte;
function chosen(): byte { return 41; }
export function prepare(): void { callback = &chosen; }
function outer(): void { prepare(); }
export function invoke(): byte { return callback(); }
function main(): void { outer(); poke($C000, invoke()); }`,
        profile,
        41,
      );
    }, 60_000);

    // A conditional write cannot prove a target on the route where the assignment is not executed.
    it(`${profile}: should reject the call with E10277 when assignment is only conditional`, async () => {
      await expectUnprovedCall(
        `module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function invoke(): byte { return callback(); }
function main(): void {
  if (peek($0400) != 0) { callback = &chosen; }
  poke($C000, invoke());
}`,
        profile,
      );
    }, 120_000);

    // An omitted callable element has no proved target and must not become a direct call.
    it(`${profile}: should reject the call with E10277 when it reaches an omitted callable element`, async () => {
      await expectUnprovedCall(
        `module Game;
let callback: fn(): byte;
let callbacks: (fn(): byte)[2] = [&chosen];
function chosen(): byte { return 37; }
export function invoke(): byte { return callbacks[1](); }
function main(): void { poke($C000, invoke()); }`,
        profile,
      );
    }, 120_000);

    // Supplying every callable element preserves the selected element's finite target proof.
    it(`${profile}: should call first when every callable array element is supplied`, async () => {
      await expectCallableProgram(
        `module Game;
function first(): byte { return 11; }
function second(): byte { return 22; }
let callbacks: (fn(): byte)[2] = [&first, &second];
function main(): void { poke($C000, callbacks[0]()); }`,
        profile,
        11,
      );
    }, 60_000);
  }
});
