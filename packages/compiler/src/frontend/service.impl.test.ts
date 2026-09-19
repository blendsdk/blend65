import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { sortAnalysisDiagnostics } from "./diagnostics.js";
import { analyzeProject } from "./service.js";

/** Build one exact in-memory source record. */
function source(sourceId: string, text: string): SourceRecord {
  return Object.freeze({
    sourceId,
    text,
    sha256: createHash("sha256").update(text, "utf8").digest("hex"),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: `/unused/${sourceId}`,
  });
}

/** Recursively freeze test input so accidental service mutation throws. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

/** Build the smallest immutable project snapshot accepted by analysis. */
function snapshot(sources: readonly SourceRecord[]): ProjectSnapshot {
  return deepFreeze({
    manifest: {
      schemaVersion: 1,
      name: "service-implementation",
      sourceRoot: "src",
      entry: "Game",
      target: "test.target",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck: true,
      divisionZeroCheck: true,
    },
    manifestSource: source("blend65.json", "{}"),
    sources,
    inputSha256: "unused",
    projectRoot: "/unused",
    sourceRoot: "/unused/src",
    assetPaths: [],
    outDir: "/unused/out",
    overrides: { target: null, entry: null },
    effectiveTarget: "test.target",
    effectiveEntry: "Game",
  });
}

/** Assert that every exposed array is immutable. */
function expectArraysFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectArraysFrozen(nested);
}

