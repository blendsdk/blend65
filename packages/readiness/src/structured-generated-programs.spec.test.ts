import { beforeEach, describe, expect, it } from "vitest";

import { runWithOracleMutationVariant } from "./oracle-conformance-v1.js";
import { createOracleEvaluatorSpecFixture } from "./test-fixtures/oracle-evaluator-spec-fixture.js";
import { createStructuredGeneratedProgramsSpecFixture } from "./test-fixtures/structured-generated-programs-spec-fixture.js";
import { validateGeneratorIr } from "./generator-ir-validator.js";
import { renderSourceModule } from "./source-renderer.js";

const fixture = createStructuredGeneratedProgramsSpecFixture();
const { booleanValue, integerValue, modeledValue } = createOracleEvaluatorSpecFixture();
const RENDER_OPTIONS = { maxSourceBytes: 1_048_576, literalSpellings: [] } as const;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;

async function loadPlannedApi() {
  const [validation, oracle] = await Promise.all([
    import("./structured-ir-validation.js"),
    import("./structured-oracle-evaluator.js"),
  ]);
  return {
    validateStructuredGeneratorProgram: validation.validateStructuredGeneratorProgram,
    evaluateStructuredOracleProgram: oracle.evaluateStructuredOracleProgram,
  };
}

let plannedApi: Awaited<ReturnType<typeof loadPlannedApi>>;

beforeEach(async () => {
  plannedApi = await loadPlannedApi();
});

function requireIr(input: unknown) {
  const result = validateGeneratorIr(input);
  expect(result).toMatchObject({ ok: true, diagnostics: [] });
  if (!result.ok) throw new TypeError("expected closed generator input");
  return result.module;
}

function requireStructured(input: unknown, generationBudget = fixture.generationBudget) {
  const result = plannedApi.validateStructuredGeneratorProgram(input, generationBudget);
  expect(result).toMatchObject({ ok: true, diagnostics: [] });
  if (!result.ok) throw new TypeError("expected a valid structured program");
  return result;
}

function render(input: unknown): string {
  const result = renderSourceModule(requireIr(input), RENDER_OPTIONS);
  expect(result).toMatchObject({ ok: true, diagnostics: [] });
  if (!result.ok) throw new TypeError("expected canonical structured source");
  return result.source;
}

function oracleInput(
  module: unknown,
  entryFunction = "main",
  parameterBindings: readonly object[] = [],
  additions: Readonly<Record<string, unknown>> = {},
) {
  return {
    schemaVersion: 2,
    handlerId: "oracle.structured-program",
    module,
    entryFunction,
    parameterBindings,
    memory: { schemaVersion: 1, cells: [] },
    generationBudget: fixture.generationBudget,
    budget: fixture.oracleBudget,
    expectationAuthority: "independent-structured-oracle-v2",
    ...additions,
  } as const;
}

function requireModeled(input: ReturnType<typeof oracleInput>) {
  const result = plannedApi.evaluateStructuredOracleProgram(input);
  expect(result).toMatchObject({ ok: true, outcome: "modeled", diagnostics: [] });
  if (!result.ok || result.outcome !== "modeled") {
    throw new TypeError("expected an independently modeled structured program");
  }
  expect(result.evaluationIdentity).toMatch(SHA256);
  return result;
}

function parameterBinding(parameterPath: string, value: bigint | boolean) {
  return { kind: "parameter-value", parameterPath, value } as const;
}

function expectStructuredFailure(
  module: unknown,
  expected: Readonly<Record<string, unknown>>,
  generationBudget = fixture.generationBudget,
): void {
  const result = plannedApi.validateStructuredGeneratorProgram(module, generationBudget);
  expect(result).toMatchObject({ ok: false, diagnostics: [expected] });
  expect(result).not.toHaveProperty("module");
  expect(result).not.toHaveProperty("usage");
}

function mutation(operationId: string, pathId: string, variantId: string) {
  return { operationId, pathId, variantId };
}

