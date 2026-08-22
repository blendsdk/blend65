import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it, vi } from "vitest";

type IssueCode =
  | "tier-unavailable"
  | "emulator-launch-failure"
  | "emulator-handshake-failure"
  | "emulator-lease-recovery-blocked"
  | "instruction-exhaustion"
  | "cycle-exhaustion"
  | "wall-time-exhaustion"
  | "semantic-mismatch"
  | "execution.invalid-schema"
  | "execution.io"
  | "execution.stale-authority"
  | "execution.identity"
  | "execution.reconciliation";

interface Issue {
  readonly code: IssueCode;
  readonly path: string;
  readonly message: string;
}

type OperationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly [Issue, ...Issue[]] };

interface NodeIdentity {
  readonly device: bigint;
  readonly inode: bigint;
  readonly uid: number;
  readonly mode: number;
  readonly links: number;
}

interface LeaseReference {
  readonly directory: NodeIdentity;
  readonly file: NodeIdentity;
  readonly bytesDigest: string;
}

type LeaseSnapshot =
  | { readonly kind: "absent"; readonly directory: NodeIdentity }
  | {
      readonly kind: "present";
      readonly directory: NodeIdentity;
      readonly file: NodeIdentity;
      readonly bytes: Uint8Array;
      readonly reference: LeaseReference;
    };

interface ProcessFact {
  readonly bootId: string;
  readonly pid: number;
  readonly startTicks: bigint;
  readonly processGroupId: number;
  readonly launchToken: Uint8Array | null;
}

interface Endpoints {
  readonly binaryPort: number;
  readonly textPort: number;
}

interface RecordedAttempt {
  readonly target: "c64";
  readonly claim: LeaseReference;
  readonly generation: number;
  readonly nonce: string;
  readonly launchToken: Uint8Array;
  readonly endpoints: Endpoints;
  readonly executable: string;
  readonly argv: readonly string[];
  readonly cwd: string;
}

interface TerminationRequest {
  readonly target: "c64";
  readonly lease: LeaseReference;
  readonly process: ProcessFact;
  readonly generation: number;
  readonly nonce: string;
  readonly phase: "graceful" | "forced";
}

type LeaseMutation =
  | { readonly kind: "created" | "replaced"; readonly snapshot: LeaseSnapshot }
  | { readonly kind: "occupied" | "changed" | "missing" | "removed" };

interface ControlIssue {
  readonly code: "vice.protocol" | "vice.cancelled" | "vice.closed" | "vice.io";
  readonly reason: string;
  readonly message: string;
}

type ControlResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issue: ControlIssue };

interface RawChannel {
  write(bytes: Uint8Array): Promise<ControlResult<true>>;
  read(): Promise<ControlResult<Uint8Array | null>>;
  close(): Promise<ControlResult<true>>;
}

interface OwnedChild {
  readonly identity: string;
  readonly exited: Promise<{ readonly code: number | null; readonly signal: string | null }>;
}

interface ControlHost {
  nowMilliseconds(): number;
  delay(milliseconds: number, signal: AbortSignal): Promise<"elapsed" | "aborted">;
  spawn(
    request: {
      readonly executable: string;
      readonly argv: readonly string[];
      readonly cwd: string;
    },
    signal: AbortSignal,
  ): Promise<ControlResult<OwnedChild>>;
  connectLoopback(
    role: "binary" | "text",
    port: number,
    signal: AbortSignal,
  ): Promise<ControlResult<RawChannel>>;
  endpointBelongsToChild(
    child: OwnedChild,
    role: "binary" | "text",
    port: number,
  ): Promise<ControlResult<boolean>>;
  closeOwnedChild(child: OwnedChild): Promise<ControlResult<true>>;
}

interface ExecutionHost {
  platform(signal: AbortSignal): Promise<OperationResult<"linux" | "unsupported">>;
  effectiveUid(signal: AbortSignal): Promise<OperationResult<number>>;
  nowMonotonicMilliseconds(): number;
  delay(milliseconds: number, signal: AbortSignal): Promise<"elapsed" | "aborted">;
  randomBytes(byteLength: 32): Uint8Array;
  observeLease(target: "c64", signal: AbortSignal): Promise<OperationResult<LeaseSnapshot>>;
  tryCreateLease(
    target: "c64",
    expectedDirectory: NodeIdentity,
    bytes: Uint8Array,
    signal: AbortSignal,
  ): Promise<OperationResult<LeaseMutation>>;
  compareReplaceLease(
    target: "c64",
    expected: LeaseReference,
    bytes: Uint8Array,
    signal: AbortSignal,
  ): Promise<OperationResult<LeaseMutation>>;
  compareRemoveLease(
    target: "c64",
    expected: LeaseReference,
    signal: AbortSignal,
  ): Promise<OperationResult<LeaseMutation>>;
  observeProcess(pid: number, signal: AbortSignal): Promise<OperationResult<ProcessFact | null>>;
  allocateLoopbackEndpoints(signal: AbortSignal): Promise<OperationResult<Endpoints>>;
  createControlAttempt(
    attempt: RecordedAttempt,
    signal: AbortSignal,
  ): Promise<OperationResult<ControlHost>>;
  revalidateAndTerminateVice(
    request: TerminationRequest,
    signal: AbortSignal,
  ): Promise<
    OperationResult<"signalled" | "already-exited" | "lease-changed" | "identity-changed">
  >;
}

