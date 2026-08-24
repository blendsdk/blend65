import { AsyncLocalStorage } from "node:async_hooks";

import {
  EXECUTION_RESULT_CODES_V1,
  EXECUTION_STAGES_V1,
  isExecutionDigestV1,
  isExecutionTierV1,
  type ExecutionPolicyV1,
  type ExecutionResultV1,
  type ExecutionTierV1,
} from "@blend65/readiness";

import type { ExecutionEnvironmentCapabilitiesV1 } from "./execution-orchestration-types.js";

/** Durable report transaction boundaries available to isolated conformance scopes. */
export type ReportFaultPointV1 =
  | "after-temporary-create"
  | "after-temporary-write"
  | "after-temporary-file-sync"
  | "before-report-rename"
  | "after-report-rename"
  | "after-report-directory-sync"
  | "during-report-reconciliation";

/** Read-only and faultable filesystem boundaries exposed only to isolated conformance scopes. */
export type ReportBoundaryPointV1 = ReportFaultPointV1 | "after-existing-report-read";

/** Bounded return-only observation emitted by orchestration conformance. */
export type ExecutionOrchestrationObservationV1 =
  | {
      readonly kind: "planned-execution";
      readonly executionIdentity: string;
      readonly tier: ExecutionTierV1;
      readonly ruleId: string;
      readonly obligation: string;
    }
  | {
      readonly kind: "result-substitution";
      readonly executionIdentity: string;
      readonly tier: ExecutionTierV1;
    }
  | { readonly kind: "report-fault"; readonly point: ReportFaultPointV1 }
  | {
      readonly kind: "report-reconciliation";
      readonly state: "prior-report" | "committed" | "ambiguous";
    };

/** Closed declarative controls accepted by one orchestration conformance scope. */
export interface ExecutionOrchestrationControlsV1 {
  /** Optional operation-local tool capability override. */
  readonly capabilities?: ExecutionEnvironmentCapabilitiesV1;
  /** Optional exact result substitutions keyed by execution identity and tier. */
  readonly actualResults?: readonly {
    /** Exact selected case/execution identity. */
    readonly executionIdentity: string;
    /** Exact terminal route tier. */
    readonly tier: ExecutionTierV1;
    /** Closed terminal result returned in place of genuine external work. */
    readonly result: ExecutionResultV1;
  }[];
  /** Optional report fault boundaries consumed exactly once. */
  readonly reportFaults?: readonly ReportFaultPointV1[];
  /** Package-private observation of the immutable policy used after planning. */
  readonly atPlannedPolicyUse?: (policy: ExecutionPolicyV1) => void;
  /** Package-private synchronous hook at each report transaction boundary. */
  readonly atReportBoundary?: (point: ReportBoundaryPointV1) => void;
}

interface RetainedResultV1 {
  readonly executionIdentity: string;
  readonly tier: ExecutionTierV1;
  readonly result: ExecutionResultV1;
  used: boolean;
}

interface OrchestrationStoreV1 {
  readonly token: { readonly generation: number; state: "active" | "closed" };
  readonly capabilities?: ExecutionEnvironmentCapabilitiesV1;
  readonly actualResults: ReadonlyMap<string, RetainedResultV1>;
  readonly reportFaults: ReadonlyMap<ReportFaultPointV1, { used: boolean }>;
  readonly transcript: ExecutionOrchestrationObservationV1[];
  readonly atPlannedPolicyUse?: (policy: ExecutionPolicyV1) => void;
  readonly atReportBoundary?: (point: ReportBoundaryPointV1) => void;
}

declare global {
  // Source-loaded tests and built public exports share one process-local operation scope.
  var __blend65ExecutionOrchestrationConformanceV1:
    | AsyncLocalStorage<OrchestrationStoreV1>
    | undefined;
}

const CONFORMANCE =
  globalThis.__blend65ExecutionOrchestrationConformanceV1 ??
  new AsyncLocalStorage<OrchestrationStoreV1>();
