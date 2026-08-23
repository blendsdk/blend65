import { createViceControlRuntimeV1 } from "@blend65/test-harness/vice-control";
import type {
  ExecutionOperationResultV1,
  ExecutionResultV1,
  ExecutionTerminalCandidateV1,
  PublishedRuntimeEvaluationProjectionV1,
} from "@blend65/readiness";
import {
  evaluatePublishedRuntimeObservationV1,
  getPublishedRuntimeEvaluationProjectionV1,
  parseExecutionEnvelopeIrV1,
  parseExecutionInitialStateFixtureV1,
  parseExecutionPolicyV1,
} from "@blend65/readiness/execution-runtime";

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
  routePass,
  viceArgv,
  VICE_EXECUTABLE,
  withAttempt,
  type RouteUsage,
} from "./execution-vice-policy.js";
import { runEvaluatedViceSessionV1, runViceSessionV1 } from "./execution-vice-session.js";
import { viceLaunchTokenPathV1 } from "./execution-vice-launch-artifact.js";
import { parseExecutionObservationLayoutV1 } from "./execution-observation-layout.js";
import {
  attachViceEvaluationEvidenceV1,
  claimBoundViceRouteV1,
  claimUnboundViceEvaluationV1,
  deriveActualObservationDigestV1,
  deriveViceRouteFingerprintV1,
  finalizeViceEvaluationEvidenceV1,
  isBoundViceRouteV1,
  propagateViceEvaluationEvidenceV1,
  type SealedViceBuildBaselineV1,
} from "./execution-vice-evaluation.js";
import {
  VICE_LEASE_HANDLE_BRAND,
  type BoundEvaluatedViceRouteRequestV1,
  type EvaluatedViceRouteRequestV1,
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

/** Reads the exact evaluated wrapper without invoking caller-controlled accessors. */
function readEvaluatedRouteRecord(input: unknown):
  | {
      readonly route: unknown;
      readonly evaluation: EvaluatedViceRouteRequestV1["evaluation"];
    }
  | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  try {
    if (Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype) return undefined;
    const keys = ["route", "evaluation"] as const;
    const ownKeys = Reflect.ownKeys(input);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some((key) => typeof key !== "string" || !(keys as readonly string[]).includes(key))
    ) {
      return undefined;
    }
    const route = Reflect.getOwnPropertyDescriptor(input, "route");
    const evaluation = Reflect.getOwnPropertyDescriptor(input, "evaluation");
    if (
      route === undefined ||
      evaluation === undefined ||
      !("value" in route) ||
      !("value" in evaluation) ||
      !route.enumerable ||
      !evaluation.enumerable
    ) {
      return undefined;
    }
    return Object.freeze({
      route: route.value,
      evaluation: evaluation.value as EvaluatedViceRouteRequestV1["evaluation"],
    });
  } catch {
    return undefined;
  }
}

function fixtureMatchesProjection(
  route: ViceRouteRequestV1,
  projection: PublishedRuntimeEvaluationProjectionV1,
): boolean {
  if (
    route.fixture.revision !== projection.fixture.revision ||
    route.fixture.cells.length !== projection.fixture.cells.length
  ) {
    return false;
  }
  return route.fixture.cells.every((cell, index) => {
    const expected = projection.fixture.cells[index];
    return expected?.address === cell.address && expected.logicalValue === cell.logicalValue;
  });
}

