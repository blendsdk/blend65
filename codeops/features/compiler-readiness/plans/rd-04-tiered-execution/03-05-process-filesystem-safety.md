# Component Design: Process and Filesystem Safety

> **Document**: 03-05-process-filesystem-safety.md
> **Parent**: [Index](00-index.md)
> **Decisions**: AR-P10, AR-P18, AR-P29

## Responsibility

Provide one route-wide lifecycle owner for temporary files, compiler workers, child processes,
streaming evidence, deadlines, monitor commands and cleanup. Resource exhaustion must stay bounded
and deterministic even when a dependency hangs or floods output.

## Case workspace

Each execution allocates a unique mode-`0700` canonical root and opens it through verified handles.
Inputs are relative lexical paths whose components are allowlisted; absolute paths, empty
components, `.`/`..`, symlinks and special files are rejected before reading, writing or spawning.
Artifact validation rechecks canonical containment and regular-file identity after each external
tool returns. Cleanup removes only the positively owned case root on every outcome.

The VICE lease is intentionally outside the case root. Linux uses one host-wide target-keyed root
under the effective user's runtime directory, canonicalized and proven owned by the effective UID
with mode `0700`. Every path component is opened without following links and must be a directory
with a positive raw link count and retained device/inode/UID/mode identity; directory link-count
changes alone are topology churn, not identity changes. Lease files are regular files with exactly
one link and mode `0600`; bounded reads and writes use no-follow handles, atomic same-directory
replacement and directory sync. A symlink, hard-linked lease file, special file, ownership/mode
mismatch or replacement race fails closed. Repository-local or per-case lease paths are forbidden
because they do not coordinate other clones on the same host.

## Child supervision

ACME launches through a package-owned persistent Node anchor, never a shell string. The anchor is
the detached PID/PGID/SID leader, authenticates a closed nonce/sequence IPC protocol, and spawns the
requested executable plus argv non-detached into its group. Only the still-live anchor may signal
the group, using `process.kill(0, signal)` from inside its pinned membership; the parent never sends
a negative-PGID signal. The anchor remains alive after target exit until bounded membership
inspection proves the group empty. Control loss, malformed protocol, ambiguous identity or absence
proof failure blocks cleanup without fallback signaling. Graceful then forced termination remains
inside the fixed cleanup grace, and the public completion relays the requested target's exit.
Worker threads use an equivalent parent-owned cancellation protocol and are terminated at deadline.

## Streaming evidence

One collector continuously drains, counts and hashes stdout and stderr independently, including
after retained samples fill. The selected `outputBytes` limit is genuinely aggregate: the
monotonic sum `stdout.totalBytes + stderr.totalBytes` may equal the selected limit and the first
subsequent byte irreversibly selects `output-exhaustion`, regardless of stream. It is never split
into per-stream failure budgets. Each stream stores a deterministic bounded head/tail sample,
total byte count, truncation flag and SHA-256 of every byte observed for that stream;
authoritative serialization is always stdout then stderr. Cross-stream callback arrival order is
never hashed or retained as authority. A finite process whose two streams are fully drained must
therefore reproduce complete independent stream evidence. For a process terminated while it is
still flooding, only the stable exhaustion code, configured aggregate limit and cleanup proof are
authority. Every sample, count and hash from that terminated flood is diagnostic because even the
stream composition at the threshold depends on scheduler interleaving; it is excluded from the
authority-report digest and is not required to be byte-identical. Optional arrival telemetry is
explicitly non-authoritative.
All serialized artifacts and metadata
are charged lazily to one 16 MiB per-case ledger; overflow discards passing evidence and returns the
stable limit code. Declared maxima are never eagerly allocated.

## Deadlines and counters

A monotonic hard route deadline encloses compilation, assembly, every launch attempt, runtime,
observation and cleanup. Child-capable policies are rejected unless `routeMs > cleanupGraceMs`.
Ordinary work receives a cancellation deadline at `hardRouteDeadline - cleanupGraceMs`; the final
fixed grace is reserved exclusively for graceful/forced cleanup. Each operation receives
`min(stageLimit, remainingWorkTime)`. Attempts,
instructions and cycles are cumulative across retries. Exact-bound consumption succeeds; the next
consuming event fails. A fired asynchronous wall watchdog is terminal before return even if another
result becomes ready concurrently. Work never starts when the cleanup reserve cannot still fit.

Sealed build preparation and later VICE control are one route for these limits. The opaque handoff
retains the original absolute deadlines, cumulative output/evidence use and build-evidence digest;
it never grants a fresh policy allowance. A caller cancellation may shorten the remaining time but
cannot extend it. Final public usage and evidence combine both halves of the route.

