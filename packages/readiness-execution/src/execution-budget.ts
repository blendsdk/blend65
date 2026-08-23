import { createHash, type Hash } from "node:crypto";

import type {
  ExecutionEvidenceSummaryV1,
  ExecutionOperationIssueCodeV1,
  ExecutionOperationResultV1,
  ExecutionPolicyV1,
  ExecutionStageV1,
  ExecutionUsageV1,
} from "@blend65/readiness";
import {
  EXECUTION_MAXIMUM_BUDGET_V1,
  EXECUTION_STAGES_V1,
  isExecutionDigestV1,
} from "@blend65/readiness/execution-runtime";

import type { ExecutionCancellationV1 } from "./execution-worker-protocol.js";

/** Absolute hard/work deadlines for one route. */
export interface ExecutionDeadlineV1 {
  /** Final route deadline, including cleanup. */
  readonly hardDeadlineMs: number;
  /** Last instant at which ordinary work may run. */
  readonly workDeadlineMs: number;
  /** Fixed time reserved exclusively for cleanup. */
  readonly cleanupGraceMs: number;
}

/** One cumulative launch slot and its bounded deadline. */
export interface ExecutionLaunchAttemptV1 {
  /** One-based cumulative attempt number. */
  readonly ordinal: number;
  /** Earlier of the attempt cap and remaining work time. */
  readonly deadlineMonotonicMs: number;
}

/** Absolute emulator counter sample tied to one child identity. */
export interface ExecutionStopwatchSampleV1 {
  /** Closed stopwatch protocol revision. */
  readonly revision: "execution-stopwatch-sample-v1";
  /** Digest of the exact child whose counter was sampled. */
  readonly childIdentityDigest: string;
  /** Absolute non-decreasing cycle counter. */
  readonly absoluteCycles: bigint;
}

/** Lazy bounded evidence accumulator. */
export interface ExecutionEvidenceLedgerV1 {
  /** Appends a complete chunk, failing before mutation when it would exceed the limit. */
  append(bytes: Uint8Array): ExecutionOperationResultV1<ExecutionEvidenceSummaryV1>;
  /** Returns the current complete digest and retained byte count. */
  summarize(): ExecutionEvidenceSummaryV1;
}

/** Cumulative budget owner shared across route retries and child launches. */
export interface ExecutionBudgetScopeV1 {
  /** Route deadlines fixed at construction. */
  readonly deadline: ExecutionDeadlineV1;
  /** Starts one stage within the smaller operation/work deadline. */
  beginOperation(
    stage: ExecutionStageV1,
    nowMonotonicMs: number,
  ): ExecutionOperationResultV1<ExecutionCancellationV1>;
  /** Consumes one cumulative launch attempt. */
  beginLaunchAttempt(nowMonotonicMs: number): ExecutionOperationResultV1<ExecutionLaunchAttemptV1>;
  /** Charges aggregate child output. */
  chargeOutput(bytes: number): ExecutionOperationResultV1<ExecutionUsageV1>;
  /** Returns aggregate child-output capacity not yet charged. */
  remainingOutputBytes(): number;
  /** Charges retained evidence. */
  chargeEvidence(bytes: number): ExecutionOperationResultV1<ExecutionUsageV1>;
  /** Returns retained-evidence capacity not yet charged. */
  remainingEvidenceBytes(): number;
  /** Charges cumulative emulator instructions. */
  chargeInstructions(count: number): ExecutionOperationResultV1<ExecutionUsageV1>;
  /** Records the absolute baseline for one child stopwatch. */
  beginStopwatch(sample: unknown): ExecutionOperationResultV1<ExecutionUsageV1>;
  /** Charges a same-child non-decreasing absolute stopwatch delta. */
  completeStopwatch(sample: unknown): ExecutionOperationResultV1<ExecutionUsageV1>;
  /** Returns usage at a monotonic instant, enforcing the inclusive route bound. */
  snapshot(nowMonotonicMs: number): ExecutionOperationResultV1<ExecutionUsageV1>;
}

const STOPWATCH_KEYS = ["revision", "childIdentityDigest", "absoluteCycles"] as const;
const STAGES = new Set<ExecutionStageV1>(EXECUTION_STAGES_V1);
const MAX_LAUNCH_ATTEMPT_MS = 15_000;

function failure<T>(
  code: ExecutionOperationIssueCodeV1,
  path: string,
  message: string,
): ExecutionOperationResultV1<T> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([Object.freeze({ code, path, message })]) as readonly [
      {
        readonly code: ExecutionOperationIssueCodeV1;
        readonly path: string;
        readonly message: string;
      },
    ],
  });
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function evidenceSummary(hash: Hash, retainedBytes: number): ExecutionEvidenceSummaryV1 {
  return Object.freeze({
    digest: `sha256:${hash.copy().digest("hex")}`,
    retainedBytes,
    truncated: false,
  });
}

/**
 * Creates a hash-only evidence ledger whose memory use is independent of its byte limit.
 *
 * @param limitBytes Positive safe byte limit selected by policy.
 * @returns A fresh ledger or a schema issue.
 */
