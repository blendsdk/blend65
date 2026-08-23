import { createHash } from "node:crypto";

import type {
  ExecutionEvidenceSummaryV1,
  ExecutionOperationResultV1,
  ExecutionResultV1,
  ExecutionUsageV1,
  PublishedRuntimeEvaluationAuthorityV1,
  PublishedRuntimeEvaluationProjectionV1,
} from "@blend65/readiness";
import {
  evaluatePublishedRuntimeObservationV1,
  getPublishedRuntimeEvaluationProjectionV1,
} from "@blend65/readiness/execution-runtime";

import {
  BOUND_EVALUATED_VICE_ROUTE_BRAND,
  type BoundEvaluatedViceRouteRequestV1,
  type ViceRouteRequestV1,
} from "./execution-vice-types.js";
import { FIXED_EVALUATED_VICE_HANDLER_IDENTITY_DIGEST_V1 } from "./execution-vice-handler-identity.js";

const ENCODER = new TextEncoder();
const EVIDENCE_RETAINED_BYTES = 32;

interface BoundEvaluationRouteState {
  readonly routeIdentity: string;
  readonly routeFingerprint: string;
  readonly route: ViceRouteRequestV1;
  readonly evaluation: PublishedRuntimeEvaluationAuthorityV1;
  readonly projection: PublishedRuntimeEvaluationProjectionV1;
  readonly baseline: SealedViceBuildBaselineV1;
  state: "fresh" | "consumed";
}

/** Private cumulative production-build facts retained only by an opaque bound route. */
export interface SealedViceBuildBaselineV1 {
  readonly startedAtMonotonicMs: number;
  readonly workDeadlineMonotonicMs: number;
  readonly hardDeadlineMonotonicMs: number;
  readonly usage: ExecutionUsageV1;
  readonly evidence: ExecutionEvidenceSummaryV1;
}

/** Trusted private inputs accepted only from the sealed production build module. */
export interface SealBoundViceRouteInputV1 {
  readonly sourceCaseDigest: string;
  readonly routeIdentity: string;
  readonly handlerIdentityDigest: string;
  readonly route: ViceRouteRequestV1;
  readonly evaluation: PublishedRuntimeEvaluationAuthorityV1;
  readonly baseline: SealedViceBuildBaselineV1;
}

/** Private claimed state returned only to the default production coordinator. */
export interface ClaimedBoundViceRouteV1 {
  readonly routeIdentity: string;
  readonly route: ViceRouteRequestV1;
  readonly evaluation: PublishedRuntimeEvaluationAuthorityV1;
  readonly projection: PublishedRuntimeEvaluationProjectionV1;
  readonly baseline: SealedViceBuildBaselineV1;
}

/** Private evidence ingredients retained without raw actual observation bytes. */
export interface ViceEvaluationEvidenceContextV1 {
  /** Exact post-build route identity authenticated before monitor access. */
  readonly routeIdentity: string;
  /** Readiness-owned selected semantic evaluation identity. */
  readonly evaluationIdentity: string;
  /** Canonical digest of the private actual observation record. */
  readonly actualObservationDigest: string;
  /** Closed readiness comparison decision. */
  readonly outcome: "match" | "semantic-mismatch" | "invalid";
  /** Exact digest of all retained preparation evidence, when production-bound. */
  readonly buildEvidenceDigest?: string;
}

const BOUND_EVALUATION_ROUTES = new WeakMap<object, BoundEvaluationRouteState>();
const CLAIMED_EVALUATIONS = new WeakSet<object>();
const PENDING_EVALUATION_EVIDENCE = new WeakMap<object, ViceEvaluationEvidenceContextV1>();

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function failure<T>(path: string, message: string): ExecutionOperationResultV1<T> {
  const issues = Object.freeze([
    Object.freeze({ code: "execution.stale-authority" as const, path, message }),
  ]) as readonly [Readonly<{ code: "execution.stale-authority"; path: string; message: string }>];
  return Object.freeze({
    ok: false,
    issues,
  });
}

