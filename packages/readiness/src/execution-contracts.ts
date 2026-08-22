import {
  compareExecutionText,
  isExecutionDigest,
  normalizeExecutionStringSet,
  readExecutionRecord,
} from "./execution-validation.js";

/** Closed execution tiers ordered from the least to the most expensive route. */
export type ExecutionTierV1 = "frontend" | "compiler-api" | "cli" | "emit" | "acme" | "vice";

/** Closed identifiers for the six reviewed execution capabilities. */
export type ExecutionCapabilityIdV1 = ExecutionTierV1;

/** Closed pipeline stages ordered by when a failure becomes terminal. */
export type ExecutionStageV1 =
  | "input"
  | "capability"
  | "frontend"
  | "compiler-api"
  | "cli"
  | "emit"
  | "acme"
  | "vice-launch"
  | "vice-handshake"
  | "fixture"
  | "run"
  | "observe"
  | "compare"
  | "cleanup";

/** Canonical result categories exposed by every execution route. */
export type ExecutionResultCodeV1 =
  | "pass"
  | "invalid-evidence-input"
  | "unbound-capability"
  | "execution-plan-capacity"
  | "tier-unavailable"
  | "diagnostic-mismatch"
  | "unexpected-emission"
  | "compiler-ice"
  | "emission-failure"
  | "assembler-failure"
  | "emulator-launch-failure"
  | "emulator-handshake-failure"
  | "instruction-exhaustion"
  | "cycle-exhaustion"
  | "wall-time-exhaustion"
  | "output-exhaustion"
  | "evidence-exhaustion"
  | "emulator-lease-recovery-blocked"
  | "semantic-mismatch";

/** Positive execution limits selected for one campaign. */
export interface ExecutionBudgetV1 {
  /** Maximum milliseconds for a compiler or assembler operation. */
  readonly operationMs: number;
  /** Maximum milliseconds for one emulator launch and handshake attempt. */
  readonly launchAttemptMs: number;
  /** Maximum milliseconds for one complete route. */
  readonly routeMs: number;
  /** Fixed milliseconds reserved after work for graceful and forced cleanup. */
  readonly cleanupGraceMs: number;
  /** Maximum aggregate bytes read from one child process. */
  readonly outputBytes: number;
  /** Maximum evidence bytes retained for one case. */
  readonly evidenceBytes: number;
  /** Maximum emulator instructions executed for one case. */
  readonly instructions: number;
  /** Maximum emulator cycles executed for one case. */
  readonly cycles: number;
  /** Maximum emulator launch attempts for one case. */
  readonly launchAttempts: number;
}

/** Versioned immutable execution policy. */
export interface ExecutionPolicyV1 {
  /** Closed policy revision. */
  readonly revision: "execution-policy-v1";
  /** Selected limits, each bounded by the canonical maxima. */
  readonly budget: ExecutionBudgetV1;
}

/** Proof that emulator cleanup could not safely release its lease. */
export interface ExecutionCleanupBlockerV1 {
  /** Stable cleanup failure category. */
  readonly code: "emulator-lease-recovery-blocked";
  /** Digest of the bounded cleanup evidence. */
  readonly evidenceDigest: string;
}

/** Cumulative resource usage observed for one execution route. */
export interface ExecutionUsageV1 {
  /** Total monotonic wall-clock milliseconds. */
  readonly wallMs: number;
  /** Aggregate child output bytes observed. */
  readonly outputBytes: number;
  /** Evidence bytes retained. */
  readonly evidenceBytes: number;
  /** Emulator instructions observed. */
  readonly instructions: number;
  /** Emulator cycles observed. */
  readonly cycles: number;
  /** Emulator launches attempted. */
  readonly launchAttempts: number;
}

/** Bounded evidence identity retained with an execution result. */
export interface ExecutionEvidenceSummaryV1 {
  /** Digest of the complete evidence stream. */
  readonly digest: string;
  /** Bytes retained in the bounded evidence record. */
  readonly retainedBytes: number;
  /** Whether the retained view omits evidence bytes. */
  readonly truncated: boolean;
}

/** Stable issue codes returned by passive execution operations. */
export type ExecutionOperationIssueCodeV1 =
  | Exclude<ExecutionResultCodeV1, "pass">
  | "execution.invalid-schema"
  | "execution.io"
  | "execution.stale-authority"
  | "execution.identity"
  | "execution.reconciliation";