## Ownership state machine

The top-level scope owns resources in acquisition order and releases them in reverse order:

```text
case root → evidence ledger → workers/ACME → VICE lease → endpoints → child → monitors → checkpoints
```

Cleanup is idempotent and records bounded cleanup evidence without replacing an earlier operational
terminal stage. Inability to prove safe VICE termination retains the lease and attaches a mandatory
`cleanupBlocker`; a provisional pass is replaced by `emulator-lease-recovery-blocked`, while an
earlier failure remains primary. Build-supervisor cleanup follows the same precedence: its bounded
cleanup issue is appended after an earlier operational issue rather than discarded. Any cleanup
blocker prevents authority. Pending monitor promises and checkpoints are actively cancelled.

## Security validation

Tests attempt traversal, absolute paths, symlink swaps, FIFOs/devices, shell metacharacters,
argument injection, stdout/stderr floods, worker hangs, child-tree leaks and cleanup races. No test
may use a path supplied by generated source as a host path or subprocess argument.

This is a local developer tool with no user accounts, public endpoint, remote network, database,
credential, PII, container or deployment surface. Authentication, authorization, CSRF/CORS, public
rate limiting, TLS and encryption-at-rest controls are therefore not applicable. Local denial of
service is controlled by the closed budgets, exclusive VICE lease and bounded evidence described
above; no secret or environment value enters reports.

## Specification-visible TypeScript interface

The following declarations are exported from `@blend65/readiness-execution`:

