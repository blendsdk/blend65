import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject, checkProject } from "@blend65/compiler";
import { withProject, type ProjectAsset } from "./project-fixture.js";

const MAIN = "\nfunction main(): void {}\n";
const fixtureRoot = join(process.cwd(), "test/rd06/fixtures/public/koala");

/** Read one committed Koala fixture under the requested project name. */
function koala(name: string, path = "level.kla"): ProjectAsset {
  return { path, bytes: readFileSync(join(fixtureRoot, `${name}.kla`)) };
}

describe("Koala frontend integration", () => {
  // Requested display components place at explicit addresses and derive their $D018 fields.
  it("should place bitmap and screen and combine their pure field constants", async () => {
    const source = `module Game;
place(at: $2000) const BITMAP: byte[] = embed("level.kla", "bitmap");
place(at: $0C00) const SCREEN: byte[] = embed("level.kla", "screen");
function main(): void {
  poke($D018, c64.vic.vicBitmapSelect(&BITMAP) | c64.vic.vicScreenSelect(&SCREEN));
}
`;
    await withProject(source, [koala("koala-patterned")], async (project) => {
      const built = await buildProject({ project });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Expected a Koala build");
      const assembly = await readFile(join(built.generation.directory, ".asm"), "utf8");
      // Bitmap $2000 -> 8, screen $0C00 -> $30, folded to one immediate $38.
      expect(assembly).toMatch(/lda #\$38\b/iu);
      expect(assembly).not.toMatch(/ora #\$30/iu);
      const assets = JSON.parse(
        await readFile(join(built.generation.directory, ".assets.json"), "utf8"),
      ) as { assets: { selector: string; placement: { range: { start: number } } }[] };
      const starts = new Map(
        assets.assets.map(({ selector, placement }) => [selector, placement.range.start]),
      );
      expect(Object.fromEntries(starts)).toEqual({ bitmap: 0x2000, screen: 0x0c00 });
    });
  });

  // A charset field derives from its final 2-KiB-aligned address.
  it("should derive the pure charset field", async () => {
    const source = `module Game;
place(at: $2800) const CHARSET: byte[] = embed("charset.bin");
function main(): void { poke($D018, c64.vic.vicCharsetSelect(&CHARSET)); }
`;
    await withProject(
      source,
      [{ path: "charset.bin", bytes: new Uint8Array(2048) }],
      async (project) => {
        const built = await buildProject({ project });
        expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
          "success",
        );
        if (built.kind !== "success") throw new Error("Expected a charset build");
        const assembly = await readFile(join(built.generation.directory, ".asm"), "utf8");
        // $2800 / $0800 = 5, then (5 & 7) << 1 = $0A.
        expect(assembly).toMatch(/lda #\$0a\b/iu);
      },
    );
  });

  // Preserve every source byte, including unused high nibbles.
  it("should preserve Color RAM high nibbles in the emitted image", async () => {
    const source = `module Game;
place(at: $3000) const COLOR: byte[] = embed("level.kla", "color_ram");
${MAIN}`;
    await withProject(source, [koala("koala-color-high-nibble")], async (project) => {
      const built = await buildProject({ project });
      if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
      const image = await readFile(
        join(built.generation.directory, built.generation.primaryArtifact),
      );
      const offset = 2 + 0x3000 - image.readUInt16LE(0);
      expect([...image.subarray(offset, offset + 4)]).toEqual([0xf0, 0xf1, 0xf2, 0xf3]);
    });
  });

  // A source address that violates the bitmap alignment names the required alignment.
  it("should reject a misaligned source bitmap address with the alignment requirement", async () => {
    const source = `module Game;\n\nplace(at: $2100) const BITMAP: byte[] = embed("level.kla", "bitmap");\n${MAIN}`;
    await withProject(source, [koala("koala-zero")], async (project) => {
      const checked = await checkProject({ project });
      expect(checked.kind).toBe("failure");
      const conflict = checked.diagnostics.find(({ code }) => code === "E10273");
      expect(conflict?.message).toContain("8192");
      expect(conflict?.message).not.toMatch(/null-byte/iu);
    });
  });

  // A Koala asset requires an explicit selector.
  it("should reject a missing selector", async () => {
    const source = `module Game;\n\nconst LEVEL: byte[] = embed("level.kla");\n${MAIN}`;
    await withProject(source, [koala("koala-zero")], async (project) => {
      const checked = await checkProject({ project });
      expect(checked.kind).toBe("failure");
      expect(checked.diagnostics.map(({ code }) => code)).toEqual(["E10132"]);
    });
  });

  // Both classic extensions dispatch to the same handler.
  it("should accept the .koa spelling", async () => {
    const source = `module Game;\n\nplace(at: $2000) const BITMAP: byte[] = embed("level.koa", "bitmap");\n${MAIN}`;
    await withProject(source, [koala("koala-zero", "level.koa")], async (project) => {
      const checked = await checkProject({ project });
      expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
    });
  });
});
