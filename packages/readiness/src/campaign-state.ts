import type { GenerationConfiguration } from "./canonical-identity.js";
import type { CampaignIdentityInput } from "./case-identity.js";
import {
  PREPARED_CAMPAIGN_CAPABILITY,
  type CampaignBoundaryBindingV1,
  type CampaignGeneratorBindingV1,
  type CampaignInventoryAuthorityV1,
  type CampaignPlanSummary,
  type CampaignRendererBindingV1,
  type CampaignRuleModelAuthorityV1,
  type PreparedCampaign,
} from "./campaign-model.js";
import type { ModeledCaseChoice } from "./modeled-generator-model.js";
import type { Sha256Digest } from "./model-registry-model.js";
import type { SourceRenderOptions } from "./roundtrip-model.js";

/** One enabled reviewed rule and its campaign-permitted choices. */
export interface CampaignDomain {
  readonly ruleId: string;
  readonly choices: readonly ModeledCaseChoice[];
  readonly neighborIds: readonly string[];
}

/** Closed executable dependencies retained only behind a prepared campaign capability. */
export interface PreparedCampaignDependencies {
  readonly inventory: CampaignInventoryAuthorityV1;
  readonly ruleModel: CampaignRuleModelAuthorityV1;
  readonly generator: CampaignGeneratorBindingV1;
  readonly boundaryTransform: CampaignBoundaryBindingV1;
  readonly renderer: CampaignRendererBindingV1;
}

/** Internal immutable state behind one prepared campaign capability. */
export interface PreparedCampaignState {
  readonly campaign: CampaignIdentityInput;
  readonly configuration: GenerationConfiguration;
  readonly dependencies: PreparedCampaignDependencies;
  readonly campaignDigest: Sha256Digest;
  readonly domains: readonly CampaignDomain[];
  readonly coverageChoices: readonly ModeledCaseChoice[];
  readonly invalidChoicesByDomain: readonly (readonly (readonly ModeledCaseChoice[])[])[];
  readonly coverageCount: number;
  readonly randomValidCount: number;
  readonly invalidCount: number;
  readonly renderOptions: SourceRenderOptions;
}

const PREPARED_STATES = new WeakMap<object, PreparedCampaignState>();

/**
 * Creates an opaque campaign and binds its already-closed private state.
 *
 * @param summary Immutable campaign summary.
 * @param state Complete prepared authority and lane metadata.
 * @returns Frozen cursor-free campaign capability.
 */
export function createPreparedCampaignCapability(
  summary: CampaignPlanSummary,
  state: PreparedCampaignState,
): PreparedCampaign {
  const capability: PreparedCampaign = Object.freeze({
    [PREPARED_CAMPAIGN_CAPABILITY]: true as const,
    summary,
  });
  PREPARED_STATES.set(capability, Object.freeze(state));
  return capability;
}

/** Resolves private state only for a factory-produced prepared campaign. */
export function getPreparedCampaignState(
  campaign: PreparedCampaign,
): PreparedCampaignState | undefined {
  if (typeof campaign !== "object" || campaign === null) return undefined;
  return PREPARED_STATES.get(campaign);
}
