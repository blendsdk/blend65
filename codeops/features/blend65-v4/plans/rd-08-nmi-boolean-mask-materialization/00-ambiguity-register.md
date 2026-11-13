# Ambiguity Register — NMI Boolean Mask Materialization

> **Status**: Closed for implementation; retention boundary recorded
> **Updated**: 2026-11-13

The frozen Specification 4.0, issue #149 and the existing NMI private-home proof are authority. This
register records the implementation-shape decisions and the forms that remain.

## AR-M1 — Delivered materialization forms

**Decision:** Deliver a materialized Boolean from a single-use byte `&` zero test, and from a
zero-extended word `&` with a byte mask, for:

1. any nonzero constant mask not already delivered by #148 (`8` and above, multi-bit, and the
   mirrored `&` and zero-test operand orders);
2. the zero constant mask, materialized as a constant load (via a zero-mask fold and a constant
   comparison fold, not a separate selection map);
3. an addressable runtime byte mask, in both `&` operand orders;
4. a byte-masked word value (`w & 1`, `w & 2`, or another byte mask), where the high byte is proved
   zero;
5. the all-ones mask `0xFF`, where the load already holds the value and owns its flags.

The comparison result must be consumed by exactly one byte store or Boolean return. The lowering
also accepts a constant-address byte memory write for internal machine shapes, but a source Boolean
cannot be poked (E10086).

**Rationale:** the expert sequence for a nonzero mask is an inline branch. The compiler can emit
the same sequence without a private home, so the delivered form meets the expert in bytes and
path-max cycles. The zero mask folds better than the branch.

**Rejected:** delivering only some nonzero constant masks and leaving the rest unowned; treating the
shift chain as universal; adding a runtime helper.

## AR-M2 — Expert threshold and branch shape

**Decision:** For a nonzero mask, emit the best expert branch shape:

| Operator | Tail after `AND` | Bytes | Path-max cycles |
|---|---|---:|---:|
| `!= 0` | `BEQ cont; LDA #1` | 4 | 4 |
| `== 0` | `BEQ zero; LDA #1; zero: EOR #1` | 6 | 6 |

The comparison convention is the largest generated path, not a static sum of mutually exclusive
branch arms. A taken branch uses its actual cost including the documented page-cross allowance; the
untaken arm pays its own instructions.

**Rationale:** the emitted sequence is byte-for-byte and cycle-for-cycle the expert's. A meet is the
honest local floor for an arbitrary zero test; there is no shorter branchless normal form for a
multi-bit mask.

**Rejected:** a static sum of both branch arms (it would invent a loss the generated code does not
have); a shift chain for masks `8+` (it loses path-max cycles); a lookup table.

## AR-M3 — Zero mask

**Decision:** Fold `x & 0` to constant zero in the bitwise lowering, fold a materialized comparison
of two constants to `LDA #0`/`LDA #1`, and keep the volatile read exactly once. The fold also covers a
constant bitwise expression such as `2 & 2`, so a single-use constant local can reach the same
optimal result.

**Rationale:** the mask is a compile-time constant; no bit of the read can survive. The expert result
is the constant, not a branch.

**Rejected:** emitting `AND #0` and a branch; removing the volatile read.

## AR-M4 — Runtime addressable mask

**Decision:** Deliver a runtime mask only when the mask operand is a directly addressable byte value
and the read stays in A through the `AND`. Both `read() & mask` and `mask & read()` are selected;
the platform-to-bitwise rule accepts the mirrored order and the byte bitwise lowering commutes a
directly addressable `label`/`static-address` left operand to the right.

**Rationale:** the addressable `AND` sets Z from the masked byte, so the expert branch shape applies
with no staging. A computed mask needs a temporary and is not at the expert floor.

**Rejected:** claiming every runtime expression is delivered; adding a mask home.

## AR-M5 — Word operand

**Decision:** Deliver a word `&` with a byte-sized constant mask. The existing bitwise proof already
establishes that the high result byte is zero, so the comparison uses only the low byte in A. Mask
`1` keeps the identity, masks `2` and `4` keep the shift identity (smaller and faster than the
branch), and any other byte mask uses the inline branch. A branch condition on a byte-masked word
uses the low `AND`'s Z. Also deliver a single-use constant word local by omitting its dead store and
home in the NMI domain.

**Rationale:** `w & 2` can never set the high byte, so the low byte is the complete zero test. A
single `LSR` normalizes the word mask `2` in one byte and two cycles, beating the branch; the mask
`1` identity `AND #1` is the canonical Boolean. The issue's
`let w: word = 2` form is delivered by the constant-local elision plus the constant bitwise and
comparison folds; the plan does not rely on a frontend fold.

**Rejected:** delivering a 16-bit mask whose high byte can be nonzero (it needs two masked bytes
and a retention or branch join); delivering a runtime word local whose zero-extension conversion
currently stages a private byte.

## AR-M6 — Retention boundary

**Decision:** A masked value shared by several consumers and several simultaneously retained samples
remain `E10245`. No NMI proof, storage allowance or route contract changes. They are re-owned by a
follow-up issue before #149 closes. A 16-bit word mask, a computed (non-addressable) mask, a masked
value compared to a nonzero constant, more than eight retained bytes, and a retained local across a
join or call are recorded with the same owner.

**Rationale:** those forms need bounded storage live across consumers or volatile reads. The
cooperative route admits no invocation-private RAM/zero-page homes, and no bounded stack-retention
mechanism is implemented or proved. This is a route limitation, not a language restriction.

**Rejected:** private homes for sampled bytes; claiming bounded stack retention is impossible without
a proof; copying or caching device reads; closing #149 with an unowned residual.

## AR-M7 — Residual owner and ledger

**Decision:** Open a follow-up issue before #149 closes for the retention forms, the 16-bit word
mask, the runtime word local, the computed mask and the nonzero-constant comparison. Narrow
`v4-nmi-retained-source-reads` to exactly those forms with probes that still fail and the new owner.

**Rationale:** every user-hittable restriction needs a live owner. The materialization forms meet
the expert floor; the retention forms need a different subsystem.

**Rejected:** retiring the row while probes still fail; leaving a closed issue as the owner; claiming
all of #149 is materialization.

## AR-M8 — No frozen-specification change

**Decision:** No `spec/` file changes. The delivered behavior implements existing language and
platform rules.

**Rationale:** `spec/` is frozen (decision D3); the defect is compiler-invented storage and a missing
materialization, not a language rule.

**Rejected:** adding a source limitation or a new diagnostic to the frozen text.

## AR-M9 — Verification authority

**Decision:** VICE 3.10 `x64sc` is the runtime oracle, with the pinned executable and ROM hashes
already used by the profile matrix. One delivered multi-bit branch (mask `3`, `!=`) runs through a
genuine CIA2 Timer A NMI and one single-bit inverse (mask `8`, `==`) through Timer A. Timer A sets
ICR bit 0 and leaves the serial bit clear, so both observe true. The zero, runtime, all-ones and
word forms have four-profile assembled-byte evidence only. The bounded result is
`VICE-verified / hardware-unverified` for the two branch forms and assembled-byte-verified for the
rest.

**Rationale:** no physical C64, drive or SID is available; physical qualification stays `V4-HW-1`.

**Rejected:** claiming physical behavior; substituting a monitor PC jump for a genuine interrupt;
claiming runtime coverage from a byte oracle.
