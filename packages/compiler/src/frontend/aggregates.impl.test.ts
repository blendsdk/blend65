import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { analyzeModules } from "./analyzer.js";
import { indexModules, resolveModules } from "./modules.js";

/** Hash fixture text exactly as the project loader does. */
function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Build one in-memory source record for a focused semantic test. */
function source(text: string, sourceId = "game.blend"): SourceRecord {
  return {
    sourceId,
    text,
    sha256: hash(text),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: `/checkout/${sourceId}`,
  };
}

/** Analyze a single-module fixture through the real module and semantic frontends. */
function analyze(text: string): ReturnType<typeof analyzeModules> {
  return analyzeSources([source(text)]);
}

/** Analyze a small multi-source fixture through the real project boundaries. */
function analyzeSources(sources: readonly SourceRecord[]): ReturnType<typeof analyzeModules> {
  const manifestText = "{}";
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "aggregate-implementation",
      sourceRoot: "src",
      entry: "Game",
      target: "test.target",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck: true,
      divisionZeroCheck: true,
    },
    manifestSource: {
      sourceId: "blend65.json",
      text: manifestText,
      sha256: hash(manifestText),
      byteLength: Buffer.byteLength(manifestText, "utf8"),
      resolvedPath: "/checkout/blend65.json",
    },
    sources,
    inputSha256: hash(sources.map(({ text }) => text).join("\n")),
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: "test.target",
    effectiveEntry: "Game",
  };
  const indexed = indexModules(snapshot);
  const resolved = resolveModules(snapshot, indexed.index);
  expect(indexed.diagnostics).toEqual([]);
  expect(resolved.graph).not.toBeNull();
  if (resolved.graph === null) throw new Error("Expected a resolved Game module");
  return analyzeModules(snapshot, resolved.graph);
}

/** Return diagnostics in stable emitted order. */
function diagnosticCodes(result: ReturnType<typeof analyzeModules>): string[] {
  return result.diagnostics.map(({ code }) => code);
}

/** Return one accepted module declaration by its qualified binding name. */
function typedDeclaration(result: ReturnType<typeof analyzeModules>, qualifiedName: string) {
  const binding = result.bindings.find((candidate) => candidate.qualifiedName === qualifiedName);
  expect(binding).toBeDefined();
  const declaration = result.declarations.find(
    (candidate) =>
      binding !== undefined &&
      candidate.binding.sourceId === binding.id.sourceId &&
      candidate.binding.span.start === binding.id.span.start &&
      candidate.binding.span.end === binding.id.span.end,
  );
  expect(declaration?.kind).toBe("typed");
  if (declaration?.kind !== "typed") throw new Error(`Missing ${qualifiedName}`);
  return declaration;
}

