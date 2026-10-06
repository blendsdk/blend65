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
let ADDRESS: word;
interrupt function N(): void { ADDRESS = $0318; }`;
const FINAL_POPS = [
  { name: "inline", declarations: "", pop: "restoreNMI();" },
  {
    name: "through one ordinary helper",
    declarations: "function drop(): void { restoreNMI(); }",
    pop: "drop();",
  },
  {
    name: "through two ordinary helpers",
    declarations:
      "function drop(): void { restoreNMI(); } function dropThroughHelper(): void { drop(); }",
    pop: "dropThroughHelper();",
  },
];

/** Require semantic acceptance and actual assembled publication after the final lifetime ends. */
async function expectSuccess(source: string, profile: string) {
  await withProfileProject(source, profile, async (project) => {
    const checked = await checkProject({ project });
    expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
    expect(checked.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    expect(built.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    if (built.kind !== "success") throw new Error("Expected complete publication");
    await expect(
      access(join(built.generation.directory, built.generation.primaryArtifact)),
    ).resolves.toBeUndefined();
  });
}

/** Keep a surviving shared-global writer live and attribute its unsafe raw write exactly. */
async function expectLiveWriterFailure(source: string, profile: string) {
  await withProfileProject(source, profile, async (project, root) => {
    const span = profileSpan(source, "poke(ADDRESS, 7)");
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

describe("ordinary helper NMI lifetime effects", () => {
  for (const { name, declarations, pop } of FINAL_POPS) {
    it.each(PROFILES)(
      `should preserve the later disjoint address when the final NMI pop occurs ${name} on %s`,
      async (profile) => {
        // A proved returning helper pop transfers the same ownership state as an inline pop.
        const source = `${PRELUDE} ${declarations}
function main(): void { setNMI(&N); ${pop} ADDRESS = $d020; poke(ADDRESS, 7); setNMI(&N); restoreNMI(); }`;
        await expectSuccess(source, profile);
      },
      60_000,
    );
  }

  it.each(PROFILES)(
    "should reject the actual poke when one helper pop leaves a nested NMI installation live on %s",
    async (profile) => {
      // Popping one of two installs does not stop the surviving handler from changing ADDRESS.
      const source = `${PRELUDE} function drop(): void { restoreNMI(); }
function main(): void { setNMI(&N); setNMI(&N); drop(); ADDRESS = $d020; poke(ADDRESS, 7); restoreNMI(); }`;
      await expectLiveWriterFailure(source, profile);
    },
    60_000,
  );
});
