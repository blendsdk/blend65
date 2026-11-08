import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { withProject } from "./project-fixture.js";

const fixtures = join(process.cwd(), "test/rd06/fixtures/public");

/** Read one committed synthetic fixture. */
function fixture(path: string, projectPath: string) {
  return { path: projectPath, bytes: readFileSync(join(fixtures, path)) };
}

describe("asset sidecar completeness", () => {
  // A scalar selector has a compileTime record and no resident memory interval.
  it("should publish a zero-byte scalar record without a memory interval", async () => {
    const source = `module Game;
const INIT: word = embed("music.sid", "init_address");
function main(): void { poke($0400, byte(INIT)); }
`;
    await withProject(source, [fixture("psid/psid-v1-fixed.sid", "music.sid")], async (project) => {
      const built = await buildProject({ project });
      if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
      const assets = JSON.parse(
        await readFile(join(built.generation.directory, ".assets.json"), "utf8"),
      ) as { assets: { id: string; payloadBytes: number; placement: { kind: string } }[] };
      const memory = JSON.parse(
        await readFile(join(built.generation.directory, ".memory.json"), "utf8"),
      ) as { intervals: { kind: string; origin: { kind: string } }[] };
      expect(assets.assets[0]).toMatchObject({
        payloadBytes: 0,
        placement: { kind: "compileTime" },
      });
      expect(
        memory.intervals.some(({ kind, origin }) => kind === "asset" && origin.kind === "asset"),
      ).toBe(false);
    });
  }, 60_000);

  // A VIC-visible resident asset emits constraints, exact alignment and visibility.
  it("should publish resident constraints, alignment and visibility together", async () => {
    const source = `module Game;
place(at: $2000) const BITMAP: byte[] = embed("level.kla", "bitmap");
place(at: $0C00) const SCREEN: byte[] = embed("level.kla", "screen");
function main(): void { poke($D018, c64.vic.vicBitmapSelect(&BITMAP) | c64.vic.vicScreenSelect(&SCREEN)); }
`;
    await withProject(
      source,
      [fixture("koala/koala-patterned.kla", "level.kla")],
      async (project) => {
        const built = await buildProject({ project });
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        const assets = JSON.parse(
          await readFile(join(built.generation.directory, ".assets.json"), "utf8"),
        ) as {
          assets: {
            selector: string;
            constraints: unknown[];
            placement: { range: { alignmentBytes: number; visibility: string[] } };
          }[];
        };
        const bitmap = assets.assets.find(({ selector }) => selector === "bitmap")!;
        expect(bitmap.placement.range).toMatchObject({
          alignmentBytes: 8192,
          visibility: ["vic"],
        });
        expect(bitmap.constraints).toEqual(
          expect.arrayContaining([
            { kind: "align", origin: "handler", bytes: 8192 },
            { kind: "visibility", origin: "handler", consumer: "vic", conditionId: "vic" },
            { kind: "at", origin: "source", addressSpaceId: "cpu16", start: 0x2000 },
          ]),
        );
        const memory = JSON.parse(
          await readFile(join(built.generation.directory, ".memory.json"), "utf8"),
        ) as { intervals: { id: string; vic?: { visibility: string[] } }[] };
        const interval = memory.intervals.find(({ id }) => id.startsWith("asset."))!;
        expect(interval.vic?.visibility).toEqual(["vic"]);
        const build = JSON.parse(
          await readFile(join(built.generation.directory, ".build.json"), "utf8"),
        ) as { semanticInputs: { assets: { path: string; sha256: string }[] } };
        expect(build.semanticInputs.assets).toHaveLength(1);
      },
    );
  }, 60_000);
});
