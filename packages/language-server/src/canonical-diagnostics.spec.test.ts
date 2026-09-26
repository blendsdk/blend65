import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeProjectOverlay, loadProject } from "@blend65/compiler/frontend";
import { describe, expect, it } from "vitest";

describe("editor canonical diagnostics before rendering", () => {
  // Unsaved edits use the same exact records as the corresponding saved frontend snapshot.
  it.each([
    [
      "UTF-8 source span",
      "module Game; /* £ */ function main(): void { poke($0400, absent); }",
      "E10239",
    ],
    [
      "edited raw asset path",
      'module Game; const DATA: byte[] = embed("changed.bin"); function main(): void {}',
      "E10130",
    ],
  ])("should preserve byte-identical diagnostics for %s", async (_name, edited, code) => {
    const root = await mkdtemp(join(tmpdir(), "blend65-editor-canonical-"));
    try {
      await mkdir(join(root, "src"));
      await mkdir(join(root, "assets"));
      await writeFile(join(root, "assets/original.bin"), Uint8Array.of(7));
      await writeFile(
        join(root, "src/game.blend"),
        'module Game; const DATA: byte[] = embed("original.bin"); function main(): void {}',
      );
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "editor-diagnostics",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          assetPaths: ["assets"],
          outDir: "out",
          optimization: "none",
        }),
      );
      const loaded = await loadProject({ cwd: root });
      if (loaded.kind !== "success") throw new Error(JSON.stringify(loaded.diagnostics));
      const overlay = await analyzeProjectOverlay(loaded.snapshot, [
        { sourceId: "src/game.blend", text: edited },
      ]);
      await writeFile(join(root, "src/game.blend"), edited);
      const saved = await loadProject({ cwd: root });
      if (saved.kind !== "success") throw new Error(JSON.stringify(saved.diagnostics));
      const analyzed = await analyzeProjectOverlay(saved.snapshot, []);
      expect(overlay.kind).toBe("error");
      expect(overlay.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([code]);
      expect(Buffer.from(JSON.stringify(overlay.diagnostics))).toEqual(
        Buffer.from(JSON.stringify(analyzed.diagnostics)),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
