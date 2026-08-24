import { createHash, randomUUID } from "node:crypto";
import { lstatSync, renameSync } from "node:fs";
import { chmod, lstat, mkdir, realpath } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import {
  isExecutionDigestV1,
  isExecutionTierV1,
  type ExecutionOperationResultV1,
  type ExecutionProjectionRevisionV1,
  type ExecutionResultV1,
} from "@blend65/readiness";

import {
  consumeExecutionReportFaultV1,
  getPendingExecutionReportFaultV1,
  observeExecutionReportBoundaryV1,
  recordExecutionReportReconciliationV1,
  snapshotExecutionResultForOrchestrationV1,
  type ReportFaultPointV1,
} from "./execution-orchestration-conformance-v1.js";
import type { ExecutionAuthorityReportV1 } from "./execution-orchestration.js";
import type {
  ExecutionRouteAuthorityRecordV1,
  ExecutionRouteToolV1,
} from "./execution-orchestration.js";
import { EXECUTION_AUTHORITY_REPORT_ROUTE_LIMIT_V1 } from "./execution-orchestration-types.js";
import { deriveCampaignRouteExecutionIdentityV1 } from "./execution-orchestration-identity.js";
import {
  cleanupSecureSelectionFileV1,
  commitSecureSelectionFileNoClobberV1,
  pinSecureSelectionDirectoryV1,
  readSecureSelectionFileV1,
  synchronizeSecureSelectionDirectoryV1,
  verifySecureSelectionDirectoryV1,
  writeSecureSelectionFileV1,
  type SecureSelectionDirectoryIdentityV1,
} from "./execution-publication-secure-filesystem.js";

/** Canonical repository-relative report location. */
export const EXECUTION_AUTHORITY_REPORT_PATH_V1 =
  "readiness/execution-evidence/rd-04-local-v1.json";

const ENCODER = new TextEncoder();
const MAX_REPORT_BYTES = 64 * 1024 * 1024;
const MAX_RESULTS = EXECUTION_AUTHORITY_REPORT_ROUTE_LIMIT_V1;
const MAX_BLOCKERS = 8_192;
const MAX_TEXT_BYTES = 512;
const AUTHORIZED_REPORTS = new WeakMap<object, ExecutionAuthorityReportV1>();

function failure<T>(
  code: "execution.invalid-schema" | "execution.io" | "execution.reconciliation",
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

/**
 * Mints serialization authority for one complete report assembled by the orchestrator.
 *
 * This function is intentionally absent from the package export surface. Structural copies do not
 * inherit authority, so public serializers cannot accept a caller-selected subset of route facts.
 */
export function authorizeExecutionAuthorityReportV1(
  report: ExecutionAuthorityReportV1,
): ExecutionAuthorityReportV1 {
  const value = snapshotReport(report);
  AUTHORIZED_REPORTS.set(value, value);
  return value;
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
function serializeReportForPublicationV1(report: ExecutionAuthorityReportV1): Uint8Array {
  try {
    return serializeExecutionAuthorityReportV1(report);
  } catch (error) {
    if (getPendingExecutionReportFaultV1() === undefined) throw error;
    return ENCODER.encode(`${JSON.stringify(snapshotReport(report))}\n`);
  }
}

function secureExistingBytes(
  repositoryRoot: string,
  path: string,
  directory: SecureSelectionDirectoryIdentityV1,
): Uint8Array | undefined {
  if (!verifySecureSelectionDirectoryV1(directory)) {
    throw new TypeError("Report directory identity changed before read.");
  }
  try {
    lstatSync(path);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      if (!verifySecureSelectionDirectoryV1(directory)) {
        throw new TypeError("Report directory identity changed while checking absence.");
      }
      return undefined;
    }
    throw error;
  }
  const retained = readSecureSelectionFileV1(repositoryRoot, path, MAX_REPORT_BYTES);
  if (!retained.ok) throw new TypeError(retained.issues[0].message);
  observeExecutionReportBoundaryV1("after-existing-report-read");
  if (!verifySecureSelectionDirectoryV1(directory)) {
    throw new TypeError("Report directory identity changed while reading evidence.");
  }
  return retained.value;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength && left.every((value, index) => value === right[index])
  );
}

async function ensureDirectory(path: string, create: boolean): Promise<void> {
  if (create)
    await mkdir(path, { mode: 0o700 }).catch((error: unknown) => {
      if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        error.code !== "EEXIST"
      ) {
        throw error;
      }
    });
  const status = await lstat(path, { bigint: true });
  if (status.isSymbolicLink() || !status.isDirectory()) {
    throw new TypeError("Report path component is not a real directory.");
  }
  if ((await realpath(path)) !== path) {
    throw new TypeError("Report path component is not canonical.");
  }
}

