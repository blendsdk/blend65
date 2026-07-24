import { describe, expect, it } from "vitest";

import { validateRuleModelRegistry } from "./rule-model-input.js";

const RULE_COUNT = 2_112;
const CONTENT_HASH = `sha256:${"a".repeat(64)}`;
const KNOWN_OPERATION_IDS = [
  "boundary.fixture.min-max",
  "constructor.fixture.scalar",
  "neighbor.fixture.above-max",
  "predicate.fixture.range",
] as const;

function createModeledRule(ruleId: string) {
  return {
    ruleId,
    state: "modeled" as const,
    citations: [
      {
        sourcePath: "fixtures/scalar-model.md",
        contentHash: CONTENT_HASH,
      },
    ],
    constructionPreconditions: [
      {
        kind: "type-in" as const,
        subject: "operand",
        values: ["byte"],
      },
    ],
    typedDomains: [
      {
        subject: "operand",
        type: "byte" as const,
        values: ["0", "255"],
      },
    ],
    invalidContracts: [
      {
        contractId: "operand.range",
        diagnosticFamily: "type.range",
        neighborIds: ["neighbor.fixture.above-max"],
      },
    ],
    constructorIds: ["constructor.fixture.scalar"],
    predicateIds: ["predicate.fixture.range"],
    neighborIds: ["neighbor.fixture.above-max"],
    boundaryFamilyIds: ["boundary.fixture.min-max"],
    spellings: ["literal"],
  };
}

function createRuleIds(count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `rule.fixture.${index.toString().padStart(4, "0")}`,
  );
}

function createExhaustiveInput() {
  const inventoryRuleIds = createRuleIds(RULE_COUNT);
  const rules = inventoryRuleIds.map((ruleId, index) => {
    if (index === 0) {
      return createModeledRule(ruleId);
    }

    if (index % 2 === 1) {
      return {
        ruleId,
        state: "unmodeled" as const,
        reason: "outside-initial-slice" as const,
      };
    }

    return {
      ruleId,
      state: "not-generatable" as const,
      reason: "not-source-generatable" as const,
    };
  });

  return {
    inventoryRuleIds,
    input: {
      schemaVersion: 1 as const,
      registryVersion: "fixture-v1",
      rules,
    },
  };
}

function createSingleModeledInput() {
  const ruleId = "rule.fixture.scalar";

  return {
    inventoryRuleIds: [ruleId],
    input: {
      schemaVersion: 1 as const,
      registryVersion: "fixture-v1",
      rules: [createModeledRule(ruleId)],
    },
  };
}

function expectDiagnostic(
  result: ReturnType<typeof validateRuleModelRegistry>,
  code: string,
  path: string,
): void {
  expect(result).toMatchObject({
    ok: false,
    diagnostics: expect.arrayContaining([
      {
        code,
        path,
        message: expect.any(String),
      },
    ]),
  });
}

