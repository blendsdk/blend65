import { describe, expect, it } from "vitest";
import {
  checkProjectionFreshness,
  computeGenerationDigest,
  renderGeneratedProjections,
  renderMarkdownProjection,
} from "./index.js";
import type { InventoryRule, InventoryV1 } from "./index.js";

const HASH = `sha256:${"a".repeat(64)}` as const;

function rule(ruleId: string, sourcePath = "spec/chapter.md"): InventoryRule {
  return {
    ruleId,
    source: {
      path: sourcePath,
      headingAncestry: ["Values"],
      quote: "A value must remain observable.",
      contentHash: HASH,
      displayLine: 12,
    },
    requirement: "A value must remain observable.",
    category: "semantics",
    polarity: "positive",
    applicability: "mandatory-c64",
    validDomains: [],
    invalidNeighbors: [],
    boundaryFamilies: ["zero"],
    generatorIds: ["generator.values"],
    oracleIds: ["oracle.values"],
    transformIds: ["transform.boundaries"],
    evidenceObligations: ["frontend", "compiler-api"],
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

function occurrences(text: string, value: string): number {
  return text.split(value).length - 1;
}

describe("Markdown readiness projection", () => {
  it("should render deterministically without mutating input and include every rule exactly once", () => {
    const fixture = inventory([rule("rule.z"), rule("rule.a")]);
    const before = JSON.stringify(fixture);
    const digest = computeGenerationDigest(fixture);
    const first = renderMarkdownProjection(fixture, digest);
    const second = renderMarkdownProjection(fixture, digest);

    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    expect(first.diagnostics).toEqual([]);
    expect(first.bytes).toBeDefined();
    const markdown = new TextDecoder().decode(first.bytes);
    for (const expectedRule of fixture.rules) {
      expect(occurrences(markdown, expectedRule.ruleId), expectedRule.ruleId).toBe(1);
      expect(markdown).toContain(expectedRule.source.path);
      expect(markdown).toContain(expectedRule.applicability);
      for (const evidence of expectedRule.evidenceObligations) {
        expect(markdown).toContain(evidence);
      }
      for (const relationship of [
        ...expectedRule.prerequisiteRuleIds,
        ...expectedRule.relatedRuleIds,
      ]) {
        expect(markdown).toContain(relationship);
      }
    }
    expect(JSON.stringify(fixture)).toBe(before);
  });

  it("should escape table and HTML-significant text while rejecting unsafe source links", () => {
    const hostileText = rule("rule.hostile");
    const escaped = renderMarkdownProjection(
      inventory([
        {
          ...hostileText,
          requirement: "left | right\n<script>alert(1)</script>",
          source: {
            ...hostileText.source,
            quote: "left | right\n<img src=x onerror=alert(1)>",
          },
        },
      ]),
      HASH,
    );
    expect(escaped.ok).toBe(true);
    const markdown = new TextDecoder().decode(escaped.bytes);
    expect(markdown).not.toContain("<script>");
    expect(markdown).not.toContain("<img");

    for (const sourcePath of [
      "javascript:alert(1)",
      "https://example.com/spec.md",
      "/spec/chapter.md",
      "spec/../secret.md",
      "spec\\chapter.md",
      "spec/chapter.md#fragment",
      "spec/chapter\u0000.md",
    ]) {
      const result = renderMarkdownProjection(inventory([rule("rule.hostile", sourcePath)]), HASH);
      expect(result.ok, sourcePath).toBe(false);
      expect(result.bytes, sourcePath).toBeUndefined();
      expect(
        result.diagnostics.some(({ code }) => code.startsWith("projection.")),
        sourcePath,
      ).toBe(true);
    }
  });

  it("should reject non-canonical path segments and safely encode valid repository filenames", () => {
    for (const sourcePath of [
      "spec//chapter.md",
      "spec/./chapter.md",
      "spec/a/../chapter.md",
      "spec/a\\chapter.md",
    ]) {
      const result = renderMarkdownProjection(inventory([rule("rule.path", sourcePath)]), HASH);
      expect(result.ok, sourcePath).toBe(false);
      expect(result.bytes, sourcePath).toBeUndefined();
      expect(
        result.diagnostics.some(({ code }) => code === "projection.unsafe-source-link"),
        sourcePath,
      ).toBe(true);
    }

    const sourcePath = "spec/chapter ?topic=[one] | <draft> (copy)#notes.md";
    const result = renderMarkdownProjection(inventory([rule("rule.path", sourcePath)]), HASH);
    expect(result.ok).toBe(true);
    const markdown = new TextDecoder().decode(result.bytes);
    expect(markdown).toContain(
      "[spec/chapter ?topic=&#91;one&#93; &#124; &lt;draft&gt; (copy)#notes.md]",
    );
    expect(markdown).toContain(
      "(../spec/chapter%20%3Ftopic%3D%5Bone%5D%20%7C%20%3Cdraft%3E%20%28copy%29%23notes.md)",
    );
  });

  it("should preserve complete citations and distinguish prerequisite from related rules", () => {
    const fixtureRule: InventoryRule = {
      ...rule("rule.complete-citation", "spec/chapter [one] (draft).md"),
      source: {
        path: "spec/chapter [one] (draft).md",
        headingAncestry: ["Values", "Observable state"],
        quote: "A value | remains <observable>.",
        contentHash: `sha256:${"b".repeat(64)}`,
        displayLine: 47,
      },
      prerequisiteRuleIds: ["rule.required-first"],
      relatedRuleIds: ["rule.see-also"],
    };
    const result = renderMarkdownProjection(
      inventory([
        fixtureRule,
        rule("rule.required-first"),
        rule("rule.see-also"),
      ]),
      HASH,
    );
    expect(result.ok).toBe(true);
    const markdown = new TextDecoder().decode(result.bytes);
    expect(markdown).toContain("Heading ancestry");
    expect(markdown).toContain("Values");
    expect(markdown).toContain("Observable state");
    expect(markdown).toContain("Quote");
    expect(markdown).toContain("A value &#124; remains &lt;observable&gt;.");
    expect(markdown).toContain("Content hash");
    expect(markdown).toContain(fixtureRule.source.contentHash);
    expect(markdown).toContain("Display line");
    expect(markdown).toContain("47");
    expect(markdown).toContain("Prerequisites");
    expect(markdown).toContain("rule.required-first");
    expect(markdown).toContain("Related");
    expect(markdown).toContain("rule.see-also");
  });
});

describe("projection freshness", () => {
  it("should accept both current outputs and diagnose either absent or stale output deterministically", () => {
    const fixture = inventory([rule("rule.a")]);
    const rendered = renderGeneratedProjections(fixture);
    expect(rendered.ok).toBe(true);
    if (rendered.outputs === undefined) {
      throw new TypeError("A valid inventory must render both projections.");
    }

    expect(
      checkProjectionFreshness(rendered.outputs, {
        declarations: rendered.outputs.declarations,
        markdown: rendered.outputs.markdown,
      }),
    ).toMatchObject({ ok: true, diagnostics: [] });

    for (const actual of [
      { markdown: rendered.outputs.markdown },
      { declarations: rendered.outputs.declarations },
      {
        declarations: new Uint8Array([...rendered.outputs.declarations, 0]),
        markdown: rendered.outputs.markdown,
      },
      {
        declarations: rendered.outputs.declarations,
        markdown: new Uint8Array([...rendered.outputs.markdown, 0]),
      },
    ]) {
      const frozen = {
        declarations: actual.declarations?.slice(),
        markdown: actual.markdown?.slice(),
      };
      const first = checkProjectionFreshness(rendered.outputs, actual);
      expect(first.ok).toBe(false);
      expect(first).toEqual(checkProjectionFreshness(rendered.outputs, actual));
      expect(actual).toEqual(frozen);
    }
  });

  it("should name both observed generation digests when a projection pair is mixed", () => {
    const authoritative = renderGeneratedProjections(inventory([rule("rule.authoritative")]));
    const declarationsRevision = renderGeneratedProjections(
      inventory([{ ...rule("rule.revision"), requirement: "Declarations revision." }]),
    );
    const markdownRevision = renderGeneratedProjections(
      inventory([{ ...rule("rule.revision"), requirement: "Markdown revision." }]),
    );
    expect(authoritative.outputs).toBeDefined();
    expect(declarationsRevision.outputs).toBeDefined();
    expect(markdownRevision.outputs).toBeDefined();
    if (
      authoritative.outputs === undefined ||
      declarationsRevision.outputs === undefined ||
      markdownRevision.outputs === undefined
    ) {
      throw new TypeError("Valid inventories must render complete projection pairs.");
    }

    const actual = {
      declarations: declarationsRevision.outputs.declarations,
      markdown: markdownRevision.outputs.markdown,
    };
    const first = checkProjectionFreshness(authoritative.outputs, actual);
    const second = checkProjectionFreshness(authoritative.outputs, actual);
    expect(first).toEqual(second);
    expect(first.ok).toBe(false);
    expect(first.diagnostics).toHaveLength(1);
    expect(first.diagnostics[0]).toMatchObject({
      code: "projection.digest-mismatch",
      path: "readiness/generated",
    });
    expect(first.diagnostics[0]?.message).toContain(
      declarationsRevision.outputs.generationDigest,
    );
    expect(first.diagnostics[0]?.message).toContain(markdownRevision.outputs.generationDigest);
  });
});
