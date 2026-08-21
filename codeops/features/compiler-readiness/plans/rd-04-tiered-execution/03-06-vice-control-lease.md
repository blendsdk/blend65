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

The checksummed, generation-numbered record contains schema, lifecycle state, Linux boot ID, owner
PID/start ticks, lease nonce, pre-launch token and canonical token-artifact path, child PID/start
ticks when known, two endpoints and timestamps. Acquisition uses an atomic create for a free lease.
Recovery first fences the observed generation, proves the owner dead in the same boot, and handles
the child according to its recorded lifecycle.

Before spawn, a unique token is persisted and embedded in a canonical autostart artifact path
passed to VICE. This closes the spawn-before-child-record window. Before any graceful or forced
signal, recovery rereads the lease and positively matches boot ID, `/proc/<pid>/stat` start time,
token artifact and current generation/nonce. PID, port or command substring alone is never enough.
Ambiguity returns `execution.lease.recovery-blocked`, retains the lease and reports a bounded manual
recovery action. Normal cleanup clears only an exact generation/nonce match.

Version 1 supports Linux with readable boot ID and `/proc` start identity. Other or restricted
hosts report VICE `tier-unavailable`; they cannot fall back to PID-only recovery.

## Launch and handshake

Each attempt reserves two distinct loopback-only endpoints, launches one child process group and
checks child liveness plus binary protocol, text protocol, C64 target and supported VICE version.
Port collision or handshake mismatch consumes one of at most eight attempts and the common route
deadline. A live mismatched child is terminated only after identity revalidation.

## Runtime loop

1. Load the accepted binary and establish/read back the target fixture.
2. Set the program counter and start a cycle stopwatch.
3. Poll completion in instruction chunks validated in `1..65535`.
4. Before each chunk and observation, evaluate instruction exhaustion before cycle exhaustion;
   record both totals when both are exhausted.
5. On completion `0xA5`, stop timing and read the declared actual bytes or direct MMIO observable.
6. Cancel pending commands, close transports and terminate the owned child during cleanup.

Totals above 65,535 are decomposed without truncation or wrap. Completion not reached within a
budget receives the applicable stable exhaustion code. The wall watchdog can terminate any pending
monitor request.

## Local authority proof

The mandatory local suite uses real ACME and VICE 3.10 to verify loopback handshakes, exact process
lifecycle, `$D020..$D022` high-nibble projection, direct and computed word starts, and one selected
case for each of `peek`, `peekw`, `poke` and `pokew`. CI-safe codec/lease/fake-process tests still
run when tools are absent, but absence cannot select publication authority.
