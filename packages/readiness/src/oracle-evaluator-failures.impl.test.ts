import { describe, expect, it } from "vitest";

import { evaluateOracleProgram } from "./oracle-evaluator.js";

const BUDGET = {
  inputNodes: 256n,
  expressionDepth: 64n,
  evaluationSteps: 512n,
  frames: 2n,
  memoryCells: 64n,
  effects: 64n,
  transformedNodes: 64n,
};

const EMPTY_MEMORY = { schemaVersion: 1 as const, cells: [] };

const literal = (type: "boolean" | "byte" | "sbyte" | "word" | "sword", value: bigint) => ({
  kind: "literal" as const,
  type,
  value,
});

const binary = (
  type: "boolean" | "byte" | "sbyte" | "word" | "sword",
  operator: "+" | "-" | "*" | "/" | "%" | "^" | "<<" | ">>" | "<=" | ">=" | "!=",
  left: unknown,
  right: unknown,
) => ({ kind: "binary" as const, type, operator, left, right });

const unary = (
  type: "boolean" | "sbyte" | "sword",
  operator: "!" | "-" | "~",
  operand: unknown,
) => ({ kind: "unary" as const, type, operator, operand });

const memoryRead = (type: "byte" | "word", width: 1 | 2, address: unknown) => ({
  kind: "memory-read" as const,
  type,
  width,
  address,
});

const program = (
  returnType: "boolean" | "byte" | "sbyte" | "word" | "sword" | "void",
  body: readonly unknown[],
  constants: readonly unknown[] = [],
) => ({
  schemaVersion: 1 as const,
  module: {
    kind: "module" as const,
    path: ["impl"],
    constants,
    functions: [
      {
        kind: "function" as const,
        name: "main",
        parameters: [],
        returnType,
        body,
      },
    ],
  },
  entryFunction: "main",
  parameterBindings: [],
  memory: EMPTY_MEMORY,
  budget: BUDGET,
});

const returned = (
  returnType: "boolean" | "byte" | "sbyte" | "word" | "sword",
  value: unknown,
  constants: readonly unknown[] = [],
) =>
  program(
    returnType,
    [
      {
        kind: "return",
        value,
      },
    ],
    constants,
  );