describe("rule model registry", () => {
  it("classifies every authoritative rule exactly once and reports non-empty state counts", () => {
    const { input, inventoryRuleIds } = createExhaustiveInput();

    const result = validateRuleModelRegistry(input, inventoryRuleIds, KNOWN_OPERATION_IDS);

    expect(result).toMatchObject({
      ok: true,
      counts: {
        modeled: 1,
        unmodeled: 1_056,
        "not-generatable": 1_055,
      },
      diagnostics: [],
    });
  });

  it("rejects an authoritative rule that has no registry entry", () => {
    const { input, inventoryRuleIds } = createExhaustiveInput();

    const result = validateRuleModelRegistry(
      { ...input, rules: input.rules.slice(0, -1) },
      inventoryRuleIds,
      KNOWN_OPERATION_IDS,
    );

    expectDiagnostic(result, "model.rule.missing", "/rules");
  });

  it("rejects the second occurrence of a duplicate rule", () => {
    const { input, inventoryRuleIds } = createExhaustiveInput();
    const rules = [input.rules[0], input.rules[0], ...input.rules.slice(1)];

    const result = validateRuleModelRegistry(
      { ...input, rules },
      inventoryRuleIds,
      KNOWN_OPERATION_IDS,
    );

    expectDiagnostic(result, "model.rule.duplicate", "/rules/1/ruleId");
  });

  it("rejects a rule absent from the authoritative inventory", () => {
    const { input, inventoryRuleIds } = createExhaustiveInput();
    const unknownIndex = input.rules.length - 1;
    const rules = [
      ...input.rules.slice(0, unknownIndex),
      {
        ruleId: "rule.fixture.unknown",
        state: "unmodeled" as const,
        reason: "outside-initial-slice" as const,
      },
    ];

    const result = validateRuleModelRegistry(
      { ...input, rules },
      inventoryRuleIds,
      KNOWN_OPERATION_IDS,
    );

    expectDiagnostic(result, "model.rule.unknown", `/rules/${unknownIndex}/ruleId`);
  });

  it.each([
    {
      name: "citation",
      field: "citations",
      path: "/rules/0/citations",
    },
    {
      name: "construction precondition",
      field: "constructionPreconditions",
      path: "/rules/0/constructionPreconditions",
    },
    {
      name: "typed domain",
      field: "typedDomains",
      path: "/rules/0/typedDomains",
    },
    {
      name: "invalid contract",
      field: "invalidContracts",
      path: "/rules/0/invalidContracts",
    },
    {
      name: "constructor",
      field: "constructorIds",
      path: "/rules/0/constructorIds",
    },
    {
      name: "predicate",
      field: "predicateIds",
      path: "/rules/0/predicateIds",
    },
    {
      name: "invalid neighbor",
      field: "neighborIds",
      path: "/rules/0/neighborIds",
    },
    {
      name: "boundary family",
      field: "boundaryFamilyIds",
      path: "/rules/0/boundaryFamilyIds",
    },
    {
      name: "spelling",
      field: "spellings",
      path: "/rules/0/spellings",
    },
  ])("rejects a modeled rule with no $name fact", ({ field, path }) => {
    const { input, inventoryRuleIds } = createSingleModeledInput();
    const modeledRule = { ...input.rules[0], [field]: [] };

    const result = validateRuleModelRegistry(
      { ...input, rules: [modeledRule] },
      inventoryRuleIds,
      KNOWN_OPERATION_IDS,
    );

    expectDiagnostic(result, "model.modeled.incomplete", path);
  });

  it.each([
    {
      name: "citation hash",
      change: {
        citations: [
          {
            sourcePath: "fixtures/scalar-model.md",
            contentHash: "sha256:not-a-content-hash",
          },
        ],
      },
      path: "/rules/0/citations/0/contentHash",
    },
    {
      name: "construction precondition values",
      change: {
        constructionPreconditions: [
          {
            kind: "type-in" as const,
            subject: "operand",
            values: [],
          },
        ],
      },
      path: "/rules/0/constructionPreconditions/0/values",
    },
    {
      name: "typed domain values",
      change: {
        typedDomains: [
          {
            subject: "operand",
            type: "byte" as const,
            values: [],
          },
        ],
      },
      path: "/rules/0/typedDomains/0/values",
    },
    {
      name: "invalid contract diagnostic family",
      change: {
        invalidContracts: [
          {
            contractId: "operand.range",
            diagnosticFamily: "",
            neighborIds: ["neighbor.fixture.above-max"],
          },
        ],
      },
      path: "/rules/0/invalidContracts/0/diagnosticFamily",
    },
  ])("rejects a modeled rule with a mutated $name", ({ change, path }) => {
    const { input, inventoryRuleIds } = createSingleModeledInput();
    const modeledRule = { ...input.rules[0], ...change };

    const result = validateRuleModelRegistry(
      { ...input, rules: [modeledRule] },
      inventoryRuleIds,
      KNOWN_OPERATION_IDS,
    );

    expectDiagnostic(result, "model.modeled.incomplete", path);
  });

  it.each([
    {
      name: "constructor",
      field: "constructorIds",
      path: "/rules/0/constructorIds/0",
    },
    {
      name: "predicate",
      field: "predicateIds",
      path: "/rules/0/predicateIds/0",
    },
    {
      name: "neighbor",
      field: "neighborIds",
      path: "/rules/0/neighborIds/0",
    },
    {
      name: "boundary family",
      field: "boundaryFamilyIds",
      path: "/rules/0/boundaryFamilyIds/0",
    },
  ])("rejects an unknown $name operation ID", ({ field, path }) => {
    const { input, inventoryRuleIds } = createSingleModeledInput();
    const modeledRule = {
      ...input.rules[0],
      [field]: [`${field}.fixture.unknown`],
    };

    const result = validateRuleModelRegistry(
      { ...input, rules: [modeledRule] },
      inventoryRuleIds,
      KNOWN_OPERATION_IDS,
    );

    expectDiagnostic(result, "model.operation.unknown", path);
  });
});
