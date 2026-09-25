import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord, SourceSpan } from "../project/types.js";
import { analyzeProject } from "./service.js";
import { parseSource } from "./parser.js";

/** Construct exact decoded input without loading or changing any host file. */
function source(text: string): SourceRecord {
  return {
    sourceId: "game.blend",
    text,
    sha256: createHash("sha256").update(text, "utf8").digest("hex"),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/unused/game.blend",
  };
}

/** Build the smallest immutable project used by semantic expression checks. */
function project(text: string): ProjectSnapshot {
  const manifestText = "{}";
  return {
    manifest: {
      schemaVersion: 1,
      name: "expression-spec",
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck: true,
      divisionZeroCheck: true,
    },
    manifestSource: {
      sourceId: "blend65.json",
      text: manifestText,
      sha256: createHash("sha256").update(manifestText, "utf8").digest("hex"),
      byteLength: Buffer.byteLength(manifestText, "utf8"),
      resolvedPath: "/checkout/blend65.json",
    },
    sources: [source(text)],
    inputSha256: createHash("sha256").update(text, "utf8").digest("hex"),
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: "c64-pal-prg-kernal-6581",
    effectiveEntry: "Game",
  };
}

function span(start: number, end: number): SourceSpan {
  return { sourceId: "game.blend", start, end };
}

function acceptedUnit(text: string) {
  const result = parseSource(source(text));
  expect(result.diagnostics).toEqual([]);
  expect(result.unit).not.toBeNull();
  if (result.unit === null) {
    throw new Error("Expected the parser to produce a syntax unit");
  }
  return result.unit;
}

function mainStatements(text: string) {
  const unit = acceptedUnit(text);
  expect(unit.declarations).toHaveLength(1);
  const declaration = unit.declarations[0];
  expect(declaration).toMatchObject({ kind: "function", name: "main" });
  if (declaration?.kind !== "function") {
    throw new Error("Expected the only declaration to be function main");
  }
  return declaration.body.statements;
}

function expressionStatement(text: string, index: number) {
  const statement = mainStatements(text)[index];
  expect(statement).toMatchObject({ kind: "expression-statement" });
  if (statement?.kind !== "expression-statement") {
    throw new Error(`Expected statement ${index} to be an expression statement`);
  }
  return statement.expression;
}

function containsNodeKind(value: unknown, kind: string): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if ("kind" in value && value.kind === kind) {
    return true;
  }
  return Object.values(value).some((child) => containsNodeKind(child, kind));
}

const precedenceSource = `module Game;
function main(): void {
  a = b = 1 + 2 * 3;
  true ? a : false ? b : c;
  a + b << 1;
  a & b ^ c | d && e || f;
}`;

