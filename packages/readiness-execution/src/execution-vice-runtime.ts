import { createViceControlRuntimeV1 } from "@blend65/test-harness/vice-control";
import {
  parseExecutionEnvelopeIrV1,
  parseExecutionInitialStateFixtureV1,
  parseExecutionPolicyV1,
  type ExecutionOperationResultV1,
  type ExecutionResultV1,
} from "@blend65/readiness";

import {
  digestViceLeaseBytesV1,
  encodeViceLeaseRecordV1,
  parseViceLeaseRecordV1,
  processFactMatchesRecordV1,
  viceBytesToHexV1,
  viceHexToBytesV1,
  type ViceLeaseRecordV1,
} from "./execution-vice-record.js";
import {
  areFreshEndpoints,
  initialRecord,
  isTrustedDirectory,
  isTrustedPresentLease,
  mapControlIssue,
  MAX_ROUTE_ATTEMPTS,
  operationFailure,
  operationSuccess,
  READINESS_VICE_MINOR,
  routeFailure,
  viceArgv,
  VICE_EXECUTABLE,
  withAttempt,
  type RouteUsage,
} from "./execution-vice-policy.js";
import { runViceSessionV1 } from "./execution-vice-session.js";
import { viceLaunchTokenPathV1 } from "./execution-vice-launch-artifact.js";
import { parseExecutionObservationLayoutV1 } from "./execution-observation-layout.js";
import {
  VICE_LEASE_HANDLE_BRAND,
  type ManualLeaseRecoveryV1,
  type ViceExecutionHostV1,
  type ViceExecutionRuntimeV1,
  type ViceLeaseHandleV1,
  type ViceLeaseReferenceV1,
  type ViceProcessIdentityFactV1,
  type ViceRecordedAttemptV1,
  type ViceRouteRequestV1,
  type ViceTerminationRequestV1,
} from "./execution-vice-types.js";

/** Private state associated with one genuine lease handle. */
interface LeaseHandleState {
  /** Runtime instance that minted the handle. */
  readonly coordinator: ViceExecutionCoordinator;
  /** Exact acquisition record. */
  record: ViceLeaseRecordV1;
  /** Exact current CAS reference. */
  reference: ViceLeaseReferenceV1;
  /** Single-use lifecycle. */
  state: "fresh" | "executing" | "consumed";
}

/** Reads one exact plain data record without invoking accessors or proxies deliberately. */
function readRouteRecord(input: unknown): Readonly<Record<string, unknown>> | undefined {
  const keys = [
    "binary",
    "loadAddress",
    "entryAddress",
    "fixture",
    "layout",
    "observation",
    "policy",
  ] as const;
  if (typeof input !== "object" || input === null) return undefined;
  try {
    if (Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype) return undefined;
    const ownKeys = Reflect.ownKeys(input);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some((key) => typeof key !== "string" || !(keys as readonly string[]).includes(key))
    )
      return undefined;
    const record: Record<string, unknown> = {};
    for (const key of keys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      record[key] = descriptor.value;
    }
    return record;
  } catch {
    return undefined;
  }
}

/** Closes an observation through the authoritative envelope parser. */
function parseRouteObservation(input: unknown) {
  for (const stores of [
    [
      { kind: "observation-byte" as const, byteIndex: 0 as const },
      { kind: "completion" as const, value: 165 as const },
    ],
    [
      { kind: "observation-byte" as const, byteIndex: 0 as const },
      { kind: "observation-byte" as const, byteIndex: 1 as const },
      { kind: "completion" as const, value: 165 as const },
    ],
    [{ kind: "completion" as const, value: 165 as const }],
  ]) {
    const parsed = parseExecutionEnvelopeIrV1({
      revision: "execution-envelope-ir-v1",
      sourceCaseDigest: `sha256:${"0".repeat(64)}`,
      arguments: [],
      entryFunction: "entry",
      observation: input,
      completionInitialValue: 0,
      completionSuccessValue: 165,
      postEntryStores: stores,
    });
    if (parsed.ok) return parsed.value.observation;
  }
  return undefined;
}

