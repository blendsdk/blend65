import { describe, expect, it } from "vitest";

import { validateGeneratorIr } from "./generator-ir-validator.js";
import { applyInvalidNeighbor } from "./invalid-neighbor.js";

type ScalarTypeFixture = "boolean" | "byte" | "sbyte" | "word" | "sword";

type ExpressionFixture =
  | {
      readonly kind: "literal";
      readonly type: ScalarTypeFixture;
      readonly value: bigint;
    }
  | {
      readonly kind: "name";
      readonly type: ScalarTypeFixture;
      readonly name: string;
    }
  | {
      readonly kind: "memory-read";
      readonly type: "byte" | "word";
      readonly width: 1 | 2;
      readonly address: ExpressionFixture;
    };

type StatementFixture =
  | {
      readonly kind: "local";
      readonly name: string;
      readonly type: ScalarTypeFixture;
      readonly initializer: ExpressionFixture;
    }
  | {
      readonly kind: "memory-write";
      readonly width: 1 | 2;
      readonly address: ExpressionFixture;
      readonly value: ExpressionFixture;
    }
  | { readonly kind: "return"; readonly value?: ExpressionFixture };

interface ModuleFixture {
  readonly kind: "module";
  readonly path: readonly string[];
  readonly constants: readonly {
    readonly kind: "const";
    readonly name: string;
    readonly type: ScalarTypeFixture;
    readonly value: ExpressionFixture;
  }[];
  readonly functions: readonly {
    readonly kind: "function";
    readonly name: string;
    readonly parameters: readonly {
      readonly name: string;
      readonly type: ScalarTypeFixture;
    }[];
    readonly returnType: ScalarTypeFixture | "void";
    readonly body: readonly StatementFixture[];
  }[];
}

const SCALAR_CASES = [
  { type: "boolean", value: 1n },
  { type: "byte", value: 255n },
  { type: "sbyte", value: -128n },
  { type: "word", value: 65_535n },
  { type: "sword", value: -32_768n },
] as const;

function scalarName(type: ScalarTypeFixture, suffix: string): string {
  return `${type}${suffix}`;
}

function createScalarModule(): ModuleFixture {
  return {
    kind: "module",
    path: ["ScalarForms"],
    constants: SCALAR_CASES.map(({ type, value }) => ({
      kind: "const",
      name: scalarName(type, "Const"),
      type,
      value: { kind: "literal", type, value },
    })),
    functions: SCALAR_CASES.map(({ type, value }) => {
      const parameterName = scalarName(type, "Parameter");
      const literalName = scalarName(type, "Literal");
      const constName = scalarName(type, "FromConst");
      const localName = scalarName(type, "FromLocal");
      const parameterCopyName = scalarName(type, "FromParameter");

      return {
        kind: "function",
        name: scalarName(type, "Forms"),
        parameters: [{ name: parameterName, type }],
        returnType: type,
        body: [
          {
            kind: "local",
            name: literalName,
            type,
            initializer: { kind: "literal", type, value },
          },
          {
            kind: "local",
            name: constName,
            type,
            initializer: {
              kind: "name",
              type,
              name: scalarName(type, "Const"),
            },
          },
          {
            kind: "local",
            name: localName,
            type,
            initializer: { kind: "name", type, name: literalName },
          },
          {
            kind: "local",
            name: parameterCopyName,
            type,
            initializer: { kind: "name", type, name: parameterName },
          },
          {
            kind: "return",
            value: { kind: "name", type, name: localName },
          },
        ],
      };
    }),
  };
}

