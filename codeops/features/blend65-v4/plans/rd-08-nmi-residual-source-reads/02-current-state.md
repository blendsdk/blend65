# Current State — NMI Residual Source Reads

> **Updated**: 2026-11-12
> **Baseline**: `a9f3026c` (issue #100 delivery); clean tree

## Reproduced witnesses

Measured with the public `checkProject`/`buildProject` boundary, optimization `none`, target
`c64-pal-prg-kernal-6581` and its three siblings. Every form fails on all four profiles.

| Form | Result | Offending storage |
|---|---|---|
| `if (readAndClearPendingSources() != 0) { flag = true; }` | `E10245` | one `retained-value` temporary |
| `flag = ((readAndClearPendingSources() & 1) != 0);` | `E10245` | two `retained-value` temporaries |
| `if ((readAndClearPendingSources() & maskValue) != 0) { flag = true; }` | `E10245` | one `retained-value` temporary |
| `let sample: byte = readAndClearPendingSources(); sampleOut = sample;` | `E10245` | one `local` home |

## Mainline output that proves the retention

The same bodies outside NMI build. They show exactly the compiler-invented homes the NMI proof
rejects:

| Form | Emitted body (mainline) |
|---|---|
| bare zero test | `lda $dd0d; sta $0950; lda $0950; beq end; ...` |
| Boolean `& 1` value | `lda $dd0d; and #$01; sta $0950; lda $0950; cmp #$01; lda #$00; adc #$00; sta $0951; lda $0951; sta flag` |
| non-constant mask | `lda $dd0d; sta $0950; lda $0950; and maskValue; beq end; ...` |
| single-use local | `lda $dd0d; sta $0950; lda $0950; sta sampleOut` |

The `sta temp; lda temp` pair contributes no source-visible effect and no device access. The local
home `$0950` is the source local, not a compiler temporary, but its only life is the adjacent
store/load pair.

## Seams

| Location | Current fact |
|---|---|
| `machine/lower-register-forwarding.ts` | A sole platform byte result is forwarded into a bitwise only with a constant peer. The zero-test rule accepts load/memory-read/bitwise producers but no platform producer. |
| `machine/lower-operation.ts` | `readOwnsZero` reuses Z for a forwarded producer, but no platform producer can reach it. The materialized `!= 0` branch always emits `CMP #1; LDA #0; ADC #0`. |
| `machine/lower-scalar.ts` | `lowerBitwise` loads the left operand into A and applies the right operand directly. A directly addressable right needs no A load. |
| `storage/inventory.ts` | Every private local receives a `local` request; no elision proof exists. |
| `storage/nmi-private-storage.ts` | Rejects every non-installation request. It must stay unchanged. |
| `test/rd04/expressiveness-ledger.json` | Row `v4-nmi-retained-source-reads` still covers all delivered forms, so it would fail the gate after this change. |
| `test/rd05/cia2-vice.spec.test.ts` | Existing CIA2 timer/NMI runtime fixture and genuine-NMI pattern. |

## Direct volatile byte reads

The platform capabilities whose selected recipe is exactly one `lda absolute` with a volatile read
effect are:

- `c64.cia1.readAndClearPendingSources`
- `c64.cia2.readAndClearPendingSources`
- `c64.input.readJoystick1`
- `c64.input.readJoystick2`
- `c64.vic.readAndClearSpriteSpriteCollisions`
- `c64.vic.readAndClearSpriteBackgroundCollisions`

Only the CIA2/CIA1 members are needed by #147. The explicit set keeps a future multi-instruction
platform operation from inheriting the Z fact.

## Test baseline

- Compiler suite at `a9f3026c`: 220/220 files, 3,709 passed, 2 skipped.
- New #100 spec oracle: 32/32; runtime: 1/1; impl: 8/8; ledger gate: 14/14.
- `yarn build` 4/4 and `yarn typecheck` 7/7 at the #100 closeout.
- VICE 3.10 SHA-256 `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74`.
