import { access } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { profileSpan, readProfileArtifacts, withProfileProject } from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;
const primaryProfile = profiles[0];

/** Wrap handler declarations in a returning cooperative IRQ program. */
function program(declarations: string, mainBody?: string): string {
  return `module Game;
import { setIRQ, setIRQExclusive, restoreIRQ } from c64.system;
${declarations}
function main(): void {
  ${mainBody ?? "setIRQ(&A); asm_cli(); asm_nop(); asm_sei(); restoreIRQ();"}
}`;
}

/** Check and build a selected profile, then inspect its returned generation. */
async function expectAccepted(source: string, profile = primaryProfile) {
  await withProfileProject(source, profile, async (project) => {
    const checked = await checkProject({ project });
    expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
    expect(checked.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    if (checked.kind !== "success") throw new Error("Expected successful ownership check");
    expect(checked.profileId).toBe(profile);

    const built = await buildProject({ project });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    expect(built.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    if (built.kind !== "success") throw new Error("Expected successful ownership build");
    const artifacts = await readProfileArtifacts(built);
    expect(artifacts.memory.profileId).toBe(profile);
    expect(artifacts.assembly.length).toBeGreaterThan(0);
    expect(artifacts.prg.length).toBeGreaterThan(2);
    return artifacts;
  });
}

/** Require ownership rejection without publishing any build artifact. */
async function expectRejected(source: string) {
  await withProfileProject(source, primaryProfile, async (project, root) => {
    for (const result of [await checkProject({ project }), await buildProject({ project })]) {
      expect(result.kind).toBe("failure");
      const errorCodes = result.diagnostics
        .filter(({ severity }) => severity === "error")
        .map(({ code }) => code);
      expect(errorCodes).toContain("E10278");
      expect(errorCodes).not.toContain("E10245");
      expect(result).not.toHaveProperty("generation");
    }
    await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
  });
}

describe("handler-side IRQ ownership", () => {
  // A temporary handler must return the vector to the predecessor A received.
  it.each(
    profiles.flatMap((profile) => [
      [profile, "setIRQ"] as const,
      [profile, "setIRQExclusive"] as const,
    ]),
  )(
    "accepts a balanced %s temporary install with %s",
    async (profile, setter) => {
      await expectAccepted(
        program(`interrupt function B(): void {}
interrupt function A(): void { ${setter}(&B); restoreIRQ(); }`),
        profile,
      );
    },
    60_000,
  );

  // A helper may give its caller the ownership it acquired.
  it("accepts a helper that installs B for A to restore", async () => {
    await expectAccepted(
      program(`interrupt function B(): void {}
function install(): void { setIRQ(&B); }
interrupt function A(): void { install(); restoreIRQ(); }`),
    );
  }, 60_000);

  // Both choices restore their own predecessor before their control-flow join.
  it("accepts two balanced runtime branches", async () => {
    await expectAccepted(
      program(`interrupt function B(): void {}
interrupt function C(): void {}
interrupt function A(): void {
  if (peek($0400) == 0) { setIRQ(&B); restoreIRQ(); }
  else { setIRQ(&C); restoreIRQ(); }
}`),
    );
  }, 60_000);

  // Reusing one balanced install site does not require a new saved link per iteration.
  it.each([0, 1, 3])(
    "accepts a balanced loop with runtime count seeded as %i",
    async (count) => {
      await expectAccepted(
        program(
          `interrupt function B(): void {}
interrupt function A(): void {
  let count: byte = peek($0400);
  for (let i: byte = 0; i < count; i += 1) { setIRQ(&B); restoreIRQ(); }
}`,
          `poke($0400, ${count}); setIRQ(&A); asm_cli(); asm_nop(); asm_sei(); restoreIRQ();`,
        ),
      );
    },
    60_000,
  );

  // Two live installs restore C's predecessor first, then B's predecessor.
  it("accepts two nested predecessors restored in reverse installation order", async () => {
    await expectAccepted(
      program(`interrupt function B(): void {}
interrupt function C(): void {}
interrupt function A(): void {
  setIRQ(&B);
  setIRQExclusive(&C);
  restoreIRQ();
  restoreIRQ();
}`),
    );
  }, 60_000);

  // The source-handler cycle is finite because each masked invocation restores its own install.
  it("accepts mutually installing masked handlers with balanced restores", async () => {
    await expectAccepted(
      program(`interrupt function A(): void { setIRQ(&B); restoreIRQ(); }
interrupt function B(): void { setIRQ(&A); restoreIRQ(); }`),
    );
  }, 60_000);

  // Repeated handler identity alone does not make a masked, balanced install unbounded.
  it("accepts a masked handler that temporarily installs itself", async () => {
    await expectAccepted(program(`interrupt function A(): void { setIRQ(&A); restoreIRQ(); }`));
  }, 60_000);

  // A handler cannot consume the install that its interrupted caller still owns.
  it("rejects a handler-only restore followed by the mainline restore", async () => {
    await expectRejected(program(`interrupt function A(): void { restoreIRQ(); }`));
  }, 60_000);

  // A join must have the same complete vector ownership on both incoming paths.
  it("rejects a branch that leaves B installed", async () => {
    await expectRejected(
      program(`interrupt function B(): void {}
interrupt function A(): void {
  if (peek($0400) == 0) { setIRQ(&B); }
}`),
    );
  }, 60_000);

  // Writing either byte of the active CINV word invalidates a helper's saved predecessor.
  it.each(["$0314", "$0315"])(
    "rejects restore after a raw write to %s",
    async (address) => {
      await expectRejected(
        program(`interrupt function B(): void {}
interrupt function A(): void {
  setIRQ(&B);
  poke(${address}, peek(${address}));
  restoreIRQ();
}`),
      );
    },
    60_000,
  );

  // An unrelated raw byte write does not change IRQ-vector ownership.
  it("accepts a neighboring non-vector raw write before restore", async () => {
    await expectAccepted(
      program(`interrupt function B(): void {}
interrupt function A(): void {
  setIRQ(&B);
  poke($0400, peek($0400));
  restoreIRQ();
}`),
    );
  }, 60_000);

  // An unmatched self-install still has no finite ownership or stack bound.
  it("retains the unbounded self-install diagnostic and both installation spans", async () => {
    const source =
      "module Game; import { setIRQ, restoreIRQ } from c64.system; interrupt function handler(): void { setIRQ(&handler); } function main(): void { setIRQ(&handler); restoreIRQ(); }";
    await withProfileProject(source, primaryProfile, async (project, root) => {
      const result = await buildProject({ project });
      expect(result.kind).toBe("failure");
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(errors.map(({ code }) => code)).toEqual(["E10245"]);
      expect(errors[0]).toMatchObject({
        code: "E10245",
        severity: "error",
        pointer: null,
        message: expect.stringMatching(
          /^Execution path '[^']*handler[^']*' can overlap or consume hardware stack without a static bound — use a bounded interrupt\/callback design$/u,
        ),
        primarySpan: profileSpan(source, "setIRQ(&handler)"),
      });
      expect(errors[0]?.related.map(({ span }) => span)).toEqual([
        profileSpan(source, "setIRQ(&handler)", 1),
      ]);
      expect(result).not.toHaveProperty("generation");
      await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
    });
  }, 60_000);
});
