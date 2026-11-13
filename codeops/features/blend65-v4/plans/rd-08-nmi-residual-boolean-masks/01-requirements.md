# Requirements Delta — Residual Boolean Masks

> **Issue**: [#148](https://github.com/blendsdk/blend65/issues/148) — "close the remaining NMI
> multi-sample and non-one Boolean restrictions"
> **Parent**: RD-08 measured output debt; issue #147 delivered the ordinary forms
> **Updated**: 2026-11-13

## Requirement mapping

| Source requirement | Current state | Plan deliverable |
|---|---|---|
| #148: a Boolean from a constant mask other than `1` that can meet the expert must build | Every non-`1` mask fails `E10245`; mainline retains the masked byte | Shift-chain identity for constant masks `2` and `4`, both polarities |
| #148: delivered forms meet or beat the hand-written expert sequence, with byte/cycle evidence | No cost exists; admission fails | Exact emitted sequences with handler bytes/cycles and the expert branch comparison |
| #148: no NMI proof relaxation | Existing proof rejects every non-installation private request | No proof change; the comparison result is never retained |
| #148: multi-sample handlers remain `E10245` | Existing negative passes | Keep the negative; record it as a contract boundary |
| #148: independent spec oracles on four profiles plus sequential VICE | None for this form | Build/byte oracle plus one genuine Timer B NMI case |
| #148: honest residual record | Ledger row names the whole mask-not-`1` class | Narrow to masks not delivered, with a live follow-up owner |

## Explicit non-goals

- No NMI proof relaxation or private-home allowance.
- No inline branch block, synthetic label or new materialization framework.
- No mask `8`+ or multi-bit constant mask delivery.
- No runtime-mask Boolean value delivery.
- No multi-sample support.
- No `spec/` edit and no physical-hardware claim.

## Acceptance

1. `flag = ((read() & 2) != 0)`, the `== 0` inverse, and the same two forms for mask `4` build with
   optimization `none` on all four cooperative profiles.
2. An elided single-use local carrying the read builds for mask `2` and `4`.
3. Their memory evidence contains no NMI-private request; the read is a single volatile access and
   the destination is the declared global.
4. Every emitted handler is `LDA $DD0D; AND #imm; LSR ×k; [EOR #$01]; STA flag`, decoded from
   published debug ranges, with no retained byte and no comparison instructions.
5. Handler bytes and selected-CPU path-max cycles meet or beat the expert branch materialization.
6. Constant masks `8` and `3`, a runtime mask, and five retained samples still fail `E10245`.
7. A sequential VICE case proves a genuine CIA2 Timer B NMI produces the mask-`2` Boolean and the
   program returns.
8. The ledger row and docs record the remaining boundary with a live owner.
9. `yarn build`, `yarn typecheck`, the complete compiler suite and the affected root suites pass;
   `spec/` is clean.
