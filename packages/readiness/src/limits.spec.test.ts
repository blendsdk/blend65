import { describe, expect, it } from "vitest";
import { INVENTORY_V1_LIMITS, parseInventoryJson, validateInventorySchema } from "./index.js";
import type { InventoryLimits } from "./index.js";

const encoder = new TextEncoder();
const HASH = `sha256:${"a".repeat(64)}`;
const SOURCE = {
  path: "spec/language.md",
  order: 0,
  classification: "normative-chapter",
  sections: [],
};
const SECTION = {
  headingAncestry: ["Values"],
  classification: "normative-chapter",
  contentHash: HASH,
};
const CLAUSE = {
  fragmentId: "fragment.values.aaaaaaaa",
  disposition: "mapped",
  ruleIds: ["rule.integer-literal"],
};
const HANDLER = {
  id: "generator.integer",
  kind: "generator",
  owner: "compiler-readiness",
  contractVersion: "1.0.0",
  binding: "unbound",
};
const CAPABILITY = {
  id: "frontend",
  owner: "compiler-readiness",
  contractVersion: "1.0.0",
  binding: "unbound",
  observableContract: "Frontend result.",
  prerequisiteRoute: "compiler.frontend",
};
const CITATION = {
  path: "spec/language.md",
  headingAncestry: ["Values"],
  quote: "Integer literals denote integer values.",
  contentHash: HASH,
  displayLine: 1,
};
const CONFLICT = {
  conflictId: "conflict.integer",
  classification: "contradiction",
  citations: [CITATION],
  ruleIds: ["rule.integer-literal"],
  resolution: "blocked",
};
const CHILD_OUTCOME = {
  outcomeId: "outcome.integer",
  ruleIds: ["rule.integer-literal"],
};
const RULE = {
  ruleId: "rule.integer-literal",
  source: {
    path: "spec/language.md",
    headingAncestry: ["Values"],
    quote: "Integer literals denote integer values.",
    contentHash: HASH,
    displayLine: 1,
  },
  requirement: "Integer literals must denote integer values.",
  category: "values",
  polarity: "positive",
  applicability: "mandatory-c64",
  validDomains: [],
  invalidNeighbors: [],
  boundaryFamilies: [],
  generatorIds: [],
  oracleIds: [],
  transformIds: [],
  evidenceObligations: ["frontend"],
  prerequisiteRuleIds: [],
  relatedRuleIds: [],
};

function validInventory(): Record<string, unknown> {
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
    normativeSources: [SOURCE],
    handlerDeclarations: [HANDLER],
    evidenceCapabilityDeclarations: [CAPABILITY],
    clauseLedger: [CLAUSE],
    conflicts: [],
    rules: [RULE],
    evolutionGate: null,
  };
}

function withField(field: string, value: unknown): Record<string, unknown> {
  return { ...validInventory(), [field]: value };
}

function replaceLimit<K extends keyof InventoryLimits>(
  limits: InventoryLimits,
  key: K,
  value: InventoryLimits[K],
): InventoryLimits {
  return { ...limits, [key]: value };
}

