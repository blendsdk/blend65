import { createHash } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { projectC64InitialStateV1 } from "@blend65/readiness";

import {
  createRuntimeAcceptanceFixture,
  type GenuineRuntimeAcceptanceCase,
  type RuntimeAcceptanceFixture,
} from "./test-fixtures/execution-runtime-acceptance-spec-fixture.js";
import type {
  ExecutionCaseV1,
  ExecutionInitialStateFixtureV1,
  ExecutionObservationLayoutV1,
  ExecutionObservationRequestV1,
  ExecutionOperationResultV1,
  ExecutionPolicyV1,
  ExecutionResultV1,
  PublishedOracleContext,
} from "@blend65/readiness";
import type {
  ViceControlHostV1,
  ViceControlOwnedChildV1,
  ViceControlRawChannelV1,
  ViceControlResultV1,
} from "@blend65/test-harness/vice-control";
import type {
  ViceExecutionHostV1,
  ViceLeaseHandleV1,
  ViceLeaseMutationV1,
  ViceLeaseNodeIdentityV1,
  ViceLeaseReferenceV1,
  ViceLeaseSnapshotV1,
  ViceLoopbackEndpointsV1,
  ViceProcessIdentityFactV1,
  ViceRecordedAttemptV1,
  ViceRouteRequestV1,
  ViceTerminationRequestV1,
} from "./index.js";

type OracleResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly [] }
  | {
      readonly ok: false;
      readonly diagnostics: readonly {
        readonly code: string;
        readonly path: string;
        readonly message: string;
      }[];
    };

interface RuntimeEvaluationProjection {
  readonly schemaVersion: 1;
  readonly sourceCaseDigest: string;
  readonly fixture: ExecutionInitialStateFixtureV1;
  readonly observation: ExecutionObservationRequestV1;
  readonly selectedReleaseDigest: string;
  readonly evaluationIdentity: string;
}

interface RuntimeEvaluationDecision {
  readonly revision: "published-runtime-evaluation-v1";
  readonly outcome: "match" | "semantic-mismatch";
  readonly evaluationIdentity: string;
}

interface ReadinessRuntimeApi {
  createPublishedRuntimeEvaluationAuthorityV1(
    context: PublishedOracleContext,
    executionCase: ExecutionCaseV1,
  ): OracleResult<object>;
  getPublishedRuntimeEvaluationProjectionV1(
    authority: object,
  ): OracleResult<RuntimeEvaluationProjection>;
  evaluatePublishedRuntimeObservationV1(
    authority: object,
    actual: unknown,
  ): OracleResult<RuntimeEvaluationDecision>;
}

interface EvaluatedRouteRequest {
  readonly route: ViceRouteRequestV1;
  readonly evaluation: object;
}

