import { describe, expect, it } from "vitest";
import { validateInventorySchema } from "./index.js";

const VALID_INVENTORY = {
  schemaVersion: 1,
  inventoryVersion: "1.0.0",
  specRevision: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  identityLedgerHead: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  normativeSources: [
    {
      path: "spec/language.md",
      order: 0,
      classification: "normative-chapter",
      sections: [
        {
          headingAncestry: ["Values"],
          classification: "normative-chapter",
          contentHash: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        },
      ],
    },
  ],
  fragmentationProfile: {
    profileId: "markdown-ebnf-v1",
    version: 1,
    contentHashAlgorithm: "sha256",
    newlinePolicy: "lf",
  },
  handlerDeclarations: [
    {
      id: "generator.integer",
      kind: "generator",
      owner: "compiler-readiness",
      contractVersion: "1.0.0",
      binding: "unbound",
    },
  ],
  evidenceCapabilityDeclarations: [
    {
      id: "frontend",
      owner: "compiler-readiness",
      contractVersion: "1.0.0",
      binding: "unbound",
      observableContract: "The frontend accepts or rejects a source program.",
      prerequisiteRoute: "compiler.frontend",
    },
  ],
  clauseLedger: [
    {
      fragmentId: "fragment.values.aaaaaaaa",
      disposition: "mapped",
      ruleIds: ["rule.integer-literal"],
    },
  ],
  conflicts: [],
  evolutionGate: null,
  rules: [
    {
      ruleId: "rule.integer-literal",
      source: {
        path: "spec/language.md",
        headingAncestry: ["Values"],
        quote: "Integer literals denote integer values.",
        contentHash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        displayLine: 10,
      },
      requirement: "Integer literals must denote integer values.",
      category: "values",
      polarity: "positive",
      applicability: "mandatory-c64",
      validDomains: [{ kind: "integer-range", values: ["0", "255"] }],
      invalidNeighbors: [],
      boundaryFamilies: ["integer"],
      generatorIds: ["generator.integer"],
      oracleIds: [],
      transformIds: [],
      evidenceObligations: ["frontend"],
      prerequisiteRuleIds: [],
      relatedRuleIds: [],
    },
  ],
} as const;

type MutableRecord = Record<string, unknown>;
type PathSegment = number | string;

function cloneValidInventory(): MutableRecord {
  const clone: unknown = structuredClone(VALID_INVENTORY);
  if (!isRecord(clone)) {
    throw new TypeError("The inventory fixture must be an object.");
  }
  return clone;
}

function expectSingleSchemaDiagnostic(
  fixture: unknown,
  expectedCode: string,
  expectedPath: string,
): void {
  const result = validateInventorySchema(fixture);

  expect(result.ok).toBe(false);
  expect(result.inventory).toBeUndefined();
  expect(result.diagnostics).toEqual([
    expect.objectContaining({
      phase: "schema",
      severity: "error",
      code: expectedCode,
      path: expectedPath,
      relatedPaths: [],
    }),
  ]);
}

function isRecord(value: unknown): value is MutableRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function objectAt(root: MutableRecord, segments: readonly PathSegment[]): MutableRecord {
  let target: unknown = root;
  for (const segment of segments) {
    if (typeof segment === "number" && Array.isArray(target)) {
      target = target[segment];
      continue;
    }
    if (typeof segment === "string" && isRecord(target)) {
      target = target[segment];
      continue;
    }
    throw new TypeError(`Fixture path segment ${String(segment)} does not select an object.`);
  }
  if (!isRecord(target)) {
    throw new TypeError("Fixture path must select an object.");
  }
  return target;
}

interface VariantObjectFixture {
  readonly name: string;
  readonly segments: readonly PathSegment[];
  readonly requiredFields: readonly string[];
  readonly create: () => MutableRecord;
}

function inventoryWithLedger(entry: MutableRecord): MutableRecord {
  const fixture = cloneValidInventory();
  fixture.clauseLedger = [entry];
  return fixture;
}

function inventoryWithRuleChange(change: MutableRecord): MutableRecord {
  const fixture = cloneValidInventory();
  Object.assign(objectAt(fixture, ["rules", 0]), change);
  return fixture;
}

