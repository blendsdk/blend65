import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadProjectWithControls } from "../project/snapshot.js";
import { analyzeProjectOverlay } from "./service.js";
import {
  buildToolingIndex,
  completionAt,
  documentSymbols,
  referencesFor,
  renameEdits,
  symbolAt,
  workspaceSymbols,
} from "./index.js";

const SOURCE = [
  "module Game;",
  "",
  "struct Point { x: byte; y: byte; }",
  "let globalCounter: byte = 3;",
  "const LIMIT: byte = 10;",
  "",
  "function add(a: byte, b: byte): byte {",
  "    let sum: byte = a + b;",
  "    return sum;",
  "}",
  "",
  "function main(): void {",
  "    let p: Point = { x: 1, y: 2 };",
  "    p.x = add(p.x, globalCounter);",
  "}",
  "",
].join("\n");

/** Build one real temporary project and return its analyzed tooling index. */
async function indexed(): Promise<ReturnType<typeof buildToolingIndex>> {
  const root = await mkdtemp(join(tmpdir(), "blend65-tooling-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), SOURCE);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "tooling",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        assetPaths: [],
        outDir: "out",
        optimization: "none",
      }),
    );
    const loaded = await loadProjectWithControls({ cwd: root });
    if (loaded.kind !== "success") throw new Error(JSON.stringify(loaded.diagnostics));
    const result = await analyzeProjectOverlay(loaded.snapshot, []);
    if (result.kind !== "complete") throw new Error(JSON.stringify(result.diagnostics));
    return buildToolingIndex(result);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Return the first byte offset of one exact source substring. */
function offsetOf(proof: string): number {
  const index = SOURCE.indexOf(proof);
  if (index < 0) throw new Error(`Missing source proof: ${proof}`);
  return Buffer.byteLength(SOURCE.slice(0, index));
}

describe("tooling index internals", () => {
  it("should keep every occurrence inside a real source and every field id stable", async () => {
    const first = await indexed();
    const second = await indexed();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    const sourceIds = new Set(first!.sources.map(({ sourceId }) => sourceId));
    for (const occurrence of first!.occurrences) {
      expect(sourceIds.has(occurrence.span.sourceId)).toBe(true);
      expect(occurrence.span.end).toBeGreaterThan(occurrence.span.start);
    }
    const fields = (index: NonNullable<typeof first>) =>
      index.symbols.filter(({ kind }) => kind === "field").map(({ id }) => id);
    expect(fields(first!)).toEqual(fields(second!));
  });

  it("should reject a rename that would collide with a visible binding", async () => {
    const index = await indexed();
    const symbol = symbolAt(index!, { sourceId: "src/game.blend", offset: offsetOf("sum") });
    expect(symbol).not.toBeNull();
    expect(renameEdits(index!, symbol!.id, "LIMIT").kind).toBe("rejected");
  });

  it("should keep references and completion bounded and declaration-ordered", async () => {
    const index = await indexed();
    const counter = symbolAt(index!, {
      sourceId: "src/game.blend",
      offset: offsetOf("globalCounter"),
    });
    expect(counter).not.toBeNull();
    expect(referencesFor(index!, counter!.id, true)).toHaveLength(2);
    expect(
      completionAt(index!, "src/game.blend", offsetOf("let p: Point"), {}).length,
    ).toBeLessThanOrEqual(200);
    expect(workspaceSymbols(index!, "", 4)).toHaveLength(4);
    const symbols = documentSymbols(index!, "src/game.blend");
    expect(symbols.map(({ name }) => name)).toEqual([
      "Game",
      "Point",
      "globalCounter",
      "LIMIT",
      "add",
      "main",
    ]);
  });
});
