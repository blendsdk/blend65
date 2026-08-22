import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { INVENTORY_V1_LIMITS } from "./limits.js";
import { parseInventoryJson } from "./json-input.js";
import { validateInventorySchema } from "./schema-validator.js";
import { createModeledGeneratorSuite } from "./modeled-generator-suite.js";
import { generateFrontendCase, boundaryVariantsHandler } from "./modeled-generators.js";
import { renderGeneratedCase } from "./case-generator.js";
import { createPreparedCampaignCapability, type PreparedCampaignState } from "./campaign-state.js";
import {
  PREPARED_CAMPAIGN_CAPABILITY,
  type CampaignPlanSummary,
  type PreparedCampaign,
} from "./campaign-model.js";
import type { Sha256Digest } from "./model-registry-model.js";
import type { ModeledGeneratorSuite, ScalarCaseChoice } from "./modeled-generator-model.js";
import {
  EXECUTION_MAXIMUM_BUDGET_V1,
  EXECUTION_RESULT_CODES_V1,
  EXECUTION_STAGES_V1,
  EXECUTION_TIERS_V1,
  isExecutionDigestV1,
  isExecutionTierV1,
  parseExecutionContractsV1,
  parseExecutionPolicyV1,
  reduceExecutionTerminalV1,
  type ExecutionOperationResultV1,
  type ExecutionOperationalStageV1,
  type ExecutionPolicyV1,
  type ExecutionRoutePlanV1,
  type ExecutionTerminalBaseV1,
  type ExecutionTerminalCandidateV1,
} from "./execution-contracts.js";
import { projectExecutionCampaignV1 } from "./execution-campaign-projection.js";
import { serializeExecutionRoutePlanV1 } from "./execution-route-plan.js";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const POLICY: ExecutionPolicyV1 = {
  revision: "execution-policy-v1",
  budget: EXECUTION_MAXIMUM_BUDGET_V1,
};

function digest(character: string): Sha256Digest {
  return `sha256:${character.repeat(64)}`;
}

function requireSuccess<T>(result: ExecutionOperationResultV1<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError(JSON.stringify(result.issues));
  return result.value;
}

function expectFailure(result: ExecutionOperationResultV1<unknown>): void {
  expect(result.ok).toBe(false);
  if (result.ok) throw new TypeError("expected passive operation failure");
  expect(result.issues).toHaveLength(1);
}

function contracts(): Readonly<Record<string, unknown>> {
  return {
    revision: "execution-contracts-v1",
    tiers: [...EXECUTION_TIERS_V1],
    capabilities: [...EXECUTION_TIERS_V1],
    stages: [...EXECUTION_STAGES_V1],
    resultCodes: [...EXECUTION_RESULT_CODES_V1],
    policy: POLICY,
  };
}

function terminalBase(): ExecutionTerminalBaseV1 {
  return {
    tier: "vice",
    stage: "compare",
    usage: {
      wallMs: 1,
      outputBytes: 2,
      evidenceBytes: 3,
      instructions: 4,
      cycles: 5,
      launchAttempts: 1,
    },
    evidence: { digest: digest("e"), retainedBytes: 3, truncated: false },
  };
}

type OperationalCandidate = Extract<
  ExecutionTerminalCandidateV1,
  { readonly stage: ExecutionOperationalStageV1 }
>;

function candidate(
  stage: ExecutionOperationalStageV1,
  code: OperationalCandidate["code"],
): OperationalCandidate {
  const base = terminalBase();
  return { stage, code, usage: base.usage, evidence: base.evidence };
}

function cleanupCandidate(): Extract<ExecutionTerminalCandidateV1, { readonly stage: "cleanup" }> {
  const base = terminalBase();
  return {
    stage: "cleanup",
    code: "emulator-lease-recovery-blocked",
    usage: base.usage,
    evidence: base.evidence,
    cleanupBlocker: {
      code: "emulator-lease-recovery-blocked",
      evidenceDigest: digest("f"),
    },
  };
}

