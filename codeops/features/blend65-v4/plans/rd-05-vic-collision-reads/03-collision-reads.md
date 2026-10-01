# Component contract: VIC-II collision reads

> **Parent**: [Index](00-index.md)

## Source contract

AR-P2 owns the exact two signatures, addresses, returned bitsets and consuming effects.
Both declarations join the existing cooperative capability inventory. Existing profile,
name, arity and type validation applies; do not add diagnostics or parser syntax.

These operations do not determine collision pairs or run gameplay code. A bit identifies a
participating hardware sprite, not which other sprite it touched. Applications decide when
to read the shared latch and how to interpret the returned bits.

## Integration

Per AR-P1/AR-P2, add named collision addresses to `C64MachineFacts` and `COMMON_MACHINE` in
`target/c64-kernal.ts`, declarations in `frontend/profile.ts`, and direct handling in
`machine/lower-c64.ts`. Reuse the existing platform operation and result-retention path.
No generic IR, SFA, serializer, packaging, IRQ or banking redesign is required.
Retained direct-store cases also admit these two producers to the existing adjacent
fixed-destination register-forwarding rule, preserving its single-use and clobber guards.

The returned byte is unsigned. Keep the operation at its source evaluation point. Result
retention may store the sampled byte through existing SFA-owned storage, but cannot sample
the device again. An unused result cannot remove the device access. Repeated calls cannot
share a sampled result. No hidden interrupt masking or two-register atomicity is promised.

## Output quality

AR-P4 requires comparison against an independent expert sequence under the same live-value
and observable-effect contract. The device operation is a direct absolute load into A;
do not introduce a helper call, address calculation, redundant transfer, hidden shadow or
runtime allocation. Report necessary caller/result storage separately from the device access.
Execution must bind assembled bytes, CPU cycles, flags, ZP/frame/stack changes, data bytes and
startup/artifact costs. VIC bus denial is separate from nominal instruction cycles.

Do not claim a whole-program optimization win from a local hardware read. If the result only
meets the expert floor, follow AGENTS.md and file the measured gap and realistic path to a win.

## Diagnostics and safety

Use existing frontend rejection paths for unsupported profiles, misspelled names or extra
arguments (AR-P2). No authentication, server, transport, new host input or infrastructure
exists in this change; those security categories are N/A. Structured emission and closed
operation lookup remain the controls. Test hostile/invalid source names and arguments through
the normal compiler path, never through interpolated shell text.

## Documentation and tests

Document consuming semantics at the existing declaration/target owner and in any maintained
platform API documentation, without planning IDs in source comments. AR-P3 alone authorizes
the old inventory edits. All other existing specification tests remain immutable.
See [ST cases](07-testing-strategy.md) for acceptance behavior; do not derive an oracle from lowering.
AR-P5 corrects only a misplaced binding-type assertion in the new API oracle; the exact
source call signature, unsigned-byte result and consuming effects stay unchanged.
