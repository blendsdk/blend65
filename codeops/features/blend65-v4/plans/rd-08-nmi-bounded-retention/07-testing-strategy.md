# Testing Strategy — Bounded NMI Retention

> **Parent**: [Index](00-index.md)
> **Updated**: 2026-11-13

## Author independence

The retention oracle is authored by the implementation-blind spec-test author from issue #149, the
plan set and the public build API. The implementation session writes only `*.impl.test.ts`.

## Specification cases

### ST-B1 — Build and storage (four profiles)

- shared: `let m = readAndClearPendingSources() & 3; a = m != 0; b = m == 0;`
- five samples: five `peek($0400..$0404)` retained across five `poke($0410..$0414)`
- runtime word local: `let w: word = readAndClearPendingSources(); flag = ((w & 2) != 0);`

Each builds, `zeroPage = 0`, `scratch = 0`, no `sfa`/`zeroPage`/`scratch` interval owned by the
handler, `acmeReconciled`, and a finite `hardwareStack` greater than the A-only wrapper for the
retention forms. The shared form is also built with the default `balanced` optimization to pin the
non-`none` path.

### ST-B2 — Handler shape

The shared handler contains one `PHA` after the masked value, two `TSX; LDA $0101,X` loads, two
expert Boolean branches, and the matching pops. The five-sample handler contains five `PHA`s, five
`TSX; LDA $010n,X` loads, five sample stores, and the matching pops. The runtime word local contains
`AND #$02; LSR` and no conversion staging.

### ST-B3 — Remaining restrictions

Each still fails `E10245` with no generation: 16-bit word mask, computed mask, nonzero comparison,
nine retained samples, and a calling handler.

### ST-B4 — Sequential VICE

One PAL/6581 case: mainline prefills `$0400-$0404` with distinct bytes, installs the exclusive
handler and Timer A; the handler computes `a = (icr & 3) != 0`, `b = (icr & 3) == 0`, and copies
the five samples to `$0410-$0414`. After the genuine NMI and `restoreNMI`, mainline observes
`a = 1`, `b = 0`, `$0410-$0414` equal to `$0400-$0404`, and caller return `$E147`.

## Implementation cases

- proof accepts the shared, five-sample and runtime word-local shapes; rejects a two-block handler,
  a call, a non-A initializer, nine loads, an address-taken local and a word slot;
- lowering emits `PHA`, `TSX`/`LDA` and the pops; `stackBytes` is correct;
- zero-extension staging emits no conversion store.
