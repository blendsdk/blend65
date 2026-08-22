import { createHash } from "node:crypto";

import type {
  ExecutionIssueV1,
  ExecutionOperationResultV1,
  ExecutionPlanningCaseV1,
  ExecutionRoutePlanItemV1,
  ExecutionRuleProjectionV1,
  ExecutionTierV1,
} from "@blend65/readiness";

import {
  compareExecutionTierV1,
  getExecutionPrerequisiteTiersV1,
} from "./execution-route-tiers.js";

/** Pure, already-validated input consumed by the deterministic selector. */
export interface ExecutionSelectorInputV1 {
  /** Exact selected parent digest. */
  readonly parentDigest: string;
  /** Exact prepared campaign digest. */
  readonly campaignDigest: string;
  /** Canonically ordered modeled rule declarations. */
  readonly rules: readonly ExecutionRuleProjectionV1[];
  /** Canonically ordered complete campaign population. */
  readonly cases: readonly ExecutionPlanningCaseV1[];
  /** Original parent-array position for each canonical modeled rule. */
  readonly ruleSourceIndices: ReadonlyMap<string, number>;
  /** Original obligation-array positions grouped by modeled rule. */
  readonly obligationSourceIndicesByRule: ReadonlyMap<string, ReadonlyMap<ExecutionTierV1, number>>;
}

/** One campaign case paired with its reusable canonical stratum key. */
interface IndexedCase {
  /** Original validated passive case projection. */
  readonly projection: ExecutionPlanningCaseV1;
  /** Canonical validity, spelling, and boundary tuple. */
  readonly stratum: string;
}

/** Current digest-ranked minimum for one stratum. */
interface RankedSelection {
  /** Case currently winning its stratum. */
  readonly indexedCase: IndexedCase;
  /** Domain-separated selector rank. */
  readonly rankDigest: string;
}

const SELECTOR_REVISION = "execution-selector-v1";
const EXPENSIVE_TIERS: ReadonlySet<ExecutionTierV1> = new Set(["acme", "vice"]);