interface ViceRuntime {
  acquireViceLease(
    target: "c64",
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceLeaseHandleV1>>;
  executeEvaluatedViceRoute(
    request: EvaluatedRouteRequest,
    lease: ViceLeaseHandleV1,
    signal: AbortSignal,
  ): Promise<ExecutionResultV1>;
}

interface ExecutionRuntimeApi {
  createViceExecutionRuntimeV1(host?: ViceExecutionHostV1): ViceRuntime;
  executeEvaluatedViceRouteV1(
    request: EvaluatedRouteRequest,
    lease: ViceLeaseHandleV1,
    signal: AbortSignal,
  ): Promise<ExecutionResultV1>;
}

const DIRECTORY: ViceLeaseNodeIdentityV1 = {
  device: 7n,
  inode: 11n,
  uid: 1000,
  mode: 0o700,
  links: 2,
};
const FILE: ViceLeaseNodeIdentityV1 = {
  device: 7n,
  inode: 12n,
  uid: 1000,
  mode: 0o600,
  links: 1,
};
const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();
const POLICY: ExecutionPolicyV1 = {
  revision: "execution-policy-v1",
  budget: {
    operationMs: 60_000,
    launchAttemptMs: 15_000,
    routeMs: 120_000,
    cleanupGraceMs: 3_000,
    outputBytes: 1_048_576,
    evidenceBytes: 16_777_216,
    instructions: 65_535,
    cycles: 100_000_000,
    launchAttempts: 8,
  },
};

function liveSignal(): AbortSignal {
  return new AbortController().signal;
}

function operationOk<T>(value: T): ExecutionOperationResultV1<T> {
  return { ok: true, value };
}

function controlOk<T>(value: T): ViceControlResultV1<T> {
  return { ok: true, value };
}

function leaseReference(bytes: Uint8Array): ViceLeaseReferenceV1 {
  return {
    directory: DIRECTORY,
    file: FILE,
    bytesDigest: createHash("sha256").update(bytes).digest("hex"),
  };
}

function presentLease(bytes: Uint8Array): ViceLeaseSnapshotV1 {
  const owned = Uint8Array.from(bytes);
  return {
    kind: "present",
    directory: DIRECTORY,
    file: FILE,
    bytes: owned,
    reference: leaseReference(owned),
  };
}

interface SpecLeaseProcessRecord {
  readonly bootId: string;
  readonly pid: number;
  readonly startTicks: string;
  readonly processGroupId: number;
  readonly launchToken: string | null;
  readonly launchTokenPath: string | null;
}

interface SpecLeaseAttemptRecord {
  readonly launchToken: string;
  readonly binaryPort: number;
  readonly textPort: number;
  readonly launchTokenPath: string;
}

interface SpecLeaseRecordPayload {
  readonly schema: "blend65-vice-lease-v1";
  readonly target: "c64";
  readonly generation: number;
  readonly nonce: string;
  readonly uid: number;
  readonly acquiredAtMs: number;
  readonly updatedAtMs: number;
  readonly lifecycle: "acquired" | "attempt-recorded" | "child-recorded";
  readonly owner: SpecLeaseProcessRecord | null;
  readonly attempt: SpecLeaseAttemptRecord | null;
  readonly child: SpecLeaseProcessRecord | null;
}

interface SpecLeaseRecord extends SpecLeaseRecordPayload {
  readonly checksum: string;
}

function encodeSpecLeaseRecord(payload: SpecLeaseRecordPayload): Uint8Array {
  const orderedPayload: SpecLeaseRecordPayload = {
    schema: payload.schema,
    target: payload.target,
    generation: payload.generation,
    nonce: payload.nonce,
    uid: payload.uid,
    acquiredAtMs: payload.acquiredAtMs,
    updatedAtMs: payload.updatedAtMs,
    lifecycle: payload.lifecycle,
    owner: payload.owner,
    attempt: payload.attempt,
    child: payload.child,
  };
  const payloadBytes = ENCODER.encode(JSON.stringify(orderedPayload));
  const checksum = createHash("sha256").update(payloadBytes).digest("hex");
  return ENCODER.encode(JSON.stringify({ ...orderedPayload, checksum }));
}

function decodeSpecLeaseRecord(bytes: Uint8Array): SpecLeaseRecord {
  const parsed = JSON.parse(DECODER.decode(bytes)) as SpecLeaseRecord;
  const payload: SpecLeaseRecordPayload = {
    schema: parsed.schema,
    target: parsed.target,
    generation: parsed.generation,
    nonce: parsed.nonce,
    uid: parsed.uid,
    acquiredAtMs: parsed.acquiredAtMs,
    updatedAtMs: parsed.updatedAtMs,
    lifecycle: parsed.lifecycle,
    owner: parsed.owner,
    attempt: parsed.attempt,
    child: parsed.child,
  };
  if (!Buffer.from(encodeSpecLeaseRecord(payload)).equals(Buffer.from(bytes))) {
    throw new TypeError("lease record is not canonical");
  }
  return parsed;
}

function referencesEqual(left: ViceLeaseReferenceV1, right: ViceLeaseReferenceV1): boolean {
  return (
    left.bytesDigest === right.bytesDigest &&
    left.directory.device === right.directory.device &&
    left.directory.inode === right.directory.inode &&
    left.file.device === right.file.device &&
    left.file.inode === right.file.inode
  );
}

function u16(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
}

function u32(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, value >>> 24);
}

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
  );
}

function response(
  type: number,
  requestId: number,
  body: Uint8Array<ArrayBufferLike> = new Uint8Array(),
): Uint8Array {
  return Uint8Array.of(2, 2, ...u32(body.length), type, 0, ...u32(requestId), ...body);
}

function checkpointBody(address: number, operation = 2): Uint8Array {
  return Uint8Array.of(
    ...u32(9),
    1,
    ...u16(address),
    ...u16(address),
    1,
    1,
    operation,
    0,
    ...u32(1),
  );
}

interface MonitorScenario {
  readonly route: ViceRouteRequestV1;
  readonly actualBytes: Uint8Array;
  readonly fixtureMismatch?: boolean;
  readonly checkpointAddress?: number;
  readonly checkpointOperation?: number;
  readonly completionByte?: number;
  readonly hit?: boolean;
  readonly stopwatch?: readonly bigint[];
  readonly wallStepMs?: number;
  readonly abortOnAdvance?: AbortController;
}

class RuntimeControlHost implements ViceControlHostV1 {
  readonly events: string[] = [];
  readonly instructionCounts: number[] = [];
  readonly returnedReads: Uint8Array[] = [];
  readonly stopwatchSamples: bigint[];
  private readonly binaryReads: Uint8Array[] = [];
  private readonly textReads: Uint8Array[] = [];
  private readonly memory = new Map<number, number>();
  private fixtureReadMutated = false;

  constructor(
    private readonly scenario: MonitorScenario,
    private readonly onSpawn: () => ViceControlOwnedChildV1,
    private readonly onAdvance: () => void = () => undefined,
  ) {
    this.stopwatchSamples = [...(scenario.stopwatch ?? [0n, 100n, 160n])];
  }

  nowMilliseconds(): number {
    return 0;
  }

  async delay(_milliseconds: number, signal: AbortSignal): Promise<"elapsed" | "aborted"> {
    return signal.aborted ? "aborted" : "elapsed";
  }

  async spawn(): Promise<ViceControlResultV1<ViceControlOwnedChildV1>> {
    this.events.push("spawn");
    return controlOk(this.onSpawn());
  }

