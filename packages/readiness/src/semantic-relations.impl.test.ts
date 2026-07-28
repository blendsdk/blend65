import { beforeAll, describe, expect, it } from "vitest";

import {
  allOnesForType,
  constantsAreIndependent,
  declaredRelationNames,
  freshRelationName,
  functionReferencesName,
  isPureRelationExpression,
  localInitializerDependenciesAreLiftable,
  localIsReassigned,
  relationExpressionNames,
  resolveDeclarationSelection,
  resolveExpressionSelection,
  selectedExpression,
} from "./semantic-relation-analysis.js";
import {
  compareSemanticRelationObservations,
  semanticRelationComparatorWitness,
} from "./semantic-relation-compare.js";
import { runWithSemanticRelationFault } from "./semantic-relation-conformance.js";
import { evaluateOracleProgramWithLocalCapture } from "./oracle-evaluator.js";
import {
  freezeSemanticRelationValue,
  snapshotSemanticRelationValue,
} from "./semantic-relation-freeze.js";
import {
  isSemanticRelationResult,
  prepareSemanticRelationRequest,
  type PreparedSemanticRelationRequestV1,
} from "./semantic-relation-input.js";
import type { SemanticRelationRequestV1 } from "./semantic-relation-model.js";
import {
  applySemanticRelationTransform,
  preflightSemanticRelationTransformBudget,
} from "./semantic-relation-transform.js";
import { diagnosticContext, evaluateSemanticRelation } from "./semantic-relations.js";
import { createSemanticRelationsSpecFixture } from "./test-fixtures/semantic-relations-spec-fixture.js";
import { validateGeneratorIr } from "./index.js";
import type {
  GeneratedModeledCase,
  GenModule,
  InvalidSourceTransform,
  OracleObservationV1,
  ScalarType,
} from "./index.js";

type Fixture = Awaited<ReturnType<typeof createSemanticRelationsSpecFixture>>;

let fixture: Fixture;

function validRequest(
  overrides: Partial<SemanticRelationRequestV1> = {},
): SemanticRelationRequestV1 {
  const source = fixture.valid;
  return {
    schemaVersion: 1,
    handlerId: "transform.semantic-relations",
    relationId: "relation.identifier-renaming",
    sourceProvenance: source.sourceProvenance,
    sourceCase: source.sourceCase,
    entryFunction: source.entryFunction,
    selectionPath: "/functions/0/parameters/0",
    variantId: "fresh-sibling-v1",
    memory: source.memory,
    budget: fixture.budget,
    ...overrides,
  };
}

function validModule(): GenModule {
  const projection = fixture.valid.sourceCase.projection;
  if (projection.kind !== "valid") throw new TypeError("expected valid relation fixture");
  return projection.module;
}

function analysisModule(): GenModule {
  const result = validateGeneratorIr({
    kind: "module",
    path: ["analysis"],
    constants: [],
    functions: [
      {
        kind: "function",
        name: "main",
        parameters: [],
        returnType: "byte",
        body: [
          {
            kind: "local",
            name: "local_value",
            type: "byte",
            initializer: { kind: "literal", type: "byte", value: 1n },
          },
          {
            kind: "assign",
            target: "local_value",
            value: { kind: "literal", type: "byte", value: 2n },
          },
          {
            kind: "memory-write",
            width: 1,
            address: { kind: "literal", type: "word", value: 0x1000n },
            value: { kind: "name", type: "byte", name: "local_value" },
          },
          {
            kind: "local",
            name: "compound",
            type: "word",
            initializer: {
              kind: "unary",
              type: "word",
              operator: "~",
              operand: {
                kind: "binary",
                type: "word",
                operator: "+",
                left: { kind: "literal", type: "word", value: 1n },
                right: {
                  kind: "memory-read",
                  type: "word",
                  width: 2,
                  address: { kind: "literal", type: "word", value: 0x1000n },
                },
              },
            },
          },
          {
            kind: "return",
            value: { kind: "name", type: "byte", name: "local_value" },
          },
        ],
      },
      {
        kind: "function",
        name: "reader",
        parameters: [],
        returnType: "word",
        body: [
          {
            kind: "return",
            value: {
              kind: "memory-read",
              type: "word",
              width: 2,
              address: { kind: "literal", type: "word", value: 0x1000n },
            },
          },
        ],
      },
      {
        kind: "function",
        name: "noop",
        parameters: [],
        returnType: "void",
        body: [{ kind: "return" }],
      },
    ],
  });
  if (!result.ok) throw new TypeError(JSON.stringify(result.diagnostics));
  return result.module;
}

function preparedAnalysisRequest(
  relationId: SemanticRelationRequestV1["relationId"],
  selectionPath: string,
  variantId: string,
): PreparedSemanticRelationRequestV1 {
  const prepared = prepareSemanticRelationRequest(fixture.valid.suite, validRequest());
  if (isSemanticRelationResult(prepared)) throw new TypeError("expected prepared relation request");
  const module = analysisModule();
  const entryFunction = module.functions[0];
  if (entryFunction === undefined) throw new TypeError("expected analysis entry");
  return Object.freeze({
    ...prepared,
    request: Object.freeze({
      ...prepared.request,
      relationId,
      selectionPath,
      variantId,
    }),
    entryFunction,
    sourceModule: module,
  });
}

beforeAll(async () => {
  fixture = await createSemanticRelationsSpecFixture();
});

