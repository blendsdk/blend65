import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { indexModules, resolveModules } from "./modules.js";

/** Build one exact in-memory source record. */
function source(sourceId: string, text: string): SourceRecord {
  return {
    sourceId,
    text,
    sha256: createHash("sha256").update(text, "utf8").digest("hex"),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: `/unused/${sourceId}`,
  };
}

/** Build the smallest immutable project snapshot accepted by module analysis. */
function snapshot(effectiveEntry: string, sources: readonly SourceRecord[]): ProjectSnapshot {
  const manifestSource = source("blend65.json", "{}");
  return Object.freeze({
    manifest: Object.freeze({
      schemaVersion: 1,
      name: "module-implementation",
      sourceRoot: "src",
      entry: effectiveEntry,
      target: "test.target",
      assetPaths: Object.freeze([]),
      outDir: "out",
      optimization: "none",
      boundsCheck: true,
      divisionZeroCheck: true,
    }),
    manifestSource,
    sources: Object.freeze(sources),
    inputSha256: "unused",
    projectRoot: "/unused",
    sourceRoot: "/unused/src",
    assetPaths: Object.freeze([]),
    outDir: "/unused/out",
    overrides: Object.freeze({ target: null, entry: null }),
    effectiveTarget: "test.target",
    effectiveEntry,
  });
}

/** Assert that every exposed array is immutable. */
function expectArraysFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectArraysFrozen(nested);
}

