import {
  getCompositeReadinessProjectionV1,
  projectExecutionCampaignV1,
  resolveCompositeReadinessSnapshot,
  serializeExecutionRoutePlanPreimageV1,
  type CompositeReadinessProjectionV1,
  type ExecutionOperationIssueCodeV1,
  type ExecutionOperationResultV1,
  type ExecutionPolicyV1,
  type ExecutionProjectionRevisionV1,
  type ExecutionResultV1,
  type ExecutionRoutePlanItemV1,
  type PreparedCampaign,
  type PublishedOracleContext,
  type PublishedSnapshot,
} from "@blend65/readiness";
import {
  authenticatePublishedExecutionCampaignParentV1,
  getPreparedCampaignExecutionIdentityV1,
} from "@blend65/readiness/execution-campaign-identity";
import { createPublishedOracleRequest } from "@blend65/readiness/published-oracle";

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
import { inspectViceLeaseV1 } from "./execution-vice.js";
import {
  getLiveExecutionContextStateV1,
  revalidateExecutionReviewContextV1,
  type ExecutionAuthorityContextV1,
  type ExecutionReviewContextV1,
} from "./execution-publication-catalog.js";
import { planExecutionRoutesV1 } from "./execution-route-planner.js";
import {
  appendExecutionRouteEvidenceV1,
  createCaughtExecutionResultV1,
  createGeneratedExecutionCaseIndexV1,
  createUnavailableExecutionResultV1,
  derivePlannedExecutionIdentityV1,
  prepareExecutionRouteEvidenceV1,
  unavailableExecutionRouteToolsV1,
  type ExecutionRouteAuthorityRecordV1,
  type ExecutionRouteSourceAuthorityV1,
  type ExecutionRouteToolV1,
} from "./execution-route-evidence.js";
import { acquireExecutionWorkerExecutorOwnershipV1 } from "./execution-supervisor.js";
import { defaultExecutionWorkerExecutorV1 } from "./execution-worker-executor.js";
import type { FailurePredicateEvidenceAuthorityV1 } from "./failure-predicate-evidence.js";
import type { ExecutionReportOccurrenceProvenanceInputV1 } from "./execution-report-provenance.js";

export type {
  ExecutionRouteAuthorityRecordV1,
  ExecutionRouteToolV1,
} from "./execution-route-evidence.js";

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

const PROJECTION_REVISIONS: readonly ExecutionProjectionRevisionV1[] = Object.freeze([
  "c64-vic-color-observation-v1",
  "c64-vic-color-readback-v1",
]);
const ENCODER = new TextEncoder();

/**
 * Waits for the process-wide VICE lease to expose completed child retirement.
 *
 * A VICE child can exit between its route result becoming available and the host's final durable
 * lease observation. Campaign reports must not become authoritative during that short interval,
 * or while a recoverable generation tombstone still occupies the namespace, because their route
 * results already claim cleanup is complete. This barrier is read-only and inherits the selected
 * cleanup grace; it never clears or signals an observed generation.
 */
async function awaitViceLeaseCleanupV1(cleanupGraceMs: number): Promise<boolean> {
  const deadline = performance.now() + cleanupGraceMs;
  for (;;) {
    const remainingMs = Math.max(1, Math.floor(deadline - performance.now()));
    const observed = await inspectViceLeaseV1("c64", AbortSignal.timeout(remainingMs));
    if (
      observed.ok &&
      observed.value.state === "clear" &&
      observed.value.generation === 0 &&
      observed.value.nonce === "" &&
      observed.value.childAbsent
    ) {
      return true;
    }
    const now = performance.now();
    if (now >= deadline) return false;
    await new Promise<void>((resolve) => setTimeout(resolve, Math.min(10, deadline - now)));
  }
}

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

function isReportAuthorizationFailure(
  value: unknown,
): value is Extract<ExecutionOperationResultV1<never>, { readonly ok: false }> {
  if (typeof value !== "object" || value === null) return false;
  const ok = Reflect.getOwnPropertyDescriptor(value, "ok");
  const issues = Reflect.getOwnPropertyDescriptor(value, "issues");
  return ok?.value === false && Array.isArray(issues?.value);
}

/**
 * Converts the report authorizer's closed report-or-failure return into one operation result.
 *
 * @example
 * ```ts
 * const completed = completeExecutionReportAuthorizationV1(authorizedReport);
 * ```
 */
