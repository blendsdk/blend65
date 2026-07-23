import { describe, expect, it } from "vitest";
import { citationMatchesFragment, compareCitations } from "./citation-identity.js";
import { validateConflicts } from "./conflict-validator.js";
import { INVENTORY_V1_LIMITS } from "./limits.js";
import type { InventoryV1, SourceCitation } from "./model.js";

const HASH: `sha256:${string}` = `sha256:${"a".repeat(64)}`;

function citation(displayLine: number): SourceCitation {
  return {
    path: "spec/source.md",
    headingAncestry: ["Source"],
    quote: "Rule.",
    contentHash: HASH,
    displayLine,
  };
}

describe("citation semantic identity", () => {
  it("accepts a stale display line when semantic source identity still matches", () => {
    expect(
      citationMatchesFragment(citation(99), {
        sourcePath: "spec/source.md",
        quote: "Rule.",
        fragment: {
          fragmentId: "fragment.one",
          kind: "paragraph",
          startByte: 0,
          endByte: 5,
          headingAncestry: ["Source"],
          sectionIdentity: "source.0",
          contentHash: HASH,
          displayLine: 2,
          displayColumn: 1,
        },
      }),
    ).toBe(true);
  });

  it("rejects conflict citations that differ only by display line as duplicates", () => {
    const first = citation(2);
    const second = citation(99);
    expect(compareCitations(first, second)).toBe(0);
    const inventory: InventoryV1 = {
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
      conflicts: [
        {
          conflictId: "conflict.one",
          classification: "contradiction",
          citations: [first, second],
          ruleIds: [],
          resolution: "Await erratum.",
        },
      ],
      rules: [],
      evolutionGate: null,
    };
    const result = validateConflicts(inventory, {
      fragments: [],
      identityLedgerBytes: new Uint8Array(),
      limits: INVENTORY_V1_LIMITS,
    });
    expect(result.ok).toBe(false);
  });
});
