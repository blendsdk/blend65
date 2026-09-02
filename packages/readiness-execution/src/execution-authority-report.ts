import { createHash } from "node:crypto";

import {
  isExecutionDigestV1,
  isExecutionTierV1,
  type ExecutionProjectionRevisionV1,
  type ExecutionResultV1,
} from "@blend65/readiness";

import {
  getPendingExecutionReportFaultV1,
  snapshotExecutionResultForOrchestrationV1,
} from "./execution-orchestration-conformance-v1.js";
import type { ExecutionAuthorityReportV1 } from "./execution-orchestration.js";
import type {
  ExecutionRouteAuthorityRecordV1,
  ExecutionRouteToolV1,
} from "./execution-orchestration.js";
import { EXECUTION_AUTHORITY_REPORT_ROUTE_LIMIT_V1 } from "./execution-orchestration-types.js";
import { deriveCampaignRouteExecutionIdentityV1 } from "./execution-orchestration-identity.js";
import { consumeExecutionReportPredicateSidecarsV1 } from "./execution-report-predicate-association.js";
import {
  type FailurePredicateEvidenceAuthorityV1,
  type FailurePredicateEvidenceV1,
} from "./failure-predicate-evidence.js";
import {
  getExecutionAuthorityReportProvenanceStateV1,
  retainExecutionAuthorityReportProvenanceV1,
  type ExecutionReportOccurrenceProvenanceInputV1,
} from "./execution-report-provenance.js";
import type { ExecutionReportPositionAuthorityV1 } from "./failure-execution-types.js";

export {
  EXECUTION_AUTHORITY_REPORT_PATH_V1,
  writeExecutionAuthorityReportV1,
} from "./execution-authority-report-publication.js";

const ENCODER = new TextEncoder();
const MAX_RESULTS = EXECUTION_AUTHORITY_REPORT_ROUTE_LIMIT_V1;
const MAX_BLOCKERS = 8_192;
const MAX_TEXT_BYTES = 512;
const AUTHORIZED_REPORTS = new WeakMap<object, ExecutionAuthorityReportV1>();

function exactRecord(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
  try {
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
    ) {
      return undefined;
    }
    const result: Record<string, unknown> = {};
    for (const key of expectedKeys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return undefined;
  }
}

function denseArray(input: unknown, maximum: number): readonly unknown[] | undefined {
  if (!Array.isArray(input)) return undefined;
  try {
    if (
      Object.getPrototypeOf(input) !== Array.prototype ||
      input.length > maximum ||
      Reflect.ownKeys(input).length !== input.length + 1
    ) {
      return undefined;
    }
    const output: unknown[] = [];
    for (let index = 0; index < input.length; index += 1) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, String(index));
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      output.push(descriptor.value);
    }
    return output;
  } catch {
    return undefined;
  }
}

function boundedText(value: unknown, allowEmpty = false): value is string {
  return (
    typeof value === "string" &&
    (allowEmpty || value.length > 0) &&
    ENCODER.encode(value).byteLength <= MAX_TEXT_BYTES &&
    !value.includes("\u0000")
  );
}

function canonicalReportResult(result: ExecutionResultV1): ExecutionResultV1 {
  return Object.freeze({
    ...result,
    usage: Object.freeze({ ...result.usage, wallMs: 0 }),
  });
}

