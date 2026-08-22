import { describe, expect, it } from "vitest";

import {
  digestViceLeaseBytesV1,
  encodeViceLeaseRecordV1,
  parseViceLeaseRecordV1,
  processFactMatchesRecordV1,
  processFactToRecordV1,
  snapshotMatchesReferenceV1,
} from "./execution-vice-record.js";
import {
  areFreshEndpoints,
  initialRecord,
  isTrustedDirectory,
  isTrustedPresentLease,
  mapControlIssue,
} from "./execution-vice-policy.js";
import type {
  ViceLeaseNodeIdentityV1,
  ViceLeaseSnapshotV1,
  ViceProcessIdentityFactV1,
} from "./execution-vice-types.js";

const DIRECTORY: ViceLeaseNodeIdentityV1 = {
  device: 7n,
  inode: 11n,
  uid: 1000,
  mode: 0o700,
  links: 1,
};
const FILE: ViceLeaseNodeIdentityV1 = {
  device: 7n,
  inode: 12n,
  uid: 1000,
  mode: 0o600,
  links: 1,
};

function processFact(
  token: Uint8Array | null = Uint8Array.from({ length: 32 }, (_, index) => index + 1),
): ViceProcessIdentityFactV1 {
  return {
    bootId: "boot-1",
    pid: 123,
    startTicks: 456n,
    processGroupId: 123,
    launchToken: token,
  };
}

describe("VICE lease record implementation", () => {
  it("round-trips a checksummed owner identity without sharing token bytes", () => {
    const token = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
    const fact = processFact(token);
    const encoded = encodeViceLeaseRecordV1(initialRecord(1000, "ab".repeat(32), 10, fact));
    token.fill(0xff);
    const parsed = parseViceLeaseRecordV1(encoded);
    expect(parsed).toMatchObject({ generation: 1, lifecycle: "acquired" });
    expect(parsed?.owner?.launchToken).toBe(
      "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20",
    );
  });

  it("rejects checksum and schema mutations", () => {
    const encoded = encodeViceLeaseRecordV1(initialRecord(1000, "ab".repeat(32), 10, null));
    const text = new TextDecoder().decode(encoded);
    expect(
      parseViceLeaseRecordV1(new TextEncoder().encode(text.replace('"uid":1000', '"uid":1001'))),
    ).toBeUndefined();
    expect(
      parseViceLeaseRecordV1(
        new TextEncoder().encode(text.replace("blend65-vice-lease-v1", "unknown")),
      ),
    ).toBeUndefined();
  });

  it("rejects structurally malformed lease record containers", () => {
    expect(parseViceLeaseRecordV1(new Uint8Array(0))).toBeUndefined();
    expect(parseViceLeaseRecordV1(new TextEncoder().encode("[]"))).toBeUndefined();

    const encoded = encodeViceLeaseRecordV1(initialRecord(1000, "ab".repeat(32), 10, null));
    const text = new TextDecoder().decode(encoded);
    expect(
      parseViceLeaseRecordV1(new TextEncoder().encode(text.replace('"owner":null', '"owner":7'))),
    ).toBeUndefined();
    expect(
      parseViceLeaseRecordV1(
        new TextEncoder().encode(text.replace('"attempt":null', '"attempt":7')),
      ),
    ).toBeUndefined();
    expect(
      parseViceLeaseRecordV1(new TextEncoder().encode(text.replace('"child":null', '"child":7'))),
    ).toBeUndefined();
    expect(
      parseViceLeaseRecordV1(
        new TextEncoder().encode(text.replace('"lifecycle":"acquired"', '"lifecycle":"bad"')),
      ),
    ).toBeUndefined();
    expect(
      parseViceLeaseRecordV1(
        new TextEncoder().encode(text.replace('"generation":1', '"extraGeneration":1')),
      ),
    ).toBeUndefined();
  });

  it("matches boot, PID, start, group and token as one process identity", () => {
    const fact = processFact();
    const record = processFactToRecordV1(fact);
    expect(processFactMatchesRecordV1(fact, record)).toBe(true);
    expect(processFactMatchesRecordV1({ ...fact, startTicks: fact.startTicks + 1n }, record)).toBe(
      false,
    );
    expect(processFactMatchesRecordV1({ ...fact, launchToken: Uint8Array.of(9) }, record)).toBe(
      false,
    );
  });

  it("rejects a replaced observed inode against the retained reference", () => {
    const bytes = encodeViceLeaseRecordV1(initialRecord(1000, "ab".repeat(32), 10, null));
    const snapshot: Extract<ViceLeaseSnapshotV1, { readonly kind: "present" }> = {
      kind: "present",
      directory: DIRECTORY,
      file: { ...FILE, inode: FILE.inode + 1n },
      bytes,
      reference: {
        directory: DIRECTORY,
        file: FILE,
        bytesDigest: "0".repeat(64),
      },
    };
    expect(snapshotMatchesReferenceV1(snapshot)).toBe(false);
    expect(isTrustedPresentLease(snapshot, 1000)).toBe(false);
  });

  it("retains directory authority across raw link-count topology churn", () => {
    const bytes = encodeViceLeaseRecordV1(initialRecord(1000, "ab".repeat(32), 10, null));
    const snapshot: Extract<ViceLeaseSnapshotV1, { readonly kind: "present" }> = {
      kind: "present",
      directory: { ...DIRECTORY, links: 276 },
      file: FILE,
      bytes,
      reference: {
        directory: { ...DIRECTORY, links: 2 },
        file: FILE,
        bytesDigest: digestViceLeaseBytesV1(bytes),
      },
    };
    expect(snapshotMatchesReferenceV1(snapshot)).toBe(true);
    expect(isTrustedPresentLease(snapshot, 1000)).toBe(true);
  });

  it("requires exact directory authority and fresh distinct endpoints", () => {
    expect(isTrustedDirectory(DIRECTORY, 1000)).toBe(true);
    expect(isTrustedDirectory({ ...DIRECTORY, mode: 0o755 }, 1000)).toBe(false);
    expect(areFreshEndpoints({ binaryPort: 20_000, textPort: 20_001 }, new Set())).toBe(true);
    expect(areFreshEndpoints({ binaryPort: 20_000, textPort: 20_001 }, new Set([20_001]))).toBe(
      false,
    );
  });

  it("rejects absent snapshots and classifies cancellation and handshake failures", () => {
    const absent: ViceLeaseSnapshotV1 = { kind: "absent", directory: DIRECTORY };
    expect(isTrustedPresentLease(absent, 1000)).toBe(false);
    expect(
      mapControlIssue({ code: "vice.io", reason: "vice.cancelled", message: "cancelled" }),
    ).toEqual({ code: "wall-time-exhaustion", stage: "vice-launch" });
    expect(
      mapControlIssue({ code: "vice.io", reason: "vice.frame", message: "invalid frame" }),
    ).toEqual({ code: "emulator-handshake-failure", stage: "vice-handshake" });
  });
});
