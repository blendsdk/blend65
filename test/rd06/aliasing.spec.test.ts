import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { withProject } from "./project-fixture.js";

const fixture = readFileSync(
  join(process.cwd(), "test/rd06/fixtures/public/koala/koala-patterned.kla"),
);

describe("native asset aliasing", () => {
  // Two declarations of one selector share a single resident object and warn.
  it("should merge duplicate selector declarations into one asset", async () => {
    const source = `module Game;
place(at: $2000) const FIRST: byte[] = embed("level.kla", "bitmap");
place(at: $2000) const SECOND: byte[] = embed("level.kla", "bitmap");
function main(): void { poke($0400, FIRST[0]); poke($0401, SECOND[1]); }
`;
    await withProject(source, [{ path: "level.kla", bytes: fixture }], async (project) => {
      const built = await buildProject({ project });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Expected the aliased build");
      expect(built.diagnostics.map(({ code }) => code)).toContain("W10151");
      const assets = JSON.parse(
        await readFile(join(built.generation.directory, ".assets.json"), "utf8"),
      ) as { assets: { selector: string; emittedBytes: number }[] };
      expect(assets.assets).toHaveLength(1);
      expect(assets.assets[0]).toMatchObject({ selector: "bitmap", emittedBytes: 8000 });
      const debug = JSON.parse(
        await readFile(join(built.generation.directory, ".debug.json"), "utf8"),
      ) as { symbols: { kind: string; labels: string[] }[] };
      const assetSymbols = debug.symbols.filter(({ kind }) => kind === "asset");
      expect(assetSymbols).toHaveLength(1);
      expect(assetSymbols[0]?.labels).toHaveLength(1);
      const prg = await readFile(
        join(built.generation.directory, built.generation.primaryArtifact),
      );
      const bitmap = Buffer.from(fixture.subarray(2, 8002));
      const first = prg.indexOf(bitmap);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(prg.indexOf(bitmap, first + 1)).toBe(-1);
    });
  }, 60_000);
});
