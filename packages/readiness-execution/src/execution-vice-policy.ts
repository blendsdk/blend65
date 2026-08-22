import { createHash } from "node:crypto";

import type { ViceControlIssueV1 } from "@blend65/test-harness/vice-control";
import type {
  ExecutionEvidenceSummaryV1,
  ExecutionOperationIssueCodeV1,
  ExecutionOperationResultV1,
  ExecutionResultCodeV1,
  ExecutionResultV1,
  ExecutionStageV1,
  ExecutionUsageV1,
} from "@blend65/readiness";

import {
  processFactToRecordV1,
  snapshotMatchesReferenceV1,
  viceBytesToHexV1,
  type ViceLeaseRecordV1,
} from "./execution-vice-record.js";
import type {
  ViceExecutionHostV1,
  ViceLeaseNodeIdentityV1,
  ViceProcessIdentityFactV1,
} from "./execution-vice-types.js";

/** Hard protocol limit for readiness-owned child attempts. */
export const MAX_ROUTE_ATTEMPTS = 8;
/** Exact readiness VICE version. */
export const READINESS_VICE_MINOR = 10;
/** Trusted executable resolved through the host environment without caller input. */
export const VICE_EXECUTABLE = "x64sc";
/** Exact instruction wire maximum. */
export const MAX_WIRE_INSTRUCTIONS = 65_535;
/** Frozen empty evidence used by VICE route terminal results. */
const EMPTY_EVIDENCE: ExecutionEvidenceSummaryV1 = Object.freeze({
  digest: `sha256:${createHash("sha256").digest("hex")}`,
  retainedBytes: 0,
  truncated: false,
});

/** Mutable cumulative counters owned by one route. */
export interface RouteUsage {
  instructions: number;
  cycles: number;
  launchAttempts: number;
}

/** Stable operation failure helper. */
export function operationFailure<T>(
  code: ExecutionOperationIssueCodeV1,
  path: string,
  message: string,
): ExecutionOperationResultV1<T> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([
      Object.freeze({ code, path, message: message.slice(0, 256) }),
    ]) as readonly [
      {
        readonly code: ExecutionOperationIssueCodeV1;
        readonly path: string;
        readonly message: string;
      },
    ],
  });
}

/** Stable operation success helper. */
export function operationSuccess<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

/** Creates a complete immutable usage snapshot. */
function usageSnapshot(usage: RouteUsage, wallMs: number): ExecutionUsageV1 {
  return Object.freeze({
    wallMs: Math.max(0, Math.floor(wallMs)),
    outputBytes: 0,
    evidenceBytes: 0,
    instructions: usage.instructions,
    cycles: usage.cycles,
    launchAttempts: usage.launchAttempts,
  });
}

/** Creates one canonical VICE route failure. */
export function routeFailure(
  code: Exclude<ExecutionResultCodeV1, "pass">,
  stage: ExecutionStageV1,
  usage: RouteUsage,
  wallMs: number,
  adapterSubcode?: string,
): ExecutionResultV1 {
  return Object.freeze({
    status: "failure",
    tier: "vice",
    stage,
    code,
    ...(adapterSubcode === undefined ? {} : { adapterSubcode }),
    usage: usageSnapshot(usage, wallMs),
    evidence: EMPTY_EVIDENCE,
  });
}

/** Creates one canonical VICE route pass. */
export function routePass(usage: RouteUsage, wallMs: number): ExecutionResultV1 {
  return Object.freeze({
    status: "pass",
    tier: "vice",
    stage: "compare",
    code: "pass",
    usage: usageSnapshot(usage, wallMs),
    evidence: EMPTY_EVIDENCE,
  });
}

/** Returns whether one filesystem node has bounded scalar identity facts. */
function isNodeIdentity(identity: ViceLeaseNodeIdentityV1): boolean {
  return (
    typeof identity.device === "bigint" &&
    identity.device >= 0n &&
    typeof identity.inode === "bigint" &&
    identity.inode > 0n &&
    Number.isSafeInteger(identity.uid) &&
    identity.uid >= 0 &&
    Number.isInteger(identity.mode) &&
    Number.isSafeInteger(identity.links) &&
    identity.links > 0
  );
}

/** Validates the trusted directory identity against the effective user. */
export function isTrustedDirectory(identity: ViceLeaseNodeIdentityV1, uid: number): boolean {
  return isNodeIdentity(identity) && identity.uid === uid && identity.mode === 0o700;
}

