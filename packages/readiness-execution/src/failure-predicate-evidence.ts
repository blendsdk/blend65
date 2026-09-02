import { createHash } from "node:crypto";

import type {
  ExecutionOperationResultV1,
  ExecutionResultV1,
  FailureObservationIdentityV1,
  FailurePredicateV1,
  Sha256Digest,
} from "@blend65/readiness";
import {
  parseFailurePredicateIngredientsV1,
  type FailurePredicateIngredientsV1,
} from "@blend65/readiness/failure-predicate-ingredients";
import { getFailureEnvelopeSourceClaimsV1 } from "@blend65/readiness/failure-reduction-internals";
import {
  getExecutionCaseProjectionV1,
  getMalformedDiagnosticCaseProjectionV1,
  isExecutionDigestV1,
} from "@blend65/readiness/execution-runtime";
import { getPublishedDiagnosticCaseProjectionV1 } from "@blend65/readiness/published-oracle";

import { deriveExecutionFixtureDigestV1 } from "./execution-envelope.js";
import { cloneFrozenFailureExecutionValueV1 } from "./failure-execution-immutable.js";
import {
  getCandidateExecutionRouteStateV1,
  type ExecutionRouteRequestV1,
} from "./execution-route-adapters.js";
import {
  FAILURE_PREDICATE_EVIDENCE_AUTHORITY_V1,
  type CandidateFailurePredicateEvidenceV1,
  type ClosedNonExecutedFailurePredicateEvidenceV1,
  type FailurePredicateEvidenceAuthorityV1,
  type FailurePredicateEvidenceOutcomeV1,
  type FailurePredicateEvidenceRouteV1,
  type FailurePredicateEvidenceV1,
  type OrdinaryFailurePredicateEvidenceV1,
} from "./failure-predicate-evidence-model.js";

export {
  FAILURE_PREDICATE_EVIDENCE_AUTHORITY_V1,
  type CandidateFailurePredicateEvidenceV1,
  type ClosedNonExecutedFailurePredicateEvidenceV1,
  type FailurePredicateEvidenceAuthorityV1,
  type FailurePredicateEvidenceOutcomeV1,
  type FailurePredicateEvidenceRouteV1,
  type FailurePredicateEvidenceV1,
  type OrdinaryFailurePredicateEvidenceV1,
} from "./failure-predicate-evidence-model.js";

/** Authenticated orchestration facts unavailable to a terminal route handler. */
export interface FailurePredicateEvidenceCompletionV1 {
  /** Exact selected published oracle authority digest. */
  readonly oracleContractDigest: Sha256Digest;
  /** Exact route-relevant handler implementation revisions. */
  readonly toolContractDigests: readonly Sha256Digest[];
}

interface FailurePredicateEvidenceStateV1 {
  readonly projection: FailurePredicateEvidenceV1;
  readonly result: ExecutionResultV1;
  readonly observation?: FailureObservationEvidenceStateV1;
}

interface HandledResultStateV1 {
  readonly request: ExecutionRouteRequestV1;
  readonly result: ExecutionResultV1;
  readonly observation?: FailureObservationEvidenceStateV1;
  consumed: boolean;
}

/** Opaque private authority for one explicitly classified observation boundary. */
export interface FailureObservationEvidenceAuthorityV1 {
  readonly revision: "failure-observation-evidence-authority-v1";
}

/** Path-free classification and identity for private canonical observation bytes. */
export interface FailureObservationEvidenceProjectionV1 {
  readonly revision: "failure-observation-evidence-projection-v1";
  readonly kind: "observed" | "not-reached";
  readonly digest: Sha256Digest;
  readonly byteLength: number;
}

interface FailureObservationEvidenceStateV1 {
  readonly kind: "observed" | "not-reached";
  readonly bytes: Uint8Array;
  readonly projectedByteLength: number;
}

const STATES = new WeakMap<object, FailurePredicateEvidenceStateV1>();
const HANDLED_RESULTS = new WeakMap<object, HandledResultStateV1>();
const AUTHENTICATED_RESULTS = new WeakSet<object>();
const OBSERVATIONS = new WeakMap<object, FailureObservationEvidenceStateV1>();
const MAX_PRIVATE_OBSERVATION_BYTES = 16_777_216;
const ENCODER = new TextEncoder();

