import { access } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { profileSpan, withProfileProject } from "./profile-fixture.js";

const PROFILES = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];
const PRELUDE = `module Game; import { setNMI, restoreNMI } from c64.system;
interrupt function N(): void {}
function terminal(): void { while (true) {} }
function later(address: word): void { setNMI(&N); poke(address, 7); restoreNMI(); }`;

/** Require complete public acceptance and publication without diagnosing unreachable ownership effects. */
async function expectUnreachableWriterSuccess(source: string, profile: string) {
  await withProfileProject(source, profile, async (project) => {
    const checked = await checkProject({ project });
    const built = await buildProject({ project, optimization: "none" });
    for (const result of [checked, built]) {
      expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
      expect(result.diagnostics.some(({ code }) => code === "E10278")).toBe(false);
      expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    }
    if (built.kind !== "success") throw new Error("Expected complete publication");
    await expect(
      access(join(built.generation.directory, built.generation.primaryArtifact)),
    ).resolves.toBeUndefined();
  });
}

/** Keep a reachable opaque writer unsafe and attribute the actual helper poke in both services. */
async function expectReachableWriterFailure(source: string, profile: string) {
  await withProfileProject(source, profile, async (project, root) => {
    const span = profileSpan(source, "poke(address, 7)");
    for (const result of [
      await checkProject({ project }),
      await buildProject({ project, optimization: "none" }),
    ]) {
      expect(result.kind, JSON.stringify(result.diagnostics)).toBe("failure");
      const diagnostic = result.diagnostics.find(
        (entry) =>
          entry.code === "E10278" &&
          entry.primarySpan?.sourceId === span.sourceId &&
          entry.primarySpan.start === span.start &&
          entry.primarySpan.end === span.end,
      );
      expect(diagnostic, JSON.stringify(result.diagnostics)).toBeDefined();
      expect(diagnostic!.severity).toBe("error");
      expect(diagnostic!.primarySpan).toEqual(span);
      expect(diagnostic!.message).toMatch(
        /^Interrupt ownership for sink '[^']+' is invalid at '[^']+' — .+$/u,
      );
      expect(Array.isArray(diagnostic!.related)).toBe(true);
      expect(result).not.toHaveProperty("generation");
    }
    await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
  });
}

describe("NMI ownership on actual returning paths", () => {
  it.each(PROFILES)(
    "should accept unreachable later ownership effects when a direct helper is nonreturning on %s",
    async (profile) => {
      // The terminal call has no return edge; neither later's writer nor main's normal exit executes.
      const source = `${PRELUDE}
function main(): void { setNMI(&N); terminal(); later($d020); }`;
      await expectUnreachableWriterSuccess(source, profile);
    },
    60_000,
  );

  it.each(PROFILES)(
    "should accept an unreachable successor when every finite indirect target is nonreturning on %s",
    async (profile) => {
      // Both precise targets are terminal, and both branch arms terminate before the successor.
      const source = `${PRELUDE}
function terminalOther(): void { while (true) {} }
function main(): void {
  setNMI(&N);
  let target: fn(): void = peek($0400) == 0 ? &terminal : &terminalOther;
  if (peek($0401) == 0) { target(); } else { terminal(); }
  later($d020);
}`;
      await expectUnreachableWriterSuccess(source, profile);
    },
    60_000,
  );

  it.each(PROFILES)(
    "should reject the actual later writer when the preceding direct helper returns on %s",
    async (profile) => {
      const source = `${PRELUDE}
function returning(): void {}
function main(): void { setNMI(&N); returning(); later(peekw($0401)); restoreNMI(); }`;
      await expectReachableWriterFailure(source, profile);
    },
    60_000,
  );

  it.each(PROFILES)(
    "should reject the actual later writer when a mixed finite target set contains a returning member on %s",
    async (profile) => {
      // One possible return is sufficient to reach the opaque writer; a terminal alternative cannot hide it.
      const source = `${PRELUDE}
function returning(): void {}
function main(): void {
  setNMI(&N);
  let target: fn(): void = peek($0400) == 0 ? &terminal : &returning;
  target();
  later(peekw($0401));
  restoreNMI();
}`;
      await expectReachableWriterFailure(source, profile);
    },
    60_000,
  );
});
