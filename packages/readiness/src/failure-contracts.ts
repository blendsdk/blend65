import {
  EXECUTION_RESULT_CODES_V1,
  EXECUTION_STAGES_V1,
  EXECUTION_TIERS_V1,
} from "./execution-contracts.js";
import {
  isExecutionDigest,
  readExecutionArray,
  readExecutionRecord,
} from "./execution-validation.js";

import type {
  ExecutionOperationIssueCodeV1,
  ExecutionOperationResultV1,
  ExecutionIssueV1,
  ExecutionResultCodeV1,
  ExecutionResultV1,
  ExecutionRoutePlanItemV1,
  ExecutionStageV1,
  ExecutionTierV1,
  ExecutionUsageV1,
} from "./execution-contracts.js";

/** Initial handling selected for an authenticated non-pass execution result. */
export type FailureDispositionV1 =
  | "direct-shrink"
  | "fresh-confirm"
  | "campaign-only"
  | "unsupported";

/** Whether emulator cleanup left a separately observable blocker. */
export type CleanupDispositionV1 = "cleanup-clear" | "cleanup-blocked";

/** Terminal outcomes emitted by deterministic failure reduction. */
export type ReductionOutcomeCodeV1 =
  | "confirmed-source-failure"
  | "stateful-sequence-failure"
  | "flaky-failure"
  | "reduction-exhausted"
  | "historical-authority-unavailable";

/**
 * Immutable classification of one execution result.
 *
 * Structurally invalid input deliberately omits `result`: retaining unvalidated caller data would
 * turn a safe unsupported outcome into a counterfeit evidence carrier.
 */
export type ClassifiedFailureV1 =
  | {
      /** Closed classification schema revision. */
      readonly revision: "failure-disposition-v1";
      /** Supported initial reduction handling for the primary result. */
      readonly disposition: Exclude<FailureDispositionV1, "unsupported">;
      /** Cleanup state retained independently of the primary failure. */
      readonly cleanup: CleanupDispositionV1;
      /** Defensively validated and frozen non-pass result. */
      readonly result: Extract<ExecutionResultV1, { readonly status: "failure" }>;
    }
  | {
      /** Closed classification schema revision. */
      readonly revision: "failure-disposition-v1";
      /** Closed outcome for a valid but disallowed route/result tuple. */
      readonly disposition: "unsupported";
      /** Cleanup state retained independently of a valid result. */
      readonly cleanup: CleanupDispositionV1;
      /** Defensively validated and frozen pass or non-pass result. */
      readonly result: ExecutionResultV1;
    }
  | {
      /** Closed classification schema revision. */
      readonly revision: "failure-disposition-v1";
      /** Closed outcome for structurally invalid or unknown input. */
      readonly disposition: "unsupported";
      /** Invalid input cannot establish an authenticated cleanup blocker. */
      readonly cleanup: "cleanup-clear";
      /** Invalid input must never be retained as evidence. */
      readonly result?: never;
    };

/** Resource ceilings shared by every reduction session in one campaign. */
export interface FailureReductionBudgetV1 {
  /** Aggregate count of all charged campaign operations. */
  readonly campaignOperations: number;
  /** Candidate transformations attempted. */
  readonly transformationAttempts: number;
  /** Reduction, confirmation, and control routes executed. */
  readonly routeExecutions: number;
  /** Failure-predicate evaluations performed. */
  readonly oracleEvaluations: number;
  /** Diagnostic bytes retained. */
  readonly diagnosticBytes: number;
  /** Provenance records inspected. */
  readonly provenanceEvents: number;
  /** Stateful sequence cases admitted. */
  readonly sequenceCases: number;
  /** Aggregate count of durable records written. */
  readonly durableWrites: number;
  /** Canonical promoted-core bytes written. */
  readonly coreBytes: number;
  /** Canonical terminal-run bytes written. */
  readonly runBytes: number;
}

/** Versioned deterministic policy selected once for a reduction campaign. */
export interface FailureReductionPolicyV1 {
  /** Closed policy schema revision. */
  readonly revision: "failure-reduction-policy-v1";
  /** Exact disposition contract revision. */
  readonly dispositionRevision: "failure-disposition-v1";
  /** Exact transformation catalog revision. */
  readonly catalogRevision: "failure-reduction-catalog-v1";
  /** Exact normalization contract revision. */
  readonly normalizationRevision: "failure-normalization-v1";
  /** Selected positive resource ceilings. */
  readonly budget: FailureReductionBudgetV1;
}

