import { describe, expect, it } from "vitest";

import { createBoundaryVariants } from "./boundary-variants.js";
import { createGenerationBudgetTracker, validateGenerationBudget } from "./generation-budget.js";

const BUDGET = {
  maxModules: 2,
  maxDeclarations: 3,
  maxIrNodes: 5,
  maxStatements: 4,
  maxExpressionDepth: 3,
  maxLoopWork: 2n,
  maxSourceBytes: 64,
  maxAttempts: 6,
} as const;

const DIMENSION_LIMITS = [
  ["modules", BUDGET.maxModules],
  ["declarations", BUDGET.maxDeclarations],
  ["ir-nodes", BUDGET.maxIrNodes],
  ["statements", BUDGET.maxStatements],
  ["expression-depth", BUDGET.maxExpressionDepth],
  ["loop-work", BUDGET.maxLoopWork],
  ["source-bytes", BUDGET.maxSourceBytes],
  ["attempts", BUDGET.maxAttempts],
] as const;

function emptyUsage() {
  return {
    modules: 0n,
    declarations: 0n,
    "ir-nodes": 0n,
    statements: 0n,
    "expression-depth": 0n,
    "loop-work": 0n,
    "source-bytes": 0n,
    attempts: 0n,
  };
}

function usageAt(dimension: (typeof DIMENSION_LIMITS)[number][0], amount: number | bigint) {
  return {
    ...emptyUsage(),
    [dimension]: BigInt(amount),
  };
}

describe("generation budgets", () => {
  it("accepts the closed budget shape with a BigInt loop-work limit", () => {
    expect(validateGenerationBudget(BUDGET)).toEqual({
      ok: true,
      budget: BUDGET,
      diagnostics: [],
    });
  });

  it.each(DIMENSION_LIMITS)(
    "accepts the exact %s limit and rejects the next unit",
    (dimension, limit) => {
      const tracker = createGenerationBudgetTracker(BUDGET);

      expect(tracker.consume(dimension, limit)).toEqual({
        ok: true,
        usage: usageAt(dimension, limit),
        diagnostics: [],
      });

      const beforeFailure = tracker.snapshot();
      const increment = dimension === "loop-work" ? 1n : 1;
      const result = tracker.consume(dimension, increment);

      expect(result).toMatchObject({
        ok: false,
        diagnostics: [
          {
            code: "generation-budget",
            path: `/usage/${dimension}`,
            dimension,
          },
        ],
      });
      expect(tracker.snapshot()).toEqual(beforeFailure);
    },
  );

  it.each([
    {
      field: "maxIrNodes",
      value: Number.MAX_SAFE_INTEGER + 1,
      path: "/budget/maxIrNodes",
    },
    {
      field: "maxSourceBytes",
      value: Number.POSITIVE_INFINITY,
      path: "/budget/maxSourceBytes",
    },
    {
      field: "maxLoopWork",
      value: Number.MAX_SAFE_INTEGER,
      path: "/budget/maxLoopWork",
    },
    {
      field: "maxLoopWork",
      value: 0n,
      path: "/budget/maxLoopWork",
    },
    {
      field: "maxLoopWork",
      value: 2n ** 4_096n,
      path: "/budget/maxLoopWork",
    },
  ])("rejects invalid or overflow-sized $field input", ({ field, value, path }) => {
    const result = validateGenerationBudget({ ...BUDGET, [field]: value });

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: "generation-input-invalid", path }],
    });
  });

  it.each([
    { dimension: "modules", amount: Number.MAX_SAFE_INTEGER + 1 },
    { dimension: "loop-work", amount: Number.MAX_SAFE_INTEGER },
    { dimension: "statements", amount: -1 },
  ] as const)(
    "rejects invalid $dimension consumption without changing usage",
    ({ dimension, amount }) => {
      const tracker = createGenerationBudgetTracker(BUDGET);
      const beforeFailure = tracker.snapshot();

      expect(tracker.consume(dimension, amount)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "generation-input-invalid", path: "/amount" }],
      });
      expect(tracker.snapshot()).toEqual(beforeFailure);
    },
  );

  it("rejects excessive BigInt loop work without partial consumption", () => {
    const tracker = createGenerationBudgetTracker(BUDGET);
    const beforeFailure = tracker.snapshot();

    expect(tracker.consume("loop-work", 2n ** 4_096n)).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "generation-budget",
          path: "/usage/loop-work",
          dimension: "loop-work",
        },
      ],
    });
    expect(tracker.snapshot()).toEqual(beforeFailure);
  });
});

