# Ambiguity Register — Bounded NMI Retention

> **Status**: Closed for implementation
> **Updated**: 2026-11-13

## AR-B1 — Stack retention, not a private home

**Decision:** Retain a byte local on the handler's own hardware stack: one `PHA` at its initializer,
`TSX; LDA $0100+n,X` at each load, and one `PLA` per pushed byte before the wrapper restores A/X.
The local's SFA request is omitted before allocation. No RAM or zero-page home is created.

**Rationale:** the stack is invocation-private and bounded; the cooperative route already reserves
stack capacity. A static scratch would be a private home and would relax the proof.

**Rejected:** static NMI scratch; a general stack storage class; heap; register-only X/Y retention
for more than one value.

## AR-B2 — Exact proof scope

**Decision:** Only a single-block NMI handler with a `void` result, no calls, no branches, and at
most eight body-pushed bytes. Each retained local is a byte with exactly one initializer store and
one or more loads, all in that block, no address taken, no indexed path. The initializer is already
in A: a platform byte read, a fixed-address byte `peek`, or a byte `&`.

**Rationale:** the slot offsets are static only for straight-line code; calls may unbalance the
stack; more than eight bytes is not a bounded cooperative demand worth proving here.

**Rejected:** multi-block handlers; calls; word slots; dynamic depths.

## AR-B3 — Stack accounting and wrapper saves

**Decision:** The body's `stackBytes` is reported on the machine function and added to the NMI
entry's fixed stack demand. `TSX` defines X, so the existing wrapper clobber analysis saves and
restores X automatically; the body pops its slots before the wrapper restores A and X.

**Rationale:** the evidence must report the real peak, and the wrapper must preserve X across a
`TSX`-using body.

**Rejected:** hiding the body pushes from `hardwareStack`; assuming X is preserved.

## AR-B4 — Zero-extension staging

**Decision:** A single-use word local initialized by a zero-extending byte read and consumed by a
byte-masked `&` keeps its low byte in A. The conversion emits no staging store and the high byte is
proved zero.

**Rationale:** only the low byte is observed by the byte mask; the conversion input home is
compiler-invented.

**Rejected:** keeping the two-byte local; staging the low byte in RAM.

## AR-B5 — Remaining restrictions

**Decision:** A 16-bit word mask whose high byte can be nonzero, a computed (non-addressable) mask,
a masked value compared to a nonzero constant, more than eight retained bytes, and a multi-block or
calling handler remain `E10245` and are owned by issue #150.

**Rationale:** each needs a wider join or a different retention proof. None is a language
restriction.

**Rejected:** claiming universal retention; leaving an unowned residual.
