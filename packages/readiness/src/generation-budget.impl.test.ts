import { describe, expect, it } from "vitest";

import { createGenerationBudgetTracker, validateGenerationBudget } from "./generation-budget.js";
import type {
  GenModule,
  GenerationBudget,
  GenerationBudgetDimension,
  GenerationBudgetTracker,
} from "./generator-ir.js";
import { validateGeneratorIr } from "./generator-ir-validator.js";

const BUDGET: GenerationBudget = {
  maxModules: 4,
  maxDeclarations: 16,
  maxIrNodes: 64,
  maxStatements: 32,
  maxExpressionDepth: 8,
  maxLoopWork: 16n,
  maxSourceBytes: 256,
  maxAttempts: 32,
};

const SIMPLE_INPUT = {
  kind: "module",
  path: ["BudgetFixture"],
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
} as const;

function validatedModule(input: unknown): GenModule {
  const result = validateGeneratorIr(input);
  if (!result.ok) throw new TypeError("Test fixture must be a valid generator module.");
  return result.module;
}

const SIMPLE_MODULE = validatedModule(SIMPLE_INPUT);

const SIMPLE_USAGE = {
  modules: 1,
  declarations: 1,
  "ir-nodes": 3,
  statements: 1,
  "expression-depth": 0,
  "loop-work": 0n,
  "source-bytes": 8,
  attempts: 1,
} as const;

function seed(
  tracker: GenerationBudgetTracker,
  usage: Readonly<Record<GenerationBudgetDimension, number | bigint>> = SIMPLE_USAGE,
): void {
  for (const [dimension, amount] of Object.entries(usage)) {
    const result = tracker.consume(dimension as GenerationBudgetDimension, amount);
    expect(result.ok).toBe(true);
  }
}

describe("generation budget validation", () => {
  it("returns a defensive immutable budget snapshot", () => {
    const input = { ...BUDGET };
    const result = validateGenerationBudget(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    input.maxModules = 99;
    expect(result.budget.maxModules).toBe(4);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.budget)).toBe(true);
  });

  it.each([
    [{ ...BUDGET, extra: 1 }, "/budget"],
    [{ ...BUDGET, maxModules: 0 }, "/budget/maxModules"],
    [{ ...BUDGET, maxAttempts: 1.5 }, "/budget/maxAttempts"],
    [{ ...BUDGET, maxLoopWork: -1n }, "/budget/maxLoopWork"],
    [Object.defineProperty({ ...BUDGET }, "maxModules", { get: () => 4 }), "/budget/maxModules"],
  ])("rejects invalid closed budgets %#", (input, path) => {
    expect(validateGenerationBudget(input)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "generation-input-invalid", path }],
    });
  });
});

