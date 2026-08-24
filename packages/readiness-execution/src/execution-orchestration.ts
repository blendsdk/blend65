import { createHash } from "node:crypto";

import {
  createExecutionCaseV1,
  generateCampaignCase,
  getCompositeReadinessProjectionV1,
  projectExecutionCampaignV1,
  resolveCompositeReadinessSnapshot,
  serializeExecutionRoutePlanV1,
  type CompositeReadinessProjectionV1,
  type ExecutionOperationIssueCodeV1,
  type ExecutionOperationResultV1,
  type ExecutionPolicyV1,
  type ExecutionProjectionRevisionV1,
  type ExecutionResultCodeV1,
  type ExecutionResultV1,
  type ExecutionRoutePlanItemV1,
  type ExecutionStageV1,
  type ExecutionCaseV1,
  type GeneratedCase,
  type PreparedCampaign,
  type PublishedOracleContext,
  type PublishedSnapshot,
} from "@blend65/readiness";
import {
  authenticatePublishedExecutionCampaignParentV1,
  getPreparedCampaignExecutionIdentityV1,
} from "@blend65/readiness/execution-campaign-identity";
import {
  createPublishedDiagnosticCaseV1,
  createPublishedOracleRequest,
  type PublishedDiagnosticCaseV1,
} from "@blend65/readiness/published-oracle";

import { authorizeExecutionAuthorityReportV1 } from "./execution-authority-report.js";
import {
  getExecutionEnvironmentCapabilitiesOverrideV1,
  observePlannedExecutionPolicyUseV1,
  recordPlannedExecutionV1,
  takeExecutionResultSubstitutionV1,
} from "./execution-orchestration-conformance-v1.js";
import type {
  ExecutionEnvironmentCapabilitiesV1,
  ExecutionToolVersionV1,
} from "./execution-orchestration-types.js";
import { deriveCampaignRouteExecutionIdentityV1 } from "./execution-orchestration-identity.js";
import {
  getLiveExecutionContextStateV1,
  revalidateExecutionReviewContextV1,
  type ExecutionAuthorityContextV1,
  type ExecutionReviewContextV1,
} from "./execution-publication-catalog.js";
import { createExecutionRouteRequestV1 } from "./execution-route-adapters.js";
import type { PublishedExecutionHandlersV1 } from "./execution-route-adapters.js";
import { planExecutionRoutesV1 } from "./execution-route-planner.js";
import { acquireExecutionWorkerExecutorOwnershipV1 } from "./execution-supervisor.js";
import { defaultExecutionWorkerExecutorV1 } from "./execution-worker-executor.js";

/** Stable campaign aggregate retained in the canonical execution report. */
export interface ExecutionCampaignSummaryV1 {
  /** Derived terminal campaign classification. */
  readonly status: "pass" | "failure" | "unavailable";
  /** Number of selected route records. */
  readonly selectedCases: number;
  /** Number of route records carrying a passing result. */
  readonly passedCases: number;
  /** Canonically ordered derived route and residual blockers. */
  readonly blockers: readonly string[];
}

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

/** Canonical machine-neutral evidence produced by one complete campaign orchestration. */
export interface ExecutionAuthorityReportV1 {
  /** Closed wire-format revision. */
  readonly revision: "execution-authority-report-v1";
  /** Exact selected parent publication digest. */
  readonly parentDigest: string;
  /** Exact published child or review candidate whose handler bytes were executed. */
  readonly executionDigest: string;
  /** Exact selected oracle publication digest. */
  readonly oracleDigest: string;
  /** Exact prepared-campaign digest. */
  readonly campaignDigest: string;
  /** Exact complete route-plan digest. */
  readonly routePlanDigest: string;
  /** Fixed local target. */
  readonly target: "c64";
  /** Canonical campaign seed identity. */
  readonly seed: string;
  /** Canonically ordered local tool versions. */
  readonly toolVersions: readonly ExecutionToolVersionV1[];
  /** Projection revisions used to interpret retained emulator evidence. */
  readonly projectionRevisions: readonly ExecutionProjectionRevisionV1[];
  /** Positional terminal results retained for version-one compatibility. */
  readonly results: readonly ExecutionResultV1[];
  /** Canonical independently attributable records paired with positional results. */
  readonly routeRecords: readonly ExecutionRouteAuthorityRecordV1[];
  /** Canonical parent/campaign blockers that do not belong to one selected route. */
  readonly residualBlockers: readonly string[];
  /** Aggregate derived exclusively from route records and residual blockers. */
  readonly summary: ExecutionCampaignSummaryV1;
}

