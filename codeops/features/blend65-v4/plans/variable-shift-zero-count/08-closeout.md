# Variable shift zero-count reuse — closeout

> **Issue**: [#131](https://github.com/blendsdk/blend65/issues/131)
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Preflight**: [00-preflight-report-99-execution-plan.md](00-preflight-report-99-execution-plan.md)
> **Status**: Done (bounded-count slice); fresh-zero reopened by the full checkpoint
> **Recorded**: 2026-11-15

## Delivered

A straight-line private byte count with a mask/conversion bound now drops both saturation tests.
The delivered bounded-count slice is 9 bytes. The fresh-zero order (2 additional bytes) was shipped
and then found unsound by the complete checkpoint: the optimized size observer folds the later
`LDX local` into a `TAX` at the storing site, so an intervening value load owns Z and the
fresh-zero gate tests the value. The DELETE/SPACE cases in
`test/rd08/input-size-runtime.spec.test.ts` classified UNCERTAIN. The fresh-zero slice is reopened
and the 700/934 optimizer artifacts are not valid until the observer fold preserves the gate.

- The bounded unsigned right shift uses the same order with `lsr`.
- An unbounded count keeps `CPX #$08`/`BCS` and the bounded fill path; the immediate follows the
  count load.
- A reassignment, an escaping raw write, an aggregate/pointer store or a call clears the bound.
- A word count keeps the high-byte path and both saturation tests.
- The fresh-flags six-byte `BEQ`/shift kernel is already smaller than the issue's seven-byte
  `DEX`/`BMI` countdown, so the countdown is not emitted for this witness.
- The same win moved the optimizer pins: saved `size`/balanced/speed 709→700, `none` 2163→2161,
  acquisition 943→934. The #145 payload gap narrows from 66 to 57 bytes.

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
| Full-checkpoint regression | The size-observer fold moves the count load and loses the fresh Z; the fresh-zero slice is reopened. A fold-proof update or the countdown is required. |

## Verification

| Tier | Result |
| --- | --- |
| Implementation | 5/5 |
| Assembly oracle | 20/20 across four profiles |
| Cost pin | 124/122/110, zero-page 0, scratch 0 |
| Native VICE | 36/36: counts 0/1/7/8 and the word path on four profiles |
| Compiler package | 235 files / 3,930 passed / 2 skipped |
| Host checkpoint | 239 files / 5,080 passed |
| Optimizer pins | 700/934 are the observed but runtime-invalid artifacts; restore the safe 709/943 baseline when the fresh-zero is fixed |
| `spec/` and ledger | Byte-identical |

## Residuals

| Residual | Owner |
| --- | --- |
| Fresh-zero fold-proof update | reopened #131 |
| Seven-byte `DEX`/`BMI` countdown for a bounded count | reopened #131 |
| Cross-block count bounds | same-block dominating store only |
| Global count bounds | globals stay unstable; no private-locality proof |

## Deferral-expiry check

No deferral's reason is invalidated. The proof is same-block and private; globals, calls, escaping
writes and reassignment keep the existing conservative sequence. The issue's second slice is not a
missing win: the fresh kernel is smaller than the proposed countdown.
