import { describe, expect, it } from "vitest";

import {
  campaignBoundaryAgrees,
  createCampaignPlan,
  createReplayCampaignPlan,
  createReplayCampaignTarget,
} from "./campaign.js";
import type { CampaignBoundaryBindingV1 } from "./campaign-model.js";

const DIGEST = `sha256:${"1".repeat(64)}` as const;
const CAMPAIGN = Object.freeze({
  inventorySchemaVersion: 1,
  inventoryVersion: "1.0.0",
  inventoryDigest: DIGEST,
  specRevision: "spec-v3.0",
  ruleModelVersion: "1.0.0",
  ruleModelDigest: DIGEST,
  generator: Object.freeze({
    handlerId: "generator.frontend-cases",
    contractVersion: "1.0.0",
    implementationRevision: DIGEST,
  }),
  boundaryTransform: Object.freeze({
    handlerId: "transform.boundary-variants",
    contractVersion: "1.0.0",
    implementationRevision: DIGEST,
  }),
  rendererRevision: DIGEST,
  target: "c64",
  prngAlgorithm: "blend65-sha256-ctr-v1",
  seed: DIGEST,
  configurationDigest: DIGEST,
});

describe("campaign public input guards", () => {
  it("rejects non-record, open, accessor, and revoked campaign envelopes", () => {
    const accessor = Object.defineProperty({}, "campaign", {
      enumerable: true,
      get(): never {
        throw new Error("must not execute");
      },
    });
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    const invalidInputs: readonly unknown[] = [
      null,
      [],
      {},
      { campaign: {}, configuration: {}, dependencies: {}, extra: true },
      accessor,
      proxy,
    ];

    for (const input of invalidInputs) {
      expect(Reflect.apply(createCampaignPlan, undefined, [input])).toMatchObject({
        ok: false,
        diagnostics: [{ code: "campaign.input.invalid" }],
      });
      expect(createReplayCampaignPlan(input)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "campaign.input.invalid" }],
      });
      expect(
        Reflect.apply(createReplayCampaignTarget, undefined, [
          input,
          { campaignDigest: "invalid", generationPath: [], ordinal: -1 },
        ]),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: "campaign.input.invalid" }],
      });
    }
  });

  it("rejects malformed dependency authority after accepting the closed outer shape", () => {
    const input = Object.freeze({
      campaign: Object.freeze({}),
      configuration: Object.freeze({}),
      dependencies: Object.freeze({}),
    });

    expect(Reflect.apply(createCampaignPlan, undefined, [input])).toMatchObject({
      ok: false,
      diagnostics: [{ code: "campaign.input.invalid", path: "/dependencies" }],
    });
    expect(createReplayCampaignPlan(input)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "campaign.input.invalid" }],
    });
    expect(
      Reflect.apply(createReplayCampaignTarget, undefined, [
        input,
        { campaignDigest: "invalid", generationPath: [], ordinal: -1 },
      ]),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "campaign.input.invalid" }],
    });
  });

  it("rejects non-plain and accessor-bearing closed envelopes without invoking accessors", () => {
    class NonPlainEnvelope {}
    const accessor = {
      campaign: CAMPAIGN,
      configuration: {},
      dependencies: {},
    };
    Object.defineProperty(accessor, "dependencies", {
      enumerable: true,
      get(): never {
        throw new Error("must not execute");
      },
    });
    const symbolKey = Symbol("extra");
    const symbolEnvelope = {
      campaign: CAMPAIGN,
      configuration: {},
      dependencies: {},
      [symbolKey]: true,
    };
    const nullPrototypeEnvelope = {
      campaign: CAMPAIGN,
      configuration: {},
      dependencies: {},
    };
    Object.setPrototypeOf(nullPrototypeEnvelope, null);

    for (const input of [new NonPlainEnvelope(), nullPrototypeEnvelope, accessor, symbolEnvelope]) {
      expect(Reflect.apply(createCampaignPlan, undefined, [input])).toMatchObject({
        ok: false,
        diagnostics: [{ code: "campaign.input.invalid" }],
      });
    }
  });

  it("validates every carried campaign identity field before registry resolution", () => {
    const invalidCampaigns: readonly unknown[] = [
      { ...CAMPAIGN, inventorySchemaVersion: 2 },
      { ...CAMPAIGN, inventoryVersion: "" },
      { ...CAMPAIGN, inventoryDigest: "invalid" },
      { ...CAMPAIGN, specRevision: "" },
      { ...CAMPAIGN, ruleModelVersion: "" },
      { ...CAMPAIGN, ruleModelDigest: "invalid" },
      { ...CAMPAIGN, generator: null },
      { ...CAMPAIGN, generator: { ...CAMPAIGN.generator, handlerId: 1 } },
      { ...CAMPAIGN, generator: { ...CAMPAIGN.generator, contractVersion: 1 } },
      {
        ...CAMPAIGN,
        generator: { ...CAMPAIGN.generator, implementationRevision: "invalid" },
      },
      { ...CAMPAIGN, boundaryTransform: null },
      {
        ...CAMPAIGN,
        boundaryTransform: { ...CAMPAIGN.boundaryTransform, handlerId: 1 },
      },
      {
        ...CAMPAIGN,
        boundaryTransform: { ...CAMPAIGN.boundaryTransform, contractVersion: 1 },
      },
      {
        ...CAMPAIGN,
        boundaryTransform: {
          ...CAMPAIGN.boundaryTransform,
          implementationRevision: "invalid",
        },
      },
      { ...CAMPAIGN, rendererRevision: "invalid" },
      { ...CAMPAIGN, target: "invalid" },
      { ...CAMPAIGN, prngAlgorithm: "invalid" },
      { ...CAMPAIGN, seed: "invalid" },
      { ...CAMPAIGN, configurationDigest: "invalid" },
      { ...CAMPAIGN, extra: true },
    ];

    for (const campaign of invalidCampaigns) {
      expect(
        createReplayCampaignPlan({
          campaign,
          configuration: {},
          dependencies: {},
        }),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: "campaign.input.invalid" }],
      });
    }
    expect(
      createReplayCampaignPlan({
        campaign: CAMPAIGN,
        configuration: {},
        dependencies: {},
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "campaign.input.invalid", path: "/dependencies" }],
    });
  });

  it("fails closed for unknown rules and throwing boundary implementations", () => {
    const throwingBoundary: CampaignBoundaryBindingV1 = Object.freeze({
      handlerId: "transform.boundary-variants",
      contractVersion: "1.0.0",
      implementationRevision: DIGEST,
      implementation(): never {
        throw new Error("injected boundary failure");
      },
    });

    expect(campaignBoundaryAgrees(throwingBoundary, "rule.unknown", ["literal"])).toBe(false);
    expect(
      campaignBoundaryAgrees(throwingBoundary, "rule.ch02.2-primitive-types.byte.range.0-255", [
        "literal",
      ]),
    ).toBe(false);
  });
});
