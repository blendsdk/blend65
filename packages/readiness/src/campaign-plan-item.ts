import {
  createDeterministicChoiceContext,
  drawBoundedIntegerFromContext,
  type DeterministicChoiceContext,
} from "./deterministic-choice.js";
import type {
  CampaignDiagnostic,
  CampaignPlanItem,
  CampaignResult,
  PreparedCampaign,
} from "./campaign-model.js";
import { getPreparedCampaignState, type PreparedCampaignState } from "./campaign-state.js";
import type { ModeledCaseChoice, ModeledCaseRequest } from "./modeled-generator-model.js";

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);

function failure<T>(
  code: CampaignDiagnostic["code"],
  path: string,
  message: string,
): CampaignResult<T> {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([Object.freeze({ code, path, message })]),
  });
}

function success<T>(value: T): CampaignResult<T> {
  return Object.freeze({ ok: true, value, diagnostics: EMPTY_DIAGNOSTICS });
}

function pathForOrdinal(
  ordinal: number,
  coverageCount: number,
  randomValidCount: number,
): readonly [0 | 1 | 2, number] {
  if (ordinal < coverageCount) return Object.freeze([0, ordinal]);
  if (ordinal < coverageCount + randomValidCount) {
    return Object.freeze([1, ordinal - coverageCount]);
  }
  return Object.freeze([2, ordinal - coverageCount - randomValidCount]);
}

function boundedIndexFromContext(
  context: DeterministicChoiceContext,
  drawOrdinal: bigint,
  upperExclusive: number,
): number | undefined {
  const drawn = drawBoundedIntegerFromContext(context, drawOrdinal, BigInt(upperExclusive));
  return drawn.ok ? Number(drawn.value) : undefined;
}

function request(
  state: PreparedCampaignState,
  choice: ModeledCaseChoice,
  ordinal: number,
  validity: ModeledCaseRequest["validity"],
): ModeledCaseRequest {
  return Object.freeze({
    handlerId: state.dependencies.generator.handlerId,
    modulePath: Object.freeze([`CampaignCase${ordinal}`]),
    choice,
    validity: Object.freeze(validity),
    budget: state.configuration.budget,
  });
}

function randomValidChoice(
  state: PreparedCampaignState,
  laneOrdinal: number,
): ModeledCaseChoice | undefined {
  const path = [1, laneOrdinal] as const;
  const context = createDeterministicChoiceContext({
    seed: state.campaign.seed,
    generationPath: path,
  });
  if (!context.ok) return undefined;
  const domainIndex = boundedIndexFromContext(context.value, 0n, state.domains.length);
  if (domainIndex === undefined) return undefined;
  const domain = state.domains[domainIndex];
  if (domain === undefined) return undefined;
  const choiceIndex = boundedIndexFromContext(context.value, 1n, domain.choices.length);
  return choiceIndex === undefined ? undefined : domain.choices[choiceIndex];
}

function invalidSelection(
  state: PreparedCampaignState,
  laneOrdinal: number,
): { readonly choice: ModeledCaseChoice; readonly neighborId: string } | undefined {
  const domain = state.domains[laneOrdinal % state.domains.length];
  if (domain === undefined || domain.neighborIds.length === 0) return undefined;
  const spellingIndex = laneOrdinal % state.configuration.spellings.length;
  const domainIndex = laneOrdinal % state.domains.length;
  const candidates = state.invalidChoicesByDomain[domainIndex]?.[spellingIndex];
  if (candidates === undefined) return undefined;
  if (candidates.length === 0) return undefined;
  const path = [2, laneOrdinal] as const;
  const context = createDeterministicChoiceContext({
    seed: state.campaign.seed,
    generationPath: path,
  });
  if (!context.ok) return undefined;
  const choiceIndex = boundedIndexFromContext(context.value, 0n, candidates.length);
  const neighborIndex = boundedIndexFromContext(context.value, 1n, domain.neighborIds.length);
  if (choiceIndex === undefined || neighborIndex === undefined) return undefined;
  const choice = candidates[choiceIndex];
  const neighborId = domain.neighborIds[neighborIndex];
  return choice === undefined || neighborId === undefined ? undefined : { choice, neighborId };
}

/**
 * Derives one immutable plan item by ordinal without advancing campaign state.
 *
 * @param campaign Factory-produced prepared campaign.
 * @param ordinal Zero-based campaign ordinal.
 * @returns Stable request metadata or deterministic diagnostics.
 *
 * @example
 * ```ts
 * const item = getCampaignPlanItem(campaign, 0);
 * ```
 */
export function getCampaignPlanItem(
  campaign: PreparedCampaign,
  ordinal: number,
): CampaignResult<CampaignPlanItem> {
  const state = getPreparedCampaignState(campaign);
  if (state === undefined) {
    return failure("campaign.input.invalid", "/campaign", "Prepared campaign is invalid.");
  }
  return deriveCampaignPlanItem(state, ordinal);
}

/**
 * Derives one plan item from already-validated private campaign state.
 *
 * @param state Closed campaign state retained behind a factory capability.
 * @param ordinal Zero-based campaign ordinal.
 * @returns Stable request metadata or deterministic diagnostics.
 */
export function deriveCampaignPlanItem(
  state: PreparedCampaignState,
  ordinal: number,
): CampaignResult<CampaignPlanItem> {
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal >= state.configuration.caseCount) {
    return failure("campaign.input.invalid", "/ordinal", "Campaign ordinal is outside the plan.");
  }
  const generationPath = pathForOrdinal(ordinal, state.coverageCount, state.randomValidCount);
  let itemRequest: ModeledCaseRequest | undefined;
  let lane: CampaignPlanItem["lane"];
  if (generationPath[0] === 0) {
    lane = "coverage-valid";
    const choice = state.coverageChoices[generationPath[1]];
    if (choice !== undefined) itemRequest = request(state, choice, ordinal, { kind: "valid" });
  } else if (generationPath[0] === 1) {
    lane = "random-valid";
    const choice = randomValidChoice(state, generationPath[1]);
    if (choice !== undefined) itemRequest = request(state, choice, ordinal, { kind: "valid" });
  } else {
    lane = "invalid";
    const selection = invalidSelection(state, generationPath[1]);
    if (selection !== undefined) {
      itemRequest = request(state, selection.choice, ordinal, {
        kind: "invalid",
        neighborId: selection.neighborId,
      });
    }
  }
  if (itemRequest === undefined) {
    return failure(
      "campaign.choice.invalid",
      "/ordinal",
      "Deterministic plan choice could not be derived.",
    );
  }
  return success(
    Object.freeze({
      ordinal,
      generationPath,
      lane,
      request: itemRequest,
      renderOptions: state.renderOptions,
    }),
  );
}
