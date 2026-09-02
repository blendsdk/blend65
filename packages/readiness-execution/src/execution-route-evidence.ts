import { createHash } from "node:crypto";

import {
  createExecutionCaseV1,
  generateCampaignCase,
  type ExecutionCaseV1,
  type ExecutionPolicyV1,
  type ExecutionResultCodeV1,
  type ExecutionResultV1,
  type ExecutionRoutePlanItemV1,
  type ExecutionStageV1,
  type GeneratedCase,
  type PreparedCampaign,
  type PublishedOracleContext,
  type PublishedSnapshot,
} from "@blend65/readiness";
import {
  createPublishedDiagnosticCaseV1,
  type PublishedDiagnosticCaseV1,
} from "@blend65/readiness/published-oracle";
import { deriveCampaignRouteExecutionIdentityV1 } from "./execution-orchestration-identity.js";
import { snapshotExecutionResultForOrchestrationV1 } from "./execution-orchestration-conformance-v1.js";
import type { ExecutionEnvironmentCapabilitiesV1 } from "./execution-orchestration-types.js";
import type { ExecutionAuthorityContextV1 } from "./execution-publication-catalog.js";
import { createFailurePredicateEvidenceCompletionV1 } from "./execution-predicate-contracts.js";
import {
  consumeHandledFailurePredicateEvidenceV1,
  createClosedNonExecutedFailurePredicateEvidenceV1,
  type FailurePredicateEvidenceAuthorityV1,
  type FailurePredicateEvidenceCompletionV1,
} from "./failure-predicate-evidence.js";
import {
  createExecutionRouteRequestV1,
  type ExecutionRouteRequestV1,
} from "./execution-route-adapters.js";
import type { ExecutionReportOccurrenceProvenanceInputV1 } from "./execution-report-provenance.js";

/** Local external tools that may be prerequisites of one selected route. */
export type ExecutionRouteToolV1 = "acme" | "vice";

/** Standalone attribution and terminal evidence for one selected route. */
export interface ExecutionRouteAuthorityRecordV1 {
  /** Exact prepared-campaign case identity. */
  readonly caseIdentity: string;
  /** Exact execution identity used by route dispatch and substitution. */
  readonly executionIdentity: string;
  /** Reviewed rule exercised by the route. */
  readonly ruleId: string;
  /** Selected evidence obligation. */
  readonly obligation: string;
  /** Last tier owned by the route. */
  readonly terminalTier: ExecutionRoutePlanItemV1["terminalTier"];
  /** Canonically ordered external tool prerequisites for this route only. */
  readonly requiredTools: readonly ExecutionRouteToolV1[];
  /** Canonically ordered prerequisites unavailable during this execution. */
  readonly unavailableTools: readonly ExecutionRouteToolV1[];
  /** Closed terminal result attributable to this route. */
  readonly result: ExecutionResultV1;
}

/** Cached opaque source authority used while preparing one campaign's route requests. */
export type ExecutionRouteSourceAuthorityV1 =
  | Readonly<{ readonly kind: "diagnostic"; readonly value: PublishedDiagnosticCaseV1 }>
  | Readonly<{ readonly kind: "execution"; readonly value: ExecutionCaseV1 }>;

/** Prepared request and authenticated report-side predicate completion for one route. */
export interface PreparedExecutionRouteEvidenceV1 {
  /** Exact parent authority selected for the complete campaign report. */
  readonly parent: PublishedSnapshot;
  /** Exact reviewed handler authority used to dispatch the route. */
  readonly execution: ExecutionAuthorityContextV1;
  /** Genuine source-bound route request. */
  readonly request: ExecutionRouteRequestV1;
  /** Selected oracle and route-relevant implementation digests. */
  readonly completion: FailurePredicateEvidenceCompletionV1;
}

/** Mutable orchestration-owned collections updated atomically for each completed route. */
export interface ExecutionRouteEvidenceCollectionsV1 {
  /** Canonical positional report results. */
  readonly results: ExecutionResultV1[];
  /** Independently attributable route records. */
  readonly records: ExecutionRouteAuthorityRecordV1[];
  /** Exact-result predicate sidecars ordered with the report results. */
  readonly sidecars: FailurePredicateEvidenceAuthorityV1[];
  /** Exact live route-occurrence provenance ordered with the report results. */
  readonly occurrences: ExecutionReportOccurrenceProvenanceInputV1[];
}

const EMPTY_USAGE = Object.freeze({
  wallMs: 0,
  outputBytes: 0,
  evidenceBytes: 0,
  instructions: 0,
  cycles: 0,
  launchAttempts: 0,
});

