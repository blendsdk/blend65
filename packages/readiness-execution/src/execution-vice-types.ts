import type { ViceControlHostV1 } from "@blend65/test-harness/vice-control";
import type {
  ExecutionEmittedStoreV1,
  ExecutionInitialStateFixtureV1,
  ExecutionObservationLayoutV1,
  ExecutionObservationRequestV1,
  ExecutionOperationResultV1,
  ExecutionPolicyV1,
  ExecutionResultV1,
  PublishedRuntimeEvaluationAuthorityV1,
} from "@blend65/readiness";

/** Private nominal discriminator present only on genuine runtime-issued lease handles. */
export const VICE_LEASE_HANDLE_BRAND: unique symbol = Symbol("ViceLeaseHandleV1");

/** Opaque single-use authority to execute one C64 VICE route. */
export interface ViceLeaseHandleV1 {
  /** Nominal brand; callers cannot construct runtime authority from structural data. */
  readonly [VICE_LEASE_HANDLE_BRAND]: true;
}

/** Bounded read-only operator evidence for one observed lease generation. */
export interface ManualLeaseRecoveryV1 {
  /** Whether the claim is absent/clear, active, or unsafe to classify. */
  readonly state: "clear" | "active" | "ambiguous";
  /** Observed generation, or zero when no lease exists. */
  readonly generation: number;
  /** Observed nonce, or an empty string when no lease exists. */
  readonly nonce: string;
  /** Positive proof that no recorded process remains. */
  readonly childAbsent: boolean;
  /** SHA-256 digest of the bounded observed evidence. */
  readonly evidenceDigest: string;
}

/** Complete input required to execute one assembled binary through VICE. */
export interface ViceRouteRequestV1 {
  /** Assembled bytes loaded at `loadAddress`. */
  readonly binary: Uint8Array;
  /** First memory address receiving the binary. */
  readonly loadAddress: number;
  /** Program counter used to enter the generated envelope. */
  readonly entryAddress: number;
  /** Exact initial machine fixture. */
  readonly fixture: ExecutionInitialStateFixtureV1;
  /** Proven observation/completion memory layout. */
  readonly layout: ExecutionObservationLayoutV1;
  /** Observation projection to collect. */
  readonly observation: ExecutionObservationRequestV1;
  /** Cumulative execution budgets. */
  readonly policy: ExecutionPolicyV1;
}

/** One raw VICE route paired with readiness-owned comparison authority. */
export interface EvaluatedViceRouteRequestV1 {
  /** Non-authorizing binary, fixture, layout and budget request. */
  readonly route: ViceRouteRequestV1;
  /** Opaque single-use authority for the selected expected semantics. */
  readonly evaluation: PublishedRuntimeEvaluationAuthorityV1;
}

/** Private nominal discriminator present only on post-build route bindings. */
export const BOUND_EVALUATED_VICE_ROUTE_BRAND: unique symbol = Symbol("BoundEvaluatedViceRouteV1");

/** Opaque one-shot post-build binding for one genuine execution/evaluation pair. */
export interface BoundEvaluatedViceRouteRequestV1 {
  /** Nominal runtime brand; structural route records cannot manufacture a production binding. */
  readonly [BOUND_EVALUATED_VICE_ROUTE_BRAND]: true;
}

/** Passive proof emitted beside a sealed route without exposing mintable artifacts. */
export interface PreparedViceBuildEvidenceV1 {
  /** Digest of the cumulative bounded build evidence sealed into the production route. */
  readonly buildEvidenceDigest: string;
  readonly sourceCaseDigest: string;
  readonly binaryDigest: string;
  readonly loadAddress: number;
  readonly entryAddress: number;
  readonly layoutDigest: string;
  readonly prebuildIdentity: string;
  readonly finalExecutionIdentity: string;
  readonly routeIdentity: string;
  readonly postEntryStores: readonly ExecutionEmittedStoreV1[];
  readonly completionValueLoadInstructionAddress: number;
  readonly finalPostCallStoreInstructionAddress: number;
}