/** Genuine opaque authorities and bounded policy required for campaign execution. */
export interface ExecuteReadinessCampaignInputV1 {
  /** Genuine selected parent publication. */
  readonly parent: PublishedSnapshot;
  /** Genuine live execution-handler context. */
  readonly execution: ExecutionAuthorityContextV1;
  /** Genuine oracle context bound to the selected parent. */
  readonly oracle: PublishedOracleContext;
  /** Genuine prepared campaign. */
  readonly campaign: PreparedCampaign;
  /** Fixed local target. */
  readonly target: "c64";
  /** Caller policy validated and frozen by route planning. */
  readonly policy: ExecutionPolicyV1;
  /** Closed local tool capability probe. */
  readonly capabilities: ExecutionEnvironmentCapabilitiesV1;
}

const EMPTY_USAGE = Object.freeze({
  wallMs: 0,
  outputBytes: 0,
  evidenceBytes: 0,
  instructions: 0,
  cycles: 0,
  launchAttempts: 0,
});
const PROJECTION_REVISIONS: readonly ExecutionProjectionRevisionV1[] = Object.freeze([
  "c64-vic-color-observation-v1",
  "c64-vic-color-readback-v1",
]);
const ENCODER = new TextEncoder();

function failure<T>(
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

function exactInput(input: unknown): Readonly<Record<string, unknown>> | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
  try {
    if (Object.getPrototypeOf(input) !== Object.prototype) return undefined;
    const expected = [
      "parent",
      "execution",
      "oracle",
      "campaign",
      "target",
      "policy",
      "capabilities",
    ];
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== expected.length ||
      keys.some((key) => typeof key !== "string" || !expected.includes(key))
    ) {
      return undefined;
    }
    const retained: Record<string, unknown> = {};
    for (const key of expected) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      retained[key] = descriptor.value;
    }
    return retained;
  } catch {
    return undefined;
  }
}

/** Copies one closed public capability probe without invoking accessors. */
function snapshotCapabilities(input: unknown): ExecutionEnvironmentCapabilitiesV1 | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
  try {
    if (Object.getPrototypeOf(input) !== Object.prototype) return undefined;
    const keys = Reflect.ownKeys(input);
    if (keys.length !== 2 || !keys.includes("acme") || !keys.includes("vice")) return undefined;
    const result: Partial<Record<"acme" | "vice", { available: boolean; version?: string }>> = {};
    for (const tool of ["acme", "vice"] as const) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, tool);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      const capability = descriptor.value;
      if (
        typeof capability !== "object" ||
        capability === null ||
        Array.isArray(capability) ||
        Object.getPrototypeOf(capability) !== Object.prototype
      ) {
        return undefined;
      }
      const capabilityKeys = Reflect.ownKeys(capability);
      if (
        (capabilityKeys.length !== 1 && capabilityKeys.length !== 2) ||
        !capabilityKeys.includes("available") ||
        capabilityKeys.some((key) => key !== "available" && key !== "version")
      ) {
        return undefined;
      }
      const available = Reflect.getOwnPropertyDescriptor(capability, "available");
      const version = Reflect.getOwnPropertyDescriptor(capability, "version");
      if (
        available === undefined ||
        !("value" in available) ||
        !available.enumerable ||
        typeof available.value !== "boolean" ||
        (version !== undefined &&
          (!("value" in version) ||
            !version.enumerable ||
            typeof version.value !== "string" ||
            version.value.length === 0 ||
            ENCODER.encode(version.value).byteLength > 512))
      ) {
        return undefined;
      }
      result[tool] = Object.freeze({
        available: available.value,
        ...(version === undefined ? {} : { version: version.value as string }),
      });
    }
    return Object.freeze({ acme: result.acme!, vice: result.vice! });
  } catch {
    return undefined;
  }
}

