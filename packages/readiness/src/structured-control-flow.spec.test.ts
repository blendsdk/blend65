import { beforeEach, describe, expect, it } from "vitest";

import { validateGeneratorIr } from "./generator-ir-validator.js";
import { runWithOracleMutationVariant } from "./oracle-conformance-v1.js";
import { runWithSemanticRelationFault } from "./semantic-relation-conformance.js";
import { evaluateSemanticRelation } from "./semantic-relations.js";
import { renderSourceModule } from "./source-renderer.js";
import { createOracleEvaluatorSpecFixture } from "./test-fixtures/oracle-evaluator-spec-fixture.js";
import { createStructuredGeneratedProgramsSpecFixture } from "./test-fixtures/structured-generated-programs-spec-fixture.js";

const fixture = createStructuredGeneratedProgramsSpecFixture();
const { integerValue, modeledValue } = createOracleEvaluatorSpecFixture();
const RENDER_OPTIONS = { maxSourceBytes: 1_048_576, literalSpellings: [] } as const;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;

async function loadPlannedApi() {
  const [caseFamilies, validation, oracle] = await Promise.all([
    import("./structured-case-families.js"),
    import("./structured-ir-validation.js"),
    import("./structured-oracle-evaluator.js"),
  ]);
  return {
    resolveStructuredCaseAuthorityV1: caseFamilies.resolveStructuredCaseAuthorityV1,
    validateStructuredGeneratorProgram: validation.validateStructuredGeneratorProgram,
    evaluateStructuredOracleProgram: oracle.evaluateStructuredOracleProgram,
  };
}

let plannedApi: Awaited<ReturnType<typeof loadPlannedApi>>;

beforeEach(async () => {
  plannedApi = await loadPlannedApi();
});

function requireStructured(input: unknown, generationBudget = fixture.generationBudget) {
  const result = plannedApi.validateStructuredGeneratorProgram(input, generationBudget);
  expect(result).toMatchObject({ ok: true, diagnostics: [] });
  if (!result.ok) throw new TypeError("expected a valid structured program");
  return result;
}

function render(input: unknown): string {
  const closed = validateGeneratorIr(input);
  expect(closed).toMatchObject({ ok: true, diagnostics: [] });
  if (!closed.ok) throw new TypeError("expected closed generator input");
  const result = renderSourceModule(closed.module, RENDER_OPTIONS);
  expect(result).toMatchObject({ ok: true, diagnostics: [] });
  if (!result.ok) throw new TypeError("expected canonical structured source");
  return result.source;
}