describe("generation budget tracker", () => {
  it("finalizes only when every incremental dimension matches the independent recount", () => {
    const tracker = createGenerationBudgetTracker(BUDGET);
    seed(tracker);

    const result = tracker.finalize(SIMPLE_MODULE, 8, 1);
    expect(result).toEqual({
      ok: true,
      usage: {
        modules: 1n,
        declarations: 1n,
        "ir-nodes": 3n,
        statements: 1n,
        "expression-depth": 0n,
        "loop-work": 0n,
        "source-bytes": 8n,
        attempts: 1n,
      },
      diagnostics: [],
    });
  });

  it.each([
    "modules",
    "declarations",
    "ir-nodes",
    "statements",
    "expression-depth",
    "loop-work",
    "source-bytes",
    "attempts",
  ] as const)("reports a stable invariant path when %s does not match", (dimension) => {
    const tracker = createGenerationBudgetTracker(BUDGET);
    const mismatched = { ...SIMPLE_USAGE, [dimension]: dimension === "loop-work" ? 1n : 2 };
    seed(tracker, mismatched);
    const before = tracker.snapshot();

    expect(tracker.finalize(SIMPLE_MODULE, 8, 1)).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "generation-invariant",
          path: `/usage/${dimension}`,
          dimension,
        },
      ],
    });
    expect(tracker.snapshot()).toEqual(before);
  });

  it("recounts all expression and statement forms without trusting incremental totals", () => {
    const module = validatedModule({
      kind: "module",
      path: ["ComplexBudget"],
      constants: [
        {
          kind: "const",
          name: "address",
          type: "word",
          value: { kind: "literal", type: "word", value: 49_152n },
        },
      ],
      functions: [
        {
          kind: "function",
          name: "main",
          parameters: [{ name: "input", type: "byte" }],
          returnType: "byte",
          body: [
            {
              kind: "local",
              name: "value",
              type: "byte",
              initializer: {
                kind: "binary",
                type: "byte",
                operator: "+",
                left: {
                  kind: "unary",
                  type: "byte",
                  operator: "~",
                  operand: { kind: "name", type: "byte", name: "input" },
                },
                right: {
                  kind: "memory-read",
                  type: "byte",
                  width: 1,
                  address: { kind: "name", type: "word", name: "address" },
                },
              },
            },
            {
              kind: "assign",
              target: "value",
              value: { kind: "literal", type: "byte", value: 1n },
            },
            {
              kind: "memory-write",
              width: 1,
              address: { kind: "name", type: "word", name: "address" },
              value: { kind: "name", type: "byte", name: "value" },
            },
            {
              kind: "return",
              value: { kind: "name", type: "byte", name: "value" },
            },
          ],
        },
      ],
    });
    const tracker = createGenerationBudgetTracker(BUDGET);
    seed(tracker, {
      modules: 1,
      declarations: 3,
      "ir-nodes": 18,
      statements: 4,
      "expression-depth": 3,
      "loop-work": 0n,
      "source-bytes": 64,
      attempts: 2,
    });

    expect(tracker.finalize(module, 64, 2)).toMatchObject({ ok: true });
  });

  it("validates final scalar inputs and completed module structure without mutation", () => {
    const tracker = createGenerationBudgetTracker(BUDGET);
    seed(tracker);
    const before = tracker.snapshot();

    expect(tracker.finalize(SIMPLE_MODULE, -1, 1)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "generation-input-invalid", path: "/sourceBytes" }],
    });
    expect(tracker.finalize(SIMPLE_MODULE, 8, Number.NaN)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "generation-input-invalid", path: "/attempts" }],
    });
    expect(
      Reflect.apply(tracker.finalize, tracker, [{ ...SIMPLE_MODULE, path: [] }, 8, 1]),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "generation-invariant", path: "/usage/ir-nodes" }],
    });
    expect(tracker.snapshot()).toEqual(before);
  });

  it("checks final limits before invariant comparison", () => {
    const tracker = createGenerationBudgetTracker({ ...BUDGET, maxSourceBytes: 7 });
    seed(tracker, { ...SIMPLE_USAGE, "source-bytes": 7 });

    expect(tracker.finalize(SIMPLE_MODULE, 8, 1)).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "generation-budget",
          path: "/usage/source-bytes",
          dimension: "source-bytes",
        },
      ],
    });
  });

  it("keeps snapshots immutable, independent, and private", () => {
    const tracker = createGenerationBudgetTracker(BUDGET);
    const first = tracker.snapshot();
    expect(Object.isFrozen(tracker)).toBe(true);
    expect(Object.isFrozen(first)).toBe(true);

    expect(tracker.consume("modules", 1).ok).toBe(true);
    expect(first.modules).toBe(0n);
    expect(tracker.snapshot().modules).toBe(1n);
    expect(tracker).not.toHaveProperty("usage");
  });

  it("rejects unsupported dimensions and wrong numeric representations transactionally", () => {
    const tracker = createGenerationBudgetTracker(BUDGET);
    const before = tracker.snapshot();

    expect(tracker.consume("unknown" as GenerationBudgetDimension, 1)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "generation-input-invalid", path: "/dimension" }],
    });
    expect(tracker.consume("modules", 1n)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "generation-input-invalid", path: "/amount" }],
    });
    expect(tracker.snapshot()).toEqual(before);
  });

  it("uses checked BigInt addition at the maximum supported loop-work budget", () => {
    const maximum = (1n << 64n) - 1n;
    const tracker = createGenerationBudgetTracker({ ...BUDGET, maxLoopWork: maximum });

    expect(tracker.consume("loop-work", maximum)).toMatchObject({ ok: true });
    const before = tracker.snapshot();
    expect(tracker.consume("loop-work", 1n)).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "generation-budget",
          path: "/usage/loop-work",
          dimension: "loop-work",
        },
      ],
    });
    expect(tracker.snapshot()).toEqual(before);
  });

  it("turns an invalid runtime budget into a non-throwing rejecting tracker", () => {
    const tracker = createGenerationBudgetTracker({ ...BUDGET, maxModules: 0 });

    expect(tracker.consume("modules", 1)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "generation-input-invalid", path: "/budget/maxModules" }],
    });
    expect(tracker.finalize(SIMPLE_MODULE, 8, 1)).toMatchObject({ ok: false });
    expect(tracker.snapshot()).toEqual({
      modules: 0n,
      declarations: 0n,
      "ir-nodes": 0n,
      statements: 0n,
      "expression-depth": 0n,
      "loop-work": 0n,
      "source-bytes": 0n,
      attempts: 0n,
    });
  });
});
