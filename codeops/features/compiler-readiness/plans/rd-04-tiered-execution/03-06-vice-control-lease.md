# Component Design: VICE Control and Lease

> **Document**: 03-06-vice-control-lease.md
> **Parent**: [Index](00-index.md)
> **Decisions**: AR-P4, AR-P8, AR-P11

## Responsibility

Reuse the live-verified VICE monitor protocols while adding cancellation, exclusive ownership,
positive process identity, crash recovery and cumulative runtime budgets.

## Control subpath

`@blend65/test-harness/vice-control` exports the binary/text transports, validated instruction
codec, target/version handshake and a cancellable launch/session surface. Hooks surround spawn,
child-record persistence and every signal. Existing root `ViceDriver` wraps this surface so its
public API and emulator suites remain compatible. Readiness-execution owns policy, lease, identity,
deadline and evidence collection.

## Durable lease record

The lease lives in the host-wide effective-UID-owned target directory defined by the filesystem
safety contract; the checksummed, generation-numbered mode-`0600` record contains schema, lifecycle state, Linux boot ID, owner
PID/start ticks, lease nonce, pre-launch token and canonical token-artifact path, child PID/start
ticks when known, two endpoints and timestamps. Acquisition uses an atomic create for a free lease.
Recovery first fences the observed generation, proves the owner dead in the same boot, and handles
the child according to its recorded lifecycle.

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

The supported operator path has two operations. Inspection returns bounded
`ManualLeaseRecoveryV1` evidence and never mutates or signals. Guarded clear requires the exact
generation and nonce from inspection, revalidates the trusted lease directory and record, and
positively proves the child absent before atomically removing that exact generation. Changed or
ambiguous state fails closed. Instructions never recommend raw lease deletion or PID-only signals.

Version 1 supports Linux with readable boot ID and `/proc` start identity. Other or restricted
hosts report VICE `tier-unavailable`; they cannot fall back to PID-only recovery.

## Launch and handshake

Each attempt reserves two distinct loopback-only endpoints, launches one child process group and
checks child liveness plus binary protocol, text protocol, C64 target and supported VICE version.
Port collision or handshake mismatch consumes one of at most eight attempts and the common route
deadline. A live mismatched child is terminated only after identity revalidation.

## Runtime loop

1. Load the accepted binary and establish/read back the target fixture.
2. Set the program counter, stop the machine and sample a per-child absolute stopwatch baseline.
3. Arm a temporary STORE checkpoint on the exact completion address, then advance in instruction
   chunks validated in `1..65535`. Charge the full requested chunk before submission.
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

## Local authority proof

The mandatory local suite uses real ACME and VICE 3.10 to verify loopback handshakes, exact process
lifecycle, `$D020..$D022` high-nibble projection, direct and computed word starts, and one selected
case for each of `peek`, `peekw`, `poke` and `pokew`. CI-safe codec/lease/fake-process tests still
run when tools are absent, but absence cannot select publication authority.

## Specification-visible TypeScript interface

`@blend65/test-harness/vice-control` exports only low-level control:

```ts
export interface ViceControlLaunchV1 {
  readonly executable: string;
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly endpoints: readonly [number, number];
}
export interface ViceCheckpointHitV1 {
  readonly checkpointId: number;
  readonly address: number;
  readonly operation: 'load' | 'store' | 'execute';
}
export interface ViceControlIssueV1 {
  readonly code: 'vice.protocol' | 'vice.cancelled' | 'vice.closed' | 'vice.io';
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
export function acquireViceLeaseV1(
  target: 'c64',
): Promise<ExecutionOperationResultV1<ViceLeaseHandleV1>>;
export function inspectViceLeaseV1(
  target: 'c64',
): Promise<ExecutionOperationResultV1<ManualLeaseRecoveryV1>>;
export function clearViceLeaseGenerationV1(
  target: 'c64',
  generation: number,
  nonce: string,
): Promise<ExecutionOperationResultV1<true>>;
export function executeViceRouteV1(
  request: ViceRouteRequestV1,
  lease: ViceLeaseHandleV1,
): Promise<ExecutionResultV1>;
```
