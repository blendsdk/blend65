import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { withProject } from "../rd06/project-fixture.js";

const HEADER = [
  "module Game;",
  "",
  "loadable const DATA: byte[4] = [1, 2, 3, 4];",
  "let target: byte[4];",
  "function main(): void { if (c64.loader.load(DATA, target)) { let x: byte = target[0]; } }",
  "",
].join("\n");

describe("D64 delivery security boundaries", () => {
  // An asset path outside the contained project root is rejected before packaging.
  it("should reject an escaping asset path without publishing", async () => {
    await withProject(
      [
        "module Game;",
        "",
        'loadable const DATA: byte[4] = embed("../outside.bin");',
        "let target: byte[4];",
        "function main(): void { c64.loader.load(DATA, target); }",
        "",
      ].join("\n"),
      [{ path: "../outside.bin", bytes: Uint8Array.from([1, 2, 3, 4]) }],
      async (project) => {
        const built = await buildProject({ project });
        expect(built.kind).toBe("failure");
        if (built.kind !== "failure") throw new Error("Expected containment rejection");
        expect(built.diagnostics.some(({ code }) => code.startsWith("PROJECT_"))).toBe(true);
      },
      "c64-pal-d64-kernal-6581",
    );
  });

  // The packager is a pure in-memory serializer: no shell, filesystem or external tool.
  it("should keep the D64 packager free of host process and filesystem access", async () => {
    const directory = join(process.cwd(), "packages/compiler/src/packaging/d64");
    const files = (await readdir(directory)).filter(
      (name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
    );
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = await readFile(join(directory, file), "utf8");
      expect(source).not.toMatch(/node:child_process|node:fs|execSync|spawnSync/u);
      expect(source).not.toMatch(/\bc1541\b|\bchild_process\b/u);
    }
  });
});
