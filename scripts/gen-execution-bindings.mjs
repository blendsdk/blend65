import { createHash } from "node:crypto";
import { builtinModules } from "node:module";
import { readFile, readdir, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";
import ts from "typescript";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED_PATH = join(
  REPOSITORY_ROOT,
  "packages/readiness-execution/src/execution-handler-catalog.generated.ts",
);
const ENTRY_PATH = "packages/readiness-execution/dist/execution-live-handlers.js";
const RUNTIME_ROOT_PATHS = Object.freeze([
  ENTRY_PATH,
  "packages/readiness-execution/dist/execution-process-anchor-entry.js",
  "packages/readiness-execution/dist/execution-vice-launcher-entry.js",
  "packages/readiness-execution/dist/execution-worker-entry.js",
]);
const RUNTIME_ASSET_DIRECTORIES = Object.freeze(["packages/codegen/runtime"]);
const CAPABILITY_IDS = ["acme", "cli", "compiler-api", "emit", "frontend", "vice"];
const BUILTIN_MODULES = new Set(
  builtinModules.flatMap((specifier) => [specifier, `node:${specifier}`]),
);
const MAX_DEPENDENCY_FILES = 2_048;
const MAX_DEPENDENCY_FILE_BYTES = 16 * 1024 * 1024;
const MAX_DEPENDENCY_TOTAL_BYTES = 128 * 1024 * 1024;
const FORBIDDEN_RUNTIME_AUTHORITY_PATHS = Object.freeze([
  "packages/readiness/dist/index.js",
  "node_modules/typescript/",
]);

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function exists(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function emittedWorkspaceExport(specifier) {
  const parts = specifier.split("/");
  const packageName = parts.slice(0, 2).join("/");
  const packageDirectory = join(REPOSITORY_ROOT, "packages", packageName.slice("@blend65/".length));
  const subpath = parts.slice(2).join("/");
  const manifest = JSON.parse(await readFile(join(packageDirectory, "package.json"), "utf8"));
  const exportKey = subpath.length === 0 ? "." : `./${subpath}`;
  const exported = manifest.exports?.[exportKey];
  const importPath =
    typeof exported === "string"
      ? exported
      : typeof exported === "object" && exported !== null
        ? (exported.import ?? exported.default)
        : undefined;
  if (
    typeof importPath !== "string" ||
    !importPath.startsWith("./dist/") ||
    !importPath.endsWith(".js")
  ) {
    throw new Error(`Cannot resolve emitted workspace export ${specifier}`);
  }
  return [join(packageDirectory, "package.json"), join(packageDirectory, importPath)];
}

function barePackageIdentity(specifier) {
  const parts = specifier.split("/");
  return specifier.startsWith("@")
    ? { packageName: parts.slice(0, 2).join("/"), subpath: parts.slice(2).join("/") }
    : { packageName: parts[0], subpath: parts.slice(1).join("/") };
}

async function installedPackageDirectory(importer, packageName) {
  for (let directory = dirname(importer); ; directory = dirname(directory)) {
    const candidate = join(directory, "node_modules", packageName);
    const metadata = await stat(candidate).catch(() => undefined);
    if (metadata?.isDirectory()) return candidate;
    if (directory === REPOSITORY_ROOT || dirname(directory) === directory) break;
  }
  throw new Error(
    `Cannot resolve installed runtime package ${packageName} from ${relative(REPOSITORY_ROOT, importer)}`,
  );
}

function conditionalExportTargets(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(conditionalExportTargets);
  if (typeof value !== "object" || value === null) return [];
  for (const [condition, target] of Object.entries(value)) {
    if (condition === "node" || condition === "import" || condition === "default") {
      const targets = conditionalExportTargets(target);
      if (targets.length > 0) return targets;
    }
  }
  return [];
}

function exportedPackageTargets(exportsField, exportKey) {
  if (typeof exportsField === "string" || Array.isArray(exportsField)) {
    return exportKey === "." ? conditionalExportTargets(exportsField) : [];
  }
  if (typeof exportsField !== "object" || exportsField === null) return [];
  const keys = Object.keys(exportsField);
  if (!keys.some((key) => key.startsWith("."))) {
    return exportKey === "." ? conditionalExportTargets(exportsField) : [];
  }
  if (exportKey in exportsField) return conditionalExportTargets(exportsField[exportKey]);
  for (const key of keys) {
    const wildcard = key.indexOf("*");
    if (wildcard < 0) continue;
    const prefix = key.slice(0, wildcard);
    const suffix = key.slice(wildcard + 1);
    if (!exportKey.startsWith(prefix) || !exportKey.endsWith(suffix)) continue;
    const replacement = exportKey.slice(prefix.length, exportKey.length - suffix.length);
    return conditionalExportTargets(exportsField[key]).map((target) =>
      target.replaceAll("*", replacement),
    );
  }
  return [];
}

async function emittedFile(path) {
  for (const candidate of [
    path,
    `${path}.js`,
    `${path}.mjs`,
    `${path}.cjs`,
    `${path}.json`,
    `${path}.node`,
    join(path, "index.js"),
    join(path, "index.mjs"),
    join(path, "index.cjs"),
  ]) {
    if (await exists(candidate)) return candidate;
  }
  return undefined;
}

async function installedRuntimeEdges(importer, specifier) {
  const { packageName, subpath } = barePackageIdentity(specifier);
  const packageDirectory = await installedPackageDirectory(importer, packageName);
  const manifestPath = join(packageDirectory, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const exportKey = subpath.length === 0 ? "." : `./${subpath}`;
  const targets =
    manifest.exports === undefined
      ? [subpath.length === 0 ? (manifest.main ?? "index.js") : subpath]
      : exportedPackageTargets(manifest.exports, exportKey);
  if (targets.length === 0) {
    throw new Error(`Installed runtime package ${specifier} has no import export target`);
  }
  for (const target of targets) {
    if (
      typeof target !== "string" ||
      (!target.startsWith("./") && manifest.exports !== undefined)
    ) {
      continue;
    }
    const candidate = await emittedFile(resolve(packageDirectory, target));
    if (candidate === undefined) continue;
    const canonicalPackage = await realpath(packageDirectory);
    const canonicalCandidate = await realpath(candidate);
    if (!canonicalCandidate.startsWith(`${canonicalPackage}/`)) {
      throw new Error(`Installed runtime export ${specifier} escaped its package directory`);
    }
    return [manifestPath, candidate];
  }
  throw new Error(`Cannot resolve installed runtime export ${specifier}`);
}

async function resolveRuntimeEdge(importer, edge) {
  const { kind, specifier } = edge;
  if (BUILTIN_MODULES.has(specifier)) return [];
  if (specifier.startsWith("@blend65/")) return emittedWorkspaceExport(specifier);
  if (!specifier.startsWith(".")) return installedRuntimeEdges(importer, specifier);
  const raw = resolve(dirname(importer), specifier);
  for (const candidate of [raw, `${raw}.js`, join(raw, "index.js")]) {
    if (await exists(candidate)) return [candidate];
  }
  if (kind === "runtime URL" && specifier.endsWith("/")) {
    const anchor = await stat(raw).catch(() => undefined);
    if (anchor?.isDirectory()) return [];
  }
  throw new Error(
    `Cannot resolve emitted runtime edge ${specifier} from ${relative(REPOSITORY_ROOT, importer)}`,
  );
}

function finiteStringValues(expression) {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return [expression.text];
  }
  if (ts.isParenthesizedExpression(expression)) return finiteStringValues(expression.expression);
  if (ts.isConditionalExpression(expression)) {
    const whenTrue = finiteStringValues(expression.whenTrue);
    const whenFalse = finiteStringValues(expression.whenFalse);
    return whenTrue === undefined || whenFalse === undefined
      ? undefined
      : [...new Set([...whenTrue, ...whenFalse])];
  }
  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = finiteStringValues(expression.left);
    const right = finiteStringValues(expression.right);
    return left === undefined || right === undefined
      ? undefined
      : left.flatMap((prefix) => right.map((suffix) => `${prefix}${suffix}`));
  }
  return undefined;
}

function isImportMetaUrl(expression) {
  return (
    ts.isPropertyAccessExpression(expression) &&
    expression.name.text === "url" &&
    expression.expression.kind === ts.SyntaxKind.MetaProperty
  );
}

function runtimeSpecifiers(path, source, commonJs) {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.JS,
  );
  const specifiers = new Map();
  function retain(expression, kind) {
    const values = finiteStringValues(expression);
    if (values === undefined || values.length === 0) {
      throw new Error(`Unresolved nonliteral ${kind} edge in ${relative(REPOSITORY_ROOT, path)}`);
    }
    for (const value of values) {
      const previous = specifiers.get(value);
      if (previous !== undefined && previous !== kind) {
        throw new Error(
          `Ambiguous ${previous}/${kind} runtime edge in ${relative(REPOSITORY_ROOT, path)}`,
        );
      }
      specifiers.set(value, kind);
    }
  }
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined
    ) {
      retain(node.moduleSpecifier, "module");
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] !== undefined
    ) {
      retain(node.arguments[0], "dynamic import");
    } else if (
      commonJs &&
      ts.isCallExpression(node) &&
      ((ts.isIdentifier(node.expression) && node.expression.text === "require") ||
        (ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "require")) &&
      node.arguments[0] !== undefined
    ) {
      retain(node.arguments[0], "CommonJS require");
    } else if (
      commonJs &&
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "require" &&
      node.expression.name.text === "resolve" &&
      node.arguments[0] !== undefined
    ) {
      retain(node.arguments[0], "CommonJS resolve");
    } else if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "URL" &&
      node.arguments?.[0] !== undefined &&
      node.arguments[1] !== undefined &&
      isImportMetaUrl(node.arguments[1])
    ) {
      retain(node.arguments[0], "runtime URL");
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return [...specifiers].map(([specifier, kind]) => ({ specifier, kind }));
}

