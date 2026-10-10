# One scoped CIA1 acquisition

> **Parent**: [Index](00-index.md)
> **Authority**: AR-P2/AR-P3 and [approved direct scoped ingress](00-ambiguity-register.md#acquisition-design-closure--direct-existing-scoped-ingress)

## Preconditions and scope

Four cooperative PRG profiles only. The accepted compatible prior CIA1/NMI owner
is a real precondition; source spelling, SEI or readable DDRs alone do not prove
it. Stock-compatible entry and compatible generated chained/exclusive owners
need their actual transitive effects/terminal behavior established. No automatic
admission mechanism, no-custom-handler restriction or per-call `$FE47` check is
added. Preserve the existing program-entry/vector/link proof and diagnostics.

No unaccounted concurrent writer may tear DDR/PBON capture or alter the owned
port contract. Input lines and PB latch provenance follow the accepted owner
contract. DDRA=$FF/DDRB=$00 is a sufficient stock default, not an API rejection
rule. Timers may run with PBON clear; no timer or mask is changed for scanning.

## Source transaction

Implement `readInputSnapshot` as ordinary source using named private CIA1
register constants and existing `asm_php`, `asm_sei`, `asm_plp`, `setNMI` and
`restoreNMI`. Initialize the complete local result once with zero raw placeholders
and quality UNAVAILABLE; placeholders are not valid released/pressed evidence.
Preserve the existing caller-owned aggregate return and its general fallback.

| Order | Source operation / boundary                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------ |
| 1     | Save status and exclude IRQ with balanced PHP/SEI. Read CRA then CRB once each.                                          |
| 2     | If either PBON is set, restore status and return initialized UNAVAILABLE; no CIA1 write or NMI installation.             |
| 3     | Capture coherent DDRA/DDRB. Write idle PA=$7F, set DDRA=$FF/DDRB=$00 while prior compatible NMI owner remains installed. |
| 4     | Clear one shared interruption byte, then install the PA-only callback through existing balanced setNMI.                  |
| 5     | Write PA=$FF; read full PB for joystick1 then full PA for joystick2.                                                     |
| 6     | For columns 0–7, write the corresponding one-low PA mask and read exactly one PB row into the result.                    |
| 7     | Write own final PA=$7F, remove the scoped route, then restore exact saved DDRA/DDRB.                                     |
| 8     | Read the final marker: nonzero selects INTERRUPTED, zero selects COMPLETE. Restore saved status, return result.          |

There is one local attempt and no hidden retry/last-good value. All returns and
loop joins balance explicit status storage and NMI ownership. Entry/exit source
paths preserve caller I/D and the existing ABI, not an invented all-register
callee-save contract. The scan does not consume CIA1/2 ICR, write PB, alter timers,
bank CPU/VIC memory or acquire another device.

## Interrupt callback and handback

One private callback-only `interrupt function` writes PA=$7F then marker=1.
Its complete selected generated route must have no invocation-private RAM/ZP
homes. Reuse current wrapper/save selection, binary entry, immutable page-safe
two-byte predecessor link and LIFO lifetime. Preserve P before A as required for
chaining; return through the selected prior owner exactly once. The callback
does not read CIA2 ICR; retained firmware remains the consuming owner.

Marker=1 is monotonic while installed. A returning event anywhere in the
published acquisition interval makes all named queries UNCERTAIN through quality.
Interrupted raw bytes remain retained, not repaired or selectively certified.
Events before publication or after removal belong to the compatible prior owner;
the handback oracle observes the library's own final write/release order, not a
promise that firmware cannot subsequently write PA. Genuine STOP remains reachable
and may not return. Unrestricted nesting, external aggregate stack, retained-ROM
completion and a finite wall-clock deadline remain unproved.

Generated normal acquisition has 14 CIA1 reads and 15 CIA1 writes, excluding
callback/firmware effects and vector/link traffic. The PBON failure has two
reads and no CIA1 writes. These are expected source effects, not a timing or
hardware result. Settling, instruction-boundary races, CPU bus patterns, exact
selected bytes and actual complete costs require
[ST-16–ST-24](07-testing-strategy.md#-specification-test-cases).

## Activation and qualification

Construct the exact installed-source candidate in the uncommitted worktree and
exercise it through ordinary fixture builds. Publish only at the coherent phase
checkpoint, after native qualification, full verification and independent reviews.
Derive the complete equivalent expert baseline independently before accepting
emitted output. Use the existing native matrix/RESTORE method, real generated
artifacts and all four profiles. If settled
samples need a larger timing primitive or ownership system, stop at a named
runtime ambiguity; do not introduce it under generic correction approval.
Final qualification reports VICE-verified / hardware-unverified only for executed
endpoints. Physical and final user-host QA remain RD-10.