describe("semantic relation input hardening", () => {
  it("rejects a structurally forged suite capability", () => {
    // @ts-expect-error A plain object is intentional hostile runtime input.
    expect(evaluateSemanticRelation({}, validRequest())).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.authority.not-accepted", path: "/suite" }],
    });
  });

  it("rejects an accessor-bearing request without invoking caller code", () => {
    let invoked = false;
    const hostile = { ...validRequest() };
    Object.defineProperty(hostile, "sourceCase", {
      enumerable: true,
      get() {
        invoked = true;
        return fixture.valid.sourceCase;
      },
    });

    expect(evaluateSemanticRelation(fixture.valid.suite, hostile)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid", path: "/sourceCase" }],
    });
    expect(invoked).toBe(false);
  });

  it("rejects unknown fields, non-canonical pointers, and relation-variant mismatches", () => {
    expect(
      evaluateSemanticRelation(fixture.valid.suite, { ...validRequest(), extra: true }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid", path: "" }],
    });
    expect(
      evaluateSemanticRelation(
        fixture.valid.suite,
        validRequest({ selectionPath: "/functions//0" }),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.relation.invalid", path: "/selectionPath" }],
    });
    expect(
      evaluateSemanticRelation(
        fixture.valid.suite,
        validRequest({ variantId: "introduce-local-v1" }),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.relation.invalid", path: "/variantId" }],
    });
  });

  it("closes malformed discriminators, entry names, budgets, memory, and replay identities", () => {
    expect(
      evaluateSemanticRelation(fixture.valid.suite, {
        ...validRequest(),
        relationId: "relation.unknown",
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.relation.invalid", path: "/relationId" }],
    });
    expect(
      evaluateSemanticRelation(fixture.valid.suite, validRequest({ entryFunction: "not-valid!" })),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid", path: "/entryFunction" }],
    });
    expect(
      evaluateSemanticRelation(
        fixture.valid.suite,
        validRequest({ entryFunction: "missing_entry" }),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid", path: "/entryFunction" }],
    });
    expect(
      evaluateSemanticRelation(
        fixture.valid.suite,
        validRequest({ budget: { ...fixture.budget, effects: -1n } }),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid", path: "/budget/effects" }],
    });
    expect(
      evaluateSemanticRelation(
        fixture.valid.suite,
        validRequest({ memory: { schemaVersion: 1, cells: [{ address: -1n, value: 0n }] } }),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid", path: "/memory/cells/0/address" }],
    });
    expect(
      evaluateSemanticRelation(fixture.valid.suite, {
        ...validRequest(),
        sourceProvenance: {
          ...fixture.valid.sourceProvenance,
          caseIdentity: {
            ...fixture.valid.sourceProvenance.caseIdentity,
            digest: `sha256:${"0".repeat(64)}`,
          },
        },
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid" }],
    });
  });

  it("enforces source and transformed structural budgets independently", () => {
    expect(
      evaluateSemanticRelation(
        fixture.valid.suite,
        validRequest({ budget: { ...fixture.budget, inputNodes: 1n } }),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.budget", path: "" }],
    });
    expect(
      evaluateSemanticRelation(
        fixture.valid.suite,
        validRequest({ budget: { ...fixture.budget, transformedNodes: 1n } }),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.budget", path: "/transformedCase" }],
    });
  });

  it("returns detached deeply immutable source and transformed snapshots", () => {
    const result = evaluateSemanticRelation(fixture.valid.suite, validRequest());
    expect(result).toMatchObject({ ok: true, outcome: "modeled" });
    if (!result.ok || result.outcome !== "modeled") throw new TypeError("expected modeled result");

    expect(result.sourceCase).not.toBe(fixture.valid.sourceCase);
    expect(Object.isFrozen(result.sourceCase.projection)).toBe(true);
    expect(Object.isFrozen(result.sourceCase.parameterBindings)).toBe(true);
    expect(Object.isFrozen(result.transformedCase.projection)).toBe(true);
    expect(Object.isFrozen(result.transformedCase.parameterBindings)).toBe(true);
  });

  it("returns inapplicable for well-formed selections outside each relation domain", () => {
    const vectors = [
      validRequest({ selectionPath: "/functions/0/body/13" }),
      validRequest({
        relationId: "relation.literal-to-local",
        selectionPath: "/functions/0/body/2/initializer",
        variantId: "introduce-local-v1",
      }),
      validRequest({
        relationId: "relation.algebraic-identity",
        selectionPath: "/functions/0/body/13/initializer",
        variantId: "add-zero-right",
      }),
      validRequest({
        relationId: "relation.independent-declaration-reordering",
        selectionPath: "/constants/2",
        variantId: "swap-independent-constants-v1",
      }),
    ];
    for (const candidate of vectors) {
      expect(evaluateSemanticRelation(fixture.valid.suite, candidate)).toMatchObject({
        ok: true,
        outcome: "relation-inapplicable",
      });
    }
  });

  it("applies expression rewrites to assignment and return-value fields", () => {
    for (const selectionPath of ["/functions/0/body/4/value", "/functions/0/body/13/value"]) {
      expect(
        evaluateSemanticRelation(
          fixture.valid.suite,
          validRequest({
            relationId: "relation.algebraic-identity",
            selectionPath,
            variantId: "add-zero-right",
          }),
        ),
      ).toMatchObject({ ok: true, outcome: "modeled" });
    }
  });

  it("propagates an evaluator budget result without misclassifying the relation", () => {
    expect(
      evaluateSemanticRelation(
        fixture.valid.suite,
        validRequest({ budget: { ...fixture.budget, evaluationSteps: 1n } }),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.budget" }],
    });
  });
});

