# Early raw-byte argument delivery — execution plan

> **Owner**: issue [#135](https://github.com/blendsdk/blend65/issues/135), blocked slice.
> **Scope mode**: strict. No benchmark-specific rule, no limit change, `none` stays canonical.

## Problem

A private retained-value temporary `t` with one direct store and one direct load can be retargeted
so a raw byte argument is delivered straight to its callee parameter home:

```asm
lda raw              lda raw
sta t          ->    sta parameter
... intervening ...  ... intervening ...
lda t                (removed)
sta parameter        (removed)
```

The measured saved-candidate win is 863 → 857 bytes and `Game.main` 112 → 106. The LowByte
composed-call observer rejects the shape.

## Decision

The lowering rule is understood and measured; the blocker is the **composed-call proof**, not the
codegen legality. `validateComposedLowByte` models each direct-global argument as one contiguous
four-instruction delivery window followed by a contiguous call suffix. An early delivery scatters
the candidate suffix, and `unchanged` compares in-place operand changes position by position, so
the current `removed`/`replacements` model cannot represent the early retarget.

This slice records the blocker with the exact witness and leaves the size mode at 863. No observer
rule is weakened, no benchmark exception is added, and `none` is untouched.

## Tasks

- [x] T-135.1 Record the rule, the measured 863/857 and 112/106 figures, and the current observer model.
- [x] T-135.2 Identify the representation gap: contiguous four-item delivery, one forwarded reload, no early-delivery fact.
- [x] T-135.3 Leave the size frontier and the `none` baseline unchanged.
- [x] T-135.4 Report the blocker for a first-class early-delivery fact.

## Acceptance

| Area | State |
| --- | --- |
| Raw/ABI/effect proof | Existing proof remains complete; no silent 6-byte win. |
| Size frontier | 863 saved candidate unchanged; no observer bypass. |
| `none` | Canonical; unchanged. |
| Early-delivery representation | **Open** — needs a first-class fact or a bounded register/argument plan. |

## Residuals

| Residual | Owner |
| --- | --- |
| First-class early-delivery replacement in the composed-call proof | #135 |
| Bounded register/argument plan keeping the delivery at the call position | #135 |

## Constraints

- `spec/`, the ledger and every limit stay unchanged. No test or VICE journey is weakened. No push.
