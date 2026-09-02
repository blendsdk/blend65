import {
  authorizeFailureEnvelopeV1,
  deriveFailurePredicateIdentityV1,
  type AuthorizedFailureEnvelopeV1,
  type ExecutionOperationResultV1,
  type FailureEnvelopeSourceAuthorityV1,
  type FailureReductionPolicyV1,
  type FailureToolIdentityV1,
} from "@blend65/readiness";

import {
  getExecutionAuthorityReportProvenanceStateV1,
  getExecutionReportOccurrenceObservationBytesV1,
  getExecutionReportPositionStateV1,
  type ExecutionReportOccurrenceStateV1,
} from "./execution-report-provenance.js";
import type { ExecutionReportPositionAuthorityV1 } from "./failure-execution-types.js";

function failure<T>(
  code: "unbound-capability" | "invalid-evidence-input",
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

function sourceAuthority(
  occurrence: ExecutionReportOccurrenceStateV1,
): FailureEnvelopeSourceAuthorityV1 | undefined {
  const request = occurrence.request;
  if (request.kind === "valid-envelope" || request.kind === undefined) {
    return Object.freeze({ kind: "typed-valid" as const, authority: request.executionCase });
  }
  if (request.kind === "invalid-diagnostic") {
    return Object.freeze({ kind: "typed-invalid" as const, authority: request.diagnosticCase });
  }
  if (request.kind === "raw-malformed") {
    return Object.freeze({ kind: "raw-malformed" as const, authority: request.malformedCase });
  }
  return undefined;
}

function occurrenceTools(
  occurrence: ExecutionReportOccurrenceStateV1,
  reportTools: readonly FailureToolIdentityV1[],
): readonly FailureToolIdentityV1[] | undefined {
  const required = new Set(occurrence.completion.toolContractDigests);
  const selected = reportTools.filter((tool) => required.has(tool.digest));
  return selected.length === required.size ? Object.freeze(selected) : undefined;
}

/**
 * Authorizes one historical envelope from a genuine non-pass report position.
 *
 * Every loose authorization field, including canonical observation and route-plan bytes, remains
 * private to this boundary. The caller receives only the existing opaque envelope authority.
 *
 * @example
 * ```ts
 * const envelope = authorizeFailureEnvelopeFromReportPositionV1(position, policy);
 * if (!envelope.ok) throw new Error(envelope.issues[0].message);
 * ```
 */
export function authorizeFailureEnvelopeFromReportPositionV1(
  position: ExecutionReportPositionAuthorityV1,
  policy: FailureReductionPolicyV1,
): ExecutionOperationResultV1<AuthorizedFailureEnvelopeV1> {
  const positioned = getExecutionReportPositionStateV1(position);
  const report =
    positioned === undefined
      ? undefined
      : getExecutionAuthorityReportProvenanceStateV1(positioned.report);
  if (positioned === undefined || report === undefined) {
    return failure("unbound-capability", "/position", "Report position authority is unavailable.");
  }
  const occurrence = positioned.occurrence;
  const basis =
    occurrence.sidecarProjection.kind === "candidate-full-predicate"
      ? undefined
      : occurrence.sidecarProjection.predicateBasis;
  const source = sourceAuthority(occurrence);
  const observationBytes = getExecutionReportOccurrenceObservationBytesV1(occurrence);
  const tools = occurrenceTools(occurrence, report.toolIdentities);
  if (
    occurrence.result.status === "pass" ||
    basis?.kind !== "failure-ingredients" ||
    source === undefined ||
    observationBytes === undefined ||
    tools === undefined
  ) {
    return failure(
      "invalid-evidence-input",
      "/position",
      "Report position lacks complete non-pass envelope provenance.",
    );
  }
  const predicate = deriveFailurePredicateIdentityV1({
    ...basis.value,
    revision: "failure-predicate-v1",
  });
  if (!predicate.ok) {
    return failure(
      "invalid-evidence-input",
      "/position/predicate",
      "Report predicate evidence is incomplete.",
    );
  }
  return authorizeFailureEnvelopeV1({
    revision: "failure-envelope-authorization-input-v1",
    source,
    routePlanBytes: report.routePlanBytes,
    routePlanDigest: report.report.routePlanDigest,
    predicate: predicate.value.predicate,
    policy,
    observationBytes,
    toolVersions: tools,
  });
}