describe("oracle evaluator failure propagation", () => {
  it("should propagate failures transactionally through every evaluator layer", () => {
    const missingByte = memoryRead("byte", 1, literal("word", 0x2000n));
    const missingWord = memoryRead("word", 2, literal("word", 0x2000n));
    const vectors = [
      {
        input: {
          ...returned("sbyte", unary("sbyte", "-", literal("sbyte", 1n))),
          budget: { ...BUDGET, evaluationSteps: 2n },
        },
        outcome: "failure",
      },
      {
        input: {
          ...returned("byte", binary("byte", "+", literal("byte", 1n), literal("byte", 2n))),
          budget: { ...BUDGET, evaluationSteps: 2n },
        },
        outcome: "failure",
      },
      {
        input: returned("byte", binary("byte", "+", missingByte, literal("byte", 1n))),
        outcome: "unmodeled",
      },
      {
        input: {
          ...returned("byte", binary("byte", "+", literal("byte", 1n), literal("byte", 2n))),
          budget: { ...BUDGET, evaluationSteps: 3n },
        },
        outcome: "failure",
      },
      {
        input: returned("byte", binary("byte", "+", literal("byte", 1n), missingByte)),
        outcome: "unmodeled",
      },
      {
        input: {
          ...returned("byte", memoryRead("byte", 1, literal("word", 0n))),
          memory: { schemaVersion: 1, cells: [{ address: 0n, value: 1n }] },
          budget: { ...BUDGET, evaluationSteps: 3n },
        },
        outcome: "failure",
      },
      {
        input: program("void", [
          { kind: "local", name: "value", type: "byte", initializer: missingByte },
        ]),
        outcome: "unmodeled",
      },
      {
        input: program("void", [
          { kind: "local", name: "value", type: "byte", initializer: literal("byte", 0n) },
          { kind: "assign", target: "value", value: missingByte },
        ]),
        outcome: "unmodeled",
      },
      {
        input: program("void", [
          {
            kind: "memory-write",
            width: 1,
            address: missingWord,
            value: literal("byte", 1n),
          },
        ]),
        outcome: "unmodeled",
      },
      {
        input: program("void", [
          {
            kind: "memory-write",
            width: 1,
            address: literal("word", 0x2000n),
            value: missingByte,
          },
        ]),
        outcome: "unmodeled",
      },
      {
        input: {
          ...program("void", [
            {
              kind: "memory-write",
              width: 2,
              address: literal("word", 0n),
              value: literal("word", 1n),
            },
          ]),
          memory: {
            schemaVersion: 1,
            cells: [
              { address: 0n, value: 0n },
              { address: 1n, value: 0n },
            ],
          },
          budget: { ...BUDGET, evaluationSteps: 3n },
        },
        outcome: "failure",
      },
      {
        input: program("void", [
          {
            kind: "memory-write",
            width: 2,
            address: literal("word", 65_535n),
            value: literal("word", 1n),
          },
        ]),
        outcome: "unmodeled",
      },
      {
        input: returned("byte", binary("byte", "/", literal("byte", 1n), literal("byte", 0n))),
        outcome: "unmodeled",
      },
      {
        input: returned("word", {
          kind: "unary",
          type: "word",
          operator: "~",
          operand: missingWord,
        }),
        outcome: "unmodeled",
      },
      {
        input: {
          ...returned("byte", memoryRead("byte", 1, literal("word", 0n))),
          budget: { ...BUDGET, evaluationSteps: 2n },
        },
        outcome: "failure",
      },
      {
        input: {
          ...program("void", [
            { kind: "local", name: "value", type: "byte", initializer: literal("byte", 0n) },
          ]),
          budget: { ...BUDGET, evaluationSteps: 1n },
        },
        outcome: "failure",
      },
      {
        input: {
          ...program("void", [
            { kind: "local", name: "value", type: "byte", initializer: literal("byte", 0n) },
            { kind: "assign", target: "value", value: literal("byte", 1n) },
          ]),
          budget: { ...BUDGET, evaluationSteps: 3n },
        },
        outcome: "failure",
      },
      {
        input: {
          ...program("void", [
            {
              kind: "memory-write",
              width: 1,
              address: literal("word", 0n),
              value: literal("byte", 1n),
            },
          ]),
          budget: { ...BUDGET, evaluationSteps: 1n },
        },
        outcome: "failure",
      },
      {
        input: {
          ...program("void", [
            {
              kind: "memory-write",
              width: 1,
              address: literal("word", 0n),
              value: literal("byte", 1n),
            },
          ]),
          budget: { ...BUDGET, evaluationSteps: 2n },
        },
        outcome: "failure",
      },
    ] as const;

    for (const vector of vectors) {
      const result = evaluateOracleProgram(vector.input);
      expect(result).toMatchObject(
        vector.outcome === "failure"
          ? { ok: false, diagnostics: [{ code: "oracle.budget" }] }
          : { ok: true, outcome: "oracle-unmodeled" },
      );
    }

    const constants = [
      {
        kind: "const",
        name: "zero",
        type: "byte",
        value: literal("byte", 0n),
      },
      {
        kind: "const",
        name: "failed",
        type: "byte",
        value: binary("byte", "/", literal("byte", 1n), literal("byte", 0n)),
      },
    ];
    expect(
      evaluateOracleProgram(
        returned("byte", { kind: "name", type: "byte", name: "failed" }, constants),
      ),
    ).toMatchObject({ ok: true, outcome: "oracle-unmodeled" });
    expect(
      evaluateOracleProgram({
        ...returned("byte", { kind: "name", type: "byte", name: "zero" }, constants.slice(0, 1)),
        budget: { ...BUDGET, evaluationSteps: 1n },
      }),
    ).toMatchObject({ ok: false, diagnostics: [{ code: "oracle.budget" }] });
    expect(
      evaluateOracleProgram({
        ...returned("byte", { kind: "name", type: "byte", name: "second" }, [
          {
            kind: "const",
            name: "first",
            type: "byte",
            value: literal("byte", 1n),
          },
          {
            kind: "const",
            name: "second",
            type: "byte",
            value: literal("byte", 2n),
          },
        ]),
        budget: { ...BUDGET, evaluationSteps: 2n },
      }),
    ).toMatchObject({ ok: false, diagnostics: [{ code: "oracle.budget" }] });
    expect(evaluateOracleProgram(program("void", [{ kind: "return" }]))).toMatchObject({
      ok: true,
      outcome: "modeled",
      observation: { returnValue: null },
    });
    expect(
      evaluateOracleProgram({
        ...program(
          "void",
          [{ kind: "return" }],
          [
            {
              kind: "const",
              name: "before",
              type: "byte",
              value: literal("byte", 1n),
            },
          ],
        ),
        budget: { ...BUDGET, evaluationSteps: 2n },
      }),
    ).toMatchObject({ ok: false, diagnostics: [{ code: "oracle.budget" }] });

    const parameterProgram = program("void", []);
    const parameterInput = {
      ...parameterProgram,
      module: {
        ...parameterProgram.module,
        functions: [
          {
            ...parameterProgram.module.functions[0],
            parameters: [{ name: "value", type: "byte" }],
          },
        ],
      },
      parameterBindings: [
        {
          kind: "parameter-value",
          parameterPath: "/functions/0/parameters/1",
          value: 1n,
        },
      ],
    };
    expect(evaluateOracleProgram(parameterInput)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid" }],
    });
  });

  it("should return unsupported for invalid semantic closure variants", () => {
    const duplicateConstants = [
      { kind: "const", name: "same", type: "byte", value: literal("byte", 1n) },
      { kind: "const", name: "same", type: "byte", value: literal("byte", 2n) },
    ];
    const constantNameCollision = [
      { kind: "const", name: "main", type: "byte", value: literal("byte", 1n) },
    ];
    const duplicateParameters = program("void", []);
    const variants = [
      returned("byte", { kind: "name", type: "byte", name: "missing" }),
      returned("sbyte", {
        kind: "unary",
        type: "sbyte",
        operator: "-",
        operand: { kind: "name", type: "sbyte", name: "missing" },
      }),
      returned("byte", {
        kind: "unary",
        type: "byte",
        operator: "!",
        operand: literal("byte", 1n),
      }),
      returned("word", {
        kind: "unary",
        type: "word",
        operator: "-",
        operand: literal("word", 1n),
      }),
      returned(
        "byte",
        binary("byte", "+", literal("byte", 1n), { kind: "name", type: "byte", name: "missing" }),
      ),
      program("byte", []),
      program("byte", [{ kind: "return" }]),
      program("void", [{ kind: "return", value: literal("byte", 1n) }]),
      program("void", [
        { kind: "return" },
        { kind: "local", name: "late", type: "byte", initializer: literal("byte", 1n) },
      ]),
      program("void", [
        { kind: "local", name: "value", type: "word", initializer: literal("byte", 1n) },
      ]),
      program("void", [{ kind: "assign", target: "missing", value: literal("byte", 1n) }]),
      program("void", [
        {
          kind: "memory-write",
          width: 1,
          address: literal("byte", 1n),
          value: literal("byte", 1n),
        },
      ]),
      returned("byte", { kind: "name", type: "byte", name: "same" }, duplicateConstants),
      program("void", [], constantNameCollision),
      {
        ...duplicateParameters,
        module: {
          ...duplicateParameters.module,
          functions: [
            {
              ...duplicateParameters.module.functions[0],
              parameters: [
                { name: "same", type: "byte" },
                { name: "same", type: "byte" },
              ],
            },
          ],
        },
      },
      returned("byte", { kind: "name", type: "byte", name: "impure" }, [
        {
          kind: "const",
          name: "impure",
          type: "byte",
          value: memoryRead("byte", 1, literal("word", 0n)),
        },
      ]),
      returned("byte", { kind: "name", type: "byte", name: "derived" }, [
        {
          kind: "const",
          name: "derived",
          type: "byte",
          value: {
            kind: "unary",
            type: "byte",
            operator: "~",
            operand: { kind: "name", type: "byte", name: "missing" },
          },
        },
      ]),
    ];
    for (const variant of variants) {
      expect(evaluateOracleProgram(variant)).toMatchObject({
        ok: true,
        outcome: "oracle-unmodeled",
        reason: "unsupported-semantics",
      });
    }
  });
});
