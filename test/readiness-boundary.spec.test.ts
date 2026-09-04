import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { scanReadinessCompilerBoundary } from "../packages/readiness/src/readiness-boundary-core.js";

const REPOSITORY_ROOT = process.cwd();
const TOOLCHAIN_PACKAGES = [
  "core",
  "frontend",
  "codegen",
  "platforms",
  "config",
  "compiler",
  "cli",
  "language-server",
  "vscode",
  "test-harness",
] as const;

function repositoryPath(path: string): string {
  return relative(REPOSITORY_ROOT, path).split(sep).join("/");
}

function isProductionTypeScript(path: string): boolean {
  const normalized = repositoryPath(path);
  return (
    normalized.endsWith(".ts") &&
    !normalized.endsWith(".spec.test.ts") &&
    !normalized.endsWith(".impl.test.ts") &&
    !normalized.includes("/test-fixtures/")
  );
}

async function productionSources(packageName: string, owner: "readiness" | "compiler-toolchain") {
  const sourceRoot = join(REPOSITORY_ROOT, "packages", packageName, "src");
  const entries = await readdir(sourceRoot, { recursive: true, withFileTypes: true });
  const paths = entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter(isProductionTypeScript)
    .sort();

  return Promise.all(
    paths.map(async (path) => ({
      owner,
      path: repositoryPath(path),
      source: await readFile(path),
    })),
  );
}

describe("readiness and compiler package boundary", () => {
  // Current production packages must remain free of circular readiness/compiler dependencies.
  it("accepts every current production source through the bidirectional scanner", async () => {
    const modules = [
      ...(await productionSources("readiness", "readiness")),
      ...(
        await Promise.all(
          TOOLCHAIN_PACKAGES.map((packageName) =>
            productionSources(packageName, "compiler-toolchain"),
          ),
        )
      ).flat(),
    ].sort((left, right) => left.path.localeCompare(right.path));

    expect(scanReadinessCompilerBoundary({ schemaVersion: 1, modules })).toEqual({
      ok: true,
      modulePaths: modules.map(({ path }) => path),
      diagnostics: [],
    });
  });

  // Both forbidden import directions are detected without matching inert source text.
  it("rejects imports in both directions without treating comments or strings as imports", () => {
    const encoder = new TextEncoder();
    const result = scanReadinessCompilerBoundary({
      schemaVersion: 1,
      modules: [
        {
          owner: "readiness",
          path: "packages/readiness/src/illegal-readiness.ts",
          source: encoder.encode('import "@blend65/compiler";\n'),
        },
        {
          owner: "compiler-toolchain",
          path: "packages/compiler/src/illegal-compiler.ts",
          source: encoder.encode('const load = () => import("@blend65/readiness");\n'),
        },
        {
          owner: "readiness",
          path: "packages/readiness/src/comment-only.ts",
          source: encoder.encode(
            '// import "@blend65/compiler";\nconst note = "@blend65/compiler";\n',
          ),
        },
        {
          owner: "compiler-toolchain",
          path: "packages/compiler/src/string-only.ts",
          source: encoder.encode(
            '/* require("@blend65/readiness") */\nconst note = "@blend65/readiness";\n',
          ),
        },
      ],
    });

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "boundary.readiness-imports-compiler",
          path: expect.any(String),
          message: expect.any(String),
        },
        {
          code: "boundary.compiler-imports-readiness",
          path: expect.any(String),
          message: expect.any(String),
        },
      ],
    });
    expect(result).not.toHaveProperty("modulePaths");
  });
});