function createMemoryModule(): ModuleFixture {
  const literalAddress = { kind: "literal", type: "word", value: 49_152n } as const;
  const literalByte = { kind: "literal", type: "byte", value: 255n } as const;
  const literalWord = { kind: "literal", type: "word", value: 65_535n } as const;
  const namedAddress = { kind: "name", type: "word", name: "MemoryAddress" } as const;
  const namedByte = { kind: "name", type: "byte", name: "ByteValue" } as const;
  const namedWord = { kind: "name", type: "word", name: "WordValue" } as const;

  const accessBody = (
    address:
      | typeof literalAddress
      | { readonly kind: "name"; readonly type: "word"; readonly name: string },
    byteValue:
      | typeof literalByte
      | { readonly kind: "name"; readonly type: "byte"; readonly name: string },
    wordValue:
      | typeof literalWord
      | { readonly kind: "name"; readonly type: "word"; readonly name: string },
    suffix: string,
  ) =>
    [
      {
        kind: "local",
        name: `readByte${suffix}`,
        type: "byte",
        initializer: {
          kind: "memory-read",
          type: "byte",
          width: 1,
          address,
        },
      },
      {
        kind: "local",
        name: `readWord${suffix}`,
        type: "word",
        initializer: {
          kind: "memory-read",
          type: "word",
          width: 2,
          address,
        },
      },
      { kind: "memory-write", width: 1, address, value: byteValue },
      { kind: "memory-write", width: 2, address, value: wordValue },
      { kind: "return" },
    ] as const;

  return {
    kind: "module",
    path: ["MemoryForms"],
    constants: [
      {
        kind: "const",
        name: "MemoryAddress",
        type: "word",
        value: literalAddress,
      },
      { kind: "const", name: "ByteValue", type: "byte", value: literalByte },
      { kind: "const", name: "WordValue", type: "word", value: literalWord },
    ],
    functions: [
      {
        kind: "function",
        name: "literalMemoryForms",
        parameters: [],
        returnType: "void",
        body: accessBody(literalAddress, literalByte, literalWord, "Literal"),
      },
      {
        kind: "function",
        name: "constantMemoryForms",
        parameters: [],
        returnType: "void",
        body: accessBody(namedAddress, namedByte, namedWord, "Const"),
      },
      {
        kind: "function",
        name: "localMemoryForms",
        parameters: [],
        returnType: "void",
        body: [
          {
            kind: "local",
            name: "localAddress",
            type: "word",
            initializer: literalAddress,
          },
          {
            kind: "local",
            name: "localByte",
            type: "byte",
            initializer: literalByte,
          },
          {
            kind: "local",
            name: "localWord",
            type: "word",
            initializer: literalWord,
          },
          ...accessBody(
            { kind: "name", type: "word", name: "localAddress" },
            { kind: "name", type: "byte", name: "localByte" },
            { kind: "name", type: "word", name: "localWord" },
            "Local",
          ),
        ],
      },
      {
        kind: "function",
        name: "parameterMemoryForms",
        parameters: [
          { name: "parameterAddress", type: "word" },
          { name: "parameterByte", type: "byte" },
          { name: "parameterWord", type: "word" },
        ],
        returnType: "void",
        body: accessBody(
          { kind: "name", type: "word", name: "parameterAddress" },
          { kind: "name", type: "byte", name: "parameterByte" },
          { kind: "name", type: "word", name: "parameterWord" },
          "Parameter",
        ),
      },
    ],
  };
}

function createNeighborBaseline(): ModuleFixture {
  return {
    kind: "module",
    path: ["NeighborFixture"],
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

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") {
    return;
  }

  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) {
    expectDeeplyFrozen(nested);
  }
}

describe("generator IR", () => {
  it("accepts every scalar type in literal, constant, local, and parameter forms", () => {
    const module = createScalarModule();

    expect(validateGeneratorIr(module)).toEqual({
      ok: true,
      module,
      diagnostics: [],
    });
  });

  it("represents byte and word memory reads and writes with every operand spelling", () => {
    const module = createMemoryModule();

    expect(validateGeneratorIr(module)).toEqual({
      ok: true,
      module,
      diagnostics: [],
    });
  });
});

describe("invalid neighbors", () => {
  const predicates = [
    {
      predicateId: "main-function-present",
      evaluate: (module: ModuleFixture) =>
        module.functions.some((candidate) => candidate.name === "main"),
    },
    {
      predicateId: "expected-module-path",
      evaluate: (module: ModuleFixture) => module.path[0] === "NeighborFixture",
    },
  ];

  it("accepts one named predicate flip and preserves its diagnostic metadata", () => {
    const baseline = createNeighborBaseline();
    const changedModule = {
      ...baseline,
      functions: [{ ...baseline.functions[0]!, name: "renamedMain" }],
    };

    const result = applyInvalidNeighbor({
      baseline,
      operation: {
        neighborId: "rename-main",
        targetPredicateId: "main-function-present",
        diagnosticFamily: "missing-entrypoint",
        apply: () => changedModule,
      },
      predicates,
    });

    expect(result).toEqual({
      ok: true,
      module: changedModule,
      neighborId: "rename-main",
      violatedPredicateId: "main-function-present",
      diagnosticFamily: "missing-entrypoint",
      diagnostics: [],
    });
    if (result.ok) {
      expectDeeplyFrozen(result.module);
    }
    expect(baseline).toEqual(createNeighborBaseline());
  });

  it("rejects an operation that flips no predicate", () => {
    const baseline = createNeighborBaseline();

    const result = applyInvalidNeighbor({
      baseline,
      operation: {
        neighborId: "leave-valid",
        targetPredicateId: "main-function-present",
        diagnosticFamily: "missing-entrypoint",
        apply: (module: ModuleFixture) => module,
      },
      predicates,
    });

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: "neighbor-invalid", path: "/predicates" }],
    });
  });

  it("rejects an operation that flips more than its named predicate", () => {
    const baseline = createNeighborBaseline();

    const result = applyInvalidNeighbor({
      baseline,
      operation: {
        neighborId: "rename-main-and-module",
        targetPredicateId: "main-function-present",
        diagnosticFamily: "missing-entrypoint",
        apply: (module: ModuleFixture) => ({
          ...module,
          path: ["ChangedFixture"],
          functions: [{ ...module.functions[0]!, name: "renamedMain" }],
        }),
      },
      predicates,
    });

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: "neighbor-invalid", path: "/predicates" }],
    });
  });
});