function observationMatchesProjection(
  route: ViceRouteRequestV1,
  projection: PublishedRuntimeEvaluationProjectionV1,
): boolean {
  const actual = route.observation;
  const expected = projection.observation;
  return (
    actual.kind === expected.kind &&
    actual.byteLength === expected.byteLength &&
    actual.address === expected.address &&
    actual.projectionRevision === expected.projectionRevision
  );
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

/** Bounds cleanup authority by both its grace allowance and the original route deadline. */
function cleanupSignal(
  nowMonotonicMs: number,
  cleanupGraceMs: number,
  hardDeadlineMonotonicMs: number,
): AbortSignal {
  const remainingMs = Math.max(0, hardDeadlineMonotonicMs - nowMonotonicMs);
  const allowanceMs = Math.floor(Math.min(cleanupGraceMs, remainingMs, 60_000));
  return allowanceMs <= 0 ? AbortSignal.abort() : AbortSignal.timeout(allowanceMs);
}

/** Rebuilds a terminal result after private cleanup has contributed wall time. */
function withFinalWall(result: ExecutionResultV1, wallMs: number): ExecutionResultV1 {
  const finalized = Object.freeze({
    ...result,
    usage: Object.freeze({ ...result.usage, wallMs: Math.max(0, Math.floor(wallMs)) }),
  });
  return propagateViceEvaluationEvidenceV1(result, finalized);
}

/** Reattaches the sealed preparation baseline to one production VICE terminal. */
function withSealedBuildBaseline(
  result: ExecutionResultV1,
  baseline: SealedViceBuildBaselineV1,
  nowMonotonicMs: number,
): ExecutionResultV1 {
  const finalized = Object.freeze({
    ...result,
    usage: Object.freeze({
      wallMs: Math.max(0, Math.floor(nowMonotonicMs - baseline.startedAtMonotonicMs)),
      outputBytes: baseline.usage.outputBytes + result.usage.outputBytes,
      evidenceBytes: baseline.usage.evidenceBytes + result.usage.evidenceBytes,
      instructions: baseline.usage.instructions + result.usage.instructions,
      cycles: baseline.usage.cycles + result.usage.cycles,
      launchAttempts: baseline.usage.launchAttempts + result.usage.launchAttempts,
    }),
    evidence: baseline.evidence,
  });
  return propagateViceEvaluationEvidenceV1(result, finalized);
}

/** Creates the only cleanup terminal emitted by VICE lease retirement. */
function cleanupCandidate(
  result: ExecutionResultV1,
  evidenceDigest = result.evidence.digest,
): Extract<ExecutionTerminalCandidateV1, { readonly stage: "cleanup" }> {
  return Object.freeze({
    stage: "cleanup",
    code: "emulator-lease-recovery-blocked",
    usage: result.usage,
    evidence: result.evidence,
    cleanupBlocker: Object.freeze({
      code: "emulator-lease-recovery-blocked",
      evidenceDigest,
    }),
  });
}

/** Applies cleanup precedence without discarding an earlier operational failure. */
export function mergeViceCleanupCandidateV1(
  result: ExecutionResultV1,
  candidate: Extract<ExecutionTerminalCandidateV1, { readonly stage: "cleanup" }> | undefined,
): ExecutionResultV1 {
  if (candidate === undefined) return result;
  const finalized =
    result.status === "pass"
      ? Object.freeze({
          status: "failure" as const,
          tier: result.tier,
          stage: "cleanup" as const,
          code: "emulator-lease-recovery-blocked" as const,
          usage: candidate.usage,
          evidence: candidate.evidence,
          cleanupBlocker: candidate.cleanupBlocker,
        })
      : Object.freeze({
          ...result,
          cleanupBlocker: candidate.cleanupBlocker,
        });
  return propagateViceEvaluationEvidenceV1(result, finalized);
}

/** One runtime-scoped coordinator with non-queueing mutation admission. */
export class ViceExecutionCoordinator implements ViceExecutionRuntimeV1 {
  readonly #host: ViceExecutionHostV1;
  readonly #callerOwnedHost: boolean;
  readonly #handles = new WeakMap<ViceLeaseHandleV1, LeaseHandleState>();
  readonly #activeTargets = new Set<"c64">();
  #mutationActive = false;

  /** Creates one isolated coordinator over a raw fixed-namespace host. */
  constructor(host: ViceExecutionHostV1, callerOwnedHost = false) {
    this.#host = host;
    this.#callerOwnedHost = callerOwnedHost;
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

  /** Authenticates, executes and privately evaluates one selected VICE route. */
  async executeEvaluatedViceRoute(
    request: EvaluatedViceRouteRequestV1,
    lease: ViceLeaseHandleV1,
    signal: AbortSignal,
  ): Promise<ExecutionResultV1> {
    if (!this.#callerOwnedHost || isBoundViceRouteV1(request)) {
      return routeFailure(
        "invalid-evidence-input",
        "input",
        { instructions: 0, cycles: 0, launchAttempts: 0 },
        0,
        "execution.stale-authority",
      );
    }
    const record = readEvaluatedRouteRecord(request);
    const canonical = record === undefined ? undefined : canonicalizeRouteRequest(record.route);
    const projected =
      record === undefined
        ? undefined
        : getPublishedRuntimeEvaluationProjectionV1(record.evaluation);
    if (
      record === undefined ||
      canonical === undefined ||
      projected === undefined ||
      !projected.ok ||
      !fixtureMatchesProjection(canonical, projected.value) ||
      !observationMatchesProjection(canonical, projected.value)
    ) {
      return routeFailure(
        "invalid-evidence-input",
        "input",
        { instructions: 0, cycles: 0, launchAttempts: 0 },
        0,
      );
    }
    const routeFingerprint = deriveViceRouteFingerprintV1(projected.value, canonical);
    const routeIdentity = claimUnboundViceEvaluationV1(record.evaluation, routeFingerprint);
    if (routeIdentity === undefined) {
      return routeFailure(
        "invalid-evidence-input",
        "input",
        { instructions: 0, cycles: 0, launchAttempts: 0 },
        0,
        "execution.stale-authority",
      );
    }
    const started = this.#host.nowMonotonicMilliseconds();
    const result = await this.#executeCanonicalViceRoute(canonical, lease, signal, {
      authority: record.evaluation,
      projection: projected.value,
      routeIdentity,
    });
    const finalized = withFinalWall(result, this.#host.nowMonotonicMilliseconds() - started);
    return finalizeViceEvaluationEvidenceV1(finalized, canonical.policy.budget.evidenceBytes);
  }

  /** Consumes one sealed build only on the production coordinator. */
  async executeBoundEvaluatedViceRoute(
    request: BoundEvaluatedViceRouteRequestV1,
    lease: ViceLeaseHandleV1,
    signal: AbortSignal,
  ): Promise<ExecutionResultV1> {
    if (this.#callerOwnedHost) {
      return routeFailure(
        "invalid-evidence-input",
        "input",
        { instructions: 0, cycles: 0, launchAttempts: 0 },
        0,
        "execution.stale-authority",
      );
    }
    const claimed = claimBoundViceRouteV1(request);
    if (claimed === undefined) {
      return routeFailure(
        "invalid-evidence-input",
        "input",
        { instructions: 0, cycles: 0, launchAttempts: 0 },
        0,
        "execution.stale-authority",
      );
    }
    const result = await this.#executeCanonicalViceRoute(claimed.route, lease, signal, {
      authority: claimed.evaluation,
      projection: claimed.projection,
      routeIdentity: claimed.routeIdentity,
      baseline: claimed.baseline,
    });
    const finalized = withSealedBuildBaseline(
      result,
      claimed.baseline,
      this.#host.nowMonotonicMilliseconds(),
    );
    return finalizeViceEvaluationEvidenceV1(finalized, claimed.route.policy.budget.evidenceBytes);
  }

  /** Executes one already-canonical request while retaining cleanup authority. */
  async #executeCanonicalViceRoute(
    request: ViceRouteRequestV1,
    lease: ViceLeaseHandleV1,
    signal: AbortSignal,
    evaluation?: {
      readonly authority: EvaluatedViceRouteRequestV1["evaluation"];
      readonly projection: PublishedRuntimeEvaluationProjectionV1;
      readonly routeIdentity: string;
      readonly baseline?: SealedViceBuildBaselineV1;
    },
  ): Promise<ExecutionResultV1> {
    const usage: RouteUsage = { instructions: 0, cycles: 0, launchAttempts: 0 };
    const started =
      evaluation?.baseline?.startedAtMonotonicMs ?? this.#host.nowMonotonicMilliseconds();
    const wall = (): number => this.#host.nowMonotonicMilliseconds() - started;
    const workDeadline =
      evaluation?.baseline?.workDeadlineMonotonicMs ??
      started + request.policy.budget.routeMs - request.policy.budget.cleanupGraceMs;
    const hardDeadline =
      evaluation?.baseline?.hardDeadlineMonotonicMs ?? started + request.policy.budget.routeMs;
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
    let cleanupIssue = false;
    let durableChildRequired = false;
    let result: ExecutionResultV1 | undefined;
    let observedCleanupCandidate:
      | Extract<ExecutionTerminalCandidateV1, { readonly stage: "cleanup" }>
      | undefined;
    try {
      if (
        evaluation?.baseline !== undefined &&
        evaluation.baseline.usage.evidenceBytes + 32 > request.policy.budget.evidenceBytes
      ) {
        result = routeFailure("evidence-exhaustion", "compare", usage, wall());
      } else if (signal.aborted) {
        result = routeFailure("wall-time-exhaustion", "vice-launch", usage, wall());
      } else {
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
                hardDeadline,
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
              hardDeadline,
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
            if (launch.ok && handle.record.child === null && !this.#callerOwnedHost) {
              await launch.value.close();
              cleanupSafe = false;
              terminal = routeFailure(
                "emulator-lease-recovery-blocked",
                "vice-launch",
                usage,
                wall(),
              );
              break;
            }
            durableChildRequired ||= launch.ok && !this.#callerOwnedHost;
            if (!launch.ok) {
              if (launch.issue.reason === "vice.closed") {
                cleanupSafe = false;
                terminal = routeFailure(
                  signal.aborted || attemptSignal.aborted
                    ? "wall-time-exhaustion"
                    : "emulator-launch-failure",
                  "vice-launch",
                  usage,
                  wall(),
                );
                break;
              }
              const retired = await this.#retireAttemptArtifact(
                handle,
                request.policy.budget.cleanupGraceMs,
                hardDeadline,
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
            let sessionResult: ExecutionResultV1;
            if (evaluation === undefined) {
              sessionResult = await runViceSessionV1(
                request,
                launch.value,
                attemptSignal,
                usage,
                wall,
              );
            } else {
              const observed = await runEvaluatedViceSessionV1(
                request,
                launch.value,
                attemptSignal,
                usage,
                wall,
              );
              if (observed.result.status === "pass" && observed.actual !== undefined) {
                const actual =
                  observed.actual.kind === "scalar-bytes"
                    ? {
                        revision: "runtime-actual-observation-v1" as const,
                        sourceCaseDigest: evaluation.projection.sourceCaseDigest,
                        kind: "scalar-bytes" as const,
                        bytes: observed.actual.bytes.slice(),
                      }
                    : {
                        revision: "runtime-actual-observation-v1" as const,
                        sourceCaseDigest: evaluation.projection.sourceCaseDigest,
                        kind: "direct-mmio" as const,
                        address: request.observation.address,
                        projectionRevision: "c64-vic-color-observation-v1" as const,
                        bytes: observed.actual.bytes.slice(),
                      };
                const decision = evaluatePublishedRuntimeObservationV1(
                  evaluation.authority,
                  actual,
                );
                const compared =
                  decision.ok && decision.value.outcome === "match"
                    ? routePass(usage, wall())
                    : routeFailure(
                        decision.ok ? "semantic-mismatch" : "invalid-evidence-input",
                        "compare",
                        usage,
                        wall(),
                      );
                sessionResult = attachViceEvaluationEvidenceV1(compared, {
                  routeIdentity: evaluation.routeIdentity,
                  evaluationIdentity: decision.ok
                    ? decision.value.evaluationIdentity
                    : evaluation.projection.evaluationIdentity,
                  actualObservationDigest: deriveActualObservationDigestV1(actual),
                  outcome: decision.ok ? decision.value.outcome : "invalid",
                  ...(evaluation.baseline === undefined
                    ? {}
                    : { buildEvidenceDigest: evaluation.baseline.evidence.digest }),
                });
              } else {
                sessionResult = observed.result;
              }
            }
            const closed = await launch.value.close();
            if (!closed.ok) cleanupIssue = true;
            terminal = sessionResult;
          } finally {
            watchdog.dispose();
          }
        }
        result = terminal ?? routeFailure("emulator-launch-failure", "vice-launch", usage, wall());
      }
    } finally {
      handle.state = "consumed";
      const cleanupBase =
        result ?? routeFailure("emulator-launch-failure", "vice-launch", usage, wall());
      if (cleanupSafe) {
        observedCleanupCandidate = await this.#cleanupLease(
          handle,
          request.policy.budget.cleanupGraceMs,
          hardDeadline,
          durableChildRequired,
          cleanupBase,
        );
      } else {
        observedCleanupCandidate = cleanupCandidate(
          cleanupBase,
          digestViceLeaseBytesV1(encodeViceLeaseRecordV1(handle.record)),
        );
      }
      if (cleanupIssue) observedCleanupCandidate ??= cleanupCandidate(cleanupBase);
      this.#releaseMutation();
    }
    return mergeViceCleanupCandidateV1(
      result ?? routeFailure("emulator-launch-failure", "vice-launch", usage, wall()),
      observedCleanupCandidate,
    );
  }

  /** Proves process absence and retires one superseded attempt artifact before retry. */
  async #retireAttemptArtifact(
    handle: LeaseHandleState,
    cleanupGraceMs: number,
    hardDeadlineMonotonicMs: number,
  ): Promise<"retired" | "compatibility-unproven" | "blocked"> {
    const attempt = handle.record.attempt;
    if (attempt === null) return "retired";
    const cleanup = cleanupSignal(
      this.#host.nowMonotonicMilliseconds(),
      cleanupGraceMs,
      hardDeadlineMonotonicMs,
    );
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
    hardDeadlineMonotonicMs: number,
  ): Promise<boolean> {
    const signal = cleanupSignal(
      this.#host.nowMonotonicMilliseconds(),
      cleanupGraceMs,
      hardDeadlineMonotonicMs,
    );
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
      record.attempt.launchTokenPath !== viceLaunchTokenPathV1(record.uid, token) ||
      (record.child !== null &&
        (record.child.launchToken !== viceBytesToHexV1(token) ||
          record.child.launchTokenPath !== viceLaunchTokenPathV1(record.uid, token)))
    ) {
      return false;
    }
    handle.record = record;
    handle.reference = observed.value.reference;
    return true;
  }

  /** Requests termination only after revalidating the retained lease and process identity. */
  async #terminateLeaseProcess(
    handle: LeaseHandleState,
    cleanupGraceMs: number,
    hardDeadlineMonotonicMs: number,
    durableChildRequired: boolean,
  ): Promise<boolean> {
    const cleanup = cleanupSignal(
      this.#host.nowMonotonicMilliseconds(),
      cleanupGraceMs,
      hardDeadlineMonotonicMs,
    );
    const identityRecord = handle.record.child;
    if (identityRecord === null) return !durableChildRequired;
    const processObservation = await this.#host.observeProcess(
      identityRecord.pid,
      cleanup,
      identityRecord.launchTokenPath ?? undefined,
    );
    if (!processObservation.ok) return false;
    if (processObservation.value === null) return true;
    const processFact = processObservation.value;
    if (!processFactMatchesRecordV1(processFact, identityRecord)) return false;
    const request: ViceTerminationRequestV1 = Object.freeze({
      target: "c64",
      lease: handle.reference,
      process: processFact,
      generation: handle.record.generation,
      nonce: handle.record.nonce,
      phase: "graceful",
    });
    const terminated = await this.#host.revalidateAndTerminateVice(request, cleanup);
    if (!terminated.ok) return false;
    if (terminated.value !== "already-exited" && terminated.value !== "signalled") return false;
    const confirmed = await this.#host.observeProcess(
      identityRecord.pid,
      cleanup,
      identityRecord.launchTokenPath ?? undefined,
    );
    return confirmed.ok && confirmed.value === null;
  }

  /** Retires an exact lease only after its retained process is positively absent. */
  async #cleanupLease(
    handle: LeaseHandleState,
    cleanupGraceMs: number,
    hardDeadlineMonotonicMs: number,
    durableChildRequired: boolean,
    result: ExecutionResultV1,
  ): Promise<Extract<ExecutionTerminalCandidateV1, { readonly stage: "cleanup" }> | undefined> {
    if (
      !(await this.#terminateLeaseProcess(
        handle,
        cleanupGraceMs,
        hardDeadlineMonotonicMs,
        durableChildRequired,
      ))
    ) {
      return cleanupCandidate(
        result,
        digestViceLeaseBytesV1(encodeViceLeaseRecordV1(handle.record)),
      );
    }
    const cleanup = cleanupSignal(
      this.#host.nowMonotonicMilliseconds(),
      cleanupGraceMs,
      hardDeadlineMonotonicMs,
    );
    const removed = await this.#host.compareRemoveLease("c64", handle.reference, cleanup);
    return removed.ok && removed.value.kind === "removed"
      ? undefined
      : cleanupCandidate(result, digestViceLeaseBytesV1(encodeViceLeaseRecordV1(handle.record)));
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