interface ExecutionResult {
  readonly status: "pass" | "failure";
  readonly code: string;
  readonly stage: string;
  readonly usage: {
    readonly instructions: number;
    readonly cycles: number;
    readonly launchAttempts: number;
  };
}

interface RecoveryEvidence {
  readonly state: "clear" | "active" | "ambiguous";
  readonly generation: number;
  readonly nonce: string;
  readonly childAbsent: boolean;
  readonly evidenceDigest: string;
}

interface ViceRuntime {
  acquireViceLease(target: "c64", signal: AbortSignal): Promise<OperationResult<unknown>>;
  inspectViceLease(target: "c64", signal: AbortSignal): Promise<OperationResult<RecoveryEvidence>>;
  clearViceLeaseGeneration(
    target: "c64",
    generation: number,
    nonce: string,
    signal: AbortSignal,
  ): Promise<OperationResult<true>>;
  executeViceRoute(
    request: ViceRouteRequest,
    lease: unknown,
    signal: AbortSignal,
  ): Promise<ExecutionResult>;
}

interface ExecutionApi {
  createViceExecutionRuntimeV1(host?: ExecutionHost): ViceRuntime;
  acquireViceLeaseV1(target: "c64", signal: AbortSignal): Promise<OperationResult<unknown>>;
  inspectViceLeaseV1(
    target: "c64",
    signal: AbortSignal,
  ): Promise<OperationResult<RecoveryEvidence>>;
  clearViceLeaseGenerationV1(
    target: "c64",
    generation: number,
    nonce: string,
    signal: AbortSignal,
  ): Promise<OperationResult<true>>;
  executeViceRouteV1(
    request: ViceRouteRequest,
    lease: unknown,
    signal: AbortSignal,
  ): Promise<ExecutionResult>;
}

interface ViceRouteRequest {
  readonly binary: Uint8Array;
  readonly loadAddress: number;
  readonly entryAddress: number;
  readonly fixture: {
    readonly revision: "c64-vic-color-readback-v1";
    readonly cells: readonly { readonly address: number; readonly logicalValue: number }[];
  };
  readonly layout: {
    readonly revision: "execution-observation-layout-v1";
    readonly resultSymbols: readonly string[];
    readonly resultAddresses: readonly number[];
    readonly completionSymbol: string;
    readonly completionAddress: number;
    readonly postEntryStores: readonly object[];
    readonly proofDigest: string;
  };
  readonly observation: { readonly kind: "scalar-bytes"; readonly byteLength: 1 };
  readonly policy: {
    readonly revision: "execution-policy-v1";
    readonly budget: {
      readonly operationMs: number;
      readonly launchAttemptMs: number;
      readonly routeMs: number;
      readonly cleanupGraceMs: number;
      readonly outputBytes: number;
      readonly evidenceBytes: number;
      readonly instructions: number;
      readonly cycles: number;
      readonly launchAttempts: number;
    };
  };
}

const DIRECTORY: NodeIdentity = { device: 7n, inode: 11n, uid: 1000, mode: 0o700, links: 1 };
const FILE: NodeIdentity = { device: 7n, inode: 12n, uid: 1000, mode: 0o600, links: 1 };
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const liveSignal = (): AbortSignal => new AbortController().signal;
const ok = <T>(value: T): OperationResult<T> => ({ ok: true, value });
const controlOk = <T>(value: T): ControlResult<T> => ({ ok: true, value });
const failure = (code: IssueCode): OperationResult<never> => ({
  ok: false,
  issues: [{ code, path: "vice", message: code }],
});

function reference(bytes: Uint8Array): LeaseReference {
  return {
    directory: DIRECTORY,
    file: FILE,
    bytesDigest: createHash("sha256").update(bytes).digest("hex"),
  };
}

function present(bytes: Uint8Array): LeaseSnapshot {
  const copy = Uint8Array.from(bytes);
  return {
    kind: "present",
    directory: DIRECTORY,
    file: FILE,
    bytes: copy,
    reference: reference(copy),
  };
}