describe("structured arrays", () => {
  // A fixed array must retain its declared elements through closure, source, and independent evaluation.
  it("validates, renders, and independently evaluates a fixed byte array index", () => {
    const validated = requireStructured(fixture.fixedArray);
    expect(validated.module).toEqual(fixture.fixedArray);
    expect(render(fixture.fixedArray)).toContain("let values: byte[4] = [1, 2, 3, 4];");
    expect(render(fixture.fixedArray)).toContain("return values[2];");

    const result = requireModeled(oracleInput(fixture.fixedArray));
    expect(result.observation).toEqual(modeledValue(integerValue("byte", 3n)).observation);
    expect(result.arrayAccessTrace).toMatchObject([
      { expressionPath: "/functions/0/body/1/value", arrayName: "values", index: 2n },
    ]);
    expect(result.loopTrace).toEqual([]);
    expect(result).not.toHaveProperty("arrayPlacementIdentity");
  });

  // A compile-time index equal to the extent is an invalid neighbor, never a passing case.
  it("rejects a constant index at the fixed extent as the named invalid neighbor", () => {
    expectStructuredFailure(fixture.constantOutOfBounds, {
      code: "neighbor-invalid",
      reason: "array-constant-index-out-of-range",
      path: "/functions/0/body/1/value/index",
      diagnosticFamily: "array-index-constant-out-of-range",
    });
    expect(
      plannedApi.evaluateStructuredOracleProgram(oracleInput(fixture.constantOutOfBounds)),
    ).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "neighbor-invalid",
          reason: "array-constant-index-out-of-range",
          diagnosticFamily: "array-index-constant-out-of-range",
        },
      ],
    });
  });

  // Computed addresses wrap at 16 bits, while placement remains oracle-only identity material.
  it("binds computed address wrapping to oracle identity without rendering placement", () => {
    const placement = {
      revision: "structured-array-placement-v1",
      bindings: [{ arrayName: "values", baseAddress: 0xfff0 }],
    } as const;
    requireStructured(fixture.computedOutOfBounds);
    const source = render(fixture.computedOutOfBounds);
    const input = oracleInput(
      fixture.computedOutOfBounds,
      "read",
      [parameterBinding("/functions/0/parameters/0", 0x20n)],
      {
        arrayPlacement: placement,
        memory: { schemaVersion: 1, cells: [{ address: 0x10n, value: 0x5an }] },
      },
    );
    const result = requireModeled(input);

    expect(result.arrayAccessTrace).toMatchObject([
      { arrayName: "values", index: 0x20n, effectiveAddress: 0x10n },
    ]);
    expect(result.arrayPlacementIdentity).toMatch(SHA256);
    expect(source).not.toContain("structured-array-placement-v1");
    expect(source).not.toContain("65520");
    expect(source).not.toContain("$FFF0");
  });

  // Word indexing scales by two before the address wraps; omitting that scale selects a different word.
  it("kills omitted word-index scaling while retaining 16-bit address wrapping", async () => {
    requireStructured(fixture.scaledWordArray);
    const input = oracleInput(
      fixture.scaledWordArray,
      "read",
      [parameterBinding("/functions/0/parameters/0", 0x81n)],
      {
        arrayPlacement: {
          revision: "structured-array-placement-v1",
          bindings: [{ arrayName: "values", baseAddress: 0xfff0 }],
        },
        memory: {
          schemaVersion: 1,
          cells: [
            { address: 0x71n, value: 0xcdn },
            { address: 0x72n, value: 0xabn },
            { address: 0xf2n, value: 0x34n },
            { address: 0xf3n, value: 0x12n },
          ],
        },
      },
    );
    const baseline = requireModeled(input);
    expect(baseline).toMatchObject({
      observation: {
        returnValue: integerValue("word", 0x1234n),
        effects: [{ kind: "read", address: 0xf2n, width: 2, value: 0x1234n }],
      },
      arrayAccessTrace: [{ arrayName: "values", index: 0x81n, effectiveAddress: 0xf2n }],
    });

    const unscaled = await runWithOracleMutationVariant(
      mutation("oracle.structured-program", "oracle.structured.index-address", "unscaled-index-v1"),
      () => plannedApi.evaluateStructuredOracleProgram(input),
    );
    expect(unscaled).toMatchObject({
      ok: true,
      outcome: "modeled",
      observation: {
        returnValue: integerValue("word", 0xabcdn),
        effects: [{ kind: "read", address: 0x71n, width: 2, value: 0xabcdn }],
      },
      arrayAccessTrace: [{ arrayName: "values", index: 0x81n, effectiveAddress: 0x71n }],
    });
  });

  // Array index widths are chosen from total bytes, with the 256-byte boundary in Tier 1.
  it("enforces the exact sized-array index tiers and accepts either unsigned unsized width", () => {
    requireStructured(fixture.indexTiers.tier1Byte);
    requireStructured(fixture.indexTiers.tier2Word);
    requireStructured(fixture.indexTiers.unsizedIndexWidths);
    expectStructuredFailure(fixture.indexTiers.tier1Word, {
      code: "generation-type-invalid",
      reason: "array-index-tier-mismatch",
      path: "/functions/0/body/1/value/index",
      diagnosticFamily: "array-index-byte-required",
      expectedCompilerDiagnosticCode: "E10117",
    });
    expectStructuredFailure(fixture.indexTiers.tier2Byte, {
      code: "generation-type-invalid",
      reason: "array-index-tier-mismatch",
      path: "/functions/0/body/1/value/index",
      diagnosticFamily: "array-index-word-required",
      expectedCompilerDiagnosticCode: "E10118",
    });
  });

  // An empty initializer preserves its positive extent; a zero extent is a distinct source error.
  it("distinguishes an illegal zero extent from a legal retained empty initializer", () => {
    expectStructuredFailure(fixture.zeroExtent, {
      code: "neighbor-invalid",
      reason: "array-size-zero",
      path: "/functions/0/body/0/extent",
      diagnosticFamily: "array-size-at-least-one",
      expectedCompilerDiagnosticCode: "E10111",
    });
    requireStructured(fixture.retainedEmptyExtent);
    expect(render(fixture.retainedEmptyExtent)).toContain("let values: byte[4] = [];");
  });

  // Only array parameters may omit an extent, and const unsized parameters still read caller data.
  it("renders and evaluates an unsized const parameter while rejecting an unsized local", () => {
    requireStructured(fixture.firstUnsized);
    const source = render(fixture.firstUnsized);
    expect(source).toContain("data: const byte[]");
    expect(source).toContain("return data[i];");
    expect(requireModeled(oracleInput(fixture.firstUnsized)).observation).toEqual(
      modeledValue(integerValue("byte", 3n)).observation,
    );

    expectStructuredFailure(fixture.unsizedLocal, {
      code: "generation-input-invalid",
      reason: "array-unsized-local",
      path: "/functions/0/body/0/extent",
      diagnosticFamily: "array-local-requires-fixed-extent",
    });
  });

  // Arrays may occupy at most 65,535 target bytes, with the first larger extent rejected early.
  it("accepts exact C64 array resource maxima and bounds the next extent", () => {
    requireStructured(fixture.extentCases.byteMaximum);
    requireStructured(fixture.extentCases.wordMaximum);
    for (const over of [fixture.extentCases.byteOver, fixture.extentCases.wordOver]) {
      expectStructuredFailure(over, {
        code: "generation-budget",
        reason: "array-extent-resource-limit",
        path: "/functions/0/body/0/extent",
      });
    }
  });
});