/** Returns whether the closed layout implements the exact requested observation. */
function layoutMatchesObservation(
  layout: ViceRouteRequestV1["layout"],
  observation: ViceRouteRequestV1["observation"],
): boolean {
  const expectedBytes = observation.kind === "scalar-bytes" ? observation.byteLength : 0;
  if (
    layout.resultSymbols.length !== expectedBytes ||
    layout.resultAddresses.length !== expectedBytes ||
    layout.postEntryStores.length !== expectedBytes + 1
  )
    return false;
  for (let index = 0; index < expectedBytes; index += 1) {
    const store = layout.postEntryStores[index];
    if (
      store?.kind !== "observation-byte" ||
      store.byteIndex !== index ||
      store.targetAddress !== layout.resultAddresses[index]
    )
      return false;
  }
  const completion = layout.postEntryStores.at(-1);
  return (
    completion?.kind === "completion" &&
    completion.targetAddress === layout.completionAddress &&
    completion.value === 165
  );
}

/** Produces a bounded defensive snapshot from already-readable plain data. */
function canonicalizeReadableRouteRequest(input: unknown): ViceRouteRequestV1 | undefined {
  const record = readRouteRecord(input);
  if (record === undefined) return undefined;
  const binary = record.binary;
  if (
    !(binary instanceof Uint8Array) ||
    Object.getPrototypeOf(binary) !== Uint8Array.prototype ||
    binary.byteLength < 1 ||
    binary.byteLength > 65_536 ||
    !Number.isSafeInteger(record.loadAddress) ||
    (record.loadAddress as number) < 0 ||
    (record.loadAddress as number) + binary.byteLength > 65_536 ||
    !Number.isSafeInteger(record.entryAddress) ||
    (record.entryAddress as number) < 0 ||
    (record.entryAddress as number) > 65_535
  )
    return undefined;
  const fixture = parseExecutionInitialStateFixtureV1(record.fixture);
  const policy = parseExecutionPolicyV1(record.policy);
  const layout = parseExecutionObservationLayoutV1(record.layout);
  const observation = parseRouteObservation(record.observation);
  if (!fixture.ok || !policy.ok || !layout.ok || observation === undefined) return undefined;
  if (!layoutMatchesObservation(layout.value, observation)) return undefined;
  return Object.freeze({
    binary: binary.slice(),
    loadAddress: record.loadAddress as number,
    entryAddress: record.entryAddress as number,
    fixture: fixture.value,
    layout: layout.value,
    observation,
    policy: policy.value,
  });
}

/** Rejects hostile nested values without allowing traps to escape the public boundary. */
function canonicalizeRouteRequest(input: unknown): ViceRouteRequestV1 | undefined {
  try {
    return canonicalizeReadableRouteRequest(input);
  } catch {
    return undefined;
  }
}

/** Rearmable monotonic deadline linked to one caller cancellation signal. */
class ViceRouteAbortScope {
  readonly controller = new AbortController();
  readonly #parent: AbortSignal;
  #timer: NodeJS.Timeout | undefined;