describe("analysis service implementation boundaries", () => {
  it("should preserve production order after equal source spans and codes", () => {
    const span = { sourceId: "src/game.blend", start: 10, end: 11 };
    const laterMessageFirst = projectDiagnostic("E10000", "Zulu producer", span);
    const earlierMessageSecond = projectDiagnostic("E10000", "Alpha producer", span);

    expect(sortAnalysisDiagnostics([laterMessageFirst, earlierMessageSecond])).toEqual([
      laterMessageFirst,
      earlierMessageSecond,
    ]);
  });

  it("should keep a missing module as an explicit dependency without exposing a program", () => {
    const project = snapshot([
      source(
        "src/game.blend",
        "module Game; import { f } from Missing; function main(): void { f(); }",
      ),
    ]);

    const result = analyzeProject(project);

    expect(result.kind).toBe("incomplete");
    expect(result).not.toHaveProperty("program");
    expect(result.diagnostics).toEqual([]);
    if (result.kind !== "incomplete") throw new Error(`Expected incomplete, got ${result.kind}`);
    expect(result.obligations).toContainEqual(
      expect.objectContaining({
        kind: "dependency",
        message: "Required module 'Missing' is unavailable",
      }),
    );
  });

  it("should not publish guessed effects when a reachable function body is poisoned", () => {
    const project = snapshot([
      source(
        "src/game.blend",
        [
          "module Game;",
          "let state: word = broken();",
          "function broken(): word { return missing; }",
          "function main(): void {}",
        ].join("\n"),
      ),
    ]);

    const result = analyzeProject(project);

    expect(result.kind).toBe("error");
    expect(result).not.toHaveProperty("program");
    expect(result.diagnostics.map(({ code }) => code)).toContain("E10239");
  });

  it("should reject a bare embed name instead of treating it as a pending asset call", () => {
    const result = analyzeProject(
      snapshot([source("src/game.blend", "module Game; function main(): void { embed; }")]),
    );

    expect(result.kind).toBe("error");
    expect(result.diagnostics.map(({ code }) => code)).toContain("E10239");
    expect(result).not.toHaveProperty("program");
  });

  it.each([
    ["qualified call", "function main(): void { Other.f(); }"],
    ["qualified type", "let value: Missing.Type; function main(): void {}"],
  ])("should keep a missing module as the root fact for a %s", (_name, declaration) => {
    const result = analyzeProject(
      snapshot([source("src/game.blend", `module Game; ${declaration}`)]),
    );

    expect(result.kind).toBe("incomplete");
    expect(result.diagnostics).toEqual([]);
    if (result.kind !== "incomplete") throw new Error(`Expected incomplete, got ${result.kind}`);
    expect(result.obligations).toContainEqual(
      expect.objectContaining({
        kind: "dependency",
        message: expect.stringContaining("unavailable"),
      }),
    );
  });

  it("should keep a local value root ahead of a reachable qualified function", () => {
    const project = snapshot([
      source(
        "src/game.blend",
        "module Game; import { f as other } from Math; function main(): void { let Math: byte = 0; Math.f(); }",
      ),
      source("src/math.blend", "module Math; export function f(): void {}"),
    ]);

    const result = analyzeProject(project);

    expect(result.kind).toBe("error");
    expect(result).not.toHaveProperty("program");
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["E10242"]);
  });

  it("should retain an explicit source qualifier on a resolved qualified callee", () => {
    const result = analyzeProject(
      snapshot([
        source("src/game.blend", "module Game; function main(): void { Math.f(); }"),
        source("src/math.blend", "module Math; export function f(): void {}"),
      ]),
    );

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error(`Expected complete, got ${result.kind}`);
    const mainBinding = result.program.bindings.find(
      ({ qualifiedName }) => qualifiedName === "Game.main",
    );
    const main = result.program.declarations.find(
      ({ binding }) =>
        mainBinding !== undefined &&
        binding.sourceId === mainBinding.id.sourceId &&
        binding.span.start === mainBinding.id.span.start,
    );
    const statement = main?.body?.statements[0];
    const callee = statement?.kind === "expression-statement" ? statement.expression.callee : null;
    expect(callee).toMatchObject({
      kind: "member",
      member: "f",
      qualifiedModule: { name: "Math" },
      binding: expect.any(Object),
    });
    expect(callee).not.toHaveProperty("object");
    expect(callee).not.toHaveProperty("name");
  });

  it("should stop a deeply nested expression with an explicit analysis-limit obligation", () => {
    const nested = Array.from({ length: 5_000 }, () => "1").join("+");
    const project = snapshot([
      source(
        "src/game.blend",
        `module Game; function main(): void { let value: word = ${nested}; }`,
      ),
    ]);

    const result = analyzeProject(project);

    expect(result.kind).toBe("incomplete");
    expect(result).not.toHaveProperty("program");
    if (result.kind !== "incomplete") throw new Error(`Expected incomplete, got ${result.kind}`);
    expect(result.obligations.map(({ kind }) => kind)).toContain("analysis-limit");
  });

  it("should cap errors without counting or dropping warnings", () => {
    const warnings = Array.from({ length: 21 }, (_, index) => `let a${index}: byte[1];`).join(" ");
    const warningResult = analyzeProject(
      snapshot([source("src/game.blend", `module Game; function main(): void { ${warnings} }`)]),
    );
    expect(warningResult.kind).toBe("complete");
    expect(warningResult.diagnostics.filter(({ code }) => code === "W10141")).toHaveLength(21);

    const errors = Array.from({ length: 21 }, (_, index) => `missing${index};`).join(" ");
    const mixed = analyzeProject(
      snapshot([
        source("src/game.blend", `module Game; function main(): void { ${warnings} ${errors} }`),
      ]),
    );
    expect(mixed.kind).toBe("incomplete");
    expect(mixed.diagnostics.filter(({ severity }) => severity === "error")).toHaveLength(20);
    expect(mixed.diagnostics.filter(({ code }) => code === "W10141")).toHaveLength(21);
  });

  it("should sort located diagnostics before reports without a source span", () => {
    const result = analyzeProject(
      snapshot([source("src/game.blend", "module Game; function helper(): void { missing; }")]),
    );

    expect(result.kind).toBe("error");
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["E10239", "E10020"]);
    expect(result.diagnostics[0]?.primarySpan).not.toBeNull();
    expect(result.diagnostics[1]?.primarySpan).toBeNull();
  });

  it("should widen a callee-indexed aggregate effect to the caller aggregate", () => {
    const result = analyzeProject(
      snapshot([
        source(
          "src/game.blend",
          [
            "module Game;",
            "let items: byte[2] = [0, 0];",
            "function mutate(values: byte[2], i: byte): void { values[i] = 1; }",
            "function caller(j: byte): void { mutate(items, j); }",
            "function main(): void {}",
          ].join("\n"),
        ),
      ]),
    );

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error(`Expected complete, got ${result.kind}`);
    const items = result.program.bindings.find(
      ({ qualifiedName }) => qualifiedName === "Game.items",
    );
    const caller = result.program.bindings.find(
      ({ qualifiedName }) => qualifiedName === "Game.caller",
    );
    const summary = result.program.effects.find(
      ({ function: id }) =>
        caller !== undefined &&
        id.sourceId === caller.id.sourceId &&
        id.span.start === caller.id.span.start,
    );
    expect(summary?.writes).toContainEqual({ binding: items?.id, path: [], readonly: false });
  });

  it("should retain transitive call and read locations for an initializer cycle", () => {
    const text = [
      "module Game;",
      "let a: word = f();",
      "let b: word = a;",
      "function f(): word { return b; }",
      "function main(): void {}",
    ].join("\n");
    const result = analyzeProject(snapshot([source("src/game.blend", text)]));

    expect(result.kind).toBe("error");
    const cycle = result.diagnostics.find(({ code }) => code === "E10194");
    const fragments = cycle?.related.map(({ span }) =>
      Buffer.from(text, "utf8").subarray(span.start, span.end).toString("utf8"),
    );
    expect(fragments).toContain("f()");
    expect(fragments).toContain("b");
  });

  it("should preserve frozen input and return the same deeply frozen result twice", () => {
    const project = snapshot([
      source(
        "src/game.blend",
        "module Game; let value: word = 1; function read(): word { return value; } function main(): void {}",
      ),
    ]);
    const before = JSON.stringify(project);

    const first = analyzeProject(project);
    const second = analyzeProject(project);

    expect(first).toEqual(second);
    expect(first.kind).toBe("complete");
    expect(JSON.stringify(project)).toBe(before);
    expectArraysFrozen(first);
  });
});