describe("structured type, access, and nesting closure", () => {
  // Conditions are boolean and every scalar-returning path must produce a value.
  it("returns exact condition and return-path diagnostic evidence while valid neighbors pass", () => {
    for (const invalid of fixture.invalidConditionCases) {
      expectStructuredFailure(invalid, {
        code: "generation-type-invalid",
        reason: "condition-not-boolean",
        path: "/functions/0/body/0/condition",
        diagnosticFamily: "condition-boolean",
        expectedCompilerDiagnosticCode: "E10100",
      });
    }
    requireStructured(fixture.validBooleanCondition);
    expectStructuredFailure(fixture.missingReturn, {
      code: "generation-type-invalid",
      reason: "function-return-path-missing",
      path: "/functions/0/body",
      diagnosticFamily: "all-code-paths-return",
      expectedCompilerDiagnosticCode: "E10102",
    });
    requireStructured(fixture.allPathsReturn);
  });

  // Mutable array parameters alias caller storage instead of copying elements into a new frame.
  it("aliases mutable array parameters to caller storage and detects copying", async () => {
    requireStructured(fixture.mutableArray);
    const source = render(fixture.mutableArray);
    expect(source).toContain("data: byte[]");
    expect(source).toContain("data[1] = 9;");
    expect(source).toContain("change(values);");
    const baseline = requireModeled(oracleInput(fixture.mutableArray));
    expect(baseline.observation).toEqual(modeledValue(integerValue("byte", 9n)).observation);

    const copied = await runWithOracleMutationVariant(
      mutation(
        "oracle.structured-program",
        "oracle.structured.array-parameter",
        "copy-argument-v1",
      ),
      () => plannedApi.evaluateStructuredOracleProgram(oracleInput(fixture.mutableArray)),
    );
    expect(copied).not.toEqual(baseline);
  });

  // Array access, element type, and fixed extent compatibility are checked before evaluation.
  it("rejects const writes and array element, extent, and access mismatches before evaluation", () => {
    const cases = [
      {
        module: fixture.constArrayWrite,
        expected: {
          code: "generation-type-invalid",
          reason: "array-const-write",
          path: "/functions/0/body/0/target",
          diagnosticFamily: "const-array-parameter-write",
          expectedCompilerDiagnosticCode: "E10123",
        },
      },
      {
        module: fixture.arrayMismatches.element,
        expected: {
          code: "generation-type-invalid",
          reason: "array-parameter-element-mismatch",
          path: "/functions/1/body/1/arguments/0",
          diagnosticFamily: "array-parameter-element-type",
        },
      },
      {
        module: fixture.arrayMismatches.extent,
        expected: {
          code: "generation-type-invalid",
          reason: "array-parameter-extent-mismatch",
          path: "/functions/1/body/1/arguments/0",
          diagnosticFamily: "array-parameter-fixed-extent",
        },
      },
      {
        module: fixture.arrayMismatches.access,
        expected: {
          code: "generation-type-invalid",
          reason: "array-parameter-access-mismatch",
          path: "/functions/1/body/1/arguments/0",
          diagnosticFamily: "const-array-to-mutable-parameter",
          expectedCompilerDiagnosticCode: "E10122",
        },
      },
    ];
    for (const vector of cases) {
      expectStructuredFailure(vector.module, vector.expected);
      expect(plannedApi.evaluateStructuredOracleProgram(oracleInput(vector.module))).toMatchObject({
        ok: false,
        diagnostics: [vector.expected],
      });
    }
  });

  // Every scalar type is legal in a direct parameter and scalar return position.
  it("renders and evaluates every scalar parameter and return representation", () => {
    requireStructured(fixture.scalarSignatures);
    const source = render(fixture.scalarSignatures);
    const vectors = [
      { type: "boolean", value: true, expected: booleanValue(true) },
      { type: "byte", value: 255n, expected: integerValue("byte", 255n) },
      { type: "sbyte", value: -128n, expected: integerValue("sbyte", -128n) },
      { type: "word", value: 65_535n, expected: integerValue("word", 65_535n) },
      { type: "sword", value: -32_768n, expected: integerValue("sword", -32_768n) },
    ] as const;
    for (const [index, vector] of vectors.entries()) {
      expect(source).toContain(`value: ${vector.type}`);
      const result = requireModeled(
        oracleInput(fixture.scalarSignatures, `identity${vector.type}`, [
          parameterBinding(`/functions/${index}/parameters/0`, vector.value),
        ]),
      );
      expect(result.observation).toEqual(modeledValue(vector.expected).observation);
    }
  });

  // A void function is callable only as a statement, including the zero-argument form.
  it("keeps zero-argument void calls in statement context", () => {
    requireStructured(fixture.voidCall);
    expect(render(fixture.voidCall)).toContain("noop();");
    expect(requireModeled(oracleInput(fixture.voidCall))).toMatchObject({
      observation: { kind: "value-state" },
      loopTrace: [],
      arrayAccessTrace: [],
    });
  });

  // Scalar calls, void calls, and array references cannot cross their declared expression contexts.
  it.each([
    [fixture.scalarAsStatement, "call-context-invalid", "/functions/1/body/0"],
    [fixture.voidAsExpression, "call-context-invalid", "/functions/1/body/0/value"],
    [
      fixture.arrayInScalarExpression,
      "array-scalar-context-invalid",
      "/functions/0/body/1/value/left",
    ],
  ] as const)(
    "rejects an expression or statement in the wrong call/array context",
    (input, reason, path) => {
      expectStructuredFailure(input, { code: "generation-input-invalid", reason, path });
    },
  );

  // Direct and indirect recursion are outside the closed structured call graph.
  it("rejects call cycles before evaluation", () => {
    expectStructuredFailure(fixture.callCycle, {
      code: "generation-type-invalid",
      reason: "call-cycle",
      path: "/functions/0/body/0/callee",
    });
  });

  // Statement nesting is charged before descending, so over-depth bodies never partially validate.
  it("accepts exact statement depth and rejects the first deeper body", () => {
    const budget = { ...fixture.generationBudget, maxStatementDepth: 2 } as const;
    requireStructured(fixture.exactDepth, budget);
    const result = plannedApi.validateStructuredGeneratorProgram(fixture.overDepth, budget);
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "generation-budget",
          reason: "statement-depth-exceeded",
          dimension: "statement-depth",
        },
      ],
    });
    expect(result).not.toHaveProperty("module");
    expect(result).not.toHaveProperty("usage");
  });

  // Loop counters, positive integer steps, and bounds must remain inside the declared scalar domain.
  it("rejects invalid loop counter, step, and bound domains with stable evidence", () => {
    const cases = [
      {
        module: fixture.invalidLoopCases.counterType,
        expected: {
          reason: "loop-counter-type",
          path: "/functions/0/body/0/counterType",
        },
      },
      {
        module: fixture.invalidLoopCases.zeroStep,
        expected: {
          reason: "loop-step-invalid",
          path: "/functions/0/body/0/step",
          diagnosticFamily: "loop-step-positive",
          expectedCompilerDiagnosticCode: "E10061",
        },
      },
      {
        module: fixture.invalidLoopCases.fractionalStep,
        expected: {
          reason: "loop-step-invalid",
          path: "/functions/0/body/0/step",
          diagnosticFamily: "loop-step-positive",
          expectedCompilerDiagnosticCode: "E10061",
        },
      },
      {
        module: fixture.invalidLoopCases.bound,
        expected: {
          reason: "loop-bound-out-of-range",
          path: "/functions/0/body/0/end",
          diagnosticFamily: "loop-bound-in-counter-range",
          expectedCompilerDiagnosticCode: "E10064",
        },
      },
    ];
    for (const vector of cases) {
      expectStructuredFailure(vector.module, {
        code: "generation-type-invalid",
        ...vector.expected,
      });
    }
  });
});

