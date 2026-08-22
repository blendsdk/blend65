# Component Design: Process and Filesystem Safety

> **Document**: 03-05-process-filesystem-safety.md
> **Parent**: [Index](00-index.md)
> **Decision**: AR-P10

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
with one link and the retained device/inode/UID identity. Lease files are regular single-link files
with mode `0600`; bounded reads and writes use no-follow handles, atomic same-directory replacement
and directory sync. A symlink, hard link, special file, ownership/mode mismatch or replacement race
fails closed. Repository-local or per-case lease paths are forbidden because they do not coordinate
other clones on the same host.

## Child supervision

ACME and VICE launch with executable plus argv arrays, never a shell string. The supervisor creates
an owned process group, observes child start identity, and applies graceful then forced termination
within a bounded cleanup grace. It cannot signal a process that fails identity revalidation.
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

## Ownership state machine

The top-level scope owns resources in acquisition order and releases them in reverse order:

```text
case root → evidence ledger → workers/ACME → VICE lease → endpoints → child → monitors → checkpoints
```

Cleanup is idempotent and records bounded cleanup evidence without replacing an earlier operational
terminal stage. Inability to prove safe VICE termination retains the lease and attaches a mandatory
`cleanupBlocker`; a provisional pass is replaced by `emulator-lease-recovery-blocked`, while an
earlier failure remains primary. Any cleanup blocker prevents authority. Pending monitor promises
and checkpoints are actively cancelled.

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
export interface ExecutionChildIdentityV1 {
  readonly bootId: string;
  readonly pid: number;
  readonly startTicks: bigint;
  readonly processGroupId: number;
}
export interface ExecutionProcessOutcomeV1 {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly evidence: ExecutionProcessEvidenceV1;
  readonly childIdentity: ExecutionChildIdentityV1;
}
export interface ExecutionCleanupOutcomeV1 {
  readonly ok: boolean;
  readonly blocker?: ExecutionCleanupBlockerV1;
}
export interface ExecutionSupervisorDependenciesV1 {
  readonly monotonicNow?: () => number;
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
```
