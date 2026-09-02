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
  getCandidateExecutionRouteStateV1,
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
import {
  prepareCandidateEvaluatedViceRouteV1,
  prepareIsolatedEvaluatedViceRouteV1,
} from "./execution-vice-build.js";
import { getFinalViceResultObservationEvidenceV1 } from "./execution-vice-evaluation.js";
import type { ExecutionCancellationV1 } from "./execution-worker-protocol.js";
import {
  createNotReachedFailureObservationEvidenceV1,
  registerHandledFailurePredicateEvidenceV1,
} from "./failure-predicate-evidence.js";

const EMPTY_USAGE: ExecutionUsageV1 = Object.freeze({
  wallMs: 0,
  outputBytes: 0,
  evidenceBytes: 0,
  instructions: 0,
  cycles: 0,
  launchAttempts: 0,
});

function failureEvidence(caseIdentity: string, code: string): ExecutionEvidenceSummaryV1 {
  const bytes = failureEvidenceBytes(caseIdentity, code);
  const digest = createHash("sha256").update(bytes).digest("hex");
  return Object.freeze({
    digest: `sha256:${digest}`,
    retainedBytes: 0,
    truncated: false,
  });
}

function failureEvidenceBytes(caseIdentity: string, code: string): Uint8Array {
  return new TextEncoder().encode(
    `blend65-live-execution-handler-failure-v1\0${caseIdentity}\0${code}`,
  );
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
  const candidate = getCandidateExecutionRouteStateV1(request);
  if (
    request.kind === "invalid-diagnostic" ||
    request.kind === "raw-malformed" ||
    request.route.terminalTier !== "vice" ||
    cancellation.signal.aborted
  ) {
    return failed("vice", "input", "invalid-evidence-input", request.route.caseIdentity);
  }
  const original = candidate?.originalRequest ?? request;
  if (original.kind !== "valid-envelope" && original.kind !== undefined) {
    return failed("vice", "input", "invalid-evidence-input", request.route.caseIdentity);
  }
  let prepared;
  if (candidate === undefined) {
    const evaluation = createPublishedRuntimeEvaluationAuthorityV1(
      original.oracle,
      original.executionCase,
    );
    prepared = evaluation.ok
      ? await prepareEvaluatedViceRouteV1(
          original.executionCase,
          evaluation.value,
          request.policy,
          cancellation.signal,
        )
      : undefined;
  } else {
    const consumed = candidate.consumed;
    if (candidate.family !== "typed-valid" || candidate.workerExecutor === undefined) {
      return failed("vice", "input", "invalid-evidence-input", request.route.caseIdentity);
    }
    if (consumed === undefined) {
      const evaluation = createPublishedRuntimeEvaluationAuthorityV1(
        original.oracle,
        original.executionCase,
      );
      prepared = evaluation.ok
        ? await prepareIsolatedEvaluatedViceRouteV1(
            original.executionCase,
            evaluation.value,
            request.policy,
            cancellation.signal,
            candidate.workerExecutor,
          )
        : undefined;
    } else {
      prepared = await prepareCandidateEvaluatedViceRouteV1(
        original.executionCase,
        original.oracle,
        consumed,
        request.policy,
        cancellation.signal,
        candidate.workerExecutor,
      );
    }
  }
  if (prepared === undefined) {
    return failed("vice", "input", "invalid-evidence-input", request.route.caseIdentity);
  }
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
  const workerExecutor =
    getCandidateExecutionRouteStateV1(request)?.workerExecutor ?? defaultExecutionWorkerExecutorV1;
  const supervisor = createExecutionSupervisorV1(request.policy, {
    workerExecutor,
  });
  if (!supervisor.ok) {
    const result = failed(tier, "input", "invalid-evidence-input", request.route.caseIdentity);
    registerHandledFailurePredicateEvidenceV1(
      request,
      result,
      createNotReachedFailureObservationEvidenceV1(result),
    );
    return result;
  }
  const handlers = createExecutionRouteHandlersV1({
    worker: { executor: workerExecutor },
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
    result =
      result.status === "failure"
        ? Object.freeze({ ...result, cleanupBlocker: blocker })
        : Object.freeze({
            status: "failure" as const,
            tier,
            stage: "cleanup" as const,
            code: "emulator-lease-recovery-blocked" as const,
            usage: result.usage,
            evidence: result.evidence,
            cleanupBlocker: blocker,
          });
  }
  registerHandledFailurePredicateEvidenceV1(
    request,
    result,
    result.status === "failure" ? createNotReachedFailureObservationEvidenceV1(result) : undefined,
  );
  return result;
}

function compilerHandler(tier: Exclude<ExecutionTierV1, "vice">): ExecutionRouteHandlerV1 {
  return Object.freeze({
    execute: (request: ExecutionRouteRequestV1, cancellation: ExecutionCancellationV1) =>
      executeCompilerRoute(tier, request, cancellation),
  });
}

async function executePublishedVice(
  request: ExecutionRouteRequestV1,
  cancellation: ExecutionCancellationV1,
): Promise<ExecutionResultV1> {
  const result = await executeVice(request, cancellation);
  registerHandledFailurePredicateEvidenceV1(
    request,
    result,
    getFinalViceResultObservationEvidenceV1(result) ??
      (result.status === "failure"
        ? createNotReachedFailureObservationEvidenceV1(result)
        : undefined),
  );
  return result;
}

/** Creates the closed real six-handler table used by reviewed live contexts. */
export function createLiveExecutionHandlersV1(): PublishedExecutionHandlersV1 {
  return Object.freeze({
    frontend: compilerHandler("frontend"),
    "compiler-api": compilerHandler("compiler-api"),
    cli: compilerHandler("cli"),
    emit: compilerHandler("emit"),
    acme: compilerHandler("acme"),
    vice: Object.freeze({ execute: executePublishedVice }),
  });
}