function digest(value: unknown): Sha256Digest {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function observation(
  result: ExecutionResultV1,
  retained: FailureObservationEvidenceStateV1,
): FailureObservationIdentityV1 {
  const evidenceDigest =
    `sha256:${createHash("sha256").update(retained.bytes).digest("hex")}` as const;
  return retained.kind === "observed"
    ? Object.freeze({ kind: "observed", digest: evidenceDigest })
    : Object.freeze({
        kind: "not-reached",
        stage: result.stage,
        terminalReasonDigest: evidenceDigest,
      });
}

function retainObservation(
  kind: FailureObservationEvidenceStateV1["kind"],
  bytes: Uint8Array,
  projectedByteLength = bytes.byteLength,
): FailureObservationEvidenceAuthorityV1 | undefined {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength > MAX_PRIVATE_OBSERVATION_BYTES ||
    !Number.isSafeInteger(projectedByteLength) ||
    projectedByteLength < 0 ||
    projectedByteLength > MAX_PRIVATE_OBSERVATION_BYTES
  ) {
    return undefined;
  }
  const authority: FailureObservationEvidenceAuthorityV1 = Object.freeze({
    revision: "failure-observation-evidence-authority-v1",
  });
  OBSERVATIONS.set(authority, Object.freeze({ kind, bytes: bytes.slice(), projectedByteLength }));
  return authority;
}

/** Mints exact canonical bytes at an authenticated runtime observation boundary. */
export function createObservedFailureObservationEvidenceV1(actual: {
  readonly kind: "scalar-bytes" | "direct-mmio";
  readonly address?: number;
  readonly projectionRevision?: string;
  readonly bytes: Uint8Array;
}): FailureObservationEvidenceAuthorityV1 | undefined {
  if (!(actual.bytes instanceof Uint8Array) || actual.bytes.byteLength > 65_536) return undefined;
  return retainObservation(
    "observed",
    ENCODER.encode(
      JSON.stringify({
        revision: "runtime-observation-facts-v1",
        kind: actual.kind,
        address: actual.address ?? null,
        projectionRevision: actual.projectionRevision ?? null,
        bytes: [...actual.bytes],
      }),
    ),
    actual.bytes.byteLength,
  );
}

/** Mints reproducible terminal facts for a route that never reached runtime observation. */
export function createNotReachedFailureObservationEvidenceV1(
  result: ExecutionResultV1,
): FailureObservationEvidenceAuthorityV1 | undefined {
  return retainObservation(
    "not-reached",
    ENCODER.encode(
      JSON.stringify({
        revision: "terminal-observation-facts-v1",
        stage: result.stage,
        code: result.code,
        adapterSubcode: result.status === "failure" ? (result.adapterSubcode ?? null) : null,
      }),
    ),
  );
}

function observationState(
  authority: FailureObservationEvidenceAuthorityV1 | undefined,
): FailureObservationEvidenceStateV1 | undefined {
  return authority === undefined ? undefined : OBSERVATIONS.get(authority);
}

/** Projects the arm and digest of a genuine observation authority without exposing its bytes. */
export function getFailureObservationEvidenceProjectionV1(
  authority: FailureObservationEvidenceAuthorityV1,
): FailureObservationEvidenceProjectionV1 | undefined {
  const retained = observationState(authority);
  return retained === undefined
    ? undefined
    : Object.freeze({
        revision: "failure-observation-evidence-projection-v1",
        kind: retained.kind,
        digest: `sha256:${createHash("sha256").update(retained.bytes).digest("hex")}`,
        byteLength: retained.projectedByteLength,
      });
}

function outcome(result: ExecutionResultV1): FailurePredicateEvidenceOutcomeV1 {
  return Object.freeze({
    status: result.status,
    tier: result.tier,
    stage: result.stage,
    code: result.code,
    evidenceDigest: result.evidence.digest,
    ...(result.status === "failure" && result.adapterSubcode !== undefined
      ? { adapterSubcode: result.adapterSubcode }
      : {}),
    cleanup:
      result.status === "failure" && result.cleanupBlocker !== undefined ? "blocked" : "clear",
  });
}

function authorityFor(
  projection: FailurePredicateEvidenceV1,
  result: ExecutionResultV1,
  retainedObservation?: FailureObservationEvidenceStateV1,
): FailurePredicateEvidenceAuthorityV1 {
  const retainedProjection = cloneFrozenFailureExecutionValueV1(projection);
  const authority: FailurePredicateEvidenceAuthorityV1 = Object.freeze({
    ...retainedProjection,
    [FAILURE_PREDICATE_EVIDENCE_AUTHORITY_V1]: true as const,
  });
  STATES.set(
    authority,
    Object.freeze({
      projection: retainedProjection,
      result,
      ...(retainedObservation === undefined ? {} : { observation: retainedObservation }),
    }),
  );
  AUTHENTICATED_RESULTS.add(result);
  return authority;
}

