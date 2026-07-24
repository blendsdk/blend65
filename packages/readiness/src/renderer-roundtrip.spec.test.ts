import { describe, expect, it } from "vitest";

import {
  createSourceRendererForTest,
  validateRoundTripModuleGraph,
} from "./roundtrip-conformance-v1.js";
import { isGenIdentifier } from "./generator-ir.js";
import type { GenExpression, GenIdentifier, GenModule } from "./generator-ir.js";
import { parseRenderedSource } from "./roundtrip-parser.js";
import { projectForRoundTrip, validateRoundTrip } from "./roundtrip-validator.js";
import { renderSourceModule } from "./source-renderer.js";

const ONE_MIB = 1_048_576;
const DEFAULT_OPTIONS = {
  maxSourceBytes: ONE_MIB,
  literalSpellings: [],
} as const;

type UnaryOperator = Extract<GenExpression, { readonly kind: "unary" }>["operator"];
type BinaryOperator = Extract<GenExpression, { readonly kind: "binary" }>["operator"];

function identifier(value: string): GenIdentifier {
  if (!isGenIdentifier(value)) {
    throw new Error(`invalid test identifier: ${value}`);
  }
  return value;
}

const literal = (value: bigint): GenExpression => ({ kind: "literal", type: "word", value });
const name = (value: string): GenExpression => ({
  kind: "name",
  type: "word",
  name: identifier(value),
});
const unary = (operator: UnaryOperator, operand: GenExpression): GenExpression => ({
  kind: "unary",
  type: operator === "!" ? "boolean" : operand.type,
  operator,
  operand,
});
const binary = (
  operator: BinaryOperator,
  left: GenExpression,
  right: GenExpression,
): GenExpression => ({
  kind: "binary",
  type: ["<", "<=", ">", ">=", "==", "!="].includes(operator) ? "boolean" : "word",
  operator,
  left,
  right,
});

function moduleWithExpression(
  expression: GenExpression,
  path: readonly string[] = ["roundtrip", "vectors"],
): GenModule {
  return {
    kind: "module",
    path: path.map(identifier),
    constants: [
      {
        kind: "const",
        name: identifier("result"),
        type: "word",
        value: expression,
      },
    ],
    functions: [],
  };
}

function requireSuccess<T extends { readonly ok: boolean }>(
  result: T,
): asserts result is Extract<T, { readonly ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected a closed success result");
  }
}

function expectBoundedDiagnostic(diagnostic: {
  readonly path: string;
  readonly message: string;
}): void {
  expect(new TextEncoder().encode(diagnostic.path).byteLength).toBeLessThanOrEqual(256);
  expect(new TextEncoder().encode(diagnostic.message).byteLength).toBeLessThanOrEqual(512);
}

const SPELLING_VECTORS = [
  { spelling: "decimal", expected: "26" },
  { spelling: "hex-dollar", expected: "$1A" },
  { spelling: "hex-prefix", expected: "0x1A" },
  { spelling: "binary-prefix", expected: "0b11010" },
] as const;

const PRECEDENCE_VECTORS = [
  {
    row: "primary",
    expression: {
      kind: "memory-read",
      type: "byte",
      width: 1,
      address: literal(2n),
    } satisfies GenExpression,
  },
  {
    row: "unary",
    expression: unary("!", unary("!", name("flag"))),
  },
  {
    row: "multiplicative",
    expression: binary("*", name("a"), binary("+", name("b"), name("c"))),
  },
  {
    row: "additive",
    expression: binary("+", name("a"), binary("<<", name("b"), name("c"))),
  },
  {
    row: "shift",
    expression: binary("<<", name("a"), binary("<", name("b"), name("c"))),
  },
  {
    row: "relational",
    expression: binary("<", name("a"), binary("==", name("b"), name("c"))),
  },
  {
    row: "equality",
    expression: binary("==", name("a"), binary("&", name("b"), name("c"))),
  },
  {
    row: "bitwise-and",
    expression: binary("&", name("a"), binary("^", name("b"), name("c"))),
  },
  {
    row: "bitwise-xor",
    expression: binary("^", name("a"), binary("|", name("b"), name("c"))),
  },
  {
    row: "bitwise-or",
    expression: binary("+", name("a"), binary("|", name("b"), name("c"))),
  },
] as const;