/** Inclusive hard maxima accepted by the reduction-policy parser. */
export const FAILURE_REDUCTION_MAXIMUM_BUDGET_V1: Readonly<FailureReductionBudgetV1> =
  Object.freeze({
    campaignOperations: 65_536,
    transformationAttempts: 4_096,
    routeExecutions: 4_096,
    oracleEvaluations: 8_192,
    diagnosticBytes: 1_048_576,
    provenanceEvents: 4_096,
    sequenceCases: 64,
    durableWrites: 65_536,
    coreBytes: 67_108_864,
    runBytes: 268_435_456,
  });

/** Canonical policy used when a caller does not request smaller limits. */
export const FAILURE_REDUCTION_DEFAULT_POLICY_V1: FailureReductionPolicyV1 = Object.freeze({
  revision: "failure-reduction-policy-v1",
  dispositionRevision: "failure-disposition-v1",
  catalogRevision: "failure-reduction-catalog-v1",
  normalizationRevision: "failure-normalization-v1",
  budget: Object.freeze({
    campaignOperations: 16_384,
    transformationAttempts: 1_024,
    routeExecutions: 1_024,
    oracleEvaluations: 2_048,
    diagnosticBytes: 262_144,
    provenanceEvents: 256,
    sequenceCases: 8,
    durableWrites: 32_768,
    coreBytes: 16_777_216,
    runBytes: 67_108_864,
  }),
});

const POLICY_KEYS = [
  "revision",
  "dispositionRevision",
  "catalogRevision",
  "normalizationRevision",
  "budget",
] as const;
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
const ROUTE_KEYS = [
  "caseIdentity",
  "ruleId",
  "obligation",
  "terminalTier",
  "prerequisiteTiers",
  "rankDigest",
] as const;
const RESULT_REQUIRED_KEYS = ["status", "tier", "stage", "code", "usage", "evidence"] as const;
const USAGE_KEYS = [
  "wallMs",
  "outputBytes",
  "evidenceBytes",
  "instructions",
  "cycles",
  "launchAttempts",
] as const;
const EVIDENCE_KEYS = ["digest", "retainedBytes", "truncated"] as const;
const CLEANUP_KEYS = ["code", "evidenceDigest"] as const;
const TIER_SET: ReadonlySet<string> = new Set(EXECUTION_TIERS_V1);
const STAGE_SET: ReadonlySet<string> = new Set(EXECUTION_STAGES_V1);
const FAILURE_CODE_SET: ReadonlySet<string> = new Set(
  EXECUTION_RESULT_CODES_V1.filter((code) => code !== "pass"),
);
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const MAX_TEXT_BYTES = 512;
const MAX_ROUTE_TIERS = EXECUTION_TIERS_V1.length;
const TEXT_ENCODER = new TextEncoder();

const DISPOSITIONS: Readonly<
  Record<Exclude<ExecutionResultCodeV1, "pass">, Exclude<FailureDispositionV1, "unsupported">>
> = Object.freeze({
  "invalid-evidence-input": "campaign-only",
  "unbound-capability": "campaign-only",
  "execution-plan-capacity": "campaign-only",
  "tier-unavailable": "campaign-only",
  "diagnostic-mismatch": "direct-shrink",
  "unexpected-emission": "direct-shrink",
  "compiler-ice": "fresh-confirm",
  "emission-failure": "fresh-confirm",
  "assembler-failure": "fresh-confirm",
  "emulator-launch-failure": "fresh-confirm",
  "emulator-handshake-failure": "fresh-confirm",
  "instruction-exhaustion": "fresh-confirm",
  "cycle-exhaustion": "fresh-confirm",
  "wall-time-exhaustion": "fresh-confirm",
  "output-exhaustion": "fresh-confirm",
  "evidence-exhaustion": "fresh-confirm",
  "emulator-lease-recovery-blocked": "campaign-only",
  "semantic-mismatch": "direct-shrink",
});

const ALLOWED_STAGES: Readonly<
  Record<Exclude<ExecutionResultCodeV1, "pass">, ReadonlySet<string>>
