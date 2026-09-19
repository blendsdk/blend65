import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SourceRecord } from "../project/types.js";
import { parseSource, readModuleHeader } from "./parser.js";

/** Build an exact in-memory source record for parser implementation checks. */
function source(text: string): SourceRecord {
  return {
    sourceId: "implementation.blend",
    text,
    sha256: createHash("sha256").update(text, "utf8").digest("hex"),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/unused/implementation.blend",
  };
}

/** Return the body statements of the fixture's only ordinary function. */
function functionStatements(text: string) {
  const result = parseSource(source(text));
  const declaration = result.unit?.declarations[0];
  if (declaration?.kind !== "function") {
    throw new Error("Expected the fixture to contain one ordinary function");
  }
  return { result, statements: declaration.body.statements };
}

describe("parser implementation recovery", () => {
  it("should preserve a safe sibling after a malformed nested call", () => {
    const { result, statements } = functionStatements(
      "module Game; function main(): void { call((1 + )); let kept: byte = 2; }",
    );

    expect(result.complete).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
    expect(statements).toMatchObject([
      { kind: "poison" },
      { kind: "variable", name: "kept", initializer: { kind: "number", value: 2n } },
    ]);
  });

  it("should make progress through repeated malformed expressions", () => {
    const malformed = Array.from({ length: 30 }, () => "let value: byte = ;").join(" ");
    const result = parseSource(source(`module Game; function main(): void { ${malformed} }`));

    expect(result.complete).toBe(false);
    expect(result.diagnostics).toHaveLength(20);
    expect(result.diagnostics.every(({ code }) => code === "PARSE_SYNTAX_ERROR")).toBe(true);
  });

  it("should stop deep expression recursion without throwing or inventing a diagnostic", () => {
    const nesting = "(".repeat(2_000) + "1" + ")".repeat(2_000);
    const text = `module Game; function main(): void { ${nesting}; let kept: byte = 1; }`;

    expect(() => parseSource(source(text))).not.toThrow();
    const result = parseSource(source(text));
    expect(result.complete).toBe(false);
    expect(result.diagnostics.length).toBeLessThanOrEqual(20);
  });

  it("should stop deeply nested blocks without exhausting the host stack", () => {
    const nesting = "{".repeat(5_000) + "}".repeat(5_000);
    const text = `module Game; function main(): void { ${nesting} }`;

    expect(() => parseSource(source(text))).not.toThrow();
    const result = parseSource(source(text));
    expect(result.complete).toBe(false);
    expect(result.diagnostics).toEqual([]);
    expect(result.unchecked).toHaveLength(1);
  });

  it("should stop a long unary prefix chain without exhausting the host stack", () => {
    const text = `module Game; function main(): void { ${"!".repeat(20_000)}true; }`;

    expect(() => parseSource(source(text))).not.toThrow();
    const result = parseSource(source(text));
    expect(result.complete).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("should retain an unfinished unsupported declaration as unchecked", () => {
    const result = parseSource(source("module Game; enum E { A"));

    expect(result.complete).toBe(false);
    expect(result.diagnostics).toEqual([]);
    expect(result.unchecked).toHaveLength(1);
    expect(result.unit?.declarations).toMatchObject([{ kind: "unchecked" }]);
  });

  it("should keep lexical poison separate from parser syntax", () => {
    const result = parseSource(source("module Game; function main(): void { let x: byte = 0x; }"));

    expect(result.complete).toBe(false);
    expect(result.diagnostics.map(({ code }) => code)).toContain("E10214");
    expect(result.unit?.declarations).toMatchObject([
      { kind: "function", body: { statements: [{ kind: "poison" }] } },
    ]);
  });

  it("should use the normative missing-type diagnostic for parameters and fields", () => {
    const result = parseSource(
      source("module Game; function run(value): void {} struct Pair { left; right: byte; }"),
    );

    expect(result.diagnostics.map(({ code, message }) => ({ code, message }))).toEqual([
      {
        code: "E10150",
        message: "Type annotation required for parameter 'value' — add ': <type>'",
      },
      {
        code: "E10150",
        message: "Type annotation required for field 'left' — add ': <type>'",
      },
    ]);
    expect(result.unit?.declarations).toMatchObject([
      { kind: "function", name: "run", parameters: [{ name: "value", type: null }] },
      {
        kind: "struct",
        name: "Pair",
        fields: [
          { name: "left", type: null },
          { name: "right", type: { kind: "named-type", name: "byte" } },
        ],
      },
    ]);
  });

  it("should stop an invalid module statement before the next declaration", () => {
    const result = parseSource(
      source("module Game; if (true) {} function kept(): void { return; }"),
    );

    expect(result.diagnostics.map(({ code }) => code)).toEqual(["E10010"]);
    expect(result.unit?.declarations).toMatchObject([{ kind: "function", name: "kept" }]);
  });

  it("should retain unsupported statement forms as exact unchecked regions", () => {
    const text =
      "module Game; function main(): void { do { work(); } while (ready); loadable const data: byte[1] = [1]; for (loadable const item: byte[1] = [1]; ready; tick()) { work(); } }";
    const { result, statements } = functionStatements(text);

    expect(result.diagnostics).toEqual([]);
    expect(result.complete).toBe(false);
    expect(statements.map(({ kind }) => kind)).toEqual(["unchecked", "unchecked", "unchecked"]);
    expect(result.unchecked.map((span) => text.slice(span.start, span.end))).toEqual([
      "do { work(); } while (ready);",
      "loadable const data: byte[1] = [1];",
      "for (loadable const item: byte[1] = [1]; ready; tick()) { work(); }",
    ]);
  });

  it("should diagnose a late first module without treating it as a duplicate", () => {
    const result = parseSource(source("let before: byte = 1; module Game;"));

    expect(result.diagnostics.map(({ code }) => code)).toEqual(["E10237"]);
    expect(result.unit?.header?.name).toBe("Game");
    expect(result.unit?.declarations).toMatchObject([{ kind: "variable", name: "before" }]);
  });

  it("should not treat a module keyword nested in a function as the file header", () => {
    const result = parseSource(source("function run(): void { module Game; }"));

    expect(result.unit?.header).toBeNull();
    expect(result.diagnostics.map(({ code }) => code)).toContain("E10001");
  });
});

describe("parser implementation shapes", () => {
  it("should preserve distinct query operand forms", () => {
    const { result, statements } = functionStatements(
      "module Game; function main(): void { sizeof(byte[2]); offsetof(Game.Pair, left); length(values); }",
    );

    expect(result.complete).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(statements).toMatchObject([
      {
        kind: "expression-statement",
        expression: {
          kind: "sizeof",
          operand: {
            kind: "array-type",
            element: { kind: "named-type", name: "byte" },
            extent: { kind: "number", value: 2n },
          },
        },
      },
      {
        kind: "expression-statement",
        expression: {
          kind: "offsetof",
          operand: { kind: "named-type", name: "Game.Pair" },
          field: "left",
        },
      },
      {
        kind: "expression-statement",
        expression: { kind: "length", operand: { kind: "name", name: "values" } },
      },
    ]);
  });

  it("should represent a fill-only array without an explicit element", () => {
    const { result, statements } = functionStatements(
      "module Game; function main(): void { let values: byte[3] = [; 7]; }",
    );

    expect(result.complete).toBe(true);
    expect(statements).toMatchObject([
      {
        kind: "variable",
        initializer: {
          kind: "array-literal",
          elements: [],
          fill: { kind: "number", value: 7n },
        },
      },
    ]);
  });

  it("should freeze returned collections and syntax nodes", () => {
    const result = parseSource(source("module Game; function main(): void { return; }"));
    const declaration = result.unit?.declarations[0];

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.diagnostics)).toBe(true);
    expect(Object.isFrozen(result.unchecked)).toBe(true);
    expect(Object.isFrozen(result.unit)).toBe(true);
    expect(Object.isFrozen(result.unit?.declarations)).toBe(true);
    expect(Object.isFrozen(declaration)).toBe(true);
    if (declaration?.kind === "function") {
      expect(Object.isFrozen(declaration.body.statements)).toBe(true);
    }
  });

  it("should sort a missing-root diagnostic before a later declaration error", () => {
    const result = parseSource(source("let value = 1;"));

    expect(result.diagnostics.map(({ code }) => code)).toEqual(["E10001", "E10150"]);
  });

  it("should ignore lexical and grammar failures after a discovered header", () => {
    const result = readModuleHeader(source("module Game; function main(): void { 0x"));

    expect(result.complete).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.header?.name).toBe("Game");
  });

  it("should retain lexical poison before a valid header", () => {
    const result = readModuleHeader(source("@module Game; function main(): void {}"));

    expect(result.header?.name).toBe("Game");
    expect(result.complete).toBe(false);
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["E10210"]);
  });

  it("should retain lexical evidence when no module token follows it", () => {
    const result = readModuleHeader(source("@"));

    expect(result.header).toBeNull();
    expect(result.complete).toBe(false);
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["E10210", "E10001"]);
  });

  it("should exclude body lexical failures after a malformed header boundary", () => {
    const result = readModuleHeader(source("module Game function main(): void { 0x }"));

    expect(result.header).toBeNull();
    expect(result.complete).toBe(false);
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["PARSE_SYNTAX_ERROR"]);
  });
});