function u16(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
}

function u32(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, value >>> 24);
}

function response(
  type: number,
  requestId: number,
  body: Uint8Array<ArrayBufferLike> = new Uint8Array(),
): Uint8Array {
  return Uint8Array.of(2, 2, ...u32(body.length), type, 0, ...u32(requestId), ...body);
}

function checkpointBody(address: number): Uint8Array {
  return Uint8Array.of(...u32(9), 1, ...u16(address), ...u16(address), 1, 1, 2, 0, ...u32(1));
}

class ProtocolControlHost implements ControlHost {
  readonly instructionCounts: number[] = [];
  readonly events: string[] = [];
  completionByte = 0xa5;
  hitAfter = Number.POSITIVE_INFINITY;
  private advances = 0;
  private readonly binaryReads: Uint8Array[] = [];
  private readonly textReads: Uint8Array[] = [];
  private memory = new Map<number, number>();

  nowMilliseconds(): number {
    return 0;
  }

  async delay(_milliseconds: number, signal: AbortSignal): Promise<"elapsed" | "aborted"> {
    return signal.aborted ? "aborted" : "elapsed";
  }

  async spawn(): Promise<ControlResult<OwnedChild>> {
    this.events.push("spawn");
    return controlOk({ identity: "owned-child", exited: new Promise(() => undefined) });
  }

  async connectLoopback(role: "binary" | "text"): Promise<ControlResult<RawChannel>> {
    this.events.push(`connect:${role}`);
    return controlOk(role === "binary" ? this.binaryChannel() : this.textChannel());
  }

  async endpointBelongsToChild(
    _child: OwnedChild,
    role: "binary" | "text",
  ): Promise<ControlResult<boolean>> {
    this.events.push(`owner:${role}`);
    return controlOk(true);
  }

  async closeOwnedChild(): Promise<ControlResult<true>> {
    this.events.push("close-child");
    return controlOk(true);
  }

  private binaryChannel(): RawChannel {
    return {
      write: async (bytes) => {
        this.handleBinary(bytes);
        return controlOk(true);
      },
      read: async () => controlOk(this.binaryReads.shift() ?? null),
      close: async () => controlOk(true),
    };
  }

  private textChannel(): RawChannel {
    return {
      write: async (bytes) => {
        this.events.push(`text:${decoder.decode(bytes)}`);
        this.textReads.push(encoder.encode("Stopwatch: 1234\n(C:$e5cf) "));
        return controlOk(true);
      },
      read: async () => controlOk(this.textReads.shift() ?? null),
      close: async () => controlOk(true),
    };
  }

  private handleBinary(frame: Uint8Array): void {
    expect(frame.slice(0, 2)).toEqual(Uint8Array.of(2, 2));
    const requestId = readU32(frame, 6);
    const type = frame[10];
    const body = frame.slice(11);
    if (type === 0x83) {
      const names = ["A", "X", "Y", "SP", "PC", "FL"];
      const items = names.flatMap((name, id) => [
        3 + name.length,
        id,
        name === "PC" ? 16 : 8,
        name.length,
        ...encoder.encode(name),
      ]);
      this.binaryReads.push(
        response(type, requestId, Uint8Array.of(...u16(names.length), ...items)),
      );
    } else if (type === 0x85) {
      this.binaryReads.push(response(type, requestId, Uint8Array.of(4, 3, 10, 0, 0)));
    } else if (type === 0x51) {
      this.binaryReads.push(response(type, requestId, Uint8Array.of(1, 1, 0)));
    } else if (type === 0x02) {
      const start = readU16(body, 1);
      for (let index = 7; index < body.length; index += 1)
        this.memory.set(start + index - 7, body[index]);
      this.binaryReads.push(response(type, requestId));
    } else if (type === 0x01) {
      const start = readU16(body, 1);
      const end = readU16(body, 3);
      const data = Array.from(
        { length: end - start + 1 },
        (_, index) =>
          this.memory.get(start + index) ?? (start + index === 0x0201 ? this.completionByte : 0),
      );
      this.binaryReads.push(response(type, requestId, Uint8Array.of(...u16(data.length), ...data)));
    } else if (type === 0x32) {
      this.binaryReads.push(response(0x31, requestId, Uint8Array.of(1, 0, 3, 4, 0x10, 0x08)));
    } else if (type === 0x12) {
      this.binaryReads.push(response(0x11, requestId, checkpointBody(readU16(body, 0))));
    } else if (type === 0x71) {
      const count = readU16(body, 1);
      this.instructionCounts.push(count);
      this.advances += 1;
      if (this.advances >= this.hitAfter) {
        this.binaryReads.push(response(0x11, 0xffffffff, checkpointBody(0x0201)));
        this.binaryReads.push(response(type, requestId));
        this.binaryReads.push(response(0x62, 0xffffffff));
        return;
      } else {
        this.binaryReads.push(response(0x62, 0xffffffff));
      }
      this.binaryReads.push(response(type, requestId));
    } else {
      this.binaryReads.push(response(type, requestId));
    }
  }
}

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

