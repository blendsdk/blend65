import { describe, expect, it } from "vitest";

import { isGenIdentifier } from "./generator-ir.js";
import type { GenForStatement, GenStructuredModule } from "./generator-ir.js";
import type { PreparedSemanticRelationRequestV2 } from "./semantic-relation-input.js";
import { applyStructuredLoopUnrollingTransform } from "./semantic-relation-transform.js";
import {
  resolveStructuredCaseAuthorityV1,
  type StructuredCaseAuthorityV1,
} from "./structured-case-families.js";
import { evaluateStructuredOracleProgram } from "./structured-oracle-evaluator.js";
import { validateStructuredGeneratorProgram } from "./structured-ir-validation.js";
import { createStructuredGeneratedProgramsSpecFixture } from "./test-fixtures/structured-generated-programs-spec-fixture.js";

const fixture = createStructuredGeneratedProgramsSpecFixture();

function validationBudget(additions: Readonly<Record<string, unknown>> = {}) {
  return { ...fixture.generationBudget, ...additions };
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

function requireAuthority(caseId: string): StructuredCaseAuthorityV1 {
  const result = resolveStructuredCaseAuthorityV1(caseId);
  if (!result.ok) throw new TypeError("expected structured case authority");
  return result.authority;
}

describe("structured semantic hardening", () => {
  it("memoizes forward constant dependencies and charges each declaration tree once", () => {
    const constants = Array.from({ length: 80 }, (_, index) => ({
      kind: "const" as const,
      name: `C${index}`,
      type: "byte" as const,
      value:
        index === 79
          ? { kind: "literal" as const, type: "byte" as const, value: 1n }
          : {
              kind: "binary" as const,
              type: "byte" as const,
              operator: "|" as const,
              left: { kind: "name" as const, type: "byte" as const, name: `C${index + 1}` },
              right: { kind: "name" as const, type: "byte" as const, name: `C${index + 1}` },
            },
    }));
    const module = {
      kind: "module",
      path: ["ConstantDag"],
      constants,
      functions: [
        {
          kind: "function",
          name: "main",
          parameters: [],
          returnType: "byte",
          body: [{ kind: "return", value: { kind: "name", type: "byte", name: "C0" } }],
        },
      ],
    };
    const generationBudget = validationBudget({
      maxDeclarations: 256,
      maxIrNodes: 2_048,
      maxExpressionDepth: 256,
    });
    expect(
      evaluateStructuredOracleProgram(
        oracleInput(module, "main", [], {
          generationBudget,
          budget: { ...fixture.oracleBudget, evaluationSteps: 320n },
        }),
      ),
    ).toMatchObject({ ok: true, outcome: "modeled", observation: { returnValue: { value: 1n } } });
    expect(
      evaluateStructuredOracleProgram(
        oracleInput(module, "main", [], {
          generationBudget,
          budget: { ...fixture.oracleBudget, evaluationSteps: 319n },
        }),
      ),
    ).toMatchObject({ ok: false, diagnostics: [{ code: "oracle.budget" }] });
  });

  it("folds constant expression trees before fixed-array bounds validation", () => {
    const module = {
      kind: "module",
      path: ["FoldedIndex"],
      constants: [
        {
          kind: "const",
          name: "INDEX",
          type: "byte",
          value: {
            kind: "binary",
            type: "byte",
            operator: "+",
            left: { kind: "literal", type: "byte", value: 2n },
            right: { kind: "literal", type: "byte", value: 2n },
          },
        },
      ],
      functions: [
        {
          kind: "function",
          name: "main",
          parameters: [],
          returnType: "byte",
          body: [
            { kind: "array", name: "values", elementType: "byte", extent: 4, initializer: [] },
            {
              kind: "return",
              value: {
                kind: "index",
                type: "byte",
                target: "values",
                index: { kind: "name", type: "byte", name: "INDEX" },
              },
            },
          ],
        },
      ],
    } as const;
    expect(validateStructuredGeneratorProgram(module, fixture.generationBudget)).toMatchObject({
      ok: false,
      diagnostics: [
        {
          reason: "array-constant-index-out-of-range",
          path: "/functions/0/body/1/value/index",
        },
      ],
    });
  });

  it("memoizes shared call subgraphs and reports the first edge belonging to a cycle", () => {
    const functions = Array.from({ length: 28 }, (_, index) => ({
      kind: "function" as const,
      name: `f${index}`,
      parameters: [],
      returnType: "void" as const,
      body:
        index === 27
          ? [{ kind: "return" as const }]
          : [
              { kind: "call-statement" as const, callee: `f${index + 1}`, arguments: [] },
              { kind: "call-statement" as const, callee: `f${index + 1}`, arguments: [] },
              { kind: "return" as const },
            ],
    }));
    expect(
      validateStructuredGeneratorProgram(
        { kind: "module", path: ["SharedGraph"], constants: [], functions },
        validationBudget({ maxDeclarations: 256, maxIrNodes: 2_048, maxStatements: 2_048 }),
      ),
    ).toMatchObject({ ok: true });

    const cycle = {
      kind: "module",
      path: ["CyclePath"],
      constants: [],
      functions: ["b", "c", "b"].map((callee, index) => ({
        kind: "function",
        name: ["a", "b", "c"][index],
        parameters: [],
        returnType: "void",
        body: [{ kind: "call-statement", callee, arguments: [] }, { kind: "return" }],
      })),
    };
    expect(validateStructuredGeneratorProgram(cycle, fixture.generationBudget)).toMatchObject({
      ok: false,
      diagnostics: [{ reason: "call-cycle", path: "/functions/1/body/0/callee" }],
    });
  });

  it("rejects accessors, exotic prototypes, and cycles without invoking caller code", () => {
    let getterCalls = 0;
    const accessor = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(accessor, {
      kind: { value: "module", enumerable: true },
      path: { value: ["Hostile"], enumerable: true },
      constants: { value: [], enumerable: true },
      functions: {
        enumerable: true,
        get: () => {
          getterCalls += 1;
          return [];
        },
      },
    });
    const exotic = Object.create({ inherited: true });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    for (const value of [accessor, exotic, cyclic]) {
      expect(validateStructuredGeneratorProgram(value, fixture.generationBudget)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "generation-input-invalid" }],
      });
    }
    expect(getterCalls).toBe(0);
  });

  it("normalizes only same-signed widening at every scalar storage boundary", () => {
    const widened = {
      kind: "module",
      path: ["Widening"],
      constants: [],
      functions: [
        {
          kind: "function",
          name: "helper",
          parameters: [{ kind: "scalar-parameter", name: "input", type: "word" }],
          returnType: "word",
          body: [{ kind: "return", value: { kind: "literal", type: "byte", value: 7n } }],
        },
        {
          kind: "function",
          name: "main",
          parameters: [],
          returnType: "word",
          body: [
            {
              kind: "local",
              name: "wide",
              type: "word",
              initializer: { kind: "literal", type: "byte", value: 1n },
            },
            { kind: "assign", target: "wide", value: { kind: "literal", type: "byte", value: 2n } },
            {
              kind: "return",
              value: {
                kind: "call",
                type: "word",
                callee: "helper",
                arguments: [{ kind: "literal", type: "byte", value: 3n }],
              },
            },
          ],
        },
      ],
    } as const;
    expect(evaluateStructuredOracleProgram(oracleInput(widened))).toMatchObject({
      ok: true,
      outcome: "modeled",
      observation: { returnValue: { type: "word", value: 7n } },
    });
    const narrowing = {
      ...widened,
      functions: [
        {
          kind: "function",
          name: "main",
          parameters: [],
          returnType: "byte",
          body: [
            {
              kind: "local",
              name: "small",
              type: "byte",
              initializer: { kind: "literal", type: "word", value: 1n },
            },
            { kind: "return", value: { kind: "literal", type: "byte", value: 0n } },
          ],
        },
      ],
    } as const;
    expect(validateStructuredGeneratorProgram(narrowing, fixture.generationBudget)).toMatchObject({
      ok: false,
      diagnostics: [{ reason: "initializer-type-mismatch" }],
    });
    const signed = {
      kind: "module",
      path: ["SignedWidening"],
      constants: [],
      functions: [
        {
          kind: "function",
          name: "helper",
          parameters: [{ kind: "scalar-parameter", name: "input", type: "sword" }],
          returnType: "sword",
          body: [{ kind: "return", value: { kind: "literal", type: "sbyte", value: -2n } }],
        },
        {
          kind: "function",
          name: "main",
          parameters: [],
          returnType: "sword",
          body: [
            {
              kind: "return",
              value: {
                kind: "call",
                type: "sword",
                callee: "helper",
                arguments: [{ kind: "literal", type: "sbyte", value: -1n }],
              },
            },
          ],
        },
      ],
    } as const;
    expect(evaluateStructuredOracleProgram(oracleInput(signed))).toMatchObject({
      ok: true,
      outcome: "modeled",
      observation: { returnValue: { type: "sword", value: -2n } },
    });
    const crossSigned = {
      ...narrowing,
      functions: [
        {
          kind: "function",
          name: "main",
          parameters: [],
          returnType: "word",
          body: [
            {
              kind: "local",
              name: "invalid",
              type: "word",
              initializer: { kind: "literal", type: "sbyte", value: -1n },
            },
            { kind: "return", value: { kind: "literal", type: "word", value: 0n } },
          ],
        },
      ],
    } as const;
    expect(validateStructuredGeneratorProgram(crossSigned, fixture.generationBudget)).toMatchObject(
      { ok: false, diagnostics: [{ reason: "initializer-type-mismatch" }] },
    );
  });

  it("charges one runtime step per actual dynamic-loop iteration", () => {
    const parameterBindings = [
      { kind: "parameter-value", parameterPath: "/functions/0/parameters/0", value: 0n },
      { kind: "parameter-value", parameterPath: "/functions/0/parameters/1", value: 3n },
    ] as const;
    const input = (evaluationSteps: bigint) =>
      oracleInput(fixture.dynamicLoopCases.actualThree, "main", parameterBindings, {
        budget: { ...fixture.oracleBudget, evaluationSteps },
      });
    expect(evaluateStructuredOracleProgram(input(4n))).toMatchObject({
      ok: true,
      outcome: "modeled",
      loopTrace: [{ value: 0n }, { value: 1n }, { value: 2n }],
    });
    expect(evaluateStructuredOracleProgram(input(3n))).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.budget" }],
    });
  });

  it("installs authenticated runtime-index bindings into both case and oracle authority", () => {
    const authority = requireAuthority("case.structured.runtime-wrap-oracle-v1");
    expect(authority.generatedCase.parameterBindings).toEqual([
      { kind: "parameter-value", parameterPath: "/functions/0/parameters/0", value: 0x20n },
    ]);
    expect(authority.oracleInput.parameterBindings).toEqual(
      authority.generatedCase.parameterBindings,
    );
    expect(evaluateStructuredOracleProgram(authority.oracleInput)).toMatchObject({
      ok: true,
      outcome: "modeled",
      arrayAccessTrace: [{ index: 0x20n, effectiveAddress: 0x10n }],
    });
  });

  it("rejects loop flattening when repeated body locals lose their iteration scope", () => {
    const original = requireAuthority("case.structured.for-until-v1");
    const originalFunction = original.oracleInput.module.functions[0];
    const originalLoop = originalFunction?.body[1];
    if (originalFunction === undefined || originalLoop?.kind !== "for") {
      throw new TypeError("expected finite loop authority");
    }
    const localName = "iteration_value";
    if (!isGenIdentifier(localName)) throw new TypeError("expected identifier");
    const selectedLoop: GenForStatement = Object.freeze({
      ...originalLoop,
      body: Object.freeze([
        Object.freeze({
          kind: "local" as const,
          name: localName,
          type: "byte" as const,
          initializer: Object.freeze({
            kind: "literal" as const,
            type: "byte" as const,
            value: 1n,
          }),
        }),
      ]),
    });
    const module: GenStructuredModule = Object.freeze({
      ...original.oracleInput.module,
      functions: Object.freeze([
        Object.freeze({
          ...originalFunction,
          body: Object.freeze([
            originalFunction.body[0]!,
            selectedLoop,
            ...originalFunction.body.slice(2),
          ]),
        }),
      ]),
    });
    expect(validateStructuredGeneratorProgram(module, fixture.generationBudget)).toMatchObject({
      ok: true,
    });
    const authority: StructuredCaseAuthorityV1 = Object.freeze({
      ...original,
      generatedCase: Object.freeze({
        ...original.generatedCase,
        projection: Object.freeze({ kind: "structured", module }),
      }),
      oracleInput: Object.freeze({ ...original.oracleInput, module }),
    });
    const request = Object.freeze({
      schemaVersion: 2 as const,
      handlerId: "transform.semantic-relations" as const,
      relationId: "relation.loop-unrolling" as const,
      sourceProvenance: authority.sourceProvenance,
      sourceCase: authority.generatedCase,
      entryFunction: authority.oracleInput.entryFunction,
      selectionPath: "/functions/0/body/1",
      variantId: "unroll-exact-domain-v1" as const,
      memory: authority.oracleInput.memory,
      budget: authority.oracleInput.budget,
      generationBudget: authority.oracleInput.generationBudget,
    });
    const prepared: PreparedSemanticRelationRequestV2 = Object.freeze({
      request,
      authority,
      selectedLoop,
      functionIndex: 0,
      statementIndex: 1,
    });
    const result = applyStructuredLoopUnrollingTransform(
      prepared,
      Object.freeze([
        Object.freeze({
          loopPath: request.selectionPath,
          counter: selectedLoop.counter,
          value: 0n,
        }),
        Object.freeze({
          loopPath: request.selectionPath,
          counter: selectedLoop.counter,
          value: 1n,
        }),
      ]),
    );
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.relation.violated", path: "/transformedCase" }],
    });
  });
});