const MUTATION_VECTORS = [
  {
    name: "multiplicative precedence",
    mutation: { kind: "precedence", operator: "*", bindingPower: 2 },
    expression: PRECEDENCE_VECTORS[2].expression,
  },
  {
    name: "additive precedence",
    mutation: { kind: "precedence", operator: "+", bindingPower: 2 },
    expression: PRECEDENCE_VECTORS[3].expression,
  },
  {
    name: "shift precedence",
    mutation: { kind: "precedence", operator: "<<", bindingPower: 2 },
    expression: PRECEDENCE_VECTORS[4].expression,
  },
  {
    name: "relational precedence",
    mutation: { kind: "precedence", operator: "<", bindingPower: 2 },
    expression: PRECEDENCE_VECTORS[5].expression,
  },
  {
    name: "equality precedence",
    mutation: { kind: "precedence", operator: "==", bindingPower: 2 },
    expression: PRECEDENCE_VECTORS[6].expression,
  },
  {
    name: "bitwise-and precedence",
    mutation: { kind: "precedence", operator: "&", bindingPower: 2 },
    expression: PRECEDENCE_VECTORS[7].expression,
  },
  {
    name: "bitwise-xor precedence",
    mutation: { kind: "precedence", operator: "^", bindingPower: 2 },
    expression: PRECEDENCE_VECTORS[8].expression,
  },
  {
    name: "bitwise-or precedence",
    mutation: { kind: "precedence", operator: "|", bindingPower: 12 },
    expression: PRECEDENCE_VECTORS[9].expression,
  },
  {
    name: "left associativity",
    mutation: { kind: "associativity", operator: "+", associativity: "right" },
    expression: binary("+", name("a"), binary("+", name("b"), name("c"))),
  },
  {
    name: "required parentheses",
    mutation: {
      kind: "omit-required-parentheses",
      expressionPath: "/constants/0/value/right",
    },
    expression: PRECEDENCE_VECTORS[2].expression,
  },
] as const;

const EMITTED_TOKEN_SOURCES = [
  "module token.path;\n",
  "module token.const;\nconst value: word = 1;\n",
  [
    "module token.function;",
    "function run(input: word, other: word): word {",
    "  let local: word = peek(input);",
    "  local = peekw(local);",
    "  poke(53280, local);",
    "  pokew(2, local);",
    "  return other;",
    "}",
    "",
  ].join("\n"),
  "module token.unary;\nconst value: word = !~-1;\n",
  "module token.mul;\nconst value: word = 12 * 3 / 2 % 5;\n",
  "module token.add;\nconst value: word = 1 + 2 - 3;\n",
  "module token.shift;\nconst value: word = 1 << 2 >> 1;\n",
  "module token.compare;\nconst value: boolean = 1 < 2 == 2 <= 3 != 4 > 3;\n",
  "module token.comparege;\nconst value: boolean = 4 >= 3;\n",
  "module token.bits;\nconst value: word = 1 & 2 ^ 3 | 4;\n",
] as const;