async function reviewedSuite(): Promise<ModeledGeneratorSuite> {
  const [inventoryBytes, seedContractBytes, ruleModelBytes, reviewEvidenceBytes] =
    await Promise.all([
      readFile(resolve(REPOSITORY_ROOT, "readiness/inventory/compiler-readiness-v1.json")),
      readFile(resolve(REPOSITORY_ROOT, "readiness/rule-models/rule-model-seed-v1.json")),
      readFile(resolve(REPOSITORY_ROOT, "readiness/rule-models/rule-models-v1.json")),
      readFile(resolve(REPOSITORY_ROOT, "readiness/reviews/rule-models-v1-review.json")),
    ]);
  const parsed = parseInventoryJson(inventoryBytes, INVENTORY_V1_LIMITS);
  if (!parsed.ok) throw new TypeError("inventory fixture must parse");
  const inventory = validateInventorySchema(parsed.inventory);
  if (!inventory.ok || inventory.inventory === undefined) {
    throw new TypeError("inventory fixture must validate");
  }
  const result = createModeledGeneratorSuite({
    seedContractBytes,
    ruleModelBytes,
    reviewEvidenceBytes,
    inventory: inventory.inventory,
  });
  if (!result.ok) throw new TypeError("reviewed modeled suite must load");
  return result.suite;
}

function state(
  suite: ModeledGeneratorSuite,
  overrides: Partial<PreparedCampaignState> = {},
): PreparedCampaignState {
  const choice: ScalarCaseChoice = {
    kind: "scalar",
    ruleId: "rule.ch02.2-primitive-types.byte.range.0-255",
    spelling: "literal",
    value: 0n,
  };
  const campaignDigest = digest("a");
  return {
    campaign: {
      inventorySchemaVersion: 1,
      inventoryVersion: "compiler-readiness-v1",
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
    },
    configuration: {
      caseCount: 1,
      maxInvalidCases: 0,
      enabledRuleIds: [choice.ruleId],
      spellings: ["literal"],
      budget: {
        maxModules: 1,
        maxDeclarations: 8,
        maxIrNodes: 64,
        maxStatements: 16,
        maxExpressionDepth: 8,
        maxLoopWork: 128n,
        maxSourceBytes: 4_096,
        maxAttempts: 8,
      },
    },
    dependencies: {
      inventory: {
        schemaVersion: 1,
        inventoryVersion: "compiler-readiness-v1",
        inventoryDigest: digest("1"),
        specRevision: "spec-v3.0",
      },
      ruleModel: {
        schemaVersion: 1,
        ruleModelVersion: "rule-model-v1",
        ruleModelDigest: digest("2"),
        suite,
      },
      generator: {
        handlerId: "generator.frontend-cases",
        contractVersion: "1.0.0",
        implementationRevision: digest("3"),
        implementation: generateFrontendCase,
      },
      boundaryTransform: {
        handlerId: "transform.boundary-variants",
        contractVersion: "1.0.0",
        implementationRevision: digest("4"),
        implementation: boundaryVariantsHandler,
      },
      renderer: {
        implementationRevision: digest("5"),
        implementation: renderGeneratedCase,
      },
    },
    campaignDigest,
    domains: [
      { ruleId: choice.ruleId, choices: [choice], neighborIds: ["neighbor.scalar.byte.above-max"] },
    ],
    coverageChoices: [choice],
    invalidChoicesByDomain: [[[]]],
    coverageCount: 1,
    randomValidCount: 0,
    invalidCount: 0,
    renderOptions: { maxSourceBytes: 4_096, literalSpellings: [] },
    ...overrides,
  };
}

function campaignFromState(campaignState: PreparedCampaignState): PreparedCampaign {
  const summary: CampaignPlanSummary = {
    schemaVersion: 1,
    campaignDigest: campaignState.campaignDigest,
    totalCaseCount: campaignState.configuration.caseCount,
    validCaseCount: campaignState.configuration.caseCount - campaignState.invalidCount,
    invalidCaseCount: campaignState.invalidCount,
  };
  return createPreparedCampaignCapability(summary, campaignState);
}

