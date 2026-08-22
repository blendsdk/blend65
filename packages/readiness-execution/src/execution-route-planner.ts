import { createHash } from "node:crypto";

import {
  EXECUTION_TIERS_V1,
  isExecutionDigestV1,
  isExecutionTierV1,
  parseExecutionPolicyV1,
  serializeExecutionRoutePlanPreimageV1,
  type CompositeReadinessProjectionV1,
  type ExecutionCampaignProjectionV1,
  type ExecutionCapabilityProjectionV1,
  type ExecutionIssueV1,
  type ExecutionOperationIssueCodeV1,
  type ExecutionOperationResultV1,
  type ExecutionPlanningCaseV1,
  type ExecutionPolicyV1,
  type ExecutionRoutePlanPreimageV1,
  type ExecutionRoutePlanV1,
  type ExecutionRuleProjectionV1,
  type ExecutionTierV1,
} from "@blend65/readiness";

import { getExecutionPrerequisiteTiersV1 } from "./execution-route-tiers.js";
import { selectExecutionRoutesV1 } from "./execution-selector.js";

/** Exact passive inputs required to plan execution routes. */
export interface PlanExecutionRoutesInputV1 {
  /** Closed parent readiness projection. */
  readonly parent: CompositeReadinessProjectionV1;
  /** Closed prepared-campaign projection. */
  readonly campaign: ExecutionCampaignProjectionV1;
  /** Selected oracle publication digest. */
  readonly oracleDigest: string;
  /** Bounded policy included in plan identity. */
  readonly policy: ExecutionPolicyV1;
}

const INPUT_KEYS = ["parent", "campaign", "oracleDigest", "policy"] as const;
const PARENT_KEYS = ["parentDigest", "executionDigest", "capabilities", "rules"] as const;
const CAMPAIGN_KEYS = ["revision", "campaignDigest", "cases"] as const;
const CAPABILITY_BOUND_KEYS = ["capabilityId", "state"] as const;
const CAPABILITY_UNBOUND_KEYS = ["capabilityId", "state", "blocker"] as const;
const RULE_KEYS = ["ruleId", "applicability", "evidenceObligations", "boundaryFamilyIds"] as const;
const CASE_KEYS = [
  "caseIdentity",
  "ruleId",
  "validity",
  "spellingTuple",
  "boundaryFamilyId",
] as const;
const MAX_RULES = 4_096;
const MAX_CASES = 100_000;
const MAX_BOUNDARIES = 256;
const MAX_SPELLINGS = 32;
const TEXT_ENCODER = new TextEncoder();
const TIER_INDEX: ReadonlyMap<ExecutionTierV1, number> = new Map(
  EXECUTION_TIERS_V1.map((tier, index) => [tier, index]),
);

/** Canonical tier values paired with their positions in the untrusted input array. */
interface NormalizedTierSet {
  /** Cost-ordered unique tier values. */
  readonly values: readonly ExecutionTierV1[];
  /** Original array index for each retained tier. */
  readonly sourceIndices: ReadonlyMap<ExecutionTierV1, number>;
}

/** One canonical rule paired with original obligation positions. */
interface NormalizedRule {
  /** Closed canonical rule projection. */
  readonly projection: ExecutionRuleProjectionV1;
  /** Original evidence-obligation index for each tier. */
  readonly obligationSourceIndices: ReadonlyMap<ExecutionTierV1, number>;
}

/** Canonical parent facts paired with source locations needed by validation issues. */
interface NormalizedParent {
  /** Closed canonical parent projection. */
  readonly projection: CompositeReadinessProjectionV1;
  /** Original capability-row index for each capability. */
  readonly capabilitySourceIndices: ReadonlyMap<ExecutionTierV1, number>;
  /** Original rule-row index for each modeled rule. */
  readonly ruleSourceIndices: ReadonlyMap<string, number>;
  /** Original obligation positions grouped by modeled rule. */
  readonly obligationSourceIndicesByRule: ReadonlyMap<string, ReadonlyMap<ExecutionTierV1, number>>;
}

/** Performs a locale-independent UTF-16 ordinal comparison. */
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Compares closed tiers by increasing execution cost. */
function compareTier(left: ExecutionTierV1, right: ExecutionTierV1): number {
  return (
    (TIER_INDEX.get(left) ?? Number.MAX_SAFE_INTEGER) -
    (TIER_INDEX.get(right) ?? Number.MAX_SAFE_INTEGER)
  );
}

