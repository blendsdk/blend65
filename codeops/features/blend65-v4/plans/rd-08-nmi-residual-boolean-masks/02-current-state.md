# Current State — Residual Boolean Masks

> **Updated**: 2026-11-13
> **Baseline**: `89125842` (issue #147 delivery); clean tree

## Reproduced witnesses

Measured with the public `buildProject` boundary, optimization `none`, target
`c64-pal-prg-kernal-6581` and its three siblings. Every materialized non-`1` form fails `E10245`.

| Form | Result | Offending storage |
|---|---|---|
| `flag = ((read() & 2) != 0)` | `E10245` | masked value plus comparison retained bytes |
| `flag = ((read() & 2) == 0)` | `E10245` | masked value plus comparison retained bytes |
| `flag = ((read() & 4) != 0)` | `E10245` | masked value plus comparison retained bytes |
| `flag = ((read() & 8) != 0)` | `E10245` | masked value plus comparison retained bytes |
| `flag = ((read() & 3) != 0)` | `E10245` | masked value plus comparison retained bytes |
| `flag = ((read() & maskGlobal) != 0)` | `E10245` | masked value plus comparison retained bytes |
| `let sample = read(); flag = ((sample & 2) != 0)` | `E10245` | masked value plus comparison retained bytes; the local itself is elided |

The branch form `if ((read() & 2) != 0) { flag = true; }` already builds with zero private storage
under #147; it consumes the `AND` flags directly and is not changed by this plan. The mirrored
forms `(2 & read())` and `0 != (read() & 2)` also fail at baseline; this plan delivers them for the
selected masks.

## Mainline output that proves the retention

The same bodies outside an NMI route use `peek($DD0D)` so they admit. They show the compiler-invented
homes:

| Form | Emitted body (mainline, symbols normalised) |
|---|---|
| mask `1` (already delivered) | `lda $dd0d; and #$01; sta flag` |
| mask `2` | `lda $dd0d; and #$02; sta t; lda t; cmp #$01; lda #$00; adc #$00; sta u; lda u; sta flag` |
| mask `4` | same with `and #$04` |
| mask `8` | same with `and #$08` |
| mask `3` | same with `and #$03` |
| local + mask `2` | local store/load pair, then the same masked retention and comparison |

The `sta t; lda t` pair is the compiler-invented masked-value home. The `sta u; lda u` pair is the
comparison result home. The NMI proof rejects both.

## Seams

| Location | Current fact |
|---|---|
| `machine/lower-register-forwarding.ts` | The mask-`1` identity rule marks an `&` result Boolean when its sole consumer is a materialized zero test with one A consumer. No other constant mask is admitted. |
| `machine/lower-operation.ts` | `booleanIdentity` returns the `AND` result itself for `!= 0` and inserts one `EOR #$01` for `== 0`, but only when `booleanValues` contains the masked value. |
| `machine/lower-scalar.ts` | For a byte `&`, the masked result is already register A; a constant operand needs no extra load. |
| `semantic/nmi-register-locals.ts` | A single-use local consumed by `&` with a constant peer is already elided before SFA closure. |
| `storage/nmi-private-storage.ts` | Rejects every non-installation request. It must stay unchanged. |
| `test/rd04/expressiveness-ledger.json` | Row `v4-nmi-retained-source-reads` records the whole non-`1` Boolean class and the multi-sample boundary, owned by #148. |
| `test/rd08/nmi-residual-source-reads-vice.spec.test.ts` | Existing genuine Timer A NMI fixture pattern with pinned VICE/ROM identity. |

## Expert comparison

The comparison uses the largest generated path, not a static sum of mutually exclusive branch arms.
Each arm uses its actual cost, including the documented page-cross allowance for a taken relative
branch. For a handler body that loads the read, masks, normalizes and stores the flag, and cancelling
the shared `LDA`/`AND`/`STA` and wrapper:

| Form | Best expert tail after `AND` | Shift-chain tail |
|---|---|---|
| `!= 0` | `BEQ done; LDA #1` = 4 bytes, 4 path-max cycles | `LSR × k` = `k` bytes, `2k` cycles |
| `== 0` | `BEQ zero; LDA #1; zero: EOR #1` = 6 bytes, 6 path-max cycles | `LSR × k; EOR #1` = `k+2` bytes, `2k+2` cycles |

The threshold `k ≤ 2` follows from both comparisons: mask `8` spends 6 `!=`-tail cycles against the
expert's 4 and 8 `==`-tail cycles against the expert's 6. Masks `2` and `4` are the only qualifying
constants.

## Test baseline

- Compiler suite at `89125842`: 222/222 files, 3,732 passed, 2 skipped.
- #147 spec oracle: 44/44; runtime: 2/2; machine impl: 14/14; storage/elision impl: 9/9.
- Ledger gate: 14/14.
- `yarn build` 4/4 and `yarn typecheck` 7/7 at the #147 closeout.
- VICE 3.10 SHA-256 `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74`.
