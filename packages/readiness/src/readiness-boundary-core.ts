import { posix } from "node:path";

import ts from "typescript";

/** One in-memory TypeScript module supplied to the readiness boundary scanner. */
export interface ReadinessBoundaryModuleV1 {
  /** Canonical POSIX repository-relative path. */
  readonly path: string;
  /** Exact UTF-8 TypeScript source bytes. */
  readonly source: Uint8Array;
}

/** Closed graph input accepted by the in-memory boundary scanner. */
export interface ReadinessBoundaryScanInputV1 {
  /** Supported scanner schema version. */
  readonly schemaVersion: 1;
  /** Fixed readiness package root. */
  readonly packageRoot: "packages/readiness";
  /** Exact production graph entries. */
  readonly entryPaths: readonly string[];
  /** Bounded module collection. */
  readonly modules: readonly ReadinessBoundaryModuleV1[];
}

/** Stable package-boundary diagnostic categories. */
export type ReadinessBoundaryDiagnosticCodeV1 =
  | "readiness.boundary.input.invalid"
  | "readiness.boundary.input.limit"
  | "readiness.boundary.module.missing"
  | "readiness.boundary.import.package"
  | "readiness.boundary.import.escape"
  | "readiness.boundary.import.dynamic";

/** One bounded scanner diagnostic with a stable input pointer. */
export interface ReadinessBoundaryDiagnosticV1 {
  /** Stable machine-readable category. */
  readonly code: ReadinessBoundaryDiagnosticCodeV1;
  /** RFC 6901 pointer into the rejected graph input. */
  readonly path: string;
  /** Bounded non-sensitive explanation. */
  readonly message: string;
}

/** Closed in-memory boundary scan result. */
export type ReadinessBoundaryScanResultV1 =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Reachable modules in lexical path order. */
      readonly modulePaths: readonly string[];
      /** Empty diagnostic tuple for success. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Failure discriminator. */
      readonly ok: false;
      /** Deterministically sorted boundary diagnostics. */
      readonly diagnostics: readonly ReadinessBoundaryDiagnosticV1[];
    };

type ReadinessBoundaryFailureV1 = Extract<ReadinessBoundaryScanResultV1, { readonly ok: false }>;

interface ParsedBoundaryModuleV1 extends ReadinessBoundaryModuleV1 {
  readonly index: number;
  readonly text: string;
}

interface LocatedBoundaryDiagnosticV1 extends ReadinessBoundaryDiagnosticV1 {
  readonly modulePath: string;
  readonly offset: number;
}

interface ModuleImportV1 {
  readonly specifier?: string;
  readonly dynamic: boolean;
  readonly offset: number;
}

type LoadTargetKindV1 = "none" | "require" | "unresolved-module";

export const READINESS_BOUNDARY_LIMITS = Object.freeze({
  modules: 4_096,
  entries: 64,
  sourceBytes: 1_048_576,
  aggregateSourceBytes: 8_388_608,
  pathBytes: 1_024,
  imports: 65_536,
  graphDepth: 1_024,
});
const PACKAGE_ROOT = "packages/readiness";
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

function diagnostic(
  code: ReadinessBoundaryDiagnosticCodeV1,
  path: string,
  message: string,
): ReadinessBoundaryDiagnosticV1 {
  return Object.freeze({ code, path, message: message.slice(0, 256) });
}

function failure(
  code: ReadinessBoundaryDiagnosticCodeV1,
  path: string,
  message: string,
): ReadinessBoundaryFailureV1 {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([diagnostic(code, path, message)]),
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPlainProperty(
  value: object,
  key: string,
  path: string,
): { readonly ok: true; readonly value: unknown } | ReadinessBoundaryFailureV1 {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
    return failure(
      "readiness.boundary.input.invalid",
      path,
      "Boundary properties must be enumerable own data.",
    );
  }
  return Object.freeze({ ok: true, value: descriptor.value });
}

function readBoundedArray(
  value: unknown,
  path: string,
  maximumLength: number,
): { readonly ok: true; readonly values: readonly unknown[] } | ReadinessBoundaryFailureV1 {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    return failure(
      "readiness.boundary.input.invalid",
      path,
      "Boundary collection must be a plain array.",
    );
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    typeof lengthDescriptor.value !== "number"
  ) {
    return failure(
      "readiness.boundary.input.invalid",
      path,
      "Boundary array length must be plain data.",
    );
  }
  const length = lengthDescriptor.value;
  if (length > maximumLength) {
    return failure(
      "readiness.boundary.input.limit",
      path,
      "Boundary graph exceeds its fixed collection limit.",
    );
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== length + 1 ||
    keys.some((key, index) => key !== (index === length ? "length" : String(index)))
  ) {
    return failure(
      "readiness.boundary.input.invalid",
      path,
      "Boundary arrays must be dense and unadorned.",
    );
  }
  const values: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const property = readPlainProperty(value, String(index), `${path}/${index}`);
    if (!property.ok) return property;
    values.push(property.value);
  }
  return Object.freeze({ ok: true, values: Object.freeze(values) });
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Reflect.ownKeys(value);
  return (
    actual.length === keys.length &&
    actual.every((key) => typeof key === "string" && keys.includes(key))
  );
}