export function createExecutionEvidenceLedgerV1(
  limitBytes: number,
): ExecutionOperationResultV1<ExecutionEvidenceLedgerV1> {
  if (
    !Number.isSafeInteger(limitBytes) ||
    limitBytes <= 0 ||
    limitBytes > EXECUTION_MAXIMUM_BUDGET_V1.evidenceBytes
  ) {
    return failure("execution.invalid-schema", "/limitBytes", "Evidence limit is invalid.");
  }
  const hash = createHash("sha256");
  let retainedBytes = 0;
  const ledger: ExecutionEvidenceLedgerV1 = Object.freeze({
    append(bytes: Uint8Array): ExecutionOperationResultV1<ExecutionEvidenceSummaryV1> {
      if (!(bytes instanceof Uint8Array)) {
        return failure("invalid-evidence-input", "/bytes", "Evidence must be bytes.");
      }
      if (bytes.byteLength > limitBytes - retainedBytes) {
        return failure(
          "evidence-exhaustion",
          "/bytes",
          "Evidence exceeds the selected aggregate limit.",
        );
      }
      hash.update(bytes);
      retainedBytes += bytes.byteLength;
      return success(evidenceSummary(hash, retainedBytes));
    },
    summarize(): ExecutionEvidenceSummaryV1 {
      return evidenceSummary(hash, retainedBytes);
    },
  });
  return success(ledger);
}

/** Validates every selected maximum without requiring the canonical publication grace value. */
function validatePolicy(policy: ExecutionPolicyV1): boolean {
  if (policy.revision !== "execution-policy-v1") return false;
  const budget = policy.budget;
  for (const key of Object.keys(EXECUTION_MAXIMUM_BUDGET_V1) as (keyof typeof budget)[]) {
    const value = budget[key];
    if (!Number.isSafeInteger(value) || value <= 0 || value > EXECUTION_MAXIMUM_BUDGET_V1[key]) {
      return false;
    }
  }
  return budget.routeMs > budget.cleanupGraceMs;
}

/** Monotonic clocks may be fractional but must remain finite and non-negative. */
function isMonotonicTime(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/** Reads one exact external stopwatch record without invoking caller accessors. */
function readStopwatch(input: unknown): ExecutionStopwatchSampleV1 | undefined {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
    if (Object.getPrototypeOf(input) !== Object.prototype) return undefined;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== STOPWATCH_KEYS.length ||
      keys.some(
        (key) => typeof key !== "string" || !(STOPWATCH_KEYS as readonly string[]).includes(key),
      )
    ) {
      return undefined;
    }
    const values: Record<string, unknown> = {};
    for (const key of STOPWATCH_KEYS) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      values[key] = descriptor.value;
    }
    if (
      values.revision !== "execution-stopwatch-sample-v1" ||
      !isExecutionDigestV1(values.childIdentityDigest) ||
      typeof values.absoluteCycles !== "bigint" ||
      values.absoluteCycles < 0n
    ) {
      return undefined;
    }
    return Object.freeze({
      revision: "execution-stopwatch-sample-v1",
      childIdentityDigest: values.childIdentityDigest,
      absoluteCycles: values.absoluteCycles,
    });
  } catch {
    return undefined;
  }
}

/**
 * Creates one cumulative budget scope with a cleanup-reserved hard deadline.
 *
 * @param policy Closed selected execution policy.
 * @param startedAtMonotonicMs Monotonic route start time.
 * @returns A fresh scope or a schema issue.
 */
