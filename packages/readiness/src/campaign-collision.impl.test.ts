import { describe, expect, it } from "vitest";

import { createCampaignCollisionIndex, proveCampaignCaseIdentities } from "./campaign-collision.js";
import type { Sha256Digest } from "./model-registry-model.js";

const CAMPAIGN_DIGEST: Sha256Digest = `sha256:${"1".repeat(64)}`;

function requireIndex(result: ReturnType<typeof createCampaignCollisionIndex>) {
  if (!result.ok) throw new TypeError("collision index fixture must succeed");
  return result.value;
}

describe("campaign-specific collision proof", () => {
  it("proves the full 100,000-case limit without using the general identity registry", () => {
    const index = requireIndex(createCampaignCollisionIndex({ campaignDigest: CAMPAIGN_DIGEST }));

    expect(proveCampaignCaseIdentities(index, CAMPAIGN_DIGEST, 100_000, 40_000, 40_000)).toEqual({
      ok: true,
      value: true,
      diagnostics: [],
    });
  }, 20_000);

  it("rejects unequal witnesses under an injected digest and consumes an index once", () => {
    const index = requireIndex(
      createCampaignCollisionIndex({
        campaignDigest: CAMPAIGN_DIGEST,
        digest: () => new Uint8Array(32),
      }),
    );

    expect(proveCampaignCaseIdentities(index, CAMPAIGN_DIGEST, 2, 1, 0)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "campaign.identity.collision" }],
    });
    expect(proveCampaignCaseIdentities(index, CAMPAIGN_DIGEST, 1, 1, 0)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "campaign.input.invalid" }],
    });
  });

  it("rejects wrong-campaign, accessor, proxy and wrong-length digest inputs as data", () => {
    const wrongCampaign = requireIndex(
      createCampaignCollisionIndex({ campaignDigest: `sha256:${"2".repeat(64)}` }),
    );
    expect(proveCampaignCaseIdentities(wrongCampaign, CAMPAIGN_DIGEST, 1, 1, 0)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "campaign.identity.mismatch" }],
    });

    const shortDigest = requireIndex(
      createCampaignCollisionIndex({
        campaignDigest: CAMPAIGN_DIGEST,
        digest: () => new Uint8Array(31),
      }),
    );
    expect(proveCampaignCaseIdentities(shortDigest, CAMPAIGN_DIGEST, 1, 1, 0)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "campaign.input.invalid" }],
    });

    const accessor = {};
    Object.defineProperty(accessor, "campaignDigest", {
      enumerable: true,
      get: () => CAMPAIGN_DIGEST,
    });
    expect(
      createCampaignCollisionIndex(
        // @ts-expect-error Hostile accessor input intentionally violates the public type.
        accessor,
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "campaign.input.invalid" }],
    });

    const { proxy, revoke } = Proxy.revocable({ campaignDigest: CAMPAIGN_DIGEST }, {});
    revoke();
    expect(createCampaignCollisionIndex(proxy)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "campaign.input.invalid" }],
    });
  });
});
