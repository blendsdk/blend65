# Testing Strategy — Residual Boolean Masks

> **Parent**: [Index](00-index.md)
> **Updated**: 2026-11-13

The behavior oracle is the frozen platform contract: a handler that materializes a Boolean from a
delivered mask must build, contain no private storage, emit the exact shift sequence, and run through
a genuine NMI. The oracle is not derived from the implementation.

## Author independence

`test/rd08/nmi-residual-boolean-masks.spec.test.ts` and
`test/rd08/nmi-residual-boolean-masks-vice.spec.test.ts` are authored by a separate
implementation-blind spec-test author from issue #148, the plan set and the public build interfaces
only. The implementation session writes only `*.impl.test.ts` and satisfies the frozen oracle; it
must not edit a spec oracle to match emitted code.

## Specification cases

### ST-R1 — Delivered forms build

For each of `c64-{pal|ntsc}-prg-kernal-{6581|8580}` and optimization `none`:

- `flag = ((readAndClearPendingSources() & 2) != 0);`
- `flag = ((readAndClearPendingSources() & 2) == 0);`
- `flag = ((readAndClearPendingSources() & 4) != 0);`
- `flag = ((readAndClearPendingSources() & 4) == 0);`
- `let sample = readAndClearPendingSources(); flag = ((sample & 2) != 0);`
- `let sample = readAndClearPendingSources(); flag = ((sample & 2) == 0);`
- `let sample = readAndClearPendingSources(); flag = ((sample & 4) != 0);`
- `let sample = readAndClearPendingSources(); flag = ((sample & 4) == 0);`
- one mirrored constant-left form, `flag = ((2 & readAndClearPendingSources()) != 0);`
- one mirrored zero test, `flag = (0 != (readAndClearPendingSources() & 2));`
- one mirrored local form, `let sample = readAndClearPendingSources();
  flag = ((2 & sample) != 0);`

No form produces an error.

### ST-R2 — No private storage

For every positive form:

- no `sfa`, `zeroPage` or `scratch` interval owned by the handler;
- `scratch = 0` and `zeroPage = 0`;
- the placed flag is the only added resident symbol;
- `acmeReconciled` is true and `hardwareStack = 4`.

### ST-R3 — Exact machine shape

The handler is decoded from its published `debug.ranges`, which must tile the handler code interval
exactly, each range one documented 6510 instruction, ending in `RTI`.

| Form | Required body after the wrapper | Handler bytes |
|---|---|---:|
| mask 2, `!=` | `LDA $DD0D; AND #$02; LSR A; STA $C000` | 13 |
| mask 4, `!=` | `LDA $DD0D; AND #$04; LSR A; LSR A; STA $C000` | 14 |
| mask 2, `==` | `LDA $DD0D; AND #$02; LSR A; EOR #$01; STA $C000` | 15 |
| mask 4, `==` | `LDA $DD0D; AND #$04; LSR A; LSR A; EOR #$01; STA $C000` | 16 |

Exactly one `$DD0D` read per handler. No `CMP`, `ADC`, `LDA #$00`, retained-byte load/store, or
second device read. The local forms emit the same body.

### ST-R4 — Remaining restrictions still fail

For every profile, each of these still fails `E10245` with no generation and no `out/` directory:

- `flag = ((read() & 8) != 0);`
- `flag = ((read() & 3) != 0);`
- `flag = ((read() & maskValue) != 0);` with `maskValue` a placed global;
- five simultaneously retained sampled bytes in the handler.

### ST-R5 — Sequential VICE behavior

Two PAL/6581 cases, run sequentially:

1. **mask 2, `!=`**: install the exclusive NMI handler and a source-programmed CIA2 Timer B; confirm
   genuine NMI acceptance, `$C000 = 1`, mainline observes the flag, `restoreNMI` runs, and caller
   return `$E147`.
2. **mask 2, `==`**: the same with a Timer A source and the inverse form; `$C000 = 1` because the
   Timer A bit is absent from mask `2`.

Each case records the VICE executable/ROM identity, artifact SHA-256, handler entry, observed global
and caller return. A missing or unidentifiable runtime must fail the case, never skip it.

## Implementation cases

`packages/compiler/src/machine/nmi-residual-boolean-masks.impl.test.ts`:

- selection records shift `1` for mask `2`, `2` for mask `4`, and nothing for mask `1`, mask `8`,
  mask `3`, a runtime mask, a multi-use mask, or a branch-condition consumer;
- mask `1` keeps its existing identity output and cost;
- lowering emits exactly `k` `LSR A` instructions and one `EOR #$01` only for `==`;
- the emitted handler totals match the design table;
- a mirrored constant-left `&` selects the same sequence.

## Regression evidence

- The #147 spec oracle passes 40/40 after the authorized one-case `BOOLEAN_MASK_TWO`
  retirement; the five-sample and borrowed-local negatives stay.
- The issue #100 oracle stays 16/16.
- `test/rd04/expressiveness-ledger.spec.test.ts` passes with the narrowed row.
- `test/rd05/nmi-route-*.spec.test.ts` and `test/rd05/cia2-*.spec.test.ts` stay green.
- Pinned optimizer artifacts (`test/rd08/optimizer-*`) stay green.
- Complete compiler suite, `yarn build`, `yarn typecheck`, and the affected root suites.

## Verification commands

```sh
yarn workspace @blend65/compiler build
yarn workspace @blend65/compiler test -- src/machine/nmi-residual-boolean-masks.impl.test.ts
yarn vitest run test/rd08/nmi-residual-boolean-masks.spec.test.ts
yarn vitest run test/rd08/nmi-residual-boolean-masks-vice.spec.test.ts
yarn vitest run test/rd04/expressiveness-ledger.spec.test.ts
yarn build
yarn typecheck
yarn workspace @blend65/compiler test
```

The root tier owned by the affected seams is run separately: pinned optimizer artifacts, the ledger
gate, the NMI/CIA2 route slice, the foundation status oracle and the profile pipeline.
