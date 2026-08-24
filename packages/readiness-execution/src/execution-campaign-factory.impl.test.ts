import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import {
  generateCampaignCase,
  projectExecutionCampaignV1,
  resolvePublishedSnapshot,
  type PublishedSnapshot,
} from "@blend65/readiness";
import {
  createPublishedDiagnosticCaseV1,
  createPublishedOracleContext,
  createPublishedOracleRequest,
  evaluatePublishedOracle,
  type PublishedOracleContext,
} from "@blend65/readiness/published-oracle";
import { createPublishedExecutionCampaignV1 } from "@blend65/readiness/execution-campaign-identity";

import {
  createLocalExecutionCampaignV1,
  LOCAL_EXECUTION_CAMPAIGN_CONFIGURATION_V1,
} from "./execution-campaign-factory.js";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SEED = "7".repeat(64);
const ORACLE_BUDGET = Object.freeze({
  inputNodes: 512n,
  expressionDepth: 16n,
  evaluationSteps: 1_024n,
  frames: 16n,
  memoryCells: 256n,
  effects: 256n,
  transformedNodes: 512n,
});

async function selectedAuthority(): Promise<{
  readonly snapshot: PublishedSnapshot;
  readonly context: PublishedOracleContext;
}> {
  const selected = await resolvePublishedSnapshot({ repositoryRoot: REPOSITORY_ROOT });
  if (!selected.ok) throw new TypeError(JSON.stringify(selected.diagnostics));
  const context = createPublishedOracleContext(selected.value);
  if (!context.ok) throw new TypeError("Expected the selected oracle context.");
  return { snapshot: selected.value, context: context.value };
}

describe("local execution campaign factory", () => {
  it("constructs the bounded population under exact selected request provenance", async () => {
    const { snapshot, context } = await selectedAuthority();
    const campaign = createLocalExecutionCampaignV1(snapshot, SEED);
    const projected = projectExecutionCampaignV1(campaign);
    expect(projected.ok).toBe(true);
    if (!projected.ok) throw new TypeError("Expected local campaign projection.");
    expect(projected.value.cases).toHaveLength(40);

    const generated = generateCampaignCase(campaign, 0);
    if (!generated.ok) throw new TypeError("Expected the first selected campaign case.");
    const request = createPublishedOracleRequest(context, {
      schemaVersion: 1,
      handlerId: "oracle.runtime-state",
      ruleId: generated.value.modeledCase.primaryRuleId,
      seed: `sha256:${SEED}`,
      configuration: LOCAL_EXECUTION_CAMPAIGN_CONFIGURATION_V1,
      ordinal: 0,
      memory: { schemaVersion: 1, cells: [] },
      budget: ORACLE_BUDGET,
      observable: { kind: "value-state" },
    });
    expect(request.ok).toBe(true);
    if (!request.ok) throw new TypeError("Expected selected request provenance.");
    expect(request.value.sourceProvenance.campaignDigest).toBe(projected.value.campaignDigest);

    for (let ordinal = 0; ordinal < projected.value.cases.length; ordinal += 1) {
      const item = generateCampaignCase(campaign, ordinal);
      if (!item.ok) throw new TypeError("Expected every selected campaign case.");
      if (item.value.modeledCase.validity.kind === "invalid") {
        expect(createPublishedDiagnosticCaseV1(context, campaign, ordinal).ok).toBe(true);
        continue;
      }
      const runtimeRequest = createPublishedOracleRequest(context, {
        schemaVersion: 1,
        handlerId: "oracle.runtime-state",
        ruleId: item.value.modeledCase.primaryRuleId,
        seed: `sha256:${SEED}`,
        configuration: LOCAL_EXECUTION_CAMPAIGN_CONFIGURATION_V1,
        ordinal,
        memory: { schemaVersion: 1, cells: [] },
        budget: ORACLE_BUDGET,
        observable: { kind: "value-state" },
      });
      expect(runtimeRequest.ok).toBe(true);
      if (!runtimeRequest.ok) throw new TypeError("Expected selected runtime request.");
      expect(evaluatePublishedOracle(context, runtimeRequest.value).ok).toBe(true);
    }
  });

  it("is byte-stable for the same selected context and seed", async () => {
    const { snapshot } = await selectedAuthority();
    const first = projectExecutionCampaignV1(createLocalExecutionCampaignV1(snapshot, SEED));
    const second = projectExecutionCampaignV1(createLocalExecutionCampaignV1(snapshot, SEED));
    expect(first).toEqual(second);
  });

  it("rejects invalid seeds before consulting campaign authority", async () => {
    const { snapshot } = await selectedAuthority();
    expect(() => createLocalExecutionCampaignV1(snapshot, "invalid")).toThrow("seed is invalid");
  });

  it("rejects forged contexts and caller-supplied authority fields", async () => {
    expect(() =>
      Reflect.apply(createLocalExecutionCampaignV1, undefined, [
        { selectedReleaseDigest: `sha256:${"0".repeat(64)}` },
        SEED,
      ]),
    ).toThrow("genuine nine-binding snapshot");

    const { snapshot } = await selectedAuthority();
    const injected = createPublishedExecutionCampaignV1(snapshot, {
      schemaVersion: 1,
      target: "c64",
      seed: `sha256:${SEED}`,
      configuration: LOCAL_EXECUTION_CAMPAIGN_CONFIGURATION_V1,
      generatorRevision: `sha256:${"0".repeat(64)}`,
    });
    expect(injected.ok).toBe(false);
    if (injected.ok) throw new TypeError("Expected injected campaign authority to fail.");
    expect(injected.diagnostics[0]?.code).toBe("oracle.input.invalid");
  });

  it("rejects enabled rules spanning different selected generator routes", async () => {
    const { snapshot } = await selectedAuthority();
    const mixed = createPublishedExecutionCampaignV1(snapshot, {
      schemaVersion: 1,
      target: "c64",
      seed: `sha256:${SEED}`,
      configuration: {
        ...LOCAL_EXECUTION_CAMPAIGN_CONFIGURATION_V1,
        enabledRuleIds: [
          LOCAL_EXECUTION_CAMPAIGN_CONFIGURATION_V1.enabledRuleIds[0],
          "rule.ch02.2-primitive-types.byte.range.0-255",
        ].sort(),
      },
    });
    expect(mixed.ok).toBe(false);
    if (mixed.ok) throw new TypeError("Expected mixed generator routes to fail.");
    expect(mixed.diagnostics[0]?.code).toBe("oracle.route.invalid");
  });
});
