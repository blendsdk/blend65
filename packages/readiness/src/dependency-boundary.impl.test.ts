import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@typescript-eslint/typescript-estree";
import { describe, expect, it } from "vitest";

import { scanReadinessCompilerBoundary } from "./readiness-boundary-core.js";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOT = resolve(PACKAGE_ROOT, "src");
const STRUCTURED_PRODUCTION_MODULES = [
  "generator-ir-validator.ts",
  "generator-ir.ts",
  "semantic-relation-analysis.ts",
  "semantic-relation-compare.ts",
  "semantic-relation-transform.ts",
  "semantic-relations.ts",
  "structured-case-families.ts",
  "structured-case-registry.ts",
  "structured-ir-validation.ts",
  "structured-oracle-evaluator.ts",
  "structured-oracle-runtime.ts",
  "structured-source-renderer.ts",
] as const;

function isStringRecord(value: unknown): value is Readonly<Record<string, string>> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringLiteral(value: unknown): string | undefined {
  if (!isRecord(value) || value.type !== "Literal" || typeof value.value !== "string") {
    return undefined;
  }
  return value.value;
}

function identifierName(value: unknown): string | undefined {
  if (!isRecord(value) || value.type !== "Identifier" || typeof value.name !== "string") {
    return undefined;
  }
  return value.name;
}

function isRequireLikeCallee(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (identifierName(value) === "require") return true;
  if (value.type === "MemberExpression") {
    const objectName = identifierName(value.object);
    const propertyName = identifierName(value.property);
    return (
      (objectName === "require" && propertyName === "resolve") ||
      (objectName === "module" && propertyName === "require")
    );
  }
  if (value.type === "CallExpression") {
    const factory = Reflect.get(value, "callee");
    return identifierName(factory) === "createRequire";
  }
  return false;
}

function moduleSpecifier(value: Readonly<Record<string, unknown>>): string | undefined {
  if (
    value.type === "ImportDeclaration" ||
    value.type === "ExportAllDeclaration" ||
    value.type === "ExportNamedDeclaration"
  ) {
    return stringLiteral(value.source);
  }
  if (value.type === "ImportExpression") {
    return stringLiteral(value.source);
  }
  if (value.type === "TSExternalModuleReference") {
    return stringLiteral(value.expression);
  }
  if (value.type === "CallExpression" && isRequireLikeCallee(value.callee)) {
    const args = value.arguments;
    if (Array.isArray(args)) return stringLiteral(args[0]);
  }
  return undefined;
}

function findWorkspaceModuleLoads(source: string): readonly string[] {
  const program = parse(source, {
    comment: false,
    jsx: false,
    loc: false,
    range: false,
    sourceType: "module",
    tokens: false,
  });
  const pending: unknown[] = [program];
  const loads: string[] = [];

  while (pending.length > 0) {
    const value = pending.pop();
    if (Array.isArray(value)) {
      pending.push(...value);
      continue;
    }
    if (!isRecord(value)) continue;
    const specifier = moduleSpecifier(value);
    if (specifier?.startsWith("@blend65/") === true) loads.push(specifier);
    for (const child of Object.values(value)) {
      if (typeof child === "object" && child !== null) pending.push(child);
    }
  }

  return loads;
}