/** Reads only exact own enumerable data fields from an ordinary object. */
function readRecord(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
  try {
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
    ) {
      return undefined;
    }
    const output: Record<string, unknown> = {};
    for (const key of expectedKeys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      output[key] = descriptor.value;
    }
    return output;
  } catch {
    return undefined;
  }
}

/** Copies a bounded plain dense array without invoking a caller iterator. */
function readArray(input: unknown, maximumLength: number): readonly unknown[] | undefined {
  if (!Array.isArray(input)) return undefined;
  try {
    if (Object.getPrototypeOf(input) !== Array.prototype) return undefined;
    const length = Reflect.getOwnPropertyDescriptor(input, "length");
    if (
      length === undefined ||
      !("value" in length) ||
      !Number.isSafeInteger(length.value) ||
      length.value < 0 ||
      length.value > maximumLength ||
      Reflect.ownKeys(input).length !== length.value + 1
    ) {
      return undefined;
    }
    const output: unknown[] = [];
    for (let index = 0; index < length.value; index += 1) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      output.push(descriptor.value);
    }
    return output;
  } catch {
    return undefined;
  }
}

/** Recognizes one bounded execution identifier. */
function isIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    TEXT_ENCODER.encode(value).byteLength <= 512 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/** Recognizes the closed C64 applicability vocabulary. */
function isApplicability(value: unknown): value is ExecutionRuleProjectionV1["applicability"] {
  return (
    value === "mandatory-c64" ||
    value === "not-applicable-c64" ||
    value === "out-of-claim-target" ||
    value === "blocked-errata"
  );
}

/** Creates one immutable non-empty operation failure. */
function failure<T>(
  code: ExecutionOperationIssueCodeV1,
  path: string,
  message: string,
): ExecutionOperationResultV1<T> {
  const issues: readonly [ExecutionIssueV1] = [Object.freeze({ code, path, message })];
  return Object.freeze({ ok: false, issues: Object.freeze(issues) });
}

/** Creates one immutable successful operation result. */
function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

/** Validates, deduplicates, and lexically orders one identifier set in linear time. */
function normalizeStringSet(input: unknown, maximumLength: number): readonly string[] | undefined {
  const array = readArray(input, maximumLength);
  if (array === undefined) return undefined;
  const output: string[] = [];
  const retained = new Set<string>();
  for (const value of array) {
    if (!isIdentifier(value) || retained.has(value)) return undefined;
    retained.add(value);
    output.push(value);
  }
  output.sort(compareText);
  return Object.freeze(output);
}

/** Validates an ordered spelling tuple while preserving meaningful repeated elements. */
function normalizeStringTuple(
  input: unknown,
  maximumLength: number,
): readonly string[] | undefined {
  const array = readArray(input, maximumLength);
  if (array === undefined) return undefined;
  const output: string[] = [];
  for (const value of array) {
    if (!isIdentifier(value)) return undefined;
    output.push(value);
  }
  return Object.freeze(output);
}

/** Validates and cost-orders a tier set while retaining each original array position. */
function normalizeTierSet(input: unknown): NormalizedTierSet | undefined {
  const array = readArray(input, EXECUTION_TIERS_V1.length);
  if (array === undefined || array.length === 0) return undefined;
  const output: ExecutionTierV1[] = [];
  const retained = new Set<ExecutionTierV1>();
  const sourceIndices = new Map<ExecutionTierV1, number>();
  for (let index = 0; index < array.length; index += 1) {
    const value = array[index];
    if (!isExecutionTierV1(value) || retained.has(value)) return undefined;
    retained.add(value);
    output.push(value);
    sourceIndices.set(value, index);
  }
  output.sort(compareTier);
  return Object.freeze({
    values: Object.freeze(output),
    sourceIndices,
  });
}

/** Parses one discriminator-specific bound or unbound capability projection. */
function normalizeCapability(
  input: unknown,
  index: number,
): ExecutionOperationResultV1<ExecutionCapabilityProjectionV1> {
  const bound = readRecord(input, CAPABILITY_BOUND_KEYS);
  if (bound !== undefined && isExecutionTierV1(bound.capabilityId) && bound.state === "bound") {
    return success(Object.freeze({ capabilityId: bound.capabilityId, state: "bound" as const }));
  }
  const unbound = readRecord(input, CAPABILITY_UNBOUND_KEYS);
  if (
    unbound !== undefined &&
    isExecutionTierV1(unbound.capabilityId) &&
    unbound.state === "unbound" &&
    unbound.blocker === "unbound-evidence-capability"
  ) {
    return success(
      Object.freeze({
        capabilityId: unbound.capabilityId,
        state: "unbound" as const,
        blocker: "unbound-evidence-capability" as const,
      }),
    );
  }
  return failure(
    "invalid-evidence-input",
    `/parent/capabilities/${index}`,
    "Execution capability projection is not closed for its state discriminator.",
  );
}