/** Reports whether an exact result object has authenticated predicate evidence. */
export function isPredicateEvidenceAuthenticatedResultV1(result: unknown): boolean {
  return typeof result === "object" && result !== null && AUTHENTICATED_RESULTS.has(result);
}

function candidateAuthority(
  subjectDigest: Sha256Digest,
  predicate: FailurePredicateV1,
  result: ExecutionResultV1,
  retainedObservation?: FailureObservationEvidenceStateV1,
): FailurePredicateEvidenceAuthorityV1 {
  const stable = {
    revision: "failure-predicate-evidence-v1" as const,
    kind: "candidate-full-predicate" as const,
    subjectDigest,
    predicate: cloneFrozenFailureExecutionValueV1(predicate),
    resultCode: result.code,
    observation:
      retainedObservation === undefined
        ? predicate.observation
        : observation(result, retainedObservation),
    outcome: outcome(result),
  };
  const projection: CandidateFailurePredicateEvidenceV1 = Object.freeze({
    ...stable,
    digest: digest(stable),
  });
  return authorityFor(projection, result, retainedObservation);
}

function invalid<T>(path: string, message: string): ExecutionOperationResultV1<T> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([
      Object.freeze({ code: "invalid-evidence-input" as const, path, message }),
    ]) as readonly [
      Readonly<{ readonly code: "invalid-evidence-input"; path: string; message: string }>,
    ],
  });
}

function ordinaryRouteFacts(
  request: ExecutionRouteRequestV1,
): ExecutionOperationResultV1<FailurePredicateEvidenceRouteV1> {
  let requestKind: FailurePredicateEvidenceRouteV1["requestKind"];
  let sourceDigest: string;
  if (request.kind === "valid-envelope" || request.kind === undefined) {
    requestKind = "valid-envelope";
    const projected = getExecutionCaseProjectionV1(request.executionCase);
    if (!projected.ok) return invalid("/request/executionCase", "Execution case is unavailable.");
    sourceDigest = projected.value.sourceCaseDigest;
  } else if (request.kind === "invalid-diagnostic") {
    requestKind = "invalid-diagnostic";
    const projected = getPublishedDiagnosticCaseProjectionV1(request.diagnosticCase);
    if (!projected.ok) {
      return invalid("/request/diagnosticCase", "Diagnostic case is unavailable.");
    }
    sourceDigest = projected.value.authority.sourceContentIdentity;
  } else if (request.kind === "raw-malformed") {
    requestKind = "raw-malformed";
    const projected = getMalformedDiagnosticCaseProjectionV1(request.malformedCase);
    if (!projected.ok) return invalid("/request/malformedCase", "Malformed case is unavailable.");
    sourceDigest = projected.value.textDigest;
  } else {
    return invalid("/request", "Candidate routes require the full-predicate evidence arm.");
  }
  if (!isExecutionDigestV1(request.route.caseIdentity) || !isExecutionDigestV1(sourceDigest)) {
    return invalid("/request/route", "Route and source identities must be canonical digests.");
  }
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      requestKind,
      caseIdentity: request.route.caseIdentity,
      rankDigest: request.route.rankDigest,
      ruleId: request.route.ruleId,
      obligation: request.route.obligation,
      terminalTier: request.route.terminalTier,
      prerequisiteTiers: Object.freeze([...request.route.prerequisiteTiers]),
      policy: cloneFrozenFailureExecutionValueV1(request.policy),
      subjectDigest: request.route.caseIdentity,
      sourceDigest,
    }),
  });
}

function fixtureDigest(request: ExecutionRouteRequestV1): Sha256Digest | undefined {
  const fixture =
    request.kind === "valid-envelope" || request.kind === undefined
      ? getExecutionCaseProjectionV1(request.executionCase)
      : undefined;
  const derived = deriveExecutionFixtureDigestV1(
    fixture?.ok === true
      ? fixture.value.fixture
      : Object.freeze({ revision: "c64-vic-color-readback-v1" as const, cells: Object.freeze([]) }),
  );
  return derived.ok && isExecutionDigestV1(derived.value)
    ? (derived.value as Sha256Digest)
    : undefined;
}

