# Ambiguity Register — RD-08 Residual NMI Forms

> **Status**: Closed for implementation
> **Updated**: 2026-11-13

## AR-R1 — Wide word mask without a temporary

**Decision:** Materialize the zero/nonzero test of a word `&` with a branch join over the two
masked bytes. The low masked byte stays in A and its Z flag starts the join; the high masked byte
is produced and tested in its own block. No two-byte temporary exists.

**Rationale:** the branch join is both smaller and faster than a private-byte `ORA` join (19 bytes /
23 cycles versus 21 bytes / 26 cycles for the `!= 0` form) and it respects the private-home proof.

**Rejected:** a zero-page temporary; a stack-staged low byte plus `ORA $0100,X`.

## AR-R1b — General word comparison

**Decision:** A word mask compared with a general nonzero word constant tests each masked byte with
`CMP` and joins the two equality results. The `==` and `!=` arms load the canonical `0`/`1` value,
so the result is in A and no temporary exists.

**Rationale:** the low byte mismatch and the high byte mismatch are independent equality failures;
one `CMP` per byte is the expert test. The zero comparison keeps the smaller `AND`-flagged join.

**Rejected:** a 16-bit subtraction/compare temporary; a private staging byte.

## AR-R2 — Computed mask on the hardware stack

**Decision:** Retain a single-use computed byte mask (`x & c`, `x | c`, `x ^ c`) on the handler's
own stack and consume it as `AND $0100+n,X`. The volatile read stays in A and happens once.

**Rationale:** the mask must be addressable across the volatile read. A register cannot be an ALU
operand, and a private byte is forbidden. The stack is invocation-private and already accounted.

**Rejected:** a private mask home; a second read; a register-only mask (not an ALU operand form).

## AR-R3 — Nonzero comparison

**Decision:** A single-bit mask equal to the comparison constant uses the zero-test branch with the
inverted sense (12 bytes / 14 cycles). Every other byte constant uses `EOR #C` followed by the same
branch (14 bytes / 16 cycles).

**Rationale:** `(x & M)` with a single-bit `M` is exactly `0` or `M`, so equality with `M` is the
nonzero test. `EOR` leaves A=0 exactly on equality, which the shared zero-test arms require.

**Rejected:** a private masked byte; `EOR #C` (destroys A and is not shorter); materializing a
16-bit comparison for an arbitrary word constant (outside every delivered form).

## AR-R4 — Capacity-bounded retention

**Decision:** Remove the fixed eight-byte cap. The bound is the platform's proved stack capacity
minus its reserve, checked by the existing closure with `E10238`. The handler still reports its real
peak.

**Rationale:** the cap was a conservative convenience, not a language or platform rule. The closure
already proves the exact simultaneous demand, including the interrupted program's depth. Nine bytes
and twenty bytes are the same proof.

**Rejected:** an arbitrary larger constant; a per-local cap; skipping the capacity check.

## AR-R5 — Multi-block and calling retention

**Decision:** Compute a dominance plan over the semantic CFG. Every retained store must dominate
every load of its binding and the single return; every pair of stores must be dominance-comparable;
no store may sit in a cycle. The slot is the dominance-order position. Block entries reset the
stack-depth counter and the X fact. Any instruction that defines X or S forces a fresh `TSX`.

**Rationale:** dominance makes the push order path-independent, so the static slot offset is sound
at every load. A stack-balanced call restores SP; ordinary functions never push a retained byte, and
interrupt handlers cannot be called directly. Re-reading SP after any X/S clobber keeps the address
exact without weakening the expert's single-`TSX` run inside a straight-line block.

**Rejected:** a runtime frame pointer; a stack-depth carry across arbitrary edges; assuming X is
preserved across a call; a second return block that pops a different count.

## AR-R6 — Residual boundary

**Decision:** The ledger row is retired. Its five probes all build on all four cooperative profiles;
the delivered boundary additionally covers a word mask against a general nonzero word constant. The
following are documented non-goals rather than deferred work: a retained local whose store is inside
a loop; more than one return block with different live push counts; a handler whose call graph is not
stack-balanced. None is a language restriction; each is outside the delivered source forms and the
current SFA call contract.

**Rationale:** the issue's five forms and their natural nonzero variants are covered. The non-goals
are new extensions, not residual restrictions a user can hit with the documented forms.

The stock chained `setNMI` route keeps its separate frame contract and remains `E10245`; its
retention proof is a separate route extension owned by issue #153 and tracked by the deferred ledger
row `v4-nmi-chained-retention`.

**Rejected:** keeping the ledger row open without an owned residual; claiming loop-carried
retention; binding the exclusive stack plan onto the stock chained frame.