/** Parses one exact modeled rule declaration. */
function normalizeRule(input: unknown, index: number): ExecutionOperationResultV1<NormalizedRule> {
  const record = readRecord(input, RULE_KEYS);
  if (
    record === undefined ||
    !isIdentifier(record.ruleId) ||
    !isApplicability(record.applicability)
  ) {
    return failure(
      "invalid-evidence-input",
      `/parent/rules/${index}`,
      "Execution rule projection is not closed.",
    );
  }
  const obligations = normalizeTierSet(record.evidenceObligations);
  const boundaries = normalizeStringSet(record.boundaryFamilyIds, MAX_BOUNDARIES);
  if (obligations === undefined || boundaries === undefined || boundaries.length === 0) {
    return failure(
      "invalid-evidence-input",
      `/parent/rules/${index}`,
      "Execution rule obligations and boundary families must be non-empty unique closed sets.",
    );
  }
  return success(
    Object.freeze({
      projection: Object.freeze({
        ruleId: record.ruleId,
        applicability: record.applicability,
        evidenceObligations: obligations.values,
        boundaryFamilyIds: boundaries,
      }),
      obligationSourceIndices: obligations.sourceIndices,
    }),
  );
}

/** Parses and canonicalizes the complete parent projection. */
function normalizeParent(input: unknown): ExecutionOperationResultV1<NormalizedParent> {
  const parent = readRecord(input, PARENT_KEYS);
  if (
    parent === undefined ||
    !isExecutionDigestV1(parent.parentDigest) ||
    !isExecutionDigestV1(parent.executionDigest)
  ) {
    return failure(
      "invalid-evidence-input",
      "/parent",
      "Composite readiness projection is not closed.",
    );
  }
  const capabilityInputs = readArray(parent.capabilities, EXECUTION_TIERS_V1.length);
  const ruleInputs = readArray(parent.rules, MAX_RULES);
  if (
    capabilityInputs === undefined ||
    capabilityInputs.length !== EXECUTION_TIERS_V1.length ||
    ruleInputs === undefined
  ) {
    return failure(
      "invalid-evidence-input",
      "/parent",
      "Composite projection requires the exact six capabilities and a bounded rule list.",
    );
  }
  const capabilities: ExecutionCapabilityProjectionV1[] = [];
  const capabilityIds = new Set<ExecutionTierV1>();
  const capabilitySourceIndices = new Map<ExecutionTierV1, number>();
  for (let index = 0; index < capabilityInputs.length; index += 1) {
    const parsed = normalizeCapability(capabilityInputs[index], index);
    if (!parsed.ok) return parsed;
    if (capabilityIds.has(parsed.value.capabilityId)) {
      return failure(
        "invalid-evidence-input",
        `/parent/capabilities/${index}/capabilityId`,
        "Execution capability identifiers must be unique.",
      );
    }
    capabilityIds.add(parsed.value.capabilityId);
    capabilitySourceIndices.set(parsed.value.capabilityId, index);
    capabilities.push(parsed.value);
  }
  capabilities.sort((left, right) => compareTier(left.capabilityId, right.capabilityId));
  if (capabilities.some((entry, index) => entry.capabilityId !== EXECUTION_TIERS_V1[index])) {
    return failure(
      "invalid-evidence-input",
      "/parent/capabilities",
      "Composite projection must contain each closed capability exactly once.",
    );
  }
  const rules: ExecutionRuleProjectionV1[] = [];
  const ruleIds = new Set<string>();
  const ruleSourceIndices = new Map<string, number>();
  const obligationSourceIndicesByRule = new Map<string, ReadonlyMap<ExecutionTierV1, number>>();
  for (let index = 0; index < ruleInputs.length; index += 1) {
    const parsed = normalizeRule(ruleInputs[index], index);
    if (!parsed.ok) return parsed;
    if (ruleIds.has(parsed.value.projection.ruleId)) {
      return failure(
        "invalid-evidence-input",
        `/parent/rules/${index}/ruleId`,
        "Execution rule identifiers must be unique.",
      );
    }
    ruleIds.add(parsed.value.projection.ruleId);
    ruleSourceIndices.set(parsed.value.projection.ruleId, index);
    obligationSourceIndicesByRule.set(
      parsed.value.projection.ruleId,
      parsed.value.obligationSourceIndices,
    );
    rules.push(parsed.value.projection);
  }
  rules.sort((left, right) => compareText(left.ruleId, right.ruleId));
  return success(
    Object.freeze({
      projection: Object.freeze({
        parentDigest: parent.parentDigest,
        executionDigest: parent.executionDigest,
        capabilities: Object.freeze(capabilities),
        rules: Object.freeze(rules),
      }),
      capabilitySourceIndices,
      ruleSourceIndices,
      obligationSourceIndicesByRule,
    }),
  );
}

