import { describe, expect, it } from "vitest";
import { INVENTORY_V1_LIMITS } from "./limits.js";
import type { InventoryRule, InventoryV1, SemanticValidationContext } from "./model.js";
import { validateInventorySemantics } from "./semantic-validator.js";

const HASH: `sha256:${string}` = `sha256:${"a".repeat(64)}`;

function rule(ruleId: string): InventoryRule {
  return {
    ruleId,
    source: {
      path: "spec/source.md",
      headingAncestry: ["Source"],
      quote: "Rule.",
      contentHash: HASH,
      displayLine: 2,
    },
    requirement: "Rule.",
    category: "source",
    polarity: "positive",
    applicability: "mandatory-c64",
    validDomains: [],
    invalidNeighbors: [],
    boundaryFamilies: [],
    generatorIds: [],
    oracleIds: [],
    transformIds: [],
    handlerAbsenceReason: "No executable handler is required.",
    evidenceObligations: [],
    prerequisiteRuleIds: [],
    relatedRuleIds: [],
  };
}

function inventory(rules: readonly InventoryRule[]): InventoryV1 {
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
    rules,
    evolutionGate: null,
  };
}

const context: SemanticValidationContext = {
  fragments: [],
  identityLedgerBytes: new Uint8Array(),
  limits: INVENTORY_V1_LIMITS,
};

describe("semantic validation pass prerequisites", () => {
  it("should reject duplicate rule IDs before identity-ledger or graph work", () => {
    const result = validateInventorySemantics(
      inventory([rule("rule.same"), rule("rule.same")]),
      context,
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "ledger.duplicate-rule",
        relatedPaths: ["$.rules[0].ruleId", "$.rules[1].ruleId"],
      }),
    ]);
    expect(result.topologicalRuleIds).toBeUndefined();
  });

  it("should reject duplicate resolved source fragments before ledger parsing", () => {
    const fragment = {
      sourcePath: "spec/source.md",
      quote: "Rule.",
      fragment: {
        fragmentId: "frag.v1.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        kind: "paragraph" as const,
        startByte: 0,
        endByte: 5,
        headingAncestry: ["Source"],
        sectionIdentity: "section",
        contentHash: HASH,
        displayLine: 1,
        displayColumn: 1,
      },
    };
    const result = validateInventorySemantics(inventory([]), {
      ...context,
      fragments: [fragment, fragment],
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("ledger.duplicate-fragment");
  });
});
