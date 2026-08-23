# Component Design: VICE Control and Lease

> **Document**: 03-06-vice-control-lease.md
> **Parent**: [Index](00-index.md)
> **Decisions**: AR-P4, AR-P8, AR-P11

## Responsibility

Reuse the live-verified VICE monitor protocols while adding cancellation, exclusive ownership,
positive process identity, crash recovery and cumulative runtime budgets.

## Control subpath

`@blend65/test-harness/vice-control` exports the binary/text transports, validated instruction
codec, composite target/version handshake and a cancellable launch/session surface. A versioned
runtime factory accepts only raw spawn/owned-child, fragmented loopback-channel, monotonic-time and
endpoint-owner facts; framing, parsing, correlation and policy remain production-owned. Existing
root `ViceDriver` wraps the default runtime so its public API, exact monitor argv ordering and
emulator suites remain compatible. Readiness-execution owns policy, lease, identity, endpoint
allocation, multi-child retry, deadline and evidence collection.

## Durable lease record

The lease lives in the host-wide effective-UID-owned target directory defined by the filesystem
safety contract. Directory link count is retained as a positive raw fact but excluded from exact
directory identity because POSIX counts directory topology; the regular lease file must have
exactly one link. The checksummed, generation-numbered mode-`0600` record contains schema, lifecycle state, Linux boot ID, owner
PID/start ticks, lease nonce, pre-launch token and canonical token-artifact path, child PID/start
ticks when known, two endpoints and timestamps. Acquisition uses an atomic create for a free lease.
Recovery first fences the observed generation, proves the owner dead in the same boot, and handles
the child according to its recorded lifecycle.

Record-v1 bytes are canonical security state. The payload is compact UTF-8 JSON with no BOM,
whitespace or trailing newline and keys in this exact order: `schema`, `target`, `generation`,
`nonce`, `uid`, `acquiredAtMs`, `updatedAtMs`, `lifecycle`, `owner`, `attempt`, `child`. Nullable
fields remain present. A process record orders `bootId`, `pid`, decimal-string `startTicks`,
`processGroupId`, `launchToken`, `launchTokenPath`; an attempt orders `launchToken`, `binaryPort`,
`textPort`, `launchTokenPath`. `checksum` is lower-case SHA-256 of those exact payload JSON bytes
without a checksum field. Final bytes serialize the same ordered payload followed by `checksum` as
the last key. Any incompatible field/order/checksum change requires a new record schema revision.

VICE starts through a same-PID record-then-exec launcher. After fork, the launcher durably records
its own PID, start ticks, process group, generation, nonce and token, then calls `process.execve` to
replace itself with VICE. VICE therefore cannot exist without the exact child identity already on
disk. Runtime support for `process.execve` is feature-gated; a pinned Node runtime without it
returns `tier-unavailable`. Crashes before record, after record and after exec have
distinct recoverable states. Before any graceful or forced signal, recovery rereads the lease and
positively matches boot ID, `/proc/<pid>/stat` start time, process group, token artifact and current
generation/nonce. PID, port, argv substring or process discovery alone is never enough.
Ambiguity returns `emulator-lease-recovery-blocked`, retains the lease and reports a bounded manual
recovery action. Normal cleanup clears only an exact generation/nonce match.

Lease handles are runtime capabilities, not structural records. The module creates a frozen object
carrying a private brand and keeps its generation, nonce, record digest, owning coordinator and
state in a module-private `WeakMap`. Acquisition registers exactly one active handle per target.
Only the acquiring coordinator may consume it, exactly once, for `executeViceRouteV1`; execution
marks it consumed before any asynchronous work begins. Plain objects, copied fields, handles from
another coordinator, stale generations, concurrent reuse and second use all fail before launch or
monitor access. Cleanup and guarded release remain parent-owned even after the handle is consumed.

A versioned `createViceExecutionRuntimeV1(host?)` factory owns one private coordinator and handle
registry. The global functions below delegate to one module singleton. Different runtimes still
contend through the same fixed host-wide lease namespace; in-memory state is never the exclusion
authority. A runtime admits only one mutation at a time and rejects a concurrent mutation with
`execution.stale-authority` rather than queueing it. A handle is bound to its creating runtime and
transitions `fresh → executing → consumed`; every terminal execution outcome consumes it.