function policyDigest(request: ExecutionRouteRequestV1): Sha256Digest {
  return digest({ revision: request.policy.revision, budget: request.policy.budget });
}

function ingredients(
  request: ExecutionRouteRequestV1,
  result: ExecutionResultV1,
  completion: FailurePredicateEvidenceCompletionV1,
  retainedObservation: FailureObservationEvidenceStateV1,
): FailurePredicateIngredientsV1 | undefined {
  if (result.status !== "failure") return undefined;
  const derivedFixtureDigest = fixtureDigest(request);
  const source =
    request.kind === "valid-envelope" || request.kind === undefined
      ? ({ kind: "typed-valid" as const, authority: request.executionCase } as const)
      : request.kind === "invalid-diagnostic"
        ? ({ kind: "typed-invalid" as const, authority: request.diagnosticCase } as const)
        : request.kind === "raw-malformed"
          ? ({ kind: "raw-malformed" as const, authority: request.malformedCase } as const)
          : undefined;
  const requiredClaimedRuleIds =
    source === undefined ? undefined : getFailureEnvelopeSourceClaimsV1(source);
  if (
    derivedFixtureDigest === undefined ||
    requiredClaimedRuleIds === undefined ||
    !requiredClaimedRuleIds.includes(request.route.ruleId)
  ) {
    return undefined;
  }
  const parsed = parseFailurePredicateIngredientsV1({
    revision: "failure-predicate-ingredients-v1",
    resultCode: result.code,
    terminalTier: result.tier,
    terminalStage: result.stage,
    observation: observation(result, retainedObservation),
    cleanup: result.cleanupBlocker === undefined ? "cleanup-clear" : "cleanup-blocked",
    primaryRuleId: request.route.ruleId,
    requiredClaimedRuleIds,
    target: "c64",
    routeContract: {
      originalRouteKind:
        request.kind === "valid-envelope" || request.kind === undefined
          ? "valid-envelope"
          : "invalid-diagnostic",
      terminalTier: request.route.terminalTier,
      obligation: request.route.obligation,
      prerequisiteTiers: request.route.prerequisiteTiers,
      policyDigest: policyDigest(request),
      fixtureDigest: derivedFixtureDigest,
      oracleContractDigest: completion.oracleContractDigest,
      toolContractDigests: completion.toolContractDigests,
    },
  });
  return parsed.ok ? parsed.value : undefined;
}

function predicateBasis(
  request: ExecutionRouteRequestV1,
  result: ExecutionResultV1,
  completion: FailurePredicateEvidenceCompletionV1,
  retainedObservation?: FailureObservationEvidenceStateV1,
): OrdinaryFailurePredicateEvidenceV1["predicateBasis"] | undefined {
  if (result.status === "pass") return Object.freeze({ kind: "pass" as const });
  if (retainedObservation === undefined) return undefined;
  const value = ingredients(request, result, completion, retainedObservation);
  return value === undefined
    ? undefined
    : Object.freeze({ kind: "failure-ingredients" as const, value });
}

function ordinaryAuthority(
  request: ExecutionRouteRequestV1,
  result: ExecutionResultV1,
  associatedResult: ExecutionResultV1,
  completion: FailurePredicateEvidenceCompletionV1,
  retainedObservation?: FailureObservationEvidenceStateV1,
): FailurePredicateEvidenceAuthorityV1 | undefined {
  const route = ordinaryRouteFacts(request);
  const basis = predicateBasis(request, result, completion, retainedObservation);
  if (!route.ok || basis === undefined) return undefined;
  const stable = {
    revision: "failure-predicate-evidence-v1" as const,
    kind: "ordinary-route-facts" as const,
    subjectDigest: route.value.subjectDigest as Sha256Digest,
    route: route.value,
    outcome: outcome(result),
    predicateBasis: basis,
  };
  const projection: OrdinaryFailurePredicateEvidenceV1 = Object.freeze({
    ...stable,
    digest: digest(stable),
  });
  return authorityFor(projection, associatedResult, retainedObservation);
}