describe("parser expressions", () => {
  // Multiplication binds before addition, and chained assignment groups from the right.
  it("should preserve arithmetic precedence inside right-associated assignments", () => {
    expect(expressionStatement(precedenceSource, 0)).toMatchObject({
      kind: "assignment",
      operator: "=",
      target: { kind: "name", name: "a" },
      value: {
        kind: "assignment",
        operator: "=",
        target: { kind: "name", name: "b" },
        value: {
          kind: "binary",
          operator: "+",
          left: { kind: "number", value: 1n },
          right: {
            kind: "binary",
            operator: "*",
            left: { kind: "number", value: 2n },
            right: { kind: "number", value: 3n },
          },
        },
      },
    });
  });

  // A conditional expression groups its false arm as another conditional expression.
  it("should associate nested conditional expressions to the right", () => {
    expect(expressionStatement(precedenceSource, 1)).toMatchObject({
      kind: "conditional",
      condition: { kind: "boolean", value: true },
      whenTrue: { kind: "name", name: "a" },
      whenFalse: {
        kind: "conditional",
        condition: { kind: "boolean", value: false },
        whenTrue: { kind: "name", name: "b" },
        whenFalse: { kind: "name", name: "c" },
      },
    });
  });

  // Addition binds before shifting, and each bitwise level binds before the logical levels.
  it("should nest shift bitwise and logical operators by precedence", () => {
    expect(expressionStatement(precedenceSource, 2)).toMatchObject({
      kind: "binary",
      operator: "<<",
      left: {
        kind: "binary",
        operator: "+",
        left: { kind: "name", name: "a" },
        right: { kind: "name", name: "b" },
      },
      right: { kind: "number", value: 1n },
    });

    expect(expressionStatement(precedenceSource, 3)).toMatchObject({
      kind: "binary",
      operator: "||",
      left: {
        kind: "binary",
        operator: "&&",
        left: {
          kind: "binary",
          operator: "|",
          left: {
            kind: "binary",
            operator: "^",
            left: {
              kind: "binary",
              operator: "&",
              left: { kind: "name", name: "a" },
              right: { kind: "name", name: "b" },
            },
            right: { kind: "name", name: "c" },
          },
          right: { kind: "name", name: "d" },
        },
        right: { kind: "name", name: "e" },
      },
      right: { kind: "name", name: "f" },
    });
  });

  // Import aliasing is contextual; the same words remain legal local names.
  it("should keep import aliases separate from ordinary as and until names", () => {
    const text = `module Game;
import { f as g } from Math;
function main(): void {
  let as: byte = 1;
  let until: byte = byte(2);
  f(1);
}`;
    const unit = acceptedUnit(text);
    const importNameStart = text.indexOf("f as g");
    const aliasStart = importNameStart + "f as ".length;
    const moduleStart = text.indexOf("Math");

    expect(unit.imports).toHaveLength(1);
    expect(unit.imports[0]).toMatchObject({
      kind: "import",
      module: "Math",
      moduleSpan: span(moduleStart, moduleStart + "Math".length),
      items: [
        {
          name: "f",
          nameSpan: span(importNameStart, importNameStart + 1),
          alias: "g",
          aliasSpan: span(aliasStart, aliasStart + 1),
        },
      ],
    });

    const statements = mainStatements(text);
    expect(statements[0]).toMatchObject({
      kind: "variable",
      name: "as",
      declarationKind: "let",
      type: { kind: "named-type", name: "byte" },
      initializer: { kind: "number", value: 1n },
    });
    expect(statements[1]).toMatchObject({
      kind: "variable",
      name: "until",
      declarationKind: "let",
      type: { kind: "named-type", name: "byte" },
    });
  });

  // Primitive integer call syntax is a cast, while an identifier call remains a call.
  it("should distinguish a primitive cast from a named call", () => {
    const text = `module Game;
function main(): void {
  let as: byte = 1;
  let until: byte = byte(2);
  f(1);
}`;
    const statements = mainStatements(text);

    expect(statements[1]).toMatchObject({
      kind: "variable",
      initializer: {
        kind: "cast",
        type: { kind: "named-type", name: "byte" },
        operand: { kind: "number", value: 2n },
      },
    });
    expect(statements[2]).toMatchObject({
      kind: "expression-statement",
      expression: {
        kind: "call",
        callee: { kind: "name", name: "f" },
        arguments: [{ kind: "number", value: 1n }],
      },
    });
  });

  // Infix as is not cast syntax and reports only the unexpected token category.
  it("should reject an infix as expression without fabricating a cast", () => {
    const text = "module Game; function main(): void { x as byte; }";
    const result = parseSource(source(text));
    const unexpectedStart = text.indexOf(" as ") + 1;
    const syntaxErrors = result.diagnostics.filter(
      (diagnostic) => diagnostic.code === "PARSE_SYNTAX_ERROR",
    );

    expect(syntaxErrors.length).toBeGreaterThan(0);
    expect(syntaxErrors[0]).toMatchObject({
      code: "PARSE_SYNTAX_ERROR",
      severity: "error",
      primarySpan: span(unexpectedStart, unexpectedStart + "as".length),
    });
    expect(syntaxErrors[0]?.message).toBe("Expected ';', found 'identifier'");
    expect(syntaxErrors[0]?.message).not.toContain("as");
    expect(containsNodeKind(result.unit, "cast")).toBe(false);
  });

  // Calls collect arguments in source order before later member and index postfixes.
  it("should build chained call member and index postfixes from left to right", () => {
    const text = `module Game;
function main(): void {
  f(1, g(2, 3)).x[4];
}`;

    expect(expressionStatement(text, 0)).toMatchObject({
      kind: "index",
      object: {
        kind: "member",
        member: "x",
        object: {
          kind: "call",
          callee: { kind: "name", name: "f" },
          arguments: [
            { kind: "number", value: 1n },
            {
              kind: "call",
              callee: { kind: "name", name: "g" },
              arguments: [
                { kind: "number", value: 2n },
                { kind: "number", value: 3n },
              ],
            },
          ],
        },
      },
      index: { kind: "number", value: 4n },
    });
  });

  // An array fill remains separate from the explicit elements that precede it.
  it("should preserve explicit array elements separately from the fill", () => {
    const text = `module Game;
function main(): void {
  let a: byte[3] = [1; 0];
}`;
    const statements = mainStatements(text);

    expect(statements[0]).toMatchObject({
      kind: "variable",
      name: "a",
      type: {
        kind: "array-type",
        element: { kind: "named-type", name: "byte" },
        extent: { kind: "number", value: 3n },
      },
      initializer: {
        kind: "array-literal",
        elements: [{ kind: "number", value: 1n }],
        fill: { kind: "number", value: 0n },
      },
    });
  });

  // A contextual struct literal preserves each named field and its value in source order.
  it("should preserve contextual struct literal fields in source order", () => {
    const text = `module Game;
function main(): void {
  let s: S = { x: 1 };
}`;
    const statements = mainStatements(text);

    expect(statements[0]).toMatchObject({
      kind: "variable",
      name: "s",
      type: { kind: "named-type", name: "S" },
      initializer: {
        kind: "struct-literal",
        fields: [
          {
            name: "x",
            value: { kind: "number", value: 1n },
          },
        ],
      },
    });
  });
});