describe("deterministic source rendering", () => {
  it("renders repeated input as byte-identical LF UTF-8 in authored declaration order", () => {
    const module: GenModule = {
      kind: "module",
      path: [identifier("game"), identifier("main")],
      constants: [
        {
          kind: "const",
          name: identifier("zeta"),
          type: "word",
          value: literal(26n),
        },
        {
          kind: "const",
          name: identifier("alpha"),
          type: "word",
          value: literal(1n),
        },
      ],
      functions: [],
    };

    const first = renderSourceModule(module, DEFAULT_OPTIONS);
    const second = renderSourceModule(module, DEFAULT_OPTIONS);
    requireSuccess(first);
    requireSuccess(second);

    expect(first.sourceBytes).toEqual(second.sourceBytes);
    expect(first.source).toBe(second.source);
    expect(first.source).not.toContain("\r");
    expect(new TextDecoder("utf-8", { fatal: true }).decode(first.sourceBytes)).toBe(first.source);
    expect(first.source.indexOf("const zeta")).toBeLessThan(first.source.indexOf("const alpha"));
    expect(first.source).not.toMatch(/\/\/|\/\*|[A-Z]:\\|file:\/\//u);

    const isolated = first.sourceBytes.slice();
    first.sourceBytes[0] ^= 0xff;
    expect(second.sourceBytes).toEqual(isolated);
  });

  it.each(SPELLING_VECTORS)(
    "renders and preserves the $spelling literal spelling class",
    ({ spelling, expected }) => {
      const module = moduleWithExpression(literal(26n));
      const options = {
        ...DEFAULT_OPTIONS,
        literalSpellings: [{ expressionPath: "/constants/0/value", spelling }],
      } as const;
      const rendered = renderSourceModule(module, options);
      const projected = projectForRoundTrip(module, options);
      requireSuccess(rendered);
      requireSuccess(projected);

      expect(rendered.source).toContain(`= ${expected};`);
      const parsed = parseRenderedSource(rendered.sourceBytes, DEFAULT_OPTIONS.maxSourceBytes);
      requireSuccess(parsed);
      expect(parsed.projection).toEqual(projected.projection);
    },
  );
});

describe("independent precedence and grouping", () => {
  it.each(PRECEDENCE_VECTORS)(
    "round trips the $row precedence discriminator without structural change",
    ({ expression }) => {
      const module = moduleWithExpression(expression);
      const expected = projectForRoundTrip(module, DEFAULT_OPTIONS);
      const result = validateRoundTrip(module, DEFAULT_OPTIONS);
      requireSuccess(expected);
      requireSuccess(result);
      expect(result.projection).toEqual(expected.projection);
    },
  );

  it.each([
    {
      associativity: "left",
      expression: binary("+", binary("+", name("a"), name("b")), name("c")),
    },
    {
      associativity: "right",
      expression: unary("-", unary("-", name("a"))),
    },
  ])("preserves $associativity-associative grouping", ({ expression }) => {
    const module = moduleWithExpression(expression);
    const expected = projectForRoundTrip(module, DEFAULT_OPTIONS);
    const result = validateRoundTrip(module, DEFAULT_OPTIONS);
    requireSuccess(expected);
    requireSuccess(result);
    expect(result.projection).toEqual(expected.projection);
  });

  it.each(MUTATION_VECTORS)(
    "detects the $name renderer policy mutation independently",
    ({ mutation, expression }) => {
      const module = moduleWithExpression(expression);
      const renderer = createSourceRendererForTest(mutation);
      const rendered = renderer.renderSourceModule(module, DEFAULT_OPTIONS);
      const expected = projectForRoundTrip(module, DEFAULT_OPTIONS);
      requireSuccess(rendered);
      requireSuccess(expected);

      const parsed = parseRenderedSource(rendered.sourceBytes, DEFAULT_OPTIONS.maxSourceBytes);
      requireSuccess(parsed);
      expect(parsed.projection).not.toEqual(expected.projection);
    },
  );
});

describe("closed round-trip failures", () => {
  it("rejects an unsupported construct with one bounded diagnostic and no partial projection", () => {
    const source = new TextEncoder().encode("module invalid;\nconst value: word = @;\n");
    const result = parseRenderedSource(source, ONE_MIB);

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: "roundtrip-unsupported" }],
    });
    expect(result).not.toHaveProperty("projection");
    if (!result.ok) {
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.path).toMatch(/^\/source\/[0-9]+$/u);
      expectBoundedDiagnostic(result.diagnostics[0]!);
    }
  });

  it("rejects invalid UTF-8 with a stable bounded diagnostic and no partial projection", () => {
    const result = parseRenderedSource(Uint8Array.of(0xc3, 0x28), ONE_MIB);

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: "roundtrip.input.invalid-utf8" }],
    });
    expect(result).not.toHaveProperty("projection");
    if (!result.ok) {
      expectBoundedDiagnostic(result.diagnostics[0]!);
    }
  });

  it("checks the UTF-8 byte budget before returning source or source bytes", () => {
    const module = moduleWithExpression(literal(1n), ["budget"]);
    const rendered = renderSourceModule(module, DEFAULT_OPTIONS);
    requireSuccess(rendered);

    const result = renderSourceModule(module, {
      maxSourceBytes: rendered.sourceBytes.byteLength - 1,
      literalSpellings: [],
    });

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: "render.budget.source-bytes" }],
    });
    expect(result).not.toHaveProperty("source");
    expect(result).not.toHaveProperty("sourceBytes");
    if (!result.ok) {
      expectBoundedDiagnostic(result.diagnostics[0]!);
    }
  });
});

