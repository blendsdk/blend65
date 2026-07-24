import { describe, expect, it } from "vitest";

import { inspectGeneratorInput, validateGeneratorIr } from "./generator-ir-validator.js";

function minimalModule() {
  return {
    kind: "module",
    path: ["Fixture"],
    constants: [],
    functions: [
      {
        kind: "function",
        name: "main",
        parameters: [],
        returnType: "void",
        body: [{ kind: "return" }],
      },
    ],
  };
}

function expressionModule() {
  return {
    kind: "module",
    path: ["Typed", "Expressions"],
    constants: [
      {
        kind: "const",
        name: "one",
        type: "byte",
        value: { kind: "literal", type: "byte", value: 1n },
      },
    ],
    functions: [
      {
        kind: "function",
        name: "calculate",
        parameters: [
          { name: "left", type: "byte" },
          { name: "address", type: "word" },
        ],
        returnType: "boolean",
        body: [
          {
            kind: "local",
            name: "inverted",
            type: "byte",
            initializer: {
              kind: "unary",
              type: "byte",
              operator: "~",
              operand: { kind: "name", type: "byte", name: "left" },
            },
          },
          {
            kind: "local",
            name: "sum",
            type: "byte",
            initializer: {
              kind: "binary",
              type: "byte",
              operator: "+",
              left: { kind: "name", type: "byte", name: "inverted" },
              right: { kind: "name", type: "byte", name: "one" },
            },
          },
          {
            kind: "assign",
            target: "sum",
            value: {
              kind: "memory-read",
              type: "byte",
              width: 1,
              address: { kind: "name", type: "word", name: "address" },
            },
          },
          {
            kind: "memory-write",
            width: 1,
            address: { kind: "name", type: "word", name: "address" },
            value: { kind: "name", type: "byte", name: "sum" },
          },
          {
            kind: "return",
            value: {
              kind: "binary",
              type: "boolean",
              operator: "==",
              left: { kind: "name", type: "byte", name: "sum" },
              right: { kind: "literal", type: "byte", value: 0n },
            },
          },
        ],
      },
    ],
  };
}

function moduleWithExpression(expression: unknown, returnType: string) {
  return {
    kind: "module",
    path: ["OperatorFixture"],
    constants: [],
    functions: [
      {
        kind: "function",
        name: "evaluate",
        parameters: [],
        returnType,
        body: [{ kind: "return", value: expression }],
      },
    ],
  };
}

function literal(type: string, value: bigint) {
  return { kind: "literal", type, value };
}

function expectFailure(input: unknown, code: string, path: string): void {
  expect(validateGeneratorIr(input)).toMatchObject({
    ok: false,
    diagnostics: [{ code, path }],
  });
}

