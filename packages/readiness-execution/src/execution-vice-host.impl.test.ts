import { chmod, readFile, unlink, writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  encodeViceLeaseRecordV1,
  MAX_VICE_LEASE_BYTES_V1,
  parseViceLeaseRecordV1,
  processFactToRecordV1,
} from "./execution-vice-record.js";
import { defaultViceExecutionHostV1 } from "./execution-vice-host.js";
import {
  createViceLaunchArtifactV1,
  readViceLaunchArtifactV1,
  recordViceLauncherIdentityV1,
  viceLaunchTokenPathV1,
} from "./execution-vice-launch-artifact.js";
import { initialRecord, withAttempt } from "./execution-vice-policy.js";
import type {
  ViceLeaseNodeIdentityV1,
  ViceLeaseReferenceV1,
  ViceProcessIdentityFactV1,
  ViceRecordedAttemptV1,
  ViceTerminationRequestV1,
} from "./execution-vice-types.js";

const liveSignal = (): AbortSignal => new AbortController().signal;
const DIRECTORY_FOR_FAILURE: ViceLeaseNodeIdentityV1 = {
  device: 1n,
  inode: 1n,
  uid: 0,
  mode: 0o700,
  links: 1,
};
const REFERENCE_FOR_FAILURE: ViceLeaseReferenceV1 = {
  directory: DIRECTORY_FOR_FAILURE,
  file: { ...DIRECTORY_FOR_FAILURE, mode: 0o600 },
  bytesDigest: "0".repeat(64),
};
const PROCESS_FOR_FAILURE: ViceProcessIdentityFactV1 = {
  bootId: "boot",
  pid: 1,
  startTicks: 1n,
  processGroupId: 1,
  launchToken: null,
};
const TERMINATION_FOR_FAILURE: ViceTerminationRequestV1 = {
  target: "c64",
  lease: REFERENCE_FOR_FAILURE,
  process: PROCESS_FOR_FAILURE,
  generation: 1,
  nonce: "0".repeat(64),
  phase: "graceful",
};
const ATTEMPT_FOR_FAILURE: ViceRecordedAttemptV1 = {
  target: "c64",
  claim: REFERENCE_FOR_FAILURE,
  generation: 1,
  nonce: "0".repeat(64),
  launchToken: new Uint8Array(32),
  launchTokenPath: `/run/user/0/blend65/vice/c64/launch-${"0".repeat(64)}.json`,
  endpoints: { binaryPort: 20_000, textPort: 20_001 },
  executable: "x64sc",
  argv: [],
  cwd: process.cwd(),
};

function changedReference(reference: ViceLeaseReferenceV1): ViceLeaseReferenceV1 {
  return {
    ...reference,
    file: { ...reference.file, inode: reference.file.inode + 1n },
  };
}