function snapshotReport(input: unknown): ExecutionAuthorityReportV1 {
  const report = exactRecord(input, [
    "revision",
    "parentDigest",
    "executionDigest",
    "oracleDigest",
    "campaignDigest",
    "routePlanDigest",
    "target",
    "seed",
    "toolVersions",
    "projectionRevisions",
    "results",
    "routeRecords",
    "residualBlockers",
    "summary",
  ]);
  if (
    report === undefined ||
    report.revision !== "execution-authority-report-v1" ||
    !isExecutionDigestV1(report.parentDigest) ||
    !isExecutionDigestV1(report.executionDigest) ||
    !isExecutionDigestV1(report.oracleDigest) ||
    !isExecutionDigestV1(report.campaignDigest) ||
    !isExecutionDigestV1(report.routePlanDigest) ||
    report.target !== "c64" ||
    !boundedText(report.seed)
  ) {
    throw new TypeError("Execution authority report identity is invalid.");
  }
  const toolInputs = denseArray(report.toolVersions, 3);
  if (toolInputs === undefined || toolInputs.length !== 3) {
    throw new TypeError("Execution authority report requires exact tool versions.");
  }
  const expectedTools = ["node", "acme", "vice"] as const;
  const toolVersions = toolInputs.map((inputTool, index) => {
    const tool = exactRecord(inputTool, ["tool", "version"]);
    if (tool === undefined || tool.tool !== expectedTools[index] || !boundedText(tool.version)) {
      throw new TypeError("Execution authority report tool version is invalid.");
    }
    return Object.freeze({ tool: expectedTools[index]!, version: tool.version });
  });
  const projectionInputs = denseArray(report.projectionRevisions, 2);
  const projectionRevisions = [
    "c64-vic-color-observation-v1",
    "c64-vic-color-readback-v1",
  ] as const;
  if (
    projectionInputs === undefined ||
    projectionInputs.length !== projectionRevisions.length ||
    projectionInputs.some((value, index) => value !== projectionRevisions[index])
  ) {
    throw new TypeError("Execution authority report projection revisions are invalid.");
  }
  const resultInputs = denseArray(report.results, MAX_RESULTS);
  if (resultInputs === undefined)
    throw new TypeError("Execution authority report results are invalid.");
  const results: ExecutionResultV1[] = [];
  for (const resultInput of resultInputs) {
    const tier = exactRecord(resultInput, [
      "status",
      "tier",
      "stage",
      "code",
      "usage",
      "evidence",
    ])?.tier;
    const optionalTier =
      tier ??
      (typeof resultInput === "object" && resultInput !== null
        ? Object.getOwnPropertyDescriptor(resultInput, "tier")?.value
        : undefined);
    if (!isExecutionTierV1(optionalTier)) {
      throw new TypeError("Execution authority report result tier is invalid.");
    }
    results.push(
      canonicalReportResult(snapshotExecutionResultForOrchestrationV1(resultInput, optionalTier)),
    );
  }
  const routeInputs = denseArray(report.routeRecords, MAX_RESULTS);
  if (routeInputs === undefined || routeInputs.length !== results.length) {
    throw new TypeError("Execution authority report route records are invalid.");
  }
  const routeRecords = routeInputs.map((inputRoute, index) => {
    const route = exactRecord(inputRoute, [
      "caseIdentity",
      "executionIdentity",
      "ruleId",
      "obligation",
      "terminalTier",
      "requiredTools",
      "unavailableTools",
      "result",
    ]);
    if (
      route === undefined ||
      !isExecutionDigestV1(route.caseIdentity) ||
      !isExecutionDigestV1(route.executionIdentity) ||
      !boundedText(route.ruleId) ||
      !boundedText(route.obligation) ||
      !isExecutionTierV1(route.terminalTier)
    ) {
      throw new TypeError("Execution authority report route attribution is invalid.");
    }
    const requiredInputs = denseArray(route.requiredTools, 2);
    const unavailableInputs = denseArray(route.unavailableTools, 2);
    const expectedRequired: readonly ExecutionRouteToolV1[] =
      route.terminalTier === "vice"
        ? ["acme", "vice"]
        : route.terminalTier === "acme"
          ? ["acme"]
          : [];
    if (
      requiredInputs === undefined ||
      unavailableInputs === undefined ||
      requiredInputs.some((tool, toolIndex) => tool !== expectedRequired[toolIndex]) ||
      requiredInputs.length !== expectedRequired.length ||
      unavailableInputs.some(
        (tool, toolIndex) =>
          (tool !== "acme" && tool !== "vice") ||
          !expectedRequired.includes(tool) ||
          (toolIndex > 0 && unavailableInputs[toolIndex - 1]! >= tool),
      )
    ) {
      throw new TypeError("Execution authority report route prerequisites are invalid.");
    }
    const expectedExecutionIdentity = deriveCampaignRouteExecutionIdentityV1({
      routePlanDigest: report.routePlanDigest as string,
      caseIdentity: route.caseIdentity,
      ruleId: route.ruleId,
      obligation: route.obligation,
      terminalTier: route.terminalTier,
      requiredTools: expectedRequired,
    });
    if (route.executionIdentity !== expectedExecutionIdentity) {
      throw new TypeError("Execution authority report route execution identity is invalid.");
    }
    const result = canonicalReportResult(
      snapshotExecutionResultForOrchestrationV1(route.result, route.terminalTier),
    );
    const positionalResult = results[index];
    if (
      positionalResult === undefined ||
      JSON.stringify(result) !== JSON.stringify(positionalResult) ||
      (result.code === "tier-unavailable") !== unavailableInputs.length > 0
    ) {
      throw new TypeError("Execution authority report route result is inconsistent.");
    }
    return Object.freeze({
      caseIdentity: route.caseIdentity,
      executionIdentity: route.executionIdentity,
      ruleId: route.ruleId,
      obligation: route.obligation,
      terminalTier: route.terminalTier,
      requiredTools: Object.freeze([...expectedRequired]),
      unavailableTools: Object.freeze([...unavailableInputs] as ExecutionRouteToolV1[]),
      result: positionalResult,
    }) as ExecutionRouteAuthorityRecordV1;
  });
  const residualInputs = denseArray(report.residualBlockers, MAX_BLOCKERS);
  if (
    residualInputs === undefined ||
    residualInputs.some(
      (blocker, index) =>
        !boundedText(blocker) ||
        !blocker.startsWith("residual:") ||
        (index > 0 && residualInputs[index - 1]! > blocker),
    )
  ) {
    throw new TypeError("Execution authority report residual blockers are invalid.");
  }
  const residualBlockers = residualInputs as readonly string[];
  const summaryInput = exactRecord(report.summary, [
    "status",
    "selectedCases",
    "passedCases",
    "blockers",
  ]);
  const blockerInputs = denseArray(summaryInput?.blockers, MAX_BLOCKERS);
  if (
    summaryInput === undefined ||
    (summaryInput.status !== "pass" &&
      summaryInput.status !== "failure" &&
      summaryInput.status !== "unavailable") ||
    !Number.isSafeInteger(summaryInput.selectedCases) ||
    Number(summaryInput.selectedCases) < 0 ||
    !Number.isSafeInteger(summaryInput.passedCases) ||
    Number(summaryInput.passedCases) < 0 ||
    Number(summaryInput.passedCases) > Number(summaryInput.selectedCases) ||
    Number(summaryInput.selectedCases) !== routeRecords.length ||
    blockerInputs === undefined ||
    blockerInputs.some((blocker) => !boundedText(blocker))
  ) {
    throw new TypeError("Execution authority report summary is invalid.");
  }
  const blockers = blockerInputs as readonly string[];
  if (blockers.some((blocker, index) => index > 0 && blockers[index - 1]! > blocker)) {
    throw new TypeError("Execution authority report blockers are not canonical.");
  }
  const unavailable = new Set<ExecutionRouteToolV1>();
  const failures: string[] = [];
  let passedCases = 0;
  for (const route of routeRecords) {
    for (const tool of route.unavailableTools) unavailable.add(tool);
    if (route.result.status === "pass") passedCases += 1;
    else if (route.result.code !== "tier-unavailable") {
      failures.push(`execution-failure:${route.result.code}`);
    }
  }
  const expectedBlockers = [
    ...[...unavailable].map((tool) => `tier-unavailable:${tool}`),
    ...residualBlockers,
    ...failures,
  ].sort();
  const expectedStatus =
    unavailable.size > 0 ? "unavailable" : passedCases === routeRecords.length ? "pass" : "failure";
  if (
    summaryInput.status !== expectedStatus ||
    Number(summaryInput.selectedCases) !== routeRecords.length ||
    Number(summaryInput.passedCases) !== passedCases ||
    blockers.length !== expectedBlockers.length ||
    blockers.some((blocker, index) => blocker !== expectedBlockers[index])
  ) {
    throw new TypeError("Execution authority report summary is inconsistent with route evidence.");
  }
  return Object.freeze({
    revision: "execution-authority-report-v1",
    parentDigest: report.parentDigest,
    executionDigest: report.executionDigest,
    oracleDigest: report.oracleDigest,
    campaignDigest: report.campaignDigest,
    routePlanDigest: report.routePlanDigest,
    target: "c64",
    seed: report.seed,
    toolVersions: Object.freeze(toolVersions),
    projectionRevisions: Object.freeze([...projectionRevisions] as ExecutionProjectionRevisionV1[]),
    results: Object.freeze(results),
    routeRecords: Object.freeze(routeRecords),
    residualBlockers: Object.freeze([...residualBlockers]),
    summary: Object.freeze({
      status: summaryInput.status,
      selectedCases: Number(summaryInput.selectedCases),
      passedCases,
      blockers: Object.freeze([...blockers]),
    }),
  });
}