The supported operator path has two operations. Inspection returns bounded
`ManualLeaseRecoveryV1` evidence and never mutates or signals. Guarded clear requires the exact
generation and nonce from inspection, revalidates the trusted lease directory and record, and
positively proves the child absent before atomically removing that exact generation. Changed or
ambiguous state fails closed. Instructions never recommend raw lease deletion or PID-only signals.

Version 1 supports Linux with readable boot ID and `/proc` start identity. Other or restricted
hosts report VICE `tier-unavailable`; they cannot fall back to PID-only recovery.

The injectable host is a production embedding boundary, not a debug/test kit. It exposes the fixed
namespace's raw lease bytes and directory/file identity facts, exact compare-and-swap mutations,
raw Linux process/token identity, random bytes, monotonic time, fresh endpoint facts, and one
constrained record-then-exec control host per attempt. The constrained host validates the exact
declared executable/argv/cwd, durably records its own PID/start/token before `execve`, and then
becomes VICE without changing PID. Termination accepts no caller PID or arbitrary signal: it
reopens the exact lease and identity immediately before a fixed graceful or forced operation.
Record parsing, lifecycle decisions, retry, budgets and expected outcomes remain production-owned.

## Launch and handshake

Each route attempt reserves two distinct loopback-only endpoints and calls the low-level control
exactly once. That call launches one child, performs at most 60 connection rounds 250 ms apart
inside the inclusive 15-second launch-attempt deadline, and never respawns or changes ports. The
composite handshake requires API-v2 binary framing, the core `A/X/Y/SP/PC/FL` registers, a major-3
`VICE_INFO` response inside the caller's closed minor range, an integer
`RESOURCE_GET("VICIIModel")`, one anchored text-monitor stopwatch reply and—when readiness
authority is requested—positive Linux proof that both listener socket inodes belong to the owned
child identity. The legacy wrapper uses VICE 3.6+ compatibility mode; readiness authority requires
exactly VICE 3.10 and owned endpoints. Connection, ownership, target, version and protocol failures
have distinct stable reason discriminators.

A low-level failure returns after that one child attempt. Readiness-execution then consumes one of
at most eight attempts, obtains fresh endpoints and retries under the common route deadline. A live
mismatched child is terminated only after identity revalidation.

## Runtime loop

1. Load the accepted binary and establish/read back the target fixture.
2. Set the program counter, stop the machine and sample a per-child absolute stopwatch baseline.
3. Arm a temporary STORE checkpoint on the exact completion address, then greedily decompose the
   remaining instruction allowance into 65,535-instruction chunks plus one remainder. Validate
   every wire count in `1..65535` without masking and charge the full requested chunk before
   submission.
4. Before each chunk and observation, evaluate instruction exhaustion before cycle exhaustion;
   record both totals when both are exhausted.
5. Accept completion only when the checkpoint response names the exact address and STORE operation
   and immediate readback is `0xA5`; stop timing and read the declared actual bytes or direct MMIO
   observable. A mismatched checkpoint or readback is non-passing.
6. Cancel pending commands, close transports and terminate the owned child during cleanup.

Totals above 65,535 are decomposed without truncation or wrap. Completion not reached within a
budget receives the applicable stable exhaustion code. The wall watchdog can terminate any pending
monitor request. Cycle usage is the monotonic delta from the stopped-machine baseline. A restart
adds the completed child's delta to the route total before taking a new baseline; counter decrease,
missing sample or unrecorded child-identity change fails closed. The STORE-checkpoint timing,
committed `$A5` readback and post-return no-mutation behavior must be proven on real VICE 3.10
before this route can authorize publication.

Every runtime operation accepts an `AbortSignal`. A pre-aborted operation performs no lease,
endpoint, spawn or monitor mutation. Once cancellation is observed no new ordinary work starts;
pending control work is cancelled, but exact-generation cleanup runs under a private bounded
cleanup signal rather than the aborted caller signal. Attempts, requested instruction chunks,
stopwatch deltas and monotonic wall time are charged before work and are never refunded or reset by
failure, cancellation or retry.

