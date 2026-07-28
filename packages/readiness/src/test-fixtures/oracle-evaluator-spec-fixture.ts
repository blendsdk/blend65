type ScalarType = "boolean" | "byte" | "sbyte" | "word" | "sword";

interface TestBudget {
  readonly inputNodes: bigint;
  readonly expressionDepth: bigint;
  readonly evaluationSteps: bigint;
  readonly frames: bigint;
  readonly memoryCells: bigint;
  readonly effects: bigint;
  readonly transformedNodes: bigint;
}

interface ProgramOptions {
  readonly constants?: readonly unknown[];
  readonly parameters?: readonly {
    readonly name: string;
    readonly type: ScalarType;
  }[];
  readonly bindings?: readonly {
    readonly kind: "parameter-value";
    readonly parameterPath: string;
    readonly value: bigint | boolean;
  }[];
  readonly memory?: {
    readonly schemaVersion: 1;
    readonly cells: readonly {
      readonly address: bigint;
      readonly value: bigint;
    }[];
  };
  readonly budget?: TestBudget;
}

const DEFAULT_BUDGET: TestBudget = {
  inputNodes: 128n,
  expressionDepth: 32n,
  evaluationSteps: 256n,
  frames: 1n,
  memoryCells: 64n,
  effects: 64n,
  transformedNodes: 1n,
};

const EMPTY_MEMORY = {
  schemaVersion: 1 as const,
  cells: [],
};

const integerValue = (type: Exclude<ScalarType, "boolean">, value: bigint) => ({
  kind: "integer" as const,
  type,
  value,
});

const booleanValue = (value: boolean) => ({
  kind: "boolean" as const,
  type: "boolean" as const,
  value,
});

const literal = (type: ScalarType, value: bigint) => ({
  kind: "literal" as const,
  type,
  value,
});

const name = (type: ScalarType, identifier: string) => ({
  kind: "name" as const,
  type,
  name: identifier,
});

const unary = (type: ScalarType, operator: "-" | "~" | "!", operand: unknown) => ({
  kind: "unary" as const,
  type,
  operator,
  operand,
});

const binary = (
  type: ScalarType,
  operator:
    | "+"
    | "-"
    | "*"
    | "/"
    | "%"
    | "&"
    | "|"
    | "^"
    | "<<"
    | ">>"
    | "=="
    | "!="
    | "<"
    | "<="
    | ">"
    | ">=",
  left: unknown,
  right: unknown,
) => ({
  kind: "binary" as const,
  type,
  operator,
  left,
  right,
});

const memoryRead = (type: "byte" | "word", width: 1 | 2, address: bigint) => ({
  kind: "memory-read" as const,
  type,
  width,
  address: literal("word", address),
});

const createProgram = (
  returnType: ScalarType | "void",
  body: readonly unknown[],
  options: ProgramOptions = {},
) => ({
  schemaVersion: 1 as const,
  module: {
    kind: "module" as const,
    path: ["spec"],
    constants: options.constants ?? [],
    functions: [
      {
        kind: "function" as const,
        name: "main",
        parameters: options.parameters ?? [],
        returnType,
        body,
      },
    ],
  },
  entryFunction: "main",
  parameterBindings: options.bindings ?? [],
  memory: options.memory ?? EMPTY_MEMORY,
  budget: options.budget ?? DEFAULT_BUDGET,
});

const returnProgram = (returnType: ScalarType, expression: unknown, options: ProgramOptions = {}) =>
  createProgram(
    returnType,
    [
      {
        kind: "return",
        value: expression,
      },
    ],
    options,
  );

const modeledValue = (
  returnValue: ReturnType<typeof integerValue> | ReturnType<typeof booleanValue> | null,
  effects: readonly unknown[] = [],
  finalMemory: readonly unknown[] = [],
) => ({
  ok: true as const,
  outcome: "modeled" as const,
  observation: {
    kind: "value-state" as const,
    returnValue,
    effects,
    finalMemory,
  },
  diagnostics: [],
});

const unsupported = {
  ok: true as const,
  outcome: "oracle-unmodeled" as const,
  reason: "unsupported-semantics" as const,
  diagnostics: [],
};

const blockedDivisionByZero = {
  ok: true as const,
  outcome: "oracle-unmodeled" as const,
  reason: "blocked-errata-division-by-zero" as const,
  diagnostics: [],
};

/**
 * Creates plain immutable evaluator inputs and expected observations.
 *
 * The fixture deliberately knows only the frozen conformance schema. It does
 * not import evaluator production types, so the specification remains capable
 * of detecting implementation drift.
 */
export const createOracleEvaluatorSpecFixture = () => ({
  binary,
  blockedDivisionByZero,
  booleanValue,
  createProgram,
  integerValue,
  literal,
  memoryRead,
  modeledValue,
  name,
  returnProgram,
  unary,
  unsupported,
});
