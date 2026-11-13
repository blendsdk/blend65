# Ambiguity Register — Residual Boolean Masks

> **Status**: Closed for implementation; remaining restrictions recorded
> **Updated**: 2026-11-13

The frozen Specification 4.0, issue #148 and the existing NMI private-home proof are authority. This
register records the implementation-shape decisions and the restrictions that remain.

## AR-R1 — Delivered source forms

**Decision:** Deliver a materialized Boolean from a constant single-bit mask `2` or `4`:

1. `flag = ((read() & 2) != 0);` and `flag = ((read() & 2) == 0);`
2. `flag = ((read() & 4) != 0);` and `flag = ((read() & 4) == 0);`
3. the same forms when the read is carried by a single-use NMI local that the #147 rule already
   elides.

The mask may be written on either side of `&`; the existing bitwise lowering commutes a constant
left operand. The zero test may also be written with the zero on either side (`0 != (x & mask)`).
The comparison result must be consumed by exactly one byte store, constant-address byte memory
write, or Boolean return.

**Rationale:** these are the single-bit masks whose shift-chain normalization meets or beats the
expert branch materialization in bytes and maximum cycles. Mask `1` is already delivered by #147 and
keeps its identity lowering.

**Rejected:** delivering masks whose normalized sequence loses bytes or maximum cycles against the
expert; treating a branch-only bit test as a new form (already delivered by #147).

## AR-R2 — Mask threshold

**Decision:** The shift chain is selected only when the complete emitted sequence does not exceed
the best expert materialization in bytes or in **largest path cycles**. Branch arms are mutually
exclusive, so the comparison uses the larger path sum with each arm's actual cost, including the
documented page-cross allowance — never a static sum of both arms' maxima.

With the shared `LDA`/`AND`/`STA` and the NMI wrapper cancelled:

| Form | Expert tail | Shift tail |
|---|---|---|
| `!= 0` | `BEQ done; LDA #1` = 4 bytes, 4 path-max cycles | `LSR × k` = `k` bytes, `2k` cycles |
| `== 0` | `BEQ zero; LDA #1; zero: EOR #1` = 6 bytes, 6 path-max cycles | `LSR × k; EOR #1` = `k+2` bytes, `2k+2` cycles |

`k = 2` (mask `4`) meets both path-max totals and beats both byte counts. `k = 3` (mask `8`)
exceeds them at 6 and 8 cycles. Therefore only masks `2` and `4` qualify.

**Rationale:** the prime directive forbids shipping output an expert would beat. Mask `8` and above
have a longer shift tail; multi-bit masks cannot be normalized by shifting. Their only expert
materialization is a branch with a block and label, which this slice deliberately does not add.

**Rejected:** a static sum of mutually exclusive branch arms (it would wrongly admit mask `8`); a
threshold based on bytes alone; delivering mask `8` through the existing eight-byte comparison
materialization.

## AR-R3 — Multi-sample boundary

**Decision:** Several simultaneously retained sampled bytes remain `E10245`. No NMI proof, storage
allowance or route contract changes.

**Rationale:** the bytes are live across distinct volatile reads. The cooperative route admits no
invocation-private RAM/zero-page homes, and no bounded stack-retention mechanism is implemented or
proved. This is a route limitation, not a language restriction and not compiler-invented scratch. It
is owned by the follow-up issue.

**Rejected:** private homes for sampled bytes; claiming bounded stack retention is impossible
without a proof; copying or caching device reads.

## AR-R4 — Mainline scope

**Decision:** The rule is not limited to the NMI domain. It replaces the existing retained-byte
comparison for the exact selected shape in every domain, as the mask-`1` identity did.

**Rationale:** the optimization is a pure strength reduction of an existing expression. Restricting
it to NMI would create a second lowering for the same source shape.

**Rejected:** an NMI-only branch; changing any general comparison semantics.

## AR-R5 — Residual owner and ledger

**Decision:** Open a follow-up issue before #148 closes for the remaining materialized Boolean masks
(constant `8` and above, multi-bit constants, and runtime masks). Narrow
`v4-nmi-retained-source-reads` to those forms plus the multi-sample boundary, with probes that still
fail and the new owner.

**Rationale:** every user-hittable restriction needs a live owner. #148 delivered the forms that
meet the expert floor; the rest need a different materialization (an inline branch block) and must
not be silently dropped.

**Rejected:** retiring the row while probes still fail; leaving a closed issue as the owner; claiming
all non-`1` forms are delivered.

## AR-R6 — No frozen-specification change

**Decision:** No `spec/` file changes. The delivered behavior implements existing language and
platform rules.

**Rationale:** `spec/` is frozen (decision D3); the defect is compiler-invented storage, not a
language rule.

**Rejected:** adding a source limitation or a new diagnostic to the frozen text.

## AR-R7 — Issue #147 oracle retirement

**Decision:** Remove exactly one negative case from
`test/rd08/nmi-residual-source-reads.spec.test.ts` — `BOOLEAN_MASK_TWO`, the mask-`2` materialized
Boolean rejection. That form is the explicit subject of issue #148 and becomes a positive here. The
other #147 negatives (five retained samples, borrowed local address) stay unchanged. The edit is
executed by the independent spec author, not the implementation session.

**Rationale:** the #147 oracle is immutable while its requirement stands; issue #148 is the named
owner of the mask-`2` restriction, so the requirement changes when #148 delivers it.

**Rejected:** leaving the old negative red; editing the oracle from the implementation session;
retiring any other #147 negative.

## AR-R8 — Verification authority

**Decision:** VICE 3.10 `x64sc` is the runtime oracle, with the pinned executable and ROM hashes
already used by the profile matrix. One representative form (mask `2`) runs through a genuine CIA2
Timer B NMI and its inverse through Timer A; mask `4` has four-profile assembled-byte evidence
because the typed platform library exposes no TOD-alarm programming, and a raw `$DD08–$DD0B` write
would invalidate the typed CIA2 lease/handback proof. The result is
`VICE-verified / hardware-unverified`.

**Rationale:** no physical C64, drive or SID is available; physical qualification stays `V4-HW-1`.
The FLAG line is ICR bit `4`, not mask `4`; it is not the reason for the mask-`4` boundary.

**Rejected:** claiming physical behavior; substituting a monitor PC jump for a genuine interrupt;
claiming mask `4` runtime coverage from a byte oracle; calling mask `4` the FLAG line.
