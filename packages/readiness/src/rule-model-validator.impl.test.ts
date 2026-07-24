import { describe, expect, it } from "vitest";
import { createExecutableOperationRegistry, validateRuleModelRegistry } from "./index.js";

const CONTENT_HASH = `sha256:${"a".repeat(64)}`;
const OPERATION_IDS = [
  "boundary.fixture.range",
  "constructor.fixture.scalar",
  "neighbor.fixture.above",
  "predicate.fixture.range",
] as const;

function modeledRule() {
  return {
    ruleId: "rule.fixture.scalar",
    state: "modeled" as const,
    citations: [{ sourcePath: "fixtures/model.md", contentHash: CONTENT_HASH }],
    constructionPreconditions: [{ kind: "type-in" as const, subject: "operand", values: ["byte"] }],
    typedDomains: [{ subject: "operand", type: "byte" as const, values: ["0", "255"] }],
    invalidContracts: [
      {
        contractId: "operand.range",
        diagnosticFamily: "type.range",
        neighborIds: ["neighbor.fixture.above"],
      },
    ],
    constructorIds: ["constructor.fixture.scalar"],
    predicateIds: ["predicate.fixture.range"],
    neighborIds: ["neighbor.fixture.above"],
    boundaryFamilyIds: ["boundary.fixture.range"],
    spellings: ["literal"],
  };
}

function registryWith(rule: unknown) {
  return {
    schemaVersion: 1,
    registryVersion: "fixture-v1",
    rules: [rule],
  };
}

