import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { inspectImportBoundary } from "./import-boundary.js";

/** Run the reader on real files, always removing only this test's temporary tree. */
async function inspect(source: string, owner = "frontend"): Promise<readonly string[]> {
  const root = await mkdtemp(join(tmpdir(), "blend65-reader-"));
  try {
    const files = {
      ["packages/" + owner + "/package.json"]: JSON.stringify({
        name: "@blend65/" + owner,
        exports: { ".": "./dist/index.js" },
        dependencies: { "@blend65/codegen": "0.1.0" },
      }),
      ["packages/" + owner + "/src/index.ts"]: source,
      "packages/codegen/package.json": JSON.stringify({
        name: "@blend65/codegen",
        exports: { ".": "./dist/index.js" },
      }),
      "packages/codegen/src/index.ts": "export const value = 1;",
    };
    for (const [path, text] of Object.entries(files)) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), text);
    }
    return await inspectImportBoundary(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("ESM import-reader internals", () => {
  it.each([
    'import { from as renamed } from "@blend65/codegen";',
    'import "@blend65/codegen"\nexport const value = 1;',
    '// ignored bare CR comment\rimport "@blend65/codegen";',
    'import "@blend65/code\\u0067en";',
    'import "@\\u{62}lend65/codegen";',
    'export const text = `value: ${import("@blend65/codegen")}`;',
    "export const load = (name: string) => import(`@blend65/${name}`);",
  ])("should expose a forbidden edge through lexical form %s", async (source) => {
    expect(await inspect(source)).not.toEqual([]);
  });

  it("should ignore property names and import.meta instead of treating them as imports", async () => {
    expect(
      await inspect("export const value = import.meta.url; const obj = {import: 1}; obj.import;"),
    ).toEqual([]);
  });

  it("should not ban an unresolved dynamic import outside frontend/editor ownership", async () => {
    expect(await inspect("export const load = (name: string) => import(name);", "cli")).toEqual([]);
  });
});