  async connectLoopback(
    role: "binary" | "text",
  ): Promise<ViceControlResultV1<ViceControlRawChannelV1>> {
    this.events.push(`connect:${role}`);
    return controlOk(role === "binary" ? this.binaryChannel() : this.textChannel());
  }

  async endpointBelongsToChild(
    _child: ViceControlOwnedChildV1,
    role: "binary" | "text",
  ): Promise<ViceControlResultV1<boolean>> {
    this.events.push(`owner:${role}`);
    return controlOk(true);
  }

  async closeOwnedChild(): Promise<ViceControlResultV1<true>> {
    this.events.push("close-child");
    return controlOk(true);
  }

  private binaryChannel(): ViceControlRawChannelV1 {
    return {
      write: async (bytes) => {
        this.handleBinary(bytes);
        return controlOk(true);
      },
      read: async () => controlOk(this.binaryReads.shift() ?? null),
      close: async () => {
        this.events.push("close:binary");
        return controlOk(true);
      },
    };
  }

  private textChannel(): ViceControlRawChannelV1 {
    return {
      write: async () => {
        const sample = this.stopwatchSamples.shift() ?? 160n;
        this.events.push(`stopwatch:${sample.toString()}`);
        this.textReads.push(ENCODER.encode(`Stopwatch: ${sample.toString()}\n(C:$e5cf) `));
        return controlOk(true);
      },
      read: async () => controlOk(this.textReads.shift() ?? null),
      close: async () => {
        this.events.push("close:text");
        return controlOk(true);
      },
    };
  }

  private handleBinary(frame: Uint8Array): void {
    const requestId = readU32(frame, 6);
    const type = frame[10]!;
    const body = frame.slice(11);
    if (type === 0x83) {
      const names = ["A", "X", "Y", "SP", "PC", "FL"];
      const items = names.flatMap((name, id) => [
        3 + name.length,
        id,
        name === "PC" ? 16 : 8,
        name.length,
        ...ENCODER.encode(name),
      ]);
      this.binaryReads.push(
        response(type, requestId, Uint8Array.of(...u16(names.length), ...items)),
      );
      return;
    }
    if (type === 0x85) {
      this.binaryReads.push(response(type, requestId, Uint8Array.of(4, 3, 10, 0, 0)));
      return;
    }
    if (type === 0x51) {
      this.binaryReads.push(response(type, requestId, Uint8Array.of(1, 1, 0)));
      return;
    }
    if (type === 0x02) {
      const start = readU16(body, 1);
      const bytes = body.slice(8);
      for (const [index, byte] of bytes.entries()) {
        const address = start + index;
        const fixtureCell = this.scenario.route.fixture.cells.find(
          (cell) => cell.address === address,
        );
        if (fixtureCell === undefined) {
          this.memory.set(address, byte);
          continue;
        }
        const projected = projectC64InitialStateV1(address, byte);
        if (!projected.ok) throw new TypeError("fixture projection failed");
        this.memory.set(address, projected.value);
      }
      this.events.push(`write:${start.toString(16)}:${Buffer.from(bytes).toString("hex")}`);
      this.binaryReads.push(response(type, requestId));
      return;
    }
    if (type === 0x01) {
      const start = readU16(body, 1);
      const end = readU16(body, 3);
      const data = Uint8Array.from(
        { length: end - start + 1 },
        (_, index) => this.memory.get(start + index) ?? 0,
      );
      if (
        this.scenario.fixtureMismatch === true &&
        !this.fixtureReadMutated &&
        this.scenario.route.fixture.cells.some(({ address }) => address === start)
      ) {
        data[0] = data[0]! ^ 1;
        this.fixtureReadMutated = true;
      }
      this.returnedReads.push(data);
      this.events.push(`read:${start.toString(16)}:${end.toString(16)}`);
      this.binaryReads.push(response(type, requestId, Uint8Array.of(...u16(data.length), ...data)));
      return;
    }
    if (type === 0x32) {
      this.events.push(`entry:${this.scenario.route.entryAddress.toString(16)}`);
      this.binaryReads.push(response(0x31, requestId, Uint8Array.of(1, 0, 3, 4, 0x10, 0x08)));
      return;
    }
    if (type === 0x12) {
      this.events.push(`checkpoint:${readU16(body, 0).toString(16)}`);
      this.binaryReads.push(response(0x11, requestId, checkpointBody(readU16(body, 0))));
      return;
    }
    if (type === 0x71) {
      const count = readU16(body, 1);
      this.instructionCounts.push(count);
      this.onAdvance();
      this.scenario.abortOnAdvance?.abort();
      if (this.scenario.hit !== false) {
        this.commitActual();
        const address =
          this.scenario.checkpointAddress ?? this.scenario.route.layout.completionAddress;
        const operation = this.scenario.checkpointOperation ?? 2;
        this.binaryReads.push(response(0x11, 0xffffffff, checkpointBody(address, operation)));
      }
      this.binaryReads.push(response(type, requestId));
      this.binaryReads.push(response(0x62, 0xffffffff));
      return;
    }
    this.binaryReads.push(response(type, requestId));
  }