> = Object.freeze({
  "invalid-evidence-input": new Set(["input", "vice-launch", "fixture", "observe", "compare"]),
  "unbound-capability": new Set(["capability"]),
  "execution-plan-capacity": new Set(["capability"]),
  "tier-unavailable": new Set(["capability", "acme", "vice-launch"]),
  "diagnostic-mismatch": new Set(["frontend", "compiler-api", "cli", "emit"]),
  "unexpected-emission": new Set(["frontend", "compiler-api", "cli", "emit"]),
  "compiler-ice": new Set(["frontend", "compiler-api", "cli", "emit", "acme", "vice-launch"]),
  "emission-failure": new Set(["emit"]),
  "assembler-failure": new Set(["acme"]),
  "emulator-launch-failure": new Set(["vice-launch"]),
  "emulator-handshake-failure": new Set(["vice-handshake", "fixture", "run"]),
  "instruction-exhaustion": new Set(["run"]),
  "cycle-exhaustion": new Set(["run"]),
  "wall-time-exhaustion": new Set([
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
  ]),
  "output-exhaustion": new Set([
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
  ]),
  "evidence-exhaustion": new Set([
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
  ]),
  "emulator-lease-recovery-blocked": new Set(["vice-launch", "cleanup"]),
  "semantic-mismatch": new Set(["fixture", "observe", "compare"]),
});

const STAGE_OWNER: Readonly<Partial<Record<ExecutionStageV1, ExecutionTierV1>>> = Object.freeze({
  frontend: "frontend",
  "compiler-api": "compiler-api",
  cli: "cli",
  emit: "emit",
  acme: "acme",
  "vice-launch": "vice",
  "vice-handshake": "vice",
  fixture: "vice",
  run: "vice",
  observe: "vice",
  compare: "vice",
  cleanup: "vice",
});

function issue<T>(
  code: ExecutionOperationIssueCodeV1,
  path: string,
  message: string,
): ExecutionOperationResultV1<T> {
  const issues: readonly [ExecutionIssueV1] = [Object.freeze({ code, path, message })];
  return Object.freeze({
    ok: false,
    issues: Object.freeze(issues),
  });
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function isBoundedText(value: unknown, identifier: boolean = false): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_TEXT_BYTES &&
    TEXT_ENCODER.encode(value).byteLength <= MAX_TEXT_BYTES &&
    (!identifier || IDENTIFIER_PATTERN.test(value))
  );
}

function isTier(value: unknown): value is ExecutionTierV1 {
  return typeof value === "string" && TIER_SET.has(value);
}

function isStage(value: unknown): value is ExecutionStageV1 {
  return typeof value === "string" && STAGE_SET.has(value);
}

function isFailureCode(value: unknown): value is Exclude<ExecutionResultCodeV1, "pass"> {
  return typeof value === "string" && FAILURE_CODE_SET.has(value);
}

function readRoute(input: unknown): ExecutionRoutePlanItemV1 | undefined {
  const route = readExecutionRecord(input, ROUTE_KEYS);
  if (
    route === undefined ||
    !isExecutionDigest(route.caseIdentity) ||
    !isBoundedText(route.ruleId, true) ||
    !isBoundedText(route.obligation) ||
    !isTier(route.terminalTier) ||
    !isExecutionDigest(route.rankDigest)
  ) {
    return undefined;
  }
  const prerequisiteInput = readExecutionArray(route.prerequisiteTiers, MAX_ROUTE_TIERS);
  if (prerequisiteInput === undefined) return undefined;
  const prerequisiteTiers: ExecutionTierV1[] = [];
  const seen = new Set<ExecutionTierV1>();
  for (const value of prerequisiteInput) {
    if (!isTier(value) || value === route.terminalTier || seen.has(value)) return undefined;
    seen.add(value);
    prerequisiteTiers.push(value);
  }
  return Object.freeze({
    caseIdentity: route.caseIdentity,
    ruleId: route.ruleId,
    obligation: route.obligation,
    terminalTier: route.terminalTier,
    prerequisiteTiers: Object.freeze(prerequisiteTiers),
    rankDigest: route.rankDigest,
  });
}

