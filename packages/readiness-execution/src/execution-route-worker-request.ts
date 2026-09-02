import { createHash } from "node:crypto";

import { getMalformedDiagnosticCaseProjectionV1 } from "@blend65/readiness/execution-runtime";
import { getPublishedDiagnosticCaseProjectionV1 } from "@blend65/readiness/published-oracle";

import {
  renderCandidateExecutionEnvelopeV1,
  renderExecutionEnvelopeV1,
} from "./execution-envelope.js";
import type { ExecutionRouteRequestV1 } from "./execution-route-adapters.js";
import { getCandidateExecutionRouteStateV1 } from "./failure-candidate-route-state.js";
import type { ExecutionWorkerParentEvidenceIdentityV1 } from "./execution-supervisor.js";
import type {
  ExecutionWorkerRequestV1,
  ExecutionWorkerResponseV1,
  ExecutionWorkerTierV1,
} from "./execution-worker-protocol.js";

const ENCODER = new TextEncoder();

/** Renders the canonical source authority into one closed tier-specific worker request. */
export function createExecutionWorkerRequestV1(
  request: ExecutionRouteRequestV1,
  tier: ExecutionWorkerTierV1,
  caseRoot: string,
): ExecutionWorkerRequestV1 | undefined {
  const candidate = getCandidateExecutionRouteStateV1(request);
  const diagnosticProjection =
    request.kind === "invalid-diagnostic"
      ? getPublishedDiagnosticCaseProjectionV1(request.diagnosticCase)
      : undefined;
  const rawProjection =
    request.kind === "raw-malformed"
      ? getMalformedDiagnosticCaseProjectionV1(request.malformedCase)
      : undefined;
  if (rawProjection !== undefined && !rawProjection.ok) return undefined;
  if (diagnosticProjection !== undefined && !diagnosticProjection.ok) return undefined;
  const rendered =
    request.kind === "valid-envelope" || request.kind === undefined
      ? renderExecutionEnvelopeV1(request.executionCase)
      : undefined;
  if (rendered !== undefined && !rendered.ok) return undefined;
  const candidateRendered =
    candidate?.family === "typed-valid" &&
    (candidate.originalRequest.kind === "valid-envelope" ||
      candidate.originalRequest.kind === undefined)
      ? renderCandidateExecutionEnvelopeV1(
          candidate.originalRequest.executionCase,
          candidate.payload,
        )
      : undefined;
  if (candidateRendered !== undefined && !candidateRendered.ok) return undefined;
  const sourceBytes =
    candidateRendered?.ok === true
      ? ENCODER.encode(candidateRendered.value)
      : candidate !== undefined
        ? candidate.payload.sourceBytes
        : rawProjection?.ok === true
          ? rawProjection.value.sourceBytes
          : diagnosticProjection?.ok === true
            ? diagnosticProjection.value.sourceBytes
            : ENCODER.encode(rendered?.value ?? "");
  const source = Object.freeze({
    revision: "execution-worker-source-v1" as const,
    relativePath: "main.blend",
    bytes: sourceBytes,
    digest:
      candidate !== undefined
        ? `sha256:${createHash("sha256").update(sourceBytes).digest("hex")}`
        : rawProjection?.ok === true
          ? rawProjection.value.textDigest
          : diagnosticProjection?.ok === true
            ? diagnosticProjection.value.authority.sourceContentIdentity
            : `sha256:${createHash("sha256").update(sourceBytes).digest("hex")}`,
  });
  const common = {
    revision: "execution-worker-request-v1" as const,
    caseKind:
      request.kind === "invalid-diagnostic" ||
      request.kind === "raw-malformed" ||
      (candidate !== undefined && candidate.family !== "typed-valid")
        ? ("invalid-diagnostic" as const)
        : ("valid-envelope" as const),
    caseIdentity: request.route.caseIdentity,
    caseRoot,
    source,
  };
  switch (tier) {
    case "frontend":
      return Object.freeze({ ...common, tier, contract: "frontend-pipeline-v1" });
    case "compiler-api":
      return Object.freeze({ ...common, tier, contract: "compiler-evidence-facade-v1" });
    case "cli":
      return Object.freeze({
        ...common,
        tier,
        contract: "blendc-cli-v1",
        argv: Object.freeze(["check", "main.blend", "--platform", "c64"]),
      });
    case "emit":
      return Object.freeze({ ...common, tier, contract: "assembly-emitter-v1" });
  }
}

/** Resolves authenticated diagnostic-parent identity for typed-invalid source authority. */
export function getExecutionWorkerDiagnosticParentEvidenceV1(
  request: ExecutionRouteRequestV1,
): ExecutionWorkerParentEvidenceIdentityV1 | undefined {
  const candidate = getCandidateExecutionRouteStateV1(request);
  const diagnosticCase =
    request.kind === "invalid-diagnostic"
      ? request.diagnosticCase
      : candidate?.family === "typed-invalid" &&
          candidate.originalRequest.kind === "invalid-diagnostic"
        ? candidate.originalRequest.diagnosticCase
        : undefined;
  if (diagnosticCase === undefined) return undefined;
  const projection = getPublishedDiagnosticCaseProjectionV1(diagnosticCase);
  if (!projection.ok) return undefined;
  return Object.freeze({
    revision: "execution-worker-parent-evidence-v1",
    joinPolicyRevision: projection.value.authority.joinPolicyRevision,
    callerSourceCaseDigest: projection.value.sourceCaseDigest,
    selectedReleaseDigest: projection.value.authority.selectedReleaseDigest,
    selectedCampaignDigest: projection.value.authority.selectedCampaignDigest,
    selectedSourceCaseDigest: projection.value.authority.selectedSourceCaseDigest,
    evaluationIdentity: projection.value.authority.evaluationIdentity,
    sourceContentIdentity: projection.value.authority.sourceContentIdentity,
  });
}

/** Requires the tier's positive evidence while rejecting every later artifact. */
export function isValidExecutionWorkerSuccessV1(response: ExecutionWorkerResponseV1): boolean {
  if (response.diagnostics.entries.some((entry) => entry.finalSeverity === "error")) return false;
  switch (response.tier) {
    case "frontend":
      return (
        response.semanticModelPresent &&
        response.allocationPlanPresent &&
        !response.emission.il &&
        !response.emission.assembly &&
        !response.emission.binary
      );
    case "compiler-api":
      return (
        !response.hasErrors &&
        !response.emission.il &&
        !response.emission.assembly &&
        !response.emission.binary
      );
    case "cli":
      return (
        response.exitCode === 0 &&
        !response.emission.il &&
        !response.emission.assembly &&
        !response.emission.binary
      );
    case "emit":
      return (
        !response.hasErrors &&
        response.assemblyBytes.byteLength > 0 &&
        !response.emission.il &&
        !response.emission.assembly &&
        !response.emission.binary
      );
  }
}
