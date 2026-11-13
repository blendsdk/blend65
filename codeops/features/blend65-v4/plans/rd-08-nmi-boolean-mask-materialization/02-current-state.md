# Current State — NMI Boolean Mask Materialization

> **Updated**: 2026-11-13
> **Baseline**: `9c41b8a9` (#148 delivery); clean tree

## Reproduced witnesses

Measured with the public `buildProject` boundary, optimization `none`, target
`c64-pal-prg-kernal-6581` and its three siblings. Every form below fails with `E10245`.

| Form | Result | Offending storage |
|---|---|---|
| `flag = ((read() & 8) != 0)` | `E10245` | masked byte plus comparison result |
| `flag = ((read() & 8) == 0)` | `E10245` | masked byte plus comparison result |
| `flag = ((read() & 3) != 0)` | `E10245` | masked byte plus comparison result |
| `flag = ((read() & 0) != 0)` | `E10245` | masked byte plus comparison result |
| `flag = ((read() & maskValue) != 0)` | `E10245` | masked byte plus comparison result |
| `flag = ((w & 2) != 0)` with a placed word `w` | `E10245` | word comparison difference plus result |
| `let w: word = 2; flag = ((w & 2) != 0)` | `E10245` | the local word home |
| `let m = read() & 2; a = m != 0; b = m == 0` | `E10245` | the shared masked local |
| five simultaneously retained samples | `E10245` | sampled-byte homes |

The mirrored forms `(8 & read())` and `0 != (read() & 8)` also fail. The 16-bit word mask
`(w & 258) != 0` fails because the high masked byte can be nonzero.

## Mainline output that proves the retention

The same bodies outside the NMI route admit with `peek($DD0D)`. They show the compiler-invented
homes:

| Form | Emitted body (mainline, symbols normalised) |
|---|---|
| mask `8` `!=` | `lda $dd0d; and #$08; sta t; lda t; cmp #$01; lda #$00; adc #$00; sta u; lda u; sta flag` |
| mask `8` `==` | same plus one `eor #$01` before the second store |
| mask `3` | same with `and #$03` |
| mask `0` | `and #$00`, then the same comparison retention |
| runtime mask | the read is stored, reloaded, `and mask`; then the same comparison retention |
| word global | `lda w; and #$02; sta t; ...` plus a word `eor/ora` comparison |
| word local constant | the frontend folds the comparison; only the local word store remains |

`sta t; lda t` is the masked-value home. `sta u; lda u` is the comparison-result home. The NMI
proof rejects both.

## Seams

| Location | Current fact |
|---|---|
| `machine/lower-register-forwarding.ts` | The mask-`1` identity and mask-`2`/`4` shift selections exist. No branch materialization is selected. |
| `machine/lower-operation.ts` | The comparison lowering emits `EOR/CMP/LDA #0/ADC #0` for a materialized equality. It has no block-splitting form. |
| `machine/lower-scalar.ts` | A byte `&` returns register A. A word `&` with a byte mask returns `zero-extended` with the low byte in A. There is no zero-mask fold. |
| `machine/lower-function.ts` | The loop already supports block-splitting lowerers (checked division, guarded shifts, aggregate fill). The Boolean comparison can use the same shape. |
| `semantic/nmi-register-locals.ts` | A single-use byte local whose whole life is one store/load pair fed by a direct read is elided. Constant stores and zero-extended word locals are not. |
| `storage/nmi-private-storage.ts` | Rejects every non-installation request. It must stay unchanged. |
| `storage/inventory.ts` | Omits the elided local requests before SFA allocation. |
| `test/rd04/expressiveness-ledger.json` | Row `v4-nmi-retained-source-reads` records the whole remaining class, owned by #149. |

## Test baseline

- Compiler suite at `9c41b8a9`: 223 files, 3,754 passed, 2 skipped.
- #148 spec oracle: 60/60; #147 oracle: 40/40; #100 oracle: 16/16.
- Machine impl 21/21; storage/elision impl 10/10.
- Ledger gate: 14/14; NMI/CIA2 root slice: 32 files/778 tests.
- `yarn build` 4/4 and `yarn typecheck` 7/7 at the #148 closeout.
- VICE 3.10 SHA-256 `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74`.