globalThis.__blend65ExecutionOrchestrationConformanceV1 = CONFORMANCE;

const MAX_RESULTS = 4_096;
const MAX_TRANSCRIPT = 16_384;
const MAX_TEXT_BYTES = 512;
let nextScopeGeneration = 1;
const ENCODER = new TextEncoder();
const RESULT_CODES = new Set<string>(EXECUTION_RESULT_CODES_V1);
const RESULT_STAGES = new Set<string>(EXECUTION_STAGES_V1);
const REPORT_FAULTS = new Set<ReportFaultPointV1>([
  "after-temporary-create",
  "after-temporary-write",
  "after-temporary-file-sync",
  "before-report-rename",
  "after-report-rename",
  "after-report-directory-sync",
  "during-report-reconciliation",
]);

function record(input: unknown, keys: readonly string[]): Readonly<Record<string, unknown>> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new TypeError("Orchestration conformance control must be a plain record.");
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("Orchestration conformance control must be a plain record.");
  }
  const ownKeys = Reflect.ownKeys(input);
  if (
    ownKeys.length !== keys.length ||
    ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))
  ) {
    throw new TypeError("Orchestration conformance control has an invalid schema.");
  }
  const retained: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError("Orchestration conformance control must contain data properties.");
    }
    retained[key] = descriptor.value;
  }
  return retained;
}

function optionalRecord(
  input: unknown,
  required: readonly string[],
  optional: readonly string[],
): Readonly<Record<string, unknown>> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new TypeError("Orchestration conformance value must be a plain record.");
  }
  const keys = Reflect.ownKeys(input);
  const stringKeys = keys.filter((key): key is string => typeof key === "string");
  if (
    stringKeys.length !== keys.length ||
    required.some((key) => !stringKeys.includes(key)) ||
    stringKeys.some((key) => !required.includes(key) && !optional.includes(key))
  ) {
    throw new TypeError("Orchestration conformance value has an invalid schema.");
  }
  return record(input, stringKeys);
}

function denseArray(input: unknown, maximum: number): readonly unknown[] {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) {
    throw new TypeError("Orchestration conformance list must be a plain array.");
  }
  const length = input.length;
  if (
    !Number.isSafeInteger(length) ||
    length > maximum ||
    Reflect.ownKeys(input).length !== length + 1
  ) {
    throw new TypeError("Orchestration conformance list is sparse or exceeds its bound.");
  }
  const retained: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Reflect.getOwnPropertyDescriptor(input, String(index));
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError("Orchestration conformance list must contain data properties.");
    }
    retained.push(descriptor.value);
  }
  return retained;
}

function boundedText(value: unknown, allowEmpty = false): value is string {
  return (
    typeof value === "string" &&
    (allowEmpty || value.length > 0) &&
    ENCODER.encode(value).byteLength <= MAX_TEXT_BYTES
  );
}

function natural(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value >= 0;
}

/** Normalizes both closed execution-evidence digest spellings into report authority form. */
function canonicalEvidenceDigest(value: unknown): string | undefined {
  if (isExecutionDigestV1(value)) return value;
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value) ? `sha256:${value}` : undefined;
}

function snapshotUsage(input: unknown): ExecutionResultV1["usage"] {
  const value = record(input, [
    "wallMs",
    "outputBytes",
    "evidenceBytes",
    "instructions",
    "cycles",
    "launchAttempts",
  ]);
  if (
    typeof value.wallMs !== "number" ||
    !Number.isFinite(value.wallMs) ||
    value.wallMs < 0 ||
    [
      value.outputBytes,
      value.evidenceBytes,
      value.instructions,
      value.cycles,
      value.launchAttempts,
    ].some((entry) => !natural(entry))
  ) {
    throw new TypeError("Substituted execution usage is invalid.");
  }
  return Object.freeze({
    wallMs: value.wallMs as number,
    outputBytes: value.outputBytes as number,
    evidenceBytes: value.evidenceBytes as number,
    instructions: value.instructions as number,
    cycles: value.cycles as number,
    launchAttempts: value.launchAttempts as number,
  });
}

