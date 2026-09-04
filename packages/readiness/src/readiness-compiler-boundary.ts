import { posix } from "node:path";

import ts from "typescript";

/** One production TypeScript module supplied to the bidirectional package-boundary scanner. */
export interface ReadinessCompilerBoundaryModuleV1 {
  /** Package family that owns the production source. */
  readonly owner: "readiness" | "compiler-toolchain";
  /** Canonical POSIX repository-relative production path. */
  readonly path: string;
  /** Exact UTF-8 TypeScript source bytes. */
  readonly source: Uint8Array;
}

/** Closed input accepted by the bidirectional package-boundary scanner. */
export interface ReadinessCompilerBoundaryScanInputV1 {
  /** Supported scanner schema version. */
  readonly schemaVersion: 1;
  /** Complete bounded production module collection. */
  readonly modules: readonly ReadinessCompilerBoundaryModuleV1[];
}

/** Stable forbidden dependency directions reported by the scanner. */
export type ReadinessCompilerBoundaryDiagnosticCodeV1 =
  | "boundary.readiness-imports-compiler"
  | "boundary.compiler-imports-readiness";

/** Result of scanning the bidirectional readiness/compiler-toolchain boundary. */
export type ReadinessCompilerBoundaryScanResultV1 =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Accepted canonical module paths in lexical order. */
      readonly modulePaths: readonly string[];
      /** Empty diagnostic tuple. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Failure discriminator. */
      readonly ok: false;
      /** Forbidden dependency diagnostics in stable direction and path order. */
      readonly diagnostics: readonly {
        /** Forbidden dependency direction. */
        readonly code: ReadinessCompilerBoundaryDiagnosticCodeV1;
        /** Canonical path of the importing production module. */
        readonly path: string;
        /** Bounded human-readable rejection reason. */
        readonly message: string;
      }[];
    };

type BoundaryOwnerV1 = ReadinessCompilerBoundaryModuleV1["owner"];
type BoundaryDiagnosticV1 = Extract<
  ReadinessCompilerBoundaryScanResultV1,
  { readonly ok: false }
>["diagnostics"][number];

const TOOLCHAIN_PACKAGES = Object.freeze([
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
]);
const MODULE_LIMIT = 4_096;
const SOURCE_BYTE_LIMIT = 1_048_576;
const AGGREGATE_SOURCE_BYTE_LIMIT = 8_388_608;
const PATH_BYTE_LIMIT = 1_024;
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const UTF8_ENCODER = new TextEncoder();

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidInput(): ReadinessCompilerBoundaryScanResultV1 {
  return Object.freeze({ ok: false, diagnostics: EMPTY_DIAGNOSTICS });
}

function sourceRoot(owner: BoundaryOwnerV1, path: string): boolean {
  if (owner === "readiness") return path.startsWith("packages/readiness/src/");
  return TOOLCHAIN_PACKAGES.some((packageName) => path.startsWith(`packages/${packageName}/src/`));
}

function isCanonicalProductionPath(owner: BoundaryOwnerV1, path: string): boolean {
  return (
    path.length > 0 &&
    UTF8_ENCODER.encode(path).byteLength <= PATH_BYTE_LIMIT &&
    path === posix.normalize(path) &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.includes("\0") &&
    path.endsWith(".ts") &&
    !path.endsWith(".spec.test.ts") &&
    !path.endsWith(".impl.test.ts") &&
    !path.includes("/test-fixtures/") &&
    sourceRoot(owner, path)
  );
}

function moduleSpecifier(node: ts.Node): string | undefined {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier !== undefined &&
    ts.isStringLiteralLike(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier.text;
  }
  if (
    ts.isImportEqualsDeclaration(node) &&
    ts.isExternalModuleReference(node.moduleReference) &&
    node.moduleReference.expression !== undefined &&
    ts.isStringLiteralLike(node.moduleReference.expression)
  ) {
    return node.moduleReference.expression.text;
  }
  if (
    ts.isImportTypeNode(node) &&
    ts.isLiteralTypeNode(node.argument) &&
    ts.isStringLiteralLike(node.argument.literal)
  ) {
    return node.argument.literal.text;
  }
  if (
    ts.isCallExpression(node) &&
    node.arguments.length > 0 &&
    ts.isStringLiteralLike(node.arguments[0]!) &&
    (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === "require"))
  ) {
    return node.arguments[0]!.text;
  }
  return undefined;
}

