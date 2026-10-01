import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Diagnostic } from "vscode-languageserver/node";
import type * as LanguageServer from "vscode-languageserver/node";
import { analyzeProjectOverlay, loadProject } from "@blend65/compiler/frontend";
import { describe, expect, it, vi } from "vitest";

/** Only the editor transport is replaced; filesystem discovery and compiler analysis stay real. */
interface OpenDocument {
  /** Canonical local document URI supplied by the external editor. */
  readonly uri: string;
  /** Current unsaved text, separate from the unchanged host file. */
  readonly getText: () => string;
}

const editor = vi.hoisted(() => ({
  open: new Map<string, OpenDocument>(),
  publications: new Map<string, Diagnostic[]>(),
  changed: (event: { document: OpenDocument }) => {
    void event;
  },
}));

vi.mock("vscode-languageserver/node", async (original) => {
  const actual = await original<typeof LanguageServer>();
  return {
    ...actual,
    createConnection: () => ({
      onInitialize: () => {},
      listen: () => {},
      console: { error: () => {} },
      sendDiagnostics: (value: { uri: string; diagnostics: Diagnostic[] }) => {
        editor.publications.set(value.uri, value.diagnostics);
      },
    }),
    TextDocuments: class {
      /** Return only documents currently admitted by the fake external editor. */
      all() {
        return [...editor.open.values()];
      }
      /** Find the same editor object used to supply unsaved source text. */
      get(uri: string) {
        return editor.open.get(uri);
      }
      /** Capture the real server's content-change callback. */
      onDidChangeContent(callback: typeof editor.changed) {
        editor.changed = callback;
      }
      onDidSave() {}
      onDidClose() {}
      listen() {}
    },
  };
});

/** Analyze an actual project with known editor documents, without creating a reusable harness. */
async function withEditor<T>(
  inspect: (fixture: {
    game: OpenDocument;
    override: OpenDocument;
    libraryPath: string;
  }) => Promise<T>,
) {
  const root = await mkdtemp(join(tmpdir(), "blend65-editor-input é-"));
  editor.open.clear();
  editor.publications.clear();
  vi.resetModules();
  try {
    await import("./server.js");
    const gamePath = join(root, "src/game.blend");
    const overridePath = join(root, "src/override é.blend");
    const collisionPath = join(root, "@blend65/stdlib/c64/input.blend");
    const gameText =
      "module Game; const selected: byte = c64.input.joystickUpMask; function main(): void { poke(1024, selected); }";
    const overrideText = "module c64.input; export const joystickUpMask: byte = 7;";
    for (const [path, text] of [
      [gamePath, gameText],
      [overridePath, overrideText],
      [collisionPath, "module User; export const extra: byte = 2;"],
    ]) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, text);
    }
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "editor-input",
        sourceRoot: ".",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        assetPaths: [],
        outDir: "out",
      }),
    );
    const loaded = await loadProject({ cwd: root });
    if (loaded.kind !== "success") throw new Error("Expected real editor project");
    const analyzed = await analyzeProjectOverlay(loaded.snapshot, []);
    const userIds = new Set(loaded.snapshot.sources.map(({ sourceId }) => sourceId));
    const library = analyzed.inputs.sources.find(({ sourceId }) => !userIds.has(sourceId));
    if (library === undefined) throw new Error("Expected installed input metadata");
    expect(library.sourceId).toBe("@@blend65/stdlib/c64/input.blend");
    const game = { uri: pathToFileURL(gamePath).href, getText: () => gameText };
    const override = { uri: pathToFileURL(overridePath).href, getText: () => overrideText };
    return await inspect({ game, override, libraryPath: library.resolvedPath });
  } finally {
    editor.open.clear();
    await rm(root, { recursive: true, force: true });
  }
}

describe("bundled diagnostic mapping internals", () => {
  it("should keep an installed related location canonical and distinguish it from encoded user paths", async () => {
    await withEditor(async ({ game, override, libraryPath }) => {
      editor.open.set(game.uri, game);
      editor.open.set(override.uri, override);
      editor.changed({ document: override });
      await vi.waitFor(
        () =>
          expect(editor.publications.get(override.uri)?.some(({ code }) => code === "E10003")).toBe(
            true,
          ),
        { timeout: 10_000, interval: 20 },
      );
      const duplicate = editor.publications
        .get(override.uri)
        ?.find(({ code }) => code === "E10003");
      const installed = duplicate?.relatedInformation?.find(
        ({ location }) => location.uri === pathToFileURL(libraryPath).href,
      );
      expect(installed).toBeDefined();
      if (installed === undefined) throw new Error("Expected installed proving location");
      expect(fileURLToPath(installed.location.uri)).toBe(libraryPath);
      expect(installed.message).toContain("Installed library");
      expect(override.uri).toContain("%C3%A9");
      expect(installed.location.uri).not.toBe(override.uri);
    });
  }, 15_000);

  it("should ignore an open installed document as an overlay and use unchanged installed bytes", async () => {
    await withEditor(async ({ game, override, libraryPath }) => {
      const original = await readFile(libraryPath, "utf8");
      editor.open.set(game.uri, game);
      editor.open.set(override.uri, {
        ...override,
        getText: () => "module c64.input; export const extra: byte = 2;",
      });
      const installedUri = pathToFileURL(libraryPath).href;
      editor.open.set(installedUri, { uri: installedUri, getText: () => "not legal source" });
      editor.changed({ document: game });
      await vi.waitFor(() => expect(editor.publications.has(game.uri)).toBe(true), {
        timeout: 10_000,
        interval: 20,
      });
      expect(editor.publications.get(game.uri)).toEqual([]);
      expect(editor.publications.has(installedUri)).toBe(false);
      expect(await readFile(libraryPath, "utf8")).toBe(original);
    });
  }, 15_000);
});