function isCanonicalModulePath(path: string): boolean {
  if (
    path.length === 0 ||
    path.length > READINESS_BOUNDARY_LIMITS.pathBytes ||
    path.includes("\\") ||
    path.startsWith("/") ||
    UTF8_ENCODER.encode(path).byteLength > READINESS_BOUNDARY_LIMITS.pathBytes
  ) {
    return false;
  }
  const segments = path.split("/");
  return (
    segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..") &&
    path.startsWith(`${PACKAGE_ROOT}/`) &&
    posix.normalize(path) === path
  );
}

function parseBoundaryInput(input: unknown):
  | {
      readonly ok: true;
      readonly entries: readonly string[];
      readonly modules: readonly ParsedBoundaryModuleV1[];
    }
  | ReadinessBoundaryFailureV1 {
  try {
    if (
      !isRecord(input) ||
      (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null)
    ) {
      return failure(
        "readiness.boundary.input.invalid",
        "",
        "Boundary scan must use the exact version-one shape.",
      );
    }
    const schemaVersion = readPlainProperty(input, "schemaVersion", "/schemaVersion");
    if (!schemaVersion.ok) return schemaVersion;
    const packageRoot = readPlainProperty(input, "packageRoot", "/packageRoot");
    if (!packageRoot.ok) return packageRoot;
    const entryPaths = readPlainProperty(input, "entryPaths", "/entryPaths");
    if (!entryPaths.ok) return entryPaths;
    const moduleValues = readPlainProperty(input, "modules", "/modules");
    if (!moduleValues.ok) return moduleValues;
    const entriesArray = readBoundedArray(
      entryPaths.value,
      "/entryPaths",
      READINESS_BOUNDARY_LIMITS.entries,
    );
    if (!entriesArray.ok) return entriesArray;
    const modulesArray = readBoundedArray(
      moduleValues.value,
      "/modules",
      READINESS_BOUNDARY_LIMITS.modules,
    );
    if (!modulesArray.ok) return modulesArray;
    if (
      !hasExactKeys(input, ["schemaVersion", "packageRoot", "entryPaths", "modules"]) ||
      schemaVersion.value !== 1 ||
      packageRoot.value !== PACKAGE_ROOT
    ) {
      return failure(
        "readiness.boundary.input.invalid",
        "",
        "Boundary scan must use the exact version-one shape.",
      );
    }
    const entries: string[] = [];
    const entrySet = new Set<string>();
    for (let index = 0; index < entriesArray.values.length; index += 1) {
      const path = entriesArray.values[index];
      if (typeof path !== "string" || !isCanonicalModulePath(path) || entrySet.has(path)) {
        return failure(
          "readiness.boundary.input.invalid",
          `/entryPaths/${index}`,
          "Boundary entry path must be unique and canonical below the readiness package.",
        );
      }
      entrySet.add(path);
      entries.push(path);
    }
    const modules: ParsedBoundaryModuleV1[] = [];
    const moduleSet = new Set<string>();
    let aggregateBytes = 0;
    for (let index = 0; index < modulesArray.values.length; index += 1) {
      const module = modulesArray.values[index];
      const path = `/modules/${index}`;
      if (
        !isRecord(module) ||
        (Object.getPrototypeOf(module) !== Object.prototype &&
          Object.getPrototypeOf(module) !== null) ||
        !hasExactKeys(module, ["path", "source"])
      ) {
        return failure(
          "readiness.boundary.input.invalid",
          path,
          "Boundary module must use a unique canonical path and plain byte source.",
        );
      }
      const modulePath = readPlainProperty(module, "path", `${path}/path`);
      if (!modulePath.ok) return modulePath;
      const moduleSource = readPlainProperty(module, "source", `${path}/source`);
      if (!moduleSource.ok) return moduleSource;
      if (
        typeof modulePath.value !== "string" ||
        !isCanonicalModulePath(modulePath.value) ||
        moduleSet.has(modulePath.value) ||
        !(moduleSource.value instanceof Uint8Array) ||
        Object.getPrototypeOf(moduleSource.value) !== Uint8Array.prototype
      ) {
        return failure(
          "readiness.boundary.input.invalid",
          path,
          "Boundary module must use a unique canonical path and plain byte source.",
        );
      }
      if (moduleSource.value.byteLength > READINESS_BOUNDARY_LIMITS.sourceBytes) {
        return failure(
          "readiness.boundary.input.limit",
          `${path}/source`,
          "Boundary module exceeds the per-source byte limit.",
        );
      }
      aggregateBytes += moduleSource.value.byteLength;
      if (aggregateBytes > READINESS_BOUNDARY_LIMITS.aggregateSourceBytes) {
        return failure(
          "readiness.boundary.input.limit",
          `${path}/source`,
          "Boundary graph exceeds the aggregate source byte limit.",
        );
      }
      let text: string;
      try {
        text = UTF8_DECODER.decode(moduleSource.value);
      } catch {
        return failure(
          "readiness.boundary.input.invalid",
          `${path}/source`,
          "Boundary module source must be valid UTF-8.",
        );
      }
      moduleSet.add(modulePath.value);
      modules.push(
        Object.freeze({
          index,
          path: modulePath.value,
          source: new Uint8Array(moduleSource.value),
          text,
        }),
      );
    }
    return Object.freeze({
      ok: true,
      entries: Object.freeze(entries),
      modules: Object.freeze(modules),
    });
  } catch {
    return failure(
      "readiness.boundary.input.invalid",
      "",
      "Boundary input structure could not be inspected safely.",
    );
  }
}

