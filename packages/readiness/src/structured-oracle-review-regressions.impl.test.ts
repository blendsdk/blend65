import { describe, expect, it } from "vitest";

import { resolveStructuredCaseAuthorityV1 } from "./structured-case-families.js";
import {
  deriveStructuredOracleEvaluationIdentityV2,
  evaluateStructuredOracleProgram,
} from "./structured-oracle-evaluator.js";
import { validateStructuredGeneratorProgram } from "./structured-ir-validation.js";
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

function binding(parameterPath: string, value: bigint | boolean) {
  return { kind: "parameter-value", parameterPath, value } as const;
}

function expectInputFailure(input: unknown, path: string): void {
  const result = evaluateStructuredOracleProgram(input);
  expect(result).toMatchObject({
    ok: false,
    diagnostics: [{ code: "oracle.input.invalid", path }],
  });
  expect(result).not.toHaveProperty("observation");
  expect(JSON.stringify(result)).not.toContain("binding missing");
}

function requireAuthority(caseId: string) {
  const result = resolveStructuredCaseAuthorityV1(caseId);
  if (!result.ok) throw new TypeError("expected structured authority");
  return result.authority;
}

describe("structured oracle input population and identity", () => {
  it("requires the exact ordered entry-parameter population, types, and ranges", () => {
    const path0 = "/functions/2/parameters/0";
    const path1 = "/functions/2/parameters/1";
    const input = (values: readonly object[]) =>
      oracleInput(fixture.argumentOrder, "selectSecond", values);

    expect(
      evaluateStructuredOracleProgram(input([binding(path0, 1n), binding(path1, 2n)])),
    ).toMatchObject({
      ok: true,
      outcome: "modeled",
      observation: { returnValue: { value: 2n } },
    });
    for (const values of [
      [],
      [binding(path0, 1n)],
      [binding(path0, 1n), binding(path0, 2n)],
      [binding(path1, 2n), binding(path0, 1n)],
      [binding("/functions/2/parameters/9", 1n), binding(path1, 2n)],
      [binding(path0, true), binding(path1, 2n)],
      [binding(path0, 256n), binding(path1, 2n)],
    ]) {
      expectInputFailure(input(values), "/parameterBindings");
    }
  });

  it("requires a non-empty unique placement population naming exactly one module array", () => {
    const invalidPlacements = [
      { revision: "structured-array-placement-v1", bindings: [] },
      {
        revision: "structured-array-placement-v1",
        bindings: [
          { arrayName: "values", baseAddress: 0x1000 },
          { arrayName: "values", baseAddress: 0x2000 },
        ],
      },
      {
        revision: "structured-array-placement-v1",
        bindings: [{ arrayName: "missing", baseAddress: 0x1000 }],
      },
    ] as const;
    for (const arrayPlacement of invalidPlacements) {
      expectInputFailure(
        oracleInput(fixture.fixedArray, "main", [], { arrayPlacement }),
        "/arrayPlacement",
      );
    }
  });

  it("binds parameter values, memory, placement, and both budget schemas into evaluation identity", () => {
    const authority = requireAuthority("case.structured.runtime-wrap-oracle-v1");
    const placement = authority.oracleInput.arrayPlacement;
    if (placement === undefined) throw new TypeError("expected structured array placement");
    const baseline = deriveStructuredOracleEvaluationIdentityV2(authority.oracleInput);
    const identities = [
      deriveStructuredOracleEvaluationIdentityV2({
        ...authority.oracleInput,
        parameterBindings: Object.freeze([
          Object.freeze({
            kind: "parameter-value",
            parameterPath: "/functions/0/parameters/0",
            value: 1n,
          }),
        ]),
      }),
      deriveStructuredOracleEvaluationIdentityV2({
        ...authority.oracleInput,
        memory: Object.freeze({
          schemaVersion: 1,
          cells: Object.freeze([Object.freeze({ address: 1n, value: 2n })]),
        }),
      }),
      deriveStructuredOracleEvaluationIdentityV2({
        ...authority.oracleInput,
        arrayPlacement: Object.freeze({
          revision: "structured-array-placement-v1",
          bindings: Object.freeze([
            Object.freeze({ arrayName: placement.bindings[0]!.arrayName, baseAddress: 0xffe0 }),
          ]),
        }),
      }),
      deriveStructuredOracleEvaluationIdentityV2({
        ...authority.oracleInput,
        generationBudget: Object.freeze({
          ...authority.oracleInput.generationBudget,
          maxAttempts: authority.oracleInput.generationBudget.maxAttempts - 1,
        }),
      }),
      deriveStructuredOracleEvaluationIdentityV2({
        ...authority.oracleInput,
        budget: Object.freeze({
          ...authority.oracleInput.budget,
          effects: authority.oracleInput.budget.effects - 1n,
        }),
      }),
    ];
    expect(deriveStructuredOracleEvaluationIdentityV2(authority.oracleInput)).toBe(baseline);
    expect(baseline).not.toBe(authority.caseDigest);
    expect(new Set([baseline, ...identities]).size).toBe(identities.length + 1);
  });
});

