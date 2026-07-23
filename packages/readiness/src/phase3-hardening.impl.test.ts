import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { compareOrdinal, compareStringTuples, equalStringTuples } from "./authority-order.js";
import { sortBlockingReasons, uniquePaths } from "./blocking-reasons.js";
import { validateConflicts } from "./conflict-validator.js";
import { validateDeclarations } from "./declaration-validator.js";
import { IDENTITY_GENESIS, parseIdentityLedger } from "./identity-ledger.js";
import { validateLedger } from "./ledger-validator.js";
import { INVENTORY_V1_LIMITS } from "./limits.js";
import type {
  InventoryRule,
  InventoryV1,
  RuleIdentityEvent,
  SemanticValidationContext,
} from "./model.js";
import { validateRuleGraph } from "./rule-graph.js";
import { validateInventorySemantics } from "./semantic-validator.js";

const HASH: `sha256:${string}` = `sha256:${"a".repeat(64)}`;
const CAPABILITIES = ["frontend", "compiler-api", "cli", "emit", "acme", "vice"] as const;

function hashEvent(event: Omit<RuleIdentityEvent, "eventHash">): `sha256:${string}` {
  const digest = createHash("sha256")
    .update("blend65.rule-identity-event")
    .update(Buffer.from([0]))
    .update(JSON.stringify(event))
    .digest("hex");
  return `sha256:${digest}`;
}

function event(
  operation: "allocate" | "retire",
  ruleId: string,
  sequence: number,
  previousHash: `sha256:${string}`,
  predecessorRuleIds: readonly string[] = [],
  successorRuleIds: readonly string[] = [],
): RuleIdentityEvent {
  const payload = {
    schemaVersion: 1 as const,
    sequence,
    operation,
    ruleId,
    predecessorRuleIds,
    successorRuleIds,
    previousHash,
  };
  return { ...payload, eventHash: hashEvent(payload) };
}

function bytes(events: readonly RuleIdentityEvent[]): Uint8Array {
  return new TextEncoder().encode(`${events.map((value) => JSON.stringify(value)).join("\n")}\n`);
}

function limits(overrides: Partial<typeof INVENTORY_V1_LIMITS> = {}) {
  return { ...INVENTORY_V1_LIMITS, ...overrides };
}

function citation(path = "spec/source.md", quote = "Rule.") {
  return {
    path,
    headingAncestry: ["Source"],
    quote,
    contentHash: HASH,
    displayLine: 2,
  } as const;
}

function rule(ruleId: string): InventoryRule {
  return {
    ruleId,
    source: citation(),
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
    handlerAbsenceReason: "not-required",
    evidenceObligations: [],
    prerequisiteRuleIds: [],
    relatedRuleIds: [],
  };
}

function inventory(overrides: Partial<InventoryV1> = {}): InventoryV1 {
  return {
    schemaVersion: 1,
    inventoryVersion: "1.0.0",
    specRevision: HASH,
    identityLedgerHead: IDENTITY_GENESIS,
    fragmentationProfile: {
      profileId: "markdown-ebnf-v1",
      version: 1,
      contentHashAlgorithm: "sha256",
      newlinePolicy: "lf",
    },
    normativeSources: [],
    handlerDeclarations: [],
    evidenceCapabilityDeclarations: CAPABILITIES.map((id) => ({
      id,
      owner: "readiness",
      contractVersion: "1.0.0",
      binding: "bound",
      observableContract: "Observable.",
      prerequisiteRoute: `route.${id}`,
    })),
    clauseLedger: [],
    conflicts: [],
    rules: [],
    evolutionGate: null,
    ...overrides,
  };
}

const EMPTY_CONTEXT: SemanticValidationContext = {
  fragments: [],
  identityLedgerBytes: new Uint8Array(),
  limits: INVENTORY_V1_LIMITS,
};

