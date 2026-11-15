# Impossible masked comparison fold — closeout

> **Issue**: [#151](https://github.com/blendsdk/blend65/issues/151)
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Preflight**: [00-preflight-report-99-execution-plan.md](00-preflight-report-99-execution-plan.md)
> **Status**: Done (byte-mask slice)
> **Recorded**: 2026-11-15

## Delivered

A compile-time byte mask that clears a bit required by the comparison constant now folds to the
constant Boolean, preserving the operand's single volatile read:

```asm
lda $dd0d
lda #$00        ; #$01 for !=
sta finished
```

The previous block was `lda $dd0d; and #$0e; eor #$03; beq …; lda #$01; eor #$01; sta finished`
(16 bytes). The folded block is 8 bytes: an 8-byte saving at this site. The issue's handler table
reports 20→8 because the handler context also removes the surrounding branch/join framing; the
local masked-comparison delta is the same 8 bytes. The accepted folded witness is 655/653/641,
zero-page 0 and scratch 0.

- `(read & 14) == 3` materializes `0`; `!= 3` materializes `1`.
- A reachable constant (`== 2`) keeps `and #$0e` and `eor #$02`.
- A runtime mask does not fold.
- Exactly one ICR read remains; no private home, helper or runtime check is added.
- Word-mask impossibility is not folded in this slice.

## Implementation

| File | Change |
| --- | --- |
| `packages/compiler/src/machine/lower-scalar.ts` | Suppress the dead `AND` for a selected impossible byte mask, keeping the operand read in A |
| `packages/compiler/src/machine/lower-mask-branch.ts` | Materialize the constant Boolean and return only the new immediate |
| `packages/compiler/src/machine/impossible-mask-fold.impl.test.ts` | `==`, `!=`, reachable and runtime-mask cases |
| `test/rd04/impossible-mask-fold.spec.test.ts` | Four-profile assembly oracle |
| `test/rd04/impossible-mask-fold-cost.impl.test.ts` | Exact artifact pin |
| `test/rd04/impossible-mask-fold-vice.spec.test.ts` | Eight native cases for `==`/`!=` on four profiles |

## Review findings and resolutions

| Finding | Resolution |
| --- | --- |
| PF-151-001 dropping the mask could drop the volatile read | The operand is already in A; the fold only appends the constant. The oracle pins one `lda $dd0d`. |
| PF-151-002 returning the prefix duplicated the read | The fold returns only the new immediate; the duplicate was removed and the cost pin confirms it. |
| PF-151-003 word-mask impossibility | **Accepted residual**; the issue witness is a byte mask. |

## Verification

| Tier | Result |
| --- | --- |
| Implementation | 4/4 |
| Assembly oracle | 12/12 across four profiles |
| Cost pin | 655/653/641, zero-page 0, scratch 0 |
| Native VICE | 8/8: `==` stores 0 and `!=` stores 1 on four profiles |
| Compiler package | 236 files / 3,934 passed / 2 skipped |
| Host checkpoint | 241 files / 5,093 passed |
| `spec/` and ledger | Byte-identical |

## Residuals

| Residual | Owner |
| --- | --- |
| Impossible word-mask comparisons | not folded by this slice |
| Volatile read count/order | preserved by the existing single read; assembly oracle pins it |

## Deferral-expiry check

No deferral's reason is invalidated. The fold is a local byte-mask fact over an already-selected
comparison; runtime masks, reachable constants, word masks and volatile read order keep their
existing behavior and owners.
