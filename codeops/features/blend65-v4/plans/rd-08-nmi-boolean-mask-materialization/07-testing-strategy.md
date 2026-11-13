# Testing Strategy — NMI Boolean Mask Materialization

> **Parent**: [Index](00-index.md)
> **Updated**: 2026-11-13

The behavior oracle is the frozen platform contract: a handler that materializes a Boolean from a
delivered mask must build, contain no private storage, emit the exact branch or constant sequence,
and run through a genuine NMI. The oracle is not derived from the implementation.

## Author independence

`test/rd08/nmi-boolean-mask-materialization.spec.test.ts` and
`test/rd08/nmi-boolean-mask-materialization-vice.spec.test.ts` are authored by a separate
implementation-blind spec-test author from issue #149, the plan set and the public build interfaces
only. The implementation session writes only `*.impl.test.ts` and satisfies the frozen oracle; it
must not edit a spec oracle to match emitted code.

## Specification cases

### ST-M1 — Delivered forms build

For each of `c64-{pal|ntsc}-prg-kernal-{6581|8580}` and optimization `none`:

- `flag = ((readAndClearPendingSources() & 8) != 0);`
- `flag = ((readAndClearPendingSources() & 8) == 0);`
- `flag = ((readAndClearPendingSources() & 3) != 0);`
- `flag = ((readAndClearPendingSources() & 3) == 0);`
- `flag = ((readAndClearPendingSources() & 0) != 0);`
- `flag = ((readAndClearPendingSources() & 0) == 0);`
- `flag = ((readAndClearPendingSources() & maskValue) != 0);`
- `flag = ((readAndClearPendingSources() & maskValue) == 0);`
- `flag = ((maskValue & readAndClearPendingSources()) != 0);`
- `let w: word = 2; flag = ((w & 2) != 0);`
- `flag = ((w & 2) != 0);` with a placed word global `w`
- `let s: byte = readAndClearPendingSources(); flag = ((s & 8) != 0);`
- `flag = ((8 & readAndClearPendingSources()) != 0);`
- `flag = (0 != (readAndClearPendingSources() & 8));`
- `flag = ((readAndClearPendingSources() & 255) != 0);`
- `let x: byte = 5; flag = ((x & 8) != 0);`
- `flag = ((w & 1) != 0);` with a placed word global `w`

No form produces an error.

### ST-M2 — No private storage

For every positive form:

- no `sfa`, `zeroPage` or `scratch` interval owned by the handler;
- `scratch = 0` and `zeroPage = 0`;
- `acmeReconciled` is true and `hardwareStack = 4`;
- the placed flag is the only added symbol; the word global and mask global are the only other
  placed symbols where the form names them.

### ST-M3 — Exact machine shape

The handler is decoded from its published `debug.ranges`, which must tile the handler code interval
exactly, each range one documented 6510 instruction, ending in `RTI`.

| Form | Required body after the wrapper | Handler bytes |
|---|---|---:|
| mask `8`/`3`, `!=` | `LDA $DD0D; AND #m; BEQ; LDA #$01; STA $C000` | 16 |
| mask `8`/`3`, `==` | `LDA $DD0D; AND #m; BEQ; LDA #$01; EOR #$01; STA $C000` | 18 |
| zero mask, `!=` | `LDA $DD0D; LDA #$00; STA $C000` | 12 |
| zero mask, `==` | `LDA $DD0D; LDA #$01; STA $C000` | 12 |
| runtime mask, `!=` | `LDA $DD0D; AND mask; BEQ; LDA #$01; STA $C000` | 17 |
| runtime mask, `==` | `LDA $DD0D; AND mask; BEQ; LDA #$01; EOR #$01; STA $C000` | 19 |
| word global mask `1`, `!=` | `LDA w; AND #$01; STA $C000` | 12 |
| word global mask `2`, `!=` | `LDA w; AND #$02; LSR; STA $C000` | 13 |
| all-ones mask `255`, `!=` | `LDA $DD0D; BEQ; LDA #$01; STA $C000` | 14 |
| constant byte local plus mask `8` | `LDA #$00; STA $C000` | 9 |
| constant word local, `!=` | `LDA #$01; STA $C000` | 9 |