describe("generator IR structural validation", () => {
  it("defensively snapshots and deeply freezes a complete expression module", () => {
    const input = expressionModule();
    const result = validateGeneratorIr(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    input.path[0] = "Changed";
    input.functions[0]!.body.length = 0;

    expect(result.module.path).toEqual(["Typed", "Expressions"]);
    expect(result.module.functions[0]?.body).toHaveLength(5);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.module)).toBe(true);
    expect(Object.isFrozen(result.module.path)).toBe(true);
    expect(Object.isFrozen(result.module.functions[0]?.body)).toBe(true);
  });

  it.each([
    [{ ...minimalModule(), extra: true }, "generation-input-invalid", ""],
    [{ ...minimalModule(), path: [] }, "generation-input-invalid", ""],
    [{ ...minimalModule(), path: [".."] }, "generation-input-invalid", ""],
    [
      {
        ...minimalModule(),
        constants: [
          {
            kind: "const",
            name: "bad",
            type: "byte",
            value: { kind: "literal", type: "byte", value: 256n },
          },
        ],
      },
      "generation-type-invalid",
      "/constants/0/value/value",
    ],
    [
      {
        ...minimalModule(),
        constants: [
          {
            kind: "const",
            name: "bad",
            type: "byte",
            value: { kind: "unknown", type: "byte" },
          },
        ],
      },
      "generation-input-invalid",
      "/constants/0/value/kind",
    ],
    [
      {
        ...minimalModule(),
        constants: [
          {
            kind: "const",
            name: "bad",
            type: "byte",
            value: { kind: "literal", type: "byte", value: 1n, extra: true },
          },
        ],
      },
      "generation-input-invalid",
      "/constants/0/value",
    ],
  ])("rejects malformed closed IR %#", (input, code, path) => {
    expectFailure(input, code, path);
  });

  it.each([
    [
      {
        kind: "unary",
        type: "byte",
        operator: "?",
        operand: { kind: "literal", type: "byte", value: 1n },
      },
      "generation-input-invalid",
    ],
    [
      {
        kind: "unary",
        type: "boolean",
        operator: "-",
        operand: { kind: "literal", type: "boolean", value: 1n },
      },
      "generation-type-invalid",
    ],
    [
      {
        kind: "binary",
        type: "byte",
        operator: "?",
        left: { kind: "literal", type: "byte", value: 1n },
        right: { kind: "literal", type: "byte", value: 2n },
      },
      "generation-input-invalid",
    ],
    [
      {
        kind: "binary",
        type: "byte",
        operator: "==",
        left: { kind: "literal", type: "byte", value: 1n },
        right: { kind: "literal", type: "byte", value: 2n },
      },
      "generation-type-invalid",
    ],
    [
      {
        kind: "memory-read",
        type: "word",
        width: 1,
        address: { kind: "literal", type: "word", value: 0n },
      },
      "generation-type-invalid",
    ],
    [
      {
        kind: "memory-read",
        type: "byte",
        width: 1,
        address: { kind: "literal", type: "byte", value: 0n },
      },
      "generation-type-invalid",
    ],
  ])("rejects invalid expression typing %#", (expression, code) => {
    const input = {
      ...minimalModule(),
      constants: [{ kind: "const", name: "value", type: "byte", value: expression }],
    };
    expect(validateGeneratorIr(input)).toMatchObject({
      ok: false,
      diagnostics: [{ code }],
    });
  });

  it("rejects duplicate and unresolved names at stable declaration paths", () => {
    const duplicateConstants = {
      ...minimalModule(),
      constants: [
        {
          kind: "const",
          name: "same",
          type: "byte",
          value: { kind: "literal", type: "byte", value: 1n },
        },
        {
          kind: "const",
          name: "same",
          type: "byte",
          value: { kind: "literal", type: "byte", value: 2n },
        },
      ],
    };
    expectFailure(duplicateConstants, "generation-type-invalid", "/constants/1/name");

    const unresolved = {
      ...minimalModule(),
      constants: [
        {
          kind: "const",
          name: "value",
          type: "byte",
          value: { kind: "name", type: "byte", name: "missing" },
        },
      ],
    };
    expectFailure(unresolved, "generation-type-invalid", "/constants/0/value/name");
  });

  it.each([
    [
      {
        kind: "local",
        name: "parameter",
        type: "byte",
        initializer: { kind: "literal", type: "byte", value: 1n },
      },
      "/functions/0/body/0/name",
    ],
    [
      {
        kind: "local",
        name: "local",
        type: "word",
        initializer: { kind: "literal", type: "byte", value: 1n },
      },
      "/functions/0/body/0/type",
    ],
    [
      {
        kind: "assign",
        target: "missing",
        value: { kind: "literal", type: "byte", value: 1n },
      },
      "/functions/0/body/0/target",
    ],
    [
      {
        kind: "memory-write",
        width: 2,
        address: { kind: "name", type: "word", name: "address" },
        value: { kind: "literal", type: "byte", value: 1n },
      },
      "/functions/0/body/0/value/type",
    ],
  ])("rejects statement type violations %#", (statement, path) => {
    const input = {
      kind: "module",
      path: ["Statements"],
      constants: [],
      functions: [
        {
          kind: "function",
          name: "main",
          parameters: [
            { name: "parameter", type: "byte" },
            { name: "address", type: "word" },
          ],
          returnType: "void",
          body: [statement],
        },
      ],
    };
    expectFailure(input, "generation-type-invalid", path);
  });

  it("rejects incompatible return forms and duplicate module functions", () => {
    const scalarWithoutValue = minimalModule();
    scalarWithoutValue.functions[0]!.returnType = "byte";
    expectFailure(scalarWithoutValue, "generation-type-invalid", "/functions/0/body/0");

    const voidWithValue = {
      ...minimalModule(),
      functions: [
        {
          ...minimalModule().functions[0]!,
          body: [
            {
              kind: "return",
              value: { kind: "literal", type: "byte", value: 0n },
            },
          ],
        },
      ],
    };
    expectFailure(voidWithValue, "generation-type-invalid", "/functions/0/body/0/value/type");

    const duplicateFunctions = minimalModule();
    duplicateFunctions.functions.push({
      ...duplicateFunctions.functions[0]!,
      body: [{ kind: "return" }],
    });
    expectFailure(duplicateFunctions, "generation-type-invalid", "/functions/1/name");
  });

  it("bounds expression nesting before recursive validation can exhaust the host", () => {
    let expression: unknown = { kind: "literal", type: "byte", value: 0n };
    for (let index = 0; index < 1_025; index += 1) {
      expression = { kind: "unary", type: "byte", operator: "~", operand: expression };
    }
    const input = {
      ...minimalModule(),
      constants: [{ kind: "const", name: "deep", type: "byte", value: expression }],
    };

    expect(validateGeneratorIr(input)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "generation-input-invalid" }],
    });
  });

  it("rejects malformed nested records at every parser boundary", () => {
    const withConstantValue = (value: unknown) => ({
      ...minimalModule(),
      constants: [{ kind: "const", name: "value", type: "byte", value }],
    });
    const withBody = (body: readonly unknown[]) => ({
      ...minimalModule(),
      functions: [{ ...minimalModule().functions[0]!, body }],
    });

    for (const input of [
      withConstantValue(null),
      withConstantValue({ kind: "name", type: "byte" }),
      withConstantValue({
        kind: "unary",
        type: "byte",
        operator: "~",
        operand: null,
      }),
      withConstantValue({
        kind: "binary",
        type: "byte",
        operator: "+",
        left: null,
        right: { kind: "literal", type: "byte", value: 1n },
      }),
      withConstantValue({
        kind: "binary",
        type: "byte",
        operator: "+",
        left: { kind: "literal", type: "byte", value: 1n },
        right: null,
      }),
      withConstantValue({
        kind: "memory-read",
        type: "byte",
        width: 1,
        address: null,
      }),
      withBody([null]),
      withBody([{ kind: "local", name: "local", type: "byte" }]),
      withBody([
        {
          kind: "local",
          name: "local",
          type: "byte",
          initializer: null,
        },
      ]),
      withBody([{ kind: "assign", target: "_bad", value: null }]),
      withBody([{ kind: "assign", target: "value", value: null }]),
      withBody([{ kind: "memory-write", width: 3, address: null, value: null }]),
      withBody([
        {
          kind: "memory-write",
          width: 1,
          address: null,
          value: { kind: "literal", type: "byte", value: 1n },
        },
      ]),
      withBody([
        {
          kind: "memory-write",
          width: 1,
          address: { kind: "literal", type: "word", value: 0n },
          value: null,
        },
      ]),
      withBody([{ kind: "return", extra: true }]),
      withBody([{ kind: "return", value: null }]),
      {
        ...minimalModule(),
        constants: [{ kind: "constant", name: "value", type: "byte", value: null }],
      },
      {
        ...minimalModule(),
        functions: [
          {
            ...minimalModule().functions[0]!,
            parameters: [null],
          },
        ],
      },
      {
        ...minimalModule(),
        functions: [
          {
            ...minimalModule().functions[0]!,
            body: [{ kind: "unsupported" }],
          },
        ],
      },
      {
        ...minimalModule(),
        functions: [...minimalModule().functions, null],
      },
    ]) {
      expect(validateGeneratorIr(input).ok).toBe(false);
    }
  });
});

