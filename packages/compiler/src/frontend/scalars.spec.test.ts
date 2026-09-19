import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot, SourceRecord, SourceSpan } from "../project/types.js";
import { analyzeModules } from "./analyzer.js";
import { indexModules, resolveModules } from "./modules.js";

function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function source(text: string): SourceRecord {
  return {
    sourceId: "game.blend",
    text,
    sha256: hash(text),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: "/checkout/game.blend",
  };
}

function snapshot(text: string): ProjectSnapshot {
  const manifestText = "{}";
  return {
    manifest: {
      schemaVersion: 1,
      name: "scalar-spec",
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
    sources: [source(text)],
    inputSha256: hash(text),
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: "test.target",
    effectiveEntry: "Game",
  };
}

function analyze(text: string): ReturnType<typeof analyzeModules> {
  const project = snapshot(text);
  const indexed = indexModules(project);
  const resolved = resolveModules(project, indexed.index);
  expect(indexed.diagnostics).toEqual([]);
  expect(resolved.graph).not.toBeNull();
  if (resolved.graph === null) throw new Error("Expected a resolved Game module");
  return analyzeModules(project, resolved.graph);
}

function spanOf(text: string, fragment: string, occurrence = 0): SourceSpan {
  let characterStart = -1;
  let searchFrom = 0;
  for (let index = 0; index <= occurrence; index += 1) {
    characterStart = text.indexOf(fragment, searchFrom);
    if (characterStart < 0) throw new Error(`Missing fixture fragment ${JSON.stringify(fragment)}`);
    searchFrom = characterStart + fragment.length;
  }
  const start = Buffer.byteLength(text.slice(0, characterStart), "utf8");
  return { sourceId: "game.blend", start, end: start + Buffer.byteLength(fragment, "utf8") };
}

function spanWithin(text: string, region: string, fragment: string): SourceSpan {
  const regionStart = text.indexOf(region);
  const relativeStart = region.indexOf(fragment);
  if (regionStart < 0 || relativeStart < 0) throw new Error("Missing fixture declaration fragment");
  const characterStart = regionStart + relativeStart;
  const start = Buffer.byteLength(text.slice(0, characterStart), "utf8");
  return { sourceId: "game.blend", start, end: start + Buffer.byteLength(fragment, "utf8") };
}

type AnalysisResult = ReturnType<typeof analyzeModules>;

function binding(result: AnalysisResult, name: string, storage?: string) {
  const found = result.bindings.find(
    (candidate) =>
      candidate.name === name && (storage === undefined || candidate.storage === storage),
  );
  expect(found).toBeDefined();
  if (found === undefined) throw new Error(`Missing binding ${name}`);
  return found;
}

function typedDeclaration(result: AnalysisResult, qualifiedName: string) {
  const foundBinding = result.bindings.find(
    (candidate) => candidate.qualifiedName === qualifiedName,
  );
  expect(foundBinding).toBeDefined();
  if (foundBinding === undefined) throw new Error(`Missing binding ${qualifiedName}`);
  const declaration = result.declarations.find(
    (candidate) =>
      candidate.binding.sourceId === foundBinding.id.sourceId &&
      candidate.binding.span.start === foundBinding.id.span.start &&
      candidate.binding.span.end === foundBinding.id.span.end,
  );
  expect(declaration?.kind).toBe("typed");
  if (declaration?.kind !== "typed") throw new Error(`Expected typed declaration ${qualifiedName}`);
  return declaration;
}

describe("scalar semantics", () => {
  // Reserved built-in names cannot be reused by an ordinary declaration.
  it("should reject a declaration named peek", () => {
    const text = "module Game; function main(): void { let peek: byte = 1; }";
    const result = analyze(text);
    expect(result.diagnostics).toMatchObject([
      {
        code: "E10212",
        severity: "error",
        message: "Cannot redeclare reserved built-in 'peek'",
        primarySpan: spanOf(text, "peek"),
      },
    ]);
    expect(result.complete).toBe(false);
  });

  // Parameters and outer-body locals share a scope, while a nested block shadows only after its initializer.
  it("should diagnose same-scope duplicates and preserve nested shadow identities", () => {
    const duplicate =
      "module Game; function f(x: word): void { let x: word = 1; } function main(): void {}";
    const duplicateResult = analyze(duplicate);
    const parameterSpan = spanWithin(duplicate, "function f(x: word)", "x");
    const localSpan = spanWithin(duplicate, "let x: word = 1", "x");
    expect(duplicateResult.diagnostics).toMatchObject([
      {
        code: "E10003",
        severity: "error",
        message: "Duplicate declaration 'x' in the same scope — also declared at game.blend:1:25",
        primarySpan: localSpan,
        related: [{ span: parameterSpan }],
      },
    ]);

    const shadowing = [
      "module Game;",
      "function f(x: word): void {",
      "  { let x: word = x + 1; x = 2; }",
      "  x = 3;",
      "}",
      "function main(): void {}",
    ].join("\n");
    const result = analyze(shadowing);
    expect(result.diagnostics).toEqual([]);
    const parameter = binding(result, "x", "parameter");
    const local = binding(result, "x", "local");
    expect(local.id).not.toEqual(parameter.id);
    expect(typedDeclaration(result, "Game.f").body).toMatchObject({
      statements: [
        {
          kind: "block",
          statements: [
            { kind: "variable", initializer: { kind: "binary", left: { binding: parameter.id } } },
            {
              kind: "expression-statement",
              expression: { kind: "assignment", target: { binding: local.id } },
            },
          ],
        },
        {
          kind: "expression-statement",
          expression: { kind: "assignment", target: { binding: parameter.id } },
        },
      ],
    });
  });

  // A loop local expires after the loop, and unknown values and types identify their exact names.
  it("should distinguish out-of-scope values, unknown types, and undeclared names", () => {
    const text = [
      "module Game;",
      "function main(): void {",
      "  for (let i: byte = 0; i < 1; i += 1) {}",
      "  i;",
      "  let y: Missing;",
      "  x;",
      "}",
    ].join("\n");
    const result = analyze(text);
    expect(result.diagnostics).toMatchObject([
      {
        code: "E10239",
        message: "'i' is not declared in this scope",
        primarySpan: spanOf(text, "i;"),
      },
      { code: "E10241", message: "Unknown type 'Missing'", primarySpan: spanOf(text, "Missing") },
      {
        code: "E10239",
        message: "'x' is not declared in this scope",
        primarySpan: spanOf(text, "x;"),
      },
    ]);
  });

  // Same-sign integer addition keeps operand-driven width and signedness.
  it.each([
    ["byte", "byte", "byte"],
    ["byte", "word", "word"],
    ["sbyte", "sword", "sword"],
  ])("should type %s plus %s as %s", (leftType, rightType, resultType) => {
    const text = `module Game; function f(a: ${leftType}, b: ${rightType}): ${resultType} { return a + b; } function main(): void {}`;
    const result = analyze(text);
    expect(result.diagnostics).toEqual([]);
    expect(typedDeclaration(result, "Game.f").body).toMatchObject({
      statements: [
        {
          kind: "return",
          value: { kind: "binary", operator: "+", type: { kind: "scalar", name: resultType } },
        },
      ],
    });
  });

  // Invalid signedness, Boolean arithmetic, Boolean ordering, and unsigned negation keep distinct diagnostics.
  it.each([
    [
      "a + b",
      "a: byte, b: sbyte",
      "E10081",
      "Cannot mix signed type 'sbyte' with unsigned type 'byte' — cast one operand",
    ],
    [
      "a + b",
      "a: boolean, b: byte",
      "E10151",
      "Cannot use 'boolean' in an arithmetic or bitwise expression",
    ],
    [
      "a < b",
      "a: boolean, b: boolean",
      "E10154",
      "Cannot apply '<' to 'boolean' — ordered comparisons are not valid for boolean operands",
    ],
    [
      "-a",
      "a: byte",
      "E10083",
      "Cannot negate unsigned type 'byte' — use 'sbyte' or 'sword' for signed arithmetic",
    ],
  ])("should reject invalid scalar expression %s", (expression, parameters, code, message) => {
    const result = analyze(
      `module Game; function f(${parameters}): void { ${expression}; } function main(): void {}`,
    );
    expect(result.diagnostics).toMatchObject([{ code, severity: "error", message }]);
  });

  // A negative literal may be represented directly by a signed destination type.
  it("should accept negative forty-two as an sbyte constant", () => {
    const result = analyze("module Game; const answer: sbyte = -42; function main(): void {}");
    expect(result.diagnostics).toEqual([]);
    expect(typedDeclaration(result, "Game.answer").initializer).toMatchObject({
      type: { kind: "scalar", name: "sbyte" },
      constant: -42n,
    });
  });

  // Constant arithmetic is exact before range validation, while independent declarations remain observable.
  it("should reject three hundred as byte and retain it as a word constant", () => {
    const text =
      "module Game; const x: byte = 200 + 100; const y: word = 200 + 100; function main(): void {}";
    const result = analyze(text);
    expect(result.diagnostics).toMatchObject([
      { code: "E10084", message: "Value 300 is out of range for type 'byte' (0–255)" },
    ]);
    expect(typedDeclaration(result, "Game.y").initializer).toMatchObject({
      type: { kind: "scalar", name: "word" },
      constant: 300n,
    });
  });

  // Runtime byte arithmetic wraps at byte width before the written value is widened.
  it("should warn when known runtime byte addition wraps before widening", () => {
    const text =
      "module Game; function f(): void { let a: byte = 200; let b: byte = 100; let r: word = a + b; } function main(): void {}";
    const result = analyze(text);
    expect(result.diagnostics).toMatchObject([
      {
        code: "W10161",
        severity: "warning",
        message:
          "Runtime expression 'a + b' is known to wrap to 44 at 'byte' width before widening to 'word'",
      },
    ]);
    expect(typedDeclaration(result, "Game.f").body).toMatchObject({
      statements: [
        {},
        {},
        {
          kind: "variable",
          initializer: {
            kind: "binary",
            type: { kind: "scalar", name: "word" },
            constant: 44n,
            conversion: "zero-extend",
            integer: { width: 8, signed: false, wrap: true },
          },
        },
      ],
    });
  });

  // Casts, signed shifts, and over-wide shifts preserve exact constants and conversion facts.
  it("should type explicit casts and saturating shifts", () => {
    const text = [
      "module Game;",
      "const cut: byte = byte($1234);",
      "const signed: sbyte = sbyte($80);",
      "const widened: sword = sword(sbyte($80));",
      "const half: sbyte = sbyte($80) >> 1;",
      "const saturated: sbyte = sbyte($80) >> 8;",
      "const zero: byte = byte($80) >> 8;",
      "function main(): void {}",
    ].join("\n");
    const result = analyze(text);
    expect(result.diagnostics).toMatchObject([
      {
        code: "W10101",
        severity: "warning",
        message: "Narrowing cast from 'word' to 'byte' truncates 4660 to 52",
        primarySpan: spanOf(text, "byte($1234)"),
      },
      {
        code: "W10174",
        message:
          "Shift amount 8 is at least the 8-bit width — '<<' yields 0; signed negative '>>' yields -1, otherwise '>>' yields 0",
      },
      {
        code: "W10174",
        message:
          "Shift amount 8 is at least the 8-bit width — '<<' yields 0; signed negative '>>' yields -1, otherwise '>>' yields 0",
      },
    ]);
    expect(typedDeclaration(result, "Game.cut").initializer).toMatchObject({
      constant: 52n,
      conversion: "truncate",
    });
    expect(typedDeclaration(result, "Game.signed").initializer).toMatchObject({ constant: -128n });
    expect(typedDeclaration(result, "Game.widened").initializer).toMatchObject({
      constant: -128n,
      conversion: "sign-extend",
    });
    expect(typedDeclaration(result, "Game.half").initializer).toMatchObject({ constant: -64n });
    expect(typedDeclaration(result, "Game.saturated").initializer).toMatchObject({ constant: -1n });
    expect(typedDeclaration(result, "Game.zero").initializer).toMatchObject({ constant: 0n });
  });

  // Boolean values cannot be converted to integer values.
  it("should reject a Boolean-to-byte cast", () => {
    const result = analyze("module Game; const x: byte = byte(true); function main(): void {}");
    expect(result.diagnostics).toMatchObject([
      {
        code: "E10086",
        message:
          "Cannot cast 'boolean' to 'byte' — boolean is not convertible to or from an integer",
      },
    ]);
  });

  // Signed constant division truncates toward zero and the remainder keeps the dividend sign.
  it.each([
    [-5, 2, -2, -1],
    [5, -2, -2, 1],
    [-5, -2, 2, -1],
    [5, 2, 2, 1],
  ])(
    "should divide %i by %i as quotient %i and remainder %i",
    (left, right, quotient, remainder) => {
      const text = `module Game; const q: sword = sword(${left}) / sword(${right}); const r: sword = sword(${left}) % sword(${right}); function main(): void {}`;
      const result = analyze(text);
      expect(result.diagnostics).toEqual([]);
      expect(typedDeclaration(result, "Game.q").initializer).toMatchObject({
        constant: BigInt(quotient),
      });
      expect(typedDeclaration(result, "Game.r").initializer).toMatchObject({
        constant: BigInt(remainder),
      });
    },
  );

  // Constant division and remainder by zero each report the smallest proving expression.
  it("should diagnose constant division and remainder by zero without fabricating values", () => {
    const text =
      "module Game; const q: byte = 1 / 0; const r: byte = 1 % 0; function main(): void {}";
    const result = analyze(text);
    expect(result.diagnostics).toMatchObject([
      {
        code: "E10160",
        message: "Division by zero in constant expression",
        primarySpan: spanOf(text, "1 / 0"),
      },
      {
        code: "E10160",
        message: "Division by zero in constant expression",
        primarySpan: spanOf(text, "1 % 0"),
      },
    ]);
    expect(result.declarations.filter((declaration) => declaration.kind === "poison")).toHaveLength(
      2,
    );
  });

  // Runtime division and remainder keep ordered byte operations without inventing zero checks or constants.
  it("should retain runtime division and remainder as typed byte operators", () => {
    const text =
      "module Game; function div(n: byte, d: byte): byte { return n / d; } function rem(n: byte, d: byte): byte { return n % d; } function main(): void {}";
    const result = analyze(text);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "E10160")).toBe(false);
    for (const name of ["div", "rem"]) {
      expect(typedDeclaration(result, `Game.${name}`).body).toMatchObject({
        statements: [
          {
            kind: "return",
            value: {
              kind: "binary",
              evaluation: "left-to-right",
              type: { kind: "scalar", name: "byte" },
              constant: null,
              integer: { width: 8, signed: false, wrap: true },
              left: { kind: "name", name: "n" },
              right: { kind: "name", name: "d" },
            },
          },
        ],
      });
    }
  });

  // Assignments, short-circuit logic, conditionals, and calls preserve source evaluation exactly once.
  it("should expose ordered evaluation metadata without duplicating calls", () => {
    const text = [
      "module Game;",
      "function next(): byte { return 1; }",
      "function delta(): byte { return 1; }",
      "function flag(): boolean { return true; }",
      "function left(): byte { return 1; }",
      "function right(): byte { return 2; }",
      "function f(a: byte, b: byte): void {",
      "  a = b = next();",
      "  a += delta();",
      "  false && flag();",
      "  true ? left() : right();",
      "}",
      "function main(): void {}",
    ].join("\n");
    const result = analyze(text);
    expect(result.diagnostics).toEqual([]);
    const body = typedDeclaration(result, "Game.f").body;
    expect(body).toMatchObject({
      statements: [
        {
          expression: {
            kind: "assignment",
            evaluation: ["place", "rhs", "store", "result"],
            value: {
              kind: "assignment",
              evaluation: ["place", "rhs", "store", "result"],
              value: { kind: "call", evaluation: "left-to-right" },
            },
          },
        },
        {
          expression: {
            kind: "assignment",
            evaluation: ["place", "old-read", "rhs", "operation", "store", "result"],
            value: { kind: "call", evaluation: "left-to-right" },
          },
        },
        {
          expression: {
            kind: "binary",
            evaluation: "short-circuit",
            right: { kind: "call", evaluation: "left-to-right" },
          },
        },
        {
          expression: {
            kind: "conditional",
            evaluation: "selected-arm",
            whenTrue: { kind: "call" },
            whenFalse: { kind: "call" },
          },
        },
      ],
    });
    expect(result.calls.map((call) => call.span)).toHaveLength(5);
  });

  // Nested calls are ordinary call edges, and argument errors remain independent of arity errors.
  it("should resolve nested calls without recursion and retain independent argument errors", () => {
    const valid =
      "module Game; function f(a: byte, b: byte): byte { return a + b; } function probe(): byte { return f(1, f(2, 3)); } function main(): void {}";
    const validResult = analyze(valid);
    expect(validResult.diagnostics).toEqual([]);
    expect(validResult.calls).toHaveLength(2);
    expect(typedDeclaration(validResult, "Game.probe").body).toMatchObject({
      statements: [
        {
          value: {
            kind: "call",
            evaluation: "left-to-right",
            signature: {
              parameters: [
                { type: { kind: "scalar", name: "byte" }, readonly: false },
                { type: { kind: "scalar", name: "byte" }, readonly: false },
              ],
              returnType: { kind: "scalar", name: "byte" },
            },
          },
        },
      ],
    });
    expect(
      validResult.diagnostics.some(
        (diagnostic) => diagnostic.code === "E10180" || diagnostic.code === "E10181",
      ),
    ).toBe(false);

    const invalid =
      "module Game; function f(a: byte, b: byte): byte { return a + b; } function probe(): byte { return f(missing); } function main(): void {}";
    const invalidResult = analyze(invalid);
    expect(invalidResult.diagnostics.map(({ code, message }) => ({ code, message }))).toEqual([
      { code: "E10171", message: "Wrong argument count — 'f()' expects 2 parameters, got 1" },
      { code: "E10239", message: "'missing' is not declared in this scope" },
    ]);
  });
});