function importsPackage(source: ts.SourceFile, packageName: string): boolean {
  let found = false;
  const inspect = (node: ts.Node): void => {
    if (found) return;
    const specifier = moduleSpecifier(node);
    if (specifier === packageName || specifier?.startsWith(`${packageName}/`) === true) {
      found = true;
      return;
    }
    ts.forEachChild(node, inspect);
  };
  inspect(source);
  return found;
}

function diagnostic(owner: BoundaryOwnerV1, path: string): BoundaryDiagnosticV1 {
  if (owner === "readiness") {
    return Object.freeze({
      code: "boundary.readiness-imports-compiler",
      path,
      message: "Readiness production modules must not import @blend65/compiler.",
    });
  }
  return Object.freeze({
    code: "boundary.compiler-imports-readiness",
    path,
    message: "Compiler-toolchain production modules must not import @blend65/readiness.",
  });
}

function diagnosticRank(code: ReadinessCompilerBoundaryDiagnosticCodeV1): number {
  return code === "boundary.readiness-imports-compiler" ? 0 : 1;
}

/**
 * Scans the closed production readiness/compiler-toolchain boundary in both directions.
 *
 * Static imports and exports, dynamic imports, TypeScript import types, import-equals declarations,
 * and CommonJS `require` calls are inspected through the TypeScript syntax tree. Comments and
 * unrelated string literals therefore remain inert.
 *
 * @param input Complete bounded production module collection.
 * @returns Lexical module paths on success, or stable forbidden-direction diagnostics.
 *
 * @example
 * ```ts
 * const result = scanReadinessCompilerBoundary({ schemaVersion: 1, modules: [] });
 * if (result.ok) console.log(result.modulePaths);
 * ```
 */
export function scanReadinessCompilerBoundary(
  input: unknown,
): ReadinessCompilerBoundaryScanResultV1 {
  if (
    !isRecord(input) ||
    Object.keys(input).length !== 2 ||
    input.schemaVersion !== 1 ||
    !Array.isArray(input.modules) ||
    input.modules.length > MODULE_LIMIT
  ) {
    return invalidInput();
  }

  const modules: readonly unknown[] = input.modules;
  const paths = new Set<string>();
  const diagnostics: BoundaryDiagnosticV1[] = [];
  let aggregateSourceBytes = 0;

  for (const module of modules) {
    if (
      !isRecord(module) ||
      Object.keys(module).length !== 3 ||
      (module.owner !== "readiness" && module.owner !== "compiler-toolchain") ||
      typeof module.path !== "string" ||
      !isCanonicalProductionPath(module.owner, module.path) ||
      !(module.source instanceof Uint8Array) ||
      paths.has(module.path)
    ) {
      return invalidInput();
    }
    aggregateSourceBytes += module.source.byteLength;
    if (
      module.source.byteLength > SOURCE_BYTE_LIMIT ||
      aggregateSourceBytes > AGGREGATE_SOURCE_BYTE_LIMIT
    ) {
      return invalidInput();
    }

    let text: string;
    try {
      text = UTF8_DECODER.decode(module.source);
    } catch {
      return invalidInput();
    }
    const source = ts.createSourceFile(
      module.path,
      text,
      ts.ScriptTarget.ES2023,
      true,
      ts.ScriptKind.TS,
    );
    const forbiddenPackage =
      module.owner === "readiness" ? "@blend65/compiler" : "@blend65/readiness";
    if (importsPackage(source, forbiddenPackage)) {
      diagnostics.push(diagnostic(module.owner, module.path));
    }
    paths.add(module.path);
  }

  if (diagnostics.length > 0) {
    diagnostics.sort(
      (left, right) =>
        diagnosticRank(left.code) - diagnosticRank(right.code) ||
        left.path.localeCompare(right.path),
    );
    return Object.freeze({ ok: false, diagnostics: Object.freeze(diagnostics) });
  }
  return Object.freeze({
    ok: true,
    modulePaths: Object.freeze([...paths].sort()),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}
