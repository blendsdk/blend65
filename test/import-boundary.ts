import { readdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/** A workspace's actual public source entries and declared internal dependencies. */
interface Workspace {
  /** Package import identity, read from its manifest. */
  readonly name: string;
  /** Absolute workspace directory, used only for resolution. */
  readonly root: string;
  /** Declared package names, including build-only workspace edges. */
  readonly dependencies: readonly string[];
  /** Public subpaths mapped to actual source entries. */
  readonly exports: ReadonlyMap<string, string>;
}

/** Lexical tokens prevent import-shaped comments and strings from becoming edges. */
interface Token {
  /** Strings and symbols cannot accidentally act as declaration keywords. */
  readonly kind: "word" | "string" | "symbol";
  /** Identifier/punctuation spelling, or a decoded string value. */
  readonly value: string;
}

/** Package and internal-source owners that must remain independent of the backend. */
const FRONTEND = /(?:^|[/@-])(?:frontend|language-server|vscode)(?:$|[/.-])/;
/** Backend responsibilities, recognized as complete path/name components. */
const BACKEND =
  /(?:^|[/@-])(?:target|lowering|codegen|serializer|serialization|packager|packaging|emulator)(?:$|[/.-])/;

/** Narrow JSON objects before inspecting manifests; parsed input is not trusted typed data. */
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Translate emitted public entries to their real TypeScript source counterparts. */
function sourceEntry(root: string, entry: string): string {
  return resolve(root, entry.replace(/^\.\/dist\//, "./src/").replace(/\.js$/, ".ts"));
}

/** Select the ESM/default export target without supporting a configurable resolution policy. */
function exportTarget(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!record(value)) return null;
  return exportTarget(value.import ?? value.default);
}

/** Read real source files only; generated output and test fixtures are not runtime edges. */
async function sourceFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  const pending = [join(root, "src")];
  while (pending.length > 0) {
    const directory = pending.pop()!;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        result.push(path);
      }
    }
  }
  return result.sort();
}

/**
 * Read static ESM syntax without the compiler API. Strings retain their decoded
 * spelling, comments disappear, and template text is ignored. Interpolation
 * expressions are scanned too, so a dynamic import cannot hide inside a template.
 */
function tokens(text: string): Token[] {
  const result: Token[] = [];
  let index = 0;
  /** Consume an expression or template interpolation, tracking its nested braces. */
  function expression(interpolation: boolean): void {
    let depth = 0;
    while (index < text.length) {
      const character = text[index]!;
      if (/\s/.test(character)) {
        index += 1;
        continue;
      }
      if (text.startsWith("//", index)) {
        index += 2;
        while (index < text.length && text[index] !== "\n" && text[index] !== "\r") index += 1;
        continue;
      }
      if (text.startsWith("/*", index)) {
        const end = text.indexOf("*/", index + 2);
        index = end === -1 ? text.length : end + 2;
        continue;
      }
      if (character === '"' || character === "'") {
        index += 1;
        let value = "";
        while (index < text.length && text[index] !== character) {
          let next = text[index++]!;
          if (next === "\\") {
            next = text[index++] ?? "";
            if (next === "u" || next === "x") {
              if (next === "u" && text[index] === "{") {
                const end = text.indexOf("}", index + 1);
                const digits = text.slice(index + 1, end);
                const point = Number.parseInt(digits, 16);
                if (/^[0-9a-fA-F]{1,6}$/.test(digits) && point <= 0x10ffff) {
                  value += String.fromCodePoint(point);
                  index = end + 1;
                  continue;
                }
              }
              const count = next === "u" ? 4 : 2;
              const digits = text.slice(index, index + count);
              if (new RegExp("^[0-9a-fA-F]{" + count + "}$").test(digits)) {
                value += String.fromCharCode(Number.parseInt(digits, 16));
                index += count;
                continue;
              }
            }
          }
          value += next;
        }
        index += 1;
        result.push({ kind: "string", value });
        continue;
      }
      if (character === "`") {
        index += 1;
        while (index < text.length) {
          if (text[index] === "\\") {
            index += 2;
            continue;
          }
          if (text[index] === "`") {
            index += 1;
            break;
          }
          if (text.startsWith("${", index)) {
            index += 2;
            expression(true);
          } else index += 1;
        }
        // A template argument is deliberately nonliteral for dependency resolution.
        result.push({ kind: "symbol", value: "<template>" });
        continue;
      }
      if (/[A-Za-z_$]/.test(character)) {
        const start = index++;
        while (index < text.length && /[A-Za-z0-9_$]/.test(text[index]!)) index += 1;
        result.push({ kind: "word", value: text.slice(start, index) });
        continue;
      }
      if (interpolation && character === "}" && depth === 0) {
        index += 1;
        return;
      }
      if (character === "{") depth += 1;
      if (character === "}") depth -= 1;
      result.push({ kind: "symbol", value: character });
      index += 1;
    }
  }
  expression(false);
  return result;
}

