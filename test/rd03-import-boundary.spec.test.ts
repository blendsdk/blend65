import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { inspectImportBoundary } from "./import-boundary.js";

const repository = fileURLToPath(new URL("../", import.meta.url));
const temporaryRoots: string[] = [];

/** Write a complete synthetic workspace graph for one boundary case. */
async function fixture(files: Readonly<Record<string, string>>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blend65-editor-boundary-"));
  temporaryRoots.push(root);
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  }
  return root;
}

/** Describe one package with only the public entries and dependencies needed by a case. */
function workspace(
  name: string,
  dependencies: readonly string[] = [],
  exports: Readonly<Record<string, string>> = { ".": "./dist/index.js" },
): string {
  return JSON.stringify({
    name: `@blend65/${name}`,
    version: "0.1.0",
    type: "module",
    exports,
    dependencies: Object.fromEntries(dependencies.map((dependency) => [dependency, "0.1.0"])),
  });
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("diagnostics-only editor import boundary", () => {
  // The real editor packages must consume the public frontend subpath without backend reachability.
  it("should keep the actual frontend and editor graph independent of compiler backends", async () => {
    const compiler = JSON.parse(
      await readFile(join(repository, "packages/compiler/package.json"), "utf8"),
    );
    expect(compiler.exports["./frontend"]).toBeDefined();
    for (const name of ["language-server", "vscode"]) {
      const manifest = JSON.parse(
        await readFile(join(repository, `packages/${name}/package.json`), "utf8"),
      );
      expect(manifest.name).toBe(`@blend65/${name}`);
    }
    expect(await inspectImportBoundary(repository)).toEqual([]);
  });

  // Each backend responsibility remains forbidden even when reached through an innocent bridge file.
  it.each([
    "target/profile",
    "semantic/cfg",
    "storage/sfa",
    "machine/lowering",
    "layout/program-layout",
    "artifacts/emitter",
    "publication/generations",
    "tools/vice",
    "services/services",
  ])("should reject frontend reachability to compiler backend path %s", async (backendPath) => {
    const root = await fixture({
      "package.json": JSON.stringify({ private: true, workspaces: ["packages/*"] }),
      "packages/compiler/package.json": workspace("compiler", [], {
        ".": "./dist/index.js",
        "./frontend": "./dist/frontend/index.js",
      }),
      "packages/compiler/src/index.ts": "export const compiler = true;",
      "packages/compiler/src/frontend/index.ts": 'export { bridge } from "../shared/bridge.js";',
      "packages/compiler/src/shared/bridge.ts": `export { backend as bridge } from "../${backendPath}.js";`,
      [`packages/compiler/src/${backendPath}.ts`]: "export const backend = true;",
    });
    expect(await inspectImportBoundary(root)).not.toEqual([]);
  });

  // Importing the compiler root would expose backend services even if no private path is named.
  it("should reject an editor importing the compiler root", async () => {
    const root = await fixture({
      "package.json": JSON.stringify({ private: true, workspaces: ["packages/*"] }),
      "packages/compiler/package.json": workspace("compiler", [], {
        ".": "./dist/index.js",
        "./frontend": "./dist/frontend/index.js",
      }),
      "packages/compiler/src/index.ts": "export const buildProject = () => true;",
      "packages/compiler/src/frontend/index.ts": "export const analyzeProject = () => true;",
      "packages/language-server/package.json": workspace("language-server", ["@blend65/compiler"]),
      "packages/language-server/src/index.ts": 'export { buildProject } from "@blend65/compiler";',
    });
    expect(await inspectImportBoundary(root)).not.toEqual([]);
  });

  // The one public compiler edge admitted to editors is the backend-free frontend subpath.
  it("should accept an editor importing only the compiler frontend subpath", async () => {
    const root = await fixture({
      "package.json": JSON.stringify({ private: true, workspaces: ["packages/*"] }),
      "packages/compiler/package.json": workspace("compiler", [], {
        ".": "./dist/index.js",
        "./frontend": "./dist/frontend/index.js",
      }),
      "packages/compiler/src/index.ts": "export const buildProject = () => true;",
      "packages/compiler/src/frontend/index.ts": "export const analyzeProject = () => true;",
      "packages/language-server/package.json": workspace("language-server", ["@blend65/compiler"]),
      "packages/language-server/src/index.ts":
        'export { analyzeProject } from "@blend65/compiler/frontend";',
    });
    expect(await inspectImportBoundary(root)).toEqual([]);
  });
});
