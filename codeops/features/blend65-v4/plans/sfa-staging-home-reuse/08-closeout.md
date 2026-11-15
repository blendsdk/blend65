# SFA staging-home reuse — closeout

> **Issue**: [#146](https://github.com/blendsdk/blend65/issues/146)
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Preflight**: [00-preflight-report-99-execution-plan.md](00-preflight-report-99-execution-plan.md)
> **Status**: Done (bounded to main-domain reuse)
> **Recorded**: 2026-11-15

## Delivered

`retainMachineValue` now reuses the SFA inventory's planned `return-stage` or `argument-stage`
home when the lowering context is main-domain and the request matches the value, storage class,
byte width and has no activation root. The machine program references the planned request ID; no
separate `machine:<owner>:retained-value:<id>` home is created for that value. The planned home is
therefore accessed, counted once, and published as a real debug location.

- The call-result witness (`helper() + helper()`) reuses its `return-stage` home.
- The nested-call witness reuses its `argument-stage` home.
- Interrupt-domain contexts and values without a matching planned home keep the machine-home
  fallback.

## Implementation

| File | Change |
| --- | --- |
| `packages/compiler/src/machine/lower-state.ts` | Planned staging lookup and reuse in `retainMachineValue` |
| `packages/compiler/src/storage/staging-home-reuse.impl.test.ts` | Return-stage, argument-stage and no-second-home cases |

## Preflight and review resolutions

| Finding | Resolution |
| --- | --- |
| Removing the request broke `requiredStorage`/closure (`COMPILER_INCOMPLETE`) | Reuse keeps the request and satisfies the binder. |
| Planned domain is `main`, not only `undefined` | The reuse check accepts both. |
| Interrupt-domain staging | Accepted residual; machine-home fallback. |

## Verification

| Tier | Result |
| --- | --- |
| Implementation | 2/2 |
| Compiler package | 233 files / 3,915 passed / 2 skipped |
| Host checkpoint | 227 files / 4,968 passed |
| Witness build | Succeeds; PRG 657, program 655, code 643, zero-page 0, scratch 0 |
| No second home | The staged value has no `:retained-value:` request and the machine program contains the planned ID |
| `spec/` and ledger | Byte-identical |

## Residuals

| Residual | Owner |
| --- | --- |
| Interrupt-domain staging reuse | machine-home fallback; activation-root matching remains |
| Unmatched values | a machine home is created as before |

## Deferral-expiry check

No deferral's reason is invalidated. The main-domain planned home is now the real home; the
interrupt-domain fallback is an explicit precision boundary, not a deferred correctness gate.
