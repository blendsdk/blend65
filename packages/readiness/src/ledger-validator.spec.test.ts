import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { INVENTORY_V1_LIMITS, validateInventorySemantics, validateLedger } from "./index.js";
import type {
  InventoryRule,
  InventoryV1,
  ResolvedSourceFragment,
  RuleIdentityEvent,
  SemanticValidationContext,
} from "./index.js";

const GENESIS = "sha256:9aeecea544992e64dcac88c5d625cc43b036424482397cd72b56705abc46ca23";
const HASH: `sha256:${string}` = `sha256:${"a".repeat(64)}`;

function citation(path = "spec/01-values.md") {
  return {
    path,
    headingAncestry: ["Values"],
    quote: "Values are defined.",
    contentHash: HASH,
    displayLine: 3,
  } as const;
}

function rule(ruleId: string, sourcePath = "spec/01-values.md"): InventoryRule {
  return {
    ruleId,
    source: citation(sourcePath),
    requirement: `${ruleId} must hold.`,
    category: "values",
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

function resolved(fragmentId: string, sourcePath = "spec/01-values.md"): ResolvedSourceFragment {
  return {
    sourcePath,
    quote: citation(sourcePath).quote,
    fragment: {
      fragmentId,
      kind: "paragraph",
      startByte: 0,
      endByte: 8,
      headingAncestry: ["Values"],
      sectionIdentity: "values.0",
      contentHash: HASH,
      displayLine: 3,
      displayColumn: 1,
    },
  };
}

type EventPayload = Omit<RuleIdentityEvent, "eventHash">;

function eventHash(payload: EventPayload): `sha256:${string}` {
  const canonical = JSON.stringify({
    schemaVersion: payload.schemaVersion,
    sequence: payload.sequence,
    operation: payload.operation,
    ruleId: payload.ruleId,
    predecessorRuleIds: payload.predecessorRuleIds,
    successorRuleIds: payload.successorRuleIds,
    previousHash: payload.previousHash,
  });
  const digest = createHash("sha256")
    .update("blend65.rule-identity-event")
    .update(Buffer.from([0]))
    .update(canonical)
    .digest("hex");
  return `sha256:${digest}`;
}

function allocate(ruleId: string, sequence: number, previousHash: string): RuleIdentityEvent {
  return identityEvent("allocate", ruleId, sequence, previousHash, [], []);
}

function identityEvent(
  operation: "allocate" | "retire",
  ruleId: string,
  sequence: number,
  previousHash: string,
  predecessorRuleIds: readonly string[],
  successorRuleIds: readonly string[],
): RuleIdentityEvent {
  const payload: EventPayload = {
    schemaVersion: 1,
    sequence,
    operation,
    ruleId,
    predecessorRuleIds,
    successorRuleIds,
    previousHash: previousHash as `sha256:${string}`,
  };
  return { ...payload, eventHash: eventHash(payload) };
}

function ledgerBytes(events: readonly RuleIdentityEvent[]): Uint8Array {
  return new TextEncoder().encode(events.map((event) => JSON.stringify(event)).join("\n") + "\n");
}

function inventory(
  rules: readonly InventoryRule[],
  clauseLedger: InventoryV1["clauseLedger"],
  head: string,
): InventoryV1 {
  return {
    schemaVersion: 1,
    inventoryVersion: "1.0.0",
    specRevision: HASH,
    identityLedgerHead: head,
    fragmentationProfile: {
      profileId: "markdown-ebnf-v1",
      version: 1,
      contentHashAlgorithm: "sha256",
      newlinePolicy: "lf",
    },
    normativeSources: [],
    handlerDeclarations: [],
    evidenceCapabilityDeclarations: [
      {
        id: "frontend",
        owner: "compiler-readiness",
        contractVersion: "1.0.0",
        binding: "bound",
        observableContract: "Frontend result.",
        prerequisiteRoute: "compiler.frontend",
      },
    ],
    clauseLedger,
    conflicts: [],
    rules,
    evolutionGate: null,
  };
}

function context(
  fragments: readonly ResolvedSourceFragment[],
  events: readonly RuleIdentityEvent[],
): SemanticValidationContext {
  return { fragments, identityLedgerBytes: ledgerBytes(events), limits: INVENTORY_V1_LIMITS };
}

describe("semantic clause ledger", () => {
  // Every included fragment must have exactly one valid disposition.
  it("should accept all five exhaustive fragment dispositions", () => {
    const ids = ["rule.a", "rule.b", "rule.c"];
    const events = eventsFor(ids);
    const base = inventory(
      [
        rule("rule.a", "spec/01-mapped.md"),
        rule("rule.b", "spec/02-decomposed.md"),
        rule("rule.c", "spec/02-decomposed.md"),
      ],
      [
        { fragmentId: "fragment.mapped", disposition: "mapped", ruleIds: ["rule.a"] },
        {
          fragmentId: "fragment.decomposed",
          disposition: "decomposed",
          childOutcomes: [
            { outcomeId: "outcome.b", ruleIds: ["rule.b"] },
            { outcomeId: "outcome.c", ruleIds: ["rule.c"] },
          ],
        },
        { fragmentId: "fragment.note", disposition: "non-normative", reasonCode: "example" },
        {
          fragmentId: "fragment.restatement",
          disposition: "canonical-restatement",
          canonicalRuleId: "rule.a",
          conflictId: "conflict.restatement",
        },
        {
          fragmentId: "fragment.blocked",
          disposition: "blocked-errata",
          conflictId: "conflict.blocked",
        },
      ],
      events.at(-1)?.eventHash ?? GENESIS,
    );
    const fixture: InventoryV1 = {
      ...base,
      conflicts: [
        {
          conflictId: "conflict.restatement",
          classification: "equivalent-restatement",
          citations: [
            citation("spec/01-mapped.md"),
            citation("spec/03-restatement.md"),
          ],
          ruleIds: ["rule.a"],
          resolution: "The chapter owns the rule.",
        },
        {
          conflictId: "conflict.blocked",
          classification: "contradiction",
          citations: [citation("spec/04-blocked.md")],
          ruleIds: [],
          resolution: "Await erratum.",
        },
      ],
    };

    expect(
      validateLedger(
        fixture,
        context(
          [
            resolved("fragment.mapped", "spec/01-mapped.md"),
            resolved("fragment.decomposed", "spec/02-decomposed.md"),
            resolved("fragment.note", "spec/05-note.md"),
            resolved("fragment.restatement", "spec/03-restatement.md"),
            resolved("fragment.blocked", "spec/04-blocked.md"),
          ],
          events,
        ),
      ).ok,
    ).toBe(true);
  });

  // Missing, duplicate, and overlapping outcome ownership must name the affected identity.
  it.each([
    ["missing disposition", [], "fragment.missing"],
    [
      "duplicate disposition",
      [
        { fragmentId: "fragment.one", disposition: "non-normative", reasonCode: "note" },
        { fragmentId: "fragment.one", disposition: "non-normative", reasonCode: "note" },
      ],
      "fragment.one",
    ],
  ] as const)("should reject %s", (_name, entries, identity) => {
    const result = validateLedger(
      inventory([], entries, GENESIS),
      context([resolved(identity)], []),
    );
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.message.includes(identity))).toBe(
      true,
    );
  });

  // Decomposed outcomes are exhaustive and cannot assign one rule twice.
  it("should reject overlapping decomposed child outcomes", () => {
    const allocated = allocate("rule.a", 0, GENESIS);
    const fixture = inventory(
      [rule("rule.a")],
      [
        {
          fragmentId: "fragment.one",
          disposition: "decomposed",
          childOutcomes: [
            { outcomeId: "outcome.a", ruleIds: ["rule.a"] },
            { outcomeId: "outcome.b", ruleIds: ["rule.a"] },
          ],
        },
      ],
      allocated.eventHash,
    );
    const result = validateLedger(fixture, context([resolved("fragment.one")], [allocated]));
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some(({ message }) => message.includes("rule.a"))).toBe(true);
  });

  // A target exclusion needs source-backed proof and must stay outside the C64 denominator.
  it("should accept uniquely cited target inapplicability and reject a missing reason", () => {
    const current = allocate("rule.other-target", 0, GENESIS);
    const excluded = {
      ...rule("rule.other-target"),
      applicability: "not-applicable-c64" as const,
    };
    const missing = inventory(
      [excluded],
      [{ fragmentId: "fragment.one", disposition: "mapped", ruleIds: ["rule.other-target"] }],
      current.eventHash,
    );
    expect(validateLedger(missing, context([resolved("fragment.one")], [current])).ok).toBe(false);

    const proven = {
      ...excluded,
      applicabilityReason: {
        code: "different-target",
        target: "cx16",
        citation: citation(),
      },
    };
    const result = validateLedger(
      { ...missing, rules: [proven] },
      context([resolved("fragment.one")], [current]),
    );
    expect(result.ok).toBe(true);
    expect(result.topologicalRuleIds).toBeUndefined();
  });
});

