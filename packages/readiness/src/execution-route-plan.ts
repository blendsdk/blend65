import type {
  ExecutionPolicyV1,
  ExecutionRoutePlanItemV1,
  ExecutionRoutePlanV1,
} from "./execution-contracts.js";
import { compareExecutionText } from "./execution-validation.js";

const TEXT_ENCODER = new TextEncoder();

/** Route plan fields covered by the content digest. */
export type ExecutionRoutePlanPreimageV1 = Omit<ExecutionRoutePlanV1, "digest">;

/** Orders plan items exactly as the canonical wire format requires. */
function comparePlanItems(left: ExecutionRoutePlanItemV1, right: ExecutionRoutePlanItemV1): number {
  return (
    compareExecutionText(left.ruleId, right.ruleId) ||
    compareExecutionText(left.obligation, right.obligation) ||
    compareExecutionText(left.caseIdentity, right.caseIdentity) ||
    compareExecutionText(left.rankDigest, right.rankDigest)
  );
}

/** Projects policy fields in their fixed wire order. */
function canonicalPolicy(policy: ExecutionPolicyV1): unknown {
  return {
    revision: policy.revision,
    budget: {
      operationMs: policy.budget.operationMs,
      launchAttemptMs: policy.budget.launchAttemptMs,
      routeMs: policy.budget.routeMs,
      cleanupGraceMs: policy.budget.cleanupGraceMs,
      outputBytes: policy.budget.outputBytes,
      evidenceBytes: policy.budget.evidenceBytes,
      instructions: policy.budget.instructions,
      cycles: policy.budget.cycles,
      launchAttempts: policy.budget.launchAttempts,
    },
  };
}

/** Projects one selected route in its fixed wire order. */
function canonicalItem(item: ExecutionRoutePlanItemV1): unknown {
  return {
    caseIdentity: item.caseIdentity,
    ruleId: item.ruleId,
    obligation: item.obligation,
    terminalTier: item.terminalTier,
    prerequisiteTiers: [...item.prerequisiteTiers],
    rankDigest: item.rankDigest,
  };
}

/** Builds the shared canonical object used by preimage and complete-plan serialization. */
function canonicalPlan(
  plan: ExecutionRoutePlanPreimageV1,
  digest?: string,
): Readonly<Record<string, unknown>> {
  const items = [...plan.items].sort(comparePlanItems);
  return {
    revision: plan.revision,
    parentDigest: plan.parentDigest,
    executionDigest: plan.executionDigest,
    campaignDigest: plan.campaignDigest,
    oracleDigest: plan.oracleDigest,
    policy: canonicalPolicy(plan.policy),
    items: items.map(canonicalItem),
    ...(digest === undefined ? {} : { digest }),
  };
}

/**
 * Serializes exactly the canonical route-plan bytes covered by the plan digest.
 *
 * @param plan Complete route fields except the digest itself.
 * @returns Fresh canonical UTF-8 bytes in the same field and item order as the complete plan.
 */
export function serializeExecutionRoutePlanPreimageV1(
  plan: ExecutionRoutePlanPreimageV1,
): Uint8Array {
  return TEXT_ENCODER.encode(JSON.stringify(canonicalPlan(plan)));
}

/**
 * Serializes a route plan into canonical UTF-8 JSON bytes.
 *
 * Map-like collections and plan items are emitted in locale-independent lexical order, so callers
 * receive identical bytes even if a structurally valid plan was assembled in another order.
 *
 * @param plan Complete version-one route plan.
 * @returns Fresh canonical bytes including the plan's content digest.
 *
 * @example
 * ```ts
 * const bytes = serializeExecutionRoutePlanV1(plan);
 * ```
 */
export function serializeExecutionRoutePlanV1(plan: ExecutionRoutePlanV1): Uint8Array {
  return TEXT_ENCODER.encode(JSON.stringify(canonicalPlan(plan, plan.digest)));
}