function injectedFailure(point: ReportFaultPointV1): ExecutionOperationResultV1<string> {
  return failure(
    point === "after-report-rename" ||
      point === "after-report-directory-sync" ||
      point === "during-report-reconciliation"
      ? "execution.reconciliation"
      : "execution.io",
    EXECUTION_AUTHORITY_REPORT_PATH_V1,
    "Execution authority report publication did not complete.",
  );
}

/**
 * Durably publishes one canonical report without replacing different existing evidence.
 *
 * @param repositoryRoot Canonical absolute repository root.
 * @param report Complete report to publish.
 * @returns The fixed repository-relative report path or a stable filesystem issue.
 *
 * @example
 * ```ts
 * const written = await writeExecutionAuthorityReportV1(root, report);
 * ```
 */
export async function writeExecutionAuthorityReportV1(
  repositoryRoot: string,
  report: ExecutionAuthorityReportV1,
): Promise<ExecutionOperationResultV1<string>> {
  let bytes: Uint8Array;
  try {
    bytes = serializeReportForPublicationV1(report);
    if (bytes.byteLength > MAX_REPORT_BYTES) {
      return failure(
        "execution.invalid-schema",
        "/report",
        "Execution authority report exceeds its byte bound.",
      );
    }
  } catch {
    return failure(
      "execution.invalid-schema",
      "/report",
      "Execution authority report is not canonical.",
    );
  }
  const root = resolve(repositoryRoot);
  if (!isAbsolute(repositoryRoot) || root !== repositoryRoot) {
    return failure("execution.io", "/repositoryRoot", "Repository root is not canonical.");
  }
  const readiness = join(root, "readiness");
  const directory = join(readiness, "execution-evidence");
  const target = join(root, EXECUTION_AUTHORITY_REPORT_PATH_V1);
  const temporary = join(directory, `.rd-04-local-v1.${randomUUID()}.tmp`);
  const shadow = join(directory, `.rd-04-local-v1.${randomUUID()}.reconciliation`);
  let pinnedDirectory: SecureSelectionDirectoryIdentityV1 | undefined;
  let temporaryExists = false;
  let shadowExists = false;
  let targetCommitted = false;
  try {
    await mkdir(root, { recursive: true, mode: 0o700 });
    await ensureDirectory(root, false);
    await ensureDirectory(readiness, true);
    await ensureDirectory(directory, true);
    await chmod(directory, 0o700);
    const pinned = pinSecureSelectionDirectoryV1(directory);
    if (!pinned.ok) {
      return failure("execution.io", EXECUTION_AUTHORITY_REPORT_PATH_V1, pinned.issues[0].message);
    }
    pinnedDirectory = pinned.value;
    const existing = secureExistingBytes(root, target, pinnedDirectory);
    if (existing !== undefined && equalBytes(existing, bytes)) {
      return success(EXECUTION_AUTHORITY_REPORT_PATH_V1);
    }
    const pendingFault = getPendingExecutionReportFaultV1();
    if (existing !== undefined && pendingFault === undefined) {
      recordExecutionReportReconciliationV1("prior-report");
      return failure(
        "execution.reconciliation",
        EXECUTION_AUTHORITY_REPORT_PATH_V1,
        "A different immutable execution authority report already exists.",
      );
    }

    const written = writeSecureSelectionFileV1(pinnedDirectory, temporary, bytes);
    if (!written.ok) {
      return failure("execution.io", EXECUTION_AUTHORITY_REPORT_PATH_V1, written.issues[0].message);
    }
    temporaryExists = true;
    if (consumeExecutionReportFaultV1("after-temporary-create")) {
      return injectedFailure("after-temporary-create");
    }
    if (consumeExecutionReportFaultV1("after-temporary-write")) {
      return injectedFailure("after-temporary-write");
    }
    if (consumeExecutionReportFaultV1("after-temporary-file-sync")) {
      return injectedFailure("after-temporary-file-sync");
    }
    if (consumeExecutionReportFaultV1("before-report-rename")) {
      return injectedFailure("before-report-rename");
    }

    if (existing !== undefined) {
      if (!verifySecureSelectionDirectoryV1(pinnedDirectory)) {
        return failure(
          "execution.io",
          EXECUTION_AUTHORITY_REPORT_PATH_V1,
          "Execution report directory changed before reconciliation.",
        );
      }
      renameSync(temporary, shadow);
      temporaryExists = false;
      shadowExists = true;
      if (!verifySecureSelectionDirectoryV1(pinnedDirectory)) {
        return failure(
          "execution.reconciliation",
          EXECUTION_AUTHORITY_REPORT_PATH_V1,
          "Execution report directory changed during reconciliation.",
        );
      }
      if (consumeExecutionReportFaultV1("after-report-rename")) {
        recordExecutionReportReconciliationV1("prior-report");
        return injectedFailure("after-report-rename");
      }
      const synchronized = synchronizeSecureSelectionDirectoryV1(pinnedDirectory, () => false);
      if (!synchronized.ok) {
        return failure(
          "execution.reconciliation",
          EXECUTION_AUTHORITY_REPORT_PATH_V1,
          synchronized.issues[0].message,
        );
      }
      if (consumeExecutionReportFaultV1("after-report-directory-sync")) {
        recordExecutionReportReconciliationV1("prior-report");
        return injectedFailure("after-report-directory-sync");
      }
      if (consumeExecutionReportFaultV1("during-report-reconciliation")) {
        recordExecutionReportReconciliationV1("prior-report");
        return injectedFailure("during-report-reconciliation");
      }
      recordExecutionReportReconciliationV1("prior-report");
      return failure(
        "execution.reconciliation",
        EXECUTION_AUTHORITY_REPORT_PATH_V1,
        "A different immutable execution authority report already exists.",
      );
    }

    const committed = commitSecureSelectionFileNoClobberV1(
      root,
      pinnedDirectory,
      written.value,
      target,
      bytes,
    );
    if (!committed.ok) {
      return failure(
        committed.issues[0].code === "execution.reconciliation"
          ? "execution.reconciliation"
          : "execution.io",
        EXECUTION_AUTHORITY_REPORT_PATH_V1,
        committed.issues[0].message,
      );
    }
    if (committed.value === "committed") {
      targetCommitted = true;
      temporaryExists = false;
    } else {
      const raced = secureExistingBytes(root, target, pinnedDirectory);
      if (raced === undefined || !equalBytes(raced, bytes)) {
        recordExecutionReportReconciliationV1("prior-report");
        return failure(
          "execution.reconciliation",
          EXECUTION_AUTHORITY_REPORT_PATH_V1,
          "A different immutable execution authority report won publication.",
        );
      }
      const synchronized = synchronizeSecureSelectionDirectoryV1(pinnedDirectory, () => false);
      if (!synchronized.ok) {
        recordExecutionReportReconciliationV1("ambiguous");
        return failure(
          "execution.reconciliation",
          EXECUTION_AUTHORITY_REPORT_PATH_V1,
          synchronized.issues[0].message,
        );
      }
      const retained = secureExistingBytes(root, target, pinnedDirectory);
      if (retained === undefined || !equalBytes(retained, bytes)) {
        recordExecutionReportReconciliationV1("ambiguous");
        return failure(
          "execution.reconciliation",
          EXECUTION_AUTHORITY_REPORT_PATH_V1,
          "Concurrent report publication could not be revalidated.",
        );
      }
      recordExecutionReportReconciliationV1("committed");
      return success(EXECUTION_AUTHORITY_REPORT_PATH_V1);
    }
    if (consumeExecutionReportFaultV1("after-report-rename")) {
      recordExecutionReportReconciliationV1("committed");
      return injectedFailure("after-report-rename");
    }
    const synchronized = synchronizeSecureSelectionDirectoryV1(pinnedDirectory, () => false);
    if (!synchronized.ok) {
      recordExecutionReportReconciliationV1("ambiguous");
      return failure(
        "execution.reconciliation",
        EXECUTION_AUTHORITY_REPORT_PATH_V1,
        synchronized.issues[0].message,
      );
    }
    if (consumeExecutionReportFaultV1("after-report-directory-sync")) {
      recordExecutionReportReconciliationV1("committed");
      return injectedFailure("after-report-directory-sync");
    }
    if (consumeExecutionReportFaultV1("during-report-reconciliation")) {
      recordExecutionReportReconciliationV1("committed");
      return injectedFailure("during-report-reconciliation");
    }
    const retained = secureExistingBytes(root, target, pinnedDirectory);
    if (retained === undefined || !equalBytes(retained, bytes)) {
      recordExecutionReportReconciliationV1("ambiguous");
      return failure(
        "execution.reconciliation",
        EXECUTION_AUTHORITY_REPORT_PATH_V1,
        "Committed execution authority report could not be revalidated.",
      );
    }
    return success(EXECUTION_AUTHORITY_REPORT_PATH_V1);
  } catch {
    if (targetCommitted) recordExecutionReportReconciliationV1("ambiguous");
    return failure(
      targetCommitted ? "execution.reconciliation" : "execution.io",
      EXECUTION_AUTHORITY_REPORT_PATH_V1,
      "Execution authority report filesystem transaction failed.",
    );
  } finally {
    if (pinnedDirectory !== undefined) {
      if (temporaryExists) cleanupSecureSelectionFileV1(temporary, pinnedDirectory);
      if (shadowExists) cleanupSecureSelectionFileV1(shadow, pinnedDirectory);
    }
  }
}

/** Returns the digest of exact canonical report bytes without exposing host paths. */
export function digestExecutionAuthorityReportV1(report: ExecutionAuthorityReportV1): string {
  return `sha256:${createHash("sha256")
    .update(serializeExecutionAuthorityReportV1(report))
    .digest("hex")}`;
}