function snapshotEvidence(input: unknown): ExecutionResultV1["evidence"] {
  const value = record(input, ["digest", "retainedBytes", "truncated"]);
  const digest = canonicalEvidenceDigest(value.digest);
  if (
    digest === undefined ||
    !natural(value.retainedBytes) ||
    typeof value.truncated !== "boolean"
  ) {
    throw new TypeError("Substituted execution evidence is invalid.");
  }
  return Object.freeze({
    digest,
    retainedBytes: value.retainedBytes,
    truncated: value.truncated,
  });
}

function snapshotCleanup(
  input: unknown,
): NonNullable<Extract<ExecutionResultV1, { status: "failure" }>["cleanupBlocker"]> {
  const value = record(input, ["code", "evidenceDigest"]);
  const evidenceDigest = canonicalEvidenceDigest(value.evidenceDigest);
  if (value.code !== "emulator-lease-recovery-blocked" || evidenceDigest === undefined) {
    throw new TypeError("Substituted cleanup evidence is invalid.");
  }
  return Object.freeze({ code: value.code, evidenceDigest });
}

/** Copies and validates one closed execution result for package-private orchestration use. */
export function snapshotExecutionResultForOrchestrationV1(
  input: unknown,
  expectedTier: ExecutionTierV1,
): ExecutionResultV1 {
  const base = optionalRecord(
    input,
    ["status", "tier", "stage", "code", "usage", "evidence"],
    ["adapterSubcode", "cleanupBlocker"],
  );
  if (
    base.tier !== expectedTier ||
    !isExecutionTierV1(base.tier) ||
    typeof base.stage !== "string" ||
    !RESULT_STAGES.has(base.stage) ||
    typeof base.code !== "string" ||
    !RESULT_CODES.has(base.code)
  ) {
    throw new TypeError("Substituted execution result identity is invalid.");
  }
  const usage = snapshotUsage(base.usage);
  const evidence = snapshotEvidence(base.evidence);
  if (base.status === "pass") {
    if (base.code !== "pass" || "adapterSubcode" in base || "cleanupBlocker" in base) {
      throw new TypeError("Substituted pass result is invalid.");
    }
    return Object.freeze({
      status: "pass",
      tier: base.tier,
      stage: base.stage as ExecutionResultV1["stage"],
      code: "pass",
      usage,
      evidence,
    });
  }
  if (base.status !== "failure" || base.code === "pass") {
    throw new TypeError("Substituted failure result is invalid.");
  }
  if (base.adapterSubcode !== undefined && !boundedText(base.adapterSubcode)) {
    throw new TypeError("Substituted adapter subcode is invalid.");
  }
  const cleanupBlocker =
    base.cleanupBlocker === undefined ? undefined : snapshotCleanup(base.cleanupBlocker);
  return Object.freeze({
    status: "failure",
    tier: base.tier,
    stage: base.stage as ExecutionResultV1["stage"],
    code: base.code as Exclude<ExecutionResultV1["code"], "pass">,
    ...(base.adapterSubcode === undefined ? {} : { adapterSubcode: base.adapterSubcode as string }),
    usage,
    evidence,
    ...(cleanupBlocker === undefined ? {} : { cleanupBlocker }),
  });
}

function snapshotCapability(input: unknown): {
  readonly available: boolean;
  readonly version?: string;
} {
  const value = optionalRecord(input, ["available"], ["version"]);
  if (typeof value.available !== "boolean") {
    throw new TypeError("Execution capability availability is invalid.");
  }
  if (value.version !== undefined && !boundedText(value.version)) {
    throw new TypeError("Execution capability version is invalid.");
  }
  return Object.freeze({
    available: value.available,
    ...(value.version === undefined ? {} : { version: value.version as string }),
  });
}