function unavailableResult(
  route: ExecutionRoutePlanItemV1,
  blocker: "acme" | "vice",
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

/** Returns the exact external tools required to finish one selected route. */
function requiredTools(route: ExecutionRoutePlanItemV1): readonly ExecutionRouteToolV1[] {
  const tiers = [...route.prerequisiteTiers, route.terminalTier];
  return Object.freeze([
    ...(tiers.includes("acme") ? (["acme"] as const) : []),
    ...(tiers.includes("vice") ? (["vice"] as const) : []),
  ]);
}

/** Returns only this route's missing external prerequisites. */
function unavailableTools(
  route: ExecutionRoutePlanItemV1,
  capabilities: ExecutionEnvironmentCapabilitiesV1,
): readonly ExecutionRouteToolV1[] {
  return Object.freeze(requiredTools(route).filter((tool) => !capabilities[tool].available));
}

function routeFailure(
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

async function executeGenuineRoute(
  route: ExecutionRoutePlanItemV1,
  campaign: PreparedCampaign,
  oracle: PublishedOracleContext,
  policy: ExecutionPolicyV1,
  handlers: PublishedExecutionHandlersV1,
  generatedCases: ReadonlyMap<
    string,
    Readonly<{ readonly ordinal: number; readonly generated: GeneratedCase }>
  >,
  authorities: Map<
    string,
    | Readonly<{ readonly kind: "diagnostic"; readonly value: PublishedDiagnosticCaseV1 }>
    | Readonly<{ readonly kind: "execution"; readonly value: ExecutionCaseV1 }>
  >,
): Promise<ExecutionResultV1> {
  const retained = generatedCases.get(route.caseIdentity);
  if (retained === undefined) return routeFailure(route, "input", "invalid-evidence-input");
  let authority = authorities.get(route.caseIdentity);
  if (retained.generated.modeledCase.validity.kind === "invalid") {
    if (
      route.terminalTier !== "frontend" &&
      route.terminalTier !== "compiler-api" &&
      route.terminalTier !== "cli"
    ) {
      return routeFailure(route, "input", "invalid-evidence-input");
    }
    if (authority === undefined) {
      const diagnostic = createPublishedDiagnosticCaseV1(oracle, campaign, retained.ordinal);
      if (!diagnostic.ok) return routeFailure(route, "input", "invalid-evidence-input");
      authority = Object.freeze({ kind: "diagnostic" as const, value: diagnostic.value });
      authorities.set(route.caseIdentity, authority);
    }
    if (authority.kind !== "diagnostic") {
      return routeFailure(route, "input", "invalid-evidence-input");
    }
    const request = createExecutionRouteRequestV1({
      kind: "invalid-diagnostic",
      route: Object.freeze({ ...route, terminalTier: route.terminalTier }),
      diagnosticCase: authority.value,
      policy,
    });
    if (!request.ok) return routeFailure(route, "input", "invalid-evidence-input");
    return handlers[route.terminalTier].execute(request.value, {
      signal: new AbortController().signal,
      deadlineMonotonicMs: performance.now() + policy.budget.routeMs,
      outputLimitBytes: policy.budget.outputBytes,
      evidenceLimitBytes: policy.budget.evidenceBytes,
    });
  }
  if (authority === undefined) {
    const observation = observationForGeneratedCase(retained.generated);
    if (observation === undefined) return routeFailure(route, "input", "invalid-evidence-input");
    const executionCase = createExecutionCaseV1(campaign, retained.ordinal, observation);
    if (!executionCase.ok) return routeFailure(route, "input", "invalid-evidence-input");
    authority = Object.freeze({ kind: "execution" as const, value: executionCase.value });
    authorities.set(route.caseIdentity, authority);
  }
  if (authority.kind !== "execution") {
    return routeFailure(route, "input", "invalid-evidence-input");
  }
  const request = createExecutionRouteRequestV1({
    route,
    executionCase: authority.value,
    oracle,
    policy,
  });
  if (!request.ok) return routeFailure(route, "input", "invalid-evidence-input");
  return handlers[route.terminalTier].execute(request.value, {
    signal: new AbortController().signal,
    deadlineMonotonicMs: performance.now() + policy.budget.routeMs,
    outputLimitBytes: policy.budget.outputBytes,
    evidenceLimitBytes: policy.budget.evidenceBytes,
  });
}

function generatedCaseIndex(
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

function residualBlockers(
  parentRules: readonly { readonly ruleId: string }[],
  cases: readonly { readonly caseIdentity: string; readonly ruleId: string }[],
  routes: readonly ExecutionRoutePlanItemV1[],
): readonly string[] {
  const campaignRules = new Set(cases.map((entry) => entry.ruleId));
  const blockers = parentRules
    .filter((rule) => !campaignRules.has(rule.ruleId))
    .map((rule) => `residual:rule:${rule.ruleId}`);
  const selectedCaseIdentities = new Set(routes.map((route) => route.caseIdentity));
  for (const campaignCase of cases) {
    /* v8 ignore next -- the current selector assigns every admitted case its cheapest route. */
    if (!selectedCaseIdentities.has(campaignCase.caseIdentity)) {
      blockers.push(`residual:case:${campaignCase.ruleId}:${campaignCase.caseIdentity}`);
    }
  }
  return blockers.sort();
}

/** Removes host-scheduling variance after live wall-budget enforcement has completed. */
function canonicalReportResult(result: ExecutionResultV1): ExecutionResultV1 {
  return Object.freeze({
    ...result,
    usage: Object.freeze({ ...result.usage, wallMs: 0 }),
  });
}

/** Binds one selected route to the complete plan authority used for dispatch. */
function derivePlannedExecutionIdentity(
  route: ExecutionRoutePlanItemV1,
  routePlanDigest: string,
): string {
  return deriveCampaignRouteExecutionIdentityV1({
    routePlanDigest,
    caseIdentity: route.caseIdentity,
    ruleId: route.ruleId,
    obligation: route.obligation,
    terminalTier: route.terminalTier,
    requiredTools: requiredTools(route),
  });
}

/** Builds one immutable standalone route record without relying on array position. */
function routeRecord(
  route: ExecutionRoutePlanItemV1,
  executionIdentity: string,
  missingTools: readonly ExecutionRouteToolV1[],
  result: ExecutionResultV1,
): ExecutionRouteAuthorityRecordV1 {
  const prerequisites = requiredTools(route);
  const canonicalResult = canonicalReportResult(result);
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

/** Derives every aggregate field from closed standalone route evidence. */
function deriveSummary(
  records: readonly ExecutionRouteAuthorityRecordV1[],
  residual: readonly string[],
): ExecutionCampaignSummaryV1 {
  const unavailable = new Set<ExecutionRouteToolV1>();
  const failures: string[] = [];
  let passedCases = 0;
  for (const record of records) {
    for (const tool of record.unavailableTools) unavailable.add(tool);
    if (record.result.status === "pass") {
      passedCases += 1;
    } else if (record.result.code !== "tier-unavailable") {
      failures.push(`execution-failure:${record.result.code}`);
    }
  }
  const blockers = [
    ...[...unavailable].map((tool) => `tier-unavailable:${tool}`),
    ...residual,
    ...failures,
  ].sort();
  return Object.freeze({
    status:
      unavailable.size > 0
        ? ("unavailable" as const)
        : passedCases === records.length
          ? ("pass" as const)
          : ("failure" as const),
    selectedCases: records.length,
    passedCases,
    blockers: Object.freeze(blockers),
  });
}

/**
 * Plans every selected obligation before executing genuine live handlers and aggregates results.
 *
 * @param input Opaque parent, child, oracle, and campaign authorities plus bounded local policy.
 * @returns A deeply frozen canonical authority report or a stable passive issue.
 *
 * @example
 * ```ts
 * const report = await executeReadinessCampaign(input);
 * ```
 */
export async function executeReadinessCampaign(
  input: ExecuteReadinessCampaignInputV1,
): Promise<ExecutionOperationResultV1<ExecutionAuthorityReportV1>> {
  const retained = exactInput(input);
  if (retained === undefined || retained.target !== "c64") {
    return failure("invalid-evidence-input", "", "Execution orchestration input is not closed.");
  }
  const inputCapabilities = snapshotCapabilities(retained.capabilities);
  if (inputCapabilities === undefined) {
    return failure(
      "invalid-evidence-input",
      "/capabilities",
      "Execution capability probe is not closed.",
    );
  }
  const live = getLiveExecutionContextStateV1(retained.execution as ExecutionAuthorityContextV1);
  if (live === undefined) {
    return failure("execution.identity", "/execution", "Live execution authority is not genuine.");
  }
  let parent: ExecutionOperationResultV1<CompositeReadinessProjectionV1>;
  if (live.kind === "published") {
    const composite = resolveCompositeReadinessSnapshot(
      retained.parent as PublishedSnapshot,
      live.release,
    );
    if (!composite.ok) return composite;
    parent = getCompositeReadinessProjectionV1(composite.value);
  } else {
    if (retained.parent !== live.parent) {
      return failure(
        "execution.identity",
        "/parent",
        "Execution review candidate belongs to a different parent authority.",
      );
    }
    const fresh = await revalidateExecutionReviewContextV1(
      retained.execution as ExecutionReviewContextV1,
    );
    if (!fresh.ok) return fresh;
    parent = Object.freeze({ ok: true, value: live.projection });
  }
  if (!parent.ok) return parent;
  const campaignParent = authenticatePublishedExecutionCampaignParentV1(
    retained.campaign as PreparedCampaign,
    parent.value.parentDigest,
  );
  if (!campaignParent.ok) return campaignParent;
  const campaign = projectExecutionCampaignV1(retained.campaign as PreparedCampaign);
  if (!campaign.ok) return campaign;
  const campaignIdentity = getPreparedCampaignExecutionIdentityV1(
    retained.campaign as PreparedCampaign,
  );
  if (!campaignIdentity.ok) return campaignIdentity;
  /* v8 ignore next -- both projections are derived from the same authenticated campaign state. */
  if (
    campaignIdentity.value.campaignDigest !== campaign.value.campaignDigest ||
    campaignIdentity.value.target !== retained.target
  ) {
    return failure(
      "execution.identity",
      "/campaign",
      "Prepared campaign identity does not match its passive projection and target.",
    );
  }
  const oracleDigest = Object.getOwnPropertyDescriptor(retained.oracle, "selectedReleaseDigest");
  if (
    oracleDigest === undefined ||
    !("value" in oracleDigest) ||
    oracleDigest.value !== parent.value.parentDigest
  ) {
    return failure("execution.identity", "/oracle", "Published oracle does not match the parent.");
  }
  const oracleProbe = createPublishedOracleRequest(
    retained.oracle as PublishedOracleContext,
    Object.freeze({}),
  );
  /* v8 ignore next -- the deliberately invalid intent can authenticate or reject only the context. */
  if (oracleProbe.ok || oracleProbe.diagnostics[0]?.code !== "oracle.input.invalid") {
    return failure("execution.identity", "/oracle", "Published oracle authority is not genuine.");
  }
  const planned = planExecutionRoutesV1({
    parent: parent.value,
    campaign: campaign.value,
    oracleDigest: oracleDigest.value,
    policy: retained.policy,
  });
  if (!planned.ok) return planned;
  const completePlanBytes = serializeExecutionRoutePlanV1(planned.value);
  /* v8 ignore next -- the canonical plan serializer always emits a non-empty schema object. */
  if (completePlanBytes.byteLength === 0) {
    return failure("execution.invalid-schema", "/routePlan", "Route plan serialization failed.");
  }
  const executionIdentities = new Map<ExecutionRoutePlanItemV1, string>();
  for (const route of planned.value.items) {
    const executionIdentity = derivePlannedExecutionIdentity(route, planned.value.digest);
    executionIdentities.set(route, executionIdentity);
    recordPlannedExecutionV1(executionIdentity, route.terminalTier, route.ruleId, route.obligation);
  }

  const capabilities = getExecutionEnvironmentCapabilitiesOverrideV1() ?? inputCapabilities;
  const generatedCases = generatedCaseIndex(
    retained.campaign as PreparedCampaign,
    campaign.value.cases.length,
  );
  const routeAuthorities = new Map<
    string,
    | Readonly<{ readonly kind: "diagnostic"; readonly value: PublishedDiagnosticCaseV1 }>
    | Readonly<{ readonly kind: "execution"; readonly value: ExecutionCaseV1 }>
  >();
  const results: ExecutionResultV1[] = [];
  const routeRecords: ExecutionRouteAuthorityRecordV1[] = [];
  const campaignWorkerLease = acquireExecutionWorkerExecutorOwnershipV1(
    defaultExecutionWorkerExecutorV1,
  );
  try {
    for (const route of planned.value.items) {
      const executionIdentity = executionIdentities.get(route);
      /* v8 ignore next -- every immutable plan item was indexed immediately above. */
      if (executionIdentity === undefined) {
        return failure("execution.identity", "/routePlan", "Planned execution identity is absent.");
      }
      const plannedPolicy = planned.value.policy;
      observePlannedExecutionPolicyUseV1(plannedPolicy);
      const missingTools = unavailableTools(route, capabilities);
      if (missingTools.length > 0) {
        const result = unavailableResult(route, missingTools[0]!);
        const record = routeRecord(route, executionIdentity, missingTools, result);
        results.push(record.result);
        routeRecords.push(record);
        continue;
      }
      const substitute = takeExecutionResultSubstitutionV1(executionIdentity, route.terminalTier);
      if (substitute !== undefined) {
        const record = routeRecord(route, executionIdentity, missingTools, substitute);
        results.push(record.result);
        routeRecords.push(record);
        continue;
      }
      try {
        const result = await executeGenuineRoute(
          route,
          retained.campaign as PreparedCampaign,
          retained.oracle as PublishedOracleContext,
          plannedPolicy,
          live.handlers,
          generatedCases,
          routeAuthorities,
        );
        const record = routeRecord(route, executionIdentity, missingTools, result);
        results.push(record.result);
        routeRecords.push(record);
      } catch {
        const result = routeFailure(
          route,
          route.terminalTier === "vice" ? "vice-launch" : route.terminalTier,
          "compiler-ice",
        );
        const record = routeRecord(route, executionIdentity, missingTools, result);
        results.push(record.result);
        routeRecords.push(record);
      }
    }
  } finally {
    await campaignWorkerLease?.shutdown?.();
  }
  const residual = residualBlockers(parent.value.rules, campaign.value.cases, planned.value.items);
  const summary = deriveSummary(routeRecords, residual);
  if (live.kind === "review-candidate") {
    const fresh = await revalidateExecutionReviewContextV1(
      retained.execution as ExecutionReviewContextV1,
    );
    if (!fresh.ok) return fresh;
  }
  return success(
    authorizeExecutionAuthorityReportV1(
      Object.freeze({
        revision: "execution-authority-report-v1" as const,
        parentDigest: parent.value.parentDigest,
        executionDigest: parent.value.executionDigest,
        oracleDigest: oracleDigest.value,
        campaignDigest: campaignIdentity.value.campaignDigest,
        routePlanDigest: planned.value.digest,
        target: "c64" as const,
        seed: campaignIdentity.value.seed,
        toolVersions: Object.freeze([
          Object.freeze({ tool: "node" as const, version: process.versions.node }),
          Object.freeze({
            tool: "acme" as const,
            version: capabilities.acme.available
              ? (capabilities.acme.version ?? "available")
              : "unavailable",
          }),
          Object.freeze({
            tool: "vice" as const,
            version: capabilities.vice.available
              ? (capabilities.vice.version ?? "available")
              : "unavailable",
          }),
        ]),
        projectionRevisions: PROJECTION_REVISIONS,
        results: Object.freeze(results),
        routeRecords: Object.freeze(routeRecords),
        residualBlockers: Object.freeze([...residual]),
        summary,
      }),
    ),
  );
}
