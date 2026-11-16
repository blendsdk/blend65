# Variable shift zero-count reuse — closeout

> **Issue**: [#131](https://github.com/blendsdk/blend65/issues/131)
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Preflight**: [00-preflight-report-99-execution-plan.md](00-preflight-report-99-execution-plan.md)
> **Status**: Done (bounded-count and fresh-zero slice; fold-safe)
> **Recorded**: 2026-11-15

## Delivered

A straight-line private byte count with a mask/conversion bound drops both saturation tests and
reuses the fresh `LDX` zero flag. The complete checkpoint found the optimized cleanup folding the
count `LDX` into a `TAX` at the storing site, after which an intervening value load owned Z and the
gate tested the value. The count load is now marked `noReloadFold`, so the cleanup keeps it at the
zero gate; the fresh-zero win is preserved and the artifact is safe.

The bounded witness is 124 PRG / 122 program / 110 code bytes, zero-page 0 and scratch 0, from 135
PRG.

- The bounded unsigned right shift uses the same order with `lsr`.
- An unbounded count keeps `CPX #$08`/`BCS` and the bounded fill path; the immediate follows the
  count load.
- A reassignment, an escaping raw write, an aggregate/pointer store or a call clears the bound.
- A word count keeps the high-byte path and both saturation tests.
- The fresh-flags six-byte `BEQ`/shift kernel is already smaller than the issue's seven-byte
  `DEX`/`BMI` countdown, so the countdown is not emitted for this witness.
- The same win moved the optimizer pins: saved `size`/balanced/speed 709→701, `none` 2163→2161,
  acquisition 943→935. The #145 payload gap narrows from 66 to 58 bytes.

## Implementation

| File | Change |
| --- | --- |
| `packages/compiler/src/machine/lower-bounds.ts` | Straight-line private count bound from a dominating store; shared `mayAliasLocals` predicate |
| `packages/compiler/src/machine/lower-variable-shift.ts` | Addressable value first, count `LDX` last with its fresh N/Z |
| `packages/compiler/src/machine/variable-shift-zero-count.impl.test.ts` | Bounded, unbounded, escaping-write, reassignment and word cases |
| `test/rd04/variable-shift-zero-count.spec.test.ts` | Four-profile assembly oracle |
| `test/rd04/variable-shift-zero-count-cost.impl.test.ts` | Exact artifact pin |
| `test/rd04/variable-shift-zero-count-vice.spec.test.ts` | 36 native cases: counts 0/1/7/8 and the word path on four profiles |

## Review findings and resolutions

| Finding | Resolution |
| --- | --- |
| PF-131-001 same-block bound invalidated by aliasing | `mayAliasLocals` clears the fact; reassignment deletes the root. The barriers keep both saturation tests. |
| PF-131-002 `TAX` would clobber A | The fresh-zero order requires an addressable count; a register count keeps the conservative order. |
| PF-131-003 seven-byte countdown | **Accepted residual** — the fresh six-byte kernel is smaller for this witness. |
| Full-checkpoint regression | Fixed with the `noReloadFold` marker: the cleanup keeps the count load at the zero gate; `input-size-runtime` cases pass. |

## Verification

| Tier | Result |
| --- | --- |
| Implementation | 5/5 |
| Assembly oracle | 20/20 across four profiles |
| Cost pin | 124/122/110, zero-page 0, scratch 0 |
| Native VICE | 36/36: counts 0/1/7/8 and the word path on four profiles |
| Compiler package | 236 files / 3,934 passed / 2 skipped |
| Host checkpoint | 243 files / 5,111 passed |
| Optimizer pins | Saved 701, acquisition 935, none 2161 (fresh-zero preserved without the unsafe fold) |
| `spec/` and ledger | Byte-identical |

## Residuals

| Residual | Owner |
| --- | --- |
| Seven-byte `DEX`/`BMI` countdown for a bounded count | not needed; the fresh kernel is smaller |
| Fold-safe marker on other count consumers | none claimed |
| Cross-block count bounds | same-block dominating store only |
| Global count bounds | globals stay unstable; no private-locality proof |

## Deferral-expiry check

No deferral's reason is invalidated. The proof is same-block and private; globals, calls, escaping
writes and reassignment keep the existing conservative sequence. The issue's second slice is not a
missing win: the fresh kernel is smaller than the proposed countdown.