describe("rule-model semantic validation", () => {
  it("returns an immutable lookup registry for complete modeled facts", () => {
    const result = validateRuleModelRegistry(
      registryWith(modeledRule()),
      ["rule.fixture.scalar"],
      OPERATION_IDS,
    );

    expect(result).toMatchObject({
      ok: true,
      counts: { modeled: 1, unmodeled: 0, "not-generatable": 0 },
    });
    if (!result.ok) return;
    expect(result.registry.get("rule.fixture.scalar")).toEqual(modeledRule());
    expect(Object.isFrozen(result.registry.rules)).toBe(true);
  });

  it("defensively deep-clones and freezes modeled records behind lookup accessors", () => {
    const rule = modeledRule();
    const result = validateRuleModelRegistry(
      registryWith(rule),
      ["rule.fixture.scalar"],
      OPERATION_IDS,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const validated = result.registry.get("rule.fixture.scalar");
    if (validated?.state !== "modeled") throw new TypeError("Expected a modeled rule.");

    rule.citations[0].sourcePath = "fixtures/changed.md";
    rule.constructorIds[0] = "constructor.fixture.changed";

    expect(validated.citations[0].sourcePath).toBe("fixtures/model.md");
    expect(validated.constructorIds).toEqual(["constructor.fixture.scalar"]);
    expect(Object.isFrozen(result.registry)).toBe(true);
    expect(Object.isFrozen(validated)).toBe(true);
    expect(Object.isFrozen(validated.citations)).toBe(true);
    expect(Object.isFrozen(validated.citations[0])).toBe(true);
    expect(Object.isFrozen(validated.constructorIds)).toBe(true);
    expect(result.registry).not.toHaveProperty("byRuleId");
  });

  it("rejects duplicate or non-lexical operation arrays", () => {
    const rule = {
      ...modeledRule(),
      constructorIds: ["constructor.fixture.scalar", "constructor.fixture.scalar"],
    };

    expect(
      validateRuleModelRegistry(registryWith(rule), ["rule.fixture.scalar"], OPERATION_IDS),
    ).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        {
          code: "model.modeled.incomplete",
          path: "/rules/0/constructorIds",
          message: expect.any(String),
        },
      ]),
    });
  });

  it("rejects an unsupported spelling", () => {
    const rule = { ...modeledRule(), spellings: ["macro"] };

    expect(
      validateRuleModelRegistry(registryWith(rule), ["rule.fixture.scalar"], OPERATION_IDS),
    ).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        {
          code: "model.modeled.incomplete",
          path: "/rules/0/spellings/0",
          message: expect.any(String),
        },
      ]),
    });
  });

  it("requires invalid contracts to reference declared neighbors", () => {
    const rule = {
      ...modeledRule(),
      invalidContracts: [
        {
          contractId: "operand.range",
          diagnosticFamily: "type.range",
          neighborIds: ["neighbor.fixture.other"],
        },
      ],
    };

    expect(
      validateRuleModelRegistry(
        registryWith(rule),
        ["rule.fixture.scalar"],
        [...OPERATION_IDS, "neighbor.fixture.other"],
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        {
          code: "model.modeled.incomplete",
          path: "/rules/0/invalidContracts/0/neighborIds/0",
          message: expect.any(String),
        },
      ]),
    });
  });

  it("rejects operation IDs registered under the wrong field kind", () => {
    const rule = {
      ...modeledRule(),
      constructorIds: ["predicate.fixture.range"],
    };

    expect(
      validateRuleModelRegistry(registryWith(rule), ["rule.fixture.scalar"], OPERATION_IDS),
    ).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        {
          code: "model.operation.unknown",
          path: "/rules/0/constructorIds/0",
          message: expect.any(String),
        },
      ]),
    });
  });

  it("rejects non-lexical rule-model entry order", () => {
    const input = {
      schemaVersion: 1,
      registryVersion: "fixture-v1",
      rules: [
        {
          ruleId: "rule.fixture.two",
          state: "unmodeled",
          reason: "outside-initial-slice",
        },
        {
          ruleId: "rule.fixture.one",
          state: "unmodeled",
          reason: "outside-initial-slice",
        },
      ],
    };

    expect(
      validateRuleModelRegistry(input, ["rule.fixture.one", "rule.fixture.two"], []),
    ).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        {
          code: "model.schema.invalid",
          path: "/rules/1/ruleId",
          message: expect.any(String),
        },
      ]),
    });
  });

  it("rejects malformed closed state records", () => {
    const rule = {
      ruleId: "rule.fixture.scalar",
      state: "unmodeled",
      reason: "outside-initial-slice",
      modeledFact: true,
    };

    expect(
      validateRuleModelRegistry(registryWith(rule), ["rule.fixture.scalar"], []),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "model.schema.invalid", path: "/rules/0/state" }],
    });
  });

  it.each([
    [
      "a non-record citation",
      { citations: [null] },
      "model.modeled.incomplete",
      "/rules/0/citations/0/contentHash",
    ],
    [
      "an unsafe citation path",
      { citations: [{ sourcePath: "../model.md", contentHash: CONTENT_HASH }] },
      "model.modeled.incomplete",
      "/rules/0/citations/0/sourcePath",
    ],
    [
      "a non-record precondition",
      { constructionPreconditions: [null] },
      "model.modeled.incomplete",
      "/rules/0/constructionPreconditions/0/values",
    ],
    [
      "an invalid precondition kind",
      {
        constructionPreconditions: [{ kind: "future", subject: "operand", values: ["byte"] }],
      },
      "model.modeled.incomplete",
      "/rules/0/constructionPreconditions/0/kind",
    ],
    [
      "an invalid precondition subject",
      {
        constructionPreconditions: [{ kind: "type-in", subject: "../operand", values: ["byte"] }],
      },
      "model.modeled.incomplete",
      "/rules/0/constructionPreconditions/0/subject",
    ],
    [
      "a non-record typed domain",
      { typedDomains: [null] },
      "model.modeled.incomplete",
      "/rules/0/typedDomains/0/values",
    ],
    [
      "an invalid domain type",
      { typedDomains: [{ subject: "operand", type: "future", values: ["0"] }] },
      "model.modeled.incomplete",
      "/rules/0/typedDomains/0/type",
    ],
    [
      "an invalid domain subject",
      { typedDomains: [{ subject: "../operand", type: "byte", values: ["0"] }] },
      "model.modeled.incomplete",
      "/rules/0/typedDomains/0/subject",
    ],
    [
      "a non-record invalid contract",
      { invalidContracts: [null] },
      "model.modeled.incomplete",
      "/rules/0/invalidContracts/0/diagnosticFamily",
    ],
    [
      "an invalid-contract neighbor list",
      {
        invalidContracts: [
          {
            contractId: "operand.range",
            diagnosticFamily: "type.range",
            neighborIds: [],
          },
        ],
      },
      "model.modeled.incomplete",
      "/rules/0/invalidContracts/0/neighborIds",
    ],
    [
      "an invalid contract ID",
      {
        invalidContracts: [
          {
            contractId: "../range",
            diagnosticFamily: "type.range",
            neighborIds: ["neighbor.fixture.above"],
          },
        ],
      },
      "model.modeled.incomplete",
      "/rules/0/invalidContracts/0/contractId",
    ],
    ["an extra modeled field", { extra: true }, "model.schema.invalid", "/rules/0"],
    ["a non-string operation ID", { constructorIds: [1] }, "model.schema.invalid", "/rules/0"],
  ])("rejects $name", (_name, change, code, path) => {
    const rule = { ...modeledRule(), ...change };

    expect(
      validateRuleModelRegistry(registryWith(rule), ["rule.fixture.scalar"], OPERATION_IDS),
    ).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([{ code, path, message: expect.any(String) }]),
    });
  });

  it.each([
    ["a non-object envelope", null],
    [
      "an envelope with an extra field",
      {
        schemaVersion: 1,
        registryVersion: "fixture-v1",
        rules: [],
        extra: true,
      },
    ],
    [
      "a non-record rule",
      {
        schemaVersion: 1,
        registryVersion: "fixture-v1",
        rules: [null],
      },
    ],
    [
      "an invalid non-modeled reason",
      registryWith({
        ruleId: "rule.fixture.scalar",
        state: "unmodeled",
        reason: "future",
      }),
    ],
  ])("rejects %s", (_name, input) => {
    expect(validateRuleModelRegistry(input, ["rule.fixture.scalar"], OPERATION_IDS)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        { code: "model.schema.invalid", message: expect.any(String), path: expect.any(String) },
      ]),
    });
  });

  it("rejects accessor-backed and non-plain nested facts without invoking accessors", () => {
    let accessorCalls = 0;
    const accessorRule = modeledRule();
    Object.defineProperty(accessorRule, "citations", {
      configurable: true,
      enumerable: true,
      get: () => {
        accessorCalls += 1;
        return [];
      },
    });
    class Citation {
      public readonly sourcePath = "fixtures/model.md";
      public readonly contentHash = CONTENT_HASH;
    }
    const classFactRule = {
      ...modeledRule(),
      citations: [new Citation()],
    };

    expect(
      validateRuleModelRegistry(registryWith(accessorRule), ["rule.fixture.scalar"], OPERATION_IDS),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "model.schema.invalid", path: "/rules/0/citations" }],
    });
    expect(accessorCalls).toBe(0);
    expect(
      validateRuleModelRegistry(
        registryWith(classFactRule),
        ["rule.fixture.scalar"],
        OPERATION_IDS,
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "model.schema.invalid", path: "/rules/0/citations/0" }],
    });
  });

  it.each([
    ["inventory rule IDs", ["rule.fixture.scalar", "rule.fixture.scalar"], OPERATION_IDS],
    ["operation IDs", ["rule.fixture.scalar"], [...OPERATION_IDS, OPERATION_IDS[0]]],
  ])("rejects duplicate %s", (_name, inventoryRuleIds, operationIds) => {
    expect(
      validateRuleModelRegistry(registryWith(modeledRule()), inventoryRuleIds, operationIds),
    ).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        { code: "model.schema.invalid", message: expect.any(String), path: expect.any(String) },
      ]),
    });
  });

  it("rejects structurally invalid and unclassified executable-operation allowlists", () => {
    expect(
      validateRuleModelRegistry(registryWith(modeledRule()), ["rule.fixture.scalar"], {}),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "model.schema.invalid", path: "/executableOperationIds" }],
    });
    expect(
      validateRuleModelRegistry(
        registryWith(modeledRule()),
        ["rule.fixture.scalar"],
        ["operation.fixture.unknown"],
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "model.schema.invalid", path: "/executableOperationIds/0" }],
    });
    expect(
      validateRuleModelRegistry(
        registryWith(modeledRule()),
        ["rule.fixture.scalar"],
        () => undefined,
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "model.schema.invalid", path: "/executableOperationIds" }],
    });
  });

  it("rejects unsafe inventory ID arrays before semantic traversal", () => {
    let accessorCalls = 0;
    const inventoryRuleIds = ["rule.fixture.scalar"];
    Object.defineProperty(inventoryRuleIds, "0", {
      configurable: true,
      enumerable: true,
      get: () => {
        accessorCalls += 1;
        return "rule.fixture.scalar";
      },
    });

    expect(
      validateRuleModelRegistry(registryWith(modeledRule()), inventoryRuleIds, OPERATION_IDS),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "model.schema.invalid", path: "/inventoryRuleIds/0" }],
    });
    expect(accessorCalls).toBe(0);
  });
});

