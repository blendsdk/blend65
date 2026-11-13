# Testing Strategy — RD-08 Residual NMI Forms

> **Parent**: [Index](00-index.md)
> **Updated**: 2026-11-13

## 1. Independent specification oracle

New file `test/rd08/nmi-residual-forms.spec.test.ts` derives only from issue #150 and this plan's
requirements; it runs 77 cases. It must not be edited to match an implementation shortcut.

- Four cooperative profiles: `c64-pal-prg-kernal-6581`, `c64-pal-prg-kernal-8580`,
  `c64-ntsc-prg-kernal-6581`, `c64-ntsc-prg-kernal-8580`.
- For each delivered form: build with `optimization: "none"` and once with the default mode; assert
  success, no zero-page or scratch resource, zero handler-private storage, the exact reported
  `hardwareStack`, and the exact handler byte count.
- Decode the published debug ranges to assert the instruction sequence: the wide join, the
  computed-mask `PHA`/`TSX`/`AND absolute,X`, the identity branch for `(read & 8) == 8`, the nine
  sample slots, and the cross-join/call slot offset.
- Assert the body path-max costs from the documented opcode table, not from the compiler's own cost
  output.
- Assert single volatile access at the source point and the exact store order.

The existing `nmi-boolean-mask-materialization.spec.test.ts` rejection cases for these five forms
are replaced by positive delivery cases in the new oracle; the file keeps its remaining negatives
(address-taken local, genuine proof refusals). This is an authorized contract change recorded in
this plan, not an oracle weakened to fit an implementation.

## 2. Implementation tests

- `packages/compiler/src/machine/nmi-residual-forms.impl.test.ts`: selection boundaries (operand
  order, mask width, constant class, adjacency), the aligned word form, the `masked-word` lowered
  value, and the failure paths (12 cases).
- `packages/compiler/src/storage/nmi-stack-plan.impl.test.ts` (6 cases) and the extended
  `nmi-local-elision.impl.test.ts` (17 cases): dominance accept/reject, slot/depth assignment, the
  removed cap, the cross-store reachability check, the zero-mask initializer and the computed mask.
- `packages/compiler/src/machine/lower-bitwise-stack.impl.test.ts` (or the existing lower-byte
  suite): stack operand mode and `TSX` reuse/invalidations.

## 3. Ledger oracle

`test/rd04/expressiveness-ledger.spec.test.ts` keeps the five probes and the row is set to
`retired`; every probe must build. The JSON row records the delivered boundary and removes the
`#150` owner.

## 4. Runtime oracle

`test/rd08/nmi-residual-forms-vice.spec.test.ts` extends the genuine CIA2 Timer A NMI case. One
handler observes:

- a placed word wide-mask Boolean,
- a computed runtime mask Boolean,
- a nonzero comparison Boolean,
- nine retained samples,
- a sample retained across a join and a stack-balanced call.

The test asserts the final memory, the single ICR read, the handler frame, the reported peak, the
wrapper restore, and the return to the BASIC caller. It runs sequentially with the other VICE cases.

## 5. Verification commands

| Level | Command |
|---|---|
| Focused new oracles | `yarn vitest run test/rd08/nmi-residual-forms.spec.test.ts test/rd08/nmi-residual-forms-vice.spec.test.ts` |
| Affected machine/storage | `yarn vitest run packages/compiler/src/machine packages/compiler/src/storage` |
| NMI/CIA2 route suites | `yarn vitest run test/rd05 test/rd08` (sequential) |
| Compiler suite | `yarn vitest run packages/compiler` |
| Complete owned suite | `yarn test` |
| Build and types | `yarn build && yarn typecheck` |
| Formatting | `yarn prettier --check <touched files>` |
