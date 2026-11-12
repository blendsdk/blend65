# Current State — NMI Register-Only Source Reads

> **Updated**: 2026-11-12
> **Baseline**: `a5717bc5` (takeover production approval); clean tree

## Reproduced witnesses

Measured with the public `checkProject`/`buildProject` boundary, optimization `none`, target
`c64-pal-prg-kernal-6581` and its three siblings.

| Form | Result |
|---|---|
| `pendingSources = readAndClearPendingSources();` | Builds on all four profiles |
| `if ((readAndClearPendingSources() & sourceTimerA) != 0) { finished = true; }` | `E10245` on all four profiles |
| `if (readAndClearPendingSources() != 0)` | `E10245` on all four profiles |
| `let pending: byte = readAndClearPendingSources(); if ((pending & sourceTimerA) != 0)` | `E10245` on all four profiles |

## Requests that trigger the failure

`nmiPrivateStorageRoute` rejects every non-installation request in the NMI domain. Instrumenting the
seam shows exactly one request per failing form:

| Form | Offending request |
|---|---|
| bit condition | `temporary`, 1 byte, `retained-value:function:...:v0` |
| bare zero-test | `temporary`, 1 byte, `retained-value:function:...:v0` |
| local | `local`, 1 byte, declared by the `let` |

The `retained-value` request is created by `materialize` in `machine/lower-state.ts` when a register
value must survive a later clobber and is not in `forwardedRegisterValues`.

## Why the value is retained

`machine/lower-register-forwarding.ts` selects adjacent register forwarding. The byte rule at
`selectRegisterForwarding` accepts producers that are `load`, byte `memory-read`, byte bitwise `&|^`
and byte complement, and forwards them into an adjacent bitwise operand or a fixed store. The
producer classes `call` and `platform` are accepted only for a direct fixed store (the assignment
witness), not for a bitwise consumer.

So for `(read() & mask) != 0`:

1. `read()` is a byte `platform` result in A;
2. its only consumer is the byte `&`, but the producer class is not forwarded;
3. `materialize` stores A into a one-byte temporary;
4. the mask reloads it, and the NMI proof sees a private request.

The assignment witness already works because the direct-store rule accepts `call`/`platform` byte
results.

## Downstream lowering already supports the fix

- `lowerBitwise` (`machine/lower-scalar.ts`) loads the left operand with `appendLoadA`; a forwarded
  A costs no instruction, then the immediate ALU operation runs.
- The comparison rule `readOwnsZero` (`machine/lower-operation.ts`) already reuses a forwarded
  producer's fresh Z for a zero test at a branch. The byte mask sets exactly that Z.
- `nmiPrivateStorageRoute` (`storage/nmi-private-storage.ts`) needs no change: removing the request
  is enough.

## Existing tests and fixtures

| Location | Current fact |
|---|---|
| `test/rd04/expressiveness-ledger.json` | Row `v4-nmi-retained-source-reads` is `deferred`, owner `issue #100`, probe retains five samples |
| `test/rd04/expressiveness-ledger.spec.test.ts` | Deferred rows must still fail with their recorded diagnostic; probes are keyed by row id |
| `test/rd05/cia2-vice.spec.test.ts` | Existing CIA2 timer/NMI runtime fixture and VICE pattern |
| `test/rd05/cia2-vice-fixture.ts` | Shared build/observe helper for the CIA2 runtime cases |
| `test/rd05/nmi-route-*.spec.test.ts` | Existing NMI source/output/negative cases |
| `packages/compiler/src/machine/lower-register-forwarding.ts` | Forwarding selection; the byte rule to extend |
| `packages/compiler/src/machine/lower-state.ts` | `materialize`, `retained-value` request creation |

## Test baseline

- Compiler suite at `b69174e3`: 219/219 files, 3,701 passed, 2 skipped.
- `yarn build` 4/4 and `yarn typecheck` 7/7 at the takeover closeout.
- VICE 3.10 SHA-256 `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74`.