function snapshotControls(input: unknown): OrchestrationStoreV1 {
  const controls = optionalRecord(
    input,
    [],
    ["capabilities", "actualResults", "reportFaults", "atPlannedPolicyUse", "atReportBoundary"],
  );
  if (
    (controls.atPlannedPolicyUse !== undefined &&
      typeof controls.atPlannedPolicyUse !== "function") ||
    (controls.atReportBoundary !== undefined && typeof controls.atReportBoundary !== "function")
  ) {
    throw new TypeError("Orchestration conformance callback is invalid.");
  }
  const capabilities =
    controls.capabilities === undefined
      ? undefined
      : (() => {
          const value = record(controls.capabilities, ["acme", "vice"]);
          return Object.freeze({
            acme: snapshotCapability(value.acme),
            vice: snapshotCapability(value.vice),
          });
        })();
  const actualResults = new Map<string, RetainedResultV1>();
  for (const inputResult of denseArray(controls.actualResults ?? [], MAX_RESULTS)) {
    const value = record(inputResult, ["executionIdentity", "tier", "result"]);
    if (!isExecutionDigestV1(value.executionIdentity) || !isExecutionTierV1(value.tier)) {
      throw new TypeError("Substituted execution identity or tier is invalid.");
    }
    const key = `${value.executionIdentity}\0${value.tier}`;
    if (actualResults.has(key)) throw new TypeError("Duplicate execution result substitution.");
    actualResults.set(key, {
      executionIdentity: value.executionIdentity,
      tier: value.tier,
      result: snapshotExecutionResultForOrchestrationV1(value.result, value.tier),
      used: false,
    });
  }
  const reportFaults = new Map<ReportFaultPointV1, { used: boolean }>();
  for (const point of denseArray(controls.reportFaults ?? [], REPORT_FAULTS.size)) {
    if (typeof point !== "string" || !REPORT_FAULTS.has(point as ReportFaultPointV1)) {
      throw new TypeError("Unknown report fault point.");
    }
    const retained = point as ReportFaultPointV1;
    if (reportFaults.has(retained)) throw new TypeError("Duplicate report fault point.");
    reportFaults.set(retained, { used: false });
  }
  return {
    token: { generation: nextScopeGeneration, state: "active" },
    ...(capabilities === undefined ? {} : { capabilities }),
    actualResults,
    reportFaults,
    transcript: [],
    ...(controls.atPlannedPolicyUse === undefined
      ? {}
      : { atPlannedPolicyUse: controls.atPlannedPolicyUse as (policy: ExecutionPolicyV1) => void }),
    ...(controls.atReportBoundary === undefined
      ? {}
      : { atReportBoundary: controls.atReportBoundary as (point: ReportBoundaryPointV1) => void }),
  };
}

/** Returns only a currently active operation store and rejects detached inherited access. */
function activeStore(): OrchestrationStoreV1 | undefined {
  const store = CONFORMANCE.getStore();
  if (store !== undefined && store.token.state !== "active") {
    throw new TypeError("Orchestration conformance scope is closed.");
  }
  return store;
}

function append(observation: ExecutionOrchestrationObservationV1): void {
  const store = activeStore();
  if (store === undefined) return;
  if (store.transcript.length >= MAX_TRANSCRIPT) {
    throw new TypeError("Orchestration conformance transcript capacity exceeded.");
  }
  store.transcript.push(Object.freeze(observation));
}

/** Returns a copied operation-local capability override when one is active. */
export function getExecutionEnvironmentCapabilitiesOverrideV1():
  | ExecutionEnvironmentCapabilitiesV1
  | undefined {
  return activeStore()?.capabilities;
}