describe("aggregate implementation edges", () => {
  it("rejects containment cycles that pass through a fixed array", () => {
    const result = analyze(
      "module Game; struct A { children: B[2]; } struct B { parent: A; } function main(): void {}",
    );
    expect(diagnosticCodes(result)).toContain("E10092");
  });

  it("retains exact nested-field element byte ranges for address analysis", () => {
    const result = analyze(
      "module Game; struct Item { bytes: byte[2]; value: byte; } function main(): void { let item: Item = { bytes: [1, 2], value: 3 }; let address: word = &item.bytes[1]; }",
    );
    expect(result.diagnostics).toEqual([]);
    const body = typedDeclaration(result, "Game.main").body;
    const address = body?.statements[1];
    expect(address?.kind).toBe("variable");
    if (address?.kind !== "variable") throw new Error("Missing address variable");
    const addressed = address.initializer?.operand;
    expect(
      addressed !== undefined && "place" in addressed ? addressed.place?.byteRange : null,
    ).toEqual({
      start: 1,
      end: 2,
    });
  });
  it("should reject a fixed-array argument with a different extent", () => {
    const result = analyze(
      [
        "module Game;",
        "function take(values: byte[2]): void {}",
        "function main(): void {",
        "  let values: byte[3] = [1, 2, 3];",
        "  take(values);",
        "}",
      ].join("\n"),
    );

    expect(diagnosticCodes(result)).toEqual(["E10080"]);
    expect(result.calls).toEqual([]);
  });

  it("should keep const protection through an indexed struct field", () => {
    const result = analyze(
      [
        "module Game;",
        "struct Enemy { x: word; }",
        "function inspect(values: const Enemy[2]): void { values[0].x = 1; }",
        "function main(): void {}",
      ].join("\n"),
    );

    expect(diagnosticCodes(result)).toEqual(["E10123"]);
  });

  it("should widen a nested direct ordinal expression without a narrow wrap", () => {
    const result = analyze(
      [
        "module Game;",
        "function f(): byte {",
        "  let values: byte[513] = [0; 0];",
        "  let i: byte = 255;",
        "  return values[(i + 1) * 2];",
        "}",
        "function main(): void {}",
      ].join("\n"),
    );
    const body = typedDeclaration(result, "Game.f").body;

    expect(result.diagnostics).toEqual([]);
    expect(body).toMatchObject({
      statements: [
        {},
        {},
        {
          value: {
            index: {
              kind: "binary",
              type: { kind: "scalar", name: "word" },
              constant: 512n,
            },
          },
        },
      ],
    });
  });

  it("should intersect initialized array ranges across structured branches", () => {
    const result = analyze(
      [
        "module Game;",
        "function f(flag: boolean): void {",
        "  let same: byte[2];",
        "  if (flag) { same[0] = 1; } else { same[0] = 2; }",
        "  same[0];",
        "  let different: byte[2];",
        "  if (flag) { different[0] = 1; } else { different[1] = 2; }",
        "  different[0];",
        "}",
        "function main(): void {}",
      ].join("\n"),
    );
    const codes = diagnosticCodes(result);

    expect(codes.filter((code) => code === "W10141")).toHaveLength(2);
    expect(codes.filter((code) => code === "W10190")).toHaveLength(1);
    expect(codes).toHaveLength(3);
  });

  it("should preserve only initialization facts that hold before a loop can execute", () => {
    const result = analyze(
      [
        "module Game;",
        "function f(flag: boolean): void {",
        "  let fromWhile: byte[1];",
        "  while (flag) { fromWhile[0] = 1; }",
        "  fromWhile[0];",
        "  let fromFor: byte[1];",
        "  for (; flag; ) { fromFor[0] = 1; }",
        "  fromFor[0];",
        "}",
        "function main(): void {}",
      ].join("\n"),
    );

    expect(diagnosticCodes(result).filter((code) => code === "W10190")).toHaveLength(2);
  });

  it("should track struct-field initialization without marking sibling fields initialized", () => {
    const result = analyze(
      [
        "module Game;",
        "struct Pair { x: byte; y: byte; }",
        "function f(): void {",
        "  let direct: Pair; direct.x = 1; direct.x; direct.y;",
        "  let indexed: Pair[1]; indexed[0].x = 1; indexed[0].x; indexed[0].y;",
        "}",
        "function main(): void {}",
      ].join("\n"),
    );

    expect(diagnosticCodes(result).filter((code) => code === "W10190")).toHaveLength(2);
  });

  it("should resolve named constants and fixed queries in array extents", () => {
    const result = analyze(
      [
        "module Game;",
        "const BASE: word = 1 + 2;",
        "let first: byte[BASE] = [0; 0];",
        "let second: byte[length(first) + sizeof(word)] = [0; 0];",
        "function main(): void {}",
      ].join("\n"),
    );

    expect(result.diagnostics).toEqual([]);
    expect(typedDeclaration(result, "Game.first").type).toMatchObject({ length: 3 });
    expect(typedDeclaration(result, "Game.second").type).toMatchObject({ length: 5 });
  });

  it("should resolve imported type aliases without exposing them as values", () => {
    const result = analyzeSources([
      source("module Shapes; export struct Point { x: byte; }", "shapes.blend"),
      source(
        [
          "module Game;",
          "import { Point as P } from Shapes;",
          "let point: P = { x: 1 };",
          "function main(): void { P; }",
        ].join("\n"),
      ),
    ]);

    expect(typedDeclaration(result, "Game.point").type).toMatchObject({ kind: "struct" });
    expect(diagnosticCodes(result)).toEqual(["E10239"]);
  });

  it("should retain deferred aggregate ABI forms as unchecked obligations", () => {
    const result = analyze(
      [
        "module Game;",
        "struct Pair { x: byte; }",
        "function make(): Pair { return { x: 1 }; }",
        "function consume(values: byte[]): void {}",
        "function main(): void {",
        "  let first: Pair = { x: 1 };",
        "  let second: Pair = first;",
        "}",
      ].join("\n"),
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.complete).toBe(false);
    expect(result.obligations).toHaveLength(3);
    expect(result.declarations.filter(({ kind }) => kind === "unchecked")).toHaveLength(3);

    const invalid = analyze(
      "module Game; struct Pair { x: byte; } function main(): void { let value: Pair = missing; }",
    );
    expect(diagnosticCodes(invalid)).toEqual(["E10239"]);
    expect(invalid.obligations).toEqual([]);
  });

  it("should keep assignment and byte-extraction arguments outside ordinal promotion", () => {
    const result = analyze(
      [
        "module Game;",
        "function f(): byte {",
        "  let values: byte[16] = [0; 0];",
        "  let i: byte = 255;",
        "  values[i = i + 1];",
        "  return values[lo(i + 10)];",
        "}",
        "function main(): void {}",
      ].join("\n"),
    );
    const body = typedDeclaration(result, "Game.f").body;

    expect(diagnosticCodes(result)).not.toContain("E10082");
    expect(body).toMatchObject({
      statements: [
        {},
        {},
        { expression: { index: { kind: "assignment", constant: 0n } } },
        { value: { index: { kind: "call", constant: 10n } } },
      ],
    });
  });

  it("should promote unary index operations before evaluating their result", () => {
    const result = analyze(
      "module Game; function f(): void { let values: byte[4] = [0; 0]; let i: byte = 0; values[~i]; } function main(): void {}",
    );

    expect(diagnosticCodes(result)).toContain("E10240");
  });

  it("should preserve ordinal promotion through nested unary expressions", () => {
    const result = analyze(
      "module Game; function f(): byte { let values: byte[65535] = [0; 0]; let i: byte = 255; return values[~(i + 1)]; } function main(): void {}",
    );

    expect(diagnosticCodes(result)).not.toContain("E10240");
    expect(typedDeclaration(result, "Game.f").body).toMatchObject({
      statements: [{}, {}, { value: { index: { kind: "unary", constant: 65279n } } }],
    });
  });

  it("should resolve preceding local constants and retain nested query diagnostics", () => {
    const local = analyze(
      "module Game; function f(): void { const N: word = 4; let values: byte[N] = [0; 0]; } function main(): void {}",
    );
    expect(local.diagnostics).toEqual([]);
    expect(typedDeclaration(local, "Game.f").body).toMatchObject({
      statements: [{}, { type: { kind: "array", length: 4 } }],
    });

    const queries = analyze(
      "module Game; struct Pair { x: byte; } let a: byte[sizeof(byte[])]; let b: byte[offsetof(Pair, missing)]; function main(): void {}",
    );
    expect(diagnosticCodes(queries)).toEqual(["E10266", "E10202"]);
  });

  it("should defer valid aggregate conditionals while retaining invalid assignment errors", () => {
    const pending = analyze(
      [
        "module Game; struct Pair { x: byte; }",
        "function choose(flag: boolean): void {",
        "  let a: Pair = { x: 1 }; let b: Pair = { x: 2 };",
        "  let c: Pair = flag ? a : b;",
        "}",
        "function main(): void {}",
      ].join("\n"),
    );
    expect(pending.diagnostics).toEqual([]);
    expect(pending.obligations).toHaveLength(1);

    const invalid = analyze(
      "module Game; struct Pair { x: byte; } function main(): void { let a: Pair = { x: 1 }; a = missing; }",
    );
    expect(diagnosticCodes(invalid)).toEqual(["E10239"]);
    expect(invalid.obligations).toEqual([]);
  });

  it("should promote complete field coverage to whole-aggregate initialization", () => {
    const result = analyze(
      [
        "module Game; struct Pair { x: byte; y: byte; }",
        "function f(): void {",
        "  let direct: Pair; direct.x = 1; direct.y = 2; direct;",
        "  let indexed: Pair[1]; indexed[0].x = 1; indexed[0].y = 2; indexed[0];",
        "}",
        "function main(): void {}",
      ].join("\n"),
    );

    expect(diagnosticCodes(result)).not.toContain("W10190");
  });

  it("should extract bytes from all integer widths without signed host shifts", () => {
    const result = analyze(
      [
        "module Game;",
        "const a: byte = hi(255);",
        "const b: sbyte = -1;",
        "const c: byte = hi(b);",
        "const d: byte = lo(-2);",
        "function main(): void {}",
      ].join("\n"),
    );

    expect(result.diagnostics).toEqual([]);
    expect(
      ["a", "c", "d"].map((name) => typedDeclaration(result, `Game.${name}`).initializer?.constant),
    ).toEqual([0n, 255n, 254n]);
  });

  it("should use dedicated fixed-query and const-aggregate diagnostics", () => {
    const queries = analyze(
      "module Game; struct Pair { x: byte; } let a: word = sizeof(byte[]); let b: word = offsetof(Pair, y); function main(): void {}",
    );
    expect(diagnosticCodes(queries)).toEqual(["E10266", "E10202"]);

    const permissions = analyze(
      [
        "module Game;",
        "struct Pair { x: byte; }",
        "function mutate(value: Pair): void {}",
        "function inspect(value: const Pair): void { value = { x: 1 }; }",
        "function main(): void { const value: Pair = { x: 1 }; mutate(value); }",
      ].join("\n"),
    );
    expect(diagnosticCodes(permissions)).toEqual(["E10123", "E10094"]);
  });

  it("should reject void storage and accept nested struct fields", () => {
    const invalid = analyze(
      "module Game; struct Bad { value: void; } let values: void[1]; function bad(values: void[]): void {} function main(): void {}",
    );
    expect(diagnosticCodes(invalid)).toEqual([
      "SEMANTIC_ERROR",
      "SEMANTIC_ERROR",
      "SEMANTIC_ERROR",
    ]);
    expect(invalid.complete).toBe(false);

    const exactMessages = analyze(
      "module Game; struct Direct { value: void; } struct Nested { values: void[1]; } function bad(value: void, values: void[]): void {} function main(): void {}",
    ).diagnostics.map(({ message }) => message);
    expect(exactMessages).toEqual([
      "Type 'void' cannot be used as a struct field",
      "Type 'void' cannot be used as an array element",
      "Type 'void' cannot be used as a parameter",
    ]);

    const nested = analyze(
      "module Game; struct Inner { x: byte; } struct Outer { inner: Inner; } function main(): void {}",
    );
    expect(nested.diagnostics).toEqual([]);
    expect(nested.obligations).toEqual([]);
    expect(nested.complete).toBe(true);
    expect(
      nested.types.find((type) => type.kind === "struct" && type.fields[0]?.name === "inner"),
    ).toMatchObject({
      size: 1,
      fields: [{ name: "inner", offset: 0 }],
    });
  });
});
