import { createHash } from "node:crypto";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

const TARGETS = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];
const HANDLERS = Array.from(
  { length: 4 },
  (_, index) => `interrupt function H${index}(): void { setNMI(&C); restoreNMI(); }`,
).join("\n");
const SCOPES = Array.from(
  { length: 4 },
  (_, index) => `setIRQ(&H${index}); asm_cli(); asm_nop(); asm_sei(); asm_nop(); restoreIRQ();`,
).join("\n  ");
const SOURCE = `module Game;
import { setNMI, restoreNMI, setIRQ, restoreIRQ } from c64.system;
interrupt function B(): void {}
interrupt function C(): void {}
${HANDLERS}
export function main(): void {
  asm_php(); asm_sei(); asm_nop();
  setNMI(&B);
  ${SCOPES}
  restoreNMI(); asm_plp();
}
`;

describe.each(TARGETS)("Sequential finite IRQ scopes on %s", (target) => {
  // Each selected IRQ handler may balance a temporary NMI installation while the outer NMI owner remains live.
  it("should build four sequential IRQ scopes with balanced inner NMI ownership and normal main return", async () => {
    await withProfileProject(SOURCE, target, async (project) => {
      const built = await buildProject({ project, optimization: "none" });
      expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
      if (built.kind !== "success") throw new Error("Expected real ACME publication");
      const artifacts = await readProfileArtifacts(built);
      expect(artifacts.prg.length).toBeGreaterThan(2);
      expect(artifacts.assembly.length).toBeGreaterThan(0);
      expect(artifacts.labels.length).toBeGreaterThan(0);
      for (const sidecar of [artifacts.build, artifacts.memory, artifacts.costs, artifacts.debug])
        expect(Object.keys(sidecar).length).toBeGreaterThan(0);
      expect(profileRecord(artifacts.costs.totals).programBytes).toBe(artifacts.prg.length - 2);
      expect(profileRecords(artifacts.debug.sources)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "src/game.blend",
            byteLength: Buffer.byteLength(SOURCE),
            sha256: createHash("sha256").update(SOURCE).digest("hex"),
          }),
        ]),
      );
    });
  }, 30_000);
});
