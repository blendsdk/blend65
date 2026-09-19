import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type {
  ProjectDiagnostic,
  ProjectSnapshot,
  SourceRecord,
  SourceSpan,
} from "../project/types.js";
import { indexModules, resolveModules } from "./modules.js";

function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function source(
  sourceId: string,
  text: string,
  resolvedPath = `/checkout/${sourceId}`,
): SourceRecord {
  return {
    sourceId,
    text,
    sha256: hash(text),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath,
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function snapshot(
  effectiveEntry: string,
  sources: readonly SourceRecord[],
  checkout = "/checkout",
): ProjectSnapshot {
  const manifestText = "{}";
  const manifestSource = source("blend65.json", manifestText, `${checkout}/blend65.json`);
  return deepFreeze({
    manifest: {
      schemaVersion: 1,
      name: "module-spec",
      sourceRoot: "src",
      entry: effectiveEntry,
      target: "test.target",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck: true,
      divisionZeroCheck: true,
    },
    manifestSource,
    sources,
    inputSha256: hash(JSON.stringify(sources.map(({ sourceId, sha256 }) => [sourceId, sha256]))),
    projectRoot: checkout,
    sourceRoot: `${checkout}/src`,
    assetPaths: [],
    outDir: `${checkout}/out`,
    overrides: { target: null, entry: null },
    effectiveTarget: "test.target",
    effectiveEntry,
  });
}

function findFragment(text: string, fragment: string, occurrence = 0): number {
  let characterStart = -1;
  let searchFrom = 0;
  for (let index = 0; index <= occurrence; index += 1) {
    characterStart = text.indexOf(fragment, searchFrom);
    if (characterStart < 0) {
      throw new Error(`Test fixture does not contain ${JSON.stringify(fragment)}`);
    }
    searchFrom = characterStart + fragment.length;
  }
  return characterStart;
}

function spanOf(sourceId: string, text: string, fragment: string, occurrence = 0): SourceSpan {
  const characterStart = findFragment(text, fragment, occurrence);
  const start = Buffer.byteLength(text.slice(0, characterStart), "utf8");
  return { sourceId, start, end: start + Buffer.byteLength(fragment, "utf8") };
}

function declarationNameSpanOf(
  sourceId: string,
  text: string,
  declaration: string,
  name: string,
): SourceSpan {
  const declarationStart = findFragment(text, declaration);
  const relativeStart = declaration.indexOf(` ${name}`);
  if (relativeStart < 0) throw new Error("Test fixture declaration does not contain its name");
  const characterStart = declarationStart + relativeStart + 1;
  const start = Buffer.byteLength(text.slice(0, characterStart), "utf8");
  return { sourceId, start, end: start + Buffer.byteLength(name, "utf8") };
}

function locationOf(sourceId: string, text: string, target: SourceSpan): string {
  const prefix = Buffer.from(text, "utf8").subarray(0, target.start).toString("utf8");
  const lines = prefix.split("\n");
  const line = lines.length;
  const column = Buffer.byteLength(lines.at(-1) ?? "", "utf8") + 1;
  return `${sourceId}:${line}:${column}`;
}

function expectOnlyError(
  result: {
    readonly diagnostics: readonly ProjectDiagnostic[];
    readonly complete: boolean;
  },
  code: string,
  message: string,
): ProjectDiagnostic {
  expect(result.complete).toBe(false);
  expect(result.diagnostics).toHaveLength(1);
  const diagnostic = result.diagnostics[0]!;
  expect(diagnostic.code).toBe(code);
  expect(diagnostic.severity).toBe("error");
  expect(diagnostic.message).toBe(message);
  return diagnostic;
}

function expectCollectionsFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectCollectionsFrozen(nested);
}

function compareSourceSpans(left: SourceSpan, right: SourceSpan): number {
  return (
    Buffer.compare(Buffer.from(left.sourceId, "utf8"), Buffer.from(right.sourceId, "utf8")) ||
    left.start - right.start ||
    left.end - right.end
  );
}

describe("module indexing and resolution", () => {
  it("merges same-named modules and diagnoses a duplicate declaration at both names", () => {
    const firstId = "src/a.blend";
    const secondId = "src/b.blend";
    const firstText = ["module Game;", "function main(): void {}", "function f(): void {}"].join(
      "\n",
    );
    const secondText = ["module Game;", "function f(): void {}"].join("\n");
    const project = snapshot("Game", [source(firstId, firstText), source(secondId, secondText)]);

    const indexed = indexModules(project);

    expect(indexed.complete).toBe(true);
    expect(indexed.diagnostics).toEqual([]);
    expect(indexed.obligations).toEqual([]);
    expect(indexed.index.modules.map(({ name }) => name)).toEqual(["Game"]);
    expect(
      indexed.index.modules[0]?.contributions.map(({ sourceId, header }) => ({
        sourceId,
        module: header.name,
      })),
    ).toEqual([
      { sourceId: firstId, module: "Game" },
      { sourceId: secondId, module: "Game" },
    ]);

    const resolved = resolveModules(project, indexed.index);
    const firstName = declarationNameSpanOf(firstId, firstText, "function f(): void {}", "f");
    const secondName = declarationNameSpanOf(secondId, secondText, "function f(): void {}", "f");
    const relatedLocation = locationOf(firstId, firstText, firstName);
    const duplicate = expectOnlyError(
      resolved,
      "E10003",
      `Duplicate declaration 'f' in the same scope — also declared at ${relatedLocation}`,
    );
    expect(duplicate.primarySpan).toEqual(secondName);
    expect(duplicate.related).toHaveLength(1);
    expect(duplicate.related[0]?.span).toEqual(firstName);
    expect(resolved.graph?.modules).toHaveLength(1);
    expect(resolved.graph?.modules[0]?.name).toBe("Game");
    expect(resolved.graph?.modules[0]?.units.map((unit) => unit.span.sourceId)).toEqual([
      firstId,
      secondId,
    ]);
  });

  it("resolves a legal import cycle and gives an alias the exported declaration identity", () => {
    const gameId = "src/game.blend";
    const mathId = "src/math.blend";
    const gameText = [
      "module Game;",
      "import { f as g } from Math;",
      "export const seed: byte = 1;",
      "function main(): void { g(); }",
    ].join("\n");
    const mathText = [
      "module Math;",
      "import { seed } from Game;",
      "export function f(): void {}",
    ].join("\n");
    const project = snapshot("Game", [source(gameId, gameText), source(mathId, mathText)]);
    const indexed = indexModules(project);

    const resolved = resolveModules(project, indexed.index);

    expect(resolved.complete).toBe(true);
    expect(resolved.diagnostics).toEqual([]);
    expect(resolved.obligations).toEqual([]);
    expect(resolved.graph).not.toBeNull();
    const graph = resolved.graph!;
    expect(graph.modules.map(({ name }) => name)).toEqual(["Game", "Math"]);
    const mathFunction = graph.bindings.find(({ qualifiedName }) => qualifiedName === "Math.f");
    expect(mathFunction).toBeDefined();
    expect(mathFunction).toMatchObject({
      name: "f",
      qualifiedName: "Math.f",
      exported: true,
      storage: "function",
      id: {
        sourceId: mathId,
        span: spanOf(mathId, mathText, "export function f(): void {}"),
      },
    });
    const alias = graph.imports.find(({ alias }) => alias === "g");
    expect(alias).toBeDefined();
    expect(alias?.binding).toEqual(mathFunction?.id);
    expect(graph.bindings.map(({ id }) => id.span)).toEqual(
      [...graph.bindings.map(({ id }) => id.span)].sort(compareSourceSpans),
    );
    expect(graph.imports.map(({ sourceSpan }) => sourceSpan)).toEqual(
      [...graph.imports.map(({ sourceSpan }) => sourceSpan)].sort(compareSourceSpans),
    );
    expectCollectionsFrozen(indexed);
    expectCollectionsFrozen(resolved);
  });

  it("rejects a named import when its target declaration is not exported", () => {
    const gameText = [
      "module Game;",
      "import { f as g } from Math;",
      "function main(): void { g(); }",
    ].join("\n");
    const mathText = "module Math;\nfunction f(): void {}";
    const project = snapshot("Game", [
      source("src/game.blend", gameText),
      source("src/math.blend", mathText),
    ]);
    const indexed = indexModules(project);

    const resolved = resolveModules(project, indexed.index);

    expectOnlyError(resolved, "E10012", "'f' is not exported from module 'Math'");
  });

  it("uses qualified access for reachability and ignores an unreachable malformed body", () => {
    const gameId = "src/Math.blend";
    const mathId = "src/Game.blend";
    const otherId = "src/looks-like-game.blend";
    const gameText = "module Game;\nfunction main(): void { Math.f(); }";
    const mathText = "module Math;\nexport function f(): void {}";
    const otherText = "module Other;\nfunction broken(: void {";
    const first = snapshot(
      "Game",
      [
        source(gameId, gameText, "/one/misleading/Math.blend"),
        source(mathId, mathText, "/one/misleading/Game.blend"),
        source(otherId, otherText, "/one/Game.blend"),
      ],
      "/one",
    );
    const second = snapshot(
      "Game",
      [
        source(otherId, otherText, "D:/two/Game.blend"),
        source(mathId, mathText, "D:/two/misleading/Game.blend"),
        source(gameId, gameText, "D:/two/misleading/Math.blend"),
      ],
      "D:/two",
    );

    const firstIndex = indexModules(first);
    const secondIndex = indexModules(second);
    const firstResult = resolveModules(first, firstIndex.index);
    const secondResult = resolveModules(second, secondIndex.index);

    expect(firstIndex.diagnostics).toEqual([]);
    expect(secondIndex.diagnostics).toEqual([]);
    expect(firstIndex.index.modules.map(({ name }) => name)).toEqual(["Game", "Math", "Other"]);
    expect(secondIndex.index.modules.map(({ name }) => name)).toEqual(["Game", "Math", "Other"]);
    expect(firstResult.complete).toBe(true);
    expect(secondResult.complete).toBe(true);
    expect(firstResult.diagnostics).toEqual([]);
    expect(secondResult.diagnostics).toEqual([]);
    expect(firstResult.obligations).toEqual([]);
    expect(secondResult.obligations).toEqual([]);
    expect(firstResult.graph).toEqual(secondResult.graph);
    expect(firstResult.graph?.modules.map(({ name }) => name)).toEqual(["Game", "Math"]);
    expect(firstResult.graph?.modules.map(({ units }) => units[0]?.span.sourceId)).toEqual([
      gameId,
      mathId,
    ]);
    expect(
      firstResult.graph?.bindings.some(({ qualifiedName }) => qualifiedName === "Math.f"),
    ).toBe(true);
    expect(
      firstResult.graph?.modules.some(({ units }) =>
        units.some((unit) => unit.span.sourceId === otherId),
      ),
    ).toBe(false);
  });
});

describe("entry-point validation", () => {
  it("requires one reachable main function", () => {
    const text = "module Game;\nfunction helper(): void {}";
    const project = snapshot("Game", [source("src/game.blend", text)]);
    const indexed = indexModules(project);

    const resolved = resolveModules(project, indexed.index);

    expectOnlyError(
      resolved,
      "E10020",
      "No entry point found — define 'function main(): void' in any module",
    );
    expect(resolved.graph?.entry).toBeNull();
  });

  it("rejects a reachable main with parameters", () => {
    const text = "module Game;\nfunction main(x: byte): void {}";
    const project = snapshot("Game", [source("src/game.blend", text)]);
    const indexed = indexModules(project);

    const resolved = resolveModules(project, indexed.index);

    expectOnlyError(
      resolved,
      "E10022",
      "Entry point 'main' must have signature 'function main(): void' — found 'function main(x: byte): void'",
    );
  });

  it("rejects main functions in two reachable modules", () => {
    const gameText = [
      "module Game;",
      "import { helper } from Other;",
      "function main(): void { helper(); }",
    ].join("\n");
    const otherText = [
      "module Other;",
      "export function helper(): void {}",
      "function main(): void {}",
    ].join("\n");
    const project = snapshot("Game", [
      source("src/game.blend", gameText),
      source("src/other.blend", otherText),
    ]);
    const indexed = indexModules(project);

    const resolved = resolveModules(project, indexed.index);

    expectOnlyError(
      resolved,
      "E10021",
      "Multiple entry points found — 'main' is defined in modules 'Game' and 'Other'; only one is allowed",
    );
  });

  it("rejects an ordinary direct call to main", () => {
    const text = [
      "module Game;",
      "function main(): void {}",
      "function helper(): void { main(); }",
    ].join("\n");
    const project = snapshot("Game", [source("src/game.blend", text)]);
    const indexed = indexModules(project);

    const resolved = resolveModules(project, indexed.index);

    expectOnlyError(
      resolved,
      "E10023",
      "Cannot call 'main()' — it is the program entry point, not a callable function",
    );
  });

  it("does not collide with a main in an unreachable module", () => {
    const gameId = "src/game.blend";
    const gameText = "module Game;\nfunction main(): void {}";
    const otherText = "module Other;\nfunction main(): void {}";
    const project = snapshot("Game", [
      source(gameId, gameText),
      source("src/other.blend", otherText),
    ]);
    const indexed = indexModules(project);

    const resolved = resolveModules(project, indexed.index);

    expect(resolved.complete).toBe(true);
    expect(resolved.diagnostics).toEqual([]);
    expect(resolved.obligations).toEqual([]);
    expect(resolved.graph?.modules.map(({ name }) => name)).toEqual(["Game"]);
    const main = resolved.graph?.bindings.find(
      ({ qualifiedName }) => qualifiedName === "Game.main",
    );
    expect(main?.id).toEqual({
      sourceId: gameId,
      span: spanOf(gameId, gameText, "function main(): void {}"),
    });
    expect(resolved.graph?.entry).toEqual(main?.id);
  });
});
