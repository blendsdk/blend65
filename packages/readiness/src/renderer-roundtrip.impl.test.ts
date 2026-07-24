import { describe, expect, it } from "vitest";

import {
  createSourceRendererForTest,
  validateRoundTripModuleGraph,
} from "./roundtrip-conformance-v1.js";
import { isGenIdentifier } from "./generator-ir.js";
import type { GenIdentifier, GenModule } from "./generator-ir.js";
import { parseRenderedSource } from "./roundtrip-parser.js";
import { tokenizeRoundTripSource } from "./roundtrip-tokenizer.js";
import { projectForRoundTrip, validateRoundTrip } from "./roundtrip-validator.js";
import { renderSourceModule } from "./source-renderer.js";

const OPTIONS = { maxSourceBytes: 1_048_576, literalSpellings: [] } as const;

function identifier(value: string): GenIdentifier {
  if (!isGenIdentifier(value)) throw new Error("invalid fixture identifier");
  return value;
}

function moduleFixture(): GenModule {
  return {
    kind: "module",
    path: [identifier("roundtrip"), identifier("implementation")],
    constants: [],
    functions: [
      {
        kind: "function",
        name: identifier("run"),
        parameters: [
          { name: identifier("address"), type: "word" },
          { name: identifier("value"), type: "byte" },
        ],
        returnType: "word",
        body: [
          {
            kind: "local",
            name: identifier("current"),
            type: "byte",
            initializer: {
              kind: "memory-read",
              type: "byte",
              width: 1,
              address: { kind: "name", type: "word", name: identifier("address") },
            },
          },
          {
            kind: "assign",
            target: identifier("current"),
            value: { kind: "name", type: "byte", name: identifier("value") },
          },
          {
            kind: "memory-write",
            width: 1,
            address: { kind: "name", type: "word", name: identifier("address") },
            value: { kind: "name", type: "byte", name: identifier("current") },
          },
          {
            kind: "memory-write",
            width: 2,
            address: { kind: "name", type: "word", name: identifier("address") },
            value: { kind: "literal", type: "word", value: 2n },
          },
          {
            kind: "return",
            value: {
              kind: "memory-read",
              type: "word",
              width: 2,
              address: { kind: "name", type: "word", name: identifier("address") },
            },
          },
        ],
      },
    ],
  };
}

