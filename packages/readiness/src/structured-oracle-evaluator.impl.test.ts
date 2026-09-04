import { describe, expect, it } from "vitest";

import { runWithOracleMutationVariant } from "./oracle-conformance-v1.js";
import { evaluateSemanticRelation } from "./semantic-relations.js";
import { resolveStructuredCaseAuthorityV1 } from "./structured-case-families.js";
import { evaluateStructuredOracleProgram } from "./structured-oracle-evaluator.js";
import { createOracleEvaluatorSpecFixture } from "./test-fixtures/oracle-evaluator-spec-fixture.js";
import { createStructuredGeneratedProgramsSpecFixture } from "./test-fixtures/structured-generated-programs-spec-fixture.js";

const fixture = createStructuredGeneratedProgramsSpecFixture();
const { integerValue, modeledValue } = createOracleEvaluatorSpecFixture();
const SHA256 = /^sha256:[0-9a-f]{64}$/u;

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

function parameterBinding(parameterPath: string, value: bigint | boolean) {
  return { kind: "parameter-value", parameterPath, value } as const;
}

function requireModeled(input: ReturnType<typeof oracleInput>) {
  const result = evaluateStructuredOracleProgram(input);
  expect(result).toMatchObject({ ok: true, outcome: "modeled", diagnostics: [] });
  if (!result.ok || result.outcome !== "modeled") {
    throw new TypeError("expected modeled structured evaluation");
  }
  expect(result.evaluationIdentity).toMatch(SHA256);
  return result;
}

describe("structured evaluator frames and aliases", () => {
  it("keeps nested scalar call frames distinct and copies scalar parameters", () => {
    expect(requireModeled(oracleInput(fixture.nestedCalls)).observation).toEqual(
      modeledValue(integerValue("byte", 7n)).observation,
    );
    expect(requireModeled(oracleInput(fixture.scalarCopy)).observation).toEqual(
      modeledValue(integerValue("byte", 4n)).observation,
    );
    expect(
      requireModeled(
        oracleInput(fixture.scalarCopy, "mutate", [
          parameterBinding("/functions/0/parameters/0", 4n),
        ]),
      ).observation,
    ).toEqual(modeledValue(integerValue("byte", 9n)).observation);
  });

  it("retains mutable array parameters as caller-visible aliases", async () => {
    const baseline = requireModeled(oracleInput(fixture.mutableArray));
    expect(baseline.observation).toEqual(modeledValue(integerValue("byte", 9n)).observation);

    const copied = await runWithOracleMutationVariant(
      {
        operationId: "oracle.structured-program",
        pathId: "oracle.structured.array-parameter",
        variantId: "copy-argument-v1",
      },
      () => evaluateStructuredOracleProgram(oracleInput(fixture.mutableArray)),
    );
    expect(copied).toMatchObject({
      ok: true,
      outcome: "modeled",
      observation: { returnValue: { kind: "integer", type: "byte", value: 2n } },
    });
    expect(copied).not.toEqual(baseline);
  });
});

