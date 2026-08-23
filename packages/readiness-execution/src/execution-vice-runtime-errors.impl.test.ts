import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type {
  ExecutionOperationResultV1,
  ExecutionResultV1,
  ExecutionTerminalCandidateV1,
  PublishedRuntimeEvaluationAuthorityV1,
} from "@blend65/readiness";
import type { ViceControlHostV1, ViceControlResultV1 } from "@blend65/test-harness/vice-control";

import {
  encodeViceLeaseRecordV1,
  parseViceLeaseRecordV1,
  processFactToRecordV1,
} from "./execution-vice-record.js";
import { createViceExecutionRuntimeV1 } from "./execution-vice.js";
import {
  attachViceEvaluationEvidenceV1,
  claimUnboundViceEvaluationV1,
  deriveActualObservationDigestV1,
  finalizeViceEvaluationEvidenceV1,
} from "./execution-vice-evaluation.js";
import { mergeViceCleanupCandidateV1 } from "./execution-vice-runtime.js";
import type {
  ViceExecutionHostV1,
  ViceLeaseMutationV1,
  ViceLeaseNodeIdentityV1,
  ViceLeaseReferenceV1,
  ViceLeaseSnapshotV1,
  ViceProcessIdentityFactV1,
  ViceRecordedAttemptV1,
  ViceRouteRequestV1,
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
const liveSignal = (): AbortSignal => new AbortController().signal;
const ok = <T>(value: T): ExecutionOperationResultV1<T> => ({ ok: true, value });
const failed = <T>(code: "execution.io" | "execution.identity"): ExecutionOperationResultV1<T> => ({
  ok: false,
  issues: [{ code, path: "/test", message: code }],
});

function present(
  bytes: Uint8Array,
  file = FILE,
): Extract<ViceLeaseSnapshotV1, { kind: "present" }> {
  const owned = bytes.slice();
  const reference: ViceLeaseReferenceV1 = {
    directory: DIRECTORY,
    file,
    bytesDigest: createHash("sha256").update(owned).digest("hex"),
  };
  return { kind: "present", directory: DIRECTORY, file, bytes: owned, reference };
}

interface HostFixture {
  host: ViceExecutionHostV1;
  readonly calls: string[];
  snapshot: ViceLeaseSnapshotV1;
}

function hostFixture(overrides: Partial<ViceExecutionHostV1> = {}): HostFixture {
  const fixture: HostFixture = {
    calls: [],
    snapshot: { kind: "absent", directory: DIRECTORY },
    host: undefined as never,
  };
  const base: ViceExecutionHostV1 = {
    platform: async () => {
      fixture.calls.push("platform");
      return ok("linux");
    },
    effectiveUid: async () => ok(1000),
    nowMonotonicMilliseconds: () => 0,
    delay: async () => "elapsed",
    randomBytes: () => new Uint8Array(32).fill(1),
    observeLease: async () => {
      fixture.calls.push("observe");
      return ok(fixture.snapshot);
    },
    tryCreateLease: async (_target, _directory, bytes) => {
      fixture.snapshot = present(bytes);
      return ok({ kind: "created", snapshot: fixture.snapshot });
    },
    compareReplaceLease: async () => ok({ kind: "changed" }),
    compareRemoveLease: async () => {
      fixture.snapshot = { kind: "absent", directory: DIRECTORY };
      return ok({ kind: "removed" });
    },
    compareRemoveLaunchArtifact: async () => ok("removed"),
    observeProcess: async () => ok(null),
    allocateLoopbackEndpoints: async () => {
      fixture.calls.push("endpoints");
      return ok({ binaryPort: 20_000, textPort: 20_001 });
    },
    createControlAttempt: async () => failed("execution.io"),
    revalidateAndTerminateVice: async () => ok("already-exited"),
  };
  fixture.host = { ...base, ...overrides };
  return fixture;
}

function routeRequest(): ViceRouteRequestV1 {
  return {
    binary: Uint8Array.of(0x60),
    loadAddress: 0x0801,
    entryAddress: 0x0810,
    fixture: { revision: "c64-vic-color-readback-v1", cells: [] },
    layout: {
      revision: "execution-observation-layout-v1",
      resultSymbols: ["result"],
      resultAddresses: [0x0200],
      completionSymbol: "complete",
      completionAddress: 0x0201,
      postEntryStores: [
        {
          instructionAddress: 0x0812,
          targetAddress: 0x0200,
          kind: "observation-byte",
          byteIndex: 0,
        },
        {
          instructionAddress: 0x0815,
          targetAddress: 0x0201,
          kind: "completion",
          value: 165,
        },
      ],
      proofDigest: "a".repeat(64),
    },
    observation: { kind: "scalar-bytes", byteLength: 1 },
    policy: {
      revision: "execution-policy-v1",
      budget: {
        operationMs: 60_000,
        launchAttemptMs: 15_000,
        routeMs: 120_000,
        cleanupGraceMs: 3_000,
        outputBytes: 1_048_576,
        evidenceBytes: 16_777_216,
        instructions: 1,
        cycles: 100,
        launchAttempts: 2,
      },
    },
  };
}

function failedControlHost(
  onSpawn: () => void,
  reason: "vice.spawn" | "vice.closed" = "vice.spawn",
): ViceControlHostV1 {
  const unavailable = <T>(): ViceControlResultV1<T> => ({
    ok: false,
    issue: {
      code: reason === "vice.closed" ? "vice.closed" : "vice.io",
      reason,
      message: "launch failed",
    },
  });
  return {
    nowMilliseconds: () => 0,
    delay: async () => "elapsed",
    spawn: async () => {
      onSpawn();
      return unavailable();
    },
    connectLoopback: async () => unavailable(),
    endpointBelongsToChild: async () => unavailable(),
    closeOwnedChild: async () => unavailable(),
  };
}

function childRecordedSnapshot(
  fixture: HostFixture,
  attempt: ViceRecordedAttemptV1,
  inode: bigint,
): ViceProcessIdentityFactV1 {
  if (fixture.snapshot.kind !== "present") throw new TypeError("Expected a present lease.");
  const record = parseViceLeaseRecordV1(fixture.snapshot.bytes);
  if (record === undefined) throw new TypeError("Expected a valid lease record.");
  const child: ViceProcessIdentityFactV1 = {
    bootId: "boot",
    pid: 789,
    startTicks: 12n,
    processGroupId: 789,
    launchToken: attempt.launchToken.slice(),
    launchTokenPath: attempt.launchTokenPath,
  };
  fixture.snapshot = present(
    encodeViceLeaseRecordV1({
      schema: record.schema,
      target: record.target,
      generation: record.generation,
      nonce: record.nonce,
      uid: record.uid,
      acquiredAtMs: record.acquiredAtMs,
      updatedAtMs: record.updatedAtMs,
      lifecycle: "child-recorded",
      owner: record.owner,
      attempt: record.attempt,
      child: processFactToRecordV1(child),
    }),
    { ...FILE, inode },
  );
  return child;
}

describe("VICE runtime fail-closed implementation branches", () => {
  it("closes injected-host evaluation claim state", () => {
    const routeFingerprint = `sha256:${"3".repeat(64)}`;
    const authority = {} as PublishedRuntimeEvaluationAuthorityV1;

    expect(claimUnboundViceEvaluationV1(authority, routeFingerprint)).toBe(routeFingerprint);
    expect(claimUnboundViceEvaluationV1(authority, routeFingerprint)).toBeUndefined();
    expect(
      Reflect.apply(claimUnboundViceEvaluationV1, undefined, [null, routeFingerprint]),
    ).toBeUndefined();
  });

  it("charges canonical evidence bound to actual, decision, route, and runtime facts", () => {
    const actual = {
      revision: "runtime-actual-observation-v1" as const,
      sourceCaseDigest: `sha256:${"1".repeat(64)}`,
      kind: "scalar-bytes" as const,
      bytes: Uint8Array.of(0xf1),
    };
    const base: ExecutionResultV1 = {
      status: "pass",
      tier: "vice",
      stage: "compare",
      code: "pass",
      usage: {
        wallMs: 10,
        outputBytes: 0,
        evidenceBytes: 0,
        instructions: 65_535,
        cycles: 60,
        launchAttempts: 1,
      },
      evidence: { digest: "0".repeat(64), retainedBytes: 0, truncated: false },
    };
    const context = {
      routeIdentity: `sha256:${"2".repeat(64)}`,
      evaluationIdentity: `sha256:${"3".repeat(64)}`,
      actualObservationDigest: deriveActualObservationDigestV1(actual),
      outcome: "match" as const,
    };
    const finalized = finalizeViceEvaluationEvidenceV1(
      attachViceEvaluationEvidenceV1(base, context),
      32,
    );
    const differentActual = finalizeViceEvaluationEvidenceV1(
      attachViceEvaluationEvidenceV1(base, {
        ...context,
        actualObservationDigest: deriveActualObservationDigestV1({
          ...actual,
          bytes: Uint8Array.of(0xf0),
        }),
      }),
      32,
    );
    const differentRuntime = finalizeViceEvaluationEvidenceV1(
      attachViceEvaluationEvidenceV1({ ...base, usage: { ...base.usage, cycles: 61 } }, context),
      32,
    );

    expect(finalized).toMatchObject({
      usage: { evidenceBytes: 32 },
      evidence: { digest: expect.stringMatching(/^[0-9a-f]{64}$/u), retainedBytes: 32 },
    });
    expect(differentActual.evidence.digest).not.toBe(finalized.evidence.digest);
    expect(differentRuntime.evidence.digest).not.toBe(finalized.evidence.digest);
    expect(finalized).not.toHaveProperty("actual");
    expect(Object.keys(finalized).sort()).toEqual([
      "code",
      "evidence",
      "stage",
      "status",
      "tier",
      "usage",
    ]);
    expect(Object.keys(finalized.evidence).sort()).toEqual([
      "digest",
      "retainedBytes",
      "truncated",
    ]);
    expect(
      finalizeViceEvaluationEvidenceV1(attachViceEvaluationEvidenceV1(base, context), 31),
    ).toMatchObject({
      status: "failure",
      stage: "compare",
      code: "evidence-exhaustion",
      usage: { evidenceBytes: 0 },
    });
  });

  it("chains sealed build evidence into cumulative evaluated evidence", () => {
    const base: ExecutionResultV1 = {
      status: "pass",
      tier: "vice",
      stage: "compare",
      code: "pass",
      usage: {
        wallMs: 23,
        outputBytes: 17,
        evidenceBytes: 10,
        instructions: 5,
        cycles: 9,
        launchAttempts: 1,
      },
      evidence: {
        digest: `sha256:${"a".repeat(64)}`,
        retainedBytes: 10,
        truncated: false,
      },
    };
    const context = {
      routeIdentity: `sha256:${"2".repeat(64)}`,
      evaluationIdentity: `sha256:${"3".repeat(64)}`,
      actualObservationDigest: `sha256:${"4".repeat(64)}`,
      outcome: "match" as const,
      buildEvidenceDigest: `sha256:${"5".repeat(64)}`,
    };
    const finalized = finalizeViceEvaluationEvidenceV1(
      attachViceEvaluationEvidenceV1(base, context),
      42,
    );
    const differentBuild = finalizeViceEvaluationEvidenceV1(
      attachViceEvaluationEvidenceV1(base, {
        ...context,
        buildEvidenceDigest: `sha256:${"6".repeat(64)}`,
      }),
      42,
    );

    expect(finalized).toMatchObject({
      status: "pass",
      usage: { outputBytes: 17, evidenceBytes: 42 },
      evidence: { retainedBytes: 42, truncated: false },
    });
    expect(differentBuild.evidence.digest).not.toBe(finalized.evidence.digest);
    expect(
      finalizeViceEvaluationEvidenceV1(attachViceEvaluationEvidenceV1(base, context), 41),
    ).toMatchObject({
      status: "failure",
      stage: "compare",
      code: "evidence-exhaustion",
      usage: { outputBytes: 17, evidenceBytes: 10 },
      evidence: { retainedBytes: 10 },
    });
  });

  it("makes cleanup primary only for a provisional pass", () => {
    const evidence = { digest: "a".repeat(64), retainedBytes: 0, truncated: false } as const;
    const usage = {
      wallMs: 1,
      outputBytes: 0,
      evidenceBytes: 0,
      instructions: 1,
      cycles: 2,
      launchAttempts: 1,
    } as const;
    const cleanup: Extract<ExecutionTerminalCandidateV1, { readonly stage: "cleanup" }> = {
      stage: "cleanup",
      code: "emulator-lease-recovery-blocked",
      usage,
      evidence,
      cleanupBlocker: {
        code: "emulator-lease-recovery-blocked",
        evidenceDigest: evidence.digest,
      },
    };
    const pass: ExecutionResultV1 = {
      status: "pass",
      tier: "vice",
      stage: "compare",
      code: "pass",
      usage,
      evidence,
    };
    const operational: ExecutionResultV1 = {
      status: "failure",
      tier: "vice",
      stage: "run",
      code: "instruction-exhaustion",
      usage,
      evidence,
    };

    expect(mergeViceCleanupCandidateV1(pass, cleanup)).toMatchObject({
      status: "failure",
      stage: "cleanup",
      code: "emulator-lease-recovery-blocked",
      cleanupBlocker: { code: "emulator-lease-recovery-blocked" },
    });
    expect(mergeViceCleanupCandidateV1(operational, cleanup)).toMatchObject({
      status: "failure",
      stage: "run",
      code: "instruction-exhaustion",
      cleanupBlocker: { code: "emulator-lease-recovery-blocked" },
    });
  });

  it("retains the exact lease when compare-remove does not report removed", async () => {
    const fixture = hostFixture({
      compareRemoveLease: async () => ok({ kind: "changed" }),
    });
    const runtime = createViceExecutionRuntimeV1(fixture.host);
    const acquired = await runtime.acquireViceLease("c64", liveSignal());
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    const cancelled = new AbortController();
    cancelled.abort();

    const result = await runtime.executeViceRoute(routeRequest(), acquired.value, cancelled.signal);

    expect(result).toMatchObject({
      status: "failure",
      stage: "vice-launch",
      code: "wall-time-exhaustion",
      cleanupBlocker: { code: "emulator-lease-recovery-blocked" },
    });
    expect(fixture.snapshot.kind).toBe("present");
  });

  it("rejects pre-aborted inspect and clear without host observation", async () => {
    const fixture = hostFixture();
    const runtime = createViceExecutionRuntimeV1(fixture.host);
    const controller = new AbortController();
    controller.abort();
    expect((await runtime.inspectViceLease("c64", controller.signal)).ok).toBe(false);
    expect(
      (await runtime.clearViceLeaseGeneration("c64", 1, "ab".repeat(32), controller.signal)).ok,
    ).toBe(false);
    expect(fixture.calls).toEqual([]);
  });

  it.each<readonly [string, Partial<ViceExecutionHostV1>]>([
    ["platform observation failure", { platform: async () => failed("execution.io") }],
    ["unsupported platform", { platform: async () => ok("unsupported") }],
    ["user observation failure", { effectiveUid: async () => failed("execution.identity") }],
    ["invalid effective user", { effectiveUid: async () => ok(-1) }],
  ])("fails closed on %s", async (_name, override) => {
    const fixture = hostFixture(override);
    expect(
      (await createViceExecutionRuntimeV1(fixture.host).acquireViceLease("c64", liveSignal())).ok,
    ).toBe(false);
  });

  it.each<readonly [string, Partial<ViceExecutionHostV1>]>([
    ["lease observation", { observeLease: async () => failed("execution.io") }],
    ["owner observation", { observeProcess: async () => failed("execution.io") }],
    ["lease creation", { tryCreateLease: async () => failed("execution.io") }],
  ])("propagates an acquisition %s failure", async (_name, override) => {
    const fixture = hostFixture(override);
    expect(
      (await createViceExecutionRuntimeV1(fixture.host).acquireViceLease("c64", liveSignal())).ok,
    ).toBe(false);
  });

  it.each([
    ["short nonce", { randomBytes: () => new Uint8Array(31) }],
    ["invalid clock", { nowMonotonicMilliseconds: () => Number.NaN }],
  ] as const)("rejects an acquisition with %s", async (_name, override) => {
    const fixture = hostFixture(override);
    expect(
      (await createViceExecutionRuntimeV1(fixture.host).acquireViceLease("c64", liveSignal())).ok,
    ).toBe(false);
  });

  it("rejects an occupied create race", async () => {
    const fixture = hostFixture({
      tryCreateLease: async (): Promise<ExecutionOperationResultV1<ViceLeaseMutationV1>> =>
        ok({ kind: "occupied" }),
    });
    expect(
      (await createViceExecutionRuntimeV1(fixture.host).acquireViceLease("c64", liveSignal())).ok,
    ).toBe(false);
  });

  it.each([
    ["untrusted created file", (bytes: Uint8Array) => present(bytes, { ...FILE, mode: 0o644 })],
    ["invalid created record", () => present(new TextEncoder().encode("invalid"))],
  ] as const)("rejects an %s", async (_name, snapshot) => {
    const fixture = hostFixture({
      tryCreateLease: async (_target, _directory, bytes) =>
        ok({ kind: "created", snapshot: snapshot(bytes) }),
    });
    expect(
      (await createViceExecutionRuntimeV1(fixture.host).acquireViceLease("c64", liveSignal())).ok,
    ).toBe(false);
  });

  it("rejects invalid clear authority before lease removal", async () => {
    const fixture = hostFixture();
    const runtime = createViceExecutionRuntimeV1(fixture.host);
    expect((await runtime.clearViceLeaseGeneration("c64", 0, "bad", liveSignal())).ok).toBe(false);
  });

  it("rejects clearing an absent generation without attempting removal", async () => {
    const fixture = hostFixture();
    const removed: string[] = [];
    fixture.host = {
      ...fixture.host,
      compareRemoveLease: async () => {
        removed.push("remove");
        return ok({ kind: "removed" });
      },
    };
    const cleared = await createViceExecutionRuntimeV1(fixture.host).clearViceLeaseGeneration(
      "c64",
      1,
      "a".repeat(64),
      liveSignal(),
    );
    expect(cleared.ok).toBe(false);
    expect(removed).toEqual([]);
  });

  it("propagates lease observation failures during clear", async () => {
    const fixture = hostFixture({ observeLease: async () => failed("execution.io") });
    const cleared = await createViceExecutionRuntimeV1(fixture.host).clearViceLeaseGeneration(
      "c64",
      1,
      "a".repeat(64),
      liveSignal(),
    );
    expect(cleared).toMatchObject({ ok: false });
  });

  it("blocks clear while the exact recorded owner remains active", async () => {
    const fact: ViceProcessIdentityFactV1 = {
      bootId: "boot",
      pid: process.pid,
      startTicks: 10n,
      processGroupId: process.pid,
      launchToken: null,
    };
    const fixture = hostFixture({ observeProcess: async () => ok(fact) });
    const owner = createViceExecutionRuntimeV1(fixture.host);
    expect((await owner.acquireViceLease("c64", liveSignal())).ok).toBe(true);
    const operator = createViceExecutionRuntimeV1(fixture.host);
    const inspected = await operator.inspectViceLease("c64", liveSignal());
    expect(inspected.ok).toBe(true);
    if (!inspected.ok) return;
    expect(
      (
        await operator.clearViceLeaseGeneration(
          "c64",
          inspected.value.generation,
          inspected.value.nonce,
          liveSignal(),
        )
      ).ok,
    ).toBe(false);
  });

  it("removes a pre-launch lease without treating its coordinator owner as a child", async () => {
    const ownerFact: ViceProcessIdentityFactV1 = {
      bootId: "boot",
      pid: process.pid,
      startTicks: 10n,
      processGroupId: process.pid,
      launchToken: null,
    };
    const terminations: string[] = [];
    const fixture = hostFixture({
      observeProcess: async () => ok(ownerFact),
      revalidateAndTerminateVice: async () => {
        terminations.push("terminate");
        return ok("identity-changed");
      },
    });
    const runtime = createViceExecutionRuntimeV1(fixture.host);
    const acquired = await runtime.acquireViceLease("c64", liveSignal());
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    const controller = new AbortController();
    controller.abort();

    expect(
      await runtime.executeViceRoute(routeRequest(), acquired.value, controller.signal),
    ).toMatchObject({
      code: "wall-time-exhaustion",
    });
    expect(terminations).toEqual([]);
    expect(fixture.snapshot.kind).toBe("absent");
  });

  it("reconciles a durable child record before retry and exact cleanup", async () => {
    let allocations = 0;
    let replacements = 0;
    let removedCurrentReference = false;
    const matchedReplacementReferences: boolean[] = [];
    const fixture = hostFixture({
      allocateLoopbackEndpoints: async () => {
        const binaryPort = 20_000 + allocations * 2;
        allocations += 1;
        return ok({ binaryPort, textPort: binaryPort + 1 });
      },
      compareReplaceLease: async (_target, expected, bytes) => {
        const current = fixture.snapshot;
        matchedReplacementReferences.push(
          current.kind === "present" &&
            current.reference.bytesDigest === expected.bytesDigest &&
            current.reference.file.inode === expected.file.inode,
        );
        replacements += 1;
        fixture.snapshot = present(bytes, { ...FILE, inode: FILE.inode + BigInt(replacements) });
        return ok({ kind: "replaced", snapshot: fixture.snapshot });
      },
      compareRemoveLease: async (_target, expected) => {
        const current = fixture.snapshot;
        removedCurrentReference =
          current.kind === "present" &&
          current.reference.bytesDigest === expected.bytesDigest &&
          current.reference.file.inode === expected.file.inode;
        fixture.snapshot = { kind: "absent", directory: DIRECTORY };
        return ok({ kind: "removed" });
      },
      createControlAttempt: async (attempt) =>
        ok(
          failedControlHost(() => {
            if (replacements === 1) childRecordedSnapshot(fixture, attempt, FILE.inode + 10n);
          }),
        ),
    });
    const runtime = createViceExecutionRuntimeV1(fixture.host);
    const acquired = await runtime.acquireViceLease("c64", liveSignal());
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;

    const result = await runtime.executeViceRoute(routeRequest(), acquired.value, liveSignal());

    expect(result).toMatchObject({ code: "emulator-launch-failure" });
    expect(replacements).toBe(2);
    expect(matchedReplacementReferences).toEqual([true, true]);
    expect(removedCurrentReference).toBe(true);
    expect(fixture.snapshot.kind).toBe("absent");
  });

  it("terminates an exact durable child before confirming absence and removing its lease", async () => {
    const events: string[] = [];
    let child: ViceProcessIdentityFactV1 | undefined;
    let childLive = true;
    const fixture = hostFixture({
      compareReplaceLease: async (_target, _expected, bytes) => {
        fixture.snapshot = present(bytes, { ...FILE, inode: FILE.inode + 1n });
        return ok({ kind: "replaced", snapshot: fixture.snapshot });
      },
      createControlAttempt: async (attempt) =>
        ok(
          failedControlHost(() => {
            child = childRecordedSnapshot(fixture, attempt, FILE.inode + 2n);
          }),
        ),
      observeProcess: async () => {
        if (child === undefined) return ok(null);
        events.push(childLive ? "observe-live" : "confirm-absent");
        return ok(childLive ? child : null);
      },
      revalidateAndTerminateVice: async (request) => {
        events.push("terminate");
        expect(request.process).toEqual(child);
        childLive = false;
        return ok("signalled");
      },
      compareRemoveLease: async () => {
        events.push("remove");
        expect(childLive).toBe(false);
        fixture.snapshot = { kind: "absent", directory: DIRECTORY };
        return ok({ kind: "removed" });
      },
    });
    const runtime = createViceExecutionRuntimeV1(fixture.host);
    const acquired = await runtime.acquireViceLease("c64", liveSignal());
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    const route = routeRequest();

    await runtime.executeViceRoute(
      {
        ...route,
        policy: { ...route.policy, budget: { ...route.policy.budget, launchAttempts: 1 } },
      },
      acquired.value,
      liveSignal(),
    );

    expect(events).toEqual(["observe-live", "terminate", "confirm-absent", "remove"]);
    expect(fixture.snapshot.kind).toBe("absent");
  });

  it("retains the lease when durable child identity becomes ambiguous during cleanup", async () => {
    let child: ViceProcessIdentityFactV1 | undefined;
    const events: string[] = [];
    const fixture = hostFixture({
      compareReplaceLease: async (_target, _expected, bytes) => {
        fixture.snapshot = present(bytes, { ...FILE, inode: FILE.inode + 1n });
        return ok({ kind: "replaced", snapshot: fixture.snapshot });
      },
      createControlAttempt: async (attempt) =>
        ok(
          failedControlHost(() => {
            child = childRecordedSnapshot(fixture, attempt, FILE.inode + 2n);
          }),
        ),
      observeProcess: async () => {
        if (child === undefined) return ok(null);
        events.push("observe-changed");
        return ok({ ...child, startTicks: child.startTicks + 1n });
      },
      revalidateAndTerminateVice: async () => {
        events.push("terminate");
        return ok("identity-changed");
      },
      compareRemoveLease: async () => {
        events.push("remove");
        return ok({ kind: "removed" });
      },
    });
    const runtime = createViceExecutionRuntimeV1(fixture.host);
    const acquired = await runtime.acquireViceLease("c64", liveSignal());
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    const route = routeRequest();

    const result = await runtime.executeViceRoute(
      {
        ...route,
        policy: { ...route.policy, budget: { ...route.policy.budget, launchAttempts: 1 } },
      },
      acquired.value,
      liveSignal(),
    );

    expect(result).toMatchObject({
      status: "failure",
      code: "emulator-launch-failure",
      cleanupBlocker: { code: "emulator-lease-recovery-blocked" },
    });
    expect(events).toEqual(["observe-changed"]);
    expect(fixture.snapshot.kind).toBe("present");
  });

  it("retires each pre-capability attempt artifact before allocating the next retry", async () => {
    const active = new Set<string>();
    let peak = 0;
    let replacements = 0;
    let retirements = 0;
    let allocations = 0;
    const fixture = hostFixture({
      allocateLoopbackEndpoints: async () => {
        const binaryPort = 20_000 + allocations * 2;
        allocations += 1;
        return ok({ binaryPort, textPort: binaryPort + 1 });
      },
      compareReplaceLease: async (_target, _expected, bytes) => {
        expect(active.size).toBe(0);
        replacements += 1;
        fixture.snapshot = present(bytes, { ...FILE, inode: FILE.inode + BigInt(replacements) });
        const record = parseViceLeaseRecordV1(bytes);
        if (record?.attempt !== null && record?.attempt !== undefined) {
          active.add(record.attempt.launchTokenPath);
          peak = Math.max(peak, active.size);
        }
        return ok({ kind: "replaced", snapshot: fixture.snapshot });
      },
      compareRemoveLaunchArtifact: async (_target, expected, path) => {
        expect(fixture.snapshot).toMatchObject({
          kind: "present",
          reference: { bytesDigest: expected.bytesDigest },
        });
        expect(active.delete(path)).toBe(true);
        retirements += 1;
        return ok("removed");
      },
      createControlAttempt: async () => failed("execution.io"),
    });
    const runtime = createViceExecutionRuntimeV1(fixture.host);
    const acquired = await runtime.acquireViceLease("c64", liveSignal());
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    expect(
      await runtime.executeViceRoute(routeRequest(), acquired.value, liveSignal()),
    ).toMatchObject({ code: "emulator-launch-failure", usage: { launchAttempts: 2 } });
    expect({ replacements, retirements, peak, active: active.size }).toEqual({
      replacements: 2,
      retirements: 2,
      peak: 1,
      active: 0,
    });
  });

  it("retains the recoverable attempt and stops retry when artifact retirement is unproven", async () => {
    let replacements = 0;
    const fixture = hostFixture({
      compareReplaceLease: async (_target, _expected, bytes) => {
        replacements += 1;
        fixture.snapshot = present(bytes, { ...FILE, inode: FILE.inode + BigInt(replacements) });
        return ok({ kind: "replaced", snapshot: fixture.snapshot });
      },
      compareRemoveLaunchArtifact: async () => ok("process-present"),
      createControlAttempt: async () => failed("execution.io"),
    });
    const runtime = createViceExecutionRuntimeV1(fixture.host);
    const acquired = await runtime.acquireViceLease("c64", liveSignal());
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    expect(
      await runtime.executeViceRoute(routeRequest(), acquired.value, liveSignal()),
    ).toMatchObject({ code: "emulator-lease-recovery-blocked", usage: { launchAttempts: 1 } });
    expect(replacements).toBe(1);
    expect(fixture.snapshot.kind).toBe("present");
  });

  it("classifies a changed observed owner as ambiguous", async () => {
    const ownerFact: ViceProcessIdentityFactV1 = {
      bootId: "boot",
      pid: process.pid,
      startTicks: 10n,
      processGroupId: process.pid,
      launchToken: null,
    };
    let observations = 0;
    const fixture = hostFixture({
      observeProcess: async () => {
        observations += 1;
        return ok(observations === 1 ? ownerFact : { ...ownerFact, startTicks: 11n });
      },
    });
    const owner = createViceExecutionRuntimeV1(fixture.host);
    expect((await owner.acquireViceLease("c64", liveSignal())).ok).toBe(true);
    expect(
      await createViceExecutionRuntimeV1(fixture.host).inspectViceLease("c64", liveSignal()),
    ).toMatchObject({ ok: true, value: { state: "ambiguous", childAbsent: false } });
  });

  it("requires positive absence for an ownerless lease", async () => {
    let observations = 0;
    const liveFact: ViceProcessIdentityFactV1 = {
      bootId: "boot",
      pid: process.pid,
      startTicks: 10n,
      processGroupId: process.pid,
      launchToken: null,
    };
    const fixture = hostFixture({
      observeProcess: async () => {
        observations += 1;
        return ok(observations === 1 ? null : liveFact);
      },
    });
    const owner = createViceExecutionRuntimeV1(fixture.host);
    expect((await owner.acquireViceLease("c64", liveSignal())).ok).toBe(true);
    expect(
      await createViceExecutionRuntimeV1(fixture.host).inspectViceLease("c64", liveSignal()),
    ).toMatchObject({ ok: true, value: { state: "ambiguous", childAbsent: false } });
  });

  it("rejects changed clear generations and propagates removal failure", async () => {
    const fixture = hostFixture();
    const owner = createViceExecutionRuntimeV1(fixture.host);
    expect((await owner.acquireViceLease("c64", liveSignal())).ok).toBe(true);
    const operator = createViceExecutionRuntimeV1(fixture.host);
    const evidence = await operator.inspectViceLease("c64", liveSignal());
    expect(evidence.ok).toBe(true);
    if (!evidence.ok) return;
    expect(
      await operator.clearViceLeaseGeneration(
        "c64",
        evidence.value.generation + 1,
        evidence.value.nonce,
        liveSignal(),
      ),
    ).toMatchObject({ ok: false });

    const failingOperator = createViceExecutionRuntimeV1({
      ...fixture.host,
      compareRemoveLease: async () => failed("execution.io"),
    });
    expect(
      await failingOperator.clearViceLeaseGeneration(
        "c64",
        evidence.value.generation,
        evidence.value.nonce,
        liveSignal(),
      ),
    ).toMatchObject({ ok: false });
  });

  it.each([
    [
      "endpoint allocation failure",
      (): Partial<ViceExecutionHostV1> => ({
        allocateLoopbackEndpoints: async () => failed("execution.io"),
      }),
      "emulator-launch-failure",
    ],
    [
      "non-distinct endpoints",
      (): Partial<ViceExecutionHostV1> => ({
        allocateLoopbackEndpoints: async () => ok({ binaryPort: 20_000, textPort: 20_000 }),
      }),
      "emulator-launch-failure",
    ],
    [
      "invalid launch token",
      (): Partial<ViceExecutionHostV1> => {
        let calls = 0;
        return { randomBytes: () => new Uint8Array((calls += 1) === 1 ? 32 : 31) };
      },
      "emulator-launch-failure",
    ],
    [
      "lease replacement failure",
      (): Partial<ViceExecutionHostV1> => ({
        compareReplaceLease: async () => failed("execution.io"),
      }),
      "emulator-lease-recovery-blocked",
    ],
  ] as const)("fails closed on %s", async (_name, createOverride, code) => {
    const fixture = hostFixture(createOverride());
    const runtime = createViceExecutionRuntimeV1(fixture.host);
    const acquired = await runtime.acquireViceLease("c64", liveSignal());
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    expect(
      await runtime.executeViceRoute(routeRequest(), acquired.value, liveSignal()),
    ).toMatchObject({
      code,
    });
  });

  it("maps endpoint failure after caller cancellation to wall-time exhaustion", async () => {
    const controller = new AbortController();
    const fixture = hostFixture({
      allocateLoopbackEndpoints: async () => {
        controller.abort();
        return failed("execution.io");
      },
    });
    const runtime = createViceExecutionRuntimeV1(fixture.host);
    const acquired = await runtime.acquireViceLease("c64", liveSignal());
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;

    expect(
      await runtime.executeViceRoute(routeRequest(), acquired.value, controller.signal),
    ).toMatchObject({ code: "wall-time-exhaustion" });
  });

  it("maps control preparation failure after caller cancellation to wall-time exhaustion", async () => {
    const controller = new AbortController();
    const fixture = hostFixture({
      compareReplaceLease: async (_target, _expected, bytes) => {
        fixture.snapshot = present(bytes, { ...FILE, inode: FILE.inode + 1n });
        return ok({ kind: "replaced", snapshot: fixture.snapshot });
      },
      createControlAttempt: async () => {
        controller.abort();
        return failed("execution.io");
      },
    });
    const runtime = createViceExecutionRuntimeV1(fixture.host);
    const acquired = await runtime.acquireViceLease("c64", liveSignal());
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;

    expect(
      await runtime.executeViceRoute(routeRequest(), acquired.value, controller.signal),
    ).toMatchObject({ code: "wall-time-exhaustion" });
  });

  it("keeps caller cancellation primary when launch cleanup is blocked", async () => {
    const controller = new AbortController();
    const fixture = hostFixture({
      compareReplaceLease: async (_target, _expected, bytes) => {
        fixture.snapshot = present(bytes, { ...FILE, inode: FILE.inode + 1n });
        return ok({ kind: "replaced", snapshot: fixture.snapshot });
      },
      createControlAttempt: async () =>
        ok(
          failedControlHost(() => {
            controller.abort();
          }, "vice.closed"),
        ),
    });
    const runtime = createViceExecutionRuntimeV1(fixture.host);
    const acquired = await runtime.acquireViceLease("c64", liveSignal());
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;

    expect(
      await runtime.executeViceRoute(routeRequest(), acquired.value, controller.signal),
    ).toMatchObject({
      status: "failure",
      code: "wall-time-exhaustion",
      cleanupBlocker: { code: "emulator-lease-recovery-blocked" },
    });
  });

  it("rejects an invalid record returned from attempt replacement", async () => {
    const fixture = hostFixture({
      compareReplaceLease: async () => {
        fixture.snapshot = present(new TextEncoder().encode("invalid"));
        return ok({ kind: "replaced", snapshot: fixture.snapshot });
      },
    });
    const runtime = createViceExecutionRuntimeV1(fixture.host);
    const acquired = await runtime.acquireViceLease("c64", liveSignal());
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    expect(
      await runtime.executeViceRoute(routeRequest(), acquired.value, liveSignal()),
    ).toMatchObject({
      code: "emulator-lease-recovery-blocked",
    });
  });

  it("retains the lease when a failed launch cannot reconcile durable child state", async () => {
    let observations = 0;
    const fixture = hostFixture({
      observeLease: async () => {
        observations += 1;
        return observations === 1 ? ok(fixture.snapshot) : failed("execution.io");
      },
      compareReplaceLease: async (_target, _expected, bytes) => {
        fixture.snapshot = present(bytes, { ...FILE, inode: FILE.inode + 1n });
        return ok({ kind: "replaced", snapshot: fixture.snapshot });
      },
      createControlAttempt: async () => ok(failedControlHost(() => undefined)),
    });
    const runtime = createViceExecutionRuntimeV1(fixture.host);
    const acquired = await runtime.acquireViceLease("c64", liveSignal());
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    expect(
      await runtime.executeViceRoute(routeRequest(), acquired.value, liveSignal()),
    ).toMatchObject({
      code: "emulator-lease-recovery-blocked",
    });
    expect(fixture.snapshot.kind).toBe("present");
  });

  it("stops cleanup when an ownerless lease removal fails", async () => {
    const fixture = hostFixture({
      observeProcess: async () => ok(null),
      compareRemoveLease: async () => failed("execution.io"),
    });
    const runtime = createViceExecutionRuntimeV1(fixture.host);
    const acquired = await runtime.acquireViceLease("c64", liveSignal());
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    expect(
      await runtime.executeViceRoute(
        { ...routeRequest(), binary: new Uint8Array(0) },
        acquired.value,
        liveSignal(),
      ),
    ).toMatchObject({ code: "invalid-evidence-input" });
  });

  it("stops cleanup when the retained owner cannot be re-observed", async () => {
    let observations = 0;
    const ownerFact: ViceProcessIdentityFactV1 = {
      bootId: "boot",
      pid: process.pid,
      startTicks: 10n,
      processGroupId: process.pid,
      launchToken: null,
    };
    const fixture = hostFixture({
      observeProcess: async () => {
        observations += 1;
        return observations === 1 ? ok(ownerFact) : failed("execution.io");
      },
      compareRemoveLease: async () => failed("execution.io"),
    });
    const runtime = createViceExecutionRuntimeV1(fixture.host);
    const acquired = await runtime.acquireViceLease("c64", liveSignal());
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    expect(
      await runtime.executeViceRoute(
        { ...routeRequest(), binary: new Uint8Array(0) },
        acquired.value,
        liveSignal(),
      ),
    ).toMatchObject({ code: "invalid-evidence-input" });
  });

  it.each([
    ["untrusted directory", { kind: "absent", directory: { ...DIRECTORY, mode: 0o755 } }],
    ["invalid present record", present(new TextEncoder().encode("invalid"))],
  ] as const)("rejects %s during passive inspection", async (_name, snapshot) => {
    const fixture = hostFixture({ observeLease: async () => ok(snapshot) });
    expect(
      await createViceExecutionRuntimeV1(fixture.host).inspectViceLease("c64", liveSignal()),
    ).toMatchObject({ ok: false });
  });

  it("rejects concurrent acquisition and clear mutations without queueing", async () => {
    let releaseAcquire:
      | ((value: ExecutionOperationResultV1<"linux" | "unsupported">) => void)
      | undefined;
    const acquiringFixture = hostFixture({
      platform: async () =>
        new Promise((resolve) => {
          releaseAcquire = resolve;
        }),
    });
    const acquiring = createViceExecutionRuntimeV1(acquiringFixture.host);
    const firstAcquire = acquiring.acquireViceLease("c64", liveSignal());
    await Promise.resolve();
    expect(await acquiring.acquireViceLease("c64", liveSignal())).toMatchObject({ ok: false });
    releaseAcquire?.(ok("linux"));
    await firstAcquire;

    let releaseInspect:
      | ((value: ExecutionOperationResultV1<"linux" | "unsupported">) => void)
      | undefined;
    const clearingFixture = hostFixture({
      platform: async () =>
        new Promise((resolve) => {
          releaseInspect = resolve;
        }),
    });
    const clearing = createViceExecutionRuntimeV1(clearingFixture.host);
    const inspection = clearing.inspectViceLease("c64", liveSignal());
    await Promise.resolve();
    expect(
      await clearing.clearViceLeaseGeneration("c64", 1, "a".repeat(64), liveSignal()),
    ).toMatchObject({ ok: false });
    releaseInspect?.(ok("linux"));
    await inspection;
  });

  it("propagates process observation failures during inspect and clear", async () => {
    const ownerFact: ViceProcessIdentityFactV1 = {
      bootId: "boot",
      pid: process.pid,
      startTicks: 10n,
      processGroupId: process.pid,
      launchToken: null,
    };
    for (const operation of ["inspect", "clear"] as const) {
      let observations = 0;
      const fixture = hostFixture({
        observeProcess: async () => {
          observations += 1;
          return observations === 1 ? ok(ownerFact) : failed("execution.io");
        },
      });
      const owner = createViceExecutionRuntimeV1(fixture.host);
      expect((await owner.acquireViceLease("c64", liveSignal())).ok).toBe(true);
      const operator = createViceExecutionRuntimeV1(fixture.host);
      if (operation === "inspect") {
        expect(await operator.inspectViceLease("c64", liveSignal())).toMatchObject({ ok: false });
      } else {
        if (fixture.snapshot.kind !== "present") return;
        const record = parseViceLeaseRecordV1(fixture.snapshot.bytes);
        if (record === undefined) return;
        expect(
          await operator.clearViceLeaseGeneration(
            "c64",
            record.generation,
            record.nonce,
            liveSignal(),
          ),
        ).toMatchObject({ ok: false });
      }
    }
  });

  it("refuses to clear an ownerless lease while the current process exists", async () => {
    let observations = 0;
    const current: ViceProcessIdentityFactV1 = {
      bootId: "boot",
      pid: process.pid,
      startTicks: 10n,
      processGroupId: process.pid,
      launchToken: null,
    };
    const fixture = hostFixture({
      observeProcess: async () => {
        observations += 1;
        return ok(observations === 1 ? null : current);
      },
    });
    const owner = createViceExecutionRuntimeV1(fixture.host);
    expect((await owner.acquireViceLease("c64", liveSignal())).ok).toBe(true);
    if (fixture.snapshot.kind !== "present") return;
    const record = parseViceLeaseRecordV1(fixture.snapshot.bytes);
    if (record === undefined) return;
    expect(
      await createViceExecutionRuntimeV1(fixture.host).clearViceLeaseGeneration(
        "c64",
        record.generation,
        record.nonce,
        liveSignal(),
      ),
    ).toMatchObject({ ok: false });
  });

  it.each<readonly [string, Partial<ViceExecutionHostV1>]>([
    ["environment", { platform: async () => failed("execution.io") }],
    ["lease", { observeLease: async () => failed("execution.io") }],
  ])("propagates an inspection %s failure", async (_name, override) => {
    const fixture = hostFixture(override);
    expect(
      await createViceExecutionRuntimeV1(fixture.host).inspectViceLease("c64", liveSignal()),
    ).toMatchObject({ ok: false });
  });

  it("charges a route whose wall budget expires before endpoint allocation", async () => {
    const times = [0, 0, 0, 200_000];
    const fixture = hostFixture({ nowMonotonicMilliseconds: () => times.shift() ?? 200_000 });
    const runtime = createViceExecutionRuntimeV1(fixture.host);
    const acquired = await runtime.acquireViceLease("c64", liveSignal());
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    expect(
      await runtime.executeViceRoute(routeRequest(), acquired.value, liveSignal()),
    ).toMatchObject({
      code: "wall-time-exhaustion",
    });
  });

  it("uses bounded cleanup for structurally missing policy input", async () => {
    const fixture = hostFixture();
    const runtime = createViceExecutionRuntimeV1(fixture.host);
    const acquired = await runtime.acquireViceLease("c64", liveSignal());
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    const request = routeRequest();
    Reflect.deleteProperty(request, "policy");
    expect(await runtime.executeViceRoute(request, acquired.value, liveSignal())).toMatchObject({
      code: "invalid-evidence-input",
    });
  });

  it("rejects forged and oversized route fields before endpoint or process work", async () => {
    const missing = routeRequest() as ViceRouteRequestV1 & {
      policy?: ViceRouteRequestV1["policy"];
    };
    Reflect.deleteProperty(missing, "policy");
    const accessor = { ...routeRequest() } as Record<string, unknown>;
    Object.defineProperty(accessor, "binary", { enumerable: true, get: () => Uint8Array.of(0x60) });
    const nonEnumerable = { ...routeRequest() };
    Object.defineProperty(nonEnumerable, "binary", {
      enumerable: false,
      value: nonEnumerable.binary,
    });
    const baseForChangedStore = routeRequest();
    const changedStore: ViceRouteRequestV1 = {
      ...baseForChangedStore,
      layout: {
        ...baseForChangedStore.layout,
        postEntryStores: baseForChangedStore.layout.postEntryStores.map((store, index) =>
          index === 0 ? { ...store, targetAddress: 0x0202 } : store,
        ),
      },
    };
    for (const request of [
      null,
      [],
      Object.create(null),
      { ...routeRequest(), extra: true },
      missing,
      accessor,
      nonEnumerable,
      { ...routeRequest(), binary: new Uint8Array(65_537) },
      { ...routeRequest(), binary: [] },
      { ...routeRequest(), binary: new Uint8Array(0) },
      { ...routeRequest(), loadAddress: -1 },
      { ...routeRequest(), loadAddress: 65_536 },
      { ...routeRequest(), entryAddress: -1 },
      { ...routeRequest(), fixture: {} },
      { ...routeRequest(), policy: {} },
      { ...routeRequest(), layout: {} },
      {
        ...routeRequest(),
        binary: new Proxy(Uint8Array.of(0x60), {
          getPrototypeOf: () => {
            throw new Error("hostile nested prototype");
          },
        }),
      },
      new Proxy(routeRequest(), {
        ownKeys: () => {
          throw new Error("hostile keys");
        },
      }),
      { ...routeRequest(), observation: { kind: "scalar-bytes", byteLength: 3 } },
      changedStore,
    ]) {
      const fixture = hostFixture();
      const runtime = createViceExecutionRuntimeV1(fixture.host);
      const acquired = await runtime.acquireViceLease("c64", liveSignal());
      expect(acquired.ok).toBe(true);
      if (!acquired.ok) continue;
      expect(
        await runtime.executeViceRoute(request as ViceRouteRequestV1, acquired.value, liveSignal()),
      ).toMatchObject({ code: "invalid-evidence-input" });
      expect(fixture.calls).not.toContain("endpoints");
    }
  });
});