function oracleInput(
  module: unknown,
  entryFunction = "main",
  parameterBindings: readonly object[] = [],
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

function mutation(operationId: string, pathId: string, variantId: string) {
  return { operationId, pathId, variantId };
}

function resolveRelationCase(
  caseId: "case.structured.for-inclusive-extremes-v1" | "case.structured.loop-volatile-order-v1",
) {
  const result = plannedApi.resolveStructuredCaseAuthorityV1(caseId);
  expect(result).toMatchObject({ ok: true, diagnostics: [] });
  if (!result.ok || result.authority.relationSelectionPath === undefined) {
    throw new TypeError("expected authenticated structured relation authority");
  }
  return result.authority;
}

function relationRequest(authority: ReturnType<typeof resolveRelationCase>) {
  return {
    schemaVersion: 2,
    handlerId: "transform.semantic-relations",
    relationId: "relation.loop-unrolling",
    sourceProvenance: authority.sourceProvenance,
    sourceCase: authority.generatedCase,
    entryFunction: authority.oracleInput.entryFunction,
    selectionPath: authority.relationSelectionPath,
    variantId: "unroll-exact-domain-v1",
    memory: authority.oracleInput.memory,
    budget: authority.oracleInput.budget,
    generationBudget: authority.oracleInput.generationBudget,
  } as const;
}

describe("structured calls and branches", () => {
  // Scalar calls compose inside expressions and preserve the exact nested evaluation result.
  it("renders nested scalar calls and returns their independent result", () => {
    requireStructured(fixture.nestedCalls);
    expect(render(fixture.nestedCalls)).toContain("return add(add(v, 1), 2);");
    expect(requireModeled(oracleInput(fixture.nestedCalls)).observation).toEqual(
      modeledValue(integerValue("byte", 7n)).observation,
    );
  });

  // Scalar parameters receive copies, so callee assignment cannot change the caller local.
  it("copies scalar arguments into distinct callee frames", async () => {
    const callee = requireModeled(
      oracleInput(fixture.scalarCopy, "mutate", [
        parameterBinding("/functions/0/parameters/0", 4n),
      ]),
    );
    const caller = requireModeled(oracleInput(fixture.scalarCopy));
    expect(callee.observation).toEqual(modeledValue(integerValue("byte", 9n)).observation);
    expect(caller.observation).toEqual(modeledValue(integerValue("byte", 4n)).observation);

    const aliased = await runWithOracleMutationVariant(
      mutation(
        "oracle.structured-program",
        "oracle.structured.scalar-parameter",
        "alias-caller-v1",
      ),
      () => plannedApi.evaluateStructuredOracleProgram(oracleInput(fixture.scalarCopy)),
    );
    expect(aliased).not.toEqual(caller);
  });

  // Call arguments and their observable effects are sequenced from left to right.
  it("evaluates observable call arguments from left to right and rejects reversal", async () => {
    const expected = modeledValue(
      integerValue("byte", 2n),
      [
        { ordinal: 0n, kind: "write", width: 1, address: 0xc000n, value: 1n },
        { ordinal: 1n, kind: "write", width: 1, address: 0xc001n, value: 2n },
      ],
      [
        { address: 0xc000n, value: 1n },
        { address: 0xc001n, value: 2n },
      ],
    ).observation;
    const baseline = requireModeled(oracleInput(fixture.argumentOrder));
    expect(baseline.observation).toEqual(expected);

    const reversed = await runWithOracleMutationVariant(
      mutation("oracle.structured-program", "oracle.structured.call-arguments", "right-to-left-v1"),
      () => plannedApi.evaluateStructuredOracleProgram(oracleInput(fixture.argumentOrder)),
    );
    expect(reversed).not.toEqual(baseline);
  });

  // Boolean branch selection executes exactly one authored arm.
  it.each([
    [true, 1n],
    [false, 2n],
  ] as const)("selects the exact branch for boolean value %s", (flag, stored) => {
    const result = requireModeled(
      oracleInput(fixture.branch, "main", [parameterBinding("/functions/0/parameters/0", flag)]),
    );
    expect(result.observation).toEqual(
      modeledValue(
        integerValue("byte", 0n),
        [{ ordinal: 0n, kind: "write", width: 1, address: 0xc000n, value: stored }],
        [{ address: 0xc000n, value: stored }],
      ).observation,
    );
  });

  // Nested conditions preserve their authored arm selection and exact return propagation.
  it("returns the inner false arm and detects opposite-arm selection", async () => {
    const baseline = requireModeled(oracleInput(fixture.nestedBranch));
    expect(baseline.observation).toEqual(modeledValue(integerValue("byte", 3n)).observation);

    const opposite = await runWithOracleMutationVariant(
      mutation(
        "oracle.structured-program",
        "oracle.structured.branch-selection",
        "opposite-arm-v1",
      ),
      () => plannedApi.evaluateStructuredOracleProgram(oracleInput(fixture.nestedBranch)),
    );
    expect(opposite).not.toEqual(baseline);
  });
});

describe("structured loops", () => {
  // A while body may run zero times, while a do-while body always runs once before its condition.
  it("executes while zero times and do-while once", () => {
    expect(render(fixture.whileZero)).toContain("while (false) {");
    expect(requireModeled(oracleInput(fixture.whileZero)).observation).toEqual(
      modeledValue(integerValue("byte", 0n)).observation,
    );
    expect(render(fixture.doWhileOne)).toContain("} while (false);");
    expect(requireModeled(oracleInput(fixture.doWhileOne)).observation).toEqual(
      modeledValue(integerValue("byte", 1n)).observation,
    );
  });

  // Exclusive and inclusive directions each enumerate their finite ordered domain exactly once.
  it("executes exclusive and inclusive three-value domains in order", () => {
    const source = render(fixture.pairedForLoops);
    expect(source).toContain("for (let i: byte = 0 until 3) {");
    expect(source).toContain("for (let j: byte = 0 to 2) {");
    const result = requireModeled(oracleInput(fixture.pairedForLoops));
    expect(result.observation).toEqual(modeledValue(integerValue("byte", 6n)).observation);
    expect(result.loopTrace).toEqual([
      ...[0n, 1n, 2n].map((value) => ({
        loopPath: "/functions/0/body/1",
        counter: "i",
        value,
      })),
      ...[0n, 1n, 2n].map((value) => ({
        loopPath: "/functions/0/body/2",
        counter: "j",
        value,
      })),
    ]);
  });

  // Loop work succeeds at the exact limit and fails atomically at the first excess iteration.
  it("accepts exact loop work and rejects the first excess without partial success", () => {
    const exactBudget = { ...fixture.generationBudget, maxLoopWork: 3n } as const;
    requireStructured(fixture.loopThree, exactBudget);
    const overBudget = { ...fixture.generationBudget, maxLoopWork: 2n } as const;
    const result = plannedApi.validateStructuredGeneratorProgram(fixture.loopThree, overBudget);
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "generation-budget",
          reason: "loop-work-exceeded",
          dimension: "loop-work",
          path: "/functions/0/body/1",
        },
      ],
    });
    expect(result).not.toHaveProperty("module");
    expect(result).not.toHaveProperty("usage");
  });

  // Pure exact domains may unroll; unproven volatile ordering must remain proof-incomplete.
  it("unrolls an authenticated pure domain and rejects forced volatile ordering", () => {
    const pure = resolveRelationCase("case.structured.for-inclusive-extremes-v1");
    const pureResult = evaluateSemanticRelation(pure.oracleSuite, relationRequest(pure));
    expect(pureResult).toMatchObject({
      ok: true,
      outcome: "modeled",
      relationId: "relation.loop-unrolling",
      diagnostics: [],
    });
    if (!pureResult.ok || pureResult.outcome !== "modeled") {
      throw new TypeError("expected a proved pure loop unrolling");
    }
    expect(pureResult.sourceObservation).toEqual(pureResult.transformedObservation);
    expect(pureResult.observation).toEqual(pureResult.transformedObservation);
    expect(pureResult.iterationDomain.map(({ value }) => value)).toEqual(
      Array.from({ length: 256 }, (_, value) => BigInt(value)),
    );

    const volatile = resolveRelationCase("case.structured.loop-volatile-order-v1");
    expect(evaluateSemanticRelation(volatile.oracleSuite, relationRequest(volatile))).toEqual({
      ok: true,
      outcome: "proof-incomplete",
      relationId: "relation.loop-unrolling",
      reason: "volatile-effect-order-unproven",
      diagnostics: [],
    });
    const forced = runWithSemanticRelationFault(
      {
        schemaVersion: 1,
        pathId: "relation.loop-unrolling.precondition",
        faultId: "relation.fault.force-precondition-true",
      },
      () => evaluateSemanticRelation(volatile.oracleSuite, relationRequest(volatile)),
    );
    expect(forced).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.relation.violated" }],
    });
  });

  // Type-extreme loop domains terminate before a counter could wrap and repeat.
  it.each([
    {
      module: fixture.loopExtremes.ascendingByte,
      expectedCount: 256n,
      expectedValues: Array.from({ length: 256 }, (_, value) => BigInt(value)),
    },
    {
      module: fixture.loopExtremes.descendingSbyte,
      expectedCount: 256n,
      expectedValues: Array.from({ length: 256 }, (_, value) => BigInt(127 - value)),
    },
    {
      module: fixture.loopExtremes.crossingByteMaximum,
      expectedCount: 2n,
      expectedValues: [250n, 253n],
    },
  ])("terminates an ordered type-domain loop without wrap repetition", (vector) => {
    const result = requireModeled(oracleInput(vector.module));
    expect(result.observation).toEqual(
      modeledValue(integerValue("word", vector.expectedCount)).observation,
    );
    expect(result.loopTrace.map(({ value }) => value)).toEqual(vector.expectedValues);
    expect(new Set(result.loopTrace.map(({ value }) => value)).size).toBe(
      vector.expectedValues.length,
    );
  });

  // A mutation that continues through a wrapped counter must disagree with the independent oracle.
  it("detects a wrapped terminal counter mutation", async () => {
    const baseline = requireModeled(oracleInput(fixture.loopExtremes.crossingByteMaximum));
    const wrapped = await runWithOracleMutationVariant(
      mutation(
        "oracle.structured-program",
        "oracle.structured.loop-domain",
        "wrapped-terminal-counter-v1",
      ),
      () =>
        plannedApi.evaluateStructuredOracleProgram(
          oracleInput(fixture.loopExtremes.crossingByteMaximum),
        ),
    );
    expect(wrapped).not.toEqual(baseline);
  });
});