describe("conservative dynamic loop work", () => {
  // Dynamic bounds use the complete scalar interval, while each literal narrows one side exactly.
  it.each([
    ["full until", fixture.dynamicLoopCases.fullUntil, 128n],
    ["literal-start until", fixture.dynamicLoopCases.partialUntil, 3n],
    ["full inclusive ascending", fixture.dynamicLoopCases.fullTo, 256n],
    ["literal-end descending", fixture.dynamicLoopCases.partialDownTo, 3n],
  ] as const)("charges the %s interval formula", (_label, input, expectedWork) => {
    const result = requireStructured(input, {
      ...fixture.generationBudget,
      maxLoopWork: expectedWork,
    });
    expect(result.usage["loop-work"]).toBe(expectedWork);
  });

  // Calls in loop bounds happen once; they are not multiplied by the outer trip count.
  it("charges bound-call work once and rejects the first loop-work unit over budget", () => {
    const exactBudget = { ...fixture.generationBudget, maxLoopWork: 6n } as const;
    expect(
      requireStructured(fixture.dynamicLoopCases.boundCallLoop, exactBudget).usage,
    ).toMatchObject({ "loop-work": 6n });
    expectStructuredFailure(
      fixture.dynamicLoopCases.boundCallLoop,
      {
        code: "generation-budget",
        reason: "loop-work-exceeded",
        path: "/functions/1/body/0",
        dimension: "loop-work",
      },
      { ...exactBudget, maxLoopWork: 5n },
    );
  });

  // Runtime metering reserves one evaluation step for each iteration before trace or body work.
  it("charges one evaluation step for every actual dynamic-loop iteration", () => {
    const bindings = [
      parameterBinding("/functions/0/parameters/0", 0n),
      parameterBinding("/functions/0/parameters/1", 3n),
    ];
    const exact = requireModeled(
      oracleInput(fixture.dynamicLoopCases.actualThree, "main", bindings, {
        budget: { ...fixture.oracleBudget, evaluationSteps: 4n },
      }),
    );
    expect(exact.loopTrace).toHaveLength(3);

    const over = plannedApi.evaluateStructuredOracleProgram(
      oracleInput(fixture.dynamicLoopCases.actualThree, "main", bindings, {
        budget: { ...fixture.oracleBudget, evaluationSteps: 3n },
      }),
    );
    expect(over).toMatchObject({ ok: false, diagnostics: [{ code: "oracle.budget" }] });
    expect(over).not.toHaveProperty("observation");
  });
});