/** Parses one exact passive planning case. */
function normalizePlanningCase(
  input: unknown,
  index: number,
): ExecutionOperationResultV1<ExecutionPlanningCaseV1> {
  const record = readRecord(input, CASE_KEYS);
  const spellings =
    record === undefined ? undefined : normalizeStringTuple(record.spellingTuple, MAX_SPELLINGS);
  if (
    record === undefined ||
    !isExecutionDigestV1(record.caseIdentity) ||
    !isIdentifier(record.ruleId) ||
    (record.validity !== "valid" && record.validity !== "invalid") ||
    spellings === undefined ||
    spellings.length === 0 ||
    !isIdentifier(record.boundaryFamilyId)
  ) {
    return failure(
      "invalid-evidence-input",
      `/campaign/cases/${index}`,
      "Execution planning case is not closed.",
    );
  }
  return success(
    Object.freeze({
      caseIdentity: record.caseIdentity,
      ruleId: record.ruleId,
      validity: record.validity,
      spellingTuple: spellings,
      boundaryFamilyId: record.boundaryFamilyId,
    }),
  );
}

/** Parses, cross-checks, and canonicalizes the complete campaign population. */
function normalizeCampaign(
  input: unknown,
  parent: CompositeReadinessProjectionV1,
): ExecutionOperationResultV1<ExecutionCampaignProjectionV1> {
  const campaign = readRecord(input, CAMPAIGN_KEYS);
  if (
    campaign === undefined ||
    campaign.revision !== "execution-campaign-projection-v1" ||
    !isExecutionDigestV1(campaign.campaignDigest)
  ) {
    return failure(
      "invalid-evidence-input",
      "/campaign",
      "Execution campaign projection is not closed.",
    );
  }
  const caseInputs = readArray(campaign.cases, MAX_CASES);
  if (caseInputs === undefined) {
    return failure(
      "invalid-evidence-input",
      "/campaign/cases",
      "Execution campaign cases must be a bounded dense array.",
    );
  }
  const byRule = new Map(parent.rules.map((rule) => [rule.ruleId, rule]));
  const boundaryIdsByRule = new Map(
    parent.rules.map((rule) => [rule.ruleId, new Set(rule.boundaryFamilyIds)]),
  );
  const cases: ExecutionPlanningCaseV1[] = [];
  const caseIdentities = new Set<string>();
  for (let index = 0; index < caseInputs.length; index += 1) {
    const parsed = normalizePlanningCase(caseInputs[index], index);
    if (!parsed.ok) return parsed;
    if (caseIdentities.has(parsed.value.caseIdentity)) {
      return failure(
        "invalid-evidence-input",
        `/campaign/cases/${index}/caseIdentity`,
        "Execution case identities must be unique.",
      );
    }
    const rule = byRule.get(parsed.value.ruleId);
    const boundaries = boundaryIdsByRule.get(parsed.value.ruleId);
    if (
      rule === undefined ||
      boundaries === undefined ||
      !boundaries.has(parsed.value.boundaryFamilyId)
    ) {
      return failure(
        "invalid-evidence-input",
        `/campaign/cases/${index}/ruleId`,
        "Every campaign case must match one declared rule and boundary family.",
      );
    }
    caseIdentities.add(parsed.value.caseIdentity);
    cases.push(parsed.value);
  }
  cases.sort((left, right) => compareText(left.caseIdentity, right.caseIdentity));
  return success(
    Object.freeze({
      revision: "execution-campaign-projection-v1" as const,
      campaignDigest: campaign.campaignDigest,
      cases: Object.freeze(cases),
    }),
  );
}

