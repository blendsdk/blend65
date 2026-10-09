# Requirements — direct constant nested construction

> **Parent**: [Index](00-index.md)

## Required correction

AR-1 authorizes constant nested literals to be constructed in proved fresh,
exclusively owned final storage, starting with function-local initialization.

| ID  | Acceptance criterion                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Preserve every initialized byte, declared packed field order, width, signed conversion and little-endian representation.                                                                                |
| R2  | Eligible nested construction has no redundant aggregate temporary, snapshot, member-copy loop or source/target pointer pair. Reuse equal literal loads while their value/flags remain proved unchanged. |
| R3  | Preserve source evaluation, volatile read/write order/count, real copy snapshots, borrow/alias/lifetime contracts, D/I state and current calling/interrupt contracts.                                   |
| R4  | Close every required home through existing SFA before emission; no late or anonymous scratch and no resource growth for the qualified ordinary witness.                                                 |
| R5  | Keep source/debug identity and public artifacts valid; all old tests and frozen authorities stay byte-for-byte unchanged.                                                                               |
| R6  | Qualify behavior and expert output independently using existing public services, real ACME and sequential VICE. Record complete artifact/resource costs separately from the improved component.         |

## Exclusions

No direct-construction expansion to borrowed, overlapping, escaped or effectful
destinations; no new source restriction if proof is absent. No general copy-elision,
constant evaluator, alias/range solver, register optimizer, new IR kind or library API.
Global placement, caller-return redesign, keyboard acquisition/decoder policy, T-10,
other output debts and physical/Windows/macOS qualification remain their existing owners.

Security/infrastructure: N/A; this changes no host input, process invocation, protocol,
authentication, network, secrets or deployment surface. Existing validation remains.
