import { access } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject, checkProject } from "@blend65/compiler";
import { readProfileArtifacts, withProfileProject } from "./profile-fixture.js";

/** Every cooperative profile requires the same live NMINV writer proof. */
const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];
/** Sink and operation spelling remain compiler-owned, but the public failure template is frozen. */
const ownershipMessage = /^Interrupt ownership for sink '[^']+' is invalid at '[^']+' — .+$/;

/** Keep high-level vector ownership live across the selected source write. */
function installedSource(statements: string, declarations = ""): string {
  return `module Game;
import { setNMI, restoreNMI } from c64.system;
${declarations}
interrupt function handler(): void {}
function main(): void { setNMI(&handler); ${statements} restoreNMI(); }`;
}

/** Successful admission must reach a real build without certifying an external stack bound. */
async function expectAdmitted(source: string, profile: string): Promise<void> {
  await withProfileProject(source, profile, async (project) => {
    expect.soft((await checkProject({ project })).kind).toBe("success");
    const built = await buildProject({ project, optimization: "none" });
    expect.soft(built.kind).toBe("success");
    if (built.kind !== "success") return;
    const artifacts = await readProfileArtifacts(built);
    expect(artifacts.memory.acmeReconciled).toBe(true);
    expect(artifacts.memory.runtimeMemorySafety).toBe("unproven");
  });
}

describe.each(profiles)("cooperative NMI writer ownership on %s", (profile) => {
  // Every byte written matters, including a word's second byte and wrapped unsigned address flow.
  it.each([
    ["a byte store touches the low vector byte", installedSource("poke($0318, 0);")],
    ["a byte store touches the high vector byte", installedSource("poke($0319, 0);")],
    ["only the second word byte touches the vector", installedSource("pokew($0317, 0);")],
    ["both word bytes touch the vector", installedSource("pokew($0318, 0);")],
    ["the first word byte touches the high vector byte", installedSource("pokew($0319, 0);")],
    [
      "unsigned address arithmetic wraps into the vector",
      installedSource("let address: word = $ffff; address += $0319; pokew(address, 0);"),
    ],
    [
      "an opaque byte address may touch the vector",
      installedSource("let address: word = peekw($0400); poke(address, 0);"),
    ],
    [
      "an ordinary helper receives an opaque word address",
      installedSource(
        "writeAt(peekw($0400));",
        "function writeAt(address: word): void { pokew(address, 0); }",
      ),
    ],
  ])("should reject live vector ownership when %s", async (_condition, source) => {
    await withProfileProject(source, profile, async (project, root) => {
      const checked = await checkProject({ project });
      const built = await buildProject({ project, optimization: "none" });
      for (const result of [checked, built]) {
        expect(result.kind).toBe("failure");
        expect(result).not.toHaveProperty("generation");
        const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
        expect(errors).toHaveLength(1);
        const diagnostic = errors[0]!;
        expect(diagnostic.code).toBe("E10278");
        expect(diagnostic.message).toMatch(ownershipMessage);
        expect(diagnostic.primarySpan?.sourceId).toBe("src/game.blend");
        expect(diagnostic.primarySpan?.start).toBeGreaterThanOrEqual(0);
        expect(diagnostic.primarySpan?.end).toBeGreaterThan(diagnostic.primarySpan!.start);
        expect(diagnostic.primarySpan?.end).toBeLessThanOrEqual(Buffer.byteLength(source));
      }
      await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
    });
  });

  // Raw management remains expressible outside the high-level live observer proof.
  it("should preserve raw vector writes when no high-level NMI installation exists", async () => {
    await expectAdmitted("module Game; function main(): void { pokew($0318, $fe47); }", profile);
  });

  // Once mainline resumes after the balanced final pop, no suspended mainline operation remains.
  it("should preserve deliberate raw management when the balanced NMI lifetime has ended", async () => {
    await expectAdmitted(
      `module Game;
import { setNMI, restoreNMI } from c64.system;
interrupt function handler(): void {}
function main(): void { setNMI(&handler); restoreNMI(); pokew($0318, $fe47); }`,
      profile,
    );
  });

  // Ordinary proven value flow is sufficient; variable-address syntax is not a rejection rule.
  it.each([
    [
      "a local address copies a constant",
      installedSource(
        "let address: word = DESTINATION; poke(address, 7);",
        "const DESTINATION: word = $0400;",
      ),
    ],
    [
      "a local address follows a known global initializer and addition",
      installedSource(
        "let address: word = globalAddress; address += 1; poke(address, 9);",
        "const DESTINATION: word = $0400; let globalAddress: word = DESTINATION;",
      ),
    ],
  ])("should admit a disjoint variable-address write when %s", async (_condition, source) => {
    await expectAdmitted(source, profile);
  });
});
