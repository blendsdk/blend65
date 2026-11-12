# Testing Strategy — NMI Residual Source Reads

> **Parent**: [Index](00-index.md)
> **Updated**: 2026-11-12

The behavior oracle is the frozen platform contract: a handler that performs one of the four forms
must build, contain no private storage, and run through a genuine NMI. The oracle is not derived from
the implementation.

## Author independence

`test/rd08/nmi-residual-source-reads.spec.test.ts` and
`test/rd08/nmi-residual-source-reads-vice.spec.test.ts` are authored by a separate
implementation-blind spec-test author from issue #147, the four source forms and the public build
interfaces only. The implementation session writes only `*.impl.test.ts` and satisfies the frozen
oracle; it must not edit a spec oracle to match emitted code.

## Specification cases

### ST-R1 — All four forms build

For each of `c64-{pal|ntsc}-prg-kernal-{6581|8580}` and optimization `none`:

- `if (readAndClearPendingSources() != 0) { flag = true; }` builds;
- `flag = ((readAndClearPendingSources() & 1) != 0);` builds, and the `== 0` inverse builds;
- `if ((readAndClearPendingSources() & maskValue) != 0) { flag = true; }` builds, with `maskValue`
  a placed module global;
- `let sample: byte = readAndClearPendingSources(); sampleOut = sample;` builds;
- the same local consumed by `poke($0402, sample)`, by `(sample & 1) != 0`, and by
  `sample != 0` builds.

No form produces `E10245` or any other error.

### ST-R2 — No private storage

For every positive form:

- the memory evidence contains no `sfa`, `zeroPage` or `scratch` interval owned by the handler;
- the resource report shows `scratch = 0` and `zeroPage = 0`;
- the placed globals are the only added resident bytes;
- `acmeReconciled` is true.

### ST-R3 — Exact machine shape

The handler is decoded from its published `debug.ranges`, which must tile the handler code interval
exactly, each range one documented 6510 instruction.

| Form | Required sequence (body, wrapper excluded) |
|---|---|
| bare zero | one `$DD0D` read, then `BEQ` to the end (store on fallthrough) or `BNE` to the store, one `LDA #1`, one store to the flag |
| Boolean `& 1` | one `$DD0D` read, `AND #$01`, one store to the flag, no `CMP`/`LDA #0`/`ADC`; the `== 0` inverse has exactly one `EOR #$01` before the store |
| non-constant mask | one `$DD0D` read, `AND` with the mask's direct address, then `BEQ` to the end (store on fallthrough) or `BNE` to the store, flag store, no reload of the sample |
| local | one `$DD0D` read, one store to the destination, no local home and no reload; a bitwise or zero consumer reuses the same A/flag without a local access |

The branch target and opcode must agree: a `BEQ` must skip the flag store on the zero path, and a
`BNE` must jump to the store on the nonzero path. Accepting any conditional branch is not enough.

No private home appears between the read and its consumer. The read occurs exactly once.

### ST-R4 — Remaining restrictions still fail

For every profile, each of these still fails `E10245` with no generation:

- a Boolean value from a constant mask `2` (`flag = ((read() & 2) != 0)`);
- five simultaneously retained sampled bytes in the handler;
- a local whose address is taken or whose life crosses a block/call.

### ST-R5 — Sequential VICE behavior

Two PAL/6581 cases, run sequentially:

1. **bare zero**: install the exclusive NMI handler and a source-programmed CIA2 Timer A; confirm
   genuine NMI acceptance, the handler stores `$C000 = 1` when the timer bit is set, mainline
   observes the flag, `restoreNMI` runs, and the program returns to the caller.
2. **single-use local**: the same, with the handler body `let sample = read(); sampleOut = sample;`.

Each case records the VICE executable/ROM identity, artifact SHA-256, handler entry, observed global
and caller return. A missing or unidentifiable runtime must fail the case, never skip it.

## Implementation cases

`packages/compiler/src/machine/nmi-residual-source-reads.impl.test.ts`:

- selection adds the read to `forwardedRegisterValues` and `zeroFlagValues` only for the exact
  zero-test shape, the exact `& 1` Boolean shape, and the exact addressable-mask shape;
- a multi-use read, a non-zero comparison, a mask other than `1`, a register mask and a wider producer
  are not forwarded;
- the `== 0` Boolean inverse emits exactly one `EOR #$01`;
- the emitted sequences and costs match the design;
- the local elision helper matches only the adjacent single-use shape and rejects address-taken,
  cross-block, non-direct-initializer and multi-use locals;
- a binding recorded as elided but not matching the expected store/load shape fails lowering loudly
  instead of falling back to a global label; a reverse mismatch cannot occur because lowering consumes
  the inventory's explicit set.

Storage cases in `packages/compiler/src/storage/nmi-local-elision.impl.test.ts`:

- the NMI inventory omits exactly the proved local request;
- a mainline or non-proved local keeps its request;
- the omitted request leaves no interval in `inventory.requests`.

## Regression evidence

- The four issue #100 negative cases that pinned these now-delivered forms are retired by the
  independent spec author under AR-R5b; the five-retained-sample negative stays green.
- `test/rd04/expressiveness-ledger.spec.test.ts` passes with the narrowed row.
- `test/rd05/nmi-route-*.spec.test.ts` and `test/rd05/cia2-*.spec.test.ts` stay green.
- Pinned optimizer artifacts (`test/rd08/optimizer-*`) stay green.
- Complete compiler suite, `yarn build`, `yarn typecheck`, root `yarn test`.

## Verification commands

```sh
yarn workspace @blend65/compiler build
yarn workspace @blend65/compiler test -- src/machine/nmi-residual-source-reads.impl.test.ts src/storage/nmi-local-elision.impl.test.ts
yarn vitest run test/rd08/nmi-residual-source-reads.spec.test.ts
yarn vitest run test/rd08/nmi-residual-source-reads-vice.spec.test.ts
yarn vitest run test/rd04/expressiveness-ledger.spec.test.ts
yarn build
yarn typecheck
yarn test
```

`yarn test` is the root tier: it runs the Turbo package tests and the root corpus. The root corpus owns
the pinned optimizer artifacts and the ledger gate, so a compiler-only run is not sufficient evidence.