/** Performs a locale-independent UTF-16 ordinal comparison. */
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Computes one canonical lowercase digest for selector ranking. */
function hashText(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

/** Ranks one case independently for one evidence obligation. */
function rankCase(
  input: ExecutionSelectorInputV1,
  caseProjection: ExecutionPlanningCaseV1,
  obligation: ExecutionTierV1,
): string {
  return hashText(
    JSON.stringify([
      SELECTOR_REVISION,
      input.parentDigest,
      input.campaignDigest,
      caseProjection.caseIdentity,
      obligation,
    ]),
  );
}

/** Encodes one validity, spelling, and boundary tuple without ambiguous separators. */
function stratum(caseProjection: ExecutionPlanningCaseV1): string {
  return JSON.stringify([
    caseProjection.validity,
    [...caseProjection.spellingTuple],
    caseProjection.boundaryFamilyId,
  ]);
}

/** Orders final items exactly as required by the canonical route-plan format. */
function itemOrder(left: ExecutionRoutePlanItemV1, right: ExecutionRoutePlanItemV1): number {
  return (
    compareText(left.ruleId, right.ruleId) ||
    compareExecutionTierV1(left.terminalTier, right.terminalTier) ||
    compareText(left.obligation, right.obligation) ||
    compareText(left.caseIdentity, right.caseIdentity) ||
    compareText(left.rankDigest, right.rankDigest)
  );
}

/** Creates one deterministic capacity issue without returning a partial plan. */
function failure(path: string, message: string): ExecutionOperationResultV1<never> {
  const issue: ExecutionIssueV1 = Object.freeze({
    code: "execution-plan-capacity",
    path,
    message,
  });
  const issues: readonly [ExecutionIssueV1] = [issue];
  return Object.freeze({ ok: false, issues: Object.freeze(issues) });
}

/** Resolves a canonical obligation back to its pointer in the original planner input. */
function obligationSourcePath(
  input: ExecutionSelectorInputV1,
  rule: ExecutionRuleProjectionV1,
  obligation: ExecutionTierV1,
  canonicalRuleIndex: number,
  canonicalObligationIndex: number,
): string {
  const ruleIndex = input.ruleSourceIndices.get(rule.ruleId) ?? canonicalRuleIndex;
  const obligationIndex =
    input.obligationSourceIndicesByRule.get(rule.ruleId)?.get(obligation) ??
    canonicalObligationIndex;
  return `/parent/rules/${ruleIndex}/evidenceObligations/${obligationIndex}`;
}

/** Indexes the complete campaign once and computes each case's reusable stratum once. */
function indexCasesByRule(
  cases: readonly ExecutionPlanningCaseV1[],
): ReadonlyMap<string, readonly IndexedCase[]> {
  const mutable = new Map<string, IndexedCase[]>();
  for (const caseProjection of cases) {
    const indexed = Object.freeze({ projection: caseProjection, stratum: stratum(caseProjection) });
    const retained = mutable.get(caseProjection.ruleId);
    if (retained === undefined) mutable.set(caseProjection.ruleId, [indexed]);
    else retained.push(indexed);
  }
  return mutable;
}

/** Counts non-empty strata and stops as soon as the expensive-obligation cap is exceeded. */
function countRequiredStrata(cases: readonly IndexedCase[]): number {
  const strata = new Set<string>();
  for (const indexedCase of cases) {
    strata.add(indexedCase.stratum);
    if (strata.size > 16) return strata.size;
  }
  return strata.size;
}

/**
 * Proves all expensive minima fit before any candidate digest or result item is materialized.
 *
 * The passive execution projection contains only modeled route declarations. Therefore a modeled
 * mandatory C64 rule that declares VICE but has no campaign candidate is an unsatisfied minimum,
 * not an unrepresented inventory rule.
 */
function preflightSelectionCapacityV1(
  input: ExecutionSelectorInputV1,
  casesByRule: ReadonlyMap<string, readonly IndexedCase[]>,
): ExecutionOperationResultV1<true> {
  let campaignExpensive = 0;
  for (let ruleIndex = 0; ruleIndex < input.rules.length; ruleIndex += 1) {
    const rule = input.rules[ruleIndex];
    if (rule === undefined) continue;
    const cases = casesByRule.get(rule.ruleId) ?? [];
    const viceIndex = rule.evidenceObligations.indexOf("vice");
    if (rule.applicability === "mandatory-c64" && viceIndex >= 0) {
      const path = obligationSourcePath(input, rule, "vice", ruleIndex, viceIndex);
      if (cases.length === 0) {
        return failure(path, `Mandatory runtime rule ${rule.ruleId} has no VICE candidate.`);
      }
      if (!cases.some((entry) => entry.projection.validity === "valid")) {
        return failure(path, `Mandatory runtime rule ${rule.ruleId} has no valid VICE candidate.`);
      }
    }
    for (
      let obligationIndex = 0;
      obligationIndex < rule.evidenceObligations.length;
      obligationIndex += 1
    ) {
      const obligation = rule.evidenceObligations[obligationIndex];
      if (obligation === undefined || !EXPENSIVE_TIERS.has(obligation)) continue;
      const required = obligationIndex === 0 ? cases.length : countRequiredStrata(cases);
      const path = obligationSourcePath(input, rule, obligation, ruleIndex, obligationIndex);
      if (required > 16) {
        return failure(
          path,
          `Required ${obligation} selections for ${rule.ruleId} exceed the inclusive cap of 16.`,
        );
      }
      campaignExpensive += required;
      if (campaignExpensive > 256) {
        return failure(
          path,
          "Required expensive selections exceed the inclusive campaign cap of 256.",
        );
      }
    }
  }
  return Object.freeze({ ok: true, value: true });
}

/** Appends one final immutable item directly, avoiding an intermediate candidate object. */
function appendPlanItem(
  items: ExecutionRoutePlanItemV1[],
  rule: ExecutionRuleProjectionV1,
  obligation: ExecutionTierV1,
  indexedCase: IndexedCase,
  rankDigest: string,
): void {
  items.push(
    Object.freeze({
      caseIdentity: indexedCase.projection.caseIdentity,
      ruleId: rule.ruleId,
      obligation,
      terminalTier: obligation,
      prerequisiteTiers: getExecutionPrerequisiteTiersV1(obligation),
      rankDigest,
    }),
  );
}

/** Streams one digest-ranked minimum per stratum without sorting all candidates. */
function appendStratumMinima(
  input: ExecutionSelectorInputV1,
  items: ExecutionRoutePlanItemV1[],
  rule: ExecutionRuleProjectionV1,
  obligation: ExecutionTierV1,
  cases: readonly IndexedCase[],
): void {
  const minima = new Map<string, RankedSelection>();
  for (const indexedCase of cases) {
    const rankDigest = rankCase(input, indexedCase.projection, obligation);
    const retained = minima.get(indexedCase.stratum);
    if (
      retained === undefined ||
      compareText(rankDigest, retained.rankDigest) < 0 ||
      (rankDigest === retained.rankDigest &&
        compareText(
          indexedCase.projection.caseIdentity,
          retained.indexedCase.projection.caseIdentity,
        ) < 0)
    ) {
      minima.set(indexedCase.stratum, { indexedCase, rankDigest });
    }
  }
  const orderedStrata = [...minima.keys()].sort(compareText);
  for (const stratumKey of orderedStrata) {
    const selected = minima.get(stratumKey);
    if (selected !== undefined) {
      appendPlanItem(items, rule, obligation, selected.indexedCase, selected.rankDigest);
    }
  }
}

/** Materializes only the already-proven selection minima and then applies canonical item order. */
function materializeExecutionRoutesV1(
  input: ExecutionSelectorInputV1,
  casesByRule: ReadonlyMap<string, readonly IndexedCase[]>,
): readonly ExecutionRoutePlanItemV1[] {
  const items: ExecutionRoutePlanItemV1[] = [];
  for (const rule of input.rules) {
    const cases = casesByRule.get(rule.ruleId) ?? [];
    const cheapest = rule.evidenceObligations[0];
    if (cheapest === undefined) continue;
    for (const indexedCase of cases) {
      appendPlanItem(
        items,
        rule,
        cheapest,
        indexedCase,
        rankCase(input, indexedCase.projection, cheapest),
      );
    }
    for (const obligation of rule.evidenceObligations.slice(1)) {
      appendStratumMinima(input, items, rule, obligation, cases);
    }
  }
  items.sort(itemOrder);
  return Object.freeze(items);
}

/**
 * Selects complete deterministic route obligations from already-validated passive inputs.
 *
 * Every case receives its cheapest declared obligation. Each additional obligation independently
 * receives one digest-ranked case from every non-empty validity, spelling, and boundary stratum.
 * Capacity is proven before ranking, so failure never allocates or returns a partial plan.
 *
 * @param input Closed parent and campaign projection facts.
 * @returns Canonically ordered selected items or a fail-closed capacity issue.
 */
export function selectExecutionRoutesV1(
  input: ExecutionSelectorInputV1,
): ExecutionOperationResultV1<readonly ExecutionRoutePlanItemV1[]> {
  const casesByRule = indexCasesByRule(input.cases);
  const capacity = preflightSelectionCapacityV1(input, casesByRule);
  if (!capacity.ok) return capacity;
  return Object.freeze({
    ok: true,
    value: materializeExecutionRoutesV1(input, casesByRule),
  });
}
