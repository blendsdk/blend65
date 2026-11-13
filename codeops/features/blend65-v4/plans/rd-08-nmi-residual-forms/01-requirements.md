# Requirements — RD-08 Residual NMI Forms

> **Issue**: [#150](https://github.com/blendsdk/blend65/issues/150) — "bound storage and staging
> for the remaining NMI Boolean forms"
> **Parent**: RD-08 measured output debt; issue #149 delivered the ordinary forms and bounded
> straight-line retention
> **Updated**: 2026-11-13

## Requirement mapping

| Source requirement | Current state | Plan deliverable |
|---|---|---|
| #150: a 16-bit word mask whose high byte can be nonzero | Fails `E10245`; `lowerBitwise` requests a two-byte temporary | Branch join over both masked bytes, no home |
| #150: a computed/non-addressable runtime mask | Fails `E10245`; the mask local needs a private home | Stack-retained mask byte consumed as `AND absolute,X`; read stays in A |
| #150: a masked value compared to a nonzero constant | Fails `E10245`; only the zero-test branch is materialized | Identity zero-test branch, byte `EOR #C`, or the per-byte word CMP join |
| #150: more than eight retained bytes | Fails `E10245` at the fixed eight-byte cap | Capacity-bounded retention; the platform stack proof is the bound |
| #150: a retained local across a join or a calling handler | Fails `E10245`; the proof requires one block and no calls | Dominance slot plan, per-block depth, X/SP re-establishment, stack-balanced calls |
| #150: each delivered form meets or beats the expert sequence | No delivered form | Exact sequences and byte/path-cycle tables in the closeout |
| #150: the NMI private-home proof is not relaxed | Existing proof rejects every private request | No RAM/zero-page request; only the invocation's hardware stack |
| #150: independent four-profile spec oracles plus sequential VICE | Rejection oracles only | Positive build/byte oracle on four profiles and one genuine-NMI runtime case |
| #150: honest residual record | Ledger row lists five forms | Row retired after all five probes build on every profile |

## Explicit non-goals

- No private RAM, zero-page or static NMI scratch.
- No heap, dynamic stack frame, frame pointer or general stack storage class.
- No word-mask comparison against a constant wider than sixteen bits (a word value cannot equal it).
- No relaxation of the interrupt-domain, reentrancy or capacity diagnostics.
- No stock chained-route retention; its separate frame proof is issue #153.
- No `spec/` edit and no physical-hardware claim. Runtime status stays
  `VICE-verified / hardware-unverified`.

## Acceptance

1. The five ledger probes build with optimization `none` and with the default optimization mode on
   all four cooperative profiles, and publish no NMI-private request.
2. A single-bit-per-byte word mask emits the branchless aligned `LSR; ORA/AND; AND #1` sequence;
   a multi-bit word mask emits the two-byte branch join. Neither creates a temporary or a home.
3. The computed mask emits one mask computation, one `PHA`, one volatile read, and one
   `TSX; AND $0100+n,X`; no mask home.
4. `(read() & 8) == 8` emits `AND #$08` followed by the inverted zero-test branch, with no `EOR`.
   A general byte constant emits `EOR #C` (not `CMP`) so equality leaves A=0 for the shared arms.
5. Nine retained samples build; the final top slot is consumed with `PLA`; the reported
   `hardwareStack` is the proved peak and no private home exists.
6. A retained sample survives an `if`/`else` join and a stack-balanced call; the slot offset is the
   same on every path, the final top-slot use is `PLA`, and the handler removes every remaining push
   with `PLA` or the proved bulk cleanup.
7. Every emitted sequence is at or below the hand-written expert byte and path-cycle count. The
   impossible-constant fold is outside this slice and tracked by issue #151.
8. Sequential VICE proves a genuine CIA2 Timer A NMI for the delivered forms and returns to the
   caller with A/X/Y/SP and the stack frame intact.
9. The ledger row `v4-nmi-retained-source-reads` is retired; its five probes all build.
10. `yarn build`, `yarn typecheck`, the complete compiler suite and the affected root suites pass;
    `spec/` is clean.
