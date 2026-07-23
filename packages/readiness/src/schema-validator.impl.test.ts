import { describe, expect, it } from "vitest";
import { INVENTORY_V1_LIMITS, validateInventorySchema } from "./index.js";

const HASH = `sha256:${"a".repeat(64)}`;

function minimalInventory(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    inventoryVersion: "1.0.0",
    specRevision: HASH,
    identityLedgerHead: HASH,
    fragmentationProfile: {
      profileId: "markdown-ebnf-v1",
      version: 1,
      contentHashAlgorithm: "sha256",
      newlinePolicy: "lf",
    },
    normativeSources: [],
    handlerDeclarations: [],
    evidenceCapabilityDeclarations: [],
    clauseLedger: [],
    conflicts: [],
    rules: [],
    evolutionGate: null,
  };
}

function validRule(index: number): Record<string, unknown> {
  return {
    ruleId: `rule.generated-${index}`,
    source: {
      path: "spec/language.md",
      headingAncestry: ["Values"],
      quote: "Generated rule.",
      contentHash: HASH,
      displayLine: index + 1,
    },
    requirement: "The generated rule must be represented.",
    category: "values",
    polarity: "positive",
    applicability: "mandatory-c64",
    validDomains: [],
    invalidNeighbors: [],
    boundaryFamilies: [],
    generatorIds: [],
    oracleIds: [],
    transformIds: [],
    evidenceObligations: [],
    prerequisiteRuleIds: [],
    relatedRuleIds: [],
  };
}

describe("schema resource validation internals", () => {
  it("should reject cyclic object graphs before schema traversal", () => {
    const value: Record<string, unknown> = {};
    value.self = value;

    const result = validateInventorySchema(value);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "schema.cyclic-value",
        path: "/self",
      }),
    );
  });

  it("should reject object graphs that exceed the traversal depth", () => {
    const root: Record<string, unknown> = {};
    let cursor = root;
    for (let depth = 0; depth <= INVENTORY_V1_LIMITS.maxDepth; depth += 1) {
      const child: Record<string, unknown> = {};
      cursor.child = child;
      cursor = child;
    }

    const result = validateInventorySchema(root);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "schema.depth-limit",
      }),
    );
  });

  it("should reject an otherwise valid inventory containing an oversized UTF-8 string", () => {
    const inventory = minimalInventory();
    inventory.normativeSources = [
      {
        path: "é".repeat(INVENTORY_V1_LIMITS.maxStringBytes / 2 + 1),
        order: 0,
        classification: "contextual",
        sections: [],
      },
    ];

    const result = validateInventorySchema(inventory);

    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "schema.max-length",
        path: "/normativeSources/0/path",
      }),
    ]);
  });

  it("should reject an oversized sparse rule array before Ajv traversal", () => {
    const inventory = minimalInventory();
    inventory.rules = new Array(INVENTORY_V1_LIMITS.maxRules + 1);

    const result = validateInventorySchema(inventory);

    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "schema.max-items",
        path: "/rules",
      }),
    ]);
  });

  it("should accept a large valid inventory within every published limit", () => {
    const inventory = minimalInventory();
    inventory.rules = Array.from({ length: 14_000 }, (_, index) => validRule(index));

    expect(validateInventorySchema(inventory)).toEqual(
      expect.objectContaining({
        ok: true,
        diagnostics: [],
      }),
    );
  });
});
