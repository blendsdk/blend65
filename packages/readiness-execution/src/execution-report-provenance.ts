import { createHash } from "node:crypto";

import type {
  ExecutionResultV1,
  ExecutionRoutePlanItemV1,
  FailureToolIdentityV1,
  PublishedSnapshot,
  Sha256Digest,
} from "@blend65/readiness";
import {
  getFailureEnvelopeSourceCandidateV1,
  type ReductionExecutionPayloadV1,
} from "@blend65/readiness/failure-reduction-internals";

import type { ExecutionAuthorityReportV1 } from "./execution-orchestration.js";
import type { ExecutionToolVersionV1 } from "./execution-orchestration-types.js";
import {
  getGeneratedExecutionCapabilityIdForRevisionV1,
  type ExecutionAuthorityContextV1,
} from "./execution-publication-catalog.js";
import type { ExecutionRouteRequestV1 } from "./execution-route-adapters.js";
import type {
  FailurePredicateEvidenceAuthorityV1,
  FailurePredicateEvidenceCompletionV1,
  FailurePredicateEvidenceV1,
} from "./failure-predicate-evidence.js";
import {
  getFailurePredicateEvidenceObservationBytesV1,
  getFailurePredicateEvidenceStateV1,
} from "./failure-predicate-evidence.js";
import {
  EXECUTION_REPORT_POSITION_AUTHORITY_V1,
  type ExecutionReportPositionAuthorityV1,
  type FailureExecutionOperationResultV1,
} from "./failure-execution-types.js";
import {
  failureExecutionIssueV1,
  failureExecutionSuccessV1,
} from "./failure-execution-operation.js";

/** Private live authority retained for one exact report position during orchestration. */
export interface ExecutionReportOccurrenceProvenanceInputV1 {
  /** Exact selected parent authority. */
  readonly parent: PublishedSnapshot;
  /** Exact reviewed handler context used for the route. */
  readonly execution: ExecutionAuthorityContextV1;
  /** Exact immutable route-plan occurrence. */
  readonly route: ExecutionRoutePlanItemV1;
  /** Genuine source-bound route request dispatched for this occurrence. */
  readonly request: ExecutionRouteRequestV1;
  /** Oracle and handler contract digests authenticated for this occurrence. */
  readonly completion: FailurePredicateEvidenceCompletionV1;
}

/** Private complete state for one exact report occurrence. */
export interface ExecutionReportOccurrenceStateV1 extends ExecutionReportOccurrenceProvenanceInputV1 {
  /** Zero-based exact report position. */
  readonly index: number;
  /** Exact canonical result stored at this report position. */
  readonly result: ExecutionResultV1;
  /** Genuine result-associated predicate sidecar authority. */
  readonly sidecar: FailurePredicateEvidenceAuthorityV1;
  /** Immutable predicate projection retained once by the genuine sidecar. */
  readonly sidecarProjection: FailurePredicateEvidenceV1;
}

/** Complete private route provenance retained beside one genuine report. */
export interface ExecutionReportProvenanceStateV1 {
  readonly report: ExecutionAuthorityReportV1;
  readonly routePlanBytes: Uint8Array;
  readonly toolIdentities: readonly FailureToolIdentityV1[];
  readonly occurrences: readonly ExecutionReportOccurrenceStateV1[];
  readonly positions: readonly ExecutionReportPositionAuthorityV1[];
}

/** Private binding from one opaque position to its exact report occurrence. */
export interface ExecutionReportPositionStateV1 {
  readonly report: ExecutionAuthorityReportV1;
  readonly occurrence: ExecutionReportOccurrenceStateV1;
}

const REPORTS = new WeakMap<object, ExecutionReportProvenanceStateV1>();
const POSITIONS = new WeakMap<object, ExecutionReportPositionStateV1>();
const PAYLOADS = new WeakMap<object, ReductionExecutionPayloadV1>();
const OCCURRENCES = new WeakSet<object>();

function sameRoute(
  route: ExecutionRoutePlanItemV1,
  request: ExecutionRouteRequestV1,
  report: ExecutionAuthorityReportV1,
  index: number,
): boolean {
  const record = report.routeRecords[index];
  return (
    record !== undefined &&
    request.kind !== "reduction-candidate-internal" &&
    JSON.stringify(route) === JSON.stringify(request.route) &&
    route.caseIdentity === record.caseIdentity &&
    route.ruleId === record.ruleId &&
    route.obligation === record.obligation &&
    route.terminalTier === record.terminalTier &&
    report.results[index] === record.result
  );
}

function toolKind(capabilityId: string): FailureToolIdentityV1["kind"] {
  return capabilityId === "acme" ? "assembler" : capabilityId === "vice" ? "emulator" : "compiler";
}

function completeToolIdentities(
  occurrences: readonly ExecutionReportOccurrenceProvenanceInputV1[],
  versions: readonly ExecutionToolVersionV1[] | undefined,
): readonly FailureToolIdentityV1[] | undefined {
  const required = new Set(
    occurrences.flatMap((occurrence) => occurrence.completion.toolContractDigests),
  );
  const identities: FailureToolIdentityV1[] = [];
  for (const digest of [...required].sort()) {
    const capabilityId = getGeneratedExecutionCapabilityIdForRevisionV1(digest);
    if (capabilityId === undefined || !Array.isArray(versions)) return undefined;
    const versionTool =
      capabilityId === "acme" ? "acme" : capabilityId === "vice" ? "vice" : "node";
    const version = versions.find((candidate) => candidate.tool === versionTool)?.version;
    if (version === undefined) return undefined;
    identities.push(
      Object.freeze({
        kind: toolKind(capabilityId),
        name: capabilityId,
        version,
        digest: digest as Sha256Digest,
      }),
    );
  }
  return Object.freeze(identities);
}