async function isCommonJsModule(path) {
  if (path.endsWith(".cjs")) return true;
  if (path.endsWith(".mjs")) return false;
  for (let directory = dirname(path); ; directory = dirname(directory)) {
    const manifestPath = join(directory, "package.json");
    const manifestSource = await readFile(manifestPath, "utf8").catch(() => undefined);
    if (manifestSource !== undefined) {
      const manifest = JSON.parse(manifestSource);
      return manifest.type !== "module";
    }
    if (directory === REPOSITORY_ROOT || dirname(directory) === directory) return true;
  }
}

async function runtimeAssetPaths() {
  const paths = [];
  for (const directory of RUNTIME_ASSET_DIRECTORIES) {
    const absoluteDirectory = join(REPOSITORY_ROOT, directory);
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || entry.isSymbolicLink()) {
        throw new Error(
          `Runtime asset directory contains a non-file entry: ${directory}/${entry.name}`,
        );
      }
      paths.push(join(absoluteDirectory, entry.name));
    }
  }
  return paths;
}

async function dependencyClosure(rootPaths) {
  const pending = [
    ...rootPaths.map((path) => join(REPOSITORY_ROOT, path)),
    ...(await runtimeAssetPaths()),
  ];
  const visited = new Set();
  while (pending.length > 0) {
    const path = pending.pop();
    if (path === undefined) break;
    const canonical = resolve(path);
    if (visited.has(canonical)) continue;
    if (!canonical.startsWith(`${REPOSITORY_ROOT}/`) || !(await exists(canonical))) {
      throw new Error(`Dependency escaped the emitted repository closure: ${canonical}`);
    }
    visited.add(canonical);
    if (![".js", ".mjs", ".cjs"].includes(extname(canonical))) continue;
    const source = await readFile(canonical, "utf8");
    const commonJs = await isCommonJsModule(canonical);
    for (const edge of runtimeSpecifiers(canonical, source, commonJs)) {
      const dependencies = await resolveRuntimeEdge(canonical, edge);
      pending.push(...dependencies);
    }
  }
  const paths = [...visited]
    .map((path) => relative(REPOSITORY_ROOT, path).replaceAll("\\", "/"))
    .sort();
  const forbidden = paths.find((path) =>
    FORBIDDEN_RUNTIME_AUTHORITY_PATHS.some((prefix) =>
      prefix.endsWith("/") ? path.startsWith(prefix) : path === prefix,
    ),
  );
  if (forbidden !== undefined) {
    throw new Error(`Execution dependency closure reached broad runtime authority: ${forbidden}`);
  }
  if (paths.length === 0 || paths.length > MAX_DEPENDENCY_FILES) {
    throw new Error("Execution dependency closure exceeds its file-count bound");
  }
  let totalBytes = 0;
  for (const path of paths) {
    const metadata = await stat(join(REPOSITORY_ROOT, path));
    if (!metadata.isFile() || metadata.size > MAX_DEPENDENCY_FILE_BYTES) {
      throw new Error(`Execution dependency exceeds its per-file bound: ${path}`);
    }
    totalBytes += metadata.size;
    if (totalBytes > MAX_DEPENDENCY_TOTAL_BYTES) {
      throw new Error("Execution dependency closure exceeds its aggregate byte bound");
    }
  }
  return paths;
}