class FakeExecutionHost implements ExecutionHost {
  readonly calls: string[] = [];
  readonly endpoints: Endpoints[] = [];
  readonly attempts: RecordedAttempt[] = [];
  readonly controls: ProtocolControlHost[] = [];
  snapshot: LeaseSnapshot = { kind: "absent", directory: DIRECTORY };
  platformValue: "linux" | "unsupported" = "linux";
  processFact: ProcessFact | null = null;
  controlFailure: IssueCode | undefined;
  termination: "signalled" | "already-exited" | "lease-changed" | "identity-changed" =
    "already-exited";
  mutationOverride: LeaseMutation | undefined;
  observeGate: Promise<void> | undefined;
  processFailure: IssueCode | undefined;
  capturedCreateBytes: Uint8Array | undefined;
  private endpointOrdinal = 0;

  async platform(): Promise<OperationResult<"linux" | "unsupported">> {
    this.calls.push("platform");
    return ok(this.platformValue);
  }

  async effectiveUid(): Promise<OperationResult<number>> {
    this.calls.push("uid");
    return ok(1000);
  }

  nowMonotonicMilliseconds(): number {
    return 0;
  }

  async delay(_milliseconds: number, signal: AbortSignal): Promise<"elapsed" | "aborted"> {
    return signal.aborted ? "aborted" : "elapsed";
  }

  randomBytes(byteLength: 32): Uint8Array {
    this.calls.push("random");
    return Uint8Array.from({ length: byteLength }, (_, index) => index + 1);
  }

  async observeLease(): Promise<OperationResult<LeaseSnapshot>> {
    this.calls.push("observe");
    await this.observeGate;
    return ok(this.snapshot);
  }

  async tryCreateLease(
    _target: "c64",
    _directory: NodeIdentity,
    bytes: Uint8Array,
  ): Promise<OperationResult<LeaseMutation>> {
    this.calls.push("create");
    if (this.snapshot.kind === "present") return ok({ kind: "occupied" });
    this.capturedCreateBytes = bytes;
    this.snapshot = present(bytes);
    return ok({ kind: "created", snapshot: this.snapshot });
  }

  async compareReplaceLease(
    _target: "c64",
    expected: LeaseReference,
    bytes: Uint8Array,
  ): Promise<OperationResult<LeaseMutation>> {
    this.calls.push("replace");
    if (this.mutationOverride !== undefined) return ok(this.mutationOverride);
    if (
      this.snapshot.kind !== "present" ||
      this.snapshot.reference.bytesDigest !== expected.bytesDigest
    )
      return ok({ kind: "changed" });
    this.snapshot = present(bytes);
    return ok({ kind: "replaced", snapshot: this.snapshot });
  }

  async compareRemoveLease(
    _target: "c64",
    expected: LeaseReference,
  ): Promise<OperationResult<LeaseMutation>> {
    this.calls.push("remove");
    if (this.mutationOverride !== undefined) return ok(this.mutationOverride);
    if (
      this.snapshot.kind !== "present" ||
      this.snapshot.reference.bytesDigest !== expected.bytesDigest
    )
      return ok({ kind: "changed" });
    this.snapshot = { kind: "absent", directory: DIRECTORY };
    return ok({ kind: "removed" });
  }

  async observeProcess(pid: number): Promise<OperationResult<ProcessFact | null>> {
    this.calls.push(`process:${pid}`);
    if (this.processFailure !== undefined) return failure(this.processFailure);
    return ok(this.processFact);
  }

  async allocateLoopbackEndpoints(): Promise<OperationResult<Endpoints>> {
    this.calls.push("endpoints");
    this.endpointOrdinal += 1;
    const value = {
      binaryPort: 20_000 + this.endpointOrdinal * 2,
      textPort: 20_001 + this.endpointOrdinal * 2,
    };
    this.endpoints.push(value);
    return ok(value);
  }

  async createControlAttempt(attempt: RecordedAttempt): Promise<OperationResult<ControlHost>> {
    this.calls.push("control");
    this.attempts.push(attempt);
    if (this.controlFailure !== undefined) return failure(this.controlFailure);
    const control = new ProtocolControlHost();
    this.controls.push(control);
    return ok(control);
  }

  async revalidateAndTerminateVice(): Promise<
    OperationResult<"signalled" | "already-exited" | "lease-changed" | "identity-changed">
  > {
    this.calls.push("terminate");
    return ok(this.termination);
  }
}

