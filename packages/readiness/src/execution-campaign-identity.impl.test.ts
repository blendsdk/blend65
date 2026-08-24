import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import type { PublishedSnapshot } from "./binding-model.js";
import type { GenerationConfiguration } from "./canonical-identity.js";
import type { PreparedCampaign } from "./campaign-model.js";
import { createPreparedCampaignCapability, type PreparedCampaignState } from "./campaign-state.js";
import {
  authenticatePublishedExecutionCampaignParentV1,
  createPublishedExecutionCampaignV1,
  getPreparedCampaignExecutionIdentityV1,
} from "./execution-campaign-identity.js";
import { resolvePublishedSnapshot } from "./publication-resolver.js";

const CAMPAIGN_DIGEST = `sha256:${"a".repeat(64)}` as `sha256:${string}`;
const SEED = `sha256:${"b".repeat(64)}` as `sha256:${string}`;
const SELECTED_PARENT_DIGEST =
  "sha256:e5796e6f2abab401100f93547b4044c57a762b9ec7703e6183fda2c07afcd3e5";
const HISTORICAL_PARENT_DIGEST =
  "sha256:8f27564485518a6addbab549ab75c85bbf19a3cc976ec9de61ea4d04a55bf597";
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONFIGURATION: GenerationConfiguration = {
  caseCount: 40,
  maxInvalidCases: 16,
  enabledRuleIds: [
    "rule.ch12.3-1-memory-access.peek-addr.signature.word",
    "rule.ch12.3-1-memory-access.peekw-addr.signature.word",
    "rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte",
    "rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word",
  ],
  spellings: ["literal", "parameter"],
  budget: {
    maxModules: 4,
    maxDeclarations: 128,
    maxIrNodes: 512,
    maxStatements: 256,
    maxExpressionDepth: 16,
    maxLoopWork: 1n,
    maxSourceBytes: 65_536,
    maxAttempts: 128,
  },
};

let selectedSnapshot: PublishedSnapshot;

beforeAll(async () => {
  const selected = await resolvePublishedSnapshot({ repositoryRoot: REPOSITORY_ROOT });
  if (!selected.ok) throw new TypeError(JSON.stringify(selected.diagnostics));
  selectedSnapshot = selected.value;
});

function genuineCampaign(): PreparedCampaign {
  const state = {
    campaignDigest: CAMPAIGN_DIGEST,
    campaign: { seed: SEED, target: "c64" },
  } as PreparedCampaignState;
  return createPreparedCampaignCapability(
    {
      schemaVersion: 1,
      campaignDigest: CAMPAIGN_DIGEST,
      totalCaseCount: 1,
      validCaseCount: 1,
      invalidCaseCount: 0,
    },
    state,
  );
}

describe("prepared campaign execution identity", () => {
  it("returns a fresh deeply frozen passive projection for genuine campaigns", () => {
    const campaign = genuineCampaign();
    const first = getPreparedCampaignExecutionIdentityV1(campaign);
    const second = getPreparedCampaignExecutionIdentityV1(campaign);

    expect(first).toEqual({
      ok: true,
      value: {
        revision: "prepared-campaign-execution-identity-v1",
        campaignDigest: CAMPAIGN_DIGEST,
        seed: SEED,
        target: "c64",
      },
    });
    expect(first).not.toBe(second);
    if (!first.ok || !second.ok) throw new TypeError("expected genuine campaign identity");
    expect(first.value).not.toBe(second.value);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.value)).toBe(true);
  });

  it("rejects structurally copied and forged campaign objects", () => {
    const campaign = genuineCampaign();
    for (const candidate of [{ ...campaign }, {}, null]) {
      const result = getPreparedCampaignExecutionIdentityV1(candidate as PreparedCampaign);
      expect(result.ok).toBe(false);
      if (result.ok) throw new TypeError("expected forged campaign rejection");
      expect(result.issues).toEqual([
        {
          code: "execution.identity",
          path: "/campaign",
          message: "Prepared campaign authority is not genuine.",
        },
      ]);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.issues)).toBe(true);
      expect(Object.isFrozen(result.issues[0])).toBe(true);
    }
  });
});

describe("published execution campaign authority", () => {
  it("prepares a genuine parent-bound campaign from semantic-only input", () => {
    const prepared = createPublishedExecutionCampaignV1(selectedSnapshot, {
      schemaVersion: 1,
      target: "c64",
      seed: SEED,
      configuration: CONFIGURATION,
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new TypeError("expected published execution campaign");
    expect(prepared.value.summary).toMatchObject({
      totalCaseCount: 40,
      validCaseCount: 24,
      invalidCaseCount: 16,
    });
    expect(
      authenticatePublishedExecutionCampaignParentV1(prepared.value, SELECTED_PARENT_DIGEST),
    ).toEqual({ ok: true, value: true });
    const mismatched = authenticatePublishedExecutionCampaignParentV1(
      prepared.value,
      HISTORICAL_PARENT_DIGEST,
    );
    expect(mismatched).toMatchObject({
      ok: false,
      issues: [{ code: "execution.identity", path: "/campaign/parentDigest" }],
    });
    expect(
      Reflect.apply(authenticatePublishedExecutionCampaignParentV1, undefined, [
        { ...prepared.value },
        SELECTED_PARENT_DIGEST,
      ]),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "execution.identity", path: "/campaign/parentDigest" }],
    });
  });

  it("rejects forged snapshots and injected authority fields", () => {
    const forged = Reflect.apply(createPublishedExecutionCampaignV1, undefined, [
      { publicationDigest: `sha256:${"0".repeat(64)}` },
      { schemaVersion: 1, target: "c64", seed: SEED, configuration: CONFIGURATION },
    ]);
    expect(forged).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.authority.missing", path: "/snapshot" }],
    });
    const injected = createPublishedExecutionCampaignV1(selectedSnapshot, {
      schemaVersion: 1,
      target: "c64",
      seed: SEED,
      configuration: CONFIGURATION,
      rendererRevision: `sha256:${"0".repeat(64)}`,
    });
    expect(injected).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid", path: "/intent" }],
    });
  });

  it("rejects malformed configurations and mixed selected generator routes", () => {
    const malformed = createPublishedExecutionCampaignV1(selectedSnapshot, {
      schemaVersion: 1,
      target: "c64",
      seed: SEED,
      configuration: { ...CONFIGURATION, caseCount: 0 },
    });
    expect(malformed).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.input.invalid" }],
    });
    const mixed = createPublishedExecutionCampaignV1(selectedSnapshot, {
      schemaVersion: 1,
      target: "c64",
      seed: SEED,
      configuration: {
        ...CONFIGURATION,
        enabledRuleIds: [
          "rule.ch02.2-primitive-types.byte.range.0-255",
          CONFIGURATION.enabledRuleIds[0],
        ],
      },
    });
    expect(mixed).toMatchObject({
      ok: false,
      diagnostics: [{ code: "oracle.route.invalid" }],
    });
  });
});