const VARIANT_OBJECTS: readonly VariantObjectFixture[] = [
  {
    name: "decomposed ledger entry",
    segments: ["clauseLedger", 0],
    requiredFields: ["fragmentId", "disposition", "childOutcomes"],
    create: () =>
      inventoryWithLedger({
        fragmentId: "fragment.values.aaaaaaaa",
        disposition: "decomposed",
        childOutcomes: [{ outcomeId: "outcome.integer", ruleIds: ["rule.integer-literal"] }],
      }),
  },
  {
    name: "child outcome",
    segments: ["clauseLedger", 0, "childOutcomes", 0],
    requiredFields: ["outcomeId", "ruleIds"],
    create: () =>
      inventoryWithLedger({
        fragmentId: "fragment.values.aaaaaaaa",
        disposition: "decomposed",
        childOutcomes: [{ outcomeId: "outcome.integer", ruleIds: ["rule.integer-literal"] }],
      }),
  },
  {
    name: "non-normative ledger entry",
    segments: ["clauseLedger", 0],
    requiredFields: ["fragmentId", "disposition", "reasonCode"],
    create: () =>
      inventoryWithLedger({
        fragmentId: "fragment.values.aaaaaaaa",
        disposition: "non-normative",
        reasonCode: "example-only",
      }),
  },
  {
    name: "restatement ledger entry",
    segments: ["clauseLedger", 0],
    requiredFields: ["fragmentId", "disposition", "canonicalRuleId", "conflictId"],
    create: () =>
      inventoryWithLedger({
        fragmentId: "fragment.values.aaaaaaaa",
        disposition: "canonical-restatement",
        canonicalRuleId: "rule.integer-literal",
        conflictId: "conflict.integer-literal-restatement",
      }),
  },
  {
    name: "blocked ledger entry",
    segments: ["clauseLedger", 0],
    requiredFields: ["fragmentId", "disposition", "conflictId"],
    create: () =>
      inventoryWithLedger({
        fragmentId: "fragment.values.aaaaaaaa",
        disposition: "blocked-errata",
        conflictId: "conflict.integer",
      }),
  },
  {
    name: "conflict record",
    segments: ["conflicts", 0],
    requiredFields: ["conflictId", "classification", "citations", "ruleIds", "resolution"],
    create: () => {
      const fixture = cloneValidInventory();
      fixture.conflicts = [
        {
          conflictId: "conflict.integer",
          classification: "contradiction",
          citations: [structuredClone(VALID_INVENTORY.rules[0].source)],
          ruleIds: ["rule.integer-literal"],
          resolution: "blocked",
        },
      ];
      return fixture;
    },
  },
  {
    name: "applicability reason",
    segments: ["rules", 0, "applicabilityReason"],
    requiredFields: ["code", "target", "citation"],
    create: () =>
      inventoryWithRuleChange({
        applicability: "not-applicable-c64",
        applicabilityReason: {
          code: "target-excluded",
          target: "c64",
          citation: structuredClone(VALID_INVENTORY.rules[0].source),
        },
      }),
  },
  {
    name: "lineage",
    segments: ["rules", 0, "lineage"],
    requiredFields: [],
    create: () => inventoryWithRuleChange({ lineage: { splitFrom: ["rule.integer-parent"] } }),
  },
  {
    name: "universal projection",
    segments: ["rules", 0, "universalProjection"],
    requiredFields: ["parentRuleId", "target"],
    create: () =>
      inventoryWithRuleChange({
        applicability: "out-of-claim-target",
        applicabilityReason: {
          code: "other-target",
          target: "cx16",
          citation: structuredClone(VALID_INVENTORY.rules[0].source),
        },
        universalProjection: { parentRuleId: "rule.integer-parent", target: "cx16" },
      }),
  },
  {
    name: "evolution gate",
    segments: ["evolutionGate"],
    requiredFields: ["owner", "semanticRevision", "acceptanceGate", "validatedAt"],
    create: () => {
      const fixture = cloneValidInventory();
      fixture.evolutionGate = {
        owner: "compiler-readiness",
        semanticRevision: "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        acceptanceGate: "evolution-approved",
        validatedAt: "2026-07-23T21:00:00Z",
      };
      return fixture;
    },
  },
];