describe("module graph implementation boundaries", () => {
  it("should sort module names and merged contributions by UTF-8 bytes", () => {
    const project = snapshot("A", [
      source("src/z.blend", "module A; function helper(): void {}"),
      source("src/b.blend", "module Z; function unused(): void {}"),
      source("src/a.blend", "module A; function main(): void {}"),
    ]);

    const indexed = indexModules(project);

    expect(indexed.index.modules.map(({ name }) => name)).toEqual(["A", "Z"]);
    expect(indexed.index.modules[0]?.contributions.map(({ sourceId }) => sourceId)).toEqual([
      "src/a.blend",
      "src/z.blend",
    ]);
    expectArraysFrozen(indexed);
  });

  it("should retain a dependency obligation when an imported module is absent", () => {
    const project = snapshot("Game", [
      source("src/game.blend", "module Game; import { f } from Missing; function main(): void {}"),
    ]);

    const indexed = indexModules(project);
    const resolved = resolveModules(project, indexed.index);

    expect(resolved.complete).toBe(false);
    expect(resolved.diagnostics).toEqual([]);
    expect(resolved.obligations).toMatchObject([
      { kind: "dependency", message: "Required module 'Missing' is unavailable" },
    ]);
    expect(resolved.graph?.modules.map(({ name }) => name)).toEqual(["Game"]);
  });

  it("should preserve accepted siblings when reachable syntax is poisoned", () => {
    const project = snapshot("Game", [
      source("src/game.blend", "module Game; function main(): void {} function broken(: void {"),
    ]);

    const resolved = resolveModules(project, indexModules(project).index);

    expect(resolved.complete).toBe(false);
    expect(resolved.diagnostics.some(({ code }) => code === "PARSE_SYNTAX_ERROR")).toBe(true);
    expect(resolved.graph?.bindings.map(({ qualifiedName }) => qualifiedName)).toContain(
      "Game.main",
    );
    expect(resolved.graph?.entry).not.toBeNull();
  });

  it("should produce the same graph for either order of a declaration cycle", () => {
    const game = source(
      "src/game.blend",
      "module Game; import { f } from Math; export const seed: byte = 1; function main(): void { f(); }",
    );
    const math = source(
      "src/math.blend",
      "module Math; import { seed } from Game; export function f(): void {}",
    );

    const first = snapshot("Game", [game, math]);
    const second = snapshot("Game", [math, game]);
    const firstResult = resolveModules(first, indexModules(first).index);
    const secondResult = resolveModules(second, indexModules(second).index);

    expect(firstResult).toEqual(secondResult);
    expect(firstResult.complete).toBe(true);
    expectArraysFrozen(firstResult);
  });

  it("should select the same first zeropage block for either input order", () => {
    const first = source(
      "src/a.blend",
      "module Game; zeropage { a: byte; } function main(): void {}",
    );
    const second = source("src/z.blend", "module Game; zeropage { z: byte; }");
    const ordered = snapshot("Game", [first, second]);
    const reversed = snapshot("Game", [second, first]);

    const firstResult = resolveModules(ordered, indexModules(ordered).index);
    const secondResult = resolveModules(reversed, indexModules(reversed).index);

    expect(firstResult).toEqual(secondResult);
    expect(firstResult.diagnostics.map(({ code }) => code)).toEqual(["E10030"]);
    expect(firstResult.graph?.bindings.map(({ qualifiedName }) => qualifiedName)).toContain(
      "Game.a",
    );
    expect(firstResult.graph?.bindings.map(({ qualifiedName }) => qualifiedName)).not.toContain(
      "Game.z",
    );
  });

  it("should inspect a deep qualified member chain without exhausting the host stack", () => {
    const suffix = Array.from({ length: 5_000 }, () => "field").join(".");
    const project = snapshot("Game", [
      source("src/game.blend", `module Game; function main(): void { Math.x.${suffix}; }`),
      source("src/math.blend", "module Math; export const x: byte = 1;"),
    ]);

    expect(() => resolveModules(project, indexModules(project).index)).not.toThrow();
    const resolved = resolveModules(project, indexModules(project).index);
    expect(resolved.complete).toBe(true);
    expect(resolved.graph?.modules.map(({ name }) => name)).toEqual(["Game", "Math"]);
  });

  it("should explain defensive parser exhaustion with an obligation", () => {
    const deep = snapshot("Game", [
      source(
        "src/game.blend",
        `module Game; function main(): void { ${"{".repeat(5_000)}${"}".repeat(5_000)} }`,
      ),
    ]);

    const deepResult = resolveModules(deep, indexModules(deep).index);

    expect(deepResult.obligations.map(({ kind }) => kind)).toContain("analysis-limit");
    expect(deepResult.complete).toBe(false);
  });

  it("should require absent modules named by qualified calls and types", () => {
    const project = snapshot("Game", [
      source(
        "src/game.blend",
        "module Game; let value: Missing.Type; function main(): void { Other.f(); }",
      ),
    ]);

    const resolved = resolveModules(project, indexModules(project).index);

    expect(resolved.diagnostics).toEqual([]);
    expect(resolved.obligations.map(({ message }) => message)).toEqual([
      "Required module 'Missing' is unavailable",
      "Required module 'Other' is unavailable",
    ]);
    expect(resolved.complete).toBe(false);
  });

  it("should diagnose calls by resolved entry identity rather than member spelling", () => {
    const wrongEntry = snapshot("Game", [
      source("src/game.blend", "module Game; function main(x: byte): void { main(x); }"),
    ]);
    const ordinaryMember = snapshot("Game", [
      source(
        "src/game.blend",
        "module Game; function main(): void {} function helper(): void { let object: byte = 0; object.main(); }",
      ),
    ]);

    const wrongResult = resolveModules(wrongEntry, indexModules(wrongEntry).index);
    const memberResult = resolveModules(ordinaryMember, indexModules(ordinaryMember).index);

    expect(wrongResult.diagnostics.map(({ code }) => code)).toEqual(["E10022", "E10023"]);
    expect(memberResult.diagnostics).toEqual([]);
    expect(memberResult.complete).toBe(true);
  });

  it("should apply local value roots only after declaration and within their lexical scope", () => {
    const project = snapshot("Game", [
      source(
        "src/game.blend",
        [
          "module Game;",
          "function main(): void {",
          "  Math.f();",
          "  if (true) { let Math: byte = 0; Math.field; }",
          "}",
        ].join("\n"),
      ),
      source("src/math.blend", "module Math; export function f(): void {}"),
    ]);

    const resolved = resolveModules(project, indexModules(project).index);

    expect(resolved.complete).toBe(true);
    expect(resolved.graph?.modules.map(({ name }) => name)).toEqual(["Game", "Math"]);
  });

  it("should order an import-alias collision by the exact name spans", () => {
    const gameText = [
      "module Game;",
      "import { f as same } from Math;",
      "function same(): void {}",
      "const same: byte = 1;",
      "function main(): void {}",
    ].join("\n");
    const project = snapshot("Game", [
      source("src/game.blend", gameText),
      source("src/math.blend", "module Math; export function f(): void {}"),
    ]);

    const resolved = resolveModules(project, indexModules(project).index);
    const duplicates = resolved.diagnostics.filter(({ code }) => code === "E10003");
    const aliasStart = Buffer.byteLength(gameText.slice(0, gameText.indexOf("same")));

    expect(duplicates.map(({ primarySpan }) => primarySpan?.start)).toEqual([
      Buffer.byteLength(gameText.slice(0, gameText.indexOf("function same") + 9)),
      Buffer.byteLength(gameText.slice(0, gameText.indexOf("const same") + 6)),
    ]);
    expect(duplicates.map(({ related }) => related[0]?.span.start)).toEqual([
      aliasStart,
      aliasStart,
    ]);
  });
});