describe("structured oracle budget and wrapped write semantics", () => {
  it("accepts exact static precharges and atomically rejects the first excess", () => {
    const validation = validateStructuredGeneratorProgram(
      fixture.fixedArray,
      fixture.generationBudget,
    );
    if (!validation.ok) throw new TypeError("expected structured validation");
    const inputNodes = validation.usage["ir-nodes"];
    const expressionDepth = validation.usage["expression-depth"];
    expect(
      evaluateStructuredOracleProgram(
        oracleInput(fixture.fixedArray, "main", [], {
          budget: { ...fixture.oracleBudget, inputNodes, expressionDepth },
        }),
      ),
    ).toMatchObject({ ok: true, outcome: "modeled" });
    for (const budget of [
      { ...fixture.oracleBudget, inputNodes: inputNodes - 1n },
      { ...fixture.oracleBudget, expressionDepth: expressionDepth - 1n },
    ]) {
      expect(
        evaluateStructuredOracleProgram(oracleInput(fixture.fixedArray, "main", [], { budget })),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: "oracle.budget", path: "/module" }],
      });
    }
  });

  it("accounts exactly for initial memory, frames, runtime steps, reads, and writes", () => {
    const scalarModule = {
      kind: "module",
      path: ["Budget"],
      constants: [],
      functions: [
        {
          kind: "function",
          name: "main",
          parameters: [],
          returnType: "byte",
          body: [{ kind: "return", value: { kind: "literal", type: "byte", value: 1n } }],
        },
      ],
    } as const;
    expect(
      evaluateStructuredOracleProgram(
        oracleInput(scalarModule, "main", [], {
          budget: { ...fixture.oracleBudget, evaluationSteps: 2n, frames: 1n },
        }),
      ),
    ).toMatchObject({ ok: true, outcome: "modeled" });
    for (const budget of [
      { ...fixture.oracleBudget, evaluationSteps: 1n },
      { ...fixture.oracleBudget, frames: 1n },
    ]) {
      const module = budget.frames === 1n ? fixture.nestedCalls : scalarModule;
      expect(
        evaluateStructuredOracleProgram(oracleInput(module, "main", [], { budget })),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: "oracle.budget" }],
      });
    }

    const memory = { schemaVersion: 1, cells: [{ address: 0x1000n, value: 7n }] } as const;
    expect(
      evaluateStructuredOracleProgram(
        oracleInput(scalarModule, "main", [], {
          memory,
          budget: { ...fixture.oracleBudget, memoryCells: 1n },
        }),
      ),
    ).toMatchObject({ ok: true, outcome: "modeled" });
    expect(
      evaluateStructuredOracleProgram(
        oracleInput(scalarModule, "main", [], {
          memory: {
            schemaVersion: 1,
            cells: [
              { address: 0x1000n, value: 7n },
              { address: 0x1001n, value: 8n },
            ],
          },
          budget: { ...fixture.oracleBudget, memoryCells: 1n },
        }),
      ),
    ).toMatchObject({ ok: false, diagnostics: [{ code: "oracle.budget" }] });
    expect(
      evaluateStructuredOracleProgram(
        oracleInput(
          fixture.computedOutOfBounds,
          "read",
          [binding("/functions/0/parameters/0", 0x20n)],
          {
            arrayPlacement: {
              revision: "structured-array-placement-v1",
              bindings: [{ arrayName: "values", baseAddress: 0xfff0 }],
            },
            budget: { ...fixture.oracleBudget, effects: 1n },
          },
        ),
      ),
    ).toMatchObject({ ok: true, outcome: "modeled", observation: { effects: [{ kind: "read" }] } });
  });

  it("uses the same scaled wrapped address for computed OOB writes, memory, and trace", () => {
    const module = {
      kind: "module",
      path: ["WriteWrap"],
      constants: [],
      functions: [
        {
          kind: "function",
          name: "main",
          parameters: [{ kind: "scalar-parameter", name: "i", type: "byte" }],
          returnType: "void",
          body: [
            { kind: "array", name: "values", elementType: "word", extent: 4, initializer: [] },
            {
              kind: "assign",
              target: {
                kind: "index-target",
                type: "word",
                target: "values",
                index: { kind: "name", type: "byte", name: "i" },
              },
              value: { kind: "literal", type: "word", value: 0x1234n },
            },
            { kind: "return" },
          ],
        },
      ],
    } as const;
    const result = evaluateStructuredOracleProgram(
      oracleInput(module, "main", [binding("/functions/0/parameters/0", 0x20n)], {
        arrayPlacement: {
          revision: "structured-array-placement-v1",
          bindings: [{ arrayName: "values", baseAddress: 0xfff0 }],
        },
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      outcome: "modeled",
      observation: {
        effects: [{ kind: "write", width: 2, address: 0x30n, value: 0x1234n }],
        finalMemory: [
          { address: 0x30n, value: 0x34n },
          { address: 0x31n, value: 0x12n },
        ],
      },
      arrayAccessTrace: [{ index: 0x20n, effectiveAddress: 0x30n }],
    });
  });
});