describe("inventory v1 resource limits", () => {
  // The input byte limit accepts the exact boundary and rejects one byte beyond it.
  it("should enforce the input byte boundary before parsing", () => {
    const exact = encoder.encode(`"${"a".repeat(INVENTORY_V1_LIMITS.maxInputBytes - 2)}"`);
    const over = encoder.encode(`"${"a".repeat(INVENTORY_V1_LIMITS.maxInputBytes - 1)}"`);

    expect(parseInventoryJson(exact, INVENTORY_V1_LIMITS).diagnostics[0]?.code).not.toBe(
      "input.byte-limit",
    );
    expect(parseInventoryJson(over, INVENTORY_V1_LIMITS)).toEqual(
      expect.objectContaining({
        ok: false,
        inventory: undefined,
        diagnostics: [
          expect.objectContaining({
            phase: "input",
            code: "input.byte-limit",
            path: "",
          }),
        ],
      }),
    );
  });

  // The nesting limit accepts exactly the configured depth and rejects the next opening container.
  it("should enforce the nesting boundary before excess traversal", () => {
    const limits = replaceLimit(INVENTORY_V1_LIMITS, "maxInputBytes", Number.MAX_SAFE_INTEGER);
    const atLimit = `${"[".repeat(limits.maxDepth)}null${"]".repeat(limits.maxDepth)}`;
    const overLimit = `[${atLimit}]`;

    expect(parseInventoryJson(encoder.encode(atLimit), limits).diagnostics[0]?.code).not.toBe(
      "input.depth-limit",
    );
    expect(parseInventoryJson(encoder.encode(overLimit), limits).diagnostics).toEqual([
      expect.objectContaining({
        phase: "input",
        code: "input.depth-limit",
      }),
    ]);
  });

  // Every schema collection limit accepts its exact boundary and rejects one additional item.
  it.each([
    ["normativeSources", "maxSources", SOURCE],
    ["handlerDeclarations", "maxArrayItems", HANDLER],
    ["evidenceCapabilityDeclarations", "maxArrayItems", CAPABILITY],
    ["clauseLedger", "maxFragments", CLAUSE],
    ["conflicts", "maxArrayItems", CONFLICT],
    ["rules", "maxRules", RULE],
  ] as const)("should enforce the %s array boundary", (field, limitName, item) => {
    const limit = INVENTORY_V1_LIMITS[limitName];
    const exact = withField(
      field,
      Array.from({ length: limit }, () => item),
    );
    const over = withField(
      field,
      Array.from({ length: limit + 1 }, () => item),
    );

    expect(validateInventorySchema(exact)).toEqual(
      expect.objectContaining({ ok: true, diagnostics: [] }),
    );
    expect(validateInventorySchema(over).diagnostics).toContainEqual(
      expect.objectContaining({ code: "schema.max-items", path: `/${field}` }),
    );
  });

  // Source-section arrays have their own bound independent from the source count.
  it("should enforce the source-section array boundary", () => {
    const limit = INVENTORY_V1_LIMITS.maxSectionsPerSource;
    const exact = withField("normativeSources", [
      { ...SOURCE, sections: Array.from({ length: limit }, () => SECTION) },
    ]);
    const over = withField("normativeSources", [
      { ...SOURCE, sections: Array.from({ length: limit + 1 }, () => SECTION) },
    ]);
    const path = "/normativeSources/0/sections";

    expect(validateInventorySchema(exact)).toEqual(
      expect.objectContaining({ ok: true, diagnostics: [] }),
    );
    expect(validateInventorySchema(over).diagnostics).toContainEqual(
      expect.objectContaining({ code: "schema.max-items", path }),
    );
  });

  // Bounded strings count their encoded UTF-8 bytes, not JavaScript UTF-16 units.
  it("should enforce the string byte boundary", () => {
    const exact = "é".repeat(INVENTORY_V1_LIMITS.maxStringBytes / 2);
    const over = `${exact}é`;
    const exactInventory = validInventory();
    const overInventory = validInventory();
    exactInventory.rules = [{ ...RULE, requirement: exact }];
    overInventory.rules = [{ ...RULE, requirement: over }];

    expect(validateInventorySchema(exactInventory)).toEqual(
      expect.objectContaining({ ok: true, diagnostics: [] }),
    );
    expect(validateInventorySchema(overInventory).diagnostics).toContainEqual(
      expect.objectContaining({ code: "schema.max-length", path: "/rules/0/requirement" }),
    );
  });

  // General arrays and rule relationships have independent caps.
  it.each([
    ["boundaryFamilies", "maxArrayItems"],
    ["generatorIds", "maxArrayItems"],
    ["oracleIds", "maxArrayItems"],
    ["transformIds", "maxArrayItems"],
    ["evidenceObligations", "maxArrayItems"],
    ["prerequisiteRuleIds", "maxRelationshipsPerRule"],
    ["relatedRuleIds", "maxRelationshipsPerRule"],
  ] as const)("should enforce the %s boundary", (field, limitName) => {
    const limit = INVENTORY_V1_LIMITS[limitName];
    const exact = withField("rules", [
      { ...RULE, [field]: Array.from({ length: limit }, (_, index) => `id-${index}`) },
    ]);
    const over = withField("rules", [
      { ...RULE, [field]: Array.from({ length: limit + 1 }, (_, index) => `id-${index}`) },
    ]);
    const path = `/rules/0/${field}`;

    expect(validateInventorySchema(exact)).toEqual(
      expect.objectContaining({ ok: true, diagnostics: [] }),
    );
    expect(validateInventorySchema(over).diagnostics).toContainEqual(
      expect.objectContaining({ code: "schema.max-items", path }),
    );
  });

  it.each([
    [
      "decomposed child outcomes",
      "/clauseLedger/0/childOutcomes",
      (items: readonly unknown[]) => ({
        ...validInventory(),
        clauseLedger: [
          {
            fragmentId: "fragment.values.aaaaaaaa",
            disposition: "decomposed",
            childOutcomes: items,
          },
        ],
      }),
      CHILD_OUTCOME,
    ],
    [
      "conflict citations",
      "/conflicts/0/citations",
      (items: readonly unknown[]) => ({
        ...validInventory(),
        conflicts: [{ ...CONFLICT, citations: items }],
      }),
      CITATION,
    ],
    [
      "conflict rule IDs",
      "/conflicts/0/ruleIds",
      (items: readonly unknown[]) => ({
        ...validInventory(),
        conflicts: [{ ...CONFLICT, ruleIds: items }],
      }),
      "rule.integer-literal",
    ],
    [
      "ledger rule IDs",
      "/clauseLedger/0/ruleIds",
      (items: readonly unknown[]) => ({
        ...validInventory(),
        clauseLedger: [{ ...CLAUSE, ruleIds: items }],
      }),
      "rule.integer-literal",
    ],
    [
      "source heading ancestry",
      "/normativeSources/0/sections/0/headingAncestry",
      (items: readonly unknown[]) => ({
        ...validInventory(),
        normativeSources: [{ ...SOURCE, sections: [{ ...SECTION, headingAncestry: items }] }],
      }),
      "Values",
    ],
    [
      "valid-domain descriptors",
      "/rules/0/validDomains",
      (items: readonly unknown[]) => ({
        ...validInventory(),
        rules: [{ ...RULE, validDomains: items }],
      }),
      { kind: "integer-range", values: ["0"] },
    ],
    [
      "invalid-neighbor descriptors",
      "/rules/0/invalidNeighbors",
      (items: readonly unknown[]) => ({
        ...validInventory(),
        rules: [{ ...RULE, invalidNeighbors: items }],
      }),
      { kind: "integer-range", values: ["256"] },
    ],
    [
      "domain values",
      "/rules/0/validDomains/0/values",
      (items: readonly unknown[]) => ({
        ...validInventory(),
        rules: [{ ...RULE, validDomains: [{ kind: "integer-range", values: items }] }],
      }),
      "0",
    ],
  ] as const)("should enforce the %s boundary", (_name, path, build, item) => {
    const limit = INVENTORY_V1_LIMITS.maxArrayItems;
    const exact = build(Array.from({ length: limit }, () => item));
    const over = build(Array.from({ length: limit + 1 }, () => item));

    expect(validateInventorySchema(exact)).toEqual(
      expect.objectContaining({ ok: true, diagnostics: [] }),
    );
    expect(validateInventorySchema(over).diagnostics).toContainEqual(
      expect.objectContaining({ code: "schema.max-items", path }),
    );
  });

  // Published limits are immutable so one validation call cannot weaken later calls.
  it("should expose immutable v1 limits", () => {
    expect(Object.isFrozen(INVENTORY_V1_LIMITS)).toBe(true);
  });
});
