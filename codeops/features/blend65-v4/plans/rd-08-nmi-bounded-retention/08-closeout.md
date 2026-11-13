# Closeout — Bounded NMI Retention

> **Status**: Delivery complete
> **Updated**: 2026-11-13
> **Issue**: [#149](https://github.com/blendsdk/blend65/issues/149)
> **Residual owner**: [#150](https://github.com/blendsdk/blend65/issues/150)

## Delivered

| Form | Result | Handler bytes | `hardwareStack` |
|---|---|---:|---:|
| shared masked value (`a = m != 0; b = m == 0`) | Builds, one stack slot, both expert branches | 38 | 6 |
| five simultaneously retained samples | Builds, five stack slots, five copies | 64 | 10 |
| runtime word local from a byte read | Builds as `AND #2; LSR`, no staging | 13 | 4 |

All report `zeroPage = 0`, `scratch = 0`, no private storage interval, and no NMI private-home
request. The retained bytes live on the handler's own hardware stack: one `PHA` per byte, one `TSX`
per run, `LDA $0100+n,X` at each load, and one `PLA` per byte before the wrapper restores A/X. The
body `stackBytes` is added to the NMI entry demand, so the reported `hardwareStack` is the real peak.

## Runtime evidence

One sequential VICE 3.10 case on `c64-pal-prg-kernal-6581`, genuine Timer A NMI through the
installed exclusive route:

| Fact | Value |
|---|---|
| Artifact SHA-256 | `c022d3bf9a6b8a1420635efb85136683873815cbe8dd126a804d8136b9010c94` |
| VICE executable SHA-256 | `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74` |
| ROM SHA-256 | `83c60d47…`, `89878cea…`, `fd0d53b8…` |
| Handler entry / range | `$0A47` (2631) / 2631-2725 |
| Observed Booleans | `a = 1`, `b = 0` |
| Observed samples | `$0410-$0414 = $11,$22,$33,$44,$55` |
| Caller return | `$E147` |

Status: `VICE-verified / hardware-unverified`.

## Remaining restrictions

| Form | Owner |
|---|---|
| 16-bit word mask with a possibly-nonzero high byte | #150 |
| Computed/non-addressable runtime mask | #150 |
| Masked value compared to a nonzero constant | #150 |
| More than eight retained bytes, a control-flow join, or a calling handler | #150 |

The ledger row `v4-nmi-retained-source-reads` carries five probes for these forms and is owned by
#150.

## Verification

| Check | Result |
|---|---|
| #149 spec oracle | 101/101 pass (retention positives, five negatives, balanced case) |
| #148 oracle | 44/44 pass |
| #147 oracle | 36/36 pass |
| Issue #100 oracle | 16/16 pass |
| Storage/elision impl | 13/13 pass |
| Machine impl | 25/25 and 21/21 pass |
| Sequential VICE (retention + materialization) | 1/1 and 2/2 pass |
| Ledger gate | 14/14 pass |
| RD-05 admission | 36/36 pass |
| NMI/CIA2 route slice | 32 files / 778 tests |
| Complete compiler suite | 224 files / 3,782 passed / 2 skipped |
| `yarn build` / `yarn typecheck` | 4/4 / 7/7 |
| `spec/` | Clean |

No push.
