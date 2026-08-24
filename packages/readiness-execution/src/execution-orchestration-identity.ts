import { createHash } from "node:crypto";

import type { ExecutionTierV1 } from "@blend65/readiness";

import type { ExecutionRouteToolV1 } from "./execution-orchestration.js";

const ENCODER = new TextEncoder();

/** Closed fields that bind one report record to its complete selected route plan. */
export interface CampaignRouteExecutionIdentityInputV1 {
  /** Digest of the complete canonical route plan. */
  readonly routePlanDigest: string;
  /** Exact prepared-campaign case identity. */
  readonly caseIdentity: string;
  /** Reviewed rule exercised by the route. */
  readonly ruleId: string;
  /** Selected evidence obligation. */
  readonly obligation: string;
  /** Last tier owned by the route. */
  readonly terminalTier: ExecutionTierV1;
  /** Canonically ordered external prerequisites. */
  readonly requiredTools: readonly ExecutionRouteToolV1[];
}

/** Derives the distinct dispatch identity for one route in one exact plan. */
export function deriveCampaignRouteExecutionIdentityV1(
  input: CampaignRouteExecutionIdentityInputV1,
): string {
  return `sha256:${createHash("sha256")
    .update(
      ENCODER.encode(
        JSON.stringify({
          domain: "blend65-campaign-route-execution-v1",
          routePlanDigest: input.routePlanDigest,
          caseIdentity: input.caseIdentity,
          ruleId: input.ruleId,
          obligation: input.obligation,
          terminalTier: input.terminalTier,
          requiredTools: input.requiredTools,
        }),
      ),
    )
    .digest("hex")}`;
}