/** Retains exact ordered route provenance beside one complete authorized report. */
export function retainExecutionAuthorityReportProvenanceV1(
  report: ExecutionAuthorityReportV1,
  sidecars: readonly FailurePredicateEvidenceAuthorityV1[],
  occurrences: readonly ExecutionReportOccurrenceProvenanceInputV1[],
  routePlanBytes: Uint8Array,
): boolean {
  const retainedRoutePlanBytes =
    routePlanBytes instanceof Uint8Array ? routePlanBytes.slice() : undefined;
  const toolIdentities = completeToolIdentities(occurrences, report.toolVersions);
  if (
    sidecars.length !== report.results.length ||
    occurrences.length !== report.results.length ||
    REPORTS.has(report) ||
    retainedRoutePlanBytes === undefined ||
    retainedRoutePlanBytes.byteLength === 0 ||
    `sha256:${createHash("sha256").update(retainedRoutePlanBytes).digest("hex")}` !==
      report.routePlanDigest ||
    toolIdentities === undefined
  ) {
    return false;
  }
  const retained: ExecutionReportOccurrenceStateV1[] = [];
  const positions: ExecutionReportPositionAuthorityV1[] = [];
  for (let index = 0; index < report.results.length; index += 1) {
    const input = occurrences[index];
    const result = report.results[index];
    const sidecar = sidecars[index];
    const projection =
      sidecar === undefined ? undefined : getFailurePredicateEvidenceStateV1(sidecar);
    if (
      input === undefined ||
      result === undefined ||
      sidecar === undefined ||
      projection === undefined ||
      !sameRoute(input.route, input.request, report, index)
    ) {
      return false;
    }
    const occurrence: ExecutionReportOccurrenceStateV1 = Object.freeze({
      ...input,
      index,
      result,
      sidecar,
      sidecarProjection: projection,
    });
    const position: ExecutionReportPositionAuthorityV1 = Object.freeze({
      [EXECUTION_REPORT_POSITION_AUTHORITY_V1]: true as const,
    });
    POSITIONS.set(position, { report, occurrence });
    OCCURRENCES.add(occurrence);
    retained.push(occurrence);
    positions.push(position);
  }
  REPORTS.set(
    report,
    Object.freeze({
      report,
      routePlanBytes: retainedRoutePlanBytes,
      toolIdentities,
      occurrences: Object.freeze(retained),
      positions: Object.freeze(positions),
    }),
  );
  return true;
}

/** Derives and caches the canonical source payload only for a selected genuine occurrence. */
export function getExecutionReportOccurrencePayloadV1(
  occurrence: ExecutionReportOccurrenceStateV1,
): ReductionExecutionPayloadV1 | undefined {
  if (typeof occurrence !== "object" || occurrence === null || !OCCURRENCES.has(occurrence)) {
    return undefined;
  }
  const retained = PAYLOADS.get(occurrence);
  if (retained !== undefined) return retained;
  const request = occurrence.request;
  const payload =
    request.kind === "valid-envelope" || request.kind === undefined
      ? getFailureEnvelopeSourceCandidateV1({
          kind: "typed-valid",
          authority: request.executionCase,
        })
      : request.kind === "invalid-diagnostic"
        ? getFailureEnvelopeSourceCandidateV1({
            kind: "typed-invalid",
            authority: request.diagnosticCase,
          })
        : request.kind === "raw-malformed"
          ? getFailureEnvelopeSourceCandidateV1({
              kind: "raw-malformed",
              authority: request.malformedCase,
            })
          : undefined;
  if (payload !== undefined) PAYLOADS.set(occurrence, payload);
  return payload;
}

/** Returns a defensive observation-byte copy only for one selected genuine occurrence. */
export function getExecutionReportOccurrenceObservationBytesV1(
  occurrence: ExecutionReportOccurrenceStateV1,
): Uint8Array | undefined {
  return getFailurePredicateEvidenceObservationBytesV1(occurrence.sidecar);
}

/** Resolves complete private report provenance without accepting structural report copies. */
export function getExecutionAuthorityReportProvenanceStateV1(
  report: ExecutionAuthorityReportV1,
): ExecutionReportProvenanceStateV1 | undefined {
  return typeof report === "object" && report !== null ? REPORTS.get(report) : undefined;
}

/** Resolves one exact report-position authority and its occurrence. */
export function getExecutionReportPositionStateV1(
  position: ExecutionReportPositionAuthorityV1,
): ExecutionReportPositionStateV1 | undefined {
  return typeof position === "object" && position !== null ? POSITIONS.get(position) : undefined;
}

/** Returns the exact retained route request for one genuine opaque report position. */
export function getExecutionReportPositionRequestV1(
  position: ExecutionReportPositionAuthorityV1,
): FailureExecutionOperationResultV1<ExecutionRouteRequestV1> {
  const positioned = getExecutionReportPositionStateV1(position);
  return positioned === undefined
    ? failureExecutionIssueV1(
        "unbound-capability",
        "/position",
        "Report position authority is unavailable.",
      )
    : failureExecutionSuccessV1(positioned.occurrence.request);
}