describe("function value expressions", () => {
  // Function parameters, aggregate qualifiers and extents, and result types are invariant as one signature.
  it("should accept an exact function signature and reject every incompatible signature boundary", () => {
    const accepted = analyzeProject(
      project(
        [
          "module Game;",
          "function inspect(values: const byte[2]): word { return word(values[0]); }",
          "let callback: fn(const byte[2]): word = &inspect;",
          "function main(): void {",
          "  let values: byte[2] = [1, 2];",
          "  callback(values);",
          "}",
        ].join("\n"),
      ),
    );
    expect(accepted.kind).toBe("complete");
    expect(accepted.diagnostics).toEqual([]);

    const mismatches = [
      [
        "module Game; function actual(value: byte): byte { return value; } let callback: fn(word): byte = &actual; function main(): void {}",
      ],
      [
        "module Game; function actual(values: const byte[2]): byte { return values[0]; } let callback: fn(byte[2]): byte = &actual; function main(): void {}",
      ],
      [
        "module Game; function actual(values: byte[2]): byte { return values[0]; } let callback: fn(byte[3]): byte = &actual; function main(): void {}",
      ],
      [
        "module Game; function actual(value: byte): byte { return value; } let callback: fn(byte): word = &actual; function main(): void {}",
      ],
    ] as const;

    for (const [text] of mismatches) {
      const result = analyzeProject(project(text));
      expect(result.kind).toBe("error");
      expect(result.diagnostics.map(({ code }) => code)).toEqual(["E10080"]);
    }
  });

  // Converting a function value to word permanently removes its callable type and target proof.
  it("should reject a call through an address whose function proof was erased", () => {
    const result = analyzeProject(
      project(
        [
          "module Game;",
          "function increment(value: byte): byte { return value + 1; }",
          "function main(): void {",
          "  let raw: word = word(&increment);",
          "  raw(1);",
          "}",
        ].join("\n"),
      ),
    );

    expect(result.kind).toBe("error");
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["E10175"]);
  });
});
