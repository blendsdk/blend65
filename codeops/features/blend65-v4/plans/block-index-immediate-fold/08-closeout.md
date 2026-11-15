# Symbolic block-index immediate fold — closeout

> **Issue**: [#160](https://github.com/blendsdk/blend65/issues/160)
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Preflight**: [00-preflight-report-99-execution-plan.md](00-preflight-report-99-execution-plan.md)
> **Status**: Done
> **Recorded**: 2026-11-15

## Delivered

A `lo` of a `>> 6` or `/ 64` over one automatic global address, used exactly once, now lowers to a
layout-resolved block-index immediate. The witness's `Game.main` is exactly:

```asm
lda #$2a
sta $07f8
```

That is 5 bytes / 6 nominal cycles with no pointer staging, `LSR`/`ROR`, zero-page or scratch home.
The accepted artifact is PRG 631, program 629, code 617, zero-page 0, scratch 0 (from 702/700/688
and two zero-page bytes before the fold).

- `lo(&buffer)`, `hi(&buffer)`, a dynamic element address, non-block arithmetic and an explicit
  placement keep the ordinary runtime path.
- Nonzero field offsets and zero-page storage are not folded; a misaligned address is a fail-closed
  layout safety net.
- The VIC field transforms and their asset alignment/visibility rules are unchanged.

## Implementation

| File | Change |
| --- | --- |
| `packages/compiler/src/machine/lower-function.ts` | Detect the single-use `lo(/64\|>>6)` shape and its symbolic global address |
| `packages/compiler/src/machine/lower-operation.ts` | Lower the address and block result as labels; skip pointer staging |
| `packages/compiler/src/machine/lower-unary.ts` | Pass the block-index label through `lo` |
| `packages/compiler/src/machine/lower-control.ts`, `machine-types.ts` | Label `addressTransform: "block-index"` and immediate-mode acceptance |
| `packages/compiler/src/layout/c64-layout-objects.ts` | Resolve `(placedAddress >> 6) & 0xff` after final placement |
| `test/rd04/block-index-immediate-fold.spec.test.ts` | Assembly oracle across four profiles |
| `test/rd04/block-index-immediate-cost.impl.test.ts` | Exact artifact pin |

## Review findings and resolutions

| Finding | Resolution |
| --- | --- |
| PF-160-001 binder rejected the label transform | Immediate-mode validation accepts `addressTransform`. |
| PF-160-002 the `lo` materialized a scratch copy | The `lo` passes the label through; the consumer emits one immediate load. |
| PF-160-003 explicit/zero-page/misaligned fallback | Guards keep the runtime path; the layout check fails closed only if that proof is violated. |

## Verification

| Tier | Result |
| --- | --- |
| Assembly oracle | 24/24 across four profiles |
| Cost pin | PRG 631, program 629, code 617, zero-page 0, scratch 0 |
| Compiler package | 233 files / 3,915 passed / 2 skipped |
| Host checkpoint | 229 files / 4,993 passed |
| `spec/` and ledger | Byte-identical |

## Residuals

| Residual | Owner |
| --- | --- |
| Non-`lo` block consumers | not folded by this slice |
| Dynamic/field-offset block indices | runtime path retained |
| VIC asset field transforms | existing mechanism, unchanged |

## Deferral-expiry check

No deferral's reason is invalidated. The #74 alignment repair remains the placement proof; this
slice removes the runtime arithmetic that the repair exposed. The dynamic-index and asset
visibility boundaries keep their existing owners.