export function createExecutionBudgetScopeV1(
  policy: ExecutionPolicyV1,
  startedAtMonotonicMs: number,
): ExecutionOperationResultV1<ExecutionBudgetScopeV1> {
  if (!validatePolicy(policy) || !isMonotonicTime(startedAtMonotonicMs)) {
    return failure("execution.invalid-schema", "", "Execution budget scope input is invalid.");
  }
  const { budget } = policy;
  const deadline: ExecutionDeadlineV1 = Object.freeze({
    hardDeadlineMs: startedAtMonotonicMs + budget.routeMs,
    workDeadlineMs: startedAtMonotonicMs + budget.routeMs - budget.cleanupGraceMs,
    cleanupGraceMs: budget.cleanupGraceMs,
  });
  if (!Number.isFinite(deadline.hardDeadlineMs)) {
    return failure("execution.invalid-schema", "/startedAt", "Route deadline is not finite.");
  }

  let outputBytes = 0;
  let evidenceBytes = 0;
  let instructions = 0;
  let cycles = 0;
  let launchAttempts = 0;
  let stopwatch: ExecutionStopwatchSampleV1 | undefined;

  const usage = (wallMs = 0): ExecutionUsageV1 =>
    Object.freeze({ wallMs, outputBytes, evidenceBytes, instructions, cycles, launchAttempts });

  const charge = (
    amount: number,
    selectedLimit: number,
    current: number,
    code: "output-exhaustion" | "evidence-exhaustion" | "instruction-exhaustion",
    path: string,
    set: (next: number) => void,
  ): ExecutionOperationResultV1<ExecutionUsageV1> => {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      return failure("invalid-evidence-input", path, "Budget charge must be non-negative.");
    }
    if (amount > selectedLimit - current) {
      return failure(code, path, "Budget charge exceeds the selected cumulative limit.");
    }
    set(current + amount);
    return success(usage());
  };

  const scope: ExecutionBudgetScopeV1 = Object.freeze({
    deadline,
    beginOperation(
      stage: ExecutionStageV1,
      nowMonotonicMs: number,
    ): ExecutionOperationResultV1<ExecutionCancellationV1> {
      if (!STAGES.has(stage) || !isMonotonicTime(nowMonotonicMs)) {
        return failure("invalid-evidence-input", "/operation", "Operation input is invalid.");
      }
      if (nowMonotonicMs > deadline.workDeadlineMs) {
        return failure("wall-time-exhaustion", "/operation", "No work time remains.");
      }
      const controller = new AbortController();
      return success(
        Object.freeze({
          signal: controller.signal,
          deadlineMonotonicMs: Math.min(
            deadline.workDeadlineMs,
            nowMonotonicMs + budget.operationMs,
          ),
        }),
      );
    },
    beginLaunchAttempt(
      nowMonotonicMs: number,
    ): ExecutionOperationResultV1<ExecutionLaunchAttemptV1> {
      if (!isMonotonicTime(nowMonotonicMs)) {
        return failure("invalid-evidence-input", "/launch", "Launch time is invalid.");
      }
      if (launchAttempts >= budget.launchAttempts || nowMonotonicMs > deadline.workDeadlineMs) {
        return failure("emulator-launch-failure", "/launch", "No launch attempt remains.");
      }
      launchAttempts += 1;
      return success(
        Object.freeze({
          ordinal: launchAttempts,
          deadlineMonotonicMs: Math.min(
            deadline.workDeadlineMs,
            nowMonotonicMs + Math.min(budget.launchAttemptMs, MAX_LAUNCH_ATTEMPT_MS),
          ),
        }),
      );
    },
    chargeOutput(bytes: number): ExecutionOperationResultV1<ExecutionUsageV1> {
      return charge(
        bytes,
        budget.outputBytes,
        outputBytes,
        "output-exhaustion",
        "/output",
        (next) => {
          outputBytes = next;
        },
      );
    },
    remainingOutputBytes(): number {
      return budget.outputBytes - outputBytes;
    },
    chargeEvidence(bytes: number): ExecutionOperationResultV1<ExecutionUsageV1> {
      return charge(
        bytes,
        budget.evidenceBytes,
        evidenceBytes,
        "evidence-exhaustion",
        "/evidence",
        (next) => {
          evidenceBytes = next;
        },
      );
    },
    remainingEvidenceBytes(): number {
      return budget.evidenceBytes - evidenceBytes;
    },
    chargeInstructions(count: number): ExecutionOperationResultV1<ExecutionUsageV1> {
      return charge(
        count,
        budget.instructions,
        instructions,
        "instruction-exhaustion",
        "/instructions",
        (next) => {
          instructions = next;
        },
      );
    },
    beginStopwatch(input: unknown): ExecutionOperationResultV1<ExecutionUsageV1> {
      const parsed = readStopwatch(input);
      if (parsed === undefined || stopwatch !== undefined) {
        return failure("invalid-evidence-input", "/stopwatch", "Stopwatch sample is invalid.");
      }
      stopwatch = parsed;
      return success(usage());
    },
    completeStopwatch(input: unknown): ExecutionOperationResultV1<ExecutionUsageV1> {
      const parsed = readStopwatch(input);
      if (
        parsed === undefined ||
        stopwatch === undefined ||
        parsed.childIdentityDigest !== stopwatch.childIdentityDigest ||
        parsed.absoluteCycles < stopwatch.absoluteCycles
      ) {
        return failure("invalid-evidence-input", "/stopwatch", "Stopwatch pair is invalid.");
      }
      const delta = parsed.absoluteCycles - stopwatch.absoluteCycles;
      if (delta > BigInt(budget.cycles - cycles)) {
        return failure("cycle-exhaustion", "/stopwatch", "Cycle budget is exhausted.");
      }
      cycles += Number(delta);
      stopwatch = undefined;
      return success(usage());
    },
    snapshot(nowMonotonicMs: number): ExecutionOperationResultV1<ExecutionUsageV1> {
      if (!isMonotonicTime(nowMonotonicMs)) {
        return failure("invalid-evidence-input", "/now", "Snapshot time is invalid.");
      }
      if (nowMonotonicMs > deadline.hardDeadlineMs) {
        return failure("wall-time-exhaustion", "/now", "Route deadline is exhausted.");
      }
      return success(usage(Math.max(0, nowMonotonicMs - startedAtMonotonicMs)));
    },
  });
  return success(scope);
}