describe("generator IR scalar operator semantics", () => {
  it.each([
    ["-", "sbyte", 1n],
    ["-", "sword", 1n],
    ["~", "byte", 1n],
    ["~", "sbyte", 1n],
    ["~", "word", 1n],
    ["~", "sword", 1n],
    ["!", "boolean", 1n],
  ])("accepts unary %s over its complete %s domain", (operator, type, value) => {
    expect(
      validateGeneratorIr(
        moduleWithExpression(
          { kind: "unary", type, operator, operand: literal(type, value) },
          type,
        ),
      ),
    ).toMatchObject({ ok: true });
  });

  it.each([
    ["-", "byte", "byte"],
    ["-", "word", "word"],
    ["-", "boolean", "boolean"],
    ["~", "boolean", "boolean"],
    ["!", "byte", "boolean"],
    ["!", "boolean", "byte"],
  ])("rejects unary %s with %s operand and %s result", (operator, operandType, resultType) => {
    expect(
      validateGeneratorIr(
        moduleWithExpression(
          {
            kind: "unary",
            type: resultType,
            operator,
            operand: literal(operandType, operandType === "boolean" ? 1n : 0n),
          },
          resultType,
        ),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "generation-type-invalid" }],
    });
  });

  it.each(["+", "-", "*", "/", "%", "&", "|", "^"])(
    "promotes mixed-width unsigned operands for %s",
    (operator) => {
      expect(
        validateGeneratorIr(
          moduleWithExpression(
            {
              kind: "binary",
              type: "word",
              operator,
              left: literal("byte", 1n),
              right: literal("word", 2n),
            },
            "word",
          ),
        ),
      ).toMatchObject({ ok: true });
    },
  );

  it("promotes mixed-width signed operands in either order", () => {
    for (const [left, right] of [
      ["sbyte", "sword"],
      ["sword", "sbyte"],
    ]) {
      expect(
        validateGeneratorIr(
          moduleWithExpression(
            {
              kind: "binary",
              type: "sword",
              operator: "+",
              left: literal(left!, -1n),
              right: literal(right!, -1n),
            },
            "sword",
          ),
        ),
      ).toMatchObject({ ok: true });
    }
  });

  it.each([
    ["byte", "sbyte", "byte"],
    ["word", "sword", "word"],
    ["boolean", "boolean", "boolean"],
    ["byte", "word", "byte"],
  ])(
    "rejects arithmetic/bitwise operands %s and %s with result %s",
    (leftType, rightType, resultType) => {
      expect(
        validateGeneratorIr(
          moduleWithExpression(
            {
              kind: "binary",
              type: resultType,
              operator: "+",
              left: literal(leftType, leftType === "boolean" ? 1n : 0n),
              right: literal(rightType, rightType === "boolean" ? 1n : 0n),
            },
            resultType,
          ),
        ),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: "generation-type-invalid" }],
      });
    },
  );

  it.each([
    ["==", "boolean", "boolean"],
    ["!=", "boolean", "boolean"],
    ["<", "byte", "word"],
    [">=", "sbyte", "sword"],
  ])("accepts comparison %s across %s and %s", (operator, leftType, rightType) => {
    expect(
      validateGeneratorIr(
        moduleWithExpression(
          {
            kind: "binary",
            type: "boolean",
            operator,
            left: literal(leftType, leftType === "boolean" ? 1n : 0n),
            right: literal(rightType, rightType === "boolean" ? 0n : 1n),
          },
          "boolean",
        ),
      ),
    ).toMatchObject({ ok: true });
  });

  it.each([
    ["<", "boolean", "boolean", "boolean"],
    ["==", "boolean", "byte", "boolean"],
    ["==", "byte", "sbyte", "boolean"],
    ["==", "byte", "word", "word"],
  ])(
    "rejects comparison %s across %s and %s with result %s",
    (operator, leftType, rightType, resultType) => {
      expect(
        validateGeneratorIr(
          moduleWithExpression(
            {
              kind: "binary",
              type: resultType,
              operator,
              left: literal(leftType, leftType === "boolean" ? 1n : 0n),
              right: literal(rightType, rightType === "boolean" ? 0n : 1n),
            },
            resultType,
          ),
        ),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: "generation-type-invalid" }],
      });
    },
  );

  it.each([
    ["<<", "sword", "byte", "sword"],
    [">>", "byte", "word", "byte"],
  ])(
    "accepts shift %s with %s left, %s amount, and %s result",
    (operator, leftType, rightType, resultType) => {
      expect(
        validateGeneratorIr(
          moduleWithExpression(
            {
              kind: "binary",
              type: resultType,
              operator,
              left: literal(leftType, leftType.startsWith("s") ? -1n : 1n),
              right: literal(rightType, 1n),
            },
            resultType,
          ),
        ),
      ).toMatchObject({ ok: true });
    },
  );

  it.each([
    ["byte", "sbyte", "byte"],
    ["word", "sword", "word"],
    ["boolean", "byte", "boolean"],
    ["byte", "boolean", "byte"],
    ["byte", "word", "word"],
  ])("rejects shift with %s left, %s amount, and %s result", (leftType, rightType, resultType) => {
    expect(
      validateGeneratorIr(
        moduleWithExpression(
          {
            kind: "binary",
            type: resultType,
            operator: "<<",
            left: literal(leftType, leftType === "boolean" ? 1n : 0n),
            right: literal(rightType, rightType === "boolean" ? 1n : 0n),
          },
          resultType,
        ),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "generation-type-invalid" }],
    });
  });
});