function collectImports(source: ts.SourceFile): readonly ModuleImportV1[] {
  const imports: ModuleImportV1[] = [];
  const addCallImport = (node: ts.CallExpression, forceDynamic = false): void => {
    const argument = !forceDynamic && node.arguments.length === 1 ? node.arguments[0] : undefined;
    imports.push(
      Object.freeze({
        ...(argument !== undefined && ts.isStringLiteralLike(argument)
          ? { specifier: argument.text }
          : {}),
        dynamic: true,
        offset: node.getStart(source),
      }),
    );
  };
  const pending: ts.Node[] = [source];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) break;
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      imports.push(
        Object.freeze({
          specifier: node.moduleSpecifier.text,
          dynamic: false,
          offset: node.moduleSpecifier.getStart(source),
        }),
      );
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      const expression = node.moduleReference.expression;
      imports.push(
        Object.freeze({
          ...(expression !== undefined && ts.isStringLiteralLike(expression)
            ? { specifier: expression.text }
            : {}),
          dynamic: true,
          offset: node.getStart(source),
        }),
      );
    } else if (ts.isImportTypeNode(node)) {
      const argument = node.argument;
      imports.push(
        Object.freeze({
          ...(ts.isLiteralTypeNode(argument) && ts.isStringLiteralLike(argument.literal)
            ? { specifier: argument.literal.text }
            : {}),
          dynamic: true,
          offset: node.getStart(source),
        }),
      );
    } else if (ts.isCallExpression(node)) {
      const loadTarget = classifyLoadTarget(node.expression);
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword || loadTarget !== "none") {
        addCallImport(node, loadTarget === "unresolved-module");
      }
    }
    ts.forEachChild(node, (child) => {
      pending.push(child);
    });
  }
  return Object.freeze(imports);
}