describe("executable-operation registry", () => {
  const operation = {
    operationId: "predicate.fixture.range",
    kind: "predicate" as const,
    implementation: () => true,
  };

  it("closes a valid executable operation table", () => {
    const result = createExecutableOperationRegistry([operation]);

    expect(result).toMatchObject({
      ok: true,
      registry: { operationIds: ["predicate.fixture.range"] },
    });
    if (!result.ok) return;
    expect(result.registry.get(operation.operationId)?.implementation()).toBe(true);
    expect(result.registry.has("predicate", operation.operationId)).toBe(true);
    expect(result.registry.has("constructor", operation.operationId)).toBe(false);
    expect(Object.isFrozen(result.registry)).toBe(true);
    expect(Object.isFrozen(result.registry.operations)).toBe(true);
    expect(Object.isFrozen(result.registry.operations[0])).toBe(true);
    expect(result.registry).not.toHaveProperty("byOperationId");
  });

  it.each([
    ["a duplicate ID", [operation, operation], "/operations/1/operationId"],
    [
      "a non-canonical ID",
      [{ ...operation, operationId: "../predicate" }],
      "/operations/0/operationId",
    ],
  ])("rejects %s", (_name, operations, path) => {
    expect(createExecutableOperationRegistry(operations)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "model.schema.invalid", path }],
    });
  });

  it.each([
    ["an extra field", [{ ...operation, extra: true }], "/operations/0"],
    ["an unsupported kind", [{ ...operation, kind: "future" }], "/operations/0/kind"],
    [
      "a non-callable implementation",
      [{ ...operation, implementation: "not-callable" }],
      "/operations/0/implementation",
    ],
  ])("rejects $name through the closed runtime shape", (_name, operations, path) => {
    expect(createExecutableOperationRegistry(operations)).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "model.schema.invalid",
          path,
          message: expect.any(String),
        },
      ],
    });
  });

  it("rejects a non-array operation container", () => {
    expect(createExecutableOperationRegistry({})).toMatchObject({
      ok: false,
      diagnostics: [{ code: "model.schema.invalid", path: "/operations" }],
    });
  });

  it("rejects accessor-backed operations without invoking the accessor", () => {
    let accessorCalls = 0;
    const accessorOperation = { ...operation };
    Object.defineProperty(accessorOperation, "implementation", {
      configurable: true,
      enumerable: true,
      get: () => {
        accessorCalls += 1;
        return operation.implementation;
      },
    });

    expect(createExecutableOperationRegistry([accessorOperation])).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "model.schema.invalid",
          path: "/operations/0/implementation",
        },
      ],
    });
    expect(accessorCalls).toBe(0);
  });

  it("uses registry operation kinds when validating modeled fields", () => {
    const operations = OPERATION_IDS.map((operationId) => ({
      operationId,
      kind:
        operationId === "constructor.fixture.scalar"
          ? ("predicate" as const)
          : operationId.startsWith("predicate.")
            ? ("predicate" as const)
            : operationId.startsWith("neighbor.")
              ? ("neighbor" as const)
              : ("boundary-family" as const),
      implementation: () => true,
    }));
    const operationResult = createExecutableOperationRegistry(operations);
    expect(operationResult.ok).toBe(true);
    if (!operationResult.ok) return;

    expect(
      validateRuleModelRegistry(
        registryWith(modeledRule()),
        ["rule.fixture.scalar"],
        operationResult.registry,
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        {
          code: "model.operation.unknown",
          path: "/rules/0/constructorIds/0",
          message: expect.any(String),
        },
      ]),
    });
  });

  it("rejects proxy-forged registry capabilities without reading their brand or has method", () => {
    let symbolReads = 0;
    let hasCalls = 0;
    const forgedRegistry = new Proxy(
      {
        operations: [],
        operationIds: [],
        get: () => undefined,
        has: () => {
          hasCalls += 1;
          return true;
        },
      },
      {
        get: (target, property, receiver) => {
          if (typeof property === "symbol") {
            symbolReads += 1;
            return true;
          }
          return Reflect.get(target, property, receiver);
        },
      },
    );
    const rule = {
      ...modeledRule(),
      constructorIds: ["predicate.fixture.range"],
    };

    expect(
      validateRuleModelRegistry(registryWith(rule), ["rule.fixture.scalar"], forgedRegistry),
    ).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "model.schema.invalid",
          path: "/executableOperationIds/has",
          message: expect.any(String),
        },
      ],
    });
    expect(symbolReads).toBe(0);
    expect(hasCalls).toBe(0);
  });
});