/** Invokes the operation-local policy-use observer with the planner's frozen policy. */
export function observePlannedExecutionPolicyUseV1(policy: ExecutionPolicyV1): void {
  activeStore()?.atPlannedPolicyUse?.(policy);
}

/** Records one fully serialized route before orchestration performs route work. */
export function recordPlannedExecutionV1(
  executionIdentity: string,
  tier: ExecutionTierV1,
  ruleId: string,
  obligation: string,
): void {
  if (
    !isExecutionDigestV1(executionIdentity) ||
    !isExecutionTierV1(tier) ||
    !boundedText(ruleId) ||
    !boundedText(obligation)
  ) {
    throw new TypeError("Planned execution observation is invalid.");
  }
  append({ kind: "planned-execution", executionIdentity, tier, ruleId, obligation });
}

/** Consumes the exact operation-local result substitution, if configured. */
export function takeExecutionResultSubstitutionV1(
  executionIdentity: string,
  tier: ExecutionTierV1,
): ExecutionResultV1 | undefined {
  const store = activeStore();
  if (store === undefined) return undefined;
  const retained = store.actualResults.get(`${executionIdentity}\0${tier}`);
  if (retained === undefined) return undefined;
  if (retained.used) throw new TypeError("Execution result substitution was consumed twice.");
  retained.used = true;
  append({ kind: "result-substitution", executionIdentity, tier });
  return retained.result;
}

/** Consumes one operation-local report fault at its exact transaction boundary. */
export function consumeExecutionReportFaultV1(point: ReportFaultPointV1): boolean {
  const store = activeStore();
  store?.atReportBoundary?.(point);
  const retained = store?.reportFaults.get(point);
  if (retained === undefined) return false;
  if (retained.used) throw new TypeError("Report fault point was consumed twice.");
  retained.used = true;
  append({ kind: "report-fault", point });
  return true;
}

/** Observes one non-faultable report boundary inside an active conformance scope. */
export function observeExecutionReportBoundaryV1(point: "after-existing-report-read"): void {
  activeStore()?.atReportBoundary?.(point);
}

/** Returns the sole pending report fault without consuming its boundary. */
export function getPendingExecutionReportFaultV1(): ReportFaultPointV1 | undefined {
  const faults = activeStore()?.reportFaults;
  if (faults === undefined) return undefined;
  for (const [point, retained] of faults) {
    if (!retained.used) return point;
  }
  return undefined;
}

/** Records one bounded report reconciliation classification. */
export function recordExecutionReportReconciliationV1(
  state: "prior-report" | "committed" | "ambiguous",
): void {
  append({ kind: "report-reconciliation", state });
}

/**
 * Runs one operation with copied, bounded, operation-local declarative controls.
 *
 * @param controls Closed tool, substitution, and report-fault controls.
 * @param operation Operation executed within the isolated async context.
 * @returns The operation result and a frozen bounded observation transcript.
 */
export async function runWithExecutionOrchestrationConformanceV1<T>(
  controls: ExecutionOrchestrationControlsV1,
  operation: () => T | Promise<T>,
): Promise<{
  readonly value: T;
  readonly transcript: readonly ExecutionOrchestrationObservationV1[];
}> {
  if (activeStore() !== undefined) {
    throw new TypeError("Nested orchestration conformance scopes are not allowed.");
  }
  if (typeof operation !== "function") throw new TypeError("A conformance operation is required.");
  const store = snapshotControls(controls);
  nextScopeGeneration += 1;
  return CONFORMANCE.run(store, async () => {
    try {
      const value = await operation();
      if ([...store.actualResults.values()].some((result) => !result.used)) {
        throw new TypeError("Execution result substitution was not matched.");
      }
      if ([...store.reportFaults.values()].some((fault) => !fault.used)) {
        throw new TypeError("Report fault point was not reached.");
      }
      return Object.freeze({
        value,
        transcript: Object.freeze([...store.transcript]),
      });
    } finally {
      store.token.state = "closed";
    }
  });
}