function routeRequest(instructions: number): ViceRouteRequest {
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
        { instructionAddress: 0x0815, targetAddress: 0x0201, kind: "completion", value: 165 },
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
        instructions,
        cycles: 100_000_000,
        launchAttempts: 8,
      },
    },
  };
}

let api: ExecutionApi | undefined;

function requireApi(): ExecutionApi {
  if (api === undefined) throw new TypeError("Missing VICE execution runtime exports");
  return api;
}

beforeAll(async () => {
  const module = await vi.importActual<Partial<ExecutionApi>>("./index.js");
  if (
    typeof module.createViceExecutionRuntimeV1 === "function" &&
    typeof module.acquireViceLeaseV1 === "function" &&
    typeof module.inspectViceLeaseV1 === "function" &&
    typeof module.clearViceLeaseGenerationV1 === "function" &&
    typeof module.executeViceRouteV1 === "function"
  ) {
    api = {
      createViceExecutionRuntimeV1: module.createViceExecutionRuntimeV1,
      acquireViceLeaseV1: module.acquireViceLeaseV1,
      inspectViceLeaseV1: module.inspectViceLeaseV1,
      clearViceLeaseGenerationV1: module.clearViceLeaseGenerationV1,
      executeViceRouteV1: module.executeViceRouteV1,
    };
  }
});