describe("structured evaluator order and addressing", () => {
  it("wraps computed array addresses in 16-bit space and records the exact access", () => {
    const input = oracleInput(
      fixture.computedOutOfBounds,
      "read",
      [parameterBinding("/functions/0/parameters/0", 0x20n)],
      {
        arrayPlacement: {
          revision: "structured-array-placement-v1",
          bindings: [{ arrayName: "values", baseAddress: 0xfff0 }],
        },
        memory: { schemaVersion: 1, cells: [{ address: 0x10n, value: 0x5an }] },
      },
    );
    const result = requireModeled(input);

    expect(result.observation.returnValue).toEqual({ kind: "integer", type: "byte", value: 0x5an });
    expect(result.arrayAccessTrace).toEqual([
      {
        expressionPath: "/functions/0/body/1/value",
        arrayName: "values",
        index: 0x20n,
        effectiveAddress: 0x10n,
      },
    ]);
    expect(result.arrayPlacementIdentity).toMatch(SHA256);
    expect(result.arrayPlacementIdentity).not.toBe(result.evaluationIdentity);
  });

  it("evaluates argument effects strictly from left to right", async () => {
    const baseline = requireModeled(oracleInput(fixture.argumentOrder));
    expect(baseline.observation.effects).toEqual([
      { ordinal: 0n, kind: "write", width: 1, address: 0xc000n, value: 1n },
      { ordinal: 1n, kind: "write", width: 1, address: 0xc001n, value: 2n },
    ]);

    const reversed = await runWithOracleMutationVariant(
      {
        operationId: "oracle.structured-program",
        pathId: "oracle.structured.call-arguments",
        variantId: "right-to-left-v1",
      },
      () => evaluateStructuredOracleProgram(oracleInput(fixture.argumentOrder)),
    );
    expect(reversed).not.toEqual(baseline);
  });

  it.each([
    [true, 1n],
    [false, 2n],
  ] as const)("executes only the authored branch selected by %s", (flag, stored) => {
    const result = requireModeled(
      oracleInput(fixture.branch, "main", [parameterBinding("/functions/0/parameters/0", flag)]),
    );
    expect(result.observation.effects).toEqual([
      { ordinal: 0n, kind: "write", width: 1, address: 0xc000n, value: stored },
    ]);
    expect(result.observation.finalMemory).toEqual([{ address: 0xc000n, value: stored }]);
  });

  it("records exclusive then inclusive loop iterations in statement order", () => {
    const result = requireModeled(oracleInput(fixture.pairedForLoops));
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
    expect(result.observation.returnValue).toEqual({
      kind: "integer",
      type: "byte",
      value: 6n,
    });
  });

  it("distinguishes zero-iteration while from mandatory-first do-while", () => {
    expect(requireModeled(oracleInput(fixture.whileZero)).observation.returnValue).toMatchObject({
      value: 0n,
    });
    expect(requireModeled(oracleInput(fixture.doWhileOne)).observation.returnValue).toMatchObject({
      value: 1n,
    });
  });
});

describe("structured evaluator fail-closed paths", () => {
  it.each(["compiler-output", "unoptimized-output", "golden"])(
    "rejects the hostile expectation authority %s",
    (expectationAuthority) => {
      const result = evaluateStructuredOracleProgram(
        oracleInput(fixture.fixedArray, "main", [], { expectationAuthority }),
      );
      expect(result).toEqual({
        ok: false,
        diagnostics: [
          {
            code: "oracle.authority.not-accepted",
            path: "/expectationAuthority",
            message: "Expectation authority is not accepted.",
          },
        ],
      });
      expect(result).not.toHaveProperty("observation");
    },
  );

  it("returns the structured diagnostic before evaluating an invalid program", () => {
    const result = evaluateStructuredOracleProgram(
      oracleInput(fixture.constantOutOfBounds, "main", [], {
        memory: { schemaVersion: 1, cells: [{ address: 0xc000n, value: 0xaan }] },
      }),
    );
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "neighbor-invalid",
          reason: "array-constant-index-out-of-range",
          path: "/functions/0/body/1/value/index",
        },
      ],
    });
    expect(result).not.toHaveProperty("observation");
    expect(result).not.toHaveProperty("arrayAccessTrace");
  });

  it.each([
    ["evaluationSteps", 1n, fixture.nestedCalls],
    ["frames", 1n, fixture.nestedCalls],
    ["effects", 1n, fixture.argumentOrder],
  ] as const)("fails closed when the runtime %s budget is exhausted", (field, limit, module) => {
    const result = evaluateStructuredOracleProgram(
      oracleInput(module, "main", [], {
        budget: { ...fixture.oracleBudget, [field]: limit },
      }),
    );
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.budget", path: "/budget" }],
    });
    expect(result).not.toHaveProperty("observation");
    expect(result).not.toHaveProperty("loopTrace");
  });

  it("returns proof-incomplete for an authenticated loop with unproven volatile order", () => {
    const resolved = resolveStructuredCaseAuthorityV1("case.structured.loop-volatile-order-v1");
    expect(resolved).toMatchObject({ ok: true, diagnostics: [] });
    if (!resolved.ok || resolved.authority.relationSelectionPath === undefined) {
      throw new TypeError("expected authenticated volatile loop authority");
    }
    const authority = resolved.authority;
    const result = evaluateSemanticRelation(authority.oracleSuite, {
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
    });
    expect(result).toEqual({
      ok: true,
      outcome: "proof-incomplete",
      relationId: "relation.loop-unrolling",
      reason: "volatile-effect-order-unproven",
      diagnostics: [],
    });
  });
});
