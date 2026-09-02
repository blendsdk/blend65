import {
  classifyExecutionFailureV1,
  deriveFailurePredicateIdentityV1,
  getFailureEnvelopeProjectionV1,
  type AuthorizedFailureEnvelopeV1,
  type ClassifiedFailureV1,
  type FailureCampaignBudgetAuthorityV1,
  type FailureEnvelopeV1,
  type FailurePredicateV1,
} from "@blend65/readiness";
import {
  failureEnvelopeSourceMatchesParentV1,
  getFailureCampaignBudgetPolicyV1,
  getFailureEnvelopeSourceAuthorityV1,
  getReductionCandidateProjectionV1,
  reductionCandidateAuthorityMatchesEnvelopeV1,
  type ReductionCandidateAuthorityV1,
  type ReductionCandidateProjectionV1,
} from "@blend65/readiness/failure-reduction-internals";
import { getExecutionCaseProjectionV1 } from "@blend65/readiness/execution-runtime";

import type { ExecutionAuthorityReportV1 } from "./execution-orchestration.js";
import {
  getExecutionAuthorityReportProvenanceStateV1,
  getExecutionReportOccurrenceObservationBytesV1,
  getExecutionReportPositionStateV1,
  type ExecutionReportOccurrenceStateV1,
} from "./execution-report-provenance.js";
import { equalFailureExecutionBytesV1 } from "./failure-execution-immutable.js";
import { deriveExecutionFixtureDigestV1 } from "./execution-envelope.js";
import {
  historicalFailureExecutionIssueV1 as historicalIssue,
  snapshotExactFailureExecutionInputV1 as exactInput,
} from "./failure-execution-operation.js";
import {
  FAILURE_CONFIRMATION_CONTEXT_AUTHORITY_V1,
  type ExecutionReportPositionAuthorityV1,
  type FailureConfirmationContextAuthorityV1,
  type FailureExecutionOperationResultV1,
} from "./failure-execution-types.js";

/** Closed input joining one report occurrence to its exact failure candidate. */
export interface CreateFailureConfirmationContextInputV1 {
  /** Complete fresh execution report carrying private ordered provenance. */
  readonly report: ExecutionAuthorityReportV1;
  /** Exact failing occurrence selected from that report. */
  readonly subject: ExecutionReportPositionAuthorityV1;
  /** Genuine candidate authority created from the same envelope. */
  readonly candidate: ReductionCandidateAuthorityV1;
  /** Genuine historical envelope for the subject occurrence. */
  readonly origin: AuthorizedFailureEnvelopeV1;
  /** Shared campaign budget whose policy equals the envelope policy. */
  readonly budget: FailureCampaignBudgetAuthorityV1;
  /** Optional exact passing occurrence from a separate authenticated report execution. */
  readonly control?: ExecutionReportPositionAuthorityV1;
}

/** Complete private state retained behind one subject-bound context capability. */
export interface FailureConfirmationContextStateV1 {
  /** Exact complete report. */
  readonly report: ExecutionAuthorityReportV1;
  /** Exact selected report occurrence. */
  readonly subject: ExecutionReportOccurrenceStateV1;
  /** Ordered genuine occurrences preceding the subject in the same report. */
  readonly preceding: readonly ExecutionReportOccurrenceStateV1[];
  /** Distinct same-route passing occurrence required by fresh confirmation. */
  readonly control?: ExecutionReportOccurrenceStateV1;
  /** Genuine candidate authority bound to the exact envelope. */
  readonly candidate: ReductionCandidateAuthorityV1;
  /** Defensive candidate projection. */
  readonly candidateProjection: ReductionCandidateProjectionV1;
  /** Genuine historical envelope. */
  readonly origin: AuthorizedFailureEnvelopeV1;
  /** Defensive historical envelope projection. */
  readonly originProjection: FailureEnvelopeV1;
  /** Complete exact historical predicate derived from report evidence. */
  readonly predicate: FailurePredicateV1;
  /** Shared authenticated campaign budget. */
  readonly budget: FailureCampaignBudgetAuthorityV1;
  /** Closed disposition selected from exact subject route and result. */
  readonly disposition: ClassifiedFailureV1["disposition"];
  /** Selected sequence lifetime capped by the hard maximum. */
  readonly sequenceLimit: number;
}