```ts
export interface ExecutionCaseWorkspaceV1 {
  readonly root: string;
  readonly identity: { readonly device: bigint; readonly inode: bigint; readonly uid: number };
  resolveRegularFile(relativePath: string): Promise<string>;
  dispose(): Promise<void>;
}
export interface ExecutionStreamEvidenceV1 {
  readonly stream: 'stdout' | 'stderr';
  readonly totalBytes: number;
  readonly sha256: string;
  readonly head: Uint8Array;
  readonly tail: Uint8Array;
  readonly truncated: boolean;
}
export interface ExecutionProcessEvidenceV1 {
  readonly stdout: ExecutionStreamEvidenceV1;
  readonly stderr: ExecutionStreamEvidenceV1;
}
export type ExecutionAuthoritativeProcessEvidenceV1 =
  | {
      readonly kind: 'finite-streams';
      readonly stdout: ExecutionStreamEvidenceV1;
      readonly stderr: ExecutionStreamEvidenceV1;
    }
  | {
      readonly kind: 'terminated-output-exhaustion';
      readonly code: 'output-exhaustion';
      readonly configuredLimit: number;
      readonly cleanupDigest: string;
    };
export interface ExecutionDeadlineV1 {
  readonly hardDeadlineMs: number;
  readonly workDeadlineMs: number;
  readonly cleanupGraceMs: number;
}
export interface ExecutionProcessRequestV1 {
  readonly executable: string;
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly deadline: ExecutionDeadlineV1;
}
export const EXECUTION_PROCESS_KERNEL_LIMITS_V1 = Object.freeze({
  controlFrameBytes: 8_388_608,
  controlBytesPerDirection: 16_777_216,
  controlFramesPerDirection: 16,
  nonceBytes: 32,
  executableBytes: 65_536,
  cwdBytes: 65_536,
  argvItems: 1_024,
  argumentBytes: 65_536,
  argvBytes: 524_288,
  environmentEntries: 3,
  environmentBytes: 131_072,
  protocolMessageBytes: 4_096,
} as const);
export interface ExecutionProcessEnvironmentV1 {
  readonly LANG: 'C';
  readonly LC_ALL: 'C';
  readonly TZ: 'UTC';
}
export interface ExecutionHostProcessIdentityV1 {
  readonly bootId: string;
  readonly pid: number;
  readonly startTicks: bigint;
  readonly processGroupId: number;
  readonly sessionId: number;
}
export interface ExecutionProcessWireIdentityV1 {
  readonly bootId: string;
  readonly pid: number;
  readonly startTicks: string;
  readonly processGroupId: number;
  readonly sessionId: number;
}
export type ExecutionHostProcessExitV1 =
  | { readonly kind: 'exit'; readonly exitCode: number }
  | { readonly kind: 'signal'; readonly signal: NodeJS.Signals }
  | { readonly kind: 'crash'; readonly code: 'spawn' | 'io'; readonly message: string };
export type ExecutionControlReadV1 =
  | { readonly kind: 'frame'; readonly bytes: Uint8Array }
  | { readonly kind: 'eof' }
  | { readonly kind: 'crash'; readonly code: 'io'; readonly message: string };
export interface ExecutionProcessControlTransportV1 {
  sendFrame(bytes: Uint8Array, cancellation: ExecutionCancellationV1): Promise<ExecutionOperationResultV1<void>>;
  receiveFrame(cancellation: ExecutionCancellationV1): Promise<ExecutionControlReadV1>;
  close(cancellation: ExecutionCancellationV1): Promise<ExecutionOperationResultV1<void>>;
}
export interface ExecutionProcessAnchorTransportV1
  extends ExecutionProcessControlTransportV1,
    ExecutionProcessSinkV1 {}
export type ExecutionGroupMembershipV1 =
  | { readonly kind: 'absent' }
  | { readonly kind: 'present'; readonly witness: ExecutionHostProcessIdentityV1 }
  | { readonly kind: 'recycled'; readonly witness: ExecutionHostProcessIdentityV1 }
  | { readonly kind: 'unknown'; readonly reason: 'io' | 'permission' | 'limit' | 'malformed' };
export interface ExecutionGroupMembershipQueryV1 {
  readonly revision: 'execution-group-membership-query-v1';
  readonly anchor: ExecutionHostProcessIdentityV1;
  readonly scope: 'including-anchor' | 'excluding-anchor';
}
export interface ExecutionAnchorSpawnInputV1 {
  readonly revision: 'execution-anchor-spawn-v1';
  readonly executable: string;
  readonly argv: readonly [string];
  readonly cwd: string;
  readonly environment: ExecutionProcessEnvironmentV1;
  readonly detached: true;
  readonly shell: false;
  readonly stdio: 'ignore-output-control-pipes';
}
export interface ExecutionSpawnedAnchorV1 {
  readonly identity: ExecutionHostProcessIdentityV1;
  readonly control: ExecutionProcessControlTransportV1;
  readonly completion: Promise<ExecutionHostProcessExitV1>;
}
export interface ExecutionProcessParentHostV1 {
  randomBytes(byteLength: 32): Uint8Array;
  spawnAnchor(input: ExecutionAnchorSpawnInputV1, sink: ExecutionProcessSinkV1, cancellation: ExecutionCancellationV1): Promise<ExecutionOperationResultV1<ExecutionSpawnedAnchorV1>>;
  observeGroup(input: ExecutionGroupMembershipQueryV1, cancellation: ExecutionCancellationV1): Promise<ExecutionGroupMembershipV1>;
}
export interface ExecutionTargetSpawnInputV1 {
  readonly revision: 'execution-target-spawn-v1';
  readonly executable: string;
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly environment: ExecutionProcessEnvironmentV1;
  readonly detached: false;
  readonly shell: false;
  readonly stdio: 'ignore-output-pipes';
}
export interface ExecutionSpawnedTargetV1 {
  readonly identity: ExecutionHostProcessIdentityV1;
  readonly completion: Promise<ExecutionHostProcessExitV1>;
}
export interface ExecutionSelfGroupSignalV1 {
  readonly revision: 'execution-self-group-signal-v1';
  readonly target: 'self-process-group';
  readonly signal: 'SIGTERM' | 'SIGKILL';
}
export interface ExecutionProcessAnchorHostV1 {
  observeSelf(cancellation: ExecutionCancellationV1): Promise<ExecutionOperationResultV1<ExecutionHostProcessIdentityV1>>;
  spawnTarget(input: ExecutionTargetSpawnInputV1, sink: ExecutionProcessSinkV1, cancellation: ExecutionCancellationV1): Promise<ExecutionOperationResultV1<ExecutionSpawnedTargetV1>>;
  signalSelfProcessGroup(input: ExecutionSelfGroupSignalV1): Promise<ExecutionOperationResultV1<void>>;
  observeGroup(query: ExecutionGroupMembershipQueryV1, cancellation: ExecutionCancellationV1): Promise<ExecutionGroupMembershipV1>;
}
export interface ExecutionProcessAnchorFrameBaseV1 {
  readonly revision: 'execution-process-anchor-frame-v1';
  readonly direction: 'parent-to-anchor' | 'anchor-to-parent';
  readonly nonce: string;
  readonly sequence: number;
}
export type ExecutionProcessParentFrameV1 =
  | (ExecutionProcessAnchorFrameBaseV1 & { readonly direction: 'parent-to-anchor'; readonly kind: 'bootstrap' })
  | (ExecutionProcessAnchorFrameBaseV1 & { readonly direction: 'parent-to-anchor'; readonly kind: 'launch'; readonly executable: string; readonly argv: readonly string[]; readonly cwd: string })
  | (ExecutionProcessAnchorFrameBaseV1 & { readonly direction: 'parent-to-anchor'; readonly kind: 'terminate'; readonly signal: 'SIGTERM' | 'SIGKILL' });
export type ExecutionProcessAnchorFrameV1 =
  | (ExecutionProcessAnchorFrameBaseV1 & { readonly direction: 'anchor-to-parent'; readonly kind: 'anchor-ready'; readonly identity: ExecutionProcessWireIdentityV1 })
  | (ExecutionProcessAnchorFrameBaseV1 & { readonly direction: 'anchor-to-parent'; readonly kind: 'target-started'; readonly identity: ExecutionProcessWireIdentityV1 })
  | (ExecutionProcessAnchorFrameBaseV1 & { readonly direction: 'anchor-to-parent'; readonly kind: 'target-exit'; readonly exitCode: number | null; readonly signal: NodeJS.Signals | null })
  | (ExecutionProcessAnchorFrameBaseV1 & { readonly direction: 'anchor-to-parent'; readonly kind: 'term-applied' })
  | (ExecutionProcessAnchorFrameBaseV1 & { readonly direction: 'anchor-to-parent'; readonly kind: 'kill-armed' })
  | (ExecutionProcessAnchorFrameBaseV1 & { readonly direction: 'anchor-to-parent'; readonly kind: 'group-empty' })
  | (ExecutionProcessAnchorFrameBaseV1 & { readonly direction: 'anchor-to-parent'; readonly kind: 'failure'; readonly code: 'spawn' | 'identity' | 'membership' | 'protocol' | 'io'; readonly message: string });
export function createExecutionProcessRuntimeV1(host?: ExecutionProcessParentHostV1): ExecutionProcessRuntimeV1;
export function runExecutionProcessAnchorV1(host: ExecutionProcessAnchorHostV1, transport: ExecutionProcessAnchorTransportV1, cancellation: ExecutionCancellationV1): Promise<ExecutionOperationResultV1<void>>;
export const defaultExecutionProcessRuntimeV1: ExecutionProcessRuntimeV1;
export interface ExecutionChildIdentityV1 {
  readonly bootId: string;
  readonly pid: number;
  readonly startTicks: bigint;
  readonly processGroupId: number;
}
export interface ExecutionProcessOutcomeV1 {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly childIdentity: ExecutionChildIdentityV1;
  readonly authority: ExecutionAuthoritativeProcessEvidenceV1;
  readonly diagnosticStreams: ExecutionProcessEvidenceV1;
}
export interface ExecutionCleanupOutcomeV1 {
  readonly ok: boolean;
  readonly blocker?: ExecutionCleanupBlockerV1;
}
export interface ExecutionTimeRuntimeV1 {
  monotonicNow(): number;
  waitUntil(
    deadlineMonotonicMs: number,
    signal: AbortSignal,
  ): Promise<'deadline' | 'cancelled'>;
}
export interface ExecutionWorkspaceProviderV1 {
  create(): Promise<ExecutionOperationResultV1<ExecutionCaseWorkspaceV1>>;
}
export interface ExecutionProcessExitV1 {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
}
export interface ExecutionProcessSinkV1 {
  onStdout(bytes: Uint8Array): void;
  onStderr(bytes: Uint8Array): void;
}
export interface ExecutionProcessHandleV1 {
  readonly identity: ExecutionChildIdentityV1;
  readonly completion: Promise<ExecutionProcessExitV1>;
  revalidateIdentity(): Promise<boolean>;
  terminate(signal: NodeJS.Signals): Promise<void>;
}
export interface ExecutionProcessRuntimeV1 {
  start(
    request: ExecutionProcessRequestV1,
    sink: ExecutionProcessSinkV1,
    cancellation: ExecutionCancellationV1,
  ): Promise<ExecutionOperationResultV1<ExecutionProcessHandleV1>>;
}
export interface ExecutionSupervisorDependenciesV1 {
  readonly time?: ExecutionTimeRuntimeV1;
  readonly workspaceProvider?: ExecutionWorkspaceProviderV1;
  readonly workerExecutor?: ExecutionWorkerExecutorV1;
  readonly processRuntime?: ExecutionProcessRuntimeV1;
  readonly runtimeDirectory?: string;
}
export interface ExecutionSupervisorV1 {
  createWorkspace(): Promise<ExecutionOperationResultV1<ExecutionCaseWorkspaceV1>>;
  runWorker(
    request: ExecutionWorkerRequestV1,
  ): Promise<ExecutionOperationResultV1<ExecutionWorkerResponseV1>>;
  runProcess(
    request: ExecutionProcessRequestV1,
  ): Promise<ExecutionOperationResultV1<ExecutionProcessOutcomeV1>>;
  cleanup(): Promise<ExecutionOperationResultV1<ExecutionCleanupOutcomeV1>>;
}
export function createExecutionSupervisorV1(
  policy: ExecutionPolicyV1,
  dependencies?: ExecutionSupervisorDependenciesV1,
): ExecutionOperationResultV1<ExecutionSupervisorV1>;
export interface ExecutionEvidenceLedgerV1 {
  append(bytes: Uint8Array): ExecutionOperationResultV1<ExecutionEvidenceSummaryV1>;
  summarize(): ExecutionEvidenceSummaryV1;
}
export function createExecutionEvidenceLedgerV1(
  limitBytes: number,
): ExecutionOperationResultV1<ExecutionEvidenceLedgerV1>;
export interface ExecutionLaunchAttemptV1 {
  readonly ordinal: number;
  readonly deadlineMonotonicMs: number;
}
export interface ExecutionStopwatchSampleV1 {
  readonly revision: 'execution-stopwatch-sample-v1';
  readonly childIdentityDigest: string;
  readonly absoluteCycles: bigint;
}
export interface ExecutionBudgetScopeV1 {
  readonly deadline: ExecutionDeadlineV1;
  beginOperation(
    stage: ExecutionStageV1,
    nowMonotonicMs: number,
  ): ExecutionOperationResultV1<ExecutionCancellationV1>;
  beginLaunchAttempt(
    nowMonotonicMs: number,
  ): ExecutionOperationResultV1<ExecutionLaunchAttemptV1>;
  chargeOutput(bytes: number): ExecutionOperationResultV1<ExecutionUsageV1>;
  chargeEvidence(bytes: number): ExecutionOperationResultV1<ExecutionUsageV1>;
  chargeInstructions(count: number): ExecutionOperationResultV1<ExecutionUsageV1>;
  beginStopwatch(sample: unknown): ExecutionOperationResultV1<ExecutionUsageV1>;
  completeStopwatch(sample: unknown): ExecutionOperationResultV1<ExecutionUsageV1>;
  snapshot(nowMonotonicMs: number): ExecutionOperationResultV1<ExecutionUsageV1>;
}
export function createExecutionBudgetScopeV1(
  policy: ExecutionPolicyV1,
  startedAtMonotonicMs: number,
): ExecutionOperationResultV1<ExecutionBudgetScopeV1>;
```

