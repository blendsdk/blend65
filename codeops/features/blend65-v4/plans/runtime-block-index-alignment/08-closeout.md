# Runtime element block-index alignment — closeout

> **Issue**: [#159](https://github.com/blendsdk/blend65/issues/159), alignment slice
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Preflight**: [00-preflight-report-99-execution-plan.md](00-preflight-report-99-execution-plan.md)
> **Status**: Done (bounded to alignment); bank/ROM diagnostic remains open
> **Recorded**: 2026-11-15

## Delivered

The block-index alignment pass now proves a runtime element address when the element stride is a
multiple of the required alignment and the static prefix/suffix remains aligned:

- `byte[2][64]` with a runtime index receives a 64-byte root alignment; the public memory interval
  reports 64 and the root address is 64-aligned on all four profiles.
- `byte[128]` with a runtime index is not 64-aligned; the byte stride cannot preserve the demand.
- The runtime shift path remains; no runtime mask, helper or check is added.
- The #74 runtime-index oracle now uses the byte-stride control, preserving its original
  "ordinary arithmetic untouched" intent.

## Implementation

| File | Change |
| --- | --- |
| `packages/compiler/src/semantic/block-index-alignment.ts` | `placeAlignment` admits a runtime index only with a demand-multiple stride and aligned static parts |
| `packages/compiler/src/semantic/block-index-alignment.impl.test.ts` | 64-stride positive and byte-stride negative |
| `test/rd04/runtime-block-index-alignment.spec.test.ts` | Four-profile public alignment oracle with a `setSpritePointer` consumer |
| `test/rd04/block-index-alignment.spec.test.ts` | #74 runtime control revised to the byte-stride case |

## Verification

| Tier | Result |
| --- | --- |
| Public runtime alignment oracle | 8/8 across four profiles |
| #74 alignment oracle | 64/64 |
| Implementation | 21/21 |
| Compiler package | 233 files / 3,916 passed / 2 skipped |
| Host checkpoint | 230 files / 5,001 passed |
| `spec/` and ledger | Byte-identical |

## Residuals

| Residual | Owner |
| --- | --- |
| VIC-bank and character-ROM visibility diagnostic for a proved block-index consumer | #158 contract, then #159 |
| Runtime element block-index fold to `base + index` | not claimed by this slice |

## Deferral-expiry check

No deferral's reason is invalidated. The runtime stride proof extends #74's placement contract; the
bank/character-ROM diagnostic is a separate consumer-aware contract owned by #158. #159 stays open
for that acceptance row rather than closing on a partial claim.
