import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject, loadProject } from "../index.js";
import { readCurrentGeneration } from "./current-record.js";

describe("terminal failure after a successful generation", () => {
  // A recoverable historical generation cannot authorize running changed, invalid source inputs.
  it.each([
    ["lexical", "module Game; function main(): void { ` }"],
    ["semantic", "module Game; function main(): void { missing(); }"],
    [
      "layout",
      "module Game; place(at: $2000) let a: byte; place(at: $2000) let b: byte; function main(): void { poke($0400, a + b); }",
    ],
  ])(
    "should reject the previous generation after a new %s failure",
    async (_stage, source) => {
      const root = await mkdtemp(join(tmpdir(), "blend65-stale-terminal-"));
      try {
        await mkdir(join(root, "src"));
        const manifest = join(root, "blend65.json");
        await writeFile(
          manifest,
          JSON.stringify({
            schemaVersion: 1,
            name: "terminal",
            sourceRoot: "src",
            entry: "Game",
            target: "c64-pal-prg-kernal-6581",
            outDir: "out",
            optimization: "none",
          }),
        );
        await writeFile(
          join(root, "src/game.blend"),
          "module Game; function main(): void { poke($0400, 7); }",
        );
        const built = await buildProject({ project: manifest });
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (built.kind !== "success") throw new Error("Expected initial generation");
        const before = await readdir(join(root, "out"));
        const historicalBytes = await readFile(
          join(built.generation.directory, built.generation.primaryArtifact),
        );
        await writeFile(join(root, "src/game.blend"), source);
        const failed = await buildProject({ project: manifest });
        expect(failed.kind).toBe("failure");
        const loaded = await loadProject({ project: manifest });
        expect(loaded.kind).toBe("success");
        if (loaded.kind !== "success") throw new Error("Expected loaded invalid source snapshot");
        expect((await readCurrentGeneration(loaded.snapshot)).kind).toBe("error");
        const after = await readdir(join(root, "out"));
        expect(after.filter((name) => name.startsWith(".staging-"))).toEqual([]);
        expect(after.filter((name) => !before.includes(name))).toEqual([]);
        expect(
          await readFile(join(built.generation.directory, built.generation.primaryArtifact)),
        ).toEqual(historicalBytes);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    60_000,
  );
});
