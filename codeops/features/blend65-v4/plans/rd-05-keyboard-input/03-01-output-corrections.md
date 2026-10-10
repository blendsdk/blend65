# Three existing-consumer output corrections

> **Parent**: [Index](00-index.md)
> **Authority**: [AR-P12](00-ambiguity-register.md#ar-p12--named-existing-consumer-correction-scope)

## Common boundary

No new pass or IR kind. Retain only the narrow value/place/availability facts the
existing consumers need. Establish them before current SFA inventory/closure;
emission never discovers a storage home. Missing proof uses the current general
path. Preserve public diagnostics, source widths, evaluation order, effects,
alias/lifetime semantics and selected-machine bus behavior.

## Masked addressing and aggregate-byte delivery

Reuse the existing mask containment proof. A word-typed `column & 7` has a
provably zero high byte; that fact may narrow machine work without narrowing the
source type. A proved unsigned byte stride-one index can feed low-byte address
addition followed by carry into the existing pointer high byte. The pointer
remains a full 16-bit address. Do not allocate a widened/scaled word temporary
solely to carry known zero. Preserve signed/wider/stride fallback paths.

Owners: `machine/lower-scalar.ts`, `lower-state.ts`,
`lower-aggregate-index.ts`, `lower-aggregate.ts`. A byte aggregate load may remain
in A only for a proved adjacent single-use consumer. Reuse the existing
forwarding/retention machinery, not a second liveness model. Pointer setup must
finish before a volatile value read that it could clobber.

## Adjacent expression and zero-condition delivery

Extend the existing single-use, same-block forwarding window to proved byte
binary results and their next compatible consumers. No machine instruction,
observable effect or clobber may be skipped. Constants/conversions that emit no
instruction may be crossed only under the existing exact guard.

The ordered two-read PBON expression can consume A directly through OR/mask and
branch. A fresh byte zero test can use its valid Z flag rather than `EOR #0`.
Track A and flag validity separately: stores preserve flags but do not establish
them; calls and pointer setup can invalidate them. Multi-use/escaping values,
nonadjacent uses, different blocks and unknown clobbers retain stable homes.
Owners: `machine/lower-register-forwarding.ts`, `lower-scalar.ts` and their
existing state/retention consumer where necessary.

## Fixed-address arguments and immediate scalar-call results

Preserve an aggregate place's fixed storage/label identity through its existing
address producer to `machine/lower-call.ts`. For a proved constant fixed place,
marshal its low/high address bytes directly to the existing by-reference
parameter home. Do not reinterpret a captured dynamic pointer as a fixed address
from its spelling, request name or current numerical value. Offset, overlap,
nested argument effects, escaped/address-taken entries and interference remain
part of the existing proof/fallback.

A byte call result in A may flow directly to its sole adjacent fixed byte store
if no subsequent argument evaluation, pointer setup or other clobber occurs.
Keep callee argument order, ordinary JSR/RTS, caller-owned hidden aggregate
destination and all interrupt-domain/storage obligations. Word/AX and indirect
call variants retain their general behavior unless the same existing guard
already proves them; AR-P12 does not authorize a separate specialization system.
Owners: `machine/lower-aggregate.ts`, `lower-state.ts`, `lower-call.ts` and
`lower-register-forwarding.ts`.

## Qualification boundary

[ST-1–ST-9](07-testing-strategy.md#-specification-test-cases) own behavior and
expert instruction/cost expectations. Analytical local candidates are not a
full-body/package budget. Reassemble actual output and inventory code, data,
padding, BSS, SFA, ZP, scratch, stack, MMIO and path cycles. Do not select a
shorter sequence that changes flag, carry, page-wrap or volatile-bus behavior.
Any further necessary support mechanism requires a new exact runtime ruling;
RD-08 debt is not permission to pass a failing keyboard parity gate.
