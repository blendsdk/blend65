import type {
  ExecutionOperationResultV1,
  ExecutionTierV1,
  FailurePredicateV1,
  Sha256Digest,
} from "@blend65/readiness";
import type {
  ConsumedReductionInvocationV1,
  ReductionExecutionPayloadV1,
} from "@blend65/readiness/failure-reduction-internals";
import { isExecutionDigestV1 } from "@blend65/readiness/execution-runtime";

import type {
  CandidateExecutionRouteRequestV1,
  ExecutionRouteRequestV1,
} from "./execution-route-adapters.js";
import {
  isGenuineExecutionRouteRequestV1,
  registerExecutionRouteRequestV1,
} from "./execution-route-authority.js";
import type { ExecutionWorkerExecutorV1 } from "./execution-worker-protocol.js";

/** Trusted private inputs for one candidate-relative adapter request. */
export interface CreateCandidateExecutionRouteRequestInputV1 {
  /** Genuine original route request. */
  readonly originalRequest: ExecutionRouteRequestV1;
  /** Closed candidate payload. */
  readonly payload: ReductionExecutionPayloadV1;
  /** Genuine consumed invocation retained for candidate runtime evaluation. */
  readonly consumed?: ConsumedReductionInvocationV1;
  /** Historical predicate evaluated after execution. */
  readonly predicate: FailurePredicateV1;
  /** Candidate-relative execution identity. */
  readonly subjectDigest: Sha256Digest;
  /** Authenticated worker owner selected by isolation mode. */
  readonly workerExecutor: ExecutionWorkerExecutorV1;
}

/** Private state consumed only by the fixed handler chain. */
export interface CandidateExecutionRouteStateV1 {
  readonly family: ReductionExecutionPayloadV1["kind"];
  readonly payload: ReductionExecutionPayloadV1;
  readonly predicate: FailurePredicateV1;
  readonly subjectDigest: Sha256Digest;
  readonly originalRequest: ExecutionRouteRequestV1;
  readonly workerExecutor: ExecutionWorkerExecutorV1;
  readonly consumed?: ConsumedReductionInvocationV1;
}

const CANDIDATE_ROUTE_STATES = new WeakMap<object, CandidateExecutionRouteStateV1>();

function failure<T>(path: string, message: string): ExecutionOperationResultV1<T> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([
      Object.freeze({ code: "invalid-evidence-input" as const, path, message }),
    ]) as readonly [
      { readonly code: "invalid-evidence-input"; readonly path: string; readonly message: string },
    ],
  });
}

/** Creates the private candidate arm consumed by the existing handler chain. */
export function createCandidateExecutionRouteRequestV1(
  input: CreateCandidateExecutionRouteRequestInputV1,
): ExecutionOperationResultV1<ExecutionRouteRequestV1> {
  if (
    !isGenuineExecutionRouteRequestV1(input.originalRequest) ||
    input.originalRequest.kind === "reduction-candidate-internal" ||
    !isExecutionDigestV1(input.subjectDigest) ||
    (input.payload.sourceBytes.byteLength === 0 && input.payload.kind !== "raw-malformed")
  ) {
    return failure("/candidate", "Candidate route authority or payload is invalid.");
  }
  const original = input.originalRequest;
  const route = Object.freeze({
    ...original.route,
    caseIdentity: input.subjectDigest,
    prerequisiteTiers: Object.freeze([...original.route.prerequisiteTiers]),
  });
  const request: CandidateExecutionRouteRequestV1<ExecutionTierV1> = Object.freeze({
    kind: "reduction-candidate-internal",
    route,
    policy: original.policy,
  });
  registerExecutionRouteRequestV1(request);
  CANDIDATE_ROUTE_STATES.set(
    request,
    Object.freeze({
      family: input.payload.kind,
      payload: input.payload,
      predicate: input.predicate,
      subjectDigest: input.subjectDigest,
      originalRequest: original,
      workerExecutor: input.workerExecutor,
      ...(input.consumed === undefined ? {} : { consumed: input.consumed }),
    }),
  );
  return Object.freeze({ ok: true, value: request });
}

/** Resolves private candidate state for fixed live handlers and adapters. */
export function getCandidateExecutionRouteStateV1(
  request: ExecutionRouteRequestV1,
): CandidateExecutionRouteStateV1 | undefined {
  return typeof request === "object" && request !== null
    ? CANDIDATE_ROUTE_STATES.get(request)
    : undefined;
}