describe("generator IR binding and return contracts", () => {
  it("allows assignments to parameters and locals while rejecting constants", () => {
    const mutableModule = {
      kind: "module",
      path: ["MutableBindings"],
      constants: [
        {
          kind: "const",
          name: "fixed",
          type: "byte",
          value: literal("byte", 1n),
        },
      ],
      functions: [
        {
          kind: "function",
          name: "main",
          parameters: [{ name: "parameter", type: "byte" }],
          returnType: "void",
          body: [
            {
              kind: "local",
              name: "local",
              type: "byte",
              initializer: { kind: "name", type: "byte", name: "fixed" },
            },
            { kind: "assign", target: "parameter", value: literal("byte", 2n) },
            { kind: "assign", target: "local", value: literal("byte", 3n) },
            { kind: "return" },
          ],
        },
      ],
    };
    expect(validateGeneratorIr(mutableModule)).toMatchObject({ ok: true });

    const constantAssignment = {
      ...mutableModule,
      functions: [
        {
          ...mutableModule.functions[0]!,
          body: [
            { kind: "assign", target: "fixed", value: literal("byte", 2n) },
            { kind: "return" },
          ],
        },
      ],
    };
    expect(validateGeneratorIr(constantAssignment)).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "generation-type-invalid",
          path: "/functions/0/body/0/target",
        },
      ],
    });
  });

  it("requires scalar functions to end in a matching value return", () => {
    for (const body of [
      [],
      [
        {
          kind: "local",
          name: "value",
          type: "byte",
          initializer: literal("byte", 1n),
        },
      ],
    ]) {
      expect(
        validateGeneratorIr({
          kind: "module",
          path: ["MissingReturn"],
          constants: [],
          functions: [
            {
              kind: "function",
              name: "value",
              parameters: [],
              returnType: "byte",
              body,
            },
          ],
        }),
      ).toMatchObject({
        ok: false,
        diagnostics: [
          {
            code: "generation-type-invalid",
            path: "/functions/0/body",
          },
        ],
      });
    }
  });

  it("rejects statements after a terminal return", () => {
    expect(
      validateGeneratorIr({
        kind: "module",
        path: ["Unreachable"],
        constants: [],
        functions: [
          {
            kind: "function",
            name: "main",
            parameters: [],
            returnType: "void",
            body: [
              { kind: "return" },
              {
                kind: "local",
                name: "unreachable",
                type: "byte",
                initializer: literal("byte", 1n),
              },
            ],
          },
        ],
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "generation-type-invalid",
          path: "/functions/0/body/1",
        },
      ],
    });
  });

  it("validates many constants and functions without per-function constant-table copying", () => {
    const constants = Array.from({ length: 8_000 }, (_, index) => ({
      kind: "const",
      name: `constant${index}`,
      type: "byte",
      value: literal("byte", BigInt(index % 256)),
    }));
    const functions = Array.from({ length: 8_000 }, (_, index) => ({
      kind: "function",
      name: `function${index}`,
      parameters: [],
      returnType: "void",
      body: [],
    }));
    const started = performance.now();
    const result = validateGeneratorIr({
      kind: "module",
      path: ["Scale"],
      constants,
      functions,
    });
    const elapsed = performance.now() - started;

    expect(result).toMatchObject({ ok: true });
    expect(elapsed).toBeLessThan(2_000);
  });
});