/** Requires every selected terminal tier and its route prerequisites to be currently bound. */
function requiredCapabilitiesAreBound(
  parent: NormalizedParent,
  campaign: ExecutionCampaignProjectionV1,
): ExecutionOperationResultV1<true> {
  const campaignRuleIds = new Set(campaign.cases.map((entry) => entry.ruleId));
  const capabilityState = new Map(
    parent.projection.capabilities.map((entry) => [entry.capabilityId, entry]),
  );
  for (const rule of parent.projection.rules) {
    if (!campaignRuleIds.has(rule.ruleId)) continue;
    for (const obligation of rule.evidenceObligations) {
      const routeTiers = [...getExecutionPrerequisiteTiersV1(obligation), obligation];
      for (const routeTier of routeTiers) {
        const capability = capabilityState.get(routeTier);
        if (capability?.state !== "bound") {
          const index = parent.capabilitySourceIndices.get(routeTier) ?? 0;
          return failure(
            "unbound-capability",
            `/parent/capabilities/${index}/state`,
            `Execution capability ${routeTier} is not bound for selected ${obligation} route on rule ${rule.ruleId}.`,
          );
        }
      }
    }
  }
  return success(true);
}

/** Prefixes nested policy issues so their RFC 6901 paths address the planner input. */
function prefixIssues<T>(
  result: Extract<ExecutionOperationResultV1<T>, { readonly ok: false }>,
  prefix: string,
): ExecutionOperationResultV1<T> {
  const [first, ...rest] = result.issues;
  const prefixedFirst = Object.freeze({
    ...first,
    path: `${prefix}${first.path}`,
  });
  const prefixedRest = rest.map((entry) =>
    Object.freeze({ ...entry, path: `${prefix}${entry.path}` }),
  );
  const issues: readonly [ExecutionIssueV1, ...ExecutionIssueV1[]] = [
    prefixedFirst,
    ...prefixedRest,
  ];
  return Object.freeze({
    ok: false,
    issues: Object.freeze(issues),
  });
}

/** Hashes the exact canonical route-plan bytes that omit only the digest field itself. */
function planDigest(preimage: ExecutionRoutePlanPreimageV1): string {
  const bytes = serializeExecutionRoutePlanPreimageV1(preimage);
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

/**
 * Validates passive projections and builds a complete deterministic route plan.
 *
 * Planning is pure and finishes capacity accounting before returning any plan. No compiler,
 * filesystem, process, emulator, adapter callback, or previous outcome is accepted as input.
 *
 * @param input Untrusted passive planner input.
 * @returns A frozen canonical plan or deterministic validation/capacity issues.
 *
 * @example
 * ```ts
 * const planned = planExecutionRoutesV1({ parent, campaign, oracleDigest, policy });
 * ```
 */
export function planExecutionRoutesV1(
  input: unknown,
): ExecutionOperationResultV1<ExecutionRoutePlanV1> {
  const record = readRecord(input, INPUT_KEYS);
  if (record === undefined || !isExecutionDigestV1(record.oracleDigest)) {
    return failure(
      "invalid-evidence-input",
      "",
      "Route planning input must contain only closed passive projections, oracle digest, and policy.",
    );
  }
  const parent = normalizeParent(record.parent);
  if (!parent.ok) return parent;
  const campaign = normalizeCampaign(record.campaign, parent.value.projection);
  if (!campaign.ok) return campaign;
  const policy = parseExecutionPolicyV1(record.policy);
  if (!policy.ok) return prefixIssues(policy, "/policy");
  const bound = requiredCapabilitiesAreBound(parent.value, campaign.value);
  if (!bound.ok) return bound;
  const selected = selectExecutionRoutesV1({
    parentDigest: parent.value.projection.parentDigest,
    campaignDigest: campaign.value.campaignDigest,
    rules: parent.value.projection.rules,
    cases: campaign.value.cases,
    ruleSourceIndices: parent.value.ruleSourceIndices,
    obligationSourceIndicesByRule: parent.value.obligationSourceIndicesByRule,
  });
  if (!selected.ok) return selected;
  const preimage: ExecutionRoutePlanPreimageV1 = Object.freeze({
    revision: "execution-route-plan-v1",
    parentDigest: parent.value.projection.parentDigest,
    campaignDigest: campaign.value.campaignDigest,
    oracleDigest: record.oracleDigest,
    policy: policy.value,
    items: selected.value,
  });
  return success(
    Object.freeze({
      ...preimage,
      digest: planDigest(preimage),
    }),
  );
}
