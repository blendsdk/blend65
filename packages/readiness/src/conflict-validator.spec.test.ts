import { describe, expect, it } from "vitest";
import { INVENTORY_V1_LIMITS, validateConflicts } from "./index.js";
import type {
  ConflictClassification,
  InventoryRule,
  InventoryV1,
  ResolvedSourceFragment,
} from "./index.js";

const HASH: `sha256:${string}` = `sha256:${"b".repeat(64)}`;

function citation(path: string, quote: string) {
  return {
    path,
    headingAncestry: ["Conflicts"],
    quote,
    contentHash: HASH,
    displayLine: 4,
  } as const;
}

function rule(ruleId: string, path = "spec/01.md"): InventoryRule {
  return {
    ruleId,
    source: citation(path, "First statement."),
    requirement: `${ruleId} must hold.`,
    category: "semantics",
    polarity: "positive",
    applicability: "mandatory-c64",
    validDomains: [],
    invalidNeighbors: [],
    boundaryFamilies: [],
    generatorIds: [],
    oracleIds: [],
    transformIds: [],
    handlerAbsenceReason: "not-required",
    evidenceObligations: ["frontend"],
    prerequisiteRuleIds: [],
    relatedRuleIds: [],
  };
}

function fixture(classification: ConflictClassification): InventoryV1 {
  const rules = classification === "contradiction" ? [] : [rule("rule.owner")];
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
    clauseLedger:
      classification === "contradiction"
        ? [
            {
              fragmentId: "fragment.conflict",
              disposition: "blocked-errata",
              conflictId: "conflict.one",
            },
          ]
        : [
            {
              fragmentId: "fragment.conflict",
              disposition: "canonical-restatement",
              canonicalRuleId: "rule.owner",
              conflictId: "conflict.one",
            },
          ],
    conflicts: [
      {
        conflictId: "conflict.one",
        classification,
        citations: [
          citation("spec/01.md", "First statement."),
          citation("spec/feature-index.md", "Second statement."),
        ],
        ruleIds: classification === "contradiction" ? [] : ["rule.owner"],
        resolution:
          classification === "contradiction" ? "Await erratum." : "Chapter owns semantics.",
      },
    ],
    rules,
    evolutionGate: null,
  };
}

function fragments(): readonly ResolvedSourceFragment[] {
  return [
    {
      sourcePath: "spec/01.md",
      quote: "First statement.",
      fragment: {
        fragmentId: "fragment.owner",
        kind: "paragraph",
        startByte: 0,
        endByte: 16,
        headingAncestry: ["Conflicts"],
        sectionIdentity: "conflicts.0",
        contentHash: HASH,
        displayLine: 4,
        displayColumn: 1,
      },
    },
    {
      sourcePath: "spec/feature-index.md",
      quote: "Second statement.",
      fragment: {
        fragmentId: "fragment.conflict",
        kind: "paragraph",
        startByte: 0,
        endByte: 17,
        headingAncestry: ["Conflicts"],
        sectionIdentity: "conflicts.0",
        contentHash: HASH,
        displayLine: 4,
        displayColumn: 1,
      },
    },
  ];
}

describe("reviewed source conflicts", () => {
  // The four reviewed conflict classes remain mechanically distinct.
  it.each([
    "equivalent-restatement",
    "duplicate-ownership",
    "overlapping-obligation",
    "contradiction",
  ] as const)("should preserve the %s classification", (classification) => {
    const inventory = fixture(classification);
    const result = validateConflicts(inventory, {
      fragments: fragments(),
      identityLedgerBytes: new Uint8Array(),
      limits: INVENTORY_V1_LIMITS,
    });
    expect(result.ok).toBe(true);
    expect(result.inventory?.conflicts).toEqual(inventory.conflicts);
  });

  // One contradiction owns all citations and blocks readiness without a passable rule.
  it("should emit one unresolved blocker for one complete contradiction aggregate", () => {
    const result = validateConflicts(fixture("contradiction"), {
      fragments: fragments(),
      identityLedgerBytes: new Uint8Array(),
      limits: INVENTORY_V1_LIMITS,
    });
    expect(result.blockingReasons).toEqual([
      {
        kind: "blocked-errata",
        identity: "fragment.conflict",
        sourcePaths: ["spec/01.md", "spec/feature-index.md"],
      },
      {
        kind: "unresolved-source-conflict",
        identity: "conflict.one",
        sourcePaths: ["spec/01.md", "spec/feature-index.md"],
      },
    ]);
    expect(result.inventory?.rules).toEqual([]);
  });

  // Contradictions cannot be split into competing aggregates or passable rows.
  it("should reject a contradiction that names a passable rule", () => {
    const inventory = fixture("contradiction");
    const invalid = {
      ...inventory,
      conflicts: [{ ...inventory.conflicts[0], ruleIds: ["rule.competing"] }],
      rules: [rule("rule.competing")],
    };
    expect(
      validateConflicts(invalid, {
        fragments: fragments(),
        identityLedgerBytes: new Uint8Array(),
        limits: INVENTORY_V1_LIMITS,
      }).ok,
    ).toBe(false);
  });
});
