import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { INVENTORY_V1_LIMITS, validateDeclarations, validateInventorySemantics } from "./index.js";
import type { BindingState, HandlerKind, InventoryRule, InventoryV1 } from "./index.js";

const HASH: `sha256:${string}` = `sha256:${"c".repeat(64)}`;
const CAPABILITIES = ["frontend", "compiler-api", "cli", "emit", "acme", "vice"] as const;

function rule(): InventoryRule {
  return {
    ruleId: "rule.one",
    source: {
      path: "spec/01.md",
      headingAncestry: ["Declarations"],
      quote: "A rule requires evidence.",
      contentHash: HASH,
      displayLine: 2,
    },
    requirement: "The rule must be observed.",
    category: "semantics",
    polarity: "positive",
    applicability: "mandatory-c64",
    validDomains: [],
    invalidNeighbors: [],
    boundaryFamilies: [],
    generatorIds: ["handler.generator"],
    oracleIds: ["handler.oracle"],
    transformIds: ["handler.transform"],
    evidenceObligations: ["acme", "frontend", "vice"],
    prerequisiteRuleIds: [],
    relatedRuleIds: [],
  };
}

function inventory(binding: BindingState = "bound"): InventoryV1 {
  const declarations = (
    [
      ["handler.generator", "generator"],
      ["handler.oracle", "oracle"],
      ["handler.transform", "transform"],
    ] as const
  ).map(([id, kind]) => ({
    id,
    kind,
    owner: "compiler-readiness",
    contractVersion: "1.0.0",
    binding,
  }));
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
    handlerDeclarations: declarations,
    evidenceCapabilityDeclarations: CAPABILITIES.map((id) => ({
      id,
      owner: "compiler-readiness",
      contractVersion: "1.0.0",
      binding,
      observableContract: `${id} observation.`,
      prerequisiteRoute: `route.${id}`,
    })),
    clauseLedger: [],
    conflicts: [],
    rules: [rule()],
    evolutionGate: null,
  };
}

describe("handler declarations", () => {
  // Bound declarations of each executable kind satisfy referenced contracts.
  it.each(["generator", "oracle", "transform"] as const)(
    "should accept a bound %s declaration",
    (kind) => {
      const fixture = inventory();
      const selected = fixture.handlerDeclarations.filter((item) => item.kind === kind);
      const currentRule = fixture.rules[0];
      const rules = [
        {
          ...currentRule,
          generatorIds: kind === "generator" ? [selected[0].id] : [],
          oracleIds: kind === "oracle" ? [selected[0].id] : [],
          transformIds: kind === "transform" ? [selected[0].id] : [],
        },
      ];
      expect(validateDeclarations({ ...fixture, rules }).ok).toBe(true);
    },
  );

  // Unbound declarations remain valid metadata but produce typed readiness blockers.
  it("should emit one blocker for each referenced unbound handler", () => {
    const result = validateDeclarations(inventory("unbound"));
    expect(result.ok).toBe(true);
    expect(result.blockingReasons.filter((reason) => reason.kind === "unbound-handler")).toEqual([
      {
        kind: "unbound-handler",
        identity: "handler.generator",
        sourcePaths: ["spec/01.md"],
      },
      {
        kind: "unbound-handler",
        identity: "handler.oracle",
        sourcePaths: ["spec/01.md"],
      },
      {
        kind: "unbound-handler",
        identity: "handler.transform",
        sourcePaths: ["spec/01.md"],
      },
    ]);
  });

  // Missing, duplicate, and wrong-kind declarations are semantic errors.
  it.each(["missing", "duplicate", "wrong-kind"] as const)(
    "should reject a %s handler declaration",
    (mutation) => {
      const fixture = inventory();
      let declarations = [...fixture.handlerDeclarations];
      if (mutation === "missing") declarations = declarations.slice(1);
      if (mutation === "duplicate") declarations.push(declarations[0]);
      if (mutation === "wrong-kind") {
        declarations[0] = { ...declarations[0], kind: "oracle" as HandlerKind };
      }
      expect(validateDeclarations({ ...fixture, handlerDeclarations: declarations }).ok).toBe(
        false,
      );
    },
  );
});