The parent validates all request/kernel limits, obtains exactly 32 nonce bytes and calls
`spawnAnchor` with `executable = process.execPath`, an exact one-item argv naming the built sibling
anchor entry, the request cwd, the exact environment `{ LANG: 'C', LC_ALL: 'C', TZ: 'UTC' }`,
detached true, shell false and `ignore-output-control-pipes`. It sends parent sequence-zero
`bootstrap`, whose base carries the 64-character lowercase hexadecimal nonce, over the private raw
transport. The anchor accepts no other first frame, validates and adopts that nonce, observes its
own identity and emits anchor sequence-zero `anchor-ready` with the same nonce. The parent requires
the spawned and ready identities to match with `pid === processGroupId === sessionId`, then sends
parent sequence-one `launch`. The anchor maps that frame to `spawnTarget` with the frame's
executable/argv/cwd, the fixed environment, detached false, shell false and
`ignore-output-pipes`. The target identity must share
the anchor PGID/SID but have a distinct positive PID/start identity. Each direction begins at
sequence zero and increments by one. Every transport operation receives the current bounded
cancellation. No caller environment, host signal method, state getter or parsed-message injection
exists.

Wire identities encode `startTicks` as a canonical nonzero decimal string because JSON cannot
represent `bigint`; raw host ports retain `bigint` and the production kernel alone converts and
validates the representation. Target stdout/stderr never enter control frames: `spawnAnchor`
attaches the anchor pipes to the parent sink, and `spawnTarget` attaches target pipes to the anchor
transport's sink side. Stream bytes therefore remain governed by the existing aggregate output
budget rather than the 16-frame control limit.

These are production boundaries rather than a testkit. The immutable Phase 3 fixture may implement
the ports with scripted failures and retain a test-local ownership probe, but production exports no
fault selector or resource snapshot. `beginStopwatch` and `completeStopwatch` accept `unknown`
because monitor samples cross an external protocol boundary; validation rejects missing values,
counter decreases and child-identity changes.
