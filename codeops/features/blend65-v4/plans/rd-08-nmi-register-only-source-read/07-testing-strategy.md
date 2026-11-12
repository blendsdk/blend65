# Testing Strategy — NMI Register-Only Source Reads

> **Parent**: [Index](00-index.md)
> **Updated**: 2026-11-12

The behavior oracle is the frozen platform contract: a handler that assigns a consuming read to a
global, or branches on a masked bit of it, must build and run with no private storage. The oracle is
not derived from the implementation.

## Author independence

`test/rd08/nmi-source-read.spec.test.ts` and `test/rd08/nmi-source-read-vice.spec.test.ts` are
authored by a separate implementation-blind spec-test author from issue #100, the two source forms and
the public interfaces only. The implementation session writes only `*.impl.test.ts` and satisfies the
frozen oracle; it must not edit a spec oracle to match emitted code.

## Specification cases

### ST-N1 — Both normal forms build

For each of `c64-{pal|ntsc}-prg-kernal-{6581|8580}`:

- `pendingSources = readAndClearPendingSources();` builds with optimization `none`;
- `if ((readAndClearPendingSources() & sourceTimerA) != 0) { finished = true; }` builds;
- neither produces `E10245` or any other error.

### ST-N2 — No NMI-private storage

For both forms:

- the memory evidence contains no private request for the handler;
- the declared global has exactly one home;
- the resource report shows zero scratch and zero zero-page growth from the handler.

### ST-N3 — Read is still a single volatile access

The emitted handler contains exactly one read of `$DD0D` and one store to the handler's global. The
masked form contains the immediate mask and a conditional branch.

### ST-N4 — Real private homes still fail

For every profile, each of these still fails `E10245` and publishes no artifact:

- five simultaneously retained sampled bytes;
- a single-use local byte in the handler;
- a bare `if (readAndClearPendingSources() != 0)`;
- a mask held in a non-constant operand;
- a Boolean value assigned from the bit test (`finished = ((read() & mask) != 0)`), because its only
  current lowering is eight bytes worse than the expert sequence.

### ST-N6 — Either operand order works

`if ((sourceTimerA & readAndClearPendingSources()) != 0)` builds on all four profiles with no private
request, proving the reversed operand order.

### ST-N5 — Sequential VICE behavior

One PAL/6581 case:

1. install the exclusive NMI handler and a source-programmed CIA2 Timer A;
2. stop at the handler entry and confirm the NMI vector and CIA2 source state;
3. run the handler to completion and confirm the shared global holds the expected timer bit and the
   handler performed exactly one ICR read;
4. stop at the mainline loop exit and confirm the program observed the flag;
5. restore the NMI route, return to the caller, and confirm the artifact hash and VICE identity.

A second PAL/6581 case repeats the assignment witness with the same observation. VICE runs
sequentially; no concurrent `x64sc` instance is used. A missing or unidentifiable runtime must fail the
case, never skip it: an unrun runtime case is not evidence.

## Implementation cases

`packages/compiler/src/machine/nmi-source-read.impl.test.ts`:

- the forwarding selection adds exactly the read result for the conditional witness and adds nothing
  for a multi-use producer, a non-constant mask, or a wider producer;
- the emitted handler is the exact expert sequence;
- byte/cycle/stack costs match the design.

## Regression evidence

- `test/rd04/expressiveness-ledger.spec.test.ts` passes with the narrowed row and its probes.
- `test/rd05/nmi-route-*.spec.test.ts` and `test/rd05/cia2-*.spec.test.ts` stay green.
- Root `yarn test`, `yarn build`, `yarn typecheck`.

## Verification commands

```sh
yarn workspace @blend65/compiler build
yarn workspace @blend65/compiler test -- src/machine/nmi-source-read.impl.test.ts
yarn vitest run test/rd08/nmi-source-read.spec.test.ts
yarn vitest run test/rd08/nmi-source-read-vice.spec.test.ts
yarn vitest run test/rd04/expressiveness-ledger.spec.test.ts
yarn build
yarn typecheck
yarn test
```

`yarn test` is the root tier: it runs the Turbo package tests and the root corpus. The root corpus owns
the pinned optimizer artifacts and the ledger gate, so a compiler-only run is not sufficient evidence.
