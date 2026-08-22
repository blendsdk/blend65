import { deriveCampaignPlanItem } from "./campaign-plan-item.js";
import { getPreparedCampaignState } from "./campaign-state.js";
import { deriveCaseIdentity } from "./case-identity.js";
import type { PreparedCampaign } from "./campaign-model.js";
import type {
  ExecutionCampaignProjectionV1,
  ExecutionIssueV1,
  ExecutionOperationResultV1,
  ExecutionPlanningCaseV1,
} from "./execution-contracts.js";
import { compareExecutionText } from "./execution-validation.js";
import { MODELED_RULE_FACTS, type ModeledRuleFact } from "./modeled-generator-facts.js";
import type { ModeledCaseChoice } from "./modeled-generator-model.js";

/** Creates one immutable projection failure with a source-addressing path. */
function projectionFailure(path: string, message: string): ExecutionOperationResultV1<never> {
  const issue: ExecutionIssueV1 = Object.freeze({
    code: "invalid-evidence-input",
    path,
    message,
  });
  const issues: readonly [ExecutionIssueV1] = [issue];
  return Object.freeze({ ok: false, issues: Object.freeze(issues) });
}

/** Projects only source-spelling dimensions from one modeled construction choice. */
function spellingTuple(choice: ModeledCaseChoice): readonly string[] {
  if (choice.kind === "scalar") return Object.freeze([choice.spelling]);
  return Object.freeze([
    choice.addressSpelling,
    ...(choice.valueSpelling === undefined ? [] : [choice.valueSpelling]),
  ]);
}

/** Resolves the reviewed boundary family carried by one modeled rule fact. */
function boundaryFamily(fact: ModeledRuleFact): string {
  return fact.kind === "scalar"
    ? `boundary.scalar.${fact.scalarType}`
    : `boundary.memory.${fact.intrinsic}`;
}

/**
 * Projects a genuine prepared campaign into passive route-selection facts.
 *
 * The projection is derived from module-private campaign state and cannot be produced from a
 * structural lookalike. It preserves source-case identity while excluding executable handlers,
 * generated source, and expected results.
 *
 * @param campaign Factory-produced immutable campaign capability.
 * @returns Canonically ordered serializable cases or one deterministic identity issue.
 *
 * @example
 * ```ts
 * const projected = projectExecutionCampaignV1(campaign);
 * ```
 */
export function projectExecutionCampaignV1(
  campaign: PreparedCampaign,
): ExecutionOperationResultV1<ExecutionCampaignProjectionV1> {
  const state = getPreparedCampaignState(campaign);
  if (state === undefined) {
    return projectionFailure("/campaign", "A genuine prepared campaign is required.");
  }
  const cases: ExecutionPlanningCaseV1[] = [];
  for (let ordinal = 0; ordinal < state.configuration.caseCount; ordinal += 1) {
    const item = deriveCampaignPlanItem(state, ordinal);
    if (!item.ok) {
      return projectionFailure(
        `/campaign/cases/${ordinal}`,
        "The prepared campaign no longer yields its complete deterministic case population.",
      );
    }
    const identity = deriveCaseIdentity(
      state.campaignDigest,
      item.value.generationPath,
      item.value.ordinal,
    );
    if (!identity.ok) {
      return projectionFailure(
        `/campaign/cases/${ordinal}/caseIdentity`,
        "The prepared campaign case identity could not be reproduced.",
      );
    }
    const fact = MODELED_RULE_FACTS.get(item.value.request.choice.ruleId);
    if (fact === undefined) {
      return projectionFailure(
        `/campaign/cases/${ordinal}/ruleId`,
        "The prepared campaign case does not name a reviewed modeled rule.",
      );
    }
    cases.push(
      Object.freeze({
        caseIdentity: identity.identity.digest,
        ruleId: fact.ruleId,
        validity: item.value.request.validity.kind,
        spellingTuple: spellingTuple(item.value.request.choice),
        boundaryFamilyId: boundaryFamily(fact),
      }),
    );
  }
  cases.sort((left, right) => compareExecutionText(left.caseIdentity, right.caseIdentity));
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      revision: "execution-campaign-projection-v1" as const,
      campaignDigest: state.campaignDigest,
      cases: Object.freeze(cases),
    }),
  });
}