function sha256Bytes(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function sha256Json(value: unknown): string {
  return sha256Bytes(ENCODER.encode(JSON.stringify(value)));
}

function sameFixture(
  route: ViceRouteRequestV1,
  projection: PublishedRuntimeEvaluationProjectionV1,
): boolean {
  return (
    route.fixture.revision === projection.fixture.revision &&
    route.fixture.cells.length === projection.fixture.cells.length &&
    route.fixture.cells.every((cell, index) => {
      const expected = projection.fixture.cells[index];
      return expected?.address === cell.address && expected.logicalValue === cell.logicalValue;
    })
  );
}

function sameObservation(
  route: ViceRouteRequestV1,
  projection: PublishedRuntimeEvaluationProjectionV1,
): boolean {
  const actual = route.observation;
  const expected = projection.observation;
  return (
    actual.kind === expected.kind &&
    actual.byteLength === expected.byteLength &&
    actual.address === expected.address &&
    actual.projectionRevision === expected.projectionRevision
  );
}

function sealedBaseline(
  input: SealedViceBuildBaselineV1,
  route: ViceRouteRequestV1,
): SealedViceBuildBaselineV1 | undefined {
  const usage = input.usage;
  const evidence = input.evidence;
  if (
    !Number.isFinite(input.startedAtMonotonicMs) ||
    input.startedAtMonotonicMs < 0 ||
    !Number.isFinite(input.workDeadlineMonotonicMs) ||
    input.workDeadlineMonotonicMs < input.startedAtMonotonicMs ||
    !Number.isFinite(input.hardDeadlineMonotonicMs) ||
    input.hardDeadlineMonotonicMs <= input.workDeadlineMonotonicMs ||
    input.hardDeadlineMonotonicMs - input.startedAtMonotonicMs !== route.policy.budget.routeMs ||
    input.hardDeadlineMonotonicMs - input.workDeadlineMonotonicMs !==
      route.policy.budget.cleanupGraceMs ||
    !Number.isFinite(usage.wallMs) ||
    usage.wallMs < 0 ||
    !Number.isSafeInteger(usage.outputBytes) ||
    usage.outputBytes < 0 ||
    usage.outputBytes > route.policy.budget.outputBytes ||
    !Number.isSafeInteger(usage.evidenceBytes) ||
    usage.evidenceBytes < 0 ||
    usage.evidenceBytes > route.policy.budget.evidenceBytes ||
    !Number.isSafeInteger(usage.instructions) ||
    usage.instructions < 0 ||
    usage.instructions > route.policy.budget.instructions ||
    !Number.isSafeInteger(usage.cycles) ||
    usage.cycles < 0 ||
    usage.cycles > route.policy.budget.cycles ||
    !Number.isSafeInteger(usage.launchAttempts) ||
    usage.launchAttempts < 0 ||
    usage.launchAttempts > route.policy.budget.launchAttempts ||
    !/^sha256:[0-9a-f]{64}$/u.test(evidence.digest) ||
    evidence.retainedBytes !== usage.evidenceBytes ||
    evidence.truncated
  ) {
    return undefined;
  }
  return Object.freeze({
    startedAtMonotonicMs: input.startedAtMonotonicMs,
    workDeadlineMonotonicMs: input.workDeadlineMonotonicMs,
    hardDeadlineMonotonicMs: input.hardDeadlineMonotonicMs,
    usage: Object.freeze({ ...usage }),
    evidence: Object.freeze({ ...evidence }),
  });
}

/** Derives the exact assembled-route fingerprint available at both binding and admission. */
export function deriveViceRouteFingerprintV1(
  projection: PublishedRuntimeEvaluationProjectionV1,
  route: ViceRouteRequestV1,
): string {
  return sha256Json({
    domain: "blend65-evaluated-vice-route-fingerprint-v1",
    sourceCaseDigest: projection.sourceCaseDigest,
    selectedReleaseDigest: projection.selectedReleaseDigest,
    evaluationIdentity: projection.evaluationIdentity,
    binaryDigest: sha256Bytes(route.binary),
    loadAddress: route.loadAddress,
    entryAddress: route.entryAddress,
    fixture: route.fixture,
    layout: route.layout,
    observation: route.observation,
    policy: route.policy,
  });
}

/** Seals one trusted build while consuming a cross-paired evaluation before rejection. */
export function sealBoundViceRouteV1(
  input: SealBoundViceRouteInputV1,
): ExecutionOperationResultV1<BoundEvaluatedViceRouteRequestV1> {
  const authority = input.evaluation;
  if (
    typeof authority !== "object" ||
    authority === null ||
    CLAIMED_EVALUATIONS.has(authority) ||
    !/^sha256:[0-9a-f]{64}$/u.test(input.routeIdentity)
  ) {
    return failure("/evaluation", "Runtime evaluation authority is already claimed or invalid.");
  }
  const projection = getPublishedRuntimeEvaluationProjectionV1(authority);
  if (!projection.ok) {
    return failure("/evaluation", "Runtime evaluation authority is unavailable.");
  }
  CLAIMED_EVALUATIONS.add(authority);
  const baseline = sealedBaseline(input.baseline, input.route);
  if (
    projection.value.sourceCaseDigest !== input.sourceCaseDigest ||
    input.handlerIdentityDigest !== FIXED_EVALUATED_VICE_HANDLER_IDENTITY_DIGEST_V1 ||
    !sameFixture(input.route, projection.value) ||
    !sameObservation(input.route, projection.value) ||
    baseline === undefined
  ) {
    evaluatePublishedRuntimeObservationV1(authority, null);
    return failure("/evaluation", "Runtime evaluation authority does not match the sealed build.");
  }
  const routeFingerprint = deriveViceRouteFingerprintV1(projection.value, input.route);
  const bound: BoundEvaluatedViceRouteRequestV1 = Object.freeze({
    [BOUND_EVALUATED_VICE_ROUTE_BRAND]: true as const,
  });
  BOUND_EVALUATION_ROUTES.set(bound, {
    routeIdentity: input.routeIdentity,
    routeFingerprint,
    route: input.route,
    evaluation: authority,
    projection: projection.value,
    baseline,
    state: "fresh",
  });
  return success(bound);
}

/** Reports whether a value is a genuine sealed production route. */
export function isBoundViceRouteV1(value: unknown): value is BoundEvaluatedViceRouteRequestV1 {
  return typeof value === "object" && value !== null && BOUND_EVALUATION_ROUTES.has(value);
}

/** Consumes one sealed production route for the default coordinator only. */
export function claimBoundViceRouteV1(
  authority: BoundEvaluatedViceRouteRequestV1,
): ClaimedBoundViceRouteV1 | undefined {
  if (typeof authority !== "object" || authority === null) return undefined;
  const state = BOUND_EVALUATION_ROUTES.get(authority);
  if (state === undefined || state.state !== "fresh") return undefined;
  state.state = "consumed";
  return Object.freeze({
    routeIdentity: state.routeIdentity,
    route: state.route,
    evaluation: state.evaluation,
    projection: state.projection,
    baseline: state.baseline,
  });
}

/** Claims one unbound evaluation only for an explicitly injected caller-owned host. */
export function claimUnboundViceEvaluationV1(
  authority: PublishedRuntimeEvaluationAuthorityV1,
  routeFingerprint: string,
): string | undefined {
  if (typeof authority !== "object" || authority === null || CLAIMED_EVALUATIONS.has(authority)) {
    return undefined;
  }
  CLAIMED_EVALUATIONS.add(authority);
  return routeFingerprint;
}

/** Hashes an actual observation before its private raw byte buffer is discarded. */
export function deriveActualObservationDigestV1(actual: {
  readonly revision: "runtime-actual-observation-v1";
  readonly sourceCaseDigest: string;
  readonly kind: "scalar-bytes" | "direct-mmio";
  readonly address?: number | undefined;
  readonly projectionRevision?: string | undefined;
  readonly bytes: Uint8Array;
}): string {
  return sha256Json({
    domain: "blend65-runtime-actual-observation-v1",
    revision: actual.revision,
    sourceCaseDigest: actual.sourceCaseDigest,
    kind: actual.kind,
    address: actual.address ?? null,
    projectionRevision: actual.projectionRevision ?? null,
    byteLength: actual.bytes.byteLength,
    bytesDigest: sha256Bytes(actual.bytes),
  });
}

/** Retains only canonical evidence identities while cleanup and final wall accounting complete. */
export function attachViceEvaluationEvidenceV1(
  result: ExecutionResultV1,
  context: ViceEvaluationEvidenceContextV1,
): ExecutionResultV1 {
  PENDING_EVALUATION_EVIDENCE.set(result, context);
  return result;
}

/** Copies a private evidence association when a terminal result is rebuilt. */
export function propagateViceEvaluationEvidenceV1(
  source: ExecutionResultV1,
  target: ExecutionResultV1,
): ExecutionResultV1 {
  const context = PENDING_EVALUATION_EVIDENCE.get(source);
  if (context !== undefined) PENDING_EVALUATION_EVIDENCE.set(target, context);
  return target;
}

/** Finalizes canonical public evidence after cleanup and complete runtime accounting. */
export function finalizeViceEvaluationEvidenceV1(
  result: ExecutionResultV1,
  evidenceLimitBytes: number,
): ExecutionResultV1 {
  const context = PENDING_EVALUATION_EVIDENCE.get(result);
  if (context === undefined) return result;
  PENDING_EVALUATION_EVIDENCE.delete(result);
  if (result.usage.evidenceBytes + EVIDENCE_RETAINED_BYTES > evidenceLimitBytes) {
    return Object.freeze({
      ...result,
      status: "failure" as const,
      stage: "compare" as const,
      code: "evidence-exhaustion" as const,
    });
  }
  const evidenceBytes = result.usage.evidenceBytes + EVIDENCE_RETAINED_BYTES;
  // The route identity already commits the wall-clock budget. Measured wall time depends on host
  // scheduling, so retaining it would make identical machine observations produce different
  // evidence identities. Deterministic instruction, cycle, attempt and byte counters remain bound.
  const canonical = {
    domain: "blend65-evaluated-vice-evidence-v1",
    routeIdentity: context.routeIdentity,
    evaluationIdentity: context.evaluationIdentity,
    actualObservationDigest: context.actualObservationDigest,
    decision: context.outcome,
    ...(context.buildEvidenceDigest === undefined
      ? {}
      : { buildEvidenceDigest: context.buildEvidenceDigest }),
    terminal: {
      status: result.status,
      tier: result.tier,
      stage: result.stage,
      code: result.code,
      adapterSubcode: result.status === "failure" ? (result.adapterSubcode ?? null) : null,
      cleanupBlocker: result.status === "failure" ? (result.cleanupBlocker ?? null) : null,
    },
    usage: {
      outputBytes: result.usage.outputBytes,
      evidenceBytes,
      instructions: result.usage.instructions,
      cycles: result.usage.cycles,
      launchAttempts: result.usage.launchAttempts,
    },
  };
  return Object.freeze({
    ...result,
    usage: Object.freeze({ ...result.usage, evidenceBytes }),
    evidence: Object.freeze({
      digest: createHash("sha256")
        .update(ENCODER.encode(JSON.stringify(canonical)))
        .digest("hex"),
      retainedBytes: evidenceBytes,
      truncated: false,
    }),
  });
}