/** Records an exact final live-handler result after route cleanup completes. */
export function registerHandledFailurePredicateEvidenceV1(
  request: ExecutionRouteRequestV1,
  result: ExecutionResultV1,
  observationAuthority?: FailureObservationEvidenceAuthorityV1,
): boolean {
  if (typeof result !== "object" || result === null || HANDLED_RESULTS.has(result)) return false;
  const retainedObservation = observationState(observationAuthority);
  if (result.status === "failure" && retainedObservation === undefined) {
    return false;
  }
  HANDLED_RESULTS.set(result, {
    request,
    result,
    ...(retainedObservation === undefined ? {} : { observation: retainedObservation }),
    consumed: false,
  });
  return true;
}

/** Consumes one exact live-handler registration into a report- or candidate-bound sidecar. */
export function consumeHandledFailurePredicateEvidenceV1(
  result: ExecutionResultV1,
  associatedResult: ExecutionResultV1,
  completion?: FailurePredicateEvidenceCompletionV1,
): FailurePredicateEvidenceAuthorityV1 | undefined {
  const retained =
    typeof result === "object" && result !== null ? HANDLED_RESULTS.get(result) : undefined;
  if (retained === undefined || retained.consumed || retained.result !== result) return undefined;
  const candidate = getCandidateExecutionRouteStateV1(retained.request);
  const authority =
    candidate === undefined
      ? completion === undefined
        ? undefined
        : ordinaryAuthority(
            retained.request,
            associatedResult,
            associatedResult,
            completion,
            retained.observation,
          )
      : completion !== undefined || !isExecutionDigestV1(candidate.subjectDigest)
        ? undefined
        : candidateAuthority(
            candidate.subjectDigest,
            candidate.predicate,
            associatedResult,
            retained.observation,
          );
  if (authority === undefined) return undefined;
  retained.consumed = true;
  return authority;
}

/** Mints a closed orchestration-owned sidecar for a route that was never dispatched. */
export function createClosedNonExecutedFailurePredicateEvidenceV1(
  request: ExecutionRouteRequestV1,
  _result: ExecutionResultV1,
  associatedResult: ExecutionResultV1,
  disposition: ClosedNonExecutedFailurePredicateEvidenceV1["disposition"],
  completion: FailurePredicateEvidenceCompletionV1,
): FailurePredicateEvidenceAuthorityV1 | undefined {
  const route = ordinaryRouteFacts(request);
  const retainedObservation =
    associatedResult.status === "failure"
      ? observationState(createNotReachedFailureObservationEvidenceV1(associatedResult))
      : undefined;
  const basis = predicateBasis(request, associatedResult, completion, retainedObservation);
  if (!route.ok || basis === undefined) return undefined;
  const stable = {
    revision: "failure-predicate-evidence-v1" as const,
    kind: "closed-non-executed" as const,
    disposition,
    subjectDigest: route.value.subjectDigest as Sha256Digest,
    route: route.value,
    outcome: outcome(associatedResult),
    predicateBasis: basis,
  };
  const projection: ClosedNonExecutedFailurePredicateEvidenceV1 = Object.freeze({
    ...stable,
    digest: digest(stable),
  });
  return authorityFor(projection, associatedResult, retainedObservation);
}

/** Returns a defensive projection only for genuine privately minted sidecars. */
export function getFailurePredicateEvidenceProjectionV1(
  authority: FailurePredicateEvidenceAuthorityV1,
): FailurePredicateEvidenceV1 | undefined {
  const retained =
    typeof authority === "object" && authority !== null ? STATES.get(authority) : undefined;
  return retained === undefined ? undefined : structuredClone(retained.projection);
}

/** Returns a fresh private copy of canonical observation bytes for one genuine sidecar. */
export function getFailurePredicateEvidenceObservationBytesV1(
  authority: FailurePredicateEvidenceAuthorityV1,
): Uint8Array | undefined {
  const retained =
    typeof authority === "object" && authority !== null ? STATES.get(authority) : undefined;
  return retained?.observation?.bytes.slice();
}

/** Resolves private sidecar state without granting mint authority. */
export function getFailurePredicateEvidenceStateV1(
  authority: unknown,
): FailurePredicateEvidenceV1 | undefined {
  return typeof authority === "object" && authority !== null
    ? STATES.get(authority)?.projection
    : undefined;
}

/** Proves that a genuine sidecar was minted for this exact result object. */
export function failurePredicateEvidenceMatchesResultV1(
  authority: unknown,
  result: unknown,
): boolean {
  return (
    typeof authority === "object" &&
    authority !== null &&
    typeof result === "object" &&
    result !== null &&
    STATES.get(authority)?.result === result
  );
}