function normalizeUsage(input: unknown): ExecutionUsageV1 | undefined {
  const usage = readExecutionRecord(input, USAGE_KEYS);
  if (usage === undefined) return undefined;
  const wallMs = usage.wallMs;
  const outputBytes = usage.outputBytes;
  const evidenceBytes = usage.evidenceBytes;
  const instructions = usage.instructions;
  const cycles = usage.cycles;
  const launchAttempts = usage.launchAttempts;
  if (
    typeof wallMs !== "number" ||
    !Number.isSafeInteger(wallMs) ||
    wallMs < 0 ||
    typeof outputBytes !== "number" ||
    !Number.isSafeInteger(outputBytes) ||
    outputBytes < 0 ||
    typeof evidenceBytes !== "number" ||
    !Number.isSafeInteger(evidenceBytes) ||
    evidenceBytes < 0 ||
    typeof instructions !== "number" ||
    !Number.isSafeInteger(instructions) ||
    instructions < 0 ||
    typeof cycles !== "number" ||
    !Number.isSafeInteger(cycles) ||
    cycles < 0 ||
    typeof launchAttempts !== "number" ||
    !Number.isSafeInteger(launchAttempts) ||
    launchAttempts < 0
  ) {
    return undefined;
  }
  return Object.freeze({
    wallMs,
    outputBytes,
    evidenceBytes,
    instructions,
    cycles,
    launchAttempts,
  });
}

function normalizeEvidence(
  input: unknown,
):
  | { readonly digest: string; readonly retainedBytes: number; readonly truncated: boolean }
  | undefined {
  const evidence = readExecutionRecord(input, EVIDENCE_KEYS);
  if (
    evidence === undefined ||
    !isExecutionDigest(evidence.digest) ||
    typeof evidence.retainedBytes !== "number" ||
    !Number.isSafeInteger(evidence.retainedBytes) ||
    evidence.retainedBytes < 0 ||
    typeof evidence.truncated !== "boolean"
  ) {
    return undefined;
  }
  return Object.freeze({
    digest: evidence.digest,
    retainedBytes: evidence.retainedBytes,
    truncated: evidence.truncated,
  });
}

function readExecutionResult(input: unknown): ExecutionResultV1 | undefined {
  const allowedKeys = [...RESULT_REQUIRED_KEYS, "adapterSubcode", "cleanupBlocker"];
  if (typeof input !== "object" || input === null) return undefined;
  let presentKeys: string[];
  try {
    presentKeys = Reflect.ownKeys(input).filter((key): key is string => typeof key === "string");
  } catch {
    return undefined;
  }
  if (
    presentKeys.length < RESULT_REQUIRED_KEYS.length ||
    presentKeys.length > allowedKeys.length ||
    presentKeys.some((key) => !allowedKeys.includes(key)) ||
    RESULT_REQUIRED_KEYS.some((key) => !presentKeys.includes(key))
  ) {
    return undefined;
  }
  const result = readExecutionRecord(input, presentKeys);
  if (result === undefined || !isTier(result.tier) || !isStage(result.stage)) {
    return undefined;
  }
  const usage = normalizeUsage(result.usage);
  const evidence = normalizeEvidence(result.evidence);
  if (usage === undefined || evidence === undefined) return undefined;
  if (
    result.status === "pass" &&
    result.code === "pass" &&
    presentKeys.length === RESULT_REQUIRED_KEYS.length
  ) {
    return Object.freeze({
      status: "pass",
      tier: result.tier,
      stage: result.stage,
      code: "pass",
      usage,
      evidence,
    });
  }
  if (
    result.status !== "failure" ||
    !isFailureCode(result.code) ||
    (result.adapterSubcode !== undefined && !isBoundedText(result.adapterSubcode))
  ) {
    return undefined;
  }
  let cleanupBlocker:
    | { readonly code: "emulator-lease-recovery-blocked"; readonly evidenceDigest: string }
    | undefined;
  if (result.cleanupBlocker !== undefined) {
    const cleanup = readExecutionRecord(result.cleanupBlocker, CLEANUP_KEYS);
    if (
      cleanup === undefined ||
      cleanup.code !== "emulator-lease-recovery-blocked" ||
      !isExecutionDigest(cleanup.evidenceDigest)
    ) {
      return undefined;
    }
    cleanupBlocker = Object.freeze({
      code: "emulator-lease-recovery-blocked",
      evidenceDigest: cleanup.evidenceDigest,
    });
  }
  return Object.freeze({
    status: "failure",
    tier: result.tier,
    stage: result.stage,
    code: result.code,
    ...(result.adapterSubcode === undefined ? {} : { adapterSubcode: result.adapterSubcode }),
    usage,
    evidence,
    ...(cleanupBlocker === undefined ? {} : { cleanupBlocker }),
  });
}