describe("generator own-data inspection", () => {
  it("permits BigInt data and only explicitly allowed callable paths", () => {
    expect(inspectGeneratorInput({ value: 1n }, "", () => false)).toBeUndefined();
    expect(
      inspectGeneratorInput({ callback: () => true }, "", (path) => path === "/callback"),
    ).toBeUndefined();
    expect(inspectGeneratorInput({ callback: () => true }, "", () => false)).toMatchObject({
      path: "/callback",
    });
  });

  it.each([
    [Object.create({ inherited: true }), ""],
    [new Date(), ""],
    [Object.assign([1], { extra: true }), ""],
    [Object.defineProperty({}, "hidden", { value: true }), "/hidden"],
    [Object.defineProperty({}, "accessor", { get: () => true, enumerable: true }), "/accessor"],
    [Object.defineProperty({}, Symbol("unsafe"), { value: true, enumerable: true }), ""],
    [{ value: Symbol("unsafe") }, "/value"],
  ])("rejects exotic or non-data input %#", (input, path) => {
    expect(inspectGeneratorInput(input, "", () => false)).toMatchObject({ path });
  });

  it("rejects cycles and proxies whose structure cannot be inspected", () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(inspectGeneratorInput(cyclic, "", () => false)).toMatchObject({ path: "/self" });

    const hostile = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          throw new Error("blocked");
        },
      },
    );
    expect(validateGeneratorIr(hostile)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "generation-input-invalid", path: "" }],
    });
  });

  it("escapes unsafe property names in diagnostic pointers", () => {
    const input = Object.defineProperty({}, "a/~b", {
      enumerable: true,
      get: () => true,
    });
    expect(inspectGeneratorInput(input, "", () => false)).toMatchObject({
      path: "/a~1~0b",
    });
  });

  it("rejects an oversized flat array before enumerating or inspecting elements", () => {
    const values = Array.from({ length: 262_145 }, () => null);
    let ownKeyCalls = 0;
    let elementDescriptorCalls = 0;
    const observed = new Proxy(values, {
      ownKeys: (target) => {
        ownKeyCalls += 1;
        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor: (target, key) => {
        if (key !== "length") elementDescriptorCalls += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    expect(inspectGeneratorInput(observed, "", () => false)).toMatchObject({
      message: "Generator input exceeds the traversal value limit.",
    });
    expect(ownKeyCalls).toBe(0);
    expect(elementDescriptorCalls).toBe(0);
  });

  it("bounds aggregate scheduled work before enumerating the second large child", () => {
    const counters = { ownKeys: 0, elementDescriptors: 0 };
    const createObservedArray = () =>
      new Proxy(
        Array.from({ length: 140_000 }, () => null),
        {
          ownKeys: (target) => {
            counters.ownKeys += 1;
            return Reflect.ownKeys(target);
          },
          getOwnPropertyDescriptor: (target, key) => {
            if (key !== "length") counters.elementDescriptors += 1;
            return Reflect.getOwnPropertyDescriptor(target, key);
          },
        },
      );

    expect(
      inspectGeneratorInput(
        { first: createObservedArray(), second: createObservedArray() },
        "",
        () => false,
      ),
    ).toMatchObject({
      message: "Generator input exceeds the traversal value limit.",
    });
    expect(counters.ownKeys).toBe(1);
    expect(counters.elementDescriptors).toBe(140_000);
  });
});
