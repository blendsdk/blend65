import { access } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject, checkProject } from "@blend65/compiler";
import { profileSpan, readProfileArtifacts, withProfileProject } from "./profile-fixture.js";

/** PAL/NTSC and SID selection must not change predecessor lifetime semantics. */
const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];
/** Re-entry must use the existing canonical diagnostic rather than a new source restriction. */
const reentrancyMessage =
  /^Execution path '[^']+' has unbounded private-storage overlap, disallowed unbounded stack use, or unproved generated reentrancy$/;
const imports = "import { setNMI, restoreNMI, setIRQ, restoreIRQ } from c64.system;";

/** Check admission through final storage closure, then require a real reconciled ACME build. */
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

/** Re-entry captures A first and B next while the first saved IRQ predecessor remains observable. */
function changedCaptureSource(throughHelper: boolean): string {
  const mutation = "setIRQ(&B); restoreIRQ();";
  return `module Game;
${imports}
interrupt function A(): void {}
interrupt function B(): void {}
${throughHelper ? `function changeIRQ(): void { ${mutation} }` : ""}
interrupt function N(): void { ${throughHelper ? "changeIRQ();" : mutation} }
function main(): void { setIRQ(&A); setNMI(&N); restoreNMI(); restoreIRQ(); }`;
}

describe.each(profiles)("cooperative NMI lifetime on %s", (profile) => {
  // Mainline suspension prevents its next logical pop from racing a suspended route observer.
  it("should admit finite predecessor nesting when main installs two empty handlers", async () => {
    await expectAdmitted(
      `module Game;
${imports}
interrupt function B(): void {}
interrupt function C(): void {}
function main(): void { setNMI(&B); setNMI(&C); restoreNMI(); restoreNMI(); }`,
      profile,
    );
  });

  // Equal empty ownership at both branches and each backedge permits an ordinary finite loop.
  it("should admit balanced ownership when a helper uses conditionals and a finite loop", async () => {
    await expectAdmitted(
      `module Game;
${imports}
interrupt function B(): void {}
interrupt function C(): void {}
function installBalanced(): void {
  if (peek($0400) == 0) { setNMI(&B); restoreNMI(); }
  else { setNMI(&C); restoreNMI(); }
  for (let index: byte = 0; index < 2; index += 1) { setNMI(&B); restoreNMI(); }
}
function main(): void { installBalanced(); }`,
      profile,
    );
  });

  // A self-masked IRQ has finite activation demand, unlike unrestricted NMI-origin mutation.
  it("should admit distinct finite bindings when IRQ temporarily installs over main's NMI route", async () => {
    await expectAdmitted(
      `module Game;
${imports}
interrupt function B(): void {}
interrupt function C(): void {}
interrupt function onIRQ(): void { setNMI(&C); restoreNMI(); }
function main(): void {
  asm_php(); asm_sei(); asm_nop(); setNMI(&B); setIRQ(&onIRQ);
  asm_cli(); asm_nop(); asm_sei(); asm_nop(); restoreIRQ(); restoreNMI(); asm_plp();
}`,
      profile,
    );
  });

  // Ordinary IRQ-only slot behavior must remain available under the existing finite mask proof.
  it("should preserve finite IRQ-only admission when IRQ installs and restores another IRQ", async () => {
    await expectAdmitted(
      `module Game;
${imports}
interrupt function B(): void {}
interrupt function A(): void { setIRQ(&B); restoreIRQ(); }
function main(): void { setIRQ(&A); restoreIRQ(); }`,
      profile,
    );
  });

  // C chains to suspended B, which can create another C continuation rather than repeat one binding.
  it("should reject generated continuation growth when NMI installs and pops another NMI", async () => {
    const source = `module Game;
${imports}
interrupt function C(): void {}
interrupt function B(): void { setNMI(&C); restoreNMI(); }
function main(): void { setNMI(&B); restoreNMI(); }`;
    await withProfileProject(source, profile, async (project, root) => {
      const checked = await checkProject({ project });
      const built = await buildProject({ project, optimization: "none" });
      for (const result of [checked, built]) {
        expect(result.kind).toBe("failure");
        expect(result).not.toHaveProperty("generation");
        const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
        expect(errors).toHaveLength(1);
        expect(errors[0]!.code).toBe("E10245");
        expect(errors[0]!.message).toMatch(reentrancyMessage);
        expect(errors[0]!.primarySpan?.sourceId).toBe("src/game.blend");
      }
      await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
    });
  });

  // A logical restore cannot erase observers of a physical word suspended by a later NMI arrival.
  it.each([
    ["direct installation", false],
    ["an ordinary helper", true],
  ] as const)(
    "should report the complete changed-capture cycle when %s re-enters NMI",
    async (_condition, throughHelper) => {
      const source = changedCaptureSource(throughHelper);
      await withProfileProject(source, profile, async (project, root) => {
        const checked = await checkProject({ project });
        const built = await buildProject({ project, optimization: "none" });
        for (const result of [checked, built]) {
          expect(result.kind).toBe("failure");
          expect(result).not.toHaveProperty("generation");
          const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
          expect(errors).toHaveLength(1);
          const diagnostic = errors[0]!;
          expect(diagnostic.code).toBe("E10245");
          expect(diagnostic.message).toMatch(reentrancyMessage);
          const changed = profileSpan(source, "setIRQ(&B)");
          expect(diagnostic.primarySpan).toEqual(changed);
          const path = diagnostic.related.map((related) => JSON.stringify(related.span));
          const initial = path.indexOf(JSON.stringify(profileSpan(source, "setIRQ(&A)")));
          const owner = path.indexOf(JSON.stringify(profileSpan(source, "setNMI(&N)")));
          const captures = path.flatMap((site, index) =>
            site === JSON.stringify(changed) ? [index] : [],
          );
          expect(initial).toBeGreaterThanOrEqual(0);
          expect(owner).toBeGreaterThan(initial);
          expect(captures.length).toBeGreaterThanOrEqual(2);
          expect(captures[0]).toBeGreaterThan(owner);
          expect(captures[1]).toBeGreaterThan(captures[0]!);
          if (throughHelper) {
            // The declaration contains the same text; the second occurrence is the source call edge.
            const edge = JSON.stringify(profileSpan(source, "changeIRQ()", 1));
            const edges = path.flatMap((site, index) => (site === edge ? [index] : []));
            expect(edges.length).toBeGreaterThanOrEqual(2);
            expect(edges[0]).toBeGreaterThan(owner);
            expect(edges[0]).toBeLessThan(captures[0]!);
            expect(edges[1]).toBeGreaterThan(captures[0]!);
            expect(edges[1]).toBeLessThan(captures[1]!);
          }
        }
        await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
      });
    },
  );
});