function sourceReportResults(input: unknown): readonly unknown[] | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  try {
    return denseArray(Object.getOwnPropertyDescriptor(input, "results")?.value, MAX_RESULTS);
  } catch {
    return undefined;
  }
}

function consumePredicateSidecarOrder(
  report: ExecutionAuthorityReportV1,
  input: unknown,
  sourceReport: unknown,
): readonly FailurePredicateEvidenceAuthorityV1[] | undefined {
  const sidecars = denseArray(input, MAX_RESULTS);
  const sourceResults = sourceReportResults(sourceReport);
  if (
    sidecars === undefined ||
    sourceResults === undefined ||
    sidecars.length !== report.results.length ||
    sourceResults.length !== report.results.length
  ) {
    return undefined;
  }
  return consumeExecutionReportPredicateSidecarsV1(report.results, sidecars, sourceResults);
}

/**
 * Mints serialization authority for one complete report assembled by the orchestrator.
 *
 * This function is intentionally absent from the package export surface. Structural copies do not
 * inherit authority, so public serializers cannot accept a caller-selected subset of route facts.
 */
export function authorizeExecutionAuthorityReportV1(
  report: ExecutionAuthorityReportV1,
  predicateSidecars?: readonly FailurePredicateEvidenceAuthorityV1[],
  routeOccurrences?: readonly ExecutionReportOccurrenceProvenanceInputV1[],
  routePlanBytes?: Uint8Array,
): ExecutionAuthorityReportV1;
export function authorizeExecutionAuthorityReportV1(
  report: unknown,
  predicateSidecars?: readonly FailurePredicateEvidenceAuthorityV1[],
  routeOccurrences?: readonly ExecutionReportOccurrenceProvenanceInputV1[],
  routePlanBytes?: Uint8Array,
): ExecutionAuthorityReportV1;
export function authorizeExecutionAuthorityReportV1(
  report: unknown,
  predicateSidecars?: readonly FailurePredicateEvidenceAuthorityV1[],
  routeOccurrences?: readonly ExecutionReportOccurrenceProvenanceInputV1[],
  routePlanBytes?: Uint8Array,
): object {
  const value = snapshotReport(report);
  const validatedSidecars =
    predicateSidecars === undefined
      ? undefined
      : consumePredicateSidecarOrder(value, predicateSidecars, report);
  if (
    (predicateSidecars === undefined) !== (routeOccurrences === undefined) ||
    (predicateSidecars === undefined) !== (routePlanBytes === undefined) ||
    (predicateSidecars !== undefined && validatedSidecars === undefined)
  ) {
    return Object.freeze({
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          code: "invalid-evidence-input",
          path: "/predicateSidecars",
          message: "Execution authority report predicate sidecars are invalid.",
        }),
      ] as const),
    });
  }
  if (validatedSidecars !== undefined) {
    if (
      routeOccurrences === undefined ||
      routePlanBytes === undefined ||
      !retainExecutionAuthorityReportProvenanceV1(
        value,
        validatedSidecars,
        routeOccurrences,
        routePlanBytes,
      )
    ) {
      return Object.freeze({
        ok: false,
        issues: Object.freeze([
          Object.freeze({
            code: "invalid-evidence-input",
            path: "/routeOccurrences",
            message: "Execution authority report route provenance is invalid.",
          }),
        ] as const),
      });
    }
  }
  AUTHORIZED_REPORTS.set(value, value);
  return value;
}