  constructor(parent: AbortSignal) {
    this.#parent = parent;
    parent.addEventListener("abort", this.#abort, { once: true });
    if (parent.aborted) this.controller.abort();
  }

  arm(deadline: number, now: number): void {
    if (this.controller.signal.aborted) return;
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = setTimeout(this.#abort, Math.max(0, deadline - now));
    this.#timer.unref();
  }

  dispose(): void {
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#parent.removeEventListener("abort", this.#abort);
  }

  readonly #abort = (): void => this.controller.abort();
}

/** Rebuilds a terminal result after private cleanup has contributed wall time. */
function withFinalWall(result: ExecutionResultV1, wallMs: number): ExecutionResultV1 {
  return Object.freeze({
    ...result,
    usage: Object.freeze({ ...result.usage, wallMs: Math.max(0, Math.floor(wallMs)) }),
  });
}

/** One runtime-scoped coordinator with non-queueing mutation admission. */
export class ViceExecutionCoordinator implements ViceExecutionRuntimeV1 {
  readonly #host: ViceExecutionHostV1;
  readonly #handles = new WeakMap<ViceLeaseHandleV1, LeaseHandleState>();
  readonly #activeTargets = new Set<"c64">();
  #mutationActive = false;

  /** Creates one isolated coordinator over a raw fixed-namespace host. */
  constructor(host: ViceExecutionHostV1) {
    this.#host = host;
  }

  /** Acquires one atomic host-wide lease after trusted-host validation. */
  async acquireViceLease(
    target: "c64",
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceLeaseHandleV1>> {
    if (signal.aborted)
      return operationFailure("execution.stale-authority", "", "Operation is cancelled.");
    if (!this.#admitMutation()) return this.#busyFailure();
    try {
      const environment = await this.#readEnvironment(signal);
      if (!environment.ok) return environment;
      const observed = await this.#host.observeLease(target, signal);
      if (!observed.ok) return observed;
      if (!isTrustedDirectory(observed.value.directory, environment.value.uid)) {
        return operationFailure(
          "execution.identity",
          "/lease/directory",
          "Lease directory is untrusted.",
        );
      }
      if (observed.value.kind === "present" || this.#activeTargets.has(target)) {
        return operationFailure(
          "emulator-lease-recovery-blocked",
          "/lease",
          "A VICE lease is already occupied.",
        );
      }
      const random = this.#host.randomBytes(32);
      if (!(random instanceof Uint8Array) || random.byteLength !== 32) {
        return operationFailure("execution.identity", "/lease/nonce", "Lease nonce is invalid.");
      }
      const ownerObservation = await this.#host.observeProcess(process.pid, signal);
      if (!ownerObservation.ok) return ownerObservation;
      const now = this.#host.nowMonotonicMilliseconds();
      if (!Number.isFinite(now) || now < 0) {
        return operationFailure("execution.identity", "/time", "Monotonic time is invalid.");
      }
      const bytes = encodeViceLeaseRecordV1(
        initialRecord(environment.value.uid, viceBytesToHexV1(random), now, ownerObservation.value),
      );
      const created = await this.#host.tryCreateLease(
        target,
        observed.value.directory,
        bytes.slice(),
        signal,
      );
      if (!created.ok) return created;
      if (created.value.kind !== "created" || created.value.snapshot.kind !== "present") {
        return operationFailure(
          "emulator-lease-recovery-blocked",
          "/lease",
          "The VICE lease was occupied during acquisition.",
        );
      }
      if (!isTrustedPresentLease(created.value.snapshot, environment.value.uid)) {
        return operationFailure("execution.identity", "/lease", "Created VICE lease is untrusted.");
      }
      const record = parseViceLeaseRecordV1(created.value.snapshot.bytes);
      if (record === undefined) {
        return operationFailure("execution.identity", "/lease", "Created VICE lease is invalid.");
      }
      const handle: ViceLeaseHandleV1 = Object.freeze({ [VICE_LEASE_HANDLE_BRAND]: true as const });
      this.#handles.set(handle, {
        coordinator: this,
        record,
        reference: created.value.snapshot.reference,
        state: "fresh",
      });
      this.#activeTargets.add(target);
      return operationSuccess(handle);
    } finally {
      this.#releaseMutation();
    }
  }

  /** Returns bounded evidence without mutating or signalling the observed lease. */
  async inspectViceLease(
    target: "c64",
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ManualLeaseRecoveryV1>> {
    if (signal.aborted)
      return operationFailure("execution.stale-authority", "", "Operation is cancelled.");
    if (!this.#admitMutation()) return this.#busyFailure();
    try {
      const observation = await this.#observeValidated(target, signal);
      if (!observation.ok) return observation;
      if (observation.value.snapshot.kind === "absent") {
        return operationSuccess(
          Object.freeze({
            state: "clear",
            generation: 0,
            nonce: "",
            childAbsent: true,
            evidenceDigest: digestViceLeaseBytesV1(new Uint8Array(0)),
          }),
        );
      }
      const { record, snapshot } = observation.value;
      const identity = record.child ?? record.owner;
      let state: ManualLeaseRecoveryV1["state"] = "clear";
      let childAbsent = true;
      if (identity !== null) {
        const processObservation = await this.#host.observeProcess(
          identity.pid,
          signal,
          identity.launchTokenPath ?? undefined,
        );
        if (!processObservation.ok) return processObservation;
        if (processObservation.value !== null) {
          childAbsent = false;
          state = processFactMatchesRecordV1(processObservation.value, identity)
            ? "active"
            : "ambiguous";
        }
      } else {
        const processObservation = await this.#host.observeProcess(process.pid, signal);
        if (!processObservation.ok) return processObservation;
        if (processObservation.value !== null) {
          childAbsent = false;
          state = "ambiguous";
        }
      }
      return operationSuccess(
        Object.freeze({
          state,
          generation: record.generation,
          nonce: record.nonce,
          childAbsent,
          evidenceDigest: digestViceLeaseBytesV1(snapshot.bytes),
        }),
      );
    } finally {
      this.#releaseMutation();
    }
  }

  /** Clears only an exact generation whose recorded process is positively absent. */
  async clearViceLeaseGeneration(
    target: "c64",
    generation: number,
    nonce: string,
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<true>> {
    if (signal.aborted)
      return operationFailure("execution.stale-authority", "", "Operation is cancelled.");
    if (!this.#admitMutation()) return this.#busyFailure();
    try {
      if (!Number.isSafeInteger(generation) || generation < 1 || !/^[0-9a-f]{64}$/.test(nonce)) {
        return operationFailure(
          "execution.invalid-schema",
          "/lease",
          "Lease generation is invalid.",
        );
      }
      const observation = await this.#observeValidated(target, signal);
      if (!observation.ok) return observation;
      if (observation.value.snapshot.kind !== "present") {
        return operationFailure("execution.stale-authority", "/lease", "Lease is absent.");
      }
      const { record, snapshot } = observation.value;
      if (record.generation !== generation || record.nonce !== nonce) {
        return operationFailure("execution.stale-authority", "/lease", "Lease generation changed.");
      }
      const identity = record.child ?? record.owner;
      if (identity !== null) {
        const processObservation = await this.#host.observeProcess(
          identity.pid,
          signal,
          identity.launchTokenPath ?? undefined,
        );
        if (!processObservation.ok) return processObservation;
        if (processObservation.value !== null) {
          return operationFailure(
            "execution.identity",
            "/lease/process",
            "Lease process is not absent.",
          );
        }
      } else {
        const processObservation = await this.#host.observeProcess(process.pid, signal);
        if (!processObservation.ok) return processObservation;
        if (processObservation.value !== null) {
          return operationFailure(
            "execution.identity",
            "/lease/process",
            "Lease process absence is not proven.",
          );
        }
      }
      const removed = await this.#host.compareRemoveLease(target, snapshot.reference, signal);
      if (!removed.ok) return removed;
      if (removed.value.kind !== "removed") {
        return operationFailure(
          "execution.stale-authority",
          "/lease",
          "Lease changed before clear.",
        );
      }
      return operationSuccess(true);
    } finally {
      this.#releaseMutation();
    }
  }

  /** Consumes one genuine handle and executes a bounded retrying VICE route. */
  async executeViceRoute(
    request: ViceRouteRequestV1,
    lease: ViceLeaseHandleV1,
    signal: AbortSignal,
  ): Promise<ExecutionResultV1> {
    const canonical = canonicalizeRouteRequest(request);
    if (canonical === undefined) {
      return routeFailure(
        "invalid-evidence-input",
        "input",
        { instructions: 0, cycles: 0, launchAttempts: 0 },
        0,
      );
    }
    const started = this.#host.nowMonotonicMilliseconds();
    const result = await this.#executeCanonicalViceRoute(canonical, lease, signal);
    return withFinalWall(result, this.#host.nowMonotonicMilliseconds() - started);
  }

  /** Executes one already-canonical request while retaining cleanup authority. */
  async #executeCanonicalViceRoute(
    request: ViceRouteRequestV1,
    lease: ViceLeaseHandleV1,
    signal: AbortSignal,
  ): Promise<ExecutionResultV1> {
    const usage: RouteUsage = { instructions: 0, cycles: 0, launchAttempts: 0 };
    const started = this.#host.nowMonotonicMilliseconds();
    const wall = (): number => this.#host.nowMonotonicMilliseconds() - started;
    const workDeadline =
      started + request.policy.budget.routeMs - request.policy.budget.cleanupGraceMs;
    const handle = this.#handles.get(lease);
    if (
      handle === undefined ||
      handle.coordinator !== this ||
      handle.state !== "fresh" ||
      !this.#admitMutation()
    ) {
      return routeFailure(
        "invalid-evidence-input",
        "vice-launch",
        usage,
        wall(),
        "execution.stale-authority",
      );
    }
    handle.state = "executing";
    this.#activeTargets.delete("c64");
    let cleanupSafe = true;
    try {
      if (signal.aborted) {
        return routeFailure("wall-time-exhaustion", "vice-launch", usage, wall());
      }
      const usedPorts = new Set<number>();
      const attemptLimit = Math.min(MAX_ROUTE_ATTEMPTS, request.policy.budget.launchAttempts);
      let terminal: ExecutionResultV1 | undefined;
      for (let ordinal = 1; ordinal <= attemptLimit && terminal === undefined; ordinal += 1) {
        if (signal.aborted || this.#host.nowMonotonicMilliseconds() >= workDeadline) {
          terminal = routeFailure("wall-time-exhaustion", "vice-launch", usage, wall());
          break;
        }
        const watchdog = new ViceRouteAbortScope(signal);
        watchdog.arm(
          Math.min(
            workDeadline,
            this.#host.nowMonotonicMilliseconds() + request.policy.budget.launchAttemptMs,
          ),
          this.#host.nowMonotonicMilliseconds(),
        );
        const attemptSignal = watchdog.controller.signal;
        try {
          usage.launchAttempts += 1;
          const endpointsResult = await this.#host.allocateLoopbackEndpoints(attemptSignal);
          if (!endpointsResult.ok) {
            terminal = routeFailure(
              signal.aborted || this.#host.nowMonotonicMilliseconds() >= workDeadline
                ? "wall-time-exhaustion"
                : "emulator-launch-failure",
              "vice-launch",
              usage,
              wall(),
            );
            break;
          }
          if (!areFreshEndpoints(endpointsResult.value, usedPorts)) {
            terminal = routeFailure("emulator-launch-failure", "vice-launch", usage, wall());
            break;
          }
          const endpoints = endpointsResult.value;
          usedPorts.add(endpoints.binaryPort);
          usedPorts.add(endpoints.textPort);
          const token = this.#host.randomBytes(32);
          if (!(token instanceof Uint8Array) || token.byteLength !== 32) {
            terminal = routeFailure("emulator-launch-failure", "vice-launch", usage, wall());
            break;
          }
          const recordedBytes = encodeViceLeaseRecordV1(
            withAttempt(
              handle.record,
              token,
              endpoints.binaryPort,
              endpoints.textPort,
              viceLaunchTokenPathV1(handle.record.uid, token),
              this.#host.nowMonotonicMilliseconds(),
            ),
          );
          const replaced = await this.#host.compareReplaceLease(
            "c64",
            handle.reference,
            recordedBytes.slice(),
            attemptSignal,
          );
          if (
            !replaced.ok ||
            replaced.value.kind !== "replaced" ||
            replaced.value.snapshot.kind !== "present"
          ) {
            terminal = routeFailure(
              "emulator-lease-recovery-blocked",
              "vice-launch",
              usage,
              wall(),
            );
            break;
          }
          const nextRecord = parseViceLeaseRecordV1(replaced.value.snapshot.bytes);
          if (nextRecord === undefined) {
            terminal = routeFailure(
              "emulator-lease-recovery-blocked",
              "vice-launch",
              usage,
              wall(),
            );
            break;
          }
          handle.record = nextRecord;
          handle.reference = replaced.value.snapshot.reference;
          const attempt: ViceRecordedAttemptV1 = Object.freeze({
            target: "c64",
            claim: handle.reference,
            generation: handle.record.generation,
            nonce: handle.record.nonce,
            launchToken: token.slice(),
            launchTokenPath: viceLaunchTokenPathV1(handle.record.uid, token),
            endpoints: Object.freeze({ ...endpoints }),
            executable: VICE_EXECUTABLE,
            argv: viceArgv(endpoints.binaryPort, endpoints.textPort),
            cwd: process.cwd(),
          });
          const hostResult = await this.#host.createControlAttempt(attempt, attemptSignal);
          if (!hostResult.ok) {
            const retired = await this.#retireAttemptArtifact(
              handle,
              request.policy.budget.cleanupGraceMs,
            );
            if (retired === "compatibility-unproven") cleanupSafe = false;
            if (retired === "blocked") {
              cleanupSafe = false;
              terminal = routeFailure(
                "emulator-lease-recovery-blocked",
                "vice-launch",
                usage,
                wall(),
              );
              break;
            }
            if (signal.aborted || this.#host.nowMonotonicMilliseconds() >= workDeadline) {
              terminal = routeFailure("wall-time-exhaustion", "vice-launch", usage, wall());
              break;
            }
            const code = hostResult.issues[0].code;
            if (code === "tier-unavailable") {
              terminal = routeFailure("tier-unavailable", "vice-launch", usage, wall());
              break;
            }
            if (ordinal === attemptLimit) {
              terminal = routeFailure(
                code === "emulator-handshake-failure"
                  ? "emulator-handshake-failure"
                  : "emulator-launch-failure",
                code === "emulator-handshake-failure" ? "vice-handshake" : "vice-launch",
                usage,
                wall(),
              );
            }
            continue;
          }
          const runtime = createViceControlRuntimeV1(hostResult.value);
          const launch = await runtime.launch(
            {
              executable: attempt.executable,
              argv: attempt.argv,
              cwd: attempt.cwd,
              endpoints,
              handshake: {
                target: "c64",
                version: {
                  major: 3,
                  minimumMinor: READINESS_VICE_MINOR,
                  maximumMinor: READINESS_VICE_MINOR,
                },
                endpointOwnership: "required",
              },
            },
            attemptSignal,
          );
          const reconciled = await this.#reconcileControlLease(
            handle,
            token,
            endpoints,
            request.policy.budget.cleanupGraceMs,
          );
          if (!reconciled) {
            if (launch.ok) await launch.value.close();
            cleanupSafe = false;
            terminal = routeFailure(
              "emulator-lease-recovery-blocked",
              "vice-launch",
              usage,
              wall(),
            );
            break;
          }
          if (!launch.ok) {
            if (launch.issue.reason === "vice.closed") {
              cleanupSafe = false;
              terminal = routeFailure(
                "emulator-lease-recovery-blocked",
                "vice-launch",
                usage,
                wall(),
              );
              break;
            }
            const retired = await this.#retireAttemptArtifact(
              handle,
              request.policy.budget.cleanupGraceMs,
            );
            if (retired === "compatibility-unproven") cleanupSafe = false;
            if (retired === "blocked") {
              cleanupSafe = false;
              terminal = routeFailure(
                "emulator-lease-recovery-blocked",
                "vice-launch",
                usage,
                wall(),
              );
              break;
            }
            const mapped = mapControlIssue(launch.issue);
            const routeExpired =
              signal.aborted || this.#host.nowMonotonicMilliseconds() >= workDeadline;
            if (
              ordinal === attemptLimit ||
              (mapped.code === "wall-time-exhaustion" && routeExpired)
            ) {
              terminal = routeFailure(mapped.code, mapped.stage, usage, wall());
            }
            continue;
          }
          watchdog.arm(workDeadline, this.#host.nowMonotonicMilliseconds());
          const sessionResult = await runViceSessionV1(
            request,
            launch.value,
            attemptSignal,
            usage,
            wall,
          );
          const closed = await launch.value.close();
          if (!closed.ok) {
            cleanupSafe = false;
            terminal = routeFailure(
              "emulator-lease-recovery-blocked",
              "vice-launch",
              usage,
              wall(),
            );
          } else {
            terminal = sessionResult;
          }
        } finally {
          watchdog.dispose();
        }
      }
      return terminal ?? routeFailure("emulator-launch-failure", "vice-launch", usage, wall());
    } finally {
      handle.state = "consumed";
      if (cleanupSafe) {
        await this.#cleanupLease(handle, request.policy?.budget.cleanupGraceMs ?? 1_000);
      }
      this.#releaseMutation();
    }
  }

