import { createHash } from "node:crypto";

import type {
  ViceLeaseReferenceV1,
  ViceLeaseSnapshotV1,
  ViceProcessIdentityFactV1,
} from "./execution-vice-types.js";

/** Maximum trusted lease-record size. */
export const MAX_VICE_LEASE_BYTES_V1 = 64 * 1024;
/** Exact lease-record schema discriminator. */
const LEASE_SCHEMA = "blend65-vice-lease-v1";
/** Exact lower-case hex digest shape. */
const HEX_64 = /^[0-9a-f]{64}$/;
/** Exact lower-case nonce/token shape. */
const HEX_BYTES = /^[0-9a-f]+$/;

/** Serializable process identity retained in a lease record. */
export interface ViceLeaseProcessRecordV1 {
  /** Linux boot identifier. */
  readonly bootId: string;
  /** Positive process identifier. */
  readonly pid: number;
  /** `/proc` start ticks represented without numeric precision loss. */
  readonly startTicks: string;
  /** Positive process group identifier. */
  readonly processGroupId: number;
  /** Exact launch token, or null before a child attempt exists. */
  readonly launchToken: string | null;
  /** Canonical artifact path that supplied the launch token. */
  readonly launchTokenPath: string | null;
}

/** Serializable route-attempt claim stored before process creation. */
export interface ViceLeaseAttemptRecordV1 {
  /** Fresh launch token encoded as lower-case hex. */
  readonly launchToken: string;
  /** Distinct binary monitor port. */
  readonly binaryPort: number;
  /** Distinct text monitor port. */
  readonly textPort: number;
  /** Canonical fixed-namespace artifact reserved for this attempt. */
  readonly launchTokenPath: string;
}

/** Complete parsed lease record with a verified checksum. */
export interface ViceLeaseRecordV1 {
  /** Exact schema identifier. */
  readonly schema: typeof LEASE_SCHEMA;
  /** Target namespace. */
  readonly target: "c64";
  /** Monotonically increasing positive generation. */
  readonly generation: number;
  /** Fresh 32-byte acquisition nonce encoded as hex. */
  readonly nonce: string;
  /** Effective user that owns the namespace. */
  readonly uid: number;
  /** Monotonic acquisition timestamp. */
  readonly acquiredAtMs: number;
  /** Monotonic last-transition timestamp. */
  readonly updatedAtMs: number;
  /** Current lifecycle state. */
  readonly lifecycle: "acquired" | "attempt-recorded" | "child-recorded";
  /** Acquiring process identity when the host could prove it. */
  readonly owner: ViceLeaseProcessRecordV1 | null;
  /** Most recent route attempt, if any. */
  readonly attempt: ViceLeaseAttemptRecordV1 | null;
  /** Same-PID child identity after durable launcher recording. */
  readonly child: ViceLeaseProcessRecordV1 | null;
  /** SHA-256 of every preceding canonical field. */
  readonly checksum: string;
}

/** Lease record fields covered by the checksum. */
type ViceLeaseRecordPayloadV1 = Omit<ViceLeaseRecordV1, "checksum">;

/** Converts raw bytes into lower-case hexadecimal text. */
export function viceBytesToHexV1(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

/** Returns an owned copy of exact lower-case hexadecimal bytes. */
export function viceHexToBytesV1(hex: string): Uint8Array | undefined {
  if (!HEX_BYTES.test(hex) || hex.length % 2 !== 0) return undefined;
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

/** Converts one observed process fact into a deterministic serializable record. */
export function processFactToRecordV1(fact: ViceProcessIdentityFactV1): ViceLeaseProcessRecordV1 {
  return Object.freeze({
    bootId: fact.bootId,
    pid: fact.pid,
    startTicks: fact.startTicks.toString(10),
    processGroupId: fact.processGroupId,
    launchToken: fact.launchToken === null ? null : viceBytesToHexV1(fact.launchToken),
    launchTokenPath: fact.launchTokenPath ?? null,
  });
}

/** Tests all process identity fields, including the launch token. */
export function processFactMatchesRecordV1(
  fact: ViceProcessIdentityFactV1,
  record: ViceLeaseProcessRecordV1,
): boolean {
  const token = fact.launchToken === null ? null : viceBytesToHexV1(fact.launchToken);
  return (
    fact.bootId === record.bootId &&
    fact.pid === record.pid &&
    fact.startTicks.toString(10) === record.startTicks &&
    fact.processGroupId === record.processGroupId &&
    token === record.launchToken &&
    (fact.launchTokenPath ?? null) === record.launchTokenPath
  );
}

/** Produces canonical JSON bytes in one fixed property order. */
function payloadBytes(payload: ViceLeaseRecordPayloadV1): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(payload));
}

/** Adds the checksum and returns immutable canonical record bytes. */
export function encodeViceLeaseRecordV1(payload: ViceLeaseRecordPayloadV1): Uint8Array {
  const checksum = createHash("sha256").update(payloadBytes(payload)).digest("hex");
  return new TextEncoder().encode(JSON.stringify({ ...payload, checksum }));
}