/** One path-specific passive execution validation or lifecycle issue. */
export interface ExecutionIssueV1 {
  /** Stable machine-readable issue category. */
  readonly code: ExecutionOperationIssueCodeV1;
  /** RFC 6901 pointer into the rejected input. */
  readonly path: string;
  /** Bounded human-readable explanation. */
  readonly message: string;
}

/** Closed success or non-empty issue result returned without throwing. */
export type ExecutionOperationResultV1<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly [ExecutionIssueV1, ...ExecutionIssueV1[]] };

/** Final pass or terminal failure for one selected route. */
export type ExecutionResultV1 =
  | {
      /** Successful result discriminator. */
      readonly status: "pass";
      /** Terminal route tier. */
      readonly tier: ExecutionTierV1;
      /** Last completed pipeline stage. */
      readonly stage: ExecutionStageV1;
      /** Stable success code. */
      readonly code: "pass";
      /** Cumulative route usage. */
      readonly usage: ExecutionUsageV1;
      /** Bounded route evidence. */
      readonly evidence: ExecutionEvidenceSummaryV1;
    }
  | {
      /** Failed result discriminator. */
      readonly status: "failure";
      /** Terminal route tier. */
      readonly tier: ExecutionTierV1;
      /** First terminal pipeline stage. */
      readonly stage: ExecutionStageV1;
      /** Canonical public failure code. */
      readonly code: Exclude<ExecutionResultCodeV1, "pass">;
      /** Optional bounded adapter-specific detail that never replaces the public code. */
      readonly adapterSubcode?: string;
      /** Cumulative usage at the terminal stage. */
      readonly usage: ExecutionUsageV1;
      /** Bounded evidence at the terminal stage. */
      readonly evidence: ExecutionEvidenceSummaryV1;
      /** Cleanup evidence attached without replacing an earlier operational failure. */
      readonly cleanupBlocker?: ExecutionCleanupBlockerV1;
    };

/** One identity-bound route or additional evidence obligation. */
export interface ExecutionRoutePlanItemV1 {
  /** Stable source-case digest. */
  readonly caseIdentity: string;
  /** Reviewed rule exercised by the case. */
  readonly ruleId: string;
  /** Evidence tier selected independently for this item. */
  readonly obligation: string;
  /** Last tier executed by this route. */
  readonly terminalTier: ExecutionTierV1;
  /** Ordered prerequisite tiers that must complete first. */
  readonly prerequisiteTiers: readonly ExecutionTierV1[];
  /** Domain-separated deterministic candidate rank. */
  readonly rankDigest: string;
}

/** Complete deterministic route plan fixed before external work starts. */
export interface ExecutionRoutePlanV1 {
  /** Closed route-plan revision. */
  readonly revision: "execution-route-plan-v1";
  /** Exact selected parent publication digest. */
  readonly parentDigest: string;
  /** Exact prepared campaign digest. */
  readonly campaignDigest: string;
  /** Exact selected oracle publication digest. */
  readonly oracleDigest: string;
  /** Policy included in route identity. */
  readonly policy: ExecutionPolicyV1;
  /** Canonically ordered selected routes. */
  readonly items: readonly ExecutionRoutePlanItemV1[];
  /** Digest of the canonical plan bytes excluding this field. */
  readonly digest: string;
}

/** Passive bound or explicitly unbound state for one execution capability. */
export type ExecutionCapabilityProjectionV1 =
  | {
      /** Reviewed capability identifier. */
      readonly capabilityId: ExecutionCapabilityIdV1;
      /** Bound capability state. */
      readonly state: "bound";
    }
  | {
      /** Reviewed capability identifier. */
      readonly capabilityId: ExecutionCapabilityIdV1;
      /** Unbound capability state. */
      readonly state: "unbound";
      /** Stable parent blocker preserved until reviewed evidence binds the capability. */
      readonly blocker: "unbound-evidence-capability";
    };

/** Serializable closed view of parent readiness facts needed by route planning. */
export interface CompositeReadinessProjectionV1 {
  /** Exact parent publication digest. */
  readonly parentDigest: string;
  /** Digest of the passive execution projection. */
  readonly executionDigest: string;
  /** Exact six capability states. */
  readonly capabilities: readonly ExecutionCapabilityProjectionV1[];
  /** Reviewed rule execution declarations. */
  readonly rules: readonly ExecutionRuleProjectionV1[];
}