describe("module constants", () => {
  // Forward dependencies are memoized once, widened into their declared types, and shared by calls.
  it("evaluates forward constant chains and exposes normalized values in every frame", () => {
    requireStructured(fixture.constants.valid);
    expect(requireModeled(oracleInput(fixture.constants.valid, "main")).observation).toEqual(
      modeledValue(integerValue("word", 42n)).observation,
    );
    expect(requireModeled(oracleInput(fixture.constants.valid, "readSigned")).observation).toEqual(
      modeledValue(integerValue("sword", -2n)).observation,
    );
  });

  it.each([
    [fixture.constants.selfCycle, "/constants/0/value"],
    [fixture.constants.indirectCycle, "/constants/1/value"],
  ] as const)(
    "rejects the first declaration-ordered constant dependency back-edge",
    (input, path) => {
      expectStructuredFailure(input, {
        code: "generation-type-invalid",
        reason: "constant-dependency-cycle",
        path,
        expectedCompilerDiagnosticCode: "E10194",
      });
    },
  );

  // Calls are not constant expressions, even when the called function itself returns a literal.
  it("rejects the first non-constant initializer subexpression", () => {
    expectStructuredFailure(fixture.constants.impure, {
      code: "generation-type-invalid",
      reason: "constant-expression-not-constant",
      path: "/constants/0/value",
      expectedCompilerDiagnosticCode: "E10193",
    });
  });

  it("rejects a constant value outside its declared scalar type", () => {
    expectStructuredFailure(fixture.constants.outOfRange, {
      code: "generation-type-invalid",
      reason: "constant-value-out-of-range",
      path: "/constants/0/value",
      expectedCompilerDiagnosticCode: "E10084",
    });
  });

  // One declaration plus one literal consumes exactly two evaluation steps before entry execution.
  it("accepts the exact constant-evaluation budget and rejects the first step over it", () => {
    requireModeled(
      oracleInput(fixture.constants.exactBudget, "main", [], {
        budget: { ...fixture.oracleBudget, evaluationSteps: 2n },
      }),
    );
    const over = plannedApi.evaluateStructuredOracleProgram(
      oracleInput(fixture.constants.exactBudget, "main", [], {
        budget: { ...fixture.oracleBudget, evaluationSteps: 1n },
      }),
    );
    expect(over).toMatchObject({ ok: false, diagnostics: [{ code: "oracle.budget" }] });
    expect(over).not.toHaveProperty("observation");
  });
});