describe("renderer hostile inputs", () => {
  it("rejects malformed options and spelling selections without partial output", () => {
    const module = moduleFixture();
    const invalidOptions = [
      null,
      {},
      { maxSourceBytes: 0, literalSpellings: [] },
      { maxSourceBytes: 1_048_577, literalSpellings: [] },
      { maxSourceBytes: 10, literalSpellings: "decimal" },
      {
        maxSourceBytes: 10,
        literalSpellings: [{ expressionPath: "/missing", spelling: "decimal" }],
      },
      { maxSourceBytes: 10, literalSpellings: [null] },
      { maxSourceBytes: 10, literalSpellings: [[]] },
      { maxSourceBytes: 10, literalSpellings: [{ expressionPath: 1, spelling: "decimal" }] },
      {
        maxSourceBytes: 10,
        literalSpellings: [{ expressionPath: "/constants/0/value", spelling: "octal" }],
      },
    ];

    for (const options of invalidOptions) {
      const result: unknown = Reflect.apply(renderSourceModule, undefined, [module, options]);
      expect(result).toMatchObject({ ok: false });
      expect(result).not.toHaveProperty("source");
    }
  });

  it("rejects structurally invalid modules before reading rendering options", () => {
    const result: unknown = Reflect.apply(renderSourceModule, undefined, [
      { kind: "module", path: [], constants: [], functions: [] },
      OPTIONS,
    ]);
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: "render.input.invalid" }],
    });
  });

  it("round trips every statement form and preserves isolated bytes", () => {
    const result = validateRoundTrip(moduleFixture(), OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const original = result.sourceBytes.slice();
      result.sourceBytes[0] ^= 0xff;
      expect(parseRenderedSource(original, original.byteLength).ok).toBe(true);
    }
  });

  it("renders negative magnitudes in every supported spelling and a void return", () => {
    const negative: GenModule = {
      kind: "module",
      path: [identifier("negative")],
      constants: [
        {
          kind: "const",
          name: identifier("value"),
          type: "sword",
          value: { kind: "literal", type: "sword", value: -26n },
        },
      ],
      functions: [
        {
          kind: "function",
          name: identifier("stop"),
          parameters: [],
          returnType: "void",
          body: [{ kind: "return" }],
        },
      ],
    };
    for (const spelling of ["decimal", "hex-dollar", "hex-prefix", "binary-prefix"] as const) {
      const result = renderSourceModule(negative, {
        ...OPTIONS,
        literalSpellings: [{ expressionPath: "/constants/0/value", spelling }],
      });
      expect(result.ok).toBe(true);
    }
  });

  it("round trips source-observable comparison, boolean, and unary-minus structure", () => {
    const cases: GenModule[] = [
      {
        kind: "module",
        path: [identifier("comparison")],
        constants: [
          {
            kind: "const",
            name: identifier("value"),
            type: "boolean",
            value: {
              kind: "binary",
              type: "boolean",
              operator: "<",
              left: { kind: "literal", type: "byte", value: 1n },
              right: { kind: "literal", type: "byte", value: 2n },
            },
          },
        ],
        functions: [],
      },
      {
        kind: "module",
        path: [identifier("booleanLiteral")],
        constants: [
          {
            kind: "const",
            name: identifier("value"),
            type: "boolean",
            value: { kind: "literal", type: "boolean", value: 1n },
          },
        ],
        functions: [],
      },
      {
        kind: "module",
        path: [identifier("unaryLiteral")],
        constants: [
          {
            kind: "const",
            name: identifier("value"),
            type: "sword",
            value: {
              kind: "unary",
              type: "sword",
              operator: "-",
              operand: { kind: "literal", type: "sword", value: 1n },
            },
          },
        ],
        functions: [],
      },
    ];

    for (const module of cases) expect(validateRoundTrip(module, OPTIONS).ok).toBe(true);
    const booleanRendered = renderSourceModule(cases[1]!, OPTIONS);
    expect(booleanRendered).toMatchObject({ ok: true, source: expect.stringContaining("true") });
  });

  it("returns diagnostics for throwing option proxies, keywords, and boolean spellings", () => {
    const hostile = new Proxy(
      { maxSourceBytes: 10, literalSpellings: [] },
      {
        ownKeys() {
          throw new Error("hostile");
        },
      },
    );
    expect(renderSourceModule(moduleFixture(), hostile)).toMatchObject({ ok: false });

    const keywordModule: GenModule = {
      kind: "module",
      path: [identifier("module")],
      constants: [],
      functions: [],
    };
    expect(renderSourceModule(keywordModule, OPTIONS)).toMatchObject({ ok: false });

    const booleanModule: GenModule = {
      kind: "module",
      path: [identifier("booleans")],
      constants: [
        {
          kind: "const",
          name: identifier("flag"),
          type: "boolean",
          value: { kind: "literal", type: "boolean", value: 1n },
        },
      ],
      functions: [],
    };
    expect(
      renderSourceModule(booleanModule, {
        ...OPTIONS,
        literalSpellings: [{ expressionPath: "/constants/0/value", spelling: "hex-prefix" }],
      }),
    ).toMatchObject({ ok: false });
  });

  it("shares one caller-independent snapshot across projection and validation", () => {
    const options = new Proxy(
      { maxSourceBytes: 1_048_576, literalSpellings: [] },
      {
        get() {
          throw new Error("caller object was read after snapshotting");
        },
      },
    );
    expect(projectForRoundTrip(moduleFixture(), options).ok).toBe(true);
    expect(validateRoundTrip(moduleFixture(), options).ok).toBe(true);
  });

  it("keeps boolean and integer literal projections discriminating", () => {
    const booleanModule: GenModule = {
      kind: "module",
      path: [identifier("booleanProjection")],
      constants: [
        {
          kind: "const",
          name: identifier("value"),
          type: "boolean",
          value: { kind: "literal", type: "boolean", value: 1n },
        },
      ],
      functions: [],
    };
    const integerModule: GenModule = {
      kind: "module",
      path: [identifier("integerProjection")],
      constants: [
        {
          kind: "const",
          name: identifier("value"),
          type: "word",
          value: { kind: "literal", type: "word", value: 1n },
        },
      ],
      functions: [],
    };
    const booleanProjection = projectForRoundTrip(booleanModule, OPTIONS);
    const integerProjection = projectForRoundTrip(integerModule, OPTIONS);
    expect(booleanProjection).toMatchObject({
      ok: true,
      projection: { constants: [{ value: { kind: "boolean-literal", value: true } }] },
    });
    expect(integerProjection).toMatchObject({
      ok: true,
      projection: { constants: [{ value: { kind: "integer-literal", value: 1n } }] },
    });
  });
});