/** One reviewed rule's applicability and execution obligations. */
export interface ExecutionRuleProjectionV1 {
  /** Stable reviewed rule identifier. */
  readonly ruleId: string;
  /** C64 applicability controlling mandatory runtime sampling. */
  readonly applicability:
    | "mandatory-c64"
    | "not-applicable-c64"
    | "out-of-claim-target"
    | "blocked-errata";
  /** Independently selected evidence tiers declared for the rule. */
  readonly evidenceObligations: readonly ExecutionTierV1[];
  /** Reviewed boundary families relevant to the rule. */
  readonly boundaryFamilyIds: readonly string[];
}

/** Serializable case facts used only for deterministic route selection. */
export interface ExecutionPlanningCaseV1 {
  /** Stable source-case digest. */
  readonly caseIdentity: string;
  /** Primary reviewed rule exercised by the case. */
  readonly ruleId: string;
  /** Whether the generator intentionally created valid or invalid source. */
  readonly validity: "valid" | "invalid";
  /** Ordered source spelling dimensions exercised by the case. */
  readonly spellingTuple: readonly string[];
  /** Reviewed boundary family exercised by the case. */
  readonly boundaryFamilyId: string;
}

/** Passive serializable projection derived from a genuine prepared campaign. */
export interface ExecutionCampaignProjectionV1 {
  /** Closed projection revision. */
  readonly revision: "execution-campaign-projection-v1";
  /** Exact prepared campaign digest. */
  readonly campaignDigest: string;
  /** Complete campaign population in canonical case-identity order. */
  readonly cases: readonly ExecutionPlanningCaseV1[];
}

/** Complete closed execution vocabulary and canonical maximum policy. */
export interface ExecutionContractsV1 {
  /** Closed contracts revision. */
  readonly revision: "execution-contracts-v1";
  /** Canonically ordered tier vocabulary. */
  readonly tiers: readonly ExecutionTierV1[];
  /** Canonically ordered capability vocabulary. */
  readonly capabilities: readonly ExecutionCapabilityIdV1[];
  /** Canonically ordered stage vocabulary. */
  readonly stages: readonly ExecutionStageV1[];
  /** Canonically ordered result-code vocabulary. */
  readonly resultCodes: readonly ExecutionResultCodeV1[];
  /** Selected bounded execution policy. */
  readonly policy: ExecutionPolicyV1;
}

/** Stable fields used when no terminal candidate exists. */
export interface ExecutionTerminalBaseV1 {
  /** Terminal route tier. */
  readonly tier: ExecutionTierV1;
  /** Last completed pipeline stage. */
  readonly stage: ExecutionStageV1;
  /** Cumulative route usage. */
  readonly usage: ExecutionUsageV1;
  /** Bounded route evidence. */
  readonly evidence: ExecutionEvidenceSummaryV1;
}

/** Pipeline stages that can produce an operational failure before cleanup. */
export type ExecutionOperationalStageV1 = Exclude<ExecutionStageV1, "cleanup">;

/** One observed terminal candidate before deterministic precedence reduction. */
export type ExecutionTerminalCandidateV1 =
  | {
      /** Operational pipeline stage that raised the candidate. */
      readonly stage: ExecutionOperationalStageV1;
      /** Canonical public failure category. */
      readonly code: Exclude<ExecutionResultCodeV1, "pass">;
      /** Cumulative usage at this candidate. */
      readonly usage: ExecutionUsageV1;
      /** Bounded evidence at this candidate. */
      readonly evidence: ExecutionEvidenceSummaryV1;
      /** Optional cleanup blocker observed while preserving this earlier failure. */
      readonly cleanupBlocker?: ExecutionCleanupBlockerV1;
    }
  | {
      /** Cleanup-only terminal stage. */
      readonly stage: "cleanup";
      /** Cleanup's only public failure category. */
      readonly code: "emulator-lease-recovery-blocked";
      /** Cumulative usage at cleanup failure. */
      readonly usage: ExecutionUsageV1;
      /** Bounded cleanup evidence. */
      readonly evidence: ExecutionEvidenceSummaryV1;
      /** Required proof that safe lease recovery could not be established. */
      readonly cleanupBlocker: ExecutionCleanupBlockerV1;
    };

