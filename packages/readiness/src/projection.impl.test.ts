import { describe, expect, it } from "vitest";
import {
  checkProjectionFreshness,
  computeGenerationDigest,
  renderGeneratedProjections,
  renderMarkdownProjection,
} from "./projection.js";
import type { InventoryRule, InventoryV1 } from "./model.js";

const HASH = `sha256:${"1".repeat(64)}` as const;

function inventory(requirement: string): InventoryV1 {
  const rule: InventoryRule = {
    ruleId: "rule.escape",
    source: {
      path: "spec/chapter (one).md",
      headingAncestry: ["A"],
      quote: "quoted",
      contentHash: HASH,
      displayLine: 1,
    },
    requirement,
    category: "semantics",
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
    rules: [rule],
    evolutionGate: null,
  };
}

describe("projection implementation", () => {
  it("should canonicalize object-key order and embed one digest in both outputs", () => {
    const first = inventory("same");
    const second: InventoryV1 = {
      evolutionGate: first.evolutionGate,
      rules: first.rules,
      conflicts: first.conflicts,
      clauseLedger: first.clauseLedger,
      evidenceCapabilityDeclarations: first.evidenceCapabilityDeclarations,
      handlerDeclarations: first.handlerDeclarations,
      normativeSources: first.normativeSources,
      fragmentationProfile: first.fragmentationProfile,
      identityLedgerHead: first.identityLedgerHead,
      specRevision: first.specRevision,
      inventoryVersion: first.inventoryVersion,
      schemaVersion: first.schemaVersion,
    };
    expect(computeGenerationDigest(first)).toBe(computeGenerationDigest(second));
    const rendered = renderGeneratedProjections(first);
    expect(rendered.ok).toBe(true);
    const outputs = rendered.outputs;
    expect(outputs).toBeDefined();
    if (outputs === undefined) return;
    expect(new TextDecoder().decode(outputs.declarations)).toContain(outputs.generationDigest);
    expect(new TextDecoder().decode(outputs.markdown)).toContain(outputs.generationDigest);
  });

  it("should apply table-context escaping without emitting raw HTML", () => {
    const value = inventory("& <b>left | right</b>\r\nnext");
    const result = renderMarkdownProjection(value, computeGenerationDigest(value));
    expect(result.ok).toBe(true);
    const text = new TextDecoder().decode(result.bytes);
    expect(text).toContain("&amp; &lt;b&gt;left &#124; right&lt;/b&gt; <br>next");
    expect(text).not.toContain("<b>");
  });

  it("should preserve complete citations and typed relationships with a safe encoded link", () => {
    const value = inventory("same");
    const sourceRule = value.rules[0]!;
    const enrichedRule: InventoryRule = {
      ...sourceRule,
      source: {
        ...sourceRule.source,
        path: "spec/chapter (one) [draft] | <copy>?#notes.md",
        headingAncestry: ["Parent", "Child > detail"],
        quote: "quoted [source] | exactly",
        displayLine: 42,
      },
      prerequisiteRuleIds: ["rule.prerequisite"],
      relatedRuleIds: ["rule.related"],
    };
    const enriched = { ...value, rules: [enrichedRule] };
    const result = renderMarkdownProjection(enriched, computeGenerationDigest(enriched));
    expect(result.ok).toBe(true);
    const text = new TextDecoder().decode(result.bytes);
    expect(text).toContain("[spec/chapter (one) &#91;draft&#93; &#124; &lt;copy&gt;?#notes.md]");
    expect(text).toContain(
      "(../spec/chapter%20%28one%29%20%5Bdraft%5D%20%7C%20%3Ccopy%3E%3F%23notes.md)",
    );
    expect(text).toContain('&#91;"Parent","Child &gt; detail"&#93;');
    expect(text).toContain("quoted &#91;source&#93; &#124; exactly");
    expect(text).toContain(HASH);
    expect(text).toContain("| 42 |");
    expect(text).toContain('&#91;"rule.prerequisite"&#93;');
    expect(text).toContain('&#91;"rule.related"&#93;');
    expect(text).toContain("| Prerequisites | Related rules |");
  });

  it.each([
    "spec//chapter.md",
    "spec/./chapter.md",
    "spec/../chapter.md",
    "spec/%2e%2e/chapter.md",
    "spec/%2Fsecret.md",
    "spec/%5csecret.md",
    "spec/chapter%ZZ.md",
  ])("should reject the noncanonical source alias %s", (path) => {
    const value = inventory("same");
    const sourceRule = value.rules[0]!;
    const result = renderMarkdownProjection(
      { ...value, rules: [{ ...sourceRule, source: { ...sourceRule.source, path } }] },
      computeGenerationDigest(value),
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("projection.unsafe-source-link");
  });

  it("should identify a mixed pair by both embedded generation digests", () => {
    const value = inventory("same");
    const rendered = renderGeneratedProjections(value);
    expect(rendered.outputs).toBeDefined();
    if (rendered.outputs === undefined) return;
    const otherDigest = `sha256:${"2".repeat(64)}` as const;
    const mixedMarkdown = new TextEncoder().encode(
      new TextDecoder()
        .decode(rendered.outputs.markdown)
        .replace(rendered.outputs.generationDigest, otherDigest),
    );
    const result = checkProjectionFreshness(rendered.outputs, {
      declarations: rendered.outputs.declarations,
      markdown: mixedMarkdown,
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "projection.digest-mismatch",
          message: expect.stringContaining(`markdown=${otherDigest}`),
        }),
      ]),
    );
  });
});
