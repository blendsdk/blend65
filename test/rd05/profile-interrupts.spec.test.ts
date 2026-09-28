import { access } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { readProfileArtifacts, withProfileProject } from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;

describe.each(profiles)("cooperative interrupt safety on %s", (target) => {
  // Selecting another video/SID combination does not change the balanced mainline IRQ contract.
  it("should accept and emit a balanced mainline IRQ installation", async () => {
    const source = `module Game;
import { setIRQ, restoreIRQ } from c64.system;
interrupt function handler(): void { poke($D019, 1); }
function main(): void { setIRQ(&handler); restoreIRQ(); }`;
    await withProfileProject(source, target, async (project) => {
      const checked = await checkProject({ project });
      expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
      if (checked.kind !== "success") throw new Error("Balanced IRQ check failed");
      expect(checked.profileId).toBe(target);
      const built = await buildProject({ project });
      expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
      if (built.kind !== "success") throw new Error("Balanced IRQ build failed");
      const artifacts = await readProfileArtifacts(built);
      expect(artifacts.memory.profileId).toBe(target);
      expect(artifacts.assembly).toMatch(/^\s*php\s*\n\s*cld\b/imu);
      expect(artifacts.assembly).toMatch(/^\s*plp\s*\n\s*jmp\s*\(/imu);
    });
  }, 60_000);

  /** The same balanced IRQ sources must compile under every selected cooperative profile. */
  const supportedHandlerUpdates = [
    [
      "handler-side chained IRQ installation",
      `import { setIRQ, restoreIRQ } from c64.system;
interrupt function next(): void {}
interrupt function handler(): void { setIRQ(&next); restoreIRQ(); }
function main(): void { asm_cli(); asm_nop(); setIRQ(&handler); asm_nop(); restoreIRQ(); }`,
    ],
    [
      "handler-side exclusive IRQ installation",
      `import { setIRQ, setIRQExclusive, restoreIRQ } from c64.system;
interrupt function next(): void {}
interrupt function handler(): void { setIRQExclusive(&next); restoreIRQ(); }
function main(): void { asm_cli(); asm_nop(); setIRQ(&handler); asm_nop(); restoreIRQ(); }`,
    ],
  ] as const;

  // Both IRQ forms preserve their predecessor and return with balanced vector ownership.
  it.each(supportedHandlerUpdates)(
    "should accept and emit %s",
    async (_name, declarations) => {
      await withProfileProject(`module Game;\n${declarations}`, target, async (project) => {
        const checked = await checkProject({ project });
        expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
        if (checked.kind !== "success") throw new Error("Balanced handler IRQ check failed");
        expect(checked.profileId).toBe(target);
        expect(checked.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
        const built = await buildProject({ project });
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (built.kind !== "success") throw new Error("Balanced handler IRQ build failed");
        expect(built.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
        const artifacts = await readProfileArtifacts(built);
        expect(artifacts.memory.profileId).toBe(target);
        expect(artifacts.prg.length).toBeGreaterThan(2);
      });
    },
    60_000,
  );

  const unsafe = [
    [
      "chained NMI installation",
      `import { setNMI, restoreNMI } from c64.system;
interrupt function handler(): void {}
function main(): void { setNMI(&handler); restoreNMI(); }`,
    ],
    [
      "exclusive NMI installation",
      `import { setNMIExclusive, restoreNMI } from c64.system;
interrupt function handler(): void {}
function main(): void { setNMIExclusive(&handler); restoreNMI(); }`,
    ],
  ] as const;

  // No emitted generation may imply a finite interrupt proof that these profiles do not provide.
  it.each(unsafe)(
    "should reject %s before emission",
    async (_name, declarations) => {
      await withProfileProject(`module Game;\n${declarations}`, target, async (project, root) => {
        for (const result of [await checkProject({ project }), await buildProject({ project })]) {
          expect(result.kind).toBe("failure");
          expect(
            result.diagnostics
              .filter(({ severity }) => severity === "error")
              .map(({ code }) => code),
          ).toContain("E10245");
          expect(result.diagnostics.map(({ code }) => code)).not.toContain("E10279");
        }
        await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
      });
    },
    60_000,
  );
});