  private commitActual(): void {
    const { route, actualBytes } = this.scenario;
    const firstAddress =
      route.observation.kind === "direct-mmio"
        ? route.observation.address!
        : route.layout.resultAddresses[0]!;
    for (const [index, byte] of actualBytes.entries()) this.memory.set(firstAddress + index, byte);
    this.memory.set(route.layout.completionAddress, this.scenario.completionByte ?? 0xa5);
  }
}

class RuntimeExecutionHost implements ViceExecutionHostV1 {
  readonly calls: string[] = [];
  readonly controls: RuntimeControlHost[] = [];
  readonly attempts: ViceRecordedAttemptV1[] = [];
  snapshot: ViceLeaseSnapshotV1 = { kind: "absent", directory: DIRECTORY };
  now = 0;
  private liveProcess: ViceProcessIdentityFactV1 | null = null;

  constructor(private readonly scenario: MonitorScenario) {}

  async platform(): Promise<ExecutionOperationResultV1<"linux" | "unsupported">> {
    this.calls.push("platform");
    return operationOk("linux");
  }

  async effectiveUid(): Promise<ExecutionOperationResultV1<number>> {
    this.calls.push("uid");
    return operationOk(1000);
  }

  nowMonotonicMilliseconds(): number {
    return this.now;
  }

  async delay(_milliseconds: number, signal: AbortSignal): Promise<"elapsed" | "aborted"> {
    return signal.aborted ? "aborted" : "elapsed";
  }

  randomBytes(byteLength: 32): Uint8Array {
    return Uint8Array.from({ length: byteLength }, (_, index) => index + 1);
  }

  async observeLease(): Promise<ExecutionOperationResultV1<ViceLeaseSnapshotV1>> {
    this.calls.push("observe");
    return operationOk(this.snapshot);
  }

  async tryCreateLease(
    _target: "c64",
    _expectedDirectory: ViceLeaseNodeIdentityV1,
    bytes: Uint8Array,
  ): Promise<ExecutionOperationResultV1<ViceLeaseMutationV1>> {
    this.calls.push("create");
    this.snapshot = presentLease(bytes);
    return operationOk({ kind: "created", snapshot: this.snapshot });
  }

  async compareReplaceLease(
    _target: "c64",
    _expected: ViceLeaseReferenceV1,
    bytes: Uint8Array,
  ): Promise<ExecutionOperationResultV1<ViceLeaseMutationV1>> {
    this.calls.push("replace");
    this.snapshot = presentLease(bytes);
    return operationOk({ kind: "replaced", snapshot: this.snapshot });
  }

  async compareRemoveLease(
    _target: "c64",
    expected: ViceLeaseReferenceV1,
  ): Promise<ExecutionOperationResultV1<ViceLeaseMutationV1>> {
    this.calls.push("remove");
    if (this.snapshot.kind !== "present") return operationOk({ kind: "missing" });
    if (!referencesEqual(this.snapshot.reference, expected))
      return operationOk({ kind: "changed" });
    if (this.liveProcess !== null) return operationOk({ kind: "occupied" });
    this.snapshot = { kind: "absent", directory: DIRECTORY };
    return operationOk({ kind: "removed" });
  }

  async observeProcess(
    pid: number,
    _signal: AbortSignal,
    launchTokenPath?: string,
  ): Promise<ExecutionOperationResultV1<ViceProcessIdentityFactV1 | null>> {
    const process = this.liveProcess;
    return operationOk(
      process?.pid === pid &&
        (launchTokenPath === undefined || process.launchTokenPath === launchTokenPath)
        ? structuredClone(process)
        : null,
    );
  }

  async allocateLoopbackEndpoints(): Promise<ExecutionOperationResultV1<ViceLoopbackEndpointsV1>> {
    this.calls.push("endpoints");
    return operationOk({ binaryPort: 20_002, textPort: 20_003 });
  }

  async createControlAttempt(
    attempt: ViceRecordedAttemptV1,
  ): Promise<ExecutionOperationResultV1<ViceControlHostV1>> {
    this.calls.push("control");
    this.attempts.push(attempt);
    const control = new RuntimeControlHost(
      this.scenario,
      () => this.recordSpawnedChild(attempt),
      () => {
        this.now += this.scenario.wallStepMs ?? 0;
      },
    );
    this.controls.push(control);
    return operationOk(control);
  }

  async revalidateAndTerminateVice(
    request: ViceTerminationRequestV1,
  ): Promise<
    ExecutionOperationResultV1<
      "signalled" | "already-exited" | "lease-changed" | "identity-changed"
    >
  > {
    this.calls.push("terminate");
    if (
      this.snapshot.kind !== "present" ||
      !referencesEqual(this.snapshot.reference, request.lease)
    )
      return operationOk("lease-changed");
    const record = decodeSpecLeaseRecord(this.snapshot.bytes);
    const process = this.liveProcess;
    const durableChild = record.child;
    if (
      process === null ||
      durableChild === null ||
      record.generation !== request.generation ||
      record.nonce !== request.nonce ||
      process.bootId !== request.process.bootId ||
      process.pid !== request.process.pid ||
      process.startTicks !== request.process.startTicks ||
      process.processGroupId !== request.process.processGroupId ||
      process.launchTokenPath !== request.process.launchTokenPath ||
      !Buffer.from(process.launchToken ?? []).equals(
        Buffer.from(request.process.launchToken ?? []),
      ) ||
      durableChild.bootId !== request.process.bootId ||
      durableChild.pid !== request.process.pid ||
      durableChild.startTicks !== request.process.startTicks.toString() ||
      durableChild.processGroupId !== request.process.processGroupId ||
      durableChild.launchTokenPath !== request.process.launchTokenPath ||
      durableChild.launchToken !== Buffer.from(request.process.launchToken ?? []).toString("hex")
    ) {
      return operationOk("identity-changed");
    }
    this.liveProcess = null;
    return operationOk("signalled");
  }

