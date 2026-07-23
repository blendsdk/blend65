import { describe, expect, it } from "vitest";
import { INVENTORY_V1_LIMITS } from "./limits.js";
import type { InventoryRule, InventoryV1 } from "./model.js";
import { validateRuleGraph } from "./rule-graph.js";

const HASH = `sha256:${"d".repeat(64)}`;
const TARGETS = ["c64", "c64u", "cx16", "a800xl", "a7800"] as const;

function rule(ruleId: string, prerequisiteRuleIds: readonly string[] = []): InventoryRule {
  return {
    ruleId,
    source: {
      path: "spec/appendix-platforms.md",
      headingAncestry: ["Universal"],
      quote: "The obligation applies.",
      contentHash: HASH,
      displayLine: 1,
    },
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
    prerequisiteRuleIds,
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

function universalParent(ruleId: string): InventoryRule {
  return {
    ...rule(ruleId),
    applicability: "out-of-claim-target",
    applicabilityReason: {
      code: "universal-parent",
      target: "universal",
      citation: rule(ruleId).source,
    },
  };
}

function projection(
  parent: InventoryRule,
  target: (typeof TARGETS)[number],
  prerequisiteRuleIds: readonly string[] = [],
): InventoryRule {
  const { applicabilityReason: _parentReason, ...shared } = parent;
  return {
    ...shared,
    ruleId: `${parent.ruleId}.${target}`,
    applicability: target === "c64" ? "mandatory-c64" : "out-of-claim-target",
    ...(target === "c64"
      ? {}
      : {
          applicabilityReason: {
            code: "different-target" as const,
            target,
            citation: parent.source,
          },
        }),
    prerequisiteRuleIds,
    universalProjection: { parentRuleId: parent.ruleId, target },
  };
}

describe("rule graph implementation hardening", () => {
  it("discovers a universal parent even when it has no projection children", () => {
    const result = validateRuleGraph(inventory([universalParent("rule.parent")]));
    expect(result.ok).toBe(false);
    expect(result.diagnostics.map(({ message }) => message)).toContain(
      "Projection parent rule.parent is missing target c64.",
    );
  });

  it("rejects an invalid universal parent applicability and invalid child reason", () => {
    const validParent = universalParent("rule.parent");
    const invalidParent = {
      ...validParent,
      applicability: "mandatory-c64" as const,
    };
    expect(
      validateRuleGraph(
        inventory([invalidParent, ...TARGETS.map((target) => projection(invalidParent, target))]),
      ).diagnostics.map(({ message }) => message),
    ).toContain("Projection parent rule.parent is invalid.");

    const children = TARGETS.map((target) => projection(validParent, target));
    children[1] = {
      ...children[1],
      applicabilityReason: {
        code: "different-target",
        target: "cx16",
        citation: validParent.source,
      },
    };
    const result = validateRuleGraph(inventory([validParent, ...children]));
    expect(result.ok).toBe(false);
    expect(result.diagnostics.map(({ message }) => message)).toContain(
      "Projection child rule.parent.c64u does not retain parent semantics.",
    );
  });

  it("rejects cross-target prerequisites globally while permitting neutral prerequisites", () => {
    const first = universalParent("rule.first");
    const neutral = rule("rule.neutral");
    const second = { ...universalParent("rule.second"), prerequisiteRuleIds: ["rule.neutral"] };
    const firstChildren = TARGETS.map((target) => projection(first, target));
    const secondChildren = TARGETS.map((target) =>
      projection(second, target, target === "c64" ? ["rule.first.cx16"] : ["rule.neutral"]),
    );
    const result = validateRuleGraph(
      inventory([neutral, first, ...firstChildren, second, ...secondChildren]),
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        message: "Target-specific rule rule.second.c64 depends on a different concrete target.",
      }),
    );
    const neutralChildren = TARGETS.map((target) => projection(second, target, ["rule.neutral"]));
    expect(validateRuleGraph(inventory([neutral, second, ...neutralChildren])).ok).toBe(true);
  });

  it("rejects non-projected cross-target edges and accepts equal concrete targets", () => {
    const targetRule = (
      ruleId: string,
      target: string,
      prerequisiteRuleIds: readonly string[] = [],
    ) => ({
      ...rule(ruleId, prerequisiteRuleIds),
      applicability: "out-of-claim-target" as const,
      applicabilityReason: {
        code: "different-target",
        target,
        citation: rule(ruleId).source,
      },
    });
    const cx16 = targetRule("rule.cx16", "cx16");
    const crossTarget = targetRule("rule.a7800", "a7800", ["rule.cx16"]);
    expect(validateRuleGraph(inventory([cx16, crossTarget])).ok).toBe(false);
    const sameTarget = targetRule("rule.cx16-dependent", "cx16", ["rule.cx16"]);
    expect(validateRuleGraph(inventory([cx16, sameTarget])).ok).toBe(true);
  });

  it("handles the maximum permitted chain without recursion", () => {
    const rules = Array.from({ length: INVENTORY_V1_LIMITS.maxRules }, (_, index) => {
      const id = `rule.${index.toString().padStart(5, "0")}`;
      return rule(id, index === 0 ? [] : [`rule.${(index - 1).toString().padStart(5, "0")}`]);
    });
    const result = validateRuleGraph(inventory(rules));
    expect(result.ok).toBe(true);
    expect(result.topologicalRuleIds).toHaveLength(INVENTORY_V1_LIMITS.maxRules);
    expect(result.topologicalRuleIds?.at(-1)).toBe("rule.32767");
  }, 30_000);

  it("orders the maximum permitted broad ready set without quadratic queue sorting", () => {
    const rules = Array.from({ length: INVENTORY_V1_LIMITS.maxRules }, (_, index) =>
      rule(`rule.${(INVENTORY_V1_LIMITS.maxRules - index - 1).toString().padStart(5, "0")}`),
    );
    const result = validateRuleGraph(inventory(rules));
    expect(result.ok).toBe(true);
    expect(result.topologicalRuleIds?.slice(0, 2)).toEqual(["rule.00000", "rule.00001"]);
    expect(result.topologicalRuleIds?.at(-1)).toBe("rule.32767");
  }, 30_000);
});
