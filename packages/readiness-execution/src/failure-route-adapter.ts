import { createHash } from "node:crypto";

import type {
  ExecutionOperationIssueCodeV1,
  ExecutionOperationResultV1,
  ExecutionResultV1,
  PublishedSnapshot,
  Sha256Digest,
} from "@blend65/readiness";
import {
  abandonReductionCandidateInvocationV1,
  consumeReductionCandidateInvocationV1,
  getFreshReductionCandidateInvocationStateV1,
  type ConsumedReductionInvocationV1,
  type ReductionCandidateInvocationV1,
  type ReductionExecutionPayloadV1,
} from "@blend65/readiness/failure-reduction-internals";

import {
  getLiveExecutionContextStateV1,
  type ExecutionAuthorityContextV1,
} from "./execution-publication-catalog.js";
import {
  createCandidateExecutionRouteRequestV1,
  type ExecutionRouteRequestV1,
} from "./execution-route-adapters.js";
import { getExecutionReportOccurrencePayloadV1 } from "./execution-report-provenance.js";
import type { ExecutionCancellationV1 } from "./execution-worker-protocol.js";
import {
  consumeFailureExecutionIsolationV1,
  getFailureExecutionPredicateV1,
  getFailureExecutionIsolationOccurrenceV1,
  getFailureExecutionProtocolStateV1,
  getReductionExecutionIsolationStateV1,
} from "./failure-execution-isolation.js";
import type {
  FailureExecutionControlAuthorityV1,
  FailureExecutionProtocolV1,
  ReductionCandidateExecutionEvaluationV1,
  ReductionExecutionIsolationV1,
  ReductionExecutionRouteRequestV1,
} from "./failure-execution-types.js";
import {
  consumeHandledFailurePredicateEvidenceV1,
  type FailurePredicateEvidenceAuthorityV1,
  type FailurePredicateEvidenceV1,
} from "./failure-predicate-evidence.js";

interface CandidateRequestStateV1 {
  readonly protocol: FailureExecutionProtocolV1;
  readonly isolation: ReductionExecutionIsolationV1;
  readonly consumed: ConsumedReductionInvocationV1;
  readonly tokenDigest: Sha256Digest;
  used: boolean;
}

/** Fixed-handler execution output retained for confirmation classification. */
export interface FailureRouteEvaluationV1 {
  /** Compatible route result. */
  readonly result: ExecutionResultV1;
  /** Genuine sidecar authority whose visible projection is stable. */
  readonly predicateEvidence: FailurePredicateEvidenceAuthorityV1 & FailurePredicateEvidenceV1;
  /** Stable digest binding result and sidecar. */
  readonly digest: Sha256Digest;
}

const REQUESTS = new WeakMap<object, CandidateRequestStateV1>();
function digest(value: unknown): Sha256Digest {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function issue<T>(
  code: ExecutionOperationIssueCodeV1,
  path: string,
  message: string,
): ExecutionOperationResultV1<T> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([Object.freeze({ code, path, message })]) as readonly [
      Readonly<{ code: typeof code; path: string; message: string }>,
    ],
  });
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function tokenDigest(
  invocation: ReductionCandidateInvocationV1,
  consumed: ConsumedReductionInvocationV1,
): Sha256Digest {
  return digest({
    domain: "blend65-reduction-evaluation-token-v1",
    candidateDigest: consumed.candidate.candidateDigest,
    purpose: consumed.purpose,
    proposalKind: consumed.proposalKind,
    sequence: consumed.sequence,
    tokenPresent: typeof invocation.token === "object" && invocation.token !== null,
  });
}

/**
 * Derives one closed candidate route after token, route, and isolation validation.
 *
 * @example
 * ```ts
 * const routed = createReductionExecutionRouteRequestV1(parent, invocation, isolation);
 * if (!routed.ok) throw new Error(routed.issues[0].message);
 * ```
 */