describe("passive execution contracts", () => {
  it("should canonicalize complete contracts and inclusive minimum and maximum policies", () => {
    const reversed = {
      revision: "execution-contracts-v1",
      tiers: [...EXECUTION_TIERS_V1].reverse(),
      capabilities: [...EXECUTION_TIERS_V1].reverse(),
      stages: [...EXECUTION_STAGES_V1].reverse(),
      resultCodes: [...EXECUTION_RESULT_CODES_V1].reverse(),
      policy: POLICY,
    };
    expect(requireSuccess(parseExecutionContractsV1(reversed))).toEqual({
      revision: "execution-contracts-v1",
      tiers: EXECUTION_TIERS_V1,
      capabilities: EXECUTION_TIERS_V1,
      stages: EXECUTION_STAGES_V1,
      resultCodes: EXECUTION_RESULT_CODES_V1,
      policy: POLICY,
    });
    expect(
      requireSuccess(
        parseExecutionPolicyV1({
          revision: "execution-policy-v1",
          budget: {
            operationMs: 1,
            launchAttemptMs: 1,
            routeMs: 3_001,
            cleanupGraceMs: 3_000,
            outputBytes: 1,
            evidenceBytes: 1,
            instructions: 1,
            cycles: 1,
            launchAttempts: 1,
          },
        }),
      ).budget.routeMs,
    ).toBe(3_001);
    expect(isExecutionTierV1("vice")).toBe(true);
    expect(isExecutionTierV1("native")).toBe(false);
    expect(isExecutionDigestV1(digest("a"))).toBe(true);
    expect(isExecutionDigestV1("bad")).toBe(false);
  });

  it("should reject hostile records and dense-array violations without invoking accessors", () => {
    let invoked = false;
    const accessor = {
      get revision(): string {
        invoked = true;
        return "execution-contracts-v1";
      },
      tiers: [...EXECUTION_TIERS_V1],
      capabilities: [...EXECUTION_TIERS_V1],
      stages: [...EXECUTION_STAGES_V1],
      resultCodes: [...EXECUTION_RESULT_CODES_V1],
      policy: POLICY,
    };
    const sparse = [...EXECUTION_TIERS_V1];
    delete sparse[2];
    class TierArray extends Array<string> {}
    const proxy = new Proxy(contracts(), {
      getPrototypeOf(): never {
        throw new Error("hostile prototype");
      },
    });

    expectFailure(parseExecutionContractsV1(accessor));
    expectFailure(parseExecutionContractsV1({ ...contracts(), tiers: sparse }));
    expectFailure(parseExecutionContractsV1({ ...contracts(), tiers: new TierArray("frontend") }));
    expectFailure(parseExecutionContractsV1(proxy));
    expect(invoked).toBe(false);
  });

  it("should reject every structural and coherent-policy violation", () => {
    const mutants: readonly unknown[] = [
      null,
      { revision: "execution-policy-v1", budget: EXECUTION_MAXIMUM_BUDGET_V1, extra: true },
      { revision: "future", budget: EXECUTION_MAXIMUM_BUDGET_V1 },
      { revision: "execution-policy-v1", budget: { operationMs: 1 } },
      { ...POLICY, budget: { ...POLICY.budget, cleanupGraceMs: 2_999 } },
      { ...POLICY, budget: { ...POLICY.budget, routeMs: 3_000 } },
      { ...POLICY, budget: { ...POLICY.budget, operationMs: Number.NaN } },
    ];
    for (const mutant of mutants) expectFailure(parseExecutionPolicyV1(mutant));

    const nested = parseExecutionContractsV1({
      ...contracts(),
      policy: { ...POLICY, budget: { ...POLICY.budget, routeMs: 3_000 } },
    });
    expectFailure(nested);
    if (!nested.ok) expect(nested.issues[0].path).toBe("/policy/budget/routeMs");
  });

  it("should preserve pipeline precedence independently of callback order", () => {
    const base = terminalBase();
    const cleanupBlocker = {
      code: "emulator-lease-recovery-blocked" as const,
      evidenceDigest: digest("f"),
    };
    const result = reduceExecutionTerminalV1(base, [
      candidate("compare", "semantic-mismatch"),
      candidate("run", "cycle-exhaustion"),
      candidate("run", "instruction-exhaustion"),
      cleanupCandidate(),
    ]);
    expect(result).toMatchObject({
      status: "failure",
      stage: "run",
      code: "instruction-exhaustion",
      cleanupBlocker,
    });
    expect(
      reduceExecutionTerminalV1(base, [
        candidate("frontend", "diagnostic-mismatch"),
        candidate("run", "wall-time-exhaustion"),
      ]),
    ).toMatchObject({ stage: "frontend", code: "diagnostic-mismatch" });
    expect(
      reduceExecutionTerminalV1(base, [
        candidate("run", "instruction-exhaustion"),
        candidate("run", "wall-time-exhaustion"),
      ]),
    ).toMatchObject({ stage: "run", code: "wall-time-exhaustion" });
    expect(reduceExecutionTerminalV1(base, [])).toMatchObject({ status: "pass", code: "pass" });
    expect(reduceExecutionTerminalV1(base, [cleanupCandidate()])).toMatchObject({
      status: "failure",
      stage: "cleanup",
      code: "emulator-lease-recovery-blocked",
    });
    const malformedCleanup = {
      stage: "cleanup",
      code: "emulator-lease-recovery-blocked",
      usage: base.usage,
      evidence: base.evidence,
    };
    expect(
      Reflect.apply(reduceExecutionTerminalV1, undefined, [base, [malformedCleanup]]),
    ).toMatchObject({
      status: "failure",
      stage: "cleanup",
      code: "emulator-lease-recovery-blocked",
      cleanupBlocker: {
        code: "emulator-lease-recovery-blocked",
        evidenceDigest: base.evidence.digest,
      },
    });
  });

  it("should serialize structurally equivalent plans into the same canonical bytes", () => {
    const itemA = {
      caseIdentity: digest("1"),
      ruleId: "rule.a",
      obligation: "frontend",
      terminalTier: "frontend" as const,
      prerequisiteTiers: [],
      rankDigest: digest("a"),
    };
    const itemB = {
      caseIdentity: digest("2"),
      ruleId: "rule.b",
      obligation: "acme",
      terminalTier: "acme" as const,
      prerequisiteTiers: ["frontend", "compiler-api", "emit"] as const,
      rankDigest: digest("b"),
    };
    const plan = (items: ExecutionRoutePlanV1["items"]): ExecutionRoutePlanV1 => ({
      revision: "execution-route-plan-v1",
      parentDigest: digest("3"),
      campaignDigest: digest("4"),
      oracleDigest: digest("5"),
      policy: POLICY,
      items,
      digest: digest("6"),
    });
    expect(serializeExecutionRoutePlanV1(plan([itemB, itemA]))).toEqual(
      serializeExecutionRoutePlanV1(plan([itemA, itemB])),
    );
  });
});

