import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkProject } from "@blend65/compiler";
import { analyzeProjectOverlay, loadProject } from "@blend65/compiler/frontend";
import type { ProjectDiagnostic, ProjectSnapshot } from "@blend65/compiler/frontend";
import { patternedBytes, withProject, type ProjectAsset } from "./project-fixture.js";

/** Load a real temporary project and return its immutable snapshot. */
async function snapshot(project: string): Promise<ProjectSnapshot> {
  const loaded = await loadProject({ project });
  if (loaded.kind !== "success") throw new Error(JSON.stringify(loaded.diagnostics));
  return loaded.snapshot;
}

/** Check one project and return only its diagnostics. */
async function diagnostics(
  source: string,
  assets: readonly ProjectAsset[] = [],
): Promise<readonly ProjectDiagnostic[]> {
  return withProject(source, assets, async (project) => {
    const checked = await checkProject({ project });
    return checked.kind === "success" ? checked.diagnostics : checked.diagnostics;
  });
}

const MAIN = "\nfunction main(): void {}\n";

describe("frontend asset metadata", () => {
  // A raw file still enters the shared semantic model with complete provenance.
  it("should expose exact handler, selector and type metadata for raw bytes", async () => {
    const bytes = patternedBytes(96, 3);
    const source = `module Game;\n\nconst TABLE: byte[] = embed("table.bin");\n${MAIN}`;
    await withProject(source, [{ path: "table.bin", bytes }], async (project) => {
      const analyzed = await analyzeProjectOverlay(await snapshot(project), []);
      expect(analyzed.kind, JSON.stringify(analyzed.diagnostics)).toBe("complete");
      if (analyzed.kind !== "complete") throw new Error("Expected complete analysis");
      expect(analyzed.program.assets).toHaveLength(1);
      const asset = analyzed.program.assets[0]!;
      expect(asset.kind).toBe("resident-asset");
      if (asset.kind !== "resident-asset") throw new Error("Expected resident bytes");
      expect(asset.bytes).toEqual([...bytes]);
      expect(asset.sourcePath).toBe("assets/table.bin");
      expect(asset.handler).toMatchObject({
        handlerKey: "raw",
        handlerVersion: "1",
        selector: "raw",
        representation: "raw",
      });
      expect(asset.handler.selectors).toEqual([
        {
          name: "raw",
          type: expect.objectContaining({ kind: "array" }),
          available: true,
          default: true,
        },
      ]);
      expect(asset.constraints).toEqual([]);
    });
  });

  // A registered native extension never falls back to raw bytes on a malformed file.
  it("should reject a malformed registered .spd file before raw fallback", async () => {
    const source = `module Game;\n\nconst SPRITES: byte[] = embed("player.spd");\n${MAIN}`;
    const result = await diagnostics(source, [{ path: "player.spd", bytes: patternedBytes(64) }]);
    expect(result.map(({ code }) => code)).toEqual(["E10204"]);
    expect(result[0]?.message).toMatch(/SPD|version|handler/iu);
  });

  // A native asset may initialize a loadable const and is validated by its handler.
  it("should accept a native loadable const through the handler", async () => {
    const bytes = readFileSync(
      join(process.cwd(), "test/rd06/fixtures/public/spritepad/synthetic-basic.spd"),
    );
    const source = `module Game;\n\nloadable const SPRITES: byte[] = embed("player.spd");\n${MAIN}`;
    await withProject(source, [{ path: "player.spd", bytes }], async (project) => {
      const checked = await checkProject({ project });
      expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
    });
  });

  // Missing files name only project-relative ordered roots, never the host path.
  it("should report a missing file with project-relative search roots", async () => {
    const source = `module Game;\n\nconst TABLE: byte[] = embed("missing.bin");\n${MAIN}`;
    await withProject(source, [], async (project, root) => {
      const checked = await checkProject({ project });
      expect(checked.kind).toBe("failure");
      const diagnostic = checked.diagnostics[0]!;
      expect(diagnostic.code).toBe("E10130");
      expect(diagnostic.message).not.toContain(root);
      expect(diagnostic.message).toContain("'src'");
      expect(diagnostic.message).toContain("'assets'");
    });
  });

  // Two declarations of one file, selector and representation share one object.
  it("should merge duplicate declarations and emit one alias warning", async () => {
    const source = `module Game;\n\nconst FIRST: byte[] = embed("table.bin");\nconst SECOND: byte[] = embed("table.bin");\n${MAIN}`;
    const bytes = patternedBytes(32, 5);
    await withProject(source, [{ path: "table.bin", bytes }], async (project) => {
      const analyzed = await analyzeProjectOverlay(await snapshot(project), []);
      expect(analyzed.kind).toBe("complete");
      if (analyzed.kind !== "complete") throw new Error("Expected complete analysis");
      expect(analyzed.program.assets).toHaveLength(1);
      expect(analyzed.diagnostics.map(({ code }) => code)).toContain("W10151");
    });
  });

  // Two different files with equal bytes stay distinct canonical objects.
  it("should keep two inputs with identical bytes as distinct assets", async () => {
    const bytes = patternedBytes(48, 7);
    const source = `module Game;\n\nconst FIRST: byte[] = embed("first.bin");\nconst SECOND: byte[] = embed("second.bin");\n${MAIN}`;
    await withProject(
      source,
      [
        { path: "first.bin", bytes },
        { path: "second.bin", bytes },
      ],
      async (project) => {
        const analyzed = await analyzeProjectOverlay(await snapshot(project), []);
        expect(analyzed.kind).toBe("complete");
        if (analyzed.kind !== "complete") throw new Error("Expected complete analysis");
        expect(analyzed.program.assets).toHaveLength(2);
        expect(new Set(analyzed.program.assets.map(({ id }) => id)).size).toBe(2);
      },
    );
  });

  // The containing source directory wins over a configured asset root.
  it("should resolve a source-relative file before an asset root", async () => {
    const nearby = patternedBytes(16, 11);
    const configured = patternedBytes(16, 13);
    const source = `module Game;\n\nconst TABLE: byte[] = embed("shadow.bin");\n${MAIN}`;
    await withProject(
      source,
      [{ path: "shadow.bin", bytes: configured }],
      async (project, root) => {
        const { writeFile } = await import("node:fs/promises");
        await writeFile(`${root}/src/shadow.bin`, nearby);
        const analyzed = await analyzeProjectOverlay(await snapshot(project), []);
        expect(analyzed.kind).toBe("complete");
        if (analyzed.kind !== "complete") throw new Error("Expected complete analysis");
        const asset = analyzed.program.assets[0]!;
        expect(asset.sourcePath).toBe("src/shadow.bin");
        if (asset.kind !== "resident-asset") throw new Error("Expected resident bytes");
        expect(asset.bytes).toEqual([...nearby]);
      },
    );
  });

  // Embedded bytes cannot stand in for a scalar; the remedy is a scalar component.
  it("should reject embedded data where a scalar is required", async () => {
    const source = `module Game;\n\nconst VALUE: byte = embed("table.bin");\n${MAIN}`;
    const result = await diagnostics(source, [{ path: "table.bin", bytes: patternedBytes(4) }]);
    expect(result.map(({ code }) => code)).toEqual(["E10142"]);
    expect(result[0]?.message).toMatch(/scalar component/iu);
  });

  // Nonliteral path and selector arguments keep their established diagnostics.
  it("should reject nonliteral path and selector arguments before dispatch", async () => {
    const source = `module Game;\n\nconst NAME: byte[] = embed(path());\nconst TABLE: byte[] = embed("table.bin", selector());\nfunction path(): byte[] { return [1]; }\nfunction selector(): byte[] { return [1]; }\n${MAIN}`;
    const result = await diagnostics(source, [{ path: "table.bin", bytes: patternedBytes(8) }]);
    expect(result.map(({ code }) => code)).toEqual(expect.arrayContaining(["E10136", "E10250"]));
  });
});
