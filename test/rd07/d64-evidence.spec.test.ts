import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { withProject } from "../rd06/project-fixture.js";

const SOURCE = [
  "module Game;",
  "",
  "loadable const DATA: byte[4] = [1, 2, 3, 4];",
  "let target: byte[4];",
  "function main(): void { if (c64.loader.load(DATA, target)) { let x: byte = target[0]; } }",
  "",
].join("\n");

describe("D64 load evidence", () => {
  // The memory report names the call site, unit, destination, quiescence and publication point.
  it("should publish one load state record", async () => {
    await withProject(
      SOURCE,
      [],
      async (project) => {
        const built = await buildProject({ project });
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        const memory = JSON.parse(
          await readFile(join(built.generation.directory, ".memory.json"), "utf8"),
        ) as {
          loadStates: {
            callSite: { path: string; startByte: number; endByte: number };
            unitId: string;
            destinationIntervalIds: string[];
            quiescence: { routes: string[]; status: string };
            publicationPoint: { callSite: unknown; resultEdge: string };
          }[];
        };
        expect(memory.loadStates).toHaveLength(1);
        const state = memory.loadStates[0]!;
        expect(state.callSite.path).toBe("src/game.blend");
        expect(state.callSite.endByte).toBeGreaterThan(state.callSite.startByte);
        expect(state.unitId).toMatch(/^[0-9a-f]{64}$/u);
        expect(state.destinationIntervalIds.length).toBeGreaterThan(0);
        expect(state.quiescence).toEqual({ routes: [], status: "proved" });
        expect(state.publicationPoint.resultEdge).toBe("true");
        const build = JSON.parse(
          await readFile(join(built.generation.directory, ".build.json"), "utf8"),
        ) as { package: { components: { id: string }[] } };
        expect(build.package.components.map(({ id }) => id)).toContain(state.unitId);
      },
      "c64-pal-d64-kernal-6581",
    );
  });
});