describe("independent parser hostile inputs", () => {
  it("rejects invalid byte containers, limits, budgets, tokens, and syntax", () => {
    const bytes = new TextEncoder().encode("module valid;\n");
    const cases = [
      () => parseRenderedSource(bytes, 0),
      () => parseRenderedSource(bytes, 1_048_577),
      () => parseRenderedSource(new Uint8Array(bytes.byteLength + 1), bytes.byteLength),
      () => parseRenderedSource(Uint8Array.of(0xff), 1),
      () => parseRenderedSource(new TextEncoder().encode("module x; @"), 20),
      () => parseRenderedSource(new TextEncoder().encode("module ;"), 20),
    ];
    for (const run of cases) expect(run().ok).toBe(false);

    for (const [input, limit] of [
      [null, 1],
      ["bytes", 1],
      [bytes, 1.5],
      [{ byteLength: bytes.byteLength }, bytes.byteLength],
    ]) {
      const result: unknown = Reflect.apply(parseRenderedSource, undefined, [input, limit]);
      expect(result).toMatchObject({ ok: false });
    }
  });

  it("rejects incomplete and malformed literals at tokenization", () => {
    for (const source of ["$", "0x", "0b", "_name"]) {
      expect(tokenizeRoundTripSource(source).ok).toBe(false);
    }
    for (const expression of ["0b2", "/* comment */"]) {
      const source = new TextEncoder().encode(
        `module malformed;\nconst x: word = ${expression};\n`,
      );
      expect(parseRenderedSource(source, source.byteLength).ok).toBe(false);
    }
  });

  it("parses syntax without resolving return or assignment semantics", () => {
    const validVoid = new TextEncoder().encode(
      "module statements;\nfunction stop(): void {\n  return;\n}\n",
    );
    expect(parseRenderedSource(validVoid, validVoid.byteLength).ok).toBe(true);

    for (const sourceText of [
      "module x;\nfunction bad(): void {\n  return 1;\n}\n",
      "module x;\nfunction bad(): word {\n  missing = 1;\n}\n",
      "module x;\nfunction bad(poke: word): void {\n  poke = 1;\n  return;\n}\n",
    ]) {
      const source = new TextEncoder().encode(sourceText);
      expect(parseRenderedSource(source, source.byteLength).ok).toBe(true);
    }

    for (const sourceText of [
      "module x;\nfunction bad(a: word,): word {\n  return a;\n}\n",
      "module x;\nconst bad: word = 1 ! 2;\n",
    ]) {
      const source = new TextEncoder().encode(sourceText);
      expect(parseRenderedSource(source, source.byteLength).ok).toBe(false);
    }
  });
});

describe("conformance seam validation", () => {
  it("rejects invalid mutations and malformed module graphs", () => {
    for (const mutation of [
      { kind: "precedence", operator: "+", bindingPower: 0 },
      { kind: "precedence", operator: "+", bindingPower: 15 },
      { kind: "precedence", operator: "+", bindingPower: 1.5 },
      { kind: "precedence", operator: "?", bindingPower: 2 },
      { kind: "associativity", operator: "+", associativity: "middle" },
      { kind: "associativity", operator: "?", associativity: "left" },
    ]) {
      expect(() => Reflect.apply(createSourceRendererForTest, undefined, [mutation])).toThrow(
        TypeError,
      );
    }
    expect(() =>
      createSourceRendererForTest({
        kind: "omit-required-parentheses",
        expressionPath: "not-a-pointer",
      }),
    ).toThrow(TypeError);

    const oversized = Array.from({ length: 129 }, (_, index) => ({
      path: `roundtrip-parser-${index}.ts`,
      imports: [],
    }));
    expect(validateRoundTripModuleGraph(oversized).ok).toBe(false);
    expect(
      validateRoundTripModuleGraph([
        { path: "roundtrip-parser.ts", imports: [], classification: "unclassified" },
      ]).ok,
    ).toBe(false);
    expect(
      validateRoundTripModuleGraph([
        { path: "roundtrip-parser.ts", imports: [] },
        { path: "roundtrip-parser.ts", imports: [] },
      ]).ok,
    ).toBe(false);
    for (const graph of [
      [{ path: "other.ts", imports: [] }],
      [{ path: "roundtrip-parser.ts", imports: ["./expression-renderer.js"] }],
      [{ path: "roundtrip-parser.ts", imports: [1] }],
    ]) {
      const result: unknown = Reflect.apply(validateRoundTripModuleGraph, undefined, [graph]);
      expect(result).toMatchObject({ ok: false });
    }
  });
});
