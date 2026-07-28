import { describe, expect, it } from "vitest";

import { validateGeneratorIrSyntax } from "./generator-ir-validator.js";
import {
  createOracleBudgetMeter,
  probeOracleBudgetCharges,
  validateOracleBudget,
} from "./oracle-budget.js";
import { evaluateOracleProgram } from "./oracle-evaluator.js";
import {
  createOracleMemoryState,
  projectOracleMemory,
  readOracleMemory,
  validateOracleMemoryFixture,
  writeOracleMemory,
} from "./oracle-memory.js";
import {
  evaluateOracleBinaryOperation,
  evaluateOracleUnaryOperation,
} from "./oracle-operations.js";
import { validateOracleSemanticClosure } from "./oracle-semantic-closure.js";
import {
  createOracleEvaluationState,
  createOracleEntryFrame,
  declareOracleLocal,
  assignOracleStateValue,
} from "./oracle-state.js";
import { normalizeOracleInteger } from "./oracle-values.js";

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

describe("oracle evaluator implementation", () => {
  it("should reject hostile accessors and unknown fields without invoking user code", () => {
    let invoked = false;
    const hostile = {
      schemaVersion: 1,
      entryFunction: "main",
      parameterBindings: [],
      memory: EMPTY_MEMORY,
      budget: BUDGET,
    };
    Object.defineProperty(hostile, "module", {
      enumerable: true,
      get() {
        invoked = true;
        return {};
      },
    });

    expect(evaluateOracleProgram(hostile)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid" }],
    });
    expect(invoked).toBe(false);
    expect(evaluateOracleProgram({ ...program("void", []), extra: true })).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid" }],
    });
  });

  it("should evaluate every remaining closed scalar operation and normalize immediately", () => {
    const vectors = [
      [
        "subtraction",
        returned("byte", binary("byte", "-", literal("byte", 1n), literal("byte", 2n))),
        { kind: "integer", type: "byte", value: 255n },
      ],
      [
        "multiplication",
        returned("sbyte", binary("sbyte", "*", literal("sbyte", -4n), literal("sbyte", 3n))),
        { kind: "integer", type: "sbyte", value: -12n },
      ],
      [
        "remainder",
        returned("sword", binary("sword", "%", literal("sword", -7n), literal("sword", 3n))),
        { kind: "integer", type: "sword", value: -1n },
      ],
      [
        "xor",
        returned("word", binary("word", "^", literal("word", 0xff00n), literal("byte", 0xffn))),
        { kind: "integer", type: "word", value: 0xffffn },
      ],
      [
        "less-or-equal",
        returned("boolean", binary("boolean", "<=", literal("word", 2n), literal("byte", 2n))),
        { kind: "boolean", type: "boolean", value: true },
      ],
      [
        "greater-or-equal",
        returned("boolean", binary("boolean", ">=", literal("sbyte", -1n), literal("sword", -2n))),
        { kind: "boolean", type: "boolean", value: true },
      ],
      [
        "boolean inequality",
        returned(
          "boolean",
          binary("boolean", "!=", literal("boolean", 1n), literal("boolean", 0n)),
        ),
        { kind: "boolean", type: "boolean", value: true },
      ],
    ] as const;

    for (const [label, input, returnValue] of vectors) {
      expect(evaluateOracleProgram(input), label).toMatchObject({
        ok: true,
        outcome: "modeled",
        observation: { returnValue },
      });
    }
    expect(
      evaluateOracleUnaryOperation(
        "!",
        "boolean",
        Object.freeze({ kind: "boolean", type: "boolean", value: true }),
      ),
    ).toMatchObject({ kind: "value", value: { value: false } });
    expect(normalizeOracleInteger("sword", 65_535n)).toBe(-1n);
  });

  it("should reject constant cycles and allow deterministic forward dependency resolution", () => {
    const cycle = [
      {
        kind: "const",
        name: "a",
        type: "byte",
        value: { kind: "name", type: "byte", name: "b" },
      },
      {
        kind: "const",
        name: "b",
        type: "byte",
        value: { kind: "name", type: "byte", name: "a" },
      },
    ];
    expect(
      evaluateOracleProgram(returned("byte", { kind: "name", type: "byte", name: "a" }, cycle)),
    ).toMatchObject({
      ok: true,
      outcome: "oracle-unmodeled",
      reason: "unsupported-semantics",
    });

    const forward = [
      {
        kind: "const",
        name: "answer",
        type: "word",
        value: { kind: "name", type: "word", name: "base" },
      },
      {
        kind: "const",
        name: "base",
        type: "word",
        value: literal("word", 42n),
      },
    ];
    expect(
      evaluateOracleProgram(
        returned("word", { kind: "name", type: "word", name: "answer" }, forward),
      ),
    ).toMatchObject({
      ok: true,
      outcome: "modeled",
      observation: { returnValue: { value: 42n } },
    });
  });

  it("should resolve a large shallow constant chain without using the call stack", () => {
    const constantCount = 20_000;
    const constants = Array.from({ length: constantCount }, (_, index) => ({
      kind: "const",
      name: `constant${index}`,
      type: "word",
      value:
        index === constantCount - 1
          ? literal("word", 42n)
          : { kind: "name", type: "word", name: `constant${index + 1}` },
    }));
    const structural = validateGeneratorIrSyntax({
      kind: "module",
      path: ["large"],
      constants,
      functions: [
        {
          kind: "function",
          name: "main",
          parameters: [],
          returnType: "word",
          body: [
            {
              kind: "return",
              value: { kind: "name", type: "word", name: "constant0" },
            },
          ],
        },
      ],
    });
    expect(structural.ok).toBe(true);
    if (!structural.ok) return;
    const closure = validateOracleSemanticClosure(structural.module, "main");
    expect(closure).toMatchObject({
      ok: true,
      closure: { constantOrder: expect.arrayContaining([0, constantCount - 1]) },
    });
  });

  it("should preserve pre-charge usage and memory state when a later event is rejected", () => {
    const probe = probeOracleBudgetCharges({
      schemaVersion: 1,
      budget: { ...BUDGET, effects: 1n },
      charges: [
        { dimension: "effects", amount: 1n },
        { dimension: "effects", amount: 1n },
      ],
    });
    expect(probe).toMatchObject({
      ok: false,
      rejectedChargeIndex: 1,
      usage: { effects: 1n },
      diagnostics: [{ code: "oracle.budget", path: "/charges/1/amount" }],
    });
    expect(
      probeOracleBudgetCharges({
        schemaVersion: 1,
        budget: BUDGET,
        charges: [{ dimension: "effects", amount: 0n }],
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid" }],
    });
    expect(createOracleBudgetMeter(BUDGET).charge("effects", 0n, "/amount")).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid" }],
    });
    expect(probeOracleBudgetCharges({ schemaVersion: 2 })).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid" }],
    });
    expect(
      probeOracleBudgetCharges({
        schemaVersion: 1,
        budget: { ...BUDGET, frames: 0n },
        charges: [],
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid", path: "/budget/frames" }],
    });
    expect(
      probeOracleBudgetCharges({
        schemaVersion: 1,
        budget: BUDGET,
        charges: [{ dimension: "unknown", amount: 1n }],
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid", path: "/charges/0" }],
    });

    const meter = createOracleBudgetMeter(BUDGET);
    const initial = createOracleMemoryState({
      schemaVersion: 1,
      cells: [{ address: 0x1000n, value: 1n }],
    });
    const rejected = writeOracleMemory(initial, 2, 0x1000n, 0xbeefn, meter, "/write");
    expect(rejected).toMatchObject({
      ok: true,
      outcome: "oracle-unmodeled",
    });
    expect([...initial.cells]).toEqual([[0x1000n, 1n]]);
    expect(initial.effects).toEqual([]);
  });

  it("should validate every memory-fixture boundary and charge effects transactionally", () => {
    const invalid = [
      {},
      { schemaVersion: 1, cells: [null] },
      { schemaVersion: 1, cells: [{ address: -1n, value: 0n }] },
      { schemaVersion: 1, cells: [{ address: 65_536n, value: 0n }] },
      { schemaVersion: 1, cells: [{ address: 0n, value: -1n }] },
      { schemaVersion: 1, cells: [{ address: 0n, value: 256n }] },
      {
        schemaVersion: 1,
        cells: [
          { address: 1n, value: 0n },
          { address: 1n, value: 0n },
        ],
      },
    ];
    for (const fixture of invalid) {
      expect(validateOracleMemoryFixture(fixture)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "oracle.input.invalid" }],
      });
    }

    const fixture = {
      schemaVersion: 1 as const,
      cells: [
        { address: 2n, value: 0x12n },
        { address: 3n, value: 0x34n },
      ],
    };
    const state = createOracleMemoryState(fixture);
    expect(readOracleMemory(state, 1, -1n, createOracleBudgetMeter(BUDGET), "/read")).toMatchObject(
      {
        ok: true,
        outcome: "oracle-unmodeled",
      },
    );
    expect(
      readOracleMemory(
        state,
        2,
        2n,
        createOracleBudgetMeter({ ...BUDGET, evaluationSteps: 1n }),
        "/read",
      ),
    ).toMatchObject({ ok: false, diagnostics: [{ code: "oracle.budget" }] });

    const effectMeter = createOracleBudgetMeter({ ...BUDGET, effects: 1n });
    const first = readOracleMemory(state, 1, 2n, effectMeter, "/read");
    expect(first).toMatchObject({ ok: true, value: 0x12n });
    if (!first.ok || "outcome" in first) return;
    expect(readOracleMemory(first.state, 1, 2n, effectMeter, "/read")).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.budget" }],
    });

    const written = writeOracleMemory(
      state,
      2,
      2n,
      0xbeefn,
      createOracleBudgetMeter(BUDGET),
      "/write",
    );
    expect(written).toMatchObject({ ok: true });
    if (!written.ok || "outcome" in written) return;
    expect(projectOracleMemory(written.state)).toEqual([
      { address: 2n, value: 0xefn },
      { address: 3n, value: 0xben },
    ]);

    const writeMeter = createOracleBudgetMeter({ ...BUDGET, effects: 1n });
    const firstWrite = writeOracleMemory(state, 1, 2n, 1n, writeMeter, "/write");
    expect(firstWrite).toMatchObject({ ok: true });
    if (!firstWrite.ok || "outcome" in firstWrite) return;
    expect(writeOracleMemory(firstWrite.state, 1, 2n, 2n, writeMeter, "/write")).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.budget" }],
    });
    expect(
      projectOracleMemory(
        Object.freeze({
          cells: new Map([
            [2n, 2n],
            [1n, 1n],
            [3n, 3n],
          ]),
          effects: Object.freeze([]),
        }),
      ),
    ).toEqual([
      { address: 1n, value: 1n },
      { address: 2n, value: 2n },
      { address: 3n, value: 3n },
    ]);
  });

  it("should keep local-state updates immutable and reject declaration collisions", () => {
    const state = createOracleEvaluationState(new Map(), new Map());
    const value = Object.freeze({
      kind: "integer" as const,
      type: "byte" as const,
      value: 1n,
    });
    const first = declareOracleLocal(state, "local", "byte", value, "/local");
    expect(first.ok).toBe(true);
    expect(state.frame.size).toBe(0);
    if (!first.ok) return;
    expect(declareOracleLocal(first.state, "local", "byte", value, "/local")).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid" }],
    });
    expect(declareOracleLocal(state, "wrong", "word", value, "/local")).toMatchObject({
      ok: false,
    });
    expect(assignOracleStateValue(state, "missing", value, "/assign")).toMatchObject({
      ok: false,
    });
    expect(assignOracleStateValue(first.state, "local", value, "/assign")).toMatchObject({
      ok: true,
      state: { frame: expect.any(Map) },
    });

    const checked = validateGeneratorIrSyntax({
      kind: "module",
      path: ["impl"],
      constants: [],
      functions: [
        {
          kind: "function",
          name: "main",
          parameters: [{ name: "flag", type: "boolean" }],
          returnType: "void",
          body: [],
        },
      ],
    });
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    const fn = checked.module.functions[0];
    if (fn === undefined) return;
    expect(createOracleEntryFrame(fn, 0, [], createOracleBudgetMeter(BUDGET))).toMatchObject({
      ok: false,
    });
    expect(
      createOracleEntryFrame(
        fn,
        0,
        [{ kind: "parameter-value", parameterPath: "/wrong", value: true }],
        createOracleBudgetMeter(BUDGET),
      ),
    ).toMatchObject({ ok: false });
    expect(
      createOracleEntryFrame(
        fn,
        0,
        [
          {
            kind: "parameter-value",
            parameterPath: "/functions/0/parameters/0",
            value: 1n,
          },
        ],
        createOracleBudgetMeter(BUDGET),
      ),
    ).toMatchObject({ ok: false });
    expect(
      createOracleEntryFrame(
        fn,
        0,
        [
          {
            kind: "parameter-value",
            parameterPath: "/functions/0/parameters/0",
            value: true,
          },
        ],
        createOracleBudgetMeter({ ...BUDGET, frames: 1n }),
      ),
    ).toMatchObject({ ok: true });
  });

  it("should classify invalid scalar dispatch and a void fallthrough without throwing", () => {
    expect(
      evaluateOracleBinaryOperation(
        "+",
        "word",
        Object.freeze({ kind: "integer", type: "sbyte", value: -1n }),
        Object.freeze({ kind: "integer", type: "word", value: 1n }),
      ),
    ).toEqual({ kind: "unmodeled", reason: "unsupported-semantics" });
    expect(evaluateOracleProgram(program("void", []))).toMatchObject({
      ok: true,
      outcome: "modeled",
      observation: { returnValue: null },
    });
    expect(
      evaluateOracleProgram({
        ...program("void", []),
        budget: { ...BUDGET, frames: 0n },
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid", path: "/budget/frames" }],
    });
    const integer = Object.freeze({
      kind: "integer" as const,
      type: "byte" as const,
      value: 1n,
    });
    const boolean = Object.freeze({
      kind: "boolean" as const,
      type: "boolean" as const,
      value: true,
    });
    expect(evaluateOracleUnaryOperation("!", "byte", integer)).toMatchObject({
      kind: "unmodeled",
    });
    expect(evaluateOracleUnaryOperation("-", "byte", integer)).toMatchObject({
      kind: "unmodeled",
    });
    expect(evaluateOracleUnaryOperation("~", "boolean", boolean)).toMatchObject({
      kind: "unmodeled",
    });
    expect(evaluateOracleBinaryOperation("+", "boolean", boolean, boolean)).toMatchObject({
      kind: "unmodeled",
    });
    expect(
      evaluateOracleBinaryOperation(
        ">>",
        "word",
        integer,
        Object.freeze({ ...integer, value: -1n }),
      ),
    ).toMatchObject({ kind: "unmodeled" });
    expect(evaluateOracleBinaryOperation("==", "byte", integer, integer)).toMatchObject({
      kind: "unmodeled",
    });
    expect(evaluateOracleBinaryOperation("+", "word", integer, integer)).toMatchObject({
      kind: "unmodeled",
    });
    expect(
      evaluateOracleBinaryOperation(
        "/",
        "byte",
        Object.freeze({ ...integer, value: 7n }),
        Object.freeze({ ...integer, value: 2n }),
      ),
    ).toMatchObject({ kind: "value", value: { value: 3n } });
    expect(evaluateOracleBinaryOperation("==", "boolean", integer, integer)).toMatchObject({
      kind: "value",
      value: { value: true },
    });
    expect(
      evaluateOracleBinaryOperation(
        "!=",
        "boolean",
        integer,
        Object.freeze({ ...integer, value: 2n }),
      ),
    ).toMatchObject({ kind: "value", value: { value: true } });
    expect(
      evaluateOracleBinaryOperation("%", "byte", integer, Object.freeze({ ...integer, value: 0n })),
    ).toMatchObject({
      kind: "unmodeled",
      reason: "blocked-errata-division-by-zero",
    });
    expect(evaluateOracleBinaryOperation("==", "boolean", boolean, boolean)).toMatchObject({
      kind: "value",
      value: { value: true },
    });

    expect(validateOracleBudget(null)).toMatchObject({ ok: false });
    expect(validateOracleBudget({ ...BUDGET, effects: 1 })).toMatchObject({
      ok: false,
    });
    expect(
      validateOracleBudget({
        ...BUDGET,
        evaluationSteps: 4_294_967_296n,
      }),
    ).toMatchObject({ ok: false });
  });

  it("should enforce evaluator budget dimensions before committing later work", () => {
    const cases = [
      {
        input: {
          ...returned("byte", literal("byte", 1n)),
          budget: { ...BUDGET, inputNodes: 1n },
        },
        path: "/module",
      },
      {
        input: {
          ...returned("byte", binary("byte", "-", literal("byte", 2n), literal("byte", 1n))),
          budget: { ...BUDGET, expressionDepth: 1n },
        },
        path: "/module",
      },
      {
        input: {
          ...returned("byte", literal("byte", 1n)),
          budget: { ...BUDGET, evaluationSteps: 1n },
        },
        path: "/functions/0/body/0/value",
      },
      {
        input: {
          ...returned("byte", literal("byte", 1n)),
          memory: {
            schemaVersion: 1,
            cells: [
              { address: 0n, value: 0n },
              { address: 1n, value: 0n },
            ],
          },
          budget: { ...BUDGET, memoryCells: 1n },
        },
        path: "/memory/cells",
      },
    ] as const;

    for (const testCase of cases) {
      expect(evaluateOracleProgram(testCase.input)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "oracle.budget", path: testCase.path }],
      });
    }
  });

  it("should close malformed program members before evaluator state exists", () => {
    const base = program("void", []);
    const malformed = [
      null,
      { ...base, schemaVersion: 2 },
      { ...base, entryFunction: "-" },
      { ...base, module: null },
      { ...base, memory: null },
      { ...base, parameterBindings: null },
      { ...base, parameterBindings: [null] },
      {
        ...base,
        parameterBindings: [
          { kind: "parameter-value", parameterPath: "/parameter", value: "wrong" },
        ],
      },
    ];

    for (const input of malformed) {
      expect(evaluateOracleProgram(input)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "oracle.input.invalid" }],
      });
    }
  });
});