function unwrapLoadTarget(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function classifyLoadTarget(expression: ts.Expression): LoadTargetKindV1 {
  const target = unwrapLoadTarget(expression);
  if (ts.isIdentifier(target) && target.text === "require") return "require";
  if (ts.isPropertyAccessExpression(target)) {
    const owner = unwrapLoadTarget(target.expression);
    return ts.isIdentifier(owner) && owner.text === "module" && target.name.text === "require"
      ? "require"
      : "none";
  }
  if (!ts.isElementAccessExpression(target)) return "none";
  const owner = unwrapLoadTarget(target.expression);
  if (!ts.isIdentifier(owner) || owner.text !== "module") return "none";
  const member = target.argumentExpression;
  return member !== undefined && ts.isStringLiteralLike(member)
    ? member.text === "require"
      ? "require"
      : "none"
    : "unresolved-module";
}

function resolveRelativeModule(fromPath: string, specifier: string): string {
  const raw = posix.normalize(posix.join(posix.dirname(fromPath), specifier));
  if (raw.endsWith(".js")) return `${raw.slice(0, -3)}.ts`;
  if (raw.endsWith(".mjs")) return `${raw.slice(0, -4)}.ts`;
  if (raw.endsWith(".cjs")) return `${raw.slice(0, -4)}.ts`;
  return posix.extname(raw).length === 0 ? `${raw}.ts` : raw;
}

function publicDiagnostics(
  diagnostics: readonly LocatedBoundaryDiagnosticV1[],
): readonly ReadinessBoundaryDiagnosticV1[] {
  return Object.freeze(
    [...diagnostics]
      .sort(
        (left, right) =>
          left.modulePath.localeCompare(right.modulePath) ||
          left.offset - right.offset ||
          left.code.localeCompare(right.code),
      )
      .map(({ code, path, message }) => Object.freeze({ code, path, message })),
  );
}

/**
 * Scans a bounded in-memory TypeScript graph for readiness package escapes.
 *
 * Static imports/exports and literal dynamic imports are traversed from the
 * exact entry set. Compiler package imports, relative escapes and computed
 * dynamic imports fail closed.
 *
 * @param input Hostile version-one module graph.
 * @returns Reachable lexical module paths or deterministic diagnostics.
 *
 * @example
 * ```ts
 * scanReadinessOracleBoundary({
 *   schemaVersion: 1,
 *   packageRoot: "packages/readiness",
 *   entryPaths: [],
 *   modules: [],
 * });
 * ```
 */
export function scanReadinessOracleBoundary(input: unknown): ReadinessBoundaryScanResultV1 {
  const parsed = parseBoundaryInput(input);
  if (!parsed.ok) return parsed;
  const modules = new Map(parsed.modules.map((module) => [module.path, module]));
  const pending = parsed.entries.map((path) => ({ path, depth: 0 }));
  const reachable = new Set<string>();
  const diagnostics: LocatedBoundaryDiagnosticV1[] = [];
  let importCount = 0;

  for (let cursor = 0; cursor < pending.length; cursor += 1) {
    const item = pending[cursor];
    if (item === undefined || reachable.has(item.path)) continue;
    const module = modules.get(item.path);
    if (module === undefined) {
      diagnostics.push(
        Object.freeze({
          ...diagnostic(
            "readiness.boundary.module.missing",
            "/entryPaths",
            "Boundary entry module is missing from the supplied graph.",
          ),
          modulePath: item.path,
          offset: 0,
        }),
      );
      continue;
    }
    if (item.depth > READINESS_BOUNDARY_LIMITS.graphDepth) {
      return failure(
        "readiness.boundary.input.limit",
        `/modules/${module.index}`,
        "Boundary graph exceeds the traversal depth limit.",
      );
    }
    reachable.add(item.path);
    let imports: readonly ModuleImportV1[];
    try {
      const source = ts.createSourceFile(
        item.path,
        module.text,
        ts.ScriptTarget.ES2023,
        true,
        ts.ScriptKind.TS,
      );
      imports = collectImports(source);
    } catch {
      diagnostics.push(
        Object.freeze({
          ...diagnostic(
            "readiness.boundary.input.invalid",
            `/modules/${module.index}/source`,
            "Boundary module could not be parsed or traversed safely.",
          ),
          modulePath: module.path,
          offset: 0,
        }),
      );
      continue;
    }
    for (const imported of imports) {
      importCount += 1;
      if (importCount > READINESS_BOUNDARY_LIMITS.imports) {
        return failure(
          "readiness.boundary.input.limit",
          `/modules/${module.index}/source`,
          "Boundary graph exceeds the import limit.",
        );
      }
      const pointer = `/modules/${module.index}/source`;
      if (imported.dynamic && imported.specifier === undefined) {
        diagnostics.push(
          Object.freeze({
            ...diagnostic(
              "readiness.boundary.import.dynamic",
              pointer,
              "Dynamic imports must use one literal module specifier.",
            ),
            modulePath: module.path,
            offset: imported.offset,
          }),
        );
        continue;
      }
      const specifier = imported.specifier;
      if (specifier === undefined) continue;
      if (specifier.startsWith("@blend65/")) {
        diagnostics.push(
          Object.freeze({
            ...diagnostic(
              "readiness.boundary.import.package",
              pointer,
              "Readiness oracle modules must not import compiler packages.",
            ),
            modulePath: module.path,
            offset: imported.offset,
          }),
        );
        continue;
      }
      if (!specifier.startsWith(".")) continue;
      const resolved = resolveRelativeModule(module.path, specifier);
      if (!resolved.startsWith(`${PACKAGE_ROOT}/`)) {
        diagnostics.push(
          Object.freeze({
            ...diagnostic(
              "readiness.boundary.import.escape",
              pointer,
              "Relative import resolves outside the readiness package.",
            ),
            modulePath: module.path,
            offset: imported.offset,
          }),
        );
        continue;
      }
      if (!modules.has(resolved)) {
        diagnostics.push(
          Object.freeze({
            ...diagnostic(
              "readiness.boundary.module.missing",
              pointer,
              "Contained relative import is missing from the supplied graph.",
            ),
            modulePath: module.path,
            offset: imported.offset,
          }),
        );
        continue;
      }
      pending.push({ path: resolved, depth: item.depth + 1 });
    }
  }
  if (diagnostics.length > 0) {
    return Object.freeze({ ok: false, diagnostics: publicDiagnostics(diagnostics) });
  }
  return Object.freeze({
    ok: true,
    modulePaths: Object.freeze([...reachable].sort((left, right) => left.localeCompare(right))),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}