describe.skipIf(process.platform !== "linux")("production VICE execution host", () => {
  it("exposes bounded passive identity, time, randomness and loopback capabilities", async () => {
    const host = defaultViceExecutionHostV1;
    expect(await host.platform(liveSignal())).toEqual({ ok: true, value: "linux" });
    expect(await host.effectiveUid(liveSignal())).toMatchObject({ ok: true });
    expect(host.nowMonotonicMilliseconds()).toBeGreaterThanOrEqual(0);
    expect(host.randomBytes(32)).toHaveLength(32);
    expect(await host.delay(0, liveSignal())).toBe("elapsed");

    const aborted = new AbortController();
    aborted.abort();
    expect(await host.delay(1, aborted.signal)).toBe("aborted");
    expect(await host.observeLease("c64", aborted.signal)).toMatchObject({ ok: false });
    expect(await host.allocateLoopbackEndpoints(aborted.signal)).toMatchObject({ ok: false });

    const waiting = new AbortController();
    const delayed = host.delay(60_000, waiting.signal);
    waiting.abort();
    expect(await delayed).toBe("aborted");

    const endpoints = await host.allocateLoopbackEndpoints(liveSignal());
    expect(endpoints).toMatchObject({ ok: true });
    if (endpoints.ok) expect(endpoints.value.binaryPort).not.toBe(endpoints.value.textPort);
  });

  it("observes only positive process identities and rejects cancelled control creation", async () => {
    const host = defaultViceExecutionHostV1;
    expect(await host.observeProcess(0, liveSignal())).toMatchObject({ ok: false });
    expect(await host.observeProcess(Number.MAX_SAFE_INTEGER, liveSignal())).toEqual({
      ok: true,
      value: null,
    });
    expect(await host.observeProcess(process.pid, liveSignal())).toMatchObject({
      ok: true,
      value: { pid: process.pid },
    });
    expect(
      await host.observeProcess(process.pid, liveSignal(), "/tmp/not-a-launch-token.json"),
    ).toMatchObject({ ok: false });

    const observed = await host.observeLease("c64", liveSignal());
    expect(observed).toMatchObject({ ok: true });
    if (!observed.ok) return;
    const attempt: ViceRecordedAttemptV1 = {
      target: "c64",
      claim:
        observed.value.kind === "present"
          ? observed.value.reference
          : {
              directory: observed.value.directory,
              file: observed.value.directory,
              bytesDigest: "0".repeat(64),
            },
      generation: 1,
      nonce: "a".repeat(64),
      launchToken: new Uint8Array(32),
      launchTokenPath: `/run/user/${process.geteuid?.() ?? 0}/blend65/vice/c64/launch-${"0".repeat(64)}.json`,
      endpoints: { binaryPort: 20_000, textPort: 20_001 },
      executable: "x64sc",
      argv: [],
      cwd: process.cwd(),
    };
    const aborted = new AbortController();
    aborted.abort();
    expect(await host.observeProcess(process.pid, aborted.signal)).toMatchObject({ ok: false });
    expect(await host.createControlAttempt(attempt, aborted.signal)).toMatchObject({ ok: false });
  });

  it("fails closed when Linux user or same-PID exec authority is unavailable", async () => {
    const host = defaultViceExecutionHostV1;
    const uidDescriptor = Object.getOwnPropertyDescriptor(process, "geteuid");
    expect(uidDescriptor).toBeDefined();
    if (uidDescriptor === undefined) return;
    try {
      Object.defineProperty(process, "geteuid", { ...uidDescriptor, value: undefined });
      expect(await host.effectiveUid(liveSignal())).toMatchObject({ ok: false });
      expect(await host.observeLease("c64", liveSignal())).toMatchObject({ ok: false });
      expect(
        await host.tryCreateLease("c64", DIRECTORY_FOR_FAILURE, Uint8Array.of(1), liveSignal()),
      ).toMatchObject({ ok: false });
      expect(
        await host.compareReplaceLease(
          "c64",
          REFERENCE_FOR_FAILURE,
          Uint8Array.of(1),
          liveSignal(),
        ),
      ).toMatchObject({ ok: false });
      expect(
        await host.compareRemoveLease("c64", REFERENCE_FOR_FAILURE, liveSignal()),
      ).toMatchObject({ ok: false });
      expect(
        await host.compareRemoveLaunchArtifact?.(
          "c64",
          REFERENCE_FOR_FAILURE,
          ATTEMPT_FOR_FAILURE.launchTokenPath,
          null,
          liveSignal(),
        ),
      ).toMatchObject({ ok: false });
      expect(
        await host.revalidateAndTerminateVice(TERMINATION_FOR_FAILURE, liveSignal()),
      ).toMatchObject({ ok: false });
    } finally {
      Object.defineProperty(process, "geteuid", uidDescriptor);
    }

    const execveDescriptor = Object.getOwnPropertyDescriptor(process, "execve");
    if (execveDescriptor === undefined) return;
    try {
      Object.defineProperty(process, "execve", { ...execveDescriptor, value: undefined });
      expect(await host.createControlAttempt(ATTEMPT_FOR_FAILURE, liveSignal())).toMatchObject({
        ok: false,
      });
    } finally {
      Object.defineProperty(process, "execve", execveDescriptor);
    }
  });

  it("enforces exact lease compare-and-swap references across all mutations", async () => {
    const host = defaultViceExecutionHostV1;
    const initial = await host.observeLease("c64", liveSignal());
    expect(initial).toMatchObject({ ok: true, value: { kind: "absent" } });
    if (!initial.ok || initial.value.kind !== "absent") return;
    let retained: ViceLeaseReferenceV1 | undefined;
    try {
      const wrongDirectory: ViceLeaseNodeIdentityV1 = {
        ...initial.value.directory,
        inode: initial.value.directory.inode + 1n,
      };
      expect(
        await host.tryCreateLease("c64", wrongDirectory, Uint8Array.of(1), liveSignal()),
      ).toEqual({ ok: true, value: { kind: "changed" } });
      expect(
        await host.tryCreateLease(
          "c64",
          initial.value.directory,
          new Uint8Array(MAX_VICE_LEASE_BYTES_V1 + 1),
          liveSignal(),
        ),
      ).toEqual({ ok: true, value: { kind: "changed" } });

      const aborted = new AbortController();
      aborted.abort();
      expect(
        await host.tryCreateLease("c64", initial.value.directory, Uint8Array.of(1), aborted.signal),
      ).toMatchObject({ ok: false });

      const created = await host.tryCreateLease(
        "c64",
        initial.value.directory,
        Uint8Array.of(1),
        liveSignal(),
      );
      expect(created).toMatchObject({ ok: true, value: { kind: "created" } });
      if (
        !created.ok ||
        created.value.kind !== "created" ||
        created.value.snapshot.kind !== "present"
      )
        return;
      retained = created.value.snapshot.reference;

      const raced = await Promise.all([
        host.compareReplaceLease("c64", retained, Uint8Array.of(2), liveSignal()),
        host.compareReplaceLease("c64", retained, Uint8Array.of(3), liveSignal()),
      ]);
      const winners = raced.filter((result) => result.ok && result.value.kind === "replaced");
      expect(winners).toHaveLength(1);
      expect(raced.filter((result) => result.ok && result.value.kind === "changed")).toHaveLength(
        1,
      );
      const winner = winners[0];
      if (
        !winner?.ok ||
        winner.value.kind !== "replaced" ||
        winner.value.snapshot.kind !== "present"
      ) {
        return;
      }
      retained = winner.value.snapshot.reference;

      const unrecordedProcess: ViceProcessIdentityFactV1 = {
        bootId: "boot",
        pid: process.pid,
        startTicks: 1n,
        processGroupId: process.pid,
        launchToken: null,
      };
      expect(
        await host.revalidateAndTerminateVice(
          {
            target: "c64",
            lease: retained,
            process: unrecordedProcess,
            generation: 1,
            nonce: "a".repeat(64),
            phase: "graceful",
          },
          liveSignal(),
        ),
      ).toEqual({ ok: true, value: "lease-changed" });

      expect(
        await host.tryCreateLease("c64", initial.value.directory, Uint8Array.of(2), liveSignal()),
      ).toEqual({ ok: true, value: { kind: "occupied" } });
      expect(
        await host.compareReplaceLease(
          "c64",
          changedReference(retained),
          Uint8Array.of(2),
          liveSignal(),
        ),
      ).toEqual({ ok: true, value: { kind: "changed" } });
      expect(
        await host.compareRemoveLease("c64", changedReference(retained), liveSignal()),
      ).toEqual({ ok: true, value: { kind: "changed" } });

      expect(
        await host.compareReplaceLease(
          "c64",
          retained,
          new Uint8Array(MAX_VICE_LEASE_BYTES_V1 + 1),
          liveSignal(),
        ),
      ).toMatchObject({ ok: false });
      const cancelled = new AbortController();
      cancelled.abort();
      expect(
        await host.compareReplaceLease("c64", retained, Uint8Array.of(2), cancelled.signal),
      ).toMatchObject({ ok: false });
      expect(await host.compareRemoveLease("c64", retained, cancelled.signal)).toMatchObject({
        ok: false,
      });

      const replaced = await host.compareReplaceLease(
        "c64",
        retained,
        Uint8Array.of(2),
        liveSignal(),
      );
      expect(replaced).toMatchObject({ ok: true, value: { kind: "replaced" } });
      if (
        !replaced.ok ||
        replaced.value.kind !== "replaced" ||
        replaced.value.snapshot.kind !== "present"
      )
        return;
      retained = replaced.value.snapshot.reference;
      expect(await host.compareRemoveLease("c64", retained, liveSignal())).toEqual({
        ok: true,
        value: { kind: "removed" },
      });
      retained = undefined;

      expect(
        await host.compareReplaceLease(
          "c64",
          created.value.snapshot.reference,
          Uint8Array.of(3),
          liveSignal(),
        ),
      ).toEqual({ ok: true, value: { kind: "missing" } });
      expect(
        await host.compareRemoveLease("c64", created.value.snapshot.reference, liveSignal()),
      ).toEqual({ ok: true, value: { kind: "missing" } });
    } finally {
      if (retained !== undefined) await host.compareRemoveLease("c64", retained, liveSignal());
    }
  });

  it("serializes mutations behind durable live, malformed and stale lock owners", async () => {
    const uid = process.geteuid?.();
    if (uid === undefined) return;
    const host = defaultViceExecutionHostV1;
    const initial = await host.observeLease("c64", liveSignal());
    expect(initial).toMatchObject({ ok: true, value: { kind: "absent" } });
    if (!initial.ok || initial.value.kind !== "absent") return;
    const directory = `/run/user/${uid}/blend65/vice/c64`;
    const lockPath = `${directory}/.mutation-lock-v1.json`;
    const reclaimToken = "d".repeat(64);
    const reclaimPath = `${directory}/.mutation-reclaim-${reclaimToken}`;
    let retained: ViceLeaseReferenceV1 | undefined;
    try {
      await writeFile(reclaimPath, "", { flag: "wx", mode: 0o600 });
      expect(
        await host.tryCreateLease("c64", initial.value.directory, Uint8Array.of(1), liveSignal()),
      ).toEqual({ ok: true, value: { kind: "changed" } });
      await unlink(reclaimPath);

      await writeFile(lockPath, "{", { flag: "wx", mode: 0o600 });
      expect(
        await host.tryCreateLease("c64", initial.value.directory, Uint8Array.of(1), liveSignal()),
      ).toEqual({ ok: true, value: { kind: "changed" } });
      await unlink(lockPath);

      const stat = await readFile(`/proc/${process.pid}/stat`, "utf8");
      const commandEnd = stat.lastIndexOf(")");
      const fields = stat
        .slice(commandEnd + 2)
        .trim()
        .split(/\s+/);
      const liveOwner = {
        bootId: (await readFile("/proc/sys/kernel/random/boot_id", "utf8")).trim(),
        pid: process.pid,
        startTicks: fields[19],
        token: "c".repeat(64),
      };
      await writeFile(lockPath, JSON.stringify(liveOwner), { flag: "wx", mode: 0o600 });
      expect(
        await host.tryCreateLease("c64", initial.value.directory, Uint8Array.of(1), liveSignal()),
      ).toEqual({ ok: true, value: { kind: "changed" } });
      await unlink(lockPath);

      const staleOwner = { ...liveOwner, bootId: "different-boot", token: "b".repeat(64) };
      await writeFile(lockPath, JSON.stringify(staleOwner), { flag: "wx", mode: 0o600 });
      const recovered = await host.tryCreateLease(
        "c64",
        initial.value.directory,
        Uint8Array.of(1),
        liveSignal(),
      );
      expect(recovered).toMatchObject({ ok: true, value: { kind: "created" } });
      if (
        recovered.ok &&
        recovered.value.kind === "created" &&
        recovered.value.snapshot.kind === "present"
      ) {
        retained = recovered.value.snapshot.reference;
      }
    } finally {
      await unlink(reclaimPath).catch(() => undefined);
      await unlink(lockPath).catch(() => undefined);
      if (retained !== undefined) {
        await host.compareRemoveLease("c64", retained, liveSignal());
      }
    }
  });

  it("retires only an exact pinned attempt artifact and reports an already-missing artifact", async () => {
    const uid = process.geteuid?.();
    if (uid === undefined) return;
    const host = defaultViceExecutionHostV1;
    const removeArtifact = host.compareRemoveLaunchArtifact;
    expect(removeArtifact).toBeTypeOf("function");
    if (removeArtifact === undefined) return;
    const observed = await host.observeLease("c64", liveSignal());
    expect(observed).toMatchObject({ ok: true, value: { kind: "absent" } });
    if (!observed.ok || observed.value.kind !== "absent") return;
    const token = new Uint8Array(32).fill(7);
    const tokenPath = viceLaunchTokenPathV1(uid, token);
    const absentReference: ViceLeaseReferenceV1 = {
      directory: observed.value.directory,
      file: { ...observed.value.directory, mode: 0o600 },
      bytesDigest: "0".repeat(64),
    };
    const aborted = new AbortController();
    aborted.abort();
    expect(
      await removeArtifact.call(host, "c64", absentReference, tokenPath, null, aborted.signal),
    ).toMatchObject({ ok: false });
    expect(
      await removeArtifact.call(host, "c64", absentReference, "/tmp/foreign", null, liveSignal()),
    ).toMatchObject({ ok: false });
    expect(
      await removeArtifact.call(host, "c64", absentReference, tokenPath, null, liveSignal()),
    ).toEqual({ ok: true, value: "changed" });

    const initialBytes = encodeViceLeaseRecordV1(initialRecord(uid, "a".repeat(64), 1, null));
    const initialParsed = parseViceLeaseRecordV1(initialBytes);
    expect(initialParsed).toBeDefined();
    if (initialParsed === undefined) return;
    const attemptBytes = encodeViceLeaseRecordV1(
      withAttempt(initialParsed, token, 20_000, 20_001, tokenPath, 2),
    );
    const created = await host.tryCreateLease(
      "c64",
      observed.value.directory,
      attemptBytes,
      liveSignal(),
    );
    expect(created).toMatchObject({ ok: true, value: { kind: "created" } });
    if (
      !created.ok ||
      created.value.kind !== "created" ||
      created.value.snapshot.kind !== "present"
    ) {
      return;
    }
    const retained = created.value.snapshot.reference;
    try {
      expect(
        await removeArtifact.call(
          host,
          "c64",
          changedReference(retained),
          tokenPath,
          null,
          liveSignal(),
        ),
      ).toEqual({ ok: true, value: "changed" });
      expect(
        await removeArtifact.call(host, "c64", retained, tokenPath, null, liveSignal()),
      ).toEqual({ ok: true, value: "missing" });
      await createViceLaunchArtifactV1(
        {
          target: "c64",
          claim: retained,
          generation: 1,
          nonce: "a".repeat(64),
          launchToken: token,
          launchTokenPath: tokenPath,
          endpoints: { binaryPort: 20_000, textPort: 20_001 },
          executable: "x64sc",
          argv: [],
          cwd: process.cwd(),
        },
        uid,
        process.execPath,
      );
      await chmod(tokenPath, 0o644);
      expect(
        await removeArtifact.call(host, "c64", retained, tokenPath, null, liveSignal()),
      ).toEqual({ ok: true, value: "changed" });
      await chmod(tokenPath, 0o600);
      expect(
        await removeArtifact.call(host, "c64", retained, tokenPath, null, liveSignal()),
      ).toEqual({ ok: true, value: "removed" });
    } finally {
      await host.compareRemoveLease("c64", retained, liveSignal());
    }
  });

  it("rejects mismatched prepared, recorded and observed artifact process identities", async () => {
    const uid = process.geteuid?.();
    if (uid === undefined) return;
    const host = defaultViceExecutionHostV1;
    const removeArtifact = host.compareRemoveLaunchArtifact;
    if (removeArtifact === undefined) return;
    const observed = await host.observeLease("c64", liveSignal());
    expect(observed).toMatchObject({ ok: true, value: { kind: "absent" } });
    if (!observed.ok || observed.value.kind !== "absent") return;
    const self = await host.observeProcess(process.pid, liveSignal());
    expect(self).toMatchObject({ ok: true, value: { pid: process.pid } });
    if (!self.ok || self.value === null) return;
    const token = new Uint8Array(32).fill(8);
    const tokenPath = viceLaunchTokenPathV1(uid, token);
    const initialParsed = parseViceLeaseRecordV1(
      encodeViceLeaseRecordV1(initialRecord(uid, "b".repeat(64), 1, null)),
    );
    if (initialParsed === undefined) return;
    const attemptBytes = encodeViceLeaseRecordV1(
      withAttempt(initialParsed, token, 20_002, 20_003, tokenPath, 2),
    );
    const created = await host.tryCreateLease(
      "c64",
      observed.value.directory,
      attemptBytes,
      liveSignal(),
    );
    expect(created).toMatchObject({ ok: true, value: { kind: "created" } });
    if (
      !created.ok ||
      created.value.kind !== "created" ||
      created.value.snapshot.kind !== "present"
    ) {
      return;
    }
    let retained = created.value.snapshot.reference;
    try {
      await createViceLaunchArtifactV1(
        {
          target: "c64",
          claim: retained,
          generation: 1,
          nonce: "b".repeat(64),
          launchToken: token,
          launchTokenPath: tokenPath,
          endpoints: { binaryPort: 20_002, textPort: 20_003 },
          executable: "x64sc",
          argv: [],
          cwd: process.cwd(),
        },
        uid,
        process.execPath,
      );
      const childFact: ViceProcessIdentityFactV1 = {
        ...self.value,
        launchToken: token,
        launchTokenPath: tokenPath,
      };
      expect(
        await removeArtifact.call(host, "c64", retained, tokenPath, childFact, liveSignal()),
      ).toEqual({ ok: true, value: "changed" });

      const attemptRecord = parseViceLeaseRecordV1(attemptBytes);
      if (attemptRecord === undefined) return;
      const childBytes = encodeViceLeaseRecordV1({
        schema: attemptRecord.schema,
        target: attemptRecord.target,
        generation: attemptRecord.generation,
        nonce: attemptRecord.nonce,
        uid: attemptRecord.uid,
        acquiredAtMs: attemptRecord.acquiredAtMs,
        updatedAtMs: attemptRecord.updatedAtMs,
        lifecycle: "child-recorded",
        owner: attemptRecord.owner,
        attempt: attemptRecord.attempt,
        child: processFactToRecordV1(childFact),
      });
      const replaced = await host.compareReplaceLease("c64", retained, childBytes, liveSignal());
      expect(replaced).toMatchObject({ ok: true, value: { kind: "replaced" } });
      if (
        !replaced.ok ||
        replaced.value.kind !== "replaced" ||
        replaced.value.snapshot.kind !== "present"
      ) {
        return;
      }
      retained = replaced.value.snapshot.reference;
      expect(
        await removeArtifact.call(host, "c64", retained, tokenPath, null, liveSignal()),
      ).toEqual({ ok: true, value: "changed" });
      expect(
        await removeArtifact.call(host, "c64", retained, tokenPath, childFact, liveSignal()),
      ).toEqual({ ok: true, value: "changed" });

      const artifactFact = { ...childFact, startTicks: childFact.startTicks + 1n };
      await recordViceLauncherIdentityV1(tokenPath, uid, artifactFact);
      expect(
        await removeArtifact.call(host, "c64", retained, tokenPath, artifactFact, liveSignal()),
      ).toEqual({ ok: true, value: "changed" });
      expect(
        await removeArtifact.call(host, "c64", retained, tokenPath, childFact, liveSignal()),
      ).toEqual({ ok: true, value: "changed" });

      const mismatchedArtifact = await readViceLaunchArtifactV1(tokenPath, uid);
      expect(mismatchedArtifact.identity).not.toBeNull();
      if (mismatchedArtifact.identity === null) return;
      await writeFile(
        tokenPath,
        JSON.stringify({
          ...mismatchedArtifact,
          identity: {
            ...mismatchedArtifact.identity,
            startTicks: childFact.startTicks.toString(),
          },
        }),
      );
      expect(
        await removeArtifact.call(host, "c64", retained, tokenPath, childFact, liveSignal()),
      ).toEqual({ ok: true, value: "process-present" });
    } finally {
      await host.compareRemoveLease("c64", retained, liveSignal());
      await unlink(tokenPath).catch(() => undefined);
    }
  });

  it("refuses termination when the durable lease authority is absent", async () => {
    const host = defaultViceExecutionHostV1;
    const observed = await host.observeLease("c64", liveSignal());
    expect(observed).toMatchObject({ ok: true, value: { kind: "absent" } });
    if (!observed.ok || observed.value.kind !== "absent") return;
    const processFact: ViceProcessIdentityFactV1 = {
      bootId: "boot",
      pid: process.pid,
      startTicks: 1n,
      processGroupId: process.pid,
      launchToken: null,
    };
    const request: ViceTerminationRequestV1 = {
      target: "c64",
      lease: {
        directory: observed.value.directory,
        file: observed.value.directory,
        bytesDigest: "0".repeat(64),
      },
      process: processFact,
      generation: 1,
      nonce: "a".repeat(64),
      phase: "graceful",
    };
    expect(await host.revalidateAndTerminateVice(request, liveSignal())).toEqual({
      ok: true,
      value: "lease-changed",
    });
  });
});