describe("evidence capabilities and blockers", () => {
  // The six required capability contracts resolve and multiple obligations stay attached.
  it("should resolve all six capabilities without collapsing a three-obligation rule", () => {
    const fixture = inventory();
    const result = validateDeclarations(fixture);
    expect(result.ok).toBe(true);
    expect(result.inventory?.evidenceCapabilityDeclarations.map(({ id }) => id)).toEqual([
      "frontend",
      "compiler-api",
      "cli",
      "emit",
      "acme",
      "vice",
    ]);
    expect(result.inventory?.rules[0].evidenceObligations).toEqual(["acme", "frontend", "vice"]);
  });

  // An unbound evidence route is valid inventory metadata but blocks readiness.
  it("should emit ordered capability blockers for referenced unbound routes", () => {
    const result = validateDeclarations(inventory("unbound"));
    expect(
      result.blockingReasons.filter((reason) => reason.kind === "unbound-evidence-capability"),
    ).toEqual([
      {
        kind: "unbound-evidence-capability",
        identity: "acme",
        sourcePaths: ["spec/01.md"],
      },
      {
        kind: "unbound-evidence-capability",
        identity: "frontend",
        sourcePaths: ["spec/01.md"],
      },
      {
        kind: "unbound-evidence-capability",
        identity: "vice",
        sourcePaths: ["spec/01.md"],
      },
    ]);
  });

  // Every blocker kind remains distinct and has deterministic ordering.
  it("should preserve the declaration blocker ordering contract", () => {
    const result = validateDeclarations(inventory("unbound"));
    expect(result.blockingReasons.map(({ kind, identity }) => `${kind}:${identity}`)).toEqual([
      "unbound-handler:handler.generator",
      "unbound-handler:handler.oracle",
      "unbound-handler:handler.transform",
      "unbound-evidence-capability:acme",
      "unbound-evidence-capability:frontend",
      "unbound-evidence-capability:vice",
    ]);
  });

  // Semantic blockers remain distinct and globally ordered in one valid inventory.
  it("should emit all four machine-readable blocker kinds in policy order", () => {
    const base = inventory("unbound");
    const currentRule = {
      ...base.rules[0],
      generatorIds: ["handler.generator"],
      oracleIds: [],
      transformIds: [],
      evidenceObligations: ["frontend"],
    };
    const previousHash = "sha256:9aeecea544992e64dcac88c5d625cc43b036424482397cd72b56705abc46ca23";
    const eventWithoutHash = {
      schemaVersion: 1,
      sequence: 0,
      operation: "allocate",
      ruleId: "rule.one",
      predecessorRuleIds: [],
      successorRuleIds: [],
      previousHash,
    } as const;
    const eventHash = `sha256:${createHash("sha256")
      .update("blend65.rule-identity-event")
      .update(Buffer.from([0]))
      .update(JSON.stringify(eventWithoutHash))
      .digest("hex")}`;
    const blockedCitation = {
      ...currentRule.source,
      path: "spec/02.md",
      quote: "The sources contradict.",
    };
    const fixture: InventoryV1 = {
      ...base,
      identityLedgerHead: eventHash,
      clauseLedger: [
        { fragmentId: "fragment.rule", disposition: "mapped", ruleIds: ["rule.one"] },
        {
          fragmentId: "fragment.blocked",
          disposition: "blocked-errata",
          conflictId: "conflict.one",
        },
      ],
      conflicts: [
        {
          conflictId: "conflict.one",
          classification: "contradiction",
          citations: [blockedCitation],
          ruleIds: [],
          resolution: "Await erratum.",
        },
      ],
      rules: [currentRule],
    };
    const result = validateInventorySemantics(fixture, {
      fragments: [
        {
          sourcePath: "spec/01.md",
          quote: currentRule.source.quote,
          fragment: {
            fragmentId: "fragment.rule",
            kind: "paragraph",
            startByte: 0,
            endByte: 10,
            headingAncestry: ["Declarations"],
            sectionIdentity: "declarations.0",
            contentHash: HASH,
            displayLine: 2,
            displayColumn: 1,
          },
        },
        {
          sourcePath: blockedCitation.path,
          quote: blockedCitation.quote,
          fragment: {
            fragmentId: "fragment.blocked",
            kind: "paragraph",
            startByte: 0,
            endByte: 10,
            headingAncestry: ["Declarations"],
            sectionIdentity: "declarations.0",
            contentHash: HASH,
            displayLine: 2,
            displayColumn: 1,
          },
        },
      ],
      identityLedgerBytes: new TextEncoder().encode(
        `${JSON.stringify({ ...eventWithoutHash, eventHash })}\n`,
      ),
      limits: INVENTORY_V1_LIMITS,
    });
    expect(result.ok).toBe(true);
    expect([...new Set(result.blockingReasons.map(({ kind }) => kind))]).toEqual([
      "blocked-errata",
      "unresolved-source-conflict",
      "unbound-handler",
      "unbound-evidence-capability",
    ]);
  });
});
