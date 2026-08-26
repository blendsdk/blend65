import { readExecutionRecord } from "./execution-validation.js";
import { parseFailureReductionPolicyV1 } from "./failure-contracts.js";

import type { ExecutionIssueV1, ExecutionOperationResultV1 } from "./execution-contracts.js";
import type { FailureReductionBudgetV1, FailureReductionPolicyV1 } from "./failure-contracts.js";

const FAILURE_CAMPAIGN_BUDGET_AUTHORITY_V1: unique symbol = Symbol(
  "failure-campaign-budget-authority-v1",
);

/** Opaque capability that owns the shared resource budget for one campaign. */
export interface FailureCampaignBudgetAuthorityV1 {
  /** Compile-time marker paired with module-private runtime state. */
  readonly [FAILURE_CAMPAIGN_BUDGET_AUTHORITY_V1]: true;
}

/** Authenticated report cardinalities used to reserve mandatory terminal evidence. */
export interface FailureCampaignBudgetReservationV1 {
  /** Total number of non-pass results that each require one terminal run. */
  readonly nonPassResults: number;
  /** Non-pass results that may additionally publish a historical envelope. */
  readonly resolvableNonPassResults: number;
}

/** Closed atomic charges accepted by the shared campaign budget. */
export type FailureCampaignBudgetChargeV1 =
  | { readonly kind: "transformation-attempt" }
  | {
      readonly kind: "route-execution";
      readonly purpose: "reduction" | "confirmation" | "control";
    }
  | { readonly kind: "oracle-evaluation" }
  | { readonly kind: "diagnostic-capture"; readonly bytes: number }
  | { readonly kind: "provenance-event-read" }
  | { readonly kind: "provenance-event-write" }
  | { readonly kind: "sequence-case" }
  | { readonly kind: "core-write"; readonly bytes: number }
  | { readonly kind: "terminal-envelope-write" }
  | { readonly kind: "terminal-run-write"; readonly bytes: number }
  | { readonly kind: "terminal-summary-write" };

/** Immutable accounting view returned after construction or one successful charge. */
export interface FailureCampaignBudgetSnapshotV1 {
  /** Closed snapshot schema revision. */
  readonly revision: "failure-campaign-budget-snapshot-v1";
  /** Resources already consumed by successful atomic charges. */
  readonly used: FailureReductionBudgetV1;
  /** Capacity that ordinary work cannot consume because terminal audit records still need it. */
  readonly terminalRemaining: {
    /** Aggregate operations reserved for terminal records. */
    readonly campaignOperations: number;
    /** Durable writes reserved for terminal records. */
    readonly durableWrites: number;
    /** Historical envelopes still allowed by report cardinality. */
    readonly envelopes: number;
    /** Terminal runs still required by report cardinality. */
    readonly runs: number;
    /** Campaign summaries still required. */
    readonly summaries: number;
  };
}

interface MutableFailureReductionBudget {
  campaignOperations: number;
  transformationAttempts: number;
  routeExecutions: number;
  oracleEvaluations: number;
  diagnosticBytes: number;
  provenanceEvents: number;
  sequenceCases: number;
  durableWrites: number;
  coreBytes: number;
  runBytes: number;
}

interface CampaignBudgetState {
  readonly policy: FailureReductionPolicyV1;
  readonly used: MutableFailureReductionBudget;
  envelopesRemaining: number;
  runsRemaining: number;
  summariesRemaining: number;
}

interface ChargeDelta {
  readonly campaignOperations: number;
  readonly transformationAttempts: number;
  readonly routeExecutions: number;
  readonly oracleEvaluations: number;
  readonly diagnosticBytes: number;
  readonly provenanceEvents: number;
  readonly sequenceCases: number;
  readonly durableWrites: number;
  readonly coreBytes: number;
  readonly runBytes: number;
  readonly terminalKind?: "envelope" | "run" | "summary";
}

const RESERVATION_KEYS = ["nonPassResults", "resolvableNonPassResults"] as const;
const BUDGET_KEYS = [
  "campaignOperations",
  "transformationAttempts",
  "routeExecutions",
  "oracleEvaluations",
  "diagnosticBytes",
  "provenanceEvents",
  "sequenceCases",
  "durableWrites",
  "coreBytes",
  "runBytes",
] as const;
const EMPTY_DELTA: Omit<ChargeDelta, "campaignOperations"> = Object.freeze({
  transformationAttempts: 0,
  routeExecutions: 0,
  oracleEvaluations: 0,
  diagnosticBytes: 0,
  provenanceEvents: 0,
  sequenceCases: 0,
  durableWrites: 0,
  coreBytes: 0,
  runBytes: 0,
});
const AUTHORITY_STATES = new WeakMap<object, CampaignBudgetState>();