const CONTEXTS = new WeakMap<object, FailureConfirmationContextStateV1>();

function same(value: unknown, expected: unknown): boolean {
  return JSON.stringify(value) === JSON.stringify(expected);
}

function policyDigest(occurrence: ExecutionReportOccurrenceStateV1): string {
  return `sha256:${createHash("sha256")
    .update(
      JSON.stringify({
        revision: occurrence.request.policy.revision,
        budget: occurrence.request.policy.budget,
      }),
    )
    .digest("hex")}`;
}

function routeContractIdentity(occurrence: ExecutionReportOccurrenceStateV1) {
  const request = occurrence.request;
  if (request.kind === "reduction-candidate-internal") return undefined;
  const fixture =
    request.kind === "valid-envelope" || request.kind === undefined
      ? getExecutionCaseProjectionV1(request.executionCase)
      : undefined;
  const fixtureDigest = deriveExecutionFixtureDigestV1(
    fixture?.ok === true
      ? fixture.value.fixture
      : Object.freeze({ revision: "c64-vic-color-readback-v1" as const, cells: Object.freeze([]) }),
  );
  return fixtureDigest.ok
    ? Object.freeze({
        originalRouteKind:
          request.kind === "raw-malformed"
            ? ("invalid-diagnostic" as const)
            : (request.kind ?? "valid-envelope"),
        terminalTier: request.route.terminalTier,
        obligation: request.route.obligation,
        prerequisiteTiers: request.route.prerequisiteTiers,
        policyDigest: policyDigest(occurrence),
        fixtureDigest: fixtureDigest.value,
        oracleContractDigest: occurrence.completion.oracleContractDigest,
        toolContractDigests: occurrence.completion.toolContractDigests,
      })
    : undefined;
}

function sidecarPredicate(
  occurrence: ExecutionReportOccurrenceStateV1,
): FailurePredicateV1 | undefined {
  const sidecar = occurrence.sidecarProjection;
  if (
    sidecar.kind === "candidate-full-predicate" ||
    sidecar.predicateBasis.kind !== "failure-ingredients"
  ) {
    return undefined;
  }
  const derived = deriveFailurePredicateIdentityV1({
    ...sidecar.predicateBasis.value,
    revision: "failure-predicate-v1",
  });
  return derived.ok ? derived.value.predicate : undefined;
}

function routeContractMatches(
  predicate: FailurePredicateV1,
  occurrence: ExecutionReportOccurrenceStateV1,
): boolean {
  return same(routeContractIdentity(occurrence), predicate.routeContract);
}

function sameControlRoute(
  subject: ExecutionReportOccurrenceStateV1,
  control: ExecutionReportOccurrenceStateV1,
): boolean {
  const subjectSidecar = subject.sidecarProjection;
  const controlSidecar = control.sidecarProjection;
  if (
    subjectSidecar.kind === "candidate-full-predicate" ||
    controlSidecar.kind === "candidate-full-predicate" ||
    controlSidecar.predicateBasis.kind !== "pass"
  ) {
    return false;
  }
  return (
    subject !== control &&
    control.result.status === "pass" &&
    subject.route.ruleId === control.route.ruleId &&
    same(routeContractIdentity(subject), routeContractIdentity(control))
  );
}

