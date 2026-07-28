import { describe, expect, it } from "vitest";

import { evaluateOracleProgram } from "./oracle-evaluator.js";
import { createOracleEvaluatorSpecFixture } from "./test-fixtures/oracle-evaluator-spec-fixture.js";

const {
  binary,
  booleanValue,
  integerValue,
  literal,
  modeledValue,
  name,
  returnProgram,
  unary,
  unsupported,
} = createOracleEvaluatorSpecFixture();

describe("reference evaluator operator specification", () => {
  it("should preserve exact typed scalar values across literal, reference, unary, and binary expressions", () => {
    const literalVectors = [
      ["boolean false", "boolean", 0n, booleanValue(false)],
      ["boolean true", "boolean", 1n, booleanValue(true)],
      ["byte zero", "byte", 0n, integerValue("byte", 0n)],
      ["byte maximum", "byte", 255n, integerValue("byte", 255n)],
      ["sbyte minimum", "sbyte", -128n, integerValue("sbyte", -128n)],
      ["sbyte zero", "sbyte", 0n, integerValue("sbyte", 0n)],
      ["sbyte maximum", "sbyte", 127n, integerValue("sbyte", 127n)],
      ["word zero", "word", 0n, integerValue("word", 0n)],
      ["word maximum", "word", 65_535n, integerValue("word", 65_535n)],
      ["sword minimum", "sword", -32_768n, integerValue("sword", -32_768n)],
      ["sword zero", "sword", 0n, integerValue("sword", 0n)],
      ["sword maximum", "sword", 32_767n, integerValue("sword", 32_767n)],
    ] as const;

    for (const [label, type, value, expected] of literalVectors) {
      expect(evaluateOracleProgram(returnProgram(type, literal(type, value))), label).toEqual(
        modeledValue(expected),
      );
    }

    const expressionVectors = [
      {
        label: "boolean reference",
        type: "boolean" as const,
        expression: name("boolean", "constant"),
        constantType: "boolean" as const,
        constantValue: 1n,
        expected: booleanValue(true),
      },
      {
        label: "byte unary",
        type: "byte" as const,
        expression: unary("byte", "~", literal("byte", 0n)),
        constantType: "byte" as const,
        constantValue: 0n,
        expected: integerValue("byte", 255n),
      },
      {
        label: "sbyte unary",
        type: "sbyte" as const,
        expression: unary("sbyte", "-", literal("sbyte", 1n)),
        constantType: "sbyte" as const,
        constantValue: 0n,
        expected: integerValue("sbyte", -1n),
      },
      {
        label: "word binary",
        type: "word" as const,
        expression: binary("word", "+", literal("word", 65_535n), literal("word", 1n)),
        constantType: "word" as const,
        constantValue: 0n,
        expected: integerValue("word", 0n),
      },
      {
        label: "sword reference",
        type: "sword" as const,
        expression: name("sword", "constant"),
        constantType: "sword" as const,
        constantValue: -32_768n,
        expected: integerValue("sword", -32_768n),
      },
    ];

    for (const vector of expressionVectors) {
      const constants =
        vector.expression.kind === "name"
          ? [
              {
                kind: "const",
                name: "constant",
                type: vector.constantType,
                value: literal(vector.constantType, vector.constantValue),
              },
            ]
          : [];
      expect(
        evaluateOracleProgram(returnProgram(vector.type, vector.expression, { constants })),
        vector.label,
      ).toEqual(modeledValue(vector.expected));
    }
  });

  it("should widen same-signed mixed-width operations in both operand orders and reject narrowing", () => {
    const vectors = [
      [
        "unsigned arithmetic narrow-first",
        binary("word", "+", literal("byte", 255n), literal("word", 1n)),
        integerValue("word", 256n),
      ],
      [
        "unsigned arithmetic wide-first",
        binary("word", "+", literal("word", 1n), literal("byte", 255n)),
        integerValue("word", 256n),
      ],
      [
        "signed arithmetic narrow-first",
        binary("sword", "+", literal("sbyte", -1n), literal("sword", 256n)),
        integerValue("sword", 255n),
      ],
      [
        "signed arithmetic wide-first",
        binary("sword", "+", literal("sword", 256n), literal("sbyte", -1n)),
        integerValue("sword", 255n),
      ],
      [
        "unsigned bitwise narrow-first",
        binary("word", "|", literal("byte", 128n), literal("word", 256n)),
        integerValue("word", 384n),
      ],
      [
        "unsigned bitwise wide-first",
        binary("word", "|", literal("word", 256n), literal("byte", 128n)),
        integerValue("word", 384n),
      ],
      [
        "signed bitwise narrow-first",
        binary("sword", "&", literal("sbyte", -1n), literal("sword", 256n)),
        integerValue("sword", 256n),
      ],
      [
        "signed bitwise wide-first",
        binary("sword", "&", literal("sword", 256n), literal("sbyte", -1n)),
        integerValue("sword", 256n),
      ],
      [
        "unsigned comparison narrow-first",
        binary("boolean", "<", literal("byte", 255n), literal("word", 256n)),
        booleanValue(true),
      ],
      [
        "unsigned comparison wide-first",
        binary("boolean", ">", literal("word", 256n), literal("byte", 255n)),
        booleanValue(true),
      ],
      [
        "signed comparison narrow-first",
        binary("boolean", "<", literal("sbyte", -1n), literal("sword", 0n)),
        booleanValue(true),
      ],
      [
        "signed comparison wide-first",
        binary("boolean", ">", literal("sword", 0n), literal("sbyte", -1n)),
        booleanValue(true),
      ],
    ] as const;

    for (const [label, expression, expected] of vectors) {
      const resultType = expected.kind === "boolean" ? "boolean" : expected.type;
      expect(evaluateOracleProgram(returnProgram(resultType, expression)), label).toEqual(
        modeledValue(expected),
      );
    }

    expect(
      evaluateOracleProgram(
        returnProgram("byte", binary("byte", "+", literal("word", 1n), literal("byte", 1n))),
      ),
    ).toEqual(unsupported);
  });

  it("should apply width-local overflow, signed shifts, and declared signed comparisons", () => {
    const vectors = [
      [
        "byte overflow",
        "byte",
        binary("byte", "+", literal("byte", 255n), literal("byte", 1n)),
        integerValue("byte", 0n),
      ],
      [
        "sbyte overflow",
        "sbyte",
        binary("sbyte", "+", literal("sbyte", 127n), literal("sbyte", 1n)),
        integerValue("sbyte", -128n),
      ],
      [
        "word overflow",
        "word",
        binary("word", "+", literal("word", 65_535n), literal("word", 1n)),
        integerValue("word", 0n),
      ],
      [
        "sword overflow",
        "sword",
        binary("sword", "+", literal("sword", 32_767n), literal("sword", 1n)),
        integerValue("sword", -32_768n),
      ],
      [
        "unsigned right shift",
        "byte",
        binary("byte", ">>", literal("byte", 128n), literal("byte", 1n)),
        integerValue("byte", 64n),
      ],
      [
        "signed right shift",
        "sbyte",
        binary("sbyte", ">>", literal("sbyte", -2n), literal("byte", 1n)),
        integerValue("sbyte", -1n),
      ],
      [
        "wrapping left shift",
        "byte",
        binary("byte", "<<", literal("byte", 128n), literal("byte", 1n)),
        integerValue("byte", 0n),
      ],
      [
        "signed comparison",
        "boolean",
        binary("boolean", "<", literal("sbyte", -1n), literal("sbyte", 1n)),
        booleanValue(true),
      ],
      [
        "unsigned comparison",
        "boolean",
        binary("boolean", ">", literal("byte", 255n), literal("byte", 1n)),
        booleanValue(true),
      ],
    ] as const;

    for (const [label, returnType, expression, expected] of vectors) {
      expect(evaluateOracleProgram(returnProgram(returnType, expression)), label).toEqual(
        modeledValue(expected),
      );
    }
  });

  it.each([
    [
      "unsigned byte exact-width left shift",
      "byte",
      binary("byte", "<<", literal("byte", 255n), literal("byte", 8n)),
    ],
    [
      "unsigned byte exact-width right shift",
      "byte",
      binary("byte", ">>", literal("byte", 255n), literal("byte", 8n)),
    ],
    [
      "signed byte exact-width left shift",
      "sbyte",
      binary("sbyte", "<<", literal("sbyte", -1n), literal("byte", 8n)),
    ],
    [
      "signed negative byte exact-width right shift",
      "sbyte",
      binary("sbyte", ">>", literal("sbyte", -1n), literal("byte", 8n)),
    ],
    [
      "unsigned word exact-width left shift",
      "word",
      binary("word", "<<", literal("word", 65_535n), literal("word", 16n)),
    ],
    [
      "unsigned word exact-width right shift",
      "word",
      binary("word", ">>", literal("word", 65_535n), literal("word", 16n)),
    ],
    [
      "signed word exact-width left shift",
      "sword",
      binary("sword", "<<", literal("sword", -1n), literal("word", 16n)),
    ],
    [
      "signed negative word exact-width right shift",
      "sword",
      binary("sword", ">>", literal("sword", -1n), literal("word", 16n)),
    ],
  ] as const)("should return typed zero for %s", (_label, returnType, expression) => {
    expect(evaluateOracleProgram(returnProgram(returnType, expression))).toEqual(
      modeledValue(integerValue(returnType, 0n)),
    );
  });

  it("should reject a signed shift count", () => {
    expect(
      evaluateOracleProgram(
        returnProgram("sbyte", binary("sbyte", ">>", literal("sbyte", -2n), literal("sbyte", 1n))),
      ),
    ).toEqual(unsupported);
  });
});