/** Canonical tier order used for validation, serialization, and route cost. */
export const EXECUTION_TIERS_V1: readonly ExecutionTierV1[] = Object.freeze([
  "frontend",
  "compiler-api",
  "cli",
  "emit",
  "acme",
  "vice",
]);

/** Canonical pipeline-stage order used for terminal precedence. */
export const EXECUTION_STAGES_V1: readonly ExecutionStageV1[] = Object.freeze([
  "input",
  "capability",
  "frontend",
  "compiler-api",
  "cli",
  "emit",
  "acme",
  "vice-launch",
  "vice-handshake",
  "fixture",
  "run",
  "observe",
  "compare",
  "cleanup",
]);

/** Canonical result-code order used by closed contract parsing. */
export const EXECUTION_RESULT_CODES_V1: readonly ExecutionResultCodeV1[] = Object.freeze([
  "pass",
  "invalid-evidence-input",
  "unbound-capability",
  "execution-plan-capacity",
  "tier-unavailable",
  "diagnostic-mismatch",
  "unexpected-emission",
  "compiler-ice",
  "emission-failure",
  "assembler-failure",
  "emulator-launch-failure",
  "emulator-handshake-failure",
  "instruction-exhaustion",
  "cycle-exhaustion",
  "wall-time-exhaustion",
  "output-exhaustion",
  "evidence-exhaustion",
  "emulator-lease-recovery-blocked",
  "semantic-mismatch",
]);

/** Inclusive maximum budget accepted by the version-one policy parser. */
export const EXECUTION_MAXIMUM_BUDGET_V1: Readonly<ExecutionBudgetV1> = Object.freeze({
  operationMs: 60_000,
  launchAttemptMs: 15_000,
  routeMs: 120_000,
  cleanupGraceMs: 3_000,
  outputBytes: 1_048_576,
  evidenceBytes: 16_777_216,
  instructions: 10_000_000,
  cycles: 100_000_000,
  launchAttempts: 8,
});

const POLICY_KEYS = ["revision", "budget"] as const;
const BUDGET_KEYS = [
  "operationMs",
  "launchAttemptMs",
  "routeMs",
  "cleanupGraceMs",
  "outputBytes",
  "evidenceBytes",
  "instructions",
  "cycles",
  "launchAttempts",
] as const;
const CONTRACT_KEYS = [
  "revision",
  "tiers",
  "capabilities",
  "stages",
  "resultCodes",
  "policy",
] as const;
const TIER_SET: ReadonlySet<string> = new Set(EXECUTION_TIERS_V1);
const STAGE_SET: ReadonlySet<string> = new Set(EXECUTION_STAGES_V1);
const RESULT_CODE_SET: ReadonlySet<string> = new Set(EXECUTION_RESULT_CODES_V1);
const STAGE_INDEX = new Map(EXECUTION_STAGES_V1.map((stage, index) => [stage, index]));
const TERMINAL_CODE_PRIORITY = new Map<Exclude<ExecutionResultCodeV1, "pass">, number>([
  ["wall-time-exhaustion", 0],
  ["instruction-exhaustion", 1],
  ["cycle-exhaustion", 2],
]);

/** Creates one immutable non-empty passive execution issue result. */
function issue(
  code: ExecutionOperationIssueCodeV1,
  path: string,
  message: string,
): ExecutionOperationResultV1<never> {
  const issues: readonly [ExecutionIssueV1] = [Object.freeze({ code, path, message })];
  return Object.freeze({
    ok: false,
    issues: Object.freeze(issues),
  });
}

/** Creates one immutable passive execution success result. */
function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

/** Prefixes nested issues so their pointers address the containing execution object. */
function prefixIssues<T>(
  result: Extract<ExecutionOperationResultV1<T>, { readonly ok: false }>,
  prefix: string,
): ExecutionOperationResultV1<T> {
  const [first, ...rest] = result.issues;
  const prefixedFirst = Object.freeze({ ...first, path: `${prefix}${first.path}` });
  const prefixedRest = rest.map((entry) =>
    Object.freeze({ ...entry, path: `${prefix}${entry.path}` }),
  );
  const issues: readonly [ExecutionIssueV1, ...ExecutionIssueV1[]] = [
    prefixedFirst,
    ...prefixedRest,
  ];
  return Object.freeze({ ok: false, issues: Object.freeze(issues) });
}