/** Mints one opaque context only after a complete exact historical join succeeds. */
export function createFailureConfirmationContextV1(
  input: CreateFailureConfirmationContextInputV1,
): FailureExecutionOperationResultV1<FailureConfirmationContextAuthorityV1> {
  const inputKeys = Object.hasOwn(input, "control")
    ? ["report", "subject", "candidate", "origin", "budget", "control"]
    : ["report", "subject", "candidate", "origin", "budget"];
  if (exactInput(input, inputKeys) === undefined) {
    return historicalIssue("/context", "Confirmation context input is incomplete.");
  }
  const reportState = getExecutionAuthorityReportProvenanceStateV1(input.report);
  const positionState = getExecutionReportPositionStateV1(input.subject);
  const origin = getFailureEnvelopeProjectionV1(input.origin);
  const source = getFailureEnvelopeSourceAuthorityV1(input.origin);
  const candidate = getReductionCandidateProjectionV1(input.candidate);
  const budgetPolicy = getFailureCampaignBudgetPolicyV1(input.budget);
  if (
    reportState === undefined ||
    positionState?.report !== input.report ||
    !origin.ok ||
    source === undefined ||
    !candidate.ok ||
    budgetPolicy === undefined ||
    !reductionCandidateAuthorityMatchesEnvelopeV1(input.candidate, input.origin)
  ) {
    return historicalIssue(
      "/context",
      "Complete historical confirmation authority is unavailable.",
    );
  }
  const occurrence = positionState.occurrence;
  const predicate = sidecarPredicate(occurrence);
  const classification = classifyExecutionFailureV1(occurrence.route, occurrence.result);
  const bytes = getExecutionReportOccurrenceObservationBytesV1(occurrence);
  if (
    predicate === undefined ||
    !classification.ok ||
    classification.value.disposition === "unsupported" ||
    occurrence.parent !== reportState.occurrences[occurrence.index]?.parent ||
    !failureEnvelopeSourceMatchesParentV1(source, input.report.parentDigest) ||
    !routeContractMatches(predicate, occurrence) ||
    input.report.routePlanDigest !== origin.value.routePlanDigest ||
    !same(predicate, origin.value.predicate) ||
    !same(predicate, candidate.value.predicate) ||
    !same(candidate.value.originalRoute, predicate.routeContract) ||
    !same(budgetPolicy, origin.value.policy) ||
    bytes === undefined ||
    !equalFailureExecutionBytesV1(bytes, origin.value.observationBytes)
  ) {
    return historicalIssue(
      "/context",
      "Historical report, route, predicate, or observation differs.",
    );
  }
  const suppliedControlPosition =
    input.control === undefined ? undefined : getExecutionReportPositionStateV1(input.control);
  if (Object.hasOwn(input, "control") && suppliedControlPosition === undefined) {
    return historicalIssue(
      "/context/control",
      "The supplied passing control occurrence is unavailable.",
    );
  }
  const suppliedControlReport =
    suppliedControlPosition === undefined
      ? undefined
      : getExecutionAuthorityReportProvenanceStateV1(suppliedControlPosition.report);
  const suppliedControl = suppliedControlPosition?.occurrence;
  const suppliedControlMatchesReport =
    suppliedControl === undefined ||
    (suppliedControlReport !== undefined &&
      suppliedControlReport.report.parentDigest === input.report.parentDigest &&
      suppliedControlReport.report.routePlanDigest === input.report.routePlanDigest &&
      same(suppliedControlReport.report.toolVersions, input.report.toolVersions));
  if (!suppliedControlMatchesReport) {
    return historicalIssue(
      "/context/control",
      "The supplied passing control report does not match the subject report authority.",
    );
  }
  const control =
    classification.value.disposition === "fresh-confirm"
      ? suppliedControl !== undefined && sameControlRoute(occurrence, suppliedControl)
        ? suppliedControl
        : reportState.occurrences.find((candidateOccurrence) =>
            sameControlRoute(occurrence, candidateOccurrence),
          )
      : undefined;
  if (classification.value.disposition === "fresh-confirm" && control === undefined) {
    return historicalIssue(
      "/context/control",
      "A distinct passing same-route control is unavailable.",
    );
  }
  const context: FailureConfirmationContextAuthorityV1 = Object.freeze({
    [FAILURE_CONFIRMATION_CONTEXT_AUTHORITY_V1]: true as const,
  });
  CONTEXTS.set(
    context,
    Object.freeze({
      report: input.report,
      subject: occurrence,
      preceding: Object.freeze(reportState.occurrences.slice(0, occurrence.index)),
      ...(control === undefined ? {} : { control }),
      candidate: input.candidate,
      candidateProjection: candidate.value,
      origin: input.origin,
      originProjection: origin.value,
      predicate,
      budget: input.budget,
      disposition: classification.value.disposition,
      sequenceLimit: Math.min(origin.value.policy.budget.sequenceCases, 64),
    }),
  );
  return Object.freeze({ ok: true, value: context });
}

/** Resolves private context state only for a genuine subject-bound authority. */
export function getFailureConfirmationContextStateV1(
  context: FailureConfirmationContextAuthorityV1,
): FailureConfirmationContextStateV1 | undefined {
  return typeof context === "object" && context !== null ? CONTEXTS.get(context) : undefined;
}
import { createHash } from "node:crypto";