/** Sealed production request paired only with passive build evidence. */
export interface PreparedEvaluatedViceRouteV1 {
  readonly request: BoundEvaluatedViceRouteRequestV1;
  readonly evidence: PreparedViceBuildEvidenceV1;
}

/** Raw identity facts for one trusted filesystem node. */
export interface ViceLeaseNodeIdentityV1 {
  /** Filesystem device number. */
  readonly device: bigint;
  /** Filesystem inode number. */
  readonly inode: bigint;
  /** Numeric effective owner. */
  readonly uid: number;
  /** Permission bits without file-type flags. */
  readonly mode: number;
  /** Raw positive link count; exact equality is security-significant only for regular files. */
  readonly links: number;
}

/** Exact retained identity used by compare-and-swap lease mutations. */
export interface ViceLeaseReferenceV1 {
  /** Trusted directory identity. */
  readonly directory: ViceLeaseNodeIdentityV1;
  /** Trusted regular-file identity. */
  readonly file: ViceLeaseNodeIdentityV1;
  /** Lower-case SHA-256 of the observed bytes. */
  readonly bytesDigest: string;
}

/** Raw absent or present lease observation in the fixed target namespace. */
export type ViceLeaseSnapshotV1 =
  | { readonly kind: "absent"; readonly directory: ViceLeaseNodeIdentityV1 }
  | {
      readonly kind: "present";
      readonly directory: ViceLeaseNodeIdentityV1;
      readonly file: ViceLeaseNodeIdentityV1;
      readonly bytes: Uint8Array;
      readonly reference: ViceLeaseReferenceV1;
    };

/** Linux process identity facts sufficient to reject PID reuse. */
export interface ViceProcessIdentityFactV1 {
  /** Current Linux boot id. */
  readonly bootId: string;
  /** Positive PID. */
  readonly pid: number;
  /** `/proc` process start ticks. */
  readonly startTicks: bigint;
  /** Positive process group id. */
  readonly processGroupId: number;
  /** Exact launch token read from the owned token artifact, when present. */
  readonly launchToken: Uint8Array | null;
  /** Canonical no-follow launch-token artifact backing the token proof. */
  readonly launchTokenPath?: string | null;
}

/** Two distinct fresh loopback endpoints for one launch attempt. */
export interface ViceLoopbackEndpointsV1 {
  /** Binary-monitor port. */
  readonly binaryPort: number;
  /** Text-monitor port. */
  readonly textPort: number;
}

/** Exact authority and shell-free process request for one constrained launch. */
export interface ViceRecordedAttemptV1 {
  /** Fixed target namespace. */
  readonly target: "c64";
  /** Exact lease claim that must be updated before exec. */
  readonly claim: ViceLeaseReferenceV1;
  /** Exact lease generation. */
  readonly generation: number;
  /** Exact lease nonce. */
  readonly nonce: string;
  /** Fresh 32-byte launch token. */
  readonly launchToken: Uint8Array;
  /** Canonical fixed-namespace launch-token artifact. */
  readonly launchTokenPath: string;
  /** Fresh monitor endpoints. */
  readonly endpoints: ViceLoopbackEndpointsV1;
  /** Fixed VICE executable. */
  readonly executable: string;
  /** Exact argument vector. */
  readonly argv: readonly string[];
  /** Fixed working directory. */
  readonly cwd: string;
}

/** Narrow request for exact-identity graceful or forced child cleanup. */
export interface ViceTerminationRequestV1 {
  /** Fixed target namespace. */
  readonly target: "c64";
  /** Exact lease bytes and inode to revalidate immediately before signalling. */
  readonly lease: ViceLeaseReferenceV1;
  /** Exact boot/PID/start/group/token identity to revalidate. */
  readonly process: ViceProcessIdentityFactV1;
  /** Expected lease generation. */
  readonly generation: number;
  /** Expected lease nonce. */
  readonly nonce: string;
  /** Fixed supported termination step. */
  readonly phase: "graceful" | "forced";
}

/** Closed outcomes from exact lease compare-and-swap operations. */
export type ViceLeaseMutationV1 =
  | { readonly kind: "created" | "replaced"; readonly snapshot: ViceLeaseSnapshotV1 }
  | { readonly kind: "occupied" | "changed" | "missing" | "removed" };

