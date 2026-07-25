import type { CaseIdentity } from "./case-identity.js";
import type { CampaignPlanItem } from "./campaign-model.js";
import type { PreparedCampaignState } from "./campaign-state.js";

const REPLAY_TARGET_CAPABILITY: unique symbol = Symbol("replay-campaign-target");

/** Opaque authority for one exact replay item without campaign-wide collision proof state. */
export interface ReplayCampaignTarget {
  readonly [REPLAY_TARGET_CAPABILITY]: true;
}

/** Private closed replay state retained by one target-only capability. */
export interface ReplayCampaignTargetState {
  readonly campaign: PreparedCampaignState;
  readonly item: CampaignPlanItem;
  readonly identity: CaseIdentity;
}

const REPLAY_TARGETS = new WeakMap<object, ReplayCampaignTargetState>();

/**
 * Creates a target-only replay capability after campaign and identity validation.
 *
 * @param state Closed campaign state.
 * @param item Exact carried ordinal plan item.
 * @param identity Independently derived carried identity.
 * @returns Opaque target-only capability.
 */
export function createReplayCampaignTargetCapability(
  state: PreparedCampaignState,
  item: CampaignPlanItem,
  identity: CaseIdentity,
): ReplayCampaignTarget {
  const capability: ReplayCampaignTarget = Object.freeze({
    [REPLAY_TARGET_CAPABILITY]: true as const,
  });
  REPLAY_TARGETS.set(capability, Object.freeze({ campaign: state, item, identity }));
  return capability;
}

/** Resolves private state only for a factory-produced replay target. */
export function getReplayCampaignTargetState(
  target: ReplayCampaignTarget,
): ReplayCampaignTargetState | undefined {
  if (typeof target !== "object" || target === null) return undefined;
  return REPLAY_TARGETS.get(target);
}
