import { describe, expect, it, vi } from "vitest";

import type { PreparedCampaign } from "./campaign-model.js";
import type { PublishedOracleContext } from "./oracle-model.js";

const FIXTURE = vi.hoisted(() => {
  const digest = (digit: string) => `sha256:${digit.repeat(64)}`;
  const campaign = {
    inventorySchemaVersion: 1,
    inventoryVersion: "1.0.0",
    inventoryDigest: digest("1"),
    specRevision: "spec-v3.0",
    ruleModelVersion: "rule-model-v1",
    ruleModelDigest: digest("2"),
    generator: {
      handlerId: "generator.frontend-cases",
      contractVersion: "1.0.0",
      implementationRevision: digest("3"),
    },
    boundaryTransform: {
      handlerId: "transform.boundary-variants",
      contractVersion: "1.0.0",
      implementationRevision: digest("4"),
    },
    rendererRevision: digest("5"),
    target: "c64",
    prngAlgorithm: "blend65-sha256-ctr-v1",
    seed: digest("6"),
    configurationDigest: digest("7"),
  } as const;
  const modeledCase = {
    primaryRuleId: "rule.ch02.2-primitive-types.word.range.0-65535",
    validity: { kind: "invalid", neighborId: "word-overflow" },
    projection: {
      kind: "invalid",
      baseline: { functions: [{ name: "main" }] },
      transform: {
        kind: "scalar-expression-replace",
        expressionPath: "/functions/0/body/0/value",
        replacement: { kind: "integer-literal", value: 65_536n },
      },
    },
  } as const;
  return {
    campaign,
    configuration: Object.freeze({ caseCount: 1 }),
    modeledCase,
    sourceBytes: new TextEncoder().encode("invalid source"),
    sourceContentIdentity: digest("8"),
    sourceCaseDigest: digest("9"),
    selectedCampaignDigest: digest("a"),
    selectedCampaign: { ...campaign } as Omit<typeof campaign, "seed" | "specRevision"> & {
      readonly specRevision: string;
      readonly seed: string;
    },
    selectedConfiguration: Object.freeze({ caseCount: 1 }) as Readonly<Record<string, unknown>>,
    lastIntent: undefined as Readonly<Record<string, unknown>> | undefined,
  };
});

const CONTEXT = {
  selectedReleaseDigest: `sha256:${"c".repeat(64)}`,
} as unknown as PublishedOracleContext;
const CAMPAIGN = Object.freeze({}) as PreparedCampaign;

vi.mock("./campaign-state.js", () => ({
  getPreparedCampaignState: () => ({
    campaign: FIXTURE.campaign,
    configuration: FIXTURE.configuration,
  }),
}));

vi.mock("./generate-case.js", () => ({
  generateCampaignCase: () => ({
    ok: true,
    value: {
      modeledCase: FIXTURE.modeledCase,
      sourceBytes: FIXTURE.sourceBytes,
      identity: { digest: FIXTURE.sourceCaseDigest },
      planItem: { ordinal: 0 },
    },
  }),
}));

vi.mock("./oracle-content-identity.js", () => ({
  deriveOracleSourceContentIdentity: () => ({
    ok: true,
    identity: FIXTURE.sourceContentIdentity,
  }),
}));

vi.mock("./published-oracle-context.js", () => ({
  createPublishedDiagnosticOracleRequest: (
    _context: unknown,
    intent: Readonly<Record<string, unknown>>,
  ) => {
    FIXTURE.lastIntent = intent;
    return {
      ok: true,
      value: {
        sourceProvenance: {
          campaign: FIXTURE.selectedCampaign,
          campaignDigest: FIXTURE.selectedCampaignDigest,
          caseIdentity: { digest: FIXTURE.sourceCaseDigest },
          configuration: FIXTURE.selectedConfiguration,
        },
        case: FIXTURE.modeledCase,
      },
      diagnostics: [],
    };
  },
  evaluatePublishedOracle: () => ({
    ok: true,
    evaluationIdentity: `sha256:${"b".repeat(64)}`,
    contentIdentities: { source: FIXTURE.sourceContentIdentity },
    result: {
      ok: true,
      outcome: "modeled",
      observation: {
        kind: "diagnostic",
        ruleId: FIXTURE.modeledCase.primaryRuleId,
        neighborId: FIXTURE.modeledCase.validity.neighborId,
      },
    },
  }),
}));

import { createPublishedDiagnosticCaseV1 } from "./published-diagnostic-case.js";

describe("published diagnostic campaign equivalence", () => {
  it("keeps the semantic specification revision distinct from inventory content identity", () => {
    expect(FIXTURE.campaign.specRevision).toBe("spec-v3.0");
    expect(FIXTURE.campaign.inventoryDigest).toMatch(/^sha256:/u);
    expect(FIXTURE.campaign.specRevision).not.toBe(FIXTURE.campaign.inventoryDigest);

    expect(createPublishedDiagnosticCaseV1(CONTEXT, CAMPAIGN, 0)).toMatchObject({ ok: true });
    expect(FIXTURE.lastIntent).toMatchObject({ seed: FIXTURE.campaign.seed });
    expect(FIXTURE.lastIntent?.configuration).toBe(FIXTURE.configuration);
  });

  it("rejects a content digest substituted for the exact semantic revision", () => {
    FIXTURE.selectedCampaign = {
      ...FIXTURE.campaign,
      specRevision: FIXTURE.campaign.inventoryDigest,
    };
    try {
      expect(createPublishedDiagnosticCaseV1(CONTEXT, CAMPAIGN, 0)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "oracle.contract.invalid", path: "/campaign" }],
      });
    } finally {
      FIXTURE.selectedCampaign = { ...FIXTURE.campaign };
    }
  });

  it("rejects a selected replay that does not echo caller-owned seed or configuration", () => {
    FIXTURE.selectedCampaign = {
      ...FIXTURE.campaign,
      seed: `sha256:${"d".repeat(64)}`,
    };
    expect(createPublishedDiagnosticCaseV1(CONTEXT, CAMPAIGN, 0)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.contract.invalid", path: "/campaign" }],
    });

    FIXTURE.selectedCampaign = { ...FIXTURE.campaign };
    FIXTURE.selectedConfiguration = Object.freeze({ caseCount: 2 });
    try {
      expect(createPublishedDiagnosticCaseV1(CONTEXT, CAMPAIGN, 0)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "oracle.contract.invalid", path: "/campaign" }],
      });
    } finally {
      FIXTURE.selectedCampaign = { ...FIXTURE.campaign };
      FIXTURE.selectedConfiguration = FIXTURE.configuration;
    }
  });
});