function resolved(fragmentId: string) {
  return {
    sourcePath: "spec/source.md",
    quote: "Rule.",
    fragment: {
      fragmentId,
      kind: "paragraph" as const,
      startByte: 0,
      endByte: 5,
      headingAncestry: ["Source"],
      sectionIdentity: "source.0",
      contentHash: HASH,
      displayLine: 2,
      displayColumn: 1,
    },
  };
}

function allocatedFixture(currentRule: InventoryRule, fragmentId = "fragment.one") {
  const allocation = event("allocate", currentRule.ruleId, 0, IDENTITY_GENESIS);
  return {
    fixture: inventory({
      identityLedgerHead: allocation.eventHash,
      rules: [currentRule],
      clauseLedger: [{ fragmentId, disposition: "mapped", ruleIds: [currentRule.ruleId] }],
    }),
    context: {
      fragments: [resolved(fragmentId)],
      identityLedgerBytes: bytes([allocation]),
      limits: INVENTORY_V1_LIMITS,
    } satisfies SemanticValidationContext,
  };
}

describe("identity ledger hostile input", () => {
  it("should reject byte, encoding, framing, event-count, and depth limits", () => {
    const valid = event("allocate", "rule.a", 0, IDENTITY_GENESIS);
    const cases = [
      [bytes([valid]), limits({ maxInputBytes: 1 })],
      [new Uint8Array([0xef, 0xbb, 0xbf]), INVENTORY_V1_LIMITS],
      [new Uint8Array([0xff]), INVENTORY_V1_LIMITS],
      [new TextEncoder().encode("{}"), INVENTORY_V1_LIMITS],
      [new TextEncoder().encode("{}\r\n"), INVENTORY_V1_LIMITS],
      [new TextEncoder().encode("{}\n\n"), INVENTORY_V1_LIMITS],
      [bytes([valid]), limits({ maxRules: 0 })],
      [bytes([valid]), limits({ maxDepth: 1 })],
      [bytes([valid]), limits({ maxStringBytes: 1 })],
    ] as const;
    for (const [input, policy] of cases) {
      expect(parseIdentityLedger(input, policy).diagnostics.length).toBeGreaterThan(0);
    }
  });

  it("should reject malformed, duplicate-key, and invalid-shape events", () => {
    const malformed = new TextEncoder().encode("{\n");
    const duplicate = new TextEncoder().encode('{"schemaVersion":1,"schemaVersion":1}\n');
    const invalidShapes = [
      null,
      [],
      {},
      {
        schemaVersion: 2,
        sequence: 0.5,
        operation: "change",
        ruleId: 1,
        predecessorRuleIds: [1],
        successorRuleIds: "none",
        previousHash: 1,
        eventHash: 1,
      },
    ];
    expect(parseIdentityLedger(malformed, INVENTORY_V1_LIMITS).diagnostics).not.toHaveLength(0);
    expect(parseIdentityLedger(duplicate, INVENTORY_V1_LIMITS).diagnostics).not.toHaveLength(0);
    for (const shape of invalidShapes) {
      const input = new TextEncoder().encode(`${JSON.stringify(shape)}\n`);
      expect(parseIdentityLedger(input, INVENTORY_V1_LIMITS).diagnostics).not.toHaveLength(0);
    }
  });

  it("should reject chain, identifier, ordering, shape, and relationship corruption", () => {
    const valid = event("allocate", "rule.a", 0, IDENTITY_GENESIS);
    const corruptions: RuleIdentityEvent[] = [
      { ...valid, sequence: 1 },
      { ...valid, previousHash: HASH },
      { ...valid, eventHash: HASH },
      event("allocate", "Rule", 0, IDENTITY_GENESIS),
      event("allocate", "rule.a", 0, IDENTITY_GENESIS, ["rule.z", "rule.a"]),
      event("allocate", "rule.a", 0, IDENTITY_GENESIS, [], ["rule.b"]),
      event("retire", "rule.a", 0, IDENTITY_GENESIS, ["rule.old"], []),
    ];
    for (const corrupted of corruptions) {
      expect(
        parseIdentityLedger(bytes([corrupted]), INVENTORY_V1_LIMITS).diagnostics,
      ).not.toHaveLength(0);
    }
    expect(
      parseIdentityLedger(bytes([valid]), limits({ maxRelationshipsPerRule: 0 })).diagnostics,
    ).toHaveLength(0);
  });

  it("should reject duplicate allocation and invalid retirement state", () => {
    const first = event("allocate", "rule.a", 0, IDENTITY_GENESIS);
    const duplicate = event("allocate", "rule.a", 1, first.eventHash);
    const unknownRetirement = event("retire", "rule.b", 1, first.eventHash);
    expect(
      parseIdentityLedger(bytes([first, duplicate]), INVENTORY_V1_LIMITS).diagnostics,
    ).not.toHaveLength(0);
    expect(
      parseIdentityLedger(bytes([first, unknownRetirement]), INVENTORY_V1_LIMITS).diagnostics,
    ).not.toHaveLength(0);
  });

  it("should reject inactive, non-reciprocal, and many-to-many replacements", () => {
    const oldA = event("allocate", "rule.old-a", 0, IDENTITY_GENESIS);
    const inactive = event("allocate", "rule.new", 1, oldA.eventHash, ["rule.missing"]);
    expect(
      parseIdentityLedger(bytes([oldA, inactive]), INVENTORY_V1_LIMITS).diagnostics,
    ).not.toHaveLength(0);

    const newA = event("allocate", "rule.new-a", 1, oldA.eventHash, ["rule.old-a"]);
    expect(
      parseIdentityLedger(bytes([oldA, newA]), INVENTORY_V1_LIMITS).diagnostics,
    ).not.toHaveLength(0);

    const newB = event("allocate", "rule.new-b", 2, newA.eventHash, ["rule.old-a"]);
    const retireA = event(
      "retire",
      "rule.old-a",
      3,
      newB.eventHash,
      [],
      ["rule.new-a", "rule.new-b"],
    );
    expect(
      parseIdentityLedger(bytes([oldA, newA, newB, retireA]), INVENTORY_V1_LIMITS).diagnostics,
    ).toHaveLength(0);

    const oldB = event("allocate", "rule.old-b", 1, oldA.eventHash);
    const joinedA = event("allocate", "rule.joined-a", 2, oldB.eventHash, [
      "rule.old-a",
      "rule.old-b",
    ]);
    const joinedB = event("allocate", "rule.joined-b", 3, joinedA.eventHash, [
      "rule.old-a",
      "rule.old-b",
    ]);
    const retiredA = event(
      "retire",
      "rule.old-a",
      4,
      joinedB.eventHash,
      [],
      ["rule.joined-a", "rule.joined-b"],
    );
    const retiredB = event(
      "retire",
      "rule.old-b",
      5,
      retiredA.eventHash,
      [],
      ["rule.joined-a", "rule.joined-b"],
    );
    expect(
      parseIdentityLedger(
        bytes([oldA, oldB, joinedA, joinedB, retiredA, retiredB]),
        INVENTORY_V1_LIMITS,
      ).diagnostics,
    ).not.toHaveLength(0);
  });
});