function implementationRevision(capabilityId, contractVersion, entryPath, dependencies) {
  const preimage = Buffer.from(
    `${JSON.stringify({ capabilityId, contractVersion, entryPath, dependencies })}\n`,
    "utf8",
  );
  return `sha256:${createHash("sha256")
    .update(Buffer.from("blend65-execution-binding-v1\0", "utf8"))
    .update(preimage)
    .digest("hex")}`;
}

async function generatedRows() {
  const dependencyPaths = await dependencyClosure(RUNTIME_ROOT_PATHS);
  const dependencies = await Promise.all(
    dependencyPaths.map(async (path) => ({
      path,
      digest: sha256(await readFile(join(REPOSITORY_ROOT, path))),
    })),
  );
  return CAPABILITY_IDS.map((capabilityId) => ({
    capabilityId,
    contractVersion: "1.0.0",
    implementationRevision: implementationRevision(capabilityId, "1.0.0", ENTRY_PATH, dependencies),
    entryPath: ENTRY_PATH,
    dependencyPaths,
    dependencyDigests: Object.fromEntries(dependencies.map(({ path, digest }) => [path, digest])),
  }));
}

function renderGeneratedSource(rows) {
  const first = rows[0];
  const participants = rows.map(
    ({ capabilityId, contractVersion, implementationRevision, entryPath }) => ({
      capabilityId,
      contractVersion,
      implementationRevision,
      entryPath,
    }),
  );
  return `/**
 * Generated fixed execution-handler dependency catalog.
 *
 * Regenerate atomically with the package generate command. The non-mutating check command
 * reconstructs this file from the emitted workspace dependency graph.
 */
const GENERATED_EXECUTION_DEPENDENCY_PATHS_V1 = Object.freeze(${JSON.stringify(first.dependencyPaths, null, 2)});
const GENERATED_EXECUTION_DEPENDENCY_DIGESTS_V1 = Object.freeze(${JSON.stringify(first.dependencyDigests, null, 2)});

export const GENERATED_EXECUTION_HANDLER_CATALOG_V1 = Object.freeze({
  catalogKind: "execution-handler-catalog-v1" as const,
  revision: "execution-bindings-generated-v1" as const,
  sourceModule: "execution-handler-catalog.generated" as const,
  rows: Object.freeze(${JSON.stringify(participants, null, 2)}.map((participant) => Object.freeze({
    ...participant,
    dependencyPaths: GENERATED_EXECUTION_DEPENDENCY_PATHS_V1,
    dependencyDigests: GENERATED_EXECUTION_DEPENDENCY_DIGESTS_V1,
  }))),
});
`;
}

const mode = process.argv[2];
if (mode !== "--write" && mode !== "--check") {
  throw new Error("Usage: gen-execution-bindings.mjs --write|--check");
}
const prettierConfig = (await resolveConfig(GENERATED_PATH)) ?? {};
const expected = await format(renderGeneratedSource(await generatedRows()), {
  ...prettierConfig,
  filepath: GENERATED_PATH,
});
if (mode === "--check") {
  const actual = await readFile(GENERATED_PATH, "utf8").catch(() => "");
  if (actual !== expected) {
    process.stderr.write("execution handler bindings are stale\n");
    process.exitCode = 1;
  }
} else {
  const temporaryPath = `${GENERATED_PATH}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, expected, { encoding: "utf8", mode: 0o600, flag: "wx" });
    await rename(temporaryPath, GENERATED_PATH);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}
