import { createHash } from "node:crypto";

import type {
  ExecutionEvidenceSummaryV1,
  ExecutionResultCodeV1,
  ExecutionResultV1,
  ExecutionStageV1,
  ExecutionTierV1,
  ExecutionUsageV1,
} from "@blend65/readiness";
import { createPublishedRuntimeEvaluationAuthorityV1 } from "@blend65/readiness/execution-runtime";

import {
  createExecutionRouteHandlersV1,
  type ExecutionRouteHandlerV1,
  type ExecutionRouteRequestV1,
  type PublishedExecutionHandlersV1,
} from "./execution-route-adapters.js";
import { createExecutionSupervisorV1 } from "./execution-supervisor.js";
import { defaultExecutionWorkerExecutorV1 } from "./execution-worker-executor.js";
import {
  acquireViceLeaseV1,
  executeEvaluatedViceRouteV1,
  prepareEvaluatedViceRouteV1,
} from "./execution-vice.js";
import type { ExecutionCancellationV1 } from "./execution-worker-protocol.js";

const EMPTY_USAGE: ExecutionUsageV1 = Object.freeze({
  wallMs: 0,
  outputBytes: 0,
  evidenceBytes: 0,
  instructions: 0,
  cycles: 0,
  launchAttempts: 0,
});

function failureEvidence(caseIdentity: string, code: string): ExecutionEvidenceSummaryV1 {
  const digest = createHash("sha256")
    .update("blend65-live-execution-handler-failure-v1\0")
    .update(caseIdentity)
    .update("\0")
    .update(code)
    .digest("hex");
  return Object.freeze({
    digest: `sha256:${digest}`,
    retainedBytes: 0,
    truncated: false,
  });
}

function failed(
  tier: ExecutionTierV1,
  stage: ExecutionStageV1,
  code: Exclude<ExecutionResultCodeV1, "pass">,
  caseIdentity: string,
): ExecutionResultV1 {
  return Object.freeze({
    status: "failure",
    tier,
    stage,
    code,
    usage: EMPTY_USAGE,
    evidence: failureEvidence(caseIdentity, code),
  });
}

async function executeVice(
  request: ExecutionRouteRequestV1,
  cancellation: ExecutionCancellationV1,
): Promise<ExecutionResultV1> {
  if (
    request.kind === "invalid-diagnostic" ||
    request.route.terminalTier !== "vice" ||
    cancellation.signal.aborted
  ) {
    return failed("vice", "input", "invalid-evidence-input", request.route.caseIdentity);
  }
  const evaluation = createPublishedRuntimeEvaluationAuthorityV1(
    request.oracle,
    request.executionCase,
  );
  if (!evaluation.ok) {
    return failed("vice", "input", "invalid-evidence-input", request.route.caseIdentity);
  }
  const prepared = await prepareEvaluatedViceRouteV1(
    request.executionCase,
    evaluation.value,
    request.policy,
    cancellation.signal,
  );
  if (!prepared.ok) {
    return failed("vice", "emit", "emission-failure", request.route.caseIdentity);
  }
  const lease = await acquireViceLeaseV1("c64", cancellation.signal);
  if (!lease.ok) {
    const unavailable = lease.issues.some((issue) => issue.code === "tier-unavailable");
    return failed(
      "vice",
      "vice-launch",
      unavailable ? "tier-unavailable" : "emulator-lease-recovery-blocked",
      request.route.caseIdentity,
    );
  }
  return executeEvaluatedViceRouteV1(prepared.value.request, lease.value, cancellation.signal);
}

async function executeCompilerRoute(
  tier: Exclude<ExecutionTierV1, "vice">,
  request: ExecutionRouteRequestV1,
  cancellation: ExecutionCancellationV1,
): Promise<ExecutionResultV1> {
  const supervisor = createExecutionSupervisorV1(request.policy, {
    workerExecutor: defaultExecutionWorkerExecutorV1,
  });
  if (!supervisor.ok) {
    return failed(tier, "input", "invalid-evidence-input", request.route.caseIdentity);
  }
  const handlers = createExecutionRouteHandlersV1({
    worker: { executor: defaultExecutionWorkerExecutorV1 },
    acme: {},
    lifecycle: { supervisor: supervisor.value },
    vice: { execute: executeVice },
  });
  let result: ExecutionResultV1;
  try {
    result = await handlers[tier].execute(request, cancellation);
  } catch {
    result = failed(tier, tier, "compiler-ice", request.route.caseIdentity);
  }
  const cleanup = await supervisor.value.cleanup().catch(() => undefined);
  if (cleanup === undefined || !cleanup.ok || !cleanup.value.ok) {
    const blocker =
      cleanup?.ok === true && cleanup.value.blocker !== undefined
        ? cleanup.value.blocker
        : Object.freeze({
            code: "emulator-lease-recovery-blocked" as const,
            evidenceDigest: failureEvidence(request.route.caseIdentity, "cleanup").digest,
          });
    if (result.status === "failure") return Object.freeze({ ...result, cleanupBlocker: blocker });
    return Object.freeze({
      status: "failure" as const,
      tier,
      stage: "cleanup" as const,
      code: "emulator-lease-recovery-blocked" as const,
      usage: result.usage,
      evidence: result.evidence,
      cleanupBlocker: blocker,
    });
  }
  return result;
}

function compilerHandler(tier: Exclude<ExecutionTierV1, "vice">): ExecutionRouteHandlerV1 {
  return Object.freeze({
    execute: (request: ExecutionRouteRequestV1, cancellation: ExecutionCancellationV1) =>
      executeCompilerRoute(tier, request, cancellation),
  });
}

/** Creates the closed real six-handler table used by reviewed live contexts. */
export function createLiveExecutionHandlersV1(): PublishedExecutionHandlersV1 {
  return Object.freeze({
    frontend: compilerHandler("frontend"),
    "compiler-api": compilerHandler("compiler-api"),
    cli: compilerHandler("cli"),
    emit: compilerHandler("emit"),
    acme: compilerHandler("acme"),
    vice: Object.freeze({ execute: executeVice }),
  });
}