describe("semantic validator error branches", () => {
  it("should compare authority tuples structurally and ordinally", () => {
    expect(compareOrdinal("a", "b")).toBeLessThan(0);
    expect(compareOrdinal("b", "a")).toBeGreaterThan(0);
    expect(compareOrdinal("a", "a")).toBe(0);
    expect(compareStringTuples(["a"], ["a", "b"])).toBeLessThan(0);
    expect(compareStringTuples(["a", "c"], ["a", "b"])).toBeGreaterThan(0);
    expect(equalStringTuples(["a", "b"], ["a", "b"])).toBe(true);
    expect(equalStringTuples(["a"], ["a", "b"])).toBe(false);
  });

  it("should merge blocker paths and order otherwise tied reasons", () => {
    expect(uniquePaths(["spec/b.md", "spec/a.md", "spec/a.md"])).toEqual([
      "spec/a.md",
      "spec/b.md",
    ]);
    expect(
      sortBlockingReasons([
        { kind: "unbound-handler", identity: "same", sourcePaths: ["spec/z.md"] },
        { kind: "unbound-handler", identity: "same", sourcePaths: ["spec/a.md"] },
      ])[0]?.sourcePaths,
    ).toEqual(["spec/a.md"]);
  });

  it("should reject malformed reviewed conflict aggregates", () => {
    const base = {
      conflictId: "conflict.one",
      classification: "equivalent-restatement" as const,
      citations: [citation()],
      ruleIds: ["rule.one"],
      resolution: "Resolved.",
    };
    const current = rule("rule.one");
    const cases = [
      [base, base],
      [{ ...base, citations: [] }],
      [{ ...base, classification: "equivalent-restatement" as const, ruleIds: [] }],
      [{ ...base, classification: "duplicate-ownership" as const, ruleIds: [] }],
      [{ ...base, classification: "contradiction" as const, ruleIds: ["rule.one"] }],
    ];
    for (const conflicts of cases) {
      expect(validateConflicts(inventory({ rules: [current], conflicts }), EMPTY_CONTEXT).ok).toBe(
        false,
      );
    }
  });

  it("should reject declaration ordering, duplicates, missing capabilities and absence metadata", () => {
    const current = rule("rule.one");
    const { handlerAbsenceReason: _absence, ...withoutAbsence } = current;
    const handler = {
      id: "handler.one",
      kind: "generator" as const,
      owner: "readiness",
      contractVersion: "1.0.0",
      binding: "bound" as const,
    };
    const cases: InventoryV1[] = [
      inventory({ handlerDeclarations: [handler, handler], rules: [current] }),
      inventory({
        evidenceCapabilityDeclarations: [],
        rules: [{ ...current, evidenceObligations: ["missing"] }],
      }),
      inventory({
        handlerDeclarations: [handler],
        rules: [{ ...current, generatorIds: ["handler.one"], handlerAbsenceReason: "wrong" }],
      }),
      inventory({
        rules: [{ ...withoutAbsence, evidenceObligations: ["vice", "acme"] }],
      }),
    ];
    for (const fixture of cases) expect(validateDeclarations(fixture).ok).toBe(false);
  });

  it("should reject duplicate, orphaned, and semantically changed projection children", () => {
    const parent = {
      ...rule("rule.parent"),
      applicability: "out-of-claim-target" as const,
      applicabilityReason: {
        code: "universal-parent",
        target: "universal",
        citation: citation(),
      },
    };
    const { applicabilityReason: _reason, ...parentWithoutReason } = parent;
    const child: InventoryRule = {
      ...parentWithoutReason,
      ruleId: "rule.parent.c64",
      applicability: "mandatory-c64" as const,
      universalProjection: { parentRuleId: parent.ruleId, target: "c64" as const },
    };
    expect(validateRuleGraph(inventory({ rules: [parent, child, child] })).ok).toBe(false);
    expect(validateRuleGraph(inventory({ rules: [child] })).ok).toBe(false);
    expect(
      validateRuleGraph(inventory({ rules: [parent, { ...child, requirement: "Changed." }] })).ok,
    ).toBe(false);
  });

  it("should diagnose invalid clause dispositions, ownership, and lineage", () => {
    const current = rule("rule.one");
    const { fixture, context } = allocatedFixture(current);
    const conflict = {
      conflictId: "conflict.one",
      classification: "equivalent-restatement" as const,
      citations: [citation()],
      ruleIds: ["rule.one"],
      resolution: "Canonical.",
    };
    const cases: InventoryV1["clauseLedger"][] = [
      [{ fragmentId: "fragment.one", disposition: "mapped", ruleIds: [] }],
      [{ fragmentId: "fragment.one", disposition: "mapped", ruleIds: ["rule.missing"] }],
      [
        { fragmentId: "fragment.one", disposition: "mapped", ruleIds: ["rule.one"] },
        { fragmentId: "fragment.two", disposition: "mapped", ruleIds: ["rule.one"] },
      ],
      [
        {
          fragmentId: "fragment.one",
          disposition: "decomposed",
          childOutcomes: [{ outcomeId: "outcome.one", ruleIds: ["rule.one"] }],
        },
      ],
      [
        {
          fragmentId: "fragment.one",
          disposition: "decomposed",
          childOutcomes: [
            { outcomeId: "outcome.z", ruleIds: ["rule.one"] },
            { outcomeId: "outcome.a", ruleIds: [] },
          ],
        },
      ],
      [
        {
          fragmentId: "fragment.one",
          disposition: "canonical-restatement",
          canonicalRuleId: "rule.one",
          conflictId: "conflict.missing",
        },
      ],
      [
        {
          fragmentId: "fragment.one",
          disposition: "blocked-errata",
          conflictId: "conflict.one",
        },
      ],
    ];
    for (const clauseLedger of cases) {
      expect(validateLedger({ ...fixture, conflicts: [conflict], clauseLedger }, context).ok).toBe(
        false,
      );
    }

    for (const lineage of [
      { supersedes: ["rule.one"] },
      { supersedes: ["rule.old"], splitFrom: ["rule.old"] },
      { supersedes: ["rule.old"] },
    ]) {
      const lineageFixture = allocatedFixture({ ...current, lineage });
      expect(validateLedger(lineageFixture.fixture, lineageFixture.context).ok).toBe(false);
    }
  });

  it("should cover duplicate declaration identities, relationship ordering, and blocker merging", () => {
    const current = rule("rule.one");
    const declaration = {
      id: "handler.one",
      kind: "generator" as const,
      owner: "readiness",
      contractVersion: "1.0.0",
      binding: "unbound" as const,
    };
    const capabilities = inventory().evidenceCapabilityDeclarations;
    expect(
      validateDeclarations(
        inventory({
          evidenceCapabilityDeclarations: [...capabilities, capabilities[0]],
        }),
      ).ok,
    ).toBe(false);
    const { handlerAbsenceReason: _absence, ...withoutAbsence } = current;
    expect(
      validateDeclarations(
        inventory({
          handlerDeclarations: [declaration],
          rules: [{ ...withoutAbsence, generatorIds: ["handler.one", "handler.one"] }],
        }),
      ).ok,
    ).toBe(false);
    const result = validateDeclarations(
      inventory({
        handlerDeclarations: [declaration],
        rules: [
          { ...withoutAbsence, generatorIds: ["handler.one"] },
          {
            ...withoutAbsence,
            ruleId: "rule.two",
            source: citation("spec/other.md"),
            generatorIds: ["handler.one"],
          },
        ],
      }),
    );
    expect(result.blockingReasons[0]?.sourcePaths).toEqual(["spec/other.md", "spec/source.md"]);
  });

  it("should stop composition after conflict, declaration, and graph failures", () => {
    const duplicateConflict = {
      conflictId: "conflict.one",
      classification: "contradiction" as const,
      citations: [citation()],
      ruleIds: [],
      resolution: "Blocked.",
    };
    expect(
      validateInventorySemantics(
        inventory({ conflicts: [duplicateConflict, duplicateConflict] }),
        EMPTY_CONTEXT,
      ).diagnostics[0]?.phase,
    ).toBe("conflict");
    expect(
      validateInventorySemantics(inventory({ evidenceCapabilityDeclarations: [] }), EMPTY_CONTEXT)
        .diagnostics[0]?.phase,
    ).toBe("declaration");
    const current = { ...rule("rule.one"), prerequisiteRuleIds: ["rule.one"] };
    const { fixture, context } = allocatedFixture(current);
    expect(validateInventorySemantics(fixture, context).diagnostics[0]?.phase).toBe("graph");
  });
});
