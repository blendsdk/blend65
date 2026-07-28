import { describe, expect, it } from "vitest";

import { probeOracleBudgetCharges } from "./oracle-budget.js";
import { evaluateOracleProgram } from "./oracle-evaluator.js";
import { createOracleEvaluatorSpecFixture } from "./test-fixtures/oracle-evaluator-spec-fixture.js";

const {
  binary,
  blockedDivisionByZero,
  createProgram,
  integerValue,
  literal,
  memoryRead,
  modeledValue,
  name,
  returnProgram,
  unsupported,
} = createOracleEvaluatorSpecFixture();

describe("reference evaluator specification", () => {
  it("should resolve constants before creating the parameter and local frame and execute statements in order", () => {
    const constants = [
      {
        kind: "const",
        name: "base",
        type: "word",
        value: literal("word", 2n),
      },
      {
        kind: "const",
        name: "derived",
        type: "word",
        value: binary("word", "+", name("word", "base"), literal("word", 3n)),
      },
    ];
    const body = [
      {
        kind: "local",
        name: "total",
        type: "word",
        initializer: binary("word", "+", name("word", "derived"), name("word", "input")),
      },
      {
        kind: "assign",
        target: "total",
        value: binary("word", "*", name("word", "total"), literal("word", 2n)),
      },
      {
        kind: "return",
        value: name("word", "total"),
      },
    ];

    expect(
      evaluateOracleProgram(
        createProgram("word", body, {
          constants,
          parameters: [{ name: "input", type: "word" }],
          bindings: [
            {
              kind: "parameter-value",
              parameterPath: "/functions/0/parameters/0",
              value: 4n,
            },
          ],
        }),
      ),
    ).toEqual(modeledValue(integerValue("word", 18n)));
  });

  it("should resolve a pure forward constant reference", () => {
    expect(
      evaluateOracleProgram(
        returnProgram("word", name("word", "derived"), {
          constants: [
            {
              kind: "const",
              name: "derived",
              type: "word",
              value: binary("word", "+", name("word", "base"), literal("word", 3n)),
            },
            {
              kind: "const",
              name: "base",
              type: "word",
              value: literal("word", 2n),
            },
          ],
        }),
      ),
    ).toEqual(modeledValue(integerValue("word", 5n)));
  });

  it("should reject impure constant initializers before frame creation or memory effects", () => {
    const impureConstants = [
      {
        label: "memory read",
        value: memoryRead("byte", 1, 0x1000n),
      },
      {
        label: "runtime name",
        value: name("byte", "input"),
      },
    ];

    for (const vector of impureConstants) {
      expect(
        evaluateOracleProgram(
          createProgram("byte", [{ kind: "return", value: name("byte", "constant") }], {
            constants: [
              {
                kind: "const",
                name: "constant",
                type: "byte",
                value: vector.value,
              },
            ],
            parameters: [{ name: "input", type: "byte" }],
            bindings: [
              {
                kind: "parameter-value",
                parameterPath: "/functions/0/parameters/0",
                value: 1n,
              },
            ],
            memory: {
              schemaVersion: 1,
              cells: [{ address: 0x1000n, value: 1n }],
            },
          }),
        ),
        vector.label,
      ).toEqual(unsupported);
    }
  });

  it("should expose left-to-right volatile order through effects, values, and final memory", () => {
    const body = [
      {
        kind: "local",
        name: "first",
        type: "byte",
        initializer: memoryRead("byte", 1, 0x1000n),
      },
      {
        kind: "memory-write",
        width: 1,
        address: literal("word", 0x1000n),
        value: literal("byte", 2n),
      },
      {
        kind: "local",
        name: "second",
        type: "byte",
        initializer: memoryRead("byte", 1, 0x1000n),
      },
      {
        kind: "memory-write",
        width: 1,
        address: literal("word", 0x1001n),
        value: binary("byte", "+", name("byte", "first"), name("byte", "second")),
      },
      {
        kind: "return",
        value: name("byte", "second"),
      },
    ];

    expect(
      evaluateOracleProgram(
        createProgram("byte", body, {
          memory: {
            schemaVersion: 1,
            cells: [
              { address: 0x1000n, value: 1n },
              { address: 0x1001n, value: 0n },
            ],
          },
        }),
      ),
    ).toEqual(
      modeledValue(
        integerValue("byte", 2n),
        [
          {
            ordinal: 0n,
            kind: "read",
            width: 1,
            address: 0x1000n,
            value: 1n,
          },
          {
            ordinal: 1n,
            kind: "write",
            width: 1,
            address: 0x1000n,
            value: 2n,
          },
          {
            ordinal: 2n,
            kind: "read",
            width: 1,
            address: 0x1000n,
            value: 2n,
          },
          {
            ordinal: 3n,
            kind: "write",
            width: 1,
            address: 0x1001n,
            value: 3n,
          },
        ],
        [
          { address: 0x1000n, value: 2n },
          { address: 0x1001n, value: 3n },
        ],
      ),
    );
  });

  it("should apply little-endian overlapping byte and word access and retain complete final memory", () => {
    const body = [
      {
        kind: "local",
        name: "high",
        type: "byte",
        initializer: memoryRead("byte", 1, 0x2001n),
      },
      {
        kind: "local",
        name: "original",
        type: "word",
        initializer: memoryRead("word", 2, 0x2000n),
      },
      {
        kind: "memory-write",
        width: 2,
        address: literal("word", 0x2001n),
        value: literal("word", 0xbeefn),
      },
      {
        kind: "return",
        value: memoryRead("word", 2, 0x2000n),
      },
    ];

    expect(
      evaluateOracleProgram(
        createProgram("word", body, {
          memory: {
            schemaVersion: 1,
            cells: [
              { address: 0x2000n, value: 0x34n },
              { address: 0x2001n, value: 0x12n },
              { address: 0x2002n, value: 0xaan },
            ],
          },
        }),
      ),
    ).toEqual(
      modeledValue(
        integerValue("word", 0xef34n),
        [
          {
            ordinal: 0n,
            kind: "read",
            width: 1,
            address: 0x2001n,
            value: 0x12n,
          },
          {
            ordinal: 1n,
            kind: "read",
            width: 2,
            address: 0x2000n,
            value: 0x1234n,
          },
          {
            ordinal: 2n,
            kind: "write",
            width: 2,
            address: 0x2001n,
            value: 0xbeefn,
          },
          {
            ordinal: 3n,
            kind: "read",
            width: 2,
            address: 0x2000n,
            value: 0xef34n,
          },
        ],
        [
          { address: 0x2000n, value: 0x34n },
          { address: 0x2001n, value: 0xefn },
          { address: 0x2002n, value: 0xben },
        ],
      ),
    );
  });

  it("should fail closed for absent cells and a word at the final address while allowing an initialized final byte", () => {
    const absentAccesses = [
      memoryRead("byte", 1, 0x3000n),
      memoryRead("word", 2, 0x3000n),
      memoryRead("word", 2, 0xffffn),
    ];

    for (const expression of absentAccesses) {
      expect(
        evaluateOracleProgram(
          returnProgram(expression.type, expression, {
            memory: {
              schemaVersion: 1,
              cells: [{ address: 0xffffn, value: 0x7fn }],
            },
          }),
        ),
      ).toEqual(unsupported);
    }

    expect(
      evaluateOracleProgram(
        returnProgram("byte", memoryRead("byte", 1, 0xffffn), {
          memory: {
            schemaVersion: 1,
            cells: [{ address: 0xffffn, value: 0x7fn }],
          },
        }),
      ),
    ).toEqual(
      modeledValue(
        integerValue("byte", 0x7fn),
        [
          {
            ordinal: 0n,
            kind: "read",
            width: 1,
            address: 0xffffn,
            value: 0x7fn,
          },
        ],
        [{ address: 0xffffn, value: 0x7fn }],
      ),
    );
  });

  it("should accept bound-minus-one and bound usage then reject the next charge for every budget dimension", () => {
    const dimensions = [
      "inputNodes",
      "expressionDepth",
      "evaluationSteps",
      "frames",
      "memoryCells",
      "effects",
      "transformedNodes",
    ] as const;
    const budget = {
      inputNodes: 2n,
      expressionDepth: 2n,
      evaluationSteps: 2n,
      frames: 2n,
      memoryCells: 2n,
      effects: 2n,
      transformedNodes: 2n,
    };
    const zeroUsage = {
      inputNodes: 0n,
      expressionDepth: 0n,
      evaluationSteps: 0n,
      frames: 0n,
      memoryCells: 0n,
      effects: 0n,
      transformedNodes: 0n,
    };

    for (const dimension of dimensions) {
      expect(
        probeOracleBudgetCharges({
          schemaVersion: 1,
          budget,
          charges: [{ dimension, amount: 1n }],
        }),
        `${dimension} bound-minus-one`,
      ).toEqual({
        ok: true,
        usage: { ...zeroUsage, [dimension]: 1n },
        diagnostics: [],
      });

      expect(
        probeOracleBudgetCharges({
          schemaVersion: 1,
          budget,
          charges: [{ dimension, amount: 2n }],
        }),
        `${dimension} bound`,
      ).toEqual({
        ok: true,
        usage: { ...zeroUsage, [dimension]: 2n },
        diagnostics: [],
      });

      const overLimit = probeOracleBudgetCharges({
        schemaVersion: 1,
        budget,
        charges: [
          { dimension, amount: 1n },
          { dimension, amount: 1n },
          { dimension, amount: 1n },
        ],
      });
      expect(overLimit, `${dimension} bound-plus-one`).toMatchObject({
        ok: false,
        usage: { ...zeroUsage, [dimension]: 2n },
        rejectedChargeIndex: 2,
        diagnostics: [
          {
            code: "oracle.budget",
            path: "/charges/2/amount",
          },
        ],
      });
    }
  });

  it("should return the same blocked result for constant-shaped and runtime-shaped zero divisors", () => {
    const constantZero = returnProgram(
      "word",
      binary("word", "/", literal("word", 10n), literal("word", 0n)),
    );
    const runtimeZero = returnProgram(
      "word",
      binary("word", "/", literal("word", 10n), name("word", "divisor")),
      {
        parameters: [{ name: "divisor", type: "word" }],
        bindings: [
          {
            kind: "parameter-value",
            parameterPath: "/functions/0/parameters/0",
            value: 0n,
          },
        ],
      },
    );

    expect(evaluateOracleProgram(constantZero)).toEqual(blockedDivisionByZero);
    expect(evaluateOracleProgram(runtimeZero)).toEqual(blockedDivisionByZero);
  });
});
