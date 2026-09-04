import { describe, expect, it } from "vitest";

import { createGenerationBudgetTracker } from "./generation-budget.js";
import type { GenerationBudgetDimension } from "./generator-ir.js";
import { validateStructuredGeneratorProgram } from "./structured-ir-validation.js";
import { createStructuredGeneratedProgramsSpecFixture } from "./test-fixtures/structured-generated-programs-spec-fixture.js";

const fixture = createStructuredGeneratedProgramsSpecFixture();
const inheritedBudget = {
  maxModules: fixture.generationBudget.maxModules,
  maxDeclarations: fixture.generationBudget.maxDeclarations,
  maxIrNodes: fixture.generationBudget.maxIrNodes,
  maxStatements: fixture.generationBudget.maxStatements,
  maxExpressionDepth: fixture.generationBudget.maxExpressionDepth,
  maxLoopWork: fixture.generationBudget.maxLoopWork,
  maxSourceBytes: fixture.generationBudget.maxSourceBytes,
  maxAttempts: fixture.generationBudget.maxAttempts,
} as const;
const inheritedDimensions: readonly {
  readonly dimension: GenerationBudgetDimension;
  readonly limit: number | bigint;
}[] = [
  { dimension: "modules", limit: inheritedBudget.maxModules },
  { dimension: "declarations", limit: inheritedBudget.maxDeclarations },
  { dimension: "ir-nodes", limit: inheritedBudget.maxIrNodes },
  { dimension: "statements", limit: inheritedBudget.maxStatements },
  { dimension: "expression-depth", limit: inheritedBudget.maxExpressionDepth },
  { dimension: "loop-work", limit: inheritedBudget.maxLoopWork },
  { dimension: "source-bytes", limit: inheritedBudget.maxSourceBytes },
  { dimension: "attempts", limit: inheritedBudget.maxAttempts },
];

function expectFailure(
  module: unknown,
  expected: Readonly<Record<string, unknown>>,
  budget: unknown = fixture.generationBudget,
): void {
  const result = validateStructuredGeneratorProgram(module, budget);
  expect(result).toMatchObject({ ok: false, diagnostics: [expected] });
  expect(result).not.toHaveProperty("module");
  expect(result).not.toHaveProperty("usage");
}

describe("structured IR defensive closure", () => {
  it("rejects non-record, callable, symbolic, and sparse hostile inputs", () => {
    const sparse: unknown[] = Array.from({ length: 2 });
    sparse[0] = { kind: "module" };
    const hostile = [null, () => undefined, Symbol("module"), sparse] as const;

    for (const input of hostile) {
      expectFailure(input, { code: "generation-input-invalid", reason: "input-invalid" });
    }
  });

  it("does not invoke accessors while rejecting an accessor-backed shape", () => {
    let invoked = false;
    const input: Record<string, unknown> = {};
    Object.defineProperty(input, "kind", {
      enumerable: true,
      get: () => {
        invoked = true;
        return "module";
      },
    });

    expectFailure(input, {
      code: "generation-input-invalid",
      reason: "input-invalid",
      path: "/kind",
    });
    expect(invoked).toBe(false);
  });

  it("rejects a cyclic data tree before structural traversal", () => {
    const input: Record<string, unknown> = { kind: "module" };
    input.self = input;

    expectFailure(input, {
      code: "generation-input-invalid",
      reason: "input-invalid",
      path: "/self",
    });
  });

  it.each([
    {
      module: fixture.unsizedLocal,
      reason: "array-unsized-local",
      path: "/functions/0/body/0/extent",
    },
    {
      module: fixture.scalarAsStatement,
      reason: "call-context-invalid",
      path: "/functions/1/body/0",
    },
    {
      module: fixture.voidAsExpression,
      reason: "call-context-invalid",
      path: "/functions/1/body/0/value",
    },
    {
      module: fixture.arrayInScalarExpression,
      reason: "array-scalar-context-invalid",
      path: "/functions/0/body/1/value/left",
    },
    {
      module: fixture.callCycle,
      reason: "call-cycle",
      path: "/functions/0/body/0/callee",
    },
    {
      module: fixture.missingReturn,
      reason: "function-return-path-missing",
      path: "/functions/0/body",
    },
  ] as const)(
    "rejects a hostile semantic shape with reason $reason",
    ({ module, reason, path }) => {
      expectFailure(module, { reason, path });
    },
  );

  it.each([
    {
      module: fixture.arrayMismatches.element,
      reason: "array-parameter-element-mismatch",
      path: "/functions/1/body/1/arguments/0",
    },
    {
      module: fixture.arrayMismatches.extent,
      reason: "array-parameter-extent-mismatch",
      path: "/functions/1/body/1/arguments/0",
    },
    {
      module: fixture.arrayMismatches.access,
      reason: "array-parameter-access-mismatch",
      path: "/functions/1/body/1/arguments/0",
    },
    {
      module: fixture.invalidLoopCases.counterType,
      reason: "loop-counter-type",
      path: "/functions/0/body/0/counterType",
    },
    {
      module: fixture.invalidLoopCases.zeroStep,
      reason: "loop-step-invalid",
      path: "/functions/0/body/0/step",
    },
    {
      module: fixture.invalidLoopCases.bound,
      reason: "loop-bound-out-of-range",
      path: "/functions/0/body/0/end",
    },
  ] as const)("reports the exact type-closure reason $reason", ({ module, reason, path }) => {
    expectFailure(module, { code: "generation-type-invalid", reason, path });
  });
});