describe("frozen inverse conformance vectors", () => {
  it("accepts every emitted structural and operator token vector", () => {
    expect(EMITTED_TOKEN_SOURCES).toHaveLength(10);
    for (const source of EMITTED_TOKEN_SOURCES) {
      const result = parseRenderedSource(new TextEncoder().encode(source), ONE_MIB);
      requireSuccess(result);
    }
  });

  it("keeps the four spelling classes and both normalization permissions discriminating", () => {
    expect(SPELLING_VECTORS.map(({ spelling }) => spelling)).toEqual([
      "decimal",
      "hex-dollar",
      "hex-prefix",
      "binary-prefix",
    ]);

    const compact = parseRenderedSource(
      new TextEncoder().encode("module normalize;\nconst value: word = 26;\n"),
      ONE_MIB,
    );
    const spaced = parseRenderedSource(
      new TextEncoder().encode("module normalize ;\n\nconst value : word = 26 ;\n"),
      ONE_MIB,
    );
    requireSuccess(compact);
    requireSuccess(spaced);
    expect(spaced.projection).toEqual(compact.projection);

    for (const { spelling } of SPELLING_VECTORS) {
      const result = validateRoundTrip(moduleWithExpression(literal(26n)), {
        ...DEFAULT_OPTIONS,
        literalSpellings:
          spelling === "decimal" ? [] : [{ expressionPath: "/constants/0/value", spelling }],
      });
      requireSuccess(result);
    }
  });

  it("keeps all ten precedence rows and both associativity classes frozen", () => {
    expect(PRECEDENCE_VECTORS.map(({ row }) => row)).toEqual([
      "primary",
      "unary",
      "multiplicative",
      "additive",
      "shift",
      "relational",
      "equality",
      "bitwise-and",
      "bitwise-xor",
      "bitwise-or",
    ]);
    expect(["left", "right"]).toEqual(["left", "right"]);
    for (const { expression } of PRECEDENCE_VECTORS) {
      requireSuccess(validateRoundTrip(moduleWithExpression(expression), DEFAULT_OPTIONS));
    }
  });
});

describe("inverse module boundary", () => {
  it("allows neutral inverse peers and rejects renderer behavior imports", () => {
    const allowed = validateRoundTripModuleGraph([
      {
        path: "roundtrip-tokenizer.ts",
        imports: ["node:util", "./roundtrip-model.js"],
      },
      {
        path: "roundtrip-parser.ts",
        imports: ["./generator-ir.js", "./roundtrip-tokenizer.js"],
      },
      {
        path: "roundtrip-normalizer.ts",
        imports: ["./roundtrip-model.js", "./roundtrip-parser.js"],
      },
    ]);
    expect(allowed).toMatchObject({ ok: true, diagnostics: [] });

    const forbidden = validateRoundTripModuleGraph([
      {
        path: "roundtrip-parser.ts",
        imports: ["./source-renderer.js"],
      },
    ]);
    expect(forbidden).toMatchObject({
      ok: false,
      diagnostics: [{ code: "roundtrip.boundary" }],
    });
    if (!forbidden.ok) {
      expectBoundedDiagnostic(forbidden.diagnostics[0]!);
    }
  });

  it("rejects an unclassified new inverse file", () => {
    const result = validateRoundTripModuleGraph([
      {
        path: "roundtrip-parser-experimental.ts",
        imports: [],
        classification: "unclassified",
      },
    ]);
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: "roundtrip.boundary" }],
    });
  });
});