/** Resolves the exact authenticated predicate sidecars associated with a fresh report. */
export function getExecutionAuthorityReportPredicateSidecarsV1(report: unknown):
  | {
      readonly ok: true;
      readonly value: readonly FailurePredicateEvidenceV1[];
    }
  | {
      readonly ok: false;
      readonly issues: readonly [
        Readonly<{ readonly code: string; readonly path: string; readonly message: string }>,
      ];
    } {
  const reportObject = typeof report === "object" && report !== null ? report : undefined;
  const retained = reportObject === undefined ? undefined : AUTHORIZED_REPORTS.get(reportObject);
  if (reportObject === undefined || retained === undefined) {
    return Object.freeze({
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          code: "invalid-evidence-input",
          path: "/report",
          message: "Execution authority report is not genuine.",
        }),
      ] as const),
    });
  }
  const provenance = getExecutionAuthorityReportProvenanceStateV1(
    retained as ExecutionAuthorityReportV1,
  );
  if (provenance === undefined) {
    return Object.freeze({
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          code: "historical-authority-unavailable",
          path: "/report/predicateSidecars",
          message: "Historical execution report has no predicate sidecar authority.",
        }),
      ] as const),
    });
  }
  const projections = provenance.occurrences.map((occurrence) =>
    structuredClone(occurrence.sidecarProjection),
  );
  return Object.freeze({ ok: true, value: Object.freeze(projections) });
}

