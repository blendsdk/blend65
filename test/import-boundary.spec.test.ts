import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { inspectImportBoundary } from "./import-boundary.js";

const temporaryRoots: string[] = [];
const repository = fileURLToPath(new URL("../", import.meta.url));

/** Write a real workspace graph so the boundary proof exercises import resolution. */
async function fixture(files: Readonly<Record<string, string>>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blend65-imports-"));
  temporaryRoots.push(root);
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  }
  return root;
}

/** Give each synthetic package a public entry and its actual declared dependencies. */
function workspace(name: string, dependencies: readonly string[] = []): string {
  return JSON.stringify({
    name: `@blend65/${name}`,
    version: "0.1.0",
    type: "module",
    exports: { ".": "./dist/index.js" },
    dependencies: Object.fromEntries(
      dependencies.map((dependency) => [`@blend65/${dependency}`, "0.1.0"]),
    ),
  });
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("public package and frontend import boundaries", () => {
  // The actual graph is scanned as frontend and editor owners appear, without placeholder packages.
  it("should accept the real owned workspace graph", async () => {
    expect(await inspectImportBoundary(repository)).toEqual([]);
  });

  // Project types and values are legitimate frontend dependencies through their public entry.
  it("should accept a frontend importing a public project service", async () => {
    const root = await fixture({
      "package.json": JSON.stringify({ private: true, workspaces: ["packages/*"] }),
      "packages/frontend/package.json": workspace("frontend", ["project"]),
      "packages/frontend/src/index.ts":
        'import { project } from "@blend65/project"; export { project };',
      "packages/project/package.json": workspace("project"),
      "packages/project/src/index.ts": "export const project = 1;",
    });
    expect(await inspectImportBoundary(root)).toEqual([]);
  });

  // Every backend responsibility is excluded from shared frontend/editor analysis.
  it.each(["lowering", "codegen", "serializer", "packager", "emulator"])(
    "should reject a frontend importing %s directly",
    async (backend) => {
      const root = await fixture({
        "package.json": JSON.stringify({ private: true, workspaces: ["packages/*"] }),
        "packages/frontend/package.json": workspace("frontend", [backend]),
        "packages/frontend/src/index.ts": `import { value } from "@blend65/${backend}"; export { value };`,
        [`packages/${backend}/package.json`]: workspace(backend),
        [`packages/${backend}/src/index.ts`]: "export const value = 1;",
      });
      expect(await inspectImportBoundary(root)).not.toEqual([]);
    },
  );

  // Re-exports and intermediate packages cannot conceal forbidden transitive ownership.
  it.each(["frontend", "language-server", "vscode"])(
    "should reject %s reaching code generation through a shared re-export",
    async (consumer) => {
      const root = await fixture({
        "package.json": JSON.stringify({ private: true, workspaces: ["packages/*"] }),
        [`packages/${consumer}/package.json`]: workspace(consumer, ["shared"]),
        [`packages/${consumer}/src/index.ts`]: 'export { value } from "@blend65/shared";',
        "packages/shared/package.json": workspace("shared", ["codegen"]),
        "packages/shared/src/index.ts": 'export { value } from "./bridge.js";',
        "packages/shared/src/bridge.ts": 'export { value } from "@blend65/codegen";',
        "packages/codegen/package.json": workspace("codegen"),
        "packages/codegen/src/index.ts": "export const value = 1;",
      });
      expect(await inspectImportBoundary(root)).not.toEqual([]);
    },
  );

  // Imports count even when erased by TypeScript or deferred until runtime.
  it.each([
    'import type { Value } from "@blend65/codegen"; export type { Value };',
    'export type { Value } from "@blend65/codegen";',
    'export const load = () => import("@blend65/codegen");',
    "export const load = (name: string) => import(name);",
  ])("should reject a forbidden or unresolvable frontend import %s", async (source) => {
    const root = await fixture({
      "package.json": JSON.stringify({ private: true, workspaces: ["packages/*"] }),
      "packages/frontend/package.json": workspace("frontend", ["codegen"]),
      "packages/frontend/src/index.ts": source,
      "packages/codegen/package.json": workspace("codegen"),
      "packages/codegen/src/index.ts": "export interface Value { score: number }",
    });
    expect(await inspectImportBoundary(root)).not.toEqual([]);
  });

  // Import-shaped comments, quoted text and templates are not dependency edges.
  it("should ignore comments and strings that mention backend imports", async () => {
    const root = await fixture({
      "package.json": JSON.stringify({ private: true, workspaces: ["packages/*"] }),
      "packages/frontend/package.json": workspace("frontend"),
      "packages/frontend/src/index.ts": [
        '// import { x } from "@blend65/codegen";',
        '/* export * from "@blend65/emulator"; */',
        "export const text = 'import(\"@blend65/codegen\")';",
        'export const template = `export * from "@blend65/packager"`;',
      ].join("\n"),
    });
    expect(await inspectImportBoundary(root)).toEqual([]);
  });

  // A CLI is an actual consumer of the compiler's public package export.
  it("should accept a CLI consuming the declared compiler entry", async () => {
    const root = await fixture({
      "package.json": JSON.stringify({ private: true, workspaces: ["packages/*"] }),
      "packages/cli/package.json": workspace("cli", ["compiler"]),
      "packages/cli/src/index.ts":
        'import { parseManifest } from "@blend65/compiler"; export { parseManifest };',
      "packages/compiler/package.json": workspace("compiler"),
      "packages/compiler/src/index.ts": "export const parseManifest = () => 1;",
    });
    expect(await inspectImportBoundary(root)).toEqual([]);
  });

  // Neither relative paths nor private package subpaths may cross a package boundary.
  it.each([
    "../../compiler/src/index.js",
    "../../compiler/dist/index.js",
    "@blend65/compiler/src/index.js",
    "@blend65/compiler/dist/index.js",
    "@blend65/compiler/project/manifest",
  ])("should reject a private cross-package import %s", async (specifier) => {
    const root = await fixture({
      "package.json": JSON.stringify({ private: true, workspaces: ["packages/*"] }),
      "packages/cli/package.json": workspace("cli", ["compiler"]),
      "packages/cli/src/index.ts": `export { value } from "${specifier}";`,
      "packages/compiler/package.json": workspace("compiler"),
      "packages/compiler/src/index.ts": "export const value = 1;",
      "packages/compiler/dist/index.js": "export const value = 1;",
    });
    expect(await inspectImportBoundary(root)).not.toEqual([]);
  });

  // An installed workspace does not excuse an undeclared package dependency.
  it("should reject an undeclared public workspace edge", async () => {
    const root = await fixture({
      "package.json": JSON.stringify({ private: true, workspaces: ["packages/*"] }),
      "packages/cli/package.json": workspace("cli"),
      "packages/cli/src/index.ts": 'export { value } from "@blend65/compiler";',
      "packages/compiler/package.json": workspace("compiler"),
      "packages/compiler/src/index.ts": "export const value = 1;",
    });
    expect(await inspectImportBoundary(root)).not.toEqual([]);
  });

  // Manifest cycles are invalid even if no source statement exposes the cycle.
  it("should reject a cyclic declared workspace graph", async () => {
    const root = await fixture({
      "package.json": JSON.stringify({ private: true, workspaces: ["packages/*"] }),
      "packages/cli/package.json": workspace("cli", ["compiler"]),
      "packages/cli/src/index.ts": "export const cli = 1;",
      "packages/compiler/package.json": workspace("compiler", ["cli"]),
      "packages/compiler/src/index.ts": "export const compiler = 1;",
    });
    expect(await inspectImportBoundary(root)).not.toEqual([]);
  });

  // Shared frontend areas within a package carry the same backend boundary as standalone packages.
  it("should reject an internal shared frontend area reaching target lowering", async () => {
    const root = await fixture({
      "package.json": JSON.stringify({ private: true, workspaces: ["packages/*"] }),
      "packages/compiler/package.json": workspace("compiler"),
      "packages/compiler/src/index.ts": 'export { analyze } from "./frontend/index.js";',
      "packages/compiler/src/frontend/index.ts": 'export { analyze } from "../target/lowering.js";',
      "packages/compiler/src/target/lowering.ts": "export const analyze = () => 1;",
    });
    expect(await inspectImportBoundary(root)).not.toEqual([]);
  });
});