  private recordSpawnedChild(attempt: ViceRecordedAttemptV1): ViceControlOwnedChildV1 {
    if (
      this.snapshot.kind !== "present" ||
      !referencesEqual(this.snapshot.reference, attempt.claim)
    )
      throw new TypeError("spawn claim does not match the live lease");
    const record = decodeSpecLeaseRecord(this.snapshot.bytes);
    const recordedAttempt = record.attempt;
    const launchToken = Buffer.from(attempt.launchToken).toString("hex");
    if (
      record.lifecycle !== "attempt-recorded" ||
      record.generation !== attempt.generation ||
      record.nonce !== attempt.nonce ||
      recordedAttempt === null ||
      recordedAttempt.launchToken !== launchToken ||
      recordedAttempt.binaryPort !== attempt.endpoints.binaryPort ||
      recordedAttempt.textPort !== attempt.endpoints.textPort ||
      recordedAttempt.launchTokenPath !== attempt.launchTokenPath
    ) {
      throw new TypeError("spawn attempt does not match the durable lease");
    }
    const process: ViceProcessIdentityFactV1 = {
      bootId: "runtime-acceptance-boot",
      pid: 6502,
      startTicks: 100n,
      processGroupId: 6502,
      launchToken: Uint8Array.from(attempt.launchToken),
      launchTokenPath: attempt.launchTokenPath,
    };
    const child: SpecLeaseProcessRecord = {
      bootId: process.bootId,
      pid: process.pid,
      startTicks: process.startTicks.toString(),
      processGroupId: process.processGroupId,
      launchToken,
      launchTokenPath: recordedAttempt.launchTokenPath,
    };
    const bytes = encodeSpecLeaseRecord({
      schema: record.schema,
      target: record.target,
      generation: record.generation,
      nonce: record.nonce,
      uid: record.uid,
      acquiredAtMs: record.acquiredAtMs,
      updatedAtMs: this.now,
      lifecycle: "child-recorded",
      owner: record.owner,
      attempt: recordedAttempt,
      child,
    });
    this.snapshot = presentLease(bytes);
    this.liveProcess = process;
    return { identity: "owned-child", exited: new Promise(() => undefined) };
  }
}

function layoutFor(entry: GenuineRuntimeAcceptanceCase): ExecutionObservationLayoutV1 {
  const scalar = entry.fixed.observation.kind === "scalar-bytes";
  const resultAddresses = scalar
    ? Array.from({ length: entry.fixed.observation.byteLength }, (_, index) => 0x2000 + index)
    : [];
  const completionAddress = 0x2004;
  return {
    revision: "execution-observation-layout-v1",
    resultSymbols: resultAddresses.map((_, index) => `result-${index}`),
    resultAddresses,
    completionSymbol: "completion",
    completionAddress,
    postEntryStores: [
      ...resultAddresses.map((address, index) => ({
        instructionAddress: 0x0812 + index * 3,
        targetAddress: address,
        kind: "observation-byte" as const,
        byteIndex: index as 0 | 1,
      })),
      {
        instructionAddress: 0x0820,
        targetAddress: completionAddress,
        kind: "completion" as const,
        value: 165 as const,
      },
    ],
    proofDigest: "a".repeat(64),
  };
}

function routeFor(
  entry: GenuineRuntimeAcceptanceCase,
  projection: RuntimeEvaluationProjection,
  policy: ExecutionPolicyV1 = POLICY,
): ViceRouteRequestV1 {
  return {
    binary: Uint8Array.of(0x60),
    loadAddress: 0x0801,
    entryAddress: 0x0810,
    fixture: structuredClone(projection.fixture),
    layout: layoutFor(entry),
    observation: structuredClone(projection.observation),
    policy,
  };
}

function requireOracleValue<T>(result: OracleResult<T>): T {
  if (!result.ok) throw new TypeError(JSON.stringify(result.diagnostics));
  expect(result.ok).toBe(true);
  return result.value;
}

function retireRuntimeEvaluationAuthority(authority: object): void {
  requireReadinessApi().evaluatePublishedRuntimeObservationV1(authority, null);
}

async function acquire(runtime: ViceRuntime): Promise<ViceLeaseHandleV1> {
  const result = await runtime.acquireViceLease("c64", liveSignal());
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError(JSON.stringify(result.issues));
  return result.value;
}

let readinessApi: ReadinessRuntimeApi | undefined;
let executionApi: ExecutionRuntimeApi | undefined;
let fixturePromise: Promise<RuntimeAcceptanceFixture> | undefined;