Short-lived supervised tools retain the same exact non-null Linux identity contract. The dedicated
anchor captures boot ID, PID, start ticks, process group and session synchronously from procfs
immediately after `spawn()` returns, before yielding to the event loop, and then confirms the normal
spawn result. Spawn errors discard the capture. Any later identity or cancellation failure cleans
the whole anchor-owned group and proves descendant absence; killing only the direct child is not a
sufficient cleanup result.

## Local authority proof

The mandatory local suite uses real ACME and VICE 3.10 to verify loopback handshakes, exact process
lifecycle, `$D020..$D022` high-nibble projection, direct and computed word starts, and one selected
case for each of `peek`, `peekw`, `poke` and `pokew`. CI-safe codec/lease/fake-process tests still
run when tools are absent, but absence cannot select publication authority.

## Specification-visible TypeScript interface

`@blend65/test-harness/vice-control` exports only low-level control and a least-authority raw host
factory. The host exchanges fragmented bytes and OS facts only; it cannot inject parsed frames,
checkpoint events, handshake decisions or policy results.

```ts
export interface ViceControlLaunchV1 {
  readonly executable: string;
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly endpoints: {
    readonly binaryPort: number;
    readonly textPort: number;
  };
  readonly handshake: {
    readonly target: 'c64';
    readonly version: {
      readonly major: 3;
      readonly minimumMinor: number;
      readonly maximumMinor: number;
    };
    readonly endpointOwnership: 'required' | 'compatibility';
  };
}
export interface ViceCheckpointHitV1 {
  readonly checkpointId: number;
  readonly address: number;
  readonly operation: 'load' | 'store' | 'execute';
}
export interface ViceControlIssueV1 {
  readonly code: 'vice.protocol' | 'vice.cancelled' | 'vice.closed' | 'vice.io';
  readonly reason:
    | 'vice.request'
    | 'vice.spawn'
    | 'vice.connect'
    | 'vice.child-exited'
    | 'vice.endpoint-owner'
    | 'vice.binary-handshake'
    | 'vice.text-handshake'
    | 'vice.target'
    | 'vice.version'
    | 'vice.frame'
    | 'vice.cancelled'
    | 'vice.closed'
    | 'vice.transport';
  readonly message: string;
}
export type ViceControlResultV1<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issue: ViceControlIssueV1 };
export interface ViceControlSessionV1 {
  loadBinary(bytes: Uint8Array, address: number): Promise<ViceControlResultV1<true>>;
  readMemory(address: number, length: number): Promise<ViceControlResultV1<Uint8Array>>;
  writeMemory(address: number, bytes: Uint8Array): Promise<ViceControlResultV1<true>>;
  setProgramCounter(address: number): Promise<ViceControlResultV1<true>>;
  setCheckpoint(
    address: number,
    operation: 'load' | 'store' | 'execute',
  ): Promise<ViceControlResultV1<number>>;
  advanceInstructions(count: number): Promise<ViceControlResultV1<ViceCheckpointHitV1 | null>>;
  readStopwatch(): Promise<ViceControlResultV1<bigint>>;
  cancelPending(): Promise<ViceControlResultV1<true>>;
  close(): Promise<ViceControlResultV1<true>>;
}
export interface ViceControlRawChannelV1 {
  write(bytes: Uint8Array): Promise<ViceControlResultV1<true>>;
  read(): Promise<ViceControlResultV1<Uint8Array | null>>;
  close(): Promise<ViceControlResultV1<true>>;
}
export interface ViceControlOwnedChildV1 {
  readonly identity: string;
  readonly exited: Promise<{ readonly code: number | null; readonly signal: string | null }>;
}
export interface ViceControlHostV1 {
  nowMilliseconds(): number;
  delay(milliseconds: number, signal: AbortSignal): Promise<'elapsed' | 'aborted'>;
  spawn(
    request: Pick<ViceControlLaunchV1, 'executable' | 'argv' | 'cwd'>,
    signal: AbortSignal,
  ): Promise<ViceControlResultV1<ViceControlOwnedChildV1>>;
  connectLoopback(
    role: 'binary' | 'text',
    port: number,
    signal: AbortSignal,
  ): Promise<ViceControlResultV1<ViceControlRawChannelV1>>;
  endpointBelongsToChild(
    child: ViceControlOwnedChildV1,
    role: 'binary' | 'text',
    port: number,
  ): Promise<ViceControlResultV1<boolean>>;
  closeOwnedChild(child: ViceControlOwnedChildV1): Promise<ViceControlResultV1<true>>;
}
export interface ViceControlRuntimeV1 {
  launch(
    request: ViceControlLaunchV1,
    signal: AbortSignal,
  ): Promise<ViceControlResultV1<ViceControlSessionV1>>;
}
export function createViceControlRuntimeV1(host?: ViceControlHostV1): ViceControlRuntimeV1;
export function launchViceControlV1(
  request: ViceControlLaunchV1,
  signal: AbortSignal,
): Promise<ViceControlResultV1<ViceControlSessionV1>>;
```