describe("exclusive VICE lease and execution policy", () => {
  it("exports both an injectable runtime and the singleton facade", () => {
    expect(requireApi()).toEqual(
      expect.objectContaining({
        createViceExecutionRuntimeV1: expect.any(Function),
        acquireViceLeaseV1: expect.any(Function),
        inspectViceLeaseV1: expect.any(Function),
        clearViceLeaseGenerationV1: expect.any(Function),
        executeViceRouteV1: expect.any(Function),
      }),
    );
  });

  it("does no host work for a pre-aborted acquisition", async () => {
    const host = new FakeExecutionHost();
    const runtime = requireApi().createViceExecutionRuntimeV1(host);
    const controller = new AbortController();
    controller.abort();
    expect((await runtime.acquireViceLease("c64", controller.signal)).ok).toBe(false);
    expect(host.calls).toEqual([]);
  });

  it("fails unavailable hosts before reading or mutating the lease", async () => {
    const host = new FakeExecutionHost();
    host.platformValue = "unsupported";
    const result = await requireApi()
      .createViceExecutionRuntimeV1(host)
      .acquireViceLease("c64", liveSignal());
    expect(result).toMatchObject({ ok: false, issues: [{ code: "tier-unavailable" }] });
    expect(host.calls).toEqual(["platform"]);
  });

  it.each([
    ["wrong owner", { ...DIRECTORY, uid: 999 }],
    ["open permissions", { ...DIRECTORY, mode: 0o755 }],
    ["invalid link metadata", { ...DIRECTORY, links: 0 }],
  ])("rejects an untrusted lease directory: %s", async (_name, directory) => {
    const host = new FakeExecutionHost();
    host.snapshot = { kind: "absent", directory };
    const result = await requireApi()
      .createViceExecutionRuntimeV1(host)
      .acquireViceLease("c64", liveSignal());
    expect(result.ok).toBe(false);
    expect(host.calls).not.toContain("create");
  });

  it.each([1, 2, 276])(
    "accepts a trusted directory with positive raw link count %i",
    async (links) => {
      const host = new FakeExecutionHost();
      host.snapshot = { kind: "absent", directory: { ...DIRECTORY, links } };
      const result = await requireApi()
        .createViceExecutionRuntimeV1(host)
        .inspectViceLease("c64", liveSignal());
      expect(result.ok).toBe(true);
      expect(host.calls).not.toEqual(expect.arrayContaining(["create", "remove", "terminate"]));
    },
  );

  it("allows exactly one host-wide owner across independent runtimes", async () => {
    const host = new FakeExecutionHost();
    const first = await requireApi()
      .createViceExecutionRuntimeV1(host)
      .acquireViceLease("c64", liveSignal());
    const second = await requireApi()
      .createViceExecutionRuntimeV1(host)
      .acquireViceLease("c64", liveSignal());
    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);
    expect(host.calls.filter((call) => call === "create")).toHaveLength(1);
  });

  it("rejects an overlapping mutation on one coordinator instead of queueing it", async () => {
    const host = new FakeExecutionHost();
    let releaseObservation = (): void => undefined;
    host.observeGate = new Promise<void>((resolve) => {
      releaseObservation = resolve;
    });
    const runtime = requireApi().createViceExecutionRuntimeV1(host);
    const acquiring = runtime.acquireViceLease("c64", liveSignal());
    while (!host.calls.includes("observe")) await Promise.resolve();
    const overlapping = await runtime.inspectViceLease("c64", liveSignal());
    expect(overlapping).toMatchObject({
      ok: false,
      issues: [{ code: "execution.stale-authority" }],
    });
    releaseObservation();
    expect((await acquiring).ok).toBe(true);
  });

  it("rejects structural and foreign handles before endpoint or control access", async () => {
    const firstHost = new FakeExecutionHost();
    const secondHost = new FakeExecutionHost();
    const firstRuntime = requireApi().createViceExecutionRuntimeV1(firstHost);
    const secondRuntime = requireApi().createViceExecutionRuntimeV1(secondHost);
    const lease = await firstRuntime.acquireViceLease("c64", liveSignal());
    expect(lease.ok).toBe(true);
    if (!lease.ok) return;
    const forged = await firstRuntime.executeViceRoute(
      routeRequest(1),
      Object.freeze({}),
      liveSignal(),
    );
    const foreign = await secondRuntime.executeViceRoute(
      routeRequest(1),
      lease.value,
      liveSignal(),
    );
    expect([forged.status, foreign.status]).toEqual(["failure", "failure"]);
    expect(firstHost.calls).not.toContain("endpoints");
    expect(secondHost.calls).not.toContain("endpoints");
  });

  it("makes a genuine handle single-use even when its first execution fails", async () => {
    const host = new FakeExecutionHost();
    host.controlFailure = "emulator-launch-failure";
    const runtime = requireApi().createViceExecutionRuntimeV1(host);
    const lease = await runtime.acquireViceLease("c64", liveSignal());
    expect(lease.ok).toBe(true);
    if (!lease.ok) return;
    await runtime.executeViceRoute(routeRequest(1), lease.value, liveSignal());
    const controls = host.calls.filter((call) => call === "control").length;
    const second = await runtime.executeViceRoute(routeRequest(1), lease.value, liveSignal());
    expect(second.status).toBe("failure");
    expect(host.calls.filter((call) => call === "control")).toHaveLength(controls);
  });

  it("does not let later host mutation rewrite an acquired handle's authority", async () => {
    const host = new FakeExecutionHost();
    const runtime = requireApi().createViceExecutionRuntimeV1(host);
    const lease = await runtime.acquireViceLease("c64", liveSignal());
    expect(lease.ok).toBe(true);
    expect(host.capturedCreateBytes).toBeDefined();
    host.capturedCreateBytes?.fill(0xff);
    if (!lease.ok) return;
    const result = await runtime.executeViceRoute(routeRequest(1), lease.value, liveSignal());
    expect(result.code).not.toBe("execution.stale-authority");
  });

  it("inspection is read-only and returns bounded recovery evidence", async () => {
    const host = new FakeExecutionHost();
    const runtime = requireApi().createViceExecutionRuntimeV1(host);
    const acquired = await runtime.acquireViceLease("c64", liveSignal());
    expect(acquired.ok).toBe(true);
    host.calls.length = 0;
    const inspected = await requireApi()
      .createViceExecutionRuntimeV1(host)
      .inspectViceLease("c64", liveSignal());
    expect(inspected).toMatchObject({
      ok: true,
      value: {
        generation: expect.any(Number),
        nonce: expect.any(String),
        evidenceDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
    });
    expect(host.calls).not.toEqual(
      expect.arrayContaining(["create", "replace", "remove", "terminate"]),
    );
  });

  it("clears only the exact inspected generation after positive child absence", async () => {
    const host = new FakeExecutionHost();
    const owner = requireApi().createViceExecutionRuntimeV1(host);
    expect((await owner.acquireViceLease("c64", liveSignal())).ok).toBe(true);
    const operator = requireApi().createViceExecutionRuntimeV1(host);
    const inspected = await operator.inspectViceLease("c64", liveSignal());
    expect(inspected.ok).toBe(true);
    if (!inspected.ok) return;
    expect(inspected.value.childAbsent).toBe(true);
    const wrong = await operator.clearViceLeaseGeneration(
      "c64",
      inspected.value.generation,
      `${inspected.value.nonce}x`,
      liveSignal(),
    );
    expect(wrong.ok).toBe(false);
    expect(host.snapshot.kind).toBe("present");
    const cleared = await operator.clearViceLeaseGeneration(
      "c64",
      inspected.value.generation,
      inspected.value.nonce,
      liveSignal(),
    );
    expect(cleared).toEqual({ ok: true, value: true });
    expect(host.snapshot.kind).toBe("absent");
  });

  it.each(["changed", "missing"] as const)(
    "retains the lease when guarded clear reports %s",
    async (kind) => {
      const host = new FakeExecutionHost();
      const owner = requireApi().createViceExecutionRuntimeV1(host);
      expect((await owner.acquireViceLease("c64", liveSignal())).ok).toBe(true);
      const operator = requireApi().createViceExecutionRuntimeV1(host);
      const inspected = await operator.inspectViceLease("c64", liveSignal());
      expect(inspected.ok).toBe(true);
      if (!inspected.ok) return;
      host.mutationOverride = { kind };
      const result = await operator.clearViceLeaseGeneration(
        "c64",
        inspected.value.generation,
        inspected.value.nonce,
        liveSignal(),
      );
      expect(result.ok).toBe(false);
      expect(host.snapshot.kind).toBe("present");
    },
  );

  it.each([
    ["file owner", { ...FILE, uid: 999 }],
    ["file permissions", { ...FILE, mode: 0o644 }],
    ["hard link", { ...FILE, links: 2 }],
    ["replaced inode", { ...FILE, inode: FILE.inode + 1n }],
  ])("fails closed for an untrusted present lease %s", async (_name, file) => {
    const host = new FakeExecutionHost();
    const bytes = encoder.encode("untrusted");
    host.snapshot = {
      kind: "present",
      directory: DIRECTORY,
      file,
      bytes,
      reference: {
        directory: DIRECTORY,
        file: _name === "replaced inode" ? FILE : file,
        bytesDigest: reference(bytes).bytesDigest,
      },
    };
    const result = await requireApi()
      .createViceExecutionRuntimeV1(host)
      .inspectViceLease("c64", liveSignal());
    expect(result.ok).toBe(false);
    expect(host.calls).not.toEqual(expect.arrayContaining(["remove", "terminate"]));
  });

  it("retains the lease when process identity cannot be read", async () => {
    const host = new FakeExecutionHost();
    const owner = requireApi().createViceExecutionRuntimeV1(host);
    expect((await owner.acquireViceLease("c64", liveSignal())).ok).toBe(true);
    host.processFailure = "execution.io";
    const result = await requireApi()
      .createViceExecutionRuntimeV1(host)
      .inspectViceLease("c64", liveSignal());
    expect(result.ok).toBe(false);
    expect(host.snapshot.kind).toBe("present");
    expect(host.calls).not.toContain("terminate");
  });

  it("treats a reused process identity as ambiguous without signalling it", async () => {
    const host = new FakeExecutionHost();
    const owner = requireApi().createViceExecutionRuntimeV1(host);
    expect((await owner.acquireViceLease("c64", liveSignal())).ok).toBe(true);
    host.processFact = {
      bootId: "different-boot",
      pid: 1,
      startTicks: 1n,
      processGroupId: 1,
      launchToken: Uint8Array.of(0),
    };
    const inspected = await requireApi()
      .createViceExecutionRuntimeV1(host)
      .inspectViceLease("c64", liveSignal());
    expect(inspected).toMatchObject({
      ok: true,
      value: { state: "ambiguous", childAbsent: false },
    });
    expect(host.calls).not.toContain("terminate");
  });

  it("does not signal when pre-signal lease revalidation changes", async () => {
    const host = new FakeExecutionHost();
    host.controlFailure = "emulator-launch-failure";
    host.termination = "lease-changed";
    const runtime = requireApi().createViceExecutionRuntimeV1(host);
    const lease = await runtime.acquireViceLease("c64", liveSignal());
    expect(lease.ok).toBe(true);
    if (!lease.ok) return;
    const result = await runtime.executeViceRoute(routeRequest(1), lease.value, liveSignal());
    expect(result.status).toBe("failure");
    expect(host.snapshot.kind).toBe("present");
  });

  it("uses at most eight fresh endpoint pairs under the route deadline", async () => {
    const host = new FakeExecutionHost();
    host.controlFailure = "emulator-handshake-failure";
    const runtime = requireApi().createViceExecutionRuntimeV1(host);
    const lease = await runtime.acquireViceLease("c64", liveSignal());
    expect(lease.ok).toBe(true);
    if (!lease.ok) return;
    const result = await runtime.executeViceRoute(routeRequest(1), lease.value, liveSignal());
    expect(host.endpoints).toHaveLength(8);
    expect(
      new Set(host.endpoints.flatMap((entry) => [entry.binaryPort, entry.textPort])).size,
    ).toBe(16);
    expect(result.usage.launchAttempts).toBe(8);
    expect(host.attempts).toHaveLength(8);
    expect(host.attempts.every((attempt) => attempt.launchToken.length === 32)).toBe(true);
    expect(host.attempts.map((attempt) => attempt.endpoints)).toEqual(host.endpoints);
  });

  it("does not retry when record-then-exec support is unavailable", async () => {
    const host = new FakeExecutionHost();
    host.controlFailure = "tier-unavailable";
    const runtime = requireApi().createViceExecutionRuntimeV1(host);
    const lease = await runtime.acquireViceLease("c64", liveSignal());
    expect(lease.ok).toBe(true);
    if (!lease.ok) return;
    const result = await runtime.executeViceRoute(routeRequest(1), lease.value, liveSignal());
    expect(result).toMatchObject({ status: "failure", code: "tier-unavailable" });
    expect(host.attempts).toHaveLength(1);
    expect(host.controls).toHaveLength(0);
  });

  it("cancellation performs no new ordinary work and still consumes the handle", async () => {
    const host = new FakeExecutionHost();
    const runtime = requireApi().createViceExecutionRuntimeV1(host);
    const lease = await runtime.acquireViceLease("c64", liveSignal());
    expect(lease.ok).toBe(true);
    if (!lease.ok) return;
    const controller = new AbortController();
    controller.abort();
    const cancelled = await runtime.executeViceRoute(
      routeRequest(1),
      lease.value,
      controller.signal,
    );
    expect(cancelled.status).toBe("failure");
    expect(host.calls).not.toContain("endpoints");
    const reused = await runtime.executeViceRoute(routeRequest(1), lease.value, liveSignal());
    expect(reused.status).toBe("failure");
    expect(host.calls).not.toContain("endpoints");
  });

  it.each([
    [65_535, [65_535]],
    [65_536, [65_535, 1]],
    [10_000_000, [...Array.from({ length: 152 }, () => 65_535), 38_680]],
  ])(
    "decomposes an instruction total of %i without wrap or truncation",
    async (total, expected) => {
      const host = new FakeExecutionHost();
      const runtime = requireApi().createViceExecutionRuntimeV1(host);
      const lease = await runtime.acquireViceLease("c64", liveSignal());
      expect(lease.ok).toBe(true);
      if (!lease.ok) return;
      const executing = runtime.executeViceRoute(routeRequest(total), lease.value, liveSignal());
      while (host.controls.length === 0) await Promise.resolve();
      host.controls[0].hitAfter = expected.length;
      await executing;
      expect(host.controls[0].instructionCounts).toEqual(expected);
    },
  );

  it("accepts completion only for the exact STORE checkpoint and committed marker", async () => {
    const host = new FakeExecutionHost();
    const runtime = requireApi().createViceExecutionRuntimeV1(host);
    const lease = await runtime.acquireViceLease("c64", liveSignal());
    expect(lease.ok).toBe(true);
    if (!lease.ok) return;
    const executing = runtime.executeViceRoute(routeRequest(1), lease.value, liveSignal());
    while (host.controls.length === 0) await Promise.resolve();
    host.controls[0].hitAfter = 1;
    const result = await executing;
    expect(result.status).toBe("pass");
    expect(host.controls[0].instructionCounts).toEqual([1]);
  });

  it("rejects a checkpoint whose completion marker did not commit", async () => {
    const host = new FakeExecutionHost();
    const runtime = requireApi().createViceExecutionRuntimeV1(host);
    const lease = await runtime.acquireViceLease("c64", liveSignal());
    expect(lease.ok).toBe(true);
    if (!lease.ok) return;
    const executing = runtime.executeViceRoute(routeRequest(1), lease.value, liveSignal());
    while (host.controls.length === 0) await Promise.resolve();
    host.controls[0].hitAfter = 1;
    host.controls[0].completionByte = 0;
    const result = await executing;
    expect(result).toMatchObject({ status: "failure", code: "semantic-mismatch" });
  });

  it("charges the full requested chunk before a terminal non-hit", async () => {
    const host = new FakeExecutionHost();
    const runtime = requireApi().createViceExecutionRuntimeV1(host);
    const lease = await runtime.acquireViceLease("c64", liveSignal());
    expect(lease.ok).toBe(true);
    if (!lease.ok) return;
    const result = await runtime.executeViceRoute(routeRequest(65_535), lease.value, liveSignal());
    expect(result).toMatchObject({
      status: "failure",
      code: "instruction-exhaustion",
      usage: { instructions: 65_535 },
    });
    expect(host.controls[0].instructionCounts).toEqual([65_535]);
  });

  it("keeps the package dependency direction acyclic", async () => {
    requireApi();
    const [executionManifest, harnessManifest] = await Promise.all([
      readFile(new URL("../package.json", import.meta.url), "utf8"),
      readFile(new URL("../../test-harness/package.json", import.meta.url), "utf8"),
    ]);
    expect(executionManifest).toContain('"@blend65/test-harness"');
    expect(harnessManifest).not.toContain('"@blend65/readiness-execution"');
  });
});
