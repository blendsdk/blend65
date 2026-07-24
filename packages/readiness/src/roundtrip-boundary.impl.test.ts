import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { validateRoundTripModuleGraph } from "./roundtrip-conformance-v1.js";

const SOURCE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const INVERSE_MODULE = /^roundtrip-(?:tokenizer|parser|normalizer)(?:-[a-z0-9-]+)?\.ts$/u;
const NON_LITERAL_DYNAMIC_IMPORT = "<non-literal-dynamic-import>";

function extractModuleSpecifiers(source: string): string[] {
  const parsed = ts.createSourceFile("inverse.ts", source, ts.ScriptTarget.Latest, true);
  const imports: string[] = [];
  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined
    ) {
      imports.push(
        ts.isStringLiteral(node.moduleSpecifier)
          ? node.moduleSpecifier.text
          : NON_LITERAL_DYNAMIC_IMPORT,
      );
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      const expression = node.moduleReference.expression;
      imports.push(
        expression !== undefined && ts.isStringLiteral(expression)
          ? expression.text
          : NON_LITERAL_DYNAMIC_IMPORT,
      );
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const argument = node.arguments[0];
      imports.push(
        argument !== undefined &&
          (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
          ? argument.text
          : NON_LITERAL_DYNAMIC_IMPORT,
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return imports.sort();
}

function discoverInverseGraph() {
  return readdirSync(SOURCE_DIRECTORY)
    .filter((path) => INVERSE_MODULE.test(path))
    .sort()
    .map((path) => {
      const source = readFileSync(resolve(SOURCE_DIRECTORY, path), "utf8");
      return {
        path: basename(path),
        imports: extractModuleSpecifiers(source),
        classification: "inverse" as const,
      };
    });
}

describe("round-trip inverse boundary", () => {
  it("discovers every inverse production module and keeps it renderer-independent", () => {
    const graph = discoverInverseGraph();

    expect(graph.map(({ path }) => path)).toEqual([
      "roundtrip-parser.ts",
      "roundtrip-tokenizer.ts",
    ]);
    expect(validateRoundTripModuleGraph(graph)).toEqual({ ok: true, diagnostics: [] });
  });

  it("classifies static and dynamic renderer imports with the same fail-closed policy", () => {
    const imports = extractModuleSpecifiers(
      'import type { X } from "./roundtrip-model.js";\nawait import("./source-renderer.js");',
    );
    expect(validateRoundTripModuleGraph([{ path: "roundtrip-parser.ts", imports }]).ok).toBe(false);

    for (const dynamic of [
      "const target = './source-renderer.js'; import(target);",
      "import(`./source-${name}.js`);",
    ]) {
      expect(
        validateRoundTripModuleGraph([
          { path: "roundtrip-parser.ts", imports: extractModuleSpecifiers(dynamic) },
        ]).ok,
      ).toBe(false);
    }
  });
});