`@blend65/readiness-execution` exports lease and runtime policy:

```ts
declare const VICE_LEASE_HANDLE_BRAND: unique symbol;
export interface ViceLeaseHandleV1 {
  readonly [VICE_LEASE_HANDLE_BRAND]: true;
}
export interface ManualLeaseRecoveryV1 {
  readonly state: 'clear' | 'active' | 'ambiguous';
  readonly generation: number;
  readonly nonce: string;
  readonly childAbsent: boolean;
  readonly evidenceDigest: string;
}
export interface ViceRouteRequestV1 {
  readonly binary: Uint8Array;
  readonly loadAddress: number;
  readonly entryAddress: number;
  readonly fixture: ExecutionInitialStateFixtureV1;
  readonly layout: ExecutionObservationLayoutV1;
  readonly observation: ExecutionObservationRequestV1;
  readonly policy: ExecutionPolicyV1;
}
export interface EvaluatedViceRouteRequestV1 {
  readonly route: ViceRouteRequestV1;
  readonly evaluation: PublishedRuntimeEvaluationAuthorityV1;
}
export interface ViceLeaseNodeIdentityV1 {
  readonly device: bigint;
  readonly inode: bigint;
  readonly uid: number;
  readonly mode: number;
  readonly links: number;
}
export interface ViceLeaseReferenceV1 {
  readonly directory: ViceLeaseNodeIdentityV1;
  readonly file: ViceLeaseNodeIdentityV1;
  readonly bytesDigest: string;
}
export type ViceLeaseSnapshotV1 =
  | { readonly kind: 'absent'; readonly directory: ViceLeaseNodeIdentityV1 }
  | {
      readonly kind: 'present';
      readonly directory: ViceLeaseNodeIdentityV1;
      readonly file: ViceLeaseNodeIdentityV1;
      readonly bytes: Uint8Array;
      readonly reference: ViceLeaseReferenceV1;
    };
export interface ViceProcessIdentityFactV1 {
  readonly bootId: string;
  readonly pid: number;
  readonly startTicks: bigint;
  readonly processGroupId: number;
  readonly launchToken: Uint8Array | null;
}
export interface ViceLoopbackEndpointsV1 {
  readonly binaryPort: number;
  readonly textPort: number;
}
export interface ViceRecordedAttemptV1 {
  readonly target: 'c64';
  readonly claim: ViceLeaseReferenceV1;
  readonly generation: number;
  readonly nonce: string;
  readonly launchToken: Uint8Array;
  readonly endpoints: ViceLoopbackEndpointsV1;
  readonly executable: string;
  readonly argv: readonly string[];
  readonly cwd: string;
}
export interface ViceTerminationRequestV1 {
  readonly target: 'c64';
  readonly lease: ViceLeaseReferenceV1;
  readonly process: ViceProcessIdentityFactV1;
  readonly generation: number;
  readonly nonce: string;
  readonly phase: 'graceful' | 'forced';
}
export type ViceLeaseMutationV1 =
  | { readonly kind: 'created' | 'replaced'; readonly snapshot: ViceLeaseSnapshotV1 }
  | { readonly kind: 'occupied' | 'changed' | 'missing' | 'removed' };
export interface ViceExecutionHostV1 {
  platform(signal: AbortSignal): Promise<ExecutionOperationResultV1<'linux' | 'unsupported'>>;
  effectiveUid(signal: AbortSignal): Promise<ExecutionOperationResultV1<number>>;
  nowMonotonicMilliseconds(): number;
  delay(milliseconds: number, signal: AbortSignal): Promise<'elapsed' | 'aborted'>;
  randomBytes(byteLength: 32): Uint8Array;
  observeLease(
    target: 'c64',
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceLeaseSnapshotV1>>;
  tryCreateLease(
    target: 'c64',
    expectedDirectory: ViceLeaseNodeIdentityV1,
    bytes: Uint8Array,
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceLeaseMutationV1>>;
  compareReplaceLease(
    target: 'c64',
    expected: ViceLeaseReferenceV1,
    bytes: Uint8Array,
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceLeaseMutationV1>>;
  compareRemoveLease(
    target: 'c64',
    expected: ViceLeaseReferenceV1,
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceLeaseMutationV1>>;
  observeProcess(
    pid: number,
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceProcessIdentityFactV1 | null>>;
  allocateLoopbackEndpoints(
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceLoopbackEndpointsV1>>;
  createControlAttempt(
    attempt: ViceRecordedAttemptV1,
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceControlHostV1>>;
  revalidateAndTerminateVice(
    request: ViceTerminationRequestV1,
    signal: AbortSignal,
  ): Promise<
    ExecutionOperationResultV1<
      'signalled' | 'already-exited' | 'lease-changed' | 'identity-changed'
    >
  >;
}
export interface ViceExecutionRuntimeV1 {
  acquireViceLease(
    target: 'c64',
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceLeaseHandleV1>>;
  inspectViceLease(
    target: 'c64',
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ManualLeaseRecoveryV1>>;
  clearViceLeaseGeneration(
    target: 'c64',
    generation: number,
    nonce: string,
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<true>>;
  executeViceRoute(
    request: ViceRouteRequestV1,
    lease: ViceLeaseHandleV1,
    signal: AbortSignal,
  ): Promise<ExecutionResultV1>;
  executeEvaluatedViceRoute(
    request: EvaluatedViceRouteRequestV1,
    lease: ViceLeaseHandleV1,
    signal: AbortSignal,
  ): Promise<ExecutionResultV1>;
}
export function createViceExecutionRuntimeV1(
  host?: ViceExecutionHostV1,
): ViceExecutionRuntimeV1;
export function acquireViceLeaseV1(
  target: 'c64',
  signal: AbortSignal,
): Promise<ExecutionOperationResultV1<ViceLeaseHandleV1>>;
export function inspectViceLeaseV1(
  target: 'c64',
  signal: AbortSignal,
): Promise<ExecutionOperationResultV1<ManualLeaseRecoveryV1>>;
export function clearViceLeaseGenerationV1(
  target: 'c64',
  generation: number,
  nonce: string,
  signal: AbortSignal,
): Promise<ExecutionOperationResultV1<true>>;
export function executeViceRouteV1(
  request: ViceRouteRequestV1,
  lease: ViceLeaseHandleV1,
  signal: AbortSignal,
): Promise<ExecutionResultV1>;
export function executeEvaluatedViceRouteV1(
  request: EvaluatedViceRouteRequestV1,
  lease: ViceLeaseHandleV1,
  signal: AbortSignal,
): Promise<ExecutionResultV1>;
```

`executeViceRouteV1` remains the non-authorizing Phase 4 control substrate and never establishes a
semantic pass for publication. The evaluated entrypoint first authenticates that the opaque
authority's passive fixture and observation equal the route, then privately collects actual bytes,
invokes readiness evaluation exactly once and maps only `match` to a pass. Any invalid authority,
projection mismatch or evaluation failure is terminal; raw observations never cross the public
result boundary.