/** Extract static imports/re-exports and literal dynamic imports; null means unresolved dynamic input. */
function imports(text: string): readonly (string | null)[] {
  const input = tokens(text);
  const result: (string | null)[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const token = input[index]!;
    if (token.kind !== "word" || !["import", "export"].includes(token.value)) continue;
    if (input[index - 1]?.value === ".") continue;
    const next = input[index + 1];
    if (token.value === "import" && next?.value === ".") continue; // import.meta is not an edge.
    if (token.value === "import" && next?.value === "(") {
      const argument = input[index + 2];
      const end = input[index + 3]?.value;
      result.push(
        argument?.kind === "string" && (end === ")" || end === ",") ? argument.value : null,
      );
      continue;
    }
    if (token.value === "import" && next?.kind === "string") {
      result.push(next.value);
      continue;
    }
    // Only declarations with an import clause or export clause can own a from specifier.
    if (token.value === "export" && !["type", "{", "*"].includes(next?.value ?? "")) continue;
    for (let cursor = index + 1; cursor < input.length; cursor += 1) {
      const item = input[cursor]!;
      if (item.value === ";" || (item.kind === "word" && ["import", "export"].includes(item.value)))
        break;
      if (item.kind === "word" && item.value === "from") {
        const specifier = input[cursor + 1];
        if (specifier?.kind === "string") {
          result.push(specifier.value);
          break;
        }
      }
    }
  }
  return result;
}

/** Test component containment, not a string prefix that confuses sibling package names. */
function contains(root: string, path: string): boolean {
  const remainder = relative(root, path);
  return remainder !== ".." && !remainder.startsWith(".." + sep) && !isAbsolute(remainder);
}

/**
 * Inspect actual workspace declarations and source edges.
 * Public declared workspace edges are allowed; private/undeclared edges and
 * workspace cycles are rejected. Every frontend/editor source is checked
 * transitively for backend ownership. This is a private test utility, not a
 * package API or configurable architecture framework.
 * @returns Concise violations, or an empty array for a valid graph.
 * @throws For unreadable or malformed repository inputs, so the check fails closed.
 */
export async function inspectImportBoundary(root: string): Promise<readonly string[]> {
  const workspaces: Workspace[] = [];
  const violations: string[] = [];
  for (const directory of await readdir(join(root, "packages"), { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const packageRoot = join(root, "packages", directory.name);
    const manifest: unknown = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
    if (!record(manifest) || typeof manifest.name !== "string")
      throw new Error("Invalid workspace manifest");
    const entries = new Map<string, string>();
    const exports = manifest.exports;
    if (record(exports)) {
      for (const [key, value] of Object.entries(exports)) {
        const target = exportTarget(value);
        if (target !== null) entries.set(key, sourceEntry(packageRoot, target));
      }
    } else {
      const target = exportTarget(exports);
      if (target !== null) entries.set(".", sourceEntry(packageRoot, target));
    }
    const dependencies = [
      manifest.dependencies,
      manifest.devDependencies,
      manifest.peerDependencies,
      manifest.optionalDependencies,
    ].flatMap((value) => (record(value) ? Object.keys(value) : []));
    workspaces.push({ name: manifest.name, root: packageRoot, dependencies, exports: entries });
  }
  const byName = new Map(workspaces.map((workspace) => [workspace.name, workspace]));
  const owners = new Map<string, Workspace>();
  for (const workspace of workspaces) {
    for (const file of await sourceFiles(workspace.root)) owners.set(file, workspace);
  }
  const edges = new Map<string, string[]>();
  const unresolvedDynamic = new Set<string>();
  for (const [file, owner] of owners) {
    const targets: string[] = [];
    const display = relative(root, file).split(sep).join("/");
    for (const specifier of imports(await readFile(file, "utf8"))) {
      if (specifier === null) {
        // An unresolved edge fails only when a frontend/editor owner can reach it.
        unresolvedDynamic.add(file);
        continue;
      }
      if (specifier.startsWith(".")) {
        const target = resolve(dirname(file), specifier.replace(/\.js$/, ".ts"));
        if (!contains(owner.root, target))
          violations.push(display + ": relative cross-package import " + specifier);
        else if (owners.has(target)) targets.push(target);
        else violations.push(display + ": unresolved source import " + specifier);
        continue;
      }
      const dependency = workspaces.find(
        (workspace) => specifier === workspace.name || specifier.startsWith(workspace.name + "/"),
      );
      if (dependency === undefined) {
        if (specifier.startsWith("@blend65/"))
          violations.push(display + ": unresolved workspace import " + specifier);
        continue; // Node built-ins and external packages are not workspace edges.
      }
      const subpath =
        specifier === dependency.name ? "." : "." + specifier.slice(dependency.name.length);
      const target = dependency.exports.get(subpath);
      if (!owner.dependencies.includes(dependency.name))
        violations.push(display + ": undeclared workspace import " + specifier);
      if (target === undefined || !owners.has(target) || !contains(dependency.root, target))
        violations.push(display + ": private or unresolved workspace import " + specifier);
      else targets.push(target);
    }
    edges.set(file, targets);
  }
  const frontend = [...owners.keys()].filter((file) =>
    FRONTEND.test(relative(root, file).split(sep).join("/")),
  );
  for (const start of frontend) {
    const seen = new Set<string>();
    const pending = [start];
    while (pending.length > 0) {
      const file = pending.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      const display = relative(root, file).split(sep).join("/");
      if (unresolvedDynamic.has(file))
        violations.push(display + ": nonliteral dynamic import reachable from frontend");
      if (BACKEND.test(display))
        violations.push(relative(root, start) + ": reaches backend " + display);
      for (const target of edges.get(file) ?? []) pending.push(target);
    }
  }
  const visited = new Set<string>();
  const active = new Set<string>();
  /** A declared cycle is forbidden even when source imports do not expose it yet. */
  function visit(name: string): void {
    if (active.has(name)) {
      violations.push("Workspace dependency cycle: " + name);
      return;
    }
    if (visited.has(name)) return;
    visited.add(name);
    active.add(name);
    for (const dependency of byName.get(name)?.dependencies ?? []) {
      if (byName.has(dependency)) visit(dependency);
    }
    active.delete(name);
  }
  for (const name of byName.keys()) visit(name);
  return [...new Set(violations)].sort();
}