function isReachableStage(route: ExecutionRoutePlanItemV1, stage: ExecutionStageV1): boolean {
  if (stage === "input" || stage === "capability") return true;
  const owner = STAGE_OWNER[stage];
  return (
    owner !== undefined && (owner === route.terminalTier || route.prerequisiteTiers.includes(owner))
  );
}

/**
 * Classifies a validated non-pass result against its authenticated route prefix.
 *
 * Known but disallowed tuples remain valid evidence and receive `unsupported`. Malformed values
 * receive an unsupported arm that omits caller data, so unsafe evidence cannot cross the boundary.
 *
 * @param route Untrusted route item that authenticates tier reachability.
 * @param result Untrusted terminal execution result.
 * @returns One immutable classification.
 *
 * @example
 * ```ts
 * const classification = classifyExecutionFailureV1(route, result);
 * ```
 */
export function classifyExecutionFailureV1(
  route: unknown,
  result: unknown,
): ExecutionOperationResultV1<ClassifiedFailureV1> {
  const normalizedRoute = readRoute(route);
  const normalizedResult = readExecutionResult(result);
  if (normalizedRoute === undefined || normalizedResult === undefined) {
    return success(
      Object.freeze({
        revision: "failure-disposition-v1",
        disposition: "unsupported",
        cleanup: "cleanup-clear",
      }),
    );
  }
  if (normalizedResult.status === "pass") {
    return success(
      Object.freeze({
        revision: "failure-disposition-v1",
        disposition: "unsupported",
        cleanup: "cleanup-clear",
        result: normalizedResult,
      }),
    );
  }
  const allowed =
    normalizedResult.tier === normalizedRoute.terminalTier &&
    isReachableStage(normalizedRoute, normalizedResult.stage) &&
    ALLOWED_STAGES[normalizedResult.code].has(normalizedResult.stage);
  const cleanup =
    normalizedResult.cleanupBlocker !== undefined ? "cleanup-blocked" : "cleanup-clear";
  return success(
    Object.freeze({
      revision: "failure-disposition-v1",
      disposition: allowed ? DISPOSITIONS[normalizedResult.code] : "unsupported",
      cleanup,
      result: normalizedResult,
    }),
  );
}

/**
 * Validates and freezes a version-one failure-reduction policy.
 *
 * @param input Untrusted policy candidate.
 * @returns Canonical policy or a closed schema issue.
 *
 * @example
 * ```ts
 * const parsed = parseFailureReductionPolicyV1(FAILURE_REDUCTION_DEFAULT_POLICY_V1);
 * ```
 */
export function parseFailureReductionPolicyV1(
  input: unknown,
): ExecutionOperationResultV1<FailureReductionPolicyV1> {
  const policy = readExecutionRecord(input, POLICY_KEYS);
  if (
    policy === undefined ||
    policy.revision !== "failure-reduction-policy-v1" ||
    policy.dispositionRevision !== "failure-disposition-v1" ||
    policy.catalogRevision !== "failure-reduction-catalog-v1" ||
    policy.normalizationRevision !== "failure-normalization-v1"
  ) {
    return issue(
      "execution.invalid-schema",
      "",
      "Failure-reduction policy must use the exact version-one shape.",
    );
  }
  const budget = readExecutionRecord(policy.budget, BUDGET_KEYS);
  if (budget === undefined) {
    return issue(
      "execution.invalid-schema",
      "/budget",
      "Failure-reduction budget must use the exact shape.",
    );
  }
  const parsed: Record<keyof FailureReductionBudgetV1, number> = {
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
  for (const key of BUDGET_KEYS) {
    const value = budget[key];
    const maximum = FAILURE_REDUCTION_MAXIMUM_BUDGET_V1[key];
    if (
      typeof value !== "number" ||
      !Number.isSafeInteger(value) ||
      value <= 0 ||
      value > maximum
    ) {
      return issue(
        "execution.invalid-schema",
        `/budget/${key}`,
        `Failure-reduction budget ${key} must be a positive safe integer no greater than ${maximum}.`,
      );
    }
    parsed[key] = value;
  }
  return success(
    Object.freeze({
      revision: "failure-reduction-policy-v1",
      dispositionRevision: "failure-disposition-v1",
      catalogRevision: "failure-reduction-catalog-v1",
      normalizationRevision: "failure-normalization-v1",
      budget: Object.freeze({ ...parsed }),
    }),
  );
}