/** Validates a present regular lease and its retained compare-and-swap reference. */
export function isTrustedPresentLease(
  snapshot: Extract<
    Awaited<ReturnType<ViceExecutionHostV1["observeLease"]>>,
    { ok: true }
  >["value"],
  uid: number,
): snapshot is Extract<typeof snapshot, { readonly kind: "present" }> {
  if (snapshot.kind !== "present") return false;
  return (
    isTrustedDirectory(snapshot.directory, uid) &&
    isNodeIdentity(snapshot.file) &&
    snapshot.file.uid === uid &&
    snapshot.file.mode === 0o600 &&
    snapshot.file.links === 1 &&
    snapshot.file.device === snapshot.directory.device &&
    snapshotMatchesReferenceV1(snapshot)
  );
}

/** Tests exact supported endpoint facts before a launch attempt is recorded. */
export function areFreshEndpoints(
  endpoints: { readonly binaryPort: number; readonly textPort: number },
  usedPorts: ReadonlySet<number>,
): boolean {
  return (
    Number.isInteger(endpoints.binaryPort) &&
    endpoints.binaryPort >= 1 &&
    endpoints.binaryPort <= 65_535 &&
    Number.isInteger(endpoints.textPort) &&
    endpoints.textPort >= 1 &&
    endpoints.textPort <= 65_535 &&
    endpoints.binaryPort !== endpoints.textPort &&
    !usedPorts.has(endpoints.binaryPort) &&
    !usedPorts.has(endpoints.textPort)
  );
}

/** Builds exact fixed VICE arguments for the two fresh endpoints. */
export function viceArgv(binaryPort: number, textPort: number): readonly string[] {
  return Object.freeze([
    "-binarymonitor",
    "-binarymonitoraddress",
    `127.0.0.1:${binaryPort}`,
    "-remotemonitor",
    "-remotemonitoraddress",
    `127.0.0.1:${textPort}`,
    "+sound",
    "-warp",
    "-console",
    "-silent",
  ]);
}

/** Maps low-level launch classifications onto closed readiness outcomes. */
export function mapControlIssue(issue: ViceControlIssueV1): {
  readonly code: "emulator-launch-failure" | "emulator-handshake-failure" | "wall-time-exhaustion";
  readonly stage: "vice-launch" | "vice-handshake";
} {
  if (issue.reason === "vice.cancelled")
    return { code: "wall-time-exhaustion", stage: "vice-launch" };
  if (
    issue.reason === "vice.endpoint-owner" ||
    issue.reason === "vice.binary-handshake" ||
    issue.reason === "vice.text-handshake" ||
    issue.reason === "vice.target" ||
    issue.reason === "vice.version" ||
    issue.reason === "vice.frame"
  )
    return { code: "emulator-handshake-failure", stage: "vice-handshake" };
  return { code: "emulator-launch-failure", stage: "vice-launch" };
}

/** Builds an acquisition record with raw owner identity when available. */
export function initialRecord(
  uid: number,
  nonce: string,
  now: number,
  owner: ViceProcessIdentityFactV1 | null,
): Omit<ViceLeaseRecordV1, "checksum"> {
  return {
    schema: "blend65-vice-lease-v1",
    target: "c64",
    generation: 1,
    nonce,
    uid,
    acquiredAtMs: now,
    updatedAtMs: now,
    lifecycle: "acquired",
    owner: owner === null ? null : processFactToRecordV1(owner),
    attempt: null,
    child: null,
  };
}

/** Copies a record into its next attempt-recorded generation state. */
export function withAttempt(
  record: ViceLeaseRecordV1,
  token: Uint8Array,
  binaryPort: number,
  textPort: number,
  launchTokenPath: string,
  now: number,
): Omit<ViceLeaseRecordV1, "checksum"> {
  return {
    schema: record.schema,
    target: record.target,
    generation: record.generation,
    nonce: record.nonce,
    uid: record.uid,
    acquiredAtMs: record.acquiredAtMs,
    updatedAtMs: Math.max(record.updatedAtMs, now),
    lifecycle: "attempt-recorded",
    owner: record.owner,
    attempt: { launchToken: viceBytesToHexV1(token), binaryPort, textPort, launchTokenPath },
    child: null,
  };
}