describe("structured zero-divisor behavior", () => {
  it.each([
    ["division", fixture.zeroDivisors.compileTimeDivide],
    ["remainder", fixture.zeroDivisors.compileTimeRemainder],
  ] as const)("rejects compile-time zero %s without inventing a compiler code", (_label, input) => {
    const result = plannedApi.validateStructuredGeneratorProgram(input, fixture.generationBudget);
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "generation-type-invalid",
          reason: "constant-zero-divisor",
          path: "/functions/0/body/0/value/right",
        },
      ],
    });
    if (result.ok) throw new TypeError("expected a compile-time zero-divisor rejection");
    expect(result.diagnostics[0]).not.toHaveProperty("expectedCompilerDiagnosticCode");
    expect(result.diagnostics[0]).not.toHaveProperty("diagnosticFamily");
  });

  // Dynamic zero division has a defined typed result for every integer representation.
  it.each([
    ["byte", 0, 255n],
    ["sbyte", 2, 127n],
    ["word", 4, 65_535n],
    ["sword", 6, 32_767n],
  ] as const)(
    "models dynamic zero division and remainder for %s",
    (type, functionIndex, maximum) => {
      const binding = [parameterBinding(`/functions/${functionIndex}/parameters/0`, 0n)];
      expect(
        requireModeled(oracleInput(fixture.zeroDivisors.runtime, `divide${type}`, binding))
          .observation,
      ).toEqual(modeledValue(integerValue(type, maximum)).observation);
      expect(
        requireModeled(
          oracleInput(fixture.zeroDivisors.runtime, `remainder${type}`, [
            parameterBinding(`/functions/${functionIndex + 1}/parameters/0`, 0n),
          ]),
        ).observation,
      ).toEqual(modeledValue(integerValue(type, 0n)).observation);
    },
  );
});

describe("independent expectation origin", () => {
  // Compiler products and goldens cannot become the authority for an independent expectation.
  it.each(["compiler-output", "unoptimized-output", "golden"] as const)(
    "boundary.oracle-expectation-origin rejects %s",
    (expectationAuthority) => {
      expect(
        plannedApi.evaluateStructuredOracleProgram(
          oracleInput(fixture.fixedArray, "main", [], { expectationAuthority }),
        ),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: "oracle.authority.not-accepted", path: "/expectationAuthority" }],
      });
    },
  );
});
