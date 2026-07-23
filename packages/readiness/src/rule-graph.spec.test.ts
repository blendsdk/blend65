import { describe, expect, it } from "vitest";
import { validateRuleGraph } from "./index.js";
import type { InventoryRule, InventoryV1, UniversalProjection } from "./index.js";

const HASH = `sha256:${"d".repeat(64)}`;
const TARGETS = ["c64", "c64u", "cx16", "a800xl", "a7800"] as const;

function citation() {
  return {
    path: "spec/appendix-platforms.md",
    headingAncestry: ["Universal"],
    quote: "The obligation applies to every platform.",
    contentHash: HASH,
    displayLine: 8,
  } as const;
}

function baseRule(ruleId: string): InventoryRule {
  return {
    ruleId,
    source: citation(),
    requirement: "The obligation must hold.",
    category: "platform",
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

function parent(ruleId: string, prerequisiteRuleIds: readonly string[] = []): InventoryRule {
  return {
    ...baseRule(ruleId),
    applicability: "out-of-claim-target",
    applicabilityReason: { code: "universal-parent", target: "universal", citation: citation() },
    prerequisiteRuleIds,
  };
}

function child(
  parentRule: InventoryRule,
  target: (typeof TARGETS)[number],
  prerequisiteRuleIds: readonly string[] = [],
): InventoryRule {
  const universalProjection: UniversalProjection = { parentRuleId: parentRule.ruleId, target };
  const { applicabilityReason: _parentApplicabilityReason, ...sharedFields } = parentRule;
  return {
    ...sharedFields,
    ruleId: `${parentRule.ruleId}.${target}`,
    applicability: target === "c64" ? "mandatory-c64" : "out-of-claim-target",
    ...(target === "c64"
      ? {}
      : {
          applicabilityReason: {
            code: "different-target",
            target,
            citation: parentRule.source,
          },
        }),
    prerequisiteRuleIds,
    universalProjection,
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

describe("universal target projection", () => {
  // A universal obligation has exactly five authored source-linked children.
  it("should validate one mandatory C64 child and four visible out-of-claim children", () => {
    const universal = parent("rule.universal");
    const children = TARGETS.map((target) => child(universal, target));
    const result = validateRuleGraph(inventory([universal, ...children]));
    expect(result.ok).toBe(true);
    expect(children.map(({ universalProjection }) => universalProjection?.target)).toEqual(TARGETS);
    expect(children.map(({ applicability }) => applicability)).toEqual([
      "mandatory-c64",
      "out-of-claim-target",
      "out-of-claim-target",
      "out-of-claim-target",
      "out-of-claim-target",
    ]);
    expect(children.every(({ source }) => source === universal.source)).toBe(true);
  });

  // Universal prerequisite edges rewrite to each corresponding target child.
  it("should validate same-target prerequisite rewrites without cross-target edges", () => {
    const prerequisite = parent("rule.prerequisite");
    const dependent = parent("rule.dependent", ["rule.prerequisite"]);
    const prerequisiteChildren = TARGETS.map((target) => child(prerequisite, target));
    const dependentChildren = TARGETS.map((target) =>
      child(dependent, target, [`rule.prerequisite.${target}`]),
    );
    expect(
      validateRuleGraph(
        inventory([prerequisite, ...prerequisiteChildren, dependent, ...dependentChildren]),
      ).ok,
    ).toBe(true);
  });

  // A projection group is invalid when any target child is absent.
  it("should reject a projection group with a missing target child", () => {
    const universal = parent("rule.universal");
    const children = TARGETS.slice(0, -1).map((target) => child(universal, target));
    expect(validateRuleGraph(inventory([universal, ...children])).ok).toBe(false);
  });

  // A projected child cannot depend on another target's sibling.
  it("should reject a cross-target projected prerequisite", () => {
    const prerequisite = parent("rule.prerequisite");
    const dependent = parent("rule.dependent", ["rule.prerequisite"]);
    const prerequisiteChildren = TARGETS.map((target) => child(prerequisite, target));
    const dependentChildren = TARGETS.map((target) =>
      child(
        dependent,
        target,
        target === "c64" ? ["rule.prerequisite.cx16"] : [`rule.prerequisite.${target}`],
      ),
    );
    expect(
      validateRuleGraph(
        inventory([prerequisite, ...prerequisiteChildren, dependent, ...dependentChildren]),
      ).ok,
    ).toBe(false);
  });
});

describe("prerequisite graph", () => {
  // Invalid executable edges fail deterministically.
  it.each([
    [
      "self",
      [baseRule("rule.a")],
      (rules: InventoryRule[]) => [{ ...rules[0], prerequisiteRuleIds: ["rule.a"] }],
    ],
    [
      "duplicate",
      [baseRule("rule.a"), baseRule("rule.b")],
      (rules: InventoryRule[]) => [
        rules[0],
        { ...rules[1], prerequisiteRuleIds: ["rule.a", "rule.a"] },
      ],
    ],
    [
      "unknown",
      [baseRule("rule.a")],
      (rules: InventoryRule[]) => [{ ...rules[0], prerequisiteRuleIds: ["rule.missing"] }],
    ],
    [
      "mandatory-to-inapplicable",
      [baseRule("rule.a"), baseRule("rule.b")],
      (rules: InventoryRule[]) => [
        {
          ...rules[0],
          applicability: "not-applicable-c64" as const,
          applicabilityReason: { code: "different-target", target: "cx16", citation: citation() },
        },
        { ...rules[1], prerequisiteRuleIds: ["rule.a"] },
      ],
    ],
  ] as const)("should reject a %s prerequisite edge", (_name, seed, mutate) => {
    const result = validateRuleGraph(inventory(mutate([...seed])));
    expect(result.ok).toBe(false);
    expect(result.topologicalRuleIds).toBeUndefined();
  });

  // Canonical cycle diagnostics start at the least member and close the path.
  it("should report one deterministic canonical cycle path", () => {
    const rules = [
      { ...baseRule("rule.a"), prerequisiteRuleIds: ["rule.b"] },
      { ...baseRule("rule.b"), prerequisiteRuleIds: ["rule.c"] },
      { ...baseRule("rule.c"), prerequisiteRuleIds: ["rule.a"] },
    ];
    const result = validateRuleGraph(inventory(rules));
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        phase: "graph",
        message: expect.stringContaining("rule.a -> rule.b -> rule.c -> rule.a"),
      }),
    ]);
  });

  // Lexical Kahn ordering is stable and descriptive cycles have no execution effect.
  it("should order tied roots lexically while ignoring a related-rule cycle", () => {
    const rules = [
      { ...baseRule("rule.z"), prerequisiteRuleIds: ["rule.b"] },
      { ...baseRule("rule.b"), relatedRuleIds: ["rule.a"] },
      { ...baseRule("rule.a"), relatedRuleIds: ["rule.b"] },
    ];
    const result = validateRuleGraph(inventory(rules));
    expect(result.ok).toBe(true);
    expect(result.topologicalRuleIds).toEqual(["rule.a", "rule.b", "rule.z"]);
  });
});
