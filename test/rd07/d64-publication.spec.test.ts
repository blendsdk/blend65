import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { withProject } from "../rd06/project-fixture.js";

/** Build one D64 project and inspect its published generation before cleanup. */
async function inspectD64<T>(
  source: string,
  inspect: (input: {
    readonly primaryArtifact: string;
    readonly names: readonly string[];
    readonly packageEvidence: {
      kind: string;
      artifactPath: string;
      imageBytes: number;
      loaderStrategyId: string;
      components: { id: string; bytes: number }[];
    };
    readonly loadStates: { unitId: string }[];
  }) => T,
): Promise<T> {
  return withProject(
    source,
    [],
    async (project) => {
      const built = await buildProject({ project });
      if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
      const evidence = JSON.parse(
        await readFile(join(built.generation.directory, ".build.json"), "utf8"),
      ) as { package: Parameters<typeof inspect>[0]["packageEvidence"] };
      const memory = JSON.parse(
        await readFile(join(built.generation.directory, ".memory.json"), "utf8"),
      ) as { loadStates: { unitId: string }[] };
      return inspect({
        primaryArtifact: built.generation.primaryArtifact,
        names: (await readdir(built.generation.directory)).sort(),
        packageEvidence: evidence.package,
        loadStates: memory.loadStates,
      });
    },
    "c64-pal-d64-kernal-6581",
  );
}

describe("D64 publication", () => {
  // The generation is exactly eight files and the D64 is the one primary artifact.
  it("should publish the eight-file D64 generation", async () => {
    const observed = await inspectD64(
      [
        "module Game;",
        "",
        "loadable const DATA: byte[4] = [1, 2, 3, 4];",
        "let target: byte[4];",
        "function main(): void { if (c64.loader.load(DATA, target)) { let x: byte = target[0]; } }",
        "",
      ].join("\n"),
      ({ primaryArtifact, names, packageEvidence }) => ({
        primaryArtifact,
        names,
        packageEvidence,
      }),
    );
    expect(observed.primaryArtifact).toBe("rd06-fixture.d64");
    expect(observed.names).toEqual([
      ".asm",
      ".assets.json",
      ".build.json",
      ".costs.json",
      ".debug.json",
      ".labels",
      ".memory.json",
      "rd06-fixture.d64",
    ]);
    expect(observed.packageEvidence).toMatchObject({
      kind: "d64",
      artifactPath: "rd06-fixture.d64",
      imageBytes: 174_848,
      loaderStrategyId: "kernal-sequential-uncompressed",
    });
    expect(observed.packageEvidence.components).toHaveLength(2);
    expect(observed.packageEvidence.components[0]!.id).toBe("boot");
  });

  // Only a unit referenced by a reachable load call is packaged.
  it("should omit an unreachable unit and keep a reachable local unit", async () => {
    const observed = await inspectD64(
      [
        "module Game;",
        "",
        "loadable const REACHED: byte[2] = [7, 8];",
        "loadable const UNREACHED: byte[2] = [9, 10];",
        "let target: byte[2];",
        "function main(): void { if (c64.loader.load(REACHED, target)) { let x: byte = target[0]; } }",
        "function unused(): void { let other: byte[2]; c64.loader.load(UNREACHED, other); }",
        "",
      ].join("\n"),
      ({ packageEvidence, loadStates }) => ({ packageEvidence, loadStates }),
    );
    expect(observed.packageEvidence.components).toHaveLength(2);
    expect(observed.packageEvidence.components[1]!.bytes).toBe(2 + 2);
    expect(observed.loadStates).toHaveLength(1);
    expect(observed.loadStates[0]!.unitId).toBe(observed.packageEvidence.components[1]!.id);
  });

  // The resident PRG profiles keep their existing primary artifact and no disk records.
  it("should leave the PRG path unchanged", async () => {
    const observed = await withProject(
      "module Game;\n\nlet value: byte = 1;\nfunction main(): void { value = 2; }\n",
      [],
      async (project) => {
        const built = await buildProject({ project });
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        const evidence = JSON.parse(
          await readFile(join(built.generation.directory, ".build.json"), "utf8"),
        ) as { package: { kind: string } };
        const memory = JSON.parse(
          await readFile(join(built.generation.directory, ".memory.json"), "utf8"),
        ) as { loadStates: unknown[] };
        return {
          primaryArtifact: built.generation.primaryArtifact,
          packageKind: evidence.package.kind,
          loadStates: memory.loadStates,
        };
      },
      "c64-pal-prg-kernal-6581",
    );
    expect(observed.primaryArtifact.endsWith(".prg")).toBe(true);
    expect(observed.packageKind).toBe("prg");
    expect(observed.loadStates).toEqual([]);
  });
});