function observationForGeneratedCase(generated: GeneratedCase):
  | {
      readonly kind: "scalar-bytes";
      readonly byteLength: 1 | 2;
    }
  | {
      readonly kind: "direct-mmio";
      readonly byteLength: 1 | 2;
      readonly address: number;
      readonly projectionRevision: "c64-vic-color-observation-v1";
    }
  | undefined {
  const projection = generated.modeledCase.projection;
  if (projection.kind !== "valid") return undefined;
  const fn = projection.module.functions[0];
  if (fn === undefined) return undefined;
  if (fn.returnType === "boolean" || fn.returnType === "byte" || fn.returnType === "sbyte") {
    return Object.freeze({ kind: "scalar-bytes", byteLength: 1 });
  }
  if (fn.returnType === "word" || fn.returnType === "sword") {
    return Object.freeze({ kind: "scalar-bytes", byteLength: 2 });
  }
  const choice = generated.planItem.request.choice;
  if (choice.kind !== "memory") return undefined;
  const writes = choice.ruleId.includes(".poke-") || choice.ruleId.includes(".pokew-");
  if (!writes) return undefined;
  return Object.freeze({
    kind: "direct-mmio",
    byteLength: choice.ruleId.includes(".pokew-") ? 2 : 1,
    address: choice.addressForm === "computed" ? 0xd021 : 0xd020,
    projectionRevision: "c64-vic-color-observation-v1",
  });
}

/** Indexes the genuine generated cases needed to mint source-bound route requests. */
export function createGeneratedExecutionCaseIndexV1(
  campaign: PreparedCampaign,
  caseCount: number,
): ReadonlyMap<string, Readonly<{ readonly ordinal: number; readonly generated: GeneratedCase }>> {
  const result = new Map<
    string,
    Readonly<{ readonly ordinal: number; readonly generated: GeneratedCase }>
  >();
  for (let ordinal = 0; ordinal < caseCount; ordinal += 1) {
    const generated = generateCampaignCase(campaign, ordinal);
    /* v8 ignore next -- the authenticated projection already reproduced every campaign ordinal. */
    if (generated.ok) {
      result.set(
        generated.value.identity.digest,
        Object.freeze({ ordinal, generated: generated.value }),
      );
    }
  }
  return result;
}

/** Mints the genuine request and authenticated predicate completion for one planned route. */
export function prepareExecutionRouteEvidenceV1(
  route: ExecutionRoutePlanItemV1,
  parent: PublishedSnapshot,
  execution: ExecutionAuthorityContextV1,
  campaign: PreparedCampaign,
  oracle: PublishedOracleContext,
  oracleDigest: string,
  policy: ExecutionPolicyV1,
  generatedCases: ReadonlyMap<
    string,
    Readonly<{ readonly ordinal: number; readonly generated: GeneratedCase }>
  >,
  authorities: Map<string, ExecutionRouteSourceAuthorityV1>,
): PreparedExecutionRouteEvidenceV1 | undefined {
  const retained = generatedCases.get(route.caseIdentity);
  if (retained === undefined) return undefined;
  let authority = authorities.get(route.caseIdentity);
  let request: ExecutionRouteRequestV1 | undefined;
  if (retained.generated.modeledCase.validity.kind === "invalid") {
    if (
      route.terminalTier !== "frontend" &&
      route.terminalTier !== "compiler-api" &&
      route.terminalTier !== "cli"
    ) {
      return undefined;
    }
    if (authority === undefined) {
      const diagnostic = createPublishedDiagnosticCaseV1(oracle, campaign, retained.ordinal);
      if (!diagnostic.ok) return undefined;
      authority = Object.freeze({ kind: "diagnostic" as const, value: diagnostic.value });
      authorities.set(route.caseIdentity, authority);
    }
    if (authority.kind !== "diagnostic") return undefined;
    const created = createExecutionRouteRequestV1({
      kind: "invalid-diagnostic",
      route: Object.freeze({ ...route, terminalTier: route.terminalTier }),
      diagnosticCase: authority.value,
      policy,
    });
    request = created.ok ? created.value : undefined;
  } else {
    if (authority === undefined) {
      const observation = observationForGeneratedCase(retained.generated);
      if (observation === undefined) return undefined;
      const executionCase = createExecutionCaseV1(campaign, retained.ordinal, observation);
      if (!executionCase.ok) return undefined;
      authority = Object.freeze({ kind: "execution" as const, value: executionCase.value });
      authorities.set(route.caseIdentity, authority);
    }
    if (authority.kind !== "execution") return undefined;
    const created = createExecutionRouteRequestV1({
      route,
      executionCase: authority.value,
      oracle,
      policy,
    });
    request = created.ok ? created.value : undefined;
  }
  const completion = createFailurePredicateEvidenceCompletionV1(route, oracleDigest);
  return request === undefined || completion === undefined
    ? undefined
    : Object.freeze({ parent, execution, request, completion });
}

/** Returns the exact external tools required to finish one selected route. */
export function requiredExecutionRouteToolsV1(
  route: ExecutionRoutePlanItemV1,
): readonly ExecutionRouteToolV1[] {
  const tiers = [...route.prerequisiteTiers, route.terminalTier];
  return Object.freeze([
    ...(tiers.includes("acme") ? (["acme"] as const) : []),
    ...(tiers.includes("vice") ? (["vice"] as const) : []),
  ]);
}