/** Returns opaque authorities for every exact position in one complete fresh report. */
export function getExecutionAuthorityReportPositionsV1(report: unknown):
  | { readonly ok: true; readonly value: readonly ExecutionReportPositionAuthorityV1[] }
  | {
      readonly ok: false;
      readonly issues: readonly [
        Readonly<{ readonly code: string; readonly path: string; readonly message: string }>,
      ];
    } {
  const retained =
    typeof report === "object" && report !== null ? AUTHORIZED_REPORTS.get(report) : undefined;
  const provenance =
    retained === undefined ? undefined : getExecutionAuthorityReportProvenanceStateV1(retained);
  if (provenance === undefined) {
    return Object.freeze({
      ok: false,
      issues: Object.freeze([
        Object.freeze({
          code: "historical-authority-unavailable",
          path: "/report/positions",
          message: "Historical execution report has no route occurrence provenance.",
        }),
      ] as const),
    });
  }
  return Object.freeze({ ok: true, value: Object.freeze([...provenance.positions]) });
}

/**
 * Serializes a closed execution report into deterministic LF-terminated canonical JSON.
 *
 * @param report Complete machine-neutral report.
 * @returns Fresh canonical UTF-8 bytes.
 *
 * @example
 * ```ts
 * const bytes = serializeExecutionAuthorityReportV1(report);
 * ```
 */
export function serializeExecutionAuthorityReportV1(
  report: ExecutionAuthorityReportV1,
): Uint8Array {
  const value =
    typeof report === "object" && report !== null ? AUTHORIZED_REPORTS.get(report) : undefined;
  if (value === undefined) {
    throw new TypeError("Execution authority report was not minted by campaign orchestration.");
  }
  return ENCODER.encode(`${JSON.stringify(value)}\n`);
}

/**
 * Serializes an alternate report only while the closed fault harness owns a pending boundary.
 *
 * The harness must be able to drive reconciliation against different, structurally valid bytes.
 * This private path snapshots those bytes without adding the caller's object to the authority
 * registry, so ordinary callers and later operations still cannot serialize structural copies.
 */
export function serializeExecutionAuthorityReportForPublicationV1(
  report: ExecutionAuthorityReportV1,
): Uint8Array {
  try {
    return serializeExecutionAuthorityReportV1(report);
  } catch (error) {
    if (getPendingExecutionReportFaultV1() === undefined) throw error;
    return ENCODER.encode(`${JSON.stringify(snapshotReport(report))}\n`);
  }
}

/** Returns the digest of exact canonical report bytes without exposing host paths. */
export function digestExecutionAuthorityReportV1(report: ExecutionAuthorityReportV1): string {
  return `sha256:${createHash("sha256")
    .update(serializeExecutionAuthorityReportV1(report))
    .digest("hex")}`;
}
