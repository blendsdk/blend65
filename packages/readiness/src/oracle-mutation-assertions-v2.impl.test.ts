import { describe, expect, it } from "vitest";

import { runWithOracleMutationVariant } from "./oracle-conformance-v1.js";
import { evaluateSemanticRelation } from "./semantic-relations.js";
import { resolveStructuredCaseAuthorityV1 } from "./structured-case-families.js";
import {
  STRUCTURED_ORACLE_MUTATION_PATHS,
  evaluateStructuredOracleProgram,
} from "./structured-oracle-evaluator.js";
import { createStructuredGeneratedProgramsSpecFixture } from "./test-fixtures/structured-generated-programs-spec-fixture.js";

const fixture = createStructuredGeneratedProgramsSpecFixture();

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
  const result = evaluateStructuredOracleProgram(input);
  expect(result).toMatchObject({ ok: true, outcome: "modeled", diagnostics: [] });
  if (!result.ok || result.outcome !== "modeled") {
    throw new TypeError("expected modeled structured oracle result");
  }
  return result;
}

function parameterBinding(parameterPath: string, value: bigint | boolean) {
  return { kind: "parameter-value", parameterPath, value } as const;
}

function countedLoopModule(
  path: string,
  direction: "until" | "to" | "downto",
  start: bigint,
  end: bigint,
) {
  return {
    kind: "module",
    path: [path],
    constants: [],
    functions: [
      {
        kind: "function",
        name: "main",
        parameters: [],
        returnType: "word",
        body: [
          {
            kind: "local",
            name: "count",
            type: "word",
            initializer: { kind: "literal", type: "word", value: 0n },
          },
          {
            kind: "for",
            counter: "i",
            counterType: "byte",
            start: { kind: "literal", type: "byte", value: start },
            direction,
            end: { kind: "literal", type: "byte", value: end },
            step: 1n,
            body: [
              {
                kind: "assign",
                target: "count",
                value: {
                  kind: "binary",
                  type: "word",
                  operator: "+",
                  left: { kind: "name", type: "word", name: "count" },
                  right: { kind: "literal", type: "word", value: 1n },
                },
              },
            ],
          },
          { kind: "return", value: { kind: "name", type: "word", name: "count" } },
        ],
      },
    ],
  } as const;
}

function relationAuthority(
  caseId: "case.structured.for-inclusive-extremes-v1" | "case.structured.loop-volatile-order-v1",
) {
  const resolved = resolveStructuredCaseAuthorityV1(caseId);
  expect(resolved).toMatchObject({ ok: true, diagnostics: [] });
  if (!resolved.ok || resolved.authority.relationSelectionPath === undefined) {
    throw new TypeError("expected authenticated loop-relation authority");
  }
  return resolved.authority;
}