describe("rule identity chain", () => {
  // Split and merge replacements preserve reciprocal lineage while retiring predecessors.
  it("should accept reciprocal split and merge lineage without reusing retired IDs", () => {
    const events: RuleIdentityEvent[] = [];
    const append = (
      operation: "allocate" | "retire",
      ruleId: string,
      predecessors: readonly string[],
      successors: readonly string[],
    ) => {
      events.push(
        identityEvent(
          operation,
          ruleId,
          events.length,
          events.at(-1)?.eventHash ?? GENESIS,
          predecessors,
          successors,
        ),
      );
    };
    append("allocate", "rule.split-old", [], []);
    append("allocate", "rule.split-a", ["rule.split-old"], []);
    append("allocate", "rule.split-b", ["rule.split-old"], []);
    append("retire", "rule.split-old", [], ["rule.split-a", "rule.split-b"]);
    append("allocate", "rule.merge-a", [], []);
    append("allocate", "rule.merge-b", [], []);
    append("allocate", "rule.merged", ["rule.merge-a", "rule.merge-b"], []);
    append("retire", "rule.merge-a", [], ["rule.merged"]);
    append("retire", "rule.merge-b", [], ["rule.merged"]);
    const rules = [
      {
        ...rule("rule.split-a", "spec/split-a.md"),
        lineage: { splitFrom: ["rule.split-old"] },
      },
      {
        ...rule("rule.split-b", "spec/split-b.md"),
        lineage: { splitFrom: ["rule.split-old"] },
      },
      {
        ...rule("rule.merged", "spec/merged.md"),
        lineage: { mergedFrom: ["rule.merge-a", "rule.merge-b"] },
      },
    ];
    const fixture = inventory(
      rules,
      [
        { fragmentId: "fragment.a", disposition: "mapped", ruleIds: ["rule.split-a"] },
        { fragmentId: "fragment.b", disposition: "mapped", ruleIds: ["rule.split-b"] },
        { fragmentId: "fragment.merged", disposition: "mapped", ruleIds: ["rule.merged"] },
      ],
      events.at(-1)?.eventHash ?? GENESIS,
    );
    expect(
      validateLedger(
        fixture,
        context(
          [
            resolved("fragment.a", "spec/split-a.md"),
            resolved("fragment.b", "spec/split-b.md"),
            resolved("fragment.merged", "spec/merged.md"),
          ],
          events,
        ),
      ).ok,
    ).toBe(true);
  });

  // Duplicate semantic IDs must fail before any graph/index output is built.
  it("should report both record paths for a duplicate rule ID", () => {
    const allocated = allocate("rule.duplicate", 0, GENESIS);
    const fixture = inventory(
      [rule("rule.duplicate"), rule("rule.duplicate")],
      [{ fragmentId: "fragment.one", disposition: "mapped", ruleIds: ["rule.duplicate"] }],
      allocated.eventHash,
    );
    const result = validateInventorySemantics(
      fixture,
      context([resolved("fragment.one")], [allocated]),
    );
    expect(result.ok).toBe(false);
    expect(result.inventory).toBeUndefined();
    expect(result.topologicalRuleIds).toBeUndefined();
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        phase: "ledger",
        relatedPaths: ["$.rules[0].ruleId", "$.rules[1].ruleId"],
      }),
    ]);
  });

  // Truncation, reordering, head mismatch, and retired-ID reuse corrupt permanent identity.
  it.each(["truncated", "reordered", "head-mismatch", "reuse"] as const)(
    "should reject a %s identity chain",
    (mutation) => {
      const first = allocate("rule.a", 0, GENESIS);
      const second = allocate("rule.b", 1, first.eventHash);
      let events: readonly RuleIdentityEvent[] = [first, second];
      let head = second.eventHash;
      if (mutation === "truncated") events = [first];
      if (mutation === "reordered") events = [second, first];
      if (mutation === "head-mismatch") head = GENESIS;
      if (mutation === "reuse") {
        const reuse = allocate("rule.a", 2, second.eventHash);
        events = [first, second, reuse];
        head = reuse.eventHash;
      }
      const fixture = inventory(
        [rule("rule.a"), rule("rule.b")],
        [
          { fragmentId: "fragment.a", disposition: "mapped", ruleIds: ["rule.a"] },
          { fragmentId: "fragment.b", disposition: "mapped", ruleIds: ["rule.b"] },
        ],
        head,
      );
      expect(
        validateLedger(fixture, context([resolved("fragment.a"), resolved("fragment.b")], events))
          .ok,
      ).toBe(false);
    },
  );
});

function eventsFor(ids: readonly string[]): RuleIdentityEvent[] {
  const events: RuleIdentityEvent[] = [];
  for (let index = 0; index < ids.length; index += 1) {
    events.push(allocate(ids[index], index, events.at(-1)?.eventHash ?? GENESIS));
  }
  return events;
}