/** Returns only the external prerequisites unavailable for this exact route. */
export function unavailableExecutionRouteToolsV1(
  route: ExecutionRoutePlanItemV1,
  capabilities: ExecutionEnvironmentCapabilitiesV1,
): readonly ExecutionRouteToolV1[] {
  return Object.freeze(
    requiredExecutionRouteToolsV1(route).filter((tool) => !capabilities[tool].available),
  );
}

/** Derives the exact dispatch identity from one selected route and its complete plan. */
export function derivePlannedExecutionIdentityV1(
  route: ExecutionRoutePlanItemV1,
  routePlanDigest: string,
): string {
  return deriveCampaignRouteExecutionIdentityV1({
    routePlanDigest,
    caseIdentity: route.caseIdentity,
    ruleId: route.ruleId,
    obligation: route.obligation,
    terminalTier: route.terminalTier,
    requiredTools: requiredExecutionRouteToolsV1(route),
  });
}

/** Creates one deterministic result when an external route prerequisite is absent. */
export function createUnavailableExecutionResultV1(
  route: ExecutionRoutePlanItemV1,
  blocker: ExecutionRouteToolV1,
): ExecutionResultV1 {
  const digest = createHash("sha256")
    .update("blend65-campaign-tier-unavailable-v1\0")
    .update(route.caseIdentity)
    .update("\0")
    .update(route.terminalTier)
    .update("\0")
    .update(blocker)
    .digest("hex");
  return Object.freeze({
    status: "failure",
    tier: route.terminalTier,
    stage: "capability",
    code: "tier-unavailable",
    usage: EMPTY_USAGE,
    evidence: Object.freeze({
      digest: `sha256:${digest}`,
      retainedBytes: 0,
      truncated: false,
    }),
  });
}

/** Creates one deterministic caught-failure result without retaining host exception data. */
export function createCaughtExecutionResultV1(
  route: ExecutionRoutePlanItemV1,
  stage: ExecutionStageV1,
  code: Exclude<ExecutionResultCodeV1, "pass">,
): ExecutionResultV1 {
  const digest = createHash("sha256")
    .update("blend65-campaign-route-failure-v1\0")
    .update(route.caseIdentity)
    .update("\0")
    .update(code)
    .digest("hex");
  return Object.freeze({
    status: "failure",
    tier: route.terminalTier,
    stage,
    code,
    usage: EMPTY_USAGE,
    evidence: Object.freeze({ digest: `sha256:${digest}`, retainedBytes: 0, truncated: false }),
  });
}

function canonicalReportResult(
  result: ExecutionResultV1,
  tier: ExecutionRoutePlanItemV1["terminalTier"],
): ExecutionResultV1 {
  const snapshot = snapshotExecutionResultForOrchestrationV1(result, tier);
  return Object.freeze({
    ...snapshot,
    usage: Object.freeze({ ...snapshot.usage, wallMs: 0 }),
  });
}

function routeRecord(
  route: ExecutionRoutePlanItemV1,
  executionIdentity: string,
  missingTools: readonly ExecutionRouteToolV1[],
  result: ExecutionResultV1,
): ExecutionRouteAuthorityRecordV1 {
  const prerequisites = requiredExecutionRouteToolsV1(route);
  const canonicalResult = canonicalReportResult(result, route.terminalTier);
  const attributedUnavailable =
    canonicalResult.code === "tier-unavailable" && missingTools.length === 0
      ? prerequisites
      : missingTools;
  return Object.freeze({
    caseIdentity: route.caseIdentity,
    executionIdentity,
    ruleId: route.ruleId,
    obligation: route.obligation,
    terminalTier: route.terminalTier,
    requiredTools: prerequisites,
    unavailableTools: Object.freeze([...attributedUnavailable]),
    result: canonicalResult,
  });
}

/** Appends one exact-result record and authenticated predicate sidecar as a single operation. */
export function appendExecutionRouteEvidenceV1(
  route: ExecutionRoutePlanItemV1,
  executionIdentity: string,
  missingTools: readonly ExecutionRouteToolV1[],
  prepared: PreparedExecutionRouteEvidenceV1,
  result: ExecutionResultV1,
  collections: ExecutionRouteEvidenceCollectionsV1,
  disposition?: "tier-unavailable" | "injected-substitution" | "caught-compiler-ice",
): boolean {
  const record = routeRecord(route, executionIdentity, missingTools, result);
  const sidecar =
    disposition === undefined
      ? consumeHandledFailurePredicateEvidenceV1(result, record.result, prepared.completion)
      : createClosedNonExecutedFailurePredicateEvidenceV1(
          prepared.request,
          result,
          record.result,
          disposition,
          prepared.completion,
        );
  if (sidecar === undefined) return false;
  collections.results.push(record.result);
  collections.records.push(record);
  collections.sidecars.push(sidecar);
  collections.occurrences.push(
    Object.freeze({
      parent: prepared.parent,
      execution: prepared.execution,
      route,
      request: prepared.request,
      completion: prepared.completion,
    }),
  );
  return true;
}
