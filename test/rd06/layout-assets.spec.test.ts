import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { patternedBytes, withProject } from "./project-fixture.js";

const MAIN = "\nfunction main(): void {}\n";

describe("resident layout asset constraints", () => {
  // 128 sprite records fill half of bank 0 and remain visible.
  it("should fit 128 sprite records in bank 0", async () => {
    const source = `module Game;
const SPRITES: byte[] = embed("sprites.bin");
function main(): void { poke($D015, 1); poke($D027, c64.vic.vicSpriteBlock(&SPRITES)); }
`;
    await withProject(
      source,
      [{ path: "sprites.bin", bytes: patternedBytes(128 * 64, 3) }],
      async (project) => {
        const built = await buildProject({ project });
        expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
          "success",
        );
        if (built.kind !== "success") throw new Error("Expected 128 sprites to fit");
        const assets = JSON.parse(
          await readFile(join(built.generation.directory, ".assets.json"), "utf8"),
        ) as { assets: { placement: { range: { start: number; visibility: string[] } } }[] };
        expect(assets.assets[0]?.placement.range.start).toBe(0x2000);
        expect(assets.assets[0]?.placement.range.visibility).toEqual(["vic"]);
      },
    );
  }, 60_000);

  // 256 sprite records cannot coexist with the active screen in one 16-KiB bank.
  it("should reject 256 sprite records with the active screen", async () => {
    const source = `module Game;
const SPRITES: byte[] = embed("sprites.bin");
function main(): void { poke($D015, 1); poke($D027, c64.vic.vicSpriteBlock(&SPRITES)); }
`;
    await withProject(
      source,
      [{ path: "sprites.bin", bytes: patternedBytes(256 * 64, 5) }],
      async (project) => {
        const built = await buildProject({ project });
        expect(built.kind).toBe("failure");
        const conflict = built.diagnostics.find(({ code }) => code === "E10273");
        expect(conflict).toBeDefined();
      },
    );
  }, 60_000);
});