/** Least-authority host boundary for the fixed Linux VICE namespace. */
export interface ViceExecutionHostV1 {
  /** Returns supported Linux status without lease mutation. */
  platform(signal: AbortSignal): Promise<ExecutionOperationResultV1<"linux" | "unsupported">>;
  /** Returns the effective numeric user id. */
  effectiveUid(signal: AbortSignal): Promise<ExecutionOperationResultV1<number>>;
  /** Reads a monotonic millisecond clock. */
  nowMonotonicMilliseconds(): number;
  /** Performs an abort-aware delay. */
  delay(milliseconds: number, signal: AbortSignal): Promise<"elapsed" | "aborted">;
  /** Returns exactly 32 cryptographically random bytes. */
  randomBytes(byteLength: 32): Uint8Array;
  /** Observes raw bounded bytes and node facts in the fixed target namespace. */
  observeLease(
    target: "c64",
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceLeaseSnapshotV1>>;
  /** Atomically creates a lease only under the retained trusted directory. */
  tryCreateLease(
    target: "c64",
    expectedDirectory: ViceLeaseNodeIdentityV1,
    bytes: Uint8Array,
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceLeaseMutationV1>>;
  /** Replaces only the exact retained lease bytes and node identity. */
  compareReplaceLease(
    target: "c64",
    expected: ViceLeaseReferenceV1,
    bytes: Uint8Array,
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceLeaseMutationV1>>;
  /** Removes only the exact retained lease bytes and node identity. */
  compareRemoveLease(
    target: "c64",
    expected: ViceLeaseReferenceV1,
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceLeaseMutationV1>>;
  /** Removes one exact superseded launch artifact only while retaining the lease claim. */
  compareRemoveLaunchArtifact?(
    target: "c64",
    expected: ViceLeaseReferenceV1,
    launchTokenPath: string,
    expectedProcess: ViceProcessIdentityFactV1 | null,
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<"removed" | "missing" | "changed" | "process-present">>;
  /** Reads raw Linux process and token identity for one positive PID. */
  observeProcess(
    pid: number,
    signal: AbortSignal,
    launchTokenPath?: string,
  ): Promise<ExecutionOperationResultV1<ViceProcessIdentityFactV1 | null>>;
  /** Reserves two fresh distinct loopback endpoints. */
  allocateLoopbackEndpoints(
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceLoopbackEndpointsV1>>;
  /** Creates one constrained record-then-exec raw control host. */
  createControlAttempt(
    attempt: ViceRecordedAttemptV1,
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceControlHostV1>>;
  /** Revalidates exact lease/process identity before a fixed termination step. */
  revalidateAndTerminateVice(
    request: ViceTerminationRequestV1,
    signal: AbortSignal,
  ): Promise<
    ExecutionOperationResultV1<
      "signalled" | "already-exited" | "lease-changed" | "identity-changed"
    >
  >;
}

/** One isolated coordinator and private handle registry. */
export interface ViceExecutionRuntimeV1 {
  /** Acquires one host-wide exclusive lease. */
  acquireViceLease(
    target: "c64",
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceLeaseHandleV1>>;
  /** Inspects bounded recovery evidence without mutation or signalling. */
  inspectViceLease(
    target: "c64",
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ManualLeaseRecoveryV1>>;
  /** Clears only an exact inspected generation after proving the process absent. */
  clearViceLeaseGeneration(
    target: "c64",
    generation: number,
    nonce: string,
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<true>>;
  /** Consumes a genuine fresh handle to run one cumulative-budget VICE route. */
  executeViceRoute(
    request: ViceRouteRequestV1,
    lease: ViceLeaseHandleV1,
    signal: AbortSignal,
  ): Promise<ExecutionResultV1>;
  /** Executes one route and privately compares its actual bytes through readiness authority. */
  executeEvaluatedViceRoute(
    request: EvaluatedViceRouteRequestV1,
    lease: ViceLeaseHandleV1,
    signal: AbortSignal,
  ): Promise<ExecutionResultV1>;
}