/** Narrows an unknown value to the closed tier vocabulary. */
function isTier(value: unknown): value is ExecutionTierV1 {
  return typeof value === "string" && TIER_SET.has(value);
}

/** Narrows an unknown value to the closed stage vocabulary. */
function isStage(value: unknown): value is ExecutionStageV1 {
  return typeof value === "string" && STAGE_SET.has(value);
}

/** Narrows an unknown value to the closed public result-code vocabulary. */
function isResultCode(value: unknown): value is ExecutionResultCodeV1 {
  return typeof value === "string" && RESULT_CODE_SET.has(value);
}

/** Requires every canonical member exactly once while returning canonical order. */
function canonicalClosedSet<T extends string>(
  input: unknown,
  canonical: readonly T[],
  validate: (value: unknown) => value is T,
): readonly T[] | undefined {
  const normalized = normalizeExecutionStringSet(input, canonical.length, validate);
  if (normalized === undefined || normalized.length !== canonical.length) return undefined;
  const canonicalLexical = [...canonical].sort(compareExecutionText);
  if (normalized.some((value, index) => value !== canonicalLexical[index])) return undefined;
  return canonical;
}

/**
 * Validates and freezes a version-one execution policy.
 *
 * Exact maxima are accepted. Every limit is a positive safe integer, cleanup grace is fixed, and
 * a child-capable route retains at least one millisecond of work time before cleanup.
 *
 * @param input Untrusted policy input.
 * @returns Canonical policy or one deterministic schema issue.
 */
export function parseExecutionPolicyV1(
  input: unknown,
): ExecutionOperationResultV1<ExecutionPolicyV1> {
  const policy = readExecutionRecord(input, POLICY_KEYS);
  if (policy === undefined || policy.revision !== "execution-policy-v1") {
    return issue(
      "execution.invalid-schema",
      "",
      "Execution policy must use the exact version-one shape.",
    );
  }
  const budget = readExecutionRecord(policy.budget, BUDGET_KEYS);
  if (budget === undefined) {
    return issue(
      "execution.invalid-schema",
      "/budget",
      "Execution budget must use the exact shape.",
    );
  }
  const parsed: Record<keyof ExecutionBudgetV1, number> = {
    operationMs: 0,
    launchAttemptMs: 0,
    routeMs: 0,
    cleanupGraceMs: 0,
    outputBytes: 0,
    evidenceBytes: 0,
    instructions: 0,
    cycles: 0,
    launchAttempts: 0,
  };
  for (const key of BUDGET_KEYS) {
    const value = budget[key];
    const maximum = EXECUTION_MAXIMUM_BUDGET_V1[key];
    if (
      typeof value !== "number" ||
      !Number.isSafeInteger(value) ||
      value <= 0 ||
      value > maximum
    ) {
      return issue(
        "execution.invalid-schema",
        `/budget/${key}`,
        `Execution budget ${key} must be a positive safe integer no greater than ${maximum}.`,
      );
    }
    parsed[key] = value;
  }
  if (parsed.cleanupGraceMs !== EXECUTION_MAXIMUM_BUDGET_V1.cleanupGraceMs) {
    return issue(
      "execution.invalid-schema",
      "/budget/cleanupGraceMs",
      "Cleanup grace must reserve exactly 3000 milliseconds.",
    );
  }
  if (parsed.routeMs <= parsed.cleanupGraceMs) {
    return issue(
      "execution.invalid-schema",
      "/budget/routeMs",
      "A child-capable route must leave work time before the cleanup reserve.",
    );
  }
  return success(
    Object.freeze({
      revision: "execution-policy-v1" as const,
      budget: Object.freeze({ ...parsed }),
    }),
  );
}

/**
 * Validates and canonicalizes the complete closed execution vocabulary.
 *
 * @param input Untrusted contracts input.
 * @returns Canonically ordered contracts or one deterministic schema issue.
 */
