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

## Child supervision

ACME and VICE launch with executable plus argv arrays, never a shell string. The supervisor creates
an owned process group, observes child start identity, and applies graceful then forced termination
within a bounded cleanup grace. It cannot signal a process that fails identity revalidation.
Worker threads use an equivalent parent-owned cancellation protocol and are terminated at deadline.

## Streaming evidence

One collector continuously drains stdout and stderr after the retention limit is reached. It stores
deterministic head/tail samples plus stream order, total byte count, truncation flag and SHA-256 of
all bytes. The combined per-process retained limit is 1 MiB. All serialized artifacts and metadata
are charged lazily to one 16 MiB per-case ledger; overflow discards passing evidence and returns the
stable limit code. Declared maxima are never eagerly allocated.

## Deadlines and counters

A monotonic route deadline encloses compilation, assembly, every launch attempt, runtime,
observation and cleanup. Each operation receives `min(stageLimit, remainingRouteTime)`. Attempts,
instructions and cycles are cumulative across retries. Exact-bound consumption succeeds; the next
consuming event fails. A fired asynchronous wall watchdog is terminal before return even if another
result becomes ready concurrently.

## Ownership state machine

The top-level scope owns resources in acquisition order and releases them in reverse order:

```text
case root → evidence ledger → workers/ACME → VICE lease → endpoints → child → monitors → checkpoints
```

Cleanup is idempotent and records bounded cleanup evidence without replacing an earlier terminal
stage, except that inability to prove safe VICE termination retains the lease and produces the
fail-closed recovery result required by the lease contract. Pending monitor promises and
checkpoints are actively cancelled.

## Security validation

Tests attempt traversal, absolute paths, symlink swaps, FIFOs/devices, shell metacharacters,
argument injection, stdout/stderr floods, worker hangs, child-tree leaks and cleanup races. No test
may use a path supplied by generated source as a host path or subprocess argument.

This is a local developer tool with no user accounts, public endpoint, remote network, database,
credential, PII, container or deployment surface. Authentication, authorization, CSRF/CORS, public
rate limiting, TLS and encryption-at-rest controls are therefore not applicable. Local denial of
service is controlled by the closed budgets, exclusive VICE lease and bounded evidence described
above; no secret or environment value enters reports.