export function createReductionExecutionRouteRequestV1(
  parent: PublishedSnapshot,
  invocation: ReductionCandidateInvocationV1,
  isolation: ReductionExecutionIsolationV1,
): ExecutionOperationResultV1<ReductionExecutionRouteRequestV1> {
  const isolated = getReductionExecutionIsolationStateV1(isolation);
  if (isolated === undefined) {
    return issue("unbound-capability", "/isolation", "Isolation is not bound to this parent.");
  }
  const protocol = getFailureExecutionProtocolStateV1(isolated.protocol);
  if (protocol === undefined || protocol.parent !== parent) {
    return issue("unbound-capability", "/isolation", "Isolation is not bound to this parent.");
  }
  const freshInvocation = getFreshReductionCandidateInvocationStateV1(invocation);
  if (freshInvocation === undefined) {
    return issue("unbound-capability", "/invocation", "A fresh candidate invocation is required.");
  }
  if (
    (isolated.mode === "campaign-shared" && freshInvocation.purpose !== "reduction") ||
    (isolated.mode === "standalone" && freshInvocation.purpose !== "confirmation") ||
    isolated.mode === "sequence-attempt"
  ) {
    if (
      isolated.mode === "standalone" &&
      isolated.subject !== undefined &&
      isolated.subject !== invocation &&
      "revision" in isolated.subject &&
      isolated.subject.revision === "reduction-candidate-invocation-v1"
    ) {
      abandonReductionCandidateInvocationV1(isolated.subject);
    }
    return issue(
      "unbound-capability",
      "/invocation/purpose",
      "Invocation purpose does not match isolation mode.",
    );
  }
  const consumedIsolation = consumeFailureExecutionIsolationV1(isolation, invocation);
  if (!consumedIsolation.ok) {
    if (
      isolated.mode === "standalone" &&
      isolated.subject !== undefined &&
      isolated.subject !== invocation &&
      "revision" in isolated.subject &&
      isolated.subject.revision === "reduction-candidate-invocation-v1"
    ) {
      abandonReductionCandidateInvocationV1(isolated.subject);
    }
    return consumedIsolation;
  }
  const consumed = consumeReductionCandidateInvocationV1(invocation);
  if (!consumed.ok) {
    abandonReductionCandidateInvocationV1(invocation);
    return consumed;
  }
  if (
    JSON.stringify(consumed.value.candidate.originalRoute) !==
      JSON.stringify(protocol.context.predicate.routeContract) ||
    JSON.stringify(consumed.value.candidate.predicate) !==
      JSON.stringify(protocol.context.predicate)
  ) {
    return issue(
      "execution.identity",
      "/candidate",
      "Candidate and historical route do not match.",
    );
  }
  const request: ReductionExecutionRouteRequestV1 = Object.freeze({
    kind: "reduction-candidate",
    invocation,
    isolation,
  });
  REQUESTS.set(request, {
    protocol: isolated.protocol,
    isolation,
    consumed: consumed.value,
    tokenDigest: tokenDigest(invocation, consumed.value),
    used: false,
  });
  return success(request);
}

function cancellationFor(request: ExecutionRouteRequestV1): ExecutionCancellationV1 {
  const controller = new AbortController();
  return Object.freeze({
    signal: controller.signal,
    deadlineMonotonicMs: performance.now() + request.policy.budget.routeMs,
  });
}

async function executePayload(
  execution: ExecutionAuthorityContextV1,
  protocol: FailureExecutionProtocolV1,
  isolation: ReductionExecutionIsolationV1,
  payload: ReductionExecutionPayloadV1,
  subjectDigest: Sha256Digest,
  consumed?: ConsumedReductionInvocationV1,
  occurrence = getFailureExecutionProtocolStateV1(protocol)?.context.subject,
): Promise<ExecutionOperationResultV1<FailureRouteEvaluationV1>> {
  const protocolState = getFailureExecutionProtocolStateV1(protocol);
  const isolationState = getReductionExecutionIsolationStateV1(isolation);
  const live = getLiveExecutionContextStateV1(execution);
  if (
    protocolState === undefined ||
    isolationState?.protocol !== protocol ||
    protocolState.execution !== execution ||
    occurrence === undefined ||
    occurrence.execution !== execution ||
    live === undefined
  ) {
    return issue(
      "unbound-capability",
      "/execution",
      "Execution context or isolation is unavailable.",
    );
  }
  const adapted = createCandidateExecutionRouteRequestV1({
    originalRequest: occurrence.request,
    payload,
    ...(consumed === undefined ? {} : { consumed }),
    predicate: protocolState.context.predicate,
    subjectDigest,
    workerExecutor: isolationState.executor,
  });
  if (!adapted.ok) return adapted;
  const handler = live.handlers[adapted.value.route.terminalTier];
  let result: ExecutionResultV1;
  try {
    result = await handler.execute(adapted.value, cancellationFor(adapted.value));
  } catch {
    return issue("execution.io", "/handler", "Published route handler terminated unexpectedly.");
  }
  const sidecar = consumeHandledFailurePredicateEvidenceV1(result, result);
  if (sidecar === undefined) {
    return issue(
      "invalid-evidence-input",
      "/handler/result",
      "Published handler result lacks exact predicate evidence authority.",
    );
  }
  const evidence = sidecar as FailurePredicateEvidenceAuthorityV1 & FailurePredicateEvidenceV1;
  const evaluationDigest = digest({
    domain: "blend65-failure-route-evaluation-v1",
    subjectDigest,
    result,
    predicateEvidenceDigest: evidence.digest,
  });
  return success(Object.freeze({ result, predicateEvidence: evidence, digest: evaluationDigest }));
}