export function parseExecutionContractsV1(
  input: unknown,
): ExecutionOperationResultV1<ExecutionContractsV1> {
  const record = readExecutionRecord(input, CONTRACT_KEYS);
  if (record === undefined || record.revision !== "execution-contracts-v1") {
    return issue(
      "execution.invalid-schema",
      "",
      "Execution contracts must use the exact version-one shape.",
    );
  }
  const tiers = canonicalClosedSet(record.tiers, EXECUTION_TIERS_V1, isTier);
  const capabilities = canonicalClosedSet(record.capabilities, EXECUTION_TIERS_V1, isTier);
  const stages = canonicalClosedSet(record.stages, EXECUTION_STAGES_V1, isStage);
  const resultCodes = canonicalClosedSet(
    record.resultCodes,
    EXECUTION_RESULT_CODES_V1,
    isResultCode,
  );
  if (
    tiers === undefined ||
    capabilities === undefined ||
    stages === undefined ||
    resultCodes === undefined
  ) {
    return issue(
      "execution.invalid-schema",
      "",
      "Execution contract members must contain each closed member exactly once.",
    );
  }
  const policy = parseExecutionPolicyV1(record.policy);
  if (!policy.ok) return prefixIssues(policy, "/policy");
  return success(
    Object.freeze({
      revision: "execution-contracts-v1" as const,
      tiers,
      capabilities,
      stages,
      resultCodes,
      policy: policy.value,
    }),
  );
}

/** Orders operational candidates by pipeline stage and deterministic same-stage precedence. */
function terminalCandidateOrder(
  left: ExecutionTerminalCandidateV1,
  right: ExecutionTerminalCandidateV1,
): number {
  const stageDifference =
    (STAGE_INDEX.get(left.stage) ?? Number.MAX_SAFE_INTEGER) -
    (STAGE_INDEX.get(right.stage) ?? Number.MAX_SAFE_INTEGER);
  if (stageDifference !== 0) return stageDifference;
  const codeDifference =
    (TERMINAL_CODE_PRIORITY.get(left.code) ?? 100) -
    (TERMINAL_CODE_PRIORITY.get(right.code) ?? 100);
  if (codeDifference !== 0) return codeDifference;
  return compareExecutionText(left.code, right.code);
}

/**
 * Reduces observed terminal candidates with pipeline and cleanup precedence.
 *
 * The earliest operational stage wins regardless of callback order. At that stage wall-time
 * exhaustion wins, followed by instruction and cycle exhaustion. Cleanup failure is attached to
 * an earlier operational result and becomes primary only when no operational failure exists.
 *
 * @param base Provisional pass fields.
 * @param candidates Independently observed terminal candidates.
 * @returns One deterministic final route result.
 */
export function reduceExecutionTerminalV1(
  base: ExecutionTerminalBaseV1,
  candidates: readonly ExecutionTerminalCandidateV1[],
): ExecutionResultV1 {
  const cleanupCandidate = candidates
    .filter((candidate) => candidate.stage === "cleanup" || candidate.cleanupBlocker !== undefined)
    .sort(terminalCandidateOrder)[0];
  const operational = candidates
    .filter((candidate) => candidate.stage !== "cleanup")
    .sort(terminalCandidateOrder)[0];
  const primary = operational ?? cleanupCandidate;
  if (primary === undefined) {
    return Object.freeze({
      status: "pass",
      tier: base.tier,
      stage: base.stage,
      code: "pass",
      usage: base.usage,
      evidence: base.evidence,
    });
  }
  const cleanupBlocker =
    cleanupCandidate?.cleanupBlocker ??
    (cleanupCandidate?.stage === "cleanup"
      ? Object.freeze({
          code: "emulator-lease-recovery-blocked" as const,
          evidenceDigest: cleanupCandidate.evidence.digest,
        })
      : undefined);
  const primaryCode = operational?.code ?? "emulator-lease-recovery-blocked";
  return Object.freeze({
    status: "failure",
    tier: base.tier,
    stage: primary.stage,
    code: primaryCode,
    usage: primary.usage,
    evidence: primary.evidence,
    ...(cleanupBlocker === undefined ? {} : { cleanupBlocker }),
  });
}

/** Returns whether an unknown value is one of the six closed execution tiers. */
export function isExecutionTierV1(value: unknown): value is ExecutionTierV1 {
  return isTier(value);
}

/** Returns whether an unknown value is a canonical execution digest. */
export function isExecutionDigestV1(value: unknown): value is `sha256:${string}` {
  return isExecutionDigest(value);
}