  /** Proves process absence and retires one superseded attempt artifact before retry. */
  async #retireAttemptArtifact(
    handle: LeaseHandleState,
    cleanupGraceMs: number,
  ): Promise<"retired" | "compatibility-unproven" | "blocked"> {
    const attempt = handle.record.attempt;
    if (attempt === null) return "retired";
    const cleanup = AbortSignal.timeout(Math.max(1, Math.min(cleanupGraceMs, 60_000)));
    let expectedProcess: ViceProcessIdentityFactV1 | null = null;
    if (handle.record.child !== null) {
      const token =
        handle.record.child.launchToken === null
          ? undefined
          : viceHexToBytesV1(handle.record.child.launchToken);
      if (
        token === undefined ||
        token.byteLength !== 32 ||
        (handle.record.child.launchTokenPath !== null &&
          handle.record.child.launchTokenPath !== attempt.launchTokenPath)
      ) {
        return "blocked";
      }
      expectedProcess = Object.freeze({
        bootId: handle.record.child.bootId,
        pid: handle.record.child.pid,
        startTicks: BigInt(handle.record.child.startTicks),
        processGroupId: handle.record.child.processGroupId,
        launchToken: token,
        launchTokenPath: handle.record.child.launchTokenPath,
      });
    }
    const removeArtifact = this.#host.compareRemoveLaunchArtifact;
    if (removeArtifact === undefined) return "compatibility-unproven";
    const removed = await removeArtifact.call(
      this.#host,
      "c64",
      handle.reference,
      attempt.launchTokenPath,
      expectedProcess,
      cleanup,
    );
    return removed.ok && (removed.value === "removed" || removed.value === "missing")
      ? "retired"
      : "blocked";
  }

  /** Reconciles the durable record-then-exec transition before retry or cleanup. */
  async #reconcileControlLease(
    handle: LeaseHandleState,
    token: Uint8Array,
    endpoints: { readonly binaryPort: number; readonly textPort: number },
    cleanupGraceMs: number,
  ): Promise<boolean> {
    const signal = AbortSignal.timeout(Math.max(1, Math.min(cleanupGraceMs, 60_000)));
    const observed = await this.#host.observeLease("c64", signal);
    if (
      !observed.ok ||
      observed.value.kind !== "present" ||
      !isTrustedPresentLease(observed.value, handle.record.uid)
    ) {
      return false;
    }
    const record = parseViceLeaseRecordV1(observed.value.bytes);
    if (
      record === undefined ||
      record.uid !== handle.record.uid ||
      record.generation !== handle.record.generation ||
      record.nonce !== handle.record.nonce ||
      record.attempt === null ||
      record.attempt.launchToken !== viceBytesToHexV1(token) ||
      record.attempt.binaryPort !== endpoints.binaryPort ||
      record.attempt.textPort !== endpoints.textPort ||
      record.attempt.launchTokenPath !== viceLaunchTokenPathV1(record.uid, token)
    ) {
      return false;
    }
    handle.record = record;
    handle.reference = observed.value.reference;
    return true;
  }

  /** Best-effort exact-reference cleanup under a private bounded signal. */
  async #cleanupLease(handle: LeaseHandleState, cleanupGraceMs: number): Promise<void> {
    const cleanup = AbortSignal.timeout(Math.max(1, Math.min(cleanupGraceMs, 60_000)));
    const removed = await this.#host.compareRemoveLease("c64", handle.reference, cleanup);
    if (removed.ok && removed.value.kind === "removed") return;
    const identityRecord = handle.record.child ?? handle.record.owner;
    if (identityRecord === null) return;
    const processObservation = await this.#host.observeProcess(
      identityRecord.pid,
      cleanup,
      identityRecord.launchTokenPath ?? undefined,
    );
    if (!processObservation.ok || processObservation.value === null) return;
    const processFact = processObservation.value;
    if (!processFactMatchesRecordV1(processFact, identityRecord)) return;
    const request: ViceTerminationRequestV1 = Object.freeze({
      target: "c64",
      lease: handle.reference,
      process: processFact,
      generation: handle.record.generation,
      nonce: handle.record.nonce,
      phase: "graceful",
    });
    await this.#host.revalidateAndTerminateVice(request, cleanup);
  }

  /** Reads supported platform and effective user before any lease access. */
  async #readEnvironment(
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<{ readonly uid: number }>> {
    const platform = await this.#host.platform(signal);
    if (!platform.ok) return platform;
    if (platform.value !== "linux") {
      return operationFailure("tier-unavailable", "/platform", "VICE lease requires Linux.");
    }
    const uid = await this.#host.effectiveUid(signal);
    if (!uid.ok) return uid;
    if (!Number.isSafeInteger(uid.value) || uid.value < 0) {
      return operationFailure("execution.identity", "/uid", "Effective user id is invalid.");
    }
    return operationSuccess({ uid: uid.value });
  }

  /** Observes and validates one absent or present trusted lease. */
  async #observeValidated(
    target: "c64",
    signal: AbortSignal,
  ): Promise<
    ExecutionOperationResultV1<{
      readonly snapshot: Awaited<ReturnType<ViceExecutionHostV1["observeLease"]>> extends infer R
        ? R extends { readonly ok: true; readonly value: infer V }
          ? V
          : never
        : never;
      readonly record: ViceLeaseRecordV1;
    }>
  > {
    const environment = await this.#readEnvironment(signal);
    if (!environment.ok) return environment;
    const observed = await this.#host.observeLease(target, signal);
    if (!observed.ok) return observed;
    if (!isTrustedDirectory(observed.value.directory, environment.value.uid)) {
      return operationFailure(
        "execution.identity",
        "/lease/directory",
        "Lease directory is untrusted.",
      );
    }
    if (observed.value.kind === "absent") {
      const empty = initialRecord(environment.value.uid, "0".repeat(64), 0, null);
      return operationSuccess({
        snapshot: observed.value,
        record: Object.freeze({ ...empty, checksum: "0".repeat(64) }),
      });
    }
    if (!isTrustedPresentLease(observed.value, environment.value.uid)) {
      return operationFailure("execution.identity", "/lease", "Present lease is untrusted.");
    }
    const record = parseViceLeaseRecordV1(observed.value.bytes);
    if (record === undefined || record.uid !== environment.value.uid) {
      return operationFailure("execution.identity", "/lease/record", "Lease record is invalid.");
    }
    return operationSuccess({ snapshot: observed.value, record });
  }

  /** Admits one mutation immediately without queueing. */
  #admitMutation(): boolean {
    if (this.#mutationActive) return false;
    this.#mutationActive = true;
    return true;
  }

  /** Releases the coordinator's single mutation slot. */
  #releaseMutation(): void {
    this.#mutationActive = false;
  }

  /** Returns the stable non-queueing mutation conflict. */
  #busyFailure<T>(): ExecutionOperationResultV1<T> {
    return operationFailure(
      "execution.stale-authority",
      "/runtime",
      "Another runtime mutation is already active.",
    );
  }
}