/** Reads one plain JSON object without invoking inherited accessors. */
function parsePlainRecord(bytes: Uint8Array): Record<string, unknown> | undefined {
  if (bytes.byteLength < 2 || bytes.byteLength > MAX_VICE_LEASE_BYTES_V1) return undefined;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      Object.getPrototypeOf(parsed) !== Object.prototype
    ) {
      return undefined;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** Validates an externally supplied process-record object. */
function isProcessRecord(value: unknown): value is ViceLeaseProcessRecordV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === 6 &&
    typeof record.bootId === "string" &&
    record.bootId.length >= 1 &&
    record.bootId.length <= 128 &&
    Number.isSafeInteger(record.pid) &&
    (record.pid as number) > 0 &&
    typeof record.startTicks === "string" &&
    /^\d+$/.test(record.startTicks) &&
    Number.isSafeInteger(record.processGroupId) &&
    (record.processGroupId as number) > 0 &&
    (record.launchToken === null ||
      (typeof record.launchToken === "string" &&
        record.launchToken.length === 64 &&
        HEX_BYTES.test(record.launchToken))) &&
    (record.launchTokenPath === null ||
      (typeof record.launchTokenPath === "string" &&
        /^\/run\/user\/\d+\/blend65\/vice\/c64\/launch-[0-9a-f]{64}\.json$/.test(
          record.launchTokenPath,
        )))
  );
}

/** Validates an externally supplied attempt-record object. */
function isAttemptRecord(value: unknown): value is ViceLeaseAttemptRecordV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === 4 &&
    typeof record.launchToken === "string" &&
    record.launchToken.length === 64 &&
    HEX_BYTES.test(record.launchToken) &&
    Number.isInteger(record.binaryPort) &&
    (record.binaryPort as number) >= 1 &&
    (record.binaryPort as number) <= 65_535 &&
    Number.isInteger(record.textPort) &&
    (record.textPort as number) >= 1 &&
    (record.textPort as number) <= 65_535 &&
    record.binaryPort !== record.textPort &&
    typeof record.launchTokenPath === "string" &&
    /^\/run\/user\/\d+\/blend65\/vice\/c64\/launch-[0-9a-f]{64}\.json$/.test(record.launchTokenPath)
  );
}

/** Parses one bounded checksummed lease record with an exact property set. */
export function parseViceLeaseRecordV1(bytes: Uint8Array): ViceLeaseRecordV1 | undefined {
  const record = parsePlainRecord(bytes);
  if (record === undefined) return undefined;
  const keys = [
    "schema",
    "target",
    "generation",
    "nonce",
    "uid",
    "acquiredAtMs",
    "updatedAtMs",
    "lifecycle",
    "owner",
    "attempt",
    "child",
    "checksum",
  ];
  if (Object.keys(record).length !== keys.length || keys.some((key) => !(key in record))) {
    return undefined;
  }
  if (
    record.schema !== LEASE_SCHEMA ||
    record.target !== "c64" ||
    !Number.isSafeInteger(record.generation) ||
    (record.generation as number) < 1 ||
    typeof record.nonce !== "string" ||
    record.nonce.length !== 64 ||
    !HEX_BYTES.test(record.nonce) ||
    !Number.isSafeInteger(record.uid) ||
    (record.uid as number) < 0 ||
    !Number.isFinite(record.acquiredAtMs) ||
    (record.acquiredAtMs as number) < 0 ||
    !Number.isFinite(record.updatedAtMs) ||
    (record.updatedAtMs as number) < (record.acquiredAtMs as number) ||
    (record.lifecycle !== "acquired" &&
      record.lifecycle !== "attempt-recorded" &&
      record.lifecycle !== "child-recorded") ||
    (record.owner !== null && !isProcessRecord(record.owner)) ||
    (record.attempt !== null && !isAttemptRecord(record.attempt)) ||
    (record.child !== null && !isProcessRecord(record.child)) ||
    typeof record.checksum !== "string" ||
    !HEX_64.test(record.checksum)
  ) {
    return undefined;
  }
  const payload: ViceLeaseRecordPayloadV1 = {
    schema: LEASE_SCHEMA,
    target: "c64",
    generation: record.generation as number,
    nonce: record.nonce,
    uid: record.uid as number,
    acquiredAtMs: record.acquiredAtMs as number,
    updatedAtMs: record.updatedAtMs as number,
    lifecycle: record.lifecycle,
    owner: record.owner,
    attempt: record.attempt,
    child: record.child,
  };
  const expected = createHash("sha256").update(payloadBytes(payload)).digest("hex");
  if (expected !== record.checksum) return undefined;
  return Object.freeze({ ...payload, checksum: expected });
}

/** Computes the exact digest retained in a raw lease reference. */
export function digestViceLeaseBytesV1(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Tests a present snapshot's raw bytes and identity against its retained reference. */
export function snapshotMatchesReferenceV1(
  snapshot: Extract<ViceLeaseSnapshotV1, { readonly kind: "present" }>,
): boolean {
  const sameDirectory = (
    left: ViceLeaseReferenceV1["file"],
    right: ViceLeaseReferenceV1["file"],
  ): boolean =>
    left.device === right.device &&
    left.inode === right.inode &&
    left.uid === right.uid &&
    left.mode === right.mode;
  const sameFile = (
    left: ViceLeaseReferenceV1["file"],
    right: ViceLeaseReferenceV1["file"],
  ): boolean => sameDirectory(left, right) && left.links === right.links;
  return (
    sameDirectory(snapshot.directory, snapshot.reference.directory) &&
    sameFile(snapshot.file, snapshot.reference.file) &&
    digestViceLeaseBytesV1(snapshot.bytes) === snapshot.reference.bytesDigest
  );
}