function relationRequest(authority: ReturnType<typeof relationAuthority>) {
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

describe("structured evaluator mutation kills", () => {
  it("keeps the six registered evaluator mutation branches exact", () => {
    expect(STRUCTURED_ORACLE_MUTATION_PATHS).toEqual([
      {
        operationId: "oracle.structured-program",
        pathId: "oracle.structured.index-address",
        variantId: "unscaled-index-v1",
      },
      {
        operationId: "oracle.structured-program",
        pathId: "oracle.structured.array-parameter",
        variantId: "copy-argument-v1",
      },
      {
        operationId: "oracle.structured-program",
        pathId: "oracle.structured.scalar-parameter",
        variantId: "alias-caller-v1",
      },
      {
        operationId: "oracle.structured-program",
        pathId: "oracle.structured.call-arguments",
        variantId: "right-to-left-v1",
      },
      {
        operationId: "oracle.structured-program",
        pathId: "oracle.structured.branch-selection",
        variantId: "opposite-arm-v1",
      },
      {
        operationId: "oracle.structured-program",
        pathId: "oracle.structured.loop-domain",
        variantId: "wrapped-terminal-counter-v1",
      },
    ]);
  });

  it("kills omitted word scaling while retaining wrapped addressing", async () => {
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
    const mutant = await runWithOracleMutationVariant(
      {
        operationId: "oracle.structured-program",
        pathId: "oracle.structured.index-address",
        variantId: "unscaled-index-v1",
      },
      () => evaluateStructuredOracleProgram(input),
    );

    expect(baseline.arrayAccessTrace[0]?.effectiveAddress).toBe(0xf2n);
    expect(mutant).toMatchObject({
      ok: true,
      outcome: "modeled",
      observation: { returnValue: { type: "word", value: 0xabcdn } },
      arrayAccessTrace: [{ effectiveAddress: 0x71n }],
    });
    expect(mutant).not.toEqual(baseline);
  });

  it("kills scalar aliasing that mutates a copied caller argument", async () => {
    const input = oracleInput(fixture.scalarCopy);
    const baseline = requireModeled(input);
    const mutant = await runWithOracleMutationVariant(
      {
        operationId: "oracle.structured-program",
        pathId: "oracle.structured.scalar-parameter",
        variantId: "alias-caller-v1",
      },
      () => evaluateStructuredOracleProgram(input),
    );

    expect(baseline.observation.returnValue).toMatchObject({ value: 4n });
    expect(mutant).toMatchObject({
      ok: true,
      outcome: "modeled",
      observation: { returnValue: { value: 9n } },
    });
    expect(mutant).not.toEqual(baseline);
  });

  it("kills array copying that hides mutation through a mutable parameter", async () => {
    const input = oracleInput(fixture.mutableArray);
    const baseline = requireModeled(input);
    const mutant = await runWithOracleMutationVariant(
      {
        operationId: "oracle.structured-program",
        pathId: "oracle.structured.array-parameter",
        variantId: "copy-argument-v1",
      },
      () => evaluateStructuredOracleProgram(input),
    );

    expect(baseline.observation.returnValue).toMatchObject({ value: 9n });
    expect(mutant).toMatchObject({
      ok: true,
      outcome: "modeled",
      observation: { returnValue: { value: 2n } },
    });
    expect(mutant).not.toEqual(baseline);
  });

  it("kills right-to-left argument evaluation through observable effect order", async () => {
    const input = oracleInput(fixture.argumentOrder);
    const baseline = requireModeled(input);
    const mutant = await runWithOracleMutationVariant(
      {
        operationId: "oracle.structured-program",
        pathId: "oracle.structured.call-arguments",
        variantId: "right-to-left-v1",
      },
      () => evaluateStructuredOracleProgram(input),
    );

    expect(baseline.observation.effects.map(({ address }) => address)).toEqual([0xc000n, 0xc001n]);
    expect(mutant).toMatchObject({ ok: true, outcome: "modeled" });
    if (!mutant.ok || mutant.outcome !== "modeled") throw new TypeError("expected mutant result");
    expect(mutant.observation.effects.map(({ address }) => address)).toEqual([0xc001n, 0xc000n]);
    expect(mutant).not.toEqual(baseline);
  });

  it("kills selection of the opposite branch arm", async () => {
    const input = oracleInput(fixture.branch, "main", [
      parameterBinding("/functions/0/parameters/0", true),
    ]);
    const baseline = requireModeled(input);
    const mutant = await runWithOracleMutationVariant(
      {
        operationId: "oracle.structured-program",
        pathId: "oracle.structured.branch-selection",
        variantId: "opposite-arm-v1",
      },
      () => evaluateStructuredOracleProgram(input),
    );

    expect(baseline.observation.finalMemory).toEqual([{ address: 0xc000n, value: 1n }]);
    expect(mutant).toMatchObject({
      ok: true,
      outcome: "modeled",
      observation: { finalMemory: [{ address: 0xc000n, value: 2n }] },
    });
    expect(mutant).not.toEqual(baseline);
  });
});

describe("structured loop mutation kills", () => {
  it.each([
    { label: "zero", module: countedLoopModule("ZeroLoop", "until", 0n, 0n), values: [] },
    { label: "one", module: countedLoopModule("OneLoop", "to", 0n, 0n), values: [0n] },
    {
      label: "multiple",
      module: countedLoopModule("MultipleLoop", "until", 0n, 3n),
      values: [0n, 1n, 2n],
    },
    {
      label: "descending",
      module: countedLoopModule("DescendingLoop", "downto", 2n, 0n),
      values: [2n, 1n, 0n],
    },
  ] as const)("retains the exact $label loop domain and order", ({ module, values }) => {
    const baseline = requireModeled(oracleInput(module));
    expect(baseline.loopTrace.map(({ value }) => value)).toEqual(values);
    expect(baseline.observation.returnValue).toMatchObject({ value: BigInt(values.length) });
  });

  it.each([
    { label: "one", module: countedLoopModule("OneWrap", "to", 1n, 1n) },
    { label: "multiple", module: countedLoopModule("MultipleWrap", "until", 0n, 3n) },
  ] as const)(
    "kills a wrapped terminal counter after a $label-iteration domain",
    async ({ module }) => {
      const input = oracleInput(module);
      const baseline = requireModeled(input);
      const mutant = await runWithOracleMutationVariant(
        {
          operationId: "oracle.structured-program",
          pathId: "oracle.structured.loop-domain",
          variantId: "wrapped-terminal-counter-v1",
        },
        () => evaluateStructuredOracleProgram(input),
      );

      expect(mutant).toMatchObject({ ok: true, outcome: "modeled" });
      if (!mutant.ok || mutant.outcome !== "modeled") throw new TypeError("expected loop mutant");
      expect(mutant.loopTrace.length).toBe(baseline.loopTrace.length + 1);
      expect(mutant.loopTrace.at(-1)?.value).toBe(0n);
      expect(mutant).not.toEqual(baseline);
    },
  );

  it("does not invent a terminal value for a zero-work loop", async () => {
    const input = oracleInput(countedLoopModule("ZeroWrap", "until", 0n, 0n));
    const baseline = requireModeled(input);
    const selected = await runWithOracleMutationVariant(
      {
        operationId: "oracle.structured-program",
        pathId: "oracle.structured.loop-domain",
        variantId: "wrapped-terminal-counter-v1",
      },
      () => evaluateStructuredOracleProgram(input),
    );
    expect(selected).toEqual(baseline);
    expect(baseline.loopTrace).toEqual([]);
  });

  it.each([
    {
      pathId: "relation.loop-unrolling.rewrite",
      variantId: "non-preserving.unroll-exact-domain-v1",
    },
    {
      pathId: "relation.loop-unrolling.rewrite",
      variantId: "semantic-closure-invalid-v1",
    },
    {
      pathId: "relation.loop-unrolling.comparator",
      variantId: "omit-required-observable-v1",
    },
  ] as const)("kills the $variantId relation mutation", async ({ pathId, variantId }) => {
    const authority = relationAuthority("case.structured.for-inclusive-extremes-v1");
    const baseline = evaluateSemanticRelation(authority.oracleSuite, relationRequest(authority));
    expect(baseline).toMatchObject({ ok: true, outcome: "modeled" });

    const mutant = await runWithOracleMutationVariant(
      { operationId: "relation.loop-unrolling", pathId, variantId },
      () => evaluateSemanticRelation(authority.oracleSuite, relationRequest(authority)),
    );
    expect(mutant).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.relation.violated", path: "/transformedCase" }],
    });
  });

  it("kills forced unrolling when volatile effect order is unproven", async () => {
    const authority = relationAuthority("case.structured.loop-volatile-order-v1");
    const request = relationRequest(authority);
    expect(evaluateSemanticRelation(authority.oracleSuite, request)).toEqual({
      ok: true,
      outcome: "proof-incomplete",
      relationId: "relation.loop-unrolling",
      reason: "volatile-effect-order-unproven",
      diagnostics: [],
    });

    const mutant = await runWithOracleMutationVariant(
      {
        operationId: "relation.loop-unrolling",
        pathId: "relation.loop-unrolling.precondition",
        variantId: "force-true-v1",
      },
      () => evaluateSemanticRelation(authority.oracleSuite, request),
    );
    expect(mutant).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.relation.violated", path: "/transformedCase" }],
    });
  });
});
