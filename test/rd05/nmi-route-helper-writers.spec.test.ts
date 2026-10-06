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
const WRITERS = [
  {
    name: "a direct helper writes the constant vector address",
    declarations: "function writeVector(): void { poke($0318, 7); }",
    call: "writeVector();",
    writer: "poke($0318, 7)",
  },
  {
    name: "two ordinary helpers lead to the constant vector write",
    declarations:
      "function writeVector(): void { poke($0318, 7); } function callWriter(): void { writeVector(); }",
    call: "callWriter();",
    writer: "poke($0318, 7)",
  },
  {
    name: "a parameterized helper receives an opaque runtime address",
    declarations: "function writeVector(address: word): void { poke(address, 7); }",
    call: "writeVector(peekw($0400));",
    writer: "poke(address, 7)",
  },
];

/** Reject the actual raw writer in both public services, with no partial publication. */
async function expectOwnedWriterFailure(source: string, profile: string, writer: string) {
  await withProfileProject(source, profile, async (project, root) => {
    const span = profileSpan(source, writer);
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

/** Keep deliberate raw vector management legal when no high-level NMI proof is live. */
async function expectUnownedWriterSuccess(source: string, profile: string) {
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

describe("ordinary helper NMINV writer attribution", () => {
  for (const { name, declarations, call, writer } of WRITERS) {
    it.each(PROFILES)(
      `should reject the actual helper writer when ${name} during caller-owned NMI on %s`,
      async (profile) => {
        // Helper traversal changes neither ownership lifetime nor the responsible source operation.
        const source = `module Game; import { setNMI, restoreNMI } from c64.system;
${declarations}
interrupt function onNMI(): void {}
function main(): void { setNMI(&onNMI); ${call} restoreNMI(); }`;
        await expectOwnedWriterFailure(source, profile, writer);
      },
      60_000,
    );

    it.each(PROFILES)(
      `should retain deliberate raw management when ${name} without high-level NMI installation on %s`,
      async (profile) => {
        // The identical raw access is not a language-wide helper or variable-address prohibition.
        const source = `module Game; ${declarations} function main(): void { ${call} }`;
        await expectUnownedWriterSuccess(source, profile);
      },
      60_000,
    );
  }
});
