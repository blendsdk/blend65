import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  profileRecord,
  profileSpan,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

const targets = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];

const source = (global: boolean, unsafe: boolean) => `module Game;
import { setNMI, restoreNMI } from c64.system;
${global ? "let x: byte = 0;" : ""}
interrupt function empty(): void {}
export function main(): void {
  setNMI(&empty);
  ${global ? "" : "let x: byte = 0;"}
  let address: word = peek($c012) != 0 ? word(&x) : ${unsafe ? "$0318" : "word(&x)"};
  poke(address, 1);
  restoreNMI();
}
`;

const local = source(false, false);
const global = source(true, false);
const unsafe = source(false, true);

describe.each(targets)("owned-address conditional merges on %s", (target) => {
  for (const [name, fixture] of [
    ["local", local],
    ["module", global],
  ] as const) {
    it(`accepts agreeing ${name} owned-place branches`, async () => {
      await withProfileProject(fixture, target, async (project) => {
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (built.kind !== "success") throw new Error("Expected a successful public build");
        const artifacts = await readProfileArtifacts(built);
        expect(artifacts.prg.length).toBeGreaterThan(2);
        expect(artifacts.assembly.length).toBeGreaterThan(0);
        expect(artifacts.labels.length).toBeGreaterThan(0);
        expect(profileRecord(artifacts.costs.totals).programBytes).toBe(artifacts.prg.length - 2);
      });
    });
  }

  it("rejects a conditional branch that can select the owned NMI vector", async () => {
    await withProfileProject(unsafe, target, async (project) => {
      const built = await buildProject({ project, optimization: "none" });
      expect(built.kind).toBe("failure");
      expect(built.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "E10278",
            severity: "error",
            primarySpan: profileSpan(unsafe, "poke(address, 1)"),
          }),
        ]),
      );
    });
  });
});