Exactly one `$DD0D` read per handler where the form names one. No `CMP`, no `ADC`, no
`LDA #$00` followed by `CMP`, no retained-byte load/store, and no second device read. The branch
target must reach the instruction named by the plan, not a helper or a private home. The byte-local,
mirrored-`&` and mirrored-zero forms emit the same body as their direct equivalents.

### ST-M4 — Remaining restrictions still fail

For every profile, each of these still fails `E10245` with no generation and no `out/` directory:

- a shared masked value: `let m = read() & 2; a = m != 0; b = m == 0`
- five simultaneously retained sampled bytes
- a 16-bit word mask with a placed word global: `place(at: $C100) let w: word = 2;
  flag = ((w & 258) != 0)`
- a runtime word local: `let w: word = read(); flag = ((w & 2) != 0)`
- a computed runtime mask: `let m: byte = maskValue | 1; flag = ((read() & m) != 0)`
- a masked value compared to a nonzero constant: `flag = ((read() & 8) == 8)`

### ST-M5 — Sequential VICE behavior

Two PAL/6581 cases, run sequentially:

1. **mask `3`, `!=`**: install the exclusive NMI handler and a source-programmed CIA2 Timer A;
   confirm genuine NMI acceptance, `$C000 = 1`, mainline observes the flag, `restoreNMI` runs, and
   caller return `$E147`.
2. **mask `8`, `==`**: the same with Timer A; the serial bit is clear, so the inverse form yields
   `$C000 = 1`.

Each case records the VICE executable/ROM identity, artifact SHA-256, handler entry, observed global
and caller return. A missing or unidentifiable runtime must fail the case, never skip it.

## Implementation cases

`packages/compiler/src/machine/nmi-boolean-mask-materialization.impl.test.ts`:

- selection records the branch kind for masks `8`, `3`, a runtime addressable mask and a byte-masked
  word; records nothing for mask `1`, `2`, `4`, mask `0` (handled by the folds), a branch condition,
  a multi-use masked value, a computed runtime mask, a 16-bit word mask, a nonzero-constant
  comparison or the mask-`1` mirrored zero test (which keeps its existing left-only identity);
- lowering emits the exact block shape for `!=` and `==`, one branch and no `CMP`/`ADC`;
- the byte-masked word mask `2` uses one `LSR` and no branch; mask `1` uses the identity; the
  all-ones and zero masks omit the `AND`;
- the zero mask emits no `AND` and one constant load;
- the word zero-extended form tests only the low byte;
- handler costs match the design table;
- a constant local is elided and its load yields the constant.

## Regression evidence

- The #148 oracle passes 48/48 after the three authorized mask-8/mask-3/runtime negative
  retirements (five samples kept); the #147 oracle 40/40 and the #100 oracle 16/16.
- `test/rd04/expressiveness-ledger.spec.test.ts` passes with the narrowed row.
- `test/rd05/nmi-route-*.spec.test.ts` and `test/rd05/cia2-*.spec.test.ts` stay green.
- Pinned optimizer artifacts (`test/rd08/optimizer-*`) stay green.
- Complete compiler suite, `yarn build`, `yarn typecheck`, and the affected root suites.

## Verification commands

```sh
yarn workspace @blend65/compiler build
yarn workspace @blend65/compiler test -- src/machine/nmi-boolean-mask-materialization.impl.test.ts
yarn vitest run test/rd08/nmi-boolean-mask-materialization.spec.test.ts
yarn vitest run test/rd08/nmi-boolean-mask-materialization-vice.spec.test.ts
yarn vitest run test/rd04/expressiveness-ledger.spec.test.ts
yarn build
yarn typecheck
yarn workspace @blend65/compiler test
```