const BOUNDARIES = [
  {
    type: "boolean",
    minimum: false,
    maximum: true,
    nearestBelow: undefined,
    nearestAbove: undefined,
  },
  {
    type: "byte",
    minimum: 0n,
    maximum: 255n,
    nearestBelow: -1n,
    nearestAbove: 256n,
  },
  {
    type: "sbyte",
    minimum: -128n,
    maximum: 127n,
    nearestBelow: -129n,
    nearestAbove: 128n,
  },
  {
    type: "word",
    minimum: 0n,
    maximum: 65_535n,
    nearestBelow: -1n,
    nearestAbove: 65_536n,
  },
  {
    type: "sword",
    minimum: -32_768n,
    maximum: 32_767n,
    nearestBelow: -32_769n,
    nearestAbove: 32_768n,
  },
] as const;

function expectedBoundaryVariants(boundary: (typeof BOUNDARIES)[number]) {
  return [
    { kind: "empty", type: boundary.type, value: null },
    { kind: "minimum", type: boundary.type, value: boundary.minimum },
    { kind: "maximum", type: boundary.type, value: boundary.maximum },
    ...(boundary.nearestBelow === undefined
      ? []
      : [
          {
            kind: "nearest-below",
            type: boundary.type,
            value: boundary.nearestBelow,
          },
        ]),
    ...(boundary.nearestAbove === undefined
      ? []
      : [
          {
            kind: "nearest-above",
            type: boundary.type,
            value: boundary.nearestAbove,
          },
        ]),
    {
      kind: "spelling",
      type: boundary.type,
      value: null,
      spelling: "const",
    },
    {
      kind: "spelling",
      type: boundary.type,
      value: null,
      spelling: "literal",
    },
    {
      kind: "spelling",
      type: boundary.type,
      value: null,
      spelling: "local",
    },
    {
      kind: "spelling",
      type: boundary.type,
      value: null,
      spelling: "parameter",
    },
    {
      kind: "nesting",
      type: boundary.type,
      value: null,
      nestingDepth: 0,
    },
    {
      kind: "nesting",
      type: boundary.type,
      value: null,
      nestingDepth: 1,
    },
    {
      kind: "nesting",
      type: boundary.type,
      value: null,
      nestingDepth: 2,
    },
  ];
}

function boundaryKey(variant: {
  readonly kind: string;
  readonly type: string;
  readonly value: bigint | boolean | null;
  readonly spelling?: string;
  readonly nestingDepth?: number;
}): string {
  const value =
    typeof variant.value === "bigint" ? `${variant.value.toString()}n` : String(variant.value);
  return [
    variant.kind,
    variant.type,
    value,
    variant.spelling ?? "",
    variant.nestingDepth?.toString() ?? "",
  ].join("|");
}

describe("boundary variants", () => {
  it.each(BOUNDARIES)("returns stable, typed, deduplicated $type boundaries", (boundary) => {
    const input = {
      type: boundary.type,
      spellings: ["parameter", "literal", "const", "literal", "local", "parameter"],
      minNestingDepth: 0,
      maxNestingDepth: 2,
      allowEmpty: true,
    } as const;
    const expected = expectedBoundaryVariants(boundary);

    const first = createBoundaryVariants(input);
    const second = createBoundaryVariants(input);

    expect(first).toEqual({
      ok: true,
      variants: expected,
      diagnostics: [],
    });
    expect(second).toEqual(first);
    if (first.ok) {
      expect(new Set(first.variants.map(boundaryKey)).size).toBe(first.variants.length);
      expect(Object.isFrozen(first.variants)).toBe(true);
      for (const variant of first.variants) {
        expect(Object.isFrozen(variant)).toBe(true);
      }
    }
  });
});