describe("semantic relation analysis implementation", () => {
  it("resolves every declaration kind and closes malformed or missing indices", () => {
    const module = validModule();
    expect(resolveDeclarationSelection(module, "/constants/0")).toEqual({
      kind: "constant",
      constantIndex: 0,
    });
    expect(resolveDeclarationSelection(module, "/functions/0")).toEqual({
      kind: "function",
      functionIndex: 0,
    });
    expect(resolveDeclarationSelection(module, "/functions/0/parameters/0")).toEqual({
      kind: "parameter",
      functionIndex: 0,
      parameterIndex: 0,
    });
    expect(resolveDeclarationSelection(module, "/functions/0/body/0")).toEqual({
      kind: "local",
      functionIndex: 0,
      statementIndex: 0,
    });
    for (const path of [
      "functions/0",
      "/unknown/0",
      "/functions/01",
      "/functions/1",
      "/functions/0/parameters/9",
      "/functions/0/body/x",
      "/functions/0/body/13",
      "/functions/0/unknown/0",
    ]) {
      expect(resolveDeclarationSelection(module, path), path).toBeUndefined();
    }
  });

  it("resolves each expression-bearing statement shape and rejects mismatched fields", () => {
    const module = analysisModule();
    const paths = [
      "/functions/0/body/0/initializer",
      "/functions/0/body/1/value",
      "/functions/0/body/2/value",
      "/functions/0/body/2/address",
      "/functions/0/body/3/initializer/operand/left",
      "/functions/0/body/3/initializer/operand/right/address",
      "/functions/0/body/4/value",
    ] as const;
    for (const path of paths) {
      const selection = resolveExpressionSelection(module, path);
      expect(selection, path).toBeDefined();
      if (selection !== undefined)
        expect(selectedExpression(module, selection), path).toBeDefined();
    }
    for (const path of [
      "/functions/0/body/0/value",
      "/functions/0/body/1/initializer",
      "/constants/x/value",
      "/constants/99/value",
      "/constants/0/value/operand",
      "/functions/0/body/0/address",
      "/functions/0/body/1/address",
      "/functions/0/body/2/initializer",
      "/functions/0/body/3/initializer/left",
      "/functions/0/body/3/initializer/operand/address",
      "/functions/x/body/0/value",
      "/functions/3/body/0/value",
      "/functions/0/body/9/value",
      "/functions/0/body/0/unknown",
    ]) {
      expect(resolveExpressionSelection(module, path), path).toBeUndefined();
    }
    expect(resolveExpressionSelection(validModule(), "/constants/0/value/operand")).toBeUndefined();
    expect(
      selectedExpression(module, {
        kind: "constant",
        constantIndex: 99,
        expressionPath: [],
      }),
    ).toBeUndefined();
    expect(
      selectedExpression(module, {
        kind: "statement",
        functionIndex: 0,
        statementIndex: 0,
        field: "address",
        expressionPath: [],
      }),
    ).toBeUndefined();
    expect(
      selectedExpression(module, {
        kind: "statement",
        functionIndex: 0,
        statementIndex: 3,
        field: "initializer",
        expressionPath: ["left"],
      }),
    ).toBeUndefined();
  });

  it("walks purity, dependency, reassignment, reference, and scalar-identity branches", () => {
    const module = validModule();
    const fn = module.functions[0];
    if (fn === undefined) throw new TypeError("expected fixture function");
    const compoundStatement = analysisModule().functions[0]?.body[3];
    if (compoundStatement?.kind !== "local") throw new TypeError("expected compound initializer");
    const compound = compoundStatement.initializer;
    const firstConstant = module.constants[0];
    const returnStatement = fn.body.at(-1);
    if (firstConstant === undefined || returnStatement?.kind !== "return") {
      throw new TypeError("expected fixture dependency expressions");
    }

    expect(isPureRelationExpression(compound)).toBe(false);
    expect(relationExpressionNames(compound)).toEqual(new Set());
    expect(declaredRelationNames(module)).toEqual(
      expect.objectContaining({ size: expect.any(Number) }),
    );
    expect(freshRelationName("first", new Set(["first_relation1"]))).toBe("first_relation2");
    expect(localIsReassigned(fn, "reassigned_local", 3)).toBe(true);
    expect(localIsReassigned(fn, "lift_me", 0)).toBe(false);
    expect(localInitializerDependenciesAreLiftable(module, fn, firstConstant.value)).toBe(true);
    if (returnStatement.value === undefined) throw new TypeError("expected return expression");
    expect(localInitializerDependenciesAreLiftable(module, fn, returnStatement.value)).toBe(false);
    expect(constantsAreIndependent(module, 0, 1)).toBe(true);
    expect(constantsAreIndependent(module, 2, 3)).toBe(false);
    expect(constantsAreIndependent(module, 99, 100)).toBe(false);
    expect(functionReferencesName(fn, "first")).toBe(true);
    expect(functionReferencesName(fn, "absent")).toBe(false);
    const scalarTypes: readonly ScalarType[] = ["byte", "sbyte", "word", "sword", "boolean"];
    expect(scalarTypes.map(allOnesForType)).toEqual([255n, -1n, 65_535n, -1n, undefined]);
  });

  it("closes extreme selection and fresh-name paths without recursion", () => {
    const module = validModule();
    expect(resolveDeclarationSelection(module, "/constants/99")).toBeUndefined();
    expect(resolveDeclarationSelection(module, "/functions/9007199254740992")).toBeUndefined();
    expect(resolveExpressionSelection(module, "/functions/0/body/9007199254740992/value")).toBe(
      undefined,
    );
    const maximumFresh = freshRelationName("x".repeat(64), new Set());
    expect(maximumFresh).toMatch(/^x+_relation1$/u);
    expect(maximumFresh).toHaveLength(64);
    expect(
      freshRelationName(
        "occupied",
        new Set(Array.from({ length: 1_000 }, (_, index) => `occupied_relation${index + 1}`)),
      ),
    ).toBeUndefined();

    const voidResult = validateGeneratorIr({
      kind: "module",
      path: ["void_analysis"],
      constants: [],
      functions: [
        {
          kind: "function",
          name: "noop",
          parameters: [],
          returnType: "void",
          body: [{ kind: "return" }],
        },
      ],
    });
    if (!voidResult.ok) throw new TypeError("expected void analysis module");
    const fn = voidResult.module.functions[0];
    if (fn === undefined) throw new TypeError("expected void function");
    expect(functionReferencesName(fn, "absent")).toBe(false);
    const analysisFunction = analysisModule().functions[0];
    if (analysisFunction === undefined) throw new TypeError("expected analysis function");
    expect(functionReferencesName(analysisFunction, "local_value")).toBe(true);
  });

  it("derives every diagnostic projection context and closes malformed paths", () => {
    const base = fixture.invalid.find(
      (candidate) => candidate.sourceCase.projection.kind === "invalid",
    )?.sourceCase;
    if (base === undefined || base.validity.kind !== "invalid") {
      throw new TypeError("expected invalid relation fixture");
    }
    const caseWith = (
      baseline: GenModule,
      transform: InvalidSourceTransform,
    ): GeneratedModeledCase => ({
      ...base,
      projection: { kind: "invalid", baseline, transform },
    });
    const sourceModule = validModule();
    const scalar = (expressionPath: string): InvalidSourceTransform => ({
      kind: "scalar-expression-replace",
      expressionPath,
      replacement: { kind: "integer-literal", value: 0n },
    });

    expect(diagnosticContext(fixture.valid.sourceCase)).toBeUndefined();
    expect(diagnosticContext(caseWith(sourceModule, scalar("/constants/0/value")))).toBe(
      "initializer",
    );
    expect(
      diagnosticContext(caseWith(sourceModule, scalar("/constants/99/value"))),
    ).toBeUndefined();
    expect(
      diagnosticContext(caseWith(sourceModule, scalar("/functions/0/body/0/initializer"))),
    ).toBe("initializer");
    expect(diagnosticContext(caseWith(sourceModule, scalar("/functions/0/body/4/value")))).toBe(
      "assignment",
    );
    expect(diagnosticContext(caseWith(sourceModule, scalar("/functions/0/body/13/value")))).toBe(
      "return-expression",
    );
    for (const path of [
      "functions/0/body/0/value",
      "/unknown/0",
      "/functions/x/body/0/value",
      "/functions/0/body/x/value",
      "/functions/0/body/0/unknown",
    ]) {
      expect(diagnosticContext(caseWith(sourceModule, scalar(path))), path).toBeUndefined();
    }

    const module = analysisModule();
    const argument = module.functions[1]?.body[0];
    if (argument?.kind !== "return" || argument.value === undefined) {
      throw new TypeError("expected intrinsic argument expression");
    }
    expect(
      diagnosticContext(
        caseWith(module, {
          kind: "intrinsic-argument-replace",
          callPath: "/functions/0/body/2",
          argumentIndex: 0,
          argument: argument.value,
        }),
      ),
    ).toBe("intrinsic-argument");
    expect(
      diagnosticContext(
        caseWith(module, {
          kind: "intrinsic-argument-replace",
          callPath: "/functions/1/body/0",
          argumentIndex: 0,
          argument: argument.value,
        }),
      ),
    ).toBe("intrinsic-argument");
    expect(
      diagnosticContext(
        caseWith(module, {
          kind: "intrinsic-argument-remove",
          callPath: "/functions/0/body/2",
          argumentIndex: 0,
        }),
      ),
    ).toBeUndefined();
  });

  it("revalidates every retained invalid-transform path family after rewriting", () => {
    const base = fixture.invalid[0]?.sourceCase;
    if (base === undefined || base.validity.kind !== "invalid") {
      throw new TypeError("expected invalid relation fixture");
    }
    const argument = {
      kind: "literal" as const,
      type: "byte" as const,
      value: 1n,
    };
    const vectors: readonly {
      module: GenModule;
      transform: InvalidSourceTransform;
      applicable: boolean;
    }[] = [
      {
        module: validModule(),
        transform: {
          kind: "parameter-binding-replace",
          parameterPath: "/functions/0/parameters/0",
          replacement: { kind: "integer-literal", value: 300n },
        },
        applicable: true,
      },
      {
        module: validModule(),
        transform: {
          kind: "parameter-binding-replace",
          parameterPath: "/functions/0/parameters/9",
          replacement: { kind: "integer-literal", value: 300n },
        },
        applicable: false,
      },
      {
        module: validModule(),
        transform: {
          kind: "scalar-expression-replace",
          expressionPath: "/constants/0/value",
          replacement: { kind: "integer-literal", value: 0n },
        },
        applicable: true,
      },
      {
        module: analysisModule(),
        transform: {
          kind: "scalar-expression-replace",
          expressionPath: "/functions/0/body/0/initializer",
          replacement: { kind: "integer-literal", value: 0n },
        },
        applicable: true,
      },
      {
        module: analysisModule(),
        transform: {
          kind: "scalar-expression-replace",
          expressionPath: "/functions/0/body/9/value",
          replacement: { kind: "integer-literal", value: 0n },
        },
        applicable: false,
      },
      {
        module: analysisModule(),
        transform: {
          kind: "intrinsic-argument-remove",
          callPath: "/functions/0/body/2",
          argumentIndex: 0,
        },
        applicable: true,
      },
      {
        module: analysisModule(),
        transform: {
          kind: "intrinsic-argument-insert",
          callPath: "/functions/0/body/2",
          argumentIndex: 2,
          argument,
        },
        applicable: true,
      },
      {
        module: analysisModule(),
        transform: {
          kind: "intrinsic-argument-replace",
          callPath: "/functions/1/body/0/value",
          argumentIndex: 0,
          argument,
        },
        applicable: true,
      },
      {
        module: analysisModule(),
        transform: {
          kind: "intrinsic-argument-remove",
          callPath: "/functions/0/body/2",
          argumentIndex: 2,
        },
        applicable: false,
      },
      {
        module: analysisModule(),
        transform: {
          kind: "intrinsic-argument-remove",
          callPath: "/functions/x/body/2",
          argumentIndex: 0,
        },
        applicable: false,
      },
    ];
    for (const { module, transform, applicable } of vectors) {
      const prepared = preparedAnalysisRequest(
        "relation.identifier-renaming",
        "/functions/0",
        "fresh-sibling-v1",
      );
      const sourceCase: GeneratedModeledCase = {
        ...base,
        projection: { kind: "invalid", baseline: module, transform },
      };
      const result = applySemanticRelationTransform({
        ...prepared,
        request: { ...prepared.request, sourceCase },
        sourceModule: module,
      });
      expect("outcome" in result, transform.kind).toBe(!applicable);
    }
  });

  it("rewrites internal assignment, memory-write, return, unary, and multi-function shapes", () => {
    const vectors = [
      preparedAnalysisRequest(
        "relation.algebraic-identity",
        "/functions/0/body/1/value",
        "add-zero-right",
      ),
      preparedAnalysisRequest(
        "relation.algebraic-identity",
        "/functions/0/body/2/value",
        "add-zero-right",
      ),
      preparedAnalysisRequest(
        "relation.algebraic-identity",
        "/functions/0/body/2/address",
        "add-zero-right",
      ),
      preparedAnalysisRequest(
        "relation.algebraic-identity",
        "/functions/0/body/3/initializer/operand/left",
        "add-zero-right",
      ),
      preparedAnalysisRequest(
        "relation.algebraic-identity",
        "/functions/1/body/0/value",
        "add-zero-right",
      ),
      preparedAnalysisRequest(
        "relation.identifier-renaming",
        "/functions/0/body/0",
        "fresh-sibling-v1",
      ),
    ];
    for (const prepared of vectors) {
      expect(applySemanticRelationTransform(prepared)).toMatchObject({ ok: true });
    }
    expect(
      applySemanticRelationTransform(
        preparedAnalysisRequest(
          "relation.local-to-parameter",
          "/functions/0/body/0",
          "lift-entry-local-v1",
        ),
        1n,
      ),
    ).toMatchObject({ ok: true });
  });

  it("supports algebraic identities in constant initializers", () => {
    expect(
      evaluateSemanticRelation(
        fixture.valid.suite,
        validRequest({
          relationId: "relation.algebraic-identity",
          selectionPath: "/constants/0/value",
          variantId: "add-zero-right",
        }),
      ),
    ).toMatchObject({ ok: true, outcome: "modeled" });
  });

  it("retains raw bindings when an invalid binding delta must remain replayable", () => {
    const source = fixture.invalid.find(
      (candidate) =>
        candidate.sourceCase.projection.kind === "invalid" &&
        candidate.sourceCase.projection.transform.kind === "parameter-binding-replace",
    );
    if (source === undefined) throw new TypeError("expected binding-invalid fixture");
    const result = evaluateSemanticRelation(source.suite, {
      ...validRequest(),
      sourceProvenance: source.sourceProvenance,
      sourceCase: source.sourceCase,
      entryFunction: source.entryFunction,
      memory: source.memory,
    });
    expect(result).toMatchObject({ ok: true, outcome: "modeled" });
    if (!result.ok || result.outcome !== "modeled") {
      throw new TypeError("expected modeled invalid rename");
    }
    expect(result.transformedCase.parameterBindings).toEqual(source.sourceCase.parameterBindings);
  });

  it("preflights local transformed-node budgets before source capture", () => {
    const prepared = prepareSemanticRelationRequest(
      fixture.valid.suite,
      validRequest({
        relationId: "relation.local-to-parameter",
        selectionPath: "/functions/0/body/0",
        variantId: "lift-entry-local-v1",
      }),
    );
    if (isSemanticRelationResult(prepared)) throw new TypeError("expected prepared local lift");
    expect(
      preflightSemanticRelationTransformBudget({
        ...prepared,
        request: {
          ...prepared.request,
          budget: { ...prepared.request.budget, transformedNodes: 0n },
        },
      }),
    ).toMatchObject({ ok: false, diagnostics: [{ code: "oracle.budget" }] });
    expect(
      preflightSemanticRelationTransformBudget(
        preparedAnalysisRequest(
          "relation.identifier-renaming",
          "/functions/0/body/0",
          "fresh-sibling-v1",
        ),
      ),
    ).toBeUndefined();
    expect(
      preflightSemanticRelationTransformBudget({
        ...prepared,
        request: { ...prepared.request, selectionPath: "/functions/0/parameters/0" },
      }),
    ).toBeUndefined();
    expect(
      preflightSemanticRelationTransformBudget({
        ...prepared,
        entryFunctionIndex: 1,
      }),
    ).toBeUndefined();
  });

  it("captures one entry local through the evaluator's single-pass integration seam", () => {
    const input = {
      schemaVersion: 1,
      module: validModule(),
      entryFunction: fixture.valid.entryFunction,
      parameterBindings: fixture.valid.sourceCase.parameterBindings,
      memory: fixture.valid.memory,
      budget: fixture.budget,
    };
    expect(evaluateOracleProgramWithLocalCapture(input, 0)).toMatchObject({
      result: { ok: true, outcome: "modeled" },
      capturedValue: { kind: "integer" },
    });
    expect(evaluateOracleProgramWithLocalCapture(input, 99)).toMatchObject({
      result: { ok: true, outcome: "modeled" },
    });
    expect(evaluateOracleProgramWithLocalCapture(input, -1)).toMatchObject({
      result: { ok: false, diagnostics: [{ code: "oracle.input.invalid" }] },
    });
    expect(evaluateOracleProgramWithLocalCapture({}, 0)).toMatchObject({
      result: { ok: false, diagnostics: [{ code: "oracle.input.invalid" }] },
    });
  });
});

