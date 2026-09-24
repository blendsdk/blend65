import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { checkProject } from "@blend65/compiler";
import { analyzeProjectOverlay, loadProject } from "@blend65/compiler/frontend";
import { inspectImportBoundary } from "../import-boundary.js";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const temporaryRoots: string[] = [];

/** Place a project input at its exact relative path under a disposable checkout. */
async function put(root: string, name: string, content: string | Uint8Array): Promise<void> {
  const path = join(root, name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("frontend consumer boundary", () => {
  // The language server must use a frontend path that cannot reach machine or publication owners.
  it("should keep the real frontend and editor import graph backend-free", async () => {
    expect(await inspectImportBoundary(repository)).toEqual([]);
  });

  // An unsaved asset-path edit and the same saved file must produce identical compiler records.
  it("should match check and overlay diagnostics after an embedded asset path is edited", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-frontend-boundary-"));
    temporaryRoots.push(root);
    await put(
      root,
      "blend65.json",
      JSON.stringify({
        schemaVersion: 1,
        name: "asset-diagnostics",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        assetPaths: ["assets"],
        outDir: "out",
      }),
    );
    const original = 'module Game; const DATA: byte[] = embed("old.bin"); function main(): void {}';
    const edited =
      'module Game; const DATA: byte[] = embed("edited.bin"); function main(): void {}';
    await put(root, "src/game.blend", original);
    await put(root, "assets/old.bin", Uint8Array.from([1]));

    const loaded = await loadProject({ cwd: root });
    expect(loaded.kind).toBe("success");
    if (loaded.kind !== "success") return;
    const sourceId = loaded.snapshot.sources[0]?.sourceId;
    expect(sourceId).toBeDefined();
    if (sourceId === undefined) return;
    const overlay = await analyzeProjectOverlay(loaded.snapshot, [{ sourceId, text: edited }]);

    await put(root, "src/game.blend", edited);
    const checked = await checkProject({ project: join(root, "blend65.json") });
    expect(checked.kind).toBe("failure");
    expect(checked.diagnostics.map(({ code }) => code)).toEqual(["E10130"]);
    expect(overlay.diagnostics).toEqual(checked.diagnostics);
  });

  // An invalid source argument has one canonical language error before either consumer renders it.
  it("should match check and overlay diagnostics for an invalid embedded-source argument", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-frontend-embed-"));
    temporaryRoots.push(root);
    await put(
      root,
      "blend65.json",
      JSON.stringify({
        schemaVersion: 1,
        name: "embed-source-error",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        assetPaths: ["assets"],
        outDir: "out",
      }),
    );
    await put(root, "assets/old.bin", Uint8Array.from([1]));
    await put(
      root,
      "src/game.blend",
      'module Game; const DATA: byte[1] = embed("old.bin"); function main(): void {}',
    );
    const loaded = await loadProject({ cwd: root });
    expect(loaded.kind).toBe("success");
    if (loaded.kind !== "success") return;
    const sourceId = loaded.snapshot.sources[0]?.sourceId;
    expect(sourceId).toBeDefined();
    if (sourceId === undefined) return;
    const invalid = "module Game; const DATA: byte[1] = embed(123); function main(): void {}";
    const overlay = await analyzeProjectOverlay(loaded.snapshot, [{ sourceId, text: invalid }]);

    await put(root, "src/game.blend", invalid);
    const checked = await checkProject({ project: join(root, "blend65.json") });
    expect(checked.kind).toBe("failure");
    expect(checked.diagnostics.map(({ code }) => code)).toEqual(["E10136"]);
    expect(overlay.diagnostics).toEqual(checked.diagnostics);
  });
});