/**
 * Executes one genuine candidate request exactly once through retained published handlers.
 *
 * @example
 * ```ts
 * const evaluated = await executeReductionCandidateV1(execution, routed.value);
 * if (evaluated.ok) console.log(evaluated.value.result.status);
 * ```
 */
export async function executeReductionCandidateV1(
  execution: ExecutionAuthorityContextV1,
  request: ReductionExecutionRouteRequestV1,
): Promise<ExecutionOperationResultV1<ReductionCandidateExecutionEvaluationV1>> {
  const state = typeof request === "object" && request !== null ? REQUESTS.get(request) : undefined;
  if (state === undefined || state.used) {
    return issue(
      "unbound-capability",
      "/request",
      "Candidate route request is forged or replayed.",
    );
  }
  state.used = true;
  const evaluated = await executePayload(
    execution,
    state.protocol,
    state.isolation,
    state.consumed.payload,
    state.consumed.candidate.candidateExecutionIdentity,
    state.consumed,
  );
  if (!evaluated.ok) return evaluated;
  const value: ReductionCandidateExecutionEvaluationV1 = Object.freeze({
    revision: "reduction-candidate-evaluation-v1",
    evaluationTokenDigest: state.tokenDigest,
    result: evaluated.value.result,
    predicateEvidence: evaluated.value.predicateEvidence,
    digest: digest({
      domain: "blend65-reduction-candidate-evaluation-v1",
      evaluationTokenDigest: state.tokenDigest,
      evaluationDigest: evaluated.value.digest,
    }),
  });
  return success(value);
}

/** Executes the exact original payload with one authenticated isolated worker owner. */
export async function executeFailureOriginalRouteV1(
  execution: ExecutionAuthorityContextV1,
  protocol: FailureExecutionProtocolV1,
  isolation: ReductionExecutionIsolationV1,
): Promise<ExecutionOperationResultV1<FailureRouteEvaluationV1>> {
  const state = getFailureExecutionProtocolStateV1(protocol);
  const occurrence = getFailureExecutionIsolationOccurrenceV1(isolation);
  if (state === undefined || occurrence === undefined) {
    return issue("unbound-capability", "/origin", "Original payload is unavailable.");
  }
  const payload = getExecutionReportOccurrencePayloadV1(occurrence);
  if (payload === undefined) {
    return issue("invalid-evidence-input", "/origin", "Original payload is unavailable.");
  }
  return executePayload(
    execution,
    protocol,
    isolation,
    payload,
    occurrence.request.route.caseIdentity as Sha256Digest,
    undefined,
    occurrence,
  );
}

/** Executes an already-consumed candidate payload for confirmation and sequence coordination. */
export async function executeConsumedFailureCandidateV1(
  execution: ExecutionAuthorityContextV1,
  protocol: FailureExecutionProtocolV1,
  isolation: ReductionExecutionIsolationV1,
  consumed: ConsumedReductionInvocationV1,
): Promise<ExecutionOperationResultV1<FailureRouteEvaluationV1>> {
  const state = getFailureExecutionProtocolStateV1(protocol);
  if (
    state === undefined ||
    JSON.stringify(consumed.candidate.originalRoute) !==
      JSON.stringify(state.context.predicate.routeContract) ||
    JSON.stringify(consumed.candidate.predicate) !== JSON.stringify(state.context.predicate)
  ) {
    return issue(
      "execution.identity",
      "/candidate",
      "Candidate and historical route do not match.",
    );
  }
  return executePayload(
    execution,
    protocol,
    isolation,
    consumed.payload,
    consumed.candidate.candidateExecutionIdentity,
    consumed,
  );
}

/** Consumes one confirmation invocation without exposing its closed execution payload. */
export function consumeConfirmationInvocationV1(
  invocation: ReductionCandidateInvocationV1,
): ExecutionOperationResultV1<ConsumedReductionInvocationV1> {
  const consumed = consumeReductionCandidateInvocationV1(invocation);
  return consumed.ok && consumed.value.purpose === "confirmation"
    ? consumed
    : issue("unbound-capability", "/invocation", "A fresh confirmation invocation is required.");
}

/** Resolves the exact original request retained by a genuine protocol. */
export function getFailureExecutionOriginalRequestV1(
  protocol: FailureExecutionProtocolV1,
): ExecutionRouteRequestV1 | undefined {
  return getFailureExecutionProtocolStateV1(protocol)?.originalRequest;
}

/** Resolves the exact historical predicate retained by a genuine protocol. */
export function getFailureRoutePredicateV1(protocol: FailureExecutionProtocolV1) {
  return getFailureExecutionPredicateV1(protocol);
}

/** Type anchor for standalone subject validation. */
export type FailureExecutionStandaloneSubjectV1 =
  | ReductionCandidateInvocationV1
  | FailureExecutionControlAuthorityV1;