export function completeExecutionReportAuthorizationV1(
  authorization: ExecutionAuthorityReportV1 | ExecutionOperationResultV1<never>,
): ExecutionOperationResultV1<ExecutionAuthorityReportV1> {
  return isReportAuthorizationFailure(authorization)
    ? authorization
    : success(authorization as ExecutionAuthorityReportV1);
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
  const routePlanBytes = serializeExecutionRoutePlanPreimageV1({
    revision: planned.value.revision,
    parentDigest: planned.value.parentDigest,
    executionDigest: planned.value.executionDigest,
    campaignDigest: planned.value.campaignDigest,
    oracleDigest: planned.value.oracleDigest,
    policy: planned.value.policy,
    items: planned.value.items,
  });
  /* v8 ignore next -- the canonical plan serializer always emits a non-empty schema object. */
  if (routePlanBytes.byteLength === 0) {
    return failure("execution.invalid-schema", "/routePlan", "Route plan serialization failed.");
  }
  const executionIdentities = new Map<ExecutionRoutePlanItemV1, string>();
  for (const route of planned.value.items) {
    const executionIdentity = derivePlannedExecutionIdentityV1(route, planned.value.digest);
    executionIdentities.set(route, executionIdentity);
    recordPlannedExecutionV1(executionIdentity, route.terminalTier, route.ruleId, route.obligation);
  }

  const capabilities = getExecutionEnvironmentCapabilitiesOverrideV1() ?? inputCapabilities;
  const generatedCases = createGeneratedExecutionCaseIndexV1(
    retained.campaign as PreparedCampaign,
    campaign.value.cases.length,
  );
  const routeAuthorities = new Map<string, ExecutionRouteSourceAuthorityV1>();
  const results: ExecutionResultV1[] = [];
  const routeRecords: ExecutionRouteAuthorityRecordV1[] = [];
  const predicateSidecars: FailurePredicateEvidenceAuthorityV1[] = [];
  const routeOccurrences: ExecutionReportOccurrenceProvenanceInputV1[] = [];
  const routeEvidenceCollections = Object.freeze({
    results,
    records: routeRecords,
    sidecars: predicateSidecars,
    occurrences: routeOccurrences,
  });
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
      const preparedEvidence = prepareExecutionRouteEvidenceV1(
        route,
        retained.parent as PublishedSnapshot,
        retained.execution as ExecutionAuthorityContextV1,
        retained.campaign as PreparedCampaign,
        retained.oracle as PublishedOracleContext,
        oracleDigest.value,
        plannedPolicy,
        generatedCases,
        routeAuthorities,
      );
      if (preparedEvidence === undefined) {
        return failure(
          "invalid-evidence-input",
          "/routePlan",
          "Planned route lacks authenticated predicate evidence facts.",
        );
      }
      const missingTools = unavailableExecutionRouteToolsV1(route, capabilities);
      if (missingTools.length > 0) {
        const result = createUnavailableExecutionResultV1(route, missingTools[0]!);
        if (
          !appendExecutionRouteEvidenceV1(
            route,
            executionIdentity,
            missingTools,
            preparedEvidence,
            result,
            routeEvidenceCollections,
            "tier-unavailable",
          )
        ) {
          return failure(
            "invalid-evidence-input",
            "/predicateSidecars",
            "Unavailable route evidence could not be authenticated.",
          );
        }
        continue;
      }
      const substitute = takeExecutionResultSubstitutionV1(executionIdentity, route.terminalTier);
      if (substitute !== undefined) {
        if (
          !appendExecutionRouteEvidenceV1(
            route,
            executionIdentity,
            missingTools,
            preparedEvidence,
            substitute,
            routeEvidenceCollections,
            "injected-substitution",
          )
        ) {
          return failure(
            "invalid-evidence-input",
            "/predicateSidecars",
            "Substituted route evidence could not be authenticated.",
          );
        }
        continue;
      }
      try {
        const result = await live.handlers[route.terminalTier].execute(preparedEvidence.request, {
          signal: new AbortController().signal,
          deadlineMonotonicMs: performance.now() + plannedPolicy.budget.routeMs,
          outputLimitBytes: plannedPolicy.budget.outputBytes,
          evidenceLimitBytes: plannedPolicy.budget.evidenceBytes,
        });
        if (
          !appendExecutionRouteEvidenceV1(
            route,
            executionIdentity,
            missingTools,
            preparedEvidence,
            result,
            routeEvidenceCollections,
          )
        ) {
          return failure(
            "invalid-evidence-input",
            "/predicateSidecars",
            "Handled route evidence could not be authenticated.",
          );
        }
      } catch {
        const result = createCaughtExecutionResultV1(
          route,
          route.terminalTier === "vice" ? "vice-launch" : route.terminalTier,
          "compiler-ice",
        );
        if (
          !appendExecutionRouteEvidenceV1(
            route,
            executionIdentity,
            missingTools,
            preparedEvidence,
            result,
            routeEvidenceCollections,
            "caught-compiler-ice",
          )
        ) {
          return failure(
            "invalid-evidence-input",
            "/predicateSidecars",
            "Caught route evidence could not be authenticated.",
          );
        }
      }
    }
  } finally {
    await campaignWorkerLease?.shutdown?.();
  }
  if (
    capabilities.vice.available &&
    planned.value.items.some((route) => route.terminalTier === "vice") &&
    !(await awaitViceLeaseCleanupV1(planned.value.policy.budget.cleanupGraceMs))
  ) {
    return failure(
      "emulator-lease-recovery-blocked",
      "/vice/cleanup",
      "VICE child retirement is not complete at the campaign report boundary.",
    );
  }
  const residual = residualBlockers(parent.value.rules, campaign.value.cases, planned.value.items);
  const summary = deriveSummary(routeRecords, residual);
  if (live.kind === "review-candidate") {
    const fresh = await revalidateExecutionReviewContextV1(
      retained.execution as ExecutionReviewContextV1,
    );
    if (!fresh.ok) return fresh;
  }
  return completeExecutionReportAuthorizationV1(
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
      predicateSidecars,
      routeOccurrences,
      routePlanBytes,
    ) as ExecutionAuthorityReportV1 | ExecutionOperationResultV1<never>,
  );
}