describe("inventory v1 schema", () => {
  // A minimal well-formed inventory must survive strict, closed-schema validation.
  it("should accept a minimal well-formed v1 inventory", () => {
    const result = validateInventorySchema(structuredClone(VALID_INVENTORY));

    expect(result.ok).toBe(true);
    expect(result.inventory).toEqual(VALID_INVENTORY);
    expect(result.diagnostics).toEqual([]);
    expect(result.blockingReasons).toEqual([]);
  });

  // Every object in the inventory is closed, including nested citations and declarations.
  it.each([
    ["inventory", [], "/unexpected"],
    ["normative source", ["normativeSources", 0], "/normativeSources/0/unexpected"],
    [
      "section",
      ["normativeSources", 0, "sections", 0],
      "/normativeSources/0/sections/0/unexpected",
    ],
    ["fragmentation profile", ["fragmentationProfile"], "/fragmentationProfile/unexpected"],
    ["handler declaration", ["handlerDeclarations", 0], "/handlerDeclarations/0/unexpected"],
    [
      "evidence capability",
      ["evidenceCapabilityDeclarations", 0],
      "/evidenceCapabilityDeclarations/0/unexpected",
    ],
    ["clause disposition", ["clauseLedger", 0], "/clauseLedger/0/unexpected"],
    ["rule", ["rules", 0], "/rules/0/unexpected"],
    ["citation", ["rules", 0, "source"], "/rules/0/source/unexpected"],
    ["domain descriptor", ["rules", 0, "validDomains", 0], "/rules/0/validDomains/0/unexpected"],
  ])("should reject an unknown property on the %s object", (_kind, segments, expectedPath) => {
    const fixture = cloneValidInventory();
    objectAt(fixture, segments).unexpected = true;

    expectSingleSchemaDiagnostic(fixture, "schema.additional-property", expectedPath);
  });

  // Every required field fails independently and identifies its canonical path.
  it.each([
    [[], "schemaVersion", "/schemaVersion"],
    [[], "inventoryVersion", "/inventoryVersion"],
    [[], "specRevision", "/specRevision"],
    [[], "identityLedgerHead", "/identityLedgerHead"],
    [[], "normativeSources", "/normativeSources"],
    [[], "fragmentationProfile", "/fragmentationProfile"],
    [[], "handlerDeclarations", "/handlerDeclarations"],
    [[], "evidenceCapabilityDeclarations", "/evidenceCapabilityDeclarations"],
    [[], "clauseLedger", "/clauseLedger"],
    [[], "conflicts", "/conflicts"],
    [[], "evolutionGate", "/evolutionGate"],
    [[], "rules", "/rules"],
    [["fragmentationProfile"], "profileId", "/fragmentationProfile/profileId"],
    [["fragmentationProfile"], "version", "/fragmentationProfile/version"],
    [
      ["fragmentationProfile"],
      "contentHashAlgorithm",
      "/fragmentationProfile/contentHashAlgorithm",
    ],
    [["fragmentationProfile"], "newlinePolicy", "/fragmentationProfile/newlinePolicy"],
    [["normativeSources", 0], "path", "/normativeSources/0/path"],
    [["normativeSources", 0], "order", "/normativeSources/0/order"],
    [["normativeSources", 0], "classification", "/normativeSources/0/classification"],
    [["normativeSources", 0], "sections", "/normativeSources/0/sections"],
    [
      ["normativeSources", 0, "sections", 0],
      "headingAncestry",
      "/normativeSources/0/sections/0/headingAncestry",
    ],
    [
      ["normativeSources", 0, "sections", 0],
      "classification",
      "/normativeSources/0/sections/0/classification",
    ],
    [
      ["normativeSources", 0, "sections", 0],
      "contentHash",
      "/normativeSources/0/sections/0/contentHash",
    ],
    [["handlerDeclarations", 0], "id", "/handlerDeclarations/0/id"],
    [["handlerDeclarations", 0], "kind", "/handlerDeclarations/0/kind"],
    [["handlerDeclarations", 0], "owner", "/handlerDeclarations/0/owner"],
    [["handlerDeclarations", 0], "contractVersion", "/handlerDeclarations/0/contractVersion"],
    [["handlerDeclarations", 0], "binding", "/handlerDeclarations/0/binding"],
    [["evidenceCapabilityDeclarations", 0], "id", "/evidenceCapabilityDeclarations/0/id"],
    [["evidenceCapabilityDeclarations", 0], "owner", "/evidenceCapabilityDeclarations/0/owner"],
    [
      ["evidenceCapabilityDeclarations", 0],
      "contractVersion",
      "/evidenceCapabilityDeclarations/0/contractVersion",
    ],
    [["evidenceCapabilityDeclarations", 0], "binding", "/evidenceCapabilityDeclarations/0/binding"],
    [
      ["evidenceCapabilityDeclarations", 0],
      "observableContract",
      "/evidenceCapabilityDeclarations/0/observableContract",
    ],
    [
      ["evidenceCapabilityDeclarations", 0],
      "prerequisiteRoute",
      "/evidenceCapabilityDeclarations/0/prerequisiteRoute",
    ],
    [["clauseLedger", 0], "fragmentId", "/clauseLedger/0/fragmentId"],
    [["clauseLedger", 0], "disposition", "/clauseLedger/0/disposition"],
    [["clauseLedger", 0], "ruleIds", "/clauseLedger/0/ruleIds"],
    [["rules", 0], "ruleId", "/rules/0/ruleId"],
    [["rules", 0], "source", "/rules/0/source"],
    [["rules", 0], "requirement", "/rules/0/requirement"],
    [["rules", 0], "category", "/rules/0/category"],
    [["rules", 0], "polarity", "/rules/0/polarity"],
    [["rules", 0], "applicability", "/rules/0/applicability"],
    [["rules", 0], "validDomains", "/rules/0/validDomains"],
    [["rules", 0], "invalidNeighbors", "/rules/0/invalidNeighbors"],
    [["rules", 0], "boundaryFamilies", "/rules/0/boundaryFamilies"],
    [["rules", 0], "generatorIds", "/rules/0/generatorIds"],
    [["rules", 0], "oracleIds", "/rules/0/oracleIds"],
    [["rules", 0], "transformIds", "/rules/0/transformIds"],
    [["rules", 0], "evidenceObligations", "/rules/0/evidenceObligations"],
    [["rules", 0], "prerequisiteRuleIds", "/rules/0/prerequisiteRuleIds"],
    [["rules", 0], "relatedRuleIds", "/rules/0/relatedRuleIds"],
    [["rules", 0, "source"], "path", "/rules/0/source/path"],
    [["rules", 0, "source"], "headingAncestry", "/rules/0/source/headingAncestry"],
    [["rules", 0, "source"], "quote", "/rules/0/source/quote"],
    [["rules", 0, "source"], "contentHash", "/rules/0/source/contentHash"],
    [["rules", 0, "source"], "displayLine", "/rules/0/source/displayLine"],
    [["rules", 0, "validDomains", 0], "kind", "/rules/0/validDomains/0/kind"],
    [["rules", 0, "validDomains", 0], "values", "/rules/0/validDomains/0/values"],
  ])("should reject a missing required field at %s/%s", (segments, field, expectedPath) => {
    const fixture = cloneValidInventory();
    delete objectAt(fixture, segments)[String(field)];

    expectSingleSchemaDiagnostic(fixture, "schema.required", String(expectedPath));
  });

  // Enum discriminators and stable IDs are allowlisted rather than accepted as arbitrary strings.
  it.each([
    [
      ["normativeSources", 0, "classification"],
      "informal",
      "/normativeSources/0/classification",
      "schema.enum",
    ],
    [
      ["normativeSources", 0, "sections", 0, "classification"],
      "informal",
      "/normativeSources/0/sections/0/classification",
      "schema.enum",
    ],
    [["handlerDeclarations", 0, "kind"], "executor", "/handlerDeclarations/0/kind", "schema.enum"],
    [
      ["handlerDeclarations", 0, "binding"],
      "missing",
      "/handlerDeclarations/0/binding",
      "schema.enum",
    ],
    [
      ["evidenceCapabilityDeclarations", 0, "binding"],
      "missing",
      "/evidenceCapabilityDeclarations/0/binding",
      "schema.enum",
    ],
    [["clauseLedger", 0, "disposition"], "ignored", "/clauseLedger/0/disposition", "schema.enum"],
    [["rules", 0, "polarity"], "sometimes", "/rules/0/polarity", "schema.enum"],
    [["rules", 0, "applicability"], "all-targets", "/rules/0/applicability", "schema.enum"],
    [["rules", 0, "ruleId"], "../rule", "/rules/0/ruleId", "schema.pattern"],
  ])("should reject invalid value at %s", (segments, value, expectedPath, expectedCode) => {
    const fixture = cloneValidInventory();
    const field = segments.at(-1);
    objectAt(fixture, segments.slice(0, -1))[String(field)] = value;

    expectSingleSchemaDiagnostic(fixture, String(expectedCode), String(expectedPath));
  });

  for (const variant of VARIANT_OBJECTS) {
    it(`should keep the ${variant.name} object closed`, () => {
      const fixture = variant.create();
      objectAt(fixture, variant.segments).unexpected = true;

      expectSingleSchemaDiagnostic(
        fixture,
        "schema.additional-property",
        `/${variant.segments.join("/")}/unexpected`,
      );
    });

    it(`should require every field on the ${variant.name} object`, () => {
      for (const field of variant.requiredFields) {
        const fixture = variant.create();
        delete objectAt(fixture, variant.segments)[field];

        expectSingleSchemaDiagnostic(
          fixture,
          "schema.required",
          `/${variant.segments.join("/")}/${field}`,
        );
      }
    });
  }

  it("should require applicability evidence for every non-mandatory rule", () => {
    const fixture = inventoryWithRuleChange({ applicability: "not-applicable-c64" });

    expectSingleSchemaDiagnostic(fixture, "schema.required", "/rules/0/applicabilityReason");
  });
});