function requireReadinessApi(): ReadinessRuntimeApi {
  if (readinessApi === undefined)
    throw new TypeError("Missing runtime evaluation authority exports");
  return readinessApi;
}

function requireExecutionApi(): ExecutionRuntimeApi {
  if (executionApi === undefined) throw new TypeError("Missing evaluated VICE runtime exports");
  return executionApi;
}

function runtimeFixture(): Promise<RuntimeAcceptanceFixture> {
  fixturePromise ??= createRuntimeAcceptanceFixture();
  return fixturePromise;
}

beforeAll(async () => {
  const readiness = await vi.importActual<Partial<ReadinessRuntimeApi>>("@blend65/readiness");
  const execution = await vi.importActual<Partial<ExecutionRuntimeApi>>("./index.js");
  if (
    typeof readiness.createPublishedRuntimeEvaluationAuthorityV1 === "function" &&
    typeof readiness.getPublishedRuntimeEvaluationProjectionV1 === "function" &&
    typeof readiness.evaluatePublishedRuntimeObservationV1 === "function"
  ) {
    readinessApi = readiness as ReadinessRuntimeApi;
  }
  if (
    typeof execution.createViceExecutionRuntimeV1 === "function" &&
    typeof execution.executeEvaluatedViceRouteV1 === "function"
  ) {
    executionApi = execution as ExecutionRuntimeApi;
  }
});

afterAll(async () => {
  if (fixturePromise !== undefined) {
    const fixture = await fixturePromise;
    await fixture.cleanup();
  }
});

