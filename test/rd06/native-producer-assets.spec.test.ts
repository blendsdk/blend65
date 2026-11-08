import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject, checkProject } from "@blend65/compiler";
import { withProject, type ProjectAsset } from "./project-fixture.js";

const producerRoot = "/home/gevik/workdir/github/blend65.ri/apps";
const available = existsSync(producerRoot);
const MAIN = "\nfunction main(): void {}\n";

/** Read one local producer example as a project asset. */
function producer(path: string, projectPath: string): ProjectAsset {
  return { path: projectPath, bytes: readFileSync(join(producerRoot, path)) };
}

const SPD_PATH = "SpritePad C64 3.80 Pro/Examples (SPD5)/Sprite Sheets (Subchrist)/ChromeFont.spd";
const SPD_TILES_PATH =
  "SpritePad C64 3.80 Pro/Examples (SPD5)/Tile Sheets (Subchrist)/Expanded Sprite Test.spd";
const CTM_PATH = "CharPad C64 3.80 Pro/Examples (CTM9)/Maps (Subchrist)/Hexagone (5x5).ctm";

describe.skipIf(!available)("native producer assets in the frontend", () => {
  // SpritePad sprites become one 64-byte-aligned VIC-visible resident object.
  it("should build SpritePad sprites with exact handler evidence", async () => {
    const source = `module Game;\n\nconst SPRITES: byte[] = embed("player.spd");\n${MAIN}`;
    await withProject(source, [producer(SPD_PATH, "player.spd")], async (project) => {
      const built = await buildProject({ project });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Expected SpritePad build");
      const assets = JSON.parse(
        await readFile(join(built.generation.directory, ".assets.json"), "utf8"),
      ) as {
        assets: {
          handler: string;
          selector: string;
          representation: string;
          inputs: { bytes: number }[];
          payloadBytes: number;
          constraints: unknown[];
          placement: { range: { start: number; alignmentBytes: number; visibility: string[] } };
        }[];
      };
      const record = assets.assets.find(({ selector }) => selector === "sprites")!;
      expect(record).toMatchObject({
        handler: "spritepad",
        representation: "spd-sprites",
        payloadBytes: 37 * 64,
        inputs: [{ bytes: 2388 }],
      });
      expect(record.placement.range.start % 64).toBe(0);
      expect(record.placement.range.start).toBeLessThan(0x4000);
      expect(record.placement.range.alignmentBytes).toBe(64);
      expect(record.placement.range.visibility).toEqual(["vic"]);
    });
  }, 60_000);

  // A SpritePad scalar selector remains compile-time-only.
  it("should expose SpritePad count as a scalar record", async () => {
    const source = `module Game;\n\nconst COUNT: word = embed("player.spd", "count");\n${MAIN}`;
    await withProject(source, [producer(SPD_PATH, "player.spd")], async (project) => {
      const built = await buildProject({ project });
      if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
      const assets = JSON.parse(
        await readFile(join(built.generation.directory, ".assets.json"), "utf8"),
      ) as { assets: { selector: string; payloadBytes: number; placement: { kind: string } }[] };
      expect(assets.assets[0]).toMatchObject({
        selector: "count",
        payloadBytes: 0,
        placement: { kind: "compileTime" },
      });
    });
  }, 60_000);

  // CharPad charset is a 2-KiB-aligned VIC-visible asset.
  it("should build a CharPad charset with 2-KiB alignment", async () => {
    const source = `module Game;\n\nconst CHARSET: byte[] = embed("level.ctm", "charset");\n${MAIN}`;
    await withProject(source, [producer(CTM_PATH, "level.ctm")], async (project) => {
      const built = await buildProject({ project });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Expected CharPad build");
      const assets = JSON.parse(
        await readFile(join(built.generation.directory, ".assets.json"), "utf8"),
      ) as {
        assets: {
          handler: string;
          selector: string;
          payloadBytes: number;
          placement: { range: { start: number; alignmentBytes: number; visibility: string[] } };
        }[];
      };
      const record = assets.assets.find(({ selector }) => selector === "charset")!;
      expect(record.handler).toBe("charpad");
      expect(record.payloadBytes).toBe(360);
      expect(record.placement.range.start % 2048).toBe(0);
      expect(record.placement.range.alignmentBytes).toBe(2048);
      expect(record.placement.range.visibility).toEqual(["vic"]);
    });
  }, 60_000);

  // A tile data selector is not VIC-visible and remains ordinary resident data.
  it("should build SpritePad tile data without a VIC visibility claim", async () => {
    const source = `module Game;\n\nconst TILES: word[] = embed("tiles.spd", "tiles");\n${MAIN}`;
    await withProject(source, [producer(SPD_TILES_PATH, "tiles.spd")], async (project) => {
      const built = await buildProject({ project });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Expected tile build");
      const assets = JSON.parse(
        await readFile(join(built.generation.directory, ".assets.json"), "utf8"),
      ) as {
        assets: {
          selector: string;
          logicalType: string;
          shape: number[];
          placement: { range: { visibility: string[] } };
        }[];
      };
      expect(assets.assets[0]?.selector).toBe("tiles");
      expect(assets.assets[0]?.logicalType).toBe("const word[]");
      expect(assets.assets[0]?.shape).toEqual([54]);
      expect(assets.assets[0]?.placement.range.visibility).toEqual([]);
    });
  }, 60_000);

  // A malformed producer file fails through the native handler, never raw fallback.
  it("should reject a malformed producer file with E10204", async () => {
    const bytes = Uint8Array.from([0x53, 0x50, 0x44, 4]);
    const source = `module Game;\n\nconst SPRITES: byte[] = embed("bad.spd");\n${MAIN}`;
    await withProject(source, [{ path: "bad.spd", bytes }], async (project) => {
      const checked = await checkProject({ project });
      expect(checked.kind).toBe("failure");
      expect(checked.diagnostics.map(({ code }) => code)).toEqual(["E10204"]);
    });
  });
});