describe("structured generation budget edges", () => {
  it("accepts the exact statement depth and rejects the first deeper undispatched body", () => {
    const budget = { ...fixture.generationBudget, maxStatementDepth: 2 } as const;
    const exact = validateStructuredGeneratorProgram(fixture.exactDepth, budget);
    expect(exact).toMatchObject({
      ok: true,
      usage: { "statement-depth": 2n },
      diagnostics: [],
    });

    expectFailure(
      fixture.overDepth,
      {
        code: "generation-budget",
        reason: "statement-depth-exceeded",
        dimension: "statement-depth",
        path: "/functions/0/body/0/thenBody/0/thenBody/0",
      },
      budget,
    );
  });

  it.each(inheritedDimensions)(
    "accepts exact inherited $dimension usage and atomically rejects the next unit",
    ({ dimension, limit }) => {
      const tracker = createGenerationBudgetTracker(inheritedBudget);
      expect(tracker.consume(dimension, limit)).toMatchObject({ ok: true, diagnostics: [] });
      const exact = tracker.snapshot();
      const increment = dimension === "loop-work" ? 1n : 1;

      expect(tracker.consume(dimension, increment)).toMatchObject({
        ok: false,
        diagnostics: [
          {
            code: "generation-budget",
            dimension,
            path: `/usage/${dimension}`,
          },
        ],
      });
      expect(tracker.snapshot()).toEqual(exact);
    },
  );

  it("checks exact construction usage and the first excess for populated dimensions", () => {
    const baseline = validateStructuredGeneratorProgram(
      fixture.fixedArray,
      fixture.generationBudget,
    );
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) throw new TypeError("expected baseline structured usage");

    const fields = [
      ["maxDeclarations", "declarations"],
      ["maxIrNodes", "ir-nodes"],
      ["maxStatements", "statements"],
      ["maxExpressionDepth", "expression-depth"],
    ] as const;
    for (const [field, dimension] of fields) {
      const exactLimit = Number(baseline.usage[dimension]);
      expect(
        validateStructuredGeneratorProgram(fixture.fixedArray, {
          ...fixture.generationBudget,
          [field]: exactLimit,
        }),
      ).toMatchObject({ ok: true, diagnostics: [] });
      expectFailure(
        fixture.fixedArray,
        {
          code: "generation-budget",
          reason: "budget-exceeded",
          dimension,
          path: `/usage/${dimension}`,
        },
        { ...fixture.generationBudget, [field]: exactLimit - 1 },
      );
    }
  });

  it("distinguishes static loop-work exhaustion from target array resource exhaustion", () => {
    expectFailure(
      fixture.loopThree,
      {
        code: "generation-budget",
        reason: "loop-work-exceeded",
        dimension: "loop-work",
        path: "/functions/0/body/1",
      },
      { ...fixture.generationBudget, maxLoopWork: 2n },
    );
    expectFailure(fixture.extentCases.byteOver, {
      code: "generation-budget",
      reason: "array-extent-resource-limit",
      path: "/functions/0/body/0/extent",
    });
  });
});
