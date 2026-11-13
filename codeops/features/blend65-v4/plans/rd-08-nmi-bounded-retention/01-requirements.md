# Requirements Delta — Bounded NMI Retention

> **Issue**: [#149](https://github.com/blendsdk/blend65/issues/149)
> **Updated**: 2026-11-13

| Requirement | Deliverable |
|---|---|
| Shared masked value builds with no private RAM/ZP home | Bounded stack slot, `PHA`/`TSX`-relative loads/`PLA` |
| Five simultaneously retained samples build | Five bounded stack slots, copied to the pokes |
| Runtime word local from a byte read builds | Zero-extension staging elision |
| No NMI private-home proof relaxation | No request created; stack demand reported |
| Four-profile oracles plus sequential VICE | New positives, negatives for the remaining forms, one genuine NMI case |
| Honest residual record | Ledger narrowed to the forms that still fail, owner #150 |

## Acceptance

1. The shared form, five-sample form and runtime word local build on all four cooperative profiles
   with optimization `none`, `zeroPage = 0`, `scratch = 0`, and a finite `hardwareStack`.
2. The handler pushes one byte per retained local, reads via `TSX`-relative `LDA`, and pops every
   byte before the wrapper restores A/X.
3. The runtime word local emits the mask-2 shift shape with no conversion staging.
4. A sequential VICE case observes `a = 1`, `b = 0` and `$0410-$0414` equal to `$0400-$0404`
   after a genuine Timer A NMI.
5. The remaining forms (16-bit word mask, computed mask, nonzero comparison, >8 bytes, multi-block)
   still fail `E10245` and are owned by #150.
6. Complete compiler suite, affected root suites, `spec/` clean.