function issue<T>(
  path: string,
  message: string,
  capacity: boolean = false,
): ExecutionOperationResultV1<T> {
  const code = capacity ? "execution-plan-capacity" : "execution.invalid-schema";
  const issues: readonly [ExecutionIssueV1] = [Object.freeze({ code, path, message })];
  return Object.freeze({
    ok: false,
    issues: Object.freeze(issues),
  });
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function zeroBudget(): MutableFailureReductionBudget {
  return {
    campaignOperations: 0,
    transformationAttempts: 0,
    routeExecutions: 0,
    oracleEvaluations: 0,
    diagnosticBytes: 0,
    provenanceEvents: 0,
    sequenceCases: 0,
    durableWrites: 0,
    coreBytes: 0,
    runBytes: 0,
  };
}

function terminalRecordCount(state: CampaignBudgetState): number {
  return state.envelopesRemaining + state.runsRemaining + state.summariesRemaining;
}

function snapshot(state: CampaignBudgetState): FailureCampaignBudgetSnapshotV1 {
  const terminalRemaining = terminalRecordCount(state);
  return Object.freeze({
    revision: "failure-campaign-budget-snapshot-v1",
    used: Object.freeze({ ...state.used }),
    terminalRemaining: Object.freeze({
      campaignOperations: terminalRemaining,
      durableWrites: terminalRemaining,
      envelopes: state.envelopesRemaining,
      runs: state.runsRemaining,
      summaries: state.summariesRemaining,
    }),
  });
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function readCharge(input: unknown): ChargeDelta | undefined {
  const oneKey = readExecutionRecord(input, ["kind"]);
  if (oneKey !== undefined) {
    switch (oneKey.kind) {
      case "transformation-attempt":
        return { campaignOperations: 1, ...EMPTY_DELTA, transformationAttempts: 1 };
      case "oracle-evaluation":
        return { campaignOperations: 1, ...EMPTY_DELTA, oracleEvaluations: 1 };
      case "provenance-event-read":
        return { campaignOperations: 1, ...EMPTY_DELTA, provenanceEvents: 1 };
      case "provenance-event-write":
        return { campaignOperations: 1, ...EMPTY_DELTA, durableWrites: 1 };
      case "sequence-case":
        return { campaignOperations: 1, ...EMPTY_DELTA, sequenceCases: 1 };
      case "terminal-envelope-write":
        return {
          campaignOperations: 1,
          ...EMPTY_DELTA,
          durableWrites: 1,
          terminalKind: "envelope",
        };
      case "terminal-summary-write":
        return {
          campaignOperations: 1,
          ...EMPTY_DELTA,
          durableWrites: 1,
          terminalKind: "summary",
        };
      default:
        return undefined;
    }
  }
  const route = readExecutionRecord(input, ["kind", "purpose"]);
  if (
    route !== undefined &&
    route.kind === "route-execution" &&
    (route.purpose === "reduction" ||
      route.purpose === "confirmation" ||
      route.purpose === "control")
  ) {
    return { campaignOperations: 1, ...EMPTY_DELTA, routeExecutions: 1 };
  }
  const bytes = readExecutionRecord(input, ["kind", "bytes"]);
  if (bytes === undefined || !isPositiveSafeInteger(bytes.bytes)) return undefined;
  switch (bytes.kind) {
    case "diagnostic-capture":
      return { campaignOperations: 1, ...EMPTY_DELTA, diagnosticBytes: bytes.bytes };
    case "core-write":
      return {
        campaignOperations: 1,
        ...EMPTY_DELTA,
        durableWrites: 1,
        coreBytes: bytes.bytes,
      };
    case "terminal-run-write":
      return {
        campaignOperations: 1,
        ...EMPTY_DELTA,
        durableWrites: 1,
        runBytes: bytes.bytes,
        terminalKind: "run",
      };
    default:
      return undefined;
  }
}

function terminalAvailable(state: CampaignBudgetState, kind: ChargeDelta["terminalKind"]): boolean {
  switch (kind) {
    case "envelope":
      return state.envelopesRemaining > 0;
    case "run":
      return state.runsRemaining > 0;
    case "summary":
      return state.summariesRemaining > 0;
    default:
      return true;
  }
}

function withinLimits(state: CampaignBudgetState, delta: ChargeDelta): boolean {
  const reserveAfter = terminalRecordCount(state) - (delta.terminalKind === undefined ? 0 : 1);
  for (const key of BUDGET_KEYS) {
    const next =
      key === "coreBytes" || key === "runBytes"
        ? Math.max(state.used[key], delta[key])
        : state.used[key] + delta[key];
    if (!Number.isSafeInteger(next) || next > state.policy.budget[key]) return false;
  }
  if (delta.terminalKind === undefined) {
    if (
      state.used.campaignOperations + delta.campaignOperations >
        state.policy.budget.campaignOperations - reserveAfter ||
      state.used.durableWrites + delta.durableWrites >
        state.policy.budget.durableWrites - reserveAfter
    ) {
      return false;
    }
  }
  return true;
}

function applyCharge(state: CampaignBudgetState, delta: ChargeDelta): void {
  for (const key of BUDGET_KEYS) {
    state.used[key] =
      key === "coreBytes" || key === "runBytes"
        ? Math.max(state.used[key], delta[key])
        : state.used[key] + delta[key];
  }
  switch (delta.terminalKind) {
    case "envelope":
      state.envelopesRemaining -= 1;
      break;
    case "run":
      state.runsRemaining -= 1;
      break;
    case "summary":
      state.summariesRemaining -= 1;
      break;
  }
}

/**
 * Creates the only shared budget authority for a reduction campaign.
 *
 * Mandatory terminal operations and durable writes are reserved before the authority is minted,
 * so a rejected policy cannot leave partial reduction or publication side effects.
 *
 * @param policy Untrusted selected policy.
 * @param reservation Authenticated report cardinalities.
 * @returns Opaque campaign authority or a closed schema/capacity issue.
 *
 * @example
 * ```ts
 * const authority = createFailureCampaignBudgetAuthorityV1(policy, {
 *   nonPassResults: 1,
 *   resolvableNonPassResults: 1,
 * });
 * ```
 */
export function createFailureCampaignBudgetAuthorityV1(
  policy: unknown,
  reservation: unknown,
): ExecutionOperationResultV1<FailureCampaignBudgetAuthorityV1> {
  const parsedPolicy = parseFailureReductionPolicyV1(policy);
  if (!parsedPolicy.ok) return parsedPolicy;
  const counts = readExecutionRecord(reservation, RESERVATION_KEYS);
  if (
    counts === undefined ||
    typeof counts.nonPassResults !== "number" ||
    !Number.isSafeInteger(counts.nonPassResults) ||
    counts.nonPassResults < 0 ||
    typeof counts.resolvableNonPassResults !== "number" ||
    !Number.isSafeInteger(counts.resolvableNonPassResults) ||
    counts.resolvableNonPassResults < 0 ||
    counts.resolvableNonPassResults > counts.nonPassResults
  ) {
    return issue(
      "/reservation",
      "Failure campaign reservation must use valid report cardinalities.",
    );
  }
  const terminalRecords = counts.nonPassResults + counts.resolvableNonPassResults + 1;
  if (
    !Number.isSafeInteger(terminalRecords) ||
    parsedPolicy.value.budget.campaignOperations < terminalRecords ||
    parsedPolicy.value.budget.durableWrites < terminalRecords
  ) {
    return issue(
      "/reservation",
      "Failure campaign policy cannot reserve every mandatory terminal record.",
      true,
    );
  }
  const state: CampaignBudgetState = {
    policy: parsedPolicy.value,
    used: zeroBudget(),
    envelopesRemaining: counts.resolvableNonPassResults,
    runsRemaining: counts.nonPassResults,
    summariesRemaining: 1,
  };
  const authority: FailureCampaignBudgetAuthorityV1 = {
    [FAILURE_CAMPAIGN_BUDGET_AUTHORITY_V1]: true,
  };
  Object.freeze(authority);
  AUTHORITY_STATES.set(authority, state);
  return success(authority);
}

/**
 * Atomically charges one closed operation against a shared campaign authority.
 *
 * Failed charges leave every counter and terminal reservation unchanged.
 *
 * @param authority Factory-produced campaign authority.
 * @param charge Untrusted closed charge candidate.
 * @returns Updated immutable snapshot or a closed schema/capacity issue.
 *
 * @example
 * ```ts
 * const next = chargeFailureCampaignBudgetV1(authority, {
 *   kind: "route-execution",
 *   purpose: "reduction",
 * });
 * ```
 */
export function chargeFailureCampaignBudgetV1(
  authority: FailureCampaignBudgetAuthorityV1,
  charge: unknown,
): ExecutionOperationResultV1<FailureCampaignBudgetSnapshotV1> {
  const state =
    typeof authority === "object" && authority !== null
      ? AUTHORITY_STATES.get(authority)
      : undefined;
  if (state === undefined) {
    return issue("/authority", "Campaign budget authority was not produced by the factory.");
  }
  const delta = readCharge(charge);
  if (delta === undefined) {
    return issue("/charge", "Campaign budget charge must use one exact closed operation shape.");
  }
  if (!terminalAvailable(state, delta.terminalKind)) {
    return issue("/charge", "Campaign terminal reservation for this record is exhausted.", true);
  }
  if (!withinLimits(state, delta)) {
    return issue("/charge", "Campaign budget capacity is exhausted.", true);
  }
  applyCharge(state, delta);
  return success(snapshot(state));
}

/**
 * Reads an isolated immutable accounting snapshot without changing campaign capacity.
 *
 * @param authority Factory-produced campaign authority.
 * @returns Current accounting or a closed authority issue.
 *
 * @example
 * ```ts
 * const current = getFailureCampaignBudgetSnapshotV1(authority);
 * ```
 */
export function getFailureCampaignBudgetSnapshotV1(
  authority: FailureCampaignBudgetAuthorityV1,
): ExecutionOperationResultV1<FailureCampaignBudgetSnapshotV1> {
  const state =
    typeof authority === "object" && authority !== null
      ? AUTHORITY_STATES.get(authority)
      : undefined;
  return state === undefined
    ? issue("/authority", "Campaign budget authority was not produced by the factory.")
    : success(snapshot(state));
}