describe("semantic relation fault isolation", () => {
  it("rejects a fault that is not correlated with its production path class", () => {
    expect(() =>
      runWithSemanticRelationFault(
        {
          schemaVersion: 1,
          pathId: "relation.identifier-renaming.precondition",
          faultId: "relation.fault.non-preserving-rewrite",
        },
        () => undefined,
      ),
    ).toThrow(TypeError);
  });

  it("keeps a concurrent baseline evaluation isolated from an awaited mutant scope", async () => {
    const mutant = runWithSemanticRelationFault(
      {
        schemaVersion: 1,
        pathId: "relation.identifier-renaming.comparator",
        faultId: "relation.fault.omit-required-observable",
      },
      async () => {
        await Promise.resolve();
        return evaluateSemanticRelation(fixture.valid.suite, validRequest());
      },
    );
    const baseline = Promise.resolve().then(() =>
      evaluateSemanticRelation(fixture.valid.suite, validRequest()),
    );

    const [mutantResult, baselineResult] = await Promise.all([mutant, baseline]);
    expect(mutantResult).toMatchObject({ ok: true, outcome: "modeled" });
    expect(baselineResult).toMatchObject({ ok: true, outcome: "modeled" });
    if (
      !mutantResult.ok ||
      mutantResult.outcome !== "modeled" ||
      !baselineResult.ok ||
      baselineResult.outcome !== "modeled"
    ) {
      throw new TypeError("expected modeled relation results");
    }
    expect(mutantResult.sourceObservation).not.toEqual(mutantResult.transformedObservation);
    expect(baselineResult.sourceObservation).toEqual(baselineResult.transformedObservation);
  });

  it("restores the baseline after a throwing fault-scoped callback", () => {
    expect(() =>
      runWithSemanticRelationFault(
        {
          schemaVersion: 1,
          pathId: "relation.identifier-renaming.precondition",
          faultId: "relation.fault.force-precondition-false",
        },
        () => {
          throw new Error("expected test failure");
        },
      ),
    ).toThrow("expected test failure");

    expect(evaluateSemanticRelation(fixture.valid.suite, validRequest())).toMatchObject({
      ok: true,
      outcome: "modeled",
    });
  });

  it("covers every typed-return comparator witness and its null projection branches", () => {
    const valueObservation = (
      type: Exclude<ScalarType, "boolean">,
      value: bigint,
    ): OracleObservationV1 => ({
      kind: "value-state",
      returnValue: { kind: "integer", type, value },
      effects: [],
      finalMemory: [],
    });
    const vectors = [
      ["byte", "sbyte", 1n],
      ["sbyte", "byte", -1n],
      ["word", "sword", 2n],
      ["sword", "word", -2n],
    ] as const;
    for (const [sourceType, witnessedType, value] of vectors) {
      const source = valueObservation(sourceType, value);
      const witnessed = runWithSemanticRelationFault(
        {
          schemaVersion: 1,
          pathId: "relation.algebraic-identity.comparator",
          faultId: "relation.fault.omit-required-observable",
        },
        () => semanticRelationComparatorWitness("relation.algebraic-identity", source),
      );
      expect(witnessed).toMatchObject({ returnValue: { type: witnessedType, value } });
      expect(
        runWithSemanticRelationFault(
          {
            schemaVersion: 1,
            pathId: "relation.algebraic-identity.comparator",
            faultId: "relation.fault.omit-required-observable",
          },
          () =>
            compareSemanticRelationObservations("relation.algebraic-identity", source, witnessed),
        ),
      ).toBe(true);
    }

    const empty: OracleObservationV1 = {
      kind: "value-state",
      returnValue: null,
      effects: [],
      finalMemory: [],
    };
    expect(semanticRelationComparatorWitness("relation.identifier-renaming", empty)).toBe(empty);
    const booleanObservation: OracleObservationV1 = {
      ...empty,
      returnValue: { kind: "boolean", type: "boolean", value: true },
    };
    const booleanWitness = runWithSemanticRelationFault(
      {
        schemaVersion: 1,
        pathId: "relation.identifier-renaming.comparator",
        faultId: "relation.fault.omit-required-observable",
      },
      () => semanticRelationComparatorWitness("relation.identifier-renaming", booleanObservation),
    );
    expect(booleanWitness).toMatchObject({ returnValue: { value: false } });
    expect(
      runWithSemanticRelationFault(
        {
          schemaVersion: 1,
          pathId: "relation.identifier-renaming.comparator",
          faultId: "relation.fault.omit-required-observable",
        },
        () =>
          compareSemanticRelationObservations(
            "relation.identifier-renaming",
            booleanObservation,
            booleanWitness,
          ),
      ),
    ).toBe(true);
    expect(compareSemanticRelationObservations("relation.identifier-renaming", empty, empty)).toBe(
      true,
    );
    expect(
      runWithSemanticRelationFault(
        {
          schemaVersion: 1,
          pathId: "relation.identifier-renaming.comparator",
          faultId: "relation.fault.omit-required-observable",
        },
        () =>
          compareSemanticRelationObservations(
            "relation.identifier-renaming",
            empty,
            valueObservation("byte", 0n),
          ),
      ),
    ).toBe(false);
  });

  it("compares closed diagnostic and binding projections for both invalid-capable relations", () => {
    const invalidObservations = fixture.invalid.map((source) => {
      const result = evaluateSemanticRelation(source.suite, {
        ...validRequest(),
        sourceProvenance: source.sourceProvenance,
        sourceCase: source.sourceCase,
        entryFunction: source.entryFunction,
        selectionPath:
          source.sourceCase.projection.kind === "invalid" &&
          source.sourceCase.projection.transform.kind === "parameter-binding-replace"
            ? "/functions/0/parameters/0"
            : "/functions/0",
        memory: source.memory,
      });
      if (!result.ok || result.outcome !== "modeled") {
        throw new TypeError("expected modeled invalid rename");
      }
      return result.sourceObservation;
    });
    const diagnostic = invalidObservations.find((item) => item.kind === "diagnostic");
    const binding = invalidObservations.find((item) => item.kind === "binding-rejection");
    if (diagnostic?.kind !== "diagnostic" || binding?.kind !== "binding-rejection") {
      throw new TypeError("expected both invalid observation families");
    }
    for (const relationId of [
      "relation.identifier-renaming",
      "relation.independent-declaration-reordering",
    ] as const) {
      expect(compareSemanticRelationObservations(relationId, diagnostic, diagnostic)).toBe(true);
      expect(compareSemanticRelationObservations(relationId, binding, binding)).toBe(true);
      expect(
        compareSemanticRelationObservations(relationId, diagnostic, {
          ...diagnostic,
          code: "E99999",
        }),
      ).toBe(false);
      expect(
        compareSemanticRelationObservations(relationId, binding, {
          ...binding,
          rejectionCode: "binding.value.type-invalid",
        }),
      ).toBe(false);
    }
  });

  it("kills non-preserving rewrites against invalid comparator-owned observations", () => {
    for (const source of fixture.invalid) {
      const selectionPath =
        source.sourceCase.projection.kind === "invalid" &&
        source.sourceCase.projection.transform.kind === "parameter-binding-replace"
          ? "/functions/0/parameters/0"
          : "/functions/0";
      const result = runWithSemanticRelationFault(
        {
          schemaVersion: 1,
          pathId: "relation.identifier-renaming.rewrite",
          faultId: "relation.fault.non-preserving-rewrite",
        },
        () =>
          evaluateSemanticRelation(source.suite, {
            ...validRequest(),
            sourceProvenance: source.sourceProvenance,
            sourceCase: source.sourceCase,
            entryFunction: source.entryFunction,
            selectionPath,
            memory: source.memory,
          }),
      );
      expect(result).toMatchObject({
        ok: false,
        diagnostics: [{ code: "oracle.relation.violated" }],
      });
    }
  });

  it("makes a void fallthrough rewrite fault observably non-preserving", () => {
    const prepared = preparedAnalysisRequest(
      "relation.identifier-renaming",
      "/functions/2",
      "fresh-sibling-v1",
    );
    const module = analysisModule();
    const entryFunction = module.functions[2];
    if (entryFunction === undefined) throw new TypeError("expected void function");
    const result = runWithSemanticRelationFault(
      {
        schemaVersion: 1,
        pathId: "relation.identifier-renaming.rewrite",
        faultId: "relation.fault.non-preserving-rewrite",
      },
      () =>
        applySemanticRelationTransform({
          ...prepared,
          request: { ...prepared.request, entryFunction: entryFunction.name },
          entryFunction,
          entryFunctionIndex: 2,
          sourceModule: module,
        }),
    );
    expect(result).toMatchObject({ ok: true });
    if (!result.ok || "outcome" in result) throw new TypeError("expected transformed module");
    expect(result.transformedModule.functions[2]?.body).toContainEqual({
      kind: "memory-write",
      width: 1,
      address: { kind: "literal", type: "word", value: 0xffffn },
      value: { kind: "literal", type: "byte", value: 1n },
    });
  });

  it("makes omitted diagnostic, binding, and void observables independently visible", () => {
    const invalidObservations = fixture.invalid.map((source) => {
      const result = evaluateSemanticRelation(source.suite, {
        ...validRequest(),
        sourceProvenance: source.sourceProvenance,
        sourceCase: source.sourceCase,
        entryFunction: source.entryFunction,
        selectionPath:
          source.sourceCase.projection.kind === "invalid" &&
          source.sourceCase.projection.transform.kind === "parameter-binding-replace"
            ? "/functions/0/parameters/0"
            : "/functions/0",
        memory: source.memory,
      });
      if (!result.ok || result.outcome !== "modeled") {
        throw new TypeError("expected modeled invalid rename");
      }
      return result.sourceObservation;
    });
    const observations: readonly OracleObservationV1[] = [
      ...invalidObservations,
      ...invalidObservations
        .filter((item) => item.kind === "binding-rejection")
        .map((item) => ({ ...item, rejectionCode: "binding.value.type-invalid" as const })),
      { kind: "value-state", returnValue: null, effects: [], finalMemory: [] },
    ];
    for (const observation of observations) {
      const witness = runWithSemanticRelationFault(
        {
          schemaVersion: 1,
          pathId: "relation.identifier-renaming.comparator",
          faultId: "relation.fault.omit-required-observable",
        },
        () => semanticRelationComparatorWitness("relation.identifier-renaming", observation),
      );
      expect(witness).not.toEqual(observation);
      expect(
        runWithSemanticRelationFault(
          {
            schemaVersion: 1,
            pathId: "relation.identifier-renaming.comparator",
            faultId: "relation.fault.omit-required-observable",
          },
          () =>
            compareSemanticRelationObservations(
              "relation.identifier-renaming",
              observation,
              witness,
            ),
        ),
      ).toBe(true);
    }
  });

  it("rejects every non-omitted comparator field independently", () => {
    const invalidObservations = fixture.invalid.map((source) => {
      const selectionPath =
        source.sourceCase.projection.kind === "invalid" &&
        source.sourceCase.projection.transform.kind === "parameter-binding-replace"
          ? "/functions/0/parameters/0"
          : "/functions/0";
      const result = evaluateSemanticRelation(source.suite, {
        ...validRequest(),
        sourceProvenance: source.sourceProvenance,
        sourceCase: source.sourceCase,
        entryFunction: source.entryFunction,
        selectionPath,
        memory: source.memory,
      });
      if (!result.ok || result.outcome !== "modeled") {
        throw new TypeError("expected modeled invalid rename");
      }
      return result.sourceObservation;
    });
    const diagnostic = invalidObservations.find((item) => item.kind === "diagnostic");
    const binding = invalidObservations.find((item) => item.kind === "binding-rejection");
    if (diagnostic?.kind !== "diagnostic" || binding?.kind !== "binding-rejection") {
      throw new TypeError("expected both invalid observation families");
    }
    const faultCompare = (source: OracleObservationV1, transformed: OracleObservationV1): boolean =>
      runWithSemanticRelationFault(
        {
          schemaVersion: 1,
          pathId: "relation.identifier-renaming.comparator",
          faultId: "relation.fault.omit-required-observable",
        },
        () =>
          compareSemanticRelationObservations("relation.identifier-renaming", source, transformed),
      );

    expect(faultCompare(diagnostic, binding)).toBe(false);
    expect(faultCompare(diagnostic, { ...diagnostic, ruleId: binding.ruleId })).toBe(false);
    expect(faultCompare(diagnostic, { ...diagnostic, neighborId: binding.neighborId })).toBe(false);
    expect(faultCompare(diagnostic, { ...diagnostic, phase: "parser" })).toBe(false);
    expect(faultCompare(binding, { ...binding, ruleId: diagnostic.ruleId })).toBe(false);
    expect(faultCompare(binding, { ...binding, neighborId: diagnostic.neighborId })).toBe(false);

    const numeric: OracleObservationV1 = {
      kind: "value-state",
      returnValue: { kind: "integer", type: "byte", value: 1n },
      effects: [],
      finalMemory: [],
    };
    const boolean: OracleObservationV1 = {
      kind: "value-state",
      returnValue: { kind: "boolean", type: "boolean", value: true },
      effects: [],
      finalMemory: [],
    };
    const empty: OracleObservationV1 = {
      kind: "value-state",
      returnValue: null,
      effects: [],
      finalMemory: [],
    };
    const write = {
      ordinal: 0n,
      kind: "write" as const,
      width: 1 as const,
      address: 0x1000n,
      value: 1n,
    };
    expect(faultCompare(numeric, empty)).toBe(false);
    expect(faultCompare(numeric, boolean)).toBe(false);
    expect(
      faultCompare(numeric, {
        ...numeric,
        returnValue: { kind: "integer", type: "byte", value: 2n },
      }),
    ).toBe(false);
    expect(faultCompare(numeric, { ...numeric, effects: [write] })).toBe(false);
    expect(
      faultCompare(numeric, {
        ...numeric,
        finalMemory: [{ address: 0x1000n, value: 1n }],
      }),
    ).toBe(false);
    expect(faultCompare(boolean, { ...boolean, effects: [write] })).toBe(false);
    expect(
      faultCompare(boolean, {
        ...boolean,
        finalMemory: [{ address: 0x1000n, value: 1n }],
      }),
    ).toBe(false);
    expect(faultCompare(empty, { ...empty, effects: [write] })).toBe(false);

    expect(
      compareSemanticRelationObservations("relation.identifier-renaming", binding, diagnostic),
    ).toBe(false);
    expect(
      compareSemanticRelationObservations("relation.identifier-renaming", binding, {
        ...binding,
        ruleId: diagnostic.ruleId,
      }),
    ).toBe(false);
    expect(
      compareSemanticRelationObservations("relation.identifier-renaming", binding, {
        ...binding,
        neighborId: diagnostic.neighborId,
      }),
    ).toBe(false);
  });

  it("freezes primitives, detached graphs, and repeated references safely", () => {
    expect(freezeSemanticRelationValue(3)).toBe(3);
    interface Cycle {
      self?: Cycle;
    }
    const cycle: Cycle = {};
    cycle.self = cycle;
    expect(freezeSemanticRelationValue(cycle)).toBe(cycle);
    expect(Object.isFrozen(cycle)).toBe(true);

    const source = { nested: { value: 1 } };
    const snapshot = snapshotSemanticRelationValue(source);
    expect(snapshot).toEqual(source);
    expect(snapshot).not.toBe(source);
    expect(Object.isFrozen(snapshot.nested)).toBe(true);
  });
});