describe("evaluated C64 runtime acceptance", () => {
  it("exports the opaque authority and evaluated runtime entrypoints", () => {
    expect(requireReadinessApi()).toEqual(
      expect.objectContaining({
        createPublishedRuntimeEvaluationAuthorityV1: expect.any(Function),
        getPublishedRuntimeEvaluationProjectionV1: expect.any(Function),
        evaluatePublishedRuntimeObservationV1: expect.any(Function),
      }),
    );
    expect(requireExecutionApi()).toEqual(
      expect.objectContaining({
        createViceExecutionRuntimeV1: expect.any(Function),
        executeEvaluatedViceRouteV1: expect.any(Function),
      }),
    );
  });

  it("keeps the fixed host answers out of generated source and passive authority evidence", async () => {
    const fixture = await runtimeFixture();
    for (const entry of fixture.cases) {
      const authority = requireOracleValue(
        requireReadinessApi().createPublishedRuntimeEvaluationAuthorityV1(
          fixture.context,
          entry.executionCase,
        ),
      );
      const projection = requireOracleValue(
        requireReadinessApi().getPublishedRuntimeEvaluationProjectionV1(authority),
      );
      expect(Object.keys(projection).sort()).toEqual([
        "evaluationIdentity",
        "fixture",
        "observation",
        "schemaVersion",
        "selectedReleaseDigest",
        "sourceCaseDigest",
      ]);
      expect(DECODER.decode(entry.projection.sourceBytes)).not.toMatch(
        /oracle|expected|0xF0|\b240\b/iu,
      );
      expect(projection).not.toHaveProperty("expected");
      expect(projection).not.toHaveProperty("actual");
      retireRuntimeEvaluationAuthority(authority);
    }
  });

  it("loads the binary, proves the fixture before entry, and accepts all four fixed cases", async () => {
    const fixture = await runtimeFixture();
    for (const entry of fixture.cases) {
      const authority = requireOracleValue(
        requireReadinessApi().createPublishedRuntimeEvaluationAuthorityV1(
          fixture.context,
          entry.executionCase,
        ),
      );
      const projection = requireOracleValue(
        requireReadinessApi().getPublishedRuntimeEvaluationProjectionV1(authority),
      );
      const route = routeFor(entry, projection);
      const host = new RuntimeExecutionHost({
        route,
        actualBytes: Uint8Array.from(entry.fixed.expectedBytes),
      });
      const runtime = requireExecutionApi().createViceExecutionRuntimeV1(host);
      const result = await runtime.executeEvaluatedViceRoute(
        { route, evaluation: authority },
        await acquire(runtime),
        liveSignal(),
      );
      expect(result).toMatchObject({
        status: "pass",
        code: "pass",
        tier: "vice",
        stage: "compare",
        usage: { instructions: 65_535, cycles: 60 },
      });
      expect(host.controls[0]?.events).toEqual(
        expect.arrayContaining([
          "write:801:60",
          "entry:810",
          "checkpoint:2004",
          "stopwatch:100",
          "stopwatch:160",
        ]),
      );
      expect(host.controls[0]?.instructionCounts).toEqual([65_535]);
      expect(host.calls).toEqual(expect.arrayContaining(["terminate", "remove"]));
      expect(Object.keys(result).sort()).toEqual([
        "code",
        "evidence",
        "stage",
        "status",
        "tier",
        "usage",
      ]);
      expect(result).not.toHaveProperty("actual");
      expect(result).not.toHaveProperty("expected");
      expect(result.evidence).toEqual({
        digest: expect.stringMatching(/^[0-9a-f]{64}$/u),
        retainedBytes: expect.any(Number),
        truncated: false,
      });
    }
  });

  it("rejects fixture mismatch before setting the entry point", async () => {
    const fixture = await runtimeFixture();
    const entry = fixture.cases[0]!;
    const authority = requireOracleValue(
      requireReadinessApi().createPublishedRuntimeEvaluationAuthorityV1(
        fixture.context,
        entry.executionCase,
      ),
    );
    const projection = requireOracleValue(
      requireReadinessApi().getPublishedRuntimeEvaluationProjectionV1(authority),
    );
    const route = routeFor(entry, projection);
    const host = new RuntimeExecutionHost({
      route,
      actualBytes: entry.fixed.expectedBytes,
      fixtureMismatch: true,
    });
    const runtime = requireExecutionApi().createViceExecutionRuntimeV1(host);
    const result = await runtime.executeEvaluatedViceRoute(
      { route, evaluation: authority },
      await acquire(runtime),
      liveSignal(),
    );
    expect(result).toMatchObject({
      status: "failure",
      code: "invalid-evidence-input",
      stage: "fixture",
    });
    expect(host.controls[0]?.events.some((event) => event.startsWith("entry:"))).toBe(false);
    expect(host.calls).toEqual(expect.arrayContaining(["terminate", "remove"]));
    retireRuntimeEvaluationAuthority(authority);
  });

  it("requires the exact STORE checkpoint and committed completion marker", async () => {
    const fixture = await runtimeFixture();
    for (const mutation of [
      { checkpointOperation: 1 },
      { checkpointAddress: 0x2005 },
      { completionByte: 0 },
    ]) {
      const entry = fixture.cases[0]!;
      const authority = requireOracleValue(
        requireReadinessApi().createPublishedRuntimeEvaluationAuthorityV1(
          fixture.context,
          entry.executionCase,
        ),
      );
      const projection = requireOracleValue(
        requireReadinessApi().getPublishedRuntimeEvaluationProjectionV1(authority),
      );
      const route = routeFor(entry, projection);
      const host = new RuntimeExecutionHost({
        route,
        actualBytes: entry.fixed.expectedBytes,
        ...mutation,
      });
      const runtime = requireExecutionApi().createViceExecutionRuntimeV1(host);
      const result = await runtime.executeEvaluatedViceRoute(
        { route, evaluation: authority },
        await acquire(runtime),
        liveSignal(),
      );
      expect(result).toMatchObject({ status: "failure", code: "semantic-mismatch" });
      retireRuntimeEvaluationAuthority(authority);
    }
  });

  it("maps a wrong actual byte to a semantic mismatch through one consumed authority", async () => {
    const fixture = await runtimeFixture();
    const entry = fixture.cases[0]!;
    const authority = requireOracleValue(
      requireReadinessApi().createPublishedRuntimeEvaluationAuthorityV1(
        fixture.context,
        entry.executionCase,
      ),
    );
    const projection = requireOracleValue(
      requireReadinessApi().getPublishedRuntimeEvaluationProjectionV1(authority),
    );
    const route = routeFor(entry, projection);
    const host = new RuntimeExecutionHost({ route, actualBytes: Uint8Array.of(0xf0) });
    const runtime = requireExecutionApi().createViceExecutionRuntimeV1(host);
    const result = await runtime.executeEvaluatedViceRoute(
      { route, evaluation: authority },
      await acquire(runtime),
      liveSignal(),
    );
    expect(result).toMatchObject({
      status: "failure",
      code: "semantic-mismatch",
      stage: "compare",
    });
    expect(
      requireReadinessApi().evaluatePublishedRuntimeObservationV1(authority, {
        revision: "runtime-actual-observation-v1",
        sourceCaseDigest: projection.sourceCaseDigest,
        kind: "scalar-bytes",
        bytes: Uint8Array.of(0xf0),
      }),
    ).toMatchObject({ ok: false });
  });

  it("rejects forged, replayed, and route-mismatched authority before monitor access", async () => {
    const fixture = await runtimeFixture();
    const entry = fixture.cases[0]!;
    const genuine = requireOracleValue(
      requireReadinessApi().createPublishedRuntimeEvaluationAuthorityV1(
        fixture.context,
        entry.executionCase,
      ),
    );
    const projection = requireOracleValue(
      requireReadinessApi().getPublishedRuntimeEvaluationProjectionV1(genuine),
    );
    const baseRoute = routeFor(entry, projection);
    retireRuntimeEvaluationAuthority(genuine);

    const invalidRoutes = [
      baseRoute,
      {
        ...baseRoute,
        fixture: { ...baseRoute.fixture, cells: baseRoute.fixture.cells.slice(1) },
      },
      {
        ...baseRoute,
        observation: { kind: "scalar-bytes" as const, byteLength: 2 as const },
      },
    ];
    for (const [index, route] of invalidRoutes.entries()) {
      const evaluation =
        index === 0
          ? {}
          : requireOracleValue(
              requireReadinessApi().createPublishedRuntimeEvaluationAuthorityV1(
                fixture.context,
                entry.executionCase,
              ),
            );
      const host = new RuntimeExecutionHost({
        route,
        actualBytes: Uint8Array.of(0xf0),
      });
      const runtime = requireExecutionApi().createViceExecutionRuntimeV1(host);
      const result = await runtime.executeEvaluatedViceRoute(
        { route, evaluation },
        await acquire(runtime),
        liveSignal(),
      );
      expect(result.status).toBe("failure");
      expect(host.calls).not.toContain("endpoints");
      if (index !== 0) retireRuntimeEvaluationAuthority(evaluation);
    }

    const replayAuthority = requireOracleValue(
      requireReadinessApi().createPublishedRuntimeEvaluationAuthorityV1(
        fixture.context,
        entry.executionCase,
      ),
    );
    const host = new RuntimeExecutionHost({
      route: baseRoute,
      actualBytes: entry.fixed.expectedBytes,
    });
    const runtime = requireExecutionApi().createViceExecutionRuntimeV1(host);
    expect(
      await runtime.executeEvaluatedViceRoute(
        { route: baseRoute, evaluation: replayAuthority },
        await acquire(runtime),
        liveSignal(),
      ),
    ).toMatchObject({ status: "pass" });
    const controls = host.calls.filter((call) => call === "control").length;
    const replay = await runtime.executeEvaluatedViceRoute(
      { route: baseRoute, evaluation: replayAuthority },
      await acquire(runtime),
      liveSignal(),
    );
    expect(replay.status).toBe("failure");
    expect(host.calls.filter((call) => call === "control")).toHaveLength(controls);
  });

  it("charges a full chunk and applies instruction, cycle, then wall precedence", async () => {
    const fixture = await runtimeFixture();
    const entry = fixture.cases[0]!;
    const authority = requireOracleValue(
      requireReadinessApi().createPublishedRuntimeEvaluationAuthorityV1(
        fixture.context,
        entry.executionCase,
      ),
    );
    const projection = requireOracleValue(
      requireReadinessApi().getPublishedRuntimeEvaluationProjectionV1(authority),
    );
    const policy: ExecutionPolicyV1 = {
      ...POLICY,
      budget: { ...POLICY.budget, routeMs: 3001, cycles: 1, instructions: 65_535 },
    };
    const route = routeFor(entry, projection, policy);
    const host = new RuntimeExecutionHost({
      route,
      actualBytes: entry.fixed.expectedBytes,
      hit: false,
      stopwatch: [0n, 100n, 160n],
      wallStepMs: 2,
    });
    const runtime = requireExecutionApi().createViceExecutionRuntimeV1(host);
    const result = await runtime.executeEvaluatedViceRoute(
      { route, evaluation: authority },
      await acquire(runtime),
      liveSignal(),
    );
    expect(result).toMatchObject({
      status: "failure",
      code: "instruction-exhaustion",
      usage: { instructions: 65_535, cycles: 60 },
    });
    expect(host.controls[0]?.instructionCounts).toEqual([65_535]);
    retireRuntimeEvaluationAuthority(authority);
  });

  it("cancels pending control work and still performs private cleanup", async () => {
    const fixture = await runtimeFixture();
    const entry = fixture.cases[0]!;
    const authority = requireOracleValue(
      requireReadinessApi().createPublishedRuntimeEvaluationAuthorityV1(
        fixture.context,
        entry.executionCase,
      ),
    );
    const projection = requireOracleValue(
      requireReadinessApi().getPublishedRuntimeEvaluationProjectionV1(authority),
    );
    const route = routeFor(entry, projection);
    const controller = new AbortController();
    const host = new RuntimeExecutionHost({
      route,
      actualBytes: entry.fixed.expectedBytes,
      abortOnAdvance: controller,
    });
    const runtime = requireExecutionApi().createViceExecutionRuntimeV1(host);
    const result = await runtime.executeEvaluatedViceRoute(
      { route, evaluation: authority },
      await acquire(runtime),
      controller.signal,
    );
    expect(result.status).toBe("failure");
    expect(host.calls).toEqual(expect.arrayContaining(["terminate", "remove"]));
    expect(host.controls[0]?.events).toEqual(
      expect.arrayContaining(["close:binary", "close:text", "close-child"]),
    );
    retireRuntimeEvaluationAuthority(authority);
  });

  it("owns actual bytes defensively after control returns", async () => {
    const fixture = await runtimeFixture();
    const entry = fixture.cases[0]!;
    const authority = requireOracleValue(
      requireReadinessApi().createPublishedRuntimeEvaluationAuthorityV1(
        fixture.context,
        entry.executionCase,
      ),
    );
    const projection = requireOracleValue(
      requireReadinessApi().getPublishedRuntimeEvaluationProjectionV1(authority),
    );
    const actualBytes = Uint8Array.from(entry.fixed.expectedBytes);
    const route = routeFor(entry, projection);
    const host = new RuntimeExecutionHost({ route, actualBytes });
    const runtime = requireExecutionApi().createViceExecutionRuntimeV1(host);
    const result = await runtime.executeEvaluatedViceRoute(
      { route, evaluation: authority },
      await acquire(runtime),
      liveSignal(),
    );
    actualBytes.fill(0);
    for (const bytes of host.controls[0]?.returnedReads ?? []) bytes.fill(0);
    expect(result).toMatchObject({ status: "pass", code: "pass" });
    expect(result).not.toHaveProperty("bytes");
    expect(result.evidence.digest).toMatch(/^[0-9a-f]{64}$/u);
  });
});