describe("prepared campaign execution projection", () => {
  it("should reject a structural campaign lookalike", async () => {
    const summary: CampaignPlanSummary = {
      schemaVersion: 1,
      campaignDigest: digest("a"),
      totalCaseCount: 0,
      validCaseCount: 0,
      invalidCaseCount: 0,
    };
    const lookalike: PreparedCampaign = {
      [PREPARED_CAMPAIGN_CAPABILITY]: true,
      summary,
    };
    expectFailure(projectExecutionCampaignV1(lookalike));
  });

  it("should derive canonical identities and passive strata from genuine private state", async () => {
    const suite = await reviewedSuite();
    const projection = requireSuccess(projectExecutionCampaignV1(campaignFromState(state(suite))));
    expect(projection).toMatchObject({
      revision: "execution-campaign-projection-v1",
      campaignDigest: digest("a"),
      cases: [
        {
          ruleId: "rule.ch02.2-primitive-types.byte.range.0-255",
          validity: "valid",
          spellingTuple: ["literal"],
          boundaryFamilyId: "boundary.scalar.byte",
        },
      ],
    });
    expect(projection.cases[0]?.caseIdentity).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it("should fail closed when retained campaign state cannot reproduce its population", async () => {
    const suite = await reviewedSuite();
    const valid = state(suite);
    const unavailableItem = state(suite, {
      configuration: { ...valid.configuration, caseCount: 2 },
    });
    const invalidIdentity = state(suite, { campaignDigest: "sha256:invalid" });
    const unknownChoice: ScalarCaseChoice = {
      kind: "scalar",
      ruleId: "rule.unknown",
      spelling: "literal",
      value: 0n,
    };
    const unknownFact = state(suite, {
      coverageChoices: [unknownChoice],
    });

    expectFailure(projectExecutionCampaignV1(campaignFromState(unavailableItem)));
    expectFailure(projectExecutionCampaignV1(campaignFromState(invalidIdentity)));
    expectFailure(projectExecutionCampaignV1(campaignFromState(unknownFact)));
  });
});