describe("readiness package boundary", () => {
  it("should declare only validation-library runtime dependencies", async () => {
    const manifestValue: unknown = JSON.parse(
      await readFile(resolve(PACKAGE_ROOT, "package.json"), "utf8"),
    );
    if (
      typeof manifestValue !== "object" ||
      manifestValue === null ||
      Array.isArray(manifestValue)
    ) {
      throw new TypeError("Package manifest must be an object.");
    }
    const dependencies = Reflect.get(manifestValue, "dependencies");
    if (!isStringRecord(dependencies)) {
      throw new TypeError("Package dependencies must be a string map.");
    }

    expect(Object.keys(dependencies).sort()).toEqual(["ajv", "jsonc-parser"]);
  });

  it("should not import compiler or toolchain workspaces", async () => {
    const entries = await readdir(SOURCE_ROOT, { recursive: true, withFileTypes: true });
    const sourceFiles = entries
      .filter(
        (entry) =>
          entry.isFile() && extname(entry.name) === ".ts" && !entry.name.endsWith(".test.ts"),
      )
      .map((entry) => resolve(entry.parentPath, entry.name));
    const contents = await Promise.all(sourceFiles.map((path) => readFile(path, "utf8")));
    const scannedNames = new Set(sourceFiles.map((path) => path.slice(SOURCE_ROOT.length + 1)));

    expect(contents.flatMap(findWorkspaceModuleLoads)).toEqual([]);
    expect([...scannedNames]).toEqual(
      expect.arrayContaining([
        "binding-model.ts",
        "binding-validator.ts",
        "boundary-variants.ts",
        "generation-budget.ts",
        "generator-ir-validator.ts",
        "generator-ir.ts",
        "invalid-neighbor.ts",
        "model-registry-model.ts",
        "rule-model-input.ts",
        "rule-model-registry.ts",
        "rule-model-validator.ts",
      ]),
    );
  });

  it.each([
    ['import value from "@blend65/core";', "@blend65/core"],
    ['export { value } from "@blend65/core";', "@blend65/core"],
    ['export * from "@blend65/core";', "@blend65/core"],
    ['const value = await import("@blend65/core");', "@blend65/core"],
    ['const value = require("@blend65/core");', "@blend65/core"],
    ['const value = require.resolve("@blend65/core");', "@blend65/core"],
    ['const value = module.require("@blend65/core");', "@blend65/core"],
    ['import value = require("@blend65/core");', "@blend65/core"],
    ['const value = createRequire(import.meta.url)("@blend65/core");', "@blend65/core"],
  ])("should detect workspace loading in %s", (source, expected) => {
    expect(findWorkspaceModuleLoads(source)).toContain(expected);
  });

  it("should ignore workspace names in comments and ordinary strings", () => {
    expect(
      findWorkspaceModuleLoads(
        'const text = "@blend65/core"; // import value from "@blend65/frontend"',
      ),
    ).toEqual([]);
  });

  it("keeps every structured production authority free of workspace imports", async () => {
    const observations = await Promise.all(
      STRUCTURED_PRODUCTION_MODULES.map(async (path) => ({
        path,
        loads: findWorkspaceModuleLoads(await readFile(resolve(SOURCE_ROOT, path), "utf8")),
      })),
    );

    expect(observations).toEqual(
      STRUCTURED_PRODUCTION_MODULES.map((path) => ({ path, loads: [] })),
    );
  });
});

describe("bidirectional compiler/readiness scanner", () => {
  const encoder = new TextEncoder();

  it.each([
    {
      label: "static imports",
      readiness: 'import "@blend65/compiler";',
      toolchain: 'import "@blend65/readiness";',
    },
    {
      label: "re-exports",
      readiness: 'export * from "@blend65/compiler";',
      toolchain: 'export { value } from "@blend65/readiness";',
    },
    {
      label: "dynamic imports",
      readiness: 'const load = () => import("@blend65/compiler/api");',
      toolchain: 'const load = () => import("@blend65/readiness/published-oracle");',
    },
    {
      label: "require calls",
      readiness: 'const compiler = require("@blend65/compiler");',
      toolchain: 'const readiness = require("@blend65/readiness");',
    },
  ])("rejects $label in both directions through the production scanner", (vector) => {
    const readinessPath = "packages/readiness/src/synthetic-boundary.ts";
    const toolchainPath = "packages/core/src/synthetic-boundary.ts";
    expect(
      scanReadinessCompilerBoundary({
        schemaVersion: 1,
        modules: [
          {
            owner: "compiler-toolchain",
            path: toolchainPath,
            source: encoder.encode(vector.toolchain),
          },
          {
            owner: "readiness",
            path: readinessPath,
            source: encoder.encode(vector.readiness),
          },
        ],
      }),
    ).toEqual({
      ok: false,
      diagnostics: [
        {
          code: "boundary.readiness-imports-compiler",
          path: readinessPath,
          message: "Readiness production modules must not import @blend65/compiler.",
        },
        {
          code: "boundary.compiler-imports-readiness",
          path: toolchainPath,
          message: "Compiler-toolchain production modules must not import @blend65/readiness.",
        },
      ],
    });
  });

  it("keeps import-like comments and ordinary strings inert in both owners", () => {
    const modules = [
      {
        owner: "compiler-toolchain",
        path: "packages/compiler/src/inert-boundary.ts",
        source: encoder.encode(
          '/* export * from "@blend65/readiness" */\nconst text = \'require("@blend65/readiness")\';',
        ),
      },
      {
        owner: "readiness",
        path: "packages/readiness/src/inert-boundary.ts",
        source: encoder.encode(
          '// import("@blend65/compiler")\nconst text = \'import "@blend65/compiler"\';',
        ),
      },
    ] as const;

    expect(scanReadinessCompilerBoundary({ schemaVersion: 1, modules })).toEqual({
      ok: true,
      modulePaths: modules.map(({ path }) => path).sort(),
      diagnostics: [],
    });
  });
});
